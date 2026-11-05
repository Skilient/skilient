# Design gates

Screen spec §1: every screen passes **Gate A** (impeccable critique plus the taste pre-flight) and **Gate B** (impeccable
audit and polish plus the craft floor: contrast, states, themed browser surfaces, copy), at **390 px and 1280 px** in
**light and dark**. Phase 13, on the neumorphism design (phase 14). Decisions: "Phase 13 finish" (2026-11-04).

## How each gate was run

**Gate B, automated, every screen** (`tests/e2e/design-gates.spec.ts`, part of the E2E suite, so it re-runs on every
PR). Every page in `tests/e2e/sweep-routes.ts` (the list the CSP sweep uses; a unit test keeps it complete) is
opened as the role that uses it, at 390×844 on the phone project and 1280×800 on the desktop project, in both themes.
Each fails on:

- axe WCAG 2.2 AA (colour contrast, target size, names, landmarks, focusable scroll regions)
- any sideways scrolling
- browser surfaces not themed: `color-scheme` must match the theme; scrollbars and the caret must be themed
- no visible focus ring on the first Tab stop
- a button whose label is clipped
- an em dash or an emoji in the copy (`/terms`, `/privacy` and `/ui` are exempt: their text is the agreement and the gallery)

States: placeholder ids render each page's not-found state inside its real layout, fresh fixtures render the empty
states, and the feature specs (40 of them run axe in both themes) cover loaded, error and sheet states such as
Register, Share, Upgrade and the skill drawer.

**Gate A and the by-eye half of Gate B.** The impeccable detector (`impeccable detect app components`) ran over the whole
app. Its 4 side-tab findings were checked: the check-in result was a real one and is fixed. The blockquote rules in
moderation and appeal cases and the chat reply preview are the conventional quote marker, so they stay. Its 53
type-ramp and colour notes measure against the Editorial `DESIGN.md`, which phase 14's neumorphism system replaced
(decisions 2026-11-02), so they don't apply; `DESIGN.md` and `PRODUCT.md` still describe Editorial and are flagged
below. Every screen outside the portals was captured in all four combinations (`DESIGN_GATES_SHOTS=1`) and reviewed on
contact sheets: desktop light for every screen, plus phone light and dark for the student-first screens with seeded
load data (feed, Openings, My Record, Paths, Skill swap, Yearbook, Societies, Events, Tickets, Notifications, Chat,
Settings, event page). Against the taste pre-flight: one accent (signal orange), Phosphor at one weight, Space
Grotesk with Spectral reserved for belief moments, no emoji, no eyebrows, no equal three-card rows, empty states
with one sentence and one action.

## Fixed in this pass

- **Bottom tabs (every phone screen):** the badge sat before the label, so the link's name ("Openings, 4 waiting")
  didn't contain its visible text ("4Openings"); axe label-content-name-mismatch on 153 screen and theme pairs. The
  badge now comes after the label and carries its own screen-reader words: "Openings 4 waiting".
- **Icon rail:** at 800 px tall the 13th item (with its badge) was cut off at the bottom edge with no hint that the
  rail scrolls. On screens up to 880 px tall the buttons are 40 px and the gaps tighter, so all of them fit.
- **Button primitive:** a nowrap label in a flex row beside a full-width input was squeezed and clipped
  ("Create list" on `/recruit/shortlists`, found by the new clipped-button check); buttons no longer shrink.
- The per-screen fixes are in the Notes column below.

## Open, not fixed here

- `DESIGN.md` and `PRODUCT.md` still describe the Editorial system (vermillion, Barlow, Spectral headings), so the
  impeccable detector reports false drift. Rewriting them is impeccable `document`; left for Ahmed to ask for
  (impeccable never repairs drift as a side effect).
- Data tables in `/ops` and the university pages show a plain sentence when empty, not an illustrated empty state.
  They are Operate-high-density staff tools, where a line of text is the convention; the student and faculty screens
  all use `EmptyState`.

## Every screen

`Pass` = every automated check, both themes, at that width. `Pass*` = recruiter and university-official screens,
gated with the portals flag on (the `@portals` pass); with portals off they 404 and aren't part of launch
(decisions.md launch-gate recheck).

