import type { Db } from "./db";

/**
 * CvFacts (credentials, W8): a student's verified work as the CV shows it, one query. Ported from the work half of
 * `private.cv_snapshot_base` (20261109000000_cv_recruiter_layout.sql, with _ai_assisted_commits.sql's fields) and
 * the teacher portal's layer (`faculty_confirmed`; `faculty_reviewed` stays false until the faculty portal, whose
 * reviews work doesn't hold yet). Endorsers are `$name:<id>` placeholders credentials fills from people; their tier
 * (the order) is work's copy of ranking's tiers. `verified_entries` and `entry_shows_skill` are inline, as in
 * skills.ts. Credentials adds the person, standing, sections, summary and education.
 */
export async function cvFacts(db: Db, userId: string): Promise<Record<string, unknown>> {
  const [r] = await db<{ v: Record<string, unknown> }[]>`
    with ve as (
      select o.id as entry_id, o.venture_id
        from work.contributions o
       where o.user_id = ${userId} and o.corrects_id is null
         and ((o.source = 'github' and not o.before_venture)
              or exists (select 1 from work.contribution_confirmations k
                          where k.contribution_id = (select c.id from work.contributions c where c.id = o.id or c.corrects_id = o.id
                                                      order by c.created_at desc, (c.id = o.id) limit 1)))
    ),
    shows as (
      -- entry_shows_skill(entry, skill) for the student's entries: the newest version's tags, or a GitHub entry's evidence.
      select o.id as entry_id, s.skill_id
        from work.contributions o
        cross join lateral (select c.skill_ids from work.contributions c where c.id = o.id or c.corrects_id = o.id order by c.created_at desc, (c.id = o.id) limit 1) cur
        cross join lateral (select unnest(cur.skill_ids) as skill_id
                            union select se.skill_id from work.skill_evidence se where o.source = 'github' and se.user_id = o.user_id and se.sha = o.commit_sha) s
       where o.user_id = ${userId} and o.corrects_id is null
    ),
    ev as (
      select us.skill_id, sk.name, sk.category::text as category, us.level::integer as level, us.repos, us.active_days, us.ai_assisted,
             (select count(*)::integer from work.github_pr_skills ps
                join work.github_pull_requests pr on pr.user_id = ps.user_id and pr.repo_github_id = ps.repo_github_id and pr.number = ps.number
               where ps.user_id = ${userId} and ps.skill_id = us.skill_id and pr.counted) as pull_requests,
             (select count(*)::integer from work.contributions o
               where o.user_id = ${userId} and o.corrects_id is null and o.source = 'manual'
                 and exists (select 1 from shows s where s.entry_id = o.id and s.skill_id = us.skill_id)
                 and o.id in (select ve.entry_id from ve)) as entries,
             (select count(*)::integer from work.endorsements e where e.endorsee_id = ${userId} and e.skill_id = us.skill_id and not e.hidden) as endorsements
        from work.user_skills us
        join work.skills sk on sk.id = us.skill_id and sk.retired_at is null
       where us.user_id = ${userId} and us.level >= 2
    ),
    top_skills as (
      select * from ev order by level desc, repos + active_days + pull_requests + entries + endorsements desc, name limit 15
    ),
    verified as (select ve.venture_id, count(*)::integer as n from ve group by ve.venture_id),
    mine as (
      select v.id, v.title, v.type, v.status, v.completed_at, v.description, v.skill_ids, v.repo_id, v.repo_full_name, v.owner_id = ${userId} as is_owner,
             m.team_role, coalesce(m.joined_at, (select min(c.created_at) from work.contributions c where c.venture_id = v.id and c.user_id = ${userId})) as started_at,
             m.user_id is null as former, coalesce(vf.n, 0) as verified_entries
        from work.ventures v
        left join work.venture_members m on m.venture_id = v.id and m.user_id = ${userId}
        left join verified vf on vf.venture_id = v.id
       where v.status in ('in_progress', 'completed') and v.visibility <> 'unlisted' and (m.user_id is not null or coalesce(vf.n, 0) > 0)
       order by (v.status = 'completed') desc, v.completed_at desc nulls last, started_at desc
       limit 10
    ),
    prs as (
      select pr.repo_full_name, pr.repo_private, pr.number, pr.merged_at,
             coalesce((select jsonb_agg(sk.name order by sk.name) from work.github_pr_skills ps join work.skills sk on sk.id = ps.skill_id
                        where ps.user_id = pr.user_id and ps.repo_github_id = pr.repo_github_id and ps.number = pr.number), '[]'::jsonb) as skills
        from work.github_pull_requests pr where pr.user_id = ${userId} and pr.counted order by pr.merged_at desc limit 20
    ),
    tied as (
      select distinct on (e.endorser_id) e.endorser_id, e.created_at, e.note, sk.name as skill, v.title as venture,
             array_position(array['raw', 'spark', 'flare', 'shine', 'radiant', 'luminary'], rt.tier) as tier
        from work.endorsements e
        join work.skills sk on sk.id = e.skill_id
        join work.ventures v on v.id = e.venture_id
        left join work.ranking_tiers rt on rt.user_id = e.endorser_id
       where e.endorsee_id = ${userId} and not e.hidden and e.evidence_id is not null
         and exists (select 1 from work.contributions o
                      cross join lateral (select c.skill_ids from work.contributions c where c.id = o.id or c.corrects_id = o.id order by c.created_at desc, (c.id = o.id) limit 1) cur
                      where o.id = e.evidence_id and o.corrects_id is null
                        and (e.skill_id = any (cur.skill_ids)
                             or (o.source = 'github' and exists (select 1 from work.skill_evidence se where se.user_id = o.user_id and se.sha = o.commit_sha and se.skill_id = e.skill_id))))
       order by e.endorser_id, e.created_at desc
    ),
    top_endorse as (select * from tied order by tier desc nulls last, created_at desc limit 5)
    select jsonb_build_object(
      'skills', coalesce((select jsonb_agg(jsonb_build_object('id', skill_id, 'name', name, 'category', category, 'level', level, 'ai_assisted', ai_assisted,
                                                              'evidence', jsonb_build_object('repos', repos, 'active_days', active_days, 'pull_requests', pull_requests,
                                                                                             'entries', entries, 'endorsements', endorsements))
                                   order by level desc, repos + active_days + pull_requests + entries + endorsements desc, name) from top_skills), '[]'::jsonb),
      'top_skills', coalesce((select to_jsonb((array_agg(name order by level desc, repos + active_days + pull_requests + entries + endorsements desc, name))[1:3]) from top_skills), '[]'::jsonb),
      'projects', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', mine.id, 'title', mine.title, 'type', mine.type, 'status', mine.status,
                 'role', case when mine.former then 'former_member' else mine.team_role::text end,
                 'owner', mine.is_owner,
                 'started', to_char(mine.started_at at time zone 'Asia/Karachi', 'YYYY-MM'),
                 'completed', to_char(mine.completed_at at time zone 'Asia/Karachi', 'YYYY-MM'),
                 'team_size', (select count(*)::integer from work.venture_members t where t.venture_id = mine.id),
                 'verified_entries', mine.verified_entries,
                 'faculty_confirmed', (select count(*)::integer from work.contributions o
                                        where o.venture_id = mine.id and o.user_id = ${userId} and o.corrects_id is null
                                          and exists (select 1 from work.contribution_confirmations k where k.confirmer_role = 'supervisor'
                                                        and k.contribution_id = (select c.id from work.contributions c where c.id = o.id or c.corrects_id = o.id
                                                                                  order by c.created_at desc, (c.id = o.id) limit 1))),
                 'faculty_reviewed', false,
                 'deliverables', (select count(*)::integer from work.venture_deliverables d where d.venture_id = mine.id),
                 'skills', coalesce((select jsonb_agg(sk.name order by sk.name) from work.skills sk where sk.id = any (mine.skill_ids)), '[]'::jsonb),
                 'repository', case when mine.repo_full_name is null then null
                                    when coalesce((select g.private from work.github_repos g where g.repo_id = mine.repo_id), true) then 'Private repository'
                                    else mine.repo_full_name end,
                 'description', case when char_length(mine.description) > 500 then rtrim(left(mine.description, 499)) || '…' else mine.description end,
                 'highlights', coalesce((
                   select jsonb_agg(h.note order by h.created_at desc)
                     from (select o.created_at,
                                  (select case when char_length(btrim(c.description)) > 160 then rtrim(left(btrim(c.description), 159)) || '…' else btrim(c.description) end
                                     from work.contributions c where c.id = o.id or c.corrects_id = o.id order by c.created_at desc, (c.id = o.id) limit 1) as note
                             from work.contributions o
                            where o.venture_id = mine.id and o.user_id = ${userId} and o.source = 'manual' and o.corrects_id is null
                              and o.id in (select ve.entry_id from ve where ve.venture_id = mine.id)
                            order by o.created_at desc limit 3) h), '[]'::jsonb),
                 'ai_assisted', coalesce((
                   select sum(g.meaningful_lines) filter (where g.ai_agent is not null) * 2 > sum(g.meaningful_lines)
                     from work.contributions o
                     join work.github_commits g on g.user_id = o.user_id and g.repo_id = mine.repo_id and g.sha = o.commit_sha
                    where o.venture_id = mine.id and o.user_id = ${userId} and o.source = 'github' and not o.before_venture and o.corrects_id is null
                      and g.status = 'counted'), false))
               order by (mine.status = 'completed') desc, mine.completed_at desc nulls last, mine.started_at desc) from mine), '[]'::jsonb),
      'projects_count', (select count(*)::integer from mine),
      'completed_count', (select count(*)::integer from mine where mine.status = 'completed'),
      'open_source', coalesce((select jsonb_agg(jsonb_build_object(
                                 'repository', case when repo_private then 'Private repository' else repo_full_name end,
                                 'number', case when repo_private then null else number end,
                                 'merged', to_char(merged_at at time zone 'Asia/Karachi', 'YYYY-MM-DD'),
                                 'skills', skills) order by merged_at desc) from prs), '[]'::jsonb),
      'pull_requests_count', (select count(*)::integer from work.github_pull_requests where user_id = ${userId} and counted),
      'endorsements', coalesce((select jsonb_agg(jsonb_build_object('endorser', '$name:' || endorser_id, 'skill', skill, 'venture', venture, 'note', note,
                                                                    'date', to_char(created_at at time zone 'Asia/Karachi', 'YYYY-MM-DD'))
                                         order by tier desc nulls last, created_at desc) from top_endorse), '[]'::jsonb),
      'credentials', coalesce((select jsonb_agg(jsonb_build_object('title', c.title, 'issuer', coalesce(ri.name, c.issuer),
                                                                   'issued', to_char(c.issued_on, 'YYYY-MM'), 'expires', to_char(c.expires_on, 'YYYY-MM'))
                                        order by c.issued_on desc, c.title)
                                 from work.credentials c left join work.recognised_issuers ri on ri.id = c.recognised_issuer_id
                                where c.user_id = ${userId} and c.status = 'approved'
                                  and (c.expires_on is null or c.expires_on > (now() at time zone 'Asia/Karachi')::date)), '[]'::jsonb)) as v`;
  return r!.v;
}
