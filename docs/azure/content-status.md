# W3 `content`: status

Updated 2026-11-26, branch `azure`. One line per W3 item, with the evidence that ticks it. Format as `docs/azure/people-status.md`.

The W3 done-when is the PRD's build-plan row: "Feed budgets met at 300 simulated users; posts, comments, polls, survey and share specs pass". As in W2 (decision W2 Q3), the specs are met by service-level journeys mirroring every test in `posts.spec.ts`, `comments.spec.ts`, `feed.spec.ts`, `survey.spec.ts` and the share test in `community.spec.ts`; web parts are `it.todo` for their workstream.

Status values: **ticked** (evidence exists), **partial** (part ticked, the rest named), **pending Ahmed** (a decision or sign-off).

| # | Item | Evidence | Date | Status |
| --- | --- | --- | --- | --- |
| 1 | Tracking sheet: every content function binned, with caller, tables and golden | `docs/azure/content-function-bins.md`: 89 owned (11 reads, 17 commands, 28 helpers, 4 schedules, 29 wrappers), 5 foreign triggers, 11 unclear (decided in docs/decisions.md 2026-11-26), 17 other-service readers; Golden column filled for all 60 ported rows | 2026-11-26 | ticked |
| 2 | Goldens recorded on the current stack, local only, stable | `packages/testing/test/content.golden.test.ts` → `packages/testing/test/golden/content/*.json`: 25 cases in 6 files, compared three times; random survey questions recorded by dimension, feed cases free of exploration draws | 2026-11-26 | ticked |
| 3 | Goldens match the port | `services/content/test/golden/*.golden.test.ts`: posts 8, comments 6, survey 5, feed 3, links 2 = 24 of 24; share.json replays with messaging (W4) | 2026-11-26 | ticked (share: W4) |
| 4 | Content schema: every table with forced default-deny RLS, one policy, a refusal test | `services/content/migrations/0001_content.sql` (22 tables), `0002_copies.sql` (11 copies); `test/refusal/tables.test.ts` (36); migration check passes | 2026-11-26 | ticked |
| 5 | Contract, budgets, callers, wiring | `packages/contracts/proto/skilient/content/v1/content.proto` (20 methods), 20 lines in `perf/budgets.json`, `src/authorize.ts`, host registry; "implements every method" and caller tests in `test/contract/content.test.ts` | 2026-11-26 | ticked |
| 6 | Events | publishes `post.created`, `post.removed`, `comment.created`, `survey.answered`, `user.deletion_confirmed`; handles 19 types through `content.copies` (`src/store/copies.ts`); registry updated with owing workstreams; `tools/lint/test/events.test.ts` passes | 2026-11-26 | ticked |
| 7 | Seams with identity and people | user.created/profile.updated/friendship/block/mute copies driven by the real events in the contract world; names via ProfileCards, mentions via ResolveUsernames (one call each); staff announcements via identity's StaffRolesOf at aal2 (identity's callers += content); people's `profile.updated` gains `department_hash`; user.deleted → rows removed + `user.deletion_confirmed` (contract test) | 2026-11-26 | ticked |
| 8 | Suspended users can't post, comment, vote or RSVP | the token's restriction where `refuse_if_restricted` sat (posts, comments, poll votes, RSVPs); contract test | 2026-11-26 | ticked |
| 9 | Feed budgets at 300 simulated users | `test/budget/feed.budget.test.ts`: 300 students, a week of posts (1,500), friendships, comments, survey counts, views; every student's first and second page. Measured 2026-11-26: first page p95 42 ms memory / 46 ms HTTP/2 (3 trips; budget 120), next page 19 / 26 ms (2 trips; budget 60), survey tick 26 / 32 ms (budget 40), PostCards 16 / 25 ms (1 trip; budget 60), RecordViews 24 / 25 ms | 2026-11-26 | ticked |
| 10 | Posts spec | `test/journeys/posts.journey.test.ts`: both spec tests on both transports (venture invite and update images W5, images W9, composer W13 `it.todo`) | 2026-11-26 | ticked |
| 11 | Comments, feed, survey, share specs | `test/journeys/{comments,feed,survey,share}.journey.test.ts` on both transports; new-posts pill (W4 realtime), followed venture updates (W5), the chat side of share (W4) `it.todo` | 2026-11-26 | ticked |
| 12 | Journey hand-off | the W3 to-do (a graduate posts to the Global Feed only) is a real test in `posts.journey.test.ts`; `docs/azure/journey-handoff.md` regenerated | 2026-11-26 | ticked |
| 13 | Link previews | `link-preview` job with the SSRF guard ported unchanged (`src/domain/links/`), nightly purge; links.json replays | 2026-11-26 | ticked |
| 14 | Typecheck, lint, unit, refusal, golden, contract, journeys, budget | "Results" below | 2026-11-26 | see "Results" |

## Left for later workstreams

- W4 messaging: replay share.json; `share_targets`, `share_post` (chat half, calling content's `VisiblePosts`), `undo_share`; the new-posts pill and live counts over realtime.
- W5 work: publish `venture.updated`, `venture.follow_changed`, `venture.completed` (content makes the Shipped post; content's `shippedNames` port needs work's venture titles), `skill.changed`, `group.member_changed` for ventures; serve a venture batch read for cards (content's `VenturePort`); own venture-update media and followed venture updates.
- W7 community: publish `society.status_changed` and society `group.member_changed` with `role`; serve the society block for cards (`SocietyPort`).
- W9 notify and media: handle `post.created` (society followers), `comment.created` (comment, reply, mention notices; read the excerpt from content), `post.removed` (delete files); media's file check behind content's `MediaPort`.
- W10 trust: publish `config.changed`, `moderation.removed`/`moderation.restored`, `post.reports_changed`; forward content's events to analytics.
- W11 market: publish `university_seat.changed`, `university_hide.changed`, the university feed module; write announcement targets through a content method.
- W12 billing: publish `entitlement.changed` (post insights).
- W13 web: call FeedPage with `with_cards` (one call for the feed's data), map content's refusal reasons to today's wording (`src/refusals.ts`).
- W14 cutover: import content's tables and fill the copies from the owners' current rows.

## Results (2026-11-26, local)

- `pnpm typecheck`, `pnpm lint` (including the migration check): pass.
- `pnpm test`: pass (exit 0). content unit 12, refusal 36, budget 4; people 37 after the `department_hash` and test-world changes; identity, platform, testing, host, lint (events 17) and web 563 pass.
- `pnpm test:contract`: pass. content 32 (contract 18, journeys 14, both transports) + 28 `it.todo`; people 52 + 18 todo; identity 138 + 36 todo; sample 22; relay 6.
- Goldens: content 24 of 24 replayed; the 25 recorded cases compared with the stack three times; people 26, identity 43 unchanged.
- Contracts: `buf lint` and `buf format` clean; no breaking change (`scripts/breaking.mjs`).
- The budget test needs a quiet machine: leftover test containers (13, from killed runs) pushed the load average to 16 and the p95s over budget; after removing them every budget passed with room (item 9).
