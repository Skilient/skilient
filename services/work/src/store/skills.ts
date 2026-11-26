import type { NewEvent } from "@skilient/platform";
import type { Db, Tx } from "./db";
import { publish } from "./publish";
import { milestone } from "./shell";

/**
 * Skills and levels, ported from _github_evidence.sql (`recompute_user_skills`), _skill_levels.sql (`l3_skills`,
 * `l4_skills`, `entry_shows_skill`, `my_skill_proofs`), _endorsements.sql (peer verification), _paths_tasks.sql
 * (`l2_at`), _ai_assisted_commits.sql and _skill_visibility.sql (`my_skills`).
 *
 * L1: a skill seen in the student's shared repositories (commits or the repository's languages). L2: 3+ active
 * days and enough use for its category. L3: a merged pull request someone else approved, a confirmed
 * contribution tagged with the skill, a confirmed pre-venture commit, or a competition award. L4: endorsements
 * by enough teammates (or a supervisor) on entries that show the skill, a passed code check, or a won
 * competition with enough endorsements. Each change is published as `skill.changed` (people's skill copy,
 * content's relevance); a skill that drops out is published at level 0.
 */
export async function recomputeUserSkills(tx: Tx, userIds: readonly string[]): Promise<void> {
  for (const userId of [...new Set(userIds)].sort()) await recomputeOne(tx, userId);
}

const peerMin = (db: Db) => db`coalesce((select (value ->> 'peer_verified_min')::int from work.config where key = 'endorsements.limits'), 2)`;

/** `entry_shows_skill(entry, skill)` on an evidence id column and a skill id column. */
const entryShowsSkill = (db: Db, entry: string, skill: string) => db`exists (
  select 1 from work.contributions o
   cross join lateral (select c.skill_ids from work.contributions c where c.id = o.id or c.corrects_id = o.id order by c.created_at desc, (c.id = o.id) limit 1) shown
   where o.id = ${db(entry)} and o.corrects_id is null
     and (${db(skill)} = any (shown.skill_ids)
          or (o.source = 'github' and exists (select 1 from work.skill_evidence se where se.user_id = o.user_id and se.sha = o.commit_sha and se.skill_id = ${db(skill)}))))`;

