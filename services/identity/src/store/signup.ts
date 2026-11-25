import { appendEvents, refuse, uuidv7 } from "@skilient/platform";
import type postgres from "postgres";
import { emailDomain } from "../domain/email";
import { isRecruiterDomain, type AccountRole } from "../domain/signup-gate";
import { loadGateData } from "./gate";
import { currentAgreementVersion } from "./reads";

/**
 * Account creation, ported from `private.handle_new_user` (the trigger on `auth.users`). It runs inside the
 * caller's transaction, after the signup gate (`validateSignup`) has passed; its own checks are the
 * trigger's backstop and keep its messages. Profile and onboarding rows are people's: identity seeds its
 * own gate copy and emits `user.created` (ids and flags only), and people reads the name through
 * GetSignupDetails (decision 2026-11-25).
 */
type Tx = postgres.TransactionSql;
export type Provider = "email" | "google";

export interface NewAccount {
  /** Defaults to a fresh UUIDv7 (the goldens pass the recording's ids). */
  id?: string;
  email: string;
  /** The role asked for; only email sign-ups may ask for one (Google sign-ups are students). */
  role?: AccountRole | null;
  /** The university chosen when one domain belongs to several. */
  universityId?: string | null;
  fullName?: string | null;
  /** The agreement version the user ticked; accepted only when it is the current one. */
  agreementVersion?: number | null;
  provider: Provider;
  /** Google has verified the address; an email sign-up confirms it with a code. */
  confirmed: boolean;
  /** An Argon2id hash for email sign-ups; none for Google. */
  passwordHash?: string | null;
}

/** What `user.created` carries for people to create the profile and onboarding rows. */
export interface UserCreatedPayload {
  role: AccountRole;
  university_id: string | null;
  provider: Provider;
  visibility: "university" | "friends";
  onboarding_complete: boolean;
  onboarding_step: number;
  onboarding_completed_at: string | null;
  status: "active";
  agreement_accepted: boolean;
}

