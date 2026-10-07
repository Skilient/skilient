# Documentation plan

Commit: 7d26258
Covers: every tracked source file outside the CONVENTIONS exclusions (see "Coverage map")

This is the stage 3 map for `docs/code/`. It says which docs exist, what each must answer, which file belongs to which doc, and how stages 5 to 10 are cut into sessions. It analyses nothing and cites nothing: names here are leads for the writing sessions, which verify them against the code (CONVENTIONS, "Verification").

## How this plan was made

- Method: the skill's Phase 1 (inventory) and Phase 1.5 (analysis planning), with the CONVENTIONS deviations. The skill's "threads" became execution contexts, its "data flow stages" became the cross-subsystem pipelines below, and its "every inventory item gets a Phase 4 document" became "every inventory item has a home doc and appears in that doc's questions". No length estimates, no line quotas.
- Ground truth for what exists: `git ls-files` at commit 7d26258, filtered exactly as `scripts/docs/coverage.mjs` filters it: 789 source files (`.ts .tsx .mts .cts .js .mjs .cjs .sql`, tests excluded).
- Leads: the `.ua/` knowledge graph (10 layers) and domain graph (10 domains, 36 flows), the CLAUDE.md code maps, `docs/prd/README.md`, and the stage 2 schema reference. Stage 2 (commit da73a5b, merged through PR 72) is in `docs/code/reference/`; its `cron-jobs.md`, `queues.md` and `buckets.md` gave the job, queue and bucket lists below.
- The subsystem split follows the code: one doc per group of migrations that were written together and the `lib/`, `components/`, route and Edge Function folders that sit on top of them. Where a PRD domain was too large for one session (recruiters, universities), it became two docs along its migration seams.

### Rules for this file

- The coverage map is the only table in this file that holds backticked paths. `coverage.mjs` treats every backticked string in any table row as a covered path, so a stray `lib/` in another table would silently cover everything.
- Each source file sits under exactly one doc. A folder row (trailing slash) and a file row never overlap. Stage 3 checked this with a one-off script; any later edit to the map must keep it true.
- A file that serves two docs (for example `lib/actions/uni.ts`) sits under its main doc; the other doc lists the symbols it uses under "Also reads".

## 1. Inventory (Phase 1)

### Execution contexts

Every line of product code runs in one of these. Each architecture doc owns the contexts named after it.

1. Browser. Client components, `window` APIs, Supabase Realtime subscriptions, the PostHog loader, Turnstile, WAAPI motion. Owner: architecture/overview, with each subsystem describing its own client parts.
2. Next.js proxy (`proxy.ts`). Runs before every matched request: request id, nonce CSP, session refresh, the role gate. Owner: architecture/request-lifecycle (gate decisions in subsystems/auth-and-rls).
3. Server components and route handlers on Vercel (`bom1`). Data reads through `lib/data/*`, route handlers under `app/**/route.ts`. Owner: architecture/request-lifecycle.
4. Server actions (`lib/actions/*`). Zod input, user lookup, ownership check, RPC call, typed result, log line. Owner: architecture/request-lifecycle for the pattern, each subsystem for its actions.
5. Postgres. RLS policies, security-definer functions in `private` with security-invoker wrappers in `public`, triggers. Owner: subsystems/auth-and-rls for the model, each subsystem for its objects.
6. pg_cron and pgmq. 47 cron jobs, 8 queues (`analytics`, `billing_events`, `billing_jobs`, `cv_jobs`, `github_jobs`, `link_previews`, `notification_emails`, `storage_cleanup`). Owner: architecture/background-jobs.
7. Supabase Edge Functions (Deno). 11 functions: `analytics-worker`, `billing-worker`, `code-check`, `competition-freeze`, `cv-sign`, `github-link`, `github-worker`, `link-preview`, `notify-worker`, `storage-cleanup`, `webhook-worker`; shared logic under `supabase/functions/_shared/`. Owner: architecture/background-jobs for how they are woken, each subsystem for its function.
8. External services: GitHub App, Resend, Sentry, PostHog EU, Axiom, Turnstile, HIBP, the billing gateways (simulated, Safepay, Paddle). Owner: architecture/environments-and-deploy for configuration, each subsystem for its calls.
9. Build, test and CI: Vitest (unit, worker, ATS), Playwright (E2E, captures), pgTAP, GitHub Actions (`ci.yml`, `zap.yml`, `restore-drill.yml`). Owner: architecture/environments-and-deploy.

### Cross-subsystem pipelines

These are the flows that change hands between docs. Each pipeline is told once, in the doc named first; the other docs link to it.

1. Sign-up to first page: signup form → Auth hook `hook_before_user_created` / `validate_signup` → `handle_new_user` → email confirm → `/auth/callback` → gate (`my_gate_state`) → agreement → onboarding. Docs: auth-and-rls, people-and-profiles.
2. Evidence to a signed CV: GitHub link → `github-worker` stages (harvest, extract, prs, pr) → `recompute_user_skills` (L1 to L4) → endorsements, credentials, code checks → nightly ranking run → `cv_snapshot` → `cv-sign` → `/verify`. Docs: github-skills, trust-evidence, ranking, cv-signing.
3. Post to feed: `create_post` → `link_previews` queue → survey answers and qualified views → `feed-stage` cron → `feed_page`. Doc: feed-and-posts.
4. Report to appeal: `submit_report` → case queue → `resolve_case` → sanction → `refuse_if_restricted` → appeal → `overturn_decision` → ranking adjustment. Docs: moderation-and-appeals, ranking.
5. Money to entitlement: checkout → gateway → `/api/billing/webhook/[gateway]` → `record_billing_event` → `billing_events` queue → `billing_apply_event` → grants → `entitlement_value` / `require_entitlement`. Doc: billing.
6. Event to email: trigger → `private.notify()` → `notifications` row and `notification_emails` queue → `notify-worker` → Resend → Resend webhook. Docs: notifications-and-email, observability.
7. Event to analytics: trigger → `private.track()` → `analytics` queue → `analytics-worker` → PostHog; deletion through `delete_person`. Doc: observability.
8. File lifecycle: upload (sharp re-encode or browser upload with a check) → bucket → delete trigger → `storage_cleanup` queue → `storage-cleanup` function. Docs: background-jobs, plus each bucket's owner.

## 2. Doc list (Phase 1.5)

Each entry gives the purpose, what it covers (its rows in the coverage map, plus SQL objects and non-source files that live elsewhere), its entry points, and the questions it must answer for someone debugging or changing that area. "Also reads" names files that belong to another doc but that this doc must open.

### architecture/overview.md

Purpose: the map of the whole system: contexts, folders, naming conventions, how the subsystem docs fit together, and the shared UI layer.
Covers: its coverage-map rows (root layout, fonts, error and not-found pages, manifest, `components/ui/`, `components/app/`, the theme provider, the `/ui` gallery, `lib/cn.ts`, `lib/motion.ts`, `lib/format/`, `lib/images/`, `lib/storage.ts`, two hooks). Non-source: `app/globals.css`, `app/styles/tokens.css`, `tsconfig.json`, `package.json`.
Also reads: the top of every route group layout; `.ua/` layers as a lead.
Entry points: `app/layout.tsx`, `app/(dev)/ui/page.tsx`, `components/ui/index.ts`.
Questions:
1. Which route groups exist (`(app)`, `(auth)`, `(marketing)`, `(dev)`) and which roles each one serves?
2. Where does a given kind of code go: page, `lib/data`, `lib/actions`, `private` SQL, Edge Function? What decides it?
3. How do the `private` and `public` schemas divide work, and why do most `public` functions exist only as wrappers?
4. How do the design tokens reach Tailwind utilities, and how do light and dark themes switch?
5. Which UI primitives exist, and which accessibility guarantees (focus, tooltips, reduced motion) do they carry?
6. How are images re-encoded and sized before storage, and which buckets are public?
7. How are dates and relative times formatted, and why on the server?
8. Which subsystem doc to open for a given route, table or function?

### architecture/request-lifecycle.md

Purpose: what happens to one request from the edge to the database and back, for pages, server actions and route handlers.
Covers: `proxy.ts`, request id and logging, the action context and result types, the shared RPC helpers (`lib/actions/rpc.ts`, `lib/actions/recruit-run.ts`, `lib/data/rpc-json.ts`), security headers and CSP, the CSP report endpoint, `security.txt`, cookie naming.
Also reads: `lib/auth/gate.ts` (owned by auth-and-rls), `lib/supabase/{server,proxy}.ts`, a sample of actions from three subsystems, `next.config.ts` headers.
Entry points: `proxy` in `proxy.ts`; `actionContext`; `rpcAction`; `rpcJson`; `buildCsp`; `POST` in `app/api/csp-report/route.ts`.
Questions:
1. Which paths does the proxy match, and in what order does it mint the request id, build the CSP nonce, refresh the session and apply the gate?
2. How does a request id travel from the proxy to logs, Sentry and the database?
3. What does every server action do before and after its RPC, and where does each step live?
4. How does a SQL error code turn into a typed refusal the UI can show (including payment-required `PT402`)?
5. How does a page read data: one RPC returning jsonb, the user's client, caching?
6. What security headers are set, where, and how does a CSP violation get reported?
7. Which cookies exist, when do they get the `__Secure-` prefix, and how is one deleted correctly?
8. Where would a failing request show up first (log line, Sentry event, CSP report), and what fields does each carry?

### architecture/background-jobs.md

Purpose: every scheduled and queued job: what wakes it, what it does, how failures are retried and seen.
Covers: `foundations.sql` (`job_runs`, `job_run_start`, `job_run_finish`, `health_check`), `phase3_answers.sql` (the `storage_cleanup` queue, cleanup triggers and the `storage-cleanup-worker` cron; its other objects are described by chat, people-and-profiles and moderation-and-appeals), the `storage-cleanup` function.
SQL objects elsewhere: every `cron.schedule` and `pgmq.create` across `supabase/migrations/` (47 jobs, 8 queues), every `wake_*_worker` function, `private.job_watchdog` (owned by observability).
Also reads: the 11 `supabase/functions/*/index.ts` files; `supabase/config.toml`.
Entry points: the `cron.job` table as defined by migrations; `wake_*_worker` functions; each Edge Function `index.ts`.
Questions:
1. Which cron jobs exist, on what schedule, and which run SQL directly versus wake an Edge Function?
2. How does a cron job call an Edge Function (`net`, Vault secrets, auth), and what happens if the call fails?
3. For each pgmq queue: who writes, who reads, visibility timeout, retry and dead-letter behaviour?
4. What do `job_runs` record, and how does the watchdog use them?
5. Which jobs are multi-step state machines (ranking run, billing tick, GitHub sync), and how is each step committed?
6. How are files removed from storage when their owner row goes away, and which buckets have triggers?
7. How do you re-run or pause a job safely in production?
8. Which jobs purge data, and on what retention?

### architecture/environments-and-deploy.md

