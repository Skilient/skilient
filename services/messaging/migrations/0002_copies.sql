-- Event-fed copies of other services' facts that messaging's rules read (docs/azure/prd.md, "Reading another
-- service's data"). Written only by messaging's `messaging.copies` consumer from an event its owner produced;
-- an event from the wrong producer is dropped. No names or text: names come from people's ProfileCards and
-- venture titles from work's batch read. Forward-only.

-- profile.updated (people): visibility and university for can_view_profile; read receipts for DmReceipt.
create table messaging.profiles (
  user_id uuid primary key,
  university_id uuid,
  visibility text check (visibility is null or visibility in ('friends', 'university', 'global')),
  read_receipts boolean not null default true,
  status text,
  updated_at timestamptz not null default now()
);

-- friendship.changed, block.changed (people).
create table messaging.friendships (
  user_id_a uuid not null,
  user_id_b uuid not null,
  primary key (user_id_a, user_id_b),
  check (user_id_a < user_id_b)
);
create index friendships_b_idx on messaging.friendships (user_id_b);

create table messaging.blocks (
  blocker_id uuid not null,
  blocked_id uuid not null,
  primary key (blocker_id, blocked_id)
);
create index blocks_blocked_idx on messaging.blocks (blocked_id);

-- Pairs work allows to message without being friends (an accepted application, a skill swap):
-- conversation.allowed {user_a, user_b, reason, allowed} (work, W5).
create table messaging.dm_allowances (
  user_id_a uuid not null,
  user_id_b uuid not null,
  reason text not null check (reason in ('application', 'swap')),
  primary key (user_id_a, user_id_b, reason),
  check (user_id_a < user_id_b)
);

-- Ventures (work): venture.updated gives the owner (pins) and makes the team chat.
create table messaging.ventures (
  venture_id uuid primary key,
  owner_id uuid not null,
  updated_at timestamptz not null default now()
);

alter table messaging.profiles enable row level security;
alter table messaging.profiles force row level security;
create policy profiles_owner on messaging.profiles for all to svc_messaging using (true) with check (true);
grant select, insert, update, delete on messaging.profiles to svc_messaging;

alter table messaging.friendships enable row level security;
alter table messaging.friendships force row level security;
create policy friendships_owner on messaging.friendships for all to svc_messaging using (true) with check (true);
grant select, insert, update, delete on messaging.friendships to svc_messaging;

alter table messaging.blocks enable row level security;
alter table messaging.blocks force row level security;
create policy blocks_owner on messaging.blocks for all to svc_messaging using (true) with check (true);
grant select, insert, update, delete on messaging.blocks to svc_messaging;

alter table messaging.dm_allowances enable row level security;
alter table messaging.dm_allowances force row level security;
create policy dm_allowances_owner on messaging.dm_allowances for all to svc_messaging using (true) with check (true);
grant select, insert, update, delete on messaging.dm_allowances to svc_messaging;

alter table messaging.ventures enable row level security;
alter table messaging.ventures force row level security;
create policy ventures_owner on messaging.ventures for all to svc_messaging using (true) with check (true);
grant select, insert, update, delete on messaging.ventures to svc_messaging;
