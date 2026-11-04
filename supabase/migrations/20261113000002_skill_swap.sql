-- Phase 17 (PRD 5.32): the skill swap. Students teach each other; the learner confirms each
-- session, and closing a swap with at least one confirmed session issues the teacher a Skilient
-- "Taught" Record entry (one per swap; a mutual swap is two swaps, one each way).
--
-- * swap_offers (L2 or higher) and swap_wants; matches are teachers at the same university.
-- * swaps: requested (7 days to answer) → accepted (a DM opens: get_or_create_dm's unlock rule
--   gains accepted swaps) → closed (either side, after 30 days without a session, or a block).
--   One open swap per pair per skill. A request may offer a skill back: accepting makes the
--   reverse swap too (mutual).
-- * swap_sessions: proposed by either side, accepted by the other, reminded, then the learner says
--   whether it happened (and how long). At most 10 confirmed hours per pair a week.
-- * swap_notes: optional thank-you notes (280 characters), on the teacher's profile once approved.
-- * anti_gaming_flags: `swap_repeat` (rapid repeat confirmations) and `swap_ring` (a cycle of three
--   people teaching each other in 30 days), for trust reviewers in /ops/evidence.
-- * Reports: target `swap`, by either side.

-- ---------------------------------------------------------------------------
-- Config
-- ---------------------------------------------------------------------------
insert into public.platform_config (key, version, value, reason) values
  ('swaps.limits', 1,
   '{"request_days": 7, "inactive_days": 30, "pair_week_minutes": 600, "open_requests": 5, "upcoming_sessions": 3, "rapid_confirms": 3, "rapid_hours": 24, "ring_days": 30}',
   'PRD 5.32: requests expire after 7 days, swaps close after 30 days without a session, 10 confirmed hours per pair a week, 5 open requests per learner, 3 upcoming sessions per swap; 3 confirmations in 24 hours or a three-person cycle in 30 days are flagged.');
insert into public.config_keys (key, area, description, applies, schema) values
  ('swaps.limits', 'paths', 'Skill swap: request expiry, inactivity close, confirmed minutes per pair a week, open requests, upcoming sessions, and the anti-gaming thresholds.', 'now',
   '{"type": "object", "additionalProperties": false,
     "required": ["request_days", "inactive_days", "pair_week_minutes", "open_requests", "upcoming_sessions", "rapid_confirms", "rapid_hours", "ring_days"],
     "properties": {
       "request_days": {"type": "integer", "minimum": 1, "maximum": 30},
       "inactive_days": {"type": "integer", "minimum": 7, "maximum": 180},
       "pair_week_minutes": {"type": "integer", "minimum": 60, "maximum": 2400},
       "open_requests": {"type": "integer", "minimum": 1, "maximum": 20},
       "upcoming_sessions": {"type": "integer", "minimum": 1, "maximum": 10},
       "rapid_confirms": {"type": "integer", "minimum": 2, "maximum": 20},
       "rapid_hours": {"type": "integer", "minimum": 1, "maximum": 168},
       "ring_days": {"type": "integer", "minimum": 1, "maximum": 180}}}');

create function private.swap_limit(p_field text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select private.cfg_int('swaps.limits', p_field,
                         case p_field when 'request_days' then 7 when 'inactive_days' then 30 when 'pair_week_minutes' then 600
                                      when 'open_requests' then 5 when 'upcoming_sessions' then 3 when 'rapid_confirms' then 3
                                      when 'rapid_hours' then 24 else 30 end);
$$;
revoke all on function private.swap_limit(text) from public;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.swap_offers (
  user_id uuid not null references auth.users (id) on delete cascade,
  skill_id text not null references public.skills (id),
  note text check (note is null or char_length(btrim(note)) between 1 and 280),
  created_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);
comment on table public.swap_offers is 'Skill swap "I can teach" (PRD 5.32): skills at L2 or higher. Owner reads; others see teachers through functions.';
create index swap_offers_skill_idx on public.swap_offers (skill_id);

create table public.swap_wants (
  user_id uuid not null references auth.users (id) on delete cascade,
  skill_id text not null references public.skills (id),
  note text check (note is null or char_length(btrim(note)) between 1 and 280),
  created_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);
comment on table public.swap_wants is 'Skill swap "I want to learn" (PRD 5.32). Owner reads; teachers see counts through functions.';
create index swap_wants_skill_idx on public.swap_wants (skill_id);

create table public.swaps (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users (id) on delete cascade,
  learner_id uuid not null references auth.users (id) on delete cascade,
  skill_id text not null references public.skills (id),
  -- A skill the learner offered back with the request (a mutual swap when accepted).
  offered_skill_id text references public.skills (id),
  mutual_of uuid references public.swaps (id) on delete set null,
  status text not null default 'requested' check (status in ('requested', 'accepted', 'declined', 'expired', 'cancelled', 'closed')),
  note text check (note is null or char_length(btrim(note)) between 1 and 500),
  preferred_times text check (preferred_times is null or char_length(btrim(preferred_times)) between 1 and 200),
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  decided_at timestamptz,
  closed_at timestamptz,
  closed_by uuid references auth.users (id) on delete set null,
  close_reason text check (close_reason in ('ended', 'inactive', 'blocked')),
  thread_id uuid references public.chat_threads (id) on delete set null,
  taught_entry_id uuid references public.record_entries (id) on delete set null,
  check (teacher_id <> learner_id),
  check (offered_skill_id is null or offered_skill_id <> skill_id),
  check ((status = 'closed') = (closed_at is not null)),
  check ((status = 'closed') = (close_reason is not null))
);
comment on table public.swaps is 'Skill swaps (PRD 5.32): one teacher, one learner, one skill. Both sides read; written by functions.';
-- One open swap per pair per skill, whichever way round.
create unique index swaps_one_open on public.swaps (least(teacher_id, learner_id), greatest(teacher_id, learner_id), skill_id)
  where status in ('requested', 'accepted');
create index swaps_teacher_idx on public.swaps (teacher_id, status);
create index swaps_learner_idx on public.swaps (learner_id, status);
create index swaps_skill_idx on public.swaps (skill_id);
create index swaps_offered_skill_idx on public.swaps (offered_skill_id) where offered_skill_id is not null;
create index swaps_mutual_idx on public.swaps (mutual_of) where mutual_of is not null;
create index swaps_thread_idx on public.swaps (thread_id) where thread_id is not null;
create index swaps_entry_idx on public.swaps (taught_entry_id) where taught_entry_id is not null;
create index swaps_closed_by_idx on public.swaps (closed_by) where closed_by is not null;
create index swaps_expiry_idx on public.swaps (expires_at) where status = 'requested';

create table public.swap_sessions (
  id uuid primary key default gen_random_uuid(),
  swap_id uuid not null references public.swaps (id) on delete cascade,
  proposed_by uuid not null references auth.users (id) on delete cascade,
  starts_at timestamptz not null,
  minutes smallint not null check (minutes between 15 and 240),
  place text not null check (char_length(btrim(place)) between 2 and 200),
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'declined', 'cancelled', 'confirmed', 'no_show')),
  responded_at timestamptz,
  confirmed_minutes smallint check (confirmed_minutes between 15 and 240),
  confirmed_at timestamptz,
  no_show_reason text check (no_show_reason in ('teacher_absent', 'learner_absent', 'rescheduled', 'other')),
  reminded_at timestamptz,
  asked_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'confirmed') = (confirmed_at is not null)),
  check ((status = 'confirmed') = (confirmed_minutes is not null)),
  check ((status = 'no_show') = (no_show_reason is not null))
);
comment on table public.swap_sessions is 'Skill swap sessions (PRD 5.32). Both sides of the swap read; the learner confirms.';
create index swap_sessions_swap_idx on public.swap_sessions (swap_id, starts_at);
create index swap_sessions_proposed_by_idx on public.swap_sessions (proposed_by);
create index swap_sessions_upcoming_idx on public.swap_sessions (starts_at) where status = 'accepted';

