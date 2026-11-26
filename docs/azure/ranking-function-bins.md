# Ranking: function tracking sheet (W6)

Date: 2026-11-26. Branch: `azure`. Source: `apps/web/supabase/migrations/` (`20261005000000_ranking.sql`, `20261006000000_leaderboard.sql`, and the later redefinitions in `_student_portal`, `_teacher_portal`, `_uni_ecosphere`, `_ops_wrapup`, `_the_record` (formula v2) and `_skill_swap` (swap flags)), each function at its latest definition. Format as `docs/azure/work-function-bins.md`.

Every SQL function the `ranking` service inherits, in one of the five bins from "How each function is ported" in `docs/azure/prd.md`, with its app caller, the method or module that replaces it, and its golden case.

**Boundary.** The PRD service catalogue and the W6 row: ranking owns the score formula (`ranking.formula`, v1 and v2), every score component and `compute_ranking`, the published scores, weekly snapshots, anti-gaming flags (rings, rapid gains, `swap_ring`, `swap_repeat`), adjustments (penalties, upheld gains), exam periods, the nightly run, the boards, tiers, the score page and the staff ranking review. Not ranking's: the facts it scores (work, content, people, credentials, community, trust publish them; ranking keeps event-fed copies in its own schema), `set_leaderboard_opt_out` (people, W2), `next_best_action` and `getting_started` (people, W2, from ranking's `fact.value_changed`), `resolve_case` and the appeal overturn (trust, W10; ranking applies their `case.resolved` and `case.overturned`), the faculty portal's teacher-concentration flags (deferred with the faculty portal, decision 11 of 2026-11-22).

## Reconciliation

Read called by the app: 10, Command called by the app: 7, Trigger or internal helper: 26 (TypeScript modules or SQL in `services/ranking/src/store`), Scheduled job: 2, Wrapper or plumbing that only existed for Supabase: 15, Not ranking's (listed for the boundary): 9.

Golden column: "Recorded and replayed: `<file>#<case>`" means `packages/testing/test/ranking.golden.test.ts` recorded it on the local stack and `services/ranking/test/golden/*.golden.test.ts` replays it against the port.

## Functions by source file

### 20261005000000_ranking.sql

