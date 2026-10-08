# Documentation plan

One row per source file or folder, and the doc(s) that cover it. `node scripts/docs/coverage.mjs`
checks tracked source files against this file; `--headers` checks the `Docs:` header instead
(stage 10). A folder row (trailing slash) covers everything under it unless a more specific row
says otherwise.

This file grows stage by stage. Stage 2 populated `docs/code/reference/schema/*` (generated) and
`docs/code/reference/{live-inventory,drift}.md` from the database and Edge Functions; it did not
write rows here. Stage 4 adds the architecture docs below. Subsystem docs
(`docs/code/subsystems/*`) and the remaining reference/howto docs are future stages.

| Path | Covered by |
| --- | --- |
| `app/` | `docs/code/architecture/overview.md`, `docs/code/architecture/request-lifecycle.md` |
| `proxy.ts` | `docs/code/architecture/overview.md`, `docs/code/architecture/request-lifecycle.md` |
| `lib/actions/` | `docs/code/architecture/overview.md`, `docs/code/architecture/request-lifecycle.md` |
| `lib/data/` | `docs/code/architecture/overview.md`, `docs/code/architecture/request-lifecycle.md` |
| `lib/supabase/` | `docs/code/architecture/overview.md`, `docs/code/architecture/request-lifecycle.md` |
| `lib/auth/` | `docs/code/architecture/overview.md`, `docs/code/architecture/request-lifecycle.md` |
| `lib/api/` | `docs/code/architecture/request-lifecycle.md` |
| `lib/log.ts` | `docs/code/architecture/overview.md`, `docs/code/architecture/request-lifecycle.md` |
| `lib/request-id.ts` | `docs/code/architecture/overview.md`, `docs/code/architecture/request-lifecycle.md` |
| `lib/env.ts` | `docs/code/architecture/environments-and-deploy.md` |
| `lib/security/` | `docs/code/architecture/overview.md`, `docs/code/architecture/request-lifecycle.md`, `docs/code/architecture/environments-and-deploy.md` |
| `lib/email/` | `docs/code/architecture/overview.md`, `docs/code/architecture/environments-and-deploy.md` |
| `lib/analytics/` | `docs/code/architecture/overview.md`, `docs/code/architecture/environments-and-deploy.md` |
| `lib/billing/` | `docs/code/architecture/environments-and-deploy.md`, `docs/code/architecture/background-jobs.md` |
| `lib/cv/` | `docs/code/architecture/environments-and-deploy.md`, `docs/code/architecture/background-jobs.md` |
| `lib/github/` | `docs/code/architecture/environments-and-deploy.md` |
| `lib/monitoring/` | `docs/code/architecture/background-jobs.md` |
| `supabase/functions/` | `docs/code/architecture/background-jobs.md`, `docs/code/architecture/environments-and-deploy.md`, `docs/code/reference/live-inventory.md` |
| `supabase/migrations/` | `docs/code/architecture/background-jobs.md`, `docs/code/architecture/request-lifecycle.md`, `docs/code/reference/schema/`, `docs/code/reference/drift.md` |
| `app/api/github/webhook/route.ts` | `docs/code/architecture/background-jobs.md` |
| `app/api/billing/webhook/` | `docs/code/architecture/background-jobs.md` |
| `app/api/webhooks/resend/route.ts` | `docs/code/architecture/background-jobs.md` |
| `.github/workflows/` | `docs/code/architecture/environments-and-deploy.md` |
| `vercel.json` | `docs/code/architecture/overview.md`, `docs/code/architecture/environments-and-deploy.md` |
| `next.config.ts` | `docs/code/architecture/overview.md`, `docs/code/architecture/environments-and-deploy.md` |
| `.env.example` | `docs/code/architecture/environments-and-deploy.md`, `docs/code/reference/live-inventory.md` |
| `instrumentation.ts` | `docs/code/architecture/overview.md`, `docs/code/architecture/environments-and-deploy.md` |
| `instrumentation-client.ts` | `docs/code/architecture/overview.md`, `docs/code/architecture/environments-and-deploy.md` |
| `sentry.server.config.ts` | `docs/code/architecture/environments-and-deploy.md` |
| `sentry.edge.config.ts` | `docs/code/architecture/environments-and-deploy.md` |
