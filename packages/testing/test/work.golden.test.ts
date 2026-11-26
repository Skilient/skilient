/**
 * Work golden recordings (W5). Records what the current stack (local Supabase) returns for every ported work
 * function, so the W5 service can be held to the same results. The sheet is docs/azure/work-function-bins.md.
 *
 *   GOLDEN_STACK_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres GOLDEN_RECORD=1 pnpm exec vitest run test/work.golden.test.ts
 *
 * Without GOLDEN_RECORD it compares the stack with the files. Without GOLDEN_STACK_DB_URL the file is skipped.
 * Every case runs in its own transaction that is rolled back. now() is fixed inside a transaction: times are set
 * by moving created_at back as the owner.
 */
import { join } from "node:path";
import type postgres from "postgres";
import { describe, expect, it } from "vitest";
import { actAs, assertLocalStack, attempt, callCurrentStackSql, golden, type SqlOutcome, type StackActor } from "../src/golden";

const DB = process.env["GOLDEN_STACK_DB_URL"];
if (DB !== undefined) assertLocalStack(DB);
const DIR = join(import.meta.dirname, "golden", "work");

// ---------------------------------------------------------------------------
// Fixtures: fixed ids, `.test` domains, distinctive names, no secrets.
// ---------------------------------------------------------------------------
export const UNI_A = "9a000000-0000-4000-8000-00000000000a";
export const UNI_B = "9a000000-0000-4000-8000-00000000000b";
export const OMAR = "9b000000-0000-4000-8000-000000000001"; // A, owns VENTURE
export const MINA = "9b000000-0000-4000-8000-000000000002"; // A, member of VENTURE, friends-only profile, owns OPEN
export const ASAD = "9b000000-0000-4000-8000-000000000003"; // A, applicant
export const ULA = "9b000000-0000-4000-8000-000000000004"; // B, global profile
export const GUL = "9b000000-0000-4000-8000-000000000005"; // A, a graduate
export const BINA = "9b000000-0000-4000-8000-000000000006"; // A, a stranger who blocks Omar in some cases
export const USERS = [OMAR, MINA, ASAD, ULA, GUL, BINA];
export const UNIS = [UNI_A, UNI_B];
export const VENTURE = "9c000000-0000-4000-8000-000000000001"; // Omar's university-only project, recruiting, Mina a member
export const OPEN = "9c000000-0000-4000-8000-000000000002"; // Mina's public startup, in progress
export const ROLE = "9d000000-0000-4000-8000-000000000001"; // VENTURE's Frontend role, 1 slot
export const VENTURES = [VENTURE, OPEN];
export const EMAIL: Record<string, string> = {
  [OMAR]: "omar@work-a.test",
  [MINA]: "mina@work-a.test",
  [ASAD]: "asad@work-a.test",
  [ULA]: "ula@work-b.test",
  [GUL]: "gul@work-a.test",
  [BINA]: "bina@work-a.test",
};
export const NAME: Record<string, string> = {
  [OMAR]: "Omar Heron",
  [MINA]: "Mina Heron",
  [ASAD]: "Asad Heron",
  [ULA]: "Ula Plover",
  [GUL]: "Gul Heron",
  [BINA]: "Bina Heron",
};
export const USERNAME: Record<string, string> = {
  [OMAR]: "wk_omar",
  [MINA]: "wk_mina",
  [ASAD]: "wk_asad",
  [ULA]: "wk_ula",
  [GUL]: "wk_gul",
  [BINA]: "wk_bina",
};
export const UNI_OF: Record<string, string> = { [OMAR]: UNI_A, [MINA]: UNI_A, [ASAD]: UNI_A, [ULA]: UNI_B, [GUL]: UNI_A, [BINA]: UNI_A };
export const VISIBILITY_OF: Record<string, string> = { [MINA]: "friends", [ULA]: "global" };

const OWNER: StackActor = { role: "postgres" };
export const ANON: StackActor = { role: "anon", claims: { role: "anon" } };
export function as(user: string, aal: "aal1" | "aal2" = "aal1"): StackActor {
  return { role: "authenticated", claims: { sub: user, role: "authenticated", aal, email: EMAIL[user] } };
}

type Tx = postgres.TransactionSql;
type Row = Record<string, unknown>;

