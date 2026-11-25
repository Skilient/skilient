/**
 * Golden replays (compare only) of the sign-up, gate and agreement cases: signup.json (`handle_new_user`,
 * `handle_new_user_roles`, `guard_email_change`, `guard_uni_admin_email_change`, `email_domain_allowed`),
 * signin.json#my_gate_state and agreement.json#acceptance, against identity's schema and its gate copies.
 *
 * People's half (replay.ts, rule 2): the recorded `public.profiles` and `public.onboarding_state` rows are
 * people's. Identity's part of them is the `user.created` event (role, university, onboarding defaults,
 * visibility; no name) plus the name GetSignupDetails returns, so each replayed step rebuilds those rows
 * from exactly that and nothing else. `username` in the gate state is people's too and not in the contract:
 * the replay adds the fixture's value.
 */
import { refuse } from "@skilient/platform";
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyDomainsChanged, applyPortalsChanged, applyProfileGateChanged } from "../../src/store/gate-copies";
import { changeEmail, readGateState } from "../../src/store/gate";
import { currentAgreementVersion } from "../../src/store/reads";
import { acceptAgreementRow, createAccount, signupDetails, USER_CREATED, type NewAccount, type UserCreatedPayload } from "../../src/store/signup";
import { ADMIN, anonymous, call, changes, EMAIL, EXTRA, IP, MOD, NEWBIE, PEER, replay, snapshot, startWorld, step, STUDENT, USERS, type Tx } from "./replay";

const UNI = "9a000000-0000-4000-8000-000000000001";
const UNI_CLOSED = "9a000000-0000-4000-8000-000000000002";
const PORTALS_DEFAULT = { faculty: true, recruiter: false, university: false };
const USERNAME: Record<string, string> = { [STUDENT]: "golden1", [PEER]: "golden2", [ADMIN]: "golden3", [MOD]: "golden4" };

/** The recording's seed, for identity's gate copies (fed here through the consumers' own write functions). */
async function seedGate(tx: Tx): Promise<void> {
  await applyPortalsChanged(tx, PORTALS_DEFAULT);
  await applyDomainsChanged(tx, { university_id: UNI, live_at: new Date(Date.now() - 86_400_000).toISOString(), domains: [{ domain: "golden-uni.test", kind: "both" }] });
  await applyDomainsChanged(tx, { university_id: UNI_CLOSED, live_at: null, domains: [{ domain: "golden-closed.test", kind: "both" }] });
  await tx`insert into identity.personal_email_domains (domain) values ('golden-mail.test')`;
  for (const user of [STUDENT, PEER, ADMIN, MOD])
    await applyProfileGateChanged(tx, { user_id: user, has_profile: true, role: "student", university_id: UNI, onboarding_complete: true, onboarding_step: 6, status: "active" });
  // The local stack publishes agreement versions 1 to 3.
  await tx`insert into identity.agreement_versions (version, title, published_at) values
             (1, 'v1', now() - interval '3 days'), (2, 'v2', now() - interval '2 days'), (3, 'v3', now() - interval '1 day')`;
}

/** Supabase user metadata, as the recorder passed it, mapped onto identity's account creation. */
function account(id: string, email: string, meta: Record<string, string>, provider: "email" | "google" = "email"): NewAccount {
  return {
    id,
    email,
    provider,
    role: (meta["role"] as NewAccount["role"]) ?? null,
    universityId: meta["university_id"] ?? null,
    fullName: meta["full_name"] ?? meta["name"] ?? null,
    agreementVersion: meta["agreement_version"] ? Number(meta["agreement_version"]) : null,
    confirmed: true,
  };
}

/**
 * People's half of a sign-up, rebuilt only from what identity hands people: the `user.created` payload and
 * GetSignupDetails (the name). Restricted to the recording's users, as its snapshots were.
 */
