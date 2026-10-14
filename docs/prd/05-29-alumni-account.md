# 5.29 Alumni account lifecycle (proposed 2026-10-13)

## Status and decision summary

**Status:** proposed for product approval. This section supersedes the graduate-account paragraphs in 5.25 where they conflict.

When a verified student graduates, the same account becomes an **alumni account**. It is not deleted, recreated or detached from its verified history. The person keeps their profile, evidence, CV, skills, tier, conversations, friends and recruiter access. The product changes the account's university privileges and moves sign-in and notifications from the university mailbox to a verified personal email.

Recommended decisions:

1. **Alumni is a lifecycle state, not a separate role.** The person remains `role = student`; the existing internal `status = graduate` value remains for compatibility, while every user-facing surface says **Alumni**.
2. **Conversion is automatic.** The existing platform graduation rule and university-specific exception remain the source of truth.
3. **Personal email is prepared before graduation.** Final-year students are repeatedly asked to verify one. At conversion it becomes the primary sign-in and notification address.
4. **Verified work survives.** Graduation never resets skill levels, evidence, contribution history, credentials, CVs, rank points or social relationships.
5. **Student-only powers end; community membership does not.** Alumni may read their university feed and finish existing ventures, but cannot create university-feed posts or newly join university-only ventures.
6. **Recruiter access continues under the alumnus's existing privacy controls.** Graduation must not make a profile newly visible.
7. **University access narrows at graduation.** Staff lose privileged access to the former student's individual student record. They retain aggregate outcomes and anything the alumnus makes public or explicitly shares.
8. **Mentoring is opt-in.** Alumni may join a university alumni directory and accept mentoring requests; they are never listed or contactable merely because they graduated.

## Problem

University email is a good way to establish student identity, but it is a poor permanent account identifier. Universities may close the mailbox shortly after graduation. If Skilient continues to depend on that address, a graduate can lose password recovery, sign-in codes, security alerts and control of an account containing years of verified work.

The current graduate state protects most data but is defined mainly by restrictions. It does not provide an email handoff, a coherent alumni identity, a privacy boundary for university staff or a positive reason for graduates to remain active.

## Goals

- Preserve one continuous, trustworthy identity from student to professional.
- Prevent loss of account access when a university mailbox or Google Workspace account is disabled.
- Keep verified work and recruiter value intact after graduation.
- Clearly separate active-student privileges from alumni privileges.
- Give alumni useful, consent-based ways to remain connected to their university community.
- Give universities aggregate graduate outcomes without permanent privileged access to individual alumni records.
- Make the transition understandable, reversible when made in error and auditable.

## Non-goals

- Letting an unverified person create a new alumni account with a personal email.
- Building a fundraising, donations, chapters, reunions or alumni-association CRM product.
- Replacing a university's official alumni database.
- Guaranteeing permanent access to university-owned services or content.
- Automatically exposing employment, contact details or mentoring availability.
- Supporting multiple simultaneous student institutions in the first release.

## Terminology and account states

| Term | Meaning |
| --- | --- |
| Student | A verified, currently enrolled user with active-student university privileges. |
| Final-year student | A student within 12 months of the configured graduation transition. |
| Alumni account | The same verified account after graduation. Singular copy uses **alumnus** only when grammatically necessary; product copy should normally say **alumni member** or **alumni account**. |
| Graduation transition | The audited state change from active student to alumni. |
| Institutional email | The university-domain address that originally established affiliation. It remains historical identity evidence after graduation. |
| Personal email | A non-disposable, user-controlled address used for alumni sign-in, recovery and notifications after verification. |

The database keeps `profiles.status = graduate` in the first release to avoid a risky enum and policy migration. The UI maps it to `Alumni`. `graduated_at` records when alumni privileges began. A later internal rename may be done separately with no product behavior change.

## Eligibility and transition timing

The existing rule remains in force: the nightly rollover converts a student when their graduation year is due under the platform rule—currently on or after 1 September in Pakistan time—or under an audited university-specific `final_year_batch` exception.

The transition changes lifecycle status; it does not re-evaluate the person's original university verification. An accounts staff member may:

- delay a transition when the graduation year is wrong or the student remains enrolled;
- convert an account early after documented correction;
- reverse a transition after verifying continued enrolment;
- record a reason for every manual action in the shared audit log.

The user receives the effective date 90, 30 and 7 days before conversion. The settings page always shows the current graduation year and a **Fix this** action. A correction request does not silently block conversion; staff must decide it before the effective date or the platform rule runs.

