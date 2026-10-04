-- Alerts and monitoring (PRD 10 "Monitoring" and "Alerts — email only"; phase 13 slice 2).
-- job-watchdog runs every 10 minutes, checks every condition below, and emails the addresses in
-- alerts.recipients through the notify worker (kind ops_alert): once when a condition starts, again
-- after the cooldown while it lasts, and once when it clears. Conditions:
--   failed, slow and missed scheduled jobs (pg_cron's run log and job_runs); queues nobody drains;
--   payment webhook failures; database connections and size; Storage use; email bounce rate;
--   GitHub rate-limit headroom; real-user LCP and INP (p75 over 24 hours).
-- Site down, 5xx rate, new Sentry issues and database CPU come from UptimeRobot, Sentry/Axiom and
-- Grafana, which email on their own (docs/alerts.md).

-- ---------------------------------------------------------------------------
-- Config
-- ---------------------------------------------------------------------------
insert into public.platform_config (key, version, value, reason) values
  ('alerts.recipients', 1, '[]', 'PRD 10: alerts go by email to the founder (on call at launch). Set the address in /ops/config.'),
  ('alerts.limits', 1,
   '{"cooldown_hours": 6, "queue_stuck_minutes": 30, "job_slow_minutes": 10, "connections_ratio": 0.8,
     "storage_ratio": 0.8, "database_bytes": 524288000, "bounce_rate": 0.05, "bounce_min_sample": 20,
     "github_headroom": 0.2, "lcp_ms": 2500, "inp_ms": 200, "vitals_min_sample": 50, "vitals_daily_cap": 20000}',
   'PRD 10 alert thresholds. database_bytes is the plan''s database size (Free 500 MB; raise it on Pro).');
insert into public.config_keys (key, area, description, applies, schema) values
  ('alerts.recipients', 'alerts', 'Email addresses that receive operational alerts (job failures, payments, quotas, performance).', 'now',
   '{"type": "array", "maxItems": 5, "uniqueItems": true, "items": {"type": "string", "format": "email", "maxLength": 254}}'),
  ('alerts.limits', 'alerts', 'Alert thresholds and the cooldown between repeat emails while a problem lasts.', 'now',
   '{"type": "object", "additionalProperties": false,
     "required": ["cooldown_hours", "queue_stuck_minutes", "job_slow_minutes", "connections_ratio", "storage_ratio", "database_bytes",
                  "bounce_rate", "bounce_min_sample", "github_headroom", "lcp_ms", "inp_ms", "vitals_min_sample", "vitals_daily_cap"],
     "properties": {
       "cooldown_hours": {"type": "number", "minimum": 1, "maximum": 168},
       "queue_stuck_minutes": {"type": "integer", "minimum": 5, "maximum": 1440},
       "job_slow_minutes": {"type": "integer", "minimum": 5, "maximum": 1440},
       "connections_ratio": {"type": "number", "exclusiveMinimum": 0, "maximum": 1},
       "storage_ratio": {"type": "number", "exclusiveMinimum": 0, "maximum": 1},
       "database_bytes": {"type": "integer", "minimum": 1},
       "bounce_rate": {"type": "number", "exclusiveMinimum": 0, "maximum": 1},
       "bounce_min_sample": {"type": "integer", "minimum": 1},
       "github_headroom": {"type": "number", "exclusiveMinimum": 0, "maximum": 1},
       "lcp_ms": {"type": "integer", "minimum": 100},
       "inp_ms": {"type": "integer", "minimum": 10},
       "vitals_min_sample": {"type": "integer", "minimum": 1},
       "vitals_daily_cap": {"type": "integer", "minimum": 100}}}');

create function private.alert_limit(p_name text)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select (private.config('alerts.limits') ->> p_name)::numeric;
$$;
revoke all on function private.alert_limit(text) from public;