create table public.swap_notes (
  id uuid primary key default gen_random_uuid(),
  swap_id uuid not null references public.swaps (id) on delete cascade,
  session_id uuid not null unique references public.swap_sessions (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  teacher_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 280),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'pending') = (decided_at is null))
);
comment on table public.swap_notes is 'Thank-you notes (PRD 5.32): shown on the teacher''s profile once the teacher approves. Author and teacher read.';
create index swap_notes_teacher_idx on public.swap_notes (teacher_id, status);
create index swap_notes_swap_idx on public.swap_notes (swap_id);
create index swap_notes_author_idx on public.swap_notes (author_id);

alter table public.swap_offers enable row level security;
alter table public.swap_wants enable row level security;
alter table public.swaps enable row level security;
alter table public.swap_sessions enable row level security;
alter table public.swap_notes enable row level security;
revoke all on table public.swap_offers, public.swap_wants, public.swaps, public.swap_sessions, public.swap_notes from anon, authenticated;
grant select on table public.swap_offers, public.swap_wants, public.swaps, public.swap_sessions, public.swap_notes to authenticated;
create policy swap_offers_owner_read on public.swap_offers for select to authenticated using (user_id = (select auth.uid()));
create policy swap_wants_owner_read on public.swap_wants for select to authenticated using (user_id = (select auth.uid()));
create policy swaps_member_read on public.swaps for select to authenticated
  using (teacher_id = (select auth.uid()) or learner_id = (select auth.uid()));
create policy swap_sessions_member_read on public.swap_sessions for select to authenticated
  using (exists (select 1 from public.swaps s where s.id = swap_id
                   and (s.teacher_id = (select auth.uid()) or s.learner_id = (select auth.uid()))));
create policy swap_notes_read on public.swap_notes for select to authenticated
  using (author_id = (select auth.uid()) or teacher_id = (select auth.uid()));

do $$
declare
  t text;