async function peopleHalf(tx: Tx, sinceSeq: string) {
  const events = await tx<{ subjects: string[]; payload: UserCreatedPayload }[]>`
    select subjects::text[] as subjects, payload from platform.events where type = ${USER_CREATED} and seq > ${sinceSeq}::bigint order by seq`;
  const out: Record<string, { added: unknown[]; removed: unknown[] }> = {};
  for (const e of events) {
    const user = e.subjects[0]!;
    if (!USERS.includes(user)) continue;
    // The payload carries ids and flags only (decision 2026-11-25).
    expect(Object.keys(e.payload).sort()).toEqual(
      ["agreement_accepted", "onboarding_complete", "onboarding_completed_at", "onboarding_step", "provider", "role", "status", "university_id", "visibility"].sort(),
    );
    const [details] = await signupDetails(tx, [user]);
    const p = e.payload;
    (out["public.onboarding_state"] ??= { added: [], removed: [] }).added.push({ completed_at: p.onboarding_completed_at, role: p.role, step: p.onboarding_step, user_id: user });
    (out["public.profiles"] ??= { added: [], removed: [] }).added.push({
      delete_after: null,
      full_name: details!.full_name,
      onboarding_complete: p.onboarding_complete,
      role: p.role,
      status: p.status,
      university_id: p.university_id,
      user_id: user,
      visibility: p.visibility,
    });
  }
  return out;
}

const lastSeq = async (tx: Tx) => (await tx<{ s: string }[]>`select coalesce(max(seq), 0)::text as s from platform.events`)[0]!.s;

/** The recorder's `signup`: an account created, with every row it changed (identity's and people's half). */
async function signup(tx: Tx, input: NewAccount) {
  const before = await snapshot(tx);
  const seq = await lastSeq(tx);
  const result = await call(tx, async (sp) => {
    await createAccount(sp, input);
    return undefined;
  });
  return { result, changes: { ...changes(before, await snapshot(tx)), ...(result.ok ? await peopleHalf(tx, seq) : {}) } };
}

const signedIn = (user: string | null) => {
  if (!user) throw refuse("not_signed_in", "not signed in");
  return user;
};

