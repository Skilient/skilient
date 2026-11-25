# W2 `people`: status

Updated 2026-11-25, branch `azure`, nothing committed. One line per W2 item, with the evidence that ticks it. Format as `docs/azure/identity-status.md`.

The W2 done-when is the PRD's build-plan row: "Shell call meets its budget; friends, blocks, privacy and onboarding specs pass". Decision W2 Q3 (advisor) sets how the specs are met: service-level journeys mirroring every test in `friends.spec.ts` and `onboarding.spec.ts`, the people parts of `student-portal.spec.ts`, and the privacy centre settings people owns; web parts are `it.todo` for their workstream.

Status values: **ticked** (evidence exists), **partial** (part ticked, the rest named), **pending Ahmed** (a decision or sign-off).

| # | Item | Evidence | Date | Status |
| --- | --- | --- | --- | --- |
| 1 | Tracking sheet: every people function binned, with caller, tables and golden | `docs/azure/people-function-bins.md`: 114 owned (18 reads, 28 commands, 21 helpers, 1 schedule, 46 wrappers), 10 foreign triggers, 9 unclear (all decided), 279 other-service readers; Golden column 68/68 | 2026-11-25 | ticked |
| 2 | Goldens recorded on the current stack, local only, stable | `packages/testing/test/people.golden.test.ts` → `packages/testing/test/golden/people/*.json`: 24 cases in 6 files, compared twice; whole-stack counts fenced to fixture rows inside the rolled-back transaction | 2026-11-25 | ticked |
| 3 | Goldens match the port | `services/people/test/golden/*.golden.test.ts`: 24/24 people cases match; identity's people halves (signup.json 4 cases, deletion.json requested, cancelled, deleted) match end to end (`identity-halves.golden.test.ts`) | 2026-11-25 | ticked |
| 4 | Platform: consumer `prepare` hook (Q2), shared `extensions` schema (Q6), restriction claim and `refuseIfRestricted` (Q10) | `packages/platform/src/events.ts`, `migrations/0003_extensions.sql`, `src/auth/user-token.ts`; tests `platform-events.test.ts` (11), `platform-restriction.test.ts` (2) | 2026-11-25 | ticked |
| 5 | Bicep: extension allow-list | `deploy/modules/data.bicep` (`azure.extensions`, `shared_preload_libraries` for pg_stat_statements; needs a server restart; not compiled or deployed, as all Bicep so far) | 2026-11-25 | partial: compile and deploy with the rest |
| 6 | People schema: every table with forced default-deny RLS, one policy, a refusal test | `services/people/migrations/0001_people.sql` (17 tables), `0002_copies.sql` (5 copies); `test/refusal/tables.test.ts` (26); `tools/lint` migration check passes | 2026-11-25 | ticked |
| 7 | Contract, budgets, callers, wiring | `packages/contracts/proto/skilient/people/v1/people.proto` (59 methods: 22 reads, 37 commands), 59 lines in `perf/budgets.json`, `src/authorize.ts`, host registry; "implements every method" and caller tests in `test/contract/people.test.ts` | 2026-11-25 | ticked |
| 8 | Seams with identity closed | people publishes `university.domains_changed` and `profile.gate_changed` as `gate-copies.ts` reads them (contract test: identity's gate and allowed domains follow people); `user.created` → profile with one GetSignupDetails call per batch; `user.deleted` → rows removed + `user.deletion_confirmed`; deletion requested/cancelled mirrored; `user.email_domain_changed`; identity's OpsStaff reads names through `ProfileCards` (`peopleNamesVia`, co-hosted contract test) | 2026-11-25 | ticked |
| 9 | Identity additions (Q7, Q9, Q10, W1 follow-up) | `CheckEmailDomains`, `email_domain` in GetSignupDetails, `user.email_domain_changed`, `importPersonalDomains` + `tools/cutover` parser, `rst` claim, lift bumps the token version, StaffRolesOf callers += people; `test/import/personal-domains.test.ts`, signup contract test; identity's full suite green (see Results) | 2026-11-25 | ticked |
| 10 | Shell: one call, one database trip, within budget | `GetShell` (one query: profile, university, tour, requests, copies); `test/budget/shell.budget.test.ts` counts queries on people's connection (1 per call) and measures p95 against `perf/budgets.json` (30 ms) on both transports | 2026-11-25 | ticked |
| 11 | Shell facts other services own (Q1, Q8) | consumer `people.copies` with an owner allow-list and a schema per key (`src/domain/shell.ts`, `src/store/copies.ts`); keys fed today: none (owners are W4-W11); keys waiting: `chat` (W4), `ventures.*`, `todo.*`, milestones, `paths.next`, `skill.changed`, ventures in `group.member_changed` (W5), `tier.next`, `tier.points` (W6), societies in `group.member_changed` (W7), `cv.built` (W8), `notifications` (W9), `openings` (W11) | 2026-11-25 | ticked; feeds wait on their owners |
| 12 | Friends and blocks spec | `test/journeys/friends.journey.test.ts`: both spec tests on both transports; live badge over realtime `it.todo` (W4), axe `it.todo` (W13) | 2026-11-25 | ticked |
| 13 | Onboarding spec | `test/journeys/onboarding.journey.test.ts`: all 6 spec tests on both transports; image re-encode and file deletion `it.todo` (W9), wizard UI `it.todo` (W13) | 2026-11-25 | ticked |
| 14 | Student portal spec, people's parts | `test/journeys/portal.journey.test.ts`: shell/tour/progress/tips, welcome (tour state), graduate status, deletion cooling-off and cancel; phone shell, film (W13), feedback (W10), graduate posting (W3), locked page (W13) `it.todo` | 2026-11-25 | ticked |
| 15 | Privacy centre and leaderboard opt-out | same file: visibility, recruiter visibility, opt-out, read receipts and blocked list stored, enforced by people's reads and published in `profile.updated`; the board itself (W6) and who-viewed / blocked companies (W11) `it.todo` | 2026-11-25 | ticked |
| 16 | Suspended users can't send friend requests (Q10) | `SendFriendRequest` refuses on the token's restriction where `refuse_if_restricted` sat (friend_requests is the only people table with it); contract test: suspended → refused, lift + refresh → allowed | 2026-11-25 | ticked |
| 17 | Staff methods: role and two-factor from identity, audit before and after | `src/api/universities.ts` (`staff()`), `people.audit_log` + `audit.recorded`; goldens universities.json#staff and #requests; contract test | 2026-11-25 | ticked |
| 18 | Typecheck, lint, unit, refusal, golden, contract, journeys, budget | "Results" below | 2026-11-25 | see "Results" |
| 19 | people_you_may_know's limit | `services/people/src/store/search.ts` applies `least(greatest(coalesce(limit, 8), 1), 30)`; `search.json#people_you_may_know` re-recorded with the limit (Ahmed's approval); replay matches | 2026-11-25 | ticked (Ahmed chose to apply the limit) |
| 20 | CI run on `azure` | needs the work committed and pushed, which only Ahmed asks for | | pending Ahmed |

