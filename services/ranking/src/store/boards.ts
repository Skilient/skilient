import { createHash } from "node:crypto";
import { pktDate } from "../domain/numbers";
import { nextTierRequirements, type TierFacts } from "../domain/tiers";
import { refused } from "../refusals";
import { num, type Db } from "./db";
import { formulaInForce } from "./formula";

/**
 * Boards, tiers and the score page, ported from _leaderboard.sql and _student_portal.sql's board. Everything
 * reads the published scores of the nightly run, so ranks and tiers don't move between runs; others see rank,
 * tier and weekly change, never points. Names and faces are people's (ProfileCards, which also applies
 * can_view_profile to the avatar): these return user ids.
 */
type Json = Record<string, unknown>;

/** `require_user()`: signed in and onboarded (people's copy). */
export async function requireUser(db: Db, me: string | null): Promise<string> {
  if (!me) throw refused("not_signed_in");
  const [m] = await db`select 1 from ranking.members where user_id = ${me} and onboarding_complete`;
  if (!m) throw refused("finish_onboarding");
  return me;
}

/** people's department hash: sha256 of the department text (the board's department filter matches it exactly). */
export const departmentHash = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const cleanDepartment = (d: string | null | undefined) => (d === null || d === undefined || d.trim() === "" ? null : d.trim());

export interface BoardRow {
  user_id: string;
  university_id: string | null;
  total: string;
  tier: string | null;
  rank: number;
  previous_rank: number | null;
  place: number;
}

/**
 * `board(scope, department, batch)`: everyone on a board, ranked (ties share a rank), with their rank in the same
 * population at the last Sunday snapshot. University scope is the reader's university, optionally one
 * department and one batch; deleting accounts, opted-out and unranked students are left out, and graduates
 * leave the university boards 12 months after graduating.
 */
export function board(db: Db, me: string, scope: string, department: string | null, batch: number | null) {
  if (scope !== "university" && scope !== "global") throw refused("choose_scope");
  const dept = cleanDepartment(department);
  const hash = dept === null ? null : departmentHash(dept);
  const today = pktDate(new Date());
  return db<BoardRow[]>`
    with me as (select university_id from ranking.members where user_id = ${me}),
    wk as (select max(week) as week from ranking.ranking_snapshots where week < ${today}::date),
    pop as (
      select s.user_id, s.total, s.tier, p.university_id
        from ranking.ranking_scores s join ranking.members p on p.user_id = s.user_id
       where s.ranked and not p.leaderboard_opt_out and p.role = 'student' and p.onboarding_complete and p.status <> 'deleting'
         and (${scope} = 'global'
              or (p.university_id = (select university_id from me)
                  and (p.status <> 'graduate' or p.graduated_at > now() - interval '12 months')
                  and (${hash}::text is null or p.department_hash = ${hash}::text)
                  and (${batch}::int is null or p.graduation_year = ${batch}::int)))
    ),
    now_ranked as (
      select pop.*, rank() over (order by pop.total desc) as r, row_number() over (order by pop.total desc, pop.user_id) as pos from pop
    ),
    prior as (
      select n.user_id, rank() over (order by n.total desc) as r
        from ranking.ranking_snapshots n join pop on pop.user_id = n.user_id
       where n.week = (select week from wk) and n.ranked
    )
    select nr.user_id::text, nr.university_id::text, nr.total::text, nr.tier, nr.r::int as rank, b.r::int as previous_rank, nr.pos::int as place
      from now_ranked nr left join prior b on b.user_id = nr.user_id
     order by nr.pos`;
}

const blockedWith = (db: Db, me: string) =>
  db<{ other: string }[]>`
    select blocked_id::text as other from ranking.blocks where blocker_id = ${me}
    union select blocker_id::text from ranking.blocks where blocked_id = ${me}`.then((r) => new Set(r.map((x) => x.other)));

