# Notify: function tracking sheet (W9)

Date: 2026-11-28. Branch: `azure`. Source: `apps/web/supabase/migrations/` (`20260929000000_notifications.sql`, `20260930000000_phase3_answers.sql`, `20261105000001_brevo_email_delivery.sql`, `20261114000003_share_reach_push.sql`, and every later migration that inserts into `notification_types` or `notification_categories` or calls `private.notify()`), each function at its latest definition on the local stack; the Edge Function logic in `supabase/functions/_shared/notify/`, `_shared/email/` and `notify-worker`.

Every SQL function the `notify` service inherits, in one of the five bins from "How each function is ported" in `docs/azure/prd.md`, with its app caller and what replaces it. The list was made by rule: every function in `public` or `private` named for notifications, push, digests, email sends or activity, and every function whose latest definition calls `private.notify()` or `private.notify_society_officers()` (116), read from the local stack's catalogue (`pg_proc`), not from the migration text.

**Boundary.** Notify owns notifications (written only by notify, from events), the 20 categories and 132 types (seeded as the stack holds them, including those whose producers are W10 to W12 or the faculty portal), email and push preferences, push subscriptions, activity for the digest, the email and push queues, the daily cap's send log and the Brevo delivery ledger. Names, usernames and photos are people's (read at read time); titles, excerpts and reasons are each owner's, read once per consumer batch and snapshotted into `data`, as the stack snapshotted them.

## Edge Function logic replaced

