# Skilient email inventory and Brevo cutover

2026-10-14. **Application/worker changes remain local and untested; deployment and live email verification are pending.**
Follow-up: Ahmed authorized the database migration through Supabase MCP. `brevo_email_delivery` was applied to
Skilient v1 (`tnkavkczqmzgasaepwnc`), and its history version aligned to `20261105000001` to match the local filename.
Read-only catalog checks confirmed both new tables, RLS/default-deny access, columns and service-role-only signal RPC.
No tests or live email flows were executed. Security Advisor reports the expected policy-free private tables and an
unrelated leaked-password-protection warning; Auth dashboard configuration remains untouched.
This runbook supersedes historical Resend configuration in decisions, phase notes and generated code snapshots.
User constraints: no tests, builds, typechecks, lint, browser automation, Docker, local servers, pushes or CI runs.
The existing changes in `docs/prd/README.md`, `docs/prd/05-29-alumni-account.md` and `.vscode/` were preserved.

## Sender rules and common sending paths

Every application/worker template now has a required `category`. `security` means authentication/security;
`notification` means product or operational correspondence without an authentication/security purpose.
Access-granting organisation/university-admin invitations and request-email verification are security.
Account sanctions/moderation/deletion/view-as notices are security.
Billing receipts/reminders, evidence/CV updates, fair invitations, staff operational alerts and product updates are notifications.

| Classification | From and Reply-To |
|---|---|
| Authentication/security | `Skilient <security@skilient.com>` |
| Notification | `Skilient <notify@skilient.com>` |

The sender is selected by category, not runtime. No `EMAIL_FROM` override remains. Both mailboxes must receive replies.
Previously neither HTTP sending path set an explicit Reply-To; it now matches the category's sender.
HTML/text wording, escaping, links, consent and notification preferences are retained. A daily digest containing both
classes is split into category-specific messages using the existing layout and item wording; the combined item limit
remains 20, each part counts against 60/day, and the digest cursor advances only after both parts succeed.
Digest content and the cursor are bounded by the queue's enqueue time, so a partial retry cannot mark newer,
unsent notifications as covered. This is necessary bookkeeping for splitting a digest without losing later items.
[VERIFY: supabase/functions/_shared/email/brevo.ts:11] [VERIFY: supabase/functions/_shared/notify/worker.ts:283]

Paths used by the inventory:

- **A — Vercel direct API:** caller → `lib/email/templates.ts` → `lib/email/send.ts` →
  `supabase/functions/_shared/email/brevo.ts` → `POST https://api.brevo.com/v3/smtp/email`.
  `BREVO_API_KEY` authenticates using `api-key`. These sends remain unqueued with no automatic retries.
  Existing request/action protections and database one-time tokens remain in place.
- **Q — Supabase queued API:** event/action/cron → SQL notification producer → `private.notify()` or bulk notification insert →
  `public.notifications` → `private.email_channel_for()` → pgmq `notification_emails` → minute `notify-worker` cron →
  `supabase/functions/notify-worker/index.ts` → `_shared/notify/worker.ts` → `_shared/notify/email.ts` /
  `_shared/notify/describe.ts` → `_shared/email/delivery.ts` → `_shared/email/brevo.ts` → Brevo.
  Daily/teacher/launch/ops queue messages have their own producers described below.
- **S — Supabase Auth SMTP:** `lib/actions/auth.ts` → Supabase Auth → hosted SMTP configuration → Brevo SMTP.
  Supabase renders `supabase/templates/*.html`; it does not use `BREVO_API_KEY` or our API transport.
  The dashboard configuration is separately owned and was not accessed or overwritten.

Production links must use `https://www.skilient.com`. Direct actions and sign-in tracking construct links from their
request origin (`ctx.origin`/`meta.origin`), preserving local/Preview behavior; production redirects must therefore
land on the canonical host before starting auth or invite flows. Worker links use required Edge secret `APP_URL`.
Supabase Auth uses the requested `/auth/confirm` redirect and its hosted Site URL/allowlist. Local config is not the hosted config.
[VERIFY: lib/actions/context.ts:23] [VERIFY: lib/actions/auth.ts:203]

## Direct and authentication inventory

