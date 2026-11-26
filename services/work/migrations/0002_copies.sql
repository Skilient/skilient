-- Event-fed copies of other services' facts that work's rules read (docs/azure/prd.md, "Reading another
-- service's data"). Written only by work's `work.copies` consumer from an event its owner produced; an event
-- from the wrong producer is dropped. No names or text: names come from people's ProfileCards. Forward-only.

-- user.created (identity), profile.updated (people): university and onboarding for require_user, status for
-- the graduate guard, visibility for can_view_profile on the team list.
create table work.members (
  user_id uuid primary key,
  role text not null default 'student',
  university_id uuid,
  department_id uuid,
  department_hash text,
  graduation_year integer,
  visibility text check (visibility is null or visibility in ('friends', 'university', 'global')),
  status text,
  onboarding_complete boolean not null default false,
  updated_at timestamptz not null default now()
);
create index members_university_idx on work.members (university_id);

-- friendship.changed, block.changed (people).
create table work.friendships (
  user_id_a uuid not null,
  user_id_b uuid not null,
  primary key (user_id_a, user_id_b),
  check (user_id_a < user_id_b)
);
create index friendships_b_idx on work.friendships (user_id_b);

create table work.blocks (
  blocker_id uuid not null,
  blocked_id uuid not null,
  primary key (blocker_id, blocked_id)
);
create index blocks_blocked_idx on work.blocks (blocked_id);

-- Row-level security: enabled and forced on every table, one policy for the owning role.
alter table work.members enable row level security;
alter table work.members force row level security;
create policy members_owner on work.members for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.members to svc_work;

alter table work.friendships enable row level security;
alter table work.friendships force row level security;
create policy friendships_owner on work.friendships for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.friendships to svc_work;

alter table work.blocks enable row level security;
alter table work.blocks force row level security;
create policy blocks_owner on work.blocks for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.blocks to svc_work;