Purpose: environments, configuration, build, CI, deploy, database migration flow, restore drill and the doc tooling.
Covers: `next.config.ts`, `lib/env.ts`, `lib/health.ts` and `/api/health`, ESLint, PostCSS, Vitest and Playwright configs, `supabase/seed.sql`, `scripts/restore/`, `scripts/zap-gate.mjs`, `scripts/docs/`. Non-source: `.github/workflows/*.yml`, `.github/dependabot.yml`, `vercel.json`, `supabase/config.toml`, `.env.example`, `.nvmrc`, `pnpm-workspace.yaml`, `.size-limit.json`, `lighthouserc.json`, `.gitleaksignore`.
Entry points: `package.json` scripts; `ci.yml`; `restore-drill.yml`; `zap.yml`; `GET` in `app/api/health/route.ts`.
Questions:
1. Which environments exist (local, CI, preview, production), and what differs between them?
2. Which environment variables does each runtime need (Next server, browser, Edge Functions, CI), and where are they validated?
3. What does CI run on a PR and on merge to `main`, in what order, and what blocks a merge?
4. How does a migration get from `supabase/migrations/` to production, and how are generated types kept fresh?
5. What does the local seed create, and what does it open that production keeps closed?
6. How does the restore drill work, and what does `verify.mjs` check?
7. What do the custom lint rules forbid, and how do you satisfy them?
8. What does `/api/health` report, and who calls it?
9. How do the ZAP gate and the docs scripts decide pass or fail?

### subsystems/auth-and-rls.md (deep dive)

Purpose: identity end to end: sign-up and sign-in paths, two-factor, the agreement, the gate, the Supabase clients, and the RLS model every table follows.
Covers: `identity.sql`, `sync_hec_universities.sql`, `auth_decisions.sql`, `scripts/universities.mjs`, `lib/auth/`, `lib/supabase/`, auth/MFA/agreement actions, the Turnstile, HIBP, hash, rate-limit and request-meta helpers, the domain directory hook and `/api/universities/domains`, `components/auth/`, `components/agreement/`, the current-user provider, `app/(auth)/`, `app/auth/`, `/agreement`, Settings → Security. Non-source: `supabase/templates/*.html`, `supabase/seed/hec_universities.csv`.
SQL objects elsewhere: later redefinitions of `validate_signup` and `handle_new_user` (recruiter_orgs, uni_core, teacher_portal, marketing), `my_gate_state` (student_portal), `require_org`, `require_uni`, `require_super_admin` (role checks), `refuse_if_restricted` (moderation), `guard_email_change`.
Also reads: `supabase/tests/00_rls_everywhere` as evidence; `proxy.ts`.
Entry points: `hook_before_user_created`; `validate_signup`; `handle_new_user`; `my_gate_state`; `decideRoute` and `homeFor` in `lib/auth/gate.ts`; `GET` in `app/auth/callback/route.ts`; actions in `lib/actions/auth.ts` and `lib/actions/mfa.ts`.
Questions:
1. Which sign-up paths exist (student, faculty, recruiter, university official), and where does each get accepted or refused?
2. Why can a sign-up be refused after the browser said the domain was fine, and where is the final check?
3. What does the gate decide for each account state, and where are the decision table and its inputs?
4. How do sign-in failures, Turnstile, delays and the "someone is trying" email work, and why is there no lockout?
5. How do TOTP, backup codes and `aal2` requirements interact for staff, recruiters and university admins?
6. Which Supabase client is used where (browser, server, proxy, public, service), and what stops the service role leaking into user paths?
7. What is the RLS pattern (default deny, private definer plus public invoker wrapper), and how is "no table without RLS" enforced?
8. How do email confirmation, the cross-tab broadcast and "not me" work?
9. Where is the agreement version stored, and what happens when it changes?
10. What breaks if a migration redefines `validate_signup` or `handle_new_user` without carrying earlier branches forward?

### subsystems/github-skills.md (deep dive)

Purpose: GitHub connection, repository sync, commit and pull-request evidence, the skill taxonomy and L1 to L4 levels, AI-assisted commits.
Covers: `github_connect.sql`, `skills.sql`, `sync_skills_taxonomy.sql`, `github_evidence.sql`, `skill_visibility.sql`, `skill_levels.sql`, `ai_assisted_commits.sql`, `scripts/skills.mjs`, `lib/github/`, `lib/skills/`, GitHub and skill actions and reads, `components/github/`, `components/skills/`, Settings → GitHub, `/me/skills`, `/api/github/*`, the `github-link` and `github-worker` functions and `_shared/github/`. Non-source: `lib/github/taxonomy/skills.yaml`.
SQL objects elsewhere: `sync_venture_commits` and contribution links (ventures), `review_flag_queue` (trust-evidence), `ops_github_resync` and `ops_recompute_skills` (ops-console), `l3_skills`/`l4_skills` redefinitions in recruiter_jobs and teacher_portal.
Entry points: `GET` in `app/api/github/callback/route.ts`; `POST` in `app/api/github/webhook/route.ts`; `start_github_link`; `github-worker/index.ts`; `recompute_user_skills`; `my_skills`; `my_skill_proofs`.
Questions:
1. How does linking work end to end (state, ticket, `github-link`, identity binding), and what stops someone binding another person's GitHub account?
2. What does each worker stage do (harvest, extract, prs, pr), how are jobs queued and advanced, and how is a sync known to be done?
3. Which commits count as the student's work, and which are excluded (forks, bots, vendored paths, linguist excludes)?
4. How do detectors map files to skills, and how is the taxonomy changed safely (retire, never delete)?
5. What are the rules for L1, L2, L3 and L4, and which function computes each?
6. How are AI-assisted commits and agent pull requests recognised, and where does the flag surface?
7. What happens on webhook delivery (signature, de-duplication, trimming), and on app uninstall or token revocation?
8. What is visible to whom (owner-only evidence versus public level)?
9. How do you replay a stuck sync or recompute one student's skills?
10. How is the worker tested without GitHub, and what does the fake cover?

### subsystems/ranking.md (deep dive)

Purpose: the score formula, the nightly run, tiers, snapshots, anti-gaming flags, adjustments, exam periods and the leaderboard.
Covers: `ranking.sql`, `leaderboard.sql`, `lib/ranking/`, ranking reads and actions (student and ops), `components/ranking/`, the ranking ops form, `/leaderboard`, `/me/score`, `/ops/evidence/ranking/[id]`, `/ops/exam-periods`.
SQL objects elsewhere: `resolve_case` severity in `penalty_rules.sql` and `sanctions_appeals.sql`, `compute_ranking`/`score_endorsements`/`detect_rings` redefinitions in `teacher_portal.sql`, `venture_completions` (ventures), `platform_config` key `ranking.formula`, `overturn_decision` (moderation).
Also reads: `docs/ranking-reference.md` as a lead and pgTAP `32` as evidence.
Entry points: `ranking-nightly` and `ranking-step` cron jobs; `ranking_start`; `ranking_step`; `compute_ranking`; `ranking_run_all`; `leaderboard`; `my_score`.
Questions:
1. What are the score components, their weights, and where is the formula versioned?
2. How does the nightly run proceed step by step, and how does it resume after a failure?
3. How are percentiles and tiers assigned, and what does "tier met" require?
4. How do exam periods change momentum or decay?
5. What triggers an anti-gaming flag (rings, rapid gains), and what happens when staff review it?
6. How do moderation penalties and upheld appeals become adjustments?
7. When is a venture's completion frozen, and why does that matter for the score?
8. How are leaderboards scoped (department, batch, university), and how does opt-out work?
9. How do you rerun one student or the whole board, and how do you prove a change matches the hand-worked reference?

### subsystems/cv-signing.md (deep dive)

Purpose: the CV snapshot, signing and key rotation, share links, PDF export, revocation and public verification.
Covers: `verified_cv.sql`, `cv_control.sql`, `lib/cv/`, CV reads and actions (student and ops), `components/cv/`, the CV revoke ops form, `/me/cv`, `/cv/[username]`, `/verify` and `/verify/[code]`, `/api/cv/pdf`, `/api/ops/pdf-check`, `/.well-known/skilient-cv-keys.json`, the `cv-sign` function and `_shared/cv/`. Non-source: `lib/cv/fonts/`.
SQL objects elsewhere: `cv_snapshot` / `cv_snapshot_base` redefinitions (teacher_portal, uni_ecosphere, ai_assisted_commits), `has_entitlement` (billing), ban and deletion triggers on `auth.users`.
Also reads: `docs/signing-keys/` exists but is excluded (name it, never describe contents).
Entry points: `cv_issue_prepare`; `cv_issue_commit`; `cv-sign/index.ts`; `verify_cv`; `open_shared_cv`; `GET` in `app/api/cv/pdf/route.ts`; the keys route.
Questions:
1. What goes into a snapshot, and which later migrations changed it?
2. How is the snapshot canonicalised and signed, where is the private key, and how is the public key published?
3. How is a key rotated, and how do old CVs still verify?
4. When is a CV re-issued automatically, and how does the refresh queue work?
5. How do share links work (token hash, newest version only), and what does a viewer see?
6. What does `/verify` show for valid, revoked and unknown codes?
7. How is the PDF made (Chromium choice per environment, fonts, QR), and how is an export recorded and rate-limited?
8. What happens to a CV when the account is banned or deleted?
9. How do the React document and the HTML document stay identical, and what test guards that?

### subsystems/billing.md (deep dive)

Purpose: entitlements, plans, grants, quotas, checkout, gateways, webhooks, the billing lifecycle, invoices and the ops billing console.
Covers: the four billing migrations, `lib/billing/`, billing reads and actions (user and ops), `components/billing/`, `/billing/checkout/[session]`, `/billing/return/[session]`, Settings → Billing, `/org/billing`, `/uni/billing`, `/ops/billing`, `/api/billing/*`, the `billing-worker` function and `_shared/billing/`.
SQL objects elsewhere: entitlement stubs replaced here (`has_entitlement`, `org_entitled`, `org_limit`, `uni_plan`, `uni_entitled`, `uni_limit`); `hires` trigger for hire fees (jobs-and-competitions); `ops_plans` / `ops_set_plan_price` (ops-console); config keys `billing.*`.
Entry points: `create_checkout`; `POST` in `app/api/billing/webhook/[gateway]/route.ts`; `record_billing_event`; `billing_apply_event`; `billing_tick`; `billing-worker/index.ts`; `require_entitlement`; `PAID_ACTIONS` in `lib/billing/registry.ts`.
Questions:
1. How is "may this subject do X" answered (keys, aliases, grants by source, effective entitlements)?
2. How do quotas count, lock and top up, and how is a quota released on failure?
3. How does checkout price an order, and why is no price trusted from the client?
4. How does a gateway webhook become state (verify, record once, queue, apply), and what if it arrives twice or out of order?
5. What does the lifecycle tick do (trials, periods, retries, grace, licences, reminders)?
6. How are invoices numbered and made immutable, and how are credit notes issued?
7. How are the simulated, Safepay and Paddle adapters chosen per environment, and what is still marked `CONFIRM`?
8. How do sponsorships give students grants?
9. What can ops do (grant, refund, void, override), and how is each audited?
10. How do you add a new paid action without breaking the registry tests?

### subsystems/people-and-profiles.md

Purpose: profiles, onboarding, friends and blocks, and Explore search.
Covers: `friends_blocks.sql`, friend, profile and onboarding actions, friend/profile/explore reads, `lib/profile/`, `lib/explore/`, `components/{friends,profile,onboarding,explore}/`, `/friends`, `/explore`, `/onboarding`, `/profile/[username]/*`, Settings → Profile.
SQL objects elsewhere: `complete_onboarding`, `username_available`, `get_profile_card`, `sync_public_card` (identity); `search_people`, `search_ventures` (chat_extras_explore, phase3_answers); avatar cleanup trigger (phase3_answers); `private.is_blocked_with` / `is_friend_of`.
Entry points: `/onboarding/[step]`; `send_friend_request`; `block_user`; `search_people`; `/profile/[username]` layout.
Questions:
1. What are the onboarding steps, what does each save, and when is onboarding complete for the gate?
2. What does profile visibility allow others to see, and where is it enforced?
3. How do friend requests move between states, and which notifications fire?
4. What does a block hide, in which directions, and which other subsystems check it?
5. How does people search work (prefix tsquery, university scope, Global profiles)?
6. How are avatars and covers uploaded, re-encoded and cleaned up?
7. Where does the profile page get each tab's data, and which tabs belong to other docs?