All A/Q rows below are **implemented locally; execution/live checks pending**. S rows are **audited; dashboard migration external/pending confirmation**.

| Email | Trigger and complete path | Class / sender | Controls and relevant source |
|---|---|---|---|
| Signup code + confirmation link | Student/faculty/university-admin `signUp` and recruiter `signUpRecruiter` → S | Security / security@ | University/domain hook, email confirmation, Turnstile, network/email limits; `lib/actions/auth.ts`, `confirmation.html` |
| Signup-code resend | `resendVerificationCode` → Supabase `auth.resend` → S | Security / security@ | Signup cookie and 3/hour per email; same confirmation template |
| Sign-in OTP + magic link | `requestSignInCode`, `resendSignInCode` → `auth.signInWithOtp` → S | Security / security@ | No implicit account creation, Turnstile, email 5/hour and per-network throttling; `magic_link.html` |
| Password recovery | `requestPasswordReset` and compromised-device `reportNotMe` flow → `resetPasswordForEmail` → S | Security / security@ | Existing rate limits/Turnstile, one-time token; `recovery.html`; `/auth/confirm` GET opens `/auth/link`, POST verifies |
| Email-change confirmation | Configured Auth template/hook, supported by `/auth/confirm`; no app caller currently changes email | Security / security@ | `email_change.html`, double confirmation locally enabled; dashboard capability only, retained |
| New-device alert | Password, OTP, Google callback, magic-link/recovery success → `recordSignIn` → `record_sign_in` RPC → `after()` → A | Security / security@ | Only when RPC emits a new-device alert token; 7-day one-time not-me link; `lib/auth/sign-in-record.ts`, `newDeviceEmail`; callers in auth actions, `app/auth/callback/route.ts`, `app/auth/confirm/route.ts` |
| Repeated-password-attempt warning | `signIn` → `signin_failed` returns `notify` → `after()` → A | Security / security@ | Ten wrong passwords/15 min; warning no more than once/hour; `lib/actions/auth.ts`, `signInAttemptsEmail` |
| Backup-code-used notice | Successful `redeemBackupCode` → backup-code RPC invalidates remaining codes/MFA → `after()` → A | Security / security@ | Successful one-time recovery only; `lib/actions/mfa.ts`, `backupCodeUsedEmail` |
| Support MFA reset | `resetTwoFactor` → `ops_reset_mfa` (staff/MFA/identity check) → `after()` → A | Security / security@ | Separate direct send outside worker budget; `lib/actions/ops/users.ts`, `mfaResetEmail`; `mfa_reset` notification itself is in-app only |
| Recruiter teammate invitation | `inviteMember` → `invite_org_member` stores token hash → A | Security / security@ | Role/ownership checks, expiring one-time invite, UI link fallback and `emailed` flag; `lib/features/organizations/actions.ts`, `orgInviteEmail` |
| University admin invitation | `inviteAdmin` → `invite_uni_admin` stores token hash → A | Security / security@ | Owner/role checks, expiring one-time invite, UI fallback; `lib/actions/uni.ts`, `uniAdminInviteEmail` |
| Job-fair company invitation | `inviteFairCompany` → `invite_fair_company` → `fair_invite_preview` → A | Notification / notify@ | Fair permission, 100/day per admin and 200 invites/fair; invite hash/access rules retained; `lib/actions/uni.ts`, `fairInviteEmail` |
| University-request email verification | `requestUniversity` → `request_university` creates consenting request → A only when status `created` | Security / security@ | Turnstile/network limits; repeat requests send nothing; confirm and unsubscribe token links; `lib/actions/marketing.ts`, `universityRequestEmail`, marketing migration |

Direct API sends previously had no provider idempotency key and no delivery queue; a failed helper returns false/logs,
and some callers intentionally still complete the underlying action. That behavior remains. Brevo now receives a fresh
UUID per helper invocation, and no automatic retry is added. A failed request confirmation still needs staff attention;
the database may already hold the request and a repeat does not resend it. There is no newly claimed exactly-once guarantee for A or S.
[VERIFY: lib/email/send.ts:13] [VERIFY: lib/actions/marketing.ts:87]

