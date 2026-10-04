-- Alerts (PRD 10; phase 13 slice 2). Each condition the watchdog checks, the email it queues (once,
-- again after the cooldown, and once when the condition clears), and who may write the inputs.
-- pgTAP runs in one transaction, so "later runs" are simulated by moving the stored times back.
begin;
select plan(28);

create function pg_temp.firing(p_key text) returns boolean language sql as $$
  select exists (select 1 from private.alert_conditions() where key = p_key);
$$;
create function pg_temp.emails(p_key text, p_state text) returns integer language sql as $$
  select count(*)::integer from pgmq.q_notification_emails
   where message ->> 'kind' = 'ops_alert' and message ->> 'key' = p_key and message ->> 'state' = p_state;
$$;

-- Start from no signals: worker tests on the same local database leave real ones behind.
delete from private.service_signals;
delete from private.web_vitals;
delete from private.alert_state;

-- ---------------------------------------------------------------------------
-- Config and who may write
-- ---------------------------------------------------------------------------
select is(private.config('alerts.recipients'), '[]'::jsonb, 'no recipients until staff set one in /ops/config');
select ok(exists (select 1 from public.config_keys where key = 'alerts.limits') and exists (select 1 from public.config_keys where key = 'alerts.recipients'),
  'both alert settings are editable in /ops/config');
select ok(not has_function_privilege('anon', 'public.record_service_signal(text, numeric)', 'execute')
      and not has_function_privilege('authenticated', 'public.record_service_signal(text, numeric)', 'execute')
      and has_function_privilege('service_role', 'public.record_service_signal(text, numeric)', 'execute'),
  'only the service role (webhooks, workers) reports service signals');
select ok(has_function_privilege('anon', 'public.record_web_vitals(text, jsonb)', 'execute'),
  'any visitor may report web vitals');
select ok((select bool_and(relrowsecurity) from pg_class
            where oid in ('private.service_signals'::regclass, 'private.web_vitals'::regclass, 'private.alert_state'::regclass))
      and not has_table_privilege('authenticated', 'private.web_vitals', 'select')
      and not has_table_privilege('anon', 'private.alert_state', 'select'),
  'the monitoring tables are closed');

set local role anon;
select lives_ok($$ select public.record_web_vitals('/feed', '{"LCP": 1800, "INP": 90, "CLS": 0.02}') $$, 'a beacon is stored');
select throws_ok($$ select public.record_web_vitals('/feed', '{"FID": 10}') $$, '22023', null, 'unknown metrics are refused');
select throws_ok($$ select public.record_web_vitals('/profile/amna?x=1', '{"LCP": 10}') $$, '22023', null, 'routes with a query are refused');
select throws_ok($$ select public.record_web_vitals('/feed', '{"LCP": -1}') $$, '22023', null, 'impossible values are refused');
reset role;
select is((select count(*)::integer from private.web_vitals where route = '/feed'), 3, 'one row per metric, nothing about the visitor');

-- ---------------------------------------------------------------------------
-- Conditions
-- ---------------------------------------------------------------------------
insert into public.job_runs (job, status, started_at, finished_at, error)
values ('feed-stage', 'failed', now() - interval '2 minutes', now() - interval '1 minute', 'boom');
select ok(pg_temp.firing('job_failed:feed-stage'), 'a job that failed in the last 15 minutes is an alert');

insert into public.job_runs (job, status, started_at) values ('ranking-nightly', 'running', now() - interval '3 hours');
select ok(pg_temp.firing('job_slow:ranking-nightly'), 'a run far longer than usual is an alert');

select pgmq.send('github_jobs', '{"stage": "alert-test"}'::jsonb);
update pgmq.q_github_jobs set vt = now() - interval '2 hours' where message ->> 'stage' = 'alert-test';
select ok(pg_temp.firing('queue_stuck:github_jobs'), 'a queue nobody drains is an alert');

select private.record_service_signal('billing_webhook_rejected');
select ok(pg_temp.firing('payments_webhook'), 'a refused payment webhook is an alert');

select private.record_service_signal('email_delivered') from generate_series(1, 19);
select ok(not pg_temp.firing('email_bounce'), 'no bounces, no alert');
select private.record_service_signal('email_bounced') from generate_series(1, 2);
select ok(pg_temp.firing('email_bounce'), 'more than 5% bounced over a day is an alert');

select private.record_service_signal('github_headroom', 0.5);
select ok(not pg_temp.firing('github_headroom'), 'half the GitHub budget left is fine');
select private.record_service_signal('github_headroom', 0.1);
select ok(pg_temp.firing('github_headroom'), 'under 20% left is an alert');

insert into private.web_vitals (route, metric, value) select '/feed', 'LCP', 3400 from generate_series(1, 60);
insert into private.web_vitals (route, metric, value) select '/feed', 'INP', 80 from generate_series(1, 60);
select ok(pg_temp.firing('perf_lcp'), 'p75 LCP over 2.5 s across the day is an alert');
select ok(not pg_temp.firing('perf_inp'), 'INP under its target is not');

-- ---------------------------------------------------------------------------
-- The watchdog: once, quiet during the cooldown, again after it, and once when it clears
-- ---------------------------------------------------------------------------
select private.job_watchdog();
select is(pg_temp.emails('payments_webhook', 'firing'), 1, 'the first run emails each new alert once');
select private.job_watchdog();
select is(pg_temp.emails('payments_webhook', 'firing'), 1, 'a second run inside the cooldown sends nothing');

update private.alert_state set last_sent_at = now() - interval '7 hours' where key = 'payments_webhook';
select private.job_watchdog();
select is(pg_temp.emails('payments_webhook', 'firing'), 2, 'after the cooldown a lasting alert is sent again');

-- The payment failure clears; time moves on.
delete from private.service_signals where kind = 'billing_webhook_rejected';
update private.alert_state set last_seen_at = last_seen_at - interval '10 minutes';
select private.job_watchdog();
select is(pg_temp.emails('payments_webhook', 'resolved'), 1, 'a cleared alert sends one "resolved" email');
select ok((select resolved_at is not null from private.alert_state where key = 'payments_webhook'), 'and is closed');
select ok((select resolved_at is null from private.alert_state where key = 'github_headroom'), 'alerts still true stay open');

select ok((select status = 'succeeded' from public.job_runs where job = 'job-watchdog' order by started_at desc limit 1),
  'the watchdog records its own runs');
select ok(exists (select 1 from cron.job where jobname = 'job-watchdog' and schedule = '*/10 * * * *'),
  'it runs every 10 minutes');

select * from finish();
rollback;
