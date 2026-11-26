import { uuidv7 } from "@skilient/platform";
import type { Config } from "../domain/config";
import {
  computeStage,
  inSeedAudience,
  matchesFilter,
  orderFeed,
  parseCursor,
  score,
  scorePool,
  type FeedPost,
  type Filter,
  type Reader,
  type Stage,
  type StageInputs,
} from "../domain/feed";
import { refused } from "../refusals";
import { canViewPost, type Db, type Tx } from "./db";
import { loadPool, loadViewer, visibleIn, type AudienceKey, type PoolCache } from "./pool";

/**
 * The ranked feed (ported from feed_page, build_feed (two steps, _feed_two_step), feed_score, post_quality,
 * in_seed_audience, compute_stage and feed_stage_job). A first page reads the reader's eligible posts with every
 * scoring input in one query, scores them in TypeScript (domain/feed.ts), and keeps the ranked list as a
 * session for 10 minutes; later pages slice the session. Stages are recomputed every 5 minutes.
 */
interface EligibleRow {
  id: string;
  author_id: string;
  university_id: string | null;
  audience: "university" | "global";
  type: string;
  venture_id: string | null;
  society_id: string | null;
  stage: Stage;
  created_at: Date;
  a_university_id: string | null;
  a_department_hash: string | null;
  a_graduation_year: number | null;
  author_skills: string[];
  quality_pos: string;
  quality_total: string;
  credible_ticks: number;
  credible_crosses: number;
  commenter_friends: boolean[];
  answers: number;
  positives: number;
  talk_commenters: number;
  seen: boolean;
}

interface ReaderRow {
  university_id: string | null;
  department_hash: string | null;
  graduation_year: number | null;
  friends: string[];
  follows: string[];
  skills: string[];
}

/** The reader's facts (one query). */
async function loadReader(db: Db, me: string): Promise<Omit<Reader, "seen">> {
  const [r] = await db<ReaderRow[]>`
    select m.university_id::text, m.department_hash, m.graduation_year,
           coalesce((select array_agg(case when f.user_id_a = ${me}::uuid then f.user_id_b else f.user_id_a end)::text[]
                       from content.friendships f where f.user_id_a = ${me}::uuid or f.user_id_b = ${me}::uuid), '{}') as friends,
           coalesce((select array_agg(vf.venture_id)::text[] from content.venture_follows vf where vf.user_id = ${me}::uuid), '{}') as follows,
           coalesce((select array_agg(s.skill_id) from content.user_skills s where s.user_id = ${me}::uuid and s.level >= 1), '{}') as skills
      from (select ${me}::uuid as id) x left join content.members m on m.user_id = x.id`;
  return {
    id: me,
    university_id: r?.university_id ?? null,
    department_hash: r?.department_hash ?? null,
    graduation_year: r?.graduation_year ?? null,
    friends: new Set(r?.friends ?? []),
    follows: new Set(r?.follows ?? []),
    skills: new Set(r?.skills ?? []),
  };
}

const toPost = (r: EligibleRow): FeedPost => ({
  id: r.id,
  author_id: r.author_id,
  university_id: r.university_id,
  audience: r.audience,
  type: r.type,
  venture_id: r.venture_id,
  society_id: r.society_id,
  stage: r.stage,
  created_at: r.created_at,
  author: { university_id: r.a_university_id, department_hash: r.a_department_hash, graduation_year: r.a_graduation_year },
  author_skills: r.author_skills,
  quality_pos: Number(r.quality_pos),
  quality_total: Number(r.quality_total),
  credible_ticks: r.credible_ticks,
  credible_crosses: r.credible_crosses,
  commenters: r.commenter_friends.map((friend) => ({ friend })),
  answers: r.answers,
  positives: r.positives,
  talk_commenters: r.talk_commenters,
});

