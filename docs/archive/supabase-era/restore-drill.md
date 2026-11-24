# Restore drill

PRD 10 "Backups": one full restore into a scratch project before launch. Supabase is on the Free plan, which keeps no
daily backups (decisions 2026-09-28), so the drill restores a **logical dump** taken by the workflow (phase 13
question 16). Once production moves to Pro before the beta, repeat it from a daily backup (below).

## What a database dump does and doesn't carry

| Carried | Not carried, and what the drill does about it |
| --- | --- |
| Schema, functions, RLS policies, migrations history | — |
| All rows, including `auth.users` (password hashes too) and `storage.objects` rows | — |
| | **Storage files**: copied bucket by bucket (`scripts/restore/copy-storage.mjs`). |
| | **Vault secrets** don't decrypt in another project: the worker secrets, `project_url` and `cv_export_secret` are recreated (`scripts/restore/reseed-vault.sql`). |
| | **CV signing key** (private, Vault only): a new key is rotated in. Every CV signed before still verifies, because `signing_keys` (public keys) is restored, and the public keys are also backed up in `docs/signing-keys/`. |
| | **GitHub tokens** (Vault): students reconnect GitHub; their imported evidence is restored. |
| | **Edge Functions and their secrets**: functions are deployed from the repo; their secrets (`BREVO_API_KEY`, `APP_URL`, GitHub App, gateways) are set by hand and the drill doesn't need them. Restore Brevo delivery tombstones and webhook receipts with the database; see `docs/email-brevo-migration.md`. |
| | **Auth settings** (templates, redirect URLs, SMTP, hooks) live in the project's settings, not the database: copy them from `supabase/config.toml` and `docs/setup-checklist.md` in a real recovery. |
| | **Our objects on Supabase-managed schemas** (`auth`, `storage`, `realtime`): `supabase db dump` leaves them out. The drill re-creates them from production: Storage and Realtime access policies and our triggers on `auth.users` (`scripts/restore/managed-objects.sql`), the job queues (`pgmq.create` per queue in `pgmq.meta`), the scheduled jobs (`cron.job`), and the CLI's migration history (`supabase_migrations`, dumped by name). The compare step counts all of them. |
| | **Queued jobs** (pgmq rows) aren't restored: the queues are, and the workers rebuild missing work on their next tick. |
| | **Supabase-only tables** the hosted `postgres` user can't write (vector and analytics buckets, iceberg tables) are skipped; the run summary lists each with the rows production had, and the compare step reports any `auth` or `storage` count that differs. |
| | **Platform parameter grants** in the role dump (`GRANT SET ON PARAMETER log_min_messages TO supabase_realtime_admin`) are skipped: a fresh project already has them and only a superuser may make them. |

## Running the drill

1. **A fresh scratch project.** Supabase → New project, region Mumbai (`ap-south-1`), same plan as production, named
   `skilient-scratch`. If one exists from an earlier drill, delete it and create it again: the restore refuses a
   database that already has tables. Save its database password.
2. **Repository secrets** (GitHub → Settings → Secrets and variables → Actions): `SCRATCH_SUPABASE_PROJECT_REF`,
   `SCRATCH_SUPABASE_DB_PASSWORD`. The production secrets already exist for the migrate job. The access token must belong
   to an account that can see both projects.
3. **Run it:** start the self-hosted runner (`docs/self-hosted-runner.md`), then Actions → Restore drill → Run workflow,
   type `restore into scratch`. The summary records how long the dump and the restore took. From Pakistan the whole
   run takes about 25 minutes; from GitHub's US runners the restore alone took 34.
4. **Read the summary** on the run's page: every check must pass and `/api/health` must answer 200. The report is attached
   to the run (counts only, no personal data; the dump itself is never uploaded).
5. **Sign in** on the scratch project once to see real data behind RLS: point a local `pnpm dev` at it
   (`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the scratch project) and sign in with a test
   account. Don't send email from scratch.
6. **Record the result** in the table below, then **delete the scratch project** (it holds a copy of everyone's data),
   or pause it until the load test (slice 5), which starts it fresh anyway.

If a check fails: the summary names it. The first runs failed on objects outside our schemas, each now handled
(decisions.md, 2026-11-05 restore drill entries). A new failure is most likely another object a migration put in a
Supabase-managed schema: add it to `scripts/restore/managed-objects.sql` and to the compare step.

## A real recovery

The same steps restore into a **new** project when production is lost. Then also: set the Edge Function secrets and
Auth settings by hand (setup checklist), point Vercel's `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` and `CV_EXPORT_SECRET` (the new `cv_export_secret`) at it, update the GitHub repository
secrets, commit the new public key to `docs/signing-keys/`, and tell students to reconnect GitHub.

**On Pro (before the beta):** Supabase → Database → Backups → restore a daily backup into the scratch project instead of
the dump, then run only the checks (`PROD_DB_URL=… SCRATCH_DB_URL=… node scripts/restore/verify.mjs`). A backup restored
into the same project keeps Vault, so nothing needs re-creating.

## Results

| Date | Source | Dump | Restore | Rows | Checks | `/api/health` | By |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-05 | Production (Free plan, 64 migrations) → scratch, self-hosted runner in Pakistan ([run 8](https://github.com/Skilient/skilient/actions/runs/42063493493)) | 3.4 min | 11.2 min (25 min end to end) | 47,530 → 47,524 (6 rows written to production during the run) | Migrations 64/64, tables 243/243, policies 135/135, functions 1,518/1,518, cron 47/47, our triggers on managed tables 10/10, Vault re-created 15/15 readable; Storage 8 of 8 files | 200 (database 191 ms, storage 495 ms, realtime 1.3 s) | Ahmed, Claude |

Runs 1–7 the same day each stopped on something `supabase db dump` doesn't carry or the hosted `postgres` user may not
do; the fixes are in decisions.md. Run 8 printed the scratch-only VAPID key pair in its log (fixed: the step is now
masked and quiet); the scratch project, and with it those keys, is deleted after the load test.
