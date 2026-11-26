import { refused, refusedWith } from "../refusals";
import { blockedBetween, canViewVenture, requireUser, type Db, type Tx } from "./db";
import { publish } from "./publish";
import { mySkillProofs } from "./skills";

/**
 * Role paths (PRD 5.30), ported from _paths_tasks.sql: a path is the ordered skills students at Shine or above
 * proved for a role (`data`), or the seed order until enough of them exist (`starter`). Followed paths drive the
 * next square on the student's home (people's `paths.next` fact).
 */
const TIERS = ["raw", "spark", "flare", "shine", "radiant", "luminary"];

async function seed(db: Db): Promise<{ roles: { role: string; name: string; pictogram: string; skills: string[] }[]; min_seniors?: number; min_share?: number; min_tier?: string; max_follows?: number } | null> {
  const [r] = await db<{ value: never }[]>`select value from work.config where key = 'paths.seed'`;
  return r?.value ?? null;
}

/** `compute_paths()` (weekly): returns how many paths come from data. */
export async function computePaths(tx: Tx): Promise<number> {
  const cfg = await seed(tx);
  if (!cfg) return 0;
  const min = cfg.min_seniors ?? 10;
  const share = cfg.min_share ?? 0.6;
  const tiers = TIERS.slice(TIERS.indexOf(cfg.min_tier ?? "shine"));
  let fromData = 0;
  const roles: string[] = [];
  for (const [i, r] of cfg.roles.entries()) {
    roles.push(r.role);
    const live = new Set((await tx<{ id: string }[]>`select id from work.skills where id = any(${r.skills}::text[]) and retired_at is null`).map((s) => s.id));
    const skills = r.skills.filter((s) => live.has(s));
    const seniors = tx`
      select u.user_id, min(u.l2_at) as first_at
        from work.user_skills u
        join work.ranking_tiers t on t.user_id = u.user_id and t.ranked and t.tier = any(${tiers}::text[])
        join work.members p on p.user_id = u.user_id and p.role = 'student' and coalesce(p.status, '') <> 'deleting'
       where u.skill_id = any(${skills}::text[]) and u.level >= 2 and u.l2_at is not null
       group by u.user_id
      having count(*) >= ceil(${share}::numeric * ${skills.length})`;
    const [n] = await tx<{ n: number }[]>`select count(*)::int as n from (${seniors}) q`;
    const data = n!.n >= min;
    await tx`
      insert into work.paths (role, name, pictogram, position, source, seniors, computed_at)
      values (${r.role}, ${r.name}, ${r.pictogram}, ${i + 1}, ${data ? "data" : "starter"}, ${n!.n}, now())
      on conflict (role) do update set name = excluded.name, pictogram = excluded.pictogram, position = excluded.position, source = excluded.source,
        seniors = excluded.seniors, computed_at = excluded.computed_at`;
    await tx`delete from work.path_skills where role = ${r.role}`;
    if (data) {
      fromData++;
      await tx`
        insert into work.path_skills (role, skill_id, position, after_days)
        with q as (${seniors}),
        offs as (
          select u.skill_id, percentile_cont(0.5) within group (order by extract(epoch from u.l2_at - q.first_at) / 86400.0) as med
            from work.user_skills u join q on q.user_id = u.user_id
           where u.skill_id = any(${skills}::text[]) and u.level >= 2 and u.l2_at is not null group by u.skill_id
        ),
        ordered as (
          select s.skill_id, o.med, row_number() over (order by o.med nulls last, s.o) as pos
            from unnest(${skills}::text[]) with ordinality as s(skill_id, o) left join offs o on o.skill_id = s.skill_id
        ),
        lagged as (select skill_id, med, pos, lag(med) over (order by pos) as prev from ordered)
        select ${r.role}, skill_id, pos, case when pos > 1 and med is not null and prev is not null then greatest(0, round(med - prev))::int end from lagged`;
    } else {
      await tx`insert into work.path_skills (role, skill_id, position) select ${r.role}, s.skill_id, s.o from unnest(${skills}::text[]) with ordinality as s(skill_id, o)`;
    }
  }
  await tx`delete from work.paths where not (role = any(${roles}::text[]))`;
  return fromData;
}

