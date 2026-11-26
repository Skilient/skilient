/**
 * Content golden recordings (W3). Records what the current stack (local Supabase) returns for every ported
 * content function, so the W3 service can be held to the same results. The sheet is
 * docs/azure/content-function-bins.md.
 *
 *   GOLDEN_STACK_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres GOLDEN_RECORD=1 pnpm exec vitest run test/content.golden.test.ts
 *
 * Without GOLDEN_RECORD it compares the stack with the files. Without GOLDEN_STACK_DB_URL the file is
 * skipped. Every case runs in its own transaction that is rolled back: fixture universities, users, posts and
 * rows exist only inside it. now() is fixed inside a transaction, so ages are set by moving created_at back
 * as the owner, and rate limits that count seconds trip on the second call.
 *
 * Randomness on the current stack is kept out of the recordings: the survey's question is recorded by its
 * dimension (the text is drawn at random within a dimension), and feed cases leave no Seed post outside the
 * viewer's candidates, so no exploration slot is drawn.
 */
import { join } from "node:path";
import type postgres from "postgres";
import { describe, expect, it } from "vitest";
import { actAs, assertLocalStack, attempt, callCurrentStackSql, golden, type SqlOutcome, type StackActor } from "../src/golden";

const DB = process.env["GOLDEN_STACK_DB_URL"];
if (DB !== undefined) assertLocalStack(DB);
const DIR = join(import.meta.dirname, "golden", "content");

// ---------------------------------------------------------------------------
// Fixtures: fixed ids, `.test` domains, distinctive names, no secrets.
// ---------------------------------------------------------------------------
export const UNI_A = "9c000000-0000-4000-8000-00000000000a";
export const UNI_B = "9c000000-0000-4000-8000-00000000000b";
export const ASMA = "9d000000-0000-4000-8000-000000000001"; // A, CS 2027, university visibility
export const BILAL = "9d000000-0000-4000-8000-000000000002"; // A, CS 2027 (same programme as Asma)
export const CYRA = "9d000000-0000-4000-8000-000000000003"; // B, EE 2027
export const DANYAL = "9d000000-0000-4000-8000-000000000004"; // A, SE 2026, friends-only visibility
export const ESHA = "9d000000-0000-4000-8000-000000000005"; // B, EE 2028, global visibility
export const FRESH = "9d000000-0000-4000-8000-000000000006"; // A, not onboarded
export const STAFF = "9d000000-0000-4000-8000-000000000007"; // A, super_admin
export const GRAD = "9d000000-0000-4000-8000-000000000008"; // A, graduate
export const USERS = [ASMA, BILAL, CYRA, DANYAL, ESHA, FRESH, STAFF, GRAD];
export const UNIS = [UNI_A, UNI_B];
export const EMAIL: Record<string, string> = {
  [ASMA]: "asma@content-a.test",
  [BILAL]: "bilal@content-a.test",
  [CYRA]: "cyra@content-b.test",
  [DANYAL]: "danyal@content-a.test",
  [ESHA]: "esha@content-b.test",
  [FRESH]: "fresh@content-a.test",
  [STAFF]: "staff@content-a.test",
  [GRAD]: "grad@content-a.test",
};
export const NAME: Record<string, string> = {
  [ASMA]: "Asma Vorquil",
  [BILAL]: "Bilal Vorquil",
  [CYRA]: "Cyra Thandor",
  [DANYAL]: "Danyal Vorquil",
  [ESHA]: "Esha Thandor",
  [FRESH]: "Fresh Plinder",
  [STAFF]: "Staff Plinder",
  [GRAD]: "Grad Plinder",
};
export const USERNAME: Record<string, string> = {
  [ASMA]: "ct_asma",
  [BILAL]: "ct_bilal",
  [CYRA]: "ct_cyra",
  [DANYAL]: "ct_danyal",
  [ESHA]: "ct_esha",
  [STAFF]: "ct_staff",
  [GRAD]: "ct_grad",
};
/** Image paths the fixture users "uploaded" (storage.objects rows inserted by the seed). */
export const MEDIA = {
  asma1: `${ASMA}/9d100000-0000-4000-8000-000000000001.webp`,
  asma2: `${ASMA}/9d100000-0000-4000-8000-000000000002.webp`,
  bilal1: `${BILAL}/9d100000-0000-4000-8000-000000000003.webp`,
};

const OWNER: StackActor = { role: "postgres" };
const ANON: StackActor = { role: "anon", claims: { role: "anon" } };
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

async function onboard(tx: Tx, id: string, v: { department: string; year: number; visibility?: string }): Promise<void> {
  await tx.unsafe(
    `update public.profiles set username = $2, department = $3, graduation_year = $4, visibility = $5::public.profile_visibility,
            onboarding_complete = true where user_id = $1`,
    [id, USERNAME[id]!, v.department, v.year, v.visibility ?? "university"],
  );
  await tx.unsafe(`update public.onboarding_state set step = 6, completed_at = now() where user_id = $1`, [id]);
}

/** The shared world: two universities, eight users, three uploaded images. No posts: each case writes its own. */
export async function seed(tx: Tx): Promise<void> {
  await tx.unsafe(
    `insert into public.universities (id, name, slug, live_at) values
       ($1, 'Content Golden University A', 'content-golden-a', now() - interval '1 day'),
       ($2, 'Content Golden University B', 'content-golden-b', now() - interval '1 day')`,
    UNIS,
  );
  await tx.unsafe(
    `insert into public.university_domains (university_id, domain, kind, source) values ($1, 'content-a.test', 'both', 'ops'), ($2, 'content-b.test', 'both', 'ops')`,
    UNIS,
  );
  for (const id of USERS) await insertUser(tx, id);
  await onboard(tx, ASMA, { department: "Computer Science", year: 2027 });
  await onboard(tx, BILAL, { department: "Computer Science", year: 2027 });
  await onboard(tx, CYRA, { department: "Electrical Engineering", year: 2027 });
  await onboard(tx, DANYAL, { department: "Software Engineering", year: 2026, visibility: "friends" });
  await onboard(tx, ESHA, { department: "Electrical Engineering", year: 2028, visibility: "global" });
  await onboard(tx, STAFF, { department: "Computer Science", year: 2027 });
  await onboard(tx, GRAD, { department: "Computer Science", year: 2025 });
  await tx.unsafe(`update public.profiles set status = 'graduate', graduated_at = now() where user_id = $1`, [GRAD]);
  await tx.unsafe(`insert into public.staff_roles (user_id, role, granted_by) values ($1, 'super_admin', $1)`, [STAFF]);
  for (const path of Object.values(MEDIA))
    await tx.unsafe(`insert into storage.objects (bucket_id, name, owner_id, metadata) values ('post-media', $1, $2, '{"mimetype":"image/webp"}')`, [
      path,
      path.split("/")[0]!,
    ]);
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
 * Content's tables (and the two foreign ones content's commands reach: notify's notifications, messaging's
 * shared messages), each projected to columns that do not change between runs. Post rows are keyed by body
 * so a case can find them without ids.
 */
