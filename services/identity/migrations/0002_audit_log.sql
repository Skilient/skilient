-- Staff actions in identity are audited before and after, in the same transaction as the change
-- (CLAUDE.md, "Never": every staff method writes the audit log before and after). Identity keeps its own
-- log and emits `audit.recorded` (ids only); trust builds the searchable /ops view from those events
-- (decision 2026-11-25, Q4). Forward-only.
create table identity.audit_log (
  id uuid primary key,
  staff_id uuid not null,
  action text not null check (action ~ '^[a-z][a-z0-9_.]{0,99}$'),
  target_type text not null,
  target_id text not null,
  reason text not null,
  before jsonb not null default '{}',
  after jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_staff on identity.audit_log (staff_id, created_at);
create index audit_log_target on identity.audit_log (target_type, target_id, created_at);
alter table identity.audit_log enable row level security;
alter table identity.audit_log force row level security;
create policy audit_log_owner on identity.audit_log for all to svc_identity using (true) with check (true);
-- Append-only: identity may add and read rows, never change or remove them.
grant select, insert on identity.audit_log to svc_identity;
