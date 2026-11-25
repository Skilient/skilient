import { appendEvents, refuse } from "@skilient/platform";
import type postgres from "postgres";
import { emailDomain } from "../domain/email";
import { gateState, guardEmailChange, tokenGateFlags, type GateState, type ProfileFacts, type ProfileStatus } from "../domain/gate-state";
import type { AccountRole, AllowedDomain, DomainKind, GateData } from "../domain/signup-gate";

/**
 * Reads over identity's gate-fact copies (decision 2026-11-25, Q1): the gate state web checks on every page,
 * the flags carried in access tokens, the signup gate's data and the email-change guard. Every read is one
 * round trip.
 */
type Db = postgres.Sql | postgres.TransactionSql;

interface DomainRow {
  domain: string;
  university_id: string;
  kind: DomainKind;
  live_at: string | null;
}

const toDomains = (rows: DomainRow[] | null): AllowedDomain[] =>
  (rows ?? []).map((d) => ({ domain: d.domain, universityId: d.university_id, kind: d.kind, universityLiveAt: d.live_at ? new Date(d.live_at) : null }));

/**
 * The signup gate's data for the given email domains (allowed university domains, the personal-email list
 * and the portals flag), read in one round trip. `now` is the database's clock, as today.
 */
export async function loadGateData(db: Db, domains: readonly (string | null)[]): Promise<GateData> {
  const wanted = [...new Set(domains.filter((d): d is string => d != null))];
  const [row] = await db<{ domains: DomainRow[] | null; personal: string[] | null; portals: unknown; now: Date }[]>`
    select (select json_agg(json_build_object('domain', d.domain, 'university_id', d.university_id, 'kind', d.kind, 'live_at', d.university_live_at)
                             order by d.domain, d.university_id)
              from identity.allowed_domains d where d.domain = any(${wanted}::text[])) as domains,
           (select array_agg(p.domain) from identity.personal_email_domains p where p.domain = any(${wanted}::text[])) as personal,
           (select c.value from identity.gate_config c where c.key = 'portals.enabled') as portals,
           now() as now`;
  return { domains: toDomains(row!.domains), personalDomains: new Set(row!.personal ?? []), portals: row!.portals ?? {}, now: row!.now };
}

interface GateRow {
  email: string | null;
  account_status: string | null;
  has_profile: boolean | null;
  role: AccountRole | null;
  university_id: string | null;
  onboarding_complete: boolean | null;
  onboarding_step: number | null;
  status: ProfileStatus | null;
  org_domain: string | null;
  portals: unknown;
  version: number | null;
  accepted: boolean;
  domains: DomainRow[] | null;
  personal: boolean;
}

/** `public.my_gate_state` over the copies, in one round trip. Side-effect free. */
export async function readGateState(db: Db, userId: string): Promise<GateState> {
  const [row] = await db<GateRow[]>`
    with v as (
      select (select max(a.version) from identity.agreement_versions a where a.published_at is not null and a.published_at <= now()) as version,
             (select c.value from identity.gate_config c where c.key = 'portals.enabled') as portals
    ), me as (
      select u.id, u.email, u.status as account_status, substring(u.email from '@([^@]+)$') as domain from identity.users u where u.id = ${userId}
    )
    select me.email, me.account_status, f.has_profile, f.role, f.university_id, f.onboarding_complete, f.onboarding_step, f.status, o.org_domain,
           v.portals, v.version,
           exists (select 1 from identity.agreement_acceptances a where a.user_id = ${userId} and a.version = v.version) as accepted,
           (select json_agg(json_build_object('domain', d.domain, 'university_id', d.university_id, 'kind', d.kind, 'live_at', d.university_live_at))
              from identity.allowed_domains d where d.domain = me.domain) as domains,
           exists (select 1 from identity.personal_email_domains p where p.domain = me.domain) as personal
      from v
      left join me on true
      left join identity.profile_facts f on f.user_id = me.id and f.has_profile
      left join identity.recruiter_org_domains o on o.user_id = me.id`;
  const r = row!;
  const domain = emailDomain(r.email);
  const profile: ProfileFacts | null = r.has_profile
    ? { role: r.role!, universityId: r.university_id, onboardingComplete: r.onboarding_complete ?? false, onboardingStep: r.onboarding_step ?? 1, status: r.status ?? "active" }
    : null;
  const state = gateState({
    data: { domains: toDomains(r.domains), personalDomains: new Set(r.personal && domain ? [domain] : []), portals: r.portals ?? {} },
    email: r.email,
    profile,
    orgDomain: r.org_domain,
    agreementVersion: r.version,
    accepted: r.accepted,
  });
  // Deletion state is identity's own (decision Q1); people's copy says active or graduate.
  return r.account_status === "deleting" ? { ...state, status: "deleting" } : state;
}

