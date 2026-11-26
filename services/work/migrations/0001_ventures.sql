-- work: the skills taxonomy, ventures (roles, questions, members, applications and their messages, invites,
-- follows, updates and their images, deliverables, completions) and the contribution log (docs/azure/prd.md,
-- service catalogue). Forward-only. Every table: row-level security enabled and forced, one policy for the
-- owning role (prd.md, "Layout"). No foreign key leaves the schema: user and university ids come from their
-- owners' events and calls. Ported from apps/web/supabase/migrations (_skills, _sync_skills_taxonomy,
-- _skill_visibility, _ventures, _venture_views, _contributions, _posts (update media), _ranking (completions),
-- _student_portal (graduate guard), _ai_assisted_commits); docs/azure/work-function-bins.md maps every function.

-- The skills taxonomy (PRD 5.5), curated by Trust staff; seeded in 0003_skills_seed.sql.
create table work.skills (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  name text not null check (char_length(name) between 1 and 60),
  category text not null check (category in ('language', 'framework', 'library', 'tool', 'platform', 'practice')),
  parent_id text references work.skills (id),
  detectors jsonb not null default '{}'::jsonb check (jsonb_typeof(detectors) = 'object'),
  taxonomy_version integer not null check (taxonomy_version >= 1),
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table work.ventures (
  id uuid primary key,
  type text not null check (type in ('project', 'startup')),
  owner_id uuid not null,
  -- The owner's university when created; decides who sees a University-only venture.
  university_id uuid not null,
  title text not null check (char_length(btrim(title)) between 3 and 80),
  description text not null check (char_length(description) between 1 and 4000),
  status text not null default 'recruiting' check (status in ('recruiting', 'in_progress', 'completed', 'abandoned')),
  visibility text not null default 'public' check (visibility in ('public', 'university', 'unlisted')),
  stage text check (stage is null or stage in ('idea', 'prototype', 'launched', 'revenue')),
  pitch_url text check (pitch_url is null or (pitch_url ~ '^https://' and char_length(pitch_url) <= 500)),
  affiliation text check (affiliation is null or char_length(affiliation) <= 120),
  skill_ids text[] not null default '{}' check (cardinality(skill_ids) <= 10),
  team_size smallint not null default 4 check (team_size between 2 and 6),
  repo_id bigint,
  repo_full_name text check (repo_full_name is null or char_length(repo_full_name) <= 140),
  completed_at timestamptz,
  abandoned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (setweight(to_tsvector('simple', title), 'A') || setweight(to_tsvector('simple', left(description, 2000)), 'B')) stored,
  check (type = 'startup' or (stage is null and pitch_url is null)),
  check ((status = 'completed') = (completed_at is not null)),
  check ((status = 'abandoned') = (abandoned_at is not null))
);
create index ventures_browse_idx on work.ventures (type, status, created_at desc) where visibility <> 'unlisted';
create index ventures_university_idx on work.ventures (university_id);
create index ventures_owner_idx on work.ventures (owner_id);
create index ventures_skills_idx on work.ventures using gin (skill_ids);
create index ventures_search_idx on work.ventures using gin (search);
create index ventures_repo_idx on work.ventures (repo_id) where repo_id is not null;

create table work.venture_members (
  venture_id uuid not null references work.ventures (id) on delete cascade,
  user_id uuid not null,
  team_role text not null default 'other' check (team_role in ('lead', 'developer', 'designer', 'researcher', 'other')),
  joined_at timestamptz not null default now(),
  primary key (venture_id, user_id)
);
create index venture_members_user_idx on work.venture_members (user_id);

create table work.venture_roles (
  id uuid primary key,
  venture_id uuid not null references work.ventures (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 60),
  skill_ids text[] not null default '{}' check (cardinality(skill_ids) <= 5),
  slots smallint not null default 1 check (slots between 1 and 5),
  filled smallint not null default 0 check (filled >= 0),
  created_at timestamptz not null default now(),
  check (filled <= slots)
);
create index venture_roles_venture_idx on work.venture_roles (venture_id);

create table work.venture_questions (
  venture_id uuid not null references work.ventures (id) on delete cascade,
  position smallint not null check (position between 1 and 3),
  body text not null check (char_length(btrim(body)) between 3 and 200),
  primary key (venture_id, position)
);

-- application_threads today.
create table work.applications (
  id uuid primary key,
  venture_id uuid not null references work.ventures (id) on delete cascade,
  role_id uuid references work.venture_roles (id) on delete set null,
  candidate_id uuid not null,
  -- The venture's owner when the thread was opened; follows ownership transfers.
  owner_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn', 'closed')),
  message text not null check (char_length(btrim(message)) between 1 and 1000),
  answers jsonb not null default '[]'::jsonb check (jsonb_typeof(answers) = 'array'),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check (candidate_id <> owner_id)
);
-- Duplicate pending applications are impossible, even under parallel clicks (PRD 5.7).
create unique index applications_one_pending on work.applications (candidate_id, venture_id) where status = 'pending';
create index applications_owner_idx on work.applications (owner_id, status, created_at desc);
create index applications_candidate_idx on work.applications (candidate_id, created_at desc);
create index applications_venture_idx on work.applications (venture_id, status);

create table work.application_messages (
  id bigint generated always as identity primary key,
  application_id uuid not null references work.applications (id) on delete cascade,
  sender_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index application_messages_application_idx on work.application_messages (application_id, created_at);

create table work.venture_invites (
  id uuid primary key,
  venture_id uuid not null references work.ventures (id) on delete cascade,
  invitee_id uuid not null,
  inviter_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (invitee_id <> inviter_id)
);
create unique index venture_invites_one_pending on work.venture_invites (venture_id, invitee_id) where status = 'pending';
create index venture_invites_invitee_idx on work.venture_invites (invitee_id, status);

create table work.venture_follows (
  venture_id uuid not null references work.ventures (id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (venture_id, user_id)
);
create index venture_follows_user_idx on work.venture_follows (user_id);

create table work.venture_updates (
  id uuid primary key,
  venture_id uuid not null references work.ventures (id) on delete cascade,
  author_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index venture_updates_venture_idx on work.venture_updates (venture_id, created_at desc);

create table work.venture_update_media (
  update_id uuid not null references work.venture_updates (id) on delete cascade,
  position smallint not null check (position between 1 and 4),
  path text not null check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  width integer not null check (width between 1 and 4000),
  height integer not null check (height between 1 and 4000),
  primary key (update_id, position)
);

-- Members only (PRD 5.28); outsiders see a count.
create table work.venture_deliverables (
  id uuid primary key,
  venture_id uuid not null references work.ventures (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 2 and 80),
  url text not null check (url ~ '^https://' and char_length(url) <= 500),
  added_by uuid,
  created_at timestamptz not null default now()
);
create index venture_deliverables_venture_idx on work.venture_deliverables (venture_id);

-- The contribution log (PRD 5.14). Insert-only: corrections are new rows (corrects_id).
create table work.contributions (
  id uuid primary key,
  venture_id uuid not null references work.ventures (id) on delete cascade,
  user_id uuid not null,
  kind text not null check (kind in ('code', 'design', 'research', 'docs', 'management', 'other')),
  description text not null check (char_length(btrim(description)) between 1 and 500),
  evidence_url text check (evidence_url is null or (evidence_url ~ '^https?://[^\s]+$' and char_length(evidence_url) <= 500)),
  hours numeric(5, 2) check (hours is null or (hours > 0 and hours <= 100)),
  corrects_id uuid references work.contributions (id) on delete cascade,
  source text not null default 'manual' check (source in ('manual', 'github')),
  commit_sha text check (commit_sha is null or commit_sha ~ '^[0-9a-f]{40}$'),
  -- A GitHub commit made before the venture was created (up to 6 months): counts once a teammate confirms it.
  before_venture boolean not null default false,
  -- Skills this entry shows (from the venture's tags); a teammate's confirmation makes them L3 for the author.
  skill_ids text[] not null default '{}' check (cardinality(skill_ids) <= 3),
  -- For a GitHub entry: the AI coding agent that wrote the commit.
  ai_agent text check (ai_agent is null or char_length(ai_agent) between 3 and 200),
  created_at timestamptz not null default now(),
  check ((source = 'github') = (commit_sha is not null)),
  check (source = 'manual' or corrects_id is null),
  check (source = 'github' or not before_venture)
);
create index contributions_venture_created_idx on work.contributions (venture_id, created_at desc);
create index contributions_user_idx on work.contributions (user_id, venture_id);
create index contributions_corrects_idx on work.contributions (corrects_id) where corrects_id is not null;
create unique index contributions_commit_uniq on work.contributions (venture_id, user_id, commit_sha) where commit_sha is not null;

create table work.contribution_confirmations (
  contribution_id uuid not null references work.contributions (id) on delete cascade,
  confirmer_id uuid not null,
  -- 'supervisor' is the faculty portal's (deferred); every confirmation here is a teammate's.
  confirmer_role text not null default 'peer' check (confirmer_role in ('peer', 'supervisor')),
  created_at timestamptz not null default now(),
  primary key (contribution_id, confirmer_id)
);
create index contribution_confirmations_confirmer_idx on work.contribution_confirmations (confirmer_id);

-- Frozen when a venture completes (PRD 5.13 Work): what ranking (W6) and the Record (W8) read, by event.
create table work.venture_completions (
  venture_id uuid primary key references work.ventures (id) on delete cascade,
  owner_id uuid,
  completed_at timestamptz not null,
  team_size smallint not null check (team_size between 0 and 6),
  weeks numeric(7, 2) not null check (weeks >= 0),
  skill_tags smallint not null check (skill_tags >= 0),
  deliverables smallint not null check (deliverables >= 0),
  verified_members smallint not null check (verified_members >= 0),
  backfilled boolean not null default false,
  created_at timestamptz not null default now()
);

create table work.venture_completion_members (
  venture_id uuid not null references work.venture_completions (venture_id) on delete cascade,
  user_id uuid not null,
  github_days integer not null default 0 check (github_days >= 0),
  verified_entries integer not null default 0 check (verified_entries >= 0),
  unconfirmed_entries integer not null default 0 check (unconfirmed_entries >= 0),
  primary key (venture_id, user_id)
);
create index venture_completion_members_user_idx on work.venture_completion_members (user_id);

-- Row-level security: enabled and forced on every table, one policy for the owning role.
alter table work.skills enable row level security;
alter table work.skills force row level security;
create policy skills_owner on work.skills for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.skills to svc_work;

alter table work.ventures enable row level security;
alter table work.ventures force row level security;
create policy ventures_owner on work.ventures for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.ventures to svc_work;

alter table work.venture_members enable row level security;
alter table work.venture_members force row level security;
create policy venture_members_owner on work.venture_members for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.venture_members to svc_work;

alter table work.venture_roles enable row level security;
alter table work.venture_roles force row level security;
create policy venture_roles_owner on work.venture_roles for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.venture_roles to svc_work;

alter table work.venture_questions enable row level security;
alter table work.venture_questions force row level security;
create policy venture_questions_owner on work.venture_questions for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.venture_questions to svc_work;

alter table work.applications enable row level security;
alter table work.applications force row level security;
create policy applications_owner on work.applications for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.applications to svc_work;

alter table work.application_messages enable row level security;
alter table work.application_messages force row level security;
create policy application_messages_owner on work.application_messages for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.application_messages to svc_work;

alter table work.venture_invites enable row level security;
alter table work.venture_invites force row level security;
create policy venture_invites_owner on work.venture_invites for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.venture_invites to svc_work;

alter table work.venture_follows enable row level security;
alter table work.venture_follows force row level security;
create policy venture_follows_owner on work.venture_follows for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.venture_follows to svc_work;

alter table work.venture_updates enable row level security;
alter table work.venture_updates force row level security;
create policy venture_updates_owner on work.venture_updates for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.venture_updates to svc_work;

alter table work.venture_update_media enable row level security;
alter table work.venture_update_media force row level security;
create policy venture_update_media_owner on work.venture_update_media for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.venture_update_media to svc_work;

alter table work.venture_deliverables enable row level security;
alter table work.venture_deliverables force row level security;
create policy venture_deliverables_owner on work.venture_deliverables for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.venture_deliverables to svc_work;

alter table work.contributions enable row level security;
alter table work.contributions force row level security;
create policy contributions_owner on work.contributions for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.contributions to svc_work;

alter table work.contribution_confirmations enable row level security;
alter table work.contribution_confirmations force row level security;
create policy contribution_confirmations_owner on work.contribution_confirmations for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.contribution_confirmations to svc_work;

alter table work.venture_completions enable row level security;
alter table work.venture_completions force row level security;
create policy venture_completions_owner on work.venture_completions for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.venture_completions to svc_work;

alter table work.venture_completion_members enable row level security;
alter table work.venture_completion_members force row level security;
create policy venture_completion_members_owner on work.venture_completion_members for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.venture_completion_members to svc_work;

grant usage on sequence work.application_messages_id_seq to svc_work;
