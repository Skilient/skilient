# Figma progress

One box per screen (route). A box is ticked when every tab of that screen has all four frames
(desktop light/dark, phone light/dark) built as editable layers bound to the "Skilient"
variables, plus its empty/error frames where `screens.json` lists those states.

- [x] Slice 1: foundations (variables Light/Dark, text styles, effects), brand, 120 icons and the component library (ids in `state.json`)
- [ ] Domain cards (post card, venture card, notification row, CV paper, ops sidebar): built in the slice whose screens first use them, from captured layout trees

## marketing (13 screens, slice 2)

- [x] `/about`
- [x] `/faculty`
- [x] `/`
- [x] `/pricing`
- [x] `/privacy`
- [x] `/recruiters`
- [x] `/request-university/confirm`
- [x] `/request-university`
- [x] `/request-university/unsubscribe`
- [x] `/terms`
- [x] `/universities`
- [ ] `/verify/[code]` (deferred: needs a signed CV on the local stack)
- [x] `/verify`

## auth (10 screens, slice 2)

- [x] `/forgot-password`
- [x] `/reset-password`
- [x] `/signin/code`
- [x] `/signin/mfa`
- [x] `/signin`
- [x] `/signup`
- [x] `/signup/recruiter`
- [x] `/signup/verify`
- [x] `/auth/confirmed`
- [x] `/auth/not-me`

## onboarding (4 screens, slice 2)

- [x] `/agreement`
- [x] `/onboarding/[step]` — tabs: university, profile, github, skills, looking-for, people
- [x] `/onboarding/done`
- [x] `/onboarding` (redirects to the current step; no frame of its own)

## public (1 screens, slice 2)

- [x] `/cv/[username]`

## student (57 screens, slice 3–4)

- [ ] `/appeals`
- [ ] `/billing/checkout/[session]`
- [ ] `/billing/return/[session]`
- [x] `/chat/[threadId]`
- [x] `/chat`
- [ ] `/competitions/[id]`
- [ ] `/events/[id]/attend`
- [ ] `/events/[id]/check-in`
- [ ] `/events/[id]`
- [ ] `/events` — tabs: upcoming, mine, past
- [x] `/explore` — tabs: people, projects, startups, ideas
- [ ] `/fairs/[id]`
- [ ] `/fairs/invite`
- [x] `/feed` — tabs: university, global
- [ ] `/feedback`
- [x] `/friends` — tabs: friends, received, sent, blocked
- [ ] `/ideas/[id]`
- [x] `/leaderboard`
- [ ] `/me/code-checks/[id]` (deferred to slice 4: needs a seeded code check)
- [x] `/me/credentials`
- [x] `/me/cv`
- [x] `/me`
- [x] `/me/score`
- [x] `/me/skills`
- [x] `/me/work` — tabs: ventures, contributions, reviews, endorsements, credentials
- [ ] `/moderation/[id]`
- [x] `/notifications`
- [ ] `/opportunities/[tab]` — tabs: for_you, jobs, contact_requests, applications, competitions, job_fairs, ideas
- [ ] `/opportunities/applications/[id]`
- [ ] `/opportunities/contact-requests/[id]`
- [ ] `/opportunities/jobs/[id]`
- [ ] `/opportunities`
- [x] `/post/[id]`
- [x] `/profile/[username]/activity`
- [x] `/profile/[username]`
- [x] `/profile/[username]/skills`
- [x] `/profile/[username]/ventures`
- [x] `/requests` — tabs: received, sent, invites
- [ ] `/settings/account/delete`
- [ ] `/settings/billing`
- [ ] `/settings/chat`
- [ ] `/settings/github`
- [ ] `/settings/notifications`
- [ ] `/settings`
- [ ] `/settings/privacy`
- [ ] `/settings/profile`
- [ ] `/settings/security`
- [x] `/ventures/[id]/chat` (redirects to `/chat/[threadId]`; same screen)
- [x] `/ventures/[id]/contributions`
- [x] `/ventures/[id]/deliverables`
- [x] `/ventures/[id]/manage`
- [x] `/ventures/[id]`
- [x] `/ventures/[id]/reviews`
- [x] `/ventures/[id]/team`
- [x] `/ventures/[id]/updates`
- [x] `/ventures/new`
- [x] `/ventures`

## teacher (13 screens, slice 5)