/** `build_feed(viewer, audience, filter, exclude)`: the reader's ranked list. `shuffle` orders exploration picks. */
export async function buildFeed(
  db: Db,
  me: string,
  audience: "university" | "global",
  filter: Filter,
  exclude: readonly string[],
  c: Config,
  shuffle: <T>(xs: T[]) => T[] = randomShuffle,
  pools?: PoolCache,
  /** Filled with each listed post's author, so the caller can ask for names before reading the cards. */
  authors?: Map<string, string>,
): Promise<string[]> {
  const { viewer, now } = await loadViewer(db, me, c);
  const key: AudienceKey = audience === "global" ? { audience } : { audience, universityId: viewer.university_id };
  const pool0 = pools ? await pools.get(db, key, c) : await loadPool(db, key, c);
  const w = c["feed.window"];
  const skip = new Set(exclude);
  const reader: Reader = viewer;
  const posts = pool0.posts.filter(
    (p) =>
      !skip.has(p.id) &&
      (p.pinned_until === null || p.pinned_until <= now) &&
      p.created_at.getTime() > now.getTime() - (p.type === "shipped" ? w.shipped_age_days : w.max_age_days) * 86_400_000 &&
      matchesFilter(filter, p) &&
      !viewer.hidden.has(p.id) &&
      !viewer.muted.has(p.author_id) &&
      visibleIn(p, viewer, now),
  );
  const pool = scorePool(posts, reader, Math.max(w.score_pool, 1)).filter((p) => p.stage !== "seed" || inSeedAudience(p, reader));
  const candidates = pool
    .map((p) => ({ id: p.id, author_id: p.author_id, score: score(p, reader, now, c), created_at: p.created_at }))
    .sort((a, b) => b.score - a.score)
    .slice(0, w.candidates);
  const taken = new Set(candidates.map((x) => x.id));
  const explore = shuffle(
    posts.filter(
      (p) =>
        p.stage === "seed" &&
        p.created_at.getTime() > now.getTime() - w.exploration_max_hours * 3_600_000 &&
        p.author_id !== me &&
        !taken.has(p.id) &&
        !reader.seen.has(p.id),
    ),
  )
    .slice(0, Math.floor(candidates.length / Math.max(w.exploration_every - 1, 1)) + 2)
    .map((p) => p.id);
  if (authors) for (const p of posts) authors.set(p.id, p.author_id);
  return orderFeed(candidates, explore, c);
}

function randomShuffle<T>(xs: T[]): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export interface FeedPageResult {
  items: { post_id: string; rank: number }[];
  next_cursor: string | null;
  /** The page's authors, when this call ranked the feed (a first page): names can be fetched in parallel with the cards. */
  authors: string[] | null;
}

/** `feed_page(audience, filter, cursor, limit)`. */
export async function feedPage(
  tx: Db,
  me: string | null,
  audience: string,
  rawFilter: string,
  cursor: string | null,
  rawLimit: number | null,
  c: Config,
  shuffle?: <T>(xs: T[]) => T[],
  pools?: PoolCache,
  /** False when the caller reads the page's cards, which apply the same visibility rule (one trip fewer). */
  checkVisible = true,
): Promise<FeedPageResult> {
  if (!me) throw refused("not_signed_in");
  if (audience !== "university" && audience !== "global") throw refused("unknown_type");
  const filter = (rawFilter || "all") as Filter;
  if (!["all", "ventures", "events", "announcements", "shipped", "societies"].includes(filter)) throw refused("unknown_filter");
  let offset = 0;
  let session: { session_id: string; post_ids: string[]; fresh: boolean } | undefined;
  if (cursor !== null) {
    const parsed = parseCursor(cursor);
    if (!parsed) throw refused("bad_cursor");
    offset = parsed.offset;
    [session] = await tx<{ session_id: string; post_ids: string[]; fresh: boolean }[]>`
      select session_id::text, post_ids::text[], created_at > now() - make_interval(mins => ${c["feed.window"].session_minutes}) as fresh
        from content.feed_sessions
       where session_id = ${parsed.session} and user_id = ${me} and audience = ${audience} and filter = ${filter}`;
  }
  let ids: string[];
  let sid: string;
  const authorOf = new Map<string, string>();
  if (session?.fresh) {
    ids = session.post_ids;
    sid = session.session_id;
  } else {
    const served = session ? session.post_ids.slice(0, offset) : [];
    if (!session) offset = 0;
    ids = [...served, ...(await buildFeed(tx, me, audience, filter, served, c, shuffle, pools, authorOf))];
    sid = uuidv7();
    // The new session, and a reader's sessions kept to the newest 10, in one statement.
    await tx`
      with added as (
        insert into content.feed_sessions (session_id, user_id, audience, filter, post_ids) values (${sid}, ${me}, ${audience}, ${filter}, ${ids}::uuid[])
        returning session_id)
      delete from content.feed_sessions f where f.user_id = ${me}
         and f.session_id not in (select f2.session_id from content.feed_sessions f2 where f2.user_id = ${me} order by f2.created_at desc, f2.session_id desc limit 9)
         and f.session_id not in (select session_id from added)`;
  }
  const limit = Math.min(Math.max(rawLimit ?? 20, 1), 50);
  const page = ids.slice(offset, offset + limit);
  const visible = !checkVisible
    ? new Set(page)
    : page.length
    ? new Set((await tx<{ id: string }[]>`select p.id::text from content.posts p where p.id = any(${page}::uuid[]) and ${canViewPost(tx, me)}`).map((r) => r.id))
    : new Set<string>();
  return {
    items: page.map((id, i) => ({ post_id: id, rank: offset + i + 1 })).filter((x) => visible.has(x.post_id)),
    next_cursor: offset + limit < ids.length ? `${sid}:${offset + limit}` : null,
    authors: authorOf.size ? [...new Set(page.map((id) => authorOf.get(id)).filter((x): x is string => Boolean(x)))] : null,
  };
}

