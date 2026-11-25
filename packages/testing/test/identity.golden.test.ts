/**
 * Identity golden recordings (W1). Records what the current stack (local
 * Supabase) returns for every ported identity function, so the W1 service can
 * be held to the same results. The sheet is docs/azure/identity-function-bins.md.
 *
 *   GOLDEN_STACK_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres GOLDEN_RECORD=1 pnpm exec vitest run test/identity.golden.test.ts
 *
 * Without GOLDEN_RECORD it compares the stack with the files. Without
 * GOLDEN_STACK_DB_URL the whole file is skipped. Every case runs in its own
 * transaction that is rolled back: fixture users, universities and domains
 * exist only inside it, and no real user data is read or written.
 */
import { join } from "node:path";
import type postgres from "postgres";
import { describe, expect, it } from "vitest";
import { actAs, assertLocalStack, attempt, callCurrentStackSql, golden, type SqlOutcome, type StackActor } from "../src/golden";

const DB = process.env["GOLDEN_STACK_DB_URL"];
// Unset: the file is skipped (no stack in unit runs). Set to anything but the local stack: it fails here, before any call.
if (DB !== undefined) assertLocalStack(DB);
const DIR = join(import.meta.dirname, "golden", "identity");

// ---------------------------------------------------------------------------
// Fixtures: fixed ids, `.test` domains, no secrets.
// ---------------------------------------------------------------------------
const UNI = "9a000000-0000-4000-8000-000000000001";
const UNI_CLOSED = "9a000000-0000-4000-8000-000000000002";
const STUDENT = "9b000000-0000-4000-8000-000000000001";
const PEER = "9b000000-0000-4000-8000-000000000002";
const ADMIN = "9b000000-0000-4000-8000-000000000003";
const MOD = "9b000000-0000-4000-8000-000000000004";
const NEWBIE = "9b000000-0000-4000-8000-000000000005";
const EXTRA = "9b000000-0000-4000-8000-000000000006";
const USERS = [STUDENT, PEER, ADMIN, MOD, NEWBIE, EXTRA];
const EMAIL: Record<string, string> = {
  [STUDENT]: "golden.student@golden-uni.test",
  [PEER]: "golden.peer@golden-uni.test",
  [ADMIN]: "golden.admin@golden-uni.test",
  [MOD]: "golden.mod@golden-uni.test",
  [NEWBIE]: "golden.newbie@golden-uni.test",
  [EXTRA]: "golden.extra@golden-uni.test",
};
const FACTOR_ADMIN = "9c000000-0000-4000-8000-000000000003";
const FACTOR_MOD = "9c000000-0000-4000-8000-000000000004";
const FACTOR_PEER = "9c000000-0000-4000-8000-000000000002";
const SESSION_PEER_1 = "9d000000-0000-4000-8000-000000000021";
const SESSION_PEER_2 = "9d000000-0000-4000-8000-000000000022";
const SESSION_STUDENT = "9d000000-0000-4000-8000-000000000011";
const IP = "1".repeat(64);
const DEVICE_A = "a".repeat(64);
const DEVICE_B = "b".repeat(64);
const UA = "golden-agent/1.0";
const PORTALS_DEFAULT = { faculty: true, recruiter: false, university: false };

const OWNER: StackActor = { role: "postgres" };
const ANON: StackActor = { role: "anon", claims: { role: "anon" } };
function as(user: string, aal: "aal1" | "aal2" = "aal1"): StackActor {
  return { role: "authenticated", claims: { sub: user, role: "authenticated", aal, email: EMAIL[user] } };
}

/**
 * The staff-role helpers (`require_*`) are executable only by the owner: they run inside security-definer
 * functions, as the owner, with the caller's claims. This actor reproduces exactly that.
 */
function definerAs(user: string, aal: "aal1" | "aal2" = "aal1"): StackActor {
  return { role: "postgres", claims: { sub: user, role: "authenticated", aal, email: EMAIL[user] } };
}
const DEFINER_ANON: StackActor = { role: "postgres", claims: { role: "anon" } };

type Tx = postgres.TransactionSql;
type Row = Record<string, unknown>;