export interface Step {
  skill_id: string;
  name: string;
  pos: number;
  after_days: number | null;
  prev_name: string | null;
  state: "proved" | "in_progress" | "next" | "later";
  proved_at: Date | null;
  level: number;
  attempt_id: string | null;
  attempt_status: string | null;
}

/** `path_steps(user, role)`: each square's state for the student. */
export async function pathSteps(db: Db, user: string, role: string): Promise<Step[]> {
  return db<Step[]>`
    with base as (
      select ps.skill_id, k.name, ps.position::int as pos, ps.after_days, lag(k.name) over (order by ps.position) as prev_name,
             least(case when u.level >= 2 then coalesce(u.l2_at, u.updated_at) end,
                   (select min(a.done_at) from work.task_attempts a where a.user_id = ${user} and a.skill_id = ps.skill_id and a.status = 'done')) as proved_at,
             coalesce(u.level, 0)::int as level, o.id::text as attempt_id, o.status as attempt_status
        from work.path_skills ps
        join work.skills k on k.id = ps.skill_id
        left join work.user_skills u on u.user_id = ${user} and u.skill_id = ps.skill_id
        left join lateral (select a.id, a.status from work.task_attempts a where a.user_id = ${user} and a.skill_id = ps.skill_id
                             and a.status not in ('done', 'abandoned') order by a.started_at desc limit 1) o on true
       where ps.role = ${role}
    ), st as (
      select b.*, case when b.proved_at is not null then 'proved' when b.attempt_id is not null then 'in_progress' end as s0 from base b
    )
    select skill_id, name, pos, after_days, prev_name,
           coalesce(s0, case when pos = min(pos) filter (where s0 is null) over () then 'next' else 'later' end) as state,
           proved_at, level, attempt_id, attempt_status
      from st order by pos`;
}

async function maxFollows(db: Db): Promise<number> {
  return (await seed(db))?.max_follows ?? 2;
}

/** `my_paths()`: the paths with progress, open tasks and review offers (student names from people). */
export async function myPaths(tx: Tx, meId: string | null) {
  const me = await requireUser(tx, meId);
  const cfg = await seed(tx);
  const paths = await tx<{ role: string; name: string; pictogram: string; source: string; seniors: number; following: boolean }[]>`
    select p.role, p.name, p.pictogram, p.source, p.seniors, f.user_id is not null as following
      from work.paths p left join work.path_follows f on f.role = p.role and f.user_id = ${me.id}
     order by f.created_at nulls last, p.position`;
  const roles = [];
  for (const p of paths) {
    const steps = await pathSteps(tx, me.id, p.role);
    const next = steps.find((s) => s.state === "next");
    roles.push({ ...p, seniors: p.source === "data" ? p.seniors : null, total: steps.length, proved: steps.filter((s) => s.state === "proved").length, next_skill: next?.skill_id ?? null, next_name: next?.name ?? null });
  }
  const tasks = await tx<{ id: string; title: string; skill: string; status: string; started_at: Date }[]>`
    select a.id::text, t.title, k.name as skill, a.status, a.started_at from work.task_attempts a join work.proof_tasks t on t.id = a.task_id join work.skills k on k.id = a.skill_id
     where a.user_id = ${me.id} and a.status not in ('done', 'abandoned') order by a.started_at desc`;
  const reviews = await tx<{ id: string; status: string; title: string; skill: string; student_id: string; offered_at: Date }[]>`
    select r.id::text, r.status, t.title, k.name as skill, a.user_id::text as student_id, r.offered_at
      from work.task_reviews r join work.task_attempts a on a.id = r.attempt_id join work.proof_tasks t on t.id = a.task_id join work.skills k on k.id = a.skill_id
     where r.reviewer_id = ${me.id} and r.status in ('offered', 'accepted') order by r.offered_at desc`;
  const [weekly] = await tx<{ n: number | null }[]>`select (value ->> 'reviews_week')::int as n from work.config where key = 'tasks.limits'`;
  const [used] = await tx<{ n: number }[]>`
    select count(*)::int as n from work.task_reviews r where r.reviewer_id = ${me.id} and r.status in ('accepted', 'confirmed', 'needs_changes') and r.responded_at > now() - interval '7 days'`;
  const [gh] = await tx`select 1 from work.github_accounts g where g.user_id = ${me.id} and g.revoked_at is null`;
  return {
    maxFollows: cfg?.max_follows ?? 2,
    minSeniors: cfg?.min_seniors ?? 10,
    githubConnected: !!gh,
    roles,
    tasks,
    reviews,
    reviewsLeft: Math.max(0, (weekly?.n ?? 5) - used!.n),
  };
}

