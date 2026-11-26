# W6 `ranking`: status

Updated 2026-11-27, branch `azure`. One line per W6 item, with the evidence that ticks it. Format as `docs/azure/work-status.md`.

The W6 done-when is the PRD's build-plan row: "Nightly run reproduces `docs/ranking-reference.md` exactly from its own schema" (the reference students of pgTAP 32, R1 to R13, including the Record students of phase 16). As in W2 to W5, the web specs (`leaderboard.spec.ts`, `ranking-ops.spec.ts`) are met by service-level journeys on both transports; web parts are `it.todo` for W13.

Status values: **ticked** (evidence exists), **partial** (part ticked, the rest named), **pending Ahmed** (a decision or sign-off).

| # | Item | Evidence | Date | Status |
| --- | --- | --- | --- | --- |
| 1 | Tracking sheet | `docs/azure/ranking-function-bins.md`: every function of `_ranking.sql` and `_leaderboard.sql` and the ranking parts of `_student_portal`, `_teacher_portal`, `_uni_ecosphere`, `_ops_wrapup`, `_the_record` and `_skill_swap`, at its latest definition, by bin, with callers and the method or module that replaces it; the functions that are other services' listed for the boundary | 2026-11-27 | ticked |
| 2 | Goldens recorded on the current stack, local only, stable | `packages/testing/test/ranking.golden.test.ts` → `test/golden/ranking/*.json`: 11 cases in 5 files (run, boards, flags, exams, exams_remove) over the reference world (`test/fixtures/ranking-reference.ts`: pgTAP 32's students with fixture ids and `.test` domains), compared twice; generated ids normalised by first appearance | 2026-11-27 | ticked |
| 3 | Goldens match the port | `services/ranking/test/golden/*.golden.test.ts`: 11 of 11, under the replay rules in `replay.ts` (decisions 2026-11-27) | 2026-11-27 | ticked |
| 4 | **Done-when: the nightly run reproduces docs/ranking-reference.md from ranking's own schema** | `test/golden/run.golden.test.ts`: the reference world fed as its owners' events, the run stepped rings → students → tiers, every component of R1 to R13 equal to the reference table (and R7 without the floor 84.60, without the exam period 75.60; R12 on 21 Dec still 100; v1 scores no Record); `run.json#reference` matches in full (scores, components, tiers, percentiles, completions) | 2026-11-27 | ticked |
| 5 | Schema: forced default-deny RLS, one policy, a refusal test per table | `migrations/0001_copies.sql` (18 event-fed copies), `0002_ranking.sql` (9 owned tables; formulas v1 and v2 seeded as on the stack); `test/refusal/tables.test.ts` (30) | 2026-11-27 | ticked |
| 6 | Contract, budgets, callers, wiring | `ranking.proto` (16 methods, a request and response message each), a budget line each, `src/authorize.ts`, host registry (core-b) | 2026-11-27 | ticked |
| 7 | Events | `src/events.ts` (publishes `tier.changed`, `ranking.published`, `ranking_flag.changed`, `fact.value_changed`, `audit.recorded`, `user.deletion_confirmed`; handles 24 types); `events.json` updated with the new types and their consumers; work publishes `contribution.logged`, `contribution.confirmed`, `pull_request.recorded` and handles `tier.changed`, `ranking_flag.changed`; events lint passes | 2026-11-27 | ticked |
| 8 | Contract tests on both transports | `test/contract/ranking.test.ts` (7 × 2): every method, caller rules, facts made through work reaching ranking and tiers back to work and people, staff refusals and audit before and after, the W7/W8/W10 facts fed as their owners will publish them, `user.deleted` | 2026-11-27 | ticked |
| 9 | Specs | `test/journeys/ranking.journey.test.ts` (5 × 2): leaderboard.spec (board, score page, tiers on cards, opting out), ranking-ops.spec (exam periods audited; a fast gain upheld and a ring cleared), the hand-offs to work | 2026-11-27 | ticked |
| 10 | Journey hand-off | people's "W6 ranking: an opted-out student is left off every board" is a real test in ranking's journey; `docs/azure/journey-handoff.md` regenerated (no W6 section) | 2026-11-27 | ticked |
| 11 | Owed to others | `work.ranking_tiers` filled from `tier.changed`; `work.ranking_flags` (new) from `ranking_flag.changed`, read by the proof-task peer check; people's `tier.next` and `tier.points` from `fact.value_changed`; `TiersFor` and `TiersOf` batch methods | 2026-11-27 | ticked |
| 12 | Typecheck, lint, unit, refusal, golden, contract, journeys | "Results" below | 2026-11-27 | see "Results" |

## Questions for Ahmed

1. **Department labels on the board's filter.** Ranking holds people's `department_hash`, never the text (payloads carry no free text), so `LeaderboardFilters` returns hashes and `Leaderboard` takes the department text and hashes it. Should people serve the texts for a set of hashes (a small batch method), or should web pair people's `DepartmentOptions` with the hashes? Today's reading (closest to production): the filter shows the same departments; how web labels them is W13's.
2. **Ties on a board.** Today, equal totals are listed by name; the port lists them by user id (ranks are the same). Acceptable, or should web re-order equal ranks by name after ProfileCards?

## Left for later workstreams

- W7 community: publish `society.status_changed` with `verified_at` (the Record's 30-day hold).
- W8 credentials: publish `record.sealed` (with `evidence {role, place, entrants, minutes}`) and `record.revoked {status revoked|superseded}`; call `TiersOf` for the CV's tier.
- W9 notify: the tier-up notice from `tier.changed`; the formula-change notice when `config.changed` adds a `ranking.formula` version.
- W10 trust: publish `case.resolved {case_id, owner_id, severity}` and `case.overturned {case_id}`; `config.changed` for `ranking.formula`, `feed.score`, `teacher.limits` (Zod schemas); the ranking flags in the /ops inbox (`RankingFlagQueue`, caller trust); analytics from `tier.changed`; /ops metrics from `ranking.published`.
- W11 market: call `UniExamPeriods`, `UniAddExamPeriod`, `UniRemoveExamPeriod` after the seat check and keep the university audit; `TiersOf` for talent search, applications and university records.
- W13 web: the board, score and /ops pages; `MyScore`'s `evidence` ids resolved with their owners in parallel; the department filter's labels (question 1); TiersFor once per page of cards.
- W14 cutover: import `ranking_scores`, `ranking_snapshots`, `anti_gaming_flags`, `ranking_adjustments`, `exam_periods` and `ranking_runs`, and fill the copies from the owners' current rows (contributions, confirmations, pull requests, join requests, skills, endorsements, credentials, posts and answers, completions, profiles, friendships, blocks, the Record, societies).
- Faculty portal (deferred): teacher endorsements (weight from `teacher.limits`) and the teacher-concentration flags.

## Results (2026-11-27, local)

- `pnpm typecheck`, `pnpm lint` (incl. the migration check and the no-foreign-schema rule): pass.
- `pnpm test` (every package, one at a time): pass. ranking unit 8, refusal 30; work 68 (refusal now 62 with `work.ranking_flags`); lint 35; web 563; the rest as before.
- `pnpm test:contract`: pass. ranking 24 (contract 14 and journeys 10, both transports) + 6 `it.todo`; work 34 + 22 todo; content 32 + 20 todo; messaging 24 + 8 todo; people 52 + 14 todo; identity 138 + 36 todo. One expectation in work's contract test now includes `skill.changed`'s new `category`.
- Goldens: ranking 12 (11 recorded cases and the done-when), work 16, messaging 18, content 24, people 26, identity 43, all match.
- `pnpm contracts:check` (after staging): pass. gitleaks on the staged diff: no leaks.
- Found and fixed on the way: people's copy-key check refused `skills.l2` (work's milestone), rolling back people's copies batch (`services/people/migrations/0003_copy_keys.sql`); identity's StaffRolesOf now lists ranking.
- PRD "phase is done when": "Ranking reference and seat-lock concurrency tests pass" stays unticked until W7's seat-lock test; the ranking half passes (item 4).