/** `feed-stage` (every 5 minutes): recomputes changed posts' stages; every post in the window at the hour's first run. */
export async function runStageJob(tx: Tx, c: Config): Promise<number> {
  const sc = c["feed.score"];
  const rows = await tx<(Omit<StageInputs, "created_at"> & { id: string; created_at: Date; now: Date })[]>`
    select p.id::text, p.stage, p.type, p.audience, p.created_at, now() as now,
           coalesce(s.reports, 0) as reports, coalesce(s.views, 0) as views, coalesce(s.hides, 0) as hides,
           coalesce(s.answers, 0) as answers, coalesce(s.positives, 0) as positives,
           coalesce(s.commenters, 0) as commenters, coalesce(s.commenter_universities, 0) as commenter_universities,
           coalesce((select sum(sc.ticks)::int from content.post_survey_counts sc where sc.post_id = p.id and sc.dimension = 'credible'), 0) as credible_ticks,
           coalesce((select sum(sc.crosses)::int from content.post_survey_counts sc where sc.post_id = p.id and sc.dimension = 'credible'), 0) as credible_crosses,
           (select count(distinct c.author_id)::int from content.post_comments c
             where c.post_id = p.id and c.deleted_at is null and c.author_id <> p.author_id and char_length(c.body) >= ${sc.min_comment_chars}
               and not exists (select 1 from content.friendships f where f.user_id_a = least(c.author_id, p.author_id) and f.user_id_b = greatest(c.author_id, p.author_id))) as nonfriend_commenters
      from content.posts p
      left join content.post_stats s on s.post_id = p.id
     where p.created_at > now() - make_interval(days => ${c["feed.window"].shipped_age_days})
       and (extract(minute from now()) < 5 or p.stage = 'seed' or p.created_at > now() - interval '15 minutes' or s.updated_at > now() - interval '15 minutes')`;
  const changed = rows.flatMap((r) => {
    const next = computeStage(r, r.now, c);
    return next !== r.stage ? [{ id: r.id, stage: next }] : [];
  });
  if (changed.length)
    await tx`
      update content.posts p set stage = x.stage, stage_changed_at = now()
        from jsonb_to_recordset(${JSON.stringify(changed)}::text::jsonb) as x(id uuid, stage text)
       where p.id = x.id`;
  return changed.length;
}