### subsystems/ventures.md

Purpose: ventures (student projects): creation, team, roles, applications, invites, deliverables, updates, contributions and confirmations.
Covers: `ventures.sql`, `venture_views.sql`, `contributions.sql`, `venture_decisions.sql`, venture actions and reads, `lib/ventures/`, `components/ventures/`, `/ventures`, `/ventures/new`, `/ventures/[id]` and its tabs except chat and reviews, `/requests`.
SQL objects elsewhere: `venture_chat` and the group-chat trigger (chat), `venture_completions` and `record_venture_completion` (ranking), `start_venture_from_idea` and supervisors (faculty), `endorse_options` (trust-evidence), `sync_venture_commits` (github-skills).
Entry points: `create_venture`; `transition_venture`; `apply_to_venture`; `decide_application`; `log_contribution`; `confirm_contribution`; `venture_team`.
Questions:
1. What are the venture states and allowed transitions, and who may make each?
2. How do applications and invites work, and what happens on accept, decline, withdraw?
3. What are member roles, how is ownership transferred, and what happens when the owner leaves?
4. How is a contribution logged, confirmed or corrected, and when does it count as verified?
5. How do GitHub commits become contributions, including "before Skilient" commits?
6. What do team cards show across profile visibility and blocks?
7. How do updates and deliverables reach the feed and followers?
8. What changes when a venture completes, and what is frozen?

### subsystems/trust-evidence.md

Purpose: the human and document evidence beside GitHub: endorsements, credentials, code checks, and the staff queues that review them.
Covers: `endorsements.sql`, `credentials.sql`, `code_checks.sql`, their actions and reads, `lib/credentials/`, `lib/code-checks/`, `components/{endorsements,credentials,code-checks}/`, the trust and code-check grading ops forms, `/me/credentials`, `/me/code-checks/[id]`, `/ops/evidence` (except ranking), the `code-check` function and `_shared/codecheck/`.
SQL objects elsewhere: GitHub review flags (`open_review_flag`, `resolve_review_flag` in github_evidence), teacher endorsements and teacher code-check grading (faculty), `peer_verified` effects on levels (github-skills).
Entry points: `endorse`; `submit_credential`; `review_credential`; `request_code_check`; `start_code_check`; `grade_code_check`; `code-check/index.ts`.
Questions:
1. Who may endorse whom, with what limits, and where are the limits configured?
2. How does an endorsement change `peer_verified` and skill level?
3. How is a credential uploaded and checked (PDF magic bytes, image re-encode), and who reviews it?
4. How is a code check chosen, prepared, served and timed, and why is code never stored?
5. How does the `code-check` function decide whether a student may see a snippet?
6. How do staff claim and decide items in each evidence queue, and what is audited?
7. How do code checks route to teachers or staff, and what happens when they are overdue?
8. How much storage may a student use, and how is it counted?

### subsystems/feed-and-posts.md

Purpose: posts, media, events and polls inside posts, comments, hides and mutes, link previews, micro-surveys and the ranked feed.
Covers: `posts.sql`, `comments_links.sql`, `micro_survey.sql`, `feed_ranking.sql`, post actions and reads, `lib/posts/`, `components/posts/`, `/feed`, `/post/[id]`, the `link-preview` function and `_shared/links/`.
SQL objects elsewhere: `can_view_post` rewrite and `pinned_announcement` (university-events-and-fairs), `feed_score` / `post_quality` (ranking.sql), `post_insights` entitlement (billing), post cleanup triggers (background-jobs), `posts.removed_at` (moderation).
Entry points: `create_post`; `post_cards`; `feed_page`; `add_comment`; `survey_for_posts`; `answer_survey`; `record_views`; `link-preview/index.ts`.
Questions:
1. Who can see a post, and where is that decided?
2. How is a feed page built (stages, score, seed audience, sessions, cursor), and why might a post not appear?
3. How are media uploaded and attached, and what limits apply?
4. How are link previews fetched safely (SSRF guard), cached and purged?
5. How do micro-surveys get assigned, answered and counted, and who sees insights?
6. What is a qualified view, and how is it recorded?
7. How do comments, pins, hides and mutes work, and how deep can comments nest?
8. How do events and polls inside posts work (RSVP, vote)?

### subsystems/chat.md

Purpose: direct and group chat, venture chats, media, reactions, pins, read receipts, search and Realtime.
Covers: `chat.sql`, `chat_extras_explore.sql` (its Explore functions are described by people-and-profiles), chat actions and reads, `lib/chat/`, `components/chat/`, `/chat`, `/chat/[threadId]`, `/ventures/[id]/chat`, Settings → Chat.
SQL objects elsewhere: `toggle_reaction` change and chat media cleanup (phase3_answers), the recruiter contact DM (recruiting), `realtime.messages` policies.
Entry points: `get_or_create_dm`; `send_message`; `thread_messages`; `mark_thread_read`; `search_chats`; the Realtime subscription in `components/chat/conversation.tsx`.
Questions:
1. Why are there no insert policies, and which functions write messages?
2. How are venture group chats kept in step with venture members?
3. How does the client receive new messages (postgres_changes, the private broadcast channel, `setAuth`), and what if it misses one?
4. How do read receipts, unread counts and mutes work?
5. How are chat images stored, signed and removed?
6. How do reactions, replies, pins and edits work, and what limits apply?
7. How does chat search work, and what can it return?
8. How do blocks and restrictions affect an existing thread?

### subsystems/notifications-and-email.md

Purpose: in-app notifications, preferences, digests and every transactional email.
Covers: `notifications.sql`, notification actions and reads, `lib/email/`, `components/notifications/`, `/notifications`, Settings → Notifications, the `notify-worker` function and `_shared/notify/`.
SQL objects elsewhere: every trigger that calls `private.notify()` (one per subsystem), `university_launch` email (marketing-site), `ops_alert` kind (observability), `teacher_digest` (faculty), Auth email templates (auth-and-rls).
Entry points: `private.notify`; `notification_types`; `notify-worker/index.ts`; `my_notifications`; `set_notification_pref`.
Questions:
1. How is a notification created, and why only through `private.notify()`?
2. How do types, categories and per-category preferences decide in-app versus email versus digest?
3. How does the notify worker send, batch and cap emails (`DAILY_CAP`), and what bypasses the cap?
4. Where does the wording come from, and how is it shared between the page and the email?
5. How do you add a new notification type end to end?
6. Which emails are sent from the Next server rather than the worker, and why?
7. How are notifications purged, and how does the bell count stay live?

### subsystems/moderation-and-appeals.md

Purpose: reports, the moderation queue, decisions and penalties, sanctions and restrictions, and appeals.
Covers: `reports.sql`, `penalty_rules.sql`, `sanctions_appeals.sql`, report and appeal actions, ops moderation and sanction actions, `lib/data/ops.ts`, `lib/data/sanctions.ts`, `lib/ops/appeals.ts`, `components/reports/`, `components/appeals/`, the appeal, resolve and sanction ops forms, the restriction banner, `/appeals`, `/moderation/[id]`, `/ops/reports`, `/ops/sanctions`, `/ops/appeals`.
SQL objects elsewhere: `resolve_case` changes in `phase3_answers.sql` and `ranking.sql`; `uni_hide` (university-events-and-fairs); `org_throttle_check` (recruiting); ranking adjustments (ranking).
Also reads: `docs/emergency-ban.md` as a lead.
Entry points: `submit_report`; `ops_queue`; `claim_case`; `resolve_case`; `sanction_user`; `sanction_org`; `submit_appeal`; `decide_appeal`; `refuse_if_restricted`.
Questions:
1. How do many reports on one target become one case, and what is copied from chat?
2. What can a moderator decide, and what does each decision do to the content, the owner and their score?
3. What limits apply to moderators versus super admins (length, bans, lifts)?
4. How does an active restriction stop writes, and on which tables is the trigger installed?
5. Who may decide an appeal, and what does an overturn undo?
6. What does the owner see and get emailed after a decision?
7. How do you lift a sanction or fix a wrong decision, and what is audited?

### subsystems/ops-console.md

Purpose: the staff console shell: roles, inbox, staff management, audit search and export, user records and view-as, config and plan editing, metrics, and the phase 11 wrap-up.
Covers: `ops_shell.sql`, `users_view_as.sql`, `config_metrics.sql`, `ops_wrapup.sql` (its organisation-document objects are described by recruiting and its university list by university-portal), `lib/ops/{nav,diff,labels}.ts`, ops shell, users and config reads and actions, the console components, `/ops` layout and inbox, `/ops/audit`, `/ops/staff`, `/ops/users`, `/ops/config`, `/ops/metrics`, `/api/ops/audit/export`.
SQL objects elsewhere: `ops_audit_log` (friends_blocks), `is_staff` (identity), each queue's claim function (its own subsystem), `config_keys` rows added by later migrations.
Entry points: `ops_inbox`; `grant_staff_role`; `ops_audit_search`; `ops_user_record`; `ops_view_as_start`; `ops_set_config`; `ops_metrics`; `OPS_AREAS` in `lib/ops/nav.ts`.
Questions:
1. Which staff roles exist, what does each open, and how is the last super admin protected?
2. How does the inbox gather counts and claims across queues, and how do you add a queue?
3. What must every staff write function do for audit, and what checks it?
4. How does view-as work (session, pages allowed, notice to the user), and what can it never show?
5. How is a config key validated and versioned, and how do you add a new key?
6. How are metrics computed and refreshed, and why do charts have table views?
7. How is a staff member's two-factor reset handled?
8. How do you add a new `/ops` area?

### subsystems/student-portal.md

Purpose: the signed-in shell and the student's own space: navigation and badges, home progress and the learning layer, `/me`, the privacy centre, account deletion, feedback and graduation.
Covers: `student_portal.sql`, `graduate_rule.sql`, `lib/nav.ts`, `lib/tours/`, `lib/tips.ts`, `lib/feedback/`, learn, account and feedback actions (student and ops), batch actions, portal, me and feedback reads, `components/shell/` (except the restriction banner), `components/{tour,learn,home,feedback,account}/`, the feedback ops form, the `(app)` layout, error and loading files, `/me` and `/me/work`, Settings index, Settings → Privacy and → Account, `/feedback`, `/ops/feedback`, `/ops/graduation`.
SQL objects elsewhere: the `opportunities(tab)` stub (filled in by jobs-and-competitions), `my_gate_state` changes (auth-and-rls), `nav_badges` callers.
Entry points: `app/(app)/layout.tsx`; `PRIMARY_NAV` and `SECONDARY_NAV` in `lib/nav.ts`; `nav_badges`; `next_best_action`; `request_account_deletion`; `graduate_rollover`; `submit_feedback`.
Questions:
1. How is the navigation built for each role and screen size from one config?
2. How are badge counts computed and kept live?
3. How does the home progress card choose the next step and the to-do count?
4. How do tours and first-visit tips start, persist and replay?
5. What does account deletion do, on what timeline, and what does the gate allow meanwhile?
6. How does graduation work (the platform rule, the per-university exception), and what changes for a graduate?
7. How is feedback submitted with files, and how do staff answer it?
8. What does the privacy centre control, and where is each setting read?

