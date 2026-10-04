# Alerts

PRD 10 "Alerts — email only". Every alert, where it comes from, and how to prove it works. Database alerts are checked by
`job-watchdog` (pg_cron, every 10 minutes, `supabase/migrations/20261105000000_alerts.sql`) and emailed through the notify
worker (kind `ops_alert`) to every address in `/ops/config` → `alerts.recipients`. Outside services send their own email.

## How the watchdog behaves

- `private.alert_conditions()` lists what is wrong right now: one row per alert key (`job_failed:feed-stage`, …).
- `private.alert_state` remembers each key. A new key emails once ("[Skilient alert] …"); a key still true emails again
  only after `alerts.limits.cooldown_hours` (6); a key that stops being true emails once "[Skilient resolved] …".
- Alert emails ignore the 60-a-day notification cap and are never written to `email_sends`.
- No recipients set → the messages are dropped (logged as `no_recipients`). Set one before launch.
- Thresholds live in `alerts.limits` (editable in `/ops/config`, schema-checked).
- Inputs: `private.service_signals` (webhook failures, email delivered/bounced, GitHub headroom; 30 days) and
  `private.web_vitals` (10% of page loads; 14 days). `purge-monitoring` trims both nightly, plus resolved alerts after
  90 days and `cron.job_run_details` after 7 days.

## The alerts

| Alert | Source | Key / rule | How to test |
| --- | --- | --- | --- |
| Site down | UptimeRobot, `/` and `/api/health` every 5 min | 2 failed checks | Pause the Supabase project (scratch) or point a monitor at a 500 URL; email within 10 min |
| Server errors (5xx > 1% for 5 min) | Interim: Sentry error-volume alert (question 12); Axiom monitor once on Vercel Pro | Sentry rule | Throw from `/api/health?sentry-test` on a preview with the rule scoped to it |
| New error | Sentry "A new issue is created" (production) | Sentry rule | Same as above; one email per new issue |
| Job failed | watchdog | `job_failed:<job>`: a `cron.job_run_details` or `job_runs` failure in the last 15 min | pgTAP `55`; in production run a job by hand that fails, e.g. `select cron.schedule('alert-test', '* * * * *', 'select 1/0')`, then unschedule |
| Job slow | watchdog | `job_slow:<job>`: a `job_runs` row running longer than twice its median and over `job_slow_minutes` | pgTAP `55` |
| Job missed | watchdog | `job_missed:<job>`: an active cron job with no start for twice its usual gap (at least 15 min; 4+ runs in 3 days) | pgTAP `55` covers the query; in production it fires when pg_cron itself stops |
| Queue stuck | watchdog | `queue_stuck:<queue>`: a visible message older than `queue_stuck_minutes` | pgTAP `55` |
| Payments | `/api/billing/webhook/[gateway]` records `billing_webhook_rejected` (bad signature, bad body) and `billing_webhook_error` (failed to record) | `payments_webhook` (any in the last 15 min); `payments_processing` (a stored event unprocessed > 15 min) | Send an unsigned POST to `/api/billing/webhook/simulated` on a preview |
| Database connections | watchdog | `db_connections`: `pg_stat_activity` / `max_connections` > 80% | pgTAP checks the query runs; in production lower `connections_ratio` to 0.01 for one run |
| Database CPU | Grafana Cloud, Supabase metrics endpoint | CPU > 80% for 10 min | Grafana rule "Test" button (question 10) |
| Database size | watchdog | `db_size`: `pg_database_size` > 80% of `database_bytes` | Lower `database_bytes` in `/ops/config` for one run |
| Storage | watchdog | `storage_quota`: `storage.objects` total > 80% of `storage.quota_bytes` | As above with the storage figure |
| Email | Resend webhook → `/api/webhooks/resend` (Svix-signed) | `email_bounce`: bounced / (delivered + bounced) > 5% over 24 h, at least 20 sends | pgTAP `55`; Resend "Send test event" for `email.bounced` |
| GitHub | `github-worker` records the lowest share of the core budget left after each run | `github_headroom`: lowest value in the last 15 min < 20% | pgTAP `55`; unit `github.test.ts` |
| Performance | `components/analytics/web-vitals.tsx` → `/api/vitals` → `record_web_vitals` | `perf_lcp` / `perf_inp`: p75 over 24 h above 2.5 s / 200 ms, at least 50 samples | pgTAP `55` |

## After deploy

1. `/ops/config` → `alerts.recipients` → `["you@…"]`.
2. Check the pipe end to end: `select private.queue_alert_email('test', 'firing', 'Test alert', 'Ignore me', now());` in
   the SQL editor. The email arrives within a minute (notify worker).
3. Resend webhook, Sentry rules, Grafana and UptimeRobot: `docs/setup-checklist.md` Phase 13.