begin
  foreach t in array array['swap_offers', 'swap_wants', 'swaps', 'swap_sessions', 'swap_notes'] loop
    execute format('create trigger refuse_if_restricted before insert on public.%I for each row execute function private.refuse_if_restricted()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- Confirmed minutes someone has taught, in every swap.
create function private.swap_minutes_taught(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(x.confirmed_minutes), 0)::integer
    from public.swap_sessions x join public.swaps s on s.id = x.swap_id
   where s.teacher_id = p_user and x.status = 'confirmed';
$$;
revoke all on function private.swap_minutes_taught(uuid) from public;

create function private.swap_hours_label(p_minutes integer)
returns text
language sql
immutable
set search_path = ''
as $$ select trim(trailing '.' from trim(trailing '0' from to_char(p_minutes / 60.0, 'FM9990.0'))) || ' h' $$;
revoke all on function private.swap_hours_label(integer) from public;

create function private.require_swap_member(p_swap uuid, p_lock boolean default false)
returns public.swaps
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  s public.swaps;
begin
  if p_lock then
    select * into s from public.swaps where id = p_swap and (teacher_id = v_me or learner_id = v_me) for update;
  else
    select * into s from public.swaps where id = p_swap and (teacher_id = v_me or learner_id = v_me);
  end if;
  if s.id is null then
    raise exception 'swap not found' using errcode = 'P0002';
  end if;
  return s;
end;
$$;
revoke all on function private.require_swap_member(uuid, boolean) from public;

-- Close a swap; with at least one confirmed session the teacher gets one Taught entry.
create function private.close_swap(p_swap uuid, p_reason text, p_by uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.swaps;
  v_sessions integer;
  v_minutes integer;
  v_last date;
  v_skill text;
  v_learner text;
  v_entry uuid;
begin
  update public.swaps set status = 'closed', closed_at = now(), close_reason = p_reason, closed_by = p_by
   where id = p_swap and status = 'accepted'
  returning * into s;
  if s.id is null then
    return;
  end if;
  update public.swap_sessions set status = 'cancelled', responded_at = coalesce(responded_at, now())
   where swap_id = s.id and status = 'proposed';
  select count(*)::integer, coalesce(sum(confirmed_minutes), 0)::integer, max((starts_at at time zone 'Asia/Karachi')::date)
    into v_sessions, v_minutes, v_last
    from public.swap_sessions where swap_id = s.id and status = 'confirmed';
  if v_sessions > 0 then
    select name into v_skill from public.skills where id = s.skill_id;
    select split_part(full_name, ' ', 1) into v_learner from public.profiles where user_id = s.learner_id;
    v_entry := private.issue_record_entry(
      s.teacher_id, null, 'taught', 'skilient', null, 'Skilient', 'swap', s.id,
      'Taught ' || v_skill || ' to ' || coalesce(v_learner, 'a student'),
      jsonb_build_object('line', v_sessions || case when v_sessions = 1 then ' session' else ' sessions' end
                                 || ' · ' || private.swap_hours_label(v_minutes),
                         'sessions', v_sessions, 'minutes', v_minutes, 'skill', s.skill_id),
      v_last, null);
    update public.swaps set taught_entry_id = v_entry where id = s.id;
  end if;
  perform private.notify(u, p_by, 'swap_closed', 'swap', s.id,
                         jsonb_build_object('skill', (select name from public.skills where id = s.skill_id), 'reason', p_reason,
                                            'sessions', v_sessions, 'taught', u = s.teacher_id and v_sessions > 0))
     from unnest(array[s.teacher_id, s.learner_id]) as u
    where u is distinct from p_by;
  perform private.track(s.teacher_id, 'swap_closed', jsonb_build_object('skill', s.skill_id, 'reason', p_reason, 'sessions', v_sessions));
end;
$$;
revoke all on function private.close_swap(uuid, text, uuid) from public;

-- ---------------------------------------------------------------------------
-- Offers and wants
-- ---------------------------------------------------------------------------
create function private.save_swap_offer(p_skill text, p_note text, p_on boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not coalesce(p_on, false) then
    delete from public.swap_offers where user_id = v_me and skill_id = p_skill;
    return;
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = v_me and p.role = 'student') then
    raise exception 'the skill swap is for students' using errcode = '42501';
  end if;
  if not exists (select 1 from public.user_skills u join public.skills k on k.id = u.skill_id and k.retired_at is null
                  where u.user_id = v_me and u.skill_id = p_skill and u.level >= 2) then
    raise exception 'you can teach skills you hold at L2 or higher' using errcode = '42501';
  end if;
  if v_note is not null and char_length(v_note) > 280 then
    raise exception 'keep the note under 280 characters' using errcode = '22023';
  end if;
  insert into public.swap_offers (user_id, skill_id, note) values (v_me, p_skill, v_note)
  on conflict (user_id, skill_id) do update set note = excluded.note;
end;
$$;

create function private.save_swap_want(p_skill text, p_note text, p_on boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not coalesce(p_on, false) then
    delete from public.swap_wants where user_id = v_me and skill_id = p_skill;
    return;
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = v_me and p.role = 'student') then
    raise exception 'the skill swap is for students' using errcode = '42501';
  end if;
  if not exists (select 1 from public.skills k where k.id = p_skill and k.retired_at is null) then
    raise exception 'skill not found' using errcode = 'P0002';
  end if;
  if v_note is not null and char_length(v_note) > 280 then
    raise exception 'keep the note under 280 characters' using errcode = '22023';
  end if;
  if (select count(*) from public.swap_wants where user_id = v_me) >= 20 then
    raise exception 'you can list up to 20 skills to learn' using errcode = '23514';
  end if;
  insert into public.swap_wants (user_id, skill_id, note) values (v_me, p_skill, v_note)
  on conflict (user_id, skill_id) do update set note = excluded.note;
end;
$$;

-- Teachers of a skill at the caller's university: level, hours taught, approved notes.
create function private.swap_teachers(p_skill text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_uni uuid := private.current_university_id();
begin
  return coalesce((
    select jsonb_agg(x order by (x ->> 'minutes')::integer desc, x ->> 'name')
      from (select jsonb_build_object(
                     'username', p.username, 'name', p.full_name, 'avatar_path', p.avatar_path, 'level', u.level,
                     'note', o.note, 'minutes', private.swap_minutes_taught(o.user_id),
                     'notes', coalesce((select jsonb_agg(n.body order by n.decided_at desc)
                                          from (select n.body, n.decided_at from public.swap_notes n
                                                 where n.teacher_id = o.user_id and n.status = 'approved'
                                                 order by n.decided_at desc limit 3) n), '[]'::jsonb),
                     'open', exists (select 1 from public.swaps s where s.status in ('requested', 'accepted') and s.skill_id = p_skill
                                       and least(s.teacher_id, s.learner_id) = least(o.user_id, v_me)
                                       and greatest(s.teacher_id, s.learner_id) = greatest(o.user_id, v_me))) as x
              from public.swap_offers o
              join public.user_skills u on u.user_id = o.user_id and u.skill_id = o.skill_id and u.level >= 2
              join public.profiles p on p.user_id = o.user_id and p.university_id = v_uni and p.status <> 'deleting'
                                    and p.role = 'student' and p.username is not null
             where o.skill_id = p_skill and o.user_id <> v_me and not private.is_blocked(v_me, o.user_id)
             limit 50) t), '[]'::jsonb);
end;
$$;

-- /swaps: offers, wants, matches, requests and the caller's swaps.
create function private.swaps_page()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_uni uuid := private.current_university_id();
begin
  return jsonb_build_object(
    'teachable', coalesce((
      select jsonb_agg(jsonb_build_object('skill_id', u.skill_id, 'name', k.name, 'level', u.level,
                                          'offered', o.user_id is not null, 'note', o.note,
                                          'wanted_by', (select count(*) from public.swap_wants w join public.profiles p on p.user_id = w.user_id
                                                         where w.skill_id = u.skill_id and w.user_id <> v_me and p.university_id = v_uni))
                       order by u.level desc, k.name)
        from public.user_skills u
        join public.skills k on k.id = u.skill_id and k.retired_at is null
        left join public.swap_offers o on o.user_id = v_me and o.skill_id = u.skill_id
       where u.user_id = v_me and u.level >= 2), '[]'::jsonb),
    'wants', coalesce((
      select jsonb_agg(jsonb_build_object('skill_id', w.skill_id, 'name', k.name, 'note', w.note,
                                          'teachers', private.swap_teachers(w.skill_id)) order by w.created_at)
        from public.swap_wants w join public.skills k on k.id = w.skill_id
       where w.user_id = v_me), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'skill', k.name, 'learner', p.full_name, 'username', p.username,
                                          'avatar_path', p.avatar_path, 'note', s.note, 'preferred_times', s.preferred_times,
                                          'offered_skill', (select name from public.skills where id = s.offered_skill_id),
                                          'expires_at', s.expires_at) order by s.requested_at)
        from public.swaps s join public.skills k on k.id = s.skill_id join public.profiles p on p.user_id = s.learner_id
       where s.teacher_id = v_me and s.status = 'requested' and s.expires_at > now()), '[]'::jsonb),
    'swaps', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'role', case when s.teacher_id = v_me then 'teacher' else 'learner' end, 'status', s.status,
               'skill', k.name, 'other', p.full_name, 'username', p.username, 'avatar_path', p.avatar_path,
               'requested_at', s.requested_at, 'closed_at', s.closed_at,
               'sessions', (select count(*) from public.swap_sessions x where x.swap_id = s.id and x.status = 'confirmed'),
               'next_session', (select min(x.starts_at) from public.swap_sessions x where x.swap_id = s.id and x.status = 'accepted' and x.starts_at > now()))
               order by case s.status when 'accepted' then 0 when 'requested' then 1 else 2 end, s.requested_at desc)
        from public.swaps s
        join public.skills k on k.id = s.skill_id
        join public.profiles p on p.user_id = case when s.teacher_id = v_me then s.learner_id else s.teacher_id end
       where (s.teacher_id = v_me or s.learner_id = v_me)
         and (s.status in ('requested', 'accepted') or coalesce(s.closed_at, s.decided_at, s.expires_at) > now() - interval '90 days')), '[]'::jsonb),
    'minutes_taught', private.swap_minutes_taught(v_me),
    'notes_pending', (select count(*) from public.swap_notes n where n.teacher_id = v_me and n.status = 'pending'));