Auth template settings preserved: confirmations on, local OTP expiry 900 seconds, six digits, double-confirm email changes.
No local SMTP credentials are active; `supabase/config.toml` uses the local test mail server and commented SMTP example.
Hosted SMTP/rate-limit values cannot be inferred from that file. Password-change notification emails are commented out,
and Google OAuth does not send an Auth email itself (it can trigger the separate new-device alert).
[VERIFY: supabase/config.toml:232]

## Queued email categories and producers

Q classification is per notification type: account/security types use security@; all other eligible types use notify@.
`notification_types.emailed=false` stays in-app only; a changed sender never turns those emails on.
Category preference/default decides instant vs digest, except billing which remains mandatory instant.

| Category / types | Trigger and relevant SQL producer | Sender / migration status |
|---|---|---|
| Friend request (`friend_request`) | friend_requests insert → `notify_friend_requests`; `20260929000000_notifications.sql` | notify@ / Q migrated |
| Venture applications (`application_received`, `application_decided`) | venture_applications status/insert → `notify_applications`; notifications migration | notify@ / Q migrated |
| Venture invitations (`invite_received`) | venture_invites insert → `notify_invites`; notifications migration | notify@ / Q migrated |
| Ownership (`ownership_transferred`) | ventures owner update → `notify_venture_changes`; notifications migration | notify@ / Q migrated |
| Team updates (`member_left`, `member_removed`, `venture_completed`, `venture_abandoned`) | membership deletion / venture state triggers; notifications migration | notify@ / Q migrated; team defaults off, digest when opted in |
| Comments and mentions (`comment_received`, `comment_reply`, `comment_mention`) | `add_comment`; `20260929020000_comments_links.sql` | notify@ / Q migrated; digest-only categories |
| Chat (`chat_message`) | chat_messages insert → `notify_chat_message`; `20260929050000_chat.sql` | notify@ / Q migrated; existing thread-mute, block and recipient checks |
| Moderation/account (`content_removed`, `moderation_warning`) | current `resolve_case`; reports/phase3/ranking/penalty migrations | security@ / Q migrated |
| Evidence (`endorsement_received`, `credential_reviewed`, `code_check_ready`, `code_check_graded`, `cv_revoked`) | `endorse`/`teacher_endorse`, `review_credential`, `code_check_prepared`/grading/tick, `ops_revoke_cv`; endorsements, credentials, code checks, teacher portal, CV migrations | notify@ / Q migrated; trust preferences retained |
| Account deletion (`deletion_requested`, `deletion_cancelled`) | `request_account_deletion`, `cancel_account_deletion`; student portal migration | security@ / Q migrated |
| Feedback (`feedback_update`) | `respond_feedback`; student portal migration | notify@ / Q migrated; digest-only |
| Recruiter organisation (`org_decided`) | `decide_org`; `20261013000000_recruiter_orgs.sql` | notify@ / Q migrated |
| Recruiter contacts and matches (`contact_request`, `saved_search_matches`) | `send_contact_request`, daily `run_saved_searches`; recruiter talent migration | notify@ / Q migrated |
| Jobs/hiring (`job_application_received`, `application_stage`, `job_invite`, `hire_outcome_due`) | `apply_to_job`, `move_application_one`, `invite_to_apply`, scheduled `ask_hire_outcomes`; recruiter jobs migration | notify@ / Q migrated |
| Competitions (`competition_decided`, `competition_result`) | `ops_review_competition`, `finish_competition`, `finish_hackathon`; recruiter jobs and uni fairs migrations | notify@ / Q migrated |
| University claim (`uni_claim_decided`) | `decide_uni_claim`, staff `ops_assign_uni_owner`; uni core/ops wrapup | notify@ / Q migrated |
| University award (`uni_award`) | `award_badge`; uni ecosphere migration | notify@ / Q migrated |
| University announcement (`uni_announcement`) | `uni_post_announcement` bulk inserts notifications directly, daily digest selects them; uni comms migration | notify@ / Q migrated; digest-only |
| University moderation (`content_hidden_by_university`) | `uni_hide`; uni comms migration | security@ / Q migrated |
| Sanctions/appeals (`account_restricted`, `restriction_lifted`, `org_sanctioned`, `appeal_decided`) | `sanction_user`, `sanction_org`, `lift_sanction_row`, `decide_appeal`; sanctions/appeals migration | security@ / Q migrated |
| Staff viewed account (`account_viewed`) | `ops_view_as_start`; users/view-as migration | security@ / Q migrated |
| Billing (`billing_payment_succeeded`, `billing_payment_failed`, `billing_trial_ended`, `billing_subscription_ended`, `billing_renewal_reminder`, `billing_hire_fee`, `billing_hire_fee_overdue`, `billing_refund`, `billing_limits_applied`) | gateway webhook → billing_events → `billing_apply_event`; `billing_tick`, `expire_subscription`, `on_hire_recorded`, `apply_org_limits` → `billing_notify` → readers' notifications; billing lifecycle migration | notify@ / Q migrated; compulsory instant; billing-worker does not send mail itself |
| Invoices/sponsorship (`billing_invoice_issued`, `billing_sponsorship_started`, `billing_sponsorship_ending`) | `ops_issue_licence`, nightly `sponsorship_sync` → `billing_notify`; billing ops migration | notify@ / Q migrated |
| Daily digest | `queue_notification_digests`, cron `7 13 * * *` (18:07 PKT) → kind digest | Each part's category sender / Q migrated; unread, inactive 24h, since last digest, 20h duplicate guard, max20 items |
| Weekly teacher digest | `queue_teacher_digests`, Monday `0 4 * * 1` (09:00 PKT), `teacher_digest_data` counts supervision invites, review requests/due dates, checks and closing ideas | notify@ / Q migrated; approved teachers only, optional, non-empty, counts only |
| University launch | universities.live_at transition → `university_went_live` → `queue_university_launch` → kind university_launch; `20261102000000_university_launch.sql` | notify@ / Q migrated; once per confirmed consenting requester, unsubscribe/live status rechecked |
| Staff alerts/resolutions | ten-minute `job_watchdog` → `queue_alert_email` → kind ops_alert; `20261105000000_alerts.sql` | notify@ / Q migrated; `alerts.recipients`, initial/cooldown/resolved, outside60/day; per-recipient durable protection |