async function recomputeOne(tx: Tx, userId: string): Promise<void> {
  const before = new Map(
    (await tx<{ skill_id: string; level: number }[]>`select skill_id, level from work.user_skills where user_id = ${userId}`).map((r) => [r.skill_id, r.level]),
  );
  await tx`
    with repos as (
      select ur.repo_id, ur.kind from work.github_user_repos ur where ur.user_id = ${userId} and not ur.excluded
    ),
    ev as (
      select e.skill_id, e.repo_id, e.detectors, e.lines, e.occurred_at, c.status, s.category, c.ai_agent
        from work.skill_evidence e
        join repos r on r.repo_id = e.repo_id
        join work.github_commits c on c.user_id = e.user_id and c.repo_id = e.repo_id and c.sha = e.sha
        join work.skills s on s.id = e.skill_id
       where e.user_id = ${userId}
    ),
    agg as (
      select skill_id, min(category) as category,
             count(distinct (occurred_at at time zone 'Asia/Karachi')::date) filter (where status = 'counted') as days,
             coalesce(sum(lines) filter (where status = 'counted'), 0)::integer as lines,
             count(*) filter (where status = 'counted' and detectors && array['manifest', 'import']) as pkg_hits,
             count(*) filter (where status = 'counted' and detectors && array['file', 'path', 'manifest', 'import']) as any_hits,
             count(distinct repo_id) as repos,
             coalesce(sum(lines) filter (where status = 'counted' and ai_agent is not null), 0)::integer as ai_lines,
             count(*) filter (where status = 'counted' and ai_agent is not null) as ai_hits,
             count(*) filter (where status = 'counted') as counted_hits,
             max(occurred_at) filter (where status in ('counted', 'held')) as last_used
        from ev group by skill_id
    ),
    linguist as (
      select distinct s.id as skill_id
        from repos r
        join work.github_repos g on g.repo_id = r.repo_id
        join work.skills s on s.retired_at is null and jsonb_typeof(s.detectors -> 'linguist') = 'array'
                           and exists (select 1 from jsonb_array_elements_text(s.detectors -> 'linguist') l where l = any (g.languages))
       where r.kind = 'owned' or exists (select 1 from work.github_commits c where c.user_id = ${userId} and c.repo_id = r.repo_id)
    ),
    github as (
      select coalesce(a.skill_id, l.skill_id) as skill_id,
             (case when a.skill_id is not null and a.days >= 3 and (
                     (a.category = 'language' and a.lines >= 150)
                     or (a.category in ('framework', 'library') and a.pkg_hits >= 3)
                     or (a.category in ('tool', 'platform', 'practice') and a.any_hits >= 3))
                   then 2 else 1 end)::smallint as level,
             coalesce(a.days, 0)::integer as active_days,
             coalesce(a.lines, 0)::integer as lines,
             coalesce(case when a.category in ('framework', 'library') then a.pkg_hits else a.any_hits end, 0)::integer as hits,
             coalesce(a.repos, 0)::integer as repos,
             a.last_used as last_used_at,
             coalesce(a.ai_lines, 0)::integer as ai_lines,
             (case when a.lines > 0 then a.ai_lines * 2 > a.lines
                   else coalesce(a.ai_hits, 0) * 2 > coalesce(a.counted_hits, 0) and a.ai_hits > 0 end) as ai_major
        from agg a full join linguist l on l.skill_id = a.skill_id
    ),
    l3 as (
      select s.skill_id
        from work.github_pr_skills s
        join work.github_pull_requests p on p.user_id = s.user_id and p.repo_github_id = s.repo_github_id and p.number = s.number
       where s.user_id = ${userId} and p.counted
      union
      select unnest(e.skill_ids)
        from work.contributions o
        cross join lateral (select c.id, c.skill_ids from work.contributions c where c.id = o.id or c.corrects_id = o.id
                             order by c.created_at desc, (c.id = o.id) limit 1) e
       where o.user_id = ${userId} and o.corrects_id is null and o.source = 'manual'
         and exists (select 1 from work.contribution_confirmations k where k.contribution_id = e.id and k.confirmer_id <> o.user_id)
      union
      select se.skill_id
        from work.contributions o
        join work.skill_evidence se on se.user_id = o.user_id and se.sha = o.commit_sha
       where o.user_id = ${userId} and o.source = 'github' and o.before_venture
         and exists (select 1 from work.contribution_confirmations k where k.contribution_id = o.id and k.confirmer_id <> o.user_id)
      union
      select a.skill_id from work.competition_awards a where a.student_id = ${userId}
    ),
    l4 as (
      select e.skill_id
        from work.endorsements e
       where e.endorsee_id = ${userId} and not e.hidden and e.evidence_id is not null and ${entryShowsSkill(tx, "e.evidence_id", "e.skill_id")}
       group by e.skill_id
      having count(distinct e.endorser_id) >= ${peerMin(tx)} or bool_or(e.endorser_kind = 'teacher')
      union
      select c.skill_id from work.code_checks c where c.user_id = ${userId} and c.status = 'passed'
      union
      select a.skill_id
        from work.competition_awards a
       where a.student_id = ${userId} and a.kind = 'winner'
         and 1 + (select count(distinct e.endorser_id) from work.endorsements e
                   where e.endorsee_id = ${userId} and e.skill_id = a.skill_id and not e.hidden and e.evidence_id is not null
                     and ${entryShowsSkill(tx, "e.evidence_id", "e.skill_id")}) >= ${peerMin(tx)}
    ),
    proofs as (
      select skill_id, 3::smallint as level from l3
      union all
      select skill_id, 4::smallint from l4
    ),
    computed as (
      select k.skill_id,
             greatest(coalesce(g.level, 0), coalesce((select max(pr.level) from proofs pr where pr.skill_id = k.skill_id), 0))::smallint as level,
             coalesce(g.active_days, 0) as active_days, coalesce(g.lines, 0) as lines, coalesce(g.hits, 0) as hits,
             coalesce(g.repos, 0) as repos, g.last_used_at, coalesce(g.ai_lines, 0) as ai_lines,
             (coalesce(g.ai_major, false)
              and not exists (select 1 from work.code_checks cc where cc.user_id = ${userId} and cc.skill_id = k.skill_id and cc.status = 'passed')) as ai_assisted,
             (select count(distinct x.endorser_id) >= ${peerMin(tx)} or coalesce(bool_or(x.endorser_kind = 'teacher'), false)
                from work.endorsements x where x.endorsee_id = ${userId} and x.skill_id = k.skill_id and not x.hidden) as peer_verified
        from (select skill_id from github union select skill_id from proofs) k
        join work.skills s on s.id = k.skill_id and s.retired_at is null
        left join github g on g.skill_id = k.skill_id
    ),
    dropped as (
      delete from work.user_skills u where u.user_id = ${userId} and not exists (select 1 from computed c where c.skill_id = u.skill_id)
    )
    insert into work.user_skills (user_id, skill_id, level, active_days, lines, hits, repos, last_used_at, ai_lines, ai_assisted, peer_verified, l2_at)
    select ${userId}, skill_id, level, active_days, lines, hits, repos, last_used_at, ai_lines, ai_assisted, peer_verified,
           case when level >= 2 then now() end
      from computed
    on conflict (user_id, skill_id) do update
      set level = excluded.level, active_days = excluded.active_days, lines = excluded.lines, hits = excluded.hits, repos = excluded.repos,
          last_used_at = excluded.last_used_at, ai_lines = excluded.ai_lines, ai_assisted = excluded.ai_assisted,
          peer_verified = excluded.peer_verified,
          l2_at = case when excluded.level >= 2 and work.user_skills.l2_at is null then now() else work.user_skills.l2_at end,
          updated_at = now()
    where (work.user_skills.level, work.user_skills.active_days, work.user_skills.lines, work.user_skills.hits, work.user_skills.repos,
           work.user_skills.last_used_at, work.user_skills.ai_lines, work.user_skills.ai_assisted, work.user_skills.peer_verified)
          is distinct from
          (excluded.level, excluded.active_days, excluded.lines, excluded.hits, excluded.repos, excluded.last_used_at,
           excluded.ai_lines, excluded.ai_assisted, excluded.peer_verified)`;
  const after = await tx<{ skill_id: string; level: number; name: string; category: string | null }[]>`
    select u.skill_id, u.level, s.name, s.category from work.user_skills u join work.skills s on s.id = u.skill_id where u.user_id = ${userId}`;
  const afterMap = new Map(after.map((r) => [r.skill_id, r]));
  const [found] = await tx<{ n: number }[]>`select count(*)::int as n from work.user_skills where user_id = ${userId} and level >= 1`;
  await tx`update work.github_sync_jobs set skills_found = ${found!.n}, updated_at = now() where user_id = ${userId} and status in ('queued', 'running')`;
  const events: NewEvent[] = [];
  for (const r of after)
    if (before.get(r.skill_id) !== r.level) events.push(skillChanged(userId, r.skill_id, r.name, r.level, r.category));
  const gone = [...before.keys()].filter((s) => !afterMap.has(s));
  if (gone.length) {
    const names = await tx<{ id: string; name: string; category: string | null }[]>`select id, name, category from work.skills where id = any(${gone}::text[])`;
    for (const n of names) events.push(skillChanged(userId, n.id, n.name, 0, n.category));
  }
  const hadL2 = [...before.values()].some((l) => l >= 2);
  const hasL2 = after.some((r) => r.level >= 2);
  if (hadL2 !== hasL2) events.push(milestone(userId, "skills.l2", hasL2));
  await publish(tx, events);
}

