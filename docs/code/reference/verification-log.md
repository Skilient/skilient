Commit: dee328c
Covers: claims the docs could not confirm from code, and code-level findings made while writing them (CONVENTIONS, "Verification")

# Verification log

Stages 4 to 6 append rows; stage 8 re-checks them; the last stage 7 session de-duplicates and sorts them.

## Unconfirmed

Things the docs rely on that live outside the repository. They are stated in the docs only as "outside the repo".

| # | Claim | Why it can't be confirmed from code | Lead | Doc |
|---|---|---|---|---|
| 1 | Server log lines reach Axiom | No code or config in the repo sends them; `lib/log.ts` writes to the console only [src: lib/log.ts#defaultSink] | `docs/prd/10-non-functional-requirements.md` line 67 names a Vercel integration log drain | architecture/overview |
| 2 | How and when a commit on `main` is deployed to Vercel production | No workflow deploys the Next app, and `vercel.json` holds only the framework, region, install and build commands [src: vercel.json#"framework": "nextjs"]; nothing orders the deploy after `migrate-production` | Vercel project settings (Git integration) | architecture/environments-and-deploy |
| 3 | The Vault secret `project_url` is set in production | Migrations say it is set once in the dashboard [src: supabase/migrations/20260927224500_github_connect.sql#), set once in the]; without it every wake function is a no-op | `docs/setup-checklist.md` | architecture/background-jobs |
| 4 | Edge Function secrets in production (`GITHUB_APP_*`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`, `POSTHOG_*`, `SITE_URL`, `BILLING_*`, gateway keys) | Set by hand on the project, not by CI [src: .github/workflows/ci.yml#GitHub App secrets are set on the project once by hand] | `docs/setup-checklist.md`; `supabase secrets list` on the project | architecture/environments-and-deploy |
| 5 | `SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` exist in the Edge Function environment, and `VERCEL*` variables in the Next runtime | Read by code [src: supabase/functions/notify-worker/index.ts#Deno.env.get("SUPABASE_DB_URL")] [src: app/layout.tsx#process.env.VERCEL] but never set in the repo | Supabase and Vercel platform documentation | architecture/environments-and-deploy |

## Findings

Code-level facts found while writing that look unintended. Documented as built; not fixed.

| # | Finding | Evidence | Doc |
|---|---|---|---|
| 1 | Deleted organisation documents are never removed from Storage. `queue_storage_cleanup` accepts the `org-documents` bucket, but the `storage-cleanup` worker's bucket list lacks it, so it archives those messages as `bad_message` | [src: supabase/migrations/20261030000000_ops_wrapup.sql#'university-claims', 'university-media', 'org-documents'] [src: supabase/functions/_shared/storage/cleanup.ts#const BUCKETS] [src: supabase/functions/_shared/storage/cleanup.ts#reason: "bad_message"] | architecture/background-jobs |
| 2 | A redelivered Resend webhook is counted twice for the bounce-rate alert: only the signal kind is stored, with no event id | [src: lib/monitoring/resend-webhook.ts#await opts.record(signal)] [src: app/api/webhooks/resend/route.ts#only the signal kind is stored] | architecture/background-jobs |
| 3 | A failed nightly ranking run can't be retried the same Pakistan day: `ranking_start` does nothing when a run for that date exists, and `ranking_step` only works unfinished runs | [src: supabase/migrations/20261005000000_ranking.sql#on conflict (run_on) do nothing] [src: supabase/migrations/20261005000000_ranking.sql#select * into r from public.ranking_runs where finished_at is null order by id limit 1 for update skip locked;] | subsystems/ranking |
| 4 | Scores depend on settings outside the ranking formula version: post quality reads `feed.score`, teacher endorsement weight reads `teacher.limits` | [src: supabase/migrations/20261005000000_ranking.sql#sc jsonb := coalesce(private.config('feed.score'), '{}'::jsonb);] [src: supabase/migrations/20261012000000_teacher_portal.sql#case when n.endorser_kind = 'teacher' then private.teacher_limit('endorsement_weight')] | subsystems/ranking |
| 5 | The score page hard-codes formula v1 values: component caps for the progress bars and the 14-day tier drop date | [src: lib/ranking/labels.ts#work: { label: "Work", layer: "Proof", max: 1125,] [src: lib/data/ranking.ts#Date.parse(belowSince) + 14 * 86_400_000] | subsystems/ranking |
