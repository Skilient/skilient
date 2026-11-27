-- community: societies (PRD 5.31), ported from apps/web/supabase/migrations/20261111000001_societies.sql.
-- Societies (pending → verified by trust staff), the request with its proof, members (one president), officer
-- terms, invites and handovers, join requests, follows, and induction rounds (roles, questions, applications).
-- User and university ids come from their owners; files are media's (W9): community keeps the path. Forward-only.

create table community.societies (
  id uuid primary key,
  university_id uuid not null,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
  name text not null check (char_length(btrim(name)) between 3 and 80),
  -- "CS Society", "The CS Club" and "cs  society!" are the same name at one university (src/domain/names.ts).
  name_key text not null check (char_length(name_key) between 1 and 80),
  category text not null check (category in ('technology', 'business', 'debating', 'arts', 'sports', 'community', 'religious', 'other')),
  about text not null check (char_length(btrim(about)) between 20 and 1000),
  logo_path text check (logo_path is null or logo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  cover_path text check (cover_path is null or cover_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  status text not null default 'pending' check (status in ('pending', 'more_info', 'verified', 'rejected', 'suspended')),
  status_reason text check (status_reason is null or char_length(status_reason) <= 1000),
  membership_mode text not null default 'request' check (membership_mode in ('open', 'request', 'inductions')),
  paid_paused boolean not null default false,
  created_by uuid,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index societies_name_unique on community.societies (university_id, name_key) where status <> 'rejected';
create index societies_university_idx on community.societies (university_id, status);
create index societies_created_by_idx on community.societies (created_by);

create table community.society_requests (
  id uuid primary key,
  society_id uuid not null references community.societies (id) on delete cascade,
  requester_id uuid not null,
  proof_path text check (proof_path is null or proof_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|webp)$'),
  proof_url text check (proof_url is null or (proof_url ~ '^https://[^[:space:]]+$' and char_length(proof_url) <= 500)),
  office_bearer boolean not null check (office_bearer),
  status text not null default 'pending' check (status in ('pending', 'more_info', 'approved', 'rejected')),
  staff_note text check (staff_note is null or char_length(staff_note) <= 1000),
  claimed_by uuid,
  claimed_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (proof_path is not null or proof_url is not null)
);
create unique index society_requests_one_open on community.society_requests (requester_id) where status in ('pending', 'more_info');
create index society_requests_society_idx on community.society_requests (society_id);
create index society_requests_queue_idx on community.society_requests (status, created_at);

create table community.society_members (
  society_id uuid not null references community.societies (id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member' check (role in ('president', 'officer', 'member')),
  title text check (title is null or char_length(btrim(title)) between 2 and 40),
  team_title text check (team_title is null or char_length(btrim(team_title)) between 2 and 40),
  joined_at timestamptz not null default now(),
  primary key (society_id, user_id)
);
create unique index society_members_one_president on community.society_members (society_id) where role = 'president';
create index society_members_user_idx on community.society_members (user_id);

create table community.society_terms (
  id uuid primary key,
  society_id uuid not null references community.societies (id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('president', 'officer')),
  title text not null check (char_length(btrim(title)) between 2 and 40),
  term_start date not null,
  term_end date not null check (term_end >= term_start),
  ended_at timestamptz,
  ended_notified_at timestamptz,
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((confirmed_by is null) = (confirmed_at is null))
);
create index society_terms_society_idx on community.society_terms (society_id, term_end);
create index society_terms_user_idx on community.society_terms (user_id);
create unique index society_terms_one_open on community.society_terms (society_id, user_id) where ended_at is null;

create table community.society_invites (
  id uuid primary key,
  society_id uuid not null references community.societies (id) on delete cascade,
  kind text not null check (kind in ('officer', 'handover')),
  invitee_id uuid not null,
  invited_by uuid,
  title text check (title is null or char_length(btrim(title)) between 2 and 40),
  term_start date,
  term_end date,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  check (kind = 'handover' or (title is not null and term_start is not null and term_end is not null and term_end >= term_start))
);
create unique index society_invites_one_pending on community.society_invites (society_id, invitee_id, kind) where status = 'pending';
create index society_invites_invitee_idx on community.society_invites (invitee_id) where status = 'pending';

create table community.society_join_requests (
  society_id uuid not null references community.societies (id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (society_id, user_id)
);
create index society_join_requests_user_idx on community.society_join_requests (user_id);

create table community.society_follows (
  society_id uuid not null references community.societies (id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (society_id, user_id)
);
create index society_follows_user_idx on community.society_follows (user_id);

create table community.induction_rounds (
  id uuid primary key,
  society_id uuid not null references community.societies (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 80),
  description text check (description is null or char_length(description) <= 1500),
  deadline timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  created_by uuid,
  published_at timestamptz,
  undecided_closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index induction_rounds_society_idx on community.induction_rounds (society_id, status);
create index induction_rounds_open_idx on community.induction_rounds (deadline) where status = 'open';

create table community.induction_roles (
  id uuid primary key,
  round_id uuid not null references community.induction_rounds (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 40),
  seats smallint not null check (seats between 1 and 50),
  filled smallint not null default 0 check (filled >= 0 and filled <= seats),
  skill_ids text[] not null default '{}' check (cardinality(skill_ids) <= 5),
  position smallint not null default 1
);
create index induction_roles_round_idx on community.induction_roles (round_id);

create table community.induction_questions (
  round_id uuid not null references community.induction_rounds (id) on delete cascade,
  position smallint not null check (position between 1 and 3),
  body text not null check (char_length(btrim(body)) between 5 and 300),
  primary key (round_id, position)
);

create table community.induction_applications (
  id uuid primary key,
  round_id uuid not null references community.induction_rounds (id) on delete cascade,
  role_id uuid not null references community.induction_roles (id) on delete cascade,
  applicant_id uuid not null,
  answers jsonb not null default '[]' check (jsonb_typeof(answers) = 'array'),
  status text not null default 'pending' check (status in ('pending', 'shortlisted', 'accepted', 'declined')),
  note text check (note is null or char_length(note) <= 500),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (round_id, applicant_id)
);
create index induction_applications_role_idx on community.induction_applications (role_id);
create index induction_applications_applicant_idx on community.induction_applications (applicant_id);

alter table community.societies enable row level security;
alter table community.societies force row level security;
create policy societies_owner on community.societies for all to svc_community using (true) with check (true);
alter table community.society_requests enable row level security;
alter table community.society_requests force row level security;
create policy society_requests_owner on community.society_requests for all to svc_community using (true) with check (true);
alter table community.society_members enable row level security;
alter table community.society_members force row level security;
create policy society_members_owner on community.society_members for all to svc_community using (true) with check (true);
alter table community.society_terms enable row level security;
alter table community.society_terms force row level security;
create policy society_terms_owner on community.society_terms for all to svc_community using (true) with check (true);
alter table community.society_invites enable row level security;
alter table community.society_invites force row level security;
create policy society_invites_owner on community.society_invites for all to svc_community using (true) with check (true);
alter table community.society_join_requests enable row level security;
alter table community.society_join_requests force row level security;
create policy society_join_requests_owner on community.society_join_requests for all to svc_community using (true) with check (true);
alter table community.society_follows enable row level security;
alter table community.society_follows force row level security;
create policy society_follows_owner on community.society_follows for all to svc_community using (true) with check (true);
alter table community.induction_rounds enable row level security;
alter table community.induction_rounds force row level security;
create policy induction_rounds_owner on community.induction_rounds for all to svc_community using (true) with check (true);
alter table community.induction_roles enable row level security;
alter table community.induction_roles force row level security;
create policy induction_roles_owner on community.induction_roles for all to svc_community using (true) with check (true);
alter table community.induction_questions enable row level security;
alter table community.induction_questions force row level security;
create policy induction_questions_owner on community.induction_questions for all to svc_community using (true) with check (true);
alter table community.induction_applications enable row level security;
alter table community.induction_applications force row level security;
create policy induction_applications_owner on community.induction_applications for all to svc_community using (true) with check (true);

grant select, insert, update, delete on community.societies, community.society_requests, community.society_members, community.society_terms,
  community.society_invites, community.society_join_requests, community.society_follows, community.induction_rounds, community.induction_roles,
  community.induction_questions, community.induction_applications to svc_community;
