-- Phase 13 load test follow-up (decisions 2026-11-05): the scheduled jobs alone used about 560 s of
-- database time an hour on a Nano server with 5,000 students and 20,000 posts, before any user arrived.
--
-- 1. feed-stage recomputed every post of the last 14 days every 5 minutes (about 9,000 posts, 6 s a run,
--    43 s at worst). A stage only changes when the post's stats change, when a post leaves 'seed' with
--    time, or when the post is new. Those are the candidates now; the first run of each hour still sweeps
--    the whole window (friendships and config edits change stages without touching post_stats).
-- 2. Nine cron jobs did nothing every minute but look at a queue and, if it had messages, wake an Edge
--    Function. Each one cost a cron connection a minute. They are now one job, wake-workers, that wakes
--    them in turn; a failure in one doesn't stop the rest and is raised at the end so job-watchdog still
--    alerts on it (by name, in the message).

create index if not exists post_stats_updated_at_idx on public.post_stats (updated_at);

create or replace function private.feed_stage_job()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_run uuid;
  v_changed integer := 0;
  r record;
  v_new public.post_stage;
  v_full boolean := extract(minute from now()) < 5;
  v_recent interval := interval '15 minutes';
begin
  v_run := public.job_run_start('feed-stage', jsonb_build_object('full_sweep', v_full));
  begin
    for r in
      select p.id, p.stage
        from public.posts p
        left join public.post_stats s on s.post_id = p.id
       where p.created_at > now() - make_interval(days => coalesce((private.config('feed.window')->>'shipped_age_days')::integer, 14))
         and (v_full
              or p.stage = 'seed'
              or p.created_at > now() - v_recent
              or s.updated_at > now() - v_recent)
    loop
      v_new := private.compute_stage(r.id);
      if v_new is not null and v_new is distinct from r.stage then
        update public.posts set stage = v_new, stage_changed_at = now() where id = r.id;
        v_changed := v_changed + 1;
      end if;
    end loop;
  exception when others then
    perform public.job_run_finish(v_run, 'failed', v_changed, sqlerrm);
    return v_changed;
  end;
  perform public.job_run_finish(v_run, 'succeeded', v_changed);
  return v_changed;
end;
$$;
revoke all on function private.feed_stage_job() from public;

create function private.wake_workers()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_worker text;
  v_failed text[] := '{}';
begin
  foreach v_worker in array array['github', 'notify', 'link_preview', 'storage_cleanup', 'cv', 'webhook', 'billing', 'analytics', 'record'] loop
    begin
      execute format('select private.%I()', 'wake_' || v_worker || '_worker');
    exception when others then
      v_failed := v_failed || (v_worker || ': ' || left(sqlerrm, 200));
    end;
  end loop;
  if cardinality(v_failed) > 0 then
    raise exception 'wake-workers: %', array_to_string(v_failed, '; ');
  end if;
end;
$$;
revoke all on function private.wake_workers() from public;

select cron.unschedule(jobname)
  from cron.job
 where jobname in ('github-worker', 'notify-worker', 'link-preview-worker', 'storage-cleanup-worker', 'cv-worker',
                   'webhook-worker', 'billing-worker', 'analytics-worker', 'record-worker');
select cron.schedule('wake-workers', '* * * * *', $$select private.wake_workers()$$);