## Email and authentication transition

### Before graduation

Beginning 12 months before the expected transition, the student sees **Secure your alumni account** in the progress card and Settings → Account. The flow asks them to:

1. add a personal email;
2. verify it with a 15-minute code and magic link;
3. set a password if the account currently relies only on university Google sign-in;
4. download fresh recovery codes or confirm an authenticator if two-factor is enabled;
5. review notification and recruiter-visibility settings.

The personal email must be unique across accounts and must not be a known disposable domain. It is private by default and is never shown on the profile or CV unless the user separately opts in through the existing CV email control.

### At graduation

If a verified personal email exists, the rollover transaction:

- makes it the primary sign-in, recovery and notification address;
- retains the institutional address as non-login historical verification evidence;
- sends a security notice to both addresses when delivery is possible;
- revokes outstanding email-change, magic-link and recovery tokens;
- preserves current sessions, except sessions whose assurance depended only on a university Google identity that is no longer available;
- writes an audit event containing addresses only in masked form.

The user signs in with the personal email afterward. Existing username-based public links, CV verification codes and account IDs do not change.

### If no personal email was verified

The account still becomes alumni; no data is deleted. Existing password sessions continue, but the user sees a blocking recovery setup before security-sensitive actions. A remembered password may be used to sign in with the institutional address and immediately verify a personal email. A Google-only user whose university identity has already been disabled uses the alumni recovery process.

Recovery without the university mailbox requires two independent signals where available: current password, existing TOTP or recovery code, a previously linked provider, or a previously linked GitHub account. If automated recovery cannot establish control, the case goes to trained support for manual identity review. Recovery must not depend solely on public profile facts, and submitted identity material must not be retained after the case closes.

### After graduation

An alumnus may change their personal email after recent password or MFA verification and confirmation of the new address. The old personal address receives a security notice but does not need to approve the change. The institutional address cannot be restored as the primary login unless it is still live and the person has returned to active-student status.

## Alumni capabilities

| Capability | Alumni behavior |
| --- | --- |
| Profile, username and public URL | Preserved; displays university, programme and class year with an **Alumni** label. |
| Skills, evidence, contributions and credentials | Preserved and may continue to grow under the same verification rules. |
| Verified CV and share links | Preserved; new versions identify the person as alumni rather than a current student. Existing signatures remain valid. |
| Recruiter visibility and job applications | Preserved exactly as configured by the user. |
| Global feed | Read and post. |
| University feed | Read, react and comment; cannot create a new top-level university post. University blocks and moderation still apply. |
| University announcements | Receives only announcements explicitly targeted to alumni and only if university communications are enabled. |
| Friends and chat | Preserved. Existing conversations continue. |
| Existing ventures | Membership and history remain. The alumnus may finish work already in progress. |
| New ventures | May create or join Public and Unlisted ventures; cannot create or newly join University-only ventures. |
| Opportunities | Jobs, recruiter requests, applications, public competitions and public events remain available. Student-only job fairs and opportunities are hidden unless the organiser explicitly allows alumni. |
| University directory | Optional alumni-directory listing; off by default. |
| Mentoring | Optional; off by default and controlled separately from recruiter visibility. |

## University relationship and privacy

Graduation ends the university's privileged student-record access. Growth or Campus staff may no longer open the private student record merely because the person studied there. They may see:

- the same public profile visible to other signed-in users;
- alumni-directory fields the alumnus explicitly publishes;
- responses to an alumni outcome request the alumnus explicitly submits;
- aggregate dashboards in groups of five or more.

The alumnus controls three independent settings:

1. **University communications** — receive alumni-targeted announcements and invitations.
2. **Alumni directory** — appear to verified members of the same university with selected fields.
3. **Outcome sharing** — share selected employment or education outcomes with the university.

All default to off at transition, except a student may choose them during the pre-graduation review. A university cannot require these settings as a condition of preserving the Skilient account. Existing student-record access logs remain visible under their normal retention rules.

Aggregate historical statistics may continue to count the alumnus, but cohort cells smaller than five remain suppressed. Individual outcome data is not inferred from recruiter chats, private applications or CV views.

## Recruiter and employment experience

Graduation does not change recruiter visibility. An alumnus who was hidden remains hidden; one who was visible remains visible. Recruiter search and profiles show:

- **Alumni · [University] · Class of [year]**;
- current availability and location;
- verified skills, work, credentials, tier and CV;
- employment history only when the user adds or imports it.