async function insertUser(tx: Tx, id: string): Promise<void> {
  await tx.unsafe(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                             raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, '', now() - interval '30 days',
             '{"provider":"email","providers":["email"]}'::jsonb, $3::text::jsonb, now() - interval '30 days', now())`,
    [id, EMAIL[id]!, JSON.stringify({ full_name: NAME[id] })],
  );
}

async function onboard(tx: Tx, id: string): Promise<void> {
  await tx.unsafe(
    `update public.profiles set username = $2, department = 'Computer Science', graduation_year = 2027, visibility = $3::public.profile_visibility,
            onboarding_complete = true where user_id = $1`,
    [id, USERNAME[id]!, VISIBILITY_OF[id] ?? "university"],
  );
  await tx.unsafe(`update public.onboarding_state set step = 6, completed_at = now() where user_id = $1`, [id]);
}

export const befriend = (tx: Tx, a: string, b: string) =>
  tx.unsafe(`insert into public.friendships (user_id_a, user_id_b) values (least($1::uuid, $2::uuid), greatest($1::uuid, $2::uuid))`, [a, b]);
export const block = (tx: Tx, a: string, b: string) => tx.unsafe(`insert into public.blocks (blocker_id, blocked_id) values ($1, $2)`, [a, b]);

/**
 * The shared world: two universities, six users (Gul a graduate), Omar's university-only project VENTURE
 * (recruiting; skills react and typescript; a Frontend role with one slot; one question; Mina a developer on the
 * team), and Mina's public startup OPEN (in progress; skill python). Created 20 days ago.
 */
export async function seed(tx: Tx): Promise<void> {
  await tx.unsafe(
    `insert into public.universities (id, name, slug, live_at) values
       ($1, 'Work Golden University A', 'work-golden-a', now() - interval '1 day'),
       ($2, 'Work Golden University B', 'work-golden-b', now() - interval '1 day')`,
    UNIS,
  );
  await tx.unsafe(`insert into public.university_domains (university_id, domain, kind, source) values ($1, 'work-a.test', 'both', 'ops'), ($2, 'work-b.test', 'both', 'ops')`, UNIS);
  for (const id of USERS) await insertUser(tx, id);
  for (const id of USERS) await onboard(tx, id);
  await tx.unsafe(`update public.profiles set status = 'graduate', graduated_at = now() - interval '1 day' where user_id = $1`, [GUL]);
  await tx.unsafe(
    `insert into public.ventures (id, owner_id, university_id, title, type, status, visibility, team_size, description, skill_ids, created_at)
     values ($1, $2, $3, 'Heron Robotics', 'project', 'recruiting', 'university', 4, 'A robot that sorts recycling.', '{react,typescript}', now() - interval '20 days'),
            ($4, $5, $3, 'Plover Pay', 'startup', 'in_progress', 'public', 3, 'Payments for campus stalls.', '{python}', now() - interval '20 days')`,
    [VENTURE, OMAR, UNI_A, OPEN, MINA],
  );
  await tx.unsafe(`insert into public.venture_members (venture_id, user_id, team_role, joined_at) values ($1, $2, 'lead', now() - interval '20 days'), ($3, $4, 'lead', now() - interval '20 days')`, [
    VENTURE,
    OMAR,
    OPEN,
    MINA,
  ]);
  await tx.unsafe(`insert into public.venture_members (venture_id, user_id, team_role, joined_at) values ($1, $2, 'developer', now() - interval '19 days')`, [VENTURE, MINA]);
  await tx.unsafe(`insert into public.venture_roles (id, venture_id, title, skill_ids, slots, created_at) values ($1, $2, 'Frontend', '{react}', 1, now() - interval '20 days')`, [ROLE, VENTURE]);
  await tx.unsafe(`insert into public.venture_questions (venture_id, position, body) values ($1, 1, 'What have you built before?')`, [VENTURE]);
}

// ---------------------------------------------------------------------------
// Calls and row snapshots
// ---------------------------------------------------------------------------
export async function call(tx: Tx, actor: StackActor, expr: string, params: unknown[] = []): Promise<SqlOutcome<unknown>> {
  const out = await attempt(tx, async (sp) => {
    await actAs(sp, actor);
    const rows = await sp.unsafe(`select ${expr} as v`, params as never[]);
    return (rows[0] as Row | undefined)?.["v"] ?? null;
  });
  await actAs(tx, OWNER);
  return out;
}

/** A set-returning function or a table read as `actor`: every row, in the order given. */
export async function rows(tx: Tx, actor: StackActor, text: string, params: unknown[] = []): Promise<SqlOutcome<unknown>> {
  const out = await attempt(tx, async (sp) => {
    await actAs(sp, actor);
    return [...(await sp.unsafe(text, params as never[]))];
  });
  await actAs(tx, OWNER);
  return out;
}

/**
 * Work's tables (ventures area), and the foreign rows its writes reach (notify's notifications, messaging's
 * team chats). Ventures are named by title, roles by title, so cases need few ids.
 */
const VT = `(select v.title from public.ventures v where v.id = x.venture_id)`;
export const SNAPSHOTS: Record<string, string> = {
  "public.ventures": `select x.title, x.type, x.owner_id, x.university_id, x.status, x.visibility, x.stage, x.pitch_url, x.affiliation, x.skill_ids,
            x.team_size, x.completed_at is not null as completed, x.abandoned_at is not null as abandoned
       from public.ventures x where x.owner_id = any($1) order by 1`,
  "public.venture_members": `select ${VT} as venture, x.user_id, x.team_role from public.venture_members x where x.user_id = any($1) order by 1, 2`,
  "public.venture_roles": `select ${VT} as venture, x.title, x.skill_ids, x.slots, x.filled from public.venture_roles x where x.venture_id in (select id from public.ventures where owner_id = any($1)) order by 1, 2`,
  "public.venture_questions": `select ${VT} as venture, x.position, x.body from public.venture_questions x where x.venture_id in (select id from public.ventures where owner_id = any($1)) order by 1, 2`,
  "public.application_threads": `select ${VT} as venture, x.candidate_id, x.owner_id, x.status, x.message, x.answers, x.decided_at is not null as decided,
            (select r.title from public.venture_roles r where r.id = x.role_id) as role
       from public.application_threads x where x.candidate_id = any($1) order by 1, 2, 4`,
  "public.application_messages": `select x.sender_id, x.body from public.application_messages x where x.sender_id = any($1) order by 1, 2`,
  "public.venture_invites": `select ${VT} as venture, x.invitee_id, x.inviter_id, x.status, x.responded_at is not null as responded from public.venture_invites x where x.invitee_id = any($1) order by 1, 2, 4`,
  "public.venture_follows": `select ${VT} as venture, x.user_id from public.venture_follows x where x.user_id = any($1) order by 1, 2`,
  "public.venture_updates": `select ${VT} as venture, x.author_id, x.body from public.venture_updates x where x.author_id = any($1) order by 1, 3`,
  "public.venture_deliverables": `select ${VT} as venture, x.label, x.url, x.added_by from public.venture_deliverables x where x.venture_id in (select id from public.ventures where owner_id = any($1)) order by 1, 2`,
  "public.contributions": `select ${VT} as venture, x.user_id, x.kind, x.description, x.evidence_url, x.hours, x.source, x.corrects_id is not null as correction, x.skill_ids
       from public.contributions x where x.user_id = any($1) order by 1, 2, 4`,
  "public.contribution_confirmations": `select c.description, x.confirmer_id, x.confirmer_role from public.contribution_confirmations x join public.contributions c on c.id = x.contribution_id
      where x.confirmer_id = any($1) order by 1, 2`,
  "public.venture_completions": `select ${VT} as venture, x.owner_id, x.team_size, x.weeks, x.skill_tags, x.deliverables, x.verified_members, x.backfilled
       from public.venture_completions x where x.owner_id = any($1) order by 1`,
  "public.venture_completion_members": `select ${VT} as venture, x.user_id, x.github_days, x.verified_entries, x.unconfirmed_entries
       from public.venture_completion_members x where x.user_id = any($1) order by 1, 2`,
  "public.notifications": `select user_id, actor_id, type, entity_type from public.notifications where user_id = any($1) order by user_id, type, actor_id`,
};

export async function snapshot(tx: Tx): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const [table, text] of Object.entries(SNAPSHOTS)) out[table] = (await tx.unsafe(text, [USERS] as never[])).map((r) => JSON.stringify(r));
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

export async function step(tx: Tx, actor: StackActor, expr: string, params: unknown[] = []) {
  const before = await snapshot(tx);
  const result = await call(tx, actor, expr, params);
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

const ok = (o: SqlOutcome<unknown>) => {
  if (!o.ok) throw new Error(`expected success: ${o.code} ${o.message}`);
  return o.value as string;
};

/** A manual contribution written as the owner, `hoursAgo` back; returns its id. */
export async function entry(tx: Tx, venture: string, user: string, description: string, hoursAgo = 1): Promise<string> {
  const [r] = await tx.unsafe(
    `insert into public.contributions (venture_id, user_id, kind, description, created_at) values ($1, $2, 'code', $3, now() - make_interval(hours => $4)) returning id::text`,
    [venture, user, description, hoursAgo],
  );
  return (r as unknown as { id: string }).id;
}

const CREATE = `public.create_venture($1::text::jsonb)`;
const NEW_VENTURE = {
  type: "startup",
  title: "  Heron Labs ",
  description: "Tools for labs.",
  visibility: "public",
  stage: "prototype",
  pitch_url: "https://heron.example/pitch",
  affiliation: " Incubator ",
  skill_ids: ["react", "python", "react"],
  team_size: 5,
  roles: [{ title: " Backend ", skill_ids: ["python"], slots: 2 }],
  questions: [" Why us? "],
};

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------
describe.skipIf(!DB)("work goldens on the current stack: ventures", () => {
  const G = "ventures";

  it("create_venture: owner and lead, roles and questions; limits and refusals", () =>
    check(G, "create_venture", async (tx) => {
      const out: Row = {};
      out["created"] = await step(tx, as(ASAD), CREATE, [JSON.stringify(NEW_VENTURE)]);
      out["defaults"] = await step(tx, as(ULA), CREATE, [JSON.stringify({ type: "project", title: "Plover Notes", description: "Shared notes." })]);
      out["too_many_roles"] = await call(tx, as(ASAD), CREATE, [JSON.stringify({ ...NEW_VENTURE, roles: Array(7).fill({ title: "Dev" }) })]);
      out["too_many_questions"] = await call(tx, as(ASAD), CREATE, [JSON.stringify({ ...NEW_VENTURE, questions: ["a?", "b?", "c?", "d?"] })]);
      out["unknown_skill"] = await call(tx, as(ASAD), CREATE, [JSON.stringify({ ...NEW_VENTURE, skill_ids: ["no-such-skill"] })]);
      out["project_with_stage"] = await call(tx, as(ASAD), CREATE, [JSON.stringify({ ...NEW_VENTURE, type: "project" })]);
      out["short_title"] = await call(tx, as(ASAD), CREATE, [JSON.stringify({ ...NEW_VENTURE, title: "ab" })]);
      out["signed_out"] = await call(tx, ANON, CREATE, [JSON.stringify(NEW_VENTURE)]);
      return out;
    }));

  it("update_venture and transition_venture: owner only, fields present change, the status machine", () =>
    check(G, "update_transition", async (tx) => {
      const out: Row = {};
      const upd = `public.update_venture($1, $2::text::jsonb)`;
      out["update"] = await step(tx, as(OMAR), upd, [VENTURE, JSON.stringify({ title: " Heron Robotics 2 ", skill_ids: ["typescript"], team_size: 5 })]);
      out["update_not_owner"] = await call(tx, as(MINA), upd, [VENTURE, JSON.stringify({ title: "Mine now" })]);
      out["update_unknown"] = await call(tx, as(OMAR), upd, ["9c000000-0000-4000-8000-0000000000ff", JSON.stringify({ title: "Nope" })]);
      const tr = `public.transition_venture($1, $2::public.venture_status)`;
      out["recruiting_to_completed"] = await call(tx, as(OMAR), tr, [VENTURE, "completed"]);
      out["to_in_progress"] = await step(tx, as(OMAR), tr, [VENTURE, "in_progress"]);
      out["complete_no_deliverable"] = await call(tx, as(OMAR), tr, [VENTURE, "completed"]);
      await tx.unsafe(`insert into public.venture_deliverables (venture_id, label, url, added_by) values ($1, 'Repo', 'https://example.com/repo', $2)`, [VENTURE, OMAR]);
      out["complete_unverified"] = await call(tx, as(OMAR), tr, [VENTURE, "completed"]);
      const a = await entry(tx, VENTURE, OMAR, "Built the arm", 30);
      const b = await entry(tx, VENTURE, MINA, "Wrote the firmware", 20);
      await tx.unsafe(`insert into public.contribution_confirmations (contribution_id, confirmer_id) values ($1, $2), ($3, $4)`, [a, MINA, b, OMAR]);
      out["complete"] = await step(tx, as(OMAR), tr, [VENTURE, "completed"]);
      out["completed_to_abandoned"] = await call(tx, as(OMAR), tr, [VENTURE, "abandoned"]);
      out["update_completed"] = await call(tx, as(OMAR), upd, [VENTURE, JSON.stringify({ title: "Too late" })]);
      out["abandon_open"] = await step(tx, as(MINA), tr, [OPEN, "abandoned"]);
      return out;
    }));
});

// ---------------------------------------------------------------------------
// More cases (added after the first recording; the seed and the helpers above are untouched)
// ---------------------------------------------------------------------------
const APPLY = `public.apply_to_venture(p_venture => $1::uuid, p_role => $2::uuid, p_message => $3::text, p_answers => $4::text[])`;

describe.skipIf(!DB)("work goldens on the current stack: applications and invites", () => {
  const G = "applications";

  it("apply_to_venture: visibility, role, answers, one pending, graduates; refusals", () =>
    check(G, "apply", async (tx) => {
      const out: Row = {};
      out["applied"] = await step(tx, as(ASAD), APPLY, [VENTURE, ROLE, " I can help ", ["  A drone  "]]);
      out["again"] = await call(tx, as(ASAD), APPLY, [VENTURE, null, "Again", ["x"]]);
      out["member"] = await call(tx, as(MINA), APPLY, [VENTURE, null, "Me", ["x"]]);
      out["other_university"] = await call(tx, as(ULA), APPLY, [VENTURE, null, "Hi", ["x"]]);
      out["graduate"] = await call(tx, as(GUL), APPLY, [VENTURE, null, "Hi", ["x"]]);
      out["wrong_answers"] = await call(tx, as(BINA), APPLY, [VENTURE, null, "Hi", []]);
      out["long_answer"] = await call(tx, as(BINA), APPLY, [VENTURE, null, "Hi", ["x".repeat(501)]]);
      out["unknown_role"] = await call(tx, as(BINA), APPLY, [VENTURE, "9d000000-0000-4000-8000-0000000000ff", "Hi", ["x"]]);
      out["public_no_questions"] = await step(tx, as(ULA), APPLY, [OPEN, null, "Count me in", []]);
      await tx.unsafe(`update public.venture_roles set filled = 1 where id = $1`, [ROLE]);
      out["role_filled"] = await call(tx, as(BINA), APPLY, [VENTURE, ROLE, "Hi", ["x"]]);
      await tx.unsafe(`update public.ventures set visibility = 'unlisted' where id = $1`, [OPEN]);
      out["unlisted"] = await call(tx, as(BINA), APPLY, [OPEN, null, "Hi", []]);
      await block(tx, OMAR, BINA);
      out["blocked_owner"] = await call(tx, as(BINA), APPLY, [VENTURE, null, "Hi", ["x"]]);
      out["signed_out"] = await call(tx, ANON, APPLY, [VENTURE, null, "Hi", ["x"]]);
      return out;
    }));

  it("decide, withdraw, messages: owner only, once; accepting fills the role and the team", () =>
    check(G, "decide", async (tx) => {
      const out: Row = {};
      const a = ok(await call(tx, as(ASAD), APPLY, [VENTURE, ROLE, "Pick me", ["Robots"]]));
      const b = ok(await call(tx, as(BINA), APPLY, [VENTURE, null, "Me too", ["Apps"]]));
      const c = ok(await call(tx, as(ULA), APPLY, [OPEN, null, "Hello", []]));
      const decide = `public.decide_application($1, $2)`;
      const msg = `public.add_application_message($1, $2)`;
      // The message id is a sequence value (not rolled back): recorded as a number only.
      const seq = (s: { result: SqlOutcome<unknown>; changes: unknown }) => ({ ...s, result: s.result.ok ? { ok: true, value: typeof s.result.value } : s.result });
      out["message_candidate"] = seq(await step(tx, as(ASAD), msg, [a, " When do we start? "]));
      out["message_owner"] = seq(await step(tx, as(OMAR), msg, [a, "Monday"]));
      out["message_outsider"] = await call(tx, as(MINA), msg, [a, "Hi"]);
      out["decide_not_owner"] = await call(tx, as(MINA), decide, [a, true]);
      out["accept"] = await step(tx, as(OMAR), decide, [a, true]);
      out["accept_again"] = await call(tx, as(OMAR), decide, [a, true]);
      out["message_after"] = await call(tx, as(ASAD), msg, [a, "Thanks"]);
      out["decline"] = await step(tx, as(OMAR), decide, [b, false]);
      out["withdraw"] = await step(tx, as(ULA), `public.withdraw_application($1)`, [c]);
      out["withdraw_again"] = await call(tx, as(ULA), `public.withdraw_application($1)`, [c]);
      out["decide_withdrawn"] = await call(tx, as(MINA), decide, [c, true]);
      out["decide_unknown"] = await call(tx, as(OMAR), decide, ["9e000000-0000-4000-8000-0000000000ff", true]);
      return out;
    }));

  it("invites: owner only, by username, university rule, one pending; respond and revoke", () =>
    check(G, "invites", async (tx) => {
      const out: Row = {};
      const invite = `public.invite_to_venture($1, $2)`;
      const respond = `public.respond_invite($1, $2)`;
      const i1 = await step(tx, as(OMAR), invite, [VENTURE, " WK_ASAD "]);
      out["invite"] = i1;
      out["again"] = await call(tx, as(OMAR), invite, [VENTURE, "wk_asad"]);
      out["member"] = await call(tx, as(OMAR), invite, [VENTURE, "wk_mina"]);
      out["other_university"] = await call(tx, as(OMAR), invite, [VENTURE, "wk_ula"]);
      out["unknown"] = await call(tx, as(OMAR), invite, [VENTURE, "wk_nobody"]);
      out["not_owner"] = await call(tx, as(MINA), invite, [VENTURE, "wk_bina"]);
      await call(tx, as(ASAD), APPLY, [VENTURE, null, "Also applying", ["x"]]);
      out["accept"] = await step(tx, as(ASAD), respond, [(i1.result as { value: string }).value, true]);
      out["accept_again"] = await call(tx, as(ASAD), respond, [(i1.result as { value: string }).value, true]);
      const i2 = ok(await call(tx, as(MINA), invite, [OPEN, "wk_ula"]));
      out["respond_not_invitee"] = await call(tx, as(BINA), respond, [i2, true]);
      out["decline"] = await step(tx, as(ULA), respond, [i2, false]);
      const i3 = ok(await call(tx, as(MINA), invite, [OPEN, "wk_bina"]));
      out["revoke_not_owner"] = await call(tx, as(OMAR), `public.revoke_invite($1)`, [i3]);
      out["revoke"] = await step(tx, as(MINA), `public.revoke_invite($1)`, [i3]);
      out["revoke_again"] = await call(tx, as(MINA), `public.revoke_invite($1)`, [i3]);
      out["respond_revoked"] = await call(tx, as(BINA), respond, [i3, true]);
      await block(tx, BINA, MINA);
      out["blocked"] = await call(tx, as(MINA), invite, [OPEN, "wk_bina"]);
      return out;
    }));
});

describe.skipIf(!DB)("work goldens on the current stack: teams", () => {
  const G = "teams";

  it("leave, remove, set role, transfer: owner rules and the team lock", () =>
    check(G, "members", async (tx) => {
      const out: Row = {};
      out["owner_leaves"] = await call(tx, as(OMAR), `public.leave_venture($1)`, [VENTURE]);
      out["outsider_leaves"] = await call(tx, as(ASAD), `public.leave_venture($1)`, [VENTURE]);
      out["set_role"] = await step(tx, as(OMAR), `public.set_member_role($1, $2, $3::public.venture_team_role)`, [VENTURE, MINA, "designer"]);
      out["set_role_not_member"] = await call(tx, as(OMAR), `public.set_member_role($1, $2, $3::public.venture_team_role)`, [VENTURE, ASAD, "designer"]);
      out["set_role_not_owner"] = await call(tx, as(MINA), `public.set_member_role($1, $2, $3::public.venture_team_role)`, [VENTURE, OMAR, "other"]);
      out["remove_owner"] = await call(tx, as(OMAR), `public.remove_venture_member($1, $2)`, [VENTURE, OMAR]);
      out["remove_not_member"] = await call(tx, as(OMAR), `public.remove_venture_member($1, $2)`, [VENTURE, ASAD]);
      out["transfer_not_member"] = await call(tx, as(OMAR), `public.transfer_venture_ownership($1, $2)`, [VENTURE, ASAD]);
      const a = ok(await call(tx, as(ASAD), APPLY, [VENTURE, null, "Hi", ["x"]]));
      out["transfer"] = await step(tx, as(OMAR), `public.transfer_venture_ownership($1, $2)`, [VENTURE, MINA]);
      out["pending_follows_owner"] = await rows(tx, as(MINA), `select owner_id from public.application_threads where id = $1`, [a]);
      out["old_owner_leaves"] = await step(tx, as(OMAR), `public.leave_venture($1)`, [VENTURE]);
      out["remove"] = await step(tx, as(MINA), `public.remove_venture_member($1, $2)`, [OPEN, MINA]);
      return out;
    }));

  it("roles, questions, deliverables: owner and member rules, limits", () =>
    check(G, "roles_deliverables", async (tx) => {
      const out: Row = {};
      const save = `public.save_venture_role(p_venture => $1::uuid, p_role => $2::uuid, p_title => $3::text, p_skill_ids => $4::text[], p_slots => $5::smallint)`;
      out["add_role"] = await step(tx, as(OMAR), save, [VENTURE, null, " Backend ", ["typescript"], 2]);
      out["edit_role"] = await step(tx, as(OMAR), save, [VENTURE, ROLE, "Frontend dev", ["react", "typescript"], 2]);
      out["edit_unknown_role"] = await call(tx, as(OMAR), save, [VENTURE, "9d000000-0000-4000-8000-0000000000ff", "X1", [], 1]);
      out["role_unknown_skill"] = await call(tx, as(OMAR), save, [VENTURE, null, "QA", ["nope"], 1]);
      out["role_not_owner"] = await call(tx, as(MINA), save, [VENTURE, null, "QA", [], 1]);
      for (const t of ["R3", "R4", "R5", "R6"]) await call(tx, as(OMAR), save, [VENTURE, null, t, [], 1]);
      out["seventh_role"] = await call(tx, as(OMAR), save, [VENTURE, null, "R7", [], 1]);
      out["delete_role"] = await step(tx, as(OMAR), `public.delete_venture_role($1, $2)`, [VENTURE, ROLE]);
      out["questions"] = await step(tx, as(OMAR), `public.set_venture_questions($1, $2::text[])`, [VENTURE, [" First? ", "Second?"]]);
      out["four_questions"] = await call(tx, as(OMAR), `public.set_venture_questions($1, $2::text[])`, [VENTURE, ["a1?", "b1?", "c1?", "d1?"]]);
      const add = `public.add_venture_deliverable($1, $2, $3)`;
      const d1 = await step(tx, as(MINA), add, [VENTURE, " Repo ", " https://example.com/r "]);
      out["deliverable_member"] = d1;
      out["deliverable_outsider"] = await call(tx, as(ASAD), add, [VENTURE, "Mine", "https://example.com/m"]);
      out["deliverable_http"] = await call(tx, as(OMAR), add, [VENTURE, "Insecure", "http://example.com"]);
      out["remove_deliverable_outsider"] = await call(tx, as(ASAD), `public.remove_venture_deliverable($1)`, [(d1.result as { value: string }).value]);
      out["remove_deliverable_owner"] = await step(tx, as(OMAR), `public.remove_venture_deliverable($1)`, [(d1.result as { value: string }).value]);
      out["remove_deliverable_gone"] = await call(tx, as(OMAR), `public.remove_venture_deliverable($1)`, [(d1.result as { value: string }).value]);
      return out;
    }));

  it("follow and updates: public only; members post; author or owner deletes", () =>
    check(G, "follow_updates", async (tx) => {
      const out: Row = {};
      const follow = `public.follow_venture($1, $2)`;
      out["follow_public"] = await step(tx, as(ULA), follow, [OPEN, true]);
      out["follow_again"] = await step(tx, as(ULA), follow, [OPEN, true]);
      out["follow_university"] = await call(tx, as(ASAD), follow, [VENTURE, true]);
      out["unfollow"] = await step(tx, as(ULA), follow, [OPEN, false]);
      const post = `public.post_venture_update($1, $2)`;
      const u1 = await step(tx, as(MINA), post, [VENTURE, " Arm works! "]);
      out["update_member"] = u1;
      out["update_outsider"] = await call(tx, as(ASAD), post, [VENTURE, "Hi"]);
      const u2 = ok(await call(tx, as(OMAR), post, [VENTURE, "Owner note"]));
      out["delete_not_author"] = await call(tx, as(ASAD), `public.delete_venture_update($1)`, [u2]);
      out["delete_by_owner"] = await step(tx, as(OMAR), `public.delete_venture_update($1)`, [(u1.result as { value: string }).value]);
      out["delete_own"] = await step(tx, as(OMAR), `public.delete_venture_update($1)`, [u2]);
      await tx.unsafe(`update public.ventures set status = 'abandoned', abandoned_at = now() where id = $1`, [VENTURE]);
      out["update_abandoned"] = await call(tx, as(MINA), post, [VENTURE, "Still here"]);
      return out;
    }));
});

describe.skipIf(!DB)("work goldens on the current stack: contributions", () => {
  const G = "contributions";
  const LOG = `public.log_contribution($1, $2::public.contribution_kind, $3, $4, $5, $6::text[])`;
  const CORRECT = `public.correct_contribution($1, $2::public.contribution_kind, $3, $4, $5, $6::text[])`;

  it("log, correct, confirm: members of open ventures; 24-hour corrections; no self-confirmation", () =>
    check(G, "log_correct_confirm", async (tx) => {
      const out: Row = {};
      const e1 = await step(tx, as(MINA), LOG, [VENTURE, "code", " Built the API ", " https://example.com/pr/1 ", 3.5, ["react"]]);
      out["log"] = e1;
      out["log_outsider"] = await call(tx, as(ASAD), LOG, [VENTURE, "code", "Me", null, null, []]);
      out["log_foreign_skill"] = await call(tx, as(MINA), LOG, [VENTURE, "code", "Py", null, null, ["python"]]);
      out["log_four_skills"] = await call(tx, as(MINA), LOG, [VENTURE, "code", "Many", null, null, ["react", "typescript", "python", "docker"]]);
      const id = (e1.result as { value: string }).value;
      out["confirm_own"] = await call(tx, as(MINA), `public.confirm_contribution($1)`, [id]);
      out["confirm_outsider"] = await call(tx, as(ASAD), `public.confirm_contribution($1)`, [id]);
      out["correct"] = await step(tx, as(MINA), CORRECT, [id, "docs", "Built and documented the API", null, 4, ["typescript"]]);
      out["correct_not_author"] = await call(tx, as(OMAR), CORRECT, [id, "docs", "Mine", null, null, []]);
      out["confirm"] = await step(tx, as(OMAR), `public.confirm_contribution($1)`, [id]);
      out["confirm_again"] = await step(tx, as(OMAR), `public.confirm_contribution($1)`, [id]);
      const listed = (await rows(tx, OWNER, `select id::text from public.contributions where corrects_id = $1`, [id])) as { value: { id: string }[] };
      const correction = listed.value[0]!.id;
      out["correct_a_correction"] = await call(tx, as(MINA), CORRECT, [correction, "docs", "Again", null, null, []]);
      out["confirm_a_correction"] = await call(tx, as(OMAR), `public.confirm_contribution($1)`, [correction]);
      const old = await entry(tx, VENTURE, MINA, "Old work", 30);
      out["correct_late"] = await call(tx, as(MINA), CORRECT, [old, "docs", "Late fix", null, null, []]);
      out["status"] = await rows(
        tx,
        as(OMAR),
        `select description, kind, source, confirmations, peer_verified, by_member, confirmed_by_me, corrected_at is not null as corrected
           from public.contributions_with_status where venture_id = $1 order by created_at`,
        [VENTURE],
      );
      out["verified_contributors"] = await call(tx, as(OMAR), `public.venture_verified_contributors($1)`, [VENTURE]);
      out["verified_contributors_outsider"] = await call(tx, as(ULA), `public.venture_verified_contributors($1)`, [VENTURE]);
      await tx.unsafe(`update public.ventures set status = 'abandoned', abandoned_at = now() where id = $1`, [VENTURE]);
      out["log_abandoned"] = await call(tx, as(MINA), LOG, [VENTURE, "code", "Late", null, null, []]);
      return out;
    }));
});

describe.skipIf(!DB)("work goldens on the current stack: reads", () => {
  const G = "reads";

  it("browse_ventures, venture_team, profile_ventures, venture_counts, venture_by_link: who sees what", () =>
    check(G, "views", async (tx) => {
      const out: Row = {};
      const browse = `select title, status, visibility, owner_username, members, team_size, open_slots, university_name
                        from public.browse_ventures($1::public.venture_type, $2::public.venture_status, $3, $4)`;
      out["browse_projects_a"] = await rows(tx, as(ASAD), browse, ["project", null, false, false]);
      out["browse_projects_b"] = await rows(tx, as(ULA), browse, ["project", null, false, false]);
      out["browse_startups_b"] = await rows(tx, as(ULA), browse, ["startup", null, false, false]);
      out["browse_open_roles"] = await rows(tx, as(ASAD), browse, ["project", null, true, false]);
      out["browse_my_university"] = await rows(tx, as(ULA), browse, ["startup", null, false, true]);
      out["browse_status"] = await rows(tx, as(ASAD), browse, ["startup", "recruiting", false, false]);
      const team = `select username, full_name, team_role, is_owner, profile_visible from public.venture_team($1)`;
      out["team_member"] = await rows(tx, as(OMAR), team, [VENTURE]);
      out["team_classmate"] = await rows(tx, as(ASAD), team, [VENTURE]);
      out["team_other_university"] = await rows(tx, as(ULA), team, [VENTURE]);
      const profile = `select title, status, team_role, is_owner from public.profile_ventures($1)`;
      out["profile_self"] = await rows(tx, as(MINA), profile, [MINA]);
      out["profile_other_university"] = await rows(tx, as(ULA), profile, [MINA]);
      out["counts"] = await rows(tx, as(ASAD), `select * from public.venture_counts($1)`, [VENTURE]);
      out["counts_hidden"] = await rows(tx, as(ULA), `select * from public.venture_counts($1)`, [VENTURE]);
      await tx.unsafe(`update public.ventures set visibility = 'unlisted' where id = $1`, [OPEN]);
      out["by_link"] = await rows(tx, as(ULA), `select title, status, visibility from public.venture_by_link($1)`, [OPEN]);
      out["by_link_counts"] = await rows(tx, as(ULA), `select * from public.venture_counts($1)`, [OPEN]);
      out["by_link_team"] = await rows(tx, as(ULA), team, [OPEN]);
      await block(tx, MINA, ULA);
      out["by_link_blocked"] = await rows(tx, as(ULA), `select title from public.venture_by_link($1)`, [OPEN]);
      return out;
    }));
});

// ---------------------------------------------------------------------------
// Evidence and growth (added after the ventures recording; the seed and the helpers above are untouched).
// Their own snapshot set, so earlier cases' snapshots stay as recorded.
// ---------------------------------------------------------------------------
const VX = `(select v.title from public.ventures v where v.id = x.venture_id)`;
export const SNAPSHOTS_2: Record<string, string> = {
  "public.endorsements": `select x.endorser_id, x.endorsee_id, ${VX} as venture, x.skill_id, x.evidence_id is not null as evidence, x.note, x.hidden
       from public.endorsements x where x.endorsee_id = any($1) order by 1, 2, 4`,
  "public.user_skills": `select x.user_id, x.skill_id, x.level, x.peer_verified from public.user_skills x where x.user_id = any($1) and x.level >= 1 order by 1, 2`,
  "public.credentials": `select x.user_id, x.title, x.issuer, x.issued_on::text, x.expires_on::text, x.file_type, x.status, x.recognised_issuer_id, x.claimed_by, x.reviewer_id, x.review_reason
       from public.credentials x where x.user_id = any($1) order by 1, 2`,
  "public.code_checks": `select x.user_id, x.skill_id, x.status, x.answers, x.started_at is not null as started, x.submitted_at is not null as submitted
       from public.code_checks x where x.user_id = any($1) order by 1, 2, 3`,
  "public.task_attempts": `select x.user_id, (select t.title from public.proof_tasks t where t.id = x.task_id) as task, x.status, x.route, x.repo_full_name
       from public.task_attempts x where x.user_id = any($1) order by 1, 2`,
  "public.path_follows": `select x.user_id, x.role from public.path_follows x where x.user_id = any($1) order by 1, 2`,
  "public.swap_offers": `select x.user_id, x.skill_id, x.note from public.swap_offers x where x.user_id = any($1) order by 1, 2`,
  "public.swap_wants": `select x.user_id, x.skill_id, x.note from public.swap_wants x where x.user_id = any($1) order by 1, 2`,
  "public.swaps": `select x.teacher_id, x.learner_id, x.skill_id, x.offered_skill_id, x.status, x.note, x.preferred_times, x.close_reason
       from public.swaps x where x.learner_id = any($1) order by 1, 2, 3, 5`,
  "public.swap_sessions": `select x.minutes, x.place, x.status, x.confirmed_minutes, x.no_show_reason from public.swap_sessions x
       join public.swaps s on s.id = x.swap_id where s.learner_id = any($1) order by 2, 3`,
  "public.swap_notes": `select x.author_id, x.teacher_id, x.body, x.status from public.swap_notes x where x.author_id = any($1) order by 3`,
};

async function snapshot2(tx: Tx): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const [table, text] of Object.entries(SNAPSHOTS_2)) out[table] = (await tx.unsafe(text, [USERS] as never[])).map((r) => JSON.stringify(r));
  return out;
}

async function step2(tx: Tx, actor: StackActor, expr: string, params: unknown[] = []) {
  const before = await snapshot2(tx);
  const result = await call(tx, actor, expr, params);
  return { result, changes: changes(before, await snapshot2(tx)) };
}

const MONTH_OK = `now()`;
void MONTH_OK;

/** A GitHub account for a user, written as the owner (the connect flow's result). */
async function githubAccount(tx: Tx, user: string, githubId: number, login: string): Promise<void> {
  await tx.unsafe(`insert into public.github_accounts (user_id, github_id, login) values ($1, $2, $3)`, [user, githubId, login]);
}

describe.skipIf(!DB)("work goldens on the current stack: endorsements", () => {
  const G = "endorsements";
  const ENDORSE = `public.endorse(p_endorsee => $1::uuid, p_venture => $2::uuid, p_items => $3::text::jsonb, p_note => $4::text)`;

  it("endorse: teammates in progress, evidence that shows the skill, once per skill, the limits; endorsements_for and hiding", () =>
    check(G, "endorse", async (tx) => {
      const out: Row = {};
      out["not_in_progress"] = await call(tx, as(OMAR), ENDORSE, [MINA, VENTURE, JSON.stringify([{ skill: "react" }]), null]);
      await tx.unsafe(`update public.ventures set status = 'in_progress' where id = $1`, [VENTURE]);
      const [e] = await tx.unsafe(`insert into public.contributions (venture_id, user_id, kind, description, skill_ids) values ($1, $2, 'code', 'Built the arm UI', '{react}') returning id::text`, [VENTURE, MINA]);
      const entry = (e as unknown as { id: string }).id;
      out["endorse"] = await step2(tx, as(OMAR), ENDORSE, [MINA, VENTURE, JSON.stringify([{ skill: "react", evidence: entry }, { skill: "typescript" }]), " Great work "]);
      out["again"] = await call(tx, as(OMAR), ENDORSE, [MINA, VENTURE, JSON.stringify([{ skill: "react" }]), null]);
      out["self"] = await call(tx, as(OMAR), ENDORSE, [OMAR, VENTURE, JSON.stringify([{ skill: "react" }]), null]);
      out["outsider"] = await call(tx, as(ASAD), ENDORSE, [MINA, VENTURE, JSON.stringify([{ skill: "react" }]), null]);
      out["not_teammate"] = await call(tx, as(OMAR), ENDORSE, [ASAD, VENTURE, JSON.stringify([{ skill: "react" }]), null]);
      out["empty"] = await call(tx, as(MINA), ENDORSE, [OMAR, VENTURE, JSON.stringify([]), null]);
      out["twice_in_one"] = await call(tx, as(MINA), ENDORSE, [OMAR, VENTURE, JSON.stringify([{ skill: "react" }, { skill: "react" }]), null]);
      out["foreign_skill"] = await call(tx, as(MINA), ENDORSE, [OMAR, VENTURE, JSON.stringify([{ skill: "python" }]), null]);
      out["evidence_not_theirs"] = await call(tx, as(MINA), ENDORSE, [OMAR, VENTURE, JSON.stringify([{ skill: "react", evidence: entry }]), null]);
      out["long_note"] = await call(tx, as(MINA), ENDORSE, [OMAR, VENTURE, JSON.stringify([{ skill: "react" }]), "x".repeat(281)]);
      out["too_many"] = await call(tx, as(MINA), ENDORSE, [OMAR, VENTURE, JSON.stringify(["react", "typescript", "python", "docker", "nextjs", "postgresql"].map((s) => ({ skill: s }))), null]);
      out["for_endorsee"] = await rows(tx, as(MINA), `select skill_id, skill_name, endorser_id, venture_title, note, has_evidence, hidden from public.endorsements_for($1) order by skill_id`, [MINA]);
      out["for_classmate"] = await rows(tx, as(ASAD), `select skill_id, endorser_id, hidden from public.endorsements_for($1) order by skill_id`, [MINA]);
      const [h] = await tx.unsafe(`select id::text from public.endorsements where endorsee_id = $1 and skill_id = 'react'`, [MINA]);
      out["hide"] = await step2(tx, as(MINA), `public.hide_endorsement($1, true)`, [(h as unknown as { id: string }).id]);
      out["hide_not_mine"] = await call(tx, as(OMAR), `public.hide_endorsement($1, true)`, [(h as unknown as { id: string }).id]);
      out["for_classmate_hidden"] = await rows(tx, as(ASAD), `select skill_id from public.endorsements_for($1) order by skill_id`, [MINA]);
      return out;
    }));
});

describe.skipIf(!DB)("work goldens on the current stack: code checks", () => {
  const G = "code_checks";

  it("request_code_check: blockers in order; start and save rules; code_check_state", () =>
    check(G, "student", async (tx) => {
      const out: Row = {};
      const req = `public.request_code_check($1)`;
      out["no_github"] = await call(tx, as(MINA), req, ["python"]);
      await githubAccount(tx, MINA, 9_900_001, "mina-gh");
      out["no_l2"] = await call(tx, as(MINA), req, ["python"]);
      await tx.unsafe(`insert into public.user_skills (user_id, skill_id, level, active_days, lines, hits, repos) values ($1, 'python', 2, 3, 200, 3, 1)`, [MINA]);
      out["unknown_skill"] = await call(tx, as(MINA), req, ["no-such-skill"]);
      const first = await step2(tx, as(MINA), req, ["python"]);
      out["requested"] = first;
      out["open"] = await call(tx, as(MINA), req, ["python"]);
      const id = (first.result as { value: string }).value;
      out["state"] = await rows(tx, as(MINA), `select status, blocker from public.code_check_state($1)`, ["python"]);
      out["start_preparing"] = await call(tx, as(MINA), `public.start_code_check($1)`, [id]);
      out["start_not_mine"] = await call(tx, as(ASAD), `public.start_code_check($1)`, [id]);
      await tx.unsafe(`update public.code_checks set status = 'ready', ready_at = now(), repo_id = 1, sha = $2, path = 'a.py', start_line = 1, end_line = 30 where id = $1`, [id, "f".repeat(40)]);
      out["start"] = await step2(tx, as(MINA), `public.start_code_check($1)`, [id]);
      out["save_not_served"] = await call(tx, as(MINA), `public.save_code_check($1, $2::text::jsonb, false)`, [id, JSON.stringify({ what: "x" })]);
      await tx.unsafe(`update public.code_checks set snippet_served_at = now(), deadline_at = now() + interval '20 minutes' where id = $1`, [id]);
      out["save_bad_keys"] = await call(tx, as(MINA), `public.save_code_check($1, $2::text::jsonb, false)`, [id, JSON.stringify({ how: "x" })]);
      out["save"] = await step2(tx, as(MINA), `public.save_code_check($1, $2::text::jsonb, false)`, [id, JSON.stringify({ what: "Adds" })]);
      out["submit"] = await step2(tx, as(MINA), `public.save_code_check($1, $2::text::jsonb, true)`, [id, JSON.stringify({ what: "Adds", why: "Totals", change: "sum()" })]);
      out["save_after"] = await call(tx, as(MINA), `public.save_code_check($1, $2::text::jsonb, false)`, [id, JSON.stringify({ what: "x" })]);
      return out;
    }));
});

describe.skipIf(!DB)("work goldens on the current stack: tasks and paths", () => {
  const G = "growth";
  const TASK = `(select id from public.proof_tasks where skill_id = 'docker' and active order by title limit 1)`;

  it("start_task, link_task_repo, submit_task, abandon_task; follow_path and its limit", () =>
    check(G, "tasks_paths", async (tx) => {
      const out: Row = {};
      const start = await step2(tx, as(ASAD), `public.start_task(${TASK})`);
      out["start"] = start;
      out["start_again_same"] = await call(tx, as(ASAD), `public.start_task(${TASK}) = $1::uuid`, [(start.result as { value: string }).value]);
      out["start_unknown"] = await call(tx, as(ASAD), `public.start_task('9f000000-0000-4000-8000-0000000000ff')`);
      const id = (start.result as { value: string }).value;
      out["link_no_github"] = await call(tx, as(ASAD), `public.link_task_repo($1, 5)`, [id]);
      out["submit_no_repo"] = await call(tx, as(ASAD), `public.submit_task($1)`, [id]);
      await githubAccount(tx, ASAD, 9_900_002, "asad-gh");
      out["link_unknown_repo"] = await call(tx, as(ASAD), `public.link_task_repo($1, 5)`, [id]);
      out["abandon"] = await step2(tx, as(ASAD), `public.abandon_task($1)`, [id]);
      out["abandon_again"] = await call(tx, as(ASAD), `public.abandon_task($1)`, [id]);
      const follow = `public.follow_path($1, $2)`;
      out["follow"] = await step2(tx, as(ASAD), follow, ["devops", true]);
      out["follow_again"] = await step2(tx, as(ASAD), follow, ["devops", true]);
      out["follow_second"] = await step2(tx, as(ASAD), follow, ["frontend", true]);
      out["follow_third"] = await call(tx, as(ASAD), follow, ["backend", true]);
      out["follow_unknown"] = await call(tx, as(ASAD), follow, ["astronaut", true]);
      out["unfollow"] = await step2(tx, as(ASAD), follow, ["devops", false]);
      return out;
    }));
});

describe.skipIf(!DB)("work goldens on the current stack: swaps", () => {
  const G = "swaps";
  const REQ = `public.request_swap(p_teacher => $1, p_skill => $2, p_note => $3, p_times => $4, p_offer => $5)`;

  it("offers, wants, a request across the rules, accept, a session proposed, accepted, confirmed with a note, closed", () =>
    check(G, "swap", async (tx) => {
      const out: Row = {};
      out["offer_no_l2"] = await call(tx, as(OMAR), `public.save_swap_offer($1, $2, true)`, ["typescript", "Happy to teach"]);
      await tx.unsafe(`insert into public.user_skills (user_id, skill_id, level) values ($1, 'typescript', 2), ($2, 'python', 2)`, [OMAR, ASAD]);
      out["offer"] = await step2(tx, as(OMAR), `public.save_swap_offer($1, $2, true)`, ["typescript", " Happy to teach "]);
      out["want"] = await step2(tx, as(ASAD), `public.save_swap_want($1, $2, true)`, ["typescript", null]);
      out["want_unknown"] = await call(tx, as(ASAD), `public.save_swap_want($1, $2, true)`, ["no-such-skill", null]);
      out["other_university"] = await call(tx, as(ULA), REQ, ["wk_omar", "typescript", null, null, null]);
      out["not_taught"] = await call(tx, as(ASAD), REQ, ["wk_omar", "react", null, null, null]);
      out["offer_back_no_l2"] = await call(tx, as(ASAD), REQ, ["wk_omar", "typescript", null, null, "react"]);
      out["self"] = await call(tx, as(OMAR), REQ, ["wk_omar", "typescript", null, null, null]);
      const r = await step2(tx, as(ASAD), REQ, ["wk_omar", "typescript", " Please ", "Evenings", "python"]);
      out["request"] = r;
      out["again"] = await call(tx, as(ASAD), REQ, ["wk_omar", "typescript", null, null, null]);
      const swap = (r.result as { value: string }).value;
      out["respond_not_teacher"] = await call(tx, as(ASAD), `public.respond_swap($1, true)`, [swap]);
      out["accept"] = await step2(tx, as(OMAR), `public.respond_swap($1, true)`, [swap]);
      out["accept_again"] = await call(tx, as(OMAR), `public.respond_swap($1, true)`, [swap]);
      const propose = `public.propose_swap_session(p_swap => $1::uuid, p_starts_at => now() + make_interval(days => $2), p_minutes => $3, p_place => $4)`;
      out["propose_past"] = await call(tx, as(OMAR), propose, [swap, -1, 60, "Library"]);
      out["propose_long"] = await call(tx, as(OMAR), propose, [swap, 1, 300, "Library"]);
      out["propose_no_place"] = await call(tx, as(OMAR), propose, [swap, 1, 60, " "]);
      const p = await step2(tx, as(OMAR), propose, [swap, 1, 60, " Library, room 2 "]);
      out["propose"] = p;
      const session = (p.result as { value: string }).value;
      out["respond_own"] = await call(tx, as(OMAR), `public.respond_swap_session($1, true)`, [session]);
      out["respond"] = await step2(tx, as(ASAD), `public.respond_swap_session($1, true)`, [session]);
      const confirm = `public.confirm_swap_session(p_session => $1::uuid, p_happened => $2, p_minutes => $3, p_reason => $4, p_note => $5)`;
      out["confirm_future"] = await call(tx, as(ASAD), confirm, [session, true, 60, null, null]);
      await tx.unsafe(`update public.swap_sessions set starts_at = now() - interval '2 hours' where id = $1`, [session]);
      out["confirm_teacher"] = await call(tx, as(OMAR), confirm, [session, true, 60, null, null]);
      out["confirm_no_reason"] = await call(tx, as(ASAD), confirm, [session, false, null, null, null]);
      out["confirm"] = await step2(tx, as(ASAD), confirm, [session, true, 60, null, " Thank you "]);
      out["end"] = await step2(tx, as(ASAD), `public.end_swap($1)`, [swap]);
      out["end_again"] = await call(tx, as(ASAD), `public.end_swap($1)`, [swap]);
      return out;
    }));
});

describe.skipIf(!DB)("work goldens on the current stack: credentials", () => {
  const G = "credentials";
  const object = (tx: Tx, user: string, name: string, mime: string, size: number) =>
    tx.unsafe(`insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values ('credentials', $1, $2::uuid, $4, $3::text::jsonb)`, [
      name,
      user,
      JSON.stringify({ mimetype: mime, size }),
      user,
    ]);
  const SUBMIT = `public.submit_credential($1::text::jsonb)`;

  it("submit_credential: the uploaded file, dates, limits; staff claim and review (audited); credentials_for", () =>
    check(G, "submit_review", async (tx) => {
      const out: Row = {};
      const pdf = `${ASAD}/9e100000-0000-4000-8000-000000000001.pdf`;
      const p = (o: Row = {}) => JSON.stringify({ path: pdf, title: " Cloud Practitioner ", issuer: " Amazon Web Services ", issued_on: "2026-01-10", ...o });
      out["no_upload"] = await call(tx, as(ASAD), SUBMIT, [p()]);
      out["others_folder"] = await call(tx, as(ASAD), SUBMIT, [p({ path: `${MINA}/9e100000-0000-4000-8000-000000000001.pdf` })]);
      await object(tx, ASAD, pdf, "application/pdf", 1000);
      out["future_date"] = await call(tx, as(ASAD), SUBMIT, [p({ issued_on: "2099-01-01" })]);
      out["bad_date"] = await call(tx, as(ASAD), SUBMIT, [p({ issued_on: "soon" })]);
      out["expiry_before"] = await call(tx, as(ASAD), SUBMIT, [p({ expires_on: "2025-01-01" })]);
      const s = await step2(tx, as(ASAD), SUBMIT, [p()]);
      out["submit"] = s;
      out["same_file"] = await call(tx, as(ASAD), SUBMIT, [p()]);
      const id = (s.result as { value: string }).value;
      const big = `${ASAD}/9e100000-0000-4000-8000-000000000002.pdf`;
      await object(tx, ASAD, big, "application/pdf", 6_000_000);
      out["too_big"] = await call(tx, as(ASAD), SUBMIT, [p({ path: big })]);
      out["for_before_review"] = await rows(tx, as(MINA), `select title from public.credentials_for($1)`, [ASAD]);
      await tx.unsafe(`insert into public.staff_roles (user_id, role) values ($1, 'trust_reviewer')`, [OMAR]);
      out["claim_aal1"] = await call(tx, as(OMAR), `public.claim_credential($1, true)`, [id]);
      out["review_unclaimed"] = await call(tx, as(OMAR, "aal2"), `public.review_credential($1, true, 'Checked', null)`, [id]);
      out["claim"] = await step2(tx, as(OMAR, "aal2"), `public.claim_credential($1, true)`, [id]);
      out["review_no_reason"] = await call(tx, as(OMAR, "aal2"), `public.review_credential($1, true, 'x', null)`, [id]);
      out["review_unknown_issuer"] = await call(tx, as(OMAR, "aal2"), `public.review_credential($1, true, 'Checked', 'no-such-issuer')`, [id]);
      out["approve"] = await step2(tx, as(OMAR, "aal2"), `public.review_credential($1, true, ' Verified on the site ', null)`, [id]);
      out["audit"] = await rows(tx, { role: "postgres" }, `select action, reason, before, after from public.ops_audit_log where target_id = $1 order by created_at, action`, [id]);
      out["for_after_review"] = await rows(tx, as(MINA), `select title, issuer, issued_on::text, recognised from public.credentials_for($1)`, [ASAD]);
      out["delete_not_mine"] = await call(tx, as(MINA), `public.delete_credential($1)`, [id]);
      out["delete"] = await step2(tx, as(ASAD), `public.delete_credential($1)`, [id]);
      return out;
    }));
});

// ---------------------------------------------------------------------------
// GitHub and skills: the functions the github-link and github-worker Edge Functions called (as the service role).
// ---------------------------------------------------------------------------
export const SNAPSHOTS_3: Record<string, string> = {
  "public.github_accounts": `select user_id, github_id, login, revoked_at is not null as revoked from public.github_accounts where user_id = any($1) order by 1`,
  "public.github_link_clashes": `select user_id, github_id, github_login, linked_user_id from public.github_link_clashes where user_id = any($1) order by 1`,
  "public.github_user_repos": `select ur.user_id, g.full_name, ur.installation_id, ur.kind, ur.excluded from public.github_user_repos ur join public.github_repos g on g.repo_id = ur.repo_id
      where ur.user_id = any($1) order by 1, 2`,
  "public.github_commits": `select user_id, repo_id, sha, seen_via, files, meaningful_lines, status, exclusion, extracted_at is not null as extracted
       from public.github_commits where user_id = any($1) order by 1, 2, 3`,
  "public.skill_evidence": `select user_id, skill_id, repo_id, sha, detectors, paths, lines from public.skill_evidence where user_id = any($1) order by 1, 2, 4`,
  "public.user_skills": `select user_id, skill_id, level, active_days, lines, hits, repos from public.user_skills where user_id = any($1) order by 1, 2`,
  "public.review_flags": `select user_id, kind, key, status from public.review_flags where user_id = any($1) order by 1, 2, 3`,
  "public.sync_jobs": `select user_id, trigger, status, stage from public.sync_jobs where user_id = any($1) order by 1, 2`,
};

async function snapshot3(tx: Tx): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const [table, text] of Object.entries(SNAPSHOTS_3)) out[table] = (await tx.unsafe(text, [USERS] as never[])).map((r) => JSON.stringify(r));
  return out;
}

async function step3(tx: Tx, actor: StackActor, expr: string, params: unknown[] = []) {
  const before = await snapshot3(tx);
  const result = await call(tx, actor, expr, params);
  return { result, changes: changes(before, await snapshot3(tx)) };
}

const SHA = (n: number) => n.toString(16).padStart(40, "a");

describe.skipIf(!DB)("work goldens on the current stack: github", () => {
  const G = "github";
  const SVC: StackActor = { role: "postgres" };
  const INSTALL = JSON.stringify([{ id: 777, account_id: 9001, account_login: "omar-gh", account_type: "User", repository_selection: "selected" }]);
  const ticket = async (tx: Tx, user: string) => {
    const [t] = await tx.unsafe(`insert into private.github_link_tickets (user_id, code, claimed_at) values ($1, 'c', now()) returning id::text`, [user]);
    return (t as unknown as { id: string }).id;
  };
  const LINK = `private.complete_github_link($1, $2, $3, 'gho_x', now() + interval '8 hours', 'ghr_x', now() + interval '180 days', $4::text::jsonb)`;

  it("complete_github_link, the discovered repositories, harvest and extraction, the levels; resync and disconnect", () =>
    check(G, "pipeline", async (tx) => {
      const out: Row = {};
      out["link"] = await step3(tx, SVC, LINK, [await ticket(tx, OMAR), 9001, "omar-gh", INSTALL]);
      out["clash"] = await step3(tx, SVC, LINK, [await ticket(tx, MINA), 9001, "omar-gh", "[]"]);
      out["other_account"] = await step3(tx, SVC, LINK, [await ticket(tx, OMAR), 9002, "omar-two", INSTALL]);
      await tx.unsafe(`update public.sync_jobs set status = 'done' where user_id = $1`, [OMAR]);
      const repos = JSON.stringify([{ id: 8101, full_name: "omar-gh/app", owner_id: 9001, private: false, fork: false, default_branch: "main", pushed_at: "2026-11-01T00:00:00Z" }]);
      out["discover"] = await step3(tx, SVC, `private.upsert_discovered_repos($1, 777, $2::text::jsonb)`, [OMAR, repos]);
      out["classify"] = await step3(tx, SVC, `private.classify_repo($1, 8101, 9001, false, null, null)`, [OMAR]);
      const listed = JSON.stringify([0, 1, 2].map((i) => ({ sha: SHA(i), authored_at: `2026-11-0${1 + 2 * i}T10:00:00Z`, committed_at: `2026-11-0${1 + 2 * i}T10:00:00Z`, parents: 1, signed: false })).concat([
        { sha: SHA(9), authored_at: "2026-11-02T10:00:00Z", committed_at: "2026-11-02T10:00:00Z", parents: 2, signed: false },
      ]));
      out["harvest"] = await step3(tx, SVC, `private.harvest_commits($1, 8101, $2::text::jsonb, true)`, [OMAR, listed]);
      for (const i of [0, 1, 2])
        out[`extract_${i}`] = await step3(tx, SVC, `private.record_commit($1, 8101, $2::text::jsonb)`, [
          OMAR,
          JSON.stringify({
            sha: SHA(i),
            authored_at: `2026-11-0${1 + 2 * i}T10:00:00Z`,
            committed_at: `2026-11-0${1 + 2 * i}T10:00:00Z`,
            seen_via: "harvest",
            files: 1,
            meaningful_lines: 60,
            detections: [{ skill: "python", kind: "lines", path: `m${i}.py`, lines: 60 }],
            blobs: [],
          }),
        ]);
      out["extract_again"] = await call(tx, SVC, `private.record_commit($1, 8101, $2::text::jsonb)`, [OMAR, JSON.stringify({ sha: SHA(0), seen_via: "harvest", detections: [] })]);
      out["backdated_push"] = await step3(tx, SVC, `private.record_commit($1, 8101, $2::text::jsonb)`, [
        OMAR,
        JSON.stringify({ sha: SHA(5), authored_at: "2026-01-01T00:00:00Z", pushed_at: "2026-11-10T00:00:00Z", seen_via: "push", files: 1, meaningful_lines: 5, detections: [], blobs: [] }),
      ]);
      out["recompute"] = await step3(tx, SVC, `private.recompute_user_skills($1)`, [OMAR]);
      out["resync"] = await step3(tx, as(OMAR), `public.request_github_resync()`);
      out["resync_not_connected"] = await call(tx, as(ASAD), `public.request_github_resync()`);
      out["disconnect"] = await step3(tx, as(OMAR), `public.disconnect_github()`);
      out["disconnect_again"] = await call(tx, as(OMAR), `public.disconnect_github()`);
      return out;
    }));
});
