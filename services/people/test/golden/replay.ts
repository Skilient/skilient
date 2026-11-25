/**
 * Replaying the people goldens against the port (CLAUDE.md, "How to work" 4).
 *
 * The goldens (packages/testing/test/people.golden.test.ts) were recorded on Supabase, so their `changes`
 * name Supabase tables and their refusals are Postgres errors. Comparison rules (as identity's, decisions
 * 2026-11-25):
 *   1. People's tables are read from people's schema and reported under the recorded name, projected to the
 *      recorded columns (RENAMED). `public.ops_audit_log` rows are people's own audit rows (people.audit_log;
 *      trust builds the /ops view from audit.recorded in W10).
 *   2. Tables another service owns (FOREIGN) are not people's to write: the replay drops them from the
 *      recorded side and the case asserts the event that carries them instead.
 *   3. A refusal maps to the recorded SQLSTATE and message through src/refusals.ts; a signed-out caller's
 *      recorded "permission denied for function X" equals not_signed_in (approved by Ahmed for W1).
 *   4. Inputs other services own (ranking's next tier, notify's unread count) are published into people's
 *      copies as their owners will publish them, from the values recorded beside the output.
 * Every case runs in one transaction that is rolled back.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ConnectError } from "@connectrpc/connect";
import { refusalReason } from "@skilient/platform";
import { normalise } from "@skilient/testing";
import { startPostgres, type TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { expect } from "vitest";
import { REFUSALS, type RefusalReason } from "../../src/refusals";
import { applyCopyEvent } from "../../src/store/copies";
import { applyUserCreated } from "../../src/store/lifecycle";

export type Tx = postgres.TransactionSql;
const DIR = join(import.meta.dirname, "../../../../packages/testing/test/golden/people");
export const MIGRATIONS = join(import.meta.dirname, "../../migrations");

// The recording's fixture world (packages/testing/test/people.golden.test.ts, `seed`).
export const UNI_A = "9e000000-0000-4000-8000-00000000000a";
export const UNI_B = "9e000000-0000-4000-8000-00000000000b";
export const UNI_C = "9e000000-0000-4000-8000-00000000000c";
export const UNI_D = "9e000000-0000-4000-8000-00000000000d";
export const DEPT_CS = "9e100000-0000-4000-8000-000000000001";
export const DEPT_SE = "9e100000-0000-4000-8000-000000000002";
export const ALI = "9f000000-0000-4000-8000-000000000001";
export const BINA = "9f000000-0000-4000-8000-000000000002";
export const CHAND = "9f000000-0000-4000-8000-000000000003";
export const DUA = "9f000000-0000-4000-8000-000000000004";
export const EMAN = "9f000000-0000-4000-8000-000000000005";
export const NEWBIE = "9f000000-0000-4000-8000-000000000006";
export const STAFF = "9f000000-0000-4000-8000-000000000007";
export const UNIADM = "9f000000-0000-4000-8000-000000000008";
export const USERS = [ALI, BINA, CHAND, DUA, EMAN, NEWBIE, STAFF, UNIADM];
export const UNIS = [UNI_A, UNI_B, UNI_C, UNI_D];
export const DOMAIN: Record<string, string> = {
  [ALI]: "people-a.test",
  [BINA]: "people-a.test",
  [CHAND]: "people-b.test",
  [DUA]: "people-a.test",
  [EMAN]: "people-b.test",
  [NEWBIE]: "people-shared.test",
  [STAFF]: "people-a.test",
  [UNIADM]: "people-a.test",
};
export const NAME: Record<string, string> = {
  [ALI]: "Ali Zyxwar",
  [BINA]: "Bina Zyxwar",
  [CHAND]: "Chand Qorvel",
  [DUA]: "Dua Zyxwar",
  [EMAN]: "Eman Qorvel",
  [NEWBIE]: "Newbie Plomt",
  [STAFF]: "Staff Plomt",
  [UNIADM]: "Office Plomt",
};
export const USERNAME: Record<string, string> = { [ALI]: "pg_ali", [BINA]: "pg_bina", [CHAND]: "pg_chand", [DUA]: "pg_dua", [EMAN]: "pg_eman", [STAFF]: "pg_staff" };

/** The personal-domain list identity holds (fed to people through CheckEmailDomains in the service). */
export const PERSONAL = { personal: async (domains: readonly string[]) => new Set(domains.filter((d) => d === "people-mail.test")) };