/** `path_view(role)`. */
export async function pathView(tx: Tx, meId: string | null, role: string) {
  const me = await requireUser(tx, meId);
  const [p] = await tx<{ role: string; name: string; pictogram: string; source: string; seniors: number; computed_at: Date | null; following: boolean }[]>`
    select p.role, p.name, p.pictogram, p.source, p.seniors, p.computed_at,
           exists (select 1 from work.path_follows f where f.user_id = ${me.id} and f.role = p.role) as following
      from work.paths p where p.role = ${role}`;
  if (!p) throw refused("path_not_found");
  const steps = await pathSteps(tx, me.id, role);
  return { ...p, seniors: p.source === "data" ? p.seniors : null, steps };
}

/** `follow_path(role, follow)`: up to `max_follows`; the next square follows (people's `paths.next`). */
export async function followPath(tx: Tx, meId: string | null, role: string, follow: boolean): Promise<void> {
  const me = await requireUser(tx, meId);
  const [p] = await tx`select 1 from work.paths where role = ${role}`;
  if (!p) throw refused("path_not_found");
  if (!follow) {
    await tx`delete from work.path_follows where user_id = ${me.id} and role = ${role}`;
  } else {
    await tx`select pg_advisory_xact_lock(hashtextextended(${"path_follows:" + me.id}, 0))`;
    const [already] = await tx`select 1 from work.path_follows where user_id = ${me.id} and role = ${role}`;
    if (!already) {
      const max = await maxFollows(tx);
      const [n] = await tx<{ n: number }[]>`select count(*)::int as n from work.path_follows where user_id = ${me.id}`;
      if (n!.n >= max) throw refusedWith("paths_max", max);
      await tx`insert into work.path_follows (user_id, role) values (${me.id}, ${role})`;
    }
  }
  await refreshNextSquare(tx, [me.id]);
}

/**
 * people's `paths.next` fact (next_best_action's path line): the next square on the first path the student
 * follows, or none. Published after follows change and after the levels or tasks move.
 */
export async function refreshNextSquare(tx: Tx, userIds: readonly string[]): Promise<void> {
  const events = [];
  for (const user of [...new Set(userIds)].sort()) {
    const [f] = await tx<{ role: string; name: string }[]>`
      select f.role, p.name from work.path_follows f join work.paths p on p.role = f.role where f.user_id = ${user} order by f.created_at, f.role limit 1`;
    const next = f ? (await pathSteps(tx, user, f.role)).find((s) => s.state === "next") : undefined;
    events.push({
      type: "fact.value_changed",
      subjects: [user],
      payload: { user_id: user, key: "paths.next", value: f && next ? { role: f.role, path_label: f.name, skill_id: next.skill_id, skill_label: next.name } : null },
    });
  }
  await publish(tx, events);
}