Recruiters use the same contact-request flow and cannot see the personal email before the user accepts and chooses to share it. Alumni remain eligible for internships only when they select that availability; the platform does not infer eligibility from graduation date.

## Ventures, community and mentoring

Graduation must not strand an active team. Existing venture membership, contribution history, reviews and group chat remain. An alumnus may finish and ship an existing university-only venture but cannot apply to another one or be newly invited into one.

Mentoring is a lightweight, opt-in extension of existing profiles, friend requests and chat—not an open inbox. An alumnus may specify:

- whether they are open to mentoring;
- up to five topics from the skill dictionary;
- preferred format: one question, occasional chat or portfolio review;
- monthly capacity from 1 to 5 accepted requests.

Only verified students and alumni from the same university may send a mentoring request in the first release. The request includes a topic and a short message; chat opens only after acceptance. Blocking, reporting and rate limits apply. Mentoring creates no rank points, endorsements or automatic credential because that would invite gaming.

## Ranking, verification and credentials

An alumnus keeps their point total, tier and verified evidence. New GitHub evidence, completed ventures, peer confirmations and credentials continue to use the existing rules. Graduation itself awards no points and changes no verification level.

For leaderboards:

- the alumnus leaves active-student university and global boards at transition;
- their class-year university board remains available for 12 months after `graduated_at` as a historical cohort view;
- the profile continues to show tier and score without an active-student percentile;
- a dedicated alumni leaderboard is out of scope until there is evidence that it creates healthy behavior.

Signed CVs issued before graduation remain valid snapshots. A newly issued CV uses the current alumni label and current primary contact preference; old records are not rewritten.

## Plans, sponsorship and billing

University-sponsored Pro ends at the end of the month containing the graduation transition. The user receives 30 days' notice where the graduation schedule permits it and may continue with a personal subscription. A personally paid subscription, trial, invoice, issued CV or entitlement is not cancelled by graduation.

No core alumni capability—account access, profile, evidence, CV verification, recruiter visibility, job applications, university communications, directory listing or mentoring—requires Pro. Existing Pro conveniences keep their current entitlement rules.

## Notifications and transition experience

The transition is a small guided sequence rather than a surprise banner:

- **12 months before:** progress-card task to add a personal email; dismissible for 30 days.
- **90 days before:** email and in-app notice with the effective date and what changes.
- **30 days before:** persistent account checklist; sponsored-Pro expiry notice where applicable.
- **7 days before:** final reminder and recovery check.
- **On transition:** full-screen **Your alumni account is ready** summary, personal-email confirmation, privacy choices and corrected navigation tour.
- **After transition:** reminders at 7 and 30 days only when personal email remains unsecured.

Messages use **alumni account**, never “expired student”, “former user” or “downgraded account”. All notices remain available in the notification centre even when email delivery fails.

## Data model and system behavior

The first release extends existing objects rather than introducing a second user record:

| Object | Change |
| --- | --- |
| `profiles` | Keep `role = student`, `status = graduate`, `graduated_at`; add no duplicate alumni profile. |
| `account_emails` | Private table: `user_id`, `email`, `kind institutional\|personal`, `verified_at`, `primary_from`, `retired_at`, `last_delivery_status`; unique normalized email. |
| `alumni_preferences` | `user_id`, `university_comms`, `directory_visible`, `outcome_sharing`, `mentoring_open`, `mentoring_topics`, `mentoring_format`, `mentoring_capacity`, timestamps. |
| `graduation_corrections` | User request, requested year, evidence reference, status, resolver and audited reason. |
| `mentoring_requests` | Requester, alumnus, topic, message, status and timestamps; unique pending pair and monthly rate limit. |
| `graduate-rollover` | Keep the internal job name initially; make personal-email promotion, status change, sponsorship expiry and notification enqueue idempotent in one controlled workflow. |
| RLS helpers | Treat `status = graduate` as alumni and enforce the capability matrix above. |

Institutional and personal email addresses never appear in public profile tables, analytics payloads or university exports. The public profile derives only the university name and class year already approved for display.

## Security, abuse and recovery

- A personal email cannot establish alumni status; only a previously verified student account can transition.
- Personal email verification is rate-limited and all links are single-use and short-lived.
- Email promotion is idempotent, audited and safe to retry after partial failure.
- A university cannot change an alumnus's personal email, privacy choices or recruiter visibility.
- Support recovery requires stronger evidence than information visible on the profile.
- Mentoring requests are rate-limited, block-aware and unavailable to suspended accounts.
- Reversing an incorrect graduation restores student privileges but does not silently switch the primary email back.
- Bans, deletion cooling-off and legal holds behave exactly as they do for student accounts.