/** `skill.changed`: level, catalogue label and category (ranking's span bonus, W6). */
const skillChanged = (userId: string, skillId: string, label: string, level: number, category: string | null): NewEvent => ({
  type: "skill.changed",
  subjects: [userId],
  payload: { user_id: userId, skill_id: skillId, skill_label: label, level, category },
});

/** `refresh_peer_verified(user)`: after endorsements change (the recompute also sets it). */
export async function refreshPeerVerified(tx: Tx, userId: string): Promise<void> {
  await tx`
    update work.user_skills u
       set peer_verified = (coalesce(e.endorsers, 0) >= ${peerMin(tx)} or coalesce(e.teachers, 0) > 0)
      from (select s.skill_id, count(distinct x.endorser_id)::int as endorsers, count(*) filter (where x.endorser_kind = 'teacher')::int as teachers
              from work.user_skills s left join work.endorsements x on x.endorsee_id = s.user_id and x.skill_id = s.skill_id and not x.hidden
             where s.user_id = ${userId} group by s.skill_id) e
     where u.user_id = ${userId} and u.skill_id = e.skill_id
       and u.peer_verified is distinct from (coalesce(e.endorsers, 0) >= ${peerMin(tx)} or coalesce(e.teachers, 0) > 0)`;
}

/** `my_skills()`: the reader's skills at L1 or above. */
export const mySkills = (db: Db, me: string) =>
  db<{
    skill_id: string;
    level: number;
    active_days: number;
    lines: number;
    hits: number;
    repos: number;
    last_used_at: Date | null;
    ai_lines: number;
    ai_assisted: boolean;
    peer_verified: boolean;
  }[]>`
    select skill_id, level, active_days, lines, hits, repos, last_used_at, ai_lines, ai_assisted, peer_verified
      from work.user_skills where user_id = ${me} and level >= 1 order by level desc, skill_id`;

