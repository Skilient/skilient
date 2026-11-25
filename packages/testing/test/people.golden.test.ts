/**
 * People golden recordings (W2). Records what the current stack (local Supabase) returns for every ported
 * people function, so the W2 service can be held to the same results. The sheet is
 * docs/azure/people-function-bins.md.
 *
 *   GOLDEN_STACK_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres GOLDEN_RECORD=1 pnpm exec vitest run test/people.golden.test.ts
 *
 * Without GOLDEN_RECORD it compares the stack with the files. Without GOLDEN_STACK_DB_URL the file is
 * skipped. Every case runs in its own transaction that is rolled back: fixture universities, users and rows
 * exist only inside it. Where a function's answer would depend on the rest of the local database (counts
 * over every university or profile), the case first moves the non-fixture rows out of the way inside the
 * same rolled-back transaction, so the recording covers fixture rows only.
 *
 * Inputs owned by other services (ranking's next-tier requirements, the formula's points) are recorded next
 * to the output under `inputs`, because people's port receives them as event-fed facts (decision Q1).
 */
import { join } from "node:path";
import type postgres from "postgres";
import { describe, expect, it } from "vitest";
import { actAs, assertLocalStack, attempt, callCurrentStackSql, golden, type SqlOutcome, type StackActor } from "../src/golden";

const DB = process.env["GOLDEN_STACK_DB_URL"];
if (DB !== undefined) assertLocalStack(DB);
const DIR = join(import.meta.dirname, "golden", "people");