/** Rule 1: people's tables under the recorded names, projected to the recorded columns and order. */
export const RENAMED: Record<string, (tx: Tx) => PromiseLike<readonly unknown[]>> = {
  "public.profiles": (tx) => tx`
    select user_id, role, university_id, full_name, username, department, department_id, programme, graduation_year, campus, bio,
           visibility, recruiter_visible, looking_for, onboarding_complete, chat_read_receipts, leaderboard_opt_out, status,
           graduated_at is not null as graduated from people.profiles where user_id = any(${USERS}::uuid[]) order by user_id`,
  "public.profiles_public_card": (tx) => tx`
    select user_id, username, full_name, department, graduation_year from people.profiles where user_id = any(${USERS}::uuid[]) order by user_id`,
  "public.onboarding_state": (tx) => tx`
    select user_id, role, step, data, completed_at is not null as completed from people.onboarding_state where user_id = any(${USERS}::uuid[]) order by user_id`,
  "public.friend_requests": (tx) => tx`
    select sender_id, receiver_id, status, responded_at is not null as responded from people.friend_requests
     where sender_id = any(${USERS}::uuid[]) or receiver_id = any(${USERS}::uuid[]) order by sender_id, receiver_id, status`,
  "public.friendships": (tx) => tx`select user_id_a, user_id_b from people.friendships order by 1, 2`,
  "public.blocks": (tx) => tx`select blocker_id, blocked_id from people.blocks order by 1, 2`,
  "public.user_mutes": (tx) => tx`select user_id, muted_id from people.user_mutes order by 1, 2`,
  "public.pymk_dismissals": (tx) => tx`select user_id, dismissed_id from people.pymk_dismissals order by 1, 2`,
  "public.ui_state": (tx) => tx`select user_id, key, value from people.ui_state order by 1, 2`,
  "public.tour_progress": (tx) => tx`
    select user_id, tour_id, step, completed_at is not null as completed, skipped_at is not null as skipped from people.tour_progress order by 1, 2`,
  "public.tips_seen": (tx) => tx`select user_id, tip_id from people.tips_seen order by 1, 2`,
  "public.universities": (tx) => tx`
    select id, name, slug, live_at is not null as live, final_year_batch from people.universities where id = any(${UNIS}::uuid[]) or slug like 'people-golden-%' order by slug`,
  "public.university_domains": (tx) => tx`
    select university_id, domain, kind, source from people.university_domains where university_id = any(${UNIS}::uuid[]) or domain like '%.people-hec.test' order by 2, 1`,
  "public.departments": (tx) => tx`select university_id, name from people.departments where university_id = any(${UNIS}::uuid[]) order by 2`,
  "public.programmes": (tx) => tx`
    select d.name as department, g.name from people.programmes g join people.departments d on d.id = g.department_id where d.university_id = any(${UNIS}::uuid[]) order by 1, 2`,
  "public.university_requests": (tx) => tx`
    select email, domain, university_id, university_name, consent, confirmed_at is not null as confirmed, unsubscribed_at is not null as unsubscribed
      from people.university_requests where domain like '%people%' order by email`,
  "public.ops_audit_log": (tx) => tx`
    select staff_id, action, target_type, target_id, reason, before, after from people.audit_log where staff_id = any(${USERS}::uuid[]) order by action, target_id`,
};

/** Rule 2: tables other services own, and the event that carries people's part. */
export const FOREIGN: Record<string, { owner: string; via: string }> = {
  "public.notifications": { owner: "notify", via: "friend_request.changed" },
};

export async function snapshot(tx: Tx): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const [table, read] of Object.entries(RENAMED)) out[table] = (await read(tx)).map((r) => JSON.stringify(r));
  return out;
}

