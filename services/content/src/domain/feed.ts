import type { Config } from "./config";

/**
 * The ranked feed's rules, pure (ported from feed_score, post_quality, in_seed_audience, compute_stage,
 * nonfriend_commenters and build_feed's two steps). The store loads posts and the reader's context in one
 * query each; everything here is arithmetic over what was loaded (docs/azure/prd.md, "Hot paths": per-viewer
 * scoring in TypeScript over at most 300 candidates).
 */
export type Stage = "seed" | "limited" | "full" | "global_boost" | "demoted" | "held";
export const FILTERS = ["all", "ventures", "events", "announcements", "shipped", "societies"] as const;
export type Filter = (typeof FILTERS)[number];

export interface AuthorFacts {
  university_id: string | null;
  department_hash: string | null;
  graduation_year: number | null;
}

/** One post with the facts that do not depend on the reader. */
export interface FeedPost {
  id: string;
  author_id: string;
  university_id: string | null;
  audience: "university" | "global";
  type: string;
  venture_id: string | null;
  society_id: string | null;
  stage: Stage;
  created_at: Date;
  author: AuthorFacts;
  /** Author's skills at level 1 or more. */
  author_skills: readonly string[];
  /** Weighted ticks and ticks+crosses on Informative and Interesting. */
  quality_pos: number;
  quality_total: number;
  credible_ticks: number;
  credible_crosses: number;
  /** Distinct qualifying commenters (not the author, not deleted, long enough), each with "friend of the author". */
  commenters: readonly { friend: boolean }[];
  answers: number;
  positives: number;
  talk_commenters: number;
}

export interface Reader {
  id: string;
  university_id: string | null;
  department_hash: string | null;
  graduation_year: number | null;
  friends: ReadonlySet<string>;
  follows: ReadonlySet<string>;
  skills: ReadonlySet<string>;
  seen: ReadonlySet<string>;
}

export const matchesFilter = (filter: Filter, p: { type: string; society_id: string | null }): boolean =>
  filter === "all"
    ? true
    : filter === "ventures"
      ? p.type === "invite"
      : filter === "events"
        ? p.type === "event"
        : filter === "announcements"
          ? p.type === "announcement"
          : filter === "shipped"
            ? p.type === "shipped"
            : p.society_id !== null;

/** `post_quality`: Bayesian average of weighted positives, reduced by the Credible negative rate. */
export function quality(p: Pick<FeedPost, "quality_pos" | "quality_total" | "credible_ticks" | "credible_crosses">, c: Config): number {
  const sc = c["feed.score"];
  const answered = p.credible_ticks + p.credible_crosses;
  const credRate = answered > 0 ? p.credible_crosses / answered : 0;
  return ((p.quality_pos + sc.bayes_k * sc.platform_mean) / (p.quality_total + sc.bayes_k)) * (1 - Math.min(sc.credible_penalty_max, sc.credible_penalty_factor * credRate));
}

/** `in_seed_audience`. */
export function inSeedAudience(p: FeedPost, r: Reader): boolean {
  const a = p.author;
  return (
    p.author_id === r.id ||
    r.friends.has(p.author_id) ||
    (a.department_hash !== null &&
      a.department_hash === r.department_hash &&
      a.graduation_year === r.graduation_year &&
      a.university_id === r.university_id) ||
    (p.venture_id !== null && r.follows.has(p.venture_id)) ||
    (p.audience === "global" && a.university_id === r.university_id)
  );
}

/** `feed_score(post, viewer)`; muted authors are filtered out before scoring. */
export function score(p: FeedPost, r: Reader, now: Date, c: Config): number {
  const sc = c["feed.score"];
  const rc = c["feed.relevance"];
  const pc = c["feed.placement"];
  const q = quality(p, c);
  const commenters = p.commenters.reduce((sum, x) => sum + (x.friend ? sc.friend_commenter : 1), 0);
  const e = sc.conversation * Math.log(1 + commenters);
  let rel = 1;
  if (r.friends.has(p.author_id)) rel *= rc.friend;
  if (p.venture_id !== null && r.follows.has(p.venture_id)) rel *= rc.follows_venture;
  if (p.author.department_hash !== null && p.author.department_hash === r.department_hash && p.author.graduation_year === r.graduation_year) rel *= rc.same_program;
  if (p.author.graduation_year !== null && p.author.graduation_year === r.graduation_year) rel *= rc.same_batch;
  const overlap = p.author_skills.filter((s) => r.skills.has(s)).length;
  rel *= Math.min(rc.skills_max, 1 + rc.skills_step * overlap);
  rel = Math.min(rel, rc.cap);
  const d = r.seen.has(p.id) ? c["feed.diversity"].seen : 1;
  const age = Math.max((now.getTime() - p.created_at.getTime()) / 3_600_000, 0);
  let s = ((sc.base + q) * (1 + e) * rel * d) / Math.pow(age + 2, sc.gravity);
  if (p.stage === "limited" && !inSeedAudience(p, r)) s *= pc.limited_outside_seed;
  else if (p.stage === "global_boost") s *= pc.global_boost;
  else if (p.stage === "demoted") s *= pc.demoted;
  if (p.type === "shipped" && p.created_at.getTime() > now.getTime() - pc.shipped_boost_hours * 3_600_000) s *= pc.shipped_boost;
  return s;
}