-- ---------------------------------------------------------------------------
-- Signals the app and workers report (kept 30 days)
-- ---------------------------------------------------------------------------
create table private.service_signals (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('billing_webhook_rejected', 'billing_webhook_error', 'email_delivered', 'email_bounced', 'github_headroom')),
  value numeric not null default 1 check (value >= 0),
  created_at timestamptz not null default now()
);
comment on table private.service_signals is 'Counts and samples for alerts (PRD 10): webhook failures, email delivery, GitHub headroom. Written by record_service_signal.';
create index service_signals_kind_created_idx on private.service_signals (kind, created_at desc);
alter table private.service_signals enable row level security;
revoke all on table private.service_signals from public, anon, authenticated;

create function private.record_service_signal(p_kind text, p_value numeric default 1)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into private.service_signals (kind, value) values (p_kind, coalesce(p_value, 1));
$$;
revoke all on function private.record_service_signal(text, numeric) from public;

-- Called by webhook routes that act for no user (service role) and by the workers.
create function public.record_service_signal(p_kind text, p_value numeric default 1)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.record_service_signal(p_kind, p_value);
$$;
revoke all on function public.record_service_signal(text, numeric) from public, anon, authenticated;
grant execute on function private.record_service_signal(text, numeric) to service_role;
grant execute on function public.record_service_signal(text, numeric) to service_role;

-- ---------------------------------------------------------------------------
-- Real-user Core Web Vitals (Q9): a 10% sample of page loads, kept 14 days
-- ---------------------------------------------------------------------------
create table private.web_vitals (
  id bigint generated always as identity primary key,
  route text not null check (route ~ '^/[A-Za-z0-9/:_.-]{0,120}$'),
  metric text not null check (metric in ('LCP', 'INP', 'CLS')),
  value numeric not null check (value >= 0 and value < 600000),
  created_at timestamptz not null default now()
);
comment on table private.web_vitals is 'Sampled real-user LCP, INP and CLS per route (PRD 10 performance alert). No user, IP or device is stored.';
create index web_vitals_metric_created_idx on private.web_vitals (metric, created_at desc);
alter table private.web_vitals enable row level security;
revoke all on table private.web_vitals from public, anon, authenticated;