### subsystems/faculty.md

Purpose: the teacher portal: applying and approval, project ideas, supervision, reviews, teacher endorsements and code-check grading, digests and reminders.
Covers: `teacher_portal.sql`, teach actions and reads, `lib/teach/`, teacher-approval ops action and form, `components/teach/`, `/teach/apply`, `/teach` portal pages except judging, `/ideas/[id]`, `/ventures/[id]/reviews`, `/ops/teachers`.
SQL objects elsewhere: faculty sign-up branches in `validate_signup`/`handle_new_user` (auth-and-rls), `uni_approve_teacher` and teacher scope (university-portal), `teacher_digest` email (notifications-and-email).
Entry points: `request_teacher_role`; `approve_teacher`; `teacher_home`; `save_idea`; `start_venture_from_idea`; `request_review`; `submit_review`; `teacher_endorse`; `teacher_grade_code_check`; `teacher-reminders` and `teacher-digest` cron jobs.
Questions:
1. How does a faculty account become an approved teacher, and who can revoke it?
2. How do ideas become ventures, and what does an idea's state allow?
3. How does supervision start and end, and what does a supervisor see and do?
4. How do review requests flow from a team to a teacher and back?
5. How do teacher endorsements and contribution confirmations differ from student ones?
6. How are code checks routed to teachers, and when do they fall back to staff?
7. What does the concentration flag detect, and who reviews it?
8. What do the reminders and the weekly digest send, and when?

### subsystems/recruiting.md

Purpose: recruiter organisations, membership and verification, the anonymised talent index and search, contact requests, shortlists and notes, the company page, the org portal, the public API and outbound webhooks.
Covers: `recruiter_orgs.sql`, `recruiter_talent.sql`, `recruiter_api.sql`, recruit actions and reads (including public invite preview and the org document action), `lib/recruit/`, `lib/api/`, recruiter components except the jobs, competitions and student-controls ones, the org ops form, `/recruit` (except jobs and competitions), `/org/*` (except billing), `/companies/[slug]`, `/ops/orgs` (except competitions), `/api/v1/*`, the `webhook-worker` function and `_shared/webhooks/`.
SQL objects elsewhere: recruiter sign-up branches (auth-and-rls), org documents in `ops_wrapup.sql`, org plan functions replaced by billing, `org_throttle_check` (moderation), talent filters touched by `ai_assisted_commits.sql`.
Also reads: `docs/recruiter-api.md`, `docs/recruiter-2fa-recovery.md` as leads; `app/(auth)/signup/recruiter/` (owned by auth-and-rls).
Entry points: `create_organization`; `require_org`; `talent_explore`; `search_talent`; `send_contact_request`; `add_to_shortlist`; `api_auth`; `app/api/v1/*/route.ts`; `webhook-worker/index.ts`.
Questions:
1. How is an organisation created, verified and joined, and why one org per account?
2. What does the talent index hold, what does it never hold, and how is it refreshed?
3. What separates anonymised explore from full search, and which entitlement unlocks it?
4. How do contact requests work, how do they expire, and how is the DM labelled?
5. How do API tokens authenticate, what is rate-limited, and what does each endpoint return?
6. How are webhooks signed, retried and protected against SSRF?
7. What can students control (prefs, viewers, company blocks)?
8. How does spam review work, and what does ops see?

### subsystems/jobs-and-competitions.md

Purpose: jobs, applications and the pipeline, hires and hire outcomes, the Opportunities tabs, and recruiter competitions with L3/L4 awards.
Covers: `recruiter_jobs.sql`, opportunities actions and reads, the applicant board, competition forms, job forms and student controls, `/recruit/jobs/*`, `/recruit/competitions/*`, `/opportunities/*`, `/competitions/[id]`, `/ops/orgs/competitions`, the `competition-freeze` function and `_shared/competitions/`.
SQL objects elsewhere: the `opportunities(tab)` stub (student-portal) and its university tabs (university-events-and-fairs), hire fees trigger (billing), `l3_skills`/`l4_skills` (github-skills), university-hosted competitions (university-events-and-fairs).
Entry points: `publish_job`; `apply_to_job`; `move_application`; `opportunities`; `save_competition`; `finish_competition`; `competition-freeze/index.ts`; `close-expired-jobs`, `competitions-tick`, `hire-outcome` cron jobs.
Questions:
1. What are the job and application states, and who may move an application?
2. How do requirements and eligibility work for applying?
3. What does each Opportunities tab list, and from where?
4. How is a hire recorded, and how are hire outcomes asked for later?
5. How does a competition run (teams, submission, scoring, freeze, finish)?
6. What does the freeze function capture, and why?
7. How do competition results become L3/L4 skill awards?
8. What expires or closes on a schedule?

### subsystems/university-portal.md

Purpose: university claims and admins, domains and departments, the ecosphere (modules, branding, pages, badges, onboarding questions), student records and dashboards, sponsorship view, and the ops university console.
Covers: `uni_core.sql`, `uni_ecosphere.sql`, `uni_records.sql`, `lib/actions/uni.ts`, `lib/data/uni.ts`, ops university reads and actions, `lib/uni/`, `lib/ecosphere/`, university components except event, check-in and fair ones, `/uni/claim`, `/uni/join`, the `/uni` portal except announcements, events, fairs, hackathons and moderation, `/u/[slug]`, `/ops/universities`, `/api/uni/export`. Non-source: `components/uni/ecosphere.css`.
SQL objects elsewhere: official sign-up branches (auth-and-rls), `ops_uni_list`/`ops_uni_record`/`ops_assign_uni_owner`/`ops_add_uni_domain` (`ops_wrapup.sql`), `universities.live_at` (marketing-site), uni plan functions replaced by billing, `university_badges` in `cv_snapshot` (cv-signing).
Also reads: `docs/university-claim-disputes.md` as a lead.
Entry points: `submit_uni_claim`; `decide_uni_claim`; `require_uni`; `save_ecosphere_page`; `award_badge`; `university_student_record`; `uni_dashboard`; `uni-daily` and `uni-stats` cron jobs.
Questions:
1. How is a university claimed and verified, and how are disputes handled?
2. Which admin roles exist, and what does each allow?
3. How are domains, departments and programmes managed, and how do they reach profiles?
4. How is ecosphere branding kept accessible (contrast check), and where do brand colours apply?
5. How are badges awarded, and why does ranking never read them?
6. What does a student record expose, how is access logged and rate-limited?
7. How are dashboard statistics computed, and how are small groups suppressed?
8. How are exports made safe (CSV formula escaping)?

### subsystems/university-events-and-fairs.md

Purpose: university announcements and pins, university moderation (hides), events with registration and check-in, job fairs with booths, queues and slots, and university hackathons with judges.
Covers: `uni_comms.sql`, `uni_fairs.sql`, the event card, check-in screen and fair-live components, `/uni` announcements, events, fairs, hackathons and moderation pages, `/teach/judging`, `/events/*`, `/fairs/*`.
SQL objects elsewhere: `can_view_post` and `pinned_announcement` (feed-and-posts), `uni_hide` to report case (moderation-and-appeals), university-hosted competitions (`recruiter_jobs.sql`), `opportunities` tabs.
Also reads: `lib/actions/uni.ts` and `lib/data/uni.ts` (owned by university-portal).
Entry points: `uni_post_announcement`; `save_event`; `rsvp_event`; `check_in_event`; `save_job_fair`; `join_fair_queue`; `fair_call_next`; `judge_score_team`; `uni-events-hourly` cron job.
Questions:
1. Who can see an announcement or an event, and how are audiences targeted?
2. How does the per-university pin work alongside the platform pin?
3. How do event check-in codes work (HMAC), and what stops replay?
4. How does a fair queue stay correct under concurrency (per-booth lock)?
5. How are fair slots booked, and how do companies get invited?
6. How do university hackathons and judging differ from recruiter competitions?
7. What does a university hide do, and how is content restored?

### subsystems/marketing-site.md

Purpose: the public site: landing and organisation pages, SEO and OG images, university requests and launch emails, sales leads, landing statistics and public plans.
Covers: `marketing.sql`, `marketing_leads.sql`, `university_launch.sql`, `app/(marketing)/` except `/verify`, `/join`, `robots.ts`, `sitemap.ts`, `/ops/leads`, `components/marketing/`, `content/`, `lib/marketing/`, `lib/og/`, marketing and leads reads and actions, the captures Playwright config. Non-source: `app/(marketing)/marketing.css`, `content/art.json`, `content/captures.json`, `lib/og/fonts/`.
SQL objects elsewhere: the `live_at` signup gate in `validate_signup` (auth-and-rls), `detectUniversity` in `lib/auth/email-domain.ts`.
Also reads: `docs/marketing-design-plan.md`, `PRODUCT.md`, `DESIGN.md` as leads.
Entry points: `app/(marketing)/page.tsx`; `request_university`; `confirm_university_request`; `landing_stats`; `public_plans`; `submit_sales_lead`; `GET` in `app/join/route.ts`.
Questions:
1. Which pages exist, which are indexed, and how are sitemap and canonicals built?
2. How does the email field detect a university without JavaScript and with it?
3. How do university requests get confirmed, rate-limited and unsubscribed, and when is the launch email sent?
4. Where do the landing numbers come from, and when are they hidden?
5. How are plan tables built from grants?
6. How are OG images and captures generated, and when must captures be regenerated?
7. How do sales leads reach staff?

### subsystems/observability.md

Purpose: product analytics, error tracking, logs, web vitals, service signals and alerts.
Covers: `analytics.sql`, `alerts.sql`, `lib/analytics/`, `lib/monitoring/`, `lib/sentry-scrub.ts`, `components/analytics/`, `instrumentation.ts`, `instrumentation-client.ts`, the Sentry configs, `/api/vitals`, `/api/webhooks/resend`, the `analytics-worker` function and `_shared/analytics/`.
SQL objects elsewhere: `private.track` triggers on source tables, `delete_person` on `auth.users` delete, `recordWebhookFailure` in the billing webhook route, GitHub headroom signals.
Also reads: `docs/analytics.md`, `docs/alerts.md` as leads; `lib/log.ts` (request-lifecycle).
Entry points: `private.track`; `analytics-worker/index.ts`; `private.alert_conditions`; `private.job_watchdog`; `record_service_signal`; `POST` in `app/api/vitals/route.ts`; `POST` in `app/api/webhooks/resend/route.ts`.
Questions:
1. Which events are recorded on the server versus in the browser, and how is a new one added?
2. Which routes are never recorded, and what is scrubbed from Sentry events?
3. How does the analytics worker batch to PostHog, and how is a person deleted?
4. Which conditions raise an alert, with what cooldown, and who receives it?
5. How do web vitals get in, and how are they capped?
6. How do Resend webhooks become signals?
7. How is monitoring data purged?

### Reference and how-to docs (stage 7)

These cover the codebase across subsystems; they own no rows in the coverage map.

