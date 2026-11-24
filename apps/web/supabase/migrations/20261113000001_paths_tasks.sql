-- Phase 17 (PRD 5.32): paths and proof tasks. No AI anywhere: paths come from aggregate data
-- (or a staff-edited starter path), tasks from a staff-written bank, and verification from
-- GitHub, then a peer, or a code check.
--
-- * paths / path_skills: 8 roles (lib/github/taxonomy/paths.yaml → platform_config `paths.seed`).
--   private.compute_paths() (weekly cron `paths-weekly`) orders a role's skills by the median day
--   seniors (Shine or higher, holding 60% of the role's skills at L2) first reached L2, measured
--   from each senior's first L2 in the role. Under 10 such seniors: the starter order.
-- * user_skills.l2_at: when the student first reached L2 in a skill (kept by a trigger).
-- * path_follows: up to 2 per student.
-- * proof_tasks (staff bank, /ops/config/tasks), task_attempts, task_reviews.
--   Submit → GitHub rescan (the worker's harvest/extract stages; task_github_check after each
--   recompute) → after `github_wait_minutes`, 3 peers (L2+, any university, never friends, never
--   in a ring with the student, 5 reviews a week, never asked twice for the same attempt) → 3 more
--   after 7 days without a review. A code check can be chosen instead where prompts exist.
--   Done: a `proof_task` row in my_skill_proofs and a Skilient "Proof task" Record entry.

-- ---------------------------------------------------------------------------
-- Config
-- ---------------------------------------------------------------------------
insert into public.platform_config (key, version, value, reason) values
  ('paths.seed', 1, $seed$
{"min_seniors":10,"min_share":0.6,"min_tier":"shine","max_follows":2,"roles":[{"role":"frontend","name":"Frontend","pictogram":"browser","skills":["html","css","javascript","typescript","react","tailwindcss","redux","tanstack-query","nextjs","vitest","playwright"]},{"role":"backend","name":"Backend","pictogram":"database","skills":["javascript","nodejs","express","sql","postgresql","typescript","nestjs","redis","docker","automated-testing","api-documentation"]},{"role":"mobile","name":"Mobile","pictogram":"device-mobile","skills":["dart","flutter","firebase","kotlin","android","jetpack-compose","swift","swiftui","ios","react-native","expo"]},{"role":"data","name":"Data","pictogram":"chart-line","skills":["python","sql","pandas","numpy","jupyter","matplotlib","seaborn","scipy","plotly","postgresql"]},{"role":"machine-learning","name":"Machine learning","pictogram":"brain","skills":["python","numpy","pandas","jupyter","matplotlib","scikit-learn","tensorflow","pytorch","keras","opencv","hugging-face-transformers"]},{"role":"devops","name":"DevOps","pictogram":"cloud","skills":["shell","docker","docker-compose","github-actions","continuous-integration","nginx","kubernetes","terraform","ansible","aws","helm"]},{"role":"ui-ux","name":"UI/UX","pictogram":"pen-nib","skills":["html","css","javascript","tailwindcss","bootstrap","react","material-ui","storybook","d3","threejs"]},{"role":"product","name":"Product","pictogram":"compass","skills":["javascript","typescript","react","nextjs","nodejs","postgresql","supabase","vercel","automated-testing","api-documentation"]}]}
$seed$::jsonb,
   'PRD 5.32: 8 roles from lib/github/taxonomy/paths.yaml; the order is the starter path until 10 seniors (Shine or higher, 60% of the role at L2) qualify.'),
  ('tasks.limits', 1, '{"active": 3, "peers": 3, "reviews_week": 5, "reoffer_days": 7, "github_wait_minutes": 30}',
   'PRD 5.32: 3 active tasks per student, 3 peers per offer, 5 reviews a week per peer, 3 more peers after 7 days, GitHub gets 30 minutes before peers are asked.');

insert into public.config_keys (key, area, description, applies, schema) values
  ('paths.seed', 'paths', 'Paths: the roles, their skills in starter order, and when data takes over (seniors, share of the role, tier). Applied by the weekly paths-weekly run.', 'now',
   '{"type": "object", "additionalProperties": false,
     "required": ["min_seniors", "min_share", "min_tier", "max_follows", "roles"],
     "properties": {
       "min_seniors": {"type": "integer", "minimum": 10, "maximum": 1000},
       "min_share": {"type": "number", "minimum": 0.3, "maximum": 1},
       "min_tier": {"enum": ["spark", "flare", "shine", "radiant", "luminary"]},
       "max_follows": {"type": "integer", "minimum": 1, "maximum": 4},
       "roles": {"type": "array", "minItems": 1, "maxItems": 16, "items": {
         "type": "object", "additionalProperties": false, "required": ["role", "name", "pictogram", "skills"],
         "properties": {
           "role": {"type": "string", "pattern": "^[a-z][a-z0-9-]{1,30}$"},
           "name": {"type": "string", "minLength": 2, "maxLength": 40},
           "pictogram": {"enum": ["browser", "database", "device-mobile", "chart-line", "brain", "cloud", "pen-nib", "compass"]},
           "skills": {"type": "array", "minItems": 3, "maxItems": 20, "uniqueItems": true,
                      "items": {"type": "string", "pattern": "^[a-z0-9][a-z0-9-]{0,39}$"}}}}}}}'),
  ('tasks.limits', 'paths', 'Proof tasks: active tasks per student, peers per offer, reviews a week per peer, days before 3 more peers, minutes GitHub gets first.', 'now',
   '{"type": "object", "additionalProperties": false,
     "required": ["active", "peers", "reviews_week", "reoffer_days", "github_wait_minutes"],
     "properties": {
       "active": {"type": "integer", "minimum": 1, "maximum": 10},
       "peers": {"type": "integer", "minimum": 1, "maximum": 10},
       "reviews_week": {"type": "integer", "minimum": 1, "maximum": 20},
       "reoffer_days": {"type": "integer", "minimum": 1, "maximum": 30},
       "github_wait_minutes": {"type": "integer", "minimum": 5, "maximum": 1440}}}');

-- An integer from a config object, with the default when the key or field is missing.
create function private.cfg_int(p_key text, p_field text, p_default integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$ select coalesce((private.config(p_key) ->> p_field)::integer, p_default) $$;
revoke all on function private.cfg_int(text, text, integer) from public;

create function private.task_limit(p_field text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select private.cfg_int('tasks.limits', p_field,
                         case p_field when 'active' then 3 when 'peers' then 3 when 'reviews_week' then 5
                                      when 'reoffer_days' then 7 else 30 end);
$$;
revoke all on function private.task_limit(text) from public;

-- ---------------------------------------------------------------------------
-- First L2: when the student first reached L2 in a skill
-- ---------------------------------------------------------------------------
alter table public.user_skills add column l2_at timestamptz;
comment on column public.user_skills.l2_at is 'When the student first reached L2 (PRD 5.32 paths). Kept by a trigger; rows from before phase 17 use their last update.';
update public.user_skills set l2_at = updated_at where level >= 2;

create function private.user_skills_l2_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.level >= 2 and new.l2_at is null then
    new.l2_at := now();
  end if;
  return new;
end;
$$;
revoke all on function private.user_skills_l2_at() from public;
create trigger user_skills_l2_at before insert or update on public.user_skills
  for each row execute function private.user_skills_l2_at();
create index user_skills_l2_idx on public.user_skills (skill_id, l2_at) where level >= 2;

-- ---------------------------------------------------------------------------
-- Paths
-- ---------------------------------------------------------------------------
create table public.paths (
  role text primary key check (role ~ '^[a-z][a-z0-9-]{1,30}$'),
  name text not null check (char_length(btrim(name)) between 2 and 40),
  pictogram text not null check (pictogram ~ '^[a-z-]{2,30}$'),
  position smallint not null check (position >= 1),
  source text not null default 'starter' check (source in ('data', 'starter')),
  -- Students who qualified as seniors on the last run (shown only when source = 'data', always >= min_seniors then).
  seniors integer not null default 0 check (seniors >= 0),
  computed_at timestamptz not null default now()
);
comment on table public.paths is 'Paths (PRD 5.32): one row per role. Aggregate only; written by private.compute_paths().';

create table public.path_skills (
  role text not null references public.paths (role) on delete cascade,
  skill_id text not null references public.skills (id),
  position smallint not null check (position >= 1),
  -- Data order only: the median days seniors took after the previous square.
  after_days integer check (after_days is null or after_days >= 0),
  primary key (role, skill_id)
);
comment on table public.path_skills is 'A path''s squares in order (PRD 5.32). Aggregate only; written by private.compute_paths().';
create index path_skills_skill_idx on public.path_skills (skill_id);

create table public.path_follows (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null references public.paths (role) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
comment on table public.path_follows is 'Paths a student follows (up to paths.seed max_follows). Owner-only; written by follow_path().';
create index path_follows_role_idx on public.path_follows (role);

alter table public.paths enable row level security;
alter table public.path_skills enable row level security;
alter table public.path_follows enable row level security;
revoke all on table public.paths, public.path_skills, public.path_follows from anon, authenticated;
grant select on table public.paths, public.path_skills, public.path_follows to authenticated;
create policy paths_read on public.paths for select to authenticated using (true);
create policy path_skills_read on public.path_skills for select to authenticated using (true);
create policy path_follows_owner_read on public.path_follows for select to authenticated using (user_id = (select auth.uid()));

-- Seniors for a set of skills: ranked students at p_tier or higher holding at least p_share of
-- the set at L2, with the day of their first L2 in the set.
create function private.path_seniors(p_skills text[], p_share numeric, p_tier public.ranking_tier)
returns table (user_id uuid, first_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select u.user_id, min(u.l2_at)
    from public.user_skills u
    join public.ranking_scores s on s.user_id = u.user_id and s.ranked and s.tier >= p_tier
    join public.profiles p on p.user_id = u.user_id and p.role = 'student' and p.status <> 'deleting'
   where u.skill_id = any (p_skills) and u.level >= 2 and u.l2_at is not null
   group by u.user_id
  having count(*) >= ceil(p_share * cardinality(p_skills));
$$;
revoke all on function private.path_seniors(text[], numeric, public.ranking_tier) from public;

create function private.compute_paths()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  cfg jsonb := private.config('paths.seed');
  r jsonb;
  v_pos integer := 0;
  v_role text;
  v_skills text[];
  v_min integer := coalesce((cfg ->> 'min_seniors')::integer, 10);
  v_share numeric := coalesce((cfg ->> 'min_share')::numeric, 0.6);
  v_tier public.ranking_tier := coalesce(cfg ->> 'min_tier', 'shine')::public.ranking_tier;
  v_n integer;
  v_roles text[] := '{}';
  v_data integer := 0;
begin
  if cfg is null then
    return 0;
  end if;
  for r in select value from jsonb_array_elements(cfg -> 'roles') loop
    v_pos := v_pos + 1;
    v_role := r ->> 'role';
    v_roles := v_roles || v_role;
    -- Retired or unknown skills drop out of the set.
    v_skills := array(select t.s from jsonb_array_elements_text(r -> 'skills') with ordinality as t(s, o)
                       where exists (select 1 from public.skills k where k.id = t.s and k.retired_at is null)
                       order by t.o);
    select count(*)::integer into v_n from private.path_seniors(v_skills, v_share, v_tier);
    insert into public.paths (role, name, pictogram, position, source, seniors, computed_at)
    values (v_role, r ->> 'name', r ->> 'pictogram', v_pos, case when v_n >= v_min then 'data' else 'starter' end, v_n, now())
    on conflict (role) do update
      set name = excluded.name, pictogram = excluded.pictogram, position = excluded.position, source = excluded.source,
          seniors = excluded.seniors, computed_at = excluded.computed_at;
    delete from public.path_skills where role = v_role;
    if v_n >= v_min then
      v_data := v_data + 1;
      insert into public.path_skills (role, skill_id, position, after_days)
      with q as (
        select * from private.path_seniors(v_skills, v_share, v_tier)
      ), offs as (
        select u.skill_id,
               percentile_cont(0.5) within group (order by extract(epoch from u.l2_at - q.first_at) / 86400.0) as med
          from public.user_skills u
          join q on q.user_id = u.user_id
         where u.skill_id = any (v_skills) and u.level >= 2 and u.l2_at is not null
         group by u.skill_id
      ), ordered as (
        select s.skill_id, o.med, row_number() over (order by o.med nulls last, s.o) as pos
          from unnest(v_skills) with ordinality as s(skill_id, o)
          left join offs o on o.skill_id = s.skill_id
      ), lagged as (
        select skill_id, med, pos, lag(med) over (order by pos) as prev from ordered
      )
      select v_role, skill_id, pos, case when pos > 1 and med is not null and prev is not null
                                         then greatest(0, round(med - prev))::integer end
        from lagged;
    else
      insert into public.path_skills (role, skill_id, position)
      select v_role, s.skill_id, s.o from unnest(v_skills) with ordinality as s(skill_id, o);
    end if;
  end loop;
  delete from public.paths where not (role = any (v_roles));
  return v_data;
end;
$$;
revoke all on function private.compute_paths() from public;

create function private.follow_path(p_role text, p_follow boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_max integer := private.cfg_int('paths.seed', 'max_follows', 2);
begin
  if not exists (select 1 from public.paths where role = p_role) then
    raise exception 'path not found' using errcode = 'P0002';
  end if;
  if not coalesce(p_follow, false) then
    delete from public.path_follows where user_id = v_me and role = p_role;
    return;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('path_follows:' || v_me::text, 0));
  if exists (select 1 from public.path_follows where user_id = v_me and role = p_role) then
    return;
  end if;
  if (select count(*) from public.path_follows where user_id = v_me) >= v_max then
    raise exception 'you can follow up to % paths; unfollow one first', v_max using errcode = '23514';
  end if;
  insert into public.path_follows (user_id, role) values (v_me, p_role);
  perform private.track(v_me, 'path_followed', jsonb_build_object('role', p_role));
end;
$$;

-- /me/paths: every role card, what the student follows, open tasks and reviews asked of them.
create function private.my_paths()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
begin
  return jsonb_build_object(
    'max_follows', private.cfg_int('paths.seed', 'max_follows', 2),
    'min_seniors', private.cfg_int('paths.seed', 'min_seniors', 10),
    'github_connected', exists (select 1 from public.github_accounts g where g.user_id = v_me and g.revoked_at is null),
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object(
               'role', p.role, 'name', p.name, 'pictogram', p.pictogram, 'source', p.source,
               'seniors', case when p.source = 'data' then p.seniors end,
               'following', f.user_id is not null,
               'total', x.total, 'proved', x.proved, 'next_skill', x.next_skill, 'next_name', x.next_name)
             order by f.created_at nulls last, p.position)
        from public.paths p
        left join public.path_follows f on f.role = p.role and f.user_id = v_me
        cross join lateral (
          select count(*)::integer as total, count(*) filter (where s.state = 'proved')::integer as proved,
                 min(s.skill_id) filter (where s.state = 'next') as next_skill,
                 min(s.name) filter (where s.state = 'next') as next_name
            from private.path_steps(v_me, p.role) s
        ) x), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'title', t.title, 'skill', k.name, 'status', a.status,
                                          'started_at', a.started_at) order by a.started_at desc)
        from public.task_attempts a
        join public.proof_tasks t on t.id = a.task_id
        join public.skills k on k.id = a.skill_id
       where a.user_id = v_me and a.status not in ('done', 'abandoned')), '[]'::jsonb),
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'status', r.status, 'title', t.title, 'skill', k.name,
                                          'student', split_part(p.full_name, ' ', 1), 'offered_at', r.offered_at)
                       order by r.offered_at desc)
        from public.task_reviews r
        join public.task_attempts a on a.id = r.attempt_id
        join public.proof_tasks t on t.id = a.task_id
        join public.skills k on k.id = a.skill_id
        join public.profiles p on p.user_id = a.user_id
       where r.reviewer_id = v_me and r.status in ('offered', 'accepted')), '[]'::jsonb),
    'reviews_left', greatest(0, private.task_limit('reviews_week') - (
      select count(*)::integer from public.task_reviews r
       where r.reviewer_id = v_me and r.status in ('accepted', 'confirmed', 'needs_changes')
         and r.responded_at > now() - interval '7 days')));