end;
$$;

-- ---------------------------------------------------------------------------
-- Requests
-- ---------------------------------------------------------------------------
create function private.request_swap(p_teacher text, p_skill text, p_note text, p_times text, p_offer text default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_teacher uuid := private.user_id_for(p_teacher);
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_times text := nullif(btrim(coalesce(p_times, '')), '');
  v_offer text := nullif(btrim(coalesce(p_offer, '')), '');
  v_id uuid;
begin
  if v_teacher is null or v_teacher = v_me or private.is_blocked(v_me, v_teacher) then
    raise exception 'teacher not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.profiles a join public.profiles b on b.user_id = v_teacher
                  where a.user_id = v_me and a.role = 'student' and b.role = 'student' and b.status <> 'deleting'
                    and a.university_id is not null and a.university_id = b.university_id) then
    raise exception 'you can ask teachers at your own university' using errcode = '42501';
  end if;
  if not exists (select 1 from public.swap_offers o join public.user_skills u on u.user_id = o.user_id and u.skill_id = o.skill_id
                  where o.user_id = v_teacher and o.skill_id = p_skill and u.level >= 2) then
    raise exception 'they don''t teach that skill in swaps' using errcode = 'P0002';
  end if;
  if v_offer is not null and not exists (select 1 from public.user_skills u where u.user_id = v_me and u.skill_id = v_offer and u.level >= 2) then
    raise exception 'you can offer back a skill you hold at L2 or higher' using errcode = '22023';
  end if;
  if v_offer = p_skill then
    raise exception 'offer back a different skill' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 500 or v_times is not null and char_length(v_times) > 200 then
    raise exception 'keep the note under 500 characters and the times under 200' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('swap_requests:' || v_me::text, 0));
  if (select count(*) from public.swaps where learner_id = v_me and status = 'requested' and expires_at > now()) >= private.swap_limit('open_requests') then
    raise exception 'you have % requests waiting; wait for answers first', private.swap_limit('open_requests') using errcode = '23514';
  end if;
  begin
    insert into public.swaps (teacher_id, learner_id, skill_id, offered_skill_id, note, preferred_times, expires_at)
    values (v_teacher, v_me, p_skill, v_offer, v_note, v_times, now() + make_interval(days => private.swap_limit('request_days')))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'you already have an open swap with them for this skill' using errcode = '23505';
  end;
  perform private.notify(v_teacher, v_me, 'swap_request', 'swap', v_id,
                         jsonb_build_object('skill', (select name from public.skills where id = p_skill),
                                            'offered', (select name from public.skills where id = v_offer)));
  perform private.track(v_me, 'swap_requested', jsonb_build_object('skill', p_skill, 'mutual', v_offer is not null));
  return v_id;
end;
$$;