/** `leaderboard(scope, department, batch, after)`: one page (50 after a position); blocked people skipped (ranks keep gaps). */
export async function leaderboard(db: Db, meId: string | null, scope: string, department: string | null, batch: number | null, after: number) {
  const me = await requireUser(db, meId);
  const rows = await board(db, me, scope, department, batch);
  const blocked = await blockedWith(db, me);
  return rows
    .filter((b) => b.place > Math.max(after, 0) && (b.user_id === me || !blocked.has(b.user_id)))
    .slice(0, 50)
    .map((b) => ({ ...b, weekly_change: b.previous_rank === null ? null : b.previous_rank - b.rank, is_me: b.user_id === me }));
}

/** `leaderboard_me(scope, department, batch)`: the reader's own place, pinned above the board. */
export async function leaderboardMe(db: Db, meId: string | null, scope: string, department: string | null, batch: number | null) {
  const me = await requireUser(db, meId);
  const [p] = await db<{ opted_out: boolean }[]>`select leaderboard_opt_out as opted_out from ranking.members where user_id = ${me}`;
  const [s] = await db<{ ranked: boolean; total: string; tier: string | null; held: boolean }[]>`
    select ranked, total::text, tier, held from ranking.ranking_scores where user_id = ${me}`;
  const rows = await board(db, me, scope, department, batch);
  const mine = rows.find((r) => r.user_id === me);
  return {
    opted_out: p!.opted_out,
    ranked: s?.ranked ?? false,
    scored: Boolean(s),
    total: s ? Number(s.total) : null,
    tier: s?.tier ?? null,
    held: s?.held ?? false,
    rank: mine?.rank ?? null,
    place: mine?.place ?? null,
    weekly_change: mine && mine.previous_rank !== null ? mine.previous_rank - mine.rank : null,
    size: rows.length,
  };
}

/** `leaderboard_filters()`: departments (as people's hashes) and batches among the reader's university's students. */
export async function leaderboardFilters(db: Db, me: string | null) {
  if (!me) throw refused("not_signed_in");
  const [r] = await db<{ departments: string[]; batches: number[] }[]>`
    with u as (select university_id from ranking.members where user_id = ${me})
    select coalesce((select array_agg(distinct m.department_hash order by m.department_hash) from ranking.members m
                      where m.university_id = (select university_id from u) and m.department_hash is not null and m.role = 'student'), '{}') as departments,
           coalesce((select array_agg(distinct m.graduation_year order by m.graduation_year desc) from ranking.members m
                      where m.university_id = (select university_id from u) and m.graduation_year is not null and m.role = 'student'), '{}') as batches`;
  return r!;
}

/** `tiers_for(ids)`: the tier of each person on a page of cards (at most 200), for a signed-in reader; blocked people left out. */
export async function tiersFor(db: Db, meId: string | null, ids: readonly string[]) {
  const me = await requireUser(db, meId);
  if (ids.length > 200) throw refused("too_many_people");
  return db<{ user_id: string; tier: string }[]>`
    select s.user_id::text, s.tier from ranking.ranking_scores s
     where s.user_id = any(${[...ids]}::uuid[]) and s.ranked and s.tier is not null
       and not exists (select 1 from ranking.blocks b where (b.blocker_id = ${me} and b.blocked_id = s.user_id) or (b.blocker_id = s.user_id and b.blocked_id = ${me}))
     order by s.user_id`;
}

/** Tiers for services that show them without a reader (the CV, talent search, /ops): one batch, no block filter. */
export function tiersOf(db: Db, ids: readonly string[]) {
  return db<{ user_id: string; tier: string | null; ranked: boolean; percentile: number | null }[]>`
    select user_id::text, tier, ranked, percentile from ranking.ranking_scores where user_id = any(${[...ids]}::uuid[]) order by user_id`;
}

/** The published score row's tier inputs, for next_tier_requirements. */
async function tierInputs(db: Db, user: string) {
  const [s] = await db<{ ranked: boolean; tier: string | null; total: string; percentile: number | null; facts: TierFacts | null }[]>`
    select ranked, tier, total::text, percentile, components->'facts' as facts from ranking.ranking_scores where user_id = ${user}`;
  return s ? { ranked: s.ranked, tier: s.tier, total: Number(s.total), percentile: s.percentile, facts: s.facts ?? {} } : null;
}

