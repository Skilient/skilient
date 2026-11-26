-- ranking: event-fed copies of the facts the score is made of (docs/azure/prd.md, "Reading another service's
-- data": "Ranking facts ... Nightly scoring reads only its own schema"). Written only by ranking's `ranking.copies`
-- consumer from an event its owner produced (services/ranking/src/store/copies.ts lists each). Ids, numbers,
-- flags and catalogue labels only: no names, titles or text. Forward-only.

-- people: profile.updated (cohort, status, opt-out), friendship.changed, block.changed.
create table ranking.members (
  user_id uuid primary key,
  role text not null default 'student',
  university_id uuid,
  department_hash text,
  graduation_year integer,
  status text not null default 'active',
  graduated_at timestamptz,
  onboarding_complete boolean not null default false,
  leaderboard_opt_out boolean not null default false,
  updated_at timestamptz not null default now()
);
create index members_university_idx on ranking.members (university_id);

create table ranking.friendships (
  user_id_a uuid not null,
  user_id_b uuid not null,
  primary key (user_id_a, user_id_b),
  check (user_id_a < user_id_b)
);
create index friendships_b_idx on ranking.friendships (user_id_b);

create table ranking.blocks (
  blocker_id uuid not null,
  blocked_id uuid not null,
  primary key (blocker_id, blocked_id)
);
create index blocks_blocked_idx on ranking.blocks (blocked_id);

-- work: venture.updated / venture.completed (status, owner; the completion frozen at completion).
create table ranking.ventures (
  venture_id uuid primary key,
  owner_id uuid,
  status text not null,
  updated_at timestamptz not null default now()
);

create table ranking.venture_completions (
  venture_id uuid primary key,
  owner_id uuid,
  completed_at timestamptz not null,
  team_size smallint not null check (team_size between 0 and 6),
  weeks numeric(7, 2) not null check (weeks >= 0),
  skill_tags smallint not null check (skill_tags >= 0),
  deliverables smallint not null check (deliverables >= 0),
  verified_members smallint not null check (verified_members >= 0)
);

create table ranking.venture_completion_members (
  venture_id uuid not null references ranking.venture_completions (venture_id) on delete cascade,
  user_id uuid not null,
  github_days integer not null default 0 check (github_days >= 0),
  verified_entries integer not null default 0 check (verified_entries >= 0),
  unconfirmed_entries integer not null default 0 check (unconfirmed_entries >= 0),
  primary key (venture_id, user_id)
);
create index venture_completion_members_user_idx on ranking.venture_completion_members (user_id);

-- work: contribution.logged, contribution.confirmed (the contribution log, for verified entries, consistency,
-- citizenship and the decay clock).
create table ranking.contributions (
  id uuid primary key,
  venture_id uuid not null,
  user_id uuid not null,
  source text not null check (source in ('manual', 'github')),
  before_venture boolean not null default false,
  corrects_id uuid,
  created_at timestamptz not null
);
create index contributions_user_idx on ranking.contributions (user_id, created_at);
create index contributions_venture_idx on ranking.contributions (venture_id);
create index contributions_corrects_idx on ranking.contributions (corrects_id) where corrects_id is not null;

create table ranking.confirmations (
  contribution_id uuid not null,
  confirmer_id uuid not null,
  created_at timestamptz not null,
  primary key (contribution_id, confirmer_id)
);
create index confirmations_confirmer_idx on ranking.confirmations (confirmer_id, created_at);

-- work: pull_request.recorded.
create table ranking.pull_requests (
  user_id uuid not null,
  repo_id bigint not null,
  number integer not null,
  repo text not null,
  merged_at timestamptz not null,
  counted boolean not null,
  primary key (user_id, repo_id, number)
);

-- work: application.changed (join requests the owner answered; times are the events').
create table ranking.applications (
  id uuid primary key,
  owner_id uuid not null,
  status text not null,
  created_at timestamptz not null,
  decided_at timestamptz
);
create index applications_owner_idx on ranking.applications (owner_id);

-- work: skill.changed (level, and the catalogue's category and label).
create table ranking.user_skills (
  user_id uuid not null,
  skill_id text not null,
  level smallint not null check (level between 0 and 4),
  category text,
  label text,
  primary key (user_id, skill_id)
);

-- work: endorsement.given, endorsement.hidden.
create table ranking.endorsements (
  id uuid primary key,
  endorser_id uuid not null,
  endorsee_id uuid not null,
  venture_id uuid not null,
  skill_id text not null,
  endorser_kind text not null default 'student' check (endorser_kind in ('student', 'teacher')),
  hidden boolean not null default false,
  created_at timestamptz not null
);
create index endorsements_endorsee_idx on ranking.endorsements (endorsee_id);
create index endorsements_endorser_idx on ranking.endorsements (endorser_id);

-- work: credential.changed.
create table ranking.credentials (
  id uuid primary key,
  user_id uuid not null,
  status text not null,
  expires_on date,
  recognised boolean not null default false,
  created_at timestamptz not null
);
create index credentials_user_idx on ranking.credentials (user_id);

-- content: post.created, post.removed, survey.answered (the micro-survey, for content quality).
create table ranking.posts (
  id uuid primary key,
  author_id uuid not null,
  created_at timestamptz not null,
  removed boolean not null default false
);
create index posts_author_idx on ranking.posts (author_id, created_at);

create table ranking.survey_responses (
  post_id uuid not null,
  user_id uuid not null,
  dimension text not null,
  answer boolean not null,
  weight numeric(6, 3) not null default 1,
  created_at timestamptz not null,
  primary key (post_id, user_id)
);

-- credentials (W8): record.sealed, record.revoked; community (W7): society.status_changed.
create table ranking.record_entries (
  id uuid primary key,
  user_id uuid not null,
  kind text not null,
  issuer_type text not null,
  issuer_id uuid,
  occurred_on date not null,
  signed_at timestamptz not null,
  status text not null check (status in ('sealed', 'revoked', 'superseded')),
  evidence jsonb not null default '{}'
);
create index record_entries_user_idx on ranking.record_entries (user_id);

create table ranking.societies (
  society_id uuid primary key,
  status text not null,
  verified_at timestamptz
);

-- trust (W10): config.changed for the keys ranking reads besides its formula (feed.score: the quality index;
-- teacher.limits: a teacher endorsement's weight). Seeded with today's values.
create table ranking.config (
  key text primary key,
  version integer not null,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into ranking.config (key, version, value) values
  ('feed.score', 1, '{"base": 0.15, "bayes_k": 10, "gravity": 1.5, "conversation": 0.5, "platform_mean": 0.6, "friend_commenter": 0.5, "min_comment_chars": 10, "credible_penalty_max": 0.8, "credible_penalty_factor": 2}'),
  ('teacher.limits', 1, '{"endorsement_weight": 1.5}');

-- Row-level security: enabled and forced on every table, one policy for the owning role.
alter table ranking.members enable row level security;
alter table ranking.members force row level security;
create policy members_owner on ranking.members for all to svc_ranking using (true) with check (true);
grant select, insert, update, delete on ranking.members to svc_ranking;

alter table ranking.friendships enable row level security;
alter table ranking.friendships force row level security;
create policy friendships_owner on ranking.friendships for all to svc_ranking using (true) with check (true);
grant select, insert, update, delete on ranking.friendships to svc_ranking;

alter table ranking.blocks enable row level security;
alter table ranking.blocks force row level security;
create policy blocks_owner on ranking.blocks for all to svc_ranking using (true) with check (true);
grant select, insert, update, delete on ranking.blocks to svc_ranking;

alter table ranking.ventures enable row level security;
alter table ranking.ventures force row level security;
create policy ventures_owner on ranking.ventures for all to svc_ranking using (true) with check (true);
grant select, insert, update, delete on ranking.ventures to svc_ranking;

alter table ranking.venture_completions enable row level security;
alter table ranking.venture_completions force row level security;
create policy venture_completions_owner on ranking.venture_completions for all to svc_ranking using (true) with check (true);
grant select, insert, update, delete on ranking.venture_completions to svc_ranking;

alter table ranking.venture_completion_members enable row level security;
alter table ranking.venture_completion_members force row level security;
create policy venture_completion_members_owner on ranking.venture_completion_members for all to svc_ranking using (true) with check (true);
grant select, insert, update, delete on ranking.venture_completion_members to svc_ranking;

alter table ranking.contributions enable row level security;
alter table ranking.contributions force row level security;
create policy contributions_owner on ranking.contributions for all to svc_ranking using (true) with check (true);
grant select, insert, update, delete on ranking.contributions to svc_ranking;

alter table ranking.confirmations enable row level security;
alter table ranking.confirmations force row level security;
create policy confirmations_owner on ranking.confirmations for all to svc_ranking using (true) with check (true);
grant select, insert, update, delete on ranking.confirmations to svc_ranking;

alter table ranking.pull_requests enable row level security;
alter table ranking.pull_requests force row level security;
create policy pull_requests_owner on ranking.pull_requests for all to svc_ranking using (true) with check (true);
grant select, insert, update, delete on ranking.pull_requests to svc_ranking;

alter table ranking.applications enable row level security;
alter table ranking.applications force row level security;
create policy applications_owner on ranking.applications for all to svc_ranking using (true) with check (true);
grant select, insert, update, delete on ranking.applications to svc_ranking;

alter table ranking.user_skills enable row level security;
alter table ranking.user_skills force row level security;
create policy user_skills_owner on ranking.user_skills for all to svc_ranking using (true) with check (true);
grant select, insert, update, delete on ranking.user_skills to svc_ranking;

alter table ranking.endorsements enable row level security;
alter table ranking.endorsements force row level security;
create policy endorsements_owner on ranking.endorsements for all to svc_ranking using (true) with check (true);
grant select, insert, update, delete on ranking.endorsements to svc_ranking;

alter table ranking.credentials enable row level security;
alter table ranking.credentials force row level security;
create policy credentials_owner on ranking.credentials for all to svc_ranking using (true) with check (true);
grant select, insert, update, delete on ranking.credentials to svc_ranking;

alter table ranking.posts enable row level security;
alter table ranking.posts force row level security;
create policy posts_owner on ranking.posts for all to svc_ranking using (true) with check (true);
grant select, insert, update, delete on ranking.posts to svc_ranking;

alter table ranking.survey_responses enable row level security;
alter table ranking.survey_responses force row level security;
create policy survey_responses_owner on ranking.survey_responses for all to svc_ranking using (true) with check (true);
grant select, insert, update, delete on ranking.survey_responses to svc_ranking;

alter table ranking.record_entries enable row level security;
alter table ranking.record_entries force row level security;
create policy record_entries_owner on ranking.record_entries for all to svc_ranking using (true) with check (true);
grant select, insert, update, delete on ranking.record_entries to svc_ranking;

alter table ranking.societies enable row level security;
alter table ranking.societies force row level security;
create policy societies_owner on ranking.societies for all to svc_ranking using (true) with check (true);
grant select, insert, update, delete on ranking.societies to svc_ranking;

alter table ranking.config enable row level security;
alter table ranking.config force row level security;
create policy config_owner on ranking.config for all to svc_ranking using (true) with check (true);
grant select, insert, update, delete on ranking.config to svc_ranking;
