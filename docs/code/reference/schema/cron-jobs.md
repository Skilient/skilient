Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# cron-jobs

## cron.account-deletion

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.account_deletion_run()",
  "schedule": "17 * * * *"
}
```

## cron.analytics-worker

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.wake_analytics_worker()",
  "schedule": "* * * * *"
}
```

## cron.billing-events

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.billing_process_events()",
  "schedule": "10 seconds"
}
```

## cron.billing-purge

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "delete from public.billing_webhook_events where received_at < now() - interval '400 days' and processed_at is not null",
  "schedule": "41 3 * * *"
}
```

## cron.billing-tick

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.billing_tick_job()",
  "schedule": "*/5 * * * *"
}
```

## cron.billing-worker

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.wake_billing_worker()",
  "schedule": "* * * * *"
}
```

## cron.close-expired-jobs

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.close_expired_jobs()",
  "schedule": "17 19 * * *"
}
```

## cron.code-checks-tick

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.code_checks_tick()",
  "schedule": "*/5 * * * *"
}
```

## cron.competition-freeze

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.wake_competition_freeze()",
  "schedule": "*/5 * * * *"
}
```

## cron.competitions-tick

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.competitions_tick()",
  "schedule": "*/10 * * * *"
}
```

## cron.contact-expiry

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.expire_contact_requests()",
  "schedule": "7 * * * *"
}
```

## cron.credentials-daily

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.credentials_daily()",
  "schedule": "13 19 * * *"
}
```

## cron.cv-exports-daily

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.cv_exports_daily()",
  "schedule": "23 19 * * *"
}
```

## cron.cv-refresh

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.cv_refresh_start()",
  "schedule": "30 19 28-31 * *"
}
```

## cron.cv-worker

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.wake_cv_worker()",
  "schedule": "* * * * *"
}
```

## cron.feed-stage

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.feed_stage_job()",
  "schedule": "*/5 * * * *"
}
```

## cron.github-nightly-sync

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.github_nightly_sync()",
  "schedule": "17 21 * * *"
}
```

## cron.github-worker

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.wake_github_worker()",
  "schedule": "* * * * *"
}
```

## cron.graduate-rollover

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.graduate_rollover()",
  "schedule": "10 19 * * *"
}
```

## cron.hire-outcome

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.ask_hire_outcomes()",
  "schedule": "11 5 * * *"
}
```

## cron.job-watchdog

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.job_watchdog()",
  "schedule": "*/10 * * * *"
}
```

## cron.link-preview-worker

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.wake_link_preview_worker()",
  "schedule": "* * * * *"
}
```

## cron.marketing-stats

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.refresh_landing_stats()",
  "schedule": "17 * * * *"
}
```

## cron.notification-digest

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.queue_notification_digests()",
  "schedule": "7 13 * * *"
}
```

## cron.notify-worker

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.wake_notify_worker()",
  "schedule": "* * * * *"
}
```

## cron.ops-metrics

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.refresh_ops_metrics()",
  "schedule": "23 * * * *"
}
```

## cron.org-spam-check

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.check_org_spam()",
  "schedule": "29 4 * * *"
}
```

## cron.purge-analytics

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.purge_analytics_queue()",
  "schedule": "47 3 * * *"
}
```

## cron.purge-feed-sessions

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "delete from public.feed_sessions where created_at < now() - interval '1 day'",
  "schedule": "53 3 * * *"
}
```

## cron.purge-github-data

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.purge_github_data()",
  "schedule": "37 3 * * *"
}
```

## cron.purge-link-previews

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "delete from public.link_previews where fetched_at < now() - interval '30 days'",
  "schedule": "41 3 * * *"
}
```

## cron.purge-monitoring

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.purge_monitoring()",
  "schedule": "43 3 * * *"
}
```

## cron.purge-notifications

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.purge_notifications()",
  "schedule": "23 3 * * *"
}
```

## cron.purge-security-data

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.purge_security_data()",
  "schedule": "23 3 * * *"
}
```

## cron.ranking-nightly

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.ranking_start()",
  "schedule": "7 22 * * *"
}
```

## cron.ranking-step

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.ranking_step()",
  "schedule": "* * * * *"
}
```

## cron.saved-searches

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.run_saved_searches()",
  "schedule": "23 * * * *"
}
```

## cron.sponsorship-sync

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.sponsorship_sync_job()",
  "schedule": "15 20 * * *"
}
```

## cron.storage-cleanup-worker

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.wake_storage_cleanup_worker()",
  "schedule": "* * * * *"
}
```

## cron.talent-index-refresh

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.refresh_talent_index()",
  "schedule": "*/15 * * * *"
}
```

## cron.teacher-digest

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.queue_teacher_digests()",
  "schedule": "0 4 * * 1"
}
```

## cron.teacher-reminders

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.teacher_reminders()",
  "schedule": "7 * * * *"
}
```

## cron.uni-daily

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.uni_daily()",
  "schedule": "23 19 * * *"
}
```

## cron.uni-events-hourly

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.uni_events_hourly()",
  "schedule": "17 * * * *"
}
```

## cron.uni-stats

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.uni_stats_run()",
  "schedule": "37 22 * * *"
}
```

## cron.webhook-purge

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "delete from public.api_webhook_deliveries where created_at < now() - interval '30 days'",
  "schedule": "37 3 * * *"
}
```

## cron.webhook-worker

[src: scripts/docs/schema-fingerprint.sql#cron.job]

```json
{
  "active": true,
  "command": "select private.wake_webhook_worker()",
  "schedule": "* * * * *"
}
```
