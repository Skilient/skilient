-- content: posts, comments, polls, post RSVPs, hides, link previews, the micro-survey, views and stats, the
-- ranked feed (docs/azure/prd.md, service catalogue). Forward-only. Every table: row-level security enabled
-- and forced, one policy for the owning role (prd.md, "Layout"). No foreign key leaves the schema: user,
-- university, venture and society ids come from their owners' events.
-- Ported from apps/web/supabase/migrations (_posts, _comments_links, _micro_survey, _feed_ranking,
-- _feed_two_step, _reports, _uni_comms, _societies); docs/azure/content-function-bins.md maps every function.

-- ---------------------------------------------------------------------------
-- Posts
-- ---------------------------------------------------------------------------
create table content.posts (
  id uuid primary key,
  author_id uuid not null,
  -- The author's university when posting (a society's for "post as"): the University Feed it belongs to.
  university_id uuid,
  audience text not null check (audience in ('university', 'global')),
  type text not null check (type in ('general', 'invite', 'announcement', 'event', 'poll', 'shipped')),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  venture_id uuid,
  society_id uuid,
  stage text not null default 'seed' check (stage in ('seed', 'limited', 'full', 'global_boost', 'demoted', 'held')),
  stage_changed_at timestamptz not null default now(),
  pinned_until timestamptz,
  edited_at timestamptz,
  -- The first URL in the body (the link preview's key).
  link_url text check (link_url is null or char_length(link_url) <= 2000),
  -- Removed by staff (trust's content.removed): hidden from everyone, the author included.
  removed_at timestamptz,
  removed_by uuid,
  -- Hidden by the university (market, W11).
  hidden_by_university_at timestamptz,
  created_at timestamptz not null default now(),
  check ((type in ('invite', 'shipped')) = (venture_id is not null)),
  check (pinned_until is null or type = 'announcement'),
  check (university_id is not null or audience = 'global')
);
create index posts_university_created_idx on content.posts (university_id, created_at desc);
create index posts_global_created_idx on content.posts (created_at desc) where audience = 'global';
create index posts_author_created_idx on content.posts (author_id, created_at desc);
create index posts_venture_idx on content.posts (venture_id) where venture_id is not null;
create index posts_pinned_idx on content.posts (pinned_until) where pinned_until is not null;
create index posts_stage_idx on content.posts (stage, created_at desc);
create unique index posts_shipped_once_idx on content.posts (venture_id) where type = 'shipped';

create table content.post_media (
  post_id uuid not null references content.posts (id) on delete cascade,
  position smallint not null check (position between 1 and 4),
  path text not null check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  width integer not null check (width between 1 and 4000),
  height integer not null check (height between 1 and 4000),
  primary key (post_id, position)
);

create table content.post_events (
  post_id uuid primary key references content.posts (id) on delete cascade,
  starts_at timestamptz not null,
  place text check (place is null or char_length(btrim(place)) between 2 and 120),
  url text check (url is null or (url ~ '^https://[^\s]+$' and char_length(url) <= 500)),
  check (place is not null or url is not null)
);

create table content.event_rsvps (
  post_id uuid not null references content.post_events (post_id) on delete cascade,
  user_id uuid not null,
  status text not null check (status in ('going', 'interested')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index event_rsvps_user_idx on content.event_rsvps (user_id);

create table content.post_polls (
  post_id uuid primary key references content.posts (id) on delete cascade,
  closes_at timestamptz not null
);

create table content.poll_options (
  post_id uuid not null references content.post_polls (post_id) on delete cascade,
  position smallint not null check (position between 1 and 4),
  label text not null check (char_length(btrim(label)) between 1 and 80),
  primary key (post_id, position)
);

create table content.poll_votes (
  post_id uuid not null references content.post_polls (post_id) on delete cascade,
  user_id uuid not null,
  position smallint not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id),
  foreign key (post_id, position) references content.poll_options (post_id, position) on delete cascade
);
create index poll_votes_user_idx on content.poll_votes (user_id);

-- University announcements (phase 9): who a university's announcement reaches. Written by market's
-- announcement method (W11); read by content's visibility rule.
create table content.announcement_meta (
  post_id uuid primary key references content.posts (id) on delete cascade,
  university_id uuid not null,
  category text check (category is null or char_length(category) between 2 and 40),
  expires_at timestamptz not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table content.announcement_targets (
  post_id uuid not null references content.announcement_meta (post_id) on delete cascade,
  department_id uuid,
  batch_year smallint check (batch_year is null or batch_year between 1980 and 2100),
  check (department_id is not null or batch_year is not null)
);
create index announcement_targets_post_idx on content.announcement_targets (post_id);

-- ---------------------------------------------------------------------------
-- Comments, hides, link previews
-- ---------------------------------------------------------------------------
create table content.post_comments (
  id uuid primary key,
  post_id uuid not null references content.posts (id) on delete cascade,
  parent_id uuid references content.post_comments (id) on delete cascade,
  author_id uuid not null,
  body text not null check (char_length(body) <= 1000),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  removed_by uuid,
  hidden_by_university_at timestamptz,
  check (deleted_at is not null or char_length(btrim(body)) >= 1),
  check (not pinned or parent_id is null)
);
create index post_comments_post_idx on content.post_comments (post_id, created_at);
create index post_comments_parent_idx on content.post_comments (parent_id) where parent_id is not null;
create index post_comments_author_idx on content.post_comments (author_id);
create unique index post_comments_one_pinned_idx on content.post_comments (post_id) where pinned;

create table content.post_hides (
  user_id uuid not null,
  post_id uuid not null references content.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index post_hides_post_idx on content.post_hides (post_id);

create table content.link_previews (
  url_hash text primary key check (url_hash ~ '^[0-9a-f]{64}$'),
  url text not null check (char_length(url) <= 2000),
  status text not null check (status in ('ok', 'failed')),
  title text check (char_length(title) <= 300),
  description text check (char_length(description) <= 500),
  image_url text check (image_url is null or (image_url ~ '^https://' and char_length(image_url) <= 2000)),
  site_name text check (char_length(site_name) <= 100),
  fetched_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Micro-survey, views, stats (PRD 5.28)
-- ---------------------------------------------------------------------------
create table content.survey_dimensions (
  dimension text primary key check (dimension ~ '^[a-z_]{3,40}$'),
  label text not null,
  public boolean not null default false,
  public_phrase text,
  post_types text[] not null,
  tie_priority smallint not null default 0,
  check (not public or public_phrase is not null),
  check (not post_types && array['announcement', 'poll'])
);

create table content.survey_questions (
  id smallint primary key,
  dimension text not null references content.survey_dimensions (dimension),
  text text not null check (char_length(text) between 5 and 120),
  active boolean not null default true,
  unique (dimension, text)
);
create index survey_questions_dimension_idx on content.survey_questions (dimension) where active;

-- The launch catalogue, with the ids the current stack gave them (identity column order), so imported
-- assignments keep pointing at the same questions.
insert into content.survey_dimensions (dimension, label, public, public_phrase, post_types, tie_priority) values
  ('informative', 'Informative', true, 'find this informative', '{general,invite,event,shipped}', 0),
  ('interesting', 'Interesting', true, 'find this interesting', '{general,invite,event,shipped}', 0),
  ('relevant', 'Relevant', false, null, '{general,invite,event,shipped}', 0),
  ('credible', 'Credible', false, null, '{general,invite,event,shipped}', 2),
  ('useful', 'Useful', false, null, '{general,shipped}', 0),
  ('clear', 'Clear', false, null, '{general,invite,event}', 0),
  ('original', 'Original', false, null, '{general,shipped}', 0),
  ('worth_sharing', 'Worth sharing', false, null, '{general,invite,event,shipped}', 0),
  ('appropriate', 'Appropriate', false, null, '{general,invite,event,shipped}', 1),
  ('impressive', 'Impressive work', false, null, '{shipped}', 0),
  ('would_join', 'Would join', false, null, '{invite}', 0),
  ('would_attend', 'Would attend', false, null, '{event}', 0);
insert into content.survey_questions (id, dimension, text) values
  (1, 'informative', 'Did you learn something from this?'),
  (2, 'informative', 'Was this informative?'),
  (3, 'interesting', 'Was this interesting to you?'),
  (4, 'interesting', 'Would you want to see more like this?'),
  (5, 'relevant', 'Is this relevant to you?'),
  (6, 'relevant', 'Does this matter to students like you?'),
  (7, 'credible', 'Does this seem accurate?'),
  (8, 'credible', 'Do you trust this information?'),
  (9, 'useful', 'Could you use this in your own work or studies?'),
  (10, 'useful', 'Is this useful to you?'),
  (11, 'clear', 'Was this clearly explained?'),
  (12, 'clear', 'Is it clear what this is about?'),
  (13, 'original', 'Is this something new to you?'),
  (14, 'original', 'Is this original work or thinking?'),
  (15, 'worth_sharing', 'Should more students see this?'),
  (16, 'worth_sharing', 'Would you tell a friend about this?'),
  (17, 'appropriate', 'Is this appropriate for Skilient?'),
  (18, 'impressive', 'Is this impressive work?'),
  (19, 'impressive', 'Would you be proud to have built this?'),
  (20, 'would_join', 'Would you join a project like this?'),
  (21, 'would_join', 'Does this team sound worth joining?'),
  (22, 'would_attend', 'Would you attend something like this?'),
  (23, 'would_attend', 'Does this event sound worth going to?'),
  (24, 'relevant', 'Is this useful for your degree or career?'),
  (25, 'credible', 'Does this sound like it''s from someone who knows?');

create table content.post_views (
  post_id uuid not null references content.posts (id) on delete cascade,
  user_id uuid not null,
  first_seen_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_views_user_idx on content.post_views (user_id, first_seen_at desc);

create table content.survey_assignments (
  post_id uuid not null references content.posts (id) on delete cascade,
  user_id uuid not null,
  question_id smallint not null references content.survey_questions (id),
  dimension text not null references content.survey_dimensions (dimension),
  assigned_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index survey_assignments_user_idx on content.survey_assignments (user_id);

create table content.survey_responses (
  post_id uuid not null,
  user_id uuid not null,
  question_id smallint not null references content.survey_questions (id),
  dimension text not null references content.survey_dimensions (dimension),
  answer boolean not null,
  latency_ms integer not null check (latency_ms >= 0),
  weight numeric(4, 3) not null check (weight > 0 and weight <= 1),
  created_at timestamptz not null default now(),
  locked_at timestamptz not null,
  updated_at timestamptz,
  primary key (post_id, user_id),
  foreign key (post_id, user_id) references content.survey_assignments (post_id, user_id) on delete cascade
);
create index survey_responses_user_idx on content.survey_responses (user_id, created_at desc);

create table content.post_survey_counts (
  post_id uuid not null references content.posts (id) on delete cascade,
  dimension text not null references content.survey_dimensions (dimension),
  assigned integer not null default 0,
  ticks integer not null default 0,
  crosses integer not null default 0,
  weighted_ticks numeric not null default 0,
  weighted_crosses numeric not null default 0,
  primary key (post_id, dimension)
);

create table content.post_stats (
  post_id uuid primary key references content.posts (id) on delete cascade,
  views integer not null default 0,
  hides integer not null default 0,
  answers integer not null default 0,
  positives integer not null default 0,
  commenters integer not null default 0,
  commenter_universities integer not null default 0,
  appropriate_flags integer not null default 0,
  -- Open reports, from trust (post.reports_changed, W10).
  reports integer not null default 0,
  updated_at timestamptz not null default now()
);
create index post_stats_updated_idx on content.post_stats (updated_at desc);

-- ---------------------------------------------------------------------------
-- The ranked feed: one ranked list per reader, audience and filter, kept for a session
-- ---------------------------------------------------------------------------
create table content.feed_sessions (
  session_id uuid primary key,
  user_id uuid not null,
  audience text not null check (audience in ('university', 'global')),
  filter text not null check (filter in ('all', 'ventures', 'events', 'announcements', 'shipped', 'societies')),
  post_ids uuid[] not null,
  created_at timestamptz not null default now()
);
create index feed_sessions_user_idx on content.feed_sessions (user_id, created_at desc);

-- Settings (feed.*, survey.*): trust's config.changed (W10) writes a key's newest value here; absent keys
-- use the launch values in src/domain/config.ts.
create table content.config (
  key text primary key check (key ~ '^[a-z][a-z0-9_.]{1,80}$'),
  version integer not null check (version >= 1),
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Accounts already deleted: a late event for one of them is ignored.
create table content.deleted_accounts (
  user_id uuid primary key,
  deleted_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row-level security: default deny, one policy for the owning role.
-- ---------------------------------------------------------------------------
alter table content.posts enable row level security;
alter table content.posts force row level security;
create policy posts_owner on content.posts for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.posts to svc_content;

alter table content.post_media enable row level security;
alter table content.post_media force row level security;
create policy post_media_owner on content.post_media for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.post_media to svc_content;

alter table content.post_events enable row level security;
alter table content.post_events force row level security;
create policy post_events_owner on content.post_events for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.post_events to svc_content;

alter table content.event_rsvps enable row level security;
alter table content.event_rsvps force row level security;
create policy event_rsvps_owner on content.event_rsvps for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.event_rsvps to svc_content;

alter table content.post_polls enable row level security;
alter table content.post_polls force row level security;
create policy post_polls_owner on content.post_polls for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.post_polls to svc_content;

alter table content.poll_options enable row level security;
alter table content.poll_options force row level security;
create policy poll_options_owner on content.poll_options for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.poll_options to svc_content;

alter table content.poll_votes enable row level security;
alter table content.poll_votes force row level security;
create policy poll_votes_owner on content.poll_votes for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.poll_votes to svc_content;

alter table content.announcement_meta enable row level security;
alter table content.announcement_meta force row level security;
create policy announcement_meta_owner on content.announcement_meta for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.announcement_meta to svc_content;

alter table content.announcement_targets enable row level security;
alter table content.announcement_targets force row level security;
create policy announcement_targets_owner on content.announcement_targets for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.announcement_targets to svc_content;

alter table content.post_comments enable row level security;
alter table content.post_comments force row level security;
create policy post_comments_owner on content.post_comments for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.post_comments to svc_content;

alter table content.post_hides enable row level security;
alter table content.post_hides force row level security;
create policy post_hides_owner on content.post_hides for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.post_hides to svc_content;

alter table content.link_previews enable row level security;
alter table content.link_previews force row level security;
create policy link_previews_owner on content.link_previews for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.link_previews to svc_content;

alter table content.survey_dimensions enable row level security;
alter table content.survey_dimensions force row level security;
create policy survey_dimensions_owner on content.survey_dimensions for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.survey_dimensions to svc_content;

alter table content.survey_questions enable row level security;
alter table content.survey_questions force row level security;
create policy survey_questions_owner on content.survey_questions for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.survey_questions to svc_content;

alter table content.post_views enable row level security;
alter table content.post_views force row level security;
create policy post_views_owner on content.post_views for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.post_views to svc_content;

alter table content.survey_assignments enable row level security;
alter table content.survey_assignments force row level security;
create policy survey_assignments_owner on content.survey_assignments for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.survey_assignments to svc_content;

alter table content.survey_responses enable row level security;
alter table content.survey_responses force row level security;
create policy survey_responses_owner on content.survey_responses for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.survey_responses to svc_content;

alter table content.post_survey_counts enable row level security;
alter table content.post_survey_counts force row level security;
create policy post_survey_counts_owner on content.post_survey_counts for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.post_survey_counts to svc_content;

alter table content.post_stats enable row level security;
alter table content.post_stats force row level security;
create policy post_stats_owner on content.post_stats for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.post_stats to svc_content;

alter table content.feed_sessions enable row level security;
alter table content.feed_sessions force row level security;
create policy feed_sessions_owner on content.feed_sessions for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.feed_sessions to svc_content;

alter table content.config enable row level security;
alter table content.config force row level security;
create policy config_owner on content.config for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.config to svc_content;

alter table content.deleted_accounts enable row level security;
alter table content.deleted_accounts force row level security;
create policy deleted_accounts_owner on content.deleted_accounts for all to svc_content using (true) with check (true);
grant select, insert, update, delete on content.deleted_accounts to svc_content;
