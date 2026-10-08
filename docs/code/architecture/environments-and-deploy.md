Commit: 4024fe9
Covers: `.env.example`, `lib/env.ts`, `vercel.json`, `.github/workflows/`, `next.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`, `instrumentation-client.ts`

# Environments and deploy

## Where configuration comes from

`.env.example` lists names only — "Real values live in Vercel env vars, Supabase Vault, or your local `.env.local`" [src: .env.example#Vercel env vars]. Three different runtimes read these names:

- **The Next.js app** (`lib/`, `app/`), reading `process.env.*` directly, except the two Supabase values that go through the validated, cached `lib/env.ts` [src: lib/env.ts#publicSchema].
- **Supabase Edge Functions** (Deno), reading the same *names* but as Supabase project secrets (`supabase secrets set`), via `Deno.env.get()` wrapped in each function's own `configFromEnv`-style helper [src: supabase/functions/_shared/github/types.ts#GITHUB_APP_ID]. Some config — the billing gateway adapters — is a single module under `supabase/functions/_shared/billing/` imported by *both* runtimes, so the Next app and the Edge Function read the identical logic over the identical names [src: lib/billing/gateways/index.ts#billingGateways] [src: supabase/functions/_shared/billing/config.ts#billingGateways].
- **Vercel's own runtime**, which sets `VERCEL`, `VERCEL_ENV` and `NODE_ENV` itself — never declared in `.env.example` — read directly where production/preview behaviour differs [src: lib/security/turnstile.ts#mustVerify] [src: lib/billing/gateways/index.ts#production] [src: lib/cv/browser.ts#launchBrowser] [src: app/layout.tsx#process.env.VERCEL].

## `.env.example` / `lib/env.ts`, one row per variable

| Variable | Read in | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/env.ts` (`readPublicEnv`/`publicEnv`, Zod-validated) [src: lib/env.ts#readPublicEnv], used by every `lib/supabase/*.ts` client factory [src: lib/supabase/server.ts#createClient]; read directly (not through `lib/env.ts`) in `lib/health.ts` and `app/.well-known/skilient-cv-keys.json/route.ts` | Public — ships to the browser. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | same as above [src: lib/env.ts#publicSchema] | Public; the Supabase anon/publishable key, never the service role key. |
| `NEXT_PUBLIC_SITE_URL` | `lib/cv/site.ts#siteUrl` (canonical origin for CV verify links/QR, and `app/layout.tsx`'s `metadataBase`) [src: lib/cv/site.ts#siteUrl]; `lib/billing/gateways/index.ts` (checkout return URLs) [src: lib/billing/gateways/index.ts#gateways] | Falls back to `http://localhost:3000` when unset. |
| `CV_EXPORT_SECRET` | `app/api/cv/pdf/route.ts` (MAC check on exported PDFs) [src: app/api/cv/pdf/route.ts#CV_EXPORT_SECRET] | Mirrors the Vault secret `cv_export_secret`; the database and the app must agree. |
| `CV_CHROMIUM_PATH` | `lib/cv/browser.ts#launchBrowser` (falls back to `PW_CHROMIUM_PATH`) [src: lib/cv/browser.ts#launchBrowser] | Ignored on Vercel (`@sparticuz/chromium` is used instead whenever `process.env.VERCEL` is set). |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/service.ts#createServiceClient` only [src: lib/supabase/service.ts#createServiceClient] | Bypasses RLS; ESLint restricts which files may import this module (CLAUDE.md: jobs, webhooks, the billing worker only). |
| `GITHUB_APP_SLUG` | `lib/github/config.ts#githubApp` (builds install/authorise links) [src: lib/github/config.ts#githubApp] | Public-safe (it's a URL segment), but server-only here. |
| `GITHUB_APP_ID` | Edge Functions only, `configFromEnv` [src: supabase/functions/_shared/github/types.ts#configFromEnv] | Never read by the Next app. |
| `GITHUB_APP_CLIENT_ID` | `lib/github/config.ts#githubApp` (Next, for the authorise URL) [src: lib/github/config.ts#githubApp] and `configFromEnv` (Edge Functions, to exchange the OAuth code) [src: supabase/functions/_shared/github/types.ts#configFromEnv] | Read by both runtimes. |
| `GITHUB_APP_CLIENT_SECRET` | Edge Functions only, `configFromEnv` [src: supabase/functions/_shared/github/types.ts#configFromEnv] | Never in the Next app or the browser. |
| `GITHUB_APP_PRIVATE_KEY` | Edge Functions only, `configFromEnv` (newlines unescaped) [src: supabase/functions/_shared/github/types.ts#configFromEnv] | Signs the App's own JWTs; never leaves `github-worker`/`github-link`. |
| `GITHUB_WEBHOOK_SECRET` | `app/api/github/webhook/route.ts` (HMAC signature check) [src: app/api/github/webhook/route.ts#GITHUB_WEBHOOK_SECRET] | Next-side only; the webhook route never calls an Edge Function to verify. |
| `RESEND_API_KEY` | `lib/email/send.ts#sendEmail` [src: lib/email/send.ts#sendEmail]; also an Edge Function secret for `notify-worker` (`notifyConfigFromEnv`) [src: supabase/functions/_shared/notify/worker.ts#notifyConfigFromEnv] | Read by both runtimes under the same name. |
| `RESEND_WEBHOOK_SECRET` | `app/api/webhooks/resend/route.ts` [src: app/api/webhooks/resend/route.ts#RESEND_WEBHOOK_SECRET] | Unset: the route answers 404 per its own comment. |
| `EMAIL_FROM` | `lib/email/send.ts#sendEmail` [src: lib/email/send.ts#sendEmail]; Edge Function secret for `notify-worker` [src: supabase/functions/_shared/notify/worker.ts#notifyConfigFromEnv] | Verified sender address. |
| `IP_HASH_SECRET` | `lib/security/hash.ts#keyedHash` [src: lib/security/hash.ts#keyedHash] | Missing locally: falls back to a logged-once plain SHA-256. |
| `TURNSTILE_SITE_KEY` | `lib/security/turnstile.ts#turnstileSiteKey` [src: lib/security/turnstile.ts#turnstileSiteKey] | Public (rendered into the challenge widget). |
| `TURNSTILE_SECRET_KEY` | `lib/security/turnstile.ts#verifyTurnstile` [src: lib/security/turnstile.ts#verifyTurnstile] | Unset outside production: the check is skipped, not refused — see `mustVerify()`. |
| `SENTRY_DSN` | `sentry.server.config.ts`, `sentry.edge.config.ts` [src: sentry.server.config.ts#Sentry] | Server-side error reporting. |
| `NEXT_PUBLIC_SENTRY_DSN` | `instrumentation-client.ts#load` [src: instrumentation-client.ts#load]; also read by `proxy.ts#buildCsp` to add Sentry's origin to `connect-src` [src: lib/security/headers.ts#buildCsp] | Public — the browser SDK needs it to report from the client. |
| `SENTRY_AUTH_TOKEN` | `next.config.ts` (Sentry's Next.js plugin, source map upload) [src: next.config.ts#authToken] | Build-time only; absent, source map upload is disabled [src: next.config.ts#sourcemaps]. |
| `SENTRY_ORG` | `next.config.ts` [src: next.config.ts#org] | Build-time only. |
| `SENTRY_PROJECT` | `next.config.ts` [src: next.config.ts#project] | Build-time only. |
| `NEXT_PUBLIC_POSTHOG_KEY` | `lib/analytics/config.ts#posthogProjectKey` (validated `phc_…` shape) [src: lib/analytics/config.ts#posthogProjectKey] | Read at request time, not inlined at build, so one build can run with or without analytics. |
| `NEXT_PUBLIC_POSTHOG_HOST` | Declared in `.env.example` and the PRD, but not read by any code in `lib/`, `app/`, or `supabase/functions/`: the browser always posts to the same-origin `/ingest` path, which `next.config.ts` rewrites to PostHog's EU ingestion [src: next.config.ts#rewrites] [src: components/analytics/analytics-loader.tsx#api_host] | Effectively unused today. |
| `POSTHOG_PERSONAL_API_KEY` | Edge Function `analytics-worker` only (`AnalyticsConfig.personalKey`, used for person-deletion calls) [src: supabase/functions/_shared/analytics/worker.ts#AnalyticsConfig] | Never read by the Next app. |
| `BILLING_GATEWAY_LOCAL` | `billingGateways()`, shared by both runtimes [src: supabase/functions/_shared/billing/config.ts#billingGateways] | `safepay` or (default) `simulated`; decides the PKR gateway. |
| `BILLING_GATEWAY_MOR` | `billingGateways()` [src: supabase/functions/_shared/billing/config.ts#billingGateways] | `paddle` or (default) `simulated`; decides the USD merchant-of-record gateway. |
| `BILLING_ALLOW_SIMULATED` | `billingGateways()` (`allowSimulatedOverride`) [src: supabase/functions/_shared/billing/config.ts#billingGateways] | `"1"` lets the simulated gateway run in production even once a real one is configured. |
| `SIMULATED_GATEWAY_SECRET` | `billingGateways()` → `createSimulatedAdapter` [src: supabase/functions/_shared/billing/config.ts#billingGateways] | Signs the simulated gateway's own webhooks; also referenced from `lib/actions/billing.ts`. |
| `SAFEPAY_ENVIRONMENT` / `SAFEPAY_API_KEY` / `SAFEPAY_SECRET_KEY` / `SAFEPAY_WEBHOOK_SECRET` | `supabase/functions/_shared/billing/safepay.ts#safepayConfig` [src: supabase/functions/_shared/billing/safepay.ts#safepayConfig] | The adapter reports `configured: false` until all three keys are set. |
| `PADDLE_ENVIRONMENT` / `PADDLE_API_KEY` / `PADDLE_WEBHOOK_SECRET` | `supabase/functions/_shared/billing/paddle.ts#paddleConfig` [src: supabase/functions/_shared/billing/paddle.ts#paddleConfig] | Same pattern as Safepay. |
| `ENABLE_UI_GALLERY` | `app/(dev)/ui/page.tsx` [src: app/(dev)/ui/page.tsx#ENABLE_UI_GALLERY] | Lets `pnpm build` keep `/ui` reachable (CI's E2E build sets it; a normal production build does not). |

Two related variables are read but not declared in `.env.example`: `PW_CHROMIUM_PATH` (Playwright's own Chromium, the fallback in `lib/cv/browser.ts#launchBrowser` [src: lib/cv/browser.ts#launchBrowser] — set by `.claude/hooks/session-start.sh` in cloud sessions per CLAUDE.md) and the Vercel-provided `VERCEL`/`VERCEL_ENV`/`NODE_ENV`, read in `app/layout.tsx`, `lib/billing/gateways/index.ts`, `lib/cv/browser.ts`, `lib/security/turnstile.ts` and `proxy.ts` as cited above.

## `.github/workflows/`

| File | Triggers | Jobs |
| --- | --- | --- |
| `ci.yml` | every pull request, `workflow_dispatch`, and `push` to `main` [src: .github/workflows/ci.yml#on] | `checks` (typecheck, lint, unit tests) [src: .github/workflows/ci.yml#checks]; `database-and-e2e` (local Supabase stack, `supabase db reset`, pgTAP, `pnpm test:worker` against a fake GitHub, a boot check that every Edge Function answers 401/"not_configured" without a valid secret, `supabase db advisors --fail-on warn`, a staleness check on `types/database.ts`, then `pnpm build`, `pnpm test:ats` and `pnpm test:e2e`) [src: .github/workflows/ci.yml#database-and-e2e]; `gitleaks` (secret scan over full history, blocking) [src: .github/workflows/ci.yml#gitleaks]; `audit` (`pnpm audit --audit-level critical --prod`) [src: .github/workflows/ci.yml#audit]; `performance` (size-limit + Lighthouse CI, report-only, `continue-on-error: true`) [src: .github/workflows/ci.yml#performance]; `migrate-production` (below). |
| `zap.yml` | weekly cron (`17 2 * * 1`), `workflow_dispatch` with an optional target URL, and pull requests touching `proxy.ts`, `next.config.ts`, `lib/security/**` or `.zap/**` [src: .github/workflows/zap.yml#on] | `baseline`: builds and starts the app against the local Supabase stack (or hits a given URL), runs OWASP ZAP's passive baseline scan, and fails only on a High finding via `scripts/zap-gate.mjs` [src: .github/workflows/zap.yml#baseline]. |
| `restore-drill.yml` | manual only (`workflow_dispatch`, requiring the literal confirmation text `"restore into scratch"`) [src: .github/workflows/restore-drill.yml#on] | `drill`: dumps the production Supabase project and restores it into an empty scratch project, then verifies migrations, RLS, policies, cron and required Vault secrets, optionally copies Storage, and builds the app against the restore to check `/api/health` [src: .github/workflows/restore-drill.yml#drill]. |

## What a merge to `main` does to production

A pull request merging into `main` triggers `ci.yml`'s `push` event. The app itself is **not** deployed by this repository's workflows: Vercel's own GitHub App integration (configured in the Vercel dashboard, outside `.github/workflows/`) builds and deploys `app/` on every push to `main`, using the install/build commands and the `bom1` region pinned in `vercel.json` [src: vercel.json#buildCommand] [src: vercel.json#regions]. What `ci.yml` *does* gate, on the merged commit, is the database and Edge Functions side:

1. Every other job (`checks`, `database-and-e2e`, `gitleaks`, `audit`) must pass first — `migrate-production`'s `needs:` lists all four [src: .github/workflows/ci.yml#migrate-production].
2. It runs under the `production` GitHub Environment, so `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD` come from that environment's repository secrets [src: .github/workflows/ci.yml#SUPABASE_ACCESS_TOKEN].
3. `supabase link` connects the CLI to the production project, `supabase db push --linked --dry-run` previews the pending migrations, then `supabase db push --linked` applies every migration under `supabase/migrations/` that the live database doesn't already have [src: .github/workflows/ci.yml#migrate-production].
4. `supabase functions deploy --use-api` ships every function under `supabase/functions/` [src: .github/workflows/ci.yml#migrate-production] — their non-code secrets (the GitHub App's private key, the billing gateway keys, etc.) are set once by hand on the Supabase project and are untouched by this step.
5. `supabase db advisors --linked --type all --level warn` reports (never blocks: `continue-on-error: true`) security/performance advisories on the now-migrated production database [src: .github/workflows/ci.yml#migrate-production].
6. The job's own `concurrency` group (`supabase-migrate-production`, `cancel-in-progress: false`) means two merges to `main` in quick succession queue their migration runs rather than racing or cancelling each other [src: .github/workflows/ci.yml#concurrency].

So one merge to `main` results in two independent deploys that are not sequenced against each other by this repository: Vercel's build of the new `app/`/`lib/`/`components/` code, and `ci.yml`'s push of the new `supabase/migrations/` and `supabase/functions/` to the same production Supabase project.