The following registered types remain non-email notifications: friend_accepted, application_withdrawn, invite_answered,
endorse_teammates, credential_expired, cv_refreshed, teacher_decided, supervision_requested, supervision_answered,
supervisor_comment, supervisor_confirmed, review_requested, review_reminder, review_received, review_expired,
org_member_joined, contact_accepted, contact_declined, team_invite, org_spam_review, uni_admin_joined,
uni_domain_decided, uni_batch_decided, uni_question_removed, uni_event_reminder, uni_event_cancelled,
content_restored, hackathon_judge, fair_called, billing_trial_started, billing_plan_changed, mfa_reset.
Faculty work is summarized by the separate weekly email; mfa_reset is delivered by A.
`fair_invite` is registered emailable, but no notification producer was found; actual fair invites use A.

## Retry, duplicate protection, limits and privacy

- Q still reads batches of20 with120-second visibility, spaces ordinary sends by600ms, retries at30×read count
  (up to5 reads), skips already-read/blocked/missing-address/stale12h instant notices, and rechecks preferences.
- `not_enough_credits` parks ordinary notices until00:05UTC. This is an application retry schedule, not an assertion
  that every Brevo plan resets credits then. Rate-limit429 honors numeric Retry-After/x-sib-ratelimit-reset and stops the batch.
  Definitive other4xx fail without retry. Network/5xx/missing successful message ID are ambiguous and use bounded safe retry.
- Brevo API authentication is `api-key`; JSON uses `sender`, `replyTo`, `htmlContent`, `textContent`, one-recipient
  `messageVersions`, and `headers.idempotencyKey` UUID. Acceptance reads `messageIds[0]` or `messageId`.
  No Resend Authorization header, `{from,to:string[],html,text}`, response `id`, or Svix verification remains.
