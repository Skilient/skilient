-- notify: in-app notifications, email and push preferences, push subscriptions, the email and push queues, the
-- daily cap's send log, the Brevo delivery ledger, activity for the digest, and a copy of people's blocks (ported
-- from 20260929000000_notifications.sql, 20260930000000_phase3_answers.sql, 20261105000001_brevo_email_delivery.sql,
-- 20261114000003_share_reach_push.sql and every later migration that adds a type or a category). Forward-only.
-- Every table: row-level security enabled and forced, one policy for the owning role (docs/azure/prd.md,
-- "Layout"). No foreign keys to other services' data: user ids are plain uuids.

-- Categories group types; email preferences are set per category. push_default null: never pushed.
create table notify.categories (
  category text primary key check (category ~ '^[a-z_]{2,40}$'),
  label text not null,
  description text not null,
  position smallint not null,
  default_channel text not null check (default_channel in ('instant_email', 'digest', 'off')),
  -- Only these categories may email instantly (the email plan's daily budget; decisions.md 2026-09-28).
  allow_instant boolean not null default false,
  push_default boolean,
  check (default_channel <> 'instant_email' or allow_instant)
);

create table notify.types (
  type text primary key check (type ~ '^[a-z_]{2,40}$'),
  category text not null references notify.categories (category),
  -- Whether this type is ever emailed (instant or digest).
  emailed boolean not null default true,
  -- Whether this type is pushed (when its category's push choice is on).
  pushed boolean not null default false
);
create index types_category_idx on notify.types (category);

-- The catalogue as the stack holds it (every category and type, including those whose producers come later).
insert into notify.categories (category, label, description, position, default_channel, allow_instant, push_default) values
  ('friend_requests', 'Friend requests', 'Someone asks to be your friend.', 1, 'instant_email', true, null),
  ('applications', 'Applications', 'Applications to your ventures, and decisions on yours.', 2, 'instant_email', true, null),
  ('invites', 'Venture invites', 'An owner invites you to join their team.', 3, 'instant_email', true, null),
  ('ownership', 'Ownership transfers', 'A venture is handed over to you.', 4, 'instant_email', true, null),
  ('team', 'Your teams', 'People joining or leaving your ventures, and ventures completing.', 5, 'off', false, null),
  ('comments', 'Comments', 'Comments on your posts and replies to your comments.', 6, 'digest', false, null),
  ('mentions', 'Mentions', 'Someone mentions you with @username.', 7, 'digest', false, null),
  ('messages', 'Messages', 'New messages in your chats while you''re away.', 8, 'digest', false, true),
  ('account', 'Account and safety', 'Moderation decisions about your content and account.', 9, 'instant_email', true, null),
  ('feedback', 'Feedback replies', 'Skilient staff answer or update feedback you sent.', 10, 'digest', false, null),
  ('trust', 'Trust and ranking', 'Endorsements, credential and code-check results, and your tier.', 10, 'off', false, null),
  ('faculty', 'Faculty supervision and reviews', 'Supervisors, reviews and teacher updates. Teachers get one weekly digest instead of emails.', 11, 'off', false, null),
  ('contact_requests', 'Recruiter contact requests', 'A company asks to talk to you about a role.', 20, 'digest', true, null),
  ('job_updates', 'Job applications', 'Where your applications stand, and hires you were part of.', 21, 'digest', true, null),
  ('recruiting', 'Recruiting', 'Organisation decisions, answers to your requests and hiring tasks.', 22, 'digest', true, null),
  ('university', 'Your university', 'Announcements, events, awards and portal news from your university.', 23, 'digest', false, null),
  ('societies', 'Societies and events', 'Societies you follow or belong to, their posts and events, and your tickets.', 24, 'digest', true, true),
  ('record', 'Your Record', 'New entries on your Record, revocations, corrections and the ones you confirm as an officer.', 25, 'digest', true, true),
  ('growth', 'Paths, tasks and swaps', 'Proof tasks done or sent back, reviews asked of you, and your skill swaps.', 26, 'digest', true, true),
  ('billing', 'Billing', 'Receipts, invoices, failed payments, renewals and sponsorship. Always emailed; can''t be turned off.', 30, 'instant_email', true, null);

insert into notify.types (type, category, emailed, pushed) values
  ('account_restricted', 'account', true, false),
  ('account_viewed', 'account', true, false),
  ('appeal_decided', 'account', true, false),
  ('content_hidden_by_university', 'account', true, false),
  ('content_removed', 'account', true, false),
  ('content_restored', 'account', false, false),
  ('deletion_cancelled', 'account', true, false),
  ('deletion_requested', 'account', true, false),
  ('mfa_reset', 'account', false, false),
  ('moderation_warning', 'account', true, false),
  ('org_sanctioned', 'account', true, false),
  ('restriction_lifted', 'account', true, false),
  ('application_decided', 'applications', true, false),
  ('application_received', 'applications', true, false),
  ('application_withdrawn', 'applications', false, false),
  ('billing_hire_fee', 'billing', true, false),
  ('billing_hire_fee_overdue', 'billing', true, false),
  ('billing_invoice_issued', 'billing', true, false),
  ('billing_limits_applied', 'billing', true, false),
  ('billing_payment_failed', 'billing', true, false),
  ('billing_payment_succeeded', 'billing', true, false),
  ('billing_plan_changed', 'billing', false, false),
  ('billing_refund', 'billing', true, false),
  ('billing_renewal_reminder', 'billing', true, false),
  ('billing_sponsorship_ending', 'billing', true, false),
  ('billing_sponsorship_started', 'billing', true, false),
  ('billing_subscription_ended', 'billing', true, false),
  ('billing_trial_ended', 'billing', true, false),
  ('billing_trial_started', 'billing', false, false),
  ('comment_received', 'comments', true, false),
  ('comment_reply', 'comments', true, false),
  ('contact_request', 'contact_requests', true, false),
  ('hackathon_judge', 'faculty', false, false),
  ('review_expired', 'faculty', false, false),
  ('review_received', 'faculty', false, false),
  ('review_reminder', 'faculty', false, false),
  ('review_requested', 'faculty', false, false),
  ('supervision_answered', 'faculty', false, false),
  ('supervision_requested', 'faculty', false, false),
  ('supervisor_comment', 'faculty', false, false),
  ('supervisor_confirmed', 'faculty', false, false),
  ('teacher_decided', 'faculty', false, false),
  ('feedback_update', 'feedback', true, false),
  ('friend_accepted', 'friend_requests', false, false),
  ('friend_request', 'friend_requests', true, false),
  ('swap_accepted', 'growth', true, false),
  ('swap_closed', 'growth', false, false),
  ('swap_declined', 'growth', false, false),
  ('swap_note', 'growth', false, false),
  ('swap_request', 'growth', true, true),
  ('swap_session_accepted', 'growth', false, false),
  ('swap_session_ask', 'growth', true, false),
  ('swap_session_proposed', 'growth', true, false),
  ('swap_session_reminder', 'growth', true, true),
  ('task_done', 'growth', false, false),
  ('task_needs_changes', 'growth', true, false),
  ('task_review_offer', 'growth', true, false),
  ('invite_answered', 'invites', false, false),
  ('invite_received', 'invites', true, false),
  ('application_stage', 'job_updates', true, false),
  ('competition_result', 'job_updates', true, false),
  ('job_invite', 'job_updates', true, false),
  ('team_invite', 'job_updates', false, false),
  ('comment_mention', 'mentions', true, false),
  ('chat_message', 'messages', true, true),
  ('ownership_transferred', 'ownership', true, false),
  ('ranking_formula', 'record', false, false),
  ('record_confirm', 'record', true, false),
  ('record_entry', 'record', false, true),
  ('record_mistake', 'record', true, false),
  ('record_mistake_declined', 'record', false, false),
  ('record_revoked', 'record', true, false),
  ('competition_decided', 'recruiting', true, false),
  ('contact_accepted', 'recruiting', false, false),
  ('contact_declined', 'recruiting', false, false),
  ('fair_invite', 'recruiting', true, false),
  ('hire_outcome_due', 'recruiting', true, false),
  ('job_application_received', 'recruiting', true, false),
  ('org_decided', 'recruiting', true, false),
  ('org_member_joined', 'recruiting', false, false),
  ('org_spam_review', 'recruiting', false, false),
  ('saved_search_matches', 'recruiting', true, false),
  ('event_cancelled', 'societies', true, true),
  ('event_changed', 'societies', true, true),
  ('event_cohost', 'societies', false, false),
  ('event_decided', 'societies', true, false),
  ('event_message', 'societies', true, false),
  ('event_promoted', 'societies', true, false),
  ('event_published', 'societies', false, false),
  ('event_registration', 'societies', true, false),
  ('event_reminder', 'societies', true, true),
  ('event_staff_added', 'societies', false, false),
  ('hold_expired', 'societies', true, false),
  ('induction_applied', 'societies', false, false),
  ('induction_decided', 'societies', true, true),
  ('induction_published', 'societies', false, false),
  ('payment_decided', 'societies', true, false),
  ('payment_details_confirmed', 'societies', true, false),
  ('payment_details_proposed', 'societies', true, false),
  ('payment_review', 'societies', false, false),
  ('refund_answered', 'societies', false, false),
  ('refund_requested', 'societies', true, false),
  ('refund_sent', 'societies', true, false),
  ('society_decided', 'societies', true, false),
  ('society_invite', 'societies', true, false),
  ('society_invite_answered', 'societies', false, false),
  ('society_join_request', 'societies', false, false),
  ('society_joined', 'societies', false, false),
  ('society_post', 'societies', false, false),
  ('term_ended', 'societies', true, false),
  ('member_left', 'team', true, false),
  ('member_removed', 'team', true, false),
  ('venture_abandoned', 'team', true, false),
  ('venture_completed', 'team', true, false),
  ('code_check_graded', 'trust', true, false),
  ('code_check_ready', 'trust', true, false),
  ('credential_expired', 'trust', false, false),
  ('credential_reviewed', 'trust', true, false),
  ('cv_refreshed', 'trust', false, false),
  ('cv_revoked', 'trust', true, false),
  ('endorse_teammates', 'trust', false, false),
  ('endorsement_received', 'trust', true, false),
  ('fair_called', 'university', false, false),
  ('uni_admin_joined', 'university', false, false),
  ('uni_announcement', 'university', true, false),
  ('uni_award', 'university', true, false),
  ('uni_batch_decided', 'university', false, false),
  ('uni_claim_decided', 'university', true, false),
  ('uni_domain_decided', 'university', false, false),
  ('uni_event_cancelled', 'university', false, false),
  ('uni_event_reminder', 'university', false, false),
  ('uni_question_removed', 'university', false, false);

-- Notifications: written only by notify's consumers and jobs. data is the snapshot the wording reads.
create table notify.notifications (
  id uuid primary key,
  user_id uuid not null,
  actor_id uuid,
  type text not null references notify.types (type),
  entity_type text not null check (char_length(entity_type) between 1 and 40),
  entity_id uuid not null,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (actor_id is null or actor_id <> user_id)
);
create index notifications_user_created_idx on notify.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on notify.notifications (user_id) where read_at is null;
create index notifications_actor_idx on notify.notifications (actor_id);
create index notifications_entity_idx on notify.notifications (entity_type, entity_id);
create index notifications_created_idx on notify.notifications (created_at);

-- Email channel per category; a missing row means the category default.
create table notify.prefs (
  user_id uuid not null,
  category text not null references notify.categories (category),
  channel text not null check (channel in ('instant_email', 'digest', 'off')),
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

-- Push choice per category; a missing row means the category's push_default.
create table notify.push_prefs (
  user_id uuid not null,
  category text not null references notify.categories (category),
  push boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

-- One row per browser subscription; endpoints only on the browsers' push services (src/domain/webpush.ts).
create table notify.push_subscriptions (
  id uuid primary key,
  user_id uuid not null,
  endpoint text not null unique check (char_length(endpoint) <= 1000),
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{80,100}$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{16,30}$'),
  user_agent text check (user_agent is null or char_length(user_agent) <= 200),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  failures smallint not null default 0
);
create index push_subscriptions_user_idx on notify.push_subscriptions (user_id);

-- Last activity (one write an hour) and last digest: the digest goes only to people with unread digest notices
-- who weren't active for 24 hours.
create table notify.activity (
  user_id uuid primary key,
  last_active_at timestamptz not null default now(),
  last_digest_at timestamptz
);

-- People's blocks (block.changed): no notice between the two, and none shown.
create table notify.blocks (
  blocker_id uuid not null,
  blocked_id uuid not null,
  primary key (blocker_id, blocked_id)
);
create index blocks_blocked_idx on notify.blocks (blocked_id);

-- Emails waiting to go (pgmq notification_emails on the stack). payload holds ids; a launch email and an ops alert
-- hold their address until the row is deleted (sent or given up).
create table notify.email_queue (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('instant', 'digest', 'university_launch', 'record_claim', 'ops_alert')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  enqueued_at timestamptz not null default now(),
  not_before timestamptz not null default now(),
  attempts smallint not null default 0
);
create index email_queue_due_idx on notify.email_queue (not_before);

-- Pushes waiting to go (pgmq notification_push).
create table notify.push_queue (
  id bigint generated always as identity primary key,
  notification_id uuid not null,
  enqueued_at timestamptz not null default now(),
  not_before timestamptz not null default now(),
  attempts smallint not null default 0
);
create index push_queue_due_idx on notify.push_queue (not_before);

-- Every notification email sent, for the daily cap (60 a UTC day; ops alerts don't count).
create table notify.email_sends (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('instant', 'digest')),
  user_id uuid,
  notification_id uuid,
  provider_message_id text,
  send_key text unique,
  sent_at timestamptz not null default now()
);
create index email_sends_sent_at_idx on notify.email_sends (sent_at);
create index email_sends_user_idx on notify.email_sends (user_id);
create index email_sends_notification_idx on notify.email_sends (notification_id);

-- The email delivery ledger: one row per send key (a hash; no address or content), so a retried send is never
-- sent twice (claim_brevo_email and finish_brevo_email).
create table notify.deliveries (
  send_key text primary key check (send_key ~ '^[0-9a-f]{64}$'),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  state text not null check (state in ('pending', 'accepted', 'retryable', 'failed', 'uncertain')),
  first_attempt_at timestamptz not null default now(),
  lease_until timestamptz not null default now() + interval '2 minutes',
  message_id text
);
create index deliveries_first_attempt_idx on notify.deliveries (first_attempt_at);

-- Row-level security: default deny, one policy for the owning role; a grant for every statement notify makes.
alter table notify.categories enable row level security;
alter table notify.categories force row level security;
create policy categories_owner on notify.categories for all to svc_notify using (true) with check (true);
grant select on notify.categories to svc_notify;

alter table notify.types enable row level security;
alter table notify.types force row level security;
create policy types_owner on notify.types for all to svc_notify using (true) with check (true);
grant select on notify.types to svc_notify;

alter table notify.notifications enable row level security;
alter table notify.notifications force row level security;
create policy notifications_owner on notify.notifications for all to svc_notify using (true) with check (true);
grant select, insert, update, delete on notify.notifications to svc_notify;

alter table notify.prefs enable row level security;
alter table notify.prefs force row level security;
create policy prefs_owner on notify.prefs for all to svc_notify using (true) with check (true);
grant select, insert, update, delete on notify.prefs to svc_notify;

alter table notify.push_prefs enable row level security;
alter table notify.push_prefs force row level security;
create policy push_prefs_owner on notify.push_prefs for all to svc_notify using (true) with check (true);
grant select, insert, update, delete on notify.push_prefs to svc_notify;

alter table notify.push_subscriptions enable row level security;
alter table notify.push_subscriptions force row level security;
create policy push_subscriptions_owner on notify.push_subscriptions for all to svc_notify using (true) with check (true);
grant select, insert, update, delete on notify.push_subscriptions to svc_notify;

alter table notify.activity enable row level security;
alter table notify.activity force row level security;
create policy activity_owner on notify.activity for all to svc_notify using (true) with check (true);
grant select, insert, update, delete on notify.activity to svc_notify;

alter table notify.blocks enable row level security;
alter table notify.blocks force row level security;
create policy blocks_owner on notify.blocks for all to svc_notify using (true) with check (true);
grant select, insert, delete on notify.blocks to svc_notify;

alter table notify.email_queue enable row level security;
alter table notify.email_queue force row level security;
create policy email_queue_owner on notify.email_queue for all to svc_notify using (true) with check (true);
grant select, insert, update, delete on notify.email_queue to svc_notify;

alter table notify.push_queue enable row level security;
alter table notify.push_queue force row level security;
create policy push_queue_owner on notify.push_queue for all to svc_notify using (true) with check (true);
grant select, insert, update, delete on notify.push_queue to svc_notify;

alter table notify.email_sends enable row level security;
alter table notify.email_sends force row level security;
create policy email_sends_owner on notify.email_sends for all to svc_notify using (true) with check (true);
grant select, insert, update, delete on notify.email_sends to svc_notify;

alter table notify.deliveries enable row level security;
alter table notify.deliveries force row level security;
create policy deliveries_owner on notify.deliveries for all to svc_notify using (true) with check (true);
grant select, insert, update, delete on notify.deliveries to svc_notify;
