import type { Config } from "../domain/config";
import type { FeedPost } from "../domain/feed";
import type { Db } from "./db";

/**
 * The feed's candidate pool (docs/azure/prd.md, "Hot paths": "Candidate pool rebuilt every 60 s per audience
 * and held in memory; per-viewer scoring in TypeScript"). One query loads every post an audience could show
 * in the window, with everything about it that does not depend on the reader (author facts, survey sums,
 * commenters and whether each is the author's friend, stats, announcement targets). One more query loads the
 * reader: friends, follows, skills, blocks, mutes, seats, hides and views in the window. The visibility rule is
 * then content's `can_view_post` in TypeScript (domain/visibility below), the same rule store/db.ts states in SQL.
 */
export interface PoolPost extends FeedPost {
  pinned_until: Date | null;
  hidden_by_university: boolean;
  /** University announcements: who they reach. */
  announcement: { university_id: string; expires_at: Date; departments: string[]; batches: number[] } | null;
}

export interface Pool {
  posts: PoolPost[];
  /** The database's time when the pool was read. */
  at: Date;
}

export interface Viewer {
  id: string;
  role: string | null;
  university_id: string | null;
  department_id: string | null;
  department_hash: string | null;
  graduation_year: number | null;
  friends: Set<string>;
  follows: Set<string>;
  skills: Set<string>;
  blocked: Set<string>;
  muted: Set<string>;
  hidden: Set<string>;
  seen: Set<string>;
  /** university id → seat role */
  seats: Map<string, string>;
}

export type AudienceKey = { audience: "global" } | { audience: "university"; universityId: string | null };
export const keyOf = (k: AudienceKey) => (k.audience === "global" ? "global" : `u:${k.universityId ?? "none"}`);

interface PoolRow {
  id: string;
  author_id: string;
  university_id: string | null;
  audience: "university" | "global";
  type: string;
  venture_id: string | null;
  society_id: string | null;
  stage: FeedPost["stage"];
  created_at: Date;
  pinned_until: Date | null;
  hidden: boolean;
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
  announcement: { university_id: string; expires_at: string; departments: string[]; batches: number[] } | null;
  now: Date;
}

/** Every post in the audience's window (not held, not removed), newest first, with its reader-free facts. */
export async function loadPool(db: Db, key: AudienceKey, c: Config): Promise<Pool> {
  const w = c["feed.window"];
  const sc = c["feed.score"];
  const scope = key.audience === "global" ? db`p.audience = 'global'` : db`p.university_id = ${key.universityId}::uuid`;
  // Trusted integers from the settings, inlined: as parameters they made the planner treat the window as unknown.
  const days = db.unsafe(String(Math.trunc(w.shipped_age_days)));
  const minChars = db.unsafe(String(Math.trunc(sc.min_comment_chars)));
  const rows = await db<PoolRow[]>`
    with sums as (
      select sc.post_id,
             sum(sc.weighted_ticks) filter (where sc.dimension in ('informative', 'interesting')) as pos,
             sum(sc.weighted_ticks + sc.weighted_crosses) filter (where sc.dimension in ('informative', 'interesting')) as total,
             sum(sc.ticks) filter (where sc.dimension = 'credible') as cred_ticks,
             sum(sc.crosses) filter (where sc.dimension = 'credible') as cred_crosses
        from content.post_survey_counts sc
        join content.posts p on p.id = sc.post_id
       where p.created_at > now() - make_interval(days => ${days}) and ${scope}
       group by sc.post_id),
    talk as (
      select x.post_id, array_agg(exists (select 1 from content.friendships f where f.user_id_a = least(x.author_id, x.post_author) and f.user_id_b = greatest(x.author_id, x.post_author))) as friends
        from (select distinct c.post_id, c.author_id, p.author_id as post_author
                from content.post_comments c join content.posts p on p.id = c.post_id
               where p.created_at > now() - make_interval(days => ${days}) and ${scope}
                 and c.deleted_at is null and c.author_id <> p.author_id and char_length(c.body) >= ${minChars}) x
       group by x.post_id)
    select p.id::text, p.author_id::text, p.university_id::text, p.audience, p.type, p.venture_id::text, p.society_id::text, p.stage, p.created_at,
           p.pinned_until, p.hidden_by_university_at is not null as hidden,
           a.university_id::text as a_university_id, a.department_hash as a_department_hash, a.graduation_year as a_graduation_year,
           coalesce(sk.skills, '{}') as author_skills,
           coalesce(s.pos, 0)::text as quality_pos, coalesce(s.total, 0)::text as quality_total,
           coalesce(s.cred_ticks, 0)::int as credible_ticks, coalesce(s.cred_crosses, 0)::int as credible_crosses,
           coalesce(t.friends, '{}') as commenter_friends,
           coalesce(st.answers, 0) as answers, coalesce(st.positives, 0) as positives, coalesce(st.commenters, 0) as talk_commenters,
           case when am.post_id is not null then jsonb_build_object(
             'university_id', am.university_id, 'expires_at', am.expires_at,
             'departments', coalesce((select jsonb_agg(at.department_id) from content.announcement_targets at where at.post_id = am.post_id and at.department_id is not null), '[]'::jsonb),
             'batches', coalesce((select jsonb_agg(at.batch_year) from content.announcement_targets at where at.post_id = am.post_id and at.batch_year is not null), '[]'::jsonb)) end as announcement,
           now() as now
      from content.posts p
      left join content.members a on a.user_id = p.author_id
      left join lateral (select array_agg(us.skill_id) as skills from content.user_skills us where us.user_id = p.author_id and us.level >= 1) sk on true
      left join sums s on s.post_id = p.id
      left join talk t on t.post_id = p.id
      left join content.post_stats st on st.post_id = p.id
      left join content.announcement_meta am on am.post_id = p.id
     where p.removed_at is null and p.stage <> 'held'
       and p.created_at > now() - make_interval(days => ${days}) and ${scope}
     order by p.created_at desc, p.id desc`;
  return {
    at: rows[0]?.now ?? new Date((await db<{ now: Date }[]>`select now()`)[0]!.now),
    posts: rows.map((r) => ({
      id: r.id,
      author_id: r.author_id,
      university_id: r.university_id,
      audience: r.audience,
      type: r.type,
      venture_id: r.venture_id,
      society_id: r.society_id,
      stage: r.stage,
      created_at: r.created_at,
      pinned_until: r.pinned_until,
      hidden_by_university: r.hidden,
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
      announcement: r.announcement
        ? { university_id: r.announcement.university_id, expires_at: new Date(r.announcement.expires_at), departments: r.announcement.departments, batches: r.announcement.batches }
        : null,
    })),
  };
}