- Brevo documents30-minute idempotency. Queue identities derive stable UUIDs from hashed logical keys;
  digests use the queue's enqueue day rather than retry day. `private.brevo_email_attempts` atomically leases each key
  and persists acceptance beyond the provider window; partial staff-alert retries skip accepted recipients.
  Accepted sends use `email_sends.send_key` uniqueness; legacy instant sends are checked by notification_id.
- Ambiguous attempts retry only identical payloads within25minutes. Changed content or expired protection becomes
  `uncertain`, never automatically resent. A crash before HTTP dispatch can therefore need reconciliation too.
  Five-read exhaustion can leave a pending ledger row needing review. Exactly-once delivery is not claimed.
  Tombstones contain opaque hashes/state/provider IDs, never email bodies, recipients, tokens or IPs, and are retained.
- Existing worker cap60/day includes queued security/account emails just as before; staff alerts bypass it.
  Two category-specific digest parts consume two slots. Direct application and Auth emails have no new global cap.
  Provider suppression is separate: no existing application bounce blocklist existed. Preserve/import valid old provider
  suppressions into Brevo under operator control; do not automatically unblock suppressed recipients or alter consent.
- Existing notification settings/teacher opt-out/university-request POST unsubscribe remain authoritative.
  No Brevo marketing contacts, campaigns, open/click tracking or new unsubscribe flow is introduced.

## Delivery and bounce monitoring

`POST https://www.skilient.com/api/webhooks/brevo` replaces the deleted `/api/webhooks/resend` route.
Brevo supports bearer webhook authentication; configure an independent random32+-character token as
`auth: {type: "bearer", token: "<your token>"}` and Vercel Production `BREVO_WEBHOOK_SECRET`.
The token is not a Brevo API key, SMTP key or old signing secret. TLS and constant-time comparison authenticate requests.
This is shared-token authentication, not a payload signature. Unbatched object payloads only; actual streamed body capped64KiB.
Missing config404, missing/wrong auth401, malformed400, oversized413, storage error500; successful/ignored events200.

Subscribe to transactional EMAIL events **Delivered** (`delivered`) and **Hard bounce** (`hardBounce` in webhook creation,
`hard_bounce` in payloads). Soft bounces may later deliver, so are not counted as final failures. Do not subscribe to opens/clicks.
The handler reads `event`, `message-id`, `email`, derives a keyed opaque event identifier, and calls service-role-only
`record_brevo_email_signal`. The receipt insert and monitoring signal commit atomically; redelivery cannot inflate counts.
Existing24h/>5%/minimum20 alert rules remain. Auth SMTP events are covered when sent through the same Brevo account.
Unknown events are acknowledged without retaining their body. Provider block/spam/unsubscribe details remain in Brevo logs.
[VERIFY: lib/monitoring/brevo-webhook.ts:6] [VERIFY: app/api/webhooks/brevo/route.ts:10]

## Remaining dashboard and deployment steps

1. Brevo: authenticate skilient.com and verify both sender identities (Skilient/security@ and Skilient/notify@).
   Confirm both mailboxes receive replies. Review sending activation, credits, suppression import and any API IP restrictions.
2. Vercel Production: `BREVO_API_KEY` is already present per Ahmed. Add independent `BREVO_WEBHOOK_SECRET`;
   set `NEXT_PUBLIC_SITE_URL=https://www.skilient.com`. Preview sends require a separately approved test credential;
   do not add production credentials to Preview automatically. `EMAIL_FROM` and old provider variables are unused; leave credentials intact.
3. Supabase Edge secrets: `BREVO_API_KEY` already present; set `APP_URL=https://www.skilient.com`.
   Billing's separate `SITE_URL` should also use the canonical origin. Existing notify_worker_secret/project_url stay intact.
4. Supabase Auth owner: separately confirm SMTP host `smtp-relay.brevo.com`, port587 STARTTLS or465 TLS,
   username from Brevo's SMTP tab, password a **Brevo SMTP key**; sender Skilient/security@.
   Set Site URL/redirect allowlist for www. Retain templates/hooks/expiry/rate limits; disable auth link tracking.
   No dashboard configuration was changed here; authentication checks remain deferred until domain/Turnstile is ready.
