# Student-first track: session prompts

One prompt per phase, to paste into a fresh Claude Code session (decisions 2026-11-02: each phase is built in one go, one session and one PR). Run them in order, and start a phase only after the previous phase's PR is merged to `main`.

**Before phase 14:** merge the docs branch `claude/gracious-goldberg-lm63bk` (this plan) into `main`, so every session reads the same spec.

---

## Phase 14: New look

```text
Build phase 14 (New look) of the Student-first track in one go: one session, one PR, no slices.

Read first: CLAUDE.md, docs/student-first-plan.md (Portals, How the app looks), docs/build-plan.md "Phase 14", docs/decisions.md "Student-first scope" and "Student-first answers", docs/screen-spec.md sections 1-2, PRD 09-design-system-and-ux.md. Then read the marketing branch claude/wonderful-feynman-rmrfgy: app/(marketing)/CLAUDE.md (the UI brief), app/(marketing)/marketing.css (the .neu tokens), components/marketing/neu.tsx, app/(marketing)/fonts.ts, scripts/renders/.

Build:
1. Portals off. A platform_config key portals.enabled = {recruiter:false, university:false, faculty:true}, with its config_keys row, returned by my_gate_state(). lib/auth/gate.ts 404s /recruit, /org, /uni, /companies and /fairs while a portal is off; validate_signup refuses recruiter and official signups; student surfaces hide jobs, contact requests, applications, job fairs, recruiter visibility and company CV viewers. Code stays.
2. Delete every recruiter and university_admin account in a migration through private.delete_account. Delete their organisations and university seats. Faculty with a seat keep their account. Put the exact counts the migration will delete on production in the PR description (read-only query) before merge.
3. Marketing. /recruiters and /universities keep their URLs with "Talk to us" CTAs (submit_sales_lead). /pricing redirects (308) to a new /features page with no prices. Organisation signup and claim routes redirect to #talk. Update BUILT_PAGES, the sitemap and the nav.
4. Design system in the app. Merge claude/wonderful-feynman-rmrfgy into this branch. Promote the .neu tokens to app/styles/tokens.css with the PRD 9 names re-pointed, and share the component classes in app/styles/neu.css. Use app density (radii 24/20/14, smaller shadows on phones). Space Grotesk replaces Barlow app-wide; the CV keeps Barlow. Rebuild components/ui primitives to the brief and add DomainCard, VentureCard (team tray), StatTile, Ladder, CommandMenu, Ticket, RecordEntry and Stepper. Update the /ui gallery. /ops keeps PRD 9 through a .classic scope. Add tests/unit/tokens-contrast.test.ts.
5. Shell and core screens. A two-tier sidebar, a header with ⌘K, and a phone dock (Home, Openings, Ventures, Chat, Me), with Opportunities renamed Openings in the nav (the page itself comes in phase 18). Redo the post card (Not for me, Mute and Report into a ⋯ menu; a Share button stubbed off until phase 18), Me, Score with tier medallions and the ladder, Ventures with the team tray, chat, notifications, onboarding, and empty states with the renders.

Update CLAUDE.md: the stack line (Space Grotesk) and a phase 14 code map. Log deviations in docs/decisions.md.
Before finishing: typecheck, lint, unit tests, pgTAP, and E2E for the gate, signup refusal, marketing routes and axe on every screen in light and dark. Every new route goes in tests/e2e/sweep-routes.ts. Lighthouse mobile at least 90 on /feed. Tick the phase 14 boxes, push, open the PR, and stop. Report in at most 15 lines.
```

## Phase 15: Societies and events

