-- people: profiles, universities and departments, friends, blocks, mutes, privacy settings, onboarding,
-- tours and tips, page shell, people search, suggestions (docs/azure/prd.md, service catalogue).
-- Forward-only. Every table: row-level security enabled and forced, one policy for the owning role
-- (prd.md, "Layout"). No foreign key leaves the schema: user ids come from identity's events.
-- Ported from apps/web/supabase/migrations (_identity, _friends_blocks, _comments_links, _student_portal,
-- _uni_core, _marketing, _share_reach_push); docs/azure/people-function-bins.md maps every function.

create function people.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Universities, domains, departments, programmes, requests
-- ---------------------------------------------------------------------------
create table people.universities (
  id uuid primary key,
  name text not null unique check (char_length(name) between 2 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  city text check (city is null or char_length(city) between 1 and 80),
  province text check (province is null or province in ('Punjab', 'Sindh', 'KP', 'Balochistan', 'ICT', 'AJK', 'GB')),
  -- Signups open at live_at (phase 12); null = closed. New universities are open unless staff close them.
  live_at timestamptz default now(),
  -- An exception to the 1 September graduation rule (phase 6).
  final_year_batch smallint check (final_year_batch is null or final_year_batch between 1980 and 2100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger universities_set_updated_at before update on people.universities for each row execute function people.set_updated_at();

create table people.university_domains (
  university_id uuid not null references people.universities (id) on delete cascade,
  domain text not null check (char_length(domain) <= 253 and domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'),
  kind text not null default 'both' check (kind in ('student', 'faculty', 'both')),
  source text not null default 'hec_seed' check (source in ('hec_seed', 'ops')),
  created_at timestamptz not null default now(),
  primary key (university_id, domain)
);
create index university_domains_domain_idx on people.university_domains (domain);

create table people.departments (
  id uuid primary key,
  university_id uuid not null references people.universities (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  created_at timestamptz not null default now()
);
create unique index departments_name_idx on people.departments (university_id, lower(name));

create table people.programmes (
  id uuid primary key,
  department_id uuid not null references people.departments (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  created_at timestamptz not null default now()
);
create unique index programmes_name_idx on people.programmes (department_id, lower(name));

-- "Tell me when my university joins" (phase 12). The email stays here and never enters an event.
create table people.university_requests (
  id uuid primary key,
  email text not null unique check (char_length(email) between 6 and 254 and email = lower(email) and email ~ '^[^\s@]+@[^\s@]+$'),
  domain text not null check (char_length(domain) between 3 and 253),
  university_id uuid references people.universities (id) on delete set null,
  university_name text check (university_name is null or char_length(btrim(university_name)) between 2 and 200),
  consent boolean not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  confirmed_at timestamptz,
  notified_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  check (university_id is not null or university_name is not null)
);
create index university_requests_domain_idx on people.university_requests (domain, created_at desc);

-- ---------------------------------------------------------------------------
-- Profiles and onboarding
-- ---------------------------------------------------------------------------
create table people.profiles (
  user_id uuid primary key,
  role text not null default 'student' check (role in ('student', 'faculty', 'recruiter', 'university_admin')),
  university_id uuid references people.universities (id) on delete restrict,
  -- The domain of the account's email (identity's GetSignupDetails and user.email_domain_changed; W2 Q9).
  email_domain text,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 60),
  username text unique check (username ~ '^[a-z0-9_]{3,30}$'),
  department text check (department is null or char_length(department) between 2 and 80),
  department_id uuid references people.departments (id) on delete set null,
  programme text check (programme is null or char_length(programme) between 2 and 80),
  graduation_year smallint check (graduation_year is null or graduation_year between 1980 and 2100),
  campus text check (campus is null or char_length(campus) between 2 and 60),
  bio text check (bio is null or char_length(bio) <= 280),
  avatar_path text check (avatar_path is null or (starts_with(avatar_path, user_id::text || '/') and char_length(avatar_path) <= 200)),
  cover_path text check (cover_path is null or (starts_with(cover_path, user_id::text || '/') and char_length(cover_path) <= 200)),
  visibility text not null default 'university' check (visibility in ('friends', 'university', 'global')),
  recruiter_visible boolean not null default false,
  looking_for text[] not null default '{}' check (looking_for <@ array['internship', 'job', 'teammates', 'project', 'mentorship']),
  availability text[] not null default '{}' check (availability <@ array['internship', 'full_time', 'part_time']),
  city text check (city is null or char_length(city) between 2 and 60),
  remote_ok boolean not null default false,
  onboarding_complete boolean not null default false,
  chat_read_receipts boolean not null default true,
  leaderboard_opt_out boolean not null default false,
  -- active and graduate are people's; deleting mirrors identity's deletion state (decision Q4, advisor).
  status text not null default 'active' check (status in ('active', 'graduate', 'deleting')),
  graduated_at timestamptz,
  delete_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    to_tsvector('simple', coalesce(full_name, '') || ' ' || coalesce(username, '') || ' ' || coalesce(department, ''))
  ) stored,
  check ((status = 'deleting') = (delete_after is not null))
);
create trigger profiles_set_updated_at before update on people.profiles for each row execute function people.set_updated_at();
create index profiles_university_cohort_idx on people.profiles (university_id, department, graduation_year);
create index profiles_department_id_idx on people.profiles (department_id);
create index profiles_search_idx on people.profiles using gin (search);
create index profiles_name_trgm_idx on people.profiles using gin (full_name extensions.gin_trgm_ops);
create index profiles_username_trgm_idx on people.profiles using gin (username extensions.gin_trgm_ops);

create table people.onboarding_state (
  user_id uuid primary key references people.profiles (user_id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'faculty', 'recruiter', 'university_admin')),
  step smallint not null default 1 check (step between 1 and 6),
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 16384),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger onboarding_state_set_updated_at before update on people.onboarding_state for each row execute function people.set_updated_at();

-- ---------------------------------------------------------------------------
-- Friends, blocks, mutes, suggestion dismissals
-- ---------------------------------------------------------------------------
create table people.friend_requests (
  id uuid primary key,
  sender_id uuid not null references people.profiles (user_id) on delete cascade,
  receiver_id uuid not null references people.profiles (user_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_id <> receiver_id),
  check ((status = 'pending') = (responded_at is null))
);
create unique index friend_requests_live_pair_idx on people.friend_requests (least(sender_id, receiver_id), greatest(sender_id, receiver_id))
  where status in ('pending', 'accepted');
create index friend_requests_receiver_pending_idx on people.friend_requests (receiver_id, created_at desc) where status = 'pending';
create index friend_requests_sender_pending_idx on people.friend_requests (sender_id, created_at desc) where status = 'pending';

create table people.friendships (
  user_id_a uuid not null references people.profiles (user_id) on delete cascade,
  user_id_b uuid not null references people.profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id_a, user_id_b),
  check (user_id_a < user_id_b)
);
create index friendships_b_idx on people.friendships (user_id_b, user_id_a);

create table people.blocks (
  blocker_id uuid not null references people.profiles (user_id) on delete cascade,
  blocked_id uuid not null references people.profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on people.blocks (blocked_id, blocker_id);

create table people.user_mutes (
  user_id uuid not null references people.profiles (user_id) on delete cascade,
  muted_id uuid not null references people.profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, muted_id),
  check (user_id <> muted_id)
);
create index user_mutes_muted_idx on people.user_mutes (muted_id);

create table people.pymk_dismissals (
  user_id uuid not null references people.profiles (user_id) on delete cascade,
  dismissed_id uuid not null references people.profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, dismissed_id),
  check (user_id <> dismissed_id)
);
create index pymk_dismissals_dismissed_idx on people.pymk_dismissals (dismissed_id);

