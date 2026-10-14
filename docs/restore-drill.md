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

## Running the drill

1. **A fresh scratch project.** Supabase → New project, region Mumbai (`ap-south-1`), same plan as production, named
   `skilient-scratch`. If one exists from an earlier drill, delete it and create it again: the restore refuses a
   database that already has tables. Save its database password.
2. **Repository secrets** (GitHub → Settings → Secrets and variables → Actions): `SCRATCH_SUPABASE_PROJECT_REF`,
   `SCRATCH_SUPABASE_DB_PASSWORD`. The production secrets already exist for the migrate job. The access token must belong
   to an account that can see both projects.
3. **Run it:** Actions → Restore drill → Run workflow, type `restore into scratch`. The summary records how long the
   dump and the restore took.
4. **Read the summary** on the run's page: every check must pass and `/api/health` must answer 200. The report is attached
   to the run (counts only, no personal data; the dump itself is never uploaded).
5. **Sign in** on the scratch project once to see real data behind RLS: point a local `pnpm dev` at it
   (`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the scratch project) and sign in with a test
   account. Don't send email from scratch.
6. **Record the result** in the table below, then **delete the scratch project** (it holds a copy of everyone's data),
   or pause it until the load test (slice 5), which starts it fresh anyway.

If a check fails: the summary names it. Possible causes: cron jobs missing (the data dump didn't include
`cron.job`: run the `cron.schedule` statements from the migrations, then note it here) or a table emptied by a
`truncate` in a migration replayed by the schema dump.

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
| | | | | | | | |