| Screen | Role | 390 light | 390 dark | 1280 light | 1280 dark | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | Visitor | Pass | Pass | Pass | Pass |  |
| `/about` | Visitor | Pass | Pass | Pass | Pass |  |
| `/faculty` | Visitor | Pass | Pass | Pass | Pass |  |
| `/features` | Visitor | Pass | Pass | Pass | Pass |  |
| `/privacy` | Visitor | Pass | Pass | Pass | Pass |  |
| `/recruiters` | Visitor | Pass | Pass | Pass | Pass |  |
| `/terms` | Visitor | Pass | Pass | Pass | Pass |  |
| `/universities` | Visitor | Pass | Pass | Pass | Pass |  |
| `/verify` | Visitor | Pass | Pass | Pass | Pass |  |
| `/verify/[code]` | Visitor | Pass | Pass | Pass | Pass |  |
| `/request-university` | Visitor | Pass | Pass | Pass | Pass |  |
| `/request-university/confirm` | Visitor | Pass | Pass | Pass | Pass |  |
| `/request-university/unsubscribe` | Visitor | Pass | Pass | Pass | Pass |  |
| `/signin` | Visitor | Pass | Pass | Pass | Pass |  |
| `/signin/code` | Visitor | Pass | Pass | Pass | Pass |  |
| `/signin/mfa` | Visitor | Pass | Pass | Pass | Pass |  |
| `/signup` | Visitor | Pass | Pass | Pass | Pass |  |
| `/signup/recruiter` | Visitor | Pass | Pass | Pass | Pass |  |
| `/signup/verify` | Visitor | Pass | Pass | Pass | Pass |  |
| `/forgot-password` | Visitor | Pass | Pass | Pass | Pass |  |
| `/reset-password` | Visitor | Pass | Pass | Pass | Pass |  |
| `/auth/confirmed` | Visitor | Pass | Pass | Pass | Pass |  |
| `/auth/link` | Visitor | Pass | Pass | Pass | Pass |  |
| `/auth/not-me` | Visitor | Pass | Pass | Pass | Pass | Gate B: the long danger button label was clipped by nowrap; it wraps now. The sweep gained a clipped-button check for every screen. |
| `/ui` | Visitor | Pass | Pass | Pass | Pass |  |
| `/cv/[username]` | Visitor | Pass | Pass | Pass | Pass |  |
| `/record/[username]` | Visitor | Pass | Pass | Pass | Pass |  |
| `/verify/transcript/[id]` | Visitor | Pass | Pass | Pass | Pass |  |
| `/feed` | Student | Pass | Pass | Pass | Pass | Gate A: "Your progress" was an uppercase eyebrow over the real heading; now the heading itself, and the checklist's text "›" is a Phosphor caret. |
| `/explore` | Student | Pass | Pass | Pass | Pass |  |
| `/friends` | Student | Pass | Pass | Pass | Pass |  |
| `/chat` | Student | Pass | Pass | Pass | Pass |  |
| `/chat/[threadId]` | Student | Pass | Pass | Pass | Pass |  |
| `/notifications` | Student | Pass | Pass | Pass | Pass |  |
| `/leaderboard` | Student | Pass | Pass | Pass | Pass |  |
| `/me` | Student | Pass | Pass | Pass | Pass | Gate A: rail fits 800 px-tall laptops (see shell). |
| `/me/credentials` | Student | Pass | Pass | Pass | Pass |  |
| `/me/cv` | Student | Pass | Pass | Pass | Pass |  |
| `/me/score` | Student | Pass | Pass | Pass | Pass |  |
| `/me/skills` | Student | Pass | Pass | Pass | Pass |  |
| `/me/work` | Student | Pass | Pass | Pass | Pass |  |
| `/me/code-checks/[id]` | Student | Pass | Pass | Pass | Pass |  |
| `/openings` | Student | Pass | Pass | Pass | Pass |  |
| `/openings/applications/[id]` | Student | Pass | Pass | Pass | Pass |  |
| `/openings/contact-requests/[id]` | Student | Pass | Pass | Pass | Pass |  |
| `/openings/jobs/[id]` | Student | Pass | Pass | Pass | Pass |  |
| `/ventures` | Student | Pass | Pass | Pass | Pass |  |
| `/ventures/new` | Student | Pass | Pass | Pass | Pass |  |
| `/requests` | Student | Pass | Pass | Pass | Pass |  |
| `/feedback` | Student | Pass | Pass | Pass | Pass |  |
| `/appeals` | Student | Pass | Pass | Pass | Pass |  |
| `/events` | Student | Pass | Pass | Pass | Pass |  |
| `/events/[id]` | Student | Pass | Pass | Pass | Pass |  |
| `/events/[id]/attend` | Student | Pass | Pass | Pass | Pass |  |
| `/events/[id]/check-in` | Student | Pass | Pass | Pass | Pass | Gate A (impeccable detector): the scan result used a thick left stripe (side-tab); now a full state frame in the result colour, still icon plus text. |
| `/fairs/invite` | Student | Pass | Pass | Pass | Pass |  |
| `/fairs/[id]` | Student | Pass | Pass | Pass | Pass |  |
| `/competitions/[id]` | Student | Pass | Pass | Pass | Pass |  |
| `/ideas/[id]` | Student | Pass | Pass | Pass | Pass |  |
| `/moderation/[id]` | Student | Pass | Pass | Pass | Pass |  |
| `/billing/checkout/[session]` | Student | Pass | Pass | Pass | Pass |  |
| `/billing/return/[session]` | Student | Pass | Pass | Pass | Pass |  |
| `/settings` | Student | Pass | Pass | Pass | Pass |  |
| `/settings/account/delete` | Student | Pass | Pass | Pass | Pass |  |
| `/settings/billing` | Student | Pass | Pass | Pass | Pass |  |
| `/settings/chat` | Student | Pass | Pass | Pass | Pass |  |
| `/settings/github` | Student | Pass | Pass | Pass | Pass |  |
| `/settings/notifications` | Student | Pass | Pass | Pass | Pass |  |
| `/settings/privacy` | Student | Pass | Pass | Pass | Pass |  |
| `/settings/profile` | Student | Pass | Pass | Pass | Pass |  |
| `/settings/security` | Student | Pass | Pass | Pass | Pass |  |
| `/agreement` | Student | Pass | Pass | Pass | Pass |  |
| `/onboarding` | Student | Pass | Pass | Pass | Pass |  |
| `/onboarding/[step]` | Student | Pass | Pass | Pass | Pass |  |
| `/onboarding/done` | Student | Pass | Pass | Pass | Pass |  |
| `/societies` | Student | Pass | Pass | Pass | Pass |  |
| `/societies/new` | Student | Pass | Pass | Pass | Pass |  |
| `/societies/[slug]` | Student | Pass | Pass | Pass | Pass | Gate A: an empty pressed well stood in for a missing cover and read as a blank field; removed (no cover, no placeholder). |
| `/societies/[slug]/manage` | Student | Pass | Pass | Pass | Pass |  |
| `/societies/[slug]/manage/payments` | Student | Pass | Pass | Pass | Pass |  |
| `/societies/[slug]/inductions/new` | Student | Pass | Pass | Pass | Pass |  |
| `/societies/[slug]/inductions/[id]` | Student | Pass | Pass | Pass | Pass |  |
| `/societies/[slug]/events/new` | Student | Pass | Pass | Pass | Pass |  |
| `/events/[id]/ticket` | Student | Pass | Pass | Pass | Pass |  |
| `/events/[id]/manage` | Student | Pass | Pass | Pass | Pass |  |
| `/me/tickets` | Student | Pass | Pass | Pass | Pass |  |
| `/me/record` | Student | Pass | Pass | Pass | Pass |  |
| `/me/paths` | Student | Pass | Pass | Pass | Pass |  |
| `/me/tasks/[id]` | Student | Pass | Pass | Pass | Pass |  |
| `/me/tasks/reviews/[id]` | Student | Pass | Pass | Pass | Pass |  |
| `/swaps` | Student | Pass | Pass | Pass | Pass |  |
| `/swaps/[id]` | Student | Pass | Pass | Pass | Pass |  |
| `/yearbook` | Student | Pass | Pass | Pass | Pass |  |
| `/yearbook/me` | Student | Pass | Pass | Pass | Pass |  |
| `/yearbook/vote` | Student | Pass | Pass | Pass | Pass |  |
| `/openings/venture-roles` | Student | Pass | Pass | Pass | Pass |  |
| `/openings/inductions` | Student | Pass | Pass | Pass | Pass |  |
| `/openings/events` | Student | Pass | Pass | Pass | Pass |  |
| `/openings/ideas` | Student | Pass | Pass | Pass | Pass |  |
| `/openings/paths` | Student | Pass | Pass | Pass | Pass | Gate A: Paths and Skill swaps highlighted "All openings" in the sidebar; both have their own row now. |
| `/openings/swaps` | Student | Pass | Pass | Pass | Pass | Gate A: the same sidebar row fix as Paths. |
| `/openings/this-week` | Student | Pass | Pass | Pass | Pass |  |
| `/yearbook/[username]` | Student | Pass | Pass | Pass | Pass |  |
| `/profile/[username]` | Student | Pass | Pass | Pass | Pass |  |
| `/profile/[username]/activity` | Student | Pass | Pass | Pass | Pass |  |
| `/profile/[username]/skills` | Student | Pass | Pass | Pass | Pass |  |
| `/profile/[username]/ventures` | Student | Pass | Pass | Pass | Pass |  |
| `/ventures/[id]` | Student | Pass | Pass | Pass | Pass |  |
| `/ventures/[id]/team` | Student | Pass | Pass | Pass | Pass |  |
| `/ventures/[id]/updates` | Student | Pass | Pass | Pass | Pass |  |
| `/ventures/[id]/contributions` | Student | Pass | Pass | Pass | Pass |  |
| `/ventures/[id]/deliverables` | Student | Pass | Pass | Pass | Pass |  |
| `/ventures/[id]/chat` | Student | Pass | Pass | Pass | Pass |  |
| `/ventures/[id]/reviews` | Student | Pass | Pass | Pass | Pass |  |
| `/ventures/[id]/manage` | Student | Pass | Pass | Pass | Pass |  |
| `/post/[id]` | Student | Pass | Pass | Pass | Pass |  |
| `/u/[slug]/[[...page]]` | Student | Pass | Pass | Pass | Pass | Gate B: the same DataTable fix. |
| `/teach` | Faculty | Pass | Pass | Pass | Pass | Gate A: "TEACHER PORTAL · …" uppercase eyebrow is now a plain sentence (whole teacher portal). |
| `/teach/apply` | Faculty | Pass | Pass | Pass | Pass |  |
| `/teach/code-checks` | Faculty | Pass | Pass | Pass | Pass |  |
| `/teach/code-checks/[id]` | Faculty | Pass | Pass | Pass | Pass |  |
| `/teach/ideas` | Faculty | Pass | Pass | Pass | Pass |  |
| `/teach/ideas/new` | Faculty | Pass | Pass | Pass | Pass |  |
| `/teach/ideas/[id]` | Faculty | Pass | Pass | Pass | Pass |  |
| `/teach/judging` | Faculty | Pass | Pass | Pass | Pass | Gate A: a bare "Nothing to judge." line; now an empty state with an icon and what to expect. |
| `/teach/judging/[id]` | Faculty | Pass | Pass | Pass | Pass |  |
| `/teach/reviews` | Faculty | Pass | Pass | Pass | Pass |  |
| `/teach/reviews/[requestId]` | Faculty | Pass | Pass | Pass | Pass |  |
| `/teach/settings` | Faculty | Pass | Pass | Pass | Pass |  |
| `/teach/ventures/[id]` | Faculty | Pass | Pass | Pass | Pass |  |
| `/recruit` | Recruiter (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/recruit/analytics` | Recruiter (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/recruit/candidates/[id]` | Recruiter (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/recruit/competitions` | Recruiter (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/recruit/competitions/new` | Recruiter (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/recruit/competitions/[id]` | Recruiter (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/recruit/contacts` | Recruiter (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/recruit/jobs` | Recruiter (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/recruit/jobs/new` | Recruiter (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/recruit/jobs/[id]` | Recruiter (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/recruit/jobs/[id]/applicants` | Recruiter (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/recruit/search` | Recruiter (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/recruit/shortlists` | Recruiter (portals on) | Pass* | Pass* | Pass* | Pass* | Gate B: "Create list" was clipped; fixed in the Button primitive. |
| `/recruit/shortlists/[id]` | Recruiter (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/org/billing` | Recruiter (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/org/join` | Recruiter (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/org/members` | Recruiter (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/org/plan` | Recruiter (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/org/settings` | Recruiter (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/org/settings/api` | Recruiter (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/companies/[slug]` | Recruiter (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/announcements` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/billing` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/claim` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/events` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/fairs` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/fairs/[id]` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/hackathons` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/join` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/moderation` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/people` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/people/awards` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/reports` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/settings` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/settings/admins` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/settings/branding` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/settings/calendar` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/settings/domains` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/settings/ecosphere` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/sponsorship` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/students` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/students/[id]` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/dashboard/adoption` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/dashboard/activity` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/dashboard/skills` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/dashboard/tiers` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/dashboard/outcomes` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/dashboard/faculty` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/uni/dashboard/benchmark` | University official (portals on) | Pass* | Pass* | Pass* | Pass* |  |
| `/ops` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/appeals` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/appeals/[id]` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/audit` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/billing` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/billing/[type]/[id]` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/config` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/config/plans` | Staff | Pass | Pass | Pass | Pass | Gate B: em dash as the empty value; now "Not set" (and every other /ops placeholder). |
| `/ops/config/skills` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/evidence` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/evidence/code-checks/[id]` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/evidence/credentials/[id]` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/evidence/flags/[id]` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/evidence/ranking/[id]` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/exam-periods` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/feedback` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/feedback/[id]` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/graduation` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/leads` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/metrics` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/orgs` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/orgs/competitions` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/orgs/spam` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/reports` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/reports/[id]` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/sanctions` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/societies` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/societies/[id]` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/staff` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/teachers` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/universities` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/universities/claims/[id]` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/users` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/record` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/config/tasks` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/config/[key]` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/users/[id]` | Staff | Pass | Pass | Pass | Pass | Gate B: em-dash placeholders replaced. |
| `/ops/users/[id]/view/[page]` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/orgs/[id]` | Staff | Pass | Pass | Pass | Pass |  |
| `/ops/universities/[id]` | Staff | Pass | Pass | Pass | Pass | Gate B: axe scrollable-region-focusable on the sideways-scrolling table (shared DataTable now focusable, named). |