describe("sign-up, gate and agreement goldens", () => {
  let pg: TestDatabase;
  let sql: postgres.Sql;
  beforeAll(async () => ({ pg, sql } = await startWorld()));
  afterAll(async () => {
    await pg?.stop();
  });

  it("signup.json#handle_new_user", () =>
    replay(sql, "signup", "handle_new_user", async (tx) => {
      await seedGate(tx);
      const version = await currentAgreementVersion(tx);
      return {
        student_with_agreement: await signup(tx, account(NEWBIE, EMAIL[NEWBIE]!, { full_name: "Golden Newbie", agreement_version: String(version) })),
        student_without_agreement: await signup(tx, account(EXTRA, EMAIL[EXTRA]!, {})),
        personal_domain_refused: await signup(tx, account("9b000000-0000-4000-8000-0000000000a1", "x@golden-mail.test", {})),
        not_a_university_refused: await signup(tx, account("9b000000-0000-4000-8000-0000000000a2", "x@golden-nowhere.test", {})),
      };
    }));

  it("signup.json#handle_new_user_roles", () =>
    replay(sql, "signup", "handle_new_user_roles", async (tx) => {
      await seedGate(tx);
      const out = {
        recruiter: await signup(tx, account(NEWBIE, "golden.hr@golden-company.test", { role: "recruiter", full_name: "Golden HR" })),
        recruiter_university_domain_refused: await signup(tx, account("9b000000-0000-4000-8000-0000000000a3", "hr@golden-uni.test", { role: "recruiter" })),
        faculty: await signup(tx, account(EXTRA, "golden.prof@golden-uni.test", { role: "faculty", university_id: UNI })),
        google_ignores_role: await signup(tx, account("9b000000-0000-4000-8000-0000000000a4", "golden.g@golden-uni.test", { role: "recruiter" }, "google")),
      };
      // Outside the recording's snapshot: the Google sign-up asked for recruiter and became a student.
      const [g] = await tx<{ role: string }[]>`select role from identity.users where id = '9b000000-0000-4000-8000-0000000000a4'`;
      expect(g?.role).toBe("student");
      return out;
    }));

  it("signup.json#guard_email_change", () =>
    replay(sql, "signup", "guard_email_change", async (tx) => {
      await seedGate(tx);
      return {
        same_university_email: await step(tx, (sp) => changeEmail(sp, STUDENT, { email: "golden.student2@golden-uni.test" })),
        pending_change_to_personal_refused: await step(tx, (sp) => changeEmail(sp, STUDENT, { pending: "x@golden-mail.test" })),
        email_to_other_university_refused: await step(tx, (sp) => changeEmail(sp, STUDENT, { email: "x@golden-closed.test" })),
      };
    }));

  it("signup.json#guard_uni_admin_email_change", () =>
    replay(sql, "signup", "guard_uni_admin_email_change", async (tx) => {
      await seedGate(tx);
      await applyPortalsChanged(tx, { recruiter: true, university: true, faculty: true });
      await createAccount(tx, account(NEWBIE, "golden.office@golden-uni.test", { role: "university_admin", university_id: UNI }));
      return {
        same_university: await call(tx, (sp) => changeEmail(sp, NEWBIE, { email: "golden.office2@golden-uni.test" })),
        personal_refused: await call(tx, (sp) => changeEmail(sp, NEWBIE, { email: "office@golden-mail.test" })),
      };
    }));

  it("signup.json#email_domain_allowed", () =>
    replay(sql, "signup", "email_domain_allowed", async (tx) => {
      await seedGate(tx);
      const allowed = (user: string | null) => call(tx, async (sp) => (await readGateState(sp, signedIn(user))).email_allowed);
      const ok = await allowed(STUDENT);
      await applyProfileGateChanged(tx, { user_id: PEER, has_profile: true, role: "student", university_id: UNI_CLOSED, onboarding_complete: true, onboarding_step: 6, status: "active" });
      return {
        student_at_own_university: ok,
        profile_at_another_university: await allowed(PEER),
        signed_out: await anonymous("email_domain_allowed", () => readGateState(tx, signedIn(null))),
      };
    }));

  it("signin.json#my_gate_state", () =>
    replay(sql, "signin", "my_gate_state", async (tx) => {
      await seedGate(tx);
      await createAccount(tx, account(NEWBIE, EMAIL[NEWBIE]!, {}));
      // `username` is people's (a profile column) and not in the contract: added from the fixture.
      const gate = (user: string | null) => call(tx, async (sp) => ({ ...(await readGateState(sp, signedIn(user))), username: USERNAME[user!] ?? null }));
      return {
        new_student: await gate(NEWBIE),
        onboarded_student_no_agreement: await gate(STUDENT),
        signed_out: await anonymous("my_gate_state", () => readGateState(tx, signedIn(null))),
      };
    }));

  it("agreement.json#acceptance", () =>
    replay(sql, "agreement", "acceptance", async (tx) => {
      await seedGate(tx);
      const current = await currentAgreementVersion(tx);
      const gate = async () => (await readGateState(tx, STUDENT)).agreement_accepted;
      const accept = (actor: string, row: { user_id: string; version: number; ip_hash?: string } & Record<string, unknown>) => (sp: Tx) =>
        acceptAgreementRow(sp, actor, row);
      const before = await gate();
      const accepted = await step(tx, accept(STUDENT, { user_id: STUDENT, version: current, ip_hash: IP }));
      return {
        gate_before: before,
        accepted,
        gate_after: await gate(),
        stale_version_refused: await step(tx, accept(PEER, { user_id: PEER, version: current - 1, ip_hash: IP })),
        other_users_row_refused: await step(tx, accept(PEER, { user_id: ADMIN, version: current, ip_hash: IP })),
        repeat: await step(tx, accept(STUDENT, { user_id: STUDENT, version: current, ip_hash: IP })),
        extra_column_refused: await call(tx, accept(PEER, { user_id: PEER, version: current, accepted_at: new Date().toISOString() })),
      };
    }));
});
