-- Scheduled job fixes (2026-11-23).
--
-- 1. uni-stats has failed every night since phase 9 with "aggregate function calls cannot be nested":
--    four groups in private.uni_stats_compute put count(*) / percentile_cont inside jsonb_agg in the same
--    query level (adoption by_department and by_batch, tiers by_tier and by_department). Each group is now
--    counted in a subquery first and aggregated into jsonb outside it. Output shape is unchanged.
-- 2. job_failed alerts resolved 15 minutes after any failure, whether or not the job had recovered, so a
--    job failing every night read as "resolved" every night. A job_failed alert now stays open until a later
--    run of the same job succeeds (failures looked at over 8 days, longer than any schedule here).
-- 3. billing-events (every 10 s) occasionally gets "job startup timeout" from pg_cron when every cron
--    worker slot is busy at the top of a minute; the next start 10 s later succeeds. Under rule 2 a failure
--    followed by a success never fires, so these transient misses stop paging. A real outage (no success
--    since) still alerts.

create or replace function private.uni_stats_compute(p_university uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_students uuid[];
  v_total integer;
  v_active integer;
  v jsonb;
begin
  select coalesce(array_agg(p.user_id), '{}') into v_students from public.profiles p
   where p.university_id = p_university and p.role = 'student' and p.status = 'active';
  v_total := cardinality(v_students);
  select count(*) into v_active from private.user_activity x where x.user_id = any (v_students) and x.last_active_at > now() - interval '30 days';

  insert into public.uni_stats (university_id, area, data) values (p_university, 'home',
    jsonb_build_object('students', private.hide_small(v_total), 'active_30d', private.hide_small(v_active)))
  on conflict (university_id, area) do update set data = excluded.data, computed_at = now();

  insert into public.uni_stats (university_id, area, data) values (p_university, 'adoption', jsonb_build_object(
    'students', private.hide_small(v_total), 'active_30d', private.hide_small(v_active),
    'active_share', case when v_total >= 5 and v_active >= 5 then round(100.0 * v_active / v_total) end,
    'by_department', private.suppress_groups(coalesce((select jsonb_agg(jsonb_build_object('label', g.label, 'count', g.n))
                       from (select coalesce(p.department, 'Not set') as label, count(*) as n
                               from public.profiles p where p.user_id = any (v_students) group by p.department) g), '[]'::jsonb)),
    'by_batch', private.suppress_groups(coalesce((select jsonb_agg(jsonb_build_object('label', g.label, 'count', g.n))
                  from (select coalesce(p.graduation_year::text, 'Not set') as label, count(*) as n
                          from public.profiles p where p.user_id = any (v_students) group by p.graduation_year) g), '[]'::jsonb))))
  on conflict (university_id, area) do update set data = excluded.data, computed_at = now();

  insert into public.uni_stats (university_id, area, data) values (p_university, 'activity', jsonb_build_object(
    'ventures', private.hide_small((select count(distinct m.venture_id) from public.venture_members m where m.user_id = any (v_students))),
    'contributions_30d', private.hide_small((select count(*) from public.contributions c where c.user_id = any (v_students)
                                               and c.created_at > now() - interval '30 days')),
    'cross_university', private.hide_small((select count(*) from (select m.venture_id from public.venture_members m
                                               join public.profiles p on p.user_id = m.user_id
                                              where m.venture_id in (select m2.venture_id from public.venture_members m2 where m2.user_id = any (v_students))
                                              group by m.venture_id having count(distinct p.university_id) > 1) x)),
    'weekly', coalesce((select jsonb_agg(jsonb_build_object('label', to_char(w, 'DD Mon'), 'count',
                          private.hide_small((select count(*) from public.contributions c where c.user_id = any (v_students)
                                                and c.created_at >= w and c.created_at < w + interval '7 days'))) order by w)
                          from generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') w), '[]'::jsonb)))
  on conflict (university_id, area) do update set data = excluded.data, computed_at = now();

  insert into public.uni_stats (university_id, area, data) values (p_university, 'skills', jsonb_build_object(
    'by_level', private.suppress_groups(coalesce((select jsonb_agg(jsonb_build_object('label', 'L' || l, 'count', n) order by l)
                  from (select max_level as l, count(*) as n from (select us.user_id, max(us.level) as max_level from public.user_skills us
                         where us.user_id = any (v_students) and us.level >= 1 group by us.user_id) m group by max_level) x), '[]'::jsonb)),
    'top', coalesce((select jsonb_agg(jsonb_build_object('label', name, 'count', n) order by n desc, name)
              from (select k.name, count(*) as n from public.user_skills us join public.skills k on k.id = us.skill_id
                     where us.user_id = any (v_students) and us.level >= 2 group by k.name having count(*) >= 5
                     order by count(*) desc, k.name limit 10) t), '[]'::jsonb),
    'growth_30d', private.hide_small((select count(*) from public.user_skills us where us.user_id = any (v_students) and us.level >= 2
                                        and us.updated_at > now() - interval '30 days'))))
  on conflict (university_id, area) do update set data = excluded.data, computed_at = now();

  -- Recruiter demand (searches naming a skill, platform-wide, 90 days) beside L2+ supply here.
  insert into public.uni_stats (university_id, area, data) values (p_university, 'skills_gap', jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object('label', k.name, 'demand', d.n,
                          'supply', private.hide_small((select count(*) from public.user_skills us where us.skill_id = d.skill
                                                          and us.user_id = any (v_students) and us.level >= 2))) order by d.n desc)
                         from (select e ->> 'skill' as skill, count(*) as n from public.search_audit sa, jsonb_array_elements(coalesce(sa.filters -> 'skills', '[]'::jsonb)) e
                                where sa.at > now() - interval '90 days' group by 1 order by 2 desc limit 15) d
                         join public.skills k on k.id = d.skill), '[]'::jsonb)))
  on conflict (university_id, area) do update set data = excluded.data, computed_at = now();

  insert into public.uni_stats (university_id, area, data) values (p_university, 'tiers', jsonb_build_object(
    'by_tier', private.suppress_groups(coalesce((select jsonb_agg(jsonb_build_object('label', g.tier, 'count', g.n))
                 from (select r.tier, count(*) as n from public.ranking_scores r
                        where r.user_id = any (v_students) and r.tier is not null group by r.tier) g), '[]'::jsonb)),
    'by_department', private.suppress_groups(coalesce((select jsonb_agg(jsonb_build_object('label', g.label, 'count', g.n, 'median_top_percent', g.median_top_percent))
                       from (select coalesce(p.department, 'Not set') as label, count(*) as n,
                                    ceil((1 - percentile_cont(0.5) within group (order by r.percentile)) * 100) as median_top_percent
                               from public.ranking_scores r join public.profiles p on p.user_id = r.user_id
                              where r.user_id = any (v_students) and r.ranked and r.percentile is not null group by p.department) g), '[]'::jsonb))))
  on conflict (university_id, area) do update set data = excluded.data, computed_at = now();

  insert into public.uni_stats (university_id, area, data) values (p_university, 'outcomes', jsonb_build_object(
    'contacts', private.hide_small((select count(*) from public.contact_requests c where c.student_id = any (v_students))),
    'contacts_accepted', private.hide_small((select count(*) from public.contact_requests c where c.student_id = any (v_students) and c.status = 'accepted')),
    'applications', private.hide_small((select count(*) from public.job_applications j where j.student_id = any (v_students))),
    'hires', private.hide_small((select count(*) from public.hires h join public.profiles p on p.user_id = h.student_id
                                  where p.university_id = p_university)),
    'hires_90d', private.hide_small((select count(*) from public.hires h join public.profiles p on p.user_id = h.student_id
                                      where p.university_id = p_university and h.hired_at > now() - interval '90 days'))))
  on conflict (university_id, area) do update set data = excluded.data, computed_at = now();

  -- Teachers are university staff: counts per teacher, never student content.
  insert into public.uni_stats (university_id, area, data) values (p_university, 'faculty', jsonb_build_object(
    'teachers', coalesce((select jsonb_agg(jsonb_build_object(
                    'name', p.full_name, 'department', t.department,
                    'reviews', (select count(*) from public.venture_reviews r where r.teacher_id = t.user_id),
                    'supervisions', (select count(*) from public.venture_supervisors v where v.teacher_id = t.user_id and v.status in ('active', 'ended')),
                    'code_checks', (select count(*) from public.code_checks c where c.grader_id = t.user_id),
                    'endorsements', (select count(*) from public.endorsements e where e.endorser_id = t.user_id and e.endorser_kind = 'teacher'),
                    'ideas', (select count(*) from public.project_ideas i where i.teacher_id = t.user_id)) order by t.department, p.full_name)
                   from public.teacher_profiles t join public.profiles p on p.user_id = t.user_id
                  where t.university_id = p_university and t.status = 'approved'), '[]'::jsonb)))
  on conflict (university_id, area) do update set data = excluded.data, computed_at = now();
end;
$$;
revoke all on function private.uni_stats_compute(uuid) from public;

create or replace function private.alert_conditions()
returns table (key text, title text, detail text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_queue record;
  v_oldest timestamptz;
  v_total numeric;
  v_bounced numeric;
  v_p75 numeric;
  v_n integer;
  v_ratio numeric;
begin
  -- Scheduled jobs whose latest finished run failed (pg_cron's own log, and job_runs for jobs that catch their errors).
  -- The alert stays open until a later run succeeds: a nightly job that fails every night is one lasting alert, not a
  -- fire-and-resolve pair each night, and a sub-minute job that misses one start but succeeds on the next never fires.
  return query
  select distinct on (j.jobname) 'job_failed:' || j.jobname, 'Scheduled job failed: ' || j.jobname,
         'pg_cron reported: ' || left(coalesce(d.return_message, 'no message'), 300)
    from cron.job_run_details d join cron.job j on j.jobid = d.jobid
   where d.status = 'failed' and d.end_time > now() - interval '8 days'
     and not exists (select 1 from cron.job_run_details later
                      where later.jobid = d.jobid and later.status = 'succeeded' and later.start_time > d.start_time)
   order by j.jobname, d.end_time desc;

  return query
  select distinct on (r.job) 'job_failed:' || r.job, 'Scheduled job failed: ' || r.job,
         'job_runs: ' || left(coalesce(r.error, 'no error text'), 300)
    from public.job_runs r
   where r.status = 'failed' and r.finished_at > now() - interval '8 days'
     and not exists (select 1 from public.job_runs later
                      where later.job = r.job and later.status = 'succeeded' and later.started_at > r.started_at)
   order by r.job, r.finished_at desc;

  -- Runs longer than twice their usual length (and at least job_slow_minutes).
  return query
  select 'job_slow:' || r.job, 'Scheduled job running long: ' || r.job,
         'Started ' || to_char(r.started_at at time zone 'Asia/Karachi', 'YYYY-MM-DD HH24:MI') || ' PKT, usually takes '
           || coalesce(to_char(m.median, 'HH24:MI:SS'), 'unknown') || '.'
    from public.job_runs r
    left join lateral (
      select percentile_cont(0.5) within group (order by x.finished_at - x.started_at) as median
        from (select finished_at, started_at from public.job_runs
               where job = r.job and status = 'succeeded' order by started_at desc limit 20) x
    ) m on true
   where r.status = 'running'
     and now() - r.started_at > greatest(make_interval(mins => private.alert_limit('job_slow_minutes')::integer),
                                          2 * coalesce(m.median, interval '0'));

  -- Missed schedules: no start for more than twice the job's usual gap (and at least 15 minutes).
  return query
  with runs as (
    select d.jobid, d.start_time,
           d.start_time - lag(d.start_time) over (partition by d.jobid order by d.start_time) as gap
      from cron.job_run_details d
     where d.start_time > now() - interval '3 days'
  ), stats as (
    select jobid, percentile_cont(0.5) within group (order by gap) as median_gap, max(start_time) as last_start, count(*) as n
      from runs group by jobid
  )
  select 'job_missed:' || j.jobname, 'Scheduled job missed its schedule: ' || j.jobname,
         'Last started ' || to_char(s.last_start at time zone 'Asia/Karachi', 'YYYY-MM-DD HH24:MI') || ' PKT; it usually runs every '
           || to_char(s.median_gap, 'HH24:MI:SS') || '.'
    from stats s join cron.job j on j.jobid = s.jobid
   where j.active and s.n >= 4 and s.median_gap is not null
     and now() - s.last_start > greatest(interval '15 minutes', 2 * s.median_gap);

  -- Queues nobody is draining: a message visible for longer than queue_stuck_minutes.
  for v_queue in select queue_name from pgmq.list_queues() loop
    execute format('select min(vt) from pgmq.%I where vt < now() - make_interval(mins => $1)', 'q_' || v_queue.queue_name)
      into v_oldest using private.alert_limit('queue_stuck_minutes')::integer;
    if v_oldest is not null then
      return query select 'queue_stuck:' || v_queue.queue_name::text, 'Queue not draining: ' || v_queue.queue_name::text,
        'A message has waited since ' || to_char(v_oldest at time zone 'Asia/Karachi', 'YYYY-MM-DD HH24:MI')
          || ' PKT. Is its Edge Function deployed and configured?';
    end if;
  end loop;

  -- Payments: webhook signature or storage failures, and stored events not applied.
  select count(*) into v_n from private.service_signals
   where kind in ('billing_webhook_rejected', 'billing_webhook_error') and created_at > now() - interval '15 minutes';
  if v_n > 0 then
    return query select 'payments_webhook'::text, 'Payment webhooks failing'::text,
      v_n || ' gateway webhook(s) refused or failed in the last 15 minutes (bad signature, old timestamp or storage error).';
  end if;
  select count(*) into v_n from public.billing_webhook_events
   where processed_at is null and received_at < now() - interval '15 minutes';
  if v_n > 0 then
    return query select 'payments_processing'::text, 'Payment events not applied'::text,
      v_n || ' stored gateway event(s) have waited more than 15 minutes. See /ops/billing.';
  end if;

  -- Database connections and size.
  select count(*)::numeric / current_setting('max_connections')::numeric into v_ratio from pg_catalog.pg_stat_activity;
  if v_ratio > private.alert_limit('connections_ratio') then
    return query select 'db_connections'::text, 'Database connections high'::text,
      round(v_ratio * 100) || '% of max_connections in use.';
  end if;
  v_ratio := pg_catalog.pg_database_size(current_database())::numeric / private.alert_limit('database_bytes');
  if v_ratio > private.alert_limit('storage_ratio') then
    return query select 'db_size'::text, 'Database near its size limit'::text,
      round(v_ratio * 100) || '% of the plan''s database size (alerts.limits.database_bytes).';
  end if;

  -- File storage against the plan quota.
  select coalesce(sum((o.metadata ->> 'size')::numeric), 0) / nullif((private.config('storage.quota_bytes') #>> '{}')::numeric, 0)
    into v_ratio from storage.objects o;
  if v_ratio > private.alert_limit('storage_ratio') then
    return query select 'storage_quota'::text, 'File storage near its quota'::text,
      round(v_ratio * 100) || '% of storage.quota_bytes used.';
  end if;

  -- Email bounce rate over the last day (Resend webhook).
  select count(*) filter (where kind = 'email_bounced'), count(*) into v_bounced, v_total
    from private.service_signals where kind in ('email_delivered', 'email_bounced') and created_at > now() - interval '1 day';
  if v_total >= private.alert_limit('bounce_min_sample') and v_bounced / v_total > private.alert_limit('bounce_rate') then
    return query select 'email_bounce'::text, 'Email bounce rate high'::text,
      round(v_bounced / v_total * 100, 1) || '% of ' || v_total || ' emails bounced in the last day.';
  end if;

  -- GitHub rate-limit headroom, lowest sample in the last 15 minutes.
  select min(value) into v_ratio from private.service_signals where kind = 'github_headroom' and created_at > now() - interval '15 minutes';
  if v_ratio is not null and v_ratio < private.alert_limit('github_headroom') then
    return query select 'github_headroom'::text, 'GitHub rate limit nearly used'::text,
      round(v_ratio * 100) || '% of a GitHub token''s hourly budget left. Imports slow down until it resets.';
  end if;

  -- Real-user performance: p75 over the last 24 hours.
  select percentile_cont(0.75) within group (order by value), count(*) into v_p75, v_n
    from private.web_vitals where metric = 'LCP' and created_at > now() - interval '1 day';
  if v_n >= private.alert_limit('vitals_min_sample') and v_p75 > private.alert_limit('lcp_ms') then
    return query select 'perf_lcp'::text, 'Pages loading slowly (LCP)'::text,
      'p75 Largest Contentful Paint ' || round(v_p75) || ' ms over the last day (' || v_n || ' samples); target '
        || private.alert_limit('lcp_ms') || ' ms.';
  end if;
  select percentile_cont(0.75) within group (order by value), count(*) into v_p75, v_n
    from private.web_vitals where metric = 'INP' and created_at > now() - interval '1 day';
  if v_n >= private.alert_limit('vitals_min_sample') and v_p75 > private.alert_limit('inp_ms') then
    return query select 'perf_inp'::text, 'Pages responding slowly (INP)'::text,
      'p75 Interaction to Next Paint ' || round(v_p75) || ' ms over the last day (' || v_n || ' samples); target '
        || private.alert_limit('inp_ms') || ' ms.';
  end if;
end;
$$;
revoke all on function private.alert_conditions() from public;