- `reference/api/openapi.v1.yaml`: the recruiter API as OpenAPI 3.1. Sources: `app/api/v1/`, `lib/api/v1.ts`, the `api_*` SQL functions. Must answer: endpoints, auth, rate limit, request and response shapes, error codes.
- `reference/api/routes.md`: every page and route handler with its gate (role, two-factor, entitlement) and owning doc. Sources: `git ls-files app/`, `lib/auth/gate.ts`, `lib/nav.ts`, `lib/ops/nav.ts`.
- `reference/api/server-actions.md`: every exported action in `lib/actions/`: input schema, RPC called, refusals, entitlement.
- `reference/api/edge-functions.md`: each Edge Function: trigger, auth, inputs, outputs, environment variables, shared module.
- `reference/rpc.md`: every `public` function the app calls: arguments, return shape, caller files, owning doc.
- `reference/env.md`: every environment variable and Vault secret: runtime, required or optional, who reads it. Never values.
- `reference/prd-mismatches.md` and `reference/verification-log.md`: appended by stages 4 to 6; the last stage 7 session de-duplicates and sorts them.
- `howto/debug.md`: symptom → where to look (logs, Sentry, job_runs, queues, pgTAP), per pipeline above.
- `howto/add-a-feature.md`: the end-to-end checklist (migration, RLS, pgTAP, wrapper, action, page, nav, sweep routes, analytics, config keys, paid action registry).
- `howto/change-the-schema.md`: migration rules, redefining functions safely, types, advisors, deploy.
- `README.md`: the index of all docs with one line each, and how to read them.

## 3. Coverage map

One row per source file or folder (trailing slash). Every tracked source file outside the CONVENTIONS exclusions matches exactly one row; tests are out of scope (`coverage.mjs` skips them). Rows are grouped by doc in the order of section 2.