export function changes(before: Record<string, string[]>, after: Record<string, string[]>) {
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

export type Outcome = { ok: true; value: unknown } | { ok: false; code: string; message: string };

/** Rule 3: a refusal as the recorded SQLSTATE and message. */
export async function outcome(run: () => unknown, fn?: string): Promise<Outcome> {
  try {
    return { ok: true, value: (await run()) ?? null };
  } catch (error) {
    if (error instanceof ConnectError) {
      const reason = refusalReason(error) as RefusalReason | null;
      const r = reason ? REFUSALS[reason] : undefined;
      if (!r) throw error;
      // `fn` is "name" for a function, or "table:name" for a direct table read or write the app made.
      if (fn && (reason === "not_signed_in" || reason === "not_signed_in_plain" || reason === "field_not_editable"))
        return { ok: false, code: "42501", message: fn.startsWith("table:") ? `permission denied for table ${fn.slice(6)}` : `permission denied for function ${fn}` };
      return { ok: false, code: r.sqlstate, message: r.text };
    }
    throw error;
  }
}

/** One call in a savepoint, as the recorder's `call`. `fn` names the function for rule 3 when the caller is signed out. */
export const call = (tx: Tx, run: (sp: Tx) => unknown, fn?: string): Promise<Outcome> => outcome(() => tx.savepoint((sp) => Promise.resolve(run(sp))), fn);

/** One call with the rows it changed, as the recorder's `step`. */
export async function step(tx: Tx, run: (sp: Tx) => unknown, fn?: string) {
  const before = await snapshot(tx);
  const result = await call(tx, run, fn);
  return { result, changes: changes(before, await snapshot(tx)) };
}

/** A replay world: people's schema in a fresh Postgres. */
export async function startWorld(): Promise<{ pg: TestDatabase; sql: postgres.Sql }> {
  if (process.env["GOLDEN_RECORD"] === "1") throw new Error("golden replays never record; unset GOLDEN_RECORD");
  const pg = await startPostgres();
  const sql = await pg.service("people", MIGRATIONS);
  return { pg, sql };
}

/** A user arrives as identity's user.created would bring them (the people half of handle_new_user). */
export async function createUser(tx: Tx, id: string, role: "student" | "university_admin" = "student", universityId: string | null = null): Promise<void> {
  const owners = await tx<{ id: string }[]>`
    select distinct university_id::text as id from people.university_domains where domain = ${DOMAIN[id]!}
       and kind in ${role === "student" ? tx(["student", "both"]) : tx(["faculty", "both"])}`;
  const uni = universityId ?? (owners.length === 1 ? owners[0]!.id : null);
  const complete = role === "university_admin";
  const r = await applyUserCreated(
    tx,
    id,
    {
      role,
      university_id: uni,
      visibility: role === "university_admin" ? "friends" : "university",
      onboarding_complete: complete,
      onboarding_step: role === "student" ? 1 : 6,
      onboarding_completed_at: complete ? new Date().toISOString() : null,
      status: "active",
    },
    new Map([[id, { fullName: NAME[id]!, emailDomain: DOMAIN[id]! }]]),
  );
  expect(r).toBe("created");
}

async function onboard(tx: Tx, id: string, v: { department: string; year: number; visibility?: string }): Promise<void> {
  await tx`
    update people.profiles p set username = ${USERNAME[id]!}, department = ${v.department}, graduation_year = ${v.year},
           visibility = ${v.visibility ?? "university"}, onboarding_complete = true,
           department_id = (select d.id from people.departments d where d.university_id = p.university_id and lower(d.name) = lower(${v.department}))
     where user_id = ${id}`;
  await tx`update people.onboarding_state set step = 6, completed_at = now() where user_id = ${id}`;
}

/** The recording's `seed`, for people's tables. */
export async function seed(tx: Tx): Promise<void> {
  await tx`
    insert into people.universities (id, name, slug, live_at) values
      (${UNI_A}, 'People Golden University A', 'people-golden-a', now() - interval '1 day'),
      (${UNI_B}, 'People Golden University B', 'people-golden-b', now() - interval '1 day'),
      (${UNI_C}, 'People Golden University C', 'people-golden-c', null),
      (${UNI_D}, 'People Golden University D', 'people-golden-d', now() - interval '1 day')`;
  await tx`
    insert into people.university_domains (university_id, domain, kind, source) values
      (${UNI_A}, 'people-a.test', 'both', 'ops'), (${UNI_B}, 'people-b.test', 'both', 'ops'), (${UNI_C}, 'people-c.test', 'both', 'ops'),
      (${UNI_A}, 'people-shared.test', 'student', 'ops'), (${UNI_D}, 'people-shared.test', 'student', 'ops')`;
  await tx`insert into people.departments (id, university_id, name) values (${DEPT_CS}, ${UNI_A}, 'Computer Science'), (${DEPT_SE}, ${UNI_A}, 'Software Engineering')`;
  await tx`insert into people.programmes (id, department_id, name) values (gen_random_uuid(), ${DEPT_CS}, 'BS Computer Science'), (gen_random_uuid(), ${DEPT_CS}, 'BS Data Science')`;
  for (const id of [ALI, BINA, CHAND, DUA, EMAN, NEWBIE, STAFF]) await createUser(tx, id);
  await createUser(tx, UNIADM, "university_admin", UNI_A);
  await onboard(tx, ALI, { department: "Computer Science", year: 2027 });
  await onboard(tx, BINA, { department: "Computer Science", year: 2027 });
  await onboard(tx, CHAND, { department: "Electrical Engineering", year: 2027 });
  await onboard(tx, DUA, { department: "Software Engineering", year: 2026, visibility: "friends" });
  await onboard(tx, EMAN, { department: "Electrical Engineering", year: 2028, visibility: "global" });
  await onboard(tx, STAFF, { department: "Computer Science", year: 2027 });
}

/** Rule 4: publishes a fact into people's copies as its owner will (the copies consumer's own write path). */
export async function asOwner(tx: Tx, producer: string, type: string, payload: Record<string, unknown>): Promise<void> {
  const outcome = await applyCopyEvent(tx, { type, producer, version: 1, payload });
  expect(outcome).toBe("applied");
}

/** Renumbers `<uuid:n>` placeholders by first appearance (keys sorted), so a value with tables removed compares. */
export function renumber(value: unknown): unknown {
  const ids = new Map<string, string>();
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return v.replace(/<uuid:\d+>/g, (m) => (ids.has(m) ? ids.get(m)! : (ids.set(m, `<uuid:${ids.size + 1}>`), ids.get(m)!)));
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object")
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value);
}

