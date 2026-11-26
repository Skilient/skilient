-- work: the audit log of staff actions on work's data (credential and code-check reviews, review flags, proof
-- tasks, skills, resyncs): one row per action with the state before and after, written in the action's
-- transaction (ops_audit_log today; trust builds the /ops audit view from `audit.recorded`, W10). Forward-only.

create table work.audit_log (
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
create index audit_log_staff_idx on work.audit_log (staff_id, created_at);
create index audit_log_target_idx on work.audit_log (target_type, target_id, created_at);

alter table work.audit_log enable row level security;
alter table work.audit_log force row level security;
create policy audit_log_owner on work.audit_log for all to svc_work using (true) with check (true);
grant select, insert on work.audit_log to svc_work;
