-- work: the GitHub connection and its evidence (accounts, installations, repositories, sync jobs, commits and
-- the skills they show, pull requests, review flags), and each student's skill levels (user_skills), which the
-- evidence and the L3/L4 proofs feed. Ported from _github_connect.sql, _github_evidence.sql, _skill_levels.sql,
-- _ai_assisted_commits.sql and _paths_tasks.sql (l2_at). Forward-only.
-- The tokens GitHub issues for a student are stored encrypted (AES-256-GCM under the Key Vault secret
-- `work-github-token-key`, src/domain/token-crypto.ts); Supabase Vault held them before.

create table work.github_accounts (
  user_id uuid primary key,
  github_id bigint not null unique check (github_id > 0),
  login text not null check (login ~ '^[A-Za-z0-9-]{1,39}$'),
  connected_at timestamptz not null default now(),
  revoked_at timestamptz,
  updated_at timestamptz not null default now()
);

-- A student's GitHub tokens, encrypted; the user id is bound as additional data.
create table work.github_tokens (
  user_id uuid primary key,
  access_token bytea not null,
  access_expires_at timestamptz,
  refresh_token bytea,
  refresh_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Grants to revoke at GitHub after a disconnect (the harvest job's `revoke` stage), encrypted as above.
create table work.github_revocations (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  access_token bytea not null,
  refresh_token bytea,
  created_at timestamptz not null default now()
);

create table work.github_installations (
  installation_id bigint primary key check (installation_id > 0),
  account_id bigint not null check (account_id > 0),
  account_login text not null check (account_login ~ '^[A-Za-z0-9-]{1,39}$'),
  account_type text not null check (account_type in ('User', 'Organization')),
  repository_selection text not null default 'selected' check (repository_selection in ('all', 'selected')),
  suspended_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table work.github_user_installations (
  user_id uuid not null,
  installation_id bigint not null references work.github_installations (installation_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, installation_id)
);
create index github_user_installations_installation_idx on work.github_user_installations (installation_id);

create table work.github_repos (
  repo_id bigint primary key check (repo_id > 0),
  full_name text not null check (full_name ~ '^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$' and char_length(full_name) <= 140),
  owner_id bigint not null check (owner_id > 0),
  private boolean not null,
  fork boolean not null default false,
  parent_full_name text check (parent_full_name is null or char_length(parent_full_name) <= 140),
  template_full_name text check (template_full_name is null or char_length(template_full_name) <= 140),
  default_branch text check (default_branch is null or char_length(default_branch) <= 255),
  pushed_at timestamptz,
  languages text[] not null default '{}' check (cardinality(languages) <= 100),
  linguist_excludes text[] not null default '{}' check (cardinality(linguist_excludes) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table work.github_user_repos (
  user_id uuid not null,
  repo_id bigint not null references work.github_repos (repo_id) on delete cascade,
  installation_id bigint not null,
  kind text check (kind is null or kind in ('owned', 'collaborator', 'fork', 'template')),
  excluded boolean not null default false,
  discovered_at timestamptz not null default now(),
  classified_at timestamptz,
  last_synced_at timestamptz,
  harvested_at timestamptz,
  agent_prs_checked_at timestamptz,
  primary key (user_id, repo_id)
);
create index github_user_repos_installation_idx on work.github_user_repos (installation_id);
create index github_user_repos_repo_idx on work.github_user_repos (repo_id);

-- sync_jobs today: one open sync per student; `pending` counts queued stages.
create table work.github_sync_jobs (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  trigger text not null check (trigger in ('connect', 'resync', 'webhook', 'nightly')),
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'cancelled')),
  stage text check (stage is null or stage ~ '^[a-z_]{1,30}$'),
  repos_total integer not null default 0 check (repos_total >= 0),
  repos_done integer not null default 0 check (repos_done >= 0),
  commits_analysed integer not null default 0 check (commits_analysed >= 0),
  skills_found integer not null default 0 check (skills_found >= 0),
  pending integer not null default 0 check (pending >= 0),
  error text check (error is null or char_length(error) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create unique index github_sync_jobs_one_open on work.github_sync_jobs (user_id) where status in ('queued', 'running');
create index github_sync_jobs_user_idx on work.github_sync_jobs (user_id, created_at desc);

-- A GitHub account already linked to another student (staff look into these).
create table work.github_link_clashes (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  github_id bigint not null,
  github_login text not null,
  linked_user_id uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);
create index github_link_clashes_user_idx on work.github_link_clashes (user_id);

-- GitHub webhook deliveries as web verified and stored them (one per delivery id), applied by the harvest job.
create table work.github_webhook_events (
  delivery_id uuid primary key,
  event text not null check (event ~ '^[a-z_]{1,60}$'),
  action text check (action is null or action ~ '^[a-z_]{1,60}$'),
  installation_id bigint,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);
create index github_webhook_events_received_idx on work.github_webhook_events (received_at);

create table work.github_upstream_blobs (
  repo_id bigint not null,
  blob_sha text not null check (blob_sha ~ '^[0-9a-f]{40}$'),
  primary key (repo_id, blob_sha)
);

create table work.github_commit_blobs (
  blob_sha text not null check (blob_sha ~ '^[0-9a-f]{40}$'),
  user_id uuid not null,
  repo_id bigint not null,
  sha text not null,
  primary key (blob_sha, user_id, repo_id, sha)
);
create index github_commit_blobs_commit_idx on work.github_commit_blobs (user_id, repo_id, sha);

create table work.github_commits (
  user_id uuid not null,
  repo_id bigint not null,
  sha text not null check (sha ~ '^[0-9a-f]{40}$'),
  authored_at timestamptz,
  occurred_at timestamptz not null,
  seen_via text not null check (seen_via in ('harvest', 'push')),
  signed boolean not null default false,
  files integer not null default 0 check (files >= 0),
  meaningful_lines integer not null default 0 check (meaningful_lines between 0 and 400),
  status text not null default 'pending' check (status in ('pending', 'counted', 'held', 'excluded')),
  exclusion text check (exclusion is null or exclusion in ('merge', 'too_many_files', 'rename_only', 'formatting_only', 'bulk_import', 'rewritten', 'review')),
  first_seen_at timestamptz not null default now(),
  extracted_at timestamptz,
  ai_agent text check (ai_agent is null or char_length(ai_agent) between 3 and 200),
  via_pr integer check (via_pr is null or via_pr > 0),
  primary key (user_id, repo_id, sha),
  check (ai_agent is null or via_pr is not null)
);
create index github_commits_agent_idx on work.github_commits (user_id, repo_id) where ai_agent is not null;
create index github_commits_pending_idx on work.github_commits (user_id, repo_id) where extracted_at is null;
create index github_commits_user_occurred_idx on work.github_commits (user_id, occurred_at);

create table work.skill_evidence (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  skill_id text not null references work.skills (id),
  source text not null default 'commit' check (source = 'commit'),
  repo_id bigint not null,
  sha text not null,
  detectors text[] not null check (detectors <@ array['lines', 'file', 'path', 'manifest', 'import'] and cardinality(detectors) > 0),
  paths text[] not null default '{}' check (cardinality(paths) <= 10),
  lines integer not null default 0 check (lines between 0 and 400),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, repo_id, sha, skill_id)
);
create index skill_evidence_skill_idx on work.skill_evidence (skill_id);
create index skill_evidence_user_skill_idx on work.skill_evidence (user_id, skill_id);

create table work.github_pull_requests (
  user_id uuid not null,
  repo_github_id bigint not null,
  number integer not null check (number > 0),
  pr_github_id bigint not null,
  repo_full_name text not null check (char_length(repo_full_name) between 3 and 140),
  repo_private boolean not null,
  merged_at timestamptz not null,
  approver_github_id bigint,
  counted boolean not null,
  exclusion text check (exclusion is null or exclusion in ('own_repo', 'no_other_human', 'young_account')),
  files integer not null default 0 check (files >= 0),
  seen_at timestamptz not null default now(),
  primary key (user_id, repo_github_id, number),
  check (counted = (exclusion is null)),
  check (not counted or approver_github_id is not null)
);
create index github_pull_requests_counted_idx on work.github_pull_requests (user_id, merged_at) where counted;

create table work.github_pr_skills (
  user_id uuid not null,
  repo_github_id bigint not null,
  number integer not null,
  skill_id text not null references work.skills (id),
  paths text[] not null default '{}' check (cardinality(paths) <= 10),
  primary key (user_id, repo_github_id, number, skill_id),
  foreign key (user_id, repo_github_id, number) references work.github_pull_requests (user_id, repo_github_id, number) on delete cascade
);
create index github_pr_skills_skill_idx on work.github_pr_skills (skill_id);

-- Anti-gaming flags on GitHub evidence (bursts, backdating, cross-account duplicates), reviewed by Trust staff.
create table work.review_flags (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  kind text not null check (kind in ('burst', 'backdating', 'cross_account_duplicate')),
  key text not null check (char_length(key) between 1 and 100),
  refs jsonb not null default '{}'::jsonb check (jsonb_typeof(refs) = 'object'),
  status text not null default 'open' check (status in ('open', 'cleared', 'upheld')),
  reviewer_id uuid,
  note text check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  claimed_by uuid,
  claimed_at timestamptz,
  unique (user_id, kind, key)
);
create index review_flags_open_idx on work.review_flags (created_at) where status = 'open';

-- The commits a flag holds back from counting until staff decide.
create table work.review_flag_commits (
  flag_id bigint not null references work.review_flags (id) on delete cascade,
  user_id uuid not null,
  repo_id bigint not null,
  sha text not null,
  primary key (flag_id, user_id, repo_id, sha)
);
create index review_flag_commits_commit_idx on work.review_flag_commits (user_id, repo_id, sha);

-- As today: unsharing a repository (or disconnecting) takes its commits and what they showed with it.
alter table work.github_user_repos add foreign key (installation_id) references work.github_installations (installation_id) on delete cascade;
alter table work.github_commits add foreign key (user_id, repo_id) references work.github_user_repos (user_id, repo_id) on delete cascade;
alter table work.skill_evidence add foreign key (user_id, repo_id, sha) references work.github_commits (user_id, repo_id, sha) on delete cascade;
alter table work.github_commit_blobs add foreign key (user_id, repo_id, sha) references work.github_commits (user_id, repo_id, sha) on delete cascade;
alter table work.review_flag_commits add foreign key (user_id, repo_id, sha) references work.github_commits (user_id, repo_id, sha) on delete cascade;

-- Each student's level per skill (L1 to L4), recomputed from the evidence and the proofs.
create table work.user_skills (
  user_id uuid not null,
  skill_id text not null references work.skills (id),
  level smallint not null check (level between 0 and 4),
  active_days integer not null default 0 check (active_days >= 0),
  lines integer not null default 0 check (lines >= 0),
  hits integer not null default 0 check (hits >= 0),
  repos integer not null default 0 check (repos >= 0),
  last_used_at timestamptz,
  peer_verified boolean not null default false,
  ai_lines integer not null default 0,
  ai_assisted boolean not null default false,
  -- When the skill first reached L2 (paths, openings matching).
  l2_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);
create index user_skills_skill_level_idx on work.user_skills (skill_id, level);
create index user_skills_l2_idx on work.user_skills (skill_id, l2_at) where level >= 2;

-- Row-level security: enabled and forced on every table, one policy for the owning role.
alter table work.github_accounts enable row level security;
alter table work.github_accounts force row level security;
create policy github_accounts_owner on work.github_accounts for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.github_accounts to svc_work;

alter table work.github_tokens enable row level security;
alter table work.github_tokens force row level security;
create policy github_tokens_owner on work.github_tokens for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.github_tokens to svc_work;

alter table work.github_revocations enable row level security;
alter table work.github_revocations force row level security;
create policy github_revocations_owner on work.github_revocations for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.github_revocations to svc_work;

alter table work.github_installations enable row level security;
alter table work.github_installations force row level security;
create policy github_installations_owner on work.github_installations for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.github_installations to svc_work;

alter table work.github_user_installations enable row level security;
alter table work.github_user_installations force row level security;
create policy github_user_installations_owner on work.github_user_installations for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.github_user_installations to svc_work;

alter table work.github_repos enable row level security;
alter table work.github_repos force row level security;
create policy github_repos_owner on work.github_repos for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.github_repos to svc_work;

alter table work.github_user_repos enable row level security;
alter table work.github_user_repos force row level security;
create policy github_user_repos_owner on work.github_user_repos for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.github_user_repos to svc_work;

alter table work.github_sync_jobs enable row level security;
alter table work.github_sync_jobs force row level security;
create policy github_sync_jobs_owner on work.github_sync_jobs for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.github_sync_jobs to svc_work;

alter table work.github_link_clashes enable row level security;
alter table work.github_link_clashes force row level security;
create policy github_link_clashes_owner on work.github_link_clashes for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.github_link_clashes to svc_work;

alter table work.github_webhook_events enable row level security;
alter table work.github_webhook_events force row level security;
create policy github_webhook_events_owner on work.github_webhook_events for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.github_webhook_events to svc_work;

alter table work.github_upstream_blobs enable row level security;
alter table work.github_upstream_blobs force row level security;
create policy github_upstream_blobs_owner on work.github_upstream_blobs for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.github_upstream_blobs to svc_work;

alter table work.github_commit_blobs enable row level security;
alter table work.github_commit_blobs force row level security;
create policy github_commit_blobs_owner on work.github_commit_blobs for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.github_commit_blobs to svc_work;

alter table work.github_commits enable row level security;
alter table work.github_commits force row level security;
create policy github_commits_owner on work.github_commits for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.github_commits to svc_work;

alter table work.skill_evidence enable row level security;
alter table work.skill_evidence force row level security;
create policy skill_evidence_owner on work.skill_evidence for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.skill_evidence to svc_work;

alter table work.github_pull_requests enable row level security;
alter table work.github_pull_requests force row level security;
create policy github_pull_requests_owner on work.github_pull_requests for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.github_pull_requests to svc_work;

alter table work.github_pr_skills enable row level security;
alter table work.github_pr_skills force row level security;
create policy github_pr_skills_owner on work.github_pr_skills for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.github_pr_skills to svc_work;

alter table work.review_flags enable row level security;
alter table work.review_flags force row level security;
create policy review_flags_owner on work.review_flags for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.review_flags to svc_work;

alter table work.review_flag_commits enable row level security;
alter table work.review_flag_commits force row level security;
create policy review_flag_commits_owner on work.review_flag_commits for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.review_flag_commits to svc_work;

alter table work.user_skills enable row level security;
alter table work.user_skills force row level security;
create policy user_skills_owner on work.user_skills for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.user_skills to svc_work;

grant usage on sequence work.github_revocations_id_seq to svc_work;
grant usage on sequence work.github_sync_jobs_id_seq to svc_work;
grant usage on sequence work.github_link_clashes_id_seq to svc_work;
grant usage on sequence work.skill_evidence_id_seq to svc_work;
grant usage on sequence work.review_flags_id_seq to svc_work;