/** One post's stage from its current inputs (compute_stage; for tests and replays). */
export async function stageOf(db: Db, postId: string, c: Config): Promise<Stage | null> {
  const [r] = await db<(Omit<StageInputs, "created_at"> & { created_at: Date; now: Date })[]>`
    select p.stage, p.type, p.audience, p.created_at, now() as now,
           coalesce(s.reports, 0) as reports, coalesce(s.views, 0) as views, coalesce(s.hides, 0) as hides,
           coalesce(s.answers, 0) as answers, coalesce(s.positives, 0) as positives,
           coalesce(s.commenters, 0) as commenters, coalesce(s.commenter_universities, 0) as commenter_universities,
           coalesce((select sum(sc.ticks)::int from content.post_survey_counts sc where sc.post_id = p.id and sc.dimension = 'credible'), 0) as credible_ticks,
           coalesce((select sum(sc.crosses)::int from content.post_survey_counts sc where sc.post_id = p.id and sc.dimension = 'credible'), 0) as credible_crosses,
           (select count(distinct c.author_id)::int from content.post_comments c
             where c.post_id = p.id and c.deleted_at is null and c.author_id <> p.author_id and char_length(c.body) >= ${c["feed.score"].min_comment_chars}
               and not exists (select 1 from content.friendships f where f.user_id_a = least(c.author_id, p.author_id) and f.user_id_b = greatest(c.author_id, p.author_id))) as nonfriend_commenters
      from content.posts p left join content.post_stats s on s.post_id = p.id where p.id = ${postId}`;
  return r ? computeStage(r, r.now, c) : null;
}

/** `feed_score(post, viewer)` for one post (tests, replays and /ops): 0 for an unknown post or a muted author. */
export async function scoreOf(db: Db, postId: string, viewer: string, c: Config): Promise<number> {
  const base = await loadReader(db, viewer);
  const sc = c["feed.score"];
  const [r] = await db<(EligibleRow & { muted: boolean; now: Date })[]>`
    select p.id::text, p.author_id::text, p.university_id::text, p.audience, p.type, p.venture_id::text, p.society_id::text, p.stage, p.created_at, now() as now,
           a.university_id::text as a_university_id, a.department_hash as a_department_hash, a.graduation_year as a_graduation_year,
           coalesce((select array_agg(s.skill_id) from content.user_skills s where s.user_id = p.author_id and s.level >= 1), '{}') as author_skills,
           coalesce((select sum(sc.weighted_ticks) from content.post_survey_counts sc where sc.post_id = p.id and sc.dimension in ('informative', 'interesting')), 0)::text as quality_pos,
           coalesce((select sum(sc.weighted_ticks + sc.weighted_crosses) from content.post_survey_counts sc where sc.post_id = p.id and sc.dimension in ('informative', 'interesting')), 0)::text as quality_total,
           coalesce((select sum(sc.ticks)::int from content.post_survey_counts sc where sc.post_id = p.id and sc.dimension = 'credible'), 0) as credible_ticks,
           coalesce((select sum(sc.crosses)::int from content.post_survey_counts sc where sc.post_id = p.id and sc.dimension = 'credible'), 0) as credible_crosses,
           coalesce((select array_agg(exists (select 1 from content.friendships f where f.user_id_a = least(x.author_id, p.author_id) and f.user_id_b = greatest(x.author_id, p.author_id)))
                       from (select distinct c.author_id from content.post_comments c
                              where c.post_id = p.id and c.deleted_at is null and c.author_id <> p.author_id and char_length(c.body) >= ${sc.min_comment_chars}) x), '{}') as commenter_friends,
           0 as answers, 0 as positives, 0 as talk_commenters,
           exists (select 1 from content.post_views pv where pv.post_id = p.id and pv.user_id = ${viewer}::uuid) as seen,
           exists (select 1 from content.mutes m where m.user_id = ${viewer}::uuid and m.muted_id = p.author_id) as muted
      from content.posts p left join content.members a on a.user_id = p.author_id
     where p.id = ${postId}`;
  if (!r || r.muted) return 0;
  return score(toPost(r), { ...base, seen: new Set(r.seen ? [r.id] : []) }, r.now, c);
}

/** `purge-feed-sessions` (nightly). */
export async function purgeFeedSessions(tx: Tx): Promise<number> {
  return (await tx`delete from content.feed_sessions where created_at < now() - interval '1 day'`).count;
}