export const USER_CREATED = "user.created";
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Creates the account and everything identity keeps about it, in the caller's transaction. */
export async function createAccount(tx: Tx, input: NewAccount): Promise<{ userId: string; payload: UserCreatedPayload }> {
  const id = input.id ?? uuidv7();
  const email = input.email.trim().toLowerCase();
  const domain = emailDomain(email);
  const asked = input.role ?? "student";
  const role: AccountRole = input.provider === "email" && (asked === "faculty" || asked === "recruiter" || asked === "university_admin") ? asked : "student";
  const data = await loadGateData(tx, [domain]);
  const [now] = await tx<{ now: Date }[]>`select now() as now`;

  let universityId: string | null = null;
  let complete: boolean;
  let visibility: "university" | "friends";
  if (role === "recruiter") {
    if (!isRecruiterDomain(data, domain)) throw refuse("not_allowed", `signup refused: ${domain ?? "(none)"} is not a company email domain`);
    complete = true;
    visibility = "friends";
  } else {
    const kinds = role === "faculty" || role === "university_admin" ? ["faculty", "both"] : ["student", "both"];
    const owners = [...new Set(data.domains.filter((d) => d.domain === domain && kinds.includes(d.kind)).map((d) => d.universityId))];
    if (owners.length === 0) throw refuse("not_allowed", `signup refused: ${domain ?? "(none)"} is not a university email domain`);
    const chosen = input.provider === "email" && input.universityId && UUID.test(input.universityId) ? input.universityId.toLowerCase() : null;
    universityId = chosen && owners.includes(chosen) ? chosen : null;
    if (universityId == null && owners.length === 1) universityId = owners[0]!;
    if (role === "university_admin" && universityId == null) throw refuse("not_allowed", "signup refused: choose the university");
    complete = (role === "faculty" && universityId != null) || role === "university_admin";
    visibility = role === "university_admin" ? "friends" : "university";
  }
  const step = role === "student" ? 1 : 6;
  const fullName = (input.fullName?.trim() || email.split("@")[0] || "").slice(0, 60);

  const inserted = await tx`
    insert into identity.users (id, email, email_confirmed_at, role)
    values (${id}, ${email}, ${input.confirmed ? now!.now : null}, ${role})
    on conflict do nothing`;
  if (inserted.count !== 1) throw refuse("conflict", "account_exists");
  if (input.passwordHash) await tx`insert into identity.password_credentials (user_id, hash, algorithm) values (${id}, ${input.passwordHash}, 'argon2id')`;
  await tx`
    insert into identity.signup_details (user_id, full_name, role, university_id, provider)
    values (${id}, ${fullName || "Skilient user"}, ${role}, ${universityId}, ${input.provider})`;
  // The gate copy starts as what people will create, so the gate is right before people handles the event.
  await tx`
    insert into identity.profile_facts (user_id, has_profile, role, university_id, onboarding_complete, onboarding_step, status)
    values (${id}, true, ${role}, ${universityId}, ${complete}, ${step}, 'active')`;

  const version = await currentAgreementVersion(tx);
  const accepted = version > 0 && input.agreementVersion === version;
  if (accepted) await tx`insert into identity.agreement_acceptances (user_id, version) values (${id}, ${version})`;

  await tx`
    insert into identity.security_events (id, user_id, kind, meta)
    values (${uuidv7()}, ${id}, 'signup', ${JSON.stringify({ provider: input.provider, role })}::text::jsonb)`;

  const payload: UserCreatedPayload = {
    role,
    university_id: universityId,
    provider: input.provider,
    visibility,
    onboarding_complete: complete,
    onboarding_step: step,
    onboarding_completed_at: complete ? now!.now.toISOString() : null,
    status: "active",
    agreement_accepted: accepted,
  };
  await appendEvents(tx, [{ type: USER_CREATED, subjects: [id], payload: { ...payload } }]);
  return { userId: id, payload };
}

/** What a new account entered at sign-up, for people (GetSignupDetails), in one round trip. */
export async function signupDetails(db: postgres.Sql | Tx, userIds: readonly string[]) {
  return db<{ user_id: string; full_name: string; role: AccountRole; university_id: string | null; email_domain: string | null }[]>`
    select s.user_id::text, s.full_name, s.role, s.university_id::text, nullif(split_part(u.email, '@', 2), '') as email_domain
      from identity.signup_details s join identity.users u on u.id = s.user_id
     where s.user_id = any(${[...userIds]}::uuid[]) order by s.user_id`;
}

const RLS = 'new row violates row-level security policy for table "agreement_acceptances"';

/**
 * An agreement acceptance, ported from the table's row-level security (`agreement_acceptances_accept_current`):
 * only your own row, only the current version, only the user id, version and IP hash. A repeat refuses with
 * the unique violation, as today (the method treats it as done).
 */
export async function acceptAgreementRow(tx: Tx, actorId: string | null, row: { user_id: string; version: number; ip_hash?: string | null } & Record<string, unknown>): Promise<number> {
  if (actorId == null) throw refuse("not_signed_in", "not signed in");
  if (Object.keys(row).some((k) => !["user_id", "version", "ip_hash"].includes(k))) throw refuse("not_allowed", "permission denied for table agreement_acceptances");
  const version = await currentAgreementVersion(tx);
  if (row.user_id !== actorId || version === 0 || row.version !== version) throw refuse("not_allowed", RLS);
  const ip = row.ip_hash != null && /^[0-9a-f]{64}$/.test(row.ip_hash) ? row.ip_hash : null;
  const done = await tx`
    insert into identity.agreement_acceptances (user_id, version, ip_hash) values (${actorId}, ${version}, ${ip})
    on conflict do nothing`;
  if (done.count === 0) throw refuse("conflict", 'duplicate key value violates unique constraint "agreement_acceptances_pkey"');
  return done.count;
}