/** Runs a case in a rolled-back transaction on a seeded world, then compares it with its golden (people's half). */
export async function replay(sql: postgres.Sql, file: string, name: string, run: (tx: Tx) => Promise<unknown>, otherHalf: { owner: string; keys: string[] } = { owner: "", keys: [] }): Promise<void> {
  if (process.env["GOLDEN_RECORD"] === "1") throw new Error("golden replays never record");
  let value: unknown;
  await sql
    .begin(async (tx) => {
      await seed(tx);
      value = await run(tx);
      throw new Error("rollback");
    })
    .catch((e: unknown) => {
      if (!(e instanceof Error && e.message === "rollback")) throw e;
    });
  const cases = JSON.parse(readFileSync(join(DIR, `${file}.json`), "utf8")) as Record<string, unknown>;
  if (!(name in cases)) throw new Error(`no golden case ${file}#${name}`);
  // Dates become ISO text first, as the recorder read timestamps as text.
  // Top-level keys that are another service's half (e.g. market's university-seat refusals, W11) are dropped.
  const drop = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k]) => !otherHalf.keys.includes(k))) : v);
  const actual = renumber(drop(normalise(JSON.parse(JSON.stringify(value ?? null)) as unknown)));
  const expected = renumber(drop(withoutForeign(cases[name])));
  const dir = process.env["GOLDEN_DIFF_DIR"];
  if (dir && JSON.stringify(actual) !== JSON.stringify(expected)) {
    mkdirSync(dir, { recursive: true });
    const keys = Object.keys(expected as object).filter((k) => JSON.stringify((actual as Record<string, unknown>)[k]) !== JSON.stringify((expected as Record<string, unknown>)[k]));
    writeFileSync(join(dir, `${file}-${name}.json`), JSON.stringify({ keys, actual: Object.fromEntries(keys.map((k) => [k, (actual as Record<string, unknown>)[k]])), expected: Object.fromEntries(keys.map((k) => [k, (expected as Record<string, unknown>)[k]])) }, null, 1));
  }
  expect(actual).toEqual(expected);
}

/** The recorded value of a case (for inputs recorded beside the output). */
export function recorded(file: string, name: string): Record<string, unknown> {
  return (JSON.parse(readFileSync(join(DIR, `${file}.json`), "utf8")) as Record<string, Record<string, unknown>>)[name]!;
}

/** Rule 2: removes FOREIGN tables from a recorded value (anywhere in it), so the comparison is people's half. */
export function withoutForeign(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutForeign);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([k]) => !(k in FOREIGN)).map(([k, v]) => [k, withoutForeign(v)]));
  return value;
}

/** A recorded case from identity's goldens (people replays its half of them). */
export function recordedIdentity(file: string, group: string, name?: string): unknown {
  const all = JSON.parse(readFileSync(join(DIR, "..", "identity", `${file}.json`), "utf8")) as Record<string, Record<string, { changes?: unknown }>>;
  const g = all[group]!;
  return name ? g[name]!.changes : g;
}
