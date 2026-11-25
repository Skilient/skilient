-- Event-fed copies of other services' facts that people's reads need (decisions 2026-11-25, advisor, W2 Q1
-- and Q8). Each row is written only by people's `people.copies` consumer from an event its owner produced;
-- an unknown key or a key from the wrong producer is dropped. Until an owner's workstream emits its events
-- (W3-W12), its rows are absent and the reads see 0 or false. No foreign keys: an event may arrive before
-- the profile does, and user.deleted removes a user's rows. Forward-only.

-- Absolute badge and to-do counts (`badge.count_changed {user_id, key, count}`); the newest event wins.
create table people.shell_counts (
  user_id uuid not null,
  key text not null check (key ~ '^[a-z][a-z_.]{1,60}$'),
  count integer not null check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Facts that are true or false (`milestone.reached` / `milestone.cleared {user_id, key}`).
create table people.shell_facts (
  user_id uuid not null,
  key text not null check (key ~ '^[a-z][a-z_.]{1,60}$'),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Structured facts (`fact.value_changed {user_id, key, value}`), each value checked by its key's schema.
create table people.fact_values (
  user_id uuid not null,
  key text not null check (key ~ '^[a-z][a-z_.]{1,60}$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Skill levels for people search (`skill.changed {user_id, skill_id, skill_label, level}` from work).
create table people.skill_levels (
  user_id uuid not null,
  skill_id text not null check (char_length(skill_id) between 1 and 80),
  skill_label text not null check (char_length(skill_label) between 1 and 80),
  level smallint not null check (level between 0 and 5),
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);
create index skill_levels_skill_idx on people.skill_levels (skill_id, level);

-- Shared ventures and societies for suggestions (`group.member_changed {kind, group_id, user_id, member}`;
-- ids only: titles and names are user-written and come from their owner's batch read).
create table people.group_members (
  kind text not null check (kind in ('venture', 'society')),
  group_id uuid not null,
  user_id uuid not null,
  updated_at timestamptz not null default now(),
  primary key (kind, group_id, user_id)
);
create index group_members_user_idx on people.group_members (user_id, kind);

alter table people.shell_counts enable row level security;
alter table people.shell_counts force row level security;
create policy shell_counts_owner on people.shell_counts for all to svc_people using (true) with check (true);
grant select, insert, update, delete on people.shell_counts to svc_people;

alter table people.shell_facts enable row level security;
alter table people.shell_facts force row level security;
create policy shell_facts_owner on people.shell_facts for all to svc_people using (true) with check (true);
grant select, insert, update, delete on people.shell_facts to svc_people;

alter table people.fact_values enable row level security;
alter table people.fact_values force row level security;
create policy fact_values_owner on people.fact_values for all to svc_people using (true) with check (true);
grant select, insert, update, delete on people.fact_values to svc_people;

alter table people.skill_levels enable row level security;
alter table people.skill_levels force row level security;
create policy skill_levels_owner on people.skill_levels for all to svc_people using (true) with check (true);
grant select, insert, update, delete on people.skill_levels to svc_people;

alter table people.group_members enable row level security;
alter table people.group_members force row level security;
create policy group_members_owner on people.group_members for all to svc_people using (true) with check (true);
grant select, insert, update, delete on people.group_members to svc_people;