| Function | Source (latest) | Bin | Caller | Replaced by | Golden |
| --- | --- | --- | --- | --- | --- |
| `private.ranking_formula` | `20261005000000_ranking.sql:40` | Trigger or internal helper | SQL | `store/formula.ts` `formulaInForce` over `ranking.formulas` (v1 and v2 seeded; `config.changed` adds versions) | Recorded and replayed: run.json#reference |
| `private.record_venture_completion` | `20261005000000_ranking.sql:263` | Not ranking's | trigger | work (W5) freezes the completion; ranking copies it from `venture.completed` (`completion` in the payload) | Recorded and replayed: run.json#reference (`venture_completions`) |
| `private.ventures_record_completion` | `20261005000000_ranking.sql:303` | Not ranking's | trigger | work (W5) | n/a |
| `private.venture_complexity` | `20261005000000_ranking.sql:338` | Trigger or internal helper | SQL | `domain/score.ts` `complexity` | Unit (`test/unit/score.test.ts`) and run.json#reference |
| `private.post_quality` | `20261005000000_ranking.sql:358` | Trigger or internal helper | SQL | `store/facts.ts` (quality over the survey copy; content keeps its own for the feed) | Recorded and replayed: run.json#reference |
| `private.feed_score` | `20261005000000_ranking.sql:403` | Not ranking's | SQL | content (W3) | n/a |
| `private.verified_entries` | `20261005000000_ranking.sql:478` | Trigger or internal helper | SQL | `store/facts.ts` `factsFor` (verified entries) | Recorded and replayed: run.json#reference (facts) |
| `private.score_work` | `20261005000000_ranking.sql:501` | Trigger or internal helper | SQL | `domain/score.ts` `scoreWork` | Recorded and replayed: run.json#reference |
| `private.score_skills` | `20261005000000_ranking.sql:567` | Trigger or internal helper | SQL | `domain/score.ts` `scoreSkills` | Recorded and replayed: run.json#reference |
| `private.score_endorsements` | `20261012000000_teacher_portal.sql:2027` | Trigger or internal helper | SQL | `domain/score.ts` `scoreEndorsements` (teacher weight from `teacher.limits` kept; work issues no teacher endorsements until the faculty portal) | Recorded and replayed: run.json#reference |
| `private.score_credentials` | `20261005000000_ranking.sql:646` | Trigger or internal helper | SQL | `domain/score.ts` `scoreCredentials` | Recorded and replayed: run.json#reference |
| `private.exam_days` | `20261005000000_ranking.sql:674` | Trigger or internal helper | SQL | `domain/score.ts` `examDays` | Unit and run.json#reference (R7) |
| `private.score_momentum` | `20261005000000_ranking.sql:691` | Trigger or internal helper | SQL | `domain/score.ts` `scoreMomentum` | Recorded and replayed: run.json#reference |
| `private.score_adjustments` | `20261005000000_ranking.sql:814` | Trigger or internal helper | SQL | `domain/score.ts` `scoreAdjustments` | Recorded and replayed: run.json#reference |
| `private.compute_ranking` | `20261112000001_the_record.sql:1791` | Trigger or internal helper | SQL | `domain/score.ts` `computeRanking` (pure over `Facts`), `store/facts.ts` loads the facts | Recorded and replayed: run.json#reference |
| `private.ranking_points` | `20261112000001_the_record.sql:1843` | Trigger or internal helper | SQL | `domain/score.ts` `rankingPoints` | Recorded and replayed: run.json#snapshots |
| `private.venture_outside_evidence` | `20261005000000_ranking.sql:911` | Trigger or internal helper | SQL | `store/rings.ts` (frozen completion deliverables or a GitHub entry) | Recorded and replayed: flags.json#ring |
| `private.detect_rings` | `20261012000000_teacher_portal.sql:2213` | Trigger or internal helper | SQL | `store/rings.ts` `detectRings` (`detect_rings_base`; the teacher-concentration half waits with the faculty portal) | Recorded and replayed: flags.json#ring |
| `private.detect_rings_base` | `20261005000000_ranking.sql:928` | Trigger or internal helper | SQL | `store/rings.ts` `detectRings` | Recorded and replayed: flags.json#ring |
| `private.detect_teacher_concentration` | `20261012000000_teacher_portal.sql:2178` | Not ranking's | SQL | faculty portal (deferred) | n/a |
| `private.ranking_apply` | `20261005000000_ranking.sql:1017` | Trigger or internal helper | SQL | `store/run.ts` `applyStudent` | Recorded and replayed: run.json#reference, flags.json#rapid_gain, flags.json#rapid_gain_cleared |
| `private.tier_met` | `20261005000000_ranking.sql:1119` | Trigger or internal helper | SQL | `domain/tiers.ts` `tierMet` | Unit and run.json#reference |
| `private.assign_percentiles_and_tiers` | `20261005000000_ranking.sql:1159` | Trigger or internal helper | SQL | `store/run.ts` `assignTiers` (publishes `tier.changed`, `fact.value_changed`) | Recorded and replayed: run.json#reference |
| `private.take_ranking_snapshot` | `20261005000000_ranking.sql:1198` | Trigger or internal helper | SQL | `store/run.ts` `takeSnapshot` | Recorded and replayed: run.json#snapshots |
| `private.ranking_start` | `20261005000000_ranking.sql:1223` | Scheduled job | cron `ranking-nightly` | schedule `ranking-nightly` → `store/run.ts` `startRun` (job_runs → the job row) | Recorded and replayed: run.json#reference |
| `private.ranking_step` | `20261005000000_ranking.sql:1255` | Scheduled job | cron `ranking-step` | schedule `ranking-step` → `store/run.ts` `step` (one committed step per job) | Recorded and replayed: run.json#reference |
| `private.ranking_run_all` | `20261005000000_ranking.sql:1328` | Trigger or internal helper | SQL (tests, manual rerun) | `store/run.ts` `runAll` | Recorded and replayed: run.json#reference |
| `private.resolve_case` | `20261007000000_penalty_rules.sql:6` | Not ranking's | lib/actions/ops/moderation.ts | trust (W10) publishes `case.resolved` with the severity; ranking writes the penalty (`store/copies.ts`) | Contract test (fed `case.resolved`) |
| `private.ranking_flag_queue` | `20261005000000_ranking.sql:1480` | Read called by the app | lib/data/ops-ranking.ts | `RankingFlagQueue` (member and claimer ids; names from people) | Recorded and replayed: flags.json#ring, flags.json#ring_upheld |
| `private.ranking_flag_case` | `20261005000000_ranking.sql:1506` | Read called by the app | lib/data/ops-ranking.ts | `RankingFlagCase` (ids; names, titles and skill labels from their owners in web) | Recorded and replayed: flags.json#ring, flags.json#ring_upheld |
| `private.claim_ranking_flag` | `20261005000000_ranking.sql:1551` | Command called by the app | lib/actions/ops/ranking.ts, lib/actions/ops/inbox.ts | `ClaimRankingFlag` (audited before and after) | Recorded and replayed: flags.json#ring, flags.json#ring_upheld |
| `private.review_ranking_flag` | `20261005000000_ranking.sql:1589` | Command called by the app | lib/actions/ops/ranking.ts | `ReviewRankingFlag` (audited; upheld gain → adjustment) | Recorded and replayed: flags.json#ring, flags.json#ring_upheld, flags.json#rapid_gain, flags.json#rapid_gain_cleared |
| `private.require_accounts` | `20261005000000_ranking.sql:1631` | Trigger or internal helper | SQL | `src/identity.ts` `requireAccounts` (identity's StaffRolesOf, aal2) | Recorded and replayed: exams.json#staff, exams_remove.json#remove |
| `private.exam_period_list` | `20261005000000_ranking.sql:1647` | Read called by the app | lib/data/ops-ranking.ts | `ExamPeriodList` (university and creator ids) | Recorded and replayed: exams.json#staff, exams_remove.json#remove |
| `private.add_exam_period` | `20261030000000_ops_wrapup.sql:8` | Command called by the app | lib/actions/ops/ranking.ts | `AddExamPeriod` (audited) | Recorded and replayed: exams.json#staff, exams_remove.json#remove |
| `private.remove_exam_period` | `20261030000000_ops_wrapup.sql:44` | Command called by the app | lib/actions/ops/ranking.ts | `RemoveExamPeriod` (audited) | Recorded and replayed: exams.json#staff, exams_remove.json#remove |
| `public.ranking_flag_queue`, `public.ranking_flag_case`, `public.claim_ranking_flag`, `public.review_ranking_flag`, `public.exam_period_list`, `public.add_exam_period`, `public.remove_exam_period` | `20261005000000_ranking.sql:1742-1760` | Wrapper or plumbing that only existed for Supabase | lib/* | deleted | n/a |

### 20261006000000_leaderboard.sql

| Function | Source (latest) | Bin | Caller | Replaced by | Golden |
| --- | --- | --- | --- | --- | --- |
| `private.set_leaderboard_opt_out` | `20261006000000_leaderboard.sql:13` | Not ranking's | lib/actions/ranking.ts | people (W2) `SetLeaderboardOptOut`; ranking copies `leaderboard_opt_out` from `profile.updated` | Journey (`opted-out student left off every board`) |
| `private.tiers_for` | `20261006000000_leaderboard.sql:34` | Read called by the app | lib/data/tiers.ts | `TiersFor` (batch, at most 200; signed in; blocks left out); `TiersOf` for services (no viewer) | Recorded and replayed: boards.json#tiers |
| `private.last_snapshot_week` | `20261006000000_leaderboard.sql:58` | Trigger or internal helper | SQL | `store/boards.ts` | Recorded and replayed: boards.json#boards |
| `private.board` | `20261010000000_student_portal.sql:138` | Trigger or internal helper | SQL | `store/boards.ts` `board` (deleting accounts off; graduates off university boards after 12 months) | Recorded and replayed: boards.json#boards |
| `private.leaderboard` | `20261006000000_leaderboard.sql:114` | Read called by the app | lib/data/ranking.ts | `Leaderboard` (user ids; faces from people's ProfileCards, which applies can_view_profile) | Recorded and replayed: boards.json#boards |
| `private.leaderboard_me` | `20261006000000_leaderboard.sql:141` | Read called by the app | lib/data/ranking.ts | `LeaderboardMe` | Recorded and replayed: boards.json#boards |
| `private.leaderboard_filters` | `20261006000000_leaderboard.sql:179` | Read called by the app | lib/data/ranking.ts | `LeaderboardFilters` (department hashes, batches; question in `ranking-status.md`) | Recorded and replayed: boards.json#boards (departments compared by hash) |
| `private.next_tier_requirements` | `20261006000000_leaderboard.sql:201` | Trigger or internal helper | SQL (my_score, next_best_action) | `domain/tiers.ts` `nextTierRequirements`; in `MyScore`, and published to people as `fact.value_changed {tier.next}` | Recorded and replayed: boards.json#score |
| `private.my_score` | `20261112000001_the_record.sql:1856` | Read called by the app | lib/data/ranking.ts | `MyScore` (components JSON; skill labels from the copy; other evidence as ids for web's owner reads) | Recorded and replayed: boards.json#score |
| `public.set_leaderboard_opt_out`, `public.tiers_for`, `public.leaderboard`, `public.leaderboard_me`, `public.leaderboard_filters`, `public.my_score` | `20261006000000_leaderboard.sql:332-344` | Wrapper or plumbing that only existed for Supabase | lib/* | deleted | n/a |

### 20261112000001_the_record.sql (formula v2)

| Function | Source (latest) | Bin | Caller | Replaced by | Golden |
| --- | --- | --- | --- | --- | --- |
| `private.score_record` | `20261112000001_the_record.sql:1723` | Trigger or internal helper | SQL | `domain/score.ts` `scoreRecord` (over the `record.sealed`/`record.revoked` copy and `society.status_changed` verification dates) | Recorded and replayed: run.json#reference (R11 to R13) |
| `private.academic_year` | `20261112000001_the_record.sql` | Trigger or internal helper | SQL | `domain/score.ts` `academicYear` | Unit |
| formula v2 insert, `config_keys` schema update, `ranking_formula` notice | `20261112000001_the_record.sql:1696-1911` | Trigger or internal helper | migration | `migrations/0002_formula.sql` seeds v1 and v2; the v2 notice was a one-time send (done on the stack) | n/a |

### Other migrations

| Function | Source (latest) | Bin | Caller | Replaced by | Golden |
| --- | --- | --- | --- | --- | --- |
| `private.uni_add_exam_period` | `20261018000000_uni_ecosphere.sql:897` | Command called by the app | lib/actions/uni.ts | `UniAddExamPeriod` (caller market, which checks the seat and writes its university audit; 90-day yearly cap kept here) | Contract test |
| `private.uni_remove_exam_period` | `20261018000000_uni_ecosphere.sql:944` | Command called by the app | lib/actions/uni.ts | `UniRemoveExamPeriod` (caller market) | Contract test |
| exam periods in the university calendar page | `20261018000000_uni_ecosphere.sql:845` | Read called by the app | lib/data/uni.ts | `UniExamPeriods` (caller market) | Contract test |
| `private.swap_flags` | `20261113000002_skill_swap.sql:690` | Trigger or internal helper | SQL | work (W5) detects and publishes `swap.flagged`; ranking stores the flag once while one is open (`store/copies.ts`) | Contract test |
| `private.task_peer_ok` (ring part) | `20261113000001_paths_tasks.sql:548` | Not ranking's | SQL | work's peer check reads `work.ranking_flags`, fed by ranking's `ranking_flag.changed` | Work journey (W6 hand-off) |
| `private.overturn_decision` (penalty part) | `20261027000000_sanctions_appeals.sql:863` | Not ranking's | SQL | trust (W10) publishes `case.overturned`; ranking deletes the case's penalties | Contract test |
| `private.analytics_tier` | `20261104000000_analytics.sql:229` | Not ranking's | trigger | trust (W10) forwards `tier.changed` to analytics | n/a |
| `private.next_best_action`, `private.getting_started` | `20261010000000_student_portal.sql:654,719` | Not ranking's | lib/data/portal.ts | people (W2) over `fact.value_changed {tier.next, tier.points}` | People goldens |
| `ops_inbox` (ranking_flags rows) | `20261026000000_ops_shell.sql:66` | Not ranking's | lib/data/ops-shell.ts | trust (W10) calls `RankingFlagQueue` | n/a |

### Readers of ranking's tables in other services' functions

`cv_snapshot` (W8), `talent_*`, `search_talent`, `recruit_candidate`, job eligibility, uni records and stats (W11), `ops_user_record` (W10), `compute_paths` (work: `work.ranking_tiers`, fed by `tier.changed`) read `ranking_scores.tier`. They call `TiersOf` (one batch per page) or copy `tier.changed`.

### Scheduled jobs

| Cron (today) | Schedule (UTC) | Replaced by |
| --- | --- | --- |
| `ranking-nightly` | `7 22 * * *` (03:07 PKT) | ranking schedule `ranking-nightly`, same slot: starts the run and queues its first step |
| `ranking-step` | `* * * * *` | each step queues the next as a job (`ranking-step`, deduplicated per run and step); a minute schedule `ranking-step` stays as the safety net for a lost job |
