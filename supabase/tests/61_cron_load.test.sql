-- Scheduled jobs after the load test (migration 20261115000000_cron_load.sql).
begin;
select plan(7);

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

select * from finish();
rollback;