| Path | Doc |
|---|---|
| `app/layout.tsx` | architecture/overview |
| `app/fonts.ts` | architecture/overview |
| `app/global-error.tsx` | architecture/overview |
| `app/not-found.tsx` | architecture/overview |
| `app/manifest.ts` | architecture/overview |
| `app/(dev)/` | architecture/overview |
| `components/ui/` | architecture/overview |
| `components/app/` | architecture/overview |
| `components/providers/theme-provider.tsx` | architecture/overview |
| `lib/cn.ts` | architecture/overview |
| `lib/motion.ts` | architecture/overview |
| `lib/storage.ts` | architecture/overview |
| `lib/hooks/use-mounted.ts` | architecture/overview |
| `lib/hooks/use-theme-mode.ts` | architecture/overview |
| `lib/format/` | architecture/overview |
| `lib/images/` | architecture/overview |
| `proxy.ts` | architecture/request-lifecycle |
| `lib/request-id.ts` | architecture/request-lifecycle |
| `lib/log.ts` | architecture/request-lifecycle |
| `lib/actions/context.ts` | architecture/request-lifecycle |
| `lib/actions/result.ts` | architecture/request-lifecycle |
| `lib/actions/rpc.ts` | architecture/request-lifecycle |
| `lib/actions/recruit-run.ts` | architecture/request-lifecycle |
| `lib/data/rpc-json.ts` | architecture/request-lifecycle |
| `lib/security/headers.ts` | architecture/request-lifecycle |
| `lib/security/csp-report.ts` | architecture/request-lifecycle |
| `lib/security/cookie-name.ts` | architecture/request-lifecycle |
| `lib/security/security-txt.ts` | architecture/request-lifecycle |
| `app/api/csp-report/route.ts` | architecture/request-lifecycle |
| `app/.well-known/security.txt/route.ts` | architecture/request-lifecycle |
| `supabase/migrations/20260927000000_foundations.sql` | architecture/background-jobs |
| `supabase/migrations/20260930000000_phase3_answers.sql` | architecture/background-jobs |
| `supabase/functions/storage-cleanup/` | architecture/background-jobs |
| `supabase/functions/_shared/storage/` | architecture/background-jobs |
| `next.config.ts` | architecture/environments-and-deploy |
| `lib/env.ts` | architecture/environments-and-deploy |
| `lib/health.ts` | architecture/environments-and-deploy |
| `app/api/health/route.ts` | architecture/environments-and-deploy |
| `eslint.config.mjs` | architecture/environments-and-deploy |
| `postcss.config.mjs` | architecture/environments-and-deploy |
| `vitest.config.mts` | architecture/environments-and-deploy |
| `vitest.worker.config.mts` | architecture/environments-and-deploy |
| `vitest.ats.config.mts` | architecture/environments-and-deploy |
| `playwright.config.ts` | architecture/environments-and-deploy |
| `supabase/seed.sql` | architecture/environments-and-deploy |
| `scripts/restore/` | architecture/environments-and-deploy |
| `scripts/zap-gate.mjs` | architecture/environments-and-deploy |
| `scripts/docs/` | architecture/environments-and-deploy |
| `supabase/migrations/20260927210238_identity.sql` | subsystems/auth-and-rls |
| `supabase/migrations/20260927210824_sync_hec_universities.sql` | subsystems/auth-and-rls |
| `supabase/migrations/20260928123000_auth_decisions.sql` | subsystems/auth-and-rls |
| `scripts/universities.mjs` | subsystems/auth-and-rls |
| `lib/auth/` | subsystems/auth-and-rls |
| `lib/supabase/` | subsystems/auth-and-rls |
| `lib/actions/auth.ts` | subsystems/auth-and-rls |
| `lib/actions/mfa.ts` | subsystems/auth-and-rls |
| `lib/actions/agreement.ts` | subsystems/auth-and-rls |
| `lib/data/agreement.ts` | subsystems/auth-and-rls |
| `lib/data/universities.ts` | subsystems/auth-and-rls |
| `lib/security/turnstile.ts` | subsystems/auth-and-rls |
| `lib/security/hibp.ts` | subsystems/auth-and-rls |
| `lib/security/hash.ts` | subsystems/auth-and-rls |
| `lib/security/rate-limit.ts` | subsystems/auth-and-rls |
| `lib/security/request-meta.ts` | subsystems/auth-and-rls |
| `lib/hooks/use-domain-directory.ts` | subsystems/auth-and-rls |
| `components/auth/` | subsystems/auth-and-rls |
| `components/agreement/` | subsystems/auth-and-rls |
| `components/providers/current-user-provider.tsx` | subsystems/auth-and-rls |
| `app/(auth)/` | subsystems/auth-and-rls |
| `app/auth/` | subsystems/auth-and-rls |
| `app/(app)/agreement/` | subsystems/auth-and-rls |
| `app/(app)/settings/security/` | subsystems/auth-and-rls |
| `app/api/universities/domains/route.ts` | subsystems/auth-and-rls |
| `supabase/migrations/20260927224500_github_connect.sql` | subsystems/github-skills |
| `supabase/migrations/20260927225000_skills.sql` | subsystems/github-skills |
| `supabase/migrations/20260927225313_sync_skills_taxonomy.sql` | subsystems/github-skills |
| `supabase/migrations/20260928150000_github_evidence.sql` | subsystems/github-skills |
| `supabase/migrations/20260928170000_skill_visibility.sql` | subsystems/github-skills |
| `supabase/migrations/20261002000000_skill_levels.sql` | subsystems/github-skills |
| `supabase/migrations/20261103000000_ai_assisted_commits.sql` | subsystems/github-skills |
| `scripts/skills.mjs` | subsystems/github-skills |
| `lib/github/` | subsystems/github-skills |
| `lib/skills/` | subsystems/github-skills |
| `lib/actions/github.ts` | subsystems/github-skills |
| `lib/actions/skills.ts` | subsystems/github-skills |
| `lib/data/github.ts` | subsystems/github-skills |
| `lib/data/skills.ts` | subsystems/github-skills |
| `components/github/` | subsystems/github-skills |
| `components/skills/` | subsystems/github-skills |
| `app/(app)/settings/github/` | subsystems/github-skills |
| `app/(app)/me/skills/` | subsystems/github-skills |
| `app/api/github/` | subsystems/github-skills |
| `supabase/functions/github-link/` | subsystems/github-skills |
| `supabase/functions/github-worker/` | subsystems/github-skills |
| `supabase/functions/_shared/github/` | subsystems/github-skills |
| `supabase/migrations/20261005000000_ranking.sql` | subsystems/ranking |
| `supabase/migrations/20261006000000_leaderboard.sql` | subsystems/ranking |
| `lib/ranking/` | subsystems/ranking |
| `lib/data/ranking.ts` | subsystems/ranking |
| `lib/data/tiers.ts` | subsystems/ranking |
| `lib/data/ops-ranking.ts` | subsystems/ranking |
| `lib/actions/ranking.ts` | subsystems/ranking |
| `lib/actions/ops/ranking.ts` | subsystems/ranking |
| `components/ranking/` | subsystems/ranking |
| `components/ops/ranking-forms.tsx` | subsystems/ranking |
| `app/(app)/leaderboard/` | subsystems/ranking |
| `app/(app)/me/score/` | subsystems/ranking |
| `app/(app)/ops/evidence/ranking/` | subsystems/ranking |
| `app/(app)/ops/exam-periods/` | subsystems/ranking |
| `supabase/migrations/20261008000000_verified_cv.sql` | subsystems/cv-signing |
| `supabase/migrations/20261009000000_cv_control.sql` | subsystems/cv-signing |
| `lib/cv/` | subsystems/cv-signing |
| `lib/data/cv.ts` | subsystems/cv-signing |
| `lib/actions/cv.ts` | subsystems/cv-signing |
| `lib/actions/ops/cv.ts` | subsystems/cv-signing |
| `components/cv/` | subsystems/cv-signing |
| `components/ops/cv-revoke.tsx` | subsystems/cv-signing |
| `app/(app)/me/cv/` | subsystems/cv-signing |
| `app/cv/` | subsystems/cv-signing |
| `app/(marketing)/verify/` | subsystems/cv-signing |
| `app/api/cv/pdf/route.ts` | subsystems/cv-signing |
| `app/api/ops/pdf-check/route.ts` | subsystems/cv-signing |
| `app/.well-known/skilient-cv-keys.json/route.ts` | subsystems/cv-signing |
| `supabase/functions/cv-sign/` | subsystems/cv-signing |
| `supabase/functions/_shared/cv/` | subsystems/cv-signing |
| `supabase/migrations/20261022000000_billing_enums.sql` | subsystems/billing |
| `supabase/migrations/20261023000000_billing_core.sql` | subsystems/billing |
| `supabase/migrations/20261024000000_billing_lifecycle.sql` | subsystems/billing |
| `supabase/migrations/20261025000000_billing_ops.sql` | subsystems/billing |
| `lib/billing/` | subsystems/billing |
| `lib/actions/billing.ts` | subsystems/billing |
| `lib/actions/ops/billing.ts` | subsystems/billing |
| `lib/data/billing.ts` | subsystems/billing |
| `components/billing/` | subsystems/billing |
| `app/(app)/billing/` | subsystems/billing |
| `app/(app)/settings/billing/` | subsystems/billing |
| `app/(app)/org/(portal)/billing/` | subsystems/billing |
| `app/(app)/uni/(portal)/billing/` | subsystems/billing |
| `app/(app)/ops/billing/` | subsystems/billing |
| `app/api/billing/` | subsystems/billing |
| `supabase/functions/billing-worker/` | subsystems/billing |
| `supabase/functions/_shared/billing/` | subsystems/billing |
| `supabase/migrations/20260928230000_friends_blocks.sql` | subsystems/people-and-profiles |
| `lib/actions/friends.ts` | subsystems/people-and-profiles |
| `lib/actions/profile.ts` | subsystems/people-and-profiles |
| `lib/actions/onboarding.ts` | subsystems/people-and-profiles |
| `lib/data/friends.ts` | subsystems/people-and-profiles |
| `lib/data/profiles.ts` | subsystems/people-and-profiles |
| `lib/data/explore.ts` | subsystems/people-and-profiles |
| `lib/profile/` | subsystems/people-and-profiles |
| `lib/explore/` | subsystems/people-and-profiles |
| `components/friends/` | subsystems/people-and-profiles |
| `components/profile/` | subsystems/people-and-profiles |
| `components/onboarding/` | subsystems/people-and-profiles |
| `components/explore/` | subsystems/people-and-profiles |
| `app/(app)/friends/` | subsystems/people-and-profiles |
| `app/(app)/explore/` | subsystems/people-and-profiles |
| `app/(app)/onboarding/` | subsystems/people-and-profiles |
| `app/(app)/profile/` | subsystems/people-and-profiles |
| `app/(app)/settings/profile/` | subsystems/people-and-profiles |
| `supabase/migrations/20260928190000_ventures.sql` | subsystems/ventures |
| `supabase/migrations/20260928200000_venture_views.sql` | subsystems/ventures |
| `supabase/migrations/20260928210000_contributions.sql` | subsystems/ventures |
| `supabase/migrations/20260928220000_venture_decisions.sql` | subsystems/ventures |
| `lib/actions/ventures.ts` | subsystems/ventures |
| `lib/data/ventures.ts` | subsystems/ventures |
| `lib/ventures/` | subsystems/ventures |
| `components/ventures/` | subsystems/ventures |
| `app/(app)/requests/` | subsystems/ventures |
| `app/(app)/ventures/page.tsx` | subsystems/ventures |
| `app/(app)/ventures/new/` | subsystems/ventures |
| `app/(app)/ventures/[id]/layout.tsx` | subsystems/ventures |
| `app/(app)/ventures/[id]/page.tsx` | subsystems/ventures |
| `app/(app)/ventures/[id]/contributions/` | subsystems/ventures |
| `app/(app)/ventures/[id]/deliverables/` | subsystems/ventures |
| `app/(app)/ventures/[id]/manage/` | subsystems/ventures |
| `app/(app)/ventures/[id]/team/` | subsystems/ventures |
| `app/(app)/ventures/[id]/updates/` | subsystems/ventures |
| `supabase/migrations/20261001000000_endorsements.sql` | subsystems/trust-evidence |
| `supabase/migrations/20261003000000_credentials.sql` | subsystems/trust-evidence |
| `supabase/migrations/20261004000000_code_checks.sql` | subsystems/trust-evidence |
| `lib/actions/endorsements.ts` | subsystems/trust-evidence |
| `lib/actions/credentials.ts` | subsystems/trust-evidence |
| `lib/actions/code-checks.ts` | subsystems/trust-evidence |
| `lib/actions/ops/trust.ts` | subsystems/trust-evidence |
| `lib/data/endorsements.ts` | subsystems/trust-evidence |
| `lib/data/credentials.ts` | subsystems/trust-evidence |
| `lib/data/code-checks.ts` | subsystems/trust-evidence |
| `lib/data/ops-trust.ts` | subsystems/trust-evidence |
| `lib/credentials/` | subsystems/trust-evidence |
| `lib/code-checks/` | subsystems/trust-evidence |
| `components/endorsements/` | subsystems/trust-evidence |
| `components/credentials/` | subsystems/trust-evidence |
| `components/code-checks/` | subsystems/trust-evidence |
| `components/ops/trust-forms.tsx` | subsystems/trust-evidence |
| `components/ops/code-check-grade-form.tsx` | subsystems/trust-evidence |
| `app/(app)/me/credentials/` | subsystems/trust-evidence |
| `app/(app)/me/code-checks/` | subsystems/trust-evidence |
| `app/(app)/ops/evidence/page.tsx` | subsystems/trust-evidence |
| `app/(app)/ops/evidence/credentials/` | subsystems/trust-evidence |
| `app/(app)/ops/evidence/code-checks/` | subsystems/trust-evidence |
| `app/(app)/ops/evidence/flags/` | subsystems/trust-evidence |
| `supabase/functions/code-check/` | subsystems/trust-evidence |
| `supabase/functions/_shared/codecheck/` | subsystems/trust-evidence |
| `supabase/migrations/20260929010000_posts.sql` | subsystems/feed-and-posts |
| `supabase/migrations/20260929020000_comments_links.sql` | subsystems/feed-and-posts |
| `supabase/migrations/20260929030000_micro_survey.sql` | subsystems/feed-and-posts |
| `supabase/migrations/20260929040000_feed_ranking.sql` | subsystems/feed-and-posts |
| `lib/actions/posts.ts` | subsystems/feed-and-posts |
| `lib/data/posts.ts` | subsystems/feed-and-posts |
| `lib/posts/` | subsystems/feed-and-posts |
| `components/posts/` | subsystems/feed-and-posts |
| `app/(app)/feed/` | subsystems/feed-and-posts |
| `app/(app)/post/` | subsystems/feed-and-posts |
| `supabase/functions/link-preview/` | subsystems/feed-and-posts |
| `supabase/functions/_shared/links/` | subsystems/feed-and-posts |
| `supabase/migrations/20260929050000_chat.sql` | subsystems/chat |
| `supabase/migrations/20260929060000_chat_extras_explore.sql` | subsystems/chat |
| `lib/actions/chat.ts` | subsystems/chat |
| `lib/data/chat.ts` | subsystems/chat |
| `lib/chat/` | subsystems/chat |
| `components/chat/` | subsystems/chat |
| `app/(app)/chat/` | subsystems/chat |
| `app/(app)/settings/chat/` | subsystems/chat |
| `app/(app)/ventures/[id]/chat/` | subsystems/chat |
| `supabase/migrations/20260929000000_notifications.sql` | subsystems/notifications-and-email |
| `lib/actions/notifications.ts` | subsystems/notifications-and-email |
| `lib/data/notifications.ts` | subsystems/notifications-and-email |
| `lib/email/` | subsystems/notifications-and-email |
| `components/notifications/` | subsystems/notifications-and-email |
| `app/(app)/notifications/` | subsystems/notifications-and-email |
| `app/(app)/settings/notifications/` | subsystems/notifications-and-email |
| `supabase/functions/notify-worker/` | subsystems/notifications-and-email |
| `supabase/functions/_shared/notify/` | subsystems/notifications-and-email |
| `supabase/migrations/20260929070000_reports.sql` | subsystems/moderation-and-appeals |
| `supabase/migrations/20261007000000_penalty_rules.sql` | subsystems/moderation-and-appeals |
| `supabase/migrations/20261027000000_sanctions_appeals.sql` | subsystems/moderation-and-appeals |
| `lib/actions/reports.ts` | subsystems/moderation-and-appeals |
| `lib/actions/appeals.ts` | subsystems/moderation-and-appeals |
| `lib/actions/ops/moderation.ts` | subsystems/moderation-and-appeals |
| `lib/actions/ops/sanctions.ts` | subsystems/moderation-and-appeals |
| `lib/data/ops.ts` | subsystems/moderation-and-appeals |
| `lib/data/sanctions.ts` | subsystems/moderation-and-appeals |
| `lib/ops/appeals.ts` | subsystems/moderation-and-appeals |
| `components/reports/` | subsystems/moderation-and-appeals |
| `components/appeals/` | subsystems/moderation-and-appeals |
| `components/ops/appeal-forms.tsx` | subsystems/moderation-and-appeals |
| `components/ops/resolve-form.tsx` | subsystems/moderation-and-appeals |
| `components/ops/sanction-forms.tsx` | subsystems/moderation-and-appeals |
| `components/shell/restriction-banner.tsx` | subsystems/moderation-and-appeals |
| `app/(app)/appeals/` | subsystems/moderation-and-appeals |
| `app/(app)/moderation/` | subsystems/moderation-and-appeals |
| `app/(app)/ops/reports/` | subsystems/moderation-and-appeals |
| `app/(app)/ops/sanctions/` | subsystems/moderation-and-appeals |
| `app/(app)/ops/appeals/` | subsystems/moderation-and-appeals |
| `supabase/migrations/20261026000000_ops_shell.sql` | subsystems/ops-console |
| `supabase/migrations/20261028000000_users_view_as.sql` | subsystems/ops-console |
| `supabase/migrations/20261029000000_config_metrics.sql` | subsystems/ops-console |
| `supabase/migrations/20261030000000_ops_wrapup.sql` | subsystems/ops-console |
| `lib/ops/nav.ts` | subsystems/ops-console |
| `lib/ops/diff.ts` | subsystems/ops-console |
| `lib/ops/labels.ts` | subsystems/ops-console |
| `lib/data/ops-shell.ts` | subsystems/ops-console |
| `lib/data/ops-users.ts` | subsystems/ops-console |
| `lib/data/ops-config.ts` | subsystems/ops-console |
| `lib/actions/ops/inbox.ts` | subsystems/ops-console |
| `lib/actions/ops/staff.ts` | subsystems/ops-console |
| `lib/actions/ops/users.ts` | subsystems/ops-console |
| `lib/actions/ops/config.ts` | subsystems/ops-console |
| `components/ops/ops-sidebar.tsx` | subsystems/ops-console |
| `components/ops/inbox-claim.tsx` | subsystems/ops-console |
| `components/ops/claim-button.tsx` | subsystems/ops-console |
| `components/ops/staff-forms.tsx` | subsystems/ops-console |
| `components/ops/audit-diff.tsx` | subsystems/ops-console |
| `components/ops/user-actions.tsx` | subsystems/ops-console |
| `components/ops/config-forms.tsx` | subsystems/ops-console |
| `components/ops/config-tabs.tsx` | subsystems/ops-console |
| `components/ops/metrics-charts.tsx` | subsystems/ops-console |
| `app/(app)/ops/layout.tsx` | subsystems/ops-console |
| `app/(app)/ops/page.tsx` | subsystems/ops-console |
| `app/(app)/ops/audit/` | subsystems/ops-console |
| `app/(app)/ops/staff/` | subsystems/ops-console |
| `app/(app)/ops/users/` | subsystems/ops-console |
| `app/(app)/ops/config/` | subsystems/ops-console |
| `app/(app)/ops/metrics/` | subsystems/ops-console |
| `app/api/ops/audit/export/route.ts` | subsystems/ops-console |
| `supabase/migrations/20261010000000_student_portal.sql` | subsystems/student-portal |
| `supabase/migrations/20261011000000_graduate_rule.sql` | subsystems/student-portal |
| `lib/nav.ts` | subsystems/student-portal |
| `lib/tours/` | subsystems/student-portal |
| `lib/tips.ts` | subsystems/student-portal |
| `lib/feedback/` | subsystems/student-portal |
| `lib/actions/learn.ts` | subsystems/student-portal |
| `lib/actions/account.ts` | subsystems/student-portal |
| `lib/actions/feedback.ts` | subsystems/student-portal |
| `lib/actions/ops/feedback.ts` | subsystems/student-portal |
| `lib/actions/ops/batches.ts` | subsystems/student-portal |
| `lib/data/portal.ts` | subsystems/student-portal |
| `lib/data/me.ts` | subsystems/student-portal |
| `lib/data/feedback.ts` | subsystems/student-portal |
| `components/shell/app-shell.tsx` | subsystems/student-portal |
| `components/shell/badge-pill.tsx` | subsystems/student-portal |
| `components/shell/bottom-tabs.tsx` | subsystems/student-portal |
| `components/shell/nav-badges.tsx` | subsystems/student-portal |
| `components/shell/sidebar.tsx` | subsystems/student-portal |
| `components/shell/top-bar.tsx` | subsystems/student-portal |
| `components/tour/` | subsystems/student-portal |
| `components/learn/` | subsystems/student-portal |
| `components/home/` | subsystems/student-portal |
| `components/feedback/` | subsystems/student-portal |
| `components/account/` | subsystems/student-portal |
| `components/ops/feedback-forms.tsx` | subsystems/student-portal |
| `app/(app)/layout.tsx` | subsystems/student-portal |
| `app/(app)/error.tsx` | subsystems/student-portal |
| `app/(app)/loading.tsx` | subsystems/student-portal |
| `app/(app)/me/page.tsx` | subsystems/student-portal |
| `app/(app)/me/loading.tsx` | subsystems/student-portal |
| `app/(app)/me/work/` | subsystems/student-portal |
| `app/(app)/settings/page.tsx` | subsystems/student-portal |
| `app/(app)/settings/privacy/` | subsystems/student-portal |
| `app/(app)/settings/account/` | subsystems/student-portal |
| `app/(app)/feedback/` | subsystems/student-portal |
| `app/(app)/ops/feedback/` | subsystems/student-portal |
| `app/(app)/ops/graduation/` | subsystems/student-portal |
| `supabase/migrations/20261012000000_teacher_portal.sql` | subsystems/faculty |
| `lib/actions/teach.ts` | subsystems/faculty |
| `lib/data/teach.ts` | subsystems/faculty |
| `lib/teach/` | subsystems/faculty |
| `lib/actions/ops/teachers.ts` | subsystems/faculty |
| `components/teach/` | subsystems/faculty |
| `components/ops/teacher-forms.tsx` | subsystems/faculty |
| `app/(app)/teach/apply/` | subsystems/faculty |
| `app/(app)/teach/(portal)/layout.tsx` | subsystems/faculty |
| `app/(app)/teach/(portal)/page.tsx` | subsystems/faculty |
| `app/(app)/teach/(portal)/ideas/` | subsystems/faculty |
| `app/(app)/teach/(portal)/reviews/` | subsystems/faculty |
| `app/(app)/teach/(portal)/ventures/` | subsystems/faculty |
| `app/(app)/teach/(portal)/code-checks/` | subsystems/faculty |
| `app/(app)/teach/(portal)/settings/` | subsystems/faculty |
| `app/(app)/ideas/` | subsystems/faculty |
| `app/(app)/ventures/[id]/reviews/` | subsystems/faculty |
| `app/(app)/ops/teachers/` | subsystems/faculty |
| `supabase/migrations/20261013000000_recruiter_orgs.sql` | subsystems/recruiting |
| `supabase/migrations/20261014000000_recruiter_talent.sql` | subsystems/recruiting |
| `supabase/migrations/20261016000000_recruiter_api.sql` | subsystems/recruiting |
| `lib/actions/recruit.ts` | subsystems/recruiting |
| `lib/actions/org-document.ts` | subsystems/recruiting |
| `lib/actions/ops/orgs.ts` | subsystems/recruiting |
| `lib/data/recruit.ts` | subsystems/recruiting |
| `lib/data/recruit-public.ts` | subsystems/recruiting |
| `lib/data/ops-orgs.ts` | subsystems/recruiting |
| `lib/recruit/` | subsystems/recruiting |
| `lib/api/` | subsystems/recruiting |
| `components/recruit/api-forms.tsx` | subsystems/recruiting |
| `components/recruit/candidate-actions.tsx` | subsystems/recruiting |
| `components/recruit/org-document-form.tsx` | subsystems/recruiting |
| `components/recruit/org-forms.tsx` | subsystems/recruiting |
| `components/recruit/portal-header.tsx` | subsystems/recruiting |
| `components/recruit/recruit-nav.tsx` | subsystems/recruiting |
| `components/recruit/saved-search.tsx` | subsystems/recruiting |
| `components/recruit/shortlist-board.tsx` | subsystems/recruiting |
| `components/recruit/talent-filter-form.tsx` | subsystems/recruiting |
| `components/ops/org-forms.tsx` | subsystems/recruiting |
| `app/(app)/recruit/layout.tsx` | subsystems/recruiting |
| `app/(app)/recruit/page.tsx` | subsystems/recruiting |
| `app/(app)/recruit/analytics/` | subsystems/recruiting |
| `app/(app)/recruit/candidates/` | subsystems/recruiting |
| `app/(app)/recruit/contacts/` | subsystems/recruiting |
| `app/(app)/recruit/search/` | subsystems/recruiting |
| `app/(app)/recruit/shortlists/` | subsystems/recruiting |
| `app/(app)/org/(portal)/layout.tsx` | subsystems/recruiting |
| `app/(app)/org/(portal)/members/` | subsystems/recruiting |
| `app/(app)/org/(portal)/plan/` | subsystems/recruiting |
| `app/(app)/org/(portal)/settings/` | subsystems/recruiting |
| `app/(app)/org/join/` | subsystems/recruiting |
| `app/(app)/companies/` | subsystems/recruiting |
| `app/(app)/ops/orgs/page.tsx` | subsystems/recruiting |
| `app/(app)/ops/orgs/[id]/` | subsystems/recruiting |
| `app/(app)/ops/orgs/spam/` | subsystems/recruiting |
| `app/api/v1/` | subsystems/recruiting |
| `supabase/functions/webhook-worker/` | subsystems/recruiting |
| `supabase/functions/_shared/webhooks/` | subsystems/recruiting |
| `supabase/migrations/20261015000000_recruiter_jobs.sql` | subsystems/jobs-and-competitions |
| `lib/actions/opportunities.ts` | subsystems/jobs-and-competitions |
| `lib/data/opportunities.ts` | subsystems/jobs-and-competitions |
| `components/recruit/applicant-board.tsx` | subsystems/jobs-and-competitions |
| `components/recruit/competition-forms.tsx` | subsystems/jobs-and-competitions |
| `components/recruit/job-forms.tsx` | subsystems/jobs-and-competitions |
| `components/recruit/student-controls.tsx` | subsystems/jobs-and-competitions |
| `app/(app)/recruit/jobs/` | subsystems/jobs-and-competitions |
| `app/(app)/recruit/competitions/` | subsystems/jobs-and-competitions |
| `app/(app)/opportunities/` | subsystems/jobs-and-competitions |
| `app/(app)/competitions/` | subsystems/jobs-and-competitions |
| `app/(app)/ops/orgs/competitions/` | subsystems/jobs-and-competitions |
| `supabase/functions/competition-freeze/` | subsystems/jobs-and-competitions |
| `supabase/functions/_shared/competitions/` | subsystems/jobs-and-competitions |
| `supabase/migrations/20261017000000_uni_core.sql` | subsystems/university-portal |
| `supabase/migrations/20261018000000_uni_ecosphere.sql` | subsystems/university-portal |
| `supabase/migrations/20261021000000_uni_records.sql` | subsystems/university-portal |
| `lib/actions/uni.ts` | subsystems/university-portal |
| `lib/data/uni.ts` | subsystems/university-portal |
| `lib/data/ops-unis.ts` | subsystems/university-portal |
| `lib/actions/ops/universities.ts` | subsystems/university-portal |
| `lib/uni/` | subsystems/university-portal |
| `lib/ecosphere/` | subsystems/university-portal |
| `components/uni/bar-list.tsx` | subsystems/university-portal |
| `components/uni/branding-form.tsx` | subsystems/university-portal |
| `components/uni/claim-form.tsx` | subsystems/university-portal |
| `components/uni/ecosphere-view.tsx` | subsystems/university-portal |
| `components/uni/page-editor.tsx` | subsystems/university-portal |
| `components/uni/page-parts.tsx` | subsystems/university-portal |
| `components/uni/questions-card.tsx` | subsystems/university-portal |
| `components/uni/rpc-form.tsx` | subsystems/university-portal |
| `components/uni/settings-tabs.tsx` | subsystems/university-portal |
| `components/uni/uni-nav.tsx` | subsystems/university-portal |
| `app/(app)/uni/claim/` | subsystems/university-portal |
| `app/(app)/uni/join/` | subsystems/university-portal |
| `app/(app)/uni/(portal)/layout.tsx` | subsystems/university-portal |
| `app/(app)/uni/(portal)/page.tsx` | subsystems/university-portal |
| `app/(app)/uni/(portal)/dashboard/` | subsystems/university-portal |
| `app/(app)/uni/(portal)/people/` | subsystems/university-portal |
| `app/(app)/uni/(portal)/reports/` | subsystems/university-portal |
| `app/(app)/uni/(portal)/settings/` | subsystems/university-portal |
| `app/(app)/uni/(portal)/sponsorship/` | subsystems/university-portal |
| `app/(app)/uni/(portal)/students/` | subsystems/university-portal |
| `app/(app)/u/` | subsystems/university-portal |
| `app/(app)/ops/universities/` | subsystems/university-portal |
| `app/api/uni/export/route.ts` | subsystems/university-portal |
| `supabase/migrations/20261019000000_uni_comms.sql` | subsystems/university-events-and-fairs |
| `supabase/migrations/20261020000000_uni_fairs.sql` | subsystems/university-events-and-fairs |
| `components/uni/checkin-screen.tsx` | subsystems/university-events-and-fairs |
| `components/uni/event-card.tsx` | subsystems/university-events-and-fairs |
| `components/uni/fair-live.tsx` | subsystems/university-events-and-fairs |
| `app/(app)/uni/(portal)/announcements/` | subsystems/university-events-and-fairs |
| `app/(app)/uni/(portal)/events/` | subsystems/university-events-and-fairs |
| `app/(app)/uni/(portal)/fairs/` | subsystems/university-events-and-fairs |
| `app/(app)/uni/(portal)/hackathons/` | subsystems/university-events-and-fairs |
| `app/(app)/uni/(portal)/moderation/` | subsystems/university-events-and-fairs |
| `app/(app)/teach/(portal)/judging/` | subsystems/university-events-and-fairs |
| `app/(app)/events/` | subsystems/university-events-and-fairs |
| `app/(app)/fairs/` | subsystems/university-events-and-fairs |
| `supabase/migrations/20261031000000_marketing.sql` | subsystems/marketing-site |
| `supabase/migrations/20261101000000_marketing_leads.sql` | subsystems/marketing-site |
| `supabase/migrations/20261102000000_university_launch.sql` | subsystems/marketing-site |
| `app/(marketing)/layout.tsx` | subsystems/marketing-site |
| `app/(marketing)/page.tsx` | subsystems/marketing-site |
| `app/(marketing)/opengraph-image.tsx` | subsystems/marketing-site |
| `app/(marketing)/about/` | subsystems/marketing-site |
| `app/(marketing)/faculty/` | subsystems/marketing-site |
| `app/(marketing)/pricing/` | subsystems/marketing-site |
| `app/(marketing)/privacy/` | subsystems/marketing-site |
| `app/(marketing)/recruiters/` | subsystems/marketing-site |
| `app/(marketing)/request-university/` | subsystems/marketing-site |
| `app/(marketing)/terms/` | subsystems/marketing-site |
| `app/(marketing)/universities/` | subsystems/marketing-site |
| `app/join/route.ts` | subsystems/marketing-site |
| `app/robots.ts` | subsystems/marketing-site |
| `app/sitemap.ts` | subsystems/marketing-site |
| `app/(app)/ops/leads/` | subsystems/marketing-site |
| `components/marketing/` | subsystems/marketing-site |
| `content/` | subsystems/marketing-site |
| `lib/marketing/` | subsystems/marketing-site |
| `lib/og/` | subsystems/marketing-site |
| `lib/data/marketing.ts` | subsystems/marketing-site |
| `lib/data/ops-leads.ts` | subsystems/marketing-site |
| `lib/actions/marketing.ts` | subsystems/marketing-site |
| `lib/actions/ops/leads.ts` | subsystems/marketing-site |
| `playwright.captures.config.ts` | subsystems/marketing-site |
| `supabase/migrations/20261104000000_analytics.sql` | subsystems/observability |
| `supabase/migrations/20261105000000_alerts.sql` | subsystems/observability |
| `lib/analytics/` | subsystems/observability |
| `lib/monitoring/` | subsystems/observability |
| `lib/sentry-scrub.ts` | subsystems/observability |
| `components/analytics/` | subsystems/observability |
| `instrumentation.ts` | subsystems/observability |
| `instrumentation-client.ts` | subsystems/observability |
| `sentry.server.config.ts` | subsystems/observability |
| `sentry.edge.config.ts` | subsystems/observability |
| `app/api/vitals/route.ts` | subsystems/observability |
| `app/api/webhooks/resend/route.ts` | subsystems/observability |
| `supabase/functions/analytics-worker/` | subsystems/observability |
| `supabase/functions/_shared/analytics/` | subsystems/observability |