end;
$$;

-- One path as a ladder.
create function private.path_view(p_role text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  p public.paths;
  v_steps jsonb;
begin
  select * into p from public.paths where role = p_role;
  if p.role is null then
    raise exception 'path not found' using errcode = 'P0002';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'skill_id', s.skill_id, 'name', s.name, 'position', s.pos, 'state', s.state, 'level', s.level,
           'proved_on', to_char((s.proved_at at time zone 'Asia/Karachi')::date, 'FMDD Mon YYYY'),
           'attempt_id', s.attempt_id, 'attempt_status', s.attempt_status) order by s.pos), '[]'::jsonb)
    into v_steps
    from private.path_steps(v_me, p_role) s;
  return jsonb_build_object(
    'role', p.role, 'name', p.name, 'pictogram', p.pictogram, 'source', p.source,
    'seniors', case when p.source = 'data' then p.seniors end,
    'following', exists (select 1 from public.path_follows f where f.user_id = v_me and f.role = p_role),
    'computed_at', p.computed_at,
    'total', jsonb_array_length(v_steps),
    'proved', (select count(*) from jsonb_array_elements(v_steps) e where e ->> 'state' = 'proved'),
    'next', (select jsonb_build_object('skill_id', e ->> 'skill_id', 'name', e ->> 'name')
               from jsonb_array_elements(v_steps) e where e ->> 'state' = 'next' limit 1),
    'steps', v_steps);