- [ ] `/teach/code-checks/[id]`
- [ ] `/teach/code-checks` — tabs: graded, open
- [ ] `/teach/ideas/[id]`
- [ ] `/teach/ideas/new`
- [ ] `/teach/ideas`
- [ ] `/teach/judging/[id]`
- [ ] `/teach/judging`
- [ ] `/teach`
- [ ] `/teach/reviews/[requestId]`
- [ ] `/teach/reviews` — tabs: done, open
- [ ] `/teach/settings`
- [ ] `/teach/ventures/[id]`
- [ ] `/teach/apply`

## recruiter (21 screens, slice 6)

- [ ] `/companies/[slug]`
- [ ] `/org/billing`
- [ ] `/org/members`
- [ ] `/org/plan`
- [ ] `/org/settings/api`
- [ ] `/org/settings`
- [ ] `/org/join`
- [ ] `/recruit/analytics`
- [ ] `/recruit/candidates/[id]`
- [ ] `/recruit/competitions/[id]`
- [ ] `/recruit/competitions/new`
- [ ] `/recruit/competitions`
- [ ] `/recruit/contacts`
- [ ] `/recruit/jobs/[id]/applicants`
- [ ] `/recruit/jobs/[id]`
- [ ] `/recruit/jobs/new`
- [ ] `/recruit/jobs`
- [ ] `/recruit`
- [ ] `/recruit/search`
- [ ] `/recruit/shortlists/[id]`
- [ ] `/recruit/shortlists`

## university (24 screens, slice 7)

- [ ] `/u/[slug]/[[...page]]`
- [ ] `/uni/announcements`
- [ ] `/uni/billing`
- [ ] `/uni/dashboard/[area]` — tabs: adoption, activity, skills, skills_gap, tiers, outcomes, faculty, benchmark
- [ ] `/uni/events`
- [ ] `/uni/fairs/[id]`
- [ ] `/uni/fairs`
- [ ] `/uni/hackathons`
- [ ] `/uni/moderation`
- [ ] `/uni`
- [ ] `/uni/people/awards`
- [ ] `/uni/people`
- [ ] `/uni/reports`
- [ ] `/uni/settings/admins`
- [ ] `/uni/settings/branding`
- [ ] `/uni/settings/calendar`
- [ ] `/uni/settings/domains`
- [ ] `/uni/settings/ecosphere`
- [ ] `/uni/settings`
- [ ] `/uni/sponsorship`
- [ ] `/uni/students/[id]`
- [ ] `/uni/students`
- [ ] `/uni/claim`
- [ ] `/uni/join`

## ops (36 screens, slice 8)

- [ ] `/ops/appeals/[id]`
- [ ] `/ops/appeals` — tabs: decided
- [ ] `/ops/audit`
- [ ] `/ops/billing/[type]/[id]`
- [ ] `/ops/billing` — tabs: accounts, revenue, gateways
- [ ] `/ops/config/[key]`
- [ ] `/ops/config`
- [ ] `/ops/config/plans`
- [ ] `/ops/config/skills`
- [ ] `/ops/evidence/code-checks/[id]`
- [ ] `/ops/evidence/credentials/[id]`
- [ ] `/ops/evidence/flags/[id]`
- [ ] `/ops/evidence` — tabs: credentials, reviewed, checks, graded, flags, ranking, ranking_reviewed, cvs
- [ ] `/ops/evidence/ranking/[id]`
- [ ] `/ops/exam-periods`
- [ ] `/ops/feedback/[id]`
- [ ] `/ops/feedback` — tabs: open, closed
- [ ] `/ops/graduation`
- [ ] `/ops/leads`
- [ ] `/ops/metrics`
- [ ] `/ops/orgs/[id]`
- [ ] `/ops/orgs/competitions`
- [ ] `/ops/orgs` — tabs: pending, verified, suspended, rejected
- [ ] `/ops/orgs/spam`
- [ ] `/ops`
- [ ] `/ops/reports/[id]`
- [ ] `/ops/reports` — tabs: resolved
- [ ] `/ops/sanctions` — tabs: recent, active
- [ ] `/ops/staff`
- [ ] `/ops/teachers` — tabs: decided, pending
- [ ] `/ops/universities/[id]` — tabs: overview, ecosphere, exams, invoices
- [ ] `/ops/universities/claims/[id]`
- [ ] `/ops/universities`
- [ ] `/ops/users/[id]` — tabs: overview, evidence, cvs, sanctions
- [ ] `/ops/users/[id]/view/[page]` — tabs: profile, me, cv, opportunities, privacy, notifications
- [ ] `/ops/users`

## dev (1 screens, slice —)

- [ ] `/ui`