create function private.respond_swap(p_swap uuid, p_accept boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  s public.swaps;
  v_thread uuid;
  v_back uuid;
  v_username text;
begin
  select * into s from public.swaps where id = p_swap and teacher_id = v_me for update;
  if s.id is null then
    raise exception 'swap not found' using errcode = 'P0002';
  end if;
  if s.status <> 'requested' then
    raise exception 'this request is no longer open' using errcode = '55000';
  end if;
  if s.expires_at <= now() then
    update public.swaps set status = 'expired', decided_at = now() where id = s.id;
    return;
  end if;
  if not coalesce(p_accept, false) then
    update public.swaps set status = 'declined', decided_at = now() where id = s.id;
    perform private.notify(s.learner_id, v_me, 'swap_declined', 'swap', s.id,
                           jsonb_build_object('skill', (select name from public.skills where id = s.skill_id)));
    return;
  end if;
  if private.is_blocked(v_me, s.learner_id) then
    raise exception 'swap not found' using errcode = 'P0002';
  end if;
  update public.swaps set status = 'accepted', decided_at = now() where id = s.id;
  -- Mutual: the learner teaches the offered skill back, unless that pair already has it open.
  if s.offered_skill_id is not null then
    begin
      insert into public.swaps (teacher_id, learner_id, skill_id, mutual_of, status, requested_at, expires_at, decided_at)
      values (s.learner_id, v_me, s.offered_skill_id, s.id, 'accepted', s.requested_at, now(), now())
      returning id into v_back;
      update public.swaps set mutual_of = v_back where id = s.id;
    exception when unique_violation then
      v_back := null;
    end;
  end if;
  -- The DM opens (the same unlock as an accepted venture application).
  select username into v_username from public.profiles where user_id = s.learner_id;
  if v_username is not null then
    v_thread := private.get_or_create_dm(v_username);
    update public.swaps set thread_id = v_thread where id in (s.id, v_back);
  end if;
  perform private.notify(s.learner_id, v_me, 'swap_accepted', 'swap', s.id,
                         jsonb_build_object('skill', (select name from public.skills where id = s.skill_id), 'mutual', v_back is not null));
  perform private.track(v_me, 'swap_accepted', jsonb_build_object('skill', s.skill_id, 'mutual', v_back is not null));
end;
$$;

create function private.cancel_swap_request(p_swap uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
begin
  update public.swaps set status = 'cancelled', decided_at = now()
   where id = p_swap and learner_id = v_me and status = 'requested';
  if not found then
    raise exception 'this request is no longer open' using errcode = '55000';
  end if;
end;
$$;

create function private.end_swap(p_swap uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  s public.swaps := private.require_swap_member(p_swap, true);
begin
  if s.status <> 'accepted' then
    raise exception 'this swap isn''t open' using errcode = '55000';
  end if;
  perform private.close_swap(s.id, 'ended', v_me);
  -- A mutual swap ends both ways.
  if s.mutual_of is not null then
    perform private.close_swap(s.mutual_of, 'ended', v_me);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------
create function private.propose_swap_session(p_swap uuid, p_starts_at timestamptz, p_minutes integer, p_place text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  s public.swaps := private.require_swap_member(p_swap, true);
  v_place text := btrim(coalesce(p_place, ''));
  v_id uuid;
begin
  if s.status <> 'accepted' then
    raise exception 'this swap isn''t open' using errcode = '55000';
  end if;
  if p_starts_at is null or p_starts_at <= now() or p_starts_at > now() + interval '60 days' then
    raise exception 'pick a time in the next 60 days' using errcode = '22023';
  end if;
  if p_minutes is null or p_minutes not between 15 and 240 then
    raise exception 'a session is 15 minutes to 4 hours' using errcode = '22023';
  end if;
  if char_length(v_place) not between 2 and 200 then
    raise exception 'say where, or paste a link (up to 200 characters)' using errcode = '22023';
  end if;
  if (select count(*) from public.swap_sessions where swap_id = s.id and status in ('proposed', 'accepted') and starts_at > now())
     >= private.swap_limit('upcoming_sessions') then
    raise exception 'you have % sessions coming up; hold those first', private.swap_limit('upcoming_sessions') using errcode = '23514';
  end if;
  insert into public.swap_sessions (swap_id, proposed_by, starts_at, minutes, place)
  values (s.id, v_me, p_starts_at, p_minutes, v_place) returning id into v_id;
  perform private.notify(case when s.teacher_id = v_me then s.learner_id else s.teacher_id end, v_me, 'swap_session_proposed', 'swap', s.id,
                         jsonb_build_object('skill', (select name from public.skills where id = s.skill_id),
                                            'when', to_char(p_starts_at at time zone 'Asia/Karachi', 'FMDy DD Mon, HH24:MI')));
  return v_id;
end;
$$;

create function private.respond_swap_session(p_session uuid, p_accept boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  x public.swap_sessions;
  s public.swaps;
begin
  select * into x from public.swap_sessions where id = p_session;
  if x.id is null then
    raise exception 'session not found' using errcode = 'P0002';
  end if;
  s := private.require_swap_member(x.swap_id, true);
  select * into x from public.swap_sessions where id = p_session for update;
  if x.proposed_by = v_me then
    raise exception 'the other side accepts a session you proposed' using errcode = '42501';
  end if;
  if x.status <> 'proposed' or s.status <> 'accepted' then
    raise exception 'this session is no longer open' using errcode = '55000';
  end if;
  if coalesce(p_accept, false) and x.starts_at <= now() then
    raise exception 'that time has passed; propose another' using errcode = '55000';
  end if;
  update public.swap_sessions set status = case when coalesce(p_accept, false) then 'accepted' else 'declined' end, responded_at = now()
   where id = x.id;
  if coalesce(p_accept, false) then
    perform private.notify(x.proposed_by, v_me, 'swap_session_accepted', 'swap', s.id,
                           jsonb_build_object('skill', (select name from public.skills where id = s.skill_id),
                                              'when', to_char(x.starts_at at time zone 'Asia/Karachi', 'FMDy DD Mon, HH24:MI')));
  end if;
end;
$$;

create function private.cancel_swap_session(p_session uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  x public.swap_sessions;
begin
  select * into x from public.swap_sessions where id = p_session;
  if x.id is null then
    raise exception 'session not found' using errcode = 'P0002';
  end if;
  perform private.require_swap_member(x.swap_id, true);
  update public.swap_sessions set status = 'cancelled', responded_at = now()
   where id = x.id and status in ('proposed', 'accepted') and starts_at > now();
  if not found then
    raise exception 'only an upcoming session can be cancelled' using errcode = '55000';
  end if;
end;
$$;

-- Anti-gaming: rapid repeat confirmations within a pair, and three people teaching each other
-- in a cycle. Flags only; trust reviewers decide (/ops/evidence, ranking flags).
create function private.swap_flags(p_swap uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.swaps;
  v_n integer;
  v_members uuid[];
  v_ids uuid[];
  c uuid;
begin
  select * into s from public.swaps where id = p_swap;
  v_members := array(select x from unnest(array[s.teacher_id, s.learner_id]) x order by x);
  select count(*)::integer, array_agg(distinct w.id) into v_n, v_ids
    from public.swap_sessions x join public.swaps w on w.id = x.swap_id
   where x.status = 'confirmed' and x.confirmed_at > now() - make_interval(hours => private.swap_limit('rapid_hours'))
     and least(w.teacher_id, w.learner_id) = v_members[1] and greatest(w.teacher_id, w.learner_id) = v_members[2];
  if v_n >= private.swap_limit('rapid_confirms')
     and not exists (select 1 from public.anti_gaming_flags f where f.kind = 'swap_repeat' and f.status = 'open' and f.members = v_members) then
    insert into public.anti_gaming_flags (kind, members, detail)
    values ('swap_repeat', v_members, jsonb_build_object('swap_ids', v_ids, 'confirmations', v_n, 'hours', private.swap_limit('rapid_hours')));
  end if;
  -- A cycle: teacher → learner (this swap), learner → c, c → teacher, each with a confirmed session.
  for c in
    select distinct b.learner_id
      from public.swaps b
      join public.swaps d on d.teacher_id = b.learner_id and d.learner_id = s.teacher_id
     where b.teacher_id = s.learner_id and b.learner_id not in (s.teacher_id, s.learner_id)
       and exists (select 1 from public.swap_sessions x where x.swap_id = b.id and x.status = 'confirmed'
                     and x.confirmed_at > now() - make_interval(days => private.swap_limit('ring_days')))
       and exists (select 1 from public.swap_sessions x where x.swap_id = d.id and x.status = 'confirmed'
                     and x.confirmed_at > now() - make_interval(days => private.swap_limit('ring_days')))
  loop
    v_members := array(select x from unnest(array[s.teacher_id, s.learner_id, c]) x order by x);
    if not exists (select 1 from public.anti_gaming_flags f where f.kind = 'swap_ring' and f.status = 'open' and f.members = v_members) then
      insert into public.anti_gaming_flags (kind, members, detail)
      values ('swap_ring', v_members, jsonb_build_object(
        'swap_ids', (select jsonb_agg(w.id) from public.swaps w
                      where w.teacher_id = any (v_members) and w.learner_id = any (v_members)
                        and exists (select 1 from public.swap_sessions x where x.swap_id = w.id and x.status = 'confirmed')),
        'window_days', private.swap_limit('ring_days')));
    end if;
  end loop;
end;
$$;
revoke all on function private.swap_flags(uuid) from public;

-- The learner says whether a session happened: Yes with its length (and an optional note for the
-- teacher to approve), or No with a reason.
create function private.confirm_swap_session(p_session uuid, p_happened boolean, p_minutes integer, p_reason text, p_note text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  x public.swap_sessions;
  s public.swaps;
  v_week integer;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into x from public.swap_sessions where id = p_session;
  if x.id is null then
    raise exception 'session not found' using errcode = 'P0002';
  end if;
  s := private.require_swap_member(x.swap_id, true);
  if s.learner_id <> v_me then
    raise exception 'the learner confirms a session' using errcode = '42501';
  end if;
  select * into x from public.swap_sessions where id = p_session for update;
  if x.status <> 'accepted' or s.status <> 'accepted' then
    raise exception 'this session can''t be confirmed now' using errcode = '55000';
  end if;
  if x.starts_at > now() then
    raise exception 'confirm a session once it has started' using errcode = '55000';
  end if;
  if not coalesce(p_happened, false) then
    if p_reason is null or p_reason not in ('teacher_absent', 'learner_absent', 'rescheduled', 'other') then
      raise exception 'say why it didn''t happen' using errcode = '22023';
    end if;
    update public.swap_sessions set status = 'no_show', no_show_reason = p_reason, responded_at = now() where id = x.id;
    return;
  end if;
  if p_minutes is null or p_minutes not between 15 and 240 then
    raise exception 'a session is 15 minutes to 4 hours' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 280 then
    raise exception 'keep the note under 280 characters' using errcode = '22023';
  end if;
  -- At most pair_week_minutes confirmed between the two of them (either way) in the 7 days to this session.
  perform pg_advisory_xact_lock(hashtextextended('swap_pair:' || least(s.teacher_id, s.learner_id)::text || greatest(s.teacher_id, s.learner_id)::text, 0));
  select coalesce(sum(y.confirmed_minutes), 0)::integer into v_week
    from public.swap_sessions y join public.swaps w on w.id = y.swap_id
   where y.status = 'confirmed' and y.starts_at > x.starts_at - interval '7 days' and y.starts_at <= x.starts_at + interval '7 days'
     and least(w.teacher_id, w.learner_id) = least(s.teacher_id, s.learner_id)
     and greatest(w.teacher_id, w.learner_id) = greatest(s.teacher_id, s.learner_id);
  if v_week + p_minutes > private.swap_limit('pair_week_minutes') then
    raise exception 'at most % confirmed hours a week between the two of you', private.swap_limit('pair_week_minutes') / 60 using errcode = '23514';
  end if;
  update public.swap_sessions set status = 'confirmed', confirmed_minutes = p_minutes, confirmed_at = now(), responded_at = now()
   where id = x.id;
  if v_note is not null then
    insert into public.swap_notes (swap_id, session_id, author_id, teacher_id, body) values (s.id, x.id, v_me, s.teacher_id, v_note);
    perform private.notify(s.teacher_id, v_me, 'swap_note', 'swap', s.id,
                           jsonb_build_object('skill', (select name from public.skills where id = s.skill_id)));
  end if;
  perform private.swap_flags(s.id);
  perform private.track(v_me, 'swap_session_confirmed', jsonb_build_object('skill', s.skill_id, 'minutes', p_minutes));
end;
$$;

create function private.decide_swap_note(p_note uuid, p_approve boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
begin
  update public.swap_notes set status = case when coalesce(p_approve, false) then 'approved' else 'declined' end, decided_at = now()
   where id = p_note and teacher_id = v_me and status = 'pending';
  if not found then
    raise exception 'this note isn''t waiting for you' using errcode = '55000';
  end if;
end;
$$;

-- One swap's page, for either side.
create function private.swap_page(p_swap uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  s public.swaps;
  v_other uuid;
begin
  select * into s from public.swaps where id = p_swap and (teacher_id = v_me or learner_id = v_me);
  if s.id is null then
    raise exception 'swap not found' using errcode = 'P0002';
  end if;
  v_other := case when s.teacher_id = v_me then s.learner_id else s.teacher_id end;
  return jsonb_build_object(
    'id', s.id, 'role', case when s.teacher_id = v_me then 'teacher' else 'learner' end, 'status', s.status,
    'skill', jsonb_build_object('id', s.skill_id, 'name', (select name from public.skills where id = s.skill_id)),
    'teacher_level', (select u.level from public.user_skills u where u.user_id = s.teacher_id and u.skill_id = s.skill_id),
    'other', (select jsonb_build_object('name', p.full_name, 'first_name', split_part(p.full_name, ' ', 1), 'username', p.username,
                                        'avatar_path', p.avatar_path) from public.profiles p where p.user_id = v_other),
    'note', s.note, 'preferred_times', s.preferred_times,
    'offered_skill', (select name from public.skills where id = s.offered_skill_id),
    'mutual', case when s.mutual_of is not null then jsonb_build_object(
      'id', s.mutual_of, 'skill', (select k.name from public.swaps m join public.skills k on k.id = m.skill_id where m.id = s.mutual_of)) end,
    'requested_at', s.requested_at, 'expires_at', s.expires_at, 'decided_at', s.decided_at,
    'closed_at', s.closed_at, 'close_reason', s.close_reason, 'thread_id', s.thread_id,
    'blocked', private.is_blocked(v_me, v_other),
    'taught_code', (select e.code from public.record_entries e where e.id = s.taught_entry_id),
    'confirmed', (select jsonb_build_object('sessions', count(*), 'minutes', coalesce(sum(x.confirmed_minutes), 0))
                    from public.swap_sessions x where x.swap_id = s.id and x.status = 'confirmed'),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', x.id, 'starts_at', x.starts_at, 'minutes', x.minutes, 'place', x.place, 'status', x.status,
               'proposed_by_me', x.proposed_by = v_me, 'confirmed_minutes', x.confirmed_minutes, 'no_show_reason', x.no_show_reason,
               'note', (select jsonb_build_object('id', n.id, 'body', n.body, 'status', n.status) from public.swap_notes n where n.session_id = x.id))
             order by x.starts_at desc)
        from public.swap_sessions x where x.swap_id = s.id), '[]'::jsonb));
end;
$$;

-- Approved thank-you notes on a profile, for anyone who can see that profile.
create function private.swap_notes_for(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_user();
  if not private.can_view_profile(p_user) or private.is_blocked((select auth.uid()), p_user) then
    return jsonb_build_object('minutes', 0, 'notes', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'minutes', private.swap_minutes_taught(p_user),
    'notes', coalesce((
      select jsonb_agg(jsonb_build_object('body', n.body, 'author', p.full_name, 'skill', k.name,
                                          'on', to_char((n.decided_at at time zone 'Asia/Karachi')::date, 'FMDD Mon YYYY'))
                       order by n.decided_at desc)
        from (select * from public.swap_notes where teacher_id = p_user and status = 'approved' order by decided_at desc limit 10) n
        join public.swaps s on s.id = n.swap_id
        join public.skills k on k.id = s.skill_id
        join public.profiles p on p.user_id = n.author_id
       where not private.is_blocked((select auth.uid()), n.author_id)), '[]'::jsonb));
end;
$$;

-- Every 15 minutes: expire requests, remind both sides a day ahead, ask the learner afterwards,
-- and close swaps with no session in inactive_days.
create function private.swap_tick()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r record;
  v_n integer := 0;
begin
  for r in update public.swaps set status = 'expired', decided_at = now()
            where status = 'requested' and expires_at <= now()
           returning id, learner_id, skill_id
  loop
    perform private.notify(r.learner_id, null, 'swap_declined', 'swap', r.id,
                           jsonb_build_object('skill', (select name from public.skills where id = r.skill_id), 'expired', true));
    v_n := v_n + 1;
  end loop;
  for r in update public.swap_sessions x set reminded_at = now()
             from public.swaps s
            where s.id = x.swap_id and s.status = 'accepted' and x.status = 'accepted' and x.reminded_at is null
              and x.starts_at > now() and x.starts_at <= now() + interval '24 hours'
           returning x.id, x.starts_at, x.place, s.id as swap_id, s.teacher_id, s.learner_id, s.skill_id
  loop
    perform private.notify(u, null, 'swap_session_reminder', 'swap', r.swap_id,
                           jsonb_build_object('skill', (select name from public.skills where id = r.skill_id), 'place', r.place,
                                              'when', to_char(r.starts_at at time zone 'Asia/Karachi', 'FMDy DD Mon, HH24:MI')))
       from unnest(array[r.teacher_id, r.learner_id]) as u;
    v_n := v_n + 1;
  end loop;
  for r in update public.swap_sessions x set asked_at = now()
             from public.swaps s
            where s.id = x.swap_id and s.status = 'accepted' and x.status = 'accepted' and x.asked_at is null
              and x.starts_at + make_interval(mins => x.minutes) <= now()
           returning x.id, s.id as swap_id, s.learner_id, s.teacher_id, s.skill_id
  loop
    perform private.notify(r.learner_id, r.teacher_id, 'swap_session_ask', 'swap', r.swap_id,
                           jsonb_build_object('skill', (select name from public.skills where id = r.skill_id)));
    v_n := v_n + 1;
  end loop;
  for r in select s.id from public.swaps s
            where s.status = 'accepted'
              and greatest(s.decided_at, (select max(x.starts_at) from public.swap_sessions x
                                           where x.swap_id = s.id and x.status in ('accepted', 'confirmed', 'proposed')))
                  < now() - make_interval(days => private.swap_limit('inactive_days'))
  loop
    perform private.close_swap(r.id, 'inactive', null);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function private.swap_tick() from public;

-- Blocks end swaps (closing one with confirmed sessions still issues the Taught entry).
create function private.swaps_on_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.swaps set status = 'cancelled', decided_at = now()
   where status = 'requested'
     and ((teacher_id = new.blocker_id and learner_id = new.blocked_id) or (teacher_id = new.blocked_id and learner_id = new.blocker_id));
  for v_id in select id from public.swaps
               where status = 'accepted'
                 and ((teacher_id = new.blocker_id and learner_id = new.blocked_id) or (teacher_id = new.blocked_id and learner_id = new.blocker_id))
  loop
    perform private.close_swap(v_id, 'blocked', null);
  end loop;
  return null;
end;
$$;
revoke all on function private.swaps_on_block() from public;
create trigger blocks_end_swaps after insert on public.blocks
  for each row execute function private.swaps_on_block();

-- ---------------------------------------------------------------------------
-- Chat: an accepted swap unlocks a DM (5.9's rule for accepted venture applications)
-- ---------------------------------------------------------------------------
create or replace function private.get_or_create_dm(p_username text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_other uuid := private.user_id_for(p_username);
  v_key text;
  v_id uuid;
begin
  if v_me is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if v_other is null or private.is_blocked(v_me, v_other) then
    raise exception 'no one has that username' using errcode = 'P0002';
  end if;
  if v_other = v_me then
    raise exception 'you can''t message yourself' using errcode = '22023';
  end if;
  if not private.are_friends(v_me, v_other)
     and not exists (
       select 1 from public.application_threads t
        where t.status = 'accepted'
          and ((t.candidate_id = v_me and t.owner_id = v_other) or (t.candidate_id = v_other and t.owner_id = v_me)))
     and not exists (
       select 1 from public.swaps s
        where s.decided_at is not null and s.status in ('accepted', 'closed')
          and ((s.teacher_id = v_me and s.learner_id = v_other) or (s.teacher_id = v_other and s.learner_id = v_me))) then
    raise exception 'you can message friends, or the people on an application or skill swap you share' using errcode = '42501';
  end if;
  v_key := least(v_me, v_other)::text || ':' || greatest(v_me, v_other)::text;
  -- Serialise the pair so two parallel first messages make one thread.
  perform pg_advisory_xact_lock(hashtextextended('dm:' || v_key, 0));
  select id into v_id from public.chat_threads where type = 'dm' and dm_key = v_key;
  if v_id is null then
    insert into public.chat_threads (type, dm_key) values ('dm', v_key) returning id into v_id;
    insert into public.chat_thread_members (thread_id, user_id) values (v_id, v_me), (v_id, v_other);
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reports (5.12): either side can report a swap; the other side owns the case
-- ---------------------------------------------------------------------------
alter function private.report_snapshot(public.report_target, uuid) rename to report_snapshot_v16;
create function private.report_snapshot(p_type public.report_target, p_target uuid)
returns table (owner_id uuid, snapshot jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.report_snapshot_v16(p_type, p_target) where p_type <> 'swap'
  union all
  select case when s.teacher_id = (select auth.uid()) then s.learner_id else s.teacher_id end,
         jsonb_build_object('title', k.name || ' swap', 'body', s.note, 'status', s.status, 'teacher', t.full_name,
                            'teacher_username', t.username, 'learner', l.full_name, 'learner_username', l.username,
                            'author', case when s.teacher_id = (select auth.uid()) then l.full_name else t.full_name end,
                            'author_username', case when s.teacher_id = (select auth.uid()) then l.username else t.username end,
                            'sessions', (select count(*) from public.swap_sessions x where x.swap_id = s.id),
                            'notes', (select coalesce(jsonb_agg(n.body), '[]'::jsonb) from public.swap_notes n where n.swap_id = s.id),
                            'created_at', s.requested_at)
    from public.swaps s
    join public.skills k on k.id = s.skill_id
    join public.profiles t on t.user_id = s.teacher_id
    join public.profiles l on l.user_id = s.learner_id
   where p_type = 'swap' and s.id = p_target;
$$;
revoke all on function private.report_snapshot_v16(public.report_target, uuid), private.report_snapshot(public.report_target, uuid) from public;

alter function private.can_report(public.report_target, uuid) rename to can_report_v16;
create function private.can_report(p_type public.report_target, p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_type
    when 'swap' then exists (select 1 from public.swaps s where s.id = p_target
                               and (s.teacher_id = (select auth.uid()) or s.learner_id = (select auth.uid())))
    else private.can_report_v16(p_type, p_target)
  end;
$$;
revoke all on function private.can_report_v16(public.report_target, uuid) from public;
revoke all on function private.can_report(public.report_target, uuid) from public;
grant execute on function private.can_report(public.report_target, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
insert into public.notification_types (type, category, emailed) values
  ('swap_request', 'growth', true),
  ('swap_accepted', 'growth', true),
  ('swap_declined', 'growth', false),
  ('swap_session_proposed', 'growth', true),
  ('swap_session_accepted', 'growth', false),
  ('swap_session_reminder', 'growth', true),
  ('swap_session_ask', 'growth', true),
  ('swap_note', 'growth', false),
  ('swap_closed', 'growth', false);

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------
select cron.schedule('swap-tick', '*/15 * * * *', $$select private.swap_tick()$$);

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
  'save_swap_offer', 'save_swap_want', 'swap_teachers', 'swaps_page', 'request_swap', 'respond_swap', 'cancel_swap_request',
  'end_swap', 'propose_swap_session', 'respond_swap_session', 'cancel_swap_session', 'confirm_swap_session', 'decide_swap_note',
  'swap_page', 'swap_notes_for']);
drop function pg_temp.expose(text[]);
