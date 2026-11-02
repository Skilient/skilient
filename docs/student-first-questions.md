# Student-first track: questions for Ahmed

One list for the whole track (CLAUDE.md). Each has a recommended default; phases build on the defaults until Ahmed answers, and answered items move to `docs/decisions.md`. The plan is `docs/student-first-plan.md`; the features are PRD 5.30–5.34.

## Open

### The Record (phase 16)

1. **Record and rank.** Should Record entries change rank? Recommended: not in formula v1 (5.13 is frozen and tested against `docs/ranking-reference.md`); consider a co-curricular input in formula v2 once real entries exist. *Default: no effect on rank.*
2. **Claim by email.** A society can add an attendee by university email; anyone not on Skilient gets a claim email. *Default: one email per person per event, entries held 180 days, then expired.*
3. **Auto-issue.** *Default: Attended and Completed entries issue on their own 72 hours after an event if the host hasn't issued them; Results and Volunteer entries always need the host.*
4. **The Record on the CV.** *Default: a "Leadership and activities" section built from entries the student picks; evidence stays on the verify page (decisions 2026-10-19).*

### Societies and events (phase 15)

5. **Paid tickets.** Paid tickets need payouts to societies (a billing and legal change). *Default: free tickets only.*
6. **Society verification.** *Default: staff verify from a recognition letter, a notification or an official link; a society is invisible to everyone but the requester until verified.*

### Paths, tasks and swaps (phase 17)

7. **Paths.** *Default: 8 roles at launch (Frontend, Backend, Mobile, Data, Machine learning, DevOps, UI/UX, Product); a path uses real data once 10 seniors qualify; "reached" means Shine or higher.*
8. **Peer review of proof tasks.** *Default: reviewers are L2 or higher in the skill, at any university, never friends with the student, at most 5 reviews a week.*

### Yearbook (phase 18)

9. **Yearbook calendar.** *Default: opens 1 February, superlative vote 1–21 June, reveal a week later, freezes 1 September; superlatives within the department; 5 votes minimum; titles in `platform_config` `yearbook.titles` (positive only).*

### Scope, look and platform

10. **Faculty.** Every new faculty tool proposed on 2026-11-02 was declined. *Default: faculty keeps today's portal with the redesign only.* What direction do you want for faculty?
11. **Web push and installable app.** *Default: yes, superseding 5.25's "no push"; VAPID keys go on the setup checklist.*
12. **Branch.** *Default: phase 14 slice 2 merges `claude/wonderful-feynman-rmrfgy` into the working branch (or rebases on `main` once its PR merges), so the app and marketing share one design system.*
13. **Student Pro.** *Default: stays on sale inside the app (`/settings/billing`, upgrade sheet); public pages show no prices.*
14. **Fonts.** *Default: Space Grotesk replaces Barlow across the app; the CV document keeps Barlow; CLAUDE.md's stack line is updated in phase 14.*
15. **Ops look.** *Default: `/ops` keeps PRD 9 through a `.classic` scope.*
16. **Existing recruiter or university accounts.** *Default: if any exist in production, they see a "paused" page with Talk to us.*