5. Later, after review and permitted verification: stop overlapping old/new notify-worker runs during cutover.
   Review any old in-flight launch/teacher/ops sends (legacy records cannot prove their receipt reliably), let old runs finish,
   The migration `20261105000001_brevo_email_delivery.sql` is now applied; do not apply it again. Do not blindly deploy the old worker again.
   Its two new private tables must retain default-deny RLS; only the signal RPC is exposed to service_role.
6. Deploy the updated notify-worker and Vercel application only after that migration. Database types were edited manually
   for the new RPC; regenerate/compare them on an approved machine later. No workflow or code deployment was started.
7. Brevo → Transactional → Settings → Webhooks: add the endpoint/events above, unbatched, and bearer authentication.
   If the UI does not expose auth, use Brevo's Create/Update Webhook API with the `auth` object; do not create an unauthenticated webhook.
   Creation body (placeholders only; configure privately):

   ```json
   {
     "url": "https://www.skilient.com/api/webhooks/brevo",
     "description": "Skilient delivery and final bounce monitoring",
     "type": "transactional", "channel": "email", "batched": false,
     "events": ["delivered", "hardBounce"],
     "auth": {"type": "bearer", "token": "<same independent BREVO_WEBHOOK_SECRET>"}
   }
   ```

8. Review legacy Resend webhook dashboard configuration at cutover so it no longer calls a removed endpoint.
   No credentials were deleted. Old application sender overrides are no longer read.

## Manual verification checklist (after deployment; not performed)

- Confirm category From/display-name/Reply-To for direct security, fair invite, instant account notice,
  product notification, billing receipt, teacher digest, university launch and staff alert; mixed digest parts use separate senders.
- Confirm HTML/text content and token links still work; request unsubscribe and preferences suppress queued mail.
- Controlled webhook without/wrong bearer401; valid delivery200; repeat same event produces one monitoring signal;
  controlled hard bounce counts once; soft bounce ignored. Exercise database error retry without exposing event bodies.
- Retry a queued request after a simulated lost response with the same key and payload; review durable receipt and one email.
  Retry beyond25minutes/with changed content only after manual provider-log reconciliation. Review pending/uncertain rows:

  ```sql
  select state, first_attempt_at, lease_until, message_id
  from private.brevo_email_attempts
  where state = 'uncertain' or (state = 'pending' and first_attempt_at < now() - interval '25 minutes');
  ```

- Confirm60/day cap, credits/rate-limit handling, digest schedule and launch once-only rules on an approved test environment.
- Auth owner later checks signup/code resend/magic-link/reset/change-email and new-device alerts once domain/Turnstile is ready.
- Run affected unit/worker tests and required database/type/lint checks only when resources and user permission allow.

## Source inspection performed and retained references

Searched the entire repository including hidden files for provider keys, imports, endpoints, SMTP, helpers/callers,
queue producers, triggers, crons, templates, tests, CI, recovery instructions and documentation. No Resend SDK dependency/import
was found in the active package/lockfile; the implementation used two direct HTTP transports and one Svix webhook.
Reviewed every direct helper caller, notification registration and producer, billing-notification fanout, all five worker kinds,
privacy/logging, worker fake-provider payloads, and new SQL permissions/atomic claims. These are source checks, not execution evidence.

Retained references: historical decisions and phase/build reports; immutable old migrations and historical `resend_id` values;
generated docs/schema/knowledge-graph snapshots; `.claude/worktrees/docs-stage-4` is a separate checkout, not the active application;
local provider credentials are untouched. Lowercase `resend`, Supabase `auth.resend`, and `RESEND_COOLDOWN` mean sending a code again,
not the retired provider. Existing historical documents point here for current configuration.

Tests updated but NOT RUN: `tests/worker/notify-worker.test.ts` (Brevo shape/auth/errors/idempotency expectations),
`tests/unit/monitoring.test.ts` (bearer auth/malformed/legacy signature refusals), and essential
`tests/unit/email-senders.test.ts` (category-to-sender/Reply-To across every template). No tests, build, typecheck, lint,
Docker, browser, local server, CI, deploy or live email were executed.

## Official provider sources consulted