```text
Build phase 15 (Societies and events) of the Student-first track in one go: one session, one PR, no slices.

Read first: CLAUDE.md, docs/student-first-plan.md, docs/build-plan.md "Phase 15", PRD 05-31-societies-and-events.md (the whole file, including paid tickets), screen-spec 3.14 (society and event rows), PRD 05-23 (existing events and check-in), 05-12 (reports), and decisions.md "Student-first" entries. Use the Postgres best-practices skill for every migration.

Build everything in PRD 5.31:
1. Societies: request stepper with proof upload (private bucket society-documents, the submit_org_document pattern), the /ops/societies queue (the decide_org pattern, audited before and after), society page and directory, officers with terms and handover, membership modes, induction rounds (the venture_roles, venture_questions and application_threads pattern), posts as the society with a Societies feed chip, and term-end confirmations (store them; Record issuing comes in phase 16).
2. Events, extending events, event_registrations and private.event_secrets with society_id: the create stepper, sessions, ticket types, eligibility, form builder, teams, approval modes, waitlist with automatic promotion under row locks (with a concurrency test like tests/worker/fair-queue.test.ts), signed offline tickets, reminders and change notices, and the event-tick job. Event posts become officer-only; past student event posts stay readable.
3. Check-in: scanner (BarcodeDetector plus a fallback), search, add by university email (record the email for phase 16 claims), per-session check-in, a Realtime headcount, close-out (attendance fixes, results, volunteer hours, issue preview stored for phase 16), CSV export, feedback.
4. Paid tickets paid directly to the society: payment details with second-officer confirmation, reference codes, 24-hour holds, receipt upload (sharp re-encode or %PDF- check), officer review, duplicate flags, refund marking, and disputes into reports after 72 hours. Receipts go in the private bucket event-receipts, deleted 90 days after the event, and on the never-recorded analytics list.

Follow the checklist in docs/student-first-plan.md for every table: RLS default deny, pgTAP refusal tests, refuse_if_restricted, report targets, storage-cleanup, analytics, config_keys, OPS_AREAS, sweep routes, notification types plus describe.ts.
Before finishing: typecheck, lint, unit tests, pgTAP, worker tests, and E2E for every "done when" in the phase. Axe in both themes. Tick the boxes, update the CLAUDE.md code map, push, open the PR, and stop. Report in at most 15 lines, including what Ahmed must do by hand (the agreement text for paid tickets is on docs/setup-checklist.md).
```

## Phase 16: The Record

```text
Build phase 16 (The Record) of the Student-first track in one go: one session, one PR, no slices.

Read first: CLAUDE.md (phase 5 code map: cv-sign, verify, PDFs), docs/student-first-plan.md, docs/build-plan.md "Phase 16", PRD 05-30-the-record.md (the whole file, including formula v2), 05-13 (ranking), 05-18 (verified CV), screen-spec 3.14 (Record rows), docs/ranking-reference.md, and decisions.md "Student-first" entries plus "Recruiter-readable verified CV (2026-10-19)". Use the Postgres best-practices skill.

Build everything in PRD 5.30:
1. record_entries and RecordEntryV1, signed by cv-sign with the existing Vault key and canonical JSON, batched through a pgmq record_jobs queue. /verify/[code] for entries (valid, revoked, superseded).
2. Issuing from phase 15's close-out, term confirmations and venture completions. Auto-issue Attended and Completed at 72 hours. No officer issues to themselves alone. Revocation with a reason, corrections that supersede, and appeals through the existing flow.
3. /me/record (stat tiles, ledger by academic year, filters, pin and hide), certificate and transcript PDFs on lib/cv/pdf.ts, share links (the cv_share_links pattern), and the CV "Leadership and activities" section (the student picks the entries; the evidence stays on the verify page).
4. Claim by email: one notify-worker email per person per event, held 180 days, moved into the Record at signup only for the same verified email, and "N entries waiting" at the end of onboarding.
5. Ranking formula v2: score_record (at most 100 points; office-bearer terms, results with at least 5 entrants, volunteer hours; at most 50 points per society; attendance never counts; 30-day hold for new societies). Add Record reference students to docs/ranking-reference.md and keep pgTAP 32 green. Show the in-app announcement.
6. The landing story features The Record (components/marketing/story/*, content/marketing.ts). Claim only what is now live.

Follow the checklist in docs/student-first-plan.md for every table.
Before finishing: typecheck, lint, unit tests, pgTAP, worker tests (cv-sign), the ATS and PDF checks, and E2E for every "done when". Axe in both themes. Tick the boxes, update the CLAUDE.md code map, push, open the PR, and stop. Report in at most 15 lines.
```

## Phase 17: Growth (paths, proof tasks, skill swap)

