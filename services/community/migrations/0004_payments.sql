-- community: paid tickets (PRD 5.31 "Paid tickets"), ported from apps/web/supabase/migrations/20261111000003_paid_tickets.sql.
-- The student pays the society directly and uploads the receipt; an officer confirms it. Skilient never handles
-- ticket money. A change to the society's payment details takes effect only when a second officer confirms it
-- (society_audit_log keeps before and after). Disputes go to trust as payment.disputed (W10); receipts are
-- media's files (W9). Forward-only.

create table community.society_payment_methods (
  id uuid primary key,
  society_id uuid not null references community.societies (id) on delete cascade,
  action text not null default 'add' check (action in ('add', 'replace', 'remove')),
  replaces_id uuid references community.society_payment_methods (id) on delete set null,
  kind text check (kind in ('bank', 'jazzcash', 'easypaisa')),
  bank_name text check (bank_name is null or char_length(btrim(bank_name)) between 2 and 60),
  account_title text check (account_title is null or char_length(btrim(account_title)) between 2 and 80),
  account_number text check (account_number is null or account_number ~ '^[A-Z0-9 -]{6,34}$'),
  status text not null default 'proposed' check (status in ('proposed', 'active', 'rejected', 'ended')),
  proposed_by uuid,
  proposed_at timestamptz not null default now(),
  confirmed_by uuid,
  confirmed_at timestamptz,
  effective_at timestamptz,
  ended_at timestamptz,
  check (action = 'remove' or (kind is not null and account_title is not null and account_number is not null
                               and (kind <> 'bank' or bank_name is not null))),
  check (action = 'add' or replaces_id is not null),
  check (confirmed_by is null or confirmed_by is distinct from proposed_by)
);
create index society_payment_methods_society_idx on community.society_payment_methods (society_id, status);

create table community.society_audit_log (
  id bigint generated always as identity primary key,
  society_id uuid not null references community.societies (id) on delete cascade,
  actor_id uuid,
  action text not null check (char_length(action) between 3 and 60),
  before jsonb not null default '{}',
  after jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index society_audit_log_society_idx on community.society_audit_log (society_id, created_at desc);

create table community.event_payments (
  id uuid primary key,
  registration_id uuid not null unique references community.event_registrations (id) on delete cascade,
  event_id uuid not null references community.events (id) on delete cascade,
  society_id uuid not null references community.societies (id) on delete cascade,
  user_id uuid not null,
  amount_pkr integer not null check (amount_pkr between 1 and 1000000),
  reference_code text not null unique check (reference_code ~ '^SKL-[A-Z0-9]{4}$'),
  receipt_path text check (receipt_path is null or receipt_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|pdf)$'),
  receipt_hash text check (receipt_hash is null or receipt_hash ~ '^[0-9a-f]{64}$'),
  receipt_phash text check (receipt_phash is null or receipt_phash ~ '^[0-9a-f]{16}$'),
  transaction_id text check (transaction_id is null or char_length(btrim(transaction_id)) between 4 and 40),
  status text not null default 'awaiting' check (status in ('awaiting', 'under_review', 'approved', 'rejected', 'released')),
  uploaded_at timestamptz,
  reject_reason text check (reject_reason is null or char_length(reject_reason) <= 300),
  decided_by uuid,
  decided_at timestamptz,
  issue_raised_at timestamptz,
  refund_status text check (refund_status in ('requested', 'sent', 'received', 'disputed')),
  refund_requested_at timestamptz,
  refund_sent_at timestamptz,
  refund_note text check (refund_note is null or char_length(refund_note) <= 300),
  refund_answered_at timestamptz,
  -- When the dispute went to trust as payment.disputed (the stack kept the report case's id here).
  disputed_at timestamptz,
  receipt_deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index event_payments_event_idx on community.event_payments (event_id, status);
create index event_payments_society_idx on community.event_payments (society_id);
create index event_payments_user_idx on community.event_payments (user_id);
create index event_payments_hash_idx on community.event_payments (society_id, receipt_hash) where receipt_hash is not null;
create index event_payments_txn_idx on community.event_payments (society_id, lower(transaction_id)) where transaction_id is not null;

alter table community.society_payment_methods enable row level security;
alter table community.society_payment_methods force row level security;
create policy society_payment_methods_owner on community.society_payment_methods for all to svc_community using (true) with check (true);
alter table community.society_audit_log enable row level security;
alter table community.society_audit_log force row level security;
create policy society_audit_log_owner on community.society_audit_log for all to svc_community using (true) with check (true);
alter table community.event_payments enable row level security;
alter table community.event_payments force row level security;
create policy event_payments_owner on community.event_payments for all to svc_community using (true) with check (true);

grant select, insert, update, delete on community.society_payment_methods, community.event_payments to svc_community;
-- Update only to clear a deleted account's actor_id (the stack's on delete set null).
grant select, insert, update on community.society_audit_log to svc_community;