async function insertUser(tx: Tx, id: string, email: string, meta: Row = {}, provider = "email"): Promise<void> {
  await tx.unsafe(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                             raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, '', now(),
             jsonb_build_object('provider', $3::text, 'providers', jsonb_build_array($3::text)), $4::text::jsonb, now(), now())`,
    [id, email, provider, JSON.stringify(meta)],
  );
}

/** The shared world for every case: two universities, a personal domain, four onboarded users, staff roles, factors, sessions. */
/** platform_config is versioned: a new version takes effect, and the transaction's rollback removes it. */
async function setPortals(tx: Tx, value: Row): Promise<void> {
  await tx.unsafe(
    `insert into public.platform_config (key, version, value, reason)
     select 'portals.enabled', coalesce(max(version), 0) + 1, $1::text::jsonb, 'golden recording' from public.platform_config where key = 'portals.enabled'`,
    [JSON.stringify(value)],
  );
}

async function seed(tx: Tx): Promise<void> {
  await setPortals(tx, PORTALS_DEFAULT);
  await tx.unsafe(
    `insert into public.universities (id, name, slug, live_at) values
       ($1, 'Golden University', 'golden-university', now() - interval '1 day'),
       ($2, 'Golden Closed University', 'golden-closed-university', null)`,
    [UNI, UNI_CLOSED],
  );
  await tx.unsafe(
    `insert into public.university_domains (university_id, domain, kind, source) values
       ($1, 'golden-uni.test', 'both', 'ops'), ($2, 'golden-closed.test', 'both', 'ops')`,
    [UNI, UNI_CLOSED],
  );
  await tx`insert into public.personal_email_domains (domain) values ('golden-mail.test')`;
  for (const id of [STUDENT, PEER, ADMIN, MOD]) await insertUser(tx, id, EMAIL[id]!, { full_name: `Golden ${id.slice(-1)}` });
  await tx.unsafe(`update public.profiles set onboarding_complete = true, username = 'golden' || right(user_id::text, 1) where user_id = any($1)`, [
    [STUDENT, PEER, ADMIN, MOD],
  ]);
  await tx.unsafe(`update public.onboarding_state set step = 6, completed_at = now() where user_id = any($1)`, [[STUDENT, PEER, ADMIN, MOD]]);
  await tx.unsafe(
    `insert into public.staff_roles (user_id, role, granted_by) values ($1, 'super_admin', $1), ($2, 'moderator', $1)`,
    [ADMIN, MOD],
  );
  await tx.unsafe(
    `insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at) values
       ($1, $2, 'golden', 'totp', 'verified', now(), now()),
       ($3, $4, 'golden', 'totp', 'verified', now(), now()),
       ($5, $6, 'golden', 'totp', 'verified', now(), now())`,
    [FACTOR_ADMIN, ADMIN, FACTOR_MOD, MOD, FACTOR_PEER, PEER],
  );
  await tx.unsafe(
    `insert into auth.sessions (id, user_id, created_at, updated_at, aal) values
       ($1, $2, now(), now(), 'aal1'), ($3, $2, now(), now(), 'aal2'), ($4, $5, now(), now(), 'aal1')`,
    [SESSION_PEER_1, PEER, SESSION_PEER_2, SESSION_STUDENT, STUDENT],
  );
}

// ---------------------------------------------------------------------------
// Calls and row snapshots
// ---------------------------------------------------------------------------
type Call = SqlOutcome<unknown>;

/** Calls one SQL expression as `actor`; a refusal comes back as its SQLSTATE and message. */
async function call(tx: Tx, actor: StackActor, expr: string, params: unknown[] = []): Promise<Call> {
  const out = await attempt(tx, async (sp) => {
    await actAs(sp, actor);
    const rows = await sp.unsafe(`select ${expr} as v`, params as never[]);
    return (rows[0] as Row | undefined)?.["v"] ?? null;
  });
  await actAs(tx, OWNER);
  return out;
}

/** Runs a statement as `actor` (inserts and updates the app makes directly); returns the affected row count. */
async function exec(tx: Tx, actor: StackActor, text: string, params: unknown[] = []): Promise<Call> {
  const out = await attempt(tx, async (sp) => {
    await actAs(sp, actor);
    return (await sp.unsafe(text, params as never[])).count;
  });
  await actAs(tx, OWNER);
  return out;
}

const SNAPSHOTS: Record<string, string> = {
  "auth.users": `select id, email, email_change, banned_until from auth.users where id = any($1) order by email`,
  "auth.sessions": `select id, user_id, aal from auth.sessions where user_id = any($1) order by id`,
  "auth.mfa_factors": `select id, user_id, factor_type, status from auth.mfa_factors where user_id = any($1) order by id`,
  "public.staff_roles": `select user_id, role, granted_by from public.staff_roles where user_id = any($1) order by user_id, role`,
  "public.security_events": `select user_id, kind, ip_hash, user_agent, meta from public.security_events where user_id = any($1) order by user_id, kind, created_at`,
  "public.user_devices": `select user_id, device_hash, user_agent from public.user_devices where user_id = any($1) order by user_id, device_hash`,
  "private.security_alert_tokens": `select user_id, expires_at, used_at from private.security_alert_tokens where user_id = any($1) order by user_id, used_at nulls first`,
  "private.auth_failures": `select key from private.auth_failures
     where key = any(select private.signin_account_key(e) from unnest($1::text[]) e) or key = 'ip:' || $2::text order by key`,
  "private.mfa_backup_codes": `select user_id, count(*) filter (where used_at is null)::int as unused, count(*) filter (where used_at is not null)::int as used
     from private.mfa_backup_codes where user_id = any($1) group by user_id order by user_id`,
  "public.agreement_acceptances": `select user_id, version, ip_hash from public.agreement_acceptances where user_id = any($1) order by user_id, version`,
  "private.rate_limit_events": `select key from private.rate_limit_events
     where key like 'golden:%' or exists (select 1 from unnest($1::uuid[]) u where key like '%' || u::text) order by key`,
  "public.ops_audit_log": `select staff_id, action, target_type, target_id, reason, before, after from public.ops_audit_log where staff_id = any($1) order by action, target_id`,
  "public.sanctions": `select id, user_id, kind, until, reason, staff_id, lifted_at, lifted_by, lift_reason from public.sanctions where user_id = any($1) order by created_at, kind`,
  "public.profiles": `select user_id, role, university_id, full_name, onboarding_complete, visibility, status, delete_after from public.profiles where user_id = any($1) order by user_id`,
  "public.onboarding_state": `select user_id, role, step, completed_at from public.onboarding_state where user_id = any($1) order by user_id`,
  "public.notifications": `select user_id, type, entity_type, data from public.notifications where user_id = any($1) order by user_id, type`,
  "public.job_runs": `select job, status, rows, error from public.job_runs where job = 'purge-security-data' and started_at >= now() order by job`,
};

/** GitHub link state, snapshotted only by the GitHub cases (token values live in Vault and are never read). */
const GITHUB_SNAPSHOTS: Record<string, string> = {
  "private.github_link_tickets": `select id, user_id, result from private.github_link_tickets where user_id = any($1) order by id`,
  "public.github_accounts": `select user_id, github_id, login, revoked_at from public.github_accounts where user_id = any($1) order by user_id`,
  "private.github_tokens": `select user_id, access_expires_at, refresh_expires_at, access_secret_id is not null as has_access, refresh_secret_id is not null as has_refresh
     from private.github_tokens where user_id = any($1) order by user_id`,
  "public.github_user_installations": `select user_id, installation_id from public.github_user_installations where user_id = any($1) order by user_id, installation_id`,
  "public.github_link_clashes": `select user_id, github_id, github_login, linked_user_id, resolved_at from public.github_link_clashes where user_id = any($1) order by user_id, github_id`,
  "public.sync_jobs": `select user_id, trigger, status, stage, pending from public.sync_jobs where user_id = any($1) order by user_id, created_at`,
};

async function snapshot(tx: Tx, extra: Record<string, string> = {}): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const [table, text] of Object.entries({ ...SNAPSHOTS, ...extra })) {
    const params = table === "private.auth_failures" ? [Object.values(EMAIL), IP] : text.includes("$1") ? [USERS] : [];
    out[table] = (await tx.unsafe(text, params as never[])).map((r) => JSON.stringify(r));
  }
  return out;
}

/** Rows added and removed between two snapshots (an update shows as one of each). */
function changes(before: Record<string, string[]>, after: Record<string, string[]>): Record<string, { added: unknown[]; removed: unknown[] }> {
  const out: Record<string, { added: unknown[]; removed: unknown[] }> = {};
  const minus = (a: string[], b: string[]) => {
    const left = [...b];
    return a.filter((x) => {
      const i = left.indexOf(x);
      if (i === -1) return true;
      left.splice(i, 1);
      return false;
    });
  };
  for (const table of Object.keys(after)) {
    const added = minus(after[table]!, before[table]!).map((x) => JSON.parse(x) as unknown);
    const removed = minus(before[table]!, after[table]!).map((x) => JSON.parse(x) as unknown);
    if (added.length || removed.length) out[table] = { added, removed };
  }
  return out;
}

/** One step with the rows it changed. */
async function step(tx: Tx, actor: StackActor, expr: string, params: unknown[] = [], extra: Record<string, string> = {}) {
  const before = await snapshot(tx, extra);
  const result = await call(tx, actor, expr, params);
  return { result, changes: changes(before, await snapshot(tx, extra)) };
}

async function stepExec(tx: Tx, actor: StackActor, text: string, params: unknown[] = []) {
  const before = await snapshot(tx);
  const result = await exec(tx, actor, text, params);
  return { result, changes: changes(before, await snapshot(tx)) };
}

/** Runs a case on the stack in a rolled-back transaction, then records or compares it. */
async function check(group: string, name: string, run: (tx: Tx) => Promise<unknown>, dropKeys: string[] = []): Promise<void> {
  const out = await callCurrentStackSql(DB!, async (tx) => {
    await seed(tx);
    return run(tx);
  });
  if (!out.ok) throw new Error(`${group}/${name}: setup failed: ${out.code} ${out.message}`);
  const r = golden(join(DIR, `${group}.json`), name, out.value, { dropKeys });
  if (r.status === "differs") expect(r.actual).toEqual(r.expected);
}

/** Random values the functions mint (tokens, codes) are replaced by their shape, never recorded. */
function shape(value: unknown, pattern: RegExp, label: string): unknown {
  if (Array.isArray(value)) return value.map((v) => shape(v, pattern, label));
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value as Row).map(([k, v]) => [k, shape(v, pattern, label)]));
  return typeof value === "string" && pattern.test(value) ? label : value;
}

/** Replaces the value of one key wherever it appears (a minted token), keeping null as null. */
function maskKey(value: unknown, key: string, label: string): unknown {
  if (Array.isArray(value)) return value.map((v) => maskKey(v, key, label));
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value as Row).map(([k, v]) => [k, k === key && v != null ? label : maskKey(v, key, label)]));
  return value;
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------
describe.skipIf(!DB)("identity goldens on the current stack", () => {
  describe("signup gates and account creation", () => {
    const G = "signup";

    it("email_domain", () =>
      check(G, "email_domain", async (tx) => {
        const out: Row = {};
        for (const e of ["Golden.Student@Golden-Uni.TEST", "  a@golden-uni.test ", "no-at-sign", "a@b@golden-uni.test", "", "a@"])
          out[JSON.stringify(e)] = await call(tx, OWNER, "private.email_domain($1)", [e]);
        return out;
      }));

    it("domain_admits_students", () =>
      check(G, "domain_admits_students", async (tx) => ({
        any_university: await call(tx, OWNER, "private.domain_admits_students($1, null)", ["golden-uni.test"]),
        its_university: await call(tx, OWNER, "private.domain_admits_students($1, $2)", ["golden-uni.test", UNI]),
        other_university: await call(tx, OWNER, "private.domain_admits_students($1, $2)", ["golden-uni.test", UNI_CLOSED]),
        personal_domain: await call(tx, OWNER, "private.domain_admits_students($1, null)", ["golden-mail.test"]),
        unknown_domain: await call(tx, OWNER, "private.domain_admits_students($1, null)", ["golden-nowhere.test"]),
      })));

    it("is_recruiter_domain", () =>
      check(G, "is_recruiter_domain", async (tx) => ({
        company: await call(tx, OWNER, "private.is_recruiter_domain($1)", ["golden-company.test"]),
        university: await call(tx, OWNER, "private.is_recruiter_domain($1)", ["golden-uni.test"]),
        personal: await call(tx, OWNER, "private.is_recruiter_domain($1)", ["golden-mail.test"]),
        none: await call(tx, OWNER, "private.is_recruiter_domain(null)"),
      })));

    it("portals_state and portal_enabled", () =>
      check(G, "portals_state", async (tx) => {
        const read = async () => ({
          state: await call(tx, ANON, "public.portals_state()"),
          recruiter: await call(tx, OWNER, "private.portal_enabled('recruiter')"),
          university: await call(tx, OWNER, "private.portal_enabled('university')"),
          faculty: await call(tx, OWNER, "private.portal_enabled('faculty')"),
          unknown: await call(tx, OWNER, "private.portal_enabled('golden')"),
        });
        const closed = await read();
        await setPortals(tx, {recruiter: true, university: true, faculty: false});
        return { closed, open: await read() };
      }));

    it("validate_signup", () =>
      check(G, "validate_signup", async (tx) => {
        const v = (email: string | null, role: string, uni: string | null = null) =>
          call(tx, OWNER, "private.validate_signup($1, $2::public.account_role, $3::uuid)", [email, role, uni]);
        const portalsOff = {
          student_ok: await v("new@golden-uni.test", "student"),
          student_ok_with_university: await v("new@golden-uni.test", "student", UNI),
          student_wrong_university: await v("new@golden-uni.test", "student", UNI_CLOSED),
          student_not_live: await v("new@golden-closed.test", "student"),
          student_personal_domain: await v("new@golden-mail.test", "student"),
          student_unknown_domain: await v("new@golden-nowhere.test", "student"),
          invalid_email: await v("not-an-email", "student"),
          null_email: await v(null, "student"),
          faculty_ok: await v("prof@golden-uni.test", "faculty"),
          faculty_not_live: await v("prof@golden-closed.test", "faculty"),
          recruiter_closed: await v("hr@golden-company.test", "recruiter"),
          university_admin_closed: await v("office@golden-uni.test", "university_admin"),
        };
        await setPortals(tx, {recruiter: true, university: true, faculty: false});
        const portalsOn = {
          recruiter_ok: await v("hr@golden-company.test", "recruiter"),
          recruiter_personal: await v("hr@golden-mail.test", "recruiter"),
          recruiter_university_domain: await v("hr@golden-uni.test", "recruiter"),
          university_admin_ok: await v("office@golden-uni.test", "university_admin", UNI),
          university_admin_not_live: await v("office@golden-closed.test", "university_admin", UNI_CLOSED),
          faculty_closed: await v("prof@golden-uni.test", "faculty"),
        };
        return { portalsOff, portalsOn };
      }));

    it("handle_new_user (trigger on auth.users insert)", () =>
      check(G, "handle_new_user", async (tx) => {
        const version = (await call(tx, OWNER, "private.current_agreement_version()")) as { ok: true; value: number };
        const signup = async (id: string, email: string, meta: Row, provider = "email") => {
          const before = await snapshot(tx);
          const result = await attempt(tx, (sp) => insertUser(sp, id, email, meta, provider));
          return { result, changes: changes(before, await snapshot(tx)) };
        };
        return {
          student_with_agreement: await signup(NEWBIE, EMAIL[NEWBIE]!, { full_name: "Golden Newbie", agreement_version: String(version.value) }),
          student_without_agreement: await signup(EXTRA, EMAIL[EXTRA]!, {}),
          personal_domain_refused: await signup("9b000000-0000-4000-8000-0000000000a1", "x@golden-mail.test", {}),
          not_a_university_refused: await signup("9b000000-0000-4000-8000-0000000000a2", "x@golden-nowhere.test", {}),
        };
      }));

    it("handle_new_user for recruiter, faculty and university_admin metadata", () =>
      check(G, "handle_new_user_roles", async (tx) => {
        const signup = async (id: string, email: string, meta: Row, provider = "email") => {
          const before = await snapshot(tx);
          const result = await attempt(tx, (sp) => insertUser(sp, id, email, meta, provider));
          return { result, changes: changes(before, await snapshot(tx)) };
        };
        return {
          recruiter: await signup(NEWBIE, "golden.hr@golden-company.test", { role: "recruiter", full_name: "Golden HR" }),
          recruiter_university_domain_refused: await signup("9b000000-0000-4000-8000-0000000000a3", "hr@golden-uni.test", { role: "recruiter" }),
          faculty: await signup(EXTRA, "golden.prof@golden-uni.test", { role: "faculty", university_id: UNI }),
          google_ignores_role: await signup("9b000000-0000-4000-8000-0000000000a4", "golden.g@golden-uni.test", { role: "recruiter" }, "google"),
        };
      }));

    it("guard_email_change (trigger on auth.users update)", () =>
      check(G, "guard_email_change", async (tx) => {
        const change = async (column: "email" | "email_change", to: string) => {
          const before = await snapshot(tx);
          const result = await attempt(tx, (sp) => sp.unsafe(`update auth.users set ${column} = $1 where id = $2`, [to, STUDENT]).then((r) => r.count));
          return { result, changes: changes(before, await snapshot(tx)) };
        };
        return {
          same_university_email: await change("email", "golden.student2@golden-uni.test"),
          pending_change_to_personal_refused: await change("email_change", "x@golden-mail.test"),
          email_to_other_university_refused: await change("email", "x@golden-closed.test"),
        };
      }));

    it("guard_uni_admin_email_change (trigger on auth.users update)", () =>
      check(G, "guard_uni_admin_email_change", async (tx) => {
        await setPortals(tx, {recruiter: true, university: true, faculty: true});
        await insertUser(tx, NEWBIE, "golden.office@golden-uni.test", { role: "university_admin", university_id: UNI });
        const change = (to: string) =>
          attempt(tx, (sp) => sp.unsafe(`update auth.users set email = $1 where id = $2`, [to, NEWBIE]).then((r) => r.count));
        return {
          same_university: await change("golden.office2@golden-uni.test"),
          personal_refused: await change("office@golden-mail.test"),
        };
      }));

    it("email_domain_allowed", () =>
      check(G, "email_domain_allowed", async (tx) => {
        const ok = await call(tx, as(STUDENT), "private.email_domain_allowed()");
        await tx.unsafe(`update public.profiles set university_id = $1 where user_id = $2`, [UNI_CLOSED, PEER]);
        return {
          student_at_own_university: ok,
          profile_at_another_university: await call(tx, as(PEER), "private.email_domain_allowed()"),
          signed_out: await call(tx, ANON, "private.email_domain_allowed()"),
        };
      }));
  });

  describe("sign-in, sessions and security events", () => {
    const G = "signin";

    it("my_gate_state", () =>
      check(G, "my_gate_state", async (tx) => {
        await insertUser(tx, NEWBIE, EMAIL[NEWBIE]!, {});
        return {
          new_student: await call(tx, as(NEWBIE), "public.my_gate_state()"),
          onboarded_student_no_agreement: await call(tx, as(STUDENT), "public.my_gate_state()"),
          signed_out: await call(tx, ANON, "public.my_gate_state()"),
        };
      }));

    it("signin key helpers and delay", () =>
      check(G, "signin_helpers", async (tx) => {
        const delays: Row = {};
        for (const n of [0, 9, 10, 11, 12, 14, 15, 20]) delays[String(n)] = await call(tx, OWNER, "private.signin_delay_seconds($1)", [n]);
        return {
          account_key: await call(tx, OWNER, "private.signin_account_key($1)", ["  Golden.Student@Golden-Uni.TEST "]),
          account_key_null: await call(tx, OWNER, "private.signin_account_key(null)"),
          ip_key: await call(tx, OWNER, "private.signin_ip_key($1)", [IP]),
          ip_key_invalid: await call(tx, OWNER, "private.signin_ip_key($1)", ["not-a-hash"]),
          delays,
        };
      }));

    it("signin_status and signin_failed through lockout", () =>
      check(G, "signin_failures", async (tx) => {
        const email = EMAIL[STUDENT]!;
        const fresh = await call(tx, ANON, "public.signin_status($1, $2)", [email, IP]);
        const steps: Row = {};
        for (let i = 1; i <= 11; i++) steps[String(i)] = await step(tx, ANON, "public.signin_failed($1, $2)", [email, IP]);
        return {
          fresh,
          failures: steps,
          status_after: await call(tx, ANON, "public.signin_status($1, $2)", [email, IP]),
          unknown_email: await step(tx, ANON, "public.signin_failed($1, $2)", ["nobody@golden-uni.test", "bad-ip"]),
        };
      }));

    it("record_sign_in and security_not_me", () =>
      check(G, "record_sign_in", async (tx) => {
        const signIn = (device: string, method = "password") =>
          step(tx, as(STUDENT), "public.record_sign_in($1, $2, $3, $4)", [device, IP, UA, method]);
        const first = await signIn(DEVICE_A);
        const again = await signIn(DEVICE_A, "otp");
        const newDevice = await signIn(DEVICE_B, "google");
        const token = (newDevice.result as { ok: true; value: { alert_token: string } }).value.alert_token;
        const notMe = await step(tx, ANON, "public.security_not_me($1)", [token]);
        return {
          first_device: first,
          same_device: again,
          new_device: maskKey(newDevice, "alert_token", "<token>"),
          invalid_device: await call(tx, as(STUDENT), "public.record_sign_in($1, $2, $3, $4)", ["xyz", IP, UA, "password"]),
          invalid_method: await call(tx, as(STUDENT), "public.record_sign_in($1, $2, $3, $4)", [DEVICE_A, IP, UA, "telepathy"]),
          signed_out: await call(tx, ANON, "public.record_sign_in($1, $2, $3, $4)", [DEVICE_A, IP, UA, "password"]),
          not_me: notMe,
          not_me_reused: await call(tx, ANON, "public.security_not_me($1)", [token]),
          not_me_malformed: await call(tx, ANON, "public.security_not_me($1)", ["nope"]),
          not_me_unknown: await call(tx, ANON, "public.security_not_me($1)", ["f".repeat(64)]),
        };
      }, []));

    it("log_security_event", () =>
      check(G, "log_security_event", async (tx) => ({
        password_changed: await step(tx, as(STUDENT), "public.log_security_event($1, $2, $3)", ["password_changed", IP, UA]),
        bad_ip_is_dropped: await step(tx, as(STUDENT), "public.log_security_event($1, $2, $3)", ["mfa_enrolled", "nope", UA]),
        invalid_kind: await call(tx, as(STUDENT), "public.log_security_event($1, $2, $3)", ["sign_in", IP, UA]),
        signed_out: await call(tx, ANON, "public.log_security_event($1, $2, $3)", ["password_changed", IP, UA]),
      })));

    it("purge_security_data (scheduled job)", () =>
      check(G, "purge_security_data", async (tx) => {
        // Only fixture rows may be purgeable, so the recorded row count does not depend on the local stack's
        // data (decision 2026-11-25). Everything here is rolled back.
        await tx`delete from private.rate_limit_events where created_at < now() - interval '1 day'`;
        await tx`delete from private.auth_failures where created_at < now() - interval '1 day'`;
        await tx`delete from private.security_alert_tokens where expires_at < now() - interval '1 day'`;
        await tx`delete from private.mfa_backup_codes where used_at < now() - interval '1 year'`;
        await tx`delete from public.security_events where created_at < now() - interval '1 year'`;
        await tx.unsafe(
          `insert into private.auth_failures (key, created_at) values
             (private.signin_account_key($1), now() - interval '2 days'), (private.signin_account_key($1), now() - interval '1 hour')`,
          [EMAIL[STUDENT]!],
        );
        await tx.unsafe(
          `insert into private.rate_limit_events (key, created_at) values ('golden:old', now() - interval '2 days'), ('golden:new', now())`,
        );
        await tx.unsafe(
          `insert into public.security_events (user_id, kind, created_at) values ($1, 'sign_in', now() - interval '400 days'), ($1, 'sign_in', now())`,
          [STUDENT],
        );
        await tx.unsafe(
          `insert into private.security_alert_tokens (token_hash, user_id, expires_at) values ($1, $2, now() - interval '2 days'), ($3, $2, now() + interval '1 day')`,
          ["0".repeat(64), STUDENT, "2".repeat(64)],
        );
        await tx.unsafe(
          `insert into private.mfa_backup_codes (user_id, code_hash, used_at) values ($1, $2, now() - interval '400 days'), ($1, $3, null)`,
          [STUDENT, "3".repeat(64), "4".repeat(64)],
        );
        return step(tx, OWNER, "private.purge_security_data()");
      }));
  });

  describe("two-factor", () => {
    const G = "two-factor";
    const CODE = /^[2-9a-z]{5}-[2-9a-z]{5}$/;

    it("normalize_backup_code", () =>
      check(G, "normalize_backup_code", async (tx) => {
        const out: Row = {};
        for (const c of ["ABCDE-FGHJK", " abcde fghjk ", "ab-cd_ef!", "", null]) out[JSON.stringify(c)] = await call(tx, OWNER, "private.normalize_backup_code($1)", [c]);
        return out;
      }));

    it("create, count, use and delete backup codes", () =>
      check(G, "backup_codes", async (tx) => {
        const user = as(PEER, "aal2");
        const created = await step(tx, user, "public.create_mfa_backup_codes()");
        const codes = (created.result as { ok: true; value: string[] }).value;
        const remaining = await call(tx, user, "public.mfa_backup_codes_remaining()");
        const used = await step(tx, as(PEER, "aal1"), "public.use_mfa_backup_code($1)", [codes[0]!.toUpperCase()]);
        return {
          create_needs_aal2: await call(tx, as(PEER, "aal1"), "public.create_mfa_backup_codes()"),
          create_signed_out: await call(tx, ANON, "public.create_mfa_backup_codes()"),
          created: shape(created, CODE, "<code>"),
          codes_well_formed: codes.length === 10 && codes.every((c) => CODE.test(c)),
          remaining,
          use_valid_code: used,
          remaining_after_use: await call(tx, as(PEER, "aal1"), "public.mfa_backup_codes_remaining()"),
          use_same_code_again: await call(tx, as(PEER, "aal1"), "public.use_mfa_backup_code($1)", [codes[0]]),
          use_wrong_code: await call(tx, as(PEER, "aal1"), "public.use_mfa_backup_code($1)", ["zzzzz-zzzzz"]),
          use_signed_out: await call(tx, ANON, "public.use_mfa_backup_code($1)", [codes[1]]),
          remaining_signed_out: await call(tx, ANON, "public.mfa_backup_codes_remaining()"),
        };
      }));

    it("delete_mfa_backup_codes", () =>
      check(G, "delete_backup_codes", async (tx) => {
        await call(tx, as(PEER, "aal2"), "public.create_mfa_backup_codes()");
        return {
          deleted: await step(tx, as(PEER, "aal2"), "public.delete_mfa_backup_codes()"),
          signed_out: await call(tx, ANON, "public.delete_mfa_backup_codes()"),
        };
      }));

    it("ops_reset_mfa (staff)", () =>
      check(G, "ops_reset_mfa", async (tx) => {
        const note = "Checked their student card over a video call.";
        await call(tx, as(PEER, "aal2"), "public.create_mfa_backup_codes()");
        return {
          reset: await step(tx, as(ADMIN, "aal2"), "private.ops_reset_mfa($1, $2)", [PEER, note]),
          no_factor_left: await call(tx, as(ADMIN, "aal2"), "private.ops_reset_mfa($1, $2)", [PEER, note]),
          short_note: await call(tx, as(ADMIN, "aal2"), "private.ops_reset_mfa($1, $2)", [MOD, "ok"]),
          self: await call(tx, as(ADMIN, "aal2"), "private.ops_reset_mfa($1, $2)", [ADMIN, note]),
          unknown_account: await call(tx, as(ADMIN, "aal2"), "private.ops_reset_mfa($1, $2)", [NEWBIE, note]),
          admin_without_aal2: await call(tx, as(ADMIN, "aal1"), "private.ops_reset_mfa($1, $2)", [MOD, note]),
          moderator: await call(tx, as(MOD, "aal2"), "private.ops_reset_mfa($1, $2)", [ADMIN, note]),
        };
      }));
  });

  describe("agreement and staff roles", () => {
    const G = "staff";

    it("current_agreement_version", () => check(G, "current_agreement_version", async (tx) => call(tx, OWNER, "private.current_agreement_version()")));

    it("is_staff and staff_roles_of", () =>
      check(G, "is_staff", async (tx) => ({
        admin_aal2_any: await call(tx, as(ADMIN, "aal2"), "public.is_staff()"),
        admin_aal2_moderator: await call(tx, as(ADMIN, "aal2"), "public.is_staff('moderator')"),
        admin_aal1: await call(tx, as(ADMIN, "aal1"), "public.is_staff()"),
        moderator_aal2_moderator: await call(tx, as(MOD, "aal2"), "public.is_staff('moderator')"),
        moderator_aal2_super_admin: await call(tx, as(MOD, "aal2"), "public.is_staff('super_admin')"),
        student_aal2: await call(tx, as(STUDENT, "aal2"), "public.is_staff()"),
        signed_out: await call(tx, ANON, "public.is_staff()"),
        roles_of_admin: await call(tx, OWNER, "private.staff_roles_of($1)", [ADMIN]),
        roles_of_student: await call(tx, OWNER, "private.staff_roles_of($1)", [STUDENT]),
      })));

    it("ops_staff", () =>
      check(G, "ops_staff", async (tx) => {
        // Only the fixture staff exist inside this transaction, so the list does not depend on the local stack's accounts.
        await tx.unsafe(`delete from public.staff_roles where not (user_id = any($1))`, [USERS]);
        return {
          admin: await call(tx, as(ADMIN, "aal2"), "private.ops_staff()"),
          moderator: await call(tx, as(MOD, "aal2"), "private.ops_staff()"),
        };
      }));

    it("grant_staff_role and revoke_staff_role", () =>
      check(G, "grant_revoke", async (tx) => {
        const admin = as(ADMIN, "aal2");
        const reason = "Joins the trust team.";
        const granted = await step(tx, admin, "private.grant_staff_role($1, $2::public.staff_role, $3)", [EMAIL[PEER], "trust_reviewer", reason]);
        return {
          granted,
          already_has_role: await call(tx, admin, "private.grant_staff_role($1, $2::public.staff_role, $3)", [EMAIL[PEER], "trust_reviewer", reason]),
          no_reason: await call(tx, admin, "private.grant_staff_role($1, $2::public.staff_role, $3)", [EMAIL[MOD], "accounts", " "]),
          no_account: await call(tx, admin, "private.grant_staff_role($1, $2::public.staff_role, $3)", ["nobody@golden-uni.test", "accounts", reason]),
          no_two_factor: await call(tx, admin, "private.grant_staff_role($1, $2::public.staff_role, $3)", [EMAIL[STUDENT], "accounts", reason]),
          by_moderator: await call(tx, as(MOD, "aal2"), "private.grant_staff_role($1, $2::public.staff_role, $3)", [EMAIL[PEER], "accounts", reason]),
          revoked: await step(tx, admin, "private.revoke_staff_role($1, $2::public.staff_role, $3)", [PEER, "trust_reviewer", "Left the team."]),
          revoke_missing_role: await call(tx, admin, "private.revoke_staff_role($1, $2::public.staff_role, $3)", [PEER, "trust_reviewer", "Left the team."]),
          revoke_own_super_admin: await call(tx, admin, "private.revoke_staff_role($1, $2::public.staff_role, $3)", [ADMIN, "super_admin", "Stepping down."]),
          revoke_by_moderator: await call(tx, as(MOD, "aal2"), "private.revoke_staff_role($1, $2::public.staff_role, $3)", [ADMIN, "super_admin", "Stepping down."]),
        };
      }));
  });

  describe("account deletion", () => {
    const G = "deletion";

    it("request_account_deletion and cancel_account_deletion", () =>
      check(G, "request_cancel", async (tx) => {
        await insertUser(tx, NEWBIE, EMAIL[NEWBIE]!, {});
        const requested = await step(tx, as(STUDENT), "public.request_account_deletion()");
        return {
          requested,
          // normalise masks timestamps, so the grace period is recorded as an interval.
          delete_after_minus_now: await call(tx, OWNER, "(select (delete_after - now())::text from public.profiles where user_id = $1)", [STUDENT]),
          requested_again: await step(tx, as(STUDENT), "public.request_account_deletion()"),
          cancelled: await step(tx, as(STUDENT), "public.cancel_account_deletion()"),
          cancel_when_none_pending: await call(tx, as(STUDENT), "public.cancel_account_deletion()"),
          staff_refused: await call(tx, as(MOD), "public.request_account_deletion()"),
          not_onboarded: await call(tx, as(NEWBIE), "public.request_account_deletion()"),
          signed_out: await call(tx, ANON, "public.request_account_deletion()"),
        };
      }));

    it("delete_account", () =>
      check(G, "delete_account", async (tx) => {
        await call(tx, as(STUDENT), "public.log_security_event('password_changed', null, null)");
        const notDue = await call(tx, OWNER, "private.delete_account($1)", [STUDENT]);
        await tx.unsafe(`update public.profiles set status = 'deleting', delete_after = now() - interval '1 minute' where user_id = $1`, [STUDENT]);
        return { not_due: notDue, deleted: await step(tx, OWNER, "private.delete_account($1)", [STUDENT]) };
      }));

    it("account_deletion_run (scheduled job)", () =>
      check(G, "account_deletion_run", async (tx) => {
        // Only fixture accounts are due inside this transaction.
        await tx.unsafe(`update public.profiles set status = 'active', delete_after = null where status = 'deleting' and not (user_id = any($1))`, [USERS]);
        await tx.unsafe(`update public.profiles set status = 'deleting', delete_after = now() - interval '1 minute' where user_id = $1`, [STUDENT]);
        await tx.unsafe(`update public.profiles set status = 'deleting', delete_after = now() + interval '1 day' where user_id = $1`, [PEER]);
        return step(tx, OWNER, "private.account_deletion_run()");
      }));
  });

  describe("rate_limit (current definition)", () => {
    const G = "rate-limit";

    it("private.rate_limit", () =>
      check(G, "private", async (tx) => {
        const hits: Row = {};
        for (let i = 1; i <= 4; i++) hits[String(i)] = await step(tx, OWNER, "private.rate_limit($1, $2, $3::interval)", ["golden:limit", 3, "1 hour"]);
        return {
          hits,
          other_key_separate: await call(tx, OWNER, "private.rate_limit($1, $2, $3::interval)", ["golden:other", 3, "1 hour"]),
          empty_key: await call(tx, OWNER, "private.rate_limit($1, $2, $3::interval)", ["", 3, "1 hour"]),
          limit_zero: await call(tx, OWNER, "private.rate_limit($1, $2, $3::interval)", ["golden:limit", 0, "1 hour"]),
          window_too_long: await call(tx, OWNER, "private.rate_limit($1, $2, $3::interval)", ["golden:limit", 3, "2 days"]),
        };
      }));

    it("public.rate_limit", () =>
      check(G, "public", async (tx) => {
        const hits: Row = {};
        for (let i = 1; i <= 3; i++) hits[String(i)] = await call(tx, as(STUDENT), "public.rate_limit($1, $2, $3)", ["golden:public", 2, 60]);
        return {
          hits,
          window_zero: await call(tx, as(STUDENT), "public.rate_limit($1, $2, $3)", ["golden:public", 2, 0]),
          signed_out: await call(tx, ANON, "public.rate_limit($1, $2, $3)", ["golden:public", 2, 60]),
        };
      }));
  });

  describe("agreement acceptance (direct table write under RLS)", () => {
    const G = "agreement";
    const insert = `insert into public.agreement_acceptances (user_id, version, ip_hash) values ($1, $2, $3)`;

    it("four cases", () =>
      check(G, "acceptance", async (tx) => {
        const current = ((await call(tx, OWNER, "private.current_agreement_version()")) as { ok: true; value: number }).value;
        const gate = async () => ((await call(tx, as(STUDENT), "public.my_gate_state()")) as { ok: true; value: Row }).value["agreement_accepted"];
        const before = await gate();
        const accepted = await stepExec(tx, as(STUDENT), insert, [STUDENT, current, IP]);
        return {
          gate_before: before,
          accepted,
          gate_after: await gate(),
          stale_version_refused: await stepExec(tx, as(PEER), insert, [PEER, current - 1, IP]),
          other_users_row_refused: await stepExec(tx, as(PEER), insert, [ADMIN, current, IP]),
          repeat: await stepExec(tx, as(STUDENT), insert, [STUDENT, current, IP]),
          extra_column_refused: await exec(tx, as(PEER), `insert into public.agreement_acceptances (user_id, version, accepted_at) values ($1, $2, now())`, [PEER, current]),
        };
      }));
  });

  describe("ban path (sanctions)", () => {
    const G = "ban";
    const ban = "private.sanction_user($1, $2, $3::timestamptz, $4, null)";

    it("ban, session end, audit, lift", () =>
      check(G, "ban_and_lift", async (tx) => {
        const admin = as(ADMIN, "aal2");
        const banned = await step(tx, admin, ban, [PEER, "ban", null, "Repeated harassment."]);
        const id = (banned.result as { ok: true; value: string }).value;
        return {
          banned,
          // normalise masks every timestamp, so the permanent-ban sentinel is checked here.
          banned_until_is_permanent_sentinel: await call(tx, OWNER,
            "(select banned_until = timestamptz '2999-12-31 00:00:00+00' from auth.users where id = $1)", [PEER]),
          banned_again_refused: await call(tx, admin, ban, [PEER, "ban", null, "Again."]),
          lift_by_moderator_refused: await call(tx, as(MOD, "aal2"), "private.lift_sanction($1, $2)", [id, "Appeal upheld."]),
          lifted: await step(tx, admin, "private.lift_sanction($1, $2)", [id, "Appeal upheld."]),
          lift_again_refused: await call(tx, admin, "private.lift_sanction($1, $2)", [id, "Appeal upheld."]),
        };
      }));

    it("refusals", () =>
      check(G, "refusals", async (tx) => ({
        moderator_ban: await step(tx, as(MOD, "aal2"), ban, [PEER, "ban", null, "Repeated harassment."]),
        admin_without_aal2: await call(tx, as(ADMIN, "aal1"), ban, [PEER, "ban", null, "Repeated harassment."]),
        student: await call(tx, as(STUDENT, "aal2"), ban, [PEER, "ban", null, "Repeated harassment."]),
        signed_out: await call(tx, ANON, ban, [PEER, "ban", null, "Repeated harassment."]),
        self: await call(tx, as(ADMIN, "aal2"), ban, [ADMIN, "ban", null, "Testing."]),
        no_reason: await call(tx, as(ADMIN, "aal2"), ban, [PEER, "ban", null, " "]),
        past_end: await call(tx, as(ADMIN, "aal2"), ban, [PEER, "ban", "2000-01-01T00:00:00Z", "Repeated harassment."]),
        unknown_account: await call(tx, as(ADMIN, "aal2"), ban, [NEWBIE, "ban", null, "Repeated harassment."]),
        bad_kind: await call(tx, as(ADMIN, "aal2"), ban, [PEER, "delete", null, "Repeated harassment."]),
      })));

    it("moderator suspension ends sessions without a ban", () =>
      check(G, "suspend", async (tx) => {
        const until = (((await call(tx, OWNER, "(now() + interval '3 days')::text")) as { ok: true; value: string }).value);
        const tooLong = (((await call(tx, OWNER, "(now() + interval '8 days')::text")) as { ok: true; value: string }).value);
        const suspended = await step(tx, as(MOD, "aal2"), ban, [PEER, "suspend", until, "Spam in chat."]);
        return {
          suspended,
          banned_until_after_suspend: await call(tx, OWNER, "(select banned_until from auth.users where id = $1)", [PEER]),
          suspend_again_refused: await call(tx, as(MOD, "aal2"), ban, [PEER, "suspend", until, "Spam in chat."]),
          too_long_for_moderator: await call(tx, as(MOD, "aal2"), ban, [STUDENT, "suspend", tooLong, "Spam in chat."]),
          warn: await step(tx, as(MOD, "aal2"), ban, [STUDENT, "warn", null, "Please keep it civil."]),
        };
      }));
  });

  describe("staff-role helpers (require_*)", () => {
    const G = "require";
    /** PEER becomes the role under test; MOD stays a moderator, ADMIN a super admin. */
    const withRole = (tx: Tx, role: string) =>
      tx.unsafe(`insert into public.staff_roles (user_id, role, granted_by) values ($1, $2::public.staff_role, $3)`, [PEER, role, ADMIN]);
    /** The same call by each kind of actor, one after another (one transaction runs one statement at a time). */
    const run = async (tx: Tx, expr: string, params: unknown[] = []): Promise<Row> => {
      const actors: [string, StackActor][] = [
        ["holder_aal2", definerAs(PEER, "aal2")],
        ["holder_aal1", definerAs(PEER, "aal1")],
        ["super_admin_aal2", definerAs(ADMIN, "aal2")],
        ["moderator_aal2", definerAs(MOD, "aal2")],
        ["student_aal2", definerAs(STUDENT, "aal2")],
        ["signed_out", DEFINER_ANON],
      ];
      const out: Row = {};
      for (const [name, actor] of actors) out[name] = await call(tx, actor, expr, params);
      return out;
    };

    it("require_trust_reviewer", () =>
      check(G, "require_trust_reviewer", async (tx) => {
        await withRole(tx, "trust_reviewer");
        return run(tx, "private.require_trust_reviewer()");
      }));

    it("require_accounts", () =>
      check(G, "require_accounts", async (tx) => {
        await withRole(tx, "accounts");
        return run(tx, "private.require_accounts()");
      }));

    it("require_accounts_or_admin", () =>
      check(G, "require_accounts_or_admin", async (tx) => {
        await withRole(tx, "accounts");
        await tx.unsafe(`insert into public.university_admins (user_id, university_id, role) values ($1, $2, 'admin'), ($3, $2, 'comms')`, [
          STUDENT,
          UNI,
          MOD,
        ]);
        const expr = "private.require_accounts_or_admin($1::uuid)";
        return {
          accounts_staff: await run(tx, expr, [null]),
          university_admin_own_university_aal2: await call(tx, definerAs(STUDENT, "aal2"), expr, [UNI]),
          university_admin_own_university_aal1: await call(tx, definerAs(STUDENT, "aal1"), expr, [UNI]),
          university_admin_other_university: await call(tx, definerAs(STUDENT, "aal2"), expr, [UNI_CLOSED]),
          university_admin_no_university_given: await call(tx, definerAs(STUDENT, "aal2"), expr, [null]),
          comms_role_is_not_admin: await call(tx, definerAs(MOD, "aal2"), expr, [UNI]),
        };
      }));

    it("require_appeal_decider", () =>
      check(G, "require_appeal_decider", async (tx) => {
        await withRole(tx, "trust_reviewer");
        const appeal = (decider: string, original: string) =>
          JSON.stringify({
            id: "9e000000-0000-4000-8000-000000000001",
            decision_type: "sanction",
            decision_id: "9e000000-0000-4000-8000-000000000002",
            appellant_id: STUDENT,
            body: "Please look at this again.",
            original_staff_id: original,
            decider_role: decider,
            status: "pending",
          });
        const expr = "private.require_appeal_decider(jsonb_populate_record(null::public.appeals, $1::text::jsonb))";
        return {
          moderator_decides_moderator_appeal: await call(tx, definerAs(MOD, "aal2"), expr, [appeal("moderator", ADMIN)]),
          moderator_made_the_original_decision: await call(tx, definerAs(MOD, "aal2"), expr, [appeal("moderator", MOD)]),
          trust_reviewer_on_moderator_appeal: await call(tx, definerAs(PEER, "aal2"), expr, [appeal("moderator", ADMIN)]),
          trust_reviewer_on_trust_appeal: await call(tx, definerAs(PEER, "aal2"), expr, [appeal("trust_reviewer", MOD)]),
          super_admin_on_any_appeal: await call(tx, definerAs(ADMIN, "aal2"), expr, [appeal("accounts", MOD)]),
          moderator_without_aal2: await call(tx, definerAs(MOD, "aal1"), expr, [appeal("moderator", ADMIN)]),
          student: await call(tx, definerAs(STUDENT, "aal2"), expr, [appeal("moderator", ADMIN)]),
        };
      }));

    it("require_super_admin", () =>
      check(G, "require_super_admin", async (tx) => ({
        super_admin_aal2: await call(tx, definerAs(ADMIN, "aal2"), "private.require_super_admin()"),
        super_admin_aal1: await call(tx, definerAs(ADMIN, "aal1"), "private.require_super_admin()"),
        moderator_aal2: await call(tx, definerAs(MOD, "aal2"), "private.require_super_admin()"),
        student_aal2: await call(tx, definerAs(STUDENT, "aal2"), "private.require_super_admin()"),
        signed_out: await call(tx, DEFINER_ANON, "private.require_super_admin()"),
      })));

    it("require_moderator", () =>
      check(G, "require_moderator", async (tx) => {
        await withRole(tx, "moderator");
        return run(tx, "private.require_moderator()");
      }));

    it("require_any_staff", () =>
      check(G, "require_any_staff", async (tx) => {
        await withRole(tx, "trust_reviewer");
        return run(tx, "private.require_any_staff()");
      }));
  });

  describe("GitHub writes into identity data", () => {
    const G = "github";
    const T1 = "9f000000-0000-4000-8000-000000000001";
    const T2 = "9f000000-0000-4000-8000-000000000002";
    const T3 = "9f000000-0000-4000-8000-000000000003";
    // Fixture strings, not credentials: complete_github_link stores them in Vault inside the rolled-back transaction.
    const installs = JSON.stringify([{ id: 7001, account_id: 9001, account_login: "golden-octo", account_type: "User" }]);
    const link = (tx: Tx, ticket: string, githubId: number, login: string) =>
      step(
        tx,
        OWNER,
        "private.complete_github_link($1::uuid, $2::bigint, $3, 'golden-access-fixture', now() + interval '8 hours', 'golden-refresh-fixture', now() + interval '180 days', $4::text::jsonb)",
        [ticket, githubId, login, installs],
        GITHUB_SNAPSHOTS,
      );
    const ticket = (tx: Tx, id: string, user: string, claimed: string, result: string | null = null) =>
      tx.unsafe(
        `insert into private.github_link_tickets (id, user_id, code, claimed_at, result) values ($1, $2, 'golden-code', now() - $3::interval, $4)`,
        [id, user, claimed, result],
      );

    it("complete_github_link", () =>
      check(G, "complete_github_link", async (tx) => {
        await ticket(tx, T1, STUDENT, "1 minute");
        await ticket(tx, T2, STUDENT, "11 minutes");
        await ticket(tx, T3, PEER, "1 minute");
        const linked = await link(tx, T1, 9001, "golden-octo");
        return {
          linked,
          ticket_used_again: await link(tx, T1, 9001, "golden-octo"),
          ticket_expired: await link(tx, T2, 9001, "golden-octo"),
          ticket_unknown: await link(tx, "9f000000-0000-4000-8000-0000000000ff", 9001, "golden-octo"),
          clash_with_another_account: await link(tx, T3, 9001, "golden-octo"),
        };
      }));

    it("complete_github_link: relink and other account", () =>
      check(G, "complete_github_link_relink", async (tx) => {
        await ticket(tx, T1, STUDENT, "1 minute");
        await ticket(tx, T2, STUDENT, "1 minute");
        await ticket(tx, T3, STUDENT, "1 minute");
        await link(tx, T1, 9001, "golden-octo");
        return {
          same_github_account_new_login: await link(tx, T2, 9001, "golden-octo-renamed"),
          different_github_account: await link(tx, T3, 9002, "golden-other"),
        };
      }));

    it("disconnect_github", () =>
      check(G, "disconnect_github", async (tx) => {
        await ticket(tx, T1, STUDENT, "1 minute");
        await link(tx, T1, 9001, "golden-octo");
        return {
          disconnected: await step(tx, as(STUDENT), "public.disconnect_github()", [], GITHUB_SNAPSHOTS),
          not_linked: await step(tx, as(STUDENT), "public.disconnect_github()", [], GITHUB_SNAPSHOTS),
          other_user_not_linked: await call(tx, as(PEER), "public.disconnect_github()"),
          signed_out: await call(tx, ANON, "public.disconnect_github()"),
        };
      }));
  });

  describe("the 17 access-rule policies that call identity functions (refusal tests)", () => {
    const G = "policies";
    const CASE = "9e100000-0000-4000-8000-000000000001";
    const REPORT = "9e100000-0000-4000-8000-000000000002";
    /** NEWBIE becomes a trust reviewer and EXTRA an accounts staff member; MOD is a moderator, ADMIN a super admin. */
    async function staff(tx: Tx): Promise<void> {
      await insertUser(tx, NEWBIE, EMAIL[NEWBIE]!, {});
      await insertUser(tx, EXTRA, EMAIL[EXTRA]!, {});
      await tx.unsafe(`insert into public.staff_roles (user_id, role, granted_by) values ($1, 'trust_reviewer', $3), ($2, 'accounts', $3)`, [NEWBIE, EXTRA, ADMIN]);
    }
    const ACTORS: [string, StackActor][] = [
      ["owner_student", as(STUDENT, "aal2")],
      ["other_student", as(PEER, "aal2")],
      ["moderator_aal2", as(MOD, "aal2")],
      ["moderator_aal1", as(MOD, "aal1")],
      ["trust_reviewer_aal2", as(NEWBIE, "aal2")],
      ["accounts_aal2", as(EXTRA, "aal2")],
      ["super_admin_aal2", as(ADMIN, "aal2")],
      ["super_admin_aal1", as(ADMIN, "aal1")],
      ["signed_out", ANON],
    ];
    /** How many of the fixture rows each actor can read through the policy. */
    async function visible(tx: Tx, from: string, params: unknown[] = []): Promise<Record<string, unknown>> {
      const out: Record<string, unknown> = {};
      for (const [name, actor] of ACTORS) {
        const r = await call(tx, actor, `(select count(*)::int from ${from})`, params);
        out[name] = r.ok ? r.value : `refused ${r.code}`;
      }
      return out;
    }
    /** Every actor outside `allowed` must see nothing (0 rows, or the read refused outright). */
    function assertRefused(seen: Record<string, unknown>, allowed: string[]): void {
      for (const [name, value] of Object.entries(seen)) {
        if (allowed.includes(name)) expect(value, `${name} should see the row`).toBe(1);
        else expect(value === 0 || String(value).startsWith("refused"), `${name} must not see the row (saw ${String(value)})`).toBe(true);
      }
    }
    const policy = (name: string, allowed: string[], run: (tx: Tx) => Promise<Record<string, unknown>>) =>
      it(name, () =>
        check(G, name, async (tx) => {
          await staff(tx);
          const seen = await run(tx);
          assertRefused(seen, allowed);
          return seen;
        }),
      );

    it("agreement_acceptances_accept_current (insert)", () =>
      check(G, "agreement_acceptances_accept_current", async (tx) => {
        const v = ((await call(tx, OWNER, "private.current_agreement_version()")) as { ok: true; value: number }).value;
        const ins = (actor: StackActor, user: string, version: number) =>
          exec(tx, actor, `insert into public.agreement_acceptances (user_id, version) values ($1, $2)`, [user, version]);
        const out = {
          own_row_current_version: await ins(as(STUDENT), STUDENT, v),
          own_row_stale_version: await ins(as(PEER), PEER, v - 1),
          someone_elses_row: await ins(as(PEER), STUDENT, v),
          signed_out: await ins(ANON, PEER, v),
        };
        expect(out.own_row_current_version.ok).toBe(true);
        for (const refused of [out.own_row_stale_version, out.someone_elses_row, out.signed_out]) expect(refused.ok).toBe(false);
        return out;
      }));

    // The moderator's own row: the policy lets the holder see it, and super admins (with two-factor) see everyone's.
    policy("staff_roles_read", ["moderator_aal2", "moderator_aal1", "super_admin_aal2"], async (tx) =>
      visible(tx, "public.staff_roles where user_id = $1 and role = 'moderator'", [MOD]),
    );

    policy("job_runs_staff_read", ["moderator_aal2", "trust_reviewer_aal2", "accounts_aal2", "super_admin_aal2"], async (tx) => {
      await tx`insert into public.job_runs (job) values ('golden-policy-job')`;
      return visible(tx, "public.job_runs where job = 'golden-policy-job'");
    });

    policy("github_link_clashes_read_trust", ["trust_reviewer_aal2", "super_admin_aal2"], async (tx) => {
      await tx.unsafe(`insert into public.github_link_clashes (user_id, github_id, github_login, linked_user_id) values ($1, 9101, 'golden-clash', $2)`, [STUDENT, PEER]);
      return visible(tx, "public.github_link_clashes where github_id = 9101");
    });

    // The flagged student sees that a flag exists (not its kind or key: those columns are not granted); trust reviewers see it all.
    policy("review_flags_read", ["owner_student", "trust_reviewer_aal2", "super_admin_aal2"], async (tx) => {
      await tx.unsafe(`insert into public.review_flags (user_id, kind, key) values ($1, 'burst', 'golden-flag')`, [STUDENT]);
      return visible(tx, "public.review_flags where user_id = $1", [STUDENT]); // key and kind are column-restricted
    });

    policy("ops_audit_log_read", ["moderator_aal2", "trust_reviewer_aal2", "accounts_aal2", "super_admin_aal2"], async (tx) => {
      await tx.unsafe(`insert into public.ops_audit_log (staff_id, action, target_type, target_id, reason) values ($1, 'golden.policy', 'user', $2, 'golden')`, [ADMIN, STUDENT]);
      return visible(tx, "public.ops_audit_log where action = 'golden.policy'");
    });

    policy("platform_config_staff_read", ["moderator_aal2", "trust_reviewer_aal2", "accounts_aal2", "super_admin_aal2"], async (tx) => {
      await setPortals(tx, { recruiter: false, university: false, faculty: true, golden: true });
      return visible(tx, "public.platform_config where key = 'portals.enabled' and value ? 'golden'");
    });

    policy("config_keys_staff_read", ["moderator_aal2", "trust_reviewer_aal2", "accounts_aal2", "super_admin_aal2"], async (tx) =>
      visible(tx, "public.config_keys where key = 'portals.enabled'"),
    );

    policy("report_cases_staff_read", ["moderator_aal2", "super_admin_aal2"], async (tx) => {
      await tx.unsafe(`insert into public.report_cases (id, target_type, target_id) values ($1, 'profile', $2)`, [CASE, STUDENT]);
      return visible(tx, "public.report_cases where id = $1", [CASE]);
    });

    policy("reports_staff_read", ["moderator_aal2", "super_admin_aal2"], async (tx) => {
      await tx.unsafe(`insert into public.report_cases (id, target_type, target_id) values ($1, 'profile', $2)`, [CASE, STUDENT]);
      await tx.unsafe(`insert into public.reports (id, case_id, reporter_id, target_type, target_id, reason) values ($1, $2, $3, 'profile', $4, 'spam')`, [
        REPORT,
        CASE,
        PEER,
        STUDENT,
      ]);
      return visible(tx, "public.reports where id = $1", [REPORT]);
    });

    policy("report_messages_staff_read", ["moderator_aal2", "super_admin_aal2"], async (tx) => {
      await tx.unsafe(`insert into public.report_cases (id, target_type, target_id) values ($1, 'message', $2)`, [CASE, STUDENT]);
      await tx.unsafe(`insert into public.reports (id, case_id, reporter_id, target_type, target_id, reason) values ($1, $2, $3, 'message', $4, 'spam')`, [
        REPORT,
        CASE,
        PEER,
        STUDENT,
      ]);
      await tx.unsafe(`insert into public.report_messages (report_id, message_id, body, sent_at) values ($1, $2, 'golden copied message', now())`, [REPORT, STUDENT]);
      return visible(tx, "public.report_messages where report_id = $1", [REPORT]);
    });

    policy("sanctions_read", ["moderator_aal2", "super_admin_aal2", "other_student"], async (tx) => {
      await tx.unsafe(`insert into public.sanctions (user_id, kind, reason, staff_id) values ($1, 'warn', 'golden warning', $2)`, [PEER, ADMIN]);
      return visible(tx, "public.sanctions where user_id = $1 and reason = 'golden warning'", [PEER]);
    });

    policy("exam_periods_read", ["accounts_aal2", "super_admin_aal2"], async (tx) => {
      await tx.unsafe(`insert into public.exam_periods (university_id, starts_on, ends_on, reason) values ($1, current_date, current_date + 7, 'golden exams')`, [UNI_CLOSED]);
      return visible(tx, "public.exam_periods where reason = 'golden exams'");
    });

    policy("appeals_read", ["owner_student", "moderator_aal2", "super_admin_aal2"], async (tx) => {
      await tx.unsafe(
        `insert into public.appeals (decision_type, decision_id, appellant_id, body, original_staff_id, decider_role)
         values ('sanction', $1, $2, 'Please look at this again.', $3, 'moderator')`,
        [CASE, STUDENT, ADMIN],
      );
      return visible(tx, "public.appeals where appellant_id = $1", [STUDENT]);
    });

    const storagePolicy = (name: string, bucket: string, allowed: string[]) =>
      policy(name, allowed, async (tx) => {
        await tx.unsafe(`insert into storage.objects (bucket_id, name, owner_id) values ($1, $2, $3)`, [bucket, `${STUDENT}/golden-policy.pdf`, STUDENT]);
        return visible(tx, "storage.objects where bucket_id = $1 and name = $2", [bucket, `${STUDENT}/golden-policy.pdf`]);
      });
    storagePolicy("credentials_files_read", "credentials", ["owner_student", "trust_reviewer_aal2", "super_admin_aal2"]);
    storagePolicy("feedback_files_read", "feedback", ["owner_student", "moderator_aal2", "trust_reviewer_aal2", "accounts_aal2", "super_admin_aal2"]);
    storagePolicy("university_claims_files_read", "university-claims", ["owner_student", "accounts_aal2", "super_admin_aal2"]);
  });
});