/** Skill levels of other people (profiles, talent; their owners decide visibility): level >= 1 only. */
export const skillsOf = (db: Db, userIds: readonly string[]) =>
  db<{ user_id: string; skill_id: string; level: number; peer_verified: boolean; ai_assisted: boolean }[]>`
    select user_id::text, skill_id, level, peer_verified, ai_assisted from work.user_skills
     where user_id = any(${[...userIds]}::uuid[]) and level >= 1 order by user_id, level desc, skill_id`;

/** The taxonomy (names and categories) for the given ids, or all live skills. */
export const skillNames = (db: Db, ids: readonly string[] | null) =>
  ids === null
    ? db<{ id: string; name: string; category: string; parent_id: string | null }[]>`select id, name, category, parent_id from work.skills where retired_at is null order by name`
    : db<{ id: string; name: string; category: string; parent_id: string | null }[]>`select id, name, category, parent_id from work.skills where id = any(${[...ids]}::text[]) order by name`;

/** `ai_agent_label(agent)`. */
const agentLabel = (db: Db, column: string) => db`coalesce(
  (select a ->> 'name' from jsonb_array_elements(coalesce((select value from work.config where key = 'github.ai_agents'), '[]'::jsonb)) a
    where lower(a ->> 'match') = lower(${db(column)}) limit 1), ${db(column)})`;

/** `my_skill_proofs(skill)`: what earned each level, newest first; an endorser is an id (names from people). */
export async function mySkillProofs(db: Db, me: string, skill: string) {
  return db<{ kind: string; level: number; title: string; detail: string | null; url: string | null; venture_id: string | null; endorser_id: string | null; occurred_at: Date }[]>`
    select * from (
      select 'pull_request' as kind, 3 as level, p.repo_full_name || ' #' || p.number as title,
             case when p.counted then 'Merged or approved by someone else'
                  when p.exclusion = 'own_repo' then 'Your own repository: doesn''t count'
                  when p.exclusion = 'young_account' then 'Approved by an account under 90 days old: doesn''t count'
                  else 'Not merged or approved by another person: doesn''t count' end as detail,
             'https://github.com/' || p.repo_full_name || '/pull/' || p.number as url, null::text as venture_id, null::text as endorser_id, p.merged_at as occurred_at
        from work.github_pr_skills s
        join work.github_pull_requests p on p.user_id = s.user_id and p.repo_github_id = s.repo_github_id and p.number = s.number
       where s.user_id = ${me} and s.skill_id = ${skill}
      union all
      select 'contribution', 3, v.title, e.description, null, v.id::text, null, o.created_at
        from work.contributions o
        join work.ventures v on v.id = o.venture_id
        cross join lateral (select c.id, c.description, c.skill_ids from work.contributions c where c.id = o.id or c.corrects_id = o.id
                             order by c.created_at desc, (c.id = o.id) limit 1) e
       where o.user_id = ${me} and o.corrects_id is null and o.source = 'manual' and ${skill} = any (e.skill_ids)
         and exists (select 1 from work.contribution_confirmations k where k.contribution_id = e.id and k.confirmer_id <> o.user_id)
      union all
      select 'endorsement', 4, null, v.title, null, v.id::text, e.endorser_id::text, e.created_at
        from work.endorsements e join work.ventures v on v.id = e.venture_id
       where e.endorsee_id = ${me} and e.skill_id = ${skill} and not e.hidden and e.evidence_id is not null
         and ${entryShowsSkill(db, "e.evidence_id", "e.skill_id")}
      union all
      select 'ai_pull_request', 2, g.full_name || ' #' || c.via_pr,
             format('Written with %s; %s %s', ${agentLabel(db, "min_agent")}, n, case when n = 1 then 'commit' else 'commits' end),
             'https://github.com/' || g.full_name || '/pull/' || c.via_pr, null, null, last_at
        from (select c.repo_id, c.via_pr, min(c.ai_agent) as min_agent, count(*) as n, max(c.occurred_at) as last_at
                from work.github_commits c
               where c.user_id = ${me} and c.ai_agent is not null and c.via_pr is not null and c.status = 'counted'
                 and exists (select 1 from work.skill_evidence e where e.user_id = c.user_id and e.repo_id = c.repo_id and e.sha = c.sha and e.skill_id = ${skill})
               group by c.repo_id, c.via_pr) c
        join work.github_repos g on g.repo_id = c.repo_id
      union all
      select 'code_check', 4, 'Code check passed', null, null, null, null, c.graded_at
        from work.code_checks c where c.user_id = ${me} and c.skill_id = ${skill} and c.status = 'passed'
      union all
      select 'proof_task', 2, t.title,
             'Verified by ' || case a.verified_by when 'github' then 'GitHub' when 'peer' then 'a peer review' else 'a code check' end,
             case when a.repo_full_name is not null then 'https://github.com/' || a.repo_full_name end, null, null, a.done_at
        from work.task_attempts a join work.proof_tasks t on t.id = a.task_id
       where a.user_id = ${me} and a.skill_id = ${skill} and a.status = 'done'
    ) x order by occurred_at desc nulls last`;
}