| Source | What it did | Replaced by |
| --- | --- | --- |
| `_shared/notify/describe.ts` | the wording of every notice (text, link, subject) | `src/domain/describe.ts`, verbatim (`test/unit/wording.test.ts` holds it equal to web's copy) |
| `_shared/notify/email.ts` | instant, digest, university launch, Record claim and ops alert templates | `src/domain/email.ts`, verbatim; the teacher digest template is not ported (faculty portal deferred) |
| `_shared/email/brevo.ts` | Brevo request, sender by category, response handling | `src/domain/mail.ts`: the same senders and security types; the request is Azure Communication Services' `emails:send` with the managed identity (decisions 2026-11-28) |
| `_shared/email/delivery.ts` | delivery identity, claim and finish around one send | `sendQueuedEmail` in `src/store/email.ts` (node:crypto; same keys and UUIDs) |
| `_shared/notify/worker.ts` `runNotifyWorker` | drains `notification_emails`: daily cap 60, ops alerts past it, park until 00:05 UTC, stale instant emails, digests grouped by category | `runEmailDrain` (`src/store/email.ts`), the `email-drain` job |
| `_shared/notify/worker.ts` `buildTeacherDigest` | the faculty weekly email | not built: deferred with the faculty portal |
| `_shared/notify/push.ts` `runPushWorker` | drains `notification_push`: one Web Push per device, 404/410 removes, five failures remove, stale after 6 hours | `runPushDrain` (`src/store/push.ts`), the `push-drain` job |
| `_shared/notify/push.ts` `loadVapidKeys` | Vault `vapid_public_key`, `vapid_private_key`, `vapid_subject` | Key Vault `notify-vapid-keys` (JSON), read at start (`parseVapidSecret`) |
| `_shared/notify/webpush.ts` | VAPID (RFC 8292), aes128gcm (RFC 8291, 8188), the push-service allowlist | `src/domain/webpush.ts`, verbatim but for two Node type names |
| `notify-worker/index.ts` | the Edge Function wrapper (bearer secret, env) | deleted: jobs inside the warm service |

## Bin 1: reads called by the app

| Function | Caller (web) | Becomes |
| --- | --- | --- |
| `my_notifications(before, limit)` | `/notifications`, the bell | `MyNotifications` (actor cards and visibility from people's ProfileCards and Relations) |
| `unread_notification_count()` | the bell, the nav badge | `UnreadCount`; the badge itself is `badge.count_changed` to people's shell |
| `my_notification_settings()` | `/settings/notifications` | `MySettings` |
| `my_push_settings()` | `components/notifications/push-settings.tsx` | `MyPushSettings` |
| `push_public_key()` | the push offer | `PushPublicKey` (from the secret; no database trip) |

## Bin 2: commands called by the app

| Function | Caller (web) | Becomes |
| --- | --- | --- |
| `mark_notification_read(id)` | the bell | `MarkRead` (publishes the new count) |
| `mark_all_notifications_read()` | the bell | `MarkAllRead` |
| `set_notification_pref(category, channel)` | `/settings/notifications` | `SetPref` |
| `touch_activity()` | the signed-in layout | `TouchActivity` |
| `set_push_pref(category, on)` | push settings | `SetPushPref` |
| `save_push_subscription(endpoint, p256dh, auth, user_agent)` | `lib/pwa/client.ts` | `SavePushSubscription` (reply not kept) |
| `delete_push_subscription(endpoint)` | push settings | `DeletePushSubscription` (reply not kept) |

## Bin 3: triggers and internal helpers

| Function | Becomes |
| --- | --- |
| `private.notify(user, actor, type, entity_type, entity_id, data)` | `notify()` in `src/store/write.ts`: skip self, a deleted account and a block either way; queue instant email and push |
| `private.notify_society_officers(...)` | the officers list from community's NoticeFacts, then `notify()` per officer |
| `private.email_channel_for(user, type)` | `CHANNEL` (`src/store/db.ts`), billing always instant |
| `private.push_on(user, type)` | `PUSHED` plus the device check |
| `private.is_push_endpoint(endpoint)` | `isPushEndpoint` (`src/domain/webpush.ts`) |
| `private.venture_data(venture)` | `venture()` in `src/domain/notices.ts` from work's NoticeFacts |
| `private.claim_brevo_email`, `private.finish_brevo_email` | `claimDelivery` and the update in `sendQueuedEmail` |
| `private.university_launch_email(request)`, `private.queue_university_launch(university)` | people's `ClaimLaunchRecipients` (marks `notified_at`), notify's `university-launch` job, from `university.domains_changed {live_at}` |
| `private.record_claim_email(claim)` | `record.claim_held`; the address from community's RecordFacts when sent |
| `private.teacher_digest_data`, `private.queue_teacher_digests` | not built (faculty portal deferred) |
| `private.record_brevo_email_signal` | trust (W10, alerts), from Azure's delivery events instead of Brevo's webhook |

The 116 functions that call `private.notify()`, by the event that now feeds notify (W9) or the workstream that owes the event:

| Function | Types | Bin | Event now | Owner |
| --- | --- | --- | --- | --- |
| `accept_org_invite` | `org_member_joined` | Trigger or helper → event handler | market event, when W11 publishes it | W11 market |
| `accept_uni_invite` | `uni_admin_joined` | Trigger or helper → event handler | market event, when W11 publishes it | W11 market |
| `add_comment` | `comment_mention`, `comment_received`, `comment_reply` | Trigger or helper → event handler | content `comment.created` (excerpt: content CommentExcerpts) | W9 |
| `add_event_staff` | `event_staff_added` | Trigger or helper → event handler | community `event.staff_changed` | W9 |
| `answer_society_invite` | `society_invite_answered` | Trigger or helper → event handler | community `society.invite_changed {accepted|declined}` | W9 |
| `apply_induction` | `induction_applied` | Trigger or helper → event handler | community `induction_application.changed {pending}` | W9 |
| `apply_org_limits` | `billing_limits_applied` | Trigger or helper → event handler | billing event, when W12 publishes it | W12 billing |
| `apply_to_job` | `job_application_received` | Trigger or helper → event handler | market event, when W11 publishes it | W11 market |
| `ask_hire_outcomes` | `hire_outcome_due` | Trigger or helper → event handler | market event, when W11 publishes it | W11 market |
| `award_badge` | `uni_award` | Trigger or helper → event handler | market event, when W11 publishes it | W11 market |
| `billing_apply_event` | `billing_payment_failed`, `billing_payment_succeeded`, `billing_refund` | Trigger or helper → event handler | billing event, when W12 publishes it | W12 billing |
| `billing_tick` | `billing_hire_fee_overdue`, `billing_renewal_reminder` | Trigger or helper → event handler | billing event, when W12 publishes it | W12 billing |
| `cancel_account_deletion` | `deletion_cancelled` | Trigger or helper → event handler | trust or identity event, when W10 publishes it | W10 trust |
| `cancel_society_event` | `event_cancelled` | Trigger or helper → event handler | community `event.updated {cancelled}` | W9 |
| `close_review_request` | `review_expired` | Trigger or helper → event handler | faculty event, when the faculty portal is built | faculty portal (deferred) |
| `close_swap` | `swap_closed` | Trigger or helper → event handler | work `swap.changed {closed}` | W9 |
| `code_check_prepared` | `code_check_ready` | Trigger or helper → event handler | work `code_check.changed {ready}` | W9 |
| `code_checks_tick` | `code_check_graded` | Trigger or helper → event handler | work `code_check.changed {failed}` | W9 |
| `complete_task` | `task_done` | Trigger or helper → event handler | work `task.completed` | W9 |
| `confirm_payment_method` | `payment_details_confirmed` | Trigger or helper → event handler | community `payment_method.changed {active|rejected}` | W9 |
| `confirm_refund` | `refund_answered` | Trigger or helper → event handler | community `payment.changed {refund_received|refund_disputed}` | W9 |
| `confirm_swap_session` | `swap_note` | Trigger or helper → event handler | work `swap.changed {note_written}` | W9 |
| `create_post` | `society_post` | Trigger or helper → event handler | content `post.created` (audience: community NoticeFacts) | W9 |
| `credentials_daily` | `credential_expired` | Trigger or helper → event handler | work `credential.changed {expired}` | W9 |
| `cv_refreshed_notice` | `cv_refreshed` | Trigger or helper → event handler | credentials `cv.issued {monthly}` | W9 |
| `decide_appeal` | `appeal_decided` | Trigger or helper → event handler | trust or identity event, when W10 publishes it | W10 trust |
| `decide_final_year_batch` | `uni_batch_decided` | Trigger or helper → event handler | market event, when W11 publishes it | W11 market |
| `decide_induction_application` | `induction_decided` | Trigger or helper → event handler | community `induction_application.changed {accepted|declined}` | W9 |
| `decide_join_request` | `society_joined` | Trigger or helper → event handler | community `society.join_changed {accepted}` | W9 |
| `decide_org` | `org_decided` | Trigger or helper → event handler | market event, when W11 publishes it | W11 market |
| `decide_registration` | `event_decided` | Trigger or helper → event handler | community `event.registered {decided}` | W9 |
| `decide_society` | `society_decided` | Trigger or helper → event handler | community `society.status_changed` | W9 |
| `decide_uni_claim` | `uni_claim_decided` | Trigger or helper → event handler | market event, when W11 publishes it | W11 market |
| `decide_uni_domain` | `uni_domain_decided` | Trigger or helper → event handler | market event, when W11 publishes it | W11 market |
| `decline_record_mistake` | `record_entry`, `record_mistake_declined` | Trigger or helper → event handler | credentials `record.mistake_declined` (note: credentials NoticeFacts) | W9 |
| `end_supervision` | `supervision_answered` | Trigger or helper → event handler | faculty event, when the faculty portal is built | faculty portal (deferred) |
| `endorse` | `endorsement_received` | Trigger or helper → event handler | work `endorsement.given` | W9 |
| `event_tick` | `event_reminder` | Trigger or helper → event handler | community `event.reminder_due` | W9 |
| `event_tick_payments` | `hold_expired` | Trigger or helper → event handler | community `event.registered {hold_expired}` | W9 |
| `expire_subscription` | `billing_subscription_ended`, `billing_trial_ended` | Trigger or helper → event handler | billing event, when W12 publishes it | W12 billing |
| `fair_call_next` | `fair_called` | Trigger or helper → event handler | market event, when W11 publishes it | W11 market |
| `finish_competition` | `competition_result` | Trigger or helper → event handler | market event, when W11 publishes it | W11 market |
| `finish_hackathon` | `competition_result` | Trigger or helper → event handler | market event, when W11 publishes it | W11 market |
| `grade_code_check` | `code_check_graded` | Trigger or helper → event handler | work `code_check.changed {passed|failed}` | W9 |
| `invite_officer` | `society_invite` | Trigger or helper → event handler | community `society.invite_changed {pending}` | W9 |
| `invite_supervisor` | `supervision_requested` | Trigger or helper → event handler | faculty event, when the faculty portal is built | faculty portal (deferred) |
| `invite_team_member` | `team_invite` | Trigger or helper → event handler | market event, when W11 publishes it | W11 market |
| `invite_to_apply` | `job_invite` | Trigger or helper → event handler | market event, when W11 publishes it | W11 market |
| `issue_record_entry` | `record_confirm`, `record_entry` | Trigger or helper → event handler | credentials `record.awaiting` (record_confirm); its record_entry via `record.sealed` | W9 |
| `join_society` | `society_join_request` | Trigger or helper → event handler | community `society.join_changed {requested}` | W9 |
| `lift_sanction_row` | `restriction_lifted` | Trigger or helper → event handler | trust or identity event, when W10 publishes it | W10 trust |
| `mark_refund_sent` | `refund_sent` | Trigger or helper → event handler | community `payment.changed {refund_sent}` | W9 |
| `message_registrants` | `event_message` | Trigger or helper → event handler | community `event.message_sent` (body: community NoticeFacts) | W9 |
| `move_application_one` | `application_stage` | Trigger or helper → event handler | market event, when W11 publishes it | W11 market |
| `notify_applications` | `application_decided`, `application_received`, `application_withdrawn` | Trigger or helper → event handler | work `application.changed` | W9 |
| `notify_chat_message` | `chat_message` | Trigger or helper → event handler | messaging `message.sent` (excerpt: messaging MessageExcerpts); `thread.read` marks read; `message.deleted {undone_share}` takes back | W9 |
| `notify_friend_requests` | `friend_accepted`, `friend_request` | Trigger or helper → event handler | people `friend_request.changed` | W9 |
| `notify_invites` | `invite_answered`, `invite_received` | Trigger or helper → event handler | work `venture.invite_changed` | W9 |
| `notify_member_removed` | `member_left`, `member_removed` | Trigger or helper → event handler | work `group.member_changed {kind venture, member false}` | W9 |
| `notify_teacher_decided` | `teacher_decided` | Trigger or helper → event handler | faculty event, when the faculty portal is built | faculty portal (deferred) |
| `notify_venture_changes` | `ownership_transferred`, `venture_abandoned`, `venture_completed` | Trigger or helper → event handler | work `venture.updated` (ownership, abandoned) and `venture.completed` | W9 |
| `offer_handover` | `society_invite` | Trigger or helper → event handler | community `society.invite_changed {pending, handover}` | W9 |
| `offer_task_peers` | `task_review_offer` | Trigger or helper → event handler | work `task_review.changed {offered}` | W9 |
| `on_hire_recorded` | `billing_hire_fee` | Trigger or helper → event handler | billing event, when W12 publishes it | W12 billing |
| `ops_assign_uni_owner` | `uni_claim_decided` | Trigger or helper → event handler | market event, when W11 publishes it | W11 market |
| `ops_issue_licence` | `billing_invoice_issued` | Trigger or helper → event handler | billing event, when W12 publishes it | W12 billing |
| `ops_remove_uni_question` | `uni_question_removed` | Trigger or helper → event handler | market event, when W11 publishes it | W11 market |
| `ops_reset_mfa` | `mfa_reset` | Trigger or helper → event handler | trust or identity event, when W10 publishes it | W10 trust |
| `ops_review_competition` | `competition_decided` | Trigger or helper → event handler | market event, when W11 publishes it | W11 market |
| `ops_revoke_cv` | `cv_revoked` | Trigger or helper → event handler | credentials `cv.revoked {staff}` | W9 |
| `ops_view_as_start` | `account_viewed` | Trigger or helper → event handler | trust or identity event, when W10 publishes it | W10 trust |
| `post_supervisor_comment` | `supervisor_comment` | Trigger or helper → event handler | faculty event, when the faculty portal is built | faculty portal (deferred) |
| `promote_waitlist` | `event_promoted` | Trigger or helper → event handler | community `event.registered {promoted}` | W9 |
| `prompt_endorsements` | `endorse_teammates` | Trigger or helper → event handler | work `venture.completed` | W9 |
| `propose_payment_method` | `payment_details_proposed` | Trigger or helper → event handler | community `payment_method.changed {proposed}` | W9 |
| `propose_swap_session` | `swap_session_proposed` | Trigger or helper → event handler | work `swap.changed {session_proposed}` | W9 |
| `publish_event` | `event_published` | Trigger or helper → event handler | community `event.updated {published}` | W9 |
| `publish_induction_round` | `induction_published` | Trigger or helper → event handler | community `induction.changed {open}` | W9 |
| `raise_payment_issue` | `payment_review` | Trigger or helper → event handler | community `payment.changed {issue}` | W9 |
| `record_sign_commit` | `record_entry` | Trigger or helper → event handler | credentials `record.sealed` | W9 |
| `register_event` | `event_registration` | Trigger or helper → event handler | community `event.registered {registered}` | W9 |
| `registration_cancelled_payment` | `refund_requested` | Trigger or helper → event handler | community `payment.changed {refund_requested}` | W9 |
| `report_record_mistake` | `record_entry`, `record_mistake` | Trigger or helper → event handler | credentials `record.mistake_reported` | W9 |
| `request_account_deletion` | `deletion_requested` | Trigger or helper → event handler | trust or identity event, when W10 publishes it | W10 trust |
| `request_review` | `review_requested` | Trigger or helper → event handler | faculty event, when the faculty portal is built | faculty portal (deferred) |
| `request_swap` | `swap_request` | Trigger or helper → event handler | work `swap.changed {requested}` | W9 |
| `resolve_case` | `content_removed`, `moderation_warning` | Trigger or helper → event handler | trust or identity event, when W10 publishes it | W10 trust |
| `respond_contact_request` | `contact_accepted`, `contact_declined`, `contact_request` | Trigger or helper → event handler | market event, when W11 publishes it | W11 market |
| `respond_feedback` | `feedback_update` | Trigger or helper → event handler | trust or identity event, when W10 publishes it | W10 trust |
| `respond_supervision` | `supervision_answered` | Trigger or helper → event handler | faculty event, when the faculty portal is built | faculty portal (deferred) |
| `respond_swap` | `swap_accepted`, `swap_declined` | Trigger or helper → event handler | work `swap.changed {accepted|declined}` | W9 |
| `respond_swap_session` | `swap_session_accepted` | Trigger or helper → event handler | work `swap.changed {session_accepted}` | W9 |
| `review_credential` | `credential_reviewed` | Trigger or helper → event handler | work `credential.changed {approved|rejected}` | W9 |
| `review_payment` | `payment_decided` | Trigger or helper → event handler | community `payment.changed {approved|rejected}` | W9 |
| `review_task` | `task_needs_changes` | Trigger or helper → event handler | work `task_review.changed {needs_changes}` | W9 |
| `revoke_record_entry` | `record_entry`, `record_revoked` | Trigger or helper → event handler | credentials `record.revoked {revoked, was_sealed}` | W9 |
| `run_saved_searches` | `saved_search_matches` | Trigger or helper → event handler | market event, when W11 publishes it | W11 market |
| `sanction_org` | `org_sanctioned` | Trigger or helper → event handler | trust or identity event, when W10 publishes it | W10 trust |
| `sanction_user` | `account_restricted` | Trigger or helper → event handler | trust or identity event, when W10 publishes it | W10 trust |
| `save_hackathon` | `hackathon_judge` | Trigger or helper → event handler | faculty event, when the faculty portal is built | faculty portal (deferred) |
| `save_society_event` | `event_changed`, `event_cohost` | Trigger or helper → event handler | community `event.updated {details}` and `event.cohost_changed {pending}` | W9 |
| `schedule_plan_change` | `billing_plan_changed` | Trigger or helper → event handler | billing event, when W12 publishes it | W12 billing |
| `send_contact_request` | `contact_request` | Trigger or helper → event handler | market event, when W11 publishes it | W11 market |
| `society_tick` | `induction_decided`, `term_ended` | Trigger or helper → event handler | community `society.term_changed {ended}` and `induction_application.changed {expired}` | W9 |
| `sponsorship_sync` | `billing_sponsorship_ending`, `billing_sponsorship_started` | Trigger or helper → event handler | billing event, when W12 publishes it | W12 billing |
| `start_trial` | `billing_trial_started` | Trigger or helper → event handler | billing event, when W12 publishes it | W12 billing |
| `start_venture_from_idea` | `supervision_requested` | Trigger or helper → event handler | faculty event, when the faculty portal is built | faculty portal (deferred) |
| `submit_receipt` | `payment_review` | Trigger or helper → event handler | community `payment.changed {submitted}` | W9 |
| `submit_review` | `review_received` | Trigger or helper → event handler | faculty event, when the faculty portal is built | faculty portal (deferred) |
| `supervisor_confirm_contribution` | `supervisor_confirmed` | Trigger or helper → event handler | faculty event, when the faculty portal is built | faculty portal (deferred) |
| `swap_tick` | `swap_declined`, `swap_session_ask`, `swap_session_reminder` | Trigger or helper → event handler | work `swap.changed {expired|session_reminder|session_ask}` | W9 |
| `teacher_endorse` | `endorsement_received` | Trigger or helper → event handler | faculty event, when the faculty portal is built | faculty portal (deferred) |
| `teacher_grade_code_check` | `code_check_graded` | Trigger or helper → event handler | faculty event, when the faculty portal is built | faculty portal (deferred) |
| `teacher_reminders` | `review_expired`, `review_reminder` | Trigger or helper → event handler | faculty event, when the faculty portal is built | faculty portal (deferred) |
| `uni_hide` | `content_hidden_by_university` | Trigger or helper → event handler | trust or identity event, when W10 publishes it | W10 trust |
| `university_hide_decided` | `content_restored` | Trigger or helper → event handler | trust or identity event, when W10 publishes it | W10 trust |

The one-off `ranking_formula` notice in `20261112000001_the_record.sql` (to every `ranking_scores` row) is the `formula-notice` job, started by trust's `config.changed {ranking.formula}` with a new version and paged through ranking's `ScoredStudents`.

## Bin 4: scheduled jobs

| pg_cron job | Becomes |
| --- | --- |
| `notify-worker` (`wake_notify_worker`, every minute) | `email-drain` and `push-drain` schedules (every minute) plus a run queued by each consumer batch that queues mail or push |
| `notification-digest` (`queue_notification_digests`, 13:07 UTC) | `notification-digest` schedule (`queueDigests`) |
| `purge-notifications` (03:23 UTC) | `purge-notifications` schedule (read after 90 days, unread after a year, sends after 60 days) |
| `teacher-digest` | not built (faculty portal deferred) |

## Bin 5: wrappers and plumbing (deleted)

The `public.*` security-invoker wrappers of every function above, the Vault secret `notify_worker_secret`, `wake_notify_worker`'s HTTP call, pgmq `notification_emails` and `notification_push` (now `notify.email_queue` and `notify.push_queue`), and the Realtime publication of `notifications` (now a `notification` and a `badge` message on the user's realtime topic).

## Golden cases

`packages/testing/test/notify.golden.test.ts` records into `test/golden/notify/`: the bell (`my_notifications`, counts, marking), preferences (`my_notification_settings`, `set_notification_pref` with refusals), push (`my_push_settings`, `set_push_pref`, `save_push_subscription` with each refusal, `delete_push_subscription`) and the notices the stack's triggers made for a friend request, a comment with a reply and a mention, and a chat message (collapse included). Replays: `services/notify/test/golden/`.