export async function nextTier(db: Db, user: string) {
  const f = await formulaInForce(db);
  return nextTierRequirements(await tierInputs(db, user), f.value);
}

/**
 * `my_score()`: everything /me/score shows the owner: the published components, the change since the last
 * snapshot, decay, the exam pause, a held gain and what the next tier needs. Evidence names: skill labels come
 * from ranking's copy; the rest are other services' (venture titles, people, credential and post text, Record
 * entries), so `evidence` lists their ids for web to read from their owners in parallel (one batch each).
 */
export async function myScore(db: Db, meId: string | null): Promise<Json> {
  const me = await requireUser(db, meId);
  const f = await formulaInForce(db);
  const [s] = await db<
    {
      formula_version: number;
      components: Json;
      total: string;
      proof: string;
      momentum: string;
      adjustments: string;
      ranked: boolean;
      tier: string | null;
      tier_met: string | null;
      percentile: number | null;
      below_since: string | null;
      held: boolean;
      held_total: string | null;
      published_at: Date;
      facts: TierFacts | null;
    }[]
  >`
    select formula_version, components, total::text, proof::text, momentum::text, adjustments::text, ranked, tier, tier_met, percentile,
           below_since::text, held, held_total::text, published_at, components->'facts' as facts
      from ranking.ranking_scores where user_id = ${me}`;
  if (!s) return { scored: false, next: nextTierRequirements(null, f.value), formula_version: f.version };
  const today = pktDate(new Date());
  const [week] = await db<{ week: string; total: string; components: Json; tier: string | null }[]>`
    select week::text, total::text, components, tier from ranking.ranking_snapshots where user_id = ${me} and week < ${today}::date order by week desc limit 1`;
  const [exam] = await db<{ starts_on: string; ends_on: string }[]>`
    select e.starts_on::text, e.ends_on::text from ranking.exam_periods e join ranking.members m on m.university_id = e.university_id
     where m.user_id = ${me} and ${today}::date between e.starts_on and e.ends_on limit 1`;
  const c = s.components;
  const items = (path: string[]) => {
    let v: unknown = c;
    for (const k of path) v = (v as Json | undefined)?.[k];
    return Array.isArray(v) ? (v as Json[]) : [];
  };
  const ids = (list: Json[], key: string) => [...new Set(list.map((x) => x[key] as string))].sort();
  const skillIds = [...new Set([...ids(items(["skills", "items"]), "skill_id"), ...ids(items(["endorsements", "items"]), "skill_id")])];
  const labels = await db<{ skill_id: string; label: string }[]>`
    select distinct on (skill_id) skill_id, label from ranking.user_skills where skill_id = any(${skillIds}::text[]) and label is not null order by skill_id`;
  return {
    scored: true,
    formula_version: s.formula_version,
    components: c,
    total: Number(s.total),
    proof: Number(s.proof),
    momentum: Number(s.momentum),
    adjustments: Number(s.adjustments),
    ranked: s.ranked,
    tier: s.tier,
    tier_met: s.tier_met,
    percentile: s.percentile,
    below_since: s.below_since,
    held: s.held,
    held_total: num(s.held_total),
    published_at: s.published_at.toISOString(),
    last_week: week ? { week: week.week, total: Number(week.total), components: week.components, tier: week.tier } : null,
    exam: exam ?? null,
    next: nextTierRequirements({ ranked: s.ranked, tier: s.tier, total: Number(s.total), percentile: s.percentile, facts: s.facts ?? {} }, f.value),
    names: { skills: Object.fromEntries(labels.map((l) => [l.skill_id, l.label])) },
    evidence: {
      ventures: ids(items(["work", "ventures"]), "venture_id"),
      people: ids(items(["endorsements", "items"]), "endorser_id"),
      credentials: ids(items(["credentials", "items"]), "id"),
      record: ids(items(["record", "items"]), "id"),
      posts: ids(items(["momentum", "content", "posts"]), "post_id"),
    },
  };
}