## 4. Session slices

Stages, as Ahmed set them (2026-10-07): 4 = architecture, 5 = the five deep dives, 6 = the other subsystem docs, 7 = API reference, 8 = verification, 10 = file comments, 11 = CLAUDE.md and CI (on `main`, no slicing). Stage 9 removes `.claude/skills/codebase-analysis/` (CONVENTIONS) and needs no slicing.

Line counts are the doc's own coverage-map files at 7d26258. "Core" is SQL, `lib/`, scripts and Edge Functions; "UI" is `app/` and `components/`. A session reads its own files plus the "Also reads" and "SQL objects elsewhere" of its docs, by grep and line offsets. The budget is about 9,000 lines of reading per session.

Rules for every writing session:

- Start from this plan's entry for the doc, its rows in the coverage map, and CONVENTIONS.
- A SQL function can be redefined by a later migration. Before describing one, run `grep -l "function private.<name>\|function public.<name>" supabase/migrations/*.sql` and read the last definition. `reference/schema/`, `reference/live-inventory.md` and `reference/drift.md` (stage 2) are leads for finding objects and where production differs.
- Append to `reference/prd-mismatches.md` and `reference/verification-log.md` as you go; never rewrite another session's rows.
- Run `pnpm docs:check` on the doc before pushing.