/** `path_skill_drawer(skill, role)`: why the square, the proofs, the tasks, swap teachers and openings for it. */
export async function pathSkillDrawer(tx: Tx, meId: string | null, skill: string, role: string | null) {
  const me = await requireUser(tx, meId);
  const [k] = await tx<{ id: string; name: string; category: string }[]>`select id, name, category from work.skills where id = ${skill}`;
  if (!k) throw refused("skill_not_found");
  let why = null;
  let state: string | null = null;
  if (role) {
    const [p] = await tx<{ name: string; source: string; seniors: number; after_days: number | null }[]>`
      select p.name, p.source, p.seniors, (select ps.after_days from work.path_skills ps where ps.role = p.role and ps.skill_id = ${skill}) as after_days
        from work.paths p where p.role = ${role}`;
    const step = (await pathSteps(tx, me.id, role)).find((s) => s.skill_id === skill);
    state = step?.state ?? null;
    if (p) why = { path: p.name, source: p.source, seniors: p.source === "data" ? p.seniors : null, position: step?.pos ?? null, prev: step?.prev_name ?? null, after_days: p.after_days };
  }
  const [lvl] = await tx<{ level: number }[]>`select level from work.user_skills where user_id = ${me.id} and skill_id = ${skill}`;
  const evidence = (await mySkillProofs(tx, me.id, skill)).slice(0, 8);
  const [commits] = await tx<{ n: number }[]>`select count(*)::int as n from work.skill_evidence where user_id = ${me.id} and skill_id = ${skill}`;
  const tasks = await tx<{ id: string; title: string; difficulty: string; attempt_id: string | null; attempt_status: string | null }[]>`
    select t.id::text, t.title, t.difficulty, o.id::text as attempt_id, o.status as attempt_status
      from work.proof_tasks t
      left join lateral (select a.id, a.status from work.task_attempts a where a.user_id = ${me.id} and a.task_id = t.id and a.status <> 'abandoned' order by a.started_at desc limit 1) o on true
     where t.skill_id = ${skill} and t.active
     order by array_position(array['starter', 'core', 'stretch'], t.difficulty), t.created_at`;
  const teacherRows = await tx<{ user_id: string; level: number; minutes: number }[]>`
    select o.user_id::text, u.level,
           coalesce((select sum(x.confirmed_minutes) from work.swap_sessions x join work.swaps s on s.id = x.swap_id where s.teacher_id = o.user_id and x.status = 'confirmed'), 0)::int as minutes
      from work.swap_offers o
      join work.user_skills u on u.user_id = o.user_id and u.skill_id = o.skill_id and u.level >= 2
      join work.members pr on pr.user_id = o.user_id and pr.university_id = ${me.university_id}::uuid and coalesce(pr.status, '') <> 'deleting'
     where o.skill_id = ${skill} and o.user_id <> ${me.id}
     limit 5`;
  const teachers = [];
  for (const t of teacherRows) if (!(await blockedBetween(tx, me.id, t.user_id))) teachers.push(t);
  teachers.sort((a, b) => b.minutes - a.minutes);
  const openings = await tx<{ venture_id: string; title: string; role: string }[]>`
    select v.id::text as venture_id, v.title, r.title as role
      from (select distinct on (v.id) v.id, r.id as role_id from work.venture_roles r join work.ventures v on v.id = r.venture_id
             where ${skill} = any (r.skill_ids) and r.filled < r.slots and v.status = 'recruiting'
               and not exists (select 1 from work.venture_members m where m.venture_id = v.id and m.user_id = ${me.id})
               and ${canViewVenture(tx, me.id)}
             order by v.id, r.created_at limit 3) x
      join work.ventures v on v.id = x.id join work.venture_roles r on r.id = x.role_id`;
  return { skill: k, level: lvl?.level ?? 0, state, why, evidence, commits: commits!.n, tasks, teachers, openings };
}

/** `my_l2_skills(user)`: Openings matching (market's batch read). */
export async function l2Skills(db: Db, userIds: readonly string[]) {
  return db<{ user_id: string; skill_ids: string[] }[]>`
    select user_id::text, array_agg(skill_id order by skill_id) as skill_ids from work.user_skills
     where user_id = any(${[...userIds]}::uuid[]) and level >= 2 group by user_id`;
}
