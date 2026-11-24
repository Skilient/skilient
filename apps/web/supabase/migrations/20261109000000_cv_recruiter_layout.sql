-- Recruiter-readable CV (decisions 2026-10-19). The snapshot gains what the new layout needs:
-- each skill's type (the CV groups skills like a normal CV), up to 3 teammate-confirmed
-- contribution notes per project, and a project-level AI-assisted flag (more than half of the
-- student's counted GitHub lines in that venture came from an AI agent, the rule skills use).
-- The summary says "team projects" without a bracketed count. Projects now come before Skills
-- by default. Signed records are untouched; the new fields arrive at each student's next refresh.

CREATE OR REPLACE FUNCTION private.cv_snapshot_base(p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_person jsonb;
  v_sections text[];
  v_show_pct boolean;
  v_show_email boolean;
  v_dept text;
  v_uni text;
  v_year smallint;
  v_tier public.ranking_tier;
  v_top integer;
  v_skills jsonb;
  v_projects jsonb;
  v_prs jsonb;
  v_endorse jsonb;
  v_creds jsonb;
  v_summary text;
  v_n_proj integer;
  v_n_done integer;
  v_n_prs integer;
  v_top3 text[];
begin
  if not private.cv_eligible(p_user) then
    return null;
  end if;

  select coalesce(s.sections, private.cv_all_sections()),
         coalesce(s.show_percentile, not p.leaderboard_opt_out),
         coalesce(s.show_email, false),
         p.department, un.name, p.graduation_year,
         jsonb_build_object(
           'name', p.full_name,
           'username', p.username,
           'university', un.name,
           'department', p.department,
           'graduation_year', p.graduation_year::integer,
           'email', case when coalesce(s.show_email, false) then u.email end)
    into v_sections, v_show_pct, v_show_email, v_dept, v_uni, v_year, v_person
    from public.profiles p
    join public.universities un on un.id = p.university_id
    join auth.users u on u.id = p.user_id
    left join public.cv_settings s on s.user_id = p.user_id
   where p.user_id = p_user;

  -- Tier always shows; the percentile only as "top N%" within the top half, and only when
  -- the student shows it (default: not when they left the leaderboard).
  select r.tier,
         case when r.ranked and r.percentile is not null and v_show_pct
                   and greatest(1, ceil((1 - r.percentile) * 100))::integer <= 50
              then greatest(1, ceil((1 - r.percentile) * 100))::integer end
    into v_tier, v_top
    from public.ranking_scores r where r.user_id = p_user;

  -- Skills: L2 and above, up to 15, by level then evidence.
  with ev as (
    select us.skill_id, sk.name, sk.category::text as category, us.level::integer as level, us.repos, us.active_days, us.ai_assisted,
           (select count(*)::integer from public.github_pr_skills ps
              join public.github_pull_requests pr
                on pr.user_id = ps.user_id and pr.repo_github_id = ps.repo_github_id and pr.number = ps.number
             where ps.user_id = p_user and ps.skill_id = us.skill_id and pr.counted) as pull_requests,
           (select count(*)::integer from public.contributions o
             where o.user_id = p_user and o.corrects_id is null and o.source = 'manual'
               and private.entry_shows_skill(o.id, us.skill_id)
               and o.id in (select e.entry_id from private.verified_entries(p_user) e)) as entries,
           (select count(*)::integer from public.endorsements e
             where e.endorsee_id = p_user and e.skill_id = us.skill_id and not e.hidden) as endorsements
      from public.user_skills us
      join public.skills sk on sk.id = us.skill_id and sk.retired_at is null
     where us.user_id = p_user and us.level >= 2
  ), top as (
    select * from ev
     order by level desc, repos + active_days + pull_requests + entries + endorsements desc, name
     limit 15
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', skill_id, 'name', name, 'category', category, 'level', level, 'ai_assisted', ai_assisted,
           'evidence', jsonb_build_object('repos', repos, 'active_days', active_days,
                                          'pull_requests', pull_requests, 'entries', entries,
                                          'endorsements', endorsements))
           order by level desc, repos + active_days + pull_requests + entries + endorsements desc, name), '[]'::jsonb),
         (array_agg(name order by level desc, repos + active_days + pull_requests + entries + endorsements desc, name))[1:3]
    into v_skills, v_top3
    from top;

  -- Projects: ventures in progress or completed where the student is a member, or was one
  -- and keeps peer-verified entries (decisions.md 2026-09-28). Unlisted ventures stay off.
  -- Deliverables are a count, never links (PRD 5.28); a private repository is not named.
  with ve as (
    select e.entry_id, e.venture_id from private.verified_entries(p_user) e
  ), verified as (
    select ve.venture_id, count(*)::integer as n from ve group by ve.venture_id
  ), mine as (
    select v.id, v.title, v.type, v.status, v.completed_at, v.description, v.skill_ids,
           v.repo_id, v.repo_full_name, v.owner_id = p_user as is_owner,
           m.team_role, coalesce(m.joined_at,
             (select min(c.created_at) from public.contributions c where c.venture_id = v.id and c.user_id = p_user)) as started_at,
           m.user_id is null as former,
           coalesce(vf.n, 0) as verified_entries
      from public.ventures v
      left join public.venture_members m on m.venture_id = v.id and m.user_id = p_user
      left join verified vf on vf.venture_id = v.id
     where v.status in ('in_progress', 'completed') and v.visibility <> 'unlisted'
       and (m.user_id is not null or coalesce(vf.n, 0) > 0)
     order by (v.status = 'completed') desc, v.completed_at desc nulls last, started_at desc
     limit 10
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', mine.id,
           'title', mine.title,
           'type', mine.type,
           'status', mine.status,
           'role', case when mine.former then 'former_member' else mine.team_role::text end,
           'owner', mine.is_owner,
           'started', to_char(mine.started_at at time zone 'Asia/Karachi', 'YYYY-MM'),
           'completed', to_char(mine.completed_at at time zone 'Asia/Karachi', 'YYYY-MM'),
           'team_size', (select count(*)::integer from public.venture_members t where t.venture_id = mine.id),
           'verified_entries', mine.verified_entries,
           'faculty_confirmed', 0,
           'faculty_reviewed', false,
           'deliverables', (select count(*)::integer from public.venture_deliverables d where d.venture_id = mine.id),
           'skills', coalesce((select jsonb_agg(sk.name order by sk.name) from public.skills sk where sk.id = any (mine.skill_ids)), '[]'::jsonb),
           'repository', case when mine.repo_full_name is null then null
                              when coalesce((select g.private from public.github_repos g where g.repo_id = mine.repo_id), true)
                                then 'Private repository'
                              else mine.repo_full_name end,
           'description', case when char_length(mine.description) > 500
                               then rtrim(left(mine.description, 499)) || '…' else mine.description end,
           'highlights', coalesce((
             select jsonb_agg(h.note order by h.created_at desc)
               from (select o.created_at,
                            (select case when char_length(btrim(c.description)) > 160
                                         then rtrim(left(btrim(c.description), 159)) || '…' else btrim(c.description) end
                               from public.contributions c
                              where c.id = o.id or c.corrects_id = o.id
                              order by c.created_at desc, (c.id = o.id)
                              limit 1) as note
                       from public.contributions o
                      where o.venture_id = mine.id and o.user_id = p_user and o.source = 'manual' and o.corrects_id is null
                        and o.id in (select ve.entry_id from ve where ve.venture_id = mine.id)
                      order by o.created_at desc
                      limit 3) h), '[]'::jsonb),
           'ai_assisted', coalesce((
             select sum(g.meaningful_lines) filter (where g.ai_agent is not null) * 2 > sum(g.meaningful_lines)
               from public.contributions o
               join public.github_commits g on g.user_id = o.user_id and g.repo_id = mine.repo_id and g.sha = o.commit_sha
              where o.venture_id = mine.id and o.user_id = p_user and o.source = 'github'
                and not o.before_venture and o.corrects_id is null and g.status = 'counted'), false))
           order by (mine.status = 'completed') desc, mine.completed_at desc nulls last, mine.started_at desc), '[]'::jsonb),
         count(*)::integer,
         count(*) filter (where mine.status = 'completed')::integer
    into v_projects, v_n_proj, v_n_done
    from mine;

  -- Open-source work: merged pull requests that count (someone else's repository).
  with prs as (
    select pr.repo_full_name, pr.repo_private, pr.number, pr.merged_at,
           coalesce((select jsonb_agg(sk.name order by sk.name)
                       from public.github_pr_skills ps join public.skills sk on sk.id = ps.skill_id
                      where ps.user_id = pr.user_id and ps.repo_github_id = pr.repo_github_id and ps.number = pr.number), '[]'::jsonb) as skills
      from public.github_pull_requests pr
     where pr.user_id = p_user and pr.counted
     order by pr.merged_at desc
     limit 20
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'repository', case when repo_private then 'Private repository' else repo_full_name end,
           'number', case when repo_private then null else number end,
           'merged', to_char(merged_at at time zone 'Asia/Karachi', 'YYYY-MM-DD'),
           'skills', skills) order by merged_at desc), '[]'::jsonb)
    into v_prs
    from prs;
  select count(*)::integer into v_n_prs from public.github_pull_requests where user_id = p_user and counted;

  -- Endorsements: up to 5 tied to evidence, one per endorser, higher endorser tier first.
  with tied as (
    select distinct on (e.endorser_id)
           e.endorser_id, e.created_at, e.note, sk.name as skill, v.title as venture, pr.full_name as endorser, rs.tier
      from public.endorsements e
      join public.skills sk on sk.id = e.skill_id
      join public.ventures v on v.id = e.venture_id
      join public.profiles pr on pr.user_id = e.endorser_id
      left join public.ranking_scores rs on rs.user_id = e.endorser_id
     where e.endorsee_id = p_user and not e.hidden and e.evidence_id is not null
       and private.entry_shows_skill(e.evidence_id, e.skill_id)
     order by e.endorser_id, e.created_at desc
  ), top as (
    select * from tied order by tier desc nulls last, created_at desc limit 5
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'endorser', endorser, 'skill', skill, 'venture', venture, 'note', note,
           'date', to_char(created_at at time zone 'Asia/Karachi', 'YYYY-MM-DD'))
           order by tier desc nulls last, created_at desc), '[]'::jsonb)
    into v_endorse
    from top;

  -- Credentials: approved by a trust reviewer and not expired.
  select coalesce(jsonb_agg(jsonb_build_object(
           'title', c.title,
           'issuer', coalesce(ri.name, c.issuer),
           'issued', to_char(c.issued_on, 'YYYY-MM'),
           'expires', to_char(c.expires_on, 'YYYY-MM'))
           order by c.issued_on desc, c.title), '[]'::jsonb)
    into v_creds
    from public.credentials c
    left join public.recognised_issuers ri on ri.id = c.recognised_issuer_id
   where c.user_id = p_user and c.status = 'approved'
     and (c.expires_on is null or c.expires_on > (now() at time zone 'Asia/Karachi')::date);

  -- Template summary (no AI): department, never the free-text programme.
  v_summary := coalesce(v_dept || ' student', 'Student') || ' at ' || v_uni
    || coalesce(', class of ' || v_year, '')
    || case when cardinality(v_top3) > 0 then ', with verified work in ' || private.cv_join_names(v_top3)
            when v_n_proj > 0 then ', with verified work' else '' end
    || case when v_n_proj = 1 and v_n_done = 1 then ' across 1 completed team project'
            when v_n_proj = 1 then ' across 1 team project'
            when v_n_proj > 1 then ' across ' || v_n_proj || ' team projects'
              || case when v_n_done > 0 then ', ' || v_n_done || ' of them completed' else '' end
            else '' end
    || '.'
    || case when v_n_prs > 0 then ' ' || v_n_prs || case when v_n_prs = 1 then ' merged pull request' else ' merged pull requests' end
              || ' to other developers'' repositories.' else '' end
    || case when v_tier is not null then ' ' || initcap(v_tier::text) || ' tier on Skilient'
              || coalesce(', top ' || v_top || '%', '') || '.' else '' end;

  return jsonb_build_object(
    'schema', 'skilient.cv/1',
    'person', v_person,
    'standing', jsonb_build_object('tier', v_tier, 'top_percent', v_top),
    'sections', to_jsonb(v_sections),
    'summary', v_summary,
    'skills', v_skills,
    'projects', v_projects,
    'open_source', v_prs,
    'endorsements', v_endorse,
    'credentials', v_creds,
    'education', jsonb_build_object('university', v_uni, 'department', v_dept, 'graduation_year', v_year::integer)
  );
end;
$function$;

create or replace function private.cv_all_sections()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['summary', 'projects', 'open_source', 'skills', 'endorsements', 'credentials', 'education'] $$;

alter table public.cv_settings alter column sections set default private.cv_all_sections();

-- Settings still on the old default order follow the new default.
update public.cv_settings
   set sections = private.cv_all_sections()
 where sections = array['summary', 'skills', 'projects', 'open_source', 'endorsements', 'credentials', 'education'];
