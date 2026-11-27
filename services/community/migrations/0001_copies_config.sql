-- community: event-fed copies of other services' facts that community's rules read, its settings and its staff
-- audit log (docs/azure/prd.md, "Reading another service's data"). Forward-only. Every table: row-level
-- security enabled and forced, one policy for the owning role (prd.md, "Layout"). No names or text in the
-- copies: names come from people's ProfileCards, one batch call per page.

-- profile.updated (people): require_user (onboarded), students only, the university, the graduate guard
-- (status), and the eligibility groups (department_hash = sha256 of the department text, graduation year).
create table community.members (
  user_id uuid primary key,
  role text not null default 'student',
  university_id uuid,
  department_hash text,
  graduation_year integer,
  status text,
  onboarding_complete boolean not null default false,
  updated_at timestamptz not null default now()
);
create index members_university_idx on community.members (university_id);

-- friendship.changed (people): "friends going" on event cards.
create table community.friendships (
  user_id_a uuid not null,
  user_id_b uuid not null,
  primary key (user_id_a, user_id_b),
  check (user_id_a < user_id_b)
);
create index friendships_b_idx on community.friendships (user_id_b);

-- Settings (platform_config today): values copied from the current stack. Staff change them through trust's
-- /ops config (W10) by an event, or by a new migration.
create table community.config (
  key text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into community.config (key, value) values
  ('societies.limits', '{"max_officers": 15, "induction_questions": 3, "induction_max_days": 30, "undecided_decline_days": 14, "review_days": 3}'::jsonb),
  ('events.ticket_limits', '{"min_pkr": 100, "max_pkr": 10000, "hold_hours": 24, "max_ticket_types": 5, "max_sessions": 10, "max_questions": 8, "closeout_hours": 72, "feedback_days": 7, "receipt_delete_days": 90, "dispute_hours": 72, "refund_flag_days": 14, "feedback_min_group": 5}'::jsonb);

-- Staff actions on community's data (society review): one row per action with the state before and after,
-- written in the action's transaction (ops_audit_log today; trust builds the /ops view from audit.recorded).
create table community.audit_log (
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
create index audit_log_target_idx on community.audit_log (target_type, target_id, created_at);
create index audit_log_staff_idx on community.audit_log (staff_id, created_at);

alter table community.members enable row level security;
alter table community.members force row level security;
create policy members_owner on community.members for all to svc_community using (true) with check (true);
grant select, insert, update, delete on community.members to svc_community;

alter table community.friendships enable row level security;
alter table community.friendships force row level security;
create policy friendships_owner on community.friendships for all to svc_community using (true) with check (true);
grant select, insert, update, delete on community.friendships to svc_community;

alter table community.config enable row level security;
alter table community.config force row level security;
create policy config_owner on community.config for all to svc_community using (true) with check (true);
grant select, insert, update, delete on community.config to svc_community;

alter table community.audit_log enable row level security;
alter table community.audit_log force row level security;
create policy audit_log_owner on community.audit_log for all to svc_community using (true) with check (true);
grant select, insert on community.audit_log to svc_community;