-- ---------------------------------------------------------------------------
-- Learning layer: small UI state, tours, tips
-- ---------------------------------------------------------------------------
create table people.ui_state (
  user_id uuid not null references people.profiles (user_id) on delete cascade,
  key text not null check (key ~ '^[a-z_]{2,40}$'),
  value jsonb not null default 'null',
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table people.tour_progress (
  user_id uuid not null references people.profiles (user_id) on delete cascade,
  tour_id text not null check (tour_id in ('student', 'faculty', 'recruiter', 'uni_admin')),
  step smallint not null default 0 check (step between 0 and 50),
  completed_at timestamptz,
  skipped_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, tour_id)
);

create table people.tips_seen (
  user_id uuid not null references people.profiles (user_id) on delete cascade,
  tip_id text not null check (tip_id in ('opportunities', 'venture', 'cv', 'score', 'privacy')),
  seen_at timestamptz not null default now(),
  primary key (user_id, tip_id)
);

-- ---------------------------------------------------------------------------
-- Staff audit (decision Q4 pattern: before and after, in the same transaction, plus audit.recorded)
-- ---------------------------------------------------------------------------
create table people.audit_log (
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
create index audit_log_staff_idx on people.audit_log (staff_id, created_at);
create index audit_log_target_idx on people.audit_log (target_type, target_id, created_at);

-- Accounts whose deletion people has carried out (user.deleted), so a replayed event confirms once.
create table people.deleted_accounts (
  user_id uuid primary key,
  deleted_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row-level security: default deny, one policy for the owning role.
-- ---------------------------------------------------------------------------
alter table people.universities enable row level security;
alter table people.universities force row level security;
create policy universities_owner on people.universities for all to svc_people using (true) with check (true);
grant select, insert, update, delete on people.universities to svc_people;

alter table people.university_domains enable row level security;
alter table people.university_domains force row level security;
create policy university_domains_owner on people.university_domains for all to svc_people using (true) with check (true);
grant select, insert, update, delete on people.university_domains to svc_people;

alter table people.departments enable row level security;
alter table people.departments force row level security;
create policy departments_owner on people.departments for all to svc_people using (true) with check (true);
grant select, insert, update, delete on people.departments to svc_people;

alter table people.programmes enable row level security;
alter table people.programmes force row level security;
create policy programmes_owner on people.programmes for all to svc_people using (true) with check (true);
grant select, insert, update, delete on people.programmes to svc_people;

alter table people.university_requests enable row level security;
alter table people.university_requests force row level security;
create policy university_requests_owner on people.university_requests for all to svc_people using (true) with check (true);
grant select, insert, update, delete on people.university_requests to svc_people;

alter table people.profiles enable row level security;
alter table people.profiles force row level security;
create policy profiles_owner on people.profiles for all to svc_people using (true) with check (true);
grant select, insert, update, delete on people.profiles to svc_people;

alter table people.onboarding_state enable row level security;
alter table people.onboarding_state force row level security;
create policy onboarding_state_owner on people.onboarding_state for all to svc_people using (true) with check (true);
grant select, insert, update, delete on people.onboarding_state to svc_people;

alter table people.friend_requests enable row level security;
alter table people.friend_requests force row level security;
create policy friend_requests_owner on people.friend_requests for all to svc_people using (true) with check (true);
grant select, insert, update, delete on people.friend_requests to svc_people;

alter table people.friendships enable row level security;
alter table people.friendships force row level security;
create policy friendships_owner on people.friendships for all to svc_people using (true) with check (true);
grant select, insert, update, delete on people.friendships to svc_people;

alter table people.blocks enable row level security;
alter table people.blocks force row level security;
create policy blocks_owner on people.blocks for all to svc_people using (true) with check (true);
grant select, insert, update, delete on people.blocks to svc_people;

alter table people.user_mutes enable row level security;
alter table people.user_mutes force row level security;
create policy user_mutes_owner on people.user_mutes for all to svc_people using (true) with check (true);
grant select, insert, update, delete on people.user_mutes to svc_people;

alter table people.pymk_dismissals enable row level security;
alter table people.pymk_dismissals force row level security;
create policy pymk_dismissals_owner on people.pymk_dismissals for all to svc_people using (true) with check (true);
grant select, insert, update, delete on people.pymk_dismissals to svc_people;

alter table people.ui_state enable row level security;
alter table people.ui_state force row level security;
create policy ui_state_owner on people.ui_state for all to svc_people using (true) with check (true);
grant select, insert, update, delete on people.ui_state to svc_people;

alter table people.tour_progress enable row level security;
alter table people.tour_progress force row level security;
create policy tour_progress_owner on people.tour_progress for all to svc_people using (true) with check (true);
grant select, insert, update, delete on people.tour_progress to svc_people;

alter table people.tips_seen enable row level security;
alter table people.tips_seen force row level security;
create policy tips_seen_owner on people.tips_seen for all to svc_people using (true) with check (true);
grant select, insert, update, delete on people.tips_seen to svc_people;

alter table people.deleted_accounts enable row level security;
alter table people.deleted_accounts force row level security;
create policy deleted_accounts_owner on people.deleted_accounts for all to svc_people using (true) with check (true);
grant select, insert, update, delete on people.deleted_accounts to svc_people;

alter table people.audit_log enable row level security;
alter table people.audit_log force row level security;
create policy audit_log_owner on people.audit_log for all to svc_people using (true) with check (true);
-- Append-only: people may add and read audit rows, never change or remove them.
grant select, insert on people.audit_log to svc_people;