```text
Build phase 17 (Growth) of the Student-first track in one go: one session, one PR, no slices.

Read first: CLAUDE.md (phase 2 and phase 4 code maps: GitHub worker, my_skill_proofs, contributions, anti-gaming), docs/student-first-plan.md, docs/build-plan.md "Phase 17", PRD 05-32-paths-and-proof-tasks.md, 05-05 (GitHub skills), 05-13 (anti-gaming), screen-spec 3.14 (Paths, task, swap rows), and decisions.md "Student-first" entries. No AI anywhere. Use the Postgres best-practices skill.

Build everything in PRD 5.32:
1. Paths: 8 roles from lib/github/taxonomy/skills.yaml; private.compute_paths() weekly (median first-L2 order among students at Shine or higher holding at least 60% of the role's skills; at least 10 students, else the platform_config paths.seed starter path; private.suppress_groups); /me/paths with the Ladder, the skill drawer, and the progress card's next step.
2. Proof tasks: a staff bank edited in /ops/config (like code_check_prompts); start, link a repository, and submit. Verification in order: GitHub rescan through the worker stages, then peer review (L2 or higher, any university, never friends, 5 a week, re-offer after 7 days), then a code check where prompts exist. A done task adds evidence (my_skill_proofs kind proof_task) and a Skilient Proof task Record entry.
3. Skill swap: offers (L2 or higher) and wants, matches at the same university, requests with a 7-day expiry, mutual swaps, the DM unlock (extend the send_message rule), sessions with reminders, learner confirmation, thank-you notes the teacher approves, a Taught Record entry on close, and limits and ring flags in anti_gaming_flags.

Follow the checklist in docs/student-first-plan.md for every table.
Before finishing: typecheck, lint, unit tests, pgTAP, worker tests with the fake GitHub, and E2E for every "done when". Axe in both themes. Tick the boxes, update the CLAUDE.md code map, push, open the PR, and stop. Report in at most 15 lines.
```

## Phase 18: Community (Openings, yearbook, sharing, push)

```text
Build phase 18 (Community) of the Student-first track in one go: one session, one PR, no slices.

Read first: CLAUDE.md, docs/student-first-plan.md, docs/build-plan.md "Phase 18", PRD 05-34-openings-sharing-and-reach.md, 05-33-yearbook.md, 05-09 (chat), 05-25 (graduation rule), screen-spec 3.14 (Openings, yearbook, share, people rows), and decisions.md "Student-first" entries. Use the Postgres best-practices skill.

Build everything in PRD 5.33 and 5.34:
1. Openings: /openings as one page of DomainCards, each showing its latest opening (openings_overview() in one SQL call); /openings/[category] with filters; This week (nightly); /opportunities/* redirects (308) to /openings/*; the nav badge renamed. Jobs, contact requests, applications and fairs cards appear only when portals.enabled turns them on.
2. Yearbook: crons yearbook-open, reveal and freeze from platform_config yearbook.calendar and yearbook.titles; pages; notes with owner approval; secret superlative votes within the department (at least 5 votes, winners told 48 hours earlier and allowed to decline, opt-out); read-only after the freeze; page PDF.
3. Share-to-chat into DMs and venture chats (chat_messages.shared_post_id, rendered through can_view_post, never counted), people you may know with reasons and dismissals, a PWA manifest and service worker (shell plus cached ticket), and web push through notify-worker with VAPID keys in Vault (add to scripts/restore/reseed-vault.sql), offered after the first meaningful action, with per-category prefs.

Follow the checklist in docs/student-first-plan.md for every table. Update the CSP for push.
Before finishing: typecheck, lint, unit tests, pgTAP, worker tests (notify-worker push with a fake), and E2E for every "done when". Axe in both themes. Tick the boxes, update the CLAUDE.md code map, push, open the PR, and stop. Report in at most 15 lines, including the VAPID setup step for Ahmed.
```

## Phase 13 (rest): Hardening on the new design

```text
Finish phase 13 (Hardening) now that the Student-first track (phases 14-18) is merged. One session, one PR.

Read first: CLAUDE.md, docs/hardening-plan.md (load test and design-gate slices), docs/build-plan.md "Phase 13", docs/screen-spec.md (both design gates; sections 3.1-3.14), PRD 10 (performance targets), and docs/decisions.md "Student-first" entries.

Do:
1. The k6 load test at 300 concurrent users for 30 minutes against the student journeys, now including the feed, Openings, event registration and check-in, and /me/record. Meet every PRD 10 target, and fix what fails.
2. Both design gates on every screen in docs/screen-spec.md, on the new neumorphism design, light and dark, phone and desktop. Fix what fails.
3. Recheck the launch-gate technical items in PRD 4 against the student-first scope (portals off), and note in docs/decisions.md any that no longer apply.

Before finishing: typecheck, lint, unit tests, pgTAP and the full E2E suite. Tick the phase 13 boxes, push, open the PR, and stop. Report in at most 15 lines.
```