- [Transactional API request and response](https://developers.brevo.com/reference/send-transac-email)
- [Batch idempotency: UUID,30-minute TTL, duplicate response](https://developers.brevo.com/docs/heterogenous-versions-batch-emails)
- [Bearer webhook authentication](https://developers.brevo.com/docs/secured-webhooks)
- [Webhook creation event names and batching](https://developers.brevo.com/reference/create-webhook)
- [Transactional delivery/bounce payloads](https://developers.brevo.com/docs/transactional-webhooks)
- [Error codes and rate-limit headers](https://developers.brevo.com/docs/how-it-works)
- [Supabase SMTP integration and distinct SMTP keys](https://developers.brevo.com/docs/supabase-smtp-integration)

## Complete email-eligible notification registry cross-check

Source inspection found86 registered types:54 eligible for email and32 in-app-only. All86 names are covered above.
Every row below uses Q and is migrated locally with execution/deployment pending; fair_invite is dormant as noted.
The current runtime lookup/preferences still decide whether an eligible row actually sends.

| Type | Classification / sender | Registry source |
|---|---|---|
| `friend_request` | Notification · notify@ | [VERIFY: supabase/migrations/20260929000000_notifications.sql:44] |
| `application_received` | Notification · notify@ | [VERIFY: supabase/migrations/20260929000000_notifications.sql:46] |
| `application_decided` | Notification · notify@ | [VERIFY: supabase/migrations/20260929000000_notifications.sql:47] |
| `invite_received` | Notification · notify@ | [VERIFY: supabase/migrations/20260929000000_notifications.sql:49] |
| `ownership_transferred` | Notification · notify@ | [VERIFY: supabase/migrations/20260929000000_notifications.sql:51] |
| `member_left` | Notification · notify@ | [VERIFY: supabase/migrations/20260929000000_notifications.sql:52] |
| `member_removed` | Notification · notify@ | [VERIFY: supabase/migrations/20260929000000_notifications.sql:53] |
| `venture_completed` | Notification · notify@ | [VERIFY: supabase/migrations/20260929000000_notifications.sql:54] |
| `venture_abandoned` | Notification · notify@ | [VERIFY: supabase/migrations/20260929000000_notifications.sql:55] |
| `comment_received` | Notification · notify@ | [VERIFY: supabase/migrations/20260929020000_comments_links.sql:151] |
| `comment_reply` | Notification · notify@ | [VERIFY: supabase/migrations/20260929020000_comments_links.sql:152] |
| `comment_mention` | Notification · notify@ | [VERIFY: supabase/migrations/20260929020000_comments_links.sql:153] |
| `chat_message` | Notification · notify@ | [VERIFY: supabase/migrations/20260929050000_chat.sql:174] |
| `content_removed` | Authentication/security · security@ | [VERIFY: supabase/migrations/20260929070000_reports.sql:146] |
| `moderation_warning` | Authentication/security · security@ | [VERIFY: supabase/migrations/20260929070000_reports.sql:147] |
| `endorsement_received` | Notification · notify@ | [VERIFY: supabase/migrations/20261001000000_endorsements.sql:60] |
| `credential_reviewed` | Notification · notify@ | [VERIFY: supabase/migrations/20261003000000_credentials.sql:178] |
| `code_check_ready` | Notification · notify@ | [VERIFY: supabase/migrations/20261004000000_code_checks.sql:152] |
| `code_check_graded` | Notification · notify@ | [VERIFY: supabase/migrations/20261004000000_code_checks.sql:153] |
| `cv_revoked` | Notification · notify@ | [VERIFY: supabase/migrations/20261009000000_cv_control.sql:651] |
| `deletion_requested` | Authentication/security · security@ | [VERIFY: supabase/migrations/20261010000000_student_portal.sql:254] |
| `deletion_cancelled` | Authentication/security · security@ | [VERIFY: supabase/migrations/20261010000000_student_portal.sql:255] |
| `feedback_update` | Notification · notify@ | [VERIFY: supabase/migrations/20261010000000_student_portal.sql:832] |
| `org_decided` | Notification · notify@ | [VERIFY: supabase/migrations/20261013000000_recruiter_orgs.sql:451] |
| `contact_request` | Notification · notify@ | [VERIFY: supabase/migrations/20261014000000_recruiter_talent.sql:1212] |
| `saved_search_matches` | Notification · notify@ | [VERIFY: supabase/migrations/20261014000000_recruiter_talent.sql:1215] |
| `job_application_received` | Notification · notify@ | [VERIFY: supabase/migrations/20261015000000_recruiter_jobs.sql:122] |
| `application_stage` | Notification · notify@ | [VERIFY: supabase/migrations/20261015000000_recruiter_jobs.sql:123] |
| `job_invite` | Notification · notify@ | [VERIFY: supabase/migrations/20261015000000_recruiter_jobs.sql:124] |
| `hire_outcome_due` | Notification · notify@ | [VERIFY: supabase/migrations/20261015000000_recruiter_jobs.sql:125] |
| `competition_decided` | Notification · notify@ | [VERIFY: supabase/migrations/20261015000000_recruiter_jobs.sql:126] |
| `competition_result` | Notification · notify@ | [VERIFY: supabase/migrations/20261015000000_recruiter_jobs.sql:128] |
| `uni_claim_decided` | Notification · notify@ | [VERIFY: supabase/migrations/20261017000000_uni_core.sql:443] |
| `uni_award` | Notification · notify@ | [VERIFY: supabase/migrations/20261018000000_uni_ecosphere.sql:358] |
| `uni_announcement` | Notification · notify@ | [VERIFY: supabase/migrations/20261019000000_uni_comms.sql:256] |
| `content_hidden_by_university` | Authentication/security · security@ | [VERIFY: supabase/migrations/20261019000000_uni_comms.sql:259] |
| `fair_invite` | Notification · notify@ | [VERIFY: supabase/migrations/20261020000000_uni_fairs.sql:63] |
| `billing_payment_succeeded` | Notification · notify@ | [VERIFY: supabase/migrations/20261024000000_billing_lifecycle.sql:382] |
| `billing_payment_failed` | Notification · notify@ | [VERIFY: supabase/migrations/20261024000000_billing_lifecycle.sql:383] |
| `billing_trial_ended` | Notification · notify@ | [VERIFY: supabase/migrations/20261024000000_billing_lifecycle.sql:385] |
| `billing_renewal_reminder` | Notification · notify@ | [VERIFY: supabase/migrations/20261024000000_billing_lifecycle.sql:386] |
| `billing_subscription_ended` | Notification · notify@ | [VERIFY: supabase/migrations/20261024000000_billing_lifecycle.sql:387] |
| `billing_invoice_issued` | Notification · notify@ | [VERIFY: supabase/migrations/20261024000000_billing_lifecycle.sql:388] |
| `billing_hire_fee` | Notification · notify@ | [VERIFY: supabase/migrations/20261024000000_billing_lifecycle.sql:389] |
| `billing_hire_fee_overdue` | Notification · notify@ | [VERIFY: supabase/migrations/20261024000000_billing_lifecycle.sql:390] |
| `billing_refund` | Notification · notify@ | [VERIFY: supabase/migrations/20261024000000_billing_lifecycle.sql:391] |
| `billing_limits_applied` | Notification · notify@ | [VERIFY: supabase/migrations/20261024000000_billing_lifecycle.sql:393] |
| `billing_sponsorship_started` | Notification · notify@ | [VERIFY: supabase/migrations/20261024000000_billing_lifecycle.sql:394] |
| `billing_sponsorship_ending` | Notification · notify@ | [VERIFY: supabase/migrations/20261024000000_billing_lifecycle.sql:395] |
| `account_restricted` | Authentication/security · security@ | [VERIFY: supabase/migrations/20261027000000_sanctions_appeals.sql:145] |
| `restriction_lifted` | Authentication/security · security@ | [VERIFY: supabase/migrations/20261027000000_sanctions_appeals.sql:146] |
| `org_sanctioned` | Authentication/security · security@ | [VERIFY: supabase/migrations/20261027000000_sanctions_appeals.sql:147] |
| `appeal_decided` | Authentication/security · security@ | [VERIFY: supabase/migrations/20261027000000_sanctions_appeals.sql:148] |
| `account_viewed` | Authentication/security · security@ | [VERIFY: supabase/migrations/20261028000000_users_view_as.sql:10] |