### Stage 4: architecture (2 sessions)

| Session | Docs | Own lines | Extra reading |
|---|---|---|---|
| 4.1 | architecture/overview, architecture/request-lifecycle | 1,976 + 686 | Route group layouts; gate.ts; supabase server and proxy clients; one server action and one data read from each of three subsystems; next.config.ts headers |
| 4.2 | architecture/background-jobs, architecture/environments-and-deploy | 571 + 953 | Every cron.schedule and pgmq.create block (grep, 47 jobs, 8 queues); the 11 Edge Function index files (270 lines); supabase/config.toml; the three workflows; package.json; vercel.json; .env.example |

### Stage 5: deep dives (5 sessions, in this order)

Each session reads every file its doc covers before writing.

| Session | Doc | Own lines (core + UI) | Start paths | Extra reading |
|---|---|---|---|---|
| 5.1 | subsystems/auth-and-rls | 4,483 + 2,758 | proxy.ts, lib/auth/gate.ts, supabase/migrations/20260927210238_identity.sql, lib/actions/auth.ts | Later validate_signup and handle_new_user definitions; require_org, require_uni, require_super_admin; pgTAP 00 |
| 5.2 | subsystems/github-skills | 6,740 + 1,108 | app/api/github/callback/route.ts, supabase/functions/_shared/github/worker.ts, supabase/migrations/20260928150000_github_evidence.sql | sync_venture_commits; l3_skills and l4_skills redefinitions; review flag functions; worker tests as evidence |
| 5.3 | subsystems/ranking | 2,845 + 978 | supabase/migrations/20261005000000_ranking.sql, supabase/migrations/20261006000000_leaderboard.sql, lib/data/ranking.ts | resolve_case in penalty_rules and sanctions_appeals; ranking redefinitions in teacher_portal; venture completion functions; overturn_decision; pgTAP 32 |
| 5.4 | subsystems/cv-signing | 2,842 + 1,387 | supabase/migrations/20261008000000_verified_cv.sql, supabase/functions/_shared/cv/sign.ts, lib/actions/cv.ts | cv_snapshot redefinitions (teacher_portal, uni_ecosphere, ai_assisted_commits); has_entitlement; auth.users triggers |
| 5.5 | subsystems/billing | 6,266 + 1,327 | supabase/migrations/20261023000000_billing_core.sql, app/api/billing/webhook/[gateway]/route.ts, lib/billing/registry.ts | Entitlement callers (grep require_entitlement and rpcAction with entitlement); hire fee trigger source; config_keys rows for billing |

Auth goes first because every other doc leans on its RLS model; github-skills, ranking and cv-signing follow the evidence pipeline in order.

### Stage 6: other subsystems (7 sessions, in this order)

Standard depth: core files are read in full; pages and components are read for what they call and render (exports, data reads, actions, test ids), not line by line.

| Session | Docs | Core lines | UI lines |
|---|---|---|---|
| 6.1 | subsystems/people-and-profiles, subsystems/chat, subsystems/notifications-and-email | 5,263 | 4,310 |
| 6.2 | subsystems/ventures, subsystems/trust-evidence | 6,424 | 4,706 |
| 6.3 | subsystems/feed-and-posts, subsystems/moderation-and-appeals | 5,963 | 3,190 |
| 6.4 | subsystems/student-portal, subsystems/faculty | 6,132 | 3,969 |
| 6.5 | subsystems/recruiting, subsystems/jobs-and-competitions | 6,553 | 4,060 |
| 6.6 | subsystems/university-portal, subsystems/university-events-and-fairs | 7,165 | 3,003 |
| 6.7 | subsystems/ops-console, subsystems/marketing-site, subsystems/observability | 6,304 | 5,106 |

Groups share code: people, chat and notifications share the Explore migration and friend and message notices; ventures and trust-evidence share contributions and endorsement options; feed and moderation share post removal; student-portal and faculty share the shell and the teacher's student side; recruiting and jobs share `lib/actions/recruit.ts`; the two university docs share `lib/actions/uni.ts` and `lib/data/uni.ts`. Ops-console comes last because it links to every queue's own doc.

### Stage 7: API reference (4 sessions)

The lists come from scripts in `scripts/docs/` (the first session writes them); sessions write only descriptions. A script's output is checked in, and the session reruns it before writing so nothing is missed.

| Session | Docs | Script lists | Reading for descriptions |
|---|---|---|---|
| 7.1 | reference/api/openapi.v1.yaml, reference/api/routes.md, reference/api/edge-functions.md | Every page and route handler with its method; every Edge Function with its env reads | Route handlers under app (1,112 lines); lib/api/v1.ts; the api_* SQL functions in recruiter_api; the 11 Edge Function index files and each shared worker's exported entry; gate.ts and both nav configs |
| 7.2 | reference/api/server-actions.md | Every exported action in lib/actions with its Zod schema name and the RPC it calls | lib/actions, all 49 files (7,163 lines) |
| 7.3 | reference/rpc.md, reference/env.md | Every public function: arguments, defining migration (last definition), caller files; every process.env and Deno.env.get read and Vault secret name | Signatures in the last defining migration; .env.example; scripts/restore/reseed-vault.sql |
| 7.4 | howto/debug.md, howto/add-a-feature.md, howto/change-the-schema.md, README.md; final pass on prd-mismatches.md and verification-log.md | none | The finished docs from stages 4 to 6 (code only to confirm a step) |

### Stage 8: verification (6 sessions)

A fresh session re-checks every claim against the code: it runs `pnpm docs:check`, then opens each cited symbol and confirms the sentence. It reads cited regions, not whole files, so its budget is citations rather than lines. Ahmed's suggested slices are kept; the standard-subsystem slice is split in three because sixteen docs are too many citations for one session.

| Session | Docs |
|---|---|
| 8.1 | the four architecture docs, subsystems/auth-and-rls |
| 8.2 | subsystems/github-skills, subsystems/ranking, subsystems/cv-signing, subsystems/billing |
| 8.3 | stage 6 sessions 6.1 and 6.2 (five docs) |
| 8.4 | stage 6 sessions 6.3, 6.4 and 6.5 (six docs) |
| 8.5 | stage 6 sessions 6.6 and 6.7 (five docs) |
| 8.6 | reference/api/*, reference/rpc.md, reference/env.md, the how-to docs and README |

### Stage 10: file comments (9 sessions)

Scope is the `--headers` set of `coverage.mjs`: 711 `.ts`/`.tsx` files, 62,022 lines at 7d26258. Groups are prefix-based; each file is in the first group whose prefix matches. JSDoc is required only in `lib/`, route handlers and Edge Functions, so those groups are smaller.

| Session | Prefixes | Files | Lines |
|---|---|---|---|
| 10.1 | lib/actions, lib/api | 50 | 7,232 |
| 10.2 | lib/data | 38 | 6,541 |
| 10.3 | the rest of lib, and the root files (proxy.ts, next.config.ts, instrumentation, Sentry and Playwright configs) | 113 | 5,517 |
| 10.4 | supabase/functions, app/api, app/.well-known, app/auth/callback, app/auth/confirm, app/join | 62 | 6,278 |
| 10.5 | app/(app)/ops, app/(app)/uni, app/(app)/teach, app/(app)/recruit, app/(app)/org | 97 | 7,615 |
| 10.6 | the rest of app/(app) | 85 | 6,973 |
| 10.7 | the rest of app; components/ui, app, providers, shell, auth, agreement, onboarding, marketing | 120 | 6,711 |
| 10.8 | components/ops, recruit, uni, teach, billing, cv | 69 | 6,914 |
| 10.9 | the rest of components | 77 | 8,241 |

Each session ends with `node scripts/docs/assert-comment-only.mjs <base-ref>` and `node scripts/docs/coverage.mjs --headers` (the count must drop by the session's file count).

## 5. Decisions (Ahmed, 2026-10-07)

1. Stage numbers: as listed at the top of section 4.
2. Sixteen subsystem docs are kept; recruiters and universities each stay split in two.
3. Stage 2 is merged into `main` (PR 72) and from there into `docs/code`.
4. A file that serves two docs carries one `Docs:` line naming the doc it is mapped to in the coverage map; the other doc names it under "Also reads".
5. Tests: architecture/environments-and-deploy has one "Tests" section (suites, folders, pgTAP numbering, which command runs what); howto/debug points to the suite for each pipeline. No test is documented on its own.
6. `reference/rpc.md` and the other stage 7 lists come from generator scripts in `scripts/docs/`; sessions write only the prose.
7. Non-source files stay outside `coverage.mjs`; each doc names them under "Covers".

Defaults taken in this revision (not asked): `reference/env.md` goes in stage 7 with rpc.md because both are script-listed tables; the how-to docs and README go in a last stage 7 session so that stage 8 verifies them; stage 8's standard-subsystem slice is split in three.