end;
$$;

-- ---------------------------------------------------------------------------
-- Proof tasks: the staff bank
-- ---------------------------------------------------------------------------
create table public.proof_tasks (
  id uuid primary key default gen_random_uuid(),
  skill_id text not null references public.skills (id),
  title text not null check (char_length(btrim(title)) between 5 and 120),
  difficulty text not null check (difficulty in ('starter', 'core', 'stretch')),
  brief text not null check (char_length(btrim(brief)) between 40 and 4000),
  -- 3 to 6 acceptance items, each a sentence.
  checklist jsonb not null check (jsonb_typeof(checklist) = 'array' and jsonb_array_length(checklist) between 3 and 6),
  active boolean not null default true,
  author_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.proof_tasks is 'Proof tasks (PRD 5.32): a staff-written bank, edited in /ops/config/tasks. Active tasks are readable by every signed-in user.';
create index proof_tasks_skill_idx on public.proof_tasks (skill_id) where active;
create index proof_tasks_author_idx on public.proof_tasks (author_id) where author_id is not null;
create trigger proof_tasks_updated_at before update on public.proof_tasks
  for each row execute function private.set_updated_at();
alter table public.proof_tasks enable row level security;
revoke all on table public.proof_tasks from anon, authenticated;
grant select on table public.proof_tasks to authenticated;
create policy proof_tasks_read_active on public.proof_tasks for select to authenticated using (active);

create table public.task_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null references public.proof_tasks (id),
  skill_id text not null references public.skills (id),
  repo_id bigint,
  repo_full_name text check (repo_full_name is null or (repo_full_name ~ '^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$' and char_length(repo_full_name) <= 140)),
  status text not null default 'started'
    check (status in ('started', 'verifying', 'awaiting_peer', 'in_review', 'code_check', 'needs_changes', 'done', 'abandoned')),
  route text check (route in ('github', 'peer', 'code_check')),
  code_check_id uuid references public.code_checks (id) on delete set null,
  -- Peer offers: which round, and when it went out (3 more peers after reoffer_days).
  round smallint not null default 0 check (round >= 0),
  offered_at timestamptz,
  -- The latest "needs changes" note (from the peer) or why a code check didn't count.
  note text check (note is null or char_length(note) <= 1000),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  done_at timestamptz,
  verified_by text check (verified_by in ('github', 'peer', 'code_check')),
  record_entry_id uuid references public.record_entries (id) on delete set null,
  updated_at timestamptz not null default now(),
  foreign key (user_id, repo_id) references public.github_user_repos (user_id, repo_id) on delete set null (repo_id),
  check ((status = 'done') = (done_at is not null)),
  check ((status = 'done') = (verified_by is not null)),
  check (status in ('started', 'abandoned') or submitted_at is not null)
);
comment on table public.task_attempts is 'A student''s go at a proof task (PRD 5.32). Owner-only; written by functions and the GitHub worker''s check.';
create unique index task_attempts_one_live on public.task_attempts (user_id, task_id) where status not in ('done', 'abandoned');
create index task_attempts_user_idx on public.task_attempts (user_id, status);
create index task_attempts_task_idx on public.task_attempts (task_id);
create index task_attempts_skill_idx on public.task_attempts (skill_id);
create index task_attempts_open_idx on public.task_attempts (status, offered_at) where status in ('verifying', 'awaiting_peer', 'in_review');
create index task_attempts_code_check_idx on public.task_attempts (code_check_id) where code_check_id is not null;
create index task_attempts_entry_idx on public.task_attempts (record_entry_id) where record_entry_id is not null;
create trigger task_attempts_updated_at before update on public.task_attempts
  for each row execute function private.set_updated_at();

create table public.task_reviews (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.task_attempts (id) on delete cascade,
  reviewer_id uuid not null references auth.users (id) on delete cascade,
  round smallint not null check (round >= 1),
  status text not null default 'offered'
    check (status in ('offered', 'accepted', 'declined', 'expired', 'withdrawn', 'confirmed', 'needs_changes')),
  -- One boolean per checklist item, as the reviewer ticked them.
  checklist jsonb check (checklist is null or jsonb_typeof(checklist) = 'array'),
  note text check (note is null or char_length(btrim(note)) between 3 and 1000),
  offered_at timestamptz not null default now(),
  responded_at timestamptz,
  decided_at timestamptz,
  -- A peer is asked at most once per attempt (declined: never again).
  unique (attempt_id, reviewer_id),
  check (status <> 'needs_changes' or note is not null)
);
comment on table public.task_reviews is 'Peer reviews of proof tasks (PRD 5.32). The reviewer reads their own; the student sees the outcome through my_task().';
create unique index task_reviews_one_accepted on public.task_reviews (attempt_id) where status = 'accepted';
create index task_reviews_reviewer_idx on public.task_reviews (reviewer_id, status, responded_at);

alter table public.task_attempts enable row level security;
alter table public.task_reviews enable row level security;
revoke all on table public.task_attempts, public.task_reviews from anon, authenticated;
grant select on table public.task_attempts, public.task_reviews to authenticated;
create policy task_attempts_owner_read on public.task_attempts for select to authenticated using (user_id = (select auth.uid()));
create policy task_reviews_reviewer_read on public.task_reviews for select to authenticated using (reviewer_id = (select auth.uid()));

create trigger refuse_if_restricted before insert on public.task_attempts
  for each row execute function private.refuse_if_restricted();

-- One student's squares on a path: proved (L2, or a done proof task), in progress (a task is
-- open), the one next square, and later.
create function private.path_steps(p_user uuid, p_role text)
returns table (skill_id text, name text, pos integer, after_days integer, prev_name text, state text,
               proved_at timestamptz, level smallint, attempt_id uuid, attempt_status text)
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select ps.skill_id, k.name, ps.position::integer as pos, ps.after_days,
           lag(k.name) over (order by ps.position) as prev_name,
           least(case when u.level >= 2 then coalesce(u.l2_at, u.updated_at) end,
                 (select min(a.done_at) from public.task_attempts a
                   where a.user_id = p_user and a.skill_id = ps.skill_id and a.status = 'done')) as proved_at,
           coalesce(u.level, 0)::smallint as level,
           o.id as attempt_id, o.status as attempt_status
      from public.path_skills ps
      join public.skills k on k.id = ps.skill_id
      left join public.user_skills u on u.user_id = p_user and u.skill_id = ps.skill_id
      left join lateral (
        select a.id, a.status from public.task_attempts a
         where a.user_id = p_user and a.skill_id = ps.skill_id and a.status not in ('done', 'abandoned')
         order by a.started_at desc limit 1
      ) o on true
     where ps.role = p_role
  ), st as (
    select b.*, case when b.proved_at is not null then 'proved' when b.attempt_id is not null then 'in_progress' end as s0
      from base b
  )
  select skill_id, name, pos, after_days, prev_name,
         coalesce(s0, case when pos = min(pos) filter (where s0 is null) over () then 'next' else 'later' end),
         proved_at, level, attempt_id, attempt_status
    from st
   order by pos;
$$;
revoke all on function private.path_steps(uuid, text) from public;


