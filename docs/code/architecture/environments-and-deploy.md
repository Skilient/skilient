Commit: dee328c
Covers: .env.example, lib/env.ts, next.config.ts, vercel.json, .nvmrc, supabase/config.toml, supabase/seed.sql, .github/workflows/ci.yml, .github/workflows/zap.yml, .github/workflows/restore-drill.yml, scripts/restore/, scripts/zap-gate.mjs, app/api/health/route.ts, lib/health.ts, eslint.config.mjs, vitest.config.mts, vitest.worker.config.mts, vitest.ats.config.mts, playwright.config.ts

# Environments and deploy

Where configuration comes from, what CI checks, and exactly what a merge to `main` changes in production.

## Environments

| | Local | CI (GitHub Actions) | Vercel preview | Production |
|---|---|---|---|---|
| Database | `supabase start` on Docker, rebuilt by `db reset` from migrations and `seed.sql` | The same local stack, started inside the job [src: .github/workflows/ci.yml#pnpm exec supabase start -x studio,imgproxy,logflare,vector,supavisor] | Not defined in the repo | The hosted project, changed only by `supabase db push` from CI [src: .github/workflows/ci.yml#pnpm exec supabase db push --linked] |
| Signup | Open at every university: the seed sets `live_at` on all of them [src: supabase/seed.sql#update public.universities set live_at = now() where live_at is null] | Same seed | — | Opened per university by staff |
| Workers | Wake functions return early: no `project_url` in Vault [src: supabase/migrations/20260927224500_github_connect.sql#without it (local, CI) this is a no-op] | Same; the Edge Functions are only checked to boot and refuse strangers [src: .github/workflows/ci.yml#Edge Functions boot] | — | Woken every minute by pg_cron |
| Turnstile | A missing secret skips the check | Same | Same | A missing secret refuses the request [src: lib/security/turnstile.ts#return process.env.VERCEL_ENV === "production"] |
| Billing | Never live | Never live; simulated gateway with a test secret [src: .github/workflows/ci.yml#the simulated gateway signs its webhooks with this test-only value] | Never live | Live when `VERCEL_ENV` is `production` [src: lib/billing/gateways/index.ts#production: process.env.VERCEL_ENV === "production"] |
| Session cookie | `skl-auth` | `__Secure-skl-auth` (the E2E server is a production build) | `__Secure-skl-auth` | `__Secure-skl-auth` [src: lib/supabase/cookie-options.ts#production = process.env.NODE_ENV === "production"] |
| `/ui` gallery | On (development build) | On: the build sets `ENABLE_UI_GALLERY=1` [src: .github/workflows/ci.yml#ENABLE_UI_GALLERY: "1"] | Off | Off [src: app/(dev)/ui/page.tsx#process.env.NODE_ENV === "production" && process.env.ENABLE_UI_GALLERY !== "1"] |

Node comes from `.nvmrc` (22) in every workflow [src: .nvmrc#22] [src: .github/workflows/ci.yml#node-version-file: .nvmrc]. Vercel builds in region `bom1` with `pnpm install --frozen-lockfile` and `pnpm build` [src: vercel.json#"regions": ["bom1"]] [src: vercel.json#pnpm install --frozen-lockfile].

## Variables in `.env.example` and `lib/env.ts`

`lib/env.ts` validates only the two public Supabase values with Zod: `readPublicEnv()` returns null when they are missing (the proxy and `/api/health` then degrade), and `publicEnv()` throws [src: lib/env.ts#const publicSchema] [src: lib/env.ts#export function readPublicEnv] [src: lib/env.ts#export function publicEnv]. Every other variable is read where it is used, and most code treats a missing value as "not configured" rather than failing at start.

| Variable | Runtime | Read in | When missing |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Next (server and browser) | `lib/env.ts` for every Supabase client [src: lib/env.ts#NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL]; the CSP in `proxy.ts` [src: proxy.ts#supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL]; university media URLs [src: lib/uni/media.ts#process.env.NEXT_PUBLIC_SUPABASE_URL] | Proxy skips session work; `/api/health` reports `env_missing` [src: lib/health.ts#env_missing] |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Next | `lib/env.ts` [src: lib/env.ts#NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY] | As above |
| `NEXT_PUBLIC_SITE_URL` | Next | `siteUrl()` for `metadataBase`, `security.txt` and CV links [src: lib/cv/site.ts#process.env.NEXT_PUBLIC_SITE_URL] [src: app/layout.tsx#metadataBase: new URL(siteUrl())]; gateway return URLs [src: lib/billing/gateways/index.ts#appUrl: process.env.NEXT_PUBLIC_SITE_URL] | `http://localhost:3000` (and `http://127.0.0.1:3000` for gateways) |
| `CV_EXPORT_SECRET` | Next server | `/api/cv/pdf` [src: app/api/cv/pdf/route.ts#process.env.CV_EXPORT_SECRET]; must equal the Vault secret `cv_export_secret` [src: .env.example#copied from the Vault secret cv_export_secret] | 503 `not_configured` [src: app/api/cv/pdf/route.ts#PDF export isn't set up yet.] |
| `CV_CHROMIUM_PATH` | Next server | `launchBrowser` outside Vercel, falling back to `PW_CHROMIUM_PATH` [src: lib/cv/browser.ts#process.env.CV_CHROMIUM_PATH ?? process.env.PW_CHROMIUM_PATH] | `@sparticuz/chromium` |
| `SUPABASE_SERVICE_ROLE_KEY` | Next server; Edge | `createServiceClient` only; ESLint forbids reading it anywhere else [src: lib/supabase/service.ts#process.env.SUPABASE_SERVICE_ROLE_KEY] [src: eslint.config.mjs#SUPABASE_SERVICE_ROLE_KEY may only be read in lib/supabase/service.ts]; `storage-cleanup` [src: supabase/functions/storage-cleanup/index.ts#Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")] | Throws [src: lib/supabase/service.ts#SUPABASE_SERVICE_ROLE_KEY is not set] |
| `GITHUB_APP_SLUG` | Next | `githubApp()` for install links [src: lib/github/config.ts#process.env.GITHUB_APP_SLUG] | No GitHub links |
| `GITHUB_APP_CLIENT_ID` | Next and Edge | `githubApp()` [src: lib/github/config.ts#process.env.GITHUB_APP_CLIENT_ID]; `configFromEnv` [src: supabase/functions/_shared/github/types.ts#clientId: required("GITHUB_APP_CLIENT_ID")] | Next: no links. Edge: `not_configured` |
| `GITHUB_APP_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_PRIVATE_KEY` | Edge only | `configFromEnv` in `github-link`, `github-worker`, `code-check` [src: supabase/functions/_shared/github/types.ts#appId: required("GITHUB_APP_ID")] [src: supabase/functions/_shared/github/types.ts#privateKey: required("GITHUB_APP_PRIVATE_KEY")] | 503 `not_configured` [src: supabase/functions/github-worker/index.ts#error: "not_configured"] |
| `GITHUB_WEBHOOK_SECRET` | Next server | `/api/github/webhook` [src: app/api/github/webhook/route.ts#process.env.GITHUB_WEBHOOK_SECRET] | 503 |
| `RESEND_API_KEY`, `EMAIL_FROM` | Next server and Edge | `sendEmail` [src: lib/email/send.ts#process.env.RESEND_API_KEY]; `notifyConfigFromEnv` [src: supabase/functions/_shared/notify/worker.ts#resendApiKey: required("RESEND_API_KEY")] | Next logs `email.skipped`; the worker answers 503 [src: lib/email/send.ts#email.skipped] |
| `RESEND_WEBHOOK_SECRET` | Next server | `/api/webhooks/resend` [src: app/api/webhooks/resend/route.ts#process.env.RESEND_WEBHOOK_SECRET] | 404 |
| `IP_HASH_SECRET` | Next server | `keyedHash` for IP hashes and rate-limit keys [src: lib/security/hash.ts#process.env.IP_HASH_SECRET] | Plain SHA-256, logged once [src: lib/security/hash.ts#security.ip_hash_secret_missing] |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Next server | `turnstileSiteKey`, `verifyTurnstile` [src: lib/security/turnstile.ts#process.env.TURNSTILE_SITE_KEY] [src: lib/security/turnstile.ts#process.env.TURNSTILE_SECRET_KEY] | Check skipped, except in Vercel production |
| `SENTRY_DSN` | Next server and edge runtimes | `sentry.server.config.ts`, `sentry.edge.config.ts` [src: sentry.server.config.ts#process.env.SENTRY_DSN] [src: sentry.edge.config.ts#process.env.SENTRY_DSN] | Sentry sends nothing |
| `NEXT_PUBLIC_SENTRY_DSN` | Browser; proxy | `instrumentation-client.ts` [src: instrumentation-client.ts#process.env.NEXT_PUBLIC_SENTRY_DSN]; its origin is added to `connect-src` [src: proxy.ts#sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN] | As above |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Build | `withSentryConfig`: source maps upload only with a token, then are deleted [src: next.config.ts#sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN, deleteSourcemapsAfterUpload: true }] | No upload |
| `NEXT_PUBLIC_POSTHOG_KEY` | Next server, at run time | `posthogProjectKey()`, read by a computed name so the build does not inline it; must look like `phc_…` [src: lib/analytics/config.ts#const KEY_NAME = "NEXT_PUBLIC_POSTHOG_KEY"] | No analytics loads |
| `NEXT_PUBLIC_POSTHOG_HOST` | — | Not read by any code; the browser goes through the `/ingest` rewrites to fixed EU hosts [src: next.config.ts#source: "/ingest/:path*", destination: "https://eu.i.posthog.com/:path*"] | — |
| `POSTHOG_PERSONAL_API_KEY` | Edge only | `analyticsConfigFromEnv`, for person deletion [src: supabase/functions/_shared/analytics/worker.ts#personalKey: env("POSTHOG_PERSONAL_API_KEY")] | Deletions wait and retry hourly [src: supabase/functions/_shared/analytics/worker.ts#outcome: "not_configured"] |
| `BILLING_GATEWAY_LOCAL`, `BILLING_GATEWAY_MOR` | Next server and Edge | `billingGateways` [src: supabase/functions/_shared/billing/config.ts#env("BILLING_GATEWAY_LOCAL") === "safepay"] | `simulated` |
| `BILLING_ALLOW_SIMULATED` | Next server and Edge | `billingGateways` [src: supabase/functions/_shared/billing/config.ts#allowSimulatedOverride: env("BILLING_ALLOW_SIMULATED") === "1"] | Simulated gateway refused in production once a real one is configured |
| `SIMULATED_GATEWAY_SECRET` | Next server and Edge | The simulated adapter [src: supabase/functions/_shared/billing/config.ts#secret: env("SIMULATED_GATEWAY_SECRET")]; the simulated checkout action signs its webhook with it [src: lib/actions/billing.ts#process.env.SIMULATED_GATEWAY_SECRET] | Listed as missing by `readiness` [src: supabase/functions/_shared/billing/config.ts#missing: g.simulated.configured ? [] : ["SIMULATED_GATEWAY_SECRET"]] |
| `SAFEPAY_ENVIRONMENT`, `SAFEPAY_API_KEY`, `SAFEPAY_SECRET_KEY`, `SAFEPAY_WEBHOOK_SECRET` | Next server and Edge | `safepayConfig` [src: supabase/functions/_shared/billing/safepay.ts#apiKey: env("SAFEPAY_API_KEY")] | Adapter disabled until all are set [src: supabase/functions/_shared/billing/config.ts#SAFEPAY_API_KEY", "SAFEPAY_SECRET_KEY", "SAFEPAY_WEBHOOK_SECRET] |
| `PADDLE_ENVIRONMENT`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET` | Next server and Edge | `paddleConfig` [src: supabase/functions/_shared/billing/paddle.ts#apiKey: env("PADDLE_API_KEY")] | As above |
| `ENABLE_UI_GALLERY` | Next server | `/ui` page [src: app/(dev)/ui/page.tsx#ENABLE_UI_GALLERY] | `/ui` is 404 in production builds |

Next reads billing variables through `gateways()`, which passes `process.env` to the same `billingGateways` the Edge Function uses [src: lib/billing/gateways/index.ts#billingGateways((name) => process.env[name]].

### Read by code but not in `.env.example`

| Variable | Where the value comes from | Read in |
|---|---|---|
| `SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` | The Edge Function environment; not set in the repo | Every function's database connection [src: supabase/functions/notify-worker/index.ts#Deno.env.get("SUPABASE_DB_URL")]; token checks in `code-check` and `cv-sign` [src: supabase/functions/cv-sign/index.ts#Deno.env.get("SUPABASE_ANON_KEY")] |
| `APP_URL`, `RESEND_API_URL` | Edge Function secrets; not set in the repo | `notifyConfigFromEnv` (`APP_URL` required) [src: supabase/functions/_shared/notify/worker.ts#appUrl: required("APP_URL")] |
| `POSTHOG_PROJECT_KEY`, `POSTHOG_HOST`, `POSTHOG_API_HOST`, `POSTHOG_PROJECT_ID` | Edge Function secrets; not set in the repo | `analyticsConfigFromEnv`; hosts must be PostHog EU [src: supabase/functions/_shared/analytics/worker.ts#POSTHOG_HOST must be PostHog EU] |
| `GITHUB_API_URL`, `GITHUB_WEB_URL` | Edge Function secrets (optional); not set in the repo | `configFromEnv` [src: supabase/functions/_shared/github/types.ts#env("GITHUB_API_URL")] |
| `GITHUB_READ_TOKEN` | Edge Function secret (optional); not set in the repo | `competition-freeze` [src: supabase/functions/competition-freeze/index.ts#Deno.env.get("GITHUB_READ_TOKEN")] |
| `SITE_URL`, `BILLING_PRODUCTION` | Edge Function secrets; not set in the repo | `billing-worker`; live only when `BILLING_PRODUCTION=1` [src: supabase/functions/billing-worker/index.ts#production: env("BILLING_PRODUCTION") === "1"] |
| `VERCEL`, `VERCEL_ENV`, `NEXT_PUBLIC_VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_REGION` | The hosting platform; not set in the repo | Vercel Analytics, Turnstile and billing modes, the Sentry environment, `/api/health`'s version, the PDF check [src: lib/sentry-scrub.ts#process.env.NEXT_PUBLIC_VERCEL_ENV] [src: app/api/health/route.ts#process.env.VERCEL_GIT_COMMIT_SHA] [src: app/api/ops/pdf-check/route.ts#process.env.VERCEL_REGION] |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | The hosting platform; not set in the repo | The simulated checkout's webhook call through Deployment Protection [src: lib/actions/billing.ts#x-vercel-protection-bypass] |
| `NEXT_PUBLIC_APP_VERSION` | Optional | Feedback records the commit or this value [src: lib/actions/feedback.ts#process.env.NEXT_PUBLIC_APP_VERSION] |
| `PORT`, `E2E_BASE_URL`, `PW_CHROMIUM_PATH`, `CI` | The shell or CI runner | Playwright configs [src: playwright.config.ts#process.env.E2E_BASE_URL]; `next.config.ts` quiets Sentry outside CI [src: next.config.ts#silent: !process.env.CI] |
| `PROD_DB_URL`, `SCRATCH_DB_URL`, `PROD_URL`, `PROD_KEY`, `SCRATCH_URL`, `SCRATCH_KEY`, `SUPABASE_ACCESS_TOKEN` | The restore drill workflow | `scripts/restore/*` [src: scripts/restore/verify.mjs#process.env.PROD_DB_URL] [src: scripts/restore/copy-storage.mjs#const { PROD_DB_URL, PROD_URL, PROD_KEY, SCRATCH_URL, SCRATCH_KEY } = process.env] |

Vault secrets are configuration too. `restore-drill` checks that these decrypt after a restore: `project_url`, `cv_export_secret` and the nine worker bearer secrets [src: scripts/restore/verify.mjs#export const REQUIRED_SECRETS]. Migrations generate the bearer secrets and `cv_export_secret`; `project_url` is set by hand [src: supabase/migrations/20260927224500_github_connect.sql#Needs a Vault secret `project_url`].

## Workflows

### `ci.yml`

Runs on every pull request, on manual dispatch and on each push to `main` [src: .github/workflows/ci.yml#pull_request:]. A new push to a pull request cancels its previous run; a run on `main` is never cancelled [src: .github/workflows/ci.yml#cancel-in-progress: ${{ github.event_name == 'pull_request' }}]. Third-party actions are pinned to commit SHAs [src: .github/workflows/ci.yml#Third-party actions are pinned to full commit SHAs].

| Job | Steps | Blocks `migrate-production` |
|---|---|---|
| `checks` | `pnpm typecheck`, `pnpm lint` (zero warnings), `pnpm test` [src: .github/workflows/ci.yml#- run: pnpm typecheck] | Yes |
| `database-and-e2e` | Start the local stack; `supabase db reset`; pgTAP (`supabase test db`); `pnpm test:worker`; boot every Edge Function and expect 401 (and `not_configured` from `github-link`); `supabase db advisors --fail-on warn`; regenerate `types/database.ts` and fail on a diff; build with the gallery; `pnpm test:ats`; `pnpm test:e2e` with `E2E_EXPECT_HEALTHY=1`; upload the Playwright report [src: .github/workflows/ci.yml#pnpm exec supabase test db] [src: .github/workflows/ci.yml#--fail-on warn] [src: .github/workflows/ci.yml#types/database.ts is stale: run pnpm db:types] [src: .github/workflows/ci.yml#E2E_EXPECT_HEALTHY: "1"] | Yes |
| `gitleaks` | Scans the full history with gitleaks 8.28, redacted [src: .github/workflows/ci.yml#zricethezav/gitleaks:v8.28.0] | Yes |
| `audit` | `pnpm audit --audit-level critical --prod` [src: .github/workflows/ci.yml#pnpm audit --audit-level critical --prod] | Yes |
| `performance` | Build, `size-limit`, Lighthouse CI; report only (`continue-on-error`) [src: .github/workflows/ci.yml#continue-on-error: true] | No |
| `migrate-production` | `main` pushes only; see below [src: .github/workflows/ci.yml#if: github.event_name == 'push' && github.ref == 'refs/heads/main'] | — |

The E2E job points the app at the local stack and sets test-only values: the stack's secret key as `SUPABASE_SERVICE_ROLE_KEY`, a test GitHub App identity and webhook secret, `CV_EXPORT_SECRET` read from the local Vault, and `NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3100` [src: .github/workflows/ci.yml#echo "SUPABASE_SERVICE_ROLE_KEY=$SECRET_KEY" >> "$GITHUB_ENV"] [src: .github/workflows/ci.yml#where name = 'cv_export_secret'].

### `zap.yml`

OWASP ZAP passive baseline: weekly on Monday at 02:17 UTC, by hand, and on pull requests that touch `proxy.ts`, `next.config.ts`, `lib/security/**`, `.zap/**` or the workflow [src: .github/workflows/zap.yml#cron: "17 2 * * 1"] [src: .github/workflows/zap.yml#- lib/security/**]. Without a target it builds the app against a local stack (no Edge runtime) and scans `http://127.0.0.1:3100`; a manual run can name another URL [src: .github/workflows/zap.yml#supavisor,edge-runtime] [src: .github/workflows/zap.yml#inputs.target != '' && inputs.target || 'http://127.0.0.1:3100']. `scripts/zap-gate.mjs` prints every alert and exits 1 on any High (`riskcode` 3) [src: scripts/zap-gate.mjs#const highs = rows.filter((r) => r.risk >= 3)]. It does not run on pushes to `main`.

### `restore-drill.yml`

Manual only, and only when the operator types `restore into scratch` [src: .github/workflows/restore-drill.yml#Type exactly: restore into scratch]. It refuses when the scratch project is production or already has tables [src: .github/workflows/restore-drill.yml#The scratch project is production] [src: .github/workflows/restore-drill.yml#Scratch already has $n tables]. Steps: dump roles, schema and data from production with the Supabase CLI; restore in one transaction with triggers off (`session_replication_role = replica`); re-create Vault secrets with the scratch `project_url` and deploy the Edge Functions there; rotate to a new CV signing key on scratch; copy Storage files (optional); compare production and scratch with `verify.mjs`; build the app against scratch and require `/api/health` to return 200 [src: .github/workflows/restore-drill.yml#--command 'SET session_replication_role = replica'] [src: .github/workflows/restore-drill.yml#scripts/restore/reseed-vault.sql] [src: .github/workflows/restore-drill.yml#select private.cv_rotate_key()] [src: .github/workflows/restore-drill.yml#[ "$code" = 200 ]]. `verify.mjs` compares migrations, RLS, policies, functions and row counts, and checks that Vault secrets decrypt and cron jobs exist [src: scripts/restore/verify.mjs#Compares production with the restored scratch project].

### Dependabot

Weekly update pull requests for npm packages (Radix, Supabase and testing packages grouped) and for GitHub Actions, all action bumps in one pull request [src: .github/dependabot.yml#package-ecosystem: npm] [src: .github/dependabot.yml#One PR for all action bumps].

## What a merge to `main` does to production

1. **CI runs on the merged commit.** The push to `main` starts `ci.yml`; the five gate jobs run as on a pull request [src: .github/workflows/ci.yml#branches: [main]].
2. **`migrate-production` waits** for `checks`, `database-and-e2e`, `gitleaks` and `audit` to pass; `performance` is not required [src: .github/workflows/ci.yml#needs: [checks, database-and-e2e, gitleaks, audit]]. It runs in the GitHub `production` environment, one at a time, never cancelled [src: .github/workflows/ci.yml#group: supabase-migrate-production].
3. **Secrets check.** It stops with an error unless `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD` are set [src: .github/workflows/ci.yml#Repository secret $v is not set].
4. **Link and dry run.** `supabase link --project-ref …`, then `supabase db push --linked --dry-run` to list pending migrations [src: .github/workflows/ci.yml#pnpm exec supabase db push --linked --dry-run].
5. **Apply migrations.** `supabase db push --linked` applies the pending migrations the previous step listed [src: .github/workflows/ci.yml#- name: Apply migrations] [src: .github/workflows/ci.yml#- name: Show pending migrations]. Because cron jobs, queues and worker secrets are created inside migrations, this step is also what schedules a new job, creates a new queue and generates a new bearer secret in production [src: supabase/migrations/20261104000000_analytics.sql#select pgmq.create('analytics')].
6. **Deploy Edge Functions.** `supabase functions deploy --use-api` uploads every function's code. Function secrets are not touched: they are set on the project by hand [src: .github/workflows/ci.yml#GitHub App secrets are set on the project once by hand].
7. **Advisors report.** `supabase db advisors --linked` runs against the live project; its result does not fail the job [src: .github/workflows/ci.yml#Supabase advisors on the live project (report)].
8. **The Next app.** No workflow builds or deploys it. `vercel.json` sets the region and build commands and nothing in the repo orders a Vercel deploy after `migrate-production` [src: vercel.json#"buildCommand": "pnpm build"]. How Vercel picks up the commit is configured outside the repo (see `reference/verification-log.md`).

`/api/health` reports `ok` or `degraded` with checks for the database (`health_check` RPC), Storage and Realtime, and the first seven characters of `VERCEL_GIT_COMMIT_SHA` so an old deployment can be told apart from a new failure [src: app/api/health/route.ts#Which build answered] [src: lib/health.ts#supabase.rpc("health_check")].

## Lint rules that guard architecture

Beyond Next's presets, ESLint (`--max-warnings=0`) refuses [src: package.json#eslint --max-warnings=0]:

- importing the service-role client outside its allow-list, or reading `SUPABASE_SERVICE_ROLE_KEY` outside `lib/supabase/service.ts` [src: eslint.config.mjs#const serviceRoleImport];
- `getSession()` anywhere [src: eslint.config.mjs#const getSessionSelectors];
- a raw `fetch` to Supabase REST (`/rest/v1`) [src: eslint.config.mjs#No raw fetch to Supabase REST];
- `innerHTML`, `outerHTML` and `insertAdjacentHTML` [src: eslint.config.mjs#Never render raw HTML (XSS)];
- a `<form>` with neither `method` nor `action` [src: eslint.config.mjs#Give every <form> method="post"].

`supabase/functions/**` is outside ESLint [src: eslint.config.mjs#"supabase/functions/**"].

## Tests

| Command | Runner | Files | Needs |
|---|---|---|---|
| `pnpm test` | Vitest | `tests/unit/**/*.test.{ts,tsx}` [src: vitest.config.mts#tests/unit/**/*.test.{ts,tsx}] | Nothing |
| `pnpm test:worker` | Vitest, files run one at a time | `tests/worker/**/*.test.ts` [src: vitest.worker.config.mts#tests/worker/**/*.test.ts] [src: vitest.worker.config.mts#fileParallelism: false] | The local database |
| `pnpm test:ats` | Vitest | `tests/ats/**/*.test.ts` [src: vitest.ats.config.mts#tests/ats/**/*.test.ts] | A Chromium (`CV_CHROMIUM_PATH`) |
| `pnpm test:e2e` | Playwright | `tests/e2e` against `pnpm start` on port 3100, plus a second server on 3101 [src: playwright.config.ts#testDir: "tests/e2e"] [src: playwright.config.ts#command: `pnpm start --port ${PORT + 1}`] | A production build and the local stack |
| `pnpm db:test` | pgTAP (`supabase test db`) | `supabase/tests/*.test.sql`, numbered; `00_rls_everywhere` first [src: package.json#"db:test": "supabase test db"] | The local stack |
| `pnpm marketing:captures` | Playwright | `tests/captures` with its own config [src: package.json#playwright test -c playwright.captures.config.ts] | A build and seeded sample content |

CI runs all of them except the captures, in the `checks` and `database-and-e2e` jobs above.
