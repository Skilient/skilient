-- identity, steps 9 to 11: account deletion state, identity's record of the sanctions it applied, and the
-- confirmations other services send after `user.deleted` (docs/azure/prd.md, "Data protection"; decisions
-- 2026-11-25 Q1 and "writes from other services into identity data go through an identity command").
-- Every table: row-level security enabled and forced, one policy for identity's own role. Forward-only.

-- Deletion state moves into identity (decision Q1). `people` keeps its own active/graduate status and
-- reacts to `user.deletion_requested`, `user.deletion_cancelled` and `user.deleted`.
alter table identity.users
  add column status text not null default 'active' check (status in ('active', 'deleting')),
  add column delete_after timestamptz,
  add column deletion_requested_at timestamptz,
  add constraint users_deletion_state check ((status = 'deleting') = (delete_after is not null));
create index users_deletion_due on identity.users (delete_after) where status = 'deleting';

-- The sanctions trust applied through SanctionUser: what identity needs to keep its half right (one active
-- suspension or ban at a time, and whether lifting one clears the ban). Trust keeps the sanction itself
-- (case, history, appeals); this row is keyed by trust's sanction id.
create table identity.sanction_marks (
  sanction_id uuid primary key,
  user_id uuid not null references identity.users (id) on delete cascade,
  kind text not null check (kind in ('warn', 'suspend', 'ban')),
  until timestamptz,
  reason text not null check (char_length(reason) between 3 and 2000),
  staff_id uuid not null,
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid,
  lift_reason text,
  check (kind <> 'warn' or until is null),
  check ((lifted_at is null) = (lifted_by is null))
);
create index sanction_marks_user on identity.sanction_marks (user_id, created_at);
alter table identity.sanction_marks enable row level security;
alter table identity.sanction_marks force row level security;
create policy sanction_marks_owner on identity.sanction_marks for all to svc_identity using (true) with check (true);
grant select, insert, update on identity.sanction_marks to svc_identity;

-- One row per deleted account (its id only, never an email or name), so identity can tell which services
-- have confirmed `user.deleted` and report those that have not after 24 hours.
create table identity.deleted_accounts (
  user_id uuid primary key,
  deleted_at timestamptz not null default now(),
  -- When the daily check last reported missing confirmations for this account (null: not reported yet).
  reported_at timestamptz
);
alter table identity.deleted_accounts enable row level security;
alter table identity.deleted_accounts force row level security;
create policy deleted_accounts_owner on identity.deleted_accounts for all to svc_identity using (true) with check (true);
grant select, insert, update, delete on identity.deleted_accounts to svc_identity;

-- A service's `user.deletion_confirmed` event, applied once (the producer role names the service).
create table identity.deletion_confirmations (
  user_id uuid not null references identity.deleted_accounts (user_id) on delete cascade,
  service text not null check (service ~ '^[a-z][a-z0-9_]{0,40}$'),
  event_id uuid not null,
  confirmed_at timestamptz not null default now(),
  primary key (user_id, service)
);
alter table identity.deletion_confirmations enable row level security;
alter table identity.deletion_confirmations force row level security;
create policy deletion_confirmations_owner on identity.deletion_confirmations for all to svc_identity using (true) with check (true);
grant select, insert, delete on identity.deletion_confirmations to svc_identity;