-- The starter bank: a few tasks per common skill, written by staff (never generated).
insert into public.proof_tasks (skill_id, title, difficulty, brief, checklist) values
  ('html', 'A semantic, accessible event page', 'starter',
   'Build a single page for a society event using semantic HTML only: header, main, sections, a schedule table and a sign-up form with labels. No CSS framework needed.',
   '["Uses header, main, section and footer elements", "The schedule is a table with a caption and header cells", "Every form field has a visible label", "The page passes an automated accessibility check with no errors"]'),
  ('css', 'A responsive card grid without a framework', 'starter',
   'Style a grid of 6 project cards with plain CSS. It must reflow from one column on a phone to three on a laptop, with a visible keyboard focus on each card link.',
   '["Uses CSS grid or flexbox, no CSS framework", "One column under 600px, three columns from 1024px", "Card links show a visible focus outline", "Colours meet 4.5:1 contrast for body text"]'),
  ('javascript', 'A to-do list that survives a reload', 'starter',
   'Write a small to-do list in plain JavaScript: add, complete and delete items, saved to localStorage so they come back after a reload. Keep the logic in functions you could test.',
   '["Add, complete and delete work from the keyboard", "Items are still there after a reload", "State changes go through named functions, not inline handlers", "No framework or build step is required"]'),
  ('typescript', 'Type a small API client', 'core',
   'Write a typed client for a public JSON API (for example a weather or books API). Model the responses with interfaces, handle errors with a result type, and turn on strict mode.',
   '["tsconfig has strict mode on", "Responses are described by interfaces or types, no any", "Network and parse errors return a typed error instead of throwing", "At least one function uses a generic type"]'),
  ('typescript', 'Migrate a JavaScript module to TypeScript', 'starter',
   'Take a JavaScript file of at least 100 lines from one of your projects and convert it to TypeScript, fixing what the compiler finds rather than silencing it.',
   '["The file compiles with strict mode on", "No any or ts-ignore was added", "Function parameters and return values are typed", "A short note in the README says what the compiler caught"]'),
  ('react', 'A searchable list with loading and error states', 'core',
   'Build a React component that fetches a list, filters it as the user types, and shows loading, empty and error states. Split it into at least three components.',
   '["Loading, empty and error states each render something different", "Filtering happens as the user types without refetching", "At least three components with clear props", "Keys on list items are stable ids, not indexes"]'),
  ('react', 'A multi-step form with validation', 'stretch',
   'Build a three-step sign-up form in React that keeps its values between steps, validates each step before moving on, and lets the user go back without losing data.',
   '["Three steps with Back and Next", "Each step validates before moving on and shows the error next to the field", "Values survive going back and forth", "The form can be completed with the keyboard alone"]'),
  ('sql', 'Design and query a society membership schema', 'starter',
   'Design tables for societies, members and events with primary and foreign keys, load sample data, and write five queries that answer real questions (for example, the most active members this term).',
   '["Tables have primary keys and foreign keys", "Sample data is loaded by a script in the repository", "Five queries, each with a comment saying what it answers", "At least one query uses a join and one uses GROUP BY"]'),
  ('python', 'A command-line expense tracker', 'starter',
   'Write a Python command-line tool that adds expenses, lists them by month and prints a total per category, saving to a CSV or JSON file.',
   '["Add, list and summary commands work from the terminal", "Data is saved to a file and read back", "Code is split into functions with docstrings", "Bad input prints a helpful message instead of a traceback"]'),
  ('pandas', 'Clean and summarise a messy dataset', 'core',
   'Take a public dataset with missing and inconsistent values, clean it with pandas, and answer three questions about it in a notebook or script.',
   '["Missing values are handled and the choice is explained", "Column types are fixed (dates, numbers, categories)", "Three questions are answered with code and a sentence each", "The cleaned data is saved separately from the raw data"]'),
  ('docker', 'Containerise one of your projects', 'core',
   'Write a Dockerfile (and a compose file if the project needs a database) so the project runs with one command on any machine.',
   '["docker build succeeds from a clean checkout", "The image runs as a non-root user", "Secrets come from environment variables, not the image", "The README has the one command to run it"]'),
  ('nodejs', 'A REST API with validation', 'core',
   'Build a small REST API in Node.js with create, read, update and delete for one resource, input validation and proper status codes.',
   '["Four routes for create, read, update and delete", "Invalid input returns 400 with a message", "Unknown ids return 404", "Configuration comes from environment variables"]'),
  ('github-actions', 'Run your tests on every push', 'starter',
   'Add a GitHub Actions workflow to one of your repositories that installs dependencies and runs the tests (or a linter) on every push and pull request.',
   '["The workflow runs on push and pull_request", "Dependencies are cached", "A failing test fails the workflow", "The README shows the workflow status badge"]'),
  ('flutter', 'A two-screen Flutter app with navigation', 'starter',
   'Build a Flutter app with a list screen and a detail screen, passing data between them, with a layout that works on a small phone.',
   '["Two screens with navigation and back", "Data is passed to the detail screen", "Layout has no overflow on a 360px-wide screen", "Widgets are split into their own classes"]');

