-- Event-fed copies of other services' facts that content's feed, visibility and survey rules read
-- (docs/azure/prd.md, "Reading another service's data": author cards and audience edges live in content).
-- Each row is written only by content's `content.copies` consumer from an event its owner produced; an event
-- from the wrong producer is dropped. No names, usernames or text: those come from people's ProfileCards
-- batch read. No foreign keys: an event may arrive before the row it points at. Forward-only.

-- Accounts and profile flags: user.created (identity; the account's age), profile.updated (people).
create table content.members (
  user_id uuid primary key,
  role text check (role is null or role in ('student', 'faculty', 'recruiter', 'university_admin')),
  university_id uuid,
  department_id uuid,
  -- sha256 of the profile's department text (the feed compares departments exactly, as today).
  department_hash text check (department_hash is null or department_hash ~ '^[0-9a-f]{64}$'),
  graduation_year smallint,
  visibility text check (visibility is null or visibility in ('friends', 'university', 'global')),
  status text check (status is null or status in ('active', 'graduate', 'deleting')),
  onboarding_complete boolean not null default false,
  account_created_at timestamptz,
  updated_at timestamptz not null default now()
);
create index members_university_idx on content.members (university_id);

-- Audience edges (people): friendship.changed, block.changed, mute.changed.
create table content.friendships (
  user_id_a uuid not null,
  user_id_b uuid not null,
  primary key (user_id_a, user_id_b),
  check (user_id_a < user_id_b)
);
create index friendships_b_idx on content.friendships (user_id_b);

create table content.blocks (
  blocker_id uuid not null,
  blocked_id uuid not null,
  primary key (blocker_id, blocked_id)
);
create index blocks_blocked_idx on content.blocks (blocked_id);

create table content.mutes (
  user_id uuid not null,
  muted_id uuid not null,
  primary key (user_id, muted_id)
);

-- Venture and society membership (work, community): group.member_changed. Role: member | officer | president.
create table content.group_members (
  kind text not null check (kind in ('venture', 'society')),
  group_id uuid not null,
  user_id uuid not null,
  role text not null default 'member' check (role in ('member', 'officer', 'president')),
  primary key (kind, group_id, user_id)
);
create index group_members_user_idx on content.group_members (user_id, kind);

-- Ventures (work, W5): venture.updated, for invite posts and visibility; venture.follow_changed for the feed.
create table content.ventures (
  venture_id uuid primary key,
  owner_id uuid not null,
  university_id uuid,
  status text not null,
  visibility text not null check (visibility in ('public', 'university', 'unlisted')),
  updated_at timestamptz not null default now()
);

create table content.venture_follows (
  venture_id uuid not null,
  user_id uuid not null,
  primary key (venture_id, user_id)
);
create index venture_follows_user_idx on content.venture_follows (user_id);

-- Skill levels (work): skill.changed, for the feed's shared-skills relevance.
create table content.user_skills (
  user_id uuid not null,
  skill_id text not null check (char_length(skill_id) between 1 and 80),
  level smallint not null check (level between 0 and 5),
  primary key (user_id, skill_id)
);

-- Societies (community, W7): society.status_changed, for "post as".
create table content.societies (
  society_id uuid primary key,
  university_id uuid not null,
  status text not null,
  updated_at timestamptz not null default now()
);

-- University seats (market, W11): university_seat.changed, for announcement reach and university hides.
create table content.uni_seats (
  user_id uuid not null,
  university_id uuid not null,
  role text not null check (role in ('owner', 'admin', 'career', 'coordinator', 'comms')),
  primary key (user_id, university_id)
);

-- Entitlements (billing, W12): entitlement.changed, for post insights.
create table content.entitlements (
  subject_id uuid not null,
  key text not null check (char_length(key) between 1 and 80),
  value jsonb not null,
  primary key (subject_id, key)
);

alter table content.members enable row level security;
alter table content.members force row level security;
create policy members_owner on content.members for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.members to svc_content;

alter table content.friendships enable row level security;
alter table content.friendships force row level security;
create policy friendships_owner on content.friendships for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.friendships to svc_content;

alter table content.blocks enable row level security;
alter table content.blocks force row level security;
create policy blocks_owner on content.blocks for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.blocks to svc_content;

alter table content.mutes enable row level security;
alter table content.mutes force row level security;
create policy mutes_owner on content.mutes for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.mutes to svc_content;

alter table content.group_members enable row level security;
alter table content.group_members force row level security;
create policy group_members_owner on content.group_members for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.group_members to svc_content;

alter table content.ventures enable row level security;
alter table content.ventures force row level security;
create policy ventures_owner on content.ventures for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.ventures to svc_content;

alter table content.venture_follows enable row level security;
alter table content.venture_follows force row level security;
create policy venture_follows_owner on content.venture_follows for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.venture_follows to svc_content;

alter table content.user_skills enable row level security;
alter table content.user_skills force row level security;
create policy user_skills_owner on content.user_skills for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.user_skills to svc_content;

alter table content.societies enable row level security;
alter table content.societies force row level security;
create policy societies_owner on content.societies for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.societies to svc_content;

alter table content.uni_seats enable row level security;
alter table content.uni_seats force row level security;
create policy uni_seats_owner on content.uni_seats for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.uni_seats to svc_content;

alter table content.entitlements enable row level security;
alter table content.entitlements force row level security;
create policy entitlements_owner on content.entitlements for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.entitlements to svc_content;