-- Anyone may report (the beacon runs for signed-out visitors too); a daily cap bounds what a flood can add.
create function private.record_web_vitals(p_route text, p_metrics jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_metric text;
  v_value numeric;
begin
  if p_route is null or p_route !~ '^/[A-Za-z0-9/:_.-]{0,120}$' or jsonb_typeof(p_metrics) is distinct from 'object' then
    raise exception 'bad vitals' using errcode = '22023';
  end if;
  if (select count(*) from private.web_vitals where created_at > now() - interval '1 day')
     >= private.alert_limit('vitals_daily_cap') then
    return;
  end if;
  for v_metric in select k from jsonb_object_keys(p_metrics) k loop
    if v_metric not in ('LCP', 'INP', 'CLS') or jsonb_typeof(p_metrics -> v_metric) <> 'number' then
      raise exception 'bad vitals' using errcode = '22023';
    end if;
    v_value := (p_metrics ->> v_metric)::numeric;
    if v_value < 0 or v_value >= 600000 then
      raise exception 'bad vitals' using errcode = '22023';
    end if;
    insert into private.web_vitals (route, metric, value) values (p_route, v_metric, v_value);
  end loop;
end;
$$;
revoke all on function private.record_web_vitals(text, jsonb) from public;

create function public.record_web_vitals(p_route text, p_metrics jsonb)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.record_web_vitals(p_route, p_metrics);
$$;
revoke all on function public.record_web_vitals(text, jsonb) from public;
grant execute on function private.record_web_vitals(text, jsonb) to anon, authenticated;
grant execute on function public.record_web_vitals(text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The conditions
-- ---------------------------------------------------------------------------
create function private.alert_conditions()
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
  -- Scheduled jobs that failed in the last 15 minutes (pg_cron's own log, and job_runs for jobs that catch their errors).
  return query
  select distinct on (j.jobname) 'job_failed:' || j.jobname, 'Scheduled job failed: ' || j.jobname,
         'pg_cron reported: ' || left(coalesce(d.return_message, 'no message'), 300)
    from cron.job_run_details d join cron.job j on j.jobid = d.jobid
   where d.status = 'failed' and d.end_time > now() - interval '15 minutes'
   order by j.jobname, d.end_time desc;

  return query
  select distinct on (r.job) 'job_failed:' || r.job, 'Scheduled job failed: ' || r.job,
         'job_runs: ' || left(coalesce(r.error, 'no error text'), 300)
    from public.job_runs r
   where r.status = 'failed' and r.finished_at > now() - interval '15 minutes'
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

-- ---------------------------------------------------------------------------
-- The watchdog: open, repeat and resolve alerts
-- ---------------------------------------------------------------------------
create table private.alert_state (
  key text primary key check (key ~ '^[a-z0-9_:.-]{3,120}$'),
  title text not null,
  detail text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_sent_at timestamptz,
  resolved_at timestamptz
);
comment on table private.alert_state is 'Open and recently resolved alerts, so each is emailed once, repeated after the cooldown and closed once.';
alter table private.alert_state enable row level security;
revoke all on table private.alert_state from public, anon, authenticated;

create function private.queue_alert_email(p_key text, p_state text, p_title text, p_detail text, p_since timestamptz)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  select pgmq.send('notification_emails', jsonb_build_object(
    'kind', 'ops_alert', 'key', p_key, 'state', p_state, 'title', p_title, 'detail', p_detail, 'since', p_since));
$$;
revoke all on function private.queue_alert_email(text, text, text, text, timestamptz) from public;

create function private.job_watchdog()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_run uuid := public.job_run_start('job-watchdog');
  v_started timestamptz := now(); -- rows touched in this run carry this transaction's now()
  v_cooldown interval := make_interval(hours => private.alert_limit('cooldown_hours')::integer);
  v_condition record;
  v_state private.alert_state;
  v_sent integer := 0;
begin
  for v_condition in select distinct on (c.key) c.key, c.title, c.detail from private.alert_conditions() c order by c.key loop
    insert into private.alert_state as s (key, title, detail)
    values (v_condition.key, v_condition.title, v_condition.detail)
    on conflict (key) do update
      set title = excluded.title,
          detail = excluded.detail,
          last_seen_at = now(),
          first_seen_at = case when s.resolved_at is not null then now() else s.first_seen_at end,
          last_sent_at = case when s.resolved_at is not null then null else s.last_sent_at end,
          resolved_at = null
    returning * into v_state;
    if v_state.last_sent_at is null or v_state.last_sent_at < now() - v_cooldown then
      perform private.queue_alert_email(v_state.key, 'firing', v_state.title, v_state.detail, v_state.first_seen_at);
      update private.alert_state set last_sent_at = now() where key = v_state.key;
      v_sent := v_sent + 1;
    end if;
  end loop;

  -- Anything not seen in this run has cleared.
  for v_state in
    update private.alert_state set resolved_at = now()
     where resolved_at is null and last_seen_at < v_started
    returning *
  loop
    if v_state.last_sent_at is not null then
      perform private.queue_alert_email(v_state.key, 'resolved', v_state.title, v_state.detail, v_state.first_seen_at);
      v_sent := v_sent + 1;
    end if;
  end loop;

  -- A failure rolls this run back; pg_cron's log keeps the error, and the next run reports it as job_failed.
  perform public.job_run_finish(v_run, 'succeeded', v_sent);
  return v_sent;
end;
$$;
revoke all on function private.job_watchdog() from public;

-- Monitoring data is short-lived; pg_cron's own run log would otherwise grow forever.
create function private.purge_monitoring()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from private.service_signals where created_at < now() - interval '30 days';
  delete from private.web_vitals where created_at < now() - interval '14 days';
  delete from private.alert_state where resolved_at < now() - interval '90 days';
  delete from cron.job_run_details where end_time < now() - interval '7 days';
$$;
revoke all on function private.purge_monitoring() from public;

select cron.schedule('job-watchdog', '*/10 * * * *', $$select private.job_watchdog()$$);
select cron.schedule('purge-monitoring', '43 3 * * *', $$select private.purge_monitoring()$$);