/** What compute_stage reads about one post. */
export interface StageInputs {
  stage: Stage;
  type: string;
  audience: string;
  created_at: Date;
  reports: number;
  views: number;
  hides: number;
  answers: number;
  positives: number;
  commenters: number;
  commenter_universities: number;
  credible_ticks: number;
  credible_crosses: number;
  /** Distinct qualifying commenters who are not the author's friends. */
  nonfriend_commenters: number;
}

/** `compute_stage`. */
export function computeStage(p: StageInputs, now: Date, c: Config): Stage {
  const s = c["feed.stages"];
  if (p.reports >= s.held_reports) return "held";
  const credAnswers = p.credible_ticks + p.credible_crosses;
  if (
    (credAnswers >= s.demote_answers && p.credible_crosses / credAnswers >= s.demote_credible_negative) ||
    (p.views >= s.demote_min_views && p.hides / p.views >= s.demote_hide_rate)
  )
    return "demoted";
  const positive = p.answers > 0 ? p.positives / p.answers : 0;
  if (
    p.audience === "global" &&
    ((p.answers >= s.boost_answers && positive >= s.boost_positive) || (p.commenters >= s.boost_commenters && p.commenter_universities >= s.boost_universities))
  )
    return "global_boost";
  if (p.stage === "full" || p.stage === "global_boost" || p.type === "shipped") return "full";
  if ((p.answers >= s.full_answers && positive >= s.full_positive) || p.nonfriend_commenters >= s.full_commenters) return "full";
  if (p.created_at.getTime() > now.getTime() - s.seed_hours * 3_600_000 && p.views < s.seed_views) return "seed";
  return "limited";
}

/**
 * build_feed step 1 (decisions 2026-11-05): when more posts are eligible than score_pool, keep the reader's
 * own, friends' and followed ventures' posts (the newest score_pool), plus the newest and the most-discussed
 * score_pool / 2 each. `eligible` is newest first.
 */
export function scorePool(eligible: readonly FeedPost[], r: Reader, pool: number): FeedPost[] {
  if (eligible.length <= pool) return [...eligible];
  const near = (p: FeedPost) => p.author_id === r.id || r.friends.has(p.author_id) || (p.venture_id !== null && r.follows.has(p.venture_id));
  const keep = new Set<string>();
  let nearCount = 0;
  eligible.forEach((p, i) => {
    if (near(p) && ++nearCount <= pool) keep.add(p.id);
    if (i < Math.floor(pool / 2)) keep.add(p.id);
  });
  const talk = (p: FeedPost) => p.answers + p.positives + 2 * p.talk_commenters;
  [...eligible]
    .sort((a, b) => talk(b) - talk(a) || b.created_at.getTime() - a.created_at.getTime())
    .slice(0, Math.floor(pool / 2))
    .forEach((p) => keep.add(p.id));
  return eligible.filter((p) => keep.has(p.id));
}

export interface Scored {
  id: string;
  author_id: string;
  score: number;
  created_at: Date;
}

/**
 * build_feed step 2's ordering: the best adjusted score, avoiding the same author twice in a row when
 * possible and damping an author's further posts on the same page; every `every`th slot takes the next
 * exploration post while any are left.
 */
export function orderFeed(candidates: readonly Scored[], explore: readonly string[], c: Config): string[] {
  const pageSize = c["feed.diversity"].page_size;
  const same = c["feed.diversity"].same_author_page;
  const every = c["feed.window"].exploration_every;
  const left = [...candidates];
  const out: string[] = [];
  let lastAuthor: string | null = null;
  let pageAuthors = new Map<string, number>();
  let ix = 0;
  for (let i = 1; ; i++) {
    if (i % every === 0 && ix < explore.length) {
      out.push(explore[ix++]!);
      continue;
    }
    if (left.length === 0) break;
    let best = 0;
    const key = (x: Scored) => [x.author_id === lastAuthor ? 1 : 0, -(x.score * Math.pow(same, pageAuthors.get(x.author_id) ?? 0)), -x.created_at.getTime()];
    for (let j = 1; j < left.length; j++) {
      const a = key(left[j]!);
      const b = key(left[best]!);
      if (a[0]! < b[0]! || (a[0] === b[0] && (a[1]! < b[1]! || (a[1] === b[1] && a[2]! < b[2]!)))) best = j;
    }
    const pick = left.splice(best, 1)[0]!;
    out.push(pick.id);
    lastAuthor = pick.author_id;
    if (out.length % pageSize === 0) pageAuthors = new Map();
    else pageAuthors.set(pick.author_id, (pageAuthors.get(pick.author_id) ?? 0) + 1);
  }
  return out;
}

/** A feed cursor is "<session id>:<offset>". */
export function parseCursor(cursor: string): { session: string; offset: number } | null {
  const [session, offset] = cursor.split(":");
  if (!session || !/^[0-9a-f-]{36}$/i.test(session) || offset === undefined || !/^-?\d+$/.test(offset)) return null;
  return { session, offset: Math.max(Number(offset), 0) };
}
