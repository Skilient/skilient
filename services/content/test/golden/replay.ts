/**
 * Replaying the content goldens against the port (CLAUDE.md, "How to work" 4).
 *
 * The goldens (packages/testing/test/content.golden.test.ts) were recorded on Supabase, so their `changes`
 * name Supabase tables and their refusals are Postgres errors. Comparison rules (as people's and identity's,
 * decisions 2026-11-25):
 *   1. Content's tables are read from content's schema and reported under the recorded name, projected to the
 *      recorded columns (RENAMED): micro_survey_* are content.survey_*.
 *   2. Tables another service owns (FOREIGN: notify's notifications) are dropped from the recorded side; the
 *      case asserts the event that carries content's part instead (comment.created).
 *   3. A refusal maps to the recorded SQLSTATE and message through src/refusals.ts. A signed-out caller's
 *      recorded "permission denied for function X" (anon had no grant) equals any refusal the port gives a
 *      caller with no user (approved by Ahmed for W1).
 *   4. Fixture rows other services own arrive as their events would bring them: members from user.created and
 *      profile.updated, friendships, blocks and mutes from people's events. Rows the recorder wrote directly
 *      into content's own tables (aged posts, votes, views) are written directly here too.
 * Every case runs in one transaction that is rolled back.
 */
import { createHash } from "node:crypto";
import { join } from "node:path";
import { ConnectError } from "@connectrpc/connect";
import { refusalReason } from "@skilient/platform";
import { normalise } from "@skilient/testing";
import { startPostgres, type TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { expect } from "vitest";
import { resolveConfig, type Config } from "../../src/domain/config";
import { REFUSALS, type RefusalReason } from "../../src/refusals";
import { applyCopyEvent } from "../../src/store/copies";

export type Tx = postgres.TransactionSql;
type Row = Record<string, unknown>;
const DIR = join(import.meta.dirname, "../../../../packages/testing/test/golden/content");
export const MIGRATIONS = join(import.meta.dirname, "../../migrations");
export const CONFIG: Config = resolveConfig({});

// The recording's fixture world (packages/testing/test/content.golden.test.ts, `seed`).
export const UNI_A = "9c000000-0000-4000-8000-00000000000a";
export const UNI_B = "9c000000-0000-4000-8000-00000000000b";
export const ASMA = "9d000000-0000-4000-8000-000000000001";
export const BILAL = "9d000000-0000-4000-8000-000000000002";
export const CYRA = "9d000000-0000-4000-8000-000000000003";
export const DANYAL = "9d000000-0000-4000-8000-000000000004";
export const ESHA = "9d000000-0000-4000-8000-000000000005";
export const FRESH = "9d000000-0000-4000-8000-000000000006";
export const STAFF = "9d000000-0000-4000-8000-000000000007";
export const GRAD = "9d000000-0000-4000-8000-000000000008";
export const USERS = [ASMA, BILAL, CYRA, DANYAL, ESHA, FRESH, STAFF, GRAD];
export const UUID_X = "9e000000-0000-4000-8000-0000000000a1";
export const UUID_Y = "9e000000-0000-4000-8000-0000000000a2";
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
export const MEDIA = {
  asma1: `${ASMA}/9d100000-0000-4000-8000-000000000001.webp`,
  asma2: `${ASMA}/9d100000-0000-4000-8000-000000000002.webp`,
  bilal1: `${BILAL}/9d100000-0000-4000-8000-000000000003.webp`,
};
/** Each fixture user's profile as people publishes it. */
const PROFILE: Record<string, { uni: string; dept: string | null; year: number | null; visibility: string; status: string; onboarded: boolean }> = {
  [ASMA]: { uni: UNI_A, dept: "Computer Science", year: 2027, visibility: "university", status: "active", onboarded: true },
  [BILAL]: { uni: UNI_A, dept: "Computer Science", year: 2027, visibility: "university", status: "active", onboarded: true },
  [CYRA]: { uni: UNI_B, dept: "Electrical Engineering", year: 2027, visibility: "university", status: "active", onboarded: true },
  [DANYAL]: { uni: UNI_A, dept: "Software Engineering", year: 2026, visibility: "friends", status: "active", onboarded: true },
  [ESHA]: { uni: UNI_B, dept: "Electrical Engineering", year: 2028, visibility: "global", status: "active", onboarded: true },
  [FRESH]: { uni: UNI_A, dept: null, year: null, visibility: "university", status: "active", onboarded: false },
  [STAFF]: { uni: UNI_A, dept: "Computer Science", year: 2027, visibility: "university", status: "active", onboarded: true },
  [GRAD]: { uni: UNI_A, dept: "Computer Science", year: 2025, visibility: "university", status: "graduate", onboarded: true },
};
const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/** The ports' fakes: people's names, identity's staff role. */
export const people = {
  async cards(ids: readonly string[]) {
    return new Map(ids.filter((id) => NAME[id]).map((id) => [id, { username: USERNAME[id] ?? "", fullName: NAME[id]!, avatarPath: "" }]));
  },
  async resolve(names: readonly string[]) {
    const byName = new Map(Object.entries(USERNAME).map(([id, u]) => [u, id]));
    return new Map(names.filter((n) => byName.has(n)).map((n) => [n, byName.get(n)!]));
  },
};
export const isStaff = (id: string | null) => id === STAFF;

/** Rule 4: the recording's `seed`, as content receives it. */
export async function seed(tx: Tx): Promise<void> {
  for (const id of USERS) {
    const p = PROFILE[id]!;
    const at = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const created = await applyCopyEvent(tx, {
      type: "user.created",
      producer: "svc_identity",
      version: 1,
      subjects: [id],
      at,
      payload: { role: "student", university_id: p.uni, visibility: "university", status: "active", onboarding_complete: false },
    });
    const updated = await applyCopyEvent(tx, {
      type: "profile.updated",
      producer: "svc_people",
      version: 1,
      subjects: [id],
      payload: {
        user_id: id,
        role: "student",
        university_id: p.uni,
        department_id: null,
        department_hash: p.dept ? sha(p.dept) : null,
        graduation_year: p.year,
        visibility: p.visibility,
        status: p.status,
        onboarding_complete: p.onboarded,
      },
    });
    expect([created, updated]).toEqual(["applied", "applied"]);
  }
}

/** Rule 4: people's edges, through the copies consumer. */
export const befriend = (tx: Tx, a: string, b: string) =>
  applyCopyEvent(tx, { type: "friendship.changed", producer: "svc_people", version: 1, subjects: [a, b], payload: { user_a: a, user_b: b, friends: true } });
export const block = (tx: Tx, a: string, b: string) =>
  applyCopyEvent(tx, { type: "block.changed", producer: "svc_people", version: 1, subjects: [a, b], payload: { blocker_id: a, blocked_id: b, blocked: true } });
export const mute = (tx: Tx, a: string, b: string) =>
  applyCopyEvent(tx, { type: "mute.changed", producer: "svc_people", version: 1, subjects: [a, b], payload: { user_id: a, muted_id: b, muted: true } });

/** Rule 1: content's tables under the recorded names, projected to the recorded columns and order. */
export const RENAMED: Record<string, (tx: Tx) => PromiseLike<readonly unknown[]>> = {
  "public.posts": (tx) => tx`
    select author_id, university_id, audience, type, body, venture_id, stage, pinned_until is not null as pinned,
           edited_at is not null as edited, link_url, society_id, removed_at is not null as removed
      from content.posts where author_id = any(${USERS}::uuid[]) order by body`,
  "public.post_media": (tx) => tx`
    select p.body, m.position, m.path, m.width, m.height from content.post_media m join content.posts p on p.id = m.post_id
     where p.author_id = any(${USERS}::uuid[]) order by 1, 2`,
  "public.post_events": (tx) => tx`
    select p.body, e.starts_at is not null as has_start, e.place, e.url from content.post_events e join content.posts p on p.id = e.post_id
     where p.author_id = any(${USERS}::uuid[]) order by 1`,
  "public.event_rsvps": (tx) => tx`
    select p.body, r.user_id, r.status from content.event_rsvps r join content.posts p on p.id = r.post_id
     where p.author_id = any(${USERS}::uuid[]) order by 1, 2`,
  "public.post_polls": (tx) => tx`
    select p.body, round(extract(epoch from (pl.closes_at - p.created_at)) / 86400)::int as days from content.post_polls pl
      join content.posts p on p.id = pl.post_id where p.author_id = any(${USERS}::uuid[]) order by 1`,
  "public.poll_options": (tx) => tx`
    select p.body, o.position, o.label from content.poll_options o join content.posts p on p.id = o.post_id
     where p.author_id = any(${USERS}::uuid[]) order by 1, 2`,
  "public.poll_votes": (tx) => tx`
    select p.body, v.user_id, v.position from content.poll_votes v join content.posts p on p.id = v.post_id
     where p.author_id = any(${USERS}::uuid[]) order by 1, 2`,
  "public.post_comments": (tx) => tx`
    select p.body as post, c.author_id, c.body, c.parent_id is not null as reply, c.pinned, c.deleted_at is not null as deleted
      from content.post_comments c join content.posts p on p.id = c.post_id where p.author_id = any(${USERS}::uuid[]) order by 1, 3, 2`,
  "public.post_hides": (tx) => tx`
    select h.user_id, p.body from content.post_hides h join content.posts p on p.id = h.post_id where h.user_id = any(${USERS}::uuid[]) order by 1, 2`,
  "public.post_views": (tx) => tx`
    select v.user_id, p.body from content.post_views v join content.posts p on p.id = v.post_id where v.user_id = any(${USERS}::uuid[]) order by 1, 2`,
  "public.micro_survey_assignments": (tx) => tx`
    select a.user_id, p.body, a.dimension from content.survey_assignments a join content.posts p on p.id = a.post_id
     where a.user_id = any(${USERS}::uuid[]) order by 1, 2`,
  "public.micro_survey_responses": (tx) => tx`
    select r.user_id, p.body, r.dimension, r.answer, r.latency_ms, r.weight from content.survey_responses r
      join content.posts p on p.id = r.post_id where r.user_id = any(${USERS}::uuid[]) order by 1, 2`,
  "public.post_survey_counts": (tx) => tx`
    select p.body, c.dimension, c.assigned, c.ticks, c.crosses, c.weighted_ticks, c.weighted_crosses
      from content.post_survey_counts c join content.posts p on p.id = c.post_id where p.author_id = any(${USERS}::uuid[]) order by 1, 2`,
  "public.post_stats": (tx) => tx`
    select p.body, s.views, s.hides, s.answers, s.positives, s.commenters, s.commenter_universities, s.appropriate_flags, s.reports
      from content.post_stats s join content.posts p on p.id = s.post_id where p.author_id = any(${USERS}::uuid[]) order by 1`,
  "public.feed_sessions": (tx) => tx`
    select user_id, audience, filter, cardinality(post_ids) as posts from content.feed_sessions where user_id = any(${USERS}::uuid[]) order by 1, 2, 3`,
};

/** Rule 2: tables other services own, and the event that carries content's part. */
export const FOREIGN: Record<string, { owner: string; via: string }> = {
  "public.notifications": { owner: "notify", via: "comment.created / post.created" },
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

/** Rule 3: a refusal as the recorded SQLSTATE and message; `fn` names the function for a signed-out caller. */
export async function outcome(run: () => unknown, fn?: string): Promise<Outcome> {
  try {
    return { ok: true, value: (await run()) ?? null };
  } catch (error) {
    if (error instanceof ConnectError) {
      if (fn) return { ok: false, code: "42501", message: `permission denied for function ${fn}` };
      const reason = refusalReason(error) as RefusalReason | null;
      const r = reason ? REFUSALS[reason] : undefined;
      if (!r) throw error;
      return { ok: false, code: r.sqlstate, message: r.text };
    }
    // A database refusal (a check constraint) compares as itself.
    const e = error as { code?: unknown; message?: unknown; name?: unknown };
    if (e.name === "PostgresError" && typeof e.code === "string") return { ok: false, code: e.code, message: String(e.message) };
    throw error;
  }
}

/** One call in a savepoint. Pass `fn` only for a signed-out caller (rule 3). */
export const call = (tx: Tx, run: (sp: Tx) => unknown, fn?: string): Promise<Outcome> => outcome(() => tx.savepoint((sp) => Promise.resolve(run(sp))), fn);

/** One call with the rows it changed, as the recorder's `step`. */
export async function step(tx: Tx, run: (sp: Tx) => unknown, fn?: string) {
  const before = await snapshot(tx);
  const result = await call(tx, run, fn);
  return { result, changes: changes(before, await snapshot(tx)) };
}

/** A replay world: content's schema in a fresh Postgres. */
export async function startWorld(): Promise<{ pg: TestDatabase; sql: postgres.Sql }> {
  if (process.env["GOLDEN_RECORD"] === "1") throw new Error("golden replays never record; unset GOLDEN_RECORD");
  const pg = await startPostgres();
  const sql = await pg.service("content", MIGRATIONS);
  return { pg, sql };
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

/** Drops rule-2 tables from every `changes` in a recorded value. */
export function dropForeign(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(dropForeign);
  if (value && typeof value === "object") {
    const o = value as Row;
    return Object.fromEntries(
      Object.entries(o)
        .map(([k, v]) => {
          if (k === "changes" && v && typeof v === "object") {
            const kept = Object.fromEntries(Object.entries(v as Row).filter(([t]) => !(t in FOREIGN)));
            return [k, kept];
          }
          return [k, dropForeign(v)];
        })
        .filter(([, v]) => v !== undefined),
    );
  }
  return value;
}

/**
 * Runs one case in a rolled-back transaction against a fresh seed and compares it with the recording, after
 * rule 2. Both sides are normalised and renumbered the same way.
 */
export async function replay(sql: postgres.Sql, group: string, name: string, run: (tx: Tx) => Promise<unknown>): Promise<void> {
  let value: unknown;
  await sql
    .begin(async (tx) => {
      await seed(tx);
      value = await run(tx);
      throw new Error("rollback");
    })
    .catch((e: unknown) => {
      if (!(e instanceof Error) || e.message !== "rollback") throw e;
    });
  const file = join(DIR, `${group}.json`);
  const recorded = JSON.parse(await import("node:fs").then((fs) => fs.readFileSync(file, "utf8"))) as Row;
  if (!(name in recorded)) throw new Error(`no golden case ${group}/${name}`);
  const expected = renumber(dropForeign(recorded[name]));
  const actual = renumber(dropForeign(normalise(value)));
  expect(actual).toEqual(expected);
}

// ---------------------------------------------------------------------------
// Fixture writers on content's own tables (the recorder's helpers, same names)
// ---------------------------------------------------------------------------
export async function insertPost(
  tx: Tx,
  author: string,
  body: string,
  v: { type?: string; audience?: string; university?: string | null; hoursAgo?: number; stage?: string } = {},
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into content.posts (id, author_id, university_id, audience, type, body, stage, created_at, link_url)
    values (gen_random_uuid(), ${author}, ${v.university === undefined ? UNI_A : v.university}, ${v.audience ?? "university"}, ${v.type ?? "general"}, ${body},
            ${v.stage ?? "seed"}, now() - make_interval(hours => ${v.hoursAgo ?? 0}),
            left(rtrim(substring(${body} from '(https?://[^\\s<>"'']+)'), '.,;:!?)]'), 2000))
    returning id::text`;
  await tx`insert into content.post_stats (post_id) values (${row!.id})`;
  return row!.id;
}

export async function addPoll(
  tx: Tx,
  author: string,
  body: string,
  v: { options?: string[]; closesInHours?: number; hoursAgo?: number; audience?: string; university?: string | null; stage?: string } = {},
): Promise<string> {
  const id = await insertPost(tx, author, body, { type: "poll", ...v });
  await tx`insert into content.post_polls (post_id, closes_at) values (${id}, now() + make_interval(hours => ${v.closesInHours ?? 48}))`;
  let i = 0;
  for (const label of v.options ?? ["Red", "Green", "Blue"]) await tx`insert into content.poll_options (post_id, position, label) values (${id}, ${++i}, ${label})`;
  return id;
}

export async function addEvent(
  tx: Tx,
  author: string,
  body: string,
  v: { startsInHours?: number; hoursAgo?: number; audience?: string; university?: string | null; stage?: string } = {},
): Promise<string> {
  const id = await insertPost(tx, author, body, { type: "event", ...v });
  await tx`insert into content.post_events (post_id, starts_at, place, url) values (${id}, now() + make_interval(hours => ${v.startsInHours ?? 48}), 'Main hall', null)`;
  return id;
}

export async function addMedia(tx: Tx, post: string, paths: string[]): Promise<void> {
  let i = 0;
  for (const p of paths) await tx`insert into content.post_media (post_id, position, path, width, height) values (${post}, ${++i}, ${p}, 800, 600)`;
}

/** As the recorder's helper; the comment stats trigger is applied as content's comment writes apply it. */
export async function insertComment(tx: Tx, post: string, author: string, body: string, v: { parent?: string | null; minutesAgo?: number; pinned?: boolean } = {}): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into content.post_comments (id, post_id, parent_id, author_id, body, pinned, created_at)
    values (gen_random_uuid(), ${post}, ${v.parent ?? null}, ${author}, ${body}, ${v.pinned ?? false}, now() - make_interval(mins => ${v.minutesAgo ?? 0}))
    returning id::text`;
  const { refreshCommentStats } = await import("../../src/store/comments");
  await refreshCommentStats(tx, post);
  return row!.id;
}

/** A view, with stats_on_view. */
export async function view(tx: Tx, post: string, user: string): Promise<void> {
  await tx`insert into content.post_views (post_id, user_id) values (${post}, ${user})`;
  await tx`insert into content.post_stats (post_id, views) values (${post}, 1) on conflict (post_id) do update set views = content.post_stats.views + 1`;
}

export const prime = (tx: Tx, post: string) =>
  tx`insert into content.post_survey_counts (post_id, dimension, assigned) values (${post}, 'informative', 1) on conflict (post_id, dimension) do nothing`;

/** An assignment written as the recorder's owner insert did (with stats_on_assignment). */
export async function assign(tx: Tx, post: string, user: string, dimension: string): Promise<void> {
  await tx`
    insert into content.survey_assignments (post_id, user_id, question_id, dimension)
    values (${post}, ${user}, (select min(id) from content.survey_questions where dimension = ${dimension}), ${dimension})`;
  await tx`
    insert into content.post_survey_counts (post_id, dimension, assigned) values (${post}, ${dimension}, 1)
    on conflict (post_id, dimension) do update set assigned = content.post_survey_counts.assigned + 1`;
}

export async function bodyMap(tx: Tx): Promise<Map<string, string>> {
  const r = await tx<{ id: string; body: string }[]>`select id::text, body from content.posts where author_id = any(${USERS}::uuid[])`;
  return new Map(r.map((x) => [x.id, x.body]));
}

/** Replaces post ids by their bodies in the named keys; rows of posts outside the fixture are dropped. */
export function named(out: Outcome, m: Map<string, string>, keys: string[]): Outcome {
  if (!out.ok) return out;
  const list = (out.value as Row[]).filter((r) => keys.every((k) => r[k] == null || m.has(String(r[k]))));
  return { ok: true, value: list.map((r) => ({ ...r, ...Object.fromEntries(keys.map((k) => [k, r[k] == null ? null : m.get(String(r[k]))])) })) };
}

export const postId = async (tx: Tx, body: string) => (await tx<{ id: string }[]>`select id::text from content.posts where body = ${body}`)[0]!.id;
