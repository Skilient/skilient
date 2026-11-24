-- Scheduled job fixes (2026-11-23): uni-stats runs without nested aggregates, and job_failed alerts stay
-- open until a later run succeeds (so a nightly failure doesn't "resolve" itself, and one missed start of a
-- sub-minute job followed by a success doesn't page).
begin;
select plan(8);

create function pg_temp.firing(p_key text) returns boolean language sql as $$
  select exists (select 1 from private.alert_conditions() where key = p_key);
$$;

-- ---------------------------------------------------------------------------
-- uni-stats
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('63000000-0000-0000-0000-000000000001', 's1@nutech.edu.pk', '{}'),
  ('63000000-0000-0000-0000-000000000002', 's2@nutech.edu.pk', '{}'),
  ('63000000-0000-0000-0000-000000000003', 's3@nutech.edu.pk', '{}'),
  ('63000000-0000-0000-0000-000000000004', 's4@nutech.edu.pk', '{}'),
  ('63000000-0000-0000-0000-000000000005', 's5@nutech.edu.pk', '{}'),
  ('63000000-0000-0000-0000-000000000006', 's6@nutech.edu.pk', '{}');
update public.profiles set department = 'Computer Science', graduation_year = 2027
 where user_id::text like '63000000-%';

select lives_ok($$ select private.uni_stats_run() $$, 'uni-stats runs');
select is((select status::text from public.job_runs where job = 'uni-stats' order by started_at desc limit 1), 'succeeded',
  'and records a successful run (no nested aggregates)');
select is((select data -> 'by_department' -> 0 ->> 'count' from public.uni_stats u
             join public.profiles p on p.university_id = u.university_id
            where p.user_id = '63000000-0000-0000-0000-000000000001' and u.area = 'adoption'),
  '6', 'groups are still counted per department');

-- ---------------------------------------------------------------------------
-- job_failed stays open until the job succeeds again
-- ---------------------------------------------------------------------------
insert into public.job_runs (job, status, started_at, finished_at, error)
values ('nightly-test', 'failed', now() - interval '3 hours', now() - interval '3 hours' + interval '2 minutes', 'boom');
select ok(pg_temp.firing('job_failed:nightly-test'), 'a failure hours ago with no success since is still an alert');
insert into public.job_runs (job, status, started_at, finished_at)
values ('nightly-test', 'succeeded', now() - interval '5 minutes', now() - interval '4 minutes');
select ok(not pg_temp.firing('job_failed:nightly-test'), 'a later successful run clears it');

select cron.schedule('fast-test', '10 seconds', 'select 1');
insert into cron.job_run_details (jobid, runid, database, username, command, status, return_message, start_time, end_time)
select jobid, 9630001, 'postgres', 'postgres', 'select 1', 'failed', 'job startup timeout', now() - interval '60 seconds', now() - interval '50 seconds'
  from cron.job where jobname = 'fast-test';
select ok(pg_temp.firing('job_failed:fast-test'), 'a pg_cron failure with no success since is an alert');
insert into cron.job_run_details (jobid, runid, database, username, command, status, return_message, start_time, end_time)
select jobid, 9630002, 'postgres', 'postgres', 'select 1', 'succeeded', '1 row', now() - interval '40 seconds', now() - interval '40 seconds'
  from cron.job where jobname = 'fast-test';
select ok(not pg_temp.firing('job_failed:fast-test'), 'a startup timeout followed by a successful start is not');

insert into public.job_runs (job, status, started_at, finished_at, error)
values ('old-test', 'failed', now() - interval '9 days', now() - interval '9 days', 'long ago');
select ok(not pg_temp.firing('job_failed:old-test'), 'failures older than 8 days are not looked at');

select * from finish();
rollback;