/** The gate flags carried in access tokens (decision 2026-11-25, Q1): the gate state at the time of minting. */
export async function gateFlags(tx: postgres.TransactionSql, userId: string): Promise<Record<string, unknown>> {
  return tokenGateFlags(await readGateState(tx, userId));
}

/** People's facts for one account from the copy, or null when there is no profile. */
export async function profileFacts(db: Db, userId: string): Promise<{ profile: ProfileFacts | null; orgDomain: string | null }> {
  const [row] = await db<{ role: AccountRole; university_id: string | null; onboarding_complete: boolean; onboarding_step: number; status: ProfileStatus; org_domain: string | null; has_profile: boolean | null }[]>`
    select f.has_profile, f.role, f.university_id, f.onboarding_complete, f.onboarding_step, f.status, o.org_domain
      from (select ${userId}::uuid as id) me
      left join identity.profile_facts f on f.user_id = me.id and f.has_profile
      left join identity.recruiter_org_domains o on o.user_id = me.id`;
  if (!row?.has_profile) return { profile: null, orgDomain: row?.org_domain ?? null };
  return {
    profile: { role: row.role, universityId: row.university_id, onboardingComplete: row.onboarding_complete, onboardingStep: row.onboarding_step, status: row.status },
    orgDomain: row.org_domain,
  };
}

/**
 * Changes an account's email under the email-change guards (the triggers `guard_email_change` and
 * `guard_uni_admin_email_change`, ported as `guardEmailChange`). `pending` is an address awaiting
 * confirmation: it is checked, not stored (identity has no pending-change column yet). Returns the number
 * of accounts changed. Used by whatever changes email (not a contract method yet).
 */
export async function changeEmail(tx: postgres.TransactionSql, userId: string, change: { email?: string; pending?: string }): Promise<number> {
  const [user] = await tx<{ email: string }[]>`select email from identity.users where id = ${userId} for update`;
  if (!user) throw refuse("not_found", "account not found");
  const after = change.email?.trim().toLowerCase();
  const pending = change.pending?.trim().toLowerCase();
  const { profile, orgDomain } = await profileFacts(tx, userId);
  const data = await loadGateData(tx, [emailDomain(after), emailDomain(pending)]);
  const refused = guardEmailChange(data, profile, orgDomain, {
    email: { before: user.email, after: after ?? user.email },
    pending: { before: null, after: pending ?? null },
  });
  if (refused) throw refuse("not_allowed", refused);
  if (after == null || after === user.email) return 0;
  const done = await tx`update identity.users set email = ${after}, updated_at = now() where id = ${userId}`;
  if (done.count !== 1) throw refuse("conflict", "email not changed");
  // People keeps each account's email domain for onboarding (decision 2026-11-25, W2 Q9). A domain is not
  // personal data, so it may travel in the event log; the address itself never does.
  const domain = emailDomain(after);
  if (domain !== emailDomain(user.email)) await appendEvents(tx, [{ type: EMAIL_DOMAIN_CHANGED, subjects: [userId], payload: { user_id: userId, email_domain: domain } }]);
  return done.count;
}

export const EMAIL_DOMAIN_CHANGED = "user.email_domain_changed";