// ---------------------------------------------------------------------------
// Fixtures: fixed ids, `.test` domains, distinctive names, no secrets.
// ---------------------------------------------------------------------------
export const UNI_A = "9e000000-0000-4000-8000-00000000000a";
export const UNI_B = "9e000000-0000-4000-8000-00000000000b";
export const UNI_C = "9e000000-0000-4000-8000-00000000000c"; // closed
export const UNI_D = "9e000000-0000-4000-8000-00000000000d"; // shares a domain with A
export const DEPT_CS = "9e100000-0000-4000-8000-000000000001";
export const DEPT_SE = "9e100000-0000-4000-8000-000000000002";
export const ALI = "9f000000-0000-4000-8000-000000000001"; // A, university visibility, 2027
export const BINA = "9f000000-0000-4000-8000-000000000002"; // A, university, 2027
export const CHAND = "9f000000-0000-4000-8000-000000000003"; // B, university, 2027
export const DUA = "9f000000-0000-4000-8000-000000000004"; // A, friends only, 2026
export const EMAN = "9f000000-0000-4000-8000-000000000005"; // B, global, 2028
export const NEWBIE = "9f000000-0000-4000-8000-000000000006"; // shared domain, not onboarded
export const STAFF = "9f000000-0000-4000-8000-000000000007"; // A, super_admin
export const UNIADM = "9f000000-0000-4000-8000-000000000008"; // university_admin at A, seat owner
export const USERS = [ALI, BINA, CHAND, DUA, EMAN, NEWBIE, STAFF, UNIADM];
export const UNIS = [UNI_A, UNI_B, UNI_C, UNI_D];
export const EMAIL: Record<string, string> = {
  [ALI]: "ali@people-a.test",
  [BINA]: "bina@people-a.test",
  [CHAND]: "chand@people-b.test",
  [DUA]: "dua@people-a.test",
  [EMAN]: "eman@people-b.test",
  [NEWBIE]: "newbie@people-shared.test",
  [STAFF]: "staff@people-a.test",
  [UNIADM]: "office@people-a.test",
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
export const USERNAME: Record<string, string> = {
  [ALI]: "pg_ali",
  [BINA]: "pg_bina",
  [CHAND]: "pg_chand",
  [DUA]: "pg_dua",
  [EMAN]: "pg_eman",
  [STAFF]: "pg_staff",
};

const OWNER: StackActor = { role: "postgres" };
const ANON: StackActor = { role: "anon", claims: { role: "anon" } };
function as(user: string, aal: "aal1" | "aal2" = "aal1"): StackActor {
  return { role: "authenticated", claims: { sub: user, role: "authenticated", aal, email: EMAIL[user] } };
}

type Tx = postgres.TransactionSql;
type Row = Record<string, unknown>;

async function insertUser(tx: Tx, id: string, meta: Row = {}): Promise<void> {
  await tx.unsafe(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                             raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, '', now(),
             '{"provider":"email","providers":["email"]}'::jsonb, $3::text::jsonb, now(), now())`,
    [id, EMAIL[id]!, JSON.stringify({ full_name: NAME[id], ...meta })],
  );
}

async function onboard(tx: Tx, id: string, values: { department: string; year: number; visibility?: string }): Promise<void> {
  await tx.unsafe(
    `update public.profiles set username = $2, department = $3, graduation_year = $4, visibility = $5::public.profile_visibility,
            onboarding_complete = true where user_id = $1`,
    [id, USERNAME[id]!, values.department, values.year, values.visibility ?? "university"],
  );
  await tx.unsafe(`update public.onboarding_state set step = 6, completed_at = now() where user_id = $1`, [id]);
}

/** The shared world: four universities, two departments with programmes at A, eight users. */
async function seed(tx: Tx): Promise<void> {
  await tx.unsafe(
    `insert into public.universities (id, name, slug, live_at) values
       ($1, 'People Golden University A', 'people-golden-a', now() - interval '1 day'),
       ($2, 'People Golden University B', 'people-golden-b', now() - interval '1 day'),
       ($3, 'People Golden University C', 'people-golden-c', null),
       ($4, 'People Golden University D', 'people-golden-d', now() - interval '1 day')`,
    UNIS,
  );
  await tx.unsafe(
    `insert into public.university_domains (university_id, domain, kind, source) values
       ($1, 'people-a.test', 'both', 'ops'), ($2, 'people-b.test', 'both', 'ops'), ($3, 'people-c.test', 'both', 'ops'),
       ($1, 'people-shared.test', 'student', 'ops'), ($4, 'people-shared.test', 'student', 'ops')`,
    UNIS,
  );
  await tx.unsafe(`insert into public.departments (id, university_id, name) values ($1, $3, 'Computer Science'), ($2, $3, 'Software Engineering')`, [
    DEPT_CS,
    DEPT_SE,
    UNI_A,
  ]);
  await tx.unsafe(`insert into public.programmes (department_id, name) values ($1, 'BS Computer Science'), ($1, 'BS Data Science')`, [DEPT_CS]);
  for (const id of [ALI, BINA, CHAND, DUA, EMAN, NEWBIE, STAFF]) await insertUser(tx, id);
  await insertUser(tx, UNIADM, { role: "university_admin", university_id: UNI_A });
  await onboard(tx, ALI, { department: "Computer Science", year: 2027 });
  await onboard(tx, BINA, { department: "Computer Science", year: 2027 });
  await onboard(tx, CHAND, { department: "Electrical Engineering", year: 2027 });
  await onboard(tx, DUA, { department: "Software Engineering", year: 2026, visibility: "friends" });
  await onboard(tx, EMAN, { department: "Electrical Engineering", year: 2028, visibility: "global" });
  await onboard(tx, STAFF, { department: "Computer Science", year: 2027 });
  await tx.unsafe(`insert into public.staff_roles (user_id, role, granted_by) values ($1, 'super_admin', $1)`, [STAFF]);
  await tx.unsafe(`insert into public.university_admins (user_id, university_id, role) values ($1, $2, 'owner')`, [UNIADM, UNI_A]);
}

// ---------------------------------------------------------------------------
// Calls and row snapshots
// ---------------------------------------------------------------------------
async function call(tx: Tx, actor: StackActor, expr: string, params: unknown[] = []): Promise<SqlOutcome<unknown>> {
  const out = await attempt(tx, async (sp) => {
    await actAs(sp, actor);
    const rows = await sp.unsafe(`select ${expr} as v`, params as never[]);
    return (rows[0] as Row | undefined)?.["v"] ?? null;
  });
  await actAs(tx, OWNER);
  return out;
}

/** A set-returning function or a table read as `actor`: every row, in the order given. */
async function rows(tx: Tx, actor: StackActor, text: string, params: unknown[] = []): Promise<SqlOutcome<unknown>> {
  const out = await attempt(tx, async (sp) => {
    await actAs(sp, actor);
    return [...(await sp.unsafe(text, params as never[]))];
  });
  await actAs(tx, OWNER);
  return out;
}

async function exec(tx: Tx, actor: StackActor, text: string, params: unknown[] = []): Promise<SqlOutcome<unknown>> {
  const out = await attempt(tx, async (sp) => {
    await actAs(sp, actor);
    return (await sp.unsafe(text, params as never[])).count;
  });
  await actAs(tx, OWNER);
  return out;
}

export const SNAPSHOTS: Record<string, string> = {
  "public.profiles": `select user_id, role, university_id, full_name, username, department, department_id, programme, graduation_year, campus, bio,
            visibility, recruiter_visible, looking_for, onboarding_complete, chat_read_receipts, leaderboard_opt_out, status,
            graduated_at is not null as graduated from public.profiles where user_id = any($1) order by user_id`,
  "public.profiles_public_card": `select user_id, username, full_name, department, graduation_year from public.profiles_public_card where user_id = any($1) order by user_id`,
  "public.onboarding_state": `select user_id, role, step, data, completed_at is not null as completed from public.onboarding_state where user_id = any($1) order by user_id`,
  "public.friend_requests": `select sender_id, receiver_id, status, responded_at is not null as responded from public.friend_requests
     where sender_id = any($1) or receiver_id = any($1) order by sender_id, receiver_id, status`,
  "public.friendships": `select user_id_a, user_id_b from public.friendships where user_id_a = any($1) or user_id_b = any($1) order by 1, 2`,
  "public.blocks": `select blocker_id, blocked_id from public.blocks where blocker_id = any($1) or blocked_id = any($1) order by 1, 2`,
  "public.user_mutes": `select user_id, muted_id from public.user_mutes where user_id = any($1) order by 1, 2`,
  "public.pymk_dismissals": `select user_id, dismissed_id from public.pymk_dismissals where user_id = any($1) order by 1, 2`,
  "public.ui_state": `select user_id, key, value from public.ui_state where user_id = any($1) order by 1, 2`,
  "public.tour_progress": `select user_id, tour_id, step, completed_at is not null as completed, skipped_at is not null as skipped from public.tour_progress where user_id = any($1) order by 1, 2`,
  "public.tips_seen": `select user_id, tip_id from public.tips_seen where user_id = any($1) order by 1, 2`,
  "public.universities": `select id, name, slug, live_at is not null as live, final_year_batch from public.universities where id = any($2) or slug like 'people-golden-%' order by slug`,
  "public.university_domains": `select university_id, domain, kind, source from public.university_domains where university_id = any($2) or domain like '%.people-hec.test' order by 2, 1`,
  "public.departments": `select university_id, name from public.departments where university_id = any($2) order by 2`,
  "public.programmes": `select d.name as department, g.name from public.programmes g join public.departments d on d.id = g.department_id where d.university_id = any($2) order by 1, 2`,
  "public.university_requests": `select email, domain, university_id, university_name, consent, confirmed_at is not null as confirmed, unsubscribed_at is not null as unsubscribed
     from public.university_requests where domain like '%people%' order by email`,
  "public.ops_audit_log": `select staff_id, action, target_type, target_id, reason, before, after from public.ops_audit_log where staff_id = any($1) order by action, target_id`,
  "public.notifications": `select user_id, actor_id, type, entity_type from public.notifications where user_id = any($1) order by user_id, type`,
};

async function snapshot(tx: Tx): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const [table, text] of Object.entries(SNAPSHOTS)) {
    const one = text.includes("$1");
    const two = text.includes("$2");
    const query = two && !one ? text.replaceAll("$2", "$1") : text;
    const params = one && two ? [USERS, UNIS] : two ? [UNIS] : one ? [USERS] : [];
    out[table] = (await tx.unsafe(query, params as never[])).map((r) => JSON.stringify(r));
  }
  return out;
}

function changes(before: Record<string, string[]>, after: Record<string, string[]>) {
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

async function step(tx: Tx, actor: StackActor, expr: string, params: unknown[] = []) {
  const before = await snapshot(tx);
  const result = await call(tx, actor, expr, params);
  return { result, changes: changes(before, await snapshot(tx)) };
}

async function stepRows(tx: Tx, actor: StackActor, text: string, params: unknown[] = []) {
  const before = await snapshot(tx);
  const result = await rows(tx, actor, text, params);
  return { result, changes: changes(before, await snapshot(tx)) };
}

async function stepExec(tx: Tx, actor: StackActor, text: string, params: unknown[] = []) {
  const before = await snapshot(tx);
  const result = await exec(tx, actor, text, params);
  return { result, changes: changes(before, await snapshot(tx)) };
}

async function check(group: string, name: string, run: (tx: Tx) => Promise<unknown>): Promise<void> {
  const out = await callCurrentStackSql(DB!, async (tx) => {
    await seed(tx);
    return run(tx);
  });
  if (!out.ok) throw new Error(`${group}/${name}: setup failed: ${out.code} ${out.message}`);
  const r = golden(join(DIR, `${group}.json`), name, out.value);
  if (r.status === "differs") expect(r.actual).toEqual(r.expected);
}

const value = (o: SqlOutcome<unknown>) => (o as { ok: true; value: unknown }).value;
const befriend = (tx: Tx, a: string, b: string) =>
  tx.unsafe(`insert into public.friendships (user_id_a, user_id_b) values (least($1::uuid, $2::uuid), greatest($1::uuid, $2::uuid))`, [a, b]);

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------
describe.skipIf(!DB)("people goldens on the current stack", () => {
  describe("profiles and visibility", () => {
    const G = "profiles";

    it("profile rows created at sign-up (handle_new_user, people's half) and the public card", () =>
      check(G, "signup_rows", async (tx) => {
        const before = await snapshot(tx);
        await tx.unsafe(`delete from public.profiles where user_id = any($1)`, [USERS]);
        await tx.unsafe(`delete from public.onboarding_state where user_id = any($1)`, [USERS]);
        return { seeded: changes(await snapshot(tx), before) };
      }));

    it("who reads a full profile (profiles_select_visible) and who gets the card", () =>
      check(G, "visibility", async (tx) => {
        await befriend(tx, ALI, DUA);
        await tx.unsafe(`insert into public.blocks (blocker_id, blocked_id) values ($1, $2)`, [CHAND, EMAN]);
        const viewers: [string, StackActor][] = [
          ["ali", as(ALI)],
          ["bina", as(BINA)],
          ["chand", as(CHAND)],
          ["dua", as(DUA)],
          ["eman", as(EMAN)],
          ["signed_out", ANON],
        ];
        const out: Row = {};
        for (const target of [ALI, CHAND, DUA, EMAN]) {
          const seen: Row = {};
          for (const [name, viewer] of viewers) {
            seen[name] = {
              full: await rows(tx, viewer, `select user_id, username, full_name, bio, university_id from public.profiles where username = $1`, [USERNAME[target]]),
              card: await rows(tx, viewer, `select * from public.get_profile_card($1)`, [USERNAME[target]!.toUpperCase() + " "]),
              can_view: await call(tx, { role: "postgres", claims: viewer.claims ?? {} }, `private.can_view_profile($1)`, [target]),
            };
          }
          out[USERNAME[target]!] = seen;
        }
        out["card_unknown"] = await rows(tx, as(ALI), `select * from public.get_profile_card($1)`, ["pg_nobody"]);
        out["public_card_table_direct"] = await rows(tx, as(ALI), `select * from public.profiles_public_card`);
        return out;
      }));

    it("username_available", () =>
      check(G, "username_available", async (tx) => {
        const out: Row = {};
        for (const u of ["pg_free_name", "PG_ALI", "pg_bina", "  pg_free_name  ", "ab", "has-dash", "admin", null, "x".repeat(31)])
          out[JSON.stringify(u)] = await call(tx, as(BINA), "public.username_available($1)", [u]);
        out["signed_out"] = await call(tx, ANON, "public.username_available($1)", ["pg_free_name"]);
        out["own_name_for_ali"] = await call(tx, as(ALI), "public.username_available($1)", ["pg_ali"]);
        return out;
      }));

    it("username_available rate limit (120 an hour)", () =>
      check(G, "username_rate_limit", async (tx) => {
        let last: SqlOutcome<unknown> | undefined;
        let refusedAt = 0;
        for (let i = 1; i <= 121; i++) {
          last = await call(tx, as(BINA), "public.username_available($1)", [`pg_try_${i}`]);
          if (!last.ok && refusedAt === 0) refusedAt = i;
        }
        return { refused_at: refusedAt, last };
      }));

    it("profile edits under the column grants (settings/profile, onboarding writes)", () =>
      check(G, "profile_update", async (tx) => {
        const upd = (actor: StackActor, set: string, params: unknown[]) =>
          stepExec(tx, actor, `update public.profiles set ${set} where user_id = $1`, params);
        return {
          own_bio_visibility: await upd(as(ALI), `bio = $2, visibility = 'global', campus = $3`, [ALI, "Builds robots", "Main"]),
          own_username: await upd(as(ALI), `username = $2`, [ALI, "pg_ali_two"]),
          taken_username: await upd(as(ALI), `username = $2`, [ALI, "pg_bina"]),
          reserved_username: await upd(as(ALI), `username = $2`, [ALI, "settings"]),
          bad_username: await upd(as(ALI), `username = $2`, [ALI, "No Spaces"]),
          long_bio: await upd(as(ALI), `bio = $2`, [ALI, "x".repeat(281)]),
          looking_for_and_recruiter: await upd(as(ALI), `looking_for = '{internship,job}', recruiter_visible = true`, [ALI]),
          department_not_in_list: await upd(as(BINA), `department = $2`, [BINA, "Mechanical"]),
          department_in_list_other_case: await upd(as(BINA), `department = $2`, [BINA, "software engineering"]),
          department_free_text_without_list: await upd(as(CHAND), `department = $2`, [CHAND, "Physics"]),
          someone_elses_row: await upd(as(BINA), `bio = $2`, [ALI, "hacked"]),
          not_granted_column: await upd(as(ALI), `onboarding_complete = false`, [ALI]),
          role_column: await upd(as(ALI), `role = 'faculty'`, [ALI]),
          signed_out: await upd(ANON, `bio = $2`, [ALI, "anon"]),
          clear_name: await upd(as(ALI), `full_name = $2`, [ALI, "  "]),
          new_name: await upd(as(ALI), `full_name = $2`, [ALI, "Ali Zyxwar-Khan"]),
        };
      }));

    it("chat read receipts and leaderboard opt-out (privacy centre)", () =>
      check(G, "privacy_settings", async (tx) => ({
        receipts_default: await rows(tx, as(ALI), `select * from public.my_chat_settings()`),
        receipts_off: await step(tx, as(ALI), "public.set_read_receipts($1)", [false]),
        receipts_after: await rows(tx, as(ALI), `select * from public.my_chat_settings()`),
        receipts_null_means_on: await step(tx, as(ALI), "public.set_read_receipts($1)", [null]),
        receipts_signed_out: await call(tx, ANON, "public.set_read_receipts($1)", [false]),
        receipts_read_signed_out: await rows(tx, ANON, `select * from public.my_chat_settings()`),
        opt_out: await step(tx, as(ALI), "public.set_leaderboard_opt_out($1)", [true]),
        opt_in: await step(tx, as(ALI), "public.set_leaderboard_opt_out($1)", [false]),
        opt_null: await step(tx, as(ALI), "public.set_leaderboard_opt_out($1)", [null]),
        opt_not_onboarded: await call(tx, as(NEWBIE), "public.set_leaderboard_opt_out($1)", [true]),
        opt_signed_out: await call(tx, ANON, "public.set_leaderboard_opt_out($1)", [true]),
      })));
  });

  describe("onboarding", () => {
    const G = "onboarding";

    it("set_my_university (shared domain), complete_onboarding and the step table", () =>
      check(G, "wizard", async (tx) => {
        const out: Row = {};
        out["start"] = await rows(tx, as(NEWBIE), `select role, step, data, completed_at from public.onboarding_state where user_id = $1`, [NEWBIE]);
        out["incomplete"] = await step(tx, as(NEWBIE), "public.complete_onboarding()");
        out["wrong_university"] = await step(tx, as(NEWBIE), "public.set_my_university($1)", [UNI_B]);
        out["null_university"] = await step(tx, as(NEWBIE), "public.set_my_university($1)", [null]);
        out["university_d"] = await step(tx, as(NEWBIE), "public.set_my_university($1)", [UNI_D]);
        out["university_a"] = await step(tx, as(NEWBIE), "public.set_my_university($1)", [UNI_A]);
        out["department_options"] = await call(tx, as(NEWBIE), "public.department_options()");
        out["step_write_own"] = await stepExec(tx, as(NEWBIE), `update public.onboarding_state set step = 2, data = '{"github":"skipped"}' where user_id = $1`, [NEWBIE]);
        out["step_write_other"] = await stepExec(tx, as(NEWBIE), `update public.onboarding_state set step = 2 where user_id = $1`, [ALI]);
        out["completed_write_refused"] = await stepExec(tx, as(NEWBIE), `update public.onboarding_state set completed_at = now() where user_id = $1`, [NEWBIE]);
        out["step_out_of_range"] = await stepExec(tx, as(NEWBIE), `update public.onboarding_state set step = 7 where user_id = $1`, [NEWBIE]);
        out["details"] = await stepExec(tx, as(NEWBIE), `update public.profiles set department_id = $2, programme = 'BS Data Science', graduation_year = 2028 where user_id = $1`, [NEWBIE, DEPT_CS]);
        out["still_incomplete_no_username"] = await step(tx, as(NEWBIE), "public.complete_onboarding()");
        out["username"] = await stepExec(tx, as(NEWBIE), `update public.profiles set username = 'pg_newbie' where user_id = $1`, [NEWBIE]);
        out["complete"] = await step(tx, as(NEWBIE), "public.complete_onboarding()");
        out["complete_again"] = await step(tx, as(NEWBIE), "public.complete_onboarding()");
        out["university_after_complete"] = await step(tx, as(NEWBIE), "public.set_my_university($1)", [UNI_D]);
        out["signed_out_complete"] = await call(tx, ANON, "public.complete_onboarding()");
        out["signed_out_university"] = await call(tx, ANON, "public.set_my_university($1)", [UNI_A]);
        out["department_options_b"] = await call(tx, as(CHAND), "public.department_options()");
        out["department_options_signed_out"] = await call(tx, ANON, "public.department_options()");
        return out;
      }));

    it("the wizard to completion, as the app writes it (department as text, the trigger links department_id)", () =>
      check(G, "wizard_complete", async (tx) => {
        const out: Row = {};
        out["university"] = await step(tx, as(NEWBIE), "public.set_my_university($1)", [UNI_A]);
        out["step1"] = await stepExec(tx, as(NEWBIE), `update public.profiles set department = 'computer science', programme = 'BS Data Science', graduation_year = 2028, campus = 'Main' where user_id = $1`, [NEWBIE]);
        out["advance1"] = await stepExec(tx, as(NEWBIE), `update public.onboarding_state set step = 2 where user_id = $1`, [NEWBIE]);
        out["not_yet"] = await step(tx, as(NEWBIE), "public.complete_onboarding()");
        out["step2"] = await stepExec(tx, as(NEWBIE), `update public.profiles set username = 'pg_newbie', bio = 'Hello' where user_id = $1`, [NEWBIE]);
        out["step3"] = await stepExec(tx, as(NEWBIE), `update public.onboarding_state set step = 4, data = '{"github":"skipped","skills_seen":true}' where user_id = $1`, [NEWBIE]);
        out["step5"] = await stepExec(tx, as(NEWBIE), `update public.profiles set looking_for = '{internship}', recruiter_visible = false where user_id = $1`, [NEWBIE]);
        out["complete"] = await step(tx, as(NEWBIE), "public.complete_onboarding()");
        out["complete_again"] = await step(tx, as(NEWBIE), "public.complete_onboarding()");
        out["university_after_complete"] = await step(tx, as(NEWBIE), "public.set_my_university($1)", [UNI_D]);
        out["options_after"] = await call(tx, as(NEWBIE), "public.department_options()");
        return out;
      }));

    it("departments and programmes (university portal edits) and their effect on profiles", () =>
      check(G, "departments", async (tx) => {
        const adm = as(UNIADM, "aal2");
        const out: Row = {};
        out["create"] = await step(tx, adm, "public.save_department(null, $1)", ["Electrical Engineering"]);
        out["duplicate"] = await call(tx, adm, "public.save_department(null, $1)", ["computer science"]);
        out["too_short"] = await call(tx, adm, "public.save_department(null, $1)", ["E"]);
        out["rename"] = await step(tx, adm, "public.save_department($1, $2)", [DEPT_SE, "Software Engineering and AI"]);
        out["rename_unknown"] = await call(tx, adm, "public.save_department($1, $2)", ["9e100000-0000-4000-8000-0000000000ff", "Nothing"]);
        out["programme"] = await step(tx, adm, "public.save_programme($1, $2)", [DEPT_SE, "BS Artificial Intelligence"]);
        out["programme_again"] = await call(tx, adm, "public.save_programme($1, $2)", [DEPT_SE, "bs artificial intelligence"]);
        out["programme_unknown_department"] = await call(tx, adm, "public.save_programme($1, $2)", ["9e100000-0000-4000-8000-0000000000ff", "BS X"]);
        const prog = value(await call(tx, OWNER, `(select id from public.programmes where name = 'BS Data Science')`));
        out["delete_programme"] = await step(tx, adm, "public.delete_programme($1)", [prog]);
        out["delete_programme_again"] = await call(tx, adm, "public.delete_programme($1)", [prog]);
        out["delete_department"] = await step(tx, adm, "public.delete_department($1)", [DEPT_SE]);
        out["delete_department_again"] = await call(tx, adm, "public.delete_department($1)", [DEPT_SE]);
        out["without_two_factor"] = await call(tx, as(UNIADM, "aal1"), "public.save_department(null, $1)", ["Physics"]);
        out["student"] = await call(tx, as(ALI, "aal2"), "public.save_department(null, $1)", ["Physics"]);
        out["signed_out"] = await call(tx, ANON, "public.save_department(null, $1)", ["Physics"]);
        out["department_options_after"] = await call(tx, as(ALI), "public.department_options()");
        return out;
      }));
  });

  describe("friends, blocks and mutes", () => {
    const G = "friends";

    it("requests: send, accept, decline, cancel, and every refusal", () =>
      check(G, "requests", async (tx) => {
        const out: Row = {};
        out["send"] = await stepRows(tx, as(ALI), `select * from public.send_friend_request($1)`, ["@pg_bina".slice(1)]);
        out["send_again_rate_limited"] = await stepRows(tx, as(ALI), `select * from public.send_friend_request($1)`, ["pg_chand"]);
        out["duplicate_from_other_side_accepts"] = await stepRows(tx, as(BINA), `select * from public.send_friend_request($1)`, [" PG_ALI "]);
        out["already_friends"] = await rows(tx, as(BINA), `select * from public.send_friend_request($1)`, ["pg_ali"]);
        out["self"] = await rows(tx, as(CHAND), `select * from public.send_friend_request($1)`, ["pg_chand"]);
        out["unknown"] = await rows(tx, as(CHAND), `select * from public.send_friend_request($1)`, ["pg_nobody"]);
        out["chand_to_dua"] = await stepRows(tx, as(CHAND), `select * from public.send_friend_request($1)`, ["pg_dua"]);
        out["eman_to_dua"] = await stepRows(tx, as(EMAN), `select * from public.send_friend_request($1)`, ["pg_dua"]);
        out["staff_to_dua"] = await stepRows(tx, as(STAFF), `select * from public.send_friend_request($1)`, ["pg_dua"]);
        out["dua_requests"] = await rows(tx, as(DUA), `select direction, user_id, username, full_name, avatar_path, department, graduation_year from public.my_friend_requests()`);
        out["chand_requests"] = await rows(tx, as(CHAND), `select direction, user_id, username, full_name, avatar_path, department, graduation_year from public.my_friend_requests()`);
        out["dua_pending_count"] = await call(tx, as(DUA), "public.pending_friend_request_count()");
        const fromChand = value(await call(tx, OWNER, `(select id from public.friend_requests where sender_id = $1 and receiver_id = $2)`, [CHAND, DUA]));
        const fromEman = value(await call(tx, OWNER, `(select id from public.friend_requests where sender_id = $1 and receiver_id = $2)`, [EMAN, DUA]));
        const fromStaff = value(await call(tx, OWNER, `(select id from public.friend_requests where sender_id = $1 and receiver_id = $2)`, [STAFF, DUA]));
        out["respond_by_sender"] = await call(tx, as(CHAND), "public.respond_friend_request($1, true)", [fromChand]);
        out["accept"] = await step(tx, as(DUA), "public.respond_friend_request($1, true)", [fromChand]);
        out["accept_again"] = await call(tx, as(DUA), "public.respond_friend_request($1, true)", [fromChand]);
        out["decline"] = await step(tx, as(DUA), "public.respond_friend_request($1, false)", [fromEman]);
        out["cancel_by_receiver"] = await call(tx, as(DUA), "public.cancel_friend_request($1)", [fromStaff]);
        out["cancel"] = await step(tx, as(STAFF), "public.cancel_friend_request($1)", [fromStaff]);
        out["cancel_again"] = await call(tx, as(STAFF), "public.cancel_friend_request($1)", [fromStaff]);
        out["resend_after_decline"] = await stepRows(tx, as(EMAN), `select * from public.send_friend_request($1)`, ["pg_dua"]);
        out["signed_out_send"] = await rows(tx, ANON, `select * from public.send_friend_request($1)`, ["pg_dua"]);
        out["signed_out_respond"] = await call(tx, ANON, "public.respond_friend_request($1, true)", [fromEman]);
        out["signed_out_cancel"] = await call(tx, ANON, "public.cancel_friend_request($1)", [fromEman]);
        out["signed_out_count"] = await call(tx, ANON, "public.pending_friend_request_count()");
        out["ali_friends"] = await rows(tx, as(ALI), `select user_id, username, full_name, avatar_path, department, graduation_year from public.my_friends()`);
        out["dua_friends"] = await rows(tx, as(DUA), `select user_id, username, full_name, avatar_path, department, graduation_year from public.my_friends()`);
        return out;
      }));

    it("friendship_state for every state, and unfriend", () =>
      check(G, "state_and_unfriend", async (tx) => {
        await befriend(tx, ALI, BINA);
        await tx.unsafe(`insert into public.friend_requests (sender_id, receiver_id) values ($1, $2)`, [ALI, CHAND]);
        await tx.unsafe(`insert into public.friend_requests (sender_id, receiver_id) values ($1, $2)`, [EMAN, ALI]);
        await tx.unsafe(`insert into public.blocks (blocker_id, blocked_id) values ($1, $2), ($3, $1)`, [ALI, STAFF, DUA]);
        const state = (actor: StackActor, u: string) => rows(tx, actor, `select state, request_id is not null as has_request from public.friendship_state($1)`, [u]);
        const out: Row = {
          self: await state(as(ALI), "pg_ali"),
          friends: await state(as(ALI), "pg_bina"),
          sent: await state(as(ALI), "pg_chand"),
          received: await state(as(ALI), "PG_EMAN"),
          blocked_by_me: await state(as(ALI), "pg_staff"),
          blocked_me: await state(as(ALI), "pg_dua"),
          none: await state(as(BINA), "pg_eman"),
          unknown: await state(as(ALI), "pg_nobody"),
          signed_out: await state(ANON, "pg_ali"),
        };
        out["unfriend"] = await step(tx, as(BINA), "public.unfriend($1)", ["pg_ali"]);
        out["unfriend_again"] = await call(tx, as(BINA), "public.unfriend($1)", ["pg_ali"]);
        out["unfriend_self"] = await call(tx, as(BINA), "public.unfriend($1)", ["pg_bina"]);
        out["unfriend_unknown"] = await call(tx, as(BINA), "public.unfriend($1)", ["pg_nobody"]);
        out["unfriend_pending_request_only"] = await call(tx, as(ALI), "public.unfriend($1)", ["pg_chand"]);
        out["unfriend_signed_out"] = await call(tx, ANON, "public.unfriend($1)", ["pg_ali"]);
        return out;
      }));

    it("block and unblock, and what a blocked person can do", () =>
      check(G, "blocks", async (tx) => {
        await befriend(tx, ALI, BINA);
        await tx.unsafe(`insert into public.friend_requests (sender_id, receiver_id) values ($1, $2)`, [BINA, DUA]);
        await tx.unsafe(`insert into public.user_mutes (user_id, muted_id) values ($1, $2)`, [ALI, BINA]);
        const out: Row = {};
        out["block_friend"] = await step(tx, as(ALI), "public.block_user($1)", ["pg_bina"]);
        out["block_again"] = await step(tx, as(ALI), "public.block_user($1)", ["pg_bina"]);
        out["block_self"] = await call(tx, as(ALI), "public.block_user($1)", ["pg_ali"]);
        out["block_unknown"] = await call(tx, as(ALI), "public.block_user($1)", ["pg_nobody"]);
        out["block_signed_out"] = await call(tx, ANON, "public.block_user($1)", ["pg_bina"]);
        out["blocked_sends_request"] = await rows(tx, as(BINA), `select * from public.send_friend_request($1)`, ["pg_ali"]);
        out["blocker_sends_request"] = await rows(tx, as(ALI), `select * from public.send_friend_request($1)`, ["pg_bina"]);
        out["blocked_reads_blocks"] = await rows(tx, as(BINA), `select blocker_id, blocked_id from public.blocks`);
        out["blocker_reads_blocks"] = await rows(tx, as(ALI), `select blocker_id, blocked_id from public.blocks`);
        out["blocked_inserts_friendship"] = await exec(tx, as(BINA), `insert into public.friendships (user_id_a, user_id_b) values (least($1::uuid, $2::uuid), greatest($1::uuid, $2::uuid))`, [ALI, BINA]);
        out["blocked_deletes_block"] = await stepExec(tx, as(BINA), `delete from public.blocks where blocker_id = $1`, [ALI]);
        out["blocked_inserts_request"] = await exec(tx, as(BINA), `insert into public.friend_requests (sender_id, receiver_id) values ($1, $2)`, [BINA, ALI]);
        out["blocker_mutes_blocked"] = await call(tx, as(ALI), "public.mute_user($1, true)", ["pg_bina"]);
        out["my_blocks"] = await rows(tx, as(ALI), `select username, full_name from public.my_blocks()`);
        out["my_blocks_blocked_side"] = await rows(tx, as(BINA), `select username, full_name from public.my_blocks()`);
        out["receiver_blocks_sender_of_pending_request"] = await call(tx, as(DUA), "public.block_user($1)", ["pg_bina"]);
        out["unblock"] = await step(tx, as(ALI), "public.unblock_user($1)", ["PG_BINA"]);
        out["unblock_again"] = await call(tx, as(ALI), "public.unblock_user($1)", ["pg_bina"]);
        out["unblock_unknown"] = await call(tx, as(ALI), "public.unblock_user($1)", ["pg_nobody"]);
        out["unblock_signed_out"] = await call(tx, ANON, "public.unblock_user($1)", ["pg_bina"]);
        out["my_blocks_signed_out"] = await rows(tx, ANON, `select * from public.my_blocks()`);
        return out;
      }));

    it("accepting a request from someone you have since blocked", () =>
      check(G, "accept_blocked", async (tx) => {
        await tx.unsafe(`insert into public.friend_requests (sender_id, receiver_id) values ($1, $2)`, [ALI, BINA]);
        const id = value(await call(tx, OWNER, `(select id from public.friend_requests where sender_id = $1)`, [ALI]));
        await tx.unsafe(`insert into public.blocks (blocker_id, blocked_id) values ($1, $2)`, [BINA, CHAND]);
        await tx.unsafe(`insert into public.friend_requests (sender_id, receiver_id) values ($1, $2)`, [CHAND, BINA]);
        const id2 = value(await call(tx, OWNER, `(select id from public.friend_requests where sender_id = $1)`, [CHAND]));
        return {
          accept_ok: await step(tx, as(BINA), "public.respond_friend_request($1, true)", [id]),
          accept_blocked: await step(tx, as(BINA), "public.respond_friend_request($1, true)", [id2]),
          decline_blocked: await step(tx, as(BINA), "public.respond_friend_request($1, false)", [id2]),
        };
      }));

    it("mute and unmute", () =>
      check(G, "mutes", async (tx) => {
        await tx.unsafe(`insert into public.blocks (blocker_id, blocked_id) values ($1, $2)`, [DUA, ALI]);
        return {
          mute: await step(tx, as(ALI), "public.mute_user($1, true)", ["pg_bina"]),
          mute_again: await step(tx, as(ALI), "public.mute_user($1, true)", ["pg_bina"]),
          mute_second: await step(tx, as(ALI), "public.mute_user($1, true)", ["pg_eman"]),
          list: await rows(tx, as(ALI), `select username, full_name from public.my_mutes()`),
          unmute: await step(tx, as(ALI), "public.mute_user($1, false)", ["pg_bina"]),
          unmute_not_muted: await step(tx, as(ALI), "public.mute_user($1, false)", ["pg_bina"]),
          mute_self: await call(tx, as(ALI), "public.mute_user($1, true)", ["pg_ali"]),
          mute_unknown: await call(tx, as(ALI), "public.mute_user($1, true)", ["pg_nobody"]),
          mute_blocked_by_them: await call(tx, as(ALI), "public.mute_user($1, true)", ["pg_dua"]),
          mute_signed_out: await call(tx, ANON, "public.mute_user($1, true)", ["pg_bina"]),
          list_signed_out: await rows(tx, ANON, `select * from public.my_mutes()`),
          list_after: await rows(tx, as(ALI), `select username, full_name from public.my_mutes()`),
          direct_insert: await exec(tx, as(ALI), `insert into public.user_mutes (user_id, muted_id) values ($1, $2)`, [ALI, CHAND]),
        };
      }));
  });

  describe("shell, tours and tips", () => {
    const G = "shell";

    it("ui_state, tours and tips", () =>
      check(G, "learn", async (tx) => ({
        tour_fresh: await call(tx, as(ALI), "public.tour_state($1)", ["student"]),
        save_progress: await step(tx, as(ALI), "public.save_tour($1, $2, $3)", ["student", 3, "progress"]),
        tour_after_progress: await call(tx, as(ALI), "public.tour_state($1)", ["student"]),
        save_completed: await step(tx, as(ALI), "public.save_tour($1, $2, $3)", ["student", 9, "completed"]),
        save_after_completed: await step(tx, as(ALI), "public.save_tour($1, $2, $3)", ["student", 2, "skipped"]),
        tour_after: await call(tx, as(ALI), "public.tour_state($1)", ["student"]),
        save_unknown_tour: await call(tx, as(ALI), "public.save_tour($1, $2, $3)", ["golden", 1, "progress"]),
        save_unknown_outcome: await call(tx, as(ALI), "public.save_tour($1, $2, $3)", ["student", 1, "maybe"]),
        save_bad_step: await call(tx, as(ALI), "public.save_tour($1, $2, $3)", ["student", 51, "progress"]),
        save_not_onboarded: await call(tx, as(NEWBIE), "public.save_tour($1, $2, $3)", ["student", 1, "progress"]),
        restart: await step(tx, as(ALI), "public.restart_tour($1)", ["student"]),
        restart_unknown: await step(tx, as(ALI), "public.restart_tour($1)", ["golden"]),
        tour_signed_out: await call(tx, ANON, "public.tour_state($1)", ["student"]),
        tour_not_onboarded: await call(tx, as(NEWBIE), "public.tour_state($1)", ["student"]),
        tip: await step(tx, as(ALI), "public.see_tip($1)", ["cv"]),
        tip_again: await step(tx, as(ALI), "public.see_tip($1)", ["cv"]),
        tip_unknown: await call(tx, as(ALI), "public.see_tip($1)", ["golden"]),
        tip_signed_out: await call(tx, ANON, "public.see_tip($1)", ["cv"]),
        ui: await step(tx, as(ALI), "public.set_ui_state($1, $2::jsonb)", ["checklist_dismissed", "true"]),
        ui_replace: await step(tx, as(ALI), "public.set_ui_state($1, $2::jsonb)", ["checklist_dismissed", "false"]),
        ui_date: await step(tx, as(ALI), "public.set_ui_state($1, $2::jsonb)", ["progress_card_dismissed_on", '"2026-11-25"']),
        ui_unknown_key: await call(tx, as(ALI), "public.set_ui_state($1, $2::jsonb)", ["golden", "true"]),
        ui_too_long: await call(tx, as(ALI), "public.set_ui_state($1, $2::jsonb)", ["checklist_dismissed", JSON.stringify("x".repeat(100))]),
        ui_null: await call(tx, as(ALI), "public.set_ui_state($1, null)", ["checklist_dismissed"]),
        ui_not_onboarded: await call(tx, as(NEWBIE), "public.set_ui_state($1, $2::jsonb)", ["checklist_dismissed", "true"]),
        ui_read_own: await rows(tx, as(ALI), `select key, value from public.ui_state order by key`),
        ui_read_other: await rows(tx, as(BINA), `select key, value from public.ui_state`),
        tips_read_own: await rows(tx, as(ALI), `select tip_id from public.tips_seen order by tip_id`),
      })));

    it("nav_badges, todo_counts, getting_started and next_best_action with no other-service data", () =>
      check(G, "shell_reads", async (tx) => {
        await tx.unsafe(`insert into public.friend_requests (sender_id, receiver_id) values ($1, $2), ($3, $2)`, [BINA, ALI, CHAND]);
        await tx.unsafe(`update public.profiles set bio = 'Builds robots', avatar_path = $1 || '/avatar.webp' where user_id = $1`, [BINA]);
        const out: Row = {};
        for (const [name, user] of [["ali", ALI], ["bina", BINA]] as const) {
          out[name] = {
            nav_badges: await call(tx, as(user), "public.nav_badges()"),
            todo_counts: await call(tx, as(user), "public.todo_counts()"),
            getting_started: await call(tx, as(user), "public.getting_started()"),
            next_best_action: await call(tx, as(user), "public.next_best_action()"),
            inputs: {
              next_tier: await call(tx, OWNER, "private.next_tier_requirements($1)", [user]),
              formula_points: await call(
                tx,
                OWNER,
                `(select jsonb_build_object('l2', (f->'skills'->'level_points'->>'2')::numeric, 'venture', (f->'work'->>'venture_points')::numeric,
                         'endorsement', (f->'endorsements'->>'points')::numeric) from (select value as f from private.ranking_formula()) x)`,
              ),
            },
          };
        }
        out["not_onboarded"] = await call(tx, as(NEWBIE), "public.nav_badges()");
        out["signed_out"] = await call(tx, ANON, "public.nav_badges()");
        out["getting_started_signed_out"] = await call(tx, ANON, "public.getting_started()");
        return out;
      }));
  });

  describe("search and suggestions", () => {
    const G = "search";
    const cols = `user_id, username, full_name, department, graduation_year, university, avatar_path, skills, friendship`;

    it("search_people", () =>
      check(G, "search_people", async (tx) => {
        await befriend(tx, ALI, BINA);
        await tx.unsafe(`insert into public.friend_requests (sender_id, receiver_id) values ($1, $2), ($3, $1)`, [ALI, CHAND, EMAN]);
        await tx.unsafe(`insert into public.blocks (blocker_id, blocked_id) values ($1, $2)`, [STAFF, ALI]);
        const s = (actor: StackActor, q: string | null, extra: unknown[] = [null, null, null, 0, null]) =>
          rows(tx, actor, `select ${cols} from public.search_people($1, $2, $3, $4, $5, $6::smallint)`, [q, ...extra]);
        return {
          by_surname: await s(as(ALI), "zyxwar"),
          by_other_surname: await s(as(ALI), "Qorvel"),
          by_username_exact: await s(as(ALI), "pg_dua"),
          by_prefix_words: await s(as(ALI), "ali zyx"),
          one_letter: await s(as(ALI), "z"),
          empty: await s(as(ALI), "   "),
          department_in_scope: await s(as(BINA), "computer"),
          department_out_of_scope: await s(as(CHAND), "computer"),
          department_filter: await s(as(ALI), "zyxwar", ["software", null, null, 0, null]),
          batch_filter: await s(as(ALI), "zyxwar", [null, null, null, 0, 2027]),
          batch_filter_other_university: await s(as(CHAND), "zyxwar", [null, null, null, 0, 2027]),
          university_filter: await s(as(ALI), "qorvel", [null, null, "people-golden-b", 0, null]),
          skill_filter: await s(as(ALI), "zyxwar", [null, "react", null, 0, null]),
          offset: await s(as(ALI), "zyxwar", [null, null, null, 1, null]),
          blocked_hidden: await s(as(STAFF), "ali"),
          like_metacharacters: await s(as(ALI), "%_"),
          signed_out: await s(ANON, "zyxwar"),
        };
      }));

    it("search_people rate limit (60 a minute)", () =>
      check(G, "search_rate_limit", async (tx) => {
        let refusedAt = 0;
        let last: SqlOutcome<unknown> | undefined;
        for (let i = 1; i <= 61; i++) {
          last = await rows(tx, as(BINA), `select user_id from public.search_people($1)`, ["zyxwar"]);
          if (!last.ok && refusedAt === 0) refusedAt = i;
        }
        return { refused_at: refusedAt, last };
      }));

    it("people_you_may_know and dismiss_suggestion", () =>
      check(G, "people_you_may_know", async (tx) => {
        // ALI: BINA same batch; DUA same university (other department, friends-only); STAFF same batch.
        await befriend(tx, BINA, DUA);
        await befriend(tx, BINA, STAFF);
        const out: Row = {};
        // Ahmed (2026-11-25): apply the limit today's SQL intended, least(greatest(coalesce(p_limit, 8), 1), 30).
        // The old function placed it where it never cut the list, so the recording applies it to its output.
        const limited = (r: unknown, limit: number | null) => {
          const o = r as { ok: boolean; value?: unknown };
          return o.ok && Array.isArray(o.value) ? { ...o, value: o.value.slice(0, Math.min(Math.max(limit ?? 8, 1), 30)) } : r;
        };
        out["ali_default"] = limited(await call(tx, as(ALI), "public.people_you_may_know()"), null);
        out["ali_limit_1"] = limited(await call(tx, as(ALI), "public.people_you_may_know(1)"), 1);
        out["ali_limit_0"] = limited(await call(tx, as(ALI), "public.people_you_may_know(0)"), 0);
        await befriend(tx, ALI, BINA);
        out["after_friend"] = await call(tx, as(ALI), "public.people_you_may_know()");
        out["dismiss"] = await step(tx, as(ALI), "public.dismiss_suggestion($1)", ["pg_staff"]);
        out["dismiss_again"] = await step(tx, as(ALI), "public.dismiss_suggestion($1)", ["PG_STAFF"]);
        out["dismiss_self"] = await call(tx, as(ALI), "public.dismiss_suggestion($1)", ["pg_ali"]);
        out["dismiss_unknown"] = await call(tx, as(ALI), "public.dismiss_suggestion($1)", ["pg_nobody"]);
        out["dismiss_signed_out"] = await call(tx, ANON, "public.dismiss_suggestion($1)", ["pg_staff"]);
        out["after_dismiss"] = await call(tx, as(ALI), "public.people_you_may_know()");
        await tx.unsafe(`insert into public.user_mutes (user_id, muted_id) values ($1, $2)`, [BINA, ALI]);
        out["bina_muted_ali"] = await call(tx, as(BINA), "public.people_you_may_know()");
        await tx.unsafe(`insert into public.friend_requests (sender_id, receiver_id) values ($1, $2)`, [CHAND, EMAN]);
        out["chand_pending_request"] = await call(tx, as(CHAND), "public.people_you_may_know()");
        out["eman"] = await call(tx, as(EMAN), "public.people_you_may_know()");
        out["not_onboarded"] = await call(tx, as(NEWBIE), "public.people_you_may_know()");
        out["signed_out"] = await call(tx, ANON, "public.people_you_may_know()");
        out["pure_department_key"] = {
          spaces: await call(tx, OWNER, "private.department_key($1)", ["  Computer Science "]),
          empty: await call(tx, OWNER, "private.department_key($1)", ["   "]),
          null: await call(tx, OWNER, "private.department_key(null)"),
        };
        return out;
      }));

    it("pure helpers: prefix_tsquery and contains_pattern", () =>
      check(G, "helpers", async (tx) => {
        const out: Row = {};
        for (const q of ["ali zyx", "a", "C++ dev", "", null, "o'brien", "one two three four five six seven eight nine", "%_\\"]) {
          out[JSON.stringify(q)] = {
            prefix: await call(tx, OWNER, "private.prefix_tsquery($1)::text", [q]),
            contains: await call(tx, OWNER, "private.contains_pattern($1)", [q]),
          };
        }
        return out;
      }));
  });

  describe("universities, requests and graduation", () => {
    const G = "universities";

    it("request_university, confirm and unsubscribe (anonymous)", () =>
      check(G, "requests", async (tx) => {
        const r = (email: string | null, name: string | null, consent: boolean | null, token: string | null) =>
          step(tx, ANON, "public.request_university($1, $2, $3, $4)", [email, name, consent, token]);
        const T1 = "a".repeat(40);
        const T2 = "b".repeat(40);
        await tx.unsafe(`insert into public.personal_email_domains (domain) values ('people-mail.test') on conflict do nothing`);
        return {
          closed_known_university: await r("Student@People-C.test", null, true, T1),
          again_same_email: await r("student@people-c.test", "Anything", true, "c".repeat(40)),
          unknown_domain_named: await r("x@people-new.test", "  People New University  ", true, T2),
          unknown_domain_no_name: await r("y@people-new.test", null, true, "d".repeat(40)),
          unknown_domain_short_name: await r("y@people-new.test", "P", true, "d".repeat(40)),
          live_university: await r("z@people-a.test", null, true, "e".repeat(40)),
          personal_domain: await r("z@people-mail.test", "Some University", true, "e".repeat(40)),
          no_consent: await r("w@people-new.test", "People New University", false, "f".repeat(40)),
          short_token: await r("w@people-new.test", "People New University", true, "short"),
          bad_email: await r("not-an-email", "People New University", true, "f".repeat(40)),
          confirm: await step(tx, ANON, "public.confirm_university_request($1)", [T1]),
          confirm_again: await step(tx, ANON, "public.confirm_university_request($1)", [T1]),
          confirm_named: await step(tx, ANON, "public.confirm_university_request($1)", [T2]),
          confirm_unknown: await call(tx, ANON, "public.confirm_university_request($1)", ["0".repeat(40)]),
          unsubscribe: await step(tx, ANON, "public.unsubscribe_university_request($1)", [T2]),
          unsubscribe_again: await step(tx, ANON, "public.unsubscribe_university_request($1)", [T2]),
          unsubscribe_unknown: await call(tx, ANON, "public.unsubscribe_university_request($1)", ["0".repeat(40)]),
          confirm_after_unsubscribe: await call(tx, ANON, "public.confirm_university_request($1)", [T2]),
          staff_view: await call(
            tx,
            as(STAFF, "aal2"),
            `(select jsonb_agg(x) from jsonb_array_elements(public.ops_university_requests()) x where x->>'domain' like '%people%')`,
          ),
          staff_view_student: await call(tx, as(ALI, "aal2"), "public.ops_university_requests()"),
          staff_view_aal1: await call(tx, as(STAFF, "aal1"), "public.ops_university_requests()"),
        };
      }));

    it("live dates, domains and final-year batches (staff)", () =>
      check(G, "staff", async (tx) => {
        const st = as(STAFF, "aal2");
        await tx.unsafe(`insert into public.personal_email_domains (domain) values ('people-mail.test') on conflict do nothing`);
        // Only the fixture's closed universities may be opened by "open all", so the count is the fixture's.
        await tx.unsafe(`update public.universities set live_at = now() where live_at is null and id <> all($1)`, [UNIS]);
        const out: Row = {};
        out["open_c"] = await step(tx, st, "public.ops_set_university_live($1, true, $2)", [UNI_C, "launch day"]);
        out["open_c_again"] = await step(tx, st, "public.ops_set_university_live($1, true, $2)", [UNI_C, "again"]);
        out["close_c"] = await step(tx, st, "public.ops_set_university_live($1, false, $2)", [UNI_C, "paused"]);
        out["no_reason"] = await call(tx, st, "public.ops_set_university_live($1, true, $2)", [UNI_C, " a "]);
        out["unknown_university"] = await call(tx, st, "public.ops_set_university_live($1, true, $2)", ["9e000000-0000-4000-8000-0000000000ff", "launch"]);
        out["open_all"] = await step(tx, st, "public.ops_open_all_universities($1)", ["public launch"]);
        out["open_all_again"] = await step(tx, st, "public.ops_open_all_universities($1)", ["public launch"]);
        out["add_domain"] = await step(tx, st, "public.ops_add_uni_domain($1, $2, $3, $4)", [UNI_B, " Students.People-B.TEST ", "student", "second domain"]);
        out["add_domain_taken"] = await call(tx, st, "public.ops_add_uni_domain($1, $2, $3, $4)", [UNI_A, "people-b.test", "both", "steal"]);
        out["add_domain_personal"] = await call(tx, st, "public.ops_add_uni_domain($1, $2, $3, $4)", [UNI_A, "people-mail.test", "both", "nope"]);
        out["add_domain_invalid"] = await call(tx, st, "public.ops_add_uni_domain($1, $2, $3, $4)", [UNI_A, "not a domain", "both", "nope"]);
        out["add_domain_kind"] = await call(tx, st, "public.ops_add_uni_domain($1, $2, $3, $4)", [UNI_A, "x.people-a.test", "alumni", "nope"]);
        out["add_domain_no_reason"] = await call(tx, st, "public.ops_add_uni_domain($1, $2, $3, $4)", [UNI_A, "x.people-a.test", "both", ""]);
        out["personal_domain_direct_insert"] = await exec(tx, OWNER, `insert into public.university_domains (university_id, domain, kind, source) values ($1, 'people-mail.test', 'both', 'ops')`, [UNI_A]);
        out["final_year"] = await step(tx, st, "public.ops_set_final_year_batch($1, $2::smallint, $3)", [UNI_A, 2026, "early exams"]);
        out["final_year_clear"] = await step(tx, st, "public.ops_set_final_year_batch($1, null, $2)", [UNI_A, "back to rule"]);
        out["final_year_bad"] = await call(tx, st, "public.ops_set_final_year_batch($1, $2::smallint, $3)", [UNI_A, 1900, "bad"]);
        out["final_year_short_reason"] = await call(tx, st, "public.ops_set_final_year_batch($1, $2::smallint, $3)", [UNI_A, 2026, "x"]);
        out["final_year_unknown"] = await call(tx, st, "public.ops_set_final_year_batch($1, $2::smallint, $3)", ["9e000000-0000-4000-8000-0000000000ff", 2026, "reason"]);
        out["batches"] = await rows(tx, st, `select university_id, name, final_year_batch, students, graduates from public.ops_batches() where university_id = any($1) order by name`, [UNIS]);
        for (const [name, actor] of [["student", as(ALI, "aal2")], ["aal1", as(STAFF, "aal1")], ["signed_out", ANON]] as const) {
          out[`refused_${name}`] = {
            live: await call(tx, actor, "public.ops_set_university_live($1, true, $2)", [UNI_C, "launch"]),
            open_all: await call(tx, actor, "public.ops_open_all_universities($1)", ["launch"]),
            domain: await call(tx, actor, "public.ops_add_uni_domain($1, $2, $3, $4)", [UNI_A, "y.people-a.test", "both", "reason"]),
            final_year: await call(tx, actor, "public.ops_set_final_year_batch($1, $2::smallint, $3)", [UNI_A, 2026, "reason"]),
            batches: await rows(tx, actor, `select count(*) from public.ops_batches()`),
          };
        }
        return out;
      }));

    it("graduate_rollover (scheduled job) and final_year_of", () =>
      check(G, "graduate_rollover", async (tx) => {
        // Only fixture students may graduate, so the count is the fixture's.
        await tx.unsafe(`update public.profiles set graduation_year = null where user_id <> all($1) and status = 'active' and role = 'student'`, [USERS]);
        const out: Row = {};
        out["before_september_2027"] = await step(tx, OWNER, "private.graduate_rollover($1::date)", ["2027-08-31"]);
        out["on_september_1_2027"] = await step(tx, OWNER, "private.graduate_rollover($1::date)", ["2027-09-01"]);
        out["again"] = await step(tx, OWNER, "private.graduate_rollover($1::date)", ["2027-09-01"]);
        await tx.unsafe(`update public.universities set final_year_batch = 2028 where id = $1`, [UNI_B]);
        out["early_batch_at_b"] = await step(tx, OWNER, "private.graduate_rollover($1::date)", ["2027-09-01"]);
        out["final_year_of"] = {
          a_rule: await call(tx, OWNER, "private.final_year_of($1) is not null", [UNI_A]),
          b_set: await call(tx, OWNER, "private.final_year_of($1)", [UNI_B]),
          unknown: await call(tx, OWNER, "private.final_year_of($1)", ["9e000000-0000-4000-8000-0000000000ff"]),
        };
        out["university_live"] = {
          a: await call(tx, OWNER, "private.university_live($1)", [UNI_A]),
          c: await call(tx, OWNER, "private.university_live($1)", [UNI_C]),
        };
        return out;
      }));

    it("sync_hec_universities (seed import)", () =>
      check(G, "sync_hec", async (tx) => {
        const rows1 = [
          { name: "People HEC One", slug: "people-golden-hec-one", city: "Lahore", province: "Punjab", domains: ["one.people-hec.test", "ONE2.people-hec.test"] },
          { name: "People HEC Two", slug: "people-golden-hec-two", city: "", province: "", domains: [] },
        ];
        const first = await step(tx, OWNER, "private.sync_hec_universities($1::text::jsonb)", [JSON.stringify(rows1)]);
        const rows2 = [{ name: "People HEC One", slug: "people-golden-hec-one", city: "Karachi", province: "Sindh", domains: ["one.people-hec.test"] }];
        return {
          first,
          update_drops_domain: await step(tx, OWNER, "private.sync_hec_universities($1::text::jsonb)", [JSON.stringify(rows2)]),
          not_an_array: await call(tx, OWNER, "private.sync_hec_universities($1::text::jsonb)", ['{"name":"x"}']),
        };
      }));
  });
});