## Left for later workstreams

- W3 content, W4 messaging, W6 ranking, W11 market: copy `profile.updated` (status, read receipts, opt-out, recruiter flags) and the audience edges (`friendship.changed`, `block.changed`, `mute.changed`); read names through `ProfileCards`.
- W4-W11: emit the shell's copy events (table in the sheet, "Copy keys and their owners"), with absolute values.
- W5 work and W7 community: a batch label read for venture titles and society names (people-you-may-know's "In X with you").
- W9 notify: `friend_request.changed` (notifications), `university.domains_changed` (launch emails); media: `profile.image_replaced`.
- W10 trust: forward `onboarding.*`, `tour.ended`, `profile.updated` to analytics; build `/ops` audit from `audit.recorded`; publish `config.changed` for the graduation rule.
- W11 market: check the university seat before calling the department and programme methods; own `ops_uni_list` / `ops_uni_record` / `ops_assign_uni_owner` and `landing_stats` (Ahmed).
- W13 web: map people's refusal reasons to today's wording (`services/people/src/refusals.ts` holds both); call `GetShell` once per page; run the Playwright friends, onboarding and student-portal specs.
- W14 cutover: import people's rows with ids kept, compute `email_domain` from `auth.users`, emit `profile.gate_changed` for every profile and `university.domains_changed` for every university.

## Results (2026-11-25, local)

- `pnpm typecheck`, `pnpm lint` (including the migration check): pass.
- `pnpm test`: pass (exit 0). Web 563 of 563; people 37 (unit 9, refusal 26, budget 2); identity, platform, testing, host, lint, cutover and samples all pass.
- `pnpm test:contract`: pass. people 50 (contract 22 and journeys 28, on both transports) + 20 `it.todo` (web, realtime, media, trust, content, ranking and market parts); identity 138 + 36 todo; sample 22; relay 6.
- Goldens: people 24 of 24 cases match, plus identity's people halves (2 tests: 4 sign-up cases, requested, cancelled, deleted); identity 43 of 43 (ban.json unchanged after the lift bump).
- Identity's full suite after the W2 changes: 30 files, 258 passed, 3 skipped (need the local stack), 36 todo; run three times clean (twice with the hash cache, once after Q10).
- Shell budget: 1 database trip per GetShell; p95 8.9 ms in memory and 19.5 ms over HTTP/2, against 30 ms.
- Contracts: `buf lint` and `buf format` clean; regenerating changes nothing; no breaking change against `azure` (`scripts/breaking.mjs`).
- `pnpm services:image` builds (people is in the bundle); `pnpm services:smoke` passes.
