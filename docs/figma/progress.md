# Figma progress

One box per screen (route). A box is ticked when every tab of that screen has all four frames
(desktop light/dark, phone light/dark) built as editable layers bound to the "Skilient"
variables, plus its empty/error frames where `screens.json` lists those states.

- [x] Slice 1: foundations (variables Light/Dark, text styles, effects), brand, 120 icons and the component library (ids in `state.json`)
- [ ] Domain cards (post card, venture card, notification row, CV paper, ops sidebar): built in the slice whose screens first use them, from captured layout trees

## marketing (13 screens, slice 2)

- [ ] `/about`
- [ ] `/faculty`
- [ ] `/`
- [ ] `/pricing`
- [ ] `/privacy`
- [ ] `/recruiters`
- [ ] `/request-university/confirm`
- [ ] `/request-university`
- [ ] `/request-university/unsubscribe`
- [ ] `/terms`
- [ ] `/universities`
- [ ] `/verify/[code]`
- [ ] `/verify`

## auth (10 screens, slice 2)

- [ ] `/forgot-password`
- [ ] `/reset-password`
- [ ] `/signin/code`
- [ ] `/signin/mfa`
- [ ] `/signin`
- [ ] `/signup`
- [ ] `/signup/recruiter`
- [ ] `/signup/verify`
- [ ] `/auth/confirmed`
- [ ] `/auth/not-me`

## onboarding (4 screens, slice 2)

- [ ] `/agreement`
- [ ] `/onboarding/[step]` — tabs: university, profile, github, skills, looking-for, people
- [ ] `/onboarding/done`
- [ ] `/onboarding`

## public (1 screens, slice 2)

- [ ] `/cv/[username]`

## student (57 screens, slice 3–4)

- [ ] `/appeals`
- [ ] `/billing/checkout/[session]`
- [ ] `/billing/return/[session]`
- [ ] `/chat/[threadId]`
- [ ] `/chat`
- [ ] `/competitions/[id]`
- [ ] `/events/[id]/attend`
- [ ] `/events/[id]/check-in`
- [ ] `/events/[id]`
- [ ] `/events` — tabs: upcoming, mine, past
- [ ] `/explore` — tabs: people, projects, startups, ideas
- [ ] `/fairs/[id]`
- [ ] `/fairs/invite`
- [ ] `/feed` — tabs: university, global
- [ ] `/feedback`
- [ ] `/friends` — tabs: friends, received, sent, blocked
- [ ] `/ideas/[id]`
- [ ] `/leaderboard`
- [ ] `/me/code-checks/[id]`
- [ ] `/me/credentials`
- [ ] `/me/cv`
- [ ] `/me`
- [ ] `/me/score`
- [ ] `/me/skills`
- [ ] `/me/work` — tabs: ventures, contributions, reviews, endorsements, credentials
- [ ] `/moderation/[id]`
- [ ] `/notifications`
- [ ] `/opportunities/[tab]` — tabs: for_you, jobs, contact_requests, applications, competitions, job_fairs, ideas
- [ ] `/opportunities/applications/[id]`
- [ ] `/opportunities/contact-requests/[id]`
- [ ] `/opportunities/jobs/[id]`
- [ ] `/opportunities`
- [ ] `/post/[id]`
- [ ] `/profile/[username]/activity`
- [ ] `/profile/[username]`
- [ ] `/profile/[username]/skills`
- [ ] `/profile/[username]/ventures`
- [ ] `/requests` — tabs: received, sent, invites
- [ ] `/settings/account/delete`
- [ ] `/settings/billing`
- [ ] `/settings/chat`
- [ ] `/settings/github`
- [ ] `/settings/notifications`
- [ ] `/settings`
- [ ] `/settings/privacy`
- [ ] `/settings/profile`
- [ ] `/settings/security`
- [ ] `/ventures/[id]/chat`
- [ ] `/ventures/[id]/contributions`
- [ ] `/ventures/[id]/deliverables`
- [ ] `/ventures/[id]/manage`
- [ ] `/ventures/[id]`
- [ ] `/ventures/[id]/reviews`
- [ ] `/ventures/[id]/team`
- [ ] `/ventures/[id]/updates`
- [ ] `/ventures/new`
- [ ] `/ventures`

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