interface ViewerRow {
  role: string | null;
  university_id: string | null;
  department_id: string | null;
  department_hash: string | null;
  graduation_year: number | null;
  friends: string[];
  follows: string[];
  skills: string[];
  blocked: string[];
  muted: string[];
  hidden: string[];
  seen: string[];
  seats: { university_id: string; role: string }[];
  now: Date;
}

/** The reader (one query): facts, edges, seats, and their hides and views among the window's posts. */
export async function loadViewer(db: Db, me: string, c: Config): Promise<{ viewer: Viewer; now: Date }> {
  const days = c["feed.window"].shipped_age_days;
  const [r] = await db<ViewerRow[]>`
    select m.role, m.university_id::text, m.department_id::text, m.department_hash, m.graduation_year,
           coalesce((select array_agg(case when f.user_id_a = x.id then f.user_id_b else f.user_id_a end)::text[]
                       from content.friendships f where f.user_id_a = x.id or f.user_id_b = x.id), '{}') as friends,
           coalesce((select array_agg(vf.venture_id)::text[] from content.venture_follows vf where vf.user_id = x.id), '{}') as follows,
           coalesce((select array_agg(s.skill_id) from content.user_skills s where s.user_id = x.id and s.level >= 1), '{}') as skills,
           coalesce((select array_agg(case when b.blocker_id = x.id then b.blocked_id else b.blocker_id end)::text[]
                       from content.blocks b where b.blocker_id = x.id or b.blocked_id = x.id), '{}') as blocked,
           coalesce((select array_agg(mu.muted_id)::text[] from content.mutes mu where mu.user_id = x.id), '{}') as muted,
           coalesce((select array_agg(h.post_id)::text[] from content.post_hides h where h.user_id = x.id), '{}') as hidden,
           coalesce((select array_agg(v.post_id)::text[] from content.post_views v
                      where v.user_id = x.id and v.first_seen_at > now() - make_interval(days => ${days}::int) - interval '1 day'), '{}') as seen,
           coalesce((select jsonb_agg(jsonb_build_object('university_id', u.university_id, 'role', u.role)) from content.uni_seats u where u.user_id = x.id), '[]'::jsonb) as seats,
           now() as now
      from (select ${me}::uuid as id) x left join content.members m on m.user_id = x.id`;
  return {
    now: r!.now,
    viewer: {
      id: me,
      role: r!.role,
      university_id: r!.university_id,
      department_id: r!.department_id,
      department_hash: r!.department_hash,
      graduation_year: r!.graduation_year,
      friends: new Set(r!.friends),
      follows: new Set(r!.follows),
      skills: new Set(r!.skills),
      blocked: new Set(r!.blocked),
      muted: new Set(r!.muted),
      hidden: new Set(r!.hidden),
      seen: new Set(r!.seen),
      seats: new Map(r!.seats.map((s) => [s.university_id, s.role])),
    },
  };
}

/** content's `can_view_post` over a pool post (the rule in store/db.ts, in TypeScript). Removed and held posts never enter the pool. */
export function visibleIn(p: PoolPost, v: Viewer, now: Date): boolean {
  if (p.author_id === v.id) return true;
  if (p.hidden_by_university) return p.university_id !== null && ["owner", "admin"].includes(v.seats.get(p.university_id) ?? "");
  if (v.blocked.has(p.author_id)) return false;
  if (p.audience !== "global" && p.university_id !== v.university_id) return false;
  if (p.type === "announcement" && p.audience !== "global") {
    const a = p.announcement;
    if (!a || a.university_id !== v.university_id) return false;
    if (v.seats.has(a.university_id)) return true;
    return (
      a.expires_at > now &&
      (v.role === "student" || v.role === "faculty") &&
      (a.departments.length === 0 || (v.department_id !== null && a.departments.includes(v.department_id))) &&
      (a.batches.length === 0 || v.role === "faculty" || (v.graduation_year !== null && a.batches.includes(v.graduation_year)))
    );
  }
  return true;
}

/** Pools held in memory per audience for `ttlMs`; a write on this replica drops the pool it touched. */
export class PoolCache {
  private pools = new Map<string, { at: number; pool: Promise<Pool> }>();
  constructor(private readonly ttlMs = 60_000) {}

  get(db: Db, key: AudienceKey, c: Config): Promise<Pool> {
    const k = keyOf(key);
    const hit = this.pools.get(k);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.pool;
    const pool = loadPool(db, key, c);
    this.pools.set(k, { at: Date.now(), pool });
    pool.catch(() => this.pools.delete(k));
    return pool;
  }

  /** A post was written or removed on this replica: the next read rebuilds (others catch up within the lifetime). */
  clear(): void {
    this.pools.clear();
  }
}
