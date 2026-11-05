-- Scheduled jobs after the load test (migration 20261115000000_cron_load.sql).
begin;
select plan(10);

select ok(exists (select 1 from cron.job where jobname = 'wake-workers' and schedule = '* * * * *'), 'one job wakes the workers every minute');
select is((select count(*)::int from cron.job where jobname in ('github-worker', 'notify-worker', 'link-preview-worker',
  'storage-cleanup-worker', 'cv-worker', 'webhook-worker', 'billing-worker', 'analytics-worker', 'record-worker')), 0,
  'the nine single-worker jobs are gone');
select lives_ok($$select private.wake_workers()$$, 'waking with empty queues does nothing and does not fail');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'post_stats_updated_at_idx'), 'post_stats is indexed by updated_at');

select lives_ok($$select private.feed_stage_job()$$, 'feed-stage runs');
select ok((select (meta->>'full_sweep') is not null from public.job_runs where job = 'feed-stage' order by started_at desc limit 1),
  'each run records whether it swept the whole window');
select is((select status from public.job_runs where job = 'feed-stage' order by started_at desc limit 1), 'succeeded', 'and succeeds');

-- Two-step feed ranking (20261115000001_feed_two_step.sql).
select is((private.config('feed.window') ->> 'score_pool')::integer, 1000, 'the feed scores at most 1,000 posts by default');
select ok(extensions.jsonb_matches_schema((select schema from public.config_keys where key = 'feed.window')::json, private.config('feed.window')),
  'and the setting is editable in /ops/config (its schema accepts the value)');
select ok(pg_get_functiondef('private.build_feed(uuid,public.post_audience,text,uuid[])'::regprocedure) like '%by_talk <= v_pool / 2%',
  'build_feed narrows to the pool before it scores');

select * from finish();
rollback;
