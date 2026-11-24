# UX pilot run: summary (local, 2026-11-24)
Tasks: 115 run as students and officers on the local stack. **87 done, 24 partly done, 3 blocked, 1 not run.** Findings: 135 (14 severity 3, 78 severity 2, 43 severity 1; R01–R109 from tasks, H01–H37 from probes and screens; `same_as` links repeats). Production recheck: 24 of 36 confirmed, 8 not reproduced, 4 can't check. Detail: `results.json`, `heuristics/heuristics.json`, `heuristics/scorecard.csv`.

## The 29 principles (1 pass, 15 partial, 13 fail)
| Code | Verdict | Worst | Measure |
|---|---|---|---|
| H01 | fail | 3 | pending within 100 ms 71%, result within 1 s 86% of 592 actions; 4 background jobs show no expe |
| H02 | partial | 0 | 16 of 26 product terms explained where they appear; L1/L4, corroborated, sealed, Taught unexpla |
| H03 | fail | 3 | 19 of 31 destructive controls have a confirm, undo or way back |
| H04 | fail | 3 | 6 concepts with two terms; 4 cross-page contradictions |
| H05 | fail | 3 | no duplicate on double-click (composer); no leave warning on 3 forms; limits shown after submit |
| H06 | partial | 3 | 0 icon-only controls unnamed; 15 other controls unnamed; next steps without links (score requir |
| H07 | fail | 3 | 45% of student page titles in Ctrl K top 3 (26/58); state in URL for feed filters, Explore and  |
| H08 | partial | 2 | 10 of 112 phone screens with 2+ primaries; first post / score below the fold on Home and Score |
| H09 | partial | 3 | field errors name cause and fix with aria-invalid + describedby on sign-up, feedback, contribut |
| H10 | partial | 2 | Feedback one tap on desktop (rail); not reachable from the phone dock or account menu |
| ACC | partial | 3 | 0 axe WCAG 2.2 AA violations on 336 page views; no sideways scroll at 390; 6 pages fail 320 px  |
| MOB | fail | 3 | LCP max 2792 ms (feed, cold); CLS ≤ 0.071; typing before hydration (~6.6 s) is wiped |
| LRN | partial | 3 | 5 of 104 tasks over 1.5x the shortest path (T002, T035, T041, T045, T078) |
| NAV | fail | 3 | desktop: all crawled pages within 3 clicks; phone: Explore, Events, Societies, Tickets unreacha |
| TRU | fail | 3 | 4 contradictions in 14 cross-page checks |
| PRV | partial | 2 | 45 viewer x setting cells all match the setting; one wrong 'why hidden' line; privacy controls  |
| AFF | partial | 2 | no pointer cursors on non-focusable elements; 2 visual affordance mix-ups (skill tag as button, |
| COP | fail | 3 | 0 real typos in 2140 strings; 10 off-flag recruiter mentions; 26 long sentences outside legal p |
| EMP | partial | 3 | 25 of 26 empty states have title, explanation and action; 7 actions lead to another empty page |
| MOT | partial | 2 | no pressure or shame wording; tier printed on the CV twice for every student (P23) |
| SAF | pass | 2 | Report/Block one tap on comment, message, profile, venture, society, event; 2 on posts; block h |
| HCK | partial | 1 | rail 13 items (desktop, grouped by level), phone dock 5; 5 native selects of 22–284 options wit |
| FIT | fail | 3 | 49 page views with targets under 24 px; Unfriend 8 px from Message |
| JAK | fail | 2 | slips seen: offline chat message looks sent; no @-mention suggestions; Enter-in-place date link |
| DOH | fail | 3 | 56% respond or show progress within 400 ms (bar 95%) |
| PKE | fail | 1 | confirmed: post ('Posted.'), registration (ticket page), venture complete (Shipped), welcome; m |
| TES | partial | 0 | no data asked twice in sign-up/onboarding; reset password doesn't carry the email from sign-in; |
| MIL | partial | 1 | most steps ≤ 7 fields or grouped; teacher idea form 11 ungrouped; event stepper 7 steps |
| AES | partial | 2 | consistent neumorphic system in both themes; issues: multiple primary styles, blue selection, c |
## The 10 worst findings
1. **R01** Phone forms look ready at 1.7 s but hydrate at ~6.6 s; typing before that is wiped (sign-up and every server-rendered form).
2. **R102** The 8-character code printed under a ticket's QR is refused at check-in; the fallback doesn't work.
3. **R107** Cancelling an event with paid registrations is one tap, no consequences shown; payers aren't told about refunds.
4. **R41 / H22** Photo post on 3G took 21.7 s with no pending state; only 56% of actions respond within 400 ms.
5. **H13** Posting offline replaces the page with a server error and loses the draft.
6. **R68** Until the tour ends, every page (including shared links) is hijacked back into the tour.
7. **R53** Explore People filters return nothing until a name is typed.
8. **R08 / R09** Onboarding promises self-added skills and open ventures that the step can't deliver.
9. **H01 / H02** Ctrl K finds 45% of pages; on phone Explore, Events, Societies and Tickets aren't reachable from visible links.
10. **H10 / H18** 12 destructive actions with no confirm or undo; 4 cross-page contradictions (tiers, share links, unread count, GitHub sync).
## Plan changes
31 fixes in `results.json` `plan_fixes`, applied to `ux-pilot-tasks.json` (log in `plan-changes.json`). The main ones: reword tasks the product doesn't match (T018 hide checklist, T020 10-minute lock, T063 sign-out-except-this, T107 handover order, T117 hours cap); add setup (aged posts, named strangers, Pro trial for CV tasks, typed academic-year dates); move T003, T011, T013, T045, T046, T071, T097, T115 to staging or a real phone; drop T116 (no society self check-in).
## What I couldn't do
Edge Functions don't boot in the container, so the notify, GitHub, push and Record workers didn't run (cv-sign ran from Node; waits simulated in SQL). Not testable here: Google OAuth (T003), the GitHub App (T011, T071), push and PWA install (T045, T046), a real camera (T115); society self check-in (T116) doesn't exist. LRN, JAK, PKE, TES, AES and H10 rest on one tester's walkthrough and 173 screenshots, not real students.