## Analytics and success metrics

Events contain user IDs and state changes, not raw email addresses:

- `alumni_transition_scheduled`
- `personal_email_added`
- `personal_email_verified`
- `alumni_transition_completed`
- `alumni_transition_reversed`
- `alumni_recovery_started|completed`
- `alumni_directory_enabled|disabled`
- `mentoring_request_sent|accepted|declined`

Initial success measures:

- at least 90% of transitioning students have a verified personal email before graduation;
- fewer than 1% of alumni transitions create a support recovery case;
- at least 95% of automated transitions complete without manual intervention;
- at least 60% of alumni who were active in the previous 90 days return within 90 days after transition;
- no measurable increase in unintended recruiter visibility;
- fewer than 0.5% of mentoring requests are reported as abuse.

## Edge cases

| Case | Required behavior |
| --- | --- |
| Student graduates early or late | User requests correction; accounts staff changes the effective year or reverses transition with an audited reason. |
| University email remains active forever | Personal email still becomes primary; the institutional address remains identity evidence, not a recovery dependency. |
| University Google account is disabled before transition | Password/personal-email preparation prevents lockout; otherwise use alumni recovery. |
| No verified personal email | Preserve account and data; allow password sign-in through the institutional identifier, then require recovery setup. |
| Personal email already belongs to another account | Refuse linking and route through duplicate-account recovery; never merge automatically. |
| Student returns for another degree | After verification, staff may restore active-student status while retaining alumni history and personal primary email. |
| Student transfers universities | Existing transfer policy applies before graduation; transition retains the verified education history. |
| Account is deleting, suspended or banned | Graduation does not cancel or weaken the existing restriction. |
| Existing university-only venture | Membership continues to completion; no new university-only memberships. |
| Existing paid subscription | Continues unchanged; only university sponsorship expires. |
| Deceased user | Existing memorialisation or deletion policy applies when one is adopted; this PRD introduces none. |

## Rollout and migration

1. Add private email and alumni-preference storage with RLS and audit coverage.
2. Ship personal-email verification to all students without changing sign-in.
3. Start prompts with final-year students; measure verification and support failure rates for at least 30 days.
4. Add dual-address sign-in compatibility and the alumni recovery flow.
5. Enable transactional email promotion in a dry-run mode that reports conflicts without changing accounts.
6. Migrate existing `status = graduate` accounts: ask for a personal email first, then promote it after verification.
7. Enable the complete rollover for one university cohort, monitor for seven days, then expand globally.
8. Add the alumni directory and mentoring only after identity transition and privacy controls are stable.

The marketing FAQ, Student Portal PRD, signup copy, user agreement, privacy notice, security requirements and support runbook must be updated before general rollout.

## Acceptance criteria

- A qualifying student becomes alumni exactly once under the configured rule, and retrying the job changes nothing twice.
- A verified personal email becomes the login and notification address without changing the user ID, username, profile URL, friends, chats, CV codes, evidence or application history.
- A student without a personal email does not lose data and has a documented recovery route.
- An alumnus cannot create a University Feed post or newly join a University-only venture, including through a direct database call.
- An alumnus can finish an existing venture and use Global Feed, public/unlisted ventures, jobs, applications and recruiter contact flows.
- Graduation does not change recruiter visibility, profile visibility, CV visibility or email-display settings.
- University staff lose privileged individual student-record access at transition; aggregates remain subject to the minimum cohort size.
- Alumni directory, university communications, outcome sharing and mentoring are independently consented and off by default.
- Existing signed CVs verify exactly as before; newly issued CVs show alumni status.
- University-sponsored Pro ends on schedule while a personal subscription continues.
- Every automatic or manual transition, correction, email promotion and recovery is auditable without storing raw email addresses in the audit payload.
- Cross-account, cross-university, duplicate-email, recovery and partial-failure tests pass.

## Open questions

These are implementation questions rather than unresolved product policy:

1. Whether Supabase Auth can promote a pre-verified secondary email atomically without sending another confirmation, or whether the rollover needs a short-lived migration token.
2. Which disposable-email dataset and update process should be used.
3. What evidence and retention window Legal approves for the exceptional manual recovery path.
4. Whether existing graduates should receive mentoring in the first migration or only after the identity transition has operated safely for one cohort.