-- ---------------------------------------------------------------------------
-- Proof tasks: who may review
-- ---------------------------------------------------------------------------
-- A peer may review a student's task: L2 or higher in the skill, a student who isn't deleting
-- their account or suspended, never the student, never friends or blocked, never flagged in a
-- ring together, and under 5 reviews in the last 7 days.
create function private.task_peer_ok(p_reviewer uuid, p_student uuid, p_skill text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_reviewer <> p_student
     and exists (select 1 from public.user_skills u where u.user_id = p_reviewer and u.skill_id = p_skill and u.level >= 2)
     and exists (select 1 from public.profiles p where p.user_id = p_reviewer and p.role = 'student'
                   and p.status <> 'deleting' and p.onboarding_complete)
     and not private.are_friends(p_reviewer, p_student)
     and not private.is_blocked(p_reviewer, p_student)
     and not exists (select 1 from public.anti_gaming_flags f
                      where f.kind in ('ring', 'swap_ring', 'swap_repeat') and f.status in ('open', 'upheld')
                        and f.members @> array[p_reviewer, p_student])
     and not exists (select 1 from public.sanctions s
                      where s.user_id = p_reviewer and s.kind in ('suspend', 'ban') and s.lifted_at is null
                        and (s.until is null or s.until > now()))
     and (select count(*) from public.task_reviews r
           where r.reviewer_id = p_reviewer and r.status in ('accepted', 'confirmed', 'needs_changes')
             and r.responded_at > now() - interval '7 days') < private.task_limit('reviews_week');
$$;
revoke all on function private.task_peer_ok(uuid, uuid, text) from public;

-- Offers the attempt to up to `peers` new eligible peers (round + 1). Returns how many.
create function private.offer_task_peers(p_attempt uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.task_attempts;
  v_round smallint;
  v_n integer;
  v_title text;
  v_skill text;
  v_student text;
begin
  select * into a from public.task_attempts where id = p_attempt for update;
  if a.id is null or a.status not in ('verifying', 'awaiting_peer', 'in_review') then
    return 0;
  end if;
  v_round := a.round + 1;
  update public.task_reviews set status = 'expired', responded_at = coalesce(responded_at, now())
   where attempt_id = a.id and status in ('offered', 'accepted');
  update public.task_attempts set status = 'awaiting_peer', round = v_round, offered_at = now(), route = 'peer' where id = a.id;
  insert into public.task_reviews (attempt_id, reviewer_id, round)
  select a.id, c.user_id, v_round
    from (select u.user_id from public.user_skills u
           where u.skill_id = a.skill_id and u.level >= 2
             and not exists (select 1 from public.task_reviews r where r.attempt_id = a.id and r.reviewer_id = u.user_id)
             and private.task_peer_ok(u.user_id, a.user_id, a.skill_id)
           order by random()
           limit private.task_limit('peers')) c;
  get diagnostics v_n = row_count;
  select t.title, k.name, split_part(p.full_name, ' ', 1) into v_title, v_skill, v_student
    from public.proof_tasks t join public.skills k on k.id = a.skill_id join public.profiles p on p.user_id = a.user_id
   where t.id = a.task_id;
  perform private.notify(r.reviewer_id, null, 'task_review_offer', 'task_review', r.id,
                         jsonb_build_object('student', v_student, 'skill', v_skill, 'title', v_title))
     from public.task_reviews r where r.attempt_id = a.id and r.round = v_round and r.status = 'offered';
  return v_n;
end;
$$;
revoke all on function private.offer_task_peers(uuid) from public;

-- ---------------------------------------------------------------------------
-- Proof tasks: done
-- ---------------------------------------------------------------------------
create function private.complete_task(p_attempt uuid, p_by text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.task_attempts;
  t public.proof_tasks;
  v_skill text;
  v_entry uuid;
begin
  update public.task_attempts
     set status = 'done', done_at = now(), verified_by = p_by, route = coalesce(route, p_by), note = null
   where id = p_attempt and status not in ('done', 'abandoned')
  returning * into a;
  if a.id is null then
    return false;
  end if;
  update public.task_reviews set status = 'withdrawn', responded_at = coalesce(responded_at, now())
   where attempt_id = a.id and status in ('offered', 'accepted');
  select * into t from public.proof_tasks where id = a.task_id;
  select name into v_skill from public.skills where id = a.skill_id;
  v_entry := private.issue_record_entry(
    a.user_id, null, 'proof_task', 'skilient', null, 'Skilient', 'task', a.id, t.title,
    jsonb_build_object('line', v_skill || ' · verified by ' || case p_by when 'github' then 'GitHub' when 'peer' then 'a peer review'
                                                                         else 'a code check' end,
                       'skill', a.skill_id, 'verified_by', p_by),
    (now() at time zone 'Asia/Karachi')::date, null);
  update public.task_attempts set record_entry_id = v_entry where id = a.id;
  perform private.notify(a.user_id, null, 'task_done', 'task_attempt', a.id,
                         jsonb_build_object('title', t.title, 'skill', v_skill, 'by', p_by));
  perform private.track(a.user_id, 'proof_task_done', jsonb_build_object('skill', a.skill_id, 'verified_by', p_by));
  return true;
end;
$$;
revoke all on function private.complete_task(uuid, text) from public;

-- GitHub: a submitted attempt is done when its linked repository holds a counted commit, made
-- since the task started, that shows the skill (it reached L1 or L2 there). Called by the
-- github-worker after every recompute and by submit_task / the tick.
create function private.task_github_check(p_user uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_n integer := 0;
begin
  for v_id in
    select a.id from public.task_attempts a
     where a.user_id = p_user and a.status in ('verifying', 'awaiting_peer', 'in_review') and a.repo_id is not null
       and exists (select 1 from public.skill_evidence e
                     join public.github_commits c on c.user_id = e.user_id and c.repo_id = e.repo_id and c.sha = e.sha
                    where e.user_id = a.user_id and e.repo_id = a.repo_id and e.skill_id = a.skill_id
                      and c.status = 'counted' and e.occurred_at >= a.started_at)
  loop
    if private.complete_task(v_id, 'github') then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;
revoke all on function private.task_github_check(uuid) from public;
grant execute on function private.task_github_check(uuid) to service_role;

-- A code check chosen for a task decides it.
create function private.code_check_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if new.status = 'passed' then
    for v_id in select id from public.task_attempts where code_check_id = new.id and status = 'code_check' loop
      perform private.complete_task(v_id, 'code_check');
    end loop;
  elsif new.status in ('failed', 'expired', 'unavailable') then
    update public.task_attempts
       set status = 'needs_changes',
           note = case new.status when 'failed' then 'The code check didn''t pass. Improve the work and submit again.'
                                  when 'expired' then 'The code check wasn''t started in time. Submit again.'
                                  else 'We couldn''t find code for a check. Submit again for GitHub and a peer.' end
     where code_check_id = new.id and status = 'code_check';
  end if;
  return null;
end;
$$;
revoke all on function private.code_check_task() from public;
create trigger code_checks_task after update of status on public.code_checks
  for each row when (old.status is distinct from new.status) execute function private.code_check_task();

-- ---------------------------------------------------------------------------
-- Proof tasks: the student
-- ---------------------------------------------------------------------------
create function private.start_task(p_task uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  t public.proof_tasks;
  v_id uuid;
begin
  select * into t from public.proof_tasks where id = p_task and active;
  if t.id is null then
    raise exception 'task not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = v_me and p.role = 'student') then
    raise exception 'proof tasks are for students' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('task_attempts:' || v_me::text, 0));
  select id into v_id from public.task_attempts where user_id = v_me and task_id = p_task and status not in ('done', 'abandoned');
  if v_id is not null then
    return v_id;
  end if;
  if exists (select 1 from public.task_attempts where user_id = v_me and task_id = p_task and status = 'done') then
    raise exception 'you already completed this task' using errcode = '55000';
  end if;
  if (select count(*) from public.task_attempts where user_id = v_me and status not in ('done', 'abandoned')) >= private.task_limit('active') then
    raise exception 'you can have % tasks open at a time; finish or drop one first', private.task_limit('active') using errcode = '23514';
  end if;
  insert into public.task_attempts (user_id, task_id, skill_id) values (v_me, p_task, t.skill_id) returning id into v_id;
  perform private.track(v_me, 'proof_task_started', jsonb_build_object('skill', t.skill_id, 'difficulty', t.difficulty));
  return v_id;
end;
$$;

create function private.link_task_repo(p_attempt uuid, p_repo bigint)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  a public.task_attempts;
  v_name text;
begin
  select * into a from public.task_attempts where id = p_attempt and user_id = v_me for update;
  if a.id is null then
    raise exception 'task not found' using errcode = 'P0002';
  end if;
  if a.status not in ('started', 'needs_changes') then
    raise exception 'the repository can be changed only before you submit' using errcode = '55000';
  end if;
  if not exists (select 1 from public.github_accounts g where g.user_id = v_me and g.revoked_at is null) then
    raise exception 'connect GitHub first' using errcode = '55000';
  end if;
  select g.full_name into v_name
    from public.github_user_repos ur join public.github_repos g on g.repo_id = ur.repo_id
   where ur.user_id = v_me and ur.repo_id = p_repo and not ur.excluded and ur.kind is not null;
  if v_name is null then
    raise exception 'pick one of your connected repositories' using errcode = '22023';
  end if;
  update public.task_attempts set repo_id = p_repo, repo_full_name = v_name where id = a.id;
end;
$$;

create function private.submit_task(p_attempt uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  a public.task_attempts;
begin
  select * into a from public.task_attempts where id = p_attempt and user_id = v_me for update;
  if a.id is null then
    raise exception 'task not found' using errcode = 'P0002';
  end if;
  if a.status not in ('started', 'needs_changes') then
    raise exception 'this task is already submitted' using errcode = '55000';
  end if;
  if a.repo_id is null then
    raise exception 'link a repository first' using errcode = '55000';
  end if;
  if not private.rate_limit('task_submit:' || v_me::text, 10, interval '1 day') then
    raise exception 'rate limited' using errcode = '54000';
  end if;
  update public.task_attempts
     set status = 'verifying', route = 'github', submitted_at = now(), code_check_id = null
   where id = a.id;
  -- Rescan the linked repository now (no sync job: a single repository's harvest, then extract).
  perform private.enqueue_github(jsonb_build_object('stage', 'harvest', 'user_id', v_me, 'repo_id', a.repo_id));
  perform private.task_github_check(v_me);
  return (select status from public.task_attempts where id = a.id);
end;
$$;

create function private.abandon_task(p_attempt uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
begin
  update public.task_attempts set status = 'abandoned'
   where id = p_attempt and user_id = v_me and status not in ('done', 'abandoned');
  if not found then
    raise exception 'this task isn''t open' using errcode = '55000';
  end if;
  update public.task_reviews set status = 'withdrawn', responded_at = coalesce(responded_at, now())
   where attempt_id = p_attempt and status in ('offered', 'accepted');
end;
$$;

-- Where the skill has code-check prompts, a code check can decide the task instead of a peer.
create function private.task_code_check_blocker(p_user uuid, p_skill text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not exists (select 1 from public.code_check_prompts p join public.skills s on s.id = p_skill
                      where p.active and (p.skill_id = p_skill or (p.skill_id is null and p.category = s.category)))
      then 'this skill has no code checks'
    else private.code_check_blocker(p_user, p_skill)
  end;
$$;
revoke all on function private.task_code_check_blocker(uuid, text) from public;

create function private.choose_task_code_check(p_attempt uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  a public.task_attempts;
  v_block text;
  v_check uuid;
begin
  select * into a from public.task_attempts where id = p_attempt and user_id = v_me for update;
  if a.id is null then
    raise exception 'task not found' using errcode = 'P0002';
  end if;
  if a.status not in ('started', 'needs_changes', 'verifying', 'awaiting_peer') then
    raise exception 'a code check can''t be chosen now' using errcode = '55000';
  end if;
  v_block := private.task_code_check_blocker(v_me, a.skill_id);
  if v_block is not null then
    raise exception '%', v_block using errcode = '55000';
  end if;
  v_check := private.request_code_check(a.skill_id);
  update public.task_attempts
     set status = 'code_check', route = 'code_check', code_check_id = v_check, submitted_at = coalesce(submitted_at, now())
   where id = a.id;
  update public.task_reviews set status = 'withdrawn', responded_at = coalesce(responded_at, now())
   where attempt_id = a.id and status in ('offered', 'accepted');
  return v_check;
end;
$$;

-- The task page.
create function private.my_task(p_attempt uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  a public.task_attempts;
  t public.proof_tasks;
begin
  select * into a from public.task_attempts where id = p_attempt and user_id = v_me;
  if a.id is null then
    raise exception 'task not found' using errcode = 'P0002';
  end if;
  select * into t from public.proof_tasks where id = a.task_id;
  return jsonb_build_object(
    'id', a.id, 'status', a.status, 'route', a.route, 'verified_by', a.verified_by, 'note', a.note,
    'started_at', a.started_at, 'submitted_at', a.submitted_at, 'done_at', a.done_at,
    'repo', case when a.repo_full_name is not null then jsonb_build_object('id', a.repo_id, 'full_name', a.repo_full_name) end,
    'task', jsonb_build_object('id', t.id, 'title', t.title, 'brief', t.brief, 'checklist', t.checklist, 'difficulty', t.difficulty),
    'skill', jsonb_build_object('id', a.skill_id, 'name', (select k.name from public.skills k where k.id = a.skill_id)),
    'github_connected', exists (select 1 from public.github_accounts g where g.user_id = v_me and g.revoked_at is null),
    'repos', case when a.status in ('started', 'needs_changes') then coalesce((
      select jsonb_agg(jsonb_build_object('id', g.repo_id, 'full_name', g.full_name) order by g.pushed_at desc nulls last, g.full_name)
        from public.github_user_repos ur join public.github_repos g on g.repo_id = ur.repo_id
       where ur.user_id = v_me and not ur.excluded and ur.kind is not null), '[]'::jsonb) else '[]'::jsonb end,
    'code_check', jsonb_build_object(
      'blocker', private.task_code_check_blocker(v_me, a.skill_id),
      'id', a.code_check_id,
      'status', (select c.status from public.code_checks c where c.id = a.code_check_id)),
    'peers', jsonb_build_object(
      'offered', (select count(*) from public.task_reviews r where r.attempt_id = a.id and r.round = a.round and r.status = 'offered'),
      'accepted', exists (select 1 from public.task_reviews r where r.attempt_id = a.id and r.status = 'accepted'),
      'round', a.round),
    'record_code', (select e.code from public.record_entries e where e.id = a.record_entry_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- Proof tasks: the peer
-- ---------------------------------------------------------------------------
create function private.task_review_page(p_review uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  r public.task_reviews;
  a public.task_attempts;
  t public.proof_tasks;
begin
  select * into r from public.task_reviews where id = p_review and reviewer_id = v_me;
  if r.id is null then
    raise exception 'review not found' using errcode = 'P0002';
  end if;
  select * into a from public.task_attempts where id = r.attempt_id;
  select * into t from public.proof_tasks where id = a.task_id;
  return jsonb_build_object(
    'id', r.id, 'status', r.status, 'note', r.note, 'checklist_ticks', r.checklist, 'offered_at', r.offered_at,
    'student', (select split_part(p.full_name, ' ', 1) from public.profiles p where p.user_id = a.user_id),
    'university', (select u.name from public.profiles p join public.universities u on u.id = p.university_id where p.user_id = a.user_id),
    'skill', (select k.name from public.skills k where k.id = a.skill_id),
    'task', jsonb_build_object('title', t.title, 'brief', t.brief, 'checklist', t.checklist, 'difficulty', t.difficulty),
    'repo', case when r.status in ('offered', 'accepted') then a.repo_full_name end,
    'submitted_at', a.submitted_at,
    'reviews_left', greatest(0, private.task_limit('reviews_week') - (
      select count(*)::integer from public.task_reviews x
       where x.reviewer_id = v_me and x.status in ('accepted', 'confirmed', 'needs_changes')
         and x.responded_at > now() - interval '7 days')));
end;
$$;

create function private.accept_task_review(p_review uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  r public.task_reviews;
  a public.task_attempts;
begin
  select * into r from public.task_reviews where id = p_review and reviewer_id = v_me;
  if r.id is null then
    raise exception 'review not found' using errcode = 'P0002';
  end if;
  -- Lock order: the attempt, then its reviews.
  select * into a from public.task_attempts where id = r.attempt_id for update;
  select * into r from public.task_reviews where id = p_review for update;
  if r.status <> 'offered' then
    raise exception 'this review is no longer open' using errcode = '55000';
  end if;
  if a.status <> 'awaiting_peer' then
    raise exception 'someone else is already reviewing this task' using errcode = '55000';
  end if;
  if not private.task_peer_ok(v_me, a.user_id, a.skill_id) then
    raise exception 'you can''t review this task' using errcode = '42501';
  end if;
  update public.task_reviews set status = 'accepted', responded_at = now() where id = r.id;
  update public.task_reviews set status = 'withdrawn', responded_at = now()
   where attempt_id = a.id and id <> r.id and status = 'offered';
  -- The reviewer gets reoffer_days from now.
  update public.task_attempts set status = 'in_review', offered_at = now() where id = a.id;
end;
$$;

create function private.decline_task_review(p_review uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  r public.task_reviews;
  a public.task_attempts;
begin
  select * into r from public.task_reviews where id = p_review and reviewer_id = v_me;
  if r.id is null then
    raise exception 'review not found' using errcode = 'P0002';
  end if;
  select * into a from public.task_attempts where id = r.attempt_id for update;
  update public.task_reviews set status = 'declined', responded_at = now() where id = r.id and status = 'offered';
  if not found then
    raise exception 'this review is no longer open' using errcode = '55000';
  end if;
  -- Everyone in the round said no: ask the next peers now.
  if a.status = 'awaiting_peer'
     and not exists (select 1 from public.task_reviews x where x.attempt_id = a.id and x.status in ('offered', 'accepted')) then
    perform private.offer_task_peers(a.id);
  end if;
end;
$$;

-- p_ticks: one boolean per checklist item. Confirm needs every item ticked; Needs changes needs a note.
create function private.review_task(p_review uuid, p_confirm boolean, p_note text, p_ticks jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  r public.task_reviews;
  a public.task_attempts;
  t public.proof_tasks;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into r from public.task_reviews where id = p_review and reviewer_id = v_me;
  if r.id is null then
    raise exception 'review not found' using errcode = 'P0002';
  end if;
  select * into a from public.task_attempts where id = r.attempt_id for update;
  select * into r from public.task_reviews where id = p_review for update;
  if r.status <> 'accepted' or a.status <> 'in_review' then
    raise exception 'accept the review before you decide' using errcode = '55000';
  end if;
  -- Re-checked at the decision: friends made since the offer can't review each other.
  if private.are_friends(v_me, a.user_id) or private.is_blocked(v_me, a.user_id) then
    raise exception 'you can''t review a friend''s task' using errcode = '42501';
  end if;
  select * into t from public.proof_tasks where id = a.task_id;
  if p_ticks is null or jsonb_typeof(p_ticks) <> 'array' or jsonb_array_length(p_ticks) <> jsonb_array_length(t.checklist)
     or exists (select 1 from jsonb_array_elements(p_ticks) x where jsonb_typeof(x) <> 'boolean') then
    raise exception 'tick the checklist' using errcode = '22023';
  end if;
  if coalesce(p_confirm, false) then
    if exists (select 1 from jsonb_array_elements(p_ticks) x where x = 'false'::jsonb) then
      raise exception 'confirm only when every item is met' using errcode = '22023';
    end if;
    if v_note is not null and char_length(v_note) not between 3 and 1000 then
      raise exception 'keep the note between 3 and 1,000 characters' using errcode = '22023';
    end if;
    update public.task_reviews set status = 'confirmed', decided_at = now(), checklist = p_ticks, note = v_note where id = r.id;
    perform private.complete_task(a.id, 'peer');
  else
    if v_note is null or char_length(v_note) not between 3 and 1000 then
      raise exception 'say what needs to change (3 to 1,000 characters)' using errcode = '22023';
    end if;
    update public.task_reviews set status = 'needs_changes', decided_at = now(), checklist = p_ticks, note = v_note where id = r.id;
    update public.task_attempts set status = 'needs_changes', note = v_note where id = a.id;
    perform private.notify(a.user_id, null, 'task_needs_changes', 'task_attempt', a.id,
                           jsonb_build_object('title', t.title, 'skill', (select k.name from public.skills k where k.id = a.skill_id)));
  end if;
  perform private.track(v_me, 'proof_task_reviewed', jsonb_build_object('skill', a.skill_id, 'confirmed', coalesce(p_confirm, false)));
end;
$$;

-- Every 5 minutes: GitHub had its time → peers; nobody reviewed in reoffer_days → 3 more peers.
create function private.proof_tasks_tick()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a record;
  v_n integer := 0;
begin
  for a in select id, user_id from public.task_attempts
            where status = 'verifying'
              and submitted_at < now() - make_interval(mins => private.task_limit('github_wait_minutes'))
  loop
    perform private.task_github_check(a.user_id);
    if exists (select 1 from public.task_attempts where id = a.id and status = 'verifying') then
      perform private.offer_task_peers(a.id);
      v_n := v_n + 1;
    end if;
  end loop;
  for a in select id from public.task_attempts
            where status in ('awaiting_peer', 'in_review')
              and offered_at < now() - make_interval(days => private.task_limit('reoffer_days'))
  loop
    perform private.offer_task_peers(a.id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function private.proof_tasks_tick() from public;

-- ---------------------------------------------------------------------------
-- The skill drawer
-- ---------------------------------------------------------------------------
create function private.path_skill_drawer(p_skill text, p_role text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  k public.skills;
  v_uni uuid := private.current_university_id();
  v_state text;
  v_pos integer;
  v_prev text;
  p public.paths;
begin
  select * into k from public.skills where id = p_skill;
  if k.id is null then
    raise exception 'skill not found' using errcode = 'P0002';
  end if;
  if p_role is not null then
    select * into p from public.paths where role = p_role;
    select s.state, s.pos, s.prev_name into v_state, v_pos, v_prev from private.path_steps(v_me, p_role) s where s.skill_id = p_skill;
  end if;
  return jsonb_build_object(
    'skill', jsonb_build_object('id', k.id, 'name', k.name, 'category', k.category),
    'level', coalesce((select u.level from public.user_skills u where u.user_id = v_me and u.skill_id = p_skill), 0),
    'state', v_state,
    'why', case when p.role is not null then jsonb_build_object(
      'path', p.name, 'source', p.source, 'seniors', case when p.source = 'data' then p.seniors end,
      'position', v_pos, 'prev', v_prev,
      'after_days', (select ps.after_days from public.path_skills ps where ps.role = p_role and ps.skill_id = p_skill)) end,
    'evidence', coalesce((
      select jsonb_agg(jsonb_build_object('kind', e.kind, 'level', e.level, 'title', e.title, 'detail', e.detail, 'url', e.url,
                                          'on', to_char((e.occurred_at at time zone 'Asia/Karachi')::date, 'FMDD Mon YYYY')))
        from (select * from private.my_skill_proofs(p_skill) limit 8) e), '[]'::jsonb),
    'commits', (select count(*) from public.skill_evidence e where e.user_id = v_me and e.skill_id = p_skill),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'difficulty', t.difficulty,
                                          'attempt_id', o.id, 'attempt_status', o.status)
                       order by array_position(array['starter', 'core', 'stretch'], t.difficulty), t.created_at)
        from public.proof_tasks t
        left join lateral (select a.id, a.status from public.task_attempts a
                            where a.user_id = v_me and a.task_id = t.id and a.status <> 'abandoned'
                            order by a.started_at desc limit 1) o on true
       where t.skill_id = p_skill and t.active), '[]'::jsonb),
    'teachers', coalesce((
      select jsonb_agg(x order by (x ->> 'minutes')::integer desc, x ->> 'name')
        from (select jsonb_build_object('username', pr.username, 'name', pr.full_name, 'avatar_path', pr.avatar_path,
                                        'level', u.level, 'minutes', private.swap_minutes_taught(o.user_id)) as x
                from public.swap_offers o
                join public.user_skills u on u.user_id = o.user_id and u.skill_id = o.skill_id and u.level >= 2
                join public.profiles pr on pr.user_id = o.user_id and pr.university_id = v_uni and pr.status <> 'deleting'
               where o.skill_id = p_skill and o.user_id <> v_me and not private.is_blocked(v_me, o.user_id)
               limit 5) t), '[]'::jsonb),
    'openings', coalesce((
      select jsonb_agg(jsonb_build_object('venture_id', v.id, 'title', v.title, 'role', r.title))
        from (select distinct on (v.id) v.id, v.title, r.id as role_id
                from public.venture_roles r join public.ventures v on v.id = r.venture_id
               where p_skill = any (r.skill_ids) and r.filled < r.slots and v.status = 'recruiting'
                 and not exists (select 1 from public.venture_members m where m.venture_id = v.id and m.user_id = v_me)
                 and private.can_view_venture(v.id)
               order by v.id, r.created_at limit 3) v
        join public.venture_roles r on r.id = v.role_id), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- Evidence: my_skill_proofs gains kind proof_task
-- ---------------------------------------------------------------------------
create or replace function private.my_skill_proofs(p_skill text)
returns table (kind text, level smallint, title text, detail text, url text, venture_id uuid, occurred_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select 'pull_request', 3::smallint, p.repo_full_name || ' #' || p.number,
         case when p.counted then 'Merged or approved by someone else'
              when p.exclusion = 'own_repo' then 'Your own repository: doesn''t count'
              when p.exclusion = 'young_account' then 'Approved by an account under 90 days old: doesn''t count'
              else 'Not merged or approved by another person: doesn''t count' end,
         'https://github.com/' || p.repo_full_name || '/pull/' || p.number, null::uuid, p.merged_at
    from public.github_pr_skills s
    join public.github_pull_requests p
      on p.user_id = s.user_id and p.repo_github_id = s.repo_github_id and p.number = s.number
   where s.user_id = (select auth.uid()) and s.skill_id = p_skill
  union all
  select 'contribution', 3::smallint, v.title, e.description, null, v.id, o.created_at
    from public.contributions o
    join public.ventures v on v.id = o.venture_id
    cross join lateral (
      select c.id, c.description, c.skill_ids from public.contributions c
       where c.id = o.id or c.corrects_id = o.id
       order by c.created_at desc, (c.id = o.id)
       limit 1
    ) e
   where o.user_id = (select auth.uid()) and o.corrects_id is null and o.source = 'manual'
     and p_skill = any (e.skill_ids)
     and exists (select 1 from public.contribution_confirmations k
                  where k.contribution_id = e.id and k.confirmer_id <> o.user_id)
  union all
  select 'endorsement', 4::smallint, pr.full_name, v.title, null, v.id, e.created_at
    from public.endorsements e
    join public.profiles pr on pr.user_id = e.endorser_id
    join public.ventures v on v.id = e.venture_id
   where e.endorsee_id = (select auth.uid()) and e.skill_id = p_skill and not e.hidden
     and e.evidence_id is not null and private.entry_shows_skill(e.evidence_id, e.skill_id)
  union all
  select 'ai_pull_request', 2::smallint, g.full_name || ' #' || c.via_pr,
         format('Written with %s; %s %s', private.ai_agent_label(min(c.ai_agent)), count(*),
                case when count(*) = 1 then 'commit' else 'commits' end),
         'https://github.com/' || g.full_name || '/pull/' || c.via_pr, null::uuid, max(c.occurred_at)
    from public.github_commits c
    join public.github_repos g on g.repo_id = c.repo_id
   where c.user_id = (select auth.uid()) and c.ai_agent is not null and c.via_pr is not null and c.status = 'counted'
     and exists (select 1 from public.skill_evidence e where e.user_id = c.user_id and e.repo_id = c.repo_id
                   and e.sha = c.sha and e.skill_id = p_skill)
   group by g.full_name, c.via_pr
  union all
  select 'code_check', 4::smallint, 'Code check passed', null, null, null, c.graded_at
    from public.code_checks c
   where c.user_id = (select auth.uid()) and c.skill_id = p_skill and c.status = 'passed'
  union all
  select 'proof_task', 2::smallint, t.title,
         'Verified by ' || case a.verified_by when 'github' then 'GitHub' when 'peer' then 'a peer review' else 'a code check' end,
         case when a.repo_full_name is not null then 'https://github.com/' || a.repo_full_name end, null::uuid, a.done_at
    from public.task_attempts a
    join public.proof_tasks t on t.id = a.task_id
   where a.user_id = (select auth.uid()) and a.skill_id = p_skill and a.status = 'done'
   order by 7 desc;
$$;

-- ---------------------------------------------------------------------------
-- Staff: the bank in /ops/config/tasks (trust reviewers; audited before and after)
-- ---------------------------------------------------------------------------
create function private.ops_proof_tasks()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'staff only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', t.id, 'skill_id', t.skill_id, 'skill', k.name, 'title', t.title, 'difficulty', t.difficulty,
             'brief', t.brief, 'checklist', t.checklist, 'active', t.active, 'updated_at', t.updated_at,
             'started', (select count(*) from public.task_attempts a where a.task_id = t.id),
             'done', (select count(*) from public.task_attempts a where a.task_id = t.id and a.status = 'done'))
           order by k.name, array_position(array['starter', 'core', 'stretch'], t.difficulty), t.title)
      from public.proof_tasks t join public.skills k on k.id = t.skill_id), '[]'::jsonb);
end;
$$;

-- p: {skill_id, title, difficulty, brief, checklist[], active}. p_id null adds a task.
create function private.ops_save_proof_task(p_id uuid, p jsonb, p_reason text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_trust_reviewer();
  v_reason text := btrim(coalesce(p_reason, ''));
  old public.proof_tasks;
  v_id uuid;
  v_check jsonb := p -> 'checklist';
begin
  if char_length(v_reason) not between 3 and 500 then
    raise exception 'give a reason (3 to 500 characters)' using errcode = '22023';
  end if;
  if not exists (select 1 from public.skills where id = p ->> 'skill_id' and retired_at is null) then
    raise exception 'choose a skill' using errcode = '22023';
  end if;
  if jsonb_typeof(v_check) <> 'array' or jsonb_array_length(v_check) not between 3 and 6
     or exists (select 1 from jsonb_array_elements(v_check) x
                 where jsonb_typeof(x) <> 'string' or char_length(btrim(x #>> '{}')) not between 3 and 200) then
    raise exception 'the checklist has 3 to 6 items of up to 200 characters' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.proof_tasks (skill_id, title, difficulty, brief, checklist, active, author_id)
    values (p ->> 'skill_id', btrim(p ->> 'title'), p ->> 'difficulty', btrim(p ->> 'brief'), v_check,
            coalesce((p ->> 'active')::boolean, true), v_me)
    returning id into v_id;
    insert into public.ops_audit_log (staff_id, action, target_type, target_id, reason, before, after)
    values (v_me, 'proof_task.add', 'proof_task', v_id::text, v_reason, '{}'::jsonb,
            (select to_jsonb(t) - 'created_at' - 'updated_at' from public.proof_tasks t where t.id = v_id));
    return v_id;
  end if;
  select * into old from public.proof_tasks where id = p_id for update;
  if old.id is null then
    raise exception 'task not found' using errcode = 'P0002';
  end if;
  update public.proof_tasks
     set skill_id = p ->> 'skill_id', title = btrim(p ->> 'title'), difficulty = p ->> 'difficulty', brief = btrim(p ->> 'brief'),
         checklist = v_check, active = coalesce((p ->> 'active')::boolean, old.active)
   where id = p_id;
  insert into public.ops_audit_log (staff_id, action, target_type, target_id, reason, before, after)
  values (v_me, 'proof_task.edit', 'proof_task', p_id::text, v_reason, to_jsonb(old) - 'created_at' - 'updated_at',
          (select to_jsonb(t) - 'created_at' - 'updated_at' from public.proof_tasks t where t.id = p_id));
  return p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
insert into public.notification_categories (category, label, description, position, default_channel, allow_instant) values
  ('growth', 'Paths, tasks and swaps', 'Proof tasks done or sent back, reviews asked of you, and your skill swaps.', 26, 'digest', true);
insert into public.notification_types (type, category, emailed) values
  ('task_done', 'growth', false),
  ('task_needs_changes', 'growth', true),
  ('task_review_offer', 'growth', true);

-- ---------------------------------------------------------------------------
-- Home: the progress card's next step points at the next square of a followed path
-- ---------------------------------------------------------------------------
alter function private.next_best_action() rename to next_best_action_base;

create function private.next_best_action()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_role text;
  v_name text;
  v_skill text;
  v_skill_name text;
begin
  select f.role, p.name into v_role, v_name
    from public.path_follows f join public.paths p on p.role = f.role
   where f.user_id = v_me order by f.created_at limit 1;
  if v_role is not null then
    select s.skill_id, s.name into v_skill, v_skill_name from private.path_steps(v_me, v_role) s where s.state = 'next';
    if v_skill is not null then
      return jsonb_build_object('key', 'path_next', 'title', 'Next on your ' || v_name || ' path: ' || v_skill_name,
        'body', 'Start a proof task for it, or ask a senior through a skill swap.',
        'href', '/me/paths?role=' || v_role || '&skill=' || v_skill);
    end if;
  end if;
  return private.next_best_action_base();
end;
$$;
revoke all on function private.next_best_action_base() from public, authenticated;
revoke all on function private.next_best_action() from public;
grant execute on function private.next_best_action() to authenticated;

-- ---------------------------------------------------------------------------
-- Jobs and first run
-- ---------------------------------------------------------------------------
select cron.schedule('paths-weekly', '23 21 * * 0', $$select private.compute_paths()$$); -- Mondays 02:23 PKT
select cron.schedule('proof-tasks-tick', '*/5 * * * *', $$select private.proof_tasks_tick()$$);
select private.compute_paths();

-- ---------------------------------------------------------------------------
-- Public wrappers
-- ---------------------------------------------------------------------------
create function pg_temp.expose(p_names text[])
returns void
language plpgsql
as $$
declare
  n text;
  r record;
  v_names text;
begin
  foreach n in array p_names loop
    select p.oid, p.proname, p.provolatile, p.proargnames,
           pg_get_function_arguments(p.oid) as args,
           pg_get_function_identity_arguments(p.oid) as ident,
           pg_get_function_result(p.oid) as result
      into r
      from pg_proc p where p.pronamespace = 'private'::regnamespace and p.proname = n;
    if r.oid is null then
      raise exception 'no private function %', n;
    end if;
    select coalesce(string_agg(a, ', ' order by ord), '') into v_names
      from unnest(coalesce(r.proargnames, '{}'::text[])) with ordinality as t(a, ord);
    execute format('revoke all on function private.%I(%s) from public', n, r.ident);
    execute format('grant execute on function private.%I(%s) to authenticated', n, r.ident);
    execute format('create function public.%I(%s) returns %s language sql %s security invoker set search_path = %L as $f$ select private.%I(%s) $f$',
                   n, r.args, r.result, case r.provolatile when 'v' then 'volatile' else 'stable' end, '', n, v_names);
    execute format('revoke all on function public.%I(%s) from public, anon', n, r.ident);
    execute format('grant execute on function public.%I(%s) to authenticated', n, r.ident);
  end loop;
end;
$$;

select pg_temp.expose(array[
  'follow_path', 'my_paths', 'path_view', 'path_skill_drawer', 'start_task', 'link_task_repo', 'submit_task', 'abandon_task',
  'choose_task_code_check', 'my_task', 'task_review_page', 'accept_task_review', 'decline_task_review', 'review_task',
  'ops_proof_tasks', 'ops_save_proof_task']);
drop function pg_temp.expose(text[]);