export const SNAPSHOTS: Record<string, string> = {
  "public.posts": `select author_id, university_id, audience, type, body, venture_id, stage, pinned_until is not null as pinned,
            edited_at is not null as edited, link_url, society_id, removed_at is not null as removed
       from public.posts where author_id = any($1) order by body`,
  "public.post_media": `select p.body, m.position, m.path, m.width, m.height from public.post_media m join public.posts p on p.id = m.post_id
      where p.author_id = any($1) order by 1, 2`,
  "public.post_events": `select p.body, e.starts_at is not null as has_start, e.place, e.url from public.post_events e join public.posts p on p.id = e.post_id
      where p.author_id = any($1) order by 1`,
  "public.event_rsvps": `select p.body, r.user_id, r.status from public.event_rsvps r join public.posts p on p.id = r.post_id
      where p.author_id = any($1) order by 1, 2`,
  "public.post_polls": `select p.body, round(extract(epoch from (pl.closes_at - p.created_at)) / 86400)::int as days from public.post_polls pl
      join public.posts p on p.id = pl.post_id where p.author_id = any($1) order by 1`,
  "public.poll_options": `select p.body, o.position, o.label from public.poll_options o join public.posts p on p.id = o.post_id
      where p.author_id = any($1) order by 1, 2`,
  "public.poll_votes": `select p.body, v.user_id, v.position from public.poll_votes v join public.posts p on p.id = v.post_id
      where p.author_id = any($1) order by 1, 2`,
  "public.post_comments": `select p.body as post, c.author_id, c.body, c.parent_id is not null as reply, c.pinned, c.deleted_at is not null as deleted
       from public.post_comments c join public.posts p on p.id = c.post_id where p.author_id = any($1) order by 1, 3, 2`,
  "public.post_hides": `select h.user_id, p.body from public.post_hides h join public.posts p on p.id = h.post_id where h.user_id = any($1) order by 1, 2`,
  "public.post_views": `select v.user_id, p.body from public.post_views v join public.posts p on p.id = v.post_id where v.user_id = any($1) order by 1, 2`,
  "public.micro_survey_assignments": `select a.user_id, p.body, a.dimension from public.micro_survey_assignments a join public.posts p on p.id = a.post_id
      where a.user_id = any($1) order by 1, 2`,
  "public.micro_survey_responses": `select r.user_id, p.body, r.dimension, r.answer, r.latency_ms, r.weight from public.micro_survey_responses r
      join public.posts p on p.id = r.post_id where r.user_id = any($1) order by 1, 2`,
  "public.post_survey_counts": `select p.body, c.dimension, c.assigned, c.ticks, c.crosses, c.weighted_ticks, c.weighted_crosses
       from public.post_survey_counts c join public.posts p on p.id = c.post_id where p.author_id = any($1) order by 1, 2`,
  "public.post_stats": `select p.body, s.views, s.hides, s.answers, s.positives, s.commenters, s.commenter_universities, s.appropriate_flags, s.reports
       from public.post_stats s join public.posts p on p.id = s.post_id where p.author_id = any($1) order by 1`,
  "public.feed_sessions": `select user_id, audience, filter, cardinality(post_ids) as posts from public.feed_sessions where user_id = any($1) order by 1, 2, 3`,
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

export async function stepRows(tx: Tx, actor: StackActor, text: string, params: unknown[] = []) {
  const before = await snapshot(tx);
  const result = await rows(tx, actor, text, params);
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

/** A post written as the owner (for types create_post refuses or to set an age); returns its id. */
export async function insertPost(
  tx: Tx,
  author: string,
  body: string,
  v: { type?: string; audience?: string; university?: string | null; hoursAgo?: number; stage?: string } = {},
): Promise<string> {
  const [row] = await tx.unsafe(
    `insert into public.posts (author_id, university_id, audience, type, body, stage, created_at)
     values ($1, $2, $3::public.post_audience, $4::public.post_type, $5, $6::public.post_stage, now() - make_interval(hours => $7))
     returning id::text`,
    [author, v.university === undefined ? UNI_A : v.university, v.audience ?? "university", v.type ?? "general", body, v.stage ?? "seed", v.hoursAgo ?? 0],
  );
  return (row as unknown as { id: string }).id;
}

export const postId = async (tx: Tx, body: string) => ((await tx.unsafe(`select id::text from public.posts where body = $1`, [body]))[0] as unknown as { id: string }).id;
export const befriend = (tx: Tx, a: string, b: string) =>
  tx.unsafe(`insert into public.friendships (user_id_a, user_id_b) values (least($1::uuid, $2::uuid), greatest($1::uuid, $2::uuid))`, [a, b]);
export const block = (tx: Tx, a: string, b: string) => tx.unsafe(`insert into public.blocks (blocker_id, blocked_id) values ($1, $2)`, [a, b]);
const post = (p: Row) => JSON.stringify(p);

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------
describe.skipIf(!DB)("content goldens on the current stack", () => {
  describe("posts", () => {
    const G = "posts";

    it("create_post: audiences, images, types, limits and refusals", () =>
      check(G, "create", async (tx) => {
        const out: Row = {};
        out["general_university_with_images"] = await step(tx, as(ASMA), "public.create_post($1::text::jsonb)", [
          post({
            type: "general",
            audience: "university",
            body: "  Hello from A, with pictures  ",
            media: [
              { path: MEDIA.asma1, width: 800, height: 600 },
              { path: MEDIA.asma2, width: 640, height: 480 },
            ],
          }),
        ]);
        out["second_within_30s"] = await call(tx, as(ASMA), "public.create_post($1::text::jsonb)", [post({ type: "general", body: "Too soon" })]);
        out["global_general"] = await step(tx, as(CYRA), "public.create_post($1::text::jsonb)", [post({ type: "general", audience: "global", body: "Hello world from B" })]);
        out["someone_elses_image"] = await call(tx, as(BILAL), "public.create_post($1::text::jsonb)", [
          post({ type: "general", body: "Stolen picture", media: [{ path: MEDIA.asma1, width: 10, height: 10 }] }),
        ]);
        out["five_images"] = await call(tx, as(BILAL), "public.create_post($1::text::jsonb)", [
          post({ type: "general", body: "Too many", media: Array.from({ length: 5 }, () => ({ path: MEDIA.bilal1, width: 10, height: 10 })) }),
        ]);
        out["images_on_poll"] = await call(tx, as(BILAL), "public.create_post($1::text::jsonb)", [
          post({ type: "poll", body: "Poll with a picture", media: [{ path: MEDIA.bilal1, width: 10, height: 10 }], poll: { options: ["a", "b"], days: 1 } }),
        ]);
        out["empty_body"] = await call(tx, as(BILAL), "public.create_post($1::text::jsonb)", [post({ type: "general", body: "   " })]);
        out["long_body"] = await call(tx, as(BILAL), "public.create_post($1::text::jsonb)", [post({ type: "general", body: "x".repeat(2001) })]);
        out["unknown_type"] = await call(tx, as(BILAL), "public.create_post($1::text::jsonb)", [post({ type: "story", body: "A story" })]);
        out["shipped_refused"] = await call(tx, as(BILAL), "public.create_post($1::text::jsonb)", [post({ type: "shipped", body: "We shipped" })]);
        out["event_without_society"] = await call(tx, as(BILAL), "public.create_post($1::text::jsonb)", [
          post({ type: "event", body: "Come along", event: { starts_at: "2099-01-01T10:00:00Z", place: "Hall" } }),
        ]);
        out["announcement_not_staff"] = await call(tx, as(BILAL), "public.create_post($1::text::jsonb)", [post({ type: "announcement", body: "Hear ye" })]);
        out["poll_one_option"] = await call(tx, as(BILAL), "public.create_post($1::text::jsonb)", [post({ type: "poll", body: "Pick", poll: { options: ["only"], days: 2 } })]);
        out["poll_eight_days"] = await call(tx, as(BILAL), "public.create_post($1::text::jsonb)", [post({ type: "poll", body: "Pick", poll: { options: ["a", "b"], days: 8 } })]);
        out["poll"] = await step(tx, as(BILAL), "public.create_post($1::text::jsonb)", [
          post({ type: "poll", audience: "global", body: "Tabs or spaces?", poll: { options: [" Tabs ", "Spaces", "Both"], days: 3 } }),
        ]);
        out["staff_announcement_pinned"] = await step(tx, as(STAFF, "aal2"), "public.create_post($1::text::jsonb)", [
          post({ type: "announcement", audience: "university", body: "Platform news", pin_days: 30 }),
        ]);
        out["graduate_university_post"] = await call(tx, as(GRAD), "public.create_post($1::text::jsonb)", [post({ type: "general", audience: "university", body: "Still here" })]);
        out["graduate_global_post"] = await step(tx, as(GRAD), "public.create_post($1::text::jsonb)", [post({ type: "general", audience: "global", body: "Alumni hello" })]);
        out["not_onboarded"] = await call(tx, as(FRESH), "public.create_post($1::text::jsonb)", [post({ type: "general", body: "Hi" })]);
        out["signed_out"] = await call(tx, ANON, "public.create_post($1::text::jsonb)", [post({ type: "general", body: "Hi" })]);
        out["link_url"] = await step(tx, as(DANYAL), "public.create_post($1::text::jsonb)", [
          post({ type: "general", body: "Read https://example.test/a/b?c=1). Then reply." }),
        ]);
        return out;
      }));
  });
});

// ===========================================================================
// More cases (W3): edit, delete, polls, RSVPs, cards, lists, pins, comments, survey, feed, links, share.
// ===========================================================================
const UUID_X = "9e000000-0000-4000-8000-0000000000a1";
const UUID_Y = "9e000000-0000-4000-8000-0000000000a2";

export async function bodyMap(tx: Tx): Promise<Map<string, string>> {
  const r = await tx.unsafe(`select id::text, body from public.posts where author_id = any($1)`, [USERS] as never[]);
  return new Map((r as unknown as { id: string; body: string }[]).map((x) => [x.id, x.body]));
}

/** Replaces post ids by their bodies in the named keys; rows of posts outside the fixture are dropped. */
export function named(out: SqlOutcome<unknown>, m: Map<string, string>, keys: string[]): SqlOutcome<unknown> {
  if (!out.ok) return out;
  const list = (out.value as Row[]).filter((r) => keys.every((k) => r[k] == null || m.has(String(r[k]))));
  return {
    ok: true,
    value: list.map((r) => ({ ...r, ...Object.fromEntries(keys.map((k) => [k, r[k] == null ? null : m.get(String(r[k]))])) })),
  };
}

export async function addPoll(
  tx: Tx,
  author: string,
  body: string,
  v: { options?: string[]; closesInHours?: number; hoursAgo?: number; audience?: string; university?: string | null; stage?: string } = {},
): Promise<string> {
  const id = await insertPost(tx, author, body, { type: "poll", ...v });
  await tx.unsafe(`insert into public.post_polls (post_id, closes_at) values ($1, now() + make_interval(hours => $2))`, [id, v.closesInHours ?? 48]);
  let i = 0;
  for (const label of v.options ?? ["Red", "Green", "Blue"]) await tx.unsafe(`insert into public.poll_options (post_id, position, label) values ($1, $2, $3)`, [id, ++i, label]);
  return id;
}

export async function addEvent(
  tx: Tx,
  author: string,
  body: string,
  v: { startsInHours?: number; hoursAgo?: number; audience?: string; university?: string | null; stage?: string } = {},
): Promise<string> {
  const id = await insertPost(tx, author, body, { type: "event", ...v });
  await tx.unsafe(`insert into public.post_events (post_id, starts_at, place, url) values ($1, now() + make_interval(hours => $2), 'Main hall', null)`, [
    id,
    v.startsInHours ?? 48,
  ]);
  return id;
}

export async function addMedia(tx: Tx, post: string, paths: string[]): Promise<void> {
  let i = 0;
  for (const p of paths) await tx.unsafe(`insert into public.post_media (post_id, position, path, width, height) values ($1, $2, $3, 800, 600)`, [post, ++i, p]);
}

export async function insertComment(
  tx: Tx,
  post: string,
  author: string,
  body: string,
  v: { parent?: string | null; minutesAgo?: number; pinned?: boolean } = {},
): Promise<string> {
  const [row] = await tx.unsafe(
    `insert into public.post_comments (post_id, parent_id, author_id, body, pinned, created_at)
     values ($1, $2, $3, $4, $5, now() - make_interval(mins => $6)) returning id::text`,
    [post, v.parent ?? null, author, body, v.pinned ?? false, v.minutesAgo ?? 0],
  );
  return (row as unknown as { id: string }).id;
}

export const view = (tx: Tx, post: string, user: string) => tx.unsafe(`insert into public.post_views (post_id, user_id) values ($1, $2)`, [post, user]);

/** Fixes the dimension the first assignment on a post gets (informative and interesting otherwise tie at random). */
export const prime = (tx: Tx, post: string) =>
  tx.unsafe(`insert into public.post_survey_counts (post_id, dimension, assigned) values ($1, 'informative', 1) on conflict (post_id, dimension) do nothing`, [post]);

export async function assign(tx: Tx, post: string, user: string, dimension: string): Promise<void> {
  await tx.unsafe(
    `insert into public.micro_survey_assignments (post_id, user_id, question_id, dimension)
     values ($1, $2, (select min(id) from public.micro_survey_questions where dimension = $3), $3)`,
    [post, user, dimension],
  );
}

describe.skipIf(!DB)("content goldens on the current stack (posts, more)", () => {
  const G = "posts";

  it("edit_post: window, owner, empty body", () =>
    check(G, "edit", async (tx) => {
      const out: Row = {};
      const fresh = await insertPost(tx, ASMA, "Edit me now");
      const old = await insertPost(tx, ASMA, "Too old to edit", { hoursAgo: 1 });
      const edge = await insertPost(tx, ASMA, "Edit me twice");
      out["own_fresh"] = await step(tx, as(ASMA), "public.edit_post($1::uuid, $2)", [fresh, "  Edited text, trimmed  "]);
      out["own_again"] = await step(tx, as(ASMA), "public.edit_post($1::uuid, $2)", [fresh, "Edited a second time"]);
      out["empty_body"] = await call(tx, as(ASMA), "public.edit_post($1::uuid, $2)", [edge, "   "]);
      out["null_body"] = await call(tx, as(ASMA), "public.edit_post($1::uuid, $2)", [edge, null]);
      out["too_long"] = await call(tx, as(ASMA), "public.edit_post($1::uuid, $2)", [edge, "y".repeat(2001)]);
      out["after_window"] = await call(tx, as(ASMA), "public.edit_post($1::uuid, $2)", [old, "Late edit"]);
      out["someone_elses"] = await call(tx, as(BILAL), "public.edit_post($1::uuid, $2)", [edge, "Hijack"]);
      out["unknown_post"] = await call(tx, as(ASMA), "public.edit_post($1::uuid, $2)", [UUID_X, "Nothing"]);
      out["signed_out"] = await call(tx, ANON, "public.edit_post($1::uuid, $2)", [edge, "Anon"]);
      return out;
    }));

  it("delete_post: paths come back, owner only, once", () =>
    check(G, "delete", async (tx) => {
      const out: Row = {};
      const withMedia = await insertPost(tx, ASMA, "Delete me with pictures");
      await addMedia(tx, withMedia, [MEDIA.asma1, MEDIA.asma2]);
      const plain = await insertPost(tx, ASMA, "Delete me plain");
      const theirs = await insertPost(tx, BILAL, "Not yours to delete");
      out["own_with_media"] = await step(tx, as(ASMA), "public.delete_post($1::uuid)", [withMedia]);
      out["own_plain"] = await step(tx, as(ASMA), "public.delete_post($1::uuid)", [plain]);
      out["twice"] = await call(tx, as(ASMA), "public.delete_post($1::uuid)", [withMedia]);
      out["someone_elses"] = await call(tx, as(ASMA), "public.delete_post($1::uuid)", [theirs]);
      out["signed_out"] = await call(tx, ANON, "public.delete_post($1::uuid)", [theirs]);
      return out;
    }));

  it("vote_poll: once, options, closing, visibility", () =>
    check(G, "vote_poll", async (tx) => {
      const out: Row = {};
      const open = await addPoll(tx, BILAL, "Colour poll", { options: ["Red", "Green", "Blue"], hoursAgo: 4 });
      const closed = await addPoll(tx, BILAL, "Closed poll", { hoursAgo: 4 });
      await tx.unsafe(`update public.post_polls set closes_at = now() - interval '1 hour' where post_id = $1`, [closed]);
      const otherUni = await addPoll(tx, CYRA, "Poll at B", { university: UNI_B, hoursAgo: 4 });
      const global = await addPoll(tx, CYRA, "Global poll", { audience: "global", university: UNI_B, hoursAgo: 4 });
      const general = await insertPost(tx, BILAL, "Not a poll", { hoursAgo: 4 });
      const vote = "public.vote_poll($1::uuid, $2::smallint)";
      out["vote"] = await step(tx, as(ASMA), vote, [open, 2]);
      out["vote_twice"] = await call(tx, as(ASMA), vote, [open, 3]);
      out["bad_option"] = await call(tx, as(DANYAL), vote, [open, 9]);
      out["option_zero"] = await call(tx, as(DANYAL), vote, [open, 0]);
      out["author_votes_own"] = await step(tx, as(BILAL), vote, [open, 1]);
      out["closed"] = await call(tx, as(DANYAL), vote, [closed, 1]);
      out["other_university"] = await call(tx, as(ASMA), vote, [otherUni, 1]);
      out["global_from_other_university"] = await step(tx, as(ASMA), vote, [global, 1]);
      out["not_a_poll"] = await call(tx, as(DANYAL), vote, [general, 1]);
      out["unknown_post"] = await call(tx, as(DANYAL), vote, [UUID_X, 1]);
      out["signed_out"] = await call(tx, ANON, vote, [open, 1]);
      return out;
    }));

  it("rsvp_event: going, interested, clear, past, not an event", () =>
    check(G, "rsvp", async (tx) => {
      const out: Row = {};
      const ev = await addEvent(tx, BILAL, "Open day", { startsInHours: 48, hoursAgo: 4 });
      const past = await addEvent(tx, BILAL, "Last week meetup", { startsInHours: -7, hoursAgo: 8 });
      const recent = await addEvent(tx, BILAL, "Just ended meetup", { startsInHours: -3, hoursAgo: 8 });
      const otherUni = await addEvent(tx, CYRA, "Event at B", { university: UNI_B, hoursAgo: 4 });
      const global = await addEvent(tx, CYRA, "Global meetup", { audience: "global", university: UNI_B, hoursAgo: 4 });
      const general = await insertPost(tx, BILAL, "Just a post", { hoursAgo: 4 });
      const rsvp = "public.rsvp_event($1::uuid, $2::public.rsvp_status)";
      out["going"] = await step(tx, as(ASMA), rsvp, [ev, "going"]);
      out["interested_changes"] = await step(tx, as(ASMA), rsvp, [ev, "interested"]);
      out["second_user"] = await step(tx, as(DANYAL), rsvp, [ev, "going"]);
      out["clear"] = await step(tx, as(ASMA), rsvp, [ev, null]);
      out["clear_when_none"] = await step(tx, as(ASMA), rsvp, [ev, null]);
      out["past_event"] = await call(tx, as(ASMA), rsvp, [past, "going"]);
      out["ended_three_hours_ago"] = await step(tx, as(ASMA), rsvp, [recent, "going"]);
      out["not_an_event"] = await call(tx, as(ASMA), rsvp, [general, "going"]);
      out["other_university"] = await call(tx, as(ASMA), rsvp, [otherUni, "going"]);
      out["global_from_other_university"] = await step(tx, as(ASMA), rsvp, [global, "interested"]);
      out["bad_status"] = await call(tx, as(ASMA), rsvp, [ev, "maybe"]);
      out["signed_out"] = await call(tx, ANON, rsvp, [ev, "going"]);
      return out;
    }));

  it("post_cards: every card shape for several readers", () =>
    check(G, "cards", async (tx) => {
      const out: Row = {};
      const withImages = await insertPost(tx, ASMA, "Card: with pictures", { hoursAgo: 6 });
      await addMedia(tx, withImages, [MEDIA.asma1, MEDIA.asma2]);
      const globalPost = await insertPost(tx, CYRA, "Card: global from B", { audience: "global", university: UNI_B, hoursAgo: 7 });
      const poll = await addPoll(tx, BILAL, "Card: open poll", { options: ["Cats", "Dogs"], hoursAgo: 8 });
      await tx.unsafe(`insert into public.poll_votes (post_id, user_id, position) values ($1, $2, 1), ($1, $3, 2), ($1, $4, 2)`, [poll, ASMA, DANYAL, STAFF]);
      const closedPoll = await addPoll(tx, BILAL, "Card: closed poll", { options: ["Yes", "No"], hoursAgo: 9 });
      await tx.unsafe(`insert into public.poll_votes (post_id, user_id, position) values ($1, $2, 1)`, [closedPoll, DANYAL]);
      await tx.unsafe(`update public.post_polls set closes_at = now() - interval '1 hour' where post_id = $1`, [closedPoll]);
      const unvotedPoll = await addPoll(tx, BILAL, "Card: poll nobody voted on", { options: ["A", "B"], hoursAgo: 10 });
      const event = await addEvent(tx, BILAL, "Card: event", { startsInHours: 72, hoursAgo: 11 });
      await tx.unsafe(`insert into public.event_rsvps (post_id, user_id, status) values ($1, $2, 'going'), ($1, $3, 'interested'), ($1, $4, 'going')`, [event, ASMA, DANYAL, STAFF]);
      const byBlocked = await insertPost(tx, DANYAL, "Card: by someone Asma blocked", { hoursAgo: 12 });
      await block(tx, ASMA, DANYAL);
      const byMuted = await insertPost(tx, STAFF, "Card: by someone Asma muted", { hoursAgo: 13 });
      await tx.unsafe(`insert into public.user_mutes (user_id, muted_id) values ($1, $2)`, [ASMA, STAFF]);
      const removed = await insertPost(tx, BILAL, "Card: removed", { hoursAgo: 14 });
      await tx.unsafe(`update public.posts set removed_at = now() where id = $1`, [removed]);
      const held = await insertPost(tx, BILAL, "Card: held", { hoursAgo: 15, stage: "held" });
      const url = "https://example.test/article/cards";
      const withLink = await insertPost(tx, BILAL, `Card: has a link ${url}`, { hoursAgo: 16 });
      await tx.unsafe(
        `insert into public.link_previews (url_hash, url, status, title, description, image_url, site_name)
         values (private.url_hash($1), $1, 'ok', 'An article', 'About something', 'https://example.test/i.png', 'Example')`,
        [url],
      );
      const withComments = await insertPost(tx, BILAL, "Card: with comments", { hoursAgo: 17 });
      await insertComment(tx, withComments, STAFF, "A first comment here", { minutesAgo: 30 });
      await insertComment(tx, withComments, DANYAL, "A comment from the blocked one", { minutesAgo: 20 });
      const gone = await insertComment(tx, withComments, STAFF, "Deleted comment text", { minutesAgo: 10 });
      await tx.unsafe(`update public.post_comments set deleted_at = now(), body = '' where id = $1`, [gone]);
      const mine = await insertPost(tx, ASMA, "Card: asma just posted");
      const order = [withImages, globalPost, poll, closedPoll, unvotedPoll, event, byBlocked, byMuted, removed, held, withLink, withComments, mine, UUID_X];
      const query = `select c.type::text, c.audience::text, c.body, c.edited_at is not null as edited, c.pinned_until is not null as pinned, c.stage::text,
                            c.author_username, c.author_name, c.is_mine, c.can_edit, c.media, c.event, c.poll, c.venture, c.comment_count, c.link,
                            c.author_muted, c.society
                       from public.post_cards($1::uuid[]) c`;
      for (const [label, user] of [["asma", ASMA], ["danyal", DANYAL], ["cyra", CYRA], ["staff", STAFF], ["bilal", BILAL]] as const)
        out[`as_${label}`] = await rows(tx, as(user), query, [order]);
      out["signed_out"] = await rows(tx, ANON, query, [order]);
      out["empty_list"] = await rows(tx, as(ASMA), query, [[]]);
      return out;
    }));

  it("list_posts: scopes, filters, cursor and limits", () =>
    check(G, "list_posts", async (tx) => {
      const out: Row = {};
      await insertPost(tx, BILAL, "List: uni general 1", { hoursAgo: 2 });
      await insertPost(tx, DANYAL, "List: uni general 2", { hoursAgo: 3 });
      await addEvent(tx, BILAL, "List: uni event", { hoursAgo: 4 });
      const announcement = await insertPost(tx, BILAL, "List: uni announcement", { type: "announcement", hoursAgo: 5 });
      await tx.unsafe(`insert into public.announcement_meta (post_id, university_id, expires_at) values ($1, $2, now() + interval '5 days')`, [announcement, UNI_A]);
      await insertPost(tx, ASMA, "List: asma own", { hoursAgo: 6 });
      await insertPost(tx, STAFF, "List: by muted author", { hoursAgo: 7 });
      await tx.unsafe(`insert into public.user_mutes (user_id, muted_id) values ($1, $2)`, [ASMA, STAFF]);
      const hidden = await insertPost(tx, BILAL, "List: hidden by asma", { hoursAgo: 8 });
      await tx.unsafe(`insert into public.post_hides (user_id, post_id) values ($1, $2)`, [ASMA, hidden]);
      await insertPost(tx, BILAL, "List: global from A", { audience: "global", hoursAgo: 9 });
      await insertPost(tx, CYRA, "List: global from B", { audience: "global", university: UNI_B, hoursAgo: 10 });
      await insertPost(tx, CYRA, "List: uni B only", { university: UNI_B, hoursAgo: 11 });
      await insertPost(tx, DANYAL, "List: by blocked", { hoursAgo: 12 });
      await block(tx, ASMA, DANYAL);
      await insertPost(tx, BILAL, "List: held", { hoursAgo: 13, stage: "held" });
      const removed = await insertPost(tx, BILAL, "List: removed", { hoursAgo: 14 });
      await tx.unsafe(`update public.posts set removed_at = now() where id = $1`, [removed]);
      await insertPost(tx, BILAL, "List: oldest", { hoursAgo: 20 });
      const m = await bodyMap(tx);
      const fn = "select l.id::text as id, l.created_at::text as created_at from public.list_posts($1, $2, $3::timestamptz, $4::uuid, $5::uuid, $6::integer) l";
      const list = async (actor: StackActor, args: unknown[]) => named(await rows(tx, actor, fn, args), m, ["id"]);
      out["university_all"] = await list(as(ASMA), ["university", "all", null, null, null, 50]);
      out["university_default_filter"] = await list(as(ASMA), ["university", null, null, null, null, 50]);
      out["global"] = await list(as(ASMA), ["global", "all", null, null, null, 50]);
      out["global_as_cyra"] = await list(as(CYRA), ["global", "all", null, null, null, 50]);
      out["university_as_cyra"] = await list(as(CYRA), ["university", "all", null, null, null, 50]);
      out["author_bilal"] = await list(as(ASMA), ["author", "all", null, null, BILAL, 50]);
      out["author_asma_own"] = await list(as(ASMA), ["author", "all", null, null, ASMA, 50]);
      out["author_staff_muted_still_listed"] = await list(as(ASMA), ["author", "all", null, null, STAFF, 50]);
      out["author_blocked"] = await list(as(ASMA), ["author", "all", null, null, DANYAL, 50]);
      out["filter_events"] = await list(as(ASMA), ["university", "events", null, null, null, 50]);
      out["filter_announcements"] = await list(as(ASMA), ["university", "announcements", null, null, null, 50]);
      out["filter_ventures"] = await list(as(ASMA), ["university", "ventures", null, null, null, 50]);
      out["filter_shipped"] = await list(as(ASMA), ["university", "shipped", null, null, null, 50]);
      out["unknown_filter_means_all"] = await list(as(ASMA), ["university", "nonsense", null, null, null, 3]);
      out["unknown_scope"] = await list(as(ASMA), ["everywhere", "all", null, null, null, 50]);
      const page1 = (await rows(tx, as(ASMA), fn, ["university", "all", null, null, null, 3])) as { ok: true; value: Row[] };
      out["page_1_of_3"] = named(page1, m, ["id"]);
      const last = page1.value[page1.value.length - 1]!;
      out["page_2_before_cursor"] = await list(as(ASMA), ["university", "all", last["created_at"], last["id"], null, 3]);
      out["before_without_id"] = await list(as(ASMA), ["university", "all", last["created_at"], null, null, 3]);
      out["limit_zero_is_one"] = await list(as(ASMA), ["university", "all", null, null, null, 0]);
      out["limit_over_cap"] = await list(as(ASMA), ["university", "all", null, null, null, 500]);
      out["signed_out"] = await rows(tx, ANON, fn, ["university", "all", null, null, null, 5]);
      return out;
    }));

  it("pinned announcements: platform and university", () =>
    check(G, "pinned", async (tx) => {
      const out: Row = {};
      const platform = await insertPost(tx, STAFF, "Pinned: platform news", { type: "announcement", audience: "global", hoursAgo: 5 });
      await tx.unsafe(`update public.posts set pinned_until = now() + interval '3 days' where id = $1`, [platform]);
      const uni = await insertPost(tx, STAFF, "Pinned: university notice", { type: "announcement", hoursAgo: 4 });
      await tx.unsafe(`insert into public.announcement_meta (post_id, university_id, expires_at, created_by) values ($1, $2, now() + interval '5 days', $3)`, [uni, UNI_A, STAFF]);
      await tx.unsafe(`update public.posts set pinned_until = now() + interval '3 days' where id = $1`, [uni]);
      const expired = await insertPost(tx, STAFF, "Pinned: expired pin", { type: "announcement", audience: "global", hoursAgo: 3 });
      await tx.unsafe(`update public.posts set pinned_until = now() - interval '1 day' where id = $1`, [expired]);
      const m = await bodyMap(tx);
      const one = async (actor: StackActor, fn: string) => named(await rows(tx, actor, `select ${fn}::text as id`), m, ["id"]);
      out["platform_asma"] = await one(as(ASMA), "public.pinned_announcement()");
      out["platform_cyra"] = await one(as(CYRA), "public.pinned_announcement()");
      out["university_asma"] = await one(as(ASMA), "public.pinned_university_announcement()");
      out["university_bilal"] = await one(as(BILAL), "public.pinned_university_announcement()");
      out["university_cyra_other_university"] = await one(as(CYRA), "public.pinned_university_announcement()");
      out["signed_out"] = await rows(tx, ANON, "select public.pinned_announcement()::text as id");
      out["hide_platform"] = await step(tx, as(ASMA), "public.hide_post($1::uuid, true)", [platform]);
      out["platform_after_hide"] = await one(as(ASMA), "public.pinned_announcement()");
      out["hide_university"] = await step(tx, as(ASMA), "public.hide_post($1::uuid, true)", [uni]);
      out["university_after_hide"] = await one(as(ASMA), "public.pinned_university_announcement()");
      out["university_bilal_unaffected"] = await one(as(BILAL), "public.pinned_university_announcement()");
      return out;
    }));
});

describe.skipIf(!DB)("content goldens on the current stack (comments)", () => {
  const G = "comments";

  it("add_comment: replies, blocks, limits, mentions", () =>
    check(G, "add", async (tx) => {
      const out: Row = {};
      const post = await insertPost(tx, BILAL, "Comment on me", { hoursAgo: 4 });
      const global = await insertPost(tx, BILAL, "Comment on me, global", { audience: "global", hoursAgo: 4 });
      await insertPost(tx, CYRA, "Comment on me at B", { university: UNI_B, hoursAgo: 4 });
      const add = "public.add_comment($1::uuid, $2::uuid, $3)";
      const first = await step(tx, as(ASMA), add, [post, null, "  A first comment  "]);
      out["comment"] = first;
      const firstId = (first.result as { ok: true; value: string }).value;
      out["second_within_10s"] = await call(tx, as(ASMA), add, [post, null, "Too soon after the last"]);
      const reply = await step(tx, as(DANYAL), add, [post, firstId, "A reply to the first"]);
      out["reply"] = reply;
      const replyId = (reply.result as { ok: true; value: string }).value;
      out["reply_to_a_reply"] = await call(tx, as(STAFF), add, [post, replyId, "A reply to a reply"]);
      out["reply_to_unknown_parent"] = await call(tx, as(STAFF), add, [post, UUID_X, "Nobody here"]);
      out["reply_parent_on_other_post"] = await call(tx, as(STAFF), add, [global, firstId, "Wrong post"]);
      out["empty"] = await call(tx, as(STAFF), add, [post, null, "    "]);
      out["null_body"] = await call(tx, as(STAFF), add, [post, null, null]);
      out["too_long"] = await call(tx, as(STAFF), add, [post, null, "z".repeat(1001)]);
      out["exactly_1000"] = await step(tx, as(STAFF), add, [post, null, "z".repeat(1000)]);
      out["other_university"] = await call(tx, as(CYRA), add, [post, null, "I should not see this"]);
      out["global_from_other_university"] = await step(tx, as(CYRA), add, [global, null, "Hello from B"]);
      out["unknown_post"] = await call(tx, as(GRAD), add, [UUID_X, null, "Nothing here"]);
      out["mentions"] = await step(tx, as(GRAD), add, [post, null, "Thanks @ct_danyal and @CT_ASMA, also @ct_cyra and @ct_bilal and @nobody_here"]);
      out["mention_on_global_reaches_other_university"] = await step(tx, as(ESHA), add, [global, null, "Welcome @ct_cyra and @ct_asma"]);
      await block(tx, ASMA, BILAL);
      out["commenter_blocked_the_post_author"] = await call(tx, as(ASMA), add, [post, null, "Blocked now"]);
      out["signed_out"] = await call(tx, ANON, add, [post, null, "Anon"]);
      return out;
    }));

  it("add_comment: blocked parent author and deleted parent", () =>
    check(G, "add_reply_rules", async (tx) => {
      const out: Row = {};
      const post = await insertPost(tx, BILAL, "Reply rules", { hoursAgo: 4 });
      const c1 = await insertComment(tx, post, DANYAL, "Top level by Danyal", { minutesAgo: 30 });
      const gone = await insertComment(tx, post, STAFF, "Will be deleted", { minutesAgo: 20 });
      await tx.unsafe(`update public.post_comments set deleted_at = now(), body = '' where id = $1`, [gone]);
      const add = "public.add_comment($1::uuid, $2::uuid, $3)";
      out["reply_to_deleted"] = await call(tx, as(ASMA), add, [post, gone, "Reply to nothing"]);
      await block(tx, ASMA, DANYAL);
      out["reply_to_blocked_author"] = await call(tx, as(ASMA), add, [post, c1, "Reply to someone I blocked"]);
      out["blocked_user_replies_to_own_comment"] = await call(tx, as(DANYAL), add, [post, c1, "Reply to myself"]);
      out["second_reply_rate_limited"] = await step(tx, as(DANYAL), add, [post, c1, "Reply to myself, again"]);
      return out;
    }));

  it("delete_comment: author, post author, stranger", () =>
    check(G, "delete", async (tx) => {
      const out: Row = {};
      const post = await insertPost(tx, BILAL, "Delete comments here", { hoursAgo: 4 });
      const c1 = await insertComment(tx, post, ASMA, "Asma comment to delete", { minutesAgo: 40 });
      const c2 = await insertComment(tx, post, DANYAL, "Danyal comment to delete", { minutesAgo: 30 });
      const c3 = await insertComment(tx, post, STAFF, "Staff comment to keep", { minutesAgo: 20 });
      const pinned = await insertComment(tx, post, ASMA, "Pinned comment to delete", { minutesAgo: 10, pinned: true });
      const del = "public.delete_comment($1::uuid)";
      out["by_author"] = await step(tx, as(ASMA), del, [c1]);
      out["by_post_author"] = await step(tx, as(BILAL), del, [c2]);
      out["by_stranger"] = await call(tx, as(DANYAL), del, [c3]);
      out["twice"] = await call(tx, as(ASMA), del, [c1]);
      out["unknown"] = await call(tx, as(ASMA), del, [UUID_X]);
      out["pinned_loses_pin"] = await step(tx, as(ASMA), del, [pinned]);
      out["signed_out"] = await call(tx, ANON, del, [c3]);
      return out;
    }));

  it("pin_comment: one pin, top level only, post author only", () =>
    check(G, "pin", async (tx) => {
      const out: Row = {};
      const post = await insertPost(tx, BILAL, "Pin comments here", { hoursAgo: 4 });
      const c1 = await insertComment(tx, post, ASMA, "First top level comment", { minutesAgo: 40 });
      const c2 = await insertComment(tx, post, DANYAL, "Second top level comment", { minutesAgo: 30 });
      const r1 = await insertComment(tx, post, STAFF, "A reply to the first", { minutesAgo: 20, parent: c1 });
      const gone = await insertComment(tx, post, STAFF, "Deleted one", { minutesAgo: 10 });
      await tx.unsafe(`update public.post_comments set deleted_at = now(), body = '' where id = $1`, [gone]);
      const pin = "public.pin_comment($1::uuid, $2::boolean)";
      out["pin"] = await step(tx, as(BILAL), pin, [c1, true]);
      out["pin_another_unpins_first"] = await step(tx, as(BILAL), pin, [c2, true]);
      out["pin_a_reply"] = await call(tx, as(BILAL), pin, [r1, true]);
      out["pin_by_commenter"] = await call(tx, as(ASMA), pin, [c1, true]);
      out["pin_deleted"] = await call(tx, as(BILAL), pin, [gone, true]);
      out["pin_unknown"] = await call(tx, as(BILAL), pin, [UUID_X, true]);
      out["unpin"] = await step(tx, as(BILAL), pin, [c2, false]);
      out["unpin_when_not_pinned"] = await step(tx, as(BILAL), pin, [c2, false]);
      out["signed_out"] = await call(tx, ANON, pin, [c1, true]);
      return out;
    }));

  it("hide_post: hide, unhide, invisible", () =>
    check(G, "hide", async (tx) => {
      const out: Row = {};
      const post = await insertPost(tx, BILAL, "Hide this one", { hoursAgo: 4 });
      const other = await insertPost(tx, CYRA, "Hide at B", { university: UNI_B, hoursAgo: 4 });
      const held = await insertPost(tx, BILAL, "Hide held", { hoursAgo: 4, stage: "held" });
      const hide = "public.hide_post($1::uuid, $2::boolean)";
      out["hide"] = await step(tx, as(ASMA), hide, [post, true]);
      out["hide_twice"] = await step(tx, as(ASMA), hide, [post, true]);
      out["second_reader"] = await step(tx, as(DANYAL), hide, [post, true]);
      out["unhide"] = await step(tx, as(ASMA), hide, [post, false]);
      out["unhide_when_not_hidden"] = await step(tx, as(ASMA), hide, [post, false]);
      out["author_hides_own"] = await step(tx, as(BILAL), hide, [post, true]);
      out["invisible_other_university"] = await call(tx, as(ASMA), hide, [other, true]);
      out["held_post_of_someone_else"] = await call(tx, as(ASMA), hide, [held, true]);
      out["unknown_post"] = await call(tx, as(ASMA), hide, [UUID_X, true]);
      out["signed_out"] = await call(tx, ANON, hide, [post, true]);
      return out;
    }));

  it("post_comment_list: threads, pins, deletions, blocks", () =>
    check(G, "list", async (tx) => {
      const out: Row = {};
      const post = await insertPost(tx, BILAL, "List my comments", { hoursAgo: 6 });
      const other = await insertPost(tx, CYRA, "List at B", { university: UNI_B, hoursAgo: 6 });
      const c1 = await insertComment(tx, post, ASMA, "First comment by Asma", { minutesAgo: 100 });
      const c2 = await insertComment(tx, post, DANYAL, "Second comment by Danyal", { minutesAgo: 90 });
      const c3 = await insertComment(tx, post, STAFF, "Third comment by Staff, pinned", { minutesAgo: 80, pinned: true });
      await insertComment(tx, post, DANYAL, "Reply by Danyal to Asma", { minutesAgo: 70, parent: c1 });
      await insertComment(tx, post, ASMA, "Reply by Asma to Staff", { minutesAgo: 60, parent: c3 });
      const gone = await insertComment(tx, post, STAFF, "Deleted by its author", { minutesAgo: 50 });
      await tx.unsafe(`update public.post_comments set deleted_at = now(), body = '' where id = $1`, [gone]);
      const hiddenByUni = await insertComment(tx, post, GRAD, "Hidden by the university", { minutesAgo: 40 });
      await tx.unsafe(`update public.post_comments set hidden_by_university_at = now() where id = $1`, [hiddenByUni]);
      await insertComment(tx, post, ESHA, "Comment by Esha from B", { minutesAgo: 30 });
      void c2;
      await insertComment(tx, other, CYRA, "Comment on a post at B", { minutesAgo: 20 });
      const query = `select l.body, l.pinned, l.deleted, l.parent_id is not null as reply, l.author_username, l.author_name, l.author_avatar_path,
                            l.is_mine, l.can_delete, l.created_at::text as created_at
                       from public.post_comment_list($1::uuid) l`;
      out["as_post_author"] = await rows(tx, as(BILAL), query, [post]);
      out["as_commenter"] = await rows(tx, as(ASMA), query, [post]);
      out["as_hidden_comment_author"] = await rows(tx, as(GRAD), query, [post]);
      out["as_staff"] = await rows(tx, as(STAFF), query, [post]);
      await block(tx, ASMA, DANYAL);
      out["blocker_does_not_see_blocked"] = await rows(tx, as(ASMA), query, [post]);
      out["blocked_does_not_see_blocker"] = await rows(tx, as(DANYAL), query, [post]);
      out["other_university_post"] = await rows(tx, as(ASMA), query, [other]);
      out["from_other_university_global"] = await rows(tx, as(CYRA), query, [post]);
      out["unknown_post"] = await rows(tx, as(ASMA), query, [UUID_X]);
      out["signed_out"] = await rows(tx, ANON, query, [post]);
      return out;
    }));
});

describe.skipIf(!DB)("content goldens on the current stack (survey)", () => {
  const G = "survey";
  const strip = "select s.post_id::text as post_id, s.dimension, s.my_answer, s.can_change, s.answered_at is not null as answered, s.public_line from public.survey_for_posts($1::uuid[]) s";
  const answer = "public.answer_survey($1::uuid, $2::boolean, $3::integer)";

  it("survey_for_posts: assigns once per reader, never on own, polls or invisible posts", () =>
    check(G, "survey_for_posts", async (tx) => {
      const out: Row = {};
      const general = await insertPost(tx, BILAL, "Survey: general by Bilal", { hoursAgo: 4 });
      await tx.unsafe(
        `insert into public.post_survey_counts (post_id, dimension, assigned, ticks) values ($1, 'informative', 1, 3), ($1, 'interesting', 0, 4)`,
        [general],
      );
      const global = await insertPost(tx, CYRA, "Survey: global by Cyra", { audience: "global", university: UNI_B, hoursAgo: 4 });
      await prime(tx, global);
      const event = await addEvent(tx, BILAL, "Survey: event by Bilal", { hoursAgo: 4 });
      await prime(tx, event);
      const own = await insertPost(tx, ASMA, "Survey: own post", { hoursAgo: 4 });
      await prime(tx, own);
      const poll = await addPoll(tx, BILAL, "Survey: a poll", { hoursAgo: 4 });
      const other = await insertPost(tx, CYRA, "Survey: only at B", { university: UNI_B, hoursAgo: 4 });
      const second = await insertPost(tx, BILAL, "Survey: second general", { hoursAgo: 5 });
      await prime(tx, second);
      const m = await bodyMap(tx);
      const strip2 = async (actor: StackActor, ids: string[]) => {
        const r = named(await rows(tx, actor, strip, [ids]), m, ["post_id"]);
        if (r.ok) (r.value as Row[]).sort((a, b) => String(a["post_id"]).localeCompare(String(b["post_id"])));
        return r;
      };
      const ids = [general, global, event, own, poll, other, UUID_X];
      const before = await snapshot(tx);
      out["asma_first_time"] = await strip2(as(ASMA), ids);
      out["assignments_after_first"] = changes(before, await snapshot(tx));
      const mid = await snapshot(tx);
      out["asma_again_is_stable"] = await strip2(as(ASMA), ids);
      out["assignments_after_second"] = changes(mid, await snapshot(tx));
      out["staff_gets_the_other_general"] = await strip2(as(STAFF), [second, own, poll]);
      out["cyra_sees_global_and_own_university"] = await strip2(as(CYRA), [general, global, other]);
      out["empty_list"] = await strip2(as(ASMA), []);
      out["signed_out"] = await rows(tx, ANON, strip, [ids]);
      return out;
    }));

  it("answer_survey: view first, latency, change window, lock, weights", () =>
    check(G, "answer", async (tx) => {
      const out: Row = {};
      const pA = await insertPost(tx, BILAL, "Answer: post A", { hoursAgo: 4 });
      await prime(tx, pA);
      out["no_question_yet"] = await call(tx, as(ASMA), answer, [pA, true, 1500]);
      out["assign"] = await stepRows(tx, as(ASMA), "select s.dimension from public.survey_for_posts($1::uuid[]) s", [[pA]]);
      out["not_viewed_yet"] = await call(tx, as(ASMA), answer, [pA, true, 1500]);
      out["record_view"] = await step(tx, as(ASMA), "public.record_views($1::uuid[])", [[pA]]);
      out["too_fast"] = await call(tx, as(ASMA), answer, [pA, true, 100]);
      out["no_latency"] = await call(tx, as(ASMA), answer, [pA, true, null]);
      out["no_answer"] = await call(tx, as(ASMA), answer, [pA, null, 1500]);
      out["answer"] = await step(tx, as(ASMA), answer, [pA, true, 1500]);
      out["change_within_window"] = await step(tx, as(ASMA), answer, [pA, false, 2000]);
      await tx.unsafe(`update public.micro_survey_responses set locked_at = now() - interval '1 minute' where post_id = $1 and user_id = $2`, [pA, ASMA]);
      out["after_lock"] = await call(tx, as(ASMA), answer, [pA, true, 2000]);

      await assign(tx, pA, DANYAL, "interesting");
      await view(tx, pA, DANYAL);
      await befriend(tx, DANYAL, BILAL);
      out["friend_of_the_author_weighs_half"] = await step(tx, as(DANYAL), answer, [pA, true, 1200]);

      await assign(tx, pA, STAFF, "relevant");
      await view(tx, pA, STAFF);
      await tx.unsafe(`update auth.users set created_at = now() where id = $1`, [STAFF]);
      out["new_account_weighs_half"] = await step(tx, as(STAFF), answer, [pA, false, 1200]);

      await assign(tx, pA, GRAD, "credible");
      await view(tx, pA, GRAD);
      await befriend(tx, GRAD, BILAL);
      await tx.unsafe(`update auth.users set created_at = now() where id = $1`, [GRAD]);
      out["friend_and_new_account"] = await step(tx, as(GRAD), answer, [pA, false, 1200]);

      const pG = await insertPost(tx, BILAL, "Answer: global post", { audience: "global", hoursAgo: 4 });
      for (let i = 0; i < 20; i++) {
        const earlier = await insertPost(tx, CYRA, `Answer: earlier ${i}`, { audience: "global", university: UNI_B, hoursAgo: 6 });
        await assign(tx, earlier, ESHA, "relevant");
        await tx.unsafe(
          `insert into public.micro_survey_responses (post_id, user_id, question_id, dimension, answer, latency_ms, weight, locked_at)
           values ($1, $2, (select min(id) from public.micro_survey_questions where dimension = 'relevant'), 'relevant', true, 1500, 1, now() - interval '1 day')`,
          [earlier, ESHA],
        );
      }
      await assign(tx, pG, ESHA, "relevant");
      await view(tx, pG, ESHA);
      out["straight_liner_weighs_less"] = await step(tx, as(ESHA), answer, [pG, true, 1500]);

      await view(tx, pA, CYRA);
      out["invisible_post_no_question"] = await call(tx, as(CYRA), answer, [pA, true, 1500]);
      out["signed_out"] = await call(tx, ANON, answer, [pA, true, 1500]);
      return out;
    }));

  it("record_views: visible only, distinct, repeated", () =>
    check(G, "record_views", async (tx) => {
      const out: Row = {};
      const vA = await insertPost(tx, BILAL, "Views: uni post", { hoursAgo: 4 });
      const vB = await insertPost(tx, CYRA, "Views: only at B", { university: UNI_B, hoursAgo: 4 });
      const vC = await insertPost(tx, BILAL, "Views: global post", { audience: "global", hoursAgo: 4 });
      const vH = await insertPost(tx, BILAL, "Views: held", { hoursAgo: 4, stage: "held" });
      const rv = "public.record_views($1::uuid[])";
      out["mixed"] = await step(tx, as(ASMA), rv, [[vA, vB, vC, vH, vA, UUID_X]]);
      out["repeat"] = await step(tx, as(ASMA), rv, [[vA, vC]]);
      out["other_reader"] = await step(tx, as(CYRA), rv, [[vA, vB, vC]]);
      out["author_views_own_held_post"] = await step(tx, as(BILAL), rv, [[vH]]);
      out["empty"] = await call(tx, as(ASMA), rv, [[]]);
      out["null"] = await call(tx, as(ASMA), rv, [null]);
      out["signed_out"] = await call(tx, ANON, rv, [[vA]]);
      return out;
    }));

  it("post_insights: author only, behind the entitlement", () =>
    check(G, "insights", async (tx) => {
      const out: Row = {};
      const p = await insertPost(tx, ASMA, "Insights: asma post", { hoursAgo: 5 });
      const other = await insertPost(tx, BILAL, "Insights: bilal post", { hoursAgo: 5 });
      const q = "select i.dimension, i.label, i.ticks, i.crosses, i.weighted_rate::text as weighted_rate, i.views, i.commenters from public.post_insights($1::uuid) i";
      out["without_entitlement"] = await rows(tx, as(ASMA), q, [p]);
      out["not_the_author"] = await rows(tx, as(BILAL), q, [p]);
      out["unknown_post"] = await rows(tx, as(ASMA), q, [UUID_X]);
      const answers: [string, string, boolean, number][] = [
        [BILAL, "informative", true, 1],
        [DANYAL, "informative", true, 0.5],
        [STAFF, "informative", false, 1],
        [GRAD, "credible", false, 1],
        [ESHA, "credible", true, 0.5],
      ];
      for (const [user, dimension, ans, weight] of answers) {
        await view(tx, p, user);
        await assign(tx, p, user, dimension);
        await tx.unsafe(
          `insert into public.micro_survey_responses (post_id, user_id, question_id, dimension, answer, latency_ms, weight, locked_at)
           values ($1, $2, (select min(id) from public.micro_survey_questions where dimension = $3), $3, $4, 1500, $5, now() - interval '1 day')`,
          [p, user, dimension, ans, weight],
        );
      }
      await tx.unsafe(`insert into public.entitlement_grants (subject_type, subject_id, key, value, source, reason) values ('user', $1, 'insights.post_survey', 'true'::jsonb, 'admin', 'content golden')`, [ASMA]);
      out["with_entitlement"] = await rows(tx, as(ASMA), q, [p]);
      out["with_entitlement_still_not_for_others_posts"] = await rows(tx, as(ASMA), q, [other]);
      out["bilal_without_entitlement"] = await rows(tx, as(BILAL), q, [other]);
      out["signed_out"] = await rows(tx, ANON, q, [p]);
      return out;
    }));

  it("stats: views, hides, comments, answers move the counters", () =>
    check(G, "stats", async (tx) => {
      const out: Row = {};
      const p = await insertPost(tx, BILAL, "Stats: global post by Bilal", { audience: "global", hoursAgo: 4 });
      await prime(tx, p);
      const before = await snapshot(tx);
      out["views"] = [
        await call(tx, as(ASMA), "public.record_views($1::uuid[])", [[p]]),
        await call(tx, as(CYRA), "public.record_views($1::uuid[])", [[p]]),
        await call(tx, as(DANYAL), "public.record_views($1::uuid[])", [[p]]),
      ];
      out["hide"] = await call(tx, as(ASMA), "public.hide_post($1::uuid, true)", [p]);
      const add = "public.add_comment($1::uuid, null, $2)";
      out["comments"] = [
        await call(tx, as(ASMA), add, [p, "A comment that is long enough"]),
        await call(tx, as(CYRA), add, [p, "From another university, long enough"]),
        await call(tx, as(DANYAL), add, [p, "short"]),
      ];
      await assign(tx, p, ASMA, "interesting");
      await assign(tx, p, CYRA, "informative");
      await assign(tx, p, DANYAL, "credible");
      out["answers"] = [
        await call(tx, as(ASMA), "public.answer_survey($1::uuid, true, 1500)", [p]),
        await call(tx, as(CYRA), "public.answer_survey($1::uuid, true, 1500)", [p]),
        await call(tx, as(DANYAL), "public.answer_survey($1::uuid, false, 1500)", [p]),
      ];
      out["changes"] = changes(before, await snapshot(tx));
      return out;
    }));
});

describe.skipIf(!DB)("content goldens on the current stack (feed)", () => {
  const G = "feed";

  it("compute_stage: held, demoted, boost, full, seed, limited", () =>
    check(G, "compute_stage", async (tx) => {
      const out: Row = {};
      const stage = async (id: string) => call(tx, OWNER, "private.compute_stage($1::uuid)::text", [id]);
      const stats = (id: string, set: string) => tx.unsafe(`update public.post_stats set ${set} where post_id = $1`, [id]);
      const hours = (n: number) => ({ hoursAgo: n });

      const held = await insertPost(tx, BILAL, "Stage: three reports", hours(5));
      await stats(held, "reports = 3");
      out["held_by_reports"] = await stage(held);
      const heldAndLoved = await insertPost(tx, BILAL, "Stage: reports beat answers", hours(5));
      await stats(heldAndLoved, "reports = 3, answers = 10, positives = 10");
      out["held_beats_everything"] = await stage(heldAndLoved);
      const twoReports = await insertPost(tx, BILAL, "Stage: two reports", hours(5));
      await stats(twoReports, "reports = 2");
      out["two_reports_not_held"] = await stage(twoReports);

      const demotedHides = await insertPost(tx, BILAL, "Stage: hidden by many", hours(5));
      await stats(demotedHides, "views = 10, hides = 3");
      out["demoted_by_hides"] = await stage(demotedHides);
      const fewViews = await insertPost(tx, BILAL, "Stage: hidden but few views", hours(5));
      await stats(fewViews, "views = 9, hides = 9");
      out["not_demoted_under_ten_views"] = await stage(fewViews);
      const demotedCred = await insertPost(tx, BILAL, "Stage: not credible", hours(5));
      await tx.unsafe(`insert into public.post_survey_counts (post_id, dimension, ticks, crosses) values ($1, 'credible', 6, 4)`, [demotedCred]);
      out["demoted_by_credible"] = await stage(demotedCred);
      const credFine = await insertPost(tx, BILAL, "Stage: credible enough", hours(5));
      await tx.unsafe(`insert into public.post_survey_counts (post_id, dimension, ticks, crosses) values ($1, 'credible', 8, 2)`, [credFine]);
      out["credible_below_threshold"] = await stage(credFine);

      const boostAnswers = await insertPost(tx, BILAL, "Stage: boosted by answers", { audience: "global", ...hours(5) });
      await stats(boostAnswers, "answers = 10, positives = 6, views = 40");
      out["global_boost_by_answers"] = await stage(boostAnswers);
      const boostComments = await insertPost(tx, BILAL, "Stage: boosted by commenters", { audience: "global", ...hours(5) });
      await stats(boostComments, "commenters = 5, commenter_universities = 2");
      out["global_boost_by_commenters"] = await stage(boostComments);
      const oneUniversity = await insertPost(tx, BILAL, "Stage: commenters from one university", { audience: "global", ...hours(5) });
      await stats(oneUniversity, "commenters = 5, commenter_universities = 1");
      out["boost_needs_two_universities"] = await stage(oneUniversity);
      const notGlobal = await insertPost(tx, BILAL, "Stage: loved but university only", hours(5));
      await stats(notGlobal, "answers = 10, positives = 9");
      out["university_post_never_boosted"] = await stage(notGlobal);

      const fullAnswers = await insertPost(tx, BILAL, "Stage: full by answers", hours(5));
      await stats(fullAnswers, "answers = 5, positives = 3");
      out["full_by_answers"] = await stage(fullAnswers);
      const lowRate = await insertPost(tx, BILAL, "Stage: answers but low rate", hours(5));
      await stats(lowRate, "answers = 5, positives = 1");
      out["answers_with_low_positive_rate"] = await stage(lowRate);
      const sticky = await insertPost(tx, BILAL, "Stage: already full", { stage: "full", ...hours(5) });
      out["full_is_sticky"] = await stage(sticky);
      const stickyBoost = await insertPost(tx, BILAL, "Stage: already boosted", { stage: "global_boost", ...hours(5) });
      out["boost_is_sticky_as_full"] = await stage(stickyBoost);
      const crowd = await insertPost(tx, BILAL, "Stage: full by non-friend commenters", hours(5));
      await insertComment(tx, crowd, DANYAL, "A comment that counts", { minutesAgo: 30 });
      await insertComment(tx, crowd, STAFF, "Another comment that counts", { minutesAgo: 20 });
      await insertComment(tx, crowd, GRAD, "A third comment that counts", { minutesAgo: 10 });
      out["full_by_three_non_friend_commenters"] = await stage(crowd);
      const friendsCrowd = await insertPost(tx, BILAL, "Stage: commenters are friends", hours(5));
      await befriend(tx, BILAL, DANYAL);
      await befriend(tx, BILAL, STAFF);
      await befriend(tx, BILAL, GRAD);
      await insertComment(tx, friendsCrowd, DANYAL, "A friend's comment here", { minutesAgo: 30 });
      await insertComment(tx, friendsCrowd, STAFF, "Another friend's comment", { minutesAgo: 20 });
      await insertComment(tx, friendsCrowd, GRAD, "A third friend's comment", { minutesAgo: 10 });
      out["friend_commenters_do_not_count"] = await stage(friendsCrowd);
      const shortComments = await insertPost(tx, BILAL, "Stage: short comments", hours(5));
      await insertComment(tx, shortComments, ASMA, "short", { minutesAgo: 30 });
      await insertComment(tx, shortComments, CYRA, "tiny", { minutesAgo: 20 });
      await insertComment(tx, shortComments, ESHA, "small", { minutesAgo: 10 });
      out["short_comments_do_not_count"] = await stage(shortComments);

      const fresh = await insertPost(tx, BILAL, "Stage: just posted", hours(1));
      out["seed_when_new"] = await stage(fresh);
      const seen = await insertPost(tx, BILAL, "Stage: new but seen a lot", hours(1));
      await stats(seen, "views = 30");
      out["limited_when_new_but_30_views"] = await stage(seen);
      const old = await insertPost(tx, BILAL, "Stage: a few hours old", hours(5));
      out["limited_when_older"] = await stage(old);
      out["unknown_post"] = await stage(UUID_X);
      return out;
    }));

  it("feed_score: friends, programme, seen, comments, stage, mutes, age", () =>
    check(G, "score", async (tx) => {
      const out: Row = {};
      const pBilal = await insertPost(tx, BILAL, "Score: bilal general", { stage: "limited", hoursAgo: 5 });
      const pCyra = await insertPost(tx, CYRA, "Score: cyra global", { audience: "global", university: UNI_B, stage: "full", hoursAgo: 5 });
      const pDanyal = await insertPost(tx, DANYAL, "Score: danyal demoted", { stage: "demoted", hoursAgo: 24 });
      const pBoost = await insertPost(tx, CYRA, "Score: cyra boosted", { audience: "global", university: UNI_B, stage: "global_boost", hoursAgo: 10 });
      const pSeed = await insertPost(tx, BILAL, "Score: bilal seed", { stage: "seed", hoursAgo: 3 });
      const posts: [string, string][] = [["bilal_limited", pBilal], ["cyra_full", pCyra], ["danyal_demoted", pDanyal], ["cyra_boost", pBoost], ["bilal_seed", pSeed]];
      const matrix = async () => {
        const m: Row = {};
        for (const [label, id] of posts)
          for (const [vl, v] of [["asma", ASMA], ["cyra", CYRA]] as const)
            m[`${label}_for_${vl}`] = await call(tx, OWNER, "round(private.feed_score($1::uuid, $2::uuid), 6)::text", [id, v]);
        return m;
      };
      out["baseline"] = await matrix();
      await befriend(tx, ASMA, BILAL);
      out["after_asma_befriends_bilal"] = await matrix();
      await view(tx, pBilal, ASMA);
      out["after_asma_saw_bilals_post"] = await matrix();
      await tx.unsafe(`insert into public.post_survey_counts (post_id, dimension, assigned, ticks, crosses, weighted_ticks, weighted_crosses) values
                         ($1, 'informative', 6, 5, 1, 4.5, 1), ($1, 'interesting', 6, 4, 2, 3.5, 2)`, [pBilal]);
      out["after_survey_counts_on_bilals_post"] = await matrix();
      await insertComment(tx, pBilal, DANYAL, "A comment that is long enough", { minutesAgo: 30 });
      await insertComment(tx, pBilal, STAFF, "Another long enough comment", { minutesAgo: 20 });
      await insertComment(tx, pBilal, ASMA, "short", { minutesAgo: 10 });
      out["after_comments"] = await matrix();
      await tx.unsafe(`insert into public.user_mutes (user_id, muted_id) values ($1, $2)`, [CYRA, BILAL]);
      out["after_cyra_mutes_bilal"] = await matrix();
      await tx.unsafe(`update public.posts set created_at = now() - interval '48 hours' where id = $1`, [pCyra]);
      out["after_cyras_post_is_two_days_old"] = await matrix();
      out["unknown_post"] = await call(tx, OWNER, "round(private.feed_score($1::uuid, $2::uuid), 6)::text", [UUID_X, ASMA]);
      return out;
    }));

  it("feed_page: pages, cursors, audiences, filters and refusals", () =>
    check(G, "page", async (tx) => {
      const out: Row = {};
      const h = (hoursAgo: number, stage = "limited") => ({ hoursAgo, stage });
      await insertPost(tx, BILAL, "Feed: bilal general", h(3));
      await insertPost(tx, DANYAL, "Feed: danyal full", h(4, "full"));
      await insertPost(tx, STAFF, "Feed: staff limited", h(5));
      await insertPost(tx, ASMA, "Feed: asma own", h(6, "full"));
      await addEvent(tx, BILAL, "Feed: bilal event", h(7));
      const announcement = await insertPost(tx, BILAL, "Feed: bilal announcement", { type: "announcement", ...h(8) });
      await tx.unsafe(`insert into public.announcement_meta (post_id, university_id, expires_at) values ($1, $2, now() + interval '5 days')`, [announcement, UNI_A]);
      await insertPost(tx, BILAL, "Feed: ten days old", h(240));
      await insertPost(tx, BILAL, "Feed: held", h(9, "held"));
      const hidden = await insertPost(tx, BILAL, "Feed: hidden by asma", h(10));
      await tx.unsafe(`insert into public.post_hides (user_id, post_id) values ($1, $2)`, [ASMA, hidden]);
      const pinned = await insertPost(tx, STAFF, "Feed: pinned platform news", { type: "announcement", audience: "global", ...h(11, "full") });
      await tx.unsafe(`update public.posts set pinned_until = now() + interval '3 days' where id = $1`, [pinned]);
      await insertPost(tx, CYRA, "Feed: global from cyra", { audience: "global", university: UNI_B, ...h(5) });
      await insertPost(tx, ESHA, "Feed: global from esha", { audience: "global", university: UNI_B, ...h(6) });
      await insertPost(tx, BILAL, "Feed: global from bilal", { audience: "global", ...h(4, "full") });
      await insertPost(tx, GRAD, "Feed: global from a blocked graduate", { audience: "global", ...h(5) });
      await block(tx, ASMA, GRAD);
      await insertPost(tx, CYRA, "Feed: only at B", { university: UNI_B, ...h(7) });
      const m = await bodyMap(tx);
      const fn = "select f.post_id::text as post_id, f.rank, f.next_cursor from public.feed_page($1::public.post_audience, $2, $3, $4::integer) f";
      const page = async (actor: StackActor, args: unknown[]) => named(await rows(tx, actor, fn, args), m, ["post_id"]);

      const first = await stepRows(tx, as(ASMA), fn, ["university", "all", null, 5]);
      const firstRows = (first.result as { ok: true; value: Row[] }).value;
      out["university_page_1"] = { result: named(first.result, m, ["post_id"]), changes: first.changes };
      const cursor = firstRows[0]!["next_cursor"] as string;
      out["university_page_2"] = await page(as(ASMA), ["university", "all", cursor, 5]);
      out["page_2_cursor_is_over"] = await rows(tx, as(ASMA), "select count(*)::int as n, count(f.next_cursor)::int as cursors from public.feed_page($1::public.post_audience, $2, $3, $4::integer) f", ["university", "all", cursor, 5]);
      out["same_cursor_other_audience"] = await page(as(ASMA), ["global", "all", cursor, 5]);
      out["unknown_session_cursor"] = await page(as(ASMA), ["university", "all", `${UUID_X}:3`, 5]);
      out["page_of_two"] = await page(as(DANYAL), ["university", "all", null, 2]);
      out["global"] = await page(as(ASMA), ["global", "all", null, 5]);
      out["global_as_cyra"] = await page(as(CYRA), ["global", "all", null, 5]);
      out["university_as_cyra"] = await page(as(CYRA), ["university", "all", null, 5]);
      out["university_as_bilal"] = await page(as(BILAL), ["university", "all", null, 20]);
      out["filter_events"] = await page(as(ASMA), ["university", "events", null, 5]);
      out["filter_announcements"] = await page(as(ASMA), ["university", "announcements", null, 5]);
      out["filter_shipped"] = await page(as(ASMA), ["university", "shipped", null, 5]);
      out["filter_ventures"] = await page(as(ASMA), ["university", "ventures", null, 5]);
      out["filter_societies"] = await page(as(ASMA), ["university", "societies", null, 5]);
      out["empty_filter_is_all"] = await page(as(ASMA), ["university", "", null, 20]);
      out["limit_zero_is_one"] = await page(as(ASMA), ["university", "all", null, 0]);
      out["limit_over_cap"] = await page(as(ASMA), ["university", "all", null, 500]);
      out["bad_filter"] = await rows(tx, as(ASMA), fn, ["university", "popular", null, 5]);
      out["bad_cursor"] = await rows(tx, as(ASMA), fn, ["university", "all", "not-a-cursor", 5]);
      out["cursor_with_bad_offset"] = await rows(tx, as(ASMA), fn, ["university", "all", `${UUID_X}:abc`, 5]);
      out["signed_out"] = await rows(tx, ANON, fn, ["university", "all", null, 5]);
      return out;
    }));
});

describe.skipIf(!DB)("content goldens on the current stack (links)", () => {
  const G = "links";
  const queue = async (tx: Tx) =>
    ((await tx.unsafe(`select message ->> 'url' as url from pgmq.q_link_previews order by msg_id`)) as unknown as { url: string }[]).map((r) => r.url);
  const links = async (tx: Tx) =>
    (
      (await tx.unsafe(`select body, left(link_url, 70) as link_url, char_length(link_url) as length from public.posts where author_id = $1 order by body`, [ASMA])) as unknown as Row[]
    ).map((r) => ({ ...r }));

  it("posts_link_url trigger: first link, trimmed, queued once", () =>
    check(G, "trigger", async (tx) => {
      const out: Row = {};
      const queued = async (run: () => Promise<unknown>) => {
        const before = await queue(tx);
        await run();
        const after = await queue(tx);
        return after.filter((u) => !before.includes(u)).map((u) => (u.length > 80 ? `${u.slice(0, 60)}... (${u.length} characters)` : u));
      };
      await tx.unsafe(
        `insert into public.link_previews (url_hash, url, status, title, fetched_at) values (private.url_hash($1), $1, 'ok', 'Fresh', now() - interval '1 day'),
           (private.url_hash($2), $2, 'ok', 'Stale', now() - interval '8 days')`,
        ["https://fresh.example.test/f", "https://stale.example.test/s"],
      );
      const bodies = [
        "Link: see https://example.test/a, and more",
        "Link: (http://plain.example.test/path).",
        "Link: question? https://q.example.test/p?x=1?",
        "Link: none here",
        "Link: two https://one.example.test/1 and https://two.example.test/2",
        "Link: fresh https://fresh.example.test/f",
        "Link: stale https://stale.example.test/s",
        "Link: not http ftp://files.example.test/f",
        "Link: brackets [https://b.example.test/x]; end",
        `Link: very long https://long.example.test/${"x".repeat(1950)}`,
      ];
      let hoursAgo = 1;
      for (const body of bodies) out[`insert: ${body.slice(0, 40)}`] = await queued(() => insertPost(tx, ASMA, body, { hoursAgo: hoursAgo++ }));
      out["after_inserts"] = await links(tx);
      const [row] = await tx.unsafe(`select id::text from public.posts where body = 'Link: none here'`);
      const id = (row as unknown as { id: string }).id;
      out["update_adds_a_link"] = await queued(() => tx.unsafe(`update public.posts set body = 'Link: now https://later.example.test/l' where id = $1`, [id]));
      out["update_same_link_not_queued_again"] = await queued(() => tx.unsafe(`update public.posts set body = 'Link: still https://later.example.test/l ok' where id = $1`, [id]));
      out["update_other_link"] = await queued(() => tx.unsafe(`update public.posts set body = 'Link: moved https://moved.example.test/m' where id = $1`, [id]));
      out["update_removes_link"] = await queued(() => tx.unsafe(`update public.posts set body = 'Link: gone' where id = $1`, [id]));
      out["after_updates"] = await links(tx);
      out["url_hash"] = await call(tx, OWNER, "private.url_hash($1)", ["https://example.test/a"]);
      out["url_hash_is_case_sensitive"] = await call(tx, OWNER, "private.url_hash($1)", ["https://Example.test/a"]);
      return out;
    }));

  it("save_link_preview: the worker's write and the card's link", () =>
    check(G, "save", async (tx) => {
      const out: Row = {};
      const url = "https://example.test/save/me";
      const post = await insertPost(tx, BILAL, `Save: a post with ${url}`, { hoursAgo: 4 });
      const card = async (user: string) =>
        rows(tx, as(user), "select c.link from public.post_cards($1::uuid[]) c", [[post]]);
      const preview = async () =>
        rows(tx, OWNER, `select status, title, description, image_url, site_name, char_length(title) as title_length, char_length(description) as description_length,
                                char_length(site_name) as site_length from public.link_previews where url_hash = private.url_hash($1)`, [url]);
      const save = "private.save_link_preview($1, $2, $3, $4, $5, $6)";
      out["card_before"] = await card(ASMA);
      out["save_ok"] = await call(tx, OWNER, save, [url, "ok", "A title", "A description", "https://img.example.test/i.png", "Example"]);
      out["row_after_ok"] = await preview();
      out["card_after_ok"] = await card(ASMA);
      out["upsert_changes_the_row"] = await call(tx, OWNER, save, [url, "ok", "A new title", "A new description", "https://img.example.test/j.png", "Example 2"]);
      out["row_after_upsert"] = await preview();
      out["image_over_http_dropped"] = await call(tx, OWNER, save, [url, "ok", "Title", "Description", "http://img.example.test/i.png", "Example"]);
      out["row_after_http_image"] = await preview();
      out["long_fields_cut"] = await call(tx, OWNER, save, [url, "ok", "t".repeat(301), "d".repeat(501), null, "s".repeat(101)]);
      out["row_after_long_fields"] = await preview();
      out["save_failed"] = await call(tx, OWNER, save, [url, "failed", null, null, null, null]);
      out["row_after_failed"] = await preview();
      out["card_after_failed_has_no_link"] = await card(ASMA);
      out["bad_status"] = await call(tx, OWNER, save, [url, "maybe", null, null, null, null]);
      out["a_user_cannot_save"] = await call(tx, as(ASMA), save, [url, "ok", "Title", null, null, null]);
      out["signed_out_cannot_save"] = await call(tx, ANON, save, [url, "ok", "Title", null, null, null]);
      await tx.unsafe(`update public.link_previews set status = 'ok', title = 'Back again' where url_hash = private.url_hash($1)`, [url]);
      out["card_for_another_reader"] = await card(DANYAL);
      out["card_for_another_university"] = await card(CYRA);
      return out;
    }));
});

describe.skipIf(!DB)("content goldens on the current stack (share)", () => {
  const G = "share";

  it("share_post: the refusals that are content's", () =>
    check(G, "visibility", async (tx) => {
      const out: Row = {};
      const visible = await insertPost(tx, BILAL, "Share: visible post", { hoursAgo: 4 });
      const otherUni = await insertPost(tx, CYRA, "Share: only at B", { university: UNI_B, hoursAgo: 4 });
      const held = await insertPost(tx, BILAL, "Share: held post", { hoursAgo: 4, stage: "held" });
      const removed = await insertPost(tx, BILAL, "Share: removed post", { hoursAgo: 4 });
      await tx.unsafe(`update public.posts set removed_at = now() where id = $1`, [removed]);
      const blocked = await insertPost(tx, DANYAL, "Share: by a blocked author", { hoursAgo: 4 });
      await block(tx, ASMA, DANYAL);
      const share = "public.share_post($1::uuid, $2::uuid[], $3)";
      const one = [UUID_X];
      out["other_university_post"] = await call(tx, as(ASMA), share, [otherUni, one, null]);
      out["held_post_of_someone_else"] = await call(tx, as(ASMA), share, [held, one, null]);
      out["removed_post"] = await call(tx, as(ASMA), share, [removed, one, null]);
      out["blocked_author"] = await call(tx, as(ASMA), share, [blocked, one, null]);
      out["unknown_post"] = await call(tx, as(ASMA), share, [UUID_Y, one, null]);
      out["null_post"] = await call(tx, as(ASMA), share, [null, one, null]);
      out["no_threads"] = await call(tx, as(ASMA), share, [visible, [], null]);
      out["null_threads"] = await call(tx, as(ASMA), share, [visible, null, null]);
      const six = Array.from({ length: 6 }, (_, i) => `9e000000-0000-4000-8000-00000000010${i}`);
      out["six_threads"] = await call(tx, as(ASMA), share, [visible, six, null]);
      out["note_1001_characters"] = await call(tx, as(ASMA), share, [visible, one, "n".repeat(1001)]);
      out["signed_out"] = await call(tx, ANON, share, [visible, one, null]);
      return out;
    }));
});
