# W7 `community`: status

Updated 2026-11-27, branch `azure`. One line per W7 item, with the evidence that ticks it. Format as `docs/azure/work-status.md`.

The W7 done-when is the PRD's build-plan row as the W7 brief scoped it: "the seat-lock concurrency test passes (apps/web/tests/worker/event-seats.test.ts), and the societies, events, tickets and check-in parts of apps/web/tests/e2e/societies.spec.ts pass as service journeys". The yearbook named in the PRD row was removed from the product (migration 20261124000000, decision 2026-11-23): its functions are listed in the sheet as removed. As in W2 to W6, the specs are met by service-level journeys on both transports; web parts are `it.todo` for W13.

Status values: **ticked** (evidence exists), **partial** (part ticked, the rest named), **pending Ahmed** (a decision or sign-off).

| # | Item | Evidence | Date | Status |
| --- | --- | --- | --- | --- |
| 1 | Tracking sheet | `docs/azure/community-function-bins.md`: every function of the three society migrations at its latest definition, by bin, with callers and the method or module that replaces it; the university-event functions (market, W11), content's and trust's parts, the Record triggers (W8) and the 31 removed yearbook functions listed; Golden column filled from the recorder | 2026-11-27 | ticked |
| 2 | Goldens recorded on the current stack, local only, stable | `packages/testing/test/community.golden.test.ts` → `test/golden/community/*.json`: 19 cases in 9 files (societies, membership, inductions, staff, events, registrations, checkin, closeout, payments) over the shared world `test/fixtures/community-world.ts`; random values recorded as their type; compared with the stack eight more times (two unstable steps dropped and two ties separated, decisions 2026-11-27) | 2026-11-27 | ticked |
| 3 | Goldens match the port | `services/community/test/golden/{societies,events}.golden.test.ts`: 19 of 19, under the replay rules in `replay.ts` | 2026-11-27 | ticked |
| 4 | **Done-when: the seat-lock concurrency test** | `test/journeys/seats.journey.test.ts` (both transports, a 30-connection pool): 120 concurrent RegisterEvent calls for 50 seats confirm exactly 50 and waitlist 70 at 1..70; three parallel repeats by one student are refused and leave one row; 10 concurrent cancellations promote the first 10 waiting in order | 2026-11-27 | ticked |
| 5 | **Done-when: societies.spec (societies, events, tickets, check-in, paid tickets)** | `test/journeys/societies.journey.test.ts` (request with proof, the name check, trust claim and approve audited, setup, inductions round, apply and accept, posting as the society with its byline), `events.journey.test.ts` (a student can't create an event, publish with its post, one seat then the waitlist, a signed ticket checks in once, amber on a second scan, red when forged, the live headcount over realtime's event: topic, a walk-in by email, search, CSV rows, close-out and issuing, feedback), `paid.journey.test.ts` (details confirmed by a second officer, a held seat, receipt, duplicate flag, approval confirms, an unpaid hold frees on event-tick) | 2026-11-27 | ticked |
| 6 | Schema: forced default-deny RLS, one policy, a refusal test per table | `migrations/0001` to `0004` (34 tables; settings seeded from the current stack); `test/refusal/tables.test.ts` (37) | 2026-11-27 | ticked |
| 7 | Contract, budgets, callers, wiring | `community.proto` (73 methods, a request and response message each; SocietyCards and CanListenEvent marked side-effect-free, one trip each), a budget line each, `src/authorize.ts`, host registry; identity's ResolveEmails and people's FilterByName (new, community only); community added to content's CreatePost, people's ListUniversities and identity's StaffRolesOf callers | 2026-11-27 | ticked |
| 8 | Events | `src/events.ts` (22 published, 3 handled); `events.json`: the W7 types with their consumers (credentials, notify, trust, market, media); community added to profile.updated, friendship.changed and audit.recorded; dropped from badge.count_changed's producers (no shell count is community's); events lint passes | 2026-11-27 | ticked |
| 9 | Owed to others | content: `society.status_changed`, `group.member_changed` with role, the society block from `SocietyCards` (content's `societyPort`); people: group copies and suggestion labels (`store/labels.ts`); ranking: `verified_at` on `society.status_changed`; realtime: `CanListenEvent` and NOTIFY headcounts on `event:{id}`; W8: `event.closed` with each entry's evidence and `society.term_changed`; W9: notices as events and `community_file.released`; W10: `payment.disputed`, `audit.recorded`; W11: `event.updated`, `induction.changed` | 2026-11-27 | ticked |
| 10 | Contract tests on both transports | `test/contract/community.test.ts` (7 × 2): callers, a signed-out reader, a repeated write, staff refusals and audit before and after, the hand-offs to content, people and ranking, a confirmed term and an auto close-out for credentials, a dispute for trust and a released receipt for media, `user.deleted` | 2026-11-27 | ticked |
| 11 | Journey hand-off | no `it.todo` named W7 in other services' journeys; community's web parts are W13 and receipts' privacy W9; `docs/azure/journey-handoff.md` regenerated | 2026-11-27 | ticked |
| 12 | Typecheck, lint, unit, refusal, golden, contract, journeys | "Results" below | 2026-11-27 | see "Results" |

## Questions

Answered by Ahmed on 2026-11-28 (docs/decisions.md):

1. **University names in refusals.** The refusal carries the university's id and web shows the name; community keeps no copy of names.
2. **Walk-ins by email.** ResolveEmails stays in identity.
3. **The call deadline under a seat rush.** Web calls RegisterEvent and CancelRegistration with a 10 s deadline and no automatic retry; W15 measures the wait on Azure.

## Left for later workstreams

- W8 credentials: make Record entries from `event.closed` (attended, completed, results with place and entrants, volunteer minutes, walk-ins by email hash) and `society.term_changed {status confirmed}`; read a result's label, a term's title and walk-ins' addresses back from community (a batch read to add when W8 is built); publish `record.sealed` with the evidence ranking reads.
- W9 notify and media: notices from `society.*`, `induction*`, `event.*`, `payment.*` and `payment_method.changed`; reminders from `event.reminder_due`; email bodies read back from community (event messages); media records society proofs, society media and receipts (community's `Files` port, today the path rule), keeps receipts private, and deletes files on `community_file.released`.
- W10 trust: open a report case on `payment.disputed` and read the registration's snapshot from community; the societies queue in the /ops inbox (OpsSocieties); `config.changed` for `societies.limits` and `events.ticket_limits`; analytics from community's events.
- W11 market: university events and fairs; Openings from `event.updated` and `induction.changed`.
- W13 web: every page; fill refusal values (the host university's name, the opening time); RegisterEvent and CancelRegistration with a 10 s deadline and no automatic retry; manage lists for events over 500 registrants (ProfileCards takes 500); the CSV's formula escaping; the receipt check (sharp, hash, dHash) before SubmitReceipt.
- W14 cutover: import community's tables; seal each event's secret under `community-ticket-key`; fill the members and friendships copies from people.
- Deploy: Key Vault secret `community-ticket-key` loaded 2026-11-28.

## Results (2026-11-27, local)

- `pnpm typecheck`, `pnpm lint` (incl. the migration check and the no-foreign-schema rule), run one package at a time (memory): pass.
- `pnpm test` (every package, one at a time): pass. community unit 9, refusal 37; lint 38 (events, journey hand-off); identity 78; people 39; realtime 3 (event topics now community's); work 68; ranking 38; web 563; the rest as before. Under load, three timing tests missed and were rerun: web's eslint-rules test (its 20 s limit; passed in the full run before), messaging's realtime budget (passed alone), content's feed budget (RecordViews p95 42 to 53 ms against 40 ms, twice, with the load average at 7 to 8 from other containers on the machine; W7 doesn't touch RecordViews): recorded as environment load, not rerun a third time.
- `pnpm test:contract`: pass. community 26 (contract 14, journeys 12, both transports) + 8 `it.todo`; work 34 + 22 todo; ranking 24 + 6 todo; content 32 + 20 todo; messaging 24 + 8 todo; people 52 + 14 todo; identity 138 + 36 todo; sample 22; relay 6.
- Goldens: community 19 (recorded and compared with the stack nine times), ranking 12, work 16, messaging 18, content 24, people 26, identity 43, all match.
- Done-when: the seat-lock journey (6 of 6, both transports) and the societies, events and paid-ticket journeys pass.
- Found and fixed on the way: the host's in-memory transport was built when a service first asked for a client, so realtime (created before community) could not reach community; it is now built on first use (`packages/host/src/host.ts`).
