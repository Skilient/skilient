# CLAUDE.md — Skilient

Skilient is a university-gated platform for Pakistani students: they prove skills through real project work (GitHub evidence, ventures, peer and faculty verification) and turn that proof into a signed, verifiable CV that recruiters trust. Current product scope: `docs/student-first-plan.md` (students first; recruiter and university portals behind flags; faculty portal waits).

This branch (`azure`) moves the backend from Supabase to Azure. Until the cutover, production still runs on Supabase and Vercel.

## Where things are

- `docs/azure/prd.md`: **the backend PRD.** Architecture, services, data, security, cost, build plan (W0 to W16), implementation plan and cutover. Read the build-plan row for your workstream and the section it points to.
- `docs/azure/setup-checklist.md`: accounts, exports and secrets a human creates. Never invent values for it.
- `docs/azure/README.md`: index of the above.
- `docs/prd/README.md`: the product spec, one file per section. Precedence: a feature section (5.x) beats section 6 (data model); 5.28 beats 5.6, 5.7, 5.9 and 5.15; 5.27 replaces 5.3; the newest entry in `docs/decisions.md` beats everything. If two sections conflict and the decision log is silent, ask Ahmed.
- `docs/screen-spec.md`, `docs/design-gates.md`: every screen, its states and the design gates.
- `docs/decisions.md`: dated decisions with reasons. Append new ones.
- `docs/archive/supabase-era/`: the old build plan, checklists, phase questions and code map. History only. Do not follow it.
- `brand/`: final logo SVGs (Editorial: ink `#0E0D0B`, vermillion `#C03910`).
- `AGENTS.md`: Next.js 16 rules. Read `node_modules/next/dist/docs/` before using an API you are unsure of.

## Stack (target, from `docs/azure/prd.md`; do not swap without asking)

- Node 22, TypeScript strict, pnpm. Monorepo: `apps/web` (the Next.js app, unchanged), `services/<name>/`, `jobs/`, `packages/`, `deploy/` (Bicep), `tools/cutover/`, `perf/`.
- Web: Next.js 16 App Router, React 19, Tailwind CSS v4 (CSS-first, `@theme inline`, no config file). Fonts and icons as in the product spec: Space Grotesk (labels and body), Spectral (belief moments, `font-serif`), JetBrains Mono (proof), Barlow in the CV, Montserrat only in the wordmark. Icons: Phosphor.
- Backend: 12 domain services (`identity`, `people`, `content`, `messaging`, `work`, `ranking`, `community`, `credentials`, `notify`, `trust`, `market`, `billing`) and 2 platform services (`realtime`, `media`). Express 5 as the HTTP server; ConnectRPC over HTTP/2 with Protobuf contracts, in-memory transport when co-hosted; Zod inside services; `postgres.js` with Kysely; Vitest, Playwright, k6; distroless images.
- Azure, Central India: Container Apps (`web`, `core-a`, `core-b`, jobs), Azure Database for PostgreSQL Flexible Server (private, virtual network), Blob Storage, Key Vault, Log Analytics with Application Insights, Azure Monitor alerts, budgets. Bicep, deployed by GitHub Actions.
- Outside Azure: Cloudflare Free, GitHub Container Registry, Brevo (email), PostHog (EU), Sentry.

## Never

- No AI or LLM API anywhere in the product (no Claude, OpenAI, etc.). Summaries, questions and grading are templates or humans.
- No likes, reactions or saves on posts. Share-to-chat is allowed and never counted. No group chats beyond venture chats. No video anywhere. No public profile pages.
- Never sell rank or visibility. Never order search, leaderboards or "For you" by payment.
- No business rule in `apps/web`. Web checks the session token itself and calls services; it holds no rules.
- Never trust a user id, GitHub username, price or entitlement from the client. The token and the owning service are the only sources.
- No table without an owning service, default-deny row-level security, and a refusal test.
- No query that names another service's schema. A lint rule and the database roles both enforce this.
- No schema change outside `services/<name>/migrations/`. Migrations are plain SQL and forward-only.
- No service-to-service call inside a loop; use the batch method. No call chain deeper than two.
- No new endpoint without a line in `perf/budgets.json`.
- Every staff method checks role and two-factor level and writes the audit log before and after. A contract test fails if one does not.
- Secrets live only in Key Vault, reached by managed identity. Never in images, the repo, CI logs or chat.
- Never commit secrets. gitleaks blocks them.
- Commits and pull requests carry no Co-Authored-By or AI attribution lines.

## Commands

Today, from `package.json`: `pnpm dev`, `pnpm build`, `pnpm lint` (zero warnings), `pnpm typecheck`, `pnpm test` (Vitest), `pnpm test:e2e` (Playwright on a built app). The `db:*` scripts drive the local Supabase stack and go when Supabase does. The W0 foundation adds the workspace's own commands; update this line when it lands.

## How to work

1. At the start of a session: read this file, the build-plan row for the workstream you are on, and the PRD sections that row names. Read nothing else up front.
2. One long-lived branch, `azure`. Workstreams in the PRD's order: W0 first; W1 and W2 next; W3 to W12 in any order; W13 re-points `apps/web` service by service; W14 to W16 close the phase. Nothing reaches production until the whole phase passes its checks.
3. Each service: a handler validates input, authorises the actor, runs one transaction together with its events, and checks the row count. Typed errors. One JSON log line per request with `request_id`, and a hashed user id, never names, emails or content.
4. Port by golden test. Before a service is written, record its public functions' outputs on the current stack. The service is not done until its golden tests match.
5. Every screen: loading, empty and error states; light and dark; keyboard-operable; passes the design gates in `docs/screen-spec.md`.
6. Before finishing: typecheck, lint, unit tests, contract tests and the workstream's own checks green. Tick the workstream's boxes in the PRD's "phase is done when" list.
7. Log every decision or deviation in `docs/decisions.md`: dated, one line, and why. If the spec is ambiguous or two sections conflict, ask Ahmed instead of picking.
8. Read only the PRD section you need. Pipe long output through `tail` or `grep`. Never paste full logs or diffs into chat.
9. Commit or push only when Ahmed asks. Never loop on a failing check more than twice; report what is failing and your best guess why.
10. Final report: at most 15 lines. What changed, what Ahmed must do by hand, and what is failing or deferred.