/** `record_pull_request(user, pr)`: a merged pull request with the skills its files show; then the levels. */
export async function recordPullRequest(
  tx: Tx,
  userId: string,
  p: {
    repo_github_id: number;
    number: number;
    pr_github_id: number;
    repo_full_name: string;
    repo_private: boolean;
    merged_at: string;
    approver_github_id: number | null;
    exclusion: string | null;
    files: number;
    skills: { skill_id: string; path: string }[];
  },
): Promise<boolean> {
  const [a] = await tx`select 1 from work.github_accounts where user_id = ${userId} and revoked_at is null`;
  if (!a) return false;
  await tx`
    insert into work.github_pull_requests (user_id, repo_github_id, number, pr_github_id, repo_full_name, repo_private, merged_at, approver_github_id, counted, exclusion, files)
    values (${userId}, ${p.repo_github_id}, ${p.number}, ${p.pr_github_id}, ${p.repo_full_name}, ${p.repo_private}, ${p.merged_at}::timestamptz,
            ${p.exclusion === null ? p.approver_github_id : null}, ${p.exclusion === null}, ${p.exclusion}, ${p.files})
    on conflict (user_id, repo_github_id, number) do update
      set pr_github_id = excluded.pr_github_id, repo_full_name = excluded.repo_full_name, repo_private = excluded.repo_private,
          merged_at = excluded.merged_at, approver_github_id = excluded.approver_github_id, counted = excluded.counted,
          exclusion = excluded.exclusion, files = excluded.files, seen_at = now()`;
  // ranking's copy (W6): Work's pull request points and the consistency weeks.
  await publish(tx, [
    {
      type: "pull_request.recorded",
      subjects: [userId],
      payload: { user_id: userId, repo_id: p.repo_github_id, number: p.number, repo: p.repo_full_name, merged_at: new Date(p.merged_at).toISOString(), counted: p.exclusion === null },
    },
  ]);
  await tx`delete from work.github_pr_skills where user_id = ${userId} and repo_github_id = ${p.repo_github_id} and number = ${p.number}`;
  if (p.skills.length)
    await tx`
      insert into work.github_pr_skills (user_id, repo_github_id, number, skill_id, paths)
      select ${userId}, ${p.repo_github_id}, ${p.number}, s.skill_id, (array_agg(distinct s.path))[1:10]
        from json_to_recordset(${JSON.stringify(p.skills)}::text::json) as s(skill_id text, path text)
        join work.skills k on k.id = s.skill_id
       group by s.skill_id`;
  await recomputeUserSkills(tx, [userId]);
  return true;
}
