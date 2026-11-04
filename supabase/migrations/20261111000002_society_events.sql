-- Phase 15 (PRD 5.31): society events, built on the university events of phase 9 (events,
-- event_registrations, private.event_secrets).
--
-- * events gain society_id, status, record kinds, teams, approval mode, a registration window,
--   eligibility, a cover, a refund policy and the event post; university events keep working behind
--   the university portal and never mix with society events (can_attend_event/can_see_event).
-- * event_sessions, event_ticket_types (capacity, free or a PKR price), event_questions (the form),
--   event_cohosts, event_teams, event_staff, event_checkins (per session), event_email_attendees
--   (walk-ins added by university email, kept for phase 16 claims), event_results, volunteer_logs,
--   event_issuances (the close-out preview, stored for phase 16 to sign), event_feedback, event_messages.
-- * Seats and waitlist promotion run under a row lock per ticket type, so parallel registrations
--   can't oversell (tests/worker/event-seats.test.ts).
-- * Tickets are signed: SKT1.<registration>.<HMAC of event, registration and user, keyed by the event
--   secret>, verified in SQL at check-in; a second scan answers with the first time.
-- * event-tick (every minute): live/ended, reminders 24 h and 1 h before. event-closeout (hourly):
--   stores the Attended and Completed issue at 72 hours when the host hasn't.
-- Paid tickets (payment details, receipts, holds, refunds) are in the next migration.

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
alter table public.events
  add column society_id uuid references public.societies (id) on delete cascade,
  add column status text not null default 'published' check (status in ('draft', 'published', 'live', 'ended', 'cancelled')),
  add column record_kinds text[] not null default '{attended}'
    check (record_kinds <@ array['attended', 'completed', 'result']::text[] and cardinality(record_kinds) between 1 and 3),
  add column completed_min smallint check (completed_min is null or completed_min between 1 and 20),
  add column volunteer_hours boolean not null default false,
  add column team_min smallint check (team_min is null or team_min between 2 and 6),
  add column team_max smallint check (team_max is null or team_max between 2 and 6),
  add column approval_mode text not null default 'automatic' check (approval_mode in ('automatic', 'manual')),
  add column registration_opens_at timestamptz,
  add column registration_closes_at timestamptz,
  add column eligibility jsonb not null default '{"scope": "university"}'
    check (jsonb_typeof(eligibility) = 'object' and eligibility ->> 'scope' in ('university', 'all', 'groups')),
  add column cover_path text check (cover_path is null or cover_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  add column refund_policy text not null default 'none' check (refund_policy in ('none', 'until')),
  add column refund_days smallint check (refund_days is null or refund_days between 1 and 60),
  add column post_id uuid references public.posts (id) on delete set null,
  add column published_at timestamptz,
  add column cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 500),
  add constraint events_team_range check ((team_min is null) = (team_max is null) and (team_min is null or team_min <= team_max)),
  add constraint events_registration_window check (registration_closes_at is null or registration_opens_at is null or registration_closes_at > registration_opens_at),
  add constraint events_refund check ((refund_policy = 'until') = (refund_days is not null));
-- University events keep their old meaning: cancelled_at is the cancellation.
update public.events set status = 'cancelled' where cancelled_at is not null;
create index events_society_idx on public.events (society_id, starts_at) where society_id is not null;

-- A replaced or deleted event cover is removed from storage (storage-cleanup).
create function private.event_cover_cleanup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.queue_storage_cleanup('society-media', old.cover_path);
  elsif old.cover_path is distinct from new.cover_path then
    perform private.queue_storage_cleanup('society-media', old.cover_path);
  end if;
  return null;
end;
$$;
revoke all on function private.event_cover_cleanup() from public;
create trigger events_cover_cleanup after update of cover_path or delete on public.events
  for each row when (old.cover_path is not null) execute function private.event_cover_cleanup();
create index events_status_idx on public.events (status, starts_at) where society_id is not null;
create index events_post_idx on public.events (post_id) where post_id is not null;

create table public.event_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  position smallint not null check (position between 1 and 20),
  title text check (title is null or char_length(btrim(title)) between 2 and 80),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  check (ends_at > starts_at and ends_at <= starts_at + interval '24 hours'),
  unique (event_id, position)
);

create table public.event_ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  position smallint not null check (position between 1 and 5),
  name text not null check (char_length(btrim(name)) between 2 and 40),
  capacity integer not null check (capacity between 1 and 20000),
  price_pkr integer check (price_pkr is null or price_pkr between 1 and 1000000),
  unique (event_id, position)
);
create index event_ticket_types_event_idx on public.event_ticket_types (event_id);

create table public.event_questions (
  event_id uuid not null references public.events (id) on delete cascade,
  position smallint not null check (position between 1 and 8),
  label text not null check (char_length(btrim(label)) between 3 and 200),
  kind text not null check (kind in ('short', 'long', 'single', 'multi')),
  options text[] not null default '{}' check (cardinality(options) <= 10),
  required boolean not null default false,
  primary key (event_id, position),
  check ((kind in ('single', 'multi')) = (cardinality(options) >= 2))
);

create table public.event_cohosts (
  event_id uuid not null references public.events (id) on delete cascade,
  society_id uuid not null references public.societies (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  primary key (event_id, society_id)
);
create index event_cohosts_society_idx on public.event_cohosts (society_id);

create table public.event_teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 40),
  code text not null check (code ~ '^[A-Z0-9]{6}$'),
  captain_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (event_id, code)
);
create index event_teams_captain_idx on public.event_teams (captain_id);

alter table public.event_registrations
  add column id uuid not null default gen_random_uuid(),
  add column ticket_type_id uuid references public.event_ticket_types (id) on delete set null,
  add column status text not null default 'confirmed' check (status in ('confirmed', 'pending', 'waitlisted', 'held', 'cancelled', 'declined')),
  add column waitlist_position integer check (waitlist_position is null or waitlist_position >= 1),
  add column answers jsonb not null default '[]' check (jsonb_typeof(answers) = 'array'),
  add column team_id uuid references public.event_teams (id) on delete set null,
  add column added_by uuid references auth.users (id) on delete set null,
  add column hold_expires_at timestamptz,
  add column reminded_1h_at timestamptz,
  add column decided_at timestamptz;
alter table public.event_registrations add constraint event_registrations_id_key unique (id);
update public.event_registrations set status = 'cancelled' where cancelled_at is not null;
create index event_registrations_ticket_idx on public.event_registrations (ticket_type_id, status);
create index event_registrations_user_status_idx on public.event_registrations (user_id, status);
create index event_registrations_team_idx on public.event_registrations (team_id) where team_id is not null;
create index event_registrations_added_by_idx on public.event_registrations (added_by) where added_by is not null;
create index event_registrations_hold_idx on public.event_registrations (hold_expires_at) where status = 'held';

create table public.event_staff (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_staff_user_idx on public.event_staff (user_id);
create index event_staff_added_by_idx on public.event_staff (added_by) where added_by is not null;

create table public.event_email_attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  email text not null check (char_length(email) between 6 and 254 and email = lower(email) and email ~ '^[^\s@]+@[^\s@]+$'),
  added_by uuid references auth.users (id) on delete set null,
  claimed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (event_id, email)
);
comment on table public.event_email_attendees is 'Walk-ins added by university email who aren''t on Skilient yet (PRD 5.31); phase 16 sends the claim email.';
create index event_email_attendees_added_by_idx on public.event_email_attendees (added_by) where added_by is not null;
create index event_email_attendees_claimed_by_idx on public.event_email_attendees (claimed_by) where claimed_by is not null;

create table public.event_checkins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  session_id uuid not null references public.event_sessions (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  email_attendee_id uuid references public.event_email_attendees (id) on delete cascade,
  method text not null check (method in ('scan', 'search', 'email', 'self', 'manual', 'walk_in')),
  checked_in_by uuid references auth.users (id) on delete set null,
  checked_in_at timestamptz not null default now(),
  reason text check (reason is null or char_length(reason) <= 300),
  removed_at timestamptz,
  removed_by uuid references auth.users (id) on delete set null,
  removed_reason text check (removed_reason is null or char_length(removed_reason) <= 300),
  check ((user_id is null) <> (email_attendee_id is null)),
  check ((removed_at is null) = (removed_reason is null))
);
create unique index event_checkins_user_once on public.event_checkins (session_id, user_id) where user_id is not null;
create unique index event_checkins_email_once on public.event_checkins (session_id, email_attendee_id) where email_attendee_id is not null;
create index event_checkins_event_idx on public.event_checkins (event_id);
create index event_checkins_by_idx on public.event_checkins (checked_in_by) where checked_in_by is not null;
create index event_checkins_removed_by_idx on public.event_checkins (removed_by) where removed_by is not null;
create index event_checkins_user_idx on public.event_checkins (user_id) where user_id is not null;
create index event_checkins_email_idx on public.event_checkins (email_attendee_id) where email_attendee_id is not null;

create table public.event_results (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  team_id uuid references public.event_teams (id) on delete cascade,
  place smallint not null check (place between 1 and 50),
  label text check (label is null or char_length(btrim(label)) between 2 and 60),
  set_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((user_id is null) <> (team_id is null))
);
create unique index event_results_user_once on public.event_results (event_id, user_id) where user_id is not null;
create unique index event_results_team_once on public.event_results (event_id, team_id) where team_id is not null;
create index event_results_team_idx on public.event_results (team_id) where team_id is not null;
create index event_results_user_idx on public.event_results (user_id) where user_id is not null;
create index event_results_set_by_idx on public.event_results (set_by) where set_by is not null;

create table public.volunteer_logs (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  hours numeric(5, 2) not null check (hours > 0 and hours <= 336),
  logged_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index volunteer_logs_user_idx on public.volunteer_logs (user_id);
create index volunteer_logs_logged_by_idx on public.volunteer_logs (logged_by) where logged_by is not null;

create table public.event_issuances (
  event_id uuid primary key references public.events (id) on delete cascade,
  preview jsonb not null check (jsonb_typeof(preview) = 'object'),
  status text not null default 'queued' check (status in ('queued', 'signed')),
  auto boolean not null default false,
  issued_by uuid references auth.users (id) on delete set null,
  issued_at timestamptz not null default now()
);
comment on table public.event_issuances is 'Close-out''s issue: who earns Attended, Completed, Results and Volunteer hours. Stored for phase 16, which signs The Record entries.';
create index event_issuances_issued_by_idx on public.event_issuances (issued_by) where issued_by is not null;

create table public.event_feedback (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_feedback_user_idx on public.event_feedback (user_id);

create table public.event_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  sender_id uuid references auth.users (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 3 and 1000),
  created_at timestamptz not null default now()
);
create index event_messages_event_idx on public.event_messages (event_id, created_at desc);
create index event_messages_sender_idx on public.event_messages (sender_id) where sender_id is not null;

do $$
declare
  t text;
begin
  foreach t in array array['event_sessions', 'event_ticket_types', 'event_questions', 'event_cohosts', 'event_teams', 'event_staff',
                           'event_email_attendees', 'event_checkins', 'event_results', 'volunteer_logs', 'event_issuances',
                           'event_feedback', 'event_messages'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
  foreach t in array array['event_teams', 'event_feedback', 'event_messages'] loop
    execute format('create trigger refuse_if_restricted before insert on public.%I for each row execute function private.refuse_if_restricted()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Config, notifications, analytics
-- ---------------------------------------------------------------------------
insert into public.platform_config (key, version, value, reason) values
  ('events.ticket_limits', 1,
   '{"min_pkr": 100, "max_pkr": 10000, "hold_hours": 24, "max_ticket_types": 5, "max_sessions": 10, "max_questions": 8,
     "closeout_hours": 72, "feedback_days": 7, "receipt_delete_days": 90, "dispute_hours": 72, "refund_flag_days": 14,
     "feedback_min_group": 5}',
   'PRD 5.31: tickets PKR 100 to 10,000, 24-hour holds, 5 ticket types, 10 sessions, 8 questions, close-out for 72 hours, feedback for 7 days, receipts deleted after 90 days, disputes after 72 hours, unmarked refunds flagged after 14 days, feedback groups under 5 suppressed.');
insert into public.config_keys (key, area, description, applies, schema) values
  ('events.ticket_limits', 'events', 'Society event limits: ticket prices, holds, ticket types, sessions, questions, close-out, feedback, receipt retention, disputes and refunds.', 'now',
   '{"type": "object", "additionalProperties": false,
     "required": ["min_pkr", "max_pkr", "hold_hours", "max_ticket_types", "max_sessions", "max_questions", "closeout_hours",
                  "feedback_days", "receipt_delete_days", "dispute_hours", "refund_flag_days", "feedback_min_group"],
     "properties": {
       "min_pkr": {"type": "integer", "minimum": 1, "maximum": 100000},
       "max_pkr": {"type": "integer", "minimum": 1, "maximum": 1000000},
       "hold_hours": {"type": "integer", "minimum": 1, "maximum": 168},
       "max_ticket_types": {"type": "integer", "minimum": 1, "maximum": 5},
       "max_sessions": {"type": "integer", "minimum": 1, "maximum": 20},
       "max_questions": {"type": "integer", "minimum": 0, "maximum": 8},
       "closeout_hours": {"type": "integer", "minimum": 1, "maximum": 720},
       "feedback_days": {"type": "integer", "minimum": 1, "maximum": 60},
       "receipt_delete_days": {"type": "integer", "minimum": 7, "maximum": 365},
       "dispute_hours": {"type": "integer", "minimum": 1, "maximum": 720},
       "refund_flag_days": {"type": "integer", "minimum": 1, "maximum": 90},
       "feedback_min_group": {"type": "integer", "minimum": 1, "maximum": 50}}}');

insert into public.notification_types (type, category, emailed) values
  ('event_published', 'societies', false),
  ('event_registration', 'societies', true),
  ('event_promoted', 'societies', true),
  ('event_decided', 'societies', true),
  ('event_reminder', 'societies', true),
  ('event_changed', 'societies', true),
  ('event_cancelled', 'societies', true),
  ('event_message', 'societies', true),
  ('event_cohost', 'societies', false),
  ('event_staff_added', 'societies', false);

create function private.event_limit(p_key text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (coalesce(private.config('events.ticket_limits'), '{}'::jsonb) ->> p_key)::integer;
$$;
revoke all on function private.event_limit(text) from public;

create function private.event_analytics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'events' then
    if new.society_id is not null and coalesce(old.status, 'draft') = 'draft' and new.status = 'published' then
      perform private.track(new.created_by, 'event_published', jsonb_build_object('type', new.type), null, null);
    end if;
  elsif tg_table_name = 'event_registrations' then
    if tg_op = 'INSERT' and new.ticket_type_id is not null then
      perform private.track(new.user_id, 'event_registered', jsonb_build_object('status', new.status), null, null);
    end if;
  elsif tg_table_name = 'event_checkins' and new.user_id is not null then
    perform private.track(new.user_id, 'event_checked_in', jsonb_build_object('method', new.method), null, null);
  end if;
  return null;
end;
$$;
revoke all on function private.event_analytics() from public;
create trigger events_analytics after update of status on public.events for each row execute function private.event_analytics();
create trigger event_registrations_analytics after insert on public.event_registrations for each row execute function private.event_analytics();
create trigger event_checkins_analytics after insert on public.event_checkins for each row execute function private.event_analytics();

-- University events and society events don't mix: the phase 9 functions only see university events.
create or replace function private.can_attend_event(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
      join public.profiles v on v.user_id = (select auth.uid())
     where e.id = p_event and e.society_id is null and e.cancelled_at is null and v.role in ('student', 'faculty') and v.status <> 'deleting'
       and private.uni_module(e.university_id, 'events')
       and (e.scope = 'global' or v.university_id = e.university_id));
$$;
create or replace function private.can_see_event(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
      join public.profiles v on v.user_id = (select auth.uid())
     where e.id = p_event and e.society_id is null and private.uni_module(e.university_id, 'events')
       and (e.scope = 'global' or v.university_id = e.university_id));
$$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- Officers of the host society (or an accepted co-host).
-- University events (PRD 5.23) and society events share the table: the university portal's list, edit,
-- cancel and reminder job only ever touch university events.
create or replace function private.save_event(p_id uuid, p jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.university_admins := private.require_uni(array['owner', 'admin', 'comms']::public.uni_admin_role[]);
  v_starts timestamptz;
  v_ends timestamptz;
  v_cap integer;
  v_id uuid;
begin
  if not private.uni_module(a.university_id, 'events') then
    raise exception 'turn on the Events module first (Settings, Ecosphere)' using errcode = '55000';
  end if;
  begin
    v_starts := (p ->> 'starts_at')::timestamptz;
    v_ends := (p ->> 'ends_at')::timestamptz;
    v_cap := nullif(p ->> 'capacity', '')::integer;
  exception when others then
    raise exception 'check the dates and capacity' using errcode = '22023';
  end;
  if v_starts is null or v_ends is null or v_ends <= v_starts or v_ends > v_starts + interval '14 days' then
    raise exception 'an event ends after it starts and lasts up to 14 days' using errcode = '22023';
  end if;
  if p_id is null and (v_starts < now() - interval '1 hour' or v_starts > now() + interval '1 year') then
    raise exception 'events start within the next year' using errcode = '22023';
  end if;
  if coalesce(p ->> 'type', '') not in ('talk', 'workshop', 'hackathon', 'competition', 'other')
     or coalesce(p ->> 'scope', 'university') not in ('university', 'global') then
    raise exception 'pick the event type and who can come' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p ->> 'title', ''))) not between 3 and 120 then
    raise exception 'event titles are 3 to 120 characters' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p ->> 'location', '')), '') is null and nullif(btrim(coalesce(p ->> 'link', '')), '') is null then
    raise exception 'give a place or an https:// link' using errcode = '22023';
  end if;
  if v_cap is not null and v_cap not between 1 and 20000 then
    raise exception 'capacity is 1 to 20,000 (or leave it empty)' using errcode = '22023';
  end if;
  if p_id is null then
    if not private.rate_limit('uni_event:' || a.university_id::text, 30, interval '1 day') then
      raise exception 'rate limited' using errcode = '54000';
    end if;
    insert into public.events (university_id, created_by, type, scope, title, description, starts_at, ends_at, location, link, capacity)
    values (a.university_id, a.user_id, (p ->> 'type')::public.uni_event_type, coalesce(p ->> 'scope', 'university')::public.uni_event_scope,
            btrim(p ->> 'title'), nullif(btrim(coalesce(p ->> 'description', '')), ''), v_starts, v_ends,
            nullif(btrim(coalesce(p ->> 'location', '')), ''), nullif(btrim(coalesce(p ->> 'link', '')), ''), v_cap)
    returning id into v_id;
    insert into private.event_secrets (event_id) values (v_id);
  else
    if v_cap is not null and v_cap < private.event_going(p_id) then
      raise exception 'more people are already going than that capacity' using errcode = '23514';
    end if;
    update public.events
       set type = (p ->> 'type')::public.uni_event_type, scope = coalesce(p ->> 'scope', 'university')::public.uni_event_scope,
           title = btrim(p ->> 'title'), description = nullif(btrim(coalesce(p ->> 'description', '')), ''),
           starts_at = v_starts, ends_at = v_ends, location = nullif(btrim(coalesce(p ->> 'location', '')), ''),
           link = nullif(btrim(coalesce(p ->> 'link', '')), ''), capacity = v_cap
     where id = p_id and university_id = a.university_id and cancelled_at is null and society_id is null
    returning id into v_id;
    if v_id is null then
      raise exception 'event not found' using errcode = 'P0002';
    end if;
  end if;
  perform private.uni_audit(a.university_id, 'event.save', 'event', v_id::text, jsonb_build_object('title', btrim(p ->> 'title')));
  return v_id;
end;
$$;

create or replace function private.cancel_event(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.university_admins := private.require_uni(array['owner', 'admin', 'comms']::public.uni_admin_role[]);
  e public.events;
begin
  update public.events set cancelled_at = now()
   where id = p_id and university_id = a.university_id and cancelled_at is null and society_id is null returning * into e;
  if e.id is null then
    raise exception 'event not found' using errcode = 'P0002';
  end if;
  insert into public.notifications (user_id, actor_id, type, entity_type, entity_id, data)
  select r.user_id, null, 'uni_event_cancelled', 'event', e.id, jsonb_build_object('title', e.title, 'starts_at', e.starts_at)
    from public.event_registrations r where r.event_id = e.id and r.cancelled_at is null;
  perform private.uni_audit(a.university_id, 'event.cancel', 'event', p_id::text);
end;
$$;

create or replace function private.uni_events()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.university_admins := private.require_uni(array['owner', 'admin', 'comms', 'career', 'coordinator']::public.uni_admin_role[]);
begin
  return jsonb_build_object(
    'module_on', private.uni_module(a.university_id, 'events'),
    'can_edit', a.role in ('owner', 'admin', 'comms'),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'type', e.type, 'scope', e.scope, 'title', e.title, 'description', e.description,
               'starts_at', e.starts_at, 'ends_at', e.ends_at, 'location', e.location, 'link', e.link, 'capacity', e.capacity,
               'cancelled', e.cancelled_at is not null, 'going', private.event_going(e.id),
               'checked_in', (select count(*) from public.event_registrations r where r.event_id = e.id and r.checked_in_at is not null))
             order by e.starts_at desc)
        from (select * from public.events where university_id = a.university_id and society_id is null order by starts_at desc limit 200) e), '[]'::jsonb));
end;
$$;

create or replace function private.events_list(p_when text default 'upcoming')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_uni uuid := private.current_university_id();
begin
  if v_me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_when not in ('upcoming', 'past', 'mine') then
    raise exception 'unknown list' using errcode = '22023';
  end if;
  return coalesce((
    select jsonb_agg(private.event_card(x.id) order by case when p_when = 'past' then -extract(epoch from x.starts_at) else extract(epoch from x.starts_at) end)
      from (select e.id, e.starts_at from public.events e
             where e.society_id is null and (e.scope = 'global' or e.university_id = v_uni)
               and private.uni_module(e.university_id, 'events')
               and case p_when
                     when 'upcoming' then e.ends_at >= now() and e.cancelled_at is null
                     when 'past' then e.ends_at < now()
                     else exists (select 1 from public.event_registrations r where r.event_id = e.id and r.user_id = v_me and r.cancelled_at is null)
                   end
             order by case when p_when = 'past' then e.starts_at end desc, e.starts_at
             limit 100) x), '[]'::jsonb);
end;
$$;

create or replace function private.uni_events_hourly()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run uuid;
  v_n integer := 0;
begin
  v_run := public.job_run_start('uni-events-hourly');
  begin
    with due as (
      update public.event_registrations r set reminded_at = now()
        from public.events e
       where e.id = r.event_id and e.society_id is null and r.cancelled_at is null and r.reminded_at is null and e.cancelled_at is null
         and e.starts_at between now() and now() + interval '24 hours'
      returning r.user_id, e.id, e.title, e.starts_at)
    insert into public.notifications (user_id, actor_id, type, entity_type, entity_id, data)
    select d.user_id, null, 'uni_event_reminder', 'event', d.id, jsonb_build_object('title', d.title, 'starts_at', d.starts_at)
      from due d;
    get diagnostics v_n = row_count;
  exception when others then
    perform public.job_run_finish(v_run, 'failed', null, sqlerrm);
    return;
  end;
  perform public.job_run_finish(v_run, 'succeeded', v_n);
end;
$$;

create function private.is_event_officer(p_event uuid, p_user uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.events e where e.id = p_event and e.society_id is not null
                   and (private.is_society_officer(e.society_id, p_user)
                        or exists (select 1 from public.event_cohosts c where c.event_id = e.id and c.status = 'accepted'
                                     and private.is_society_officer(c.society_id, p_user))));
$$;
revoke all on function private.is_event_officer(uuid, uuid) from public;
grant execute on function private.is_event_officer(uuid, uuid) to authenticated;

create function private.is_event_staff(p_event uuid, p_user uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_event_officer(p_event, p_user)
      or exists (select 1 from public.event_staff s where s.event_id = p_event and s.user_id = coalesce(p_user, (select auth.uid())));
$$;
revoke all on function private.is_event_staff(uuid, uuid) from public;
grant execute on function private.is_event_staff(uuid, uuid) to authenticated;

create function private.require_event_officer(p_event uuid)
returns public.events
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.events;
begin
  select * into e from public.events where id = p_event and society_id is not null;
  if not found or not private.is_event_officer(p_event) then
    raise exception 'event not found' using errcode = 'P0002';
  end if;
  return e;
end;
$$;
revoke all on function private.require_event_officer(uuid) from public;

create function private.require_event_staff(p_event uuid)
returns public.events
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.events;
begin
  select * into e from public.events where id = p_event and society_id is not null;
  if not found or not private.is_event_staff(p_event) then
    raise exception 'event not found' using errcode = 'P0002';
  end if;
  return e;
end;
$$;
revoke all on function private.require_event_staff(uuid) from public;

-- Why someone can't register, or null when they can (the flat button's reason).
create function private.event_block_reason(p_event uuid, p_user uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.events;
  v public.profiles;
  v_batches integer[];
  v_departments text[];
begin
  select * into e from public.events where id = p_event;
  select * into v from public.profiles where user_id = p_user;
  if e.status = 'cancelled' then return 'This event was cancelled.'; end if;
  if e.status = 'ended' or e.ends_at < now() then return 'This event has ended.'; end if;
  if e.status = 'draft' then return 'This event isn''t published yet.'; end if;
  if v.role <> 'student' or v.status <> 'active' then return 'Only students register for society events.'; end if;
  if e.registration_opens_at is not null and now() < e.registration_opens_at then
    return 'Registration opens ' || to_char(e.registration_opens_at at time zone 'Asia/Karachi', 'DD Mon · HH24:MI') || '.';
  end if;
  if e.registration_closes_at is not null and now() > e.registration_closes_at then return 'Registration has closed.'; end if;
  if e.eligibility ->> 'scope' in ('university', 'groups') and v.university_id is distinct from e.university_id then
    return 'For students at ' || (select name from public.universities where id = e.university_id) || ' only.';
  end if;
  if e.eligibility ->> 'scope' = 'groups' then
    v_batches := coalesce(array(select jsonb_array_elements_text(coalesce(e.eligibility -> 'batches', '[]'::jsonb))::integer), '{}');
    v_departments := coalesce(array(select jsonb_array_elements_text(coalesce(e.eligibility -> 'departments', '[]'::jsonb))), '{}');
    if (cardinality(v_batches) > 0 and not (coalesce(v.graduation_year, 0) = any (v_batches)))
       or (cardinality(v_departments) > 0 and not (coalesce(v.department, '') = any (v_departments))) then
      return 'For ' || concat_ws(' ', nullif(array_to_string(v_departments, ', '), ''),
                                  case when cardinality(v_batches) > 0 then array_to_string(v_batches, ', ') end) || ' only.';
    end if;
  end if;
  return null;
end;
$$;
revoke all on function private.event_block_reason(uuid, uuid) from public;

-- Seats a ticket type has given out (confirmed and held); call under the ticket type's row lock.
create function private.ticket_seats_taken(p_ticket uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.event_registrations r where r.ticket_type_id = p_ticket and r.status in ('confirmed', 'held');
$$;
revoke all on function private.ticket_seats_taken(uuid) from public;

-- The signed ticket: SKT1.<registration>.<24 hex of HMAC(event:registration:user)>.
create function private.ticket_payload(p_registration uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select 'SKT1.' || r.id::text || '.' ||
         substr(encode(extensions.hmac(convert_to('ticket:' || r.event_id::text || ':' || r.id::text || ':' || r.user_id::text, 'UTF8'), s.secret, 'sha256'), 'hex'), 1, 24)
    from public.event_registrations r join private.event_secrets s on s.event_id = r.event_id
   where r.id = p_registration;
$$;
revoke all on function private.ticket_payload(uuid) from public;

-- Called with the ticket type locked: hands free seats to the waitlist in order. A paid ticket gets
-- the 24-hour hold (the paid-ticket migration completes that path).
create function private.promote_waitlist(p_ticket uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  t public.event_ticket_types;
  e public.events;
  r public.event_registrations;
  v_free integer;
  v_n integer := 0;
begin
  select * into t from public.event_ticket_types where id = p_ticket for update;
  select * into e from public.events where id = t.event_id;
  if e.status not in ('published', 'live') then
    return 0;
  end if;
  v_free := t.capacity - private.ticket_seats_taken(p_ticket);
  while v_free > 0 loop
    select * into r from public.event_registrations x
     where x.ticket_type_id = p_ticket and x.status = 'waitlisted' order by x.waitlist_position, x.registered_at limit 1 for update;
    exit when not found;
    if t.price_pkr is null then
      update public.event_registrations set status = 'confirmed', waitlist_position = null, decided_at = now() where event_id = r.event_id and user_id = r.user_id;
    else
      update public.event_registrations
         set status = 'held', waitlist_position = null, decided_at = now(),
             hold_expires_at = now() + make_interval(hours => private.event_limit('hold_hours'))
       where event_id = r.event_id and user_id = r.user_id;
      perform private.open_payment(r.id);
    end if;
    perform private.notify(r.user_id, null, 'event_promoted', 'event', e.id,
                           jsonb_build_object('event', e.title, 'paid', t.price_pkr is not null));
    v_free := v_free - 1;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function private.promote_waitlist(uuid) from public;

-- Placeholder until the paid-ticket migration: opens the payment record for a held seat.
create function private.open_payment(p_registration uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return;
end;
$$;
revoke all on function private.open_payment(uuid) from public;

create function private.event_card_v2(p_event uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'id', e.id, 'title', e.title, 'type', e.type, 'status', e.status, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
           'location', e.location, 'link', e.link, 'cover_path', e.cover_path,
           'society', (select jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug, 'logo_path', s.logo_path)
                         from public.societies s where s.id = e.society_id),
           'university', u.name, 'own_university', e.university_id = private.current_university_id(),
           'seats_left', (select coalesce(sum(greatest(t.capacity - private.ticket_seats_taken(t.id), 0)), 0)
                            from public.event_ticket_types t where t.event_id = e.id),
           'paid', exists (select 1 from public.event_ticket_types t where t.event_id = e.id and t.price_pkr is not null),
           'friends_going', (select count(*) from public.event_registrations r
                              where r.event_id = e.id and r.status = 'confirmed' and private.is_friend_of(r.user_id)),
           'my_status', (select r.status from public.event_registrations r where r.event_id = e.id and r.user_id = (select auth.uid())))
    from public.events e join public.universities u on u.id = e.university_id
   where e.id = p_event;
$$;
revoke all on function private.event_card_v2(uuid) from public;

-- ---------------------------------------------------------------------------
-- Create, edit, publish, cancel (officers only: students can't create events)
-- ---------------------------------------------------------------------------
-- p: {id?, type, title, description, cover_path?, location?, link?,
--     sessions: [{title?, starts_at, ends_at}], ticket_types: [{name, capacity, price_pkr?}],
--     eligibility: {scope, departments?, batches?}, team: {min, max}?, approval_mode,
--     registration_opens_at?, registration_closes_at?, questions: [{label, kind, options?, required}],
--     record_kinds: [...], completed_min?, volunteer_hours, refund_policy, refund_days?, cohosts: [slug]}
create function private.save_society_event(p_society uuid, p jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.societies;
  e public.events;
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_sessions jsonb := coalesce(p->'sessions', '[]'::jsonb);
  v_tickets jsonb := coalesce(p->'ticket_types', '[]'::jsonb);
  v_questions jsonb := coalesce(p->'questions', '[]'::jsonb);
  v_start timestamptz;
  v_end timestamptz;
  v_scope text := coalesce(p->'eligibility'->>'scope', 'university');
  x jsonb;
  i integer := 0;
  v_registered boolean := false;
  v_changed boolean := false;
  v_slug text;
  v_cohost uuid;
begin
  s := private.require_society_officer(p_society);
  if s.status <> 'verified' then
    raise exception 'events open once the society is verified' using errcode = '55000';
  end if;
  if jsonb_typeof(v_sessions) <> 'array' or jsonb_array_length(v_sessions) not between 1 and private.event_limit('max_sessions') then
    raise exception 'an event has 1 to % sessions', private.event_limit('max_sessions') using errcode = '22023';
  end if;
  if jsonb_typeof(v_tickets) <> 'array' or jsonb_array_length(v_tickets) not between 1 and private.event_limit('max_ticket_types') then
    raise exception 'an event has 1 to % ticket types', private.event_limit('max_ticket_types') using errcode = '22023';
  end if;
  if jsonb_typeof(v_questions) <> 'array' or jsonb_array_length(v_questions) > private.event_limit('max_questions') then
    raise exception 'up to % questions', private.event_limit('max_questions') using errcode = '22023';
  end if;
  begin
    select min((y->>'starts_at')::timestamptz), max((y->>'ends_at')::timestamptz) into v_start, v_end from jsonb_array_elements(v_sessions) y;
  exception when others then
    raise exception 'give every session a start and an end' using errcode = '22023';
  end;
  if v_start is null or v_end is null or v_end <= v_start then
    raise exception 'give every session a start and an end' using errcode = '22023';
  end if;
  for x in select value from jsonb_array_elements(v_tickets) loop
    if (x->>'price_pkr') is not null and (x->>'price_pkr')::integer not between private.event_limit('min_pkr') and private.event_limit('max_pkr') then
      raise exception 'ticket prices are PKR % to %', private.event_limit('min_pkr'), private.event_limit('max_pkr') using errcode = '22023';
    end if;
  end loop;
  if v_scope not in ('university', 'all', 'groups') then
    raise exception 'unknown eligibility' using errcode = '22023';
  end if;
  -- A cover is an image the officers uploaded to the society's own folder.
  if nullif(p->>'cover_path', '') is not null
     and (split_part(p->>'cover_path', '/', 1) <> p_society::text
          or not exists (select 1 from storage.objects o where o.bucket_id = 'society-media' and o.name = p->>'cover_path')) then
    raise exception 'upload the cover again' using errcode = '22023';
  end if;

  if v_id is not null then
    select * into e from public.events where id = v_id and society_id = p_society for update;
    if not found then
      raise exception 'event not found' using errcode = 'P0002';
    end if;
    if e.status in ('ended', 'cancelled') then
      raise exception 'this event can''t change any more' using errcode = '55000';
    end if;
    v_registered := exists (select 1 from public.event_registrations r where r.event_id = v_id and r.status <> 'cancelled');
  end if;

  if v_id is null then
    insert into public.events (university_id, society_id, created_by, type, scope, title, description, starts_at, ends_at, location, link,
                               status, record_kinds, completed_min, volunteer_hours, team_min, team_max, approval_mode,
                               registration_opens_at, registration_closes_at, eligibility, cover_path, refund_policy, refund_days)
    values (s.university_id, p_society, (select auth.uid()), (p->>'type')::public.uni_event_type,
            case when v_scope = 'all' then 'global' else 'university' end::public.uni_event_scope,
            btrim(coalesce(p->>'title', '')), nullif(btrim(coalesce(p->>'description', '')), ''), v_start, v_end,
            nullif(btrim(coalesce(p->>'location', '')), ''), nullif(btrim(coalesce(p->>'link', '')), ''),
            'draft', coalesce(array(select jsonb_array_elements_text(coalesce(p->'record_kinds', '["attended"]'::jsonb))), '{attended}'),
            nullif(p->>'completed_min', '')::smallint, coalesce((p->>'volunteer_hours')::boolean, false),
            nullif(p->'team'->>'min', '')::smallint, nullif(p->'team'->>'max', '')::smallint,
            coalesce(p->>'approval_mode', 'automatic'),
            nullif(p->>'registration_opens_at', '')::timestamptz, nullif(p->>'registration_closes_at', '')::timestamptz,
            jsonb_build_object('scope', v_scope, 'departments', coalesce(p->'eligibility'->'departments', '[]'::jsonb),
                               'batches', coalesce(p->'eligibility'->'batches', '[]'::jsonb)),
            nullif(p->>'cover_path', ''), coalesce(p->>'refund_policy', 'none'), nullif(p->>'refund_days', '')::smallint)
    returning id into v_id;
    insert into private.event_secrets (event_id) values (v_id);
  else
    -- After the first registration eligibility can't narrow; capacity never drops below given-out seats.
    if v_registered and (e.eligibility ->> 'scope' = 'all' and v_scope <> 'all'
                         or e.eligibility ->> 'scope' = 'university' and v_scope = 'groups') then
      raise exception 'eligibility can''t narrow after the first registration' using errcode = '55000';
    end if;
    v_changed := e.status in ('published', 'live')
                 and (e.starts_at <> v_start or e.ends_at <> v_end
                      or e.location is distinct from nullif(btrim(coalesce(p->>'location', '')), '')
                      or e.link is distinct from nullif(btrim(coalesce(p->>'link', '')), ''));
    update public.events
       set type = (p->>'type')::public.uni_event_type,
           scope = case when v_scope = 'all' then 'global' else 'university' end::public.uni_event_scope,
           title = btrim(coalesce(p->>'title', '')), description = nullif(btrim(coalesce(p->>'description', '')), ''),
           starts_at = v_start, ends_at = v_end,
           location = nullif(btrim(coalesce(p->>'location', '')), ''), link = nullif(btrim(coalesce(p->>'link', '')), ''),
           record_kinds = coalesce(array(select jsonb_array_elements_text(coalesce(p->'record_kinds', '["attended"]'::jsonb))), '{attended}'),
           completed_min = nullif(p->>'completed_min', '')::smallint, volunteer_hours = coalesce((p->>'volunteer_hours')::boolean, false),
           team_min = case when v_registered then team_min else nullif(p->'team'->>'min', '')::smallint end,
           team_max = case when v_registered then team_max else nullif(p->'team'->>'max', '')::smallint end,
           approval_mode = coalesce(p->>'approval_mode', 'automatic'),
           registration_opens_at = nullif(p->>'registration_opens_at', '')::timestamptz,
           registration_closes_at = nullif(p->>'registration_closes_at', '')::timestamptz,
           eligibility = jsonb_build_object('scope', v_scope, 'departments', coalesce(p->'eligibility'->'departments', '[]'::jsonb),
                                            'batches', coalesce(p->'eligibility'->'batches', '[]'::jsonb)),
           cover_path = coalesce(nullif(p->>'cover_path', ''), cover_path),
           refund_policy = coalesce(p->>'refund_policy', 'none'), refund_days = nullif(p->>'refund_days', '')::smallint
     where id = v_id;
    delete from public.event_questions where event_id = v_id;
  end if;

  -- Sessions are replaced only while nobody has checked in.
  if not exists (select 1 from public.event_checkins c where c.event_id = v_id) then
    delete from public.event_sessions where event_id = v_id;
    i := 0;
    for x in select value from jsonb_array_elements(v_sessions) order by (value->>'starts_at')::timestamptz loop
      i := i + 1;
      insert into public.event_sessions (event_id, position, title, starts_at, ends_at)
      values (v_id, i, nullif(btrim(coalesce(x->>'title', '')), ''), (x->>'starts_at')::timestamptz, (x->>'ends_at')::timestamptz);
    end loop;
  end if;

  -- Ticket types by position: existing ones keep their id (registrations point at them).
  i := 0;
  for x in select value from jsonb_array_elements(v_tickets) loop
    i := i + 1;
    if exists (select 1 from public.event_ticket_types t where t.event_id = v_id and t.position = i) then
      if (x->>'capacity')::integer < private.ticket_seats_taken((select t.id from public.event_ticket_types t where t.event_id = v_id and t.position = i)) then
        raise exception 'capacity can''t go below the seats already given out' using errcode = '23514';
      end if;
      update public.event_ticket_types
         set name = btrim(x->>'name'), capacity = (x->>'capacity')::integer,
             price_pkr = case when v_registered then price_pkr else nullif(x->>'price_pkr', '')::integer end
       where event_id = v_id and position = i;
    else
      insert into public.event_ticket_types (event_id, position, name, capacity, price_pkr)
      values (v_id, i, btrim(coalesce(x->>'name', '')), (x->>'capacity')::integer, nullif(x->>'price_pkr', '')::integer);
    end if;
  end loop;
  delete from public.event_ticket_types t where t.event_id = v_id and t.position > i
     and not exists (select 1 from public.event_registrations r where r.ticket_type_id = t.id);

  i := 0;
  for x in select value from jsonb_array_elements(v_questions) loop
    i := i + 1;
    insert into public.event_questions (event_id, position, label, kind, options, required)
    values (v_id, i, btrim(coalesce(x->>'label', '')), coalesce(x->>'kind', 'short'),
            coalesce(array(select btrim(o) from jsonb_array_elements_text(coalesce(x->'options', '[]'::jsonb)) o where btrim(o) <> ''), '{}'),
            coalesce((x->>'required')::boolean, false));
  end loop;

  -- Co-hosts: verified societies, invited by slug; they accept.
  for v_slug in select jsonb_array_elements_text(coalesce(p->'cohosts', '[]'::jsonb)) loop
    select so.id into v_cohost from public.societies so where so.slug = v_slug and so.status = 'verified' and so.id <> p_society;
    if v_cohost is not null and not exists (select 1 from public.event_cohosts c where c.event_id = v_id and c.society_id = v_cohost) then
      insert into public.event_cohosts (event_id, society_id) values (v_id, v_cohost);
      perform private.notify_society_officers(v_cohost, (select auth.uid()), 'event_cohost', 'event', v_id,
                                              jsonb_build_object('event', btrim(coalesce(p->>'title', '')), 'society', s.name));
    end if;
    v_cohost := null;
  end loop;

  if v_changed then
    perform private.notify(r.user_id, (select auth.uid()), 'event_changed', 'event', v_id,
                           jsonb_build_object('event', btrim(coalesce(p->>'title', '')), 'starts_at', v_start))
       from public.event_registrations r where r.event_id = v_id and r.status in ('confirmed', 'held', 'pending', 'waitlisted');
  end if;
  return v_id;
end;
$$;

create function private.publish_event(p_event uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e public.events;
  s public.societies;
  v_post uuid;
begin
  e := private.require_event_officer(p_event);
  select * into s from public.societies where id = e.society_id;
  if not private.is_society_officer(s.id) then
    raise exception 'the host society publishes its events' using errcode = '42501';
  end if;
  if e.status <> 'draft' then
    raise exception 'this event is already published' using errcode = '55000';
  end if;
  if e.starts_at <= now() then
    raise exception 'move the first session into the future first' using errcode = '55000';
  end if;
  if exists (select 1 from public.event_ticket_types t where t.event_id = p_event and t.price_pkr is not null) then
    if s.paid_paused then
      raise exception 'Skilient has paused paid tickets for this society' using errcode = '55000';
    end if;
    if not private.society_has_payment_details(s.id) then
      raise exception 'add and confirm the society''s payment details before publishing a paid ticket' using errcode = '55000';
    end if;
  end if;
  insert into public.posts (author_id, university_id, audience, type, body, society_id)
  values ((select auth.uid()), e.university_id, 'university', 'event', left(e.title || coalesce(E'\n\n' || e.description, ''), 2000), s.id)
  returning id into v_post;
  insert into public.post_events (post_id, starts_at, place, url) values (v_post, e.starts_at, e.location, e.link);
  update public.events set status = 'published', published_at = now(), post_id = v_post where id = p_event;
  perform private.notify(x.user_id, (select auth.uid()), 'event_published', 'event', p_event,
                         jsonb_build_object('event', e.title, 'society', s.name, 'starts_at', e.starts_at))
     from (select f.user_id from public.society_follows f where f.society_id = s.id
           union select m.user_id from public.society_members m where m.society_id = s.id) x
    where x.user_id <> (select auth.uid());
end;
$$;

-- Until the paid-ticket migration: no payment details anywhere.
create function private.society_has_payment_details(p_society uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select false $$;
revoke all on function private.society_has_payment_details(uuid) from public;

create function private.cancel_society_event(p_event uuid, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e public.events;
begin
  e := private.require_event_officer(p_event);
  if e.status in ('ended', 'cancelled') then
    raise exception 'this event is already %', e.status using errcode = '55000';
  end if;
  update public.events set status = 'cancelled', cancelled_at = now(), cancel_reason = nullif(btrim(coalesce(p_reason, '')), '') where id = p_event;
  perform private.notify(r.user_id, (select auth.uid()), 'event_cancelled', 'event', p_event,
                         jsonb_build_object('event', e.title, 'reason', nullif(btrim(coalesce(p_reason, '')), ''),
                                            'paid', exists (select 1 from public.event_ticket_types t where t.id = r.ticket_type_id and t.price_pkr is not null)))
     from public.event_registrations r where r.event_id = p_event and r.status in ('confirmed', 'held', 'pending', 'waitlisted');
  perform private.event_cancelled_refunds(p_event);
end;
$$;

-- Placeholder until the paid-ticket migration: paid registrants are owed refunds.
create function private.event_cancelled_refunds(p_event uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return;
end;
$$;
revoke all on function private.event_cancelled_refunds(uuid) from public;

-- The full payload for the edit form, or to duplicate a past event (dates cleared).
create function private.event_edit_payload(p_event uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.events;
begin
  e := private.require_event_officer(p_event);
  return jsonb_build_object(
    'id', e.id, 'society_id', e.society_id, 'status', e.status, 'type', e.type, 'title', e.title, 'description', e.description,
    'cover_path', e.cover_path, 'location', e.location, 'link', e.link,
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('title', x.title, 'starts_at', x.starts_at, 'ends_at', x.ends_at) order by x.position)
                            from public.event_sessions x where x.event_id = e.id), '[]'::jsonb),
    'ticket_types', coalesce((select jsonb_agg(jsonb_build_object('name', t.name, 'capacity', t.capacity, 'price_pkr', t.price_pkr) order by t.position)
                                from public.event_ticket_types t where t.event_id = e.id), '[]'::jsonb),
    'eligibility', e.eligibility, 'team', case when e.team_min is not null then jsonb_build_object('min', e.team_min, 'max', e.team_max) end,
    'approval_mode', e.approval_mode, 'registration_opens_at', e.registration_opens_at, 'registration_closes_at', e.registration_closes_at,
    'questions', coalesce((select jsonb_agg(jsonb_build_object('label', q.label, 'kind', q.kind, 'options', q.options, 'required', q.required) order by q.position)
                             from public.event_questions q where q.event_id = e.id), '[]'::jsonb),
    'record_kinds', e.record_kinds, 'completed_min', e.completed_min, 'volunteer_hours', e.volunteer_hours,
    'refund_policy', e.refund_policy, 'refund_days', e.refund_days,
    'cohosts', coalesce((select jsonb_agg(s.slug) from public.event_cohosts c join public.societies s on s.id = c.society_id where c.event_id = e.id), '[]'::jsonb));
end;
$$;

create function private.answer_cohost(p_event uuid, p_society uuid, p_accept boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.is_society_officer(p_society) then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;
  update public.event_cohosts set status = case when p_accept then 'accepted' else 'declined' end
   where event_id = p_event and society_id = p_society and status = 'pending';
  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Discover and the event page
-- ---------------------------------------------------------------------------
-- p_when: upcoming | past | mine. Own university first; society events, plus university events
-- while the university portal is on.
create function private.society_events(p_when text default 'upcoming', p_type text default null)
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
  if p_when not in ('upcoming', 'past', 'mine') then
    raise exception 'unknown list' using errcode = '22023';
  end if;
  return coalesce((
    select jsonb_agg(private.event_card_v2(x.id) order by x.own desc, case when p_when = 'past' then -extract(epoch from x.starts_at) else extract(epoch from x.starts_at) end)
      from (select e.id, e.starts_at, e.university_id = v_uni as own
              from public.events e
              join public.societies s on s.id = e.society_id and s.status = 'verified'
             where e.status <> 'draft'
               and (e.university_id = v_uni or e.eligibility ->> 'scope' = 'all')
               and (p_type is null or p_type = '' or e.type::text = p_type)
               and case p_when
                     when 'upcoming' then e.ends_at >= now() and e.status <> 'cancelled'
                     when 'past' then e.ends_at < now()
                     else exists (select 1 from public.event_registrations r where r.event_id = e.id and r.user_id = v_me and r.status <> 'cancelled')
                   end
             order by (e.university_id = v_uni) desc, e.starts_at
             limit 200) x), '[]'::jsonb);
end;
$$;

create function private.event_page(p_event uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  e public.events;
  r public.event_registrations;
  v_officer boolean;
begin
  select * into e from public.events where id = p_event and society_id is not null;
  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;
  v_officer := private.is_event_officer(p_event);
  if (e.status = 'draft' and not v_officer)
     or not (e.university_id = private.current_university_id() or e.eligibility ->> 'scope' = 'all' or private.is_event_staff(p_event)
             or exists (select 1 from public.event_registrations x where x.event_id = p_event and x.user_id = v_me)) then
    raise exception 'event not found' using errcode = 'P0002';
  end if;
  select * into r from public.event_registrations x where x.event_id = p_event and x.user_id = v_me;
  return private.event_card_v2(p_event) || jsonb_build_object(
    'description', e.description, 'eligibility', e.eligibility, 'approval_mode', e.approval_mode,
    'registration_opens_at', e.registration_opens_at, 'registration_closes_at', e.registration_closes_at,
    'record_kinds', e.record_kinds, 'completed_min', e.completed_min, 'volunteer_hours', e.volunteer_hours,
    'team', case when e.team_min is not null then jsonb_build_object('min', e.team_min, 'max', e.team_max) end,
    'refund_policy', e.refund_policy, 'refund_days', e.refund_days, 'cancel_reason', e.cancel_reason, 'cancelled_at', e.cancelled_at,
    'officer', v_officer, 'staff', private.is_event_staff(p_event),
    'block_reason', private.event_block_reason(p_event, v_me),
    'cohosts', coalesce((select jsonb_agg(jsonb_build_object('name', s.name, 'slug', s.slug)) from public.event_cohosts c
                           join public.societies s on s.id = c.society_id where c.event_id = e.id and c.status = 'accepted'), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'starts_at', x.starts_at, 'ends_at', x.ends_at) order by x.position)
                            from public.event_sessions x where x.event_id = e.id), '[]'::jsonb),
    'ticket_types', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'capacity', t.capacity, 'price_pkr', t.price_pkr,
                                                                  'left', greatest(t.capacity - private.ticket_seats_taken(t.id), 0)) order by t.position)
                                from public.event_ticket_types t where t.event_id = e.id), '[]'::jsonb),
    'questions', coalesce((select jsonb_agg(jsonb_build_object('position', q.position, 'label', q.label, 'kind', q.kind, 'options', q.options, 'required', q.required) order by q.position)
                             from public.event_questions q where q.event_id = e.id), '[]'::jsonb),
    'registration', case when r.user_id is not null then jsonb_build_object(
        'id', r.id, 'status', r.status, 'waitlist_position', r.waitlist_position, 'ticket_type_id', r.ticket_type_id,
        'hold_expires_at', r.hold_expires_at,
        'team', (select jsonb_build_object('name', t.name, 'code', t.code,
                                           'members', (select count(*) from public.event_registrations y where y.team_id = t.id and y.status <> 'cancelled'))
                   from public.event_teams t where t.id = r.team_id)) end,
    'feedback_open', r.status = 'confirmed' and e.ends_at < now() and e.ends_at > now() - make_interval(days => private.event_limit('feedback_days'))
                     and not exists (select 1 from public.event_feedback f where f.event_id = e.id and f.user_id = v_me));
end;
$$;

-- ---------------------------------------------------------------------------
-- Register, cancel, approve
-- ---------------------------------------------------------------------------
create function private.new_team_code()
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::integer, 1), '') from generate_series(1, 6);
$$;
revoke all on function private.new_team_code() from public;

-- p: {ticket_type_id, answers: [...], team?: {create: name} | {code}}. Returns {status, waitlist_position, registration_id}.
create function private.register_event(p_event uuid, p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  e public.events;
  t public.event_ticket_types;
  r public.event_registrations;
  v_reason text;
  v_answers jsonb := coalesce(p->'answers', '[]'::jsonb);
  q record;
  v_status text;
  v_position integer;
  v_team uuid;
  v_id uuid;
begin
  select * into e from public.events where id = p_event and society_id is not null;
  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;
  v_reason := private.event_block_reason(p_event, v_me);
  if v_reason is not null then
    raise exception '%', v_reason using errcode = '55000';
  end if;
  -- The seat lock: every registration for this ticket type queues here, so seats can't oversell.
  select * into t from public.event_ticket_types where id = (p->>'ticket_type_id')::uuid and event_id = p_event for update;
  if not found then
    raise exception 'pick a ticket type' using errcode = '22023';
  end if;
  select * into r from public.event_registrations x where x.event_id = p_event and x.user_id = v_me;
  if r.user_id is not null and r.status <> 'cancelled' then
    raise exception 'you''re already registered' using errcode = '23505';
  end if;
  -- The form: required questions answered, choices from the options.
  if jsonb_typeof(v_answers) <> 'array' then
    raise exception 'answer the form' using errcode = '22023';
  end if;
  for q in select * from public.event_questions where event_id = p_event order by position loop
    if q.required and coalesce(btrim(v_answers ->> (q.position - 1)), '') in ('', '[]') then
      raise exception 'answer "%"', q.label using errcode = '22023';
    end if;
    if char_length(coalesce(v_answers ->> (q.position - 1), '')) > 2000 then
      raise exception 'answers are up to 2,000 characters' using errcode = '22023';
    end if;
  end loop;
  -- Teams: create one (you're the captain) or join with its code.
  if e.team_max is not null then
    if nullif(btrim(coalesce(p->'team'->>'code', '')), '') is not null then
      select tm.id into v_team from public.event_teams tm where tm.event_id = p_event and tm.code = upper(btrim(p->'team'->>'code')) for update;
      if v_team is null then
        raise exception 'no team with that code' using errcode = 'P0002';
      end if;
      if (select count(*) from public.event_registrations y where y.team_id = v_team and y.status not in ('cancelled', 'declined')) >= e.team_max then
        raise exception 'that team is full' using errcode = '23514';
      end if;
    elsif nullif(btrim(coalesce(p->'team'->>'create', '')), '') is not null then
      insert into public.event_teams (event_id, name, code, captain_id)
      values (p_event, btrim(p->'team'->>'create'), private.new_team_code(), v_me) returning id into v_team;
    else
      raise exception 'create a team or join one with its code' using errcode = '22023';
    end if;
  end if;

  if e.approval_mode = 'manual' then
    v_status := 'pending';
  elsif private.ticket_seats_taken(t.id) < t.capacity then
    v_status := case when t.price_pkr is null then 'confirmed' else 'held' end;
  else
    v_status := 'waitlisted';
    select coalesce(max(x.waitlist_position), 0) + 1 into v_position from public.event_registrations x where x.ticket_type_id = t.id and x.status = 'waitlisted';
  end if;

  insert into public.event_registrations (event_id, user_id, ticket_type_id, status, waitlist_position, answers, team_id, hold_expires_at, registered_at)
  values (p_event, v_me, t.id, v_status, v_position, v_answers, v_team,
          case when v_status = 'held' then now() + make_interval(hours => private.event_limit('hold_hours')) end, now())
  on conflict (event_id, user_id) do update
    set ticket_type_id = excluded.ticket_type_id, status = excluded.status, waitlist_position = excluded.waitlist_position,
        answers = excluded.answers, team_id = excluded.team_id, hold_expires_at = excluded.hold_expires_at,
        registered_at = now(), cancelled_at = null, checked_in_at = null, reminded_at = null, reminded_1h_at = null, decided_at = null
  returning id into v_id;
  if v_status = 'held' then
    perform private.open_payment(v_id);
  end if;
  perform private.notify(v_me, null, 'event_registration', 'event', p_event,
                         jsonb_build_object('event', e.title, 'status', v_status, 'position', v_position));
  return jsonb_build_object('status', v_status, 'waitlist_position', v_position, 'registration_id', v_id);
end;
$$;

-- Cancelling frees the seat and promotes the waitlist. A paid ticket within the refund policy is
-- marked "Refund requested" (the paid-ticket migration).
create function private.cancel_registration(p_event uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  r public.event_registrations;
  t public.event_ticket_types;
begin
  select * into r from public.event_registrations x where x.event_id = p_event and x.user_id = v_me and x.status <> 'cancelled';
  if not found then
    raise exception 'you aren''t registered' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.event_checkins c where c.event_id = p_event and c.user_id = v_me and c.removed_at is null) then
    raise exception 'you''ve already checked in' using errcode = '55000';
  end if;
  select * into t from public.event_ticket_types where id = r.ticket_type_id for update;
  update public.event_registrations set status = 'cancelled', cancelled_at = now(), waitlist_position = null, hold_expires_at = null
   where event_id = p_event and user_id = v_me;
  perform private.registration_cancelled_payment(r.id);
  if t.id is not null then
    perform private.promote_waitlist(t.id);
  end if;
end;
$$;

create function private.registration_cancelled_payment(p_registration uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return;
end;
$$;
revoke all on function private.registration_cancelled_payment(uuid) from public;

-- Manual approval: approving takes a seat (or the waitlist); a paid ticket starts its 24-hour hold.
create function private.decide_registration(p_event uuid, p_user uuid, p_accept boolean)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e public.events;
  r public.event_registrations;
  t public.event_ticket_types;
  v_status text;
  v_position integer;
begin
  e := private.require_event_officer(p_event);
  select * into r from public.event_registrations x where x.event_id = p_event and x.user_id = p_user and x.status = 'pending';
  if not found then
    raise exception 'nothing to decide' using errcode = 'P0002';
  end if;
  select * into t from public.event_ticket_types where id = r.ticket_type_id for update;
  if not p_accept then
    v_status := 'declined';
  elsif private.ticket_seats_taken(t.id) < t.capacity then
    v_status := case when t.price_pkr is null then 'confirmed' else 'held' end;
  else
    v_status := 'waitlisted';
    select coalesce(max(x.waitlist_position), 0) + 1 into v_position from public.event_registrations x where x.ticket_type_id = t.id and x.status = 'waitlisted';
  end if;
  update public.event_registrations
     set status = v_status, waitlist_position = v_position, decided_at = now(),
         hold_expires_at = case when v_status = 'held' then now() + make_interval(hours => private.event_limit('hold_hours')) end
   where event_id = p_event and user_id = p_user;
  if v_status = 'held' then
    perform private.open_payment(r.id);
  end if;
  perform private.notify(p_user, (select auth.uid()), 'event_decided', 'event', p_event,
                         jsonb_build_object('event', e.title, 'status', v_status, 'position', v_position));
  return v_status;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tickets
-- ---------------------------------------------------------------------------
create function private.my_tickets()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'upcoming', coalesce((select jsonb_agg(private.event_card_v2(e.id) || jsonb_build_object('registration_status', r.status, 'waitlist_position', r.waitlist_position)
                                           order by e.starts_at)
                            from public.event_registrations r join public.events e on e.id = r.event_id
                           where r.user_id = (select auth.uid()) and e.society_id is not null and r.status not in ('cancelled', 'declined')
                             and e.ends_at >= now() and e.status <> 'cancelled'), '[]'::jsonb),
    'past', coalesce((select jsonb_agg(private.event_card_v2(e.id) || jsonb_build_object('registration_status', r.status) order by e.starts_at desc)
                        from public.event_registrations r join public.events e on e.id = r.event_id
                       where r.user_id = (select auth.uid()) and e.society_id is not null
                         and (e.ends_at < now() or e.status = 'cancelled' or r.status in ('cancelled', 'declined'))), '[]'::jsonb));
$$;

create function private.event_ticket(p_event uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  r public.event_registrations;
  e public.events;
begin
  select * into r from public.event_registrations x where x.event_id = p_event and x.user_id = v_me;
  select * into e from public.events where id = p_event and society_id is not null;
  if r.user_id is null or e.id is null then
    raise exception 'ticket not found' using errcode = 'P0002';
  end if;
  return private.event_card_v2(p_event) || jsonb_build_object(
    'registration_id', r.id, 'status', r.status, 'waitlist_position', r.waitlist_position, 'hold_expires_at', r.hold_expires_at,
    'ticket_type', (select jsonb_build_object('name', t.name, 'price_pkr', t.price_pkr) from public.event_ticket_types t where t.id = r.ticket_type_id),
    'payload', case when r.status = 'confirmed' then private.ticket_payload(r.id) end,
    'code', upper(substr(replace(r.id::text, '-', ''), 1, 8)),
    'name', (select full_name from public.profiles where user_id = v_me),
    'refund_policy', e.refund_policy, 'refund_days', e.refund_days,
    'can_cancel', r.status not in ('cancelled', 'declined') and e.status in ('published', 'live')
                  and not exists (select 1 from public.event_checkins c where c.event_id = p_event and c.user_id = v_me and c.removed_at is null),
    'checked_in', coalesce((select jsonb_agg(jsonb_build_object('session_id', c.session_id, 'at', c.checked_in_at)) from public.event_checkins c
                              where c.event_id = p_event and c.user_id = v_me and c.removed_at is null), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'starts_at', x.starts_at, 'ends_at', x.ends_at) order by x.position)
                            from public.event_sessions x where x.event_id = p_event), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- Manage: stat tiles, registrations, staff, messages, feedback
-- ---------------------------------------------------------------------------
create function private.event_manage(p_event uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.events;
  v_min integer := private.event_limit('feedback_min_group');
  v_feedback integer;
begin
  e := private.require_event_officer(p_event);
  select count(*) into v_feedback from public.event_feedback f where f.event_id = p_event;
  return private.event_card_v2(p_event) || jsonb_build_object(
    'approval_mode', e.approval_mode, 'team', case when e.team_min is not null then jsonb_build_object('min', e.team_min, 'max', e.team_max) end,
    'stats', jsonb_build_object(
      'registered', (select count(*) from public.event_registrations r where r.event_id = p_event and r.status = 'confirmed'),
      'pending', (select count(*) from public.event_registrations r where r.event_id = p_event and r.status in ('pending', 'held')),
      'waitlist', (select count(*) from public.event_registrations r where r.event_id = p_event and r.status = 'waitlisted'),
      'capacity', (select coalesce(sum(t.capacity), 0) from public.event_ticket_types t where t.event_id = p_event),
      'checked_in', (select count(distinct c.user_id) from public.event_checkins c where c.event_id = p_event and c.removed_at is null)),
    'questions', coalesce((select jsonb_agg(q.label order by q.position) from public.event_questions q where q.event_id = p_event), '[]'::jsonb),
    'registrations', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', r.user_id, 'name', p.full_name, 'username', p.username, 'department', p.department,
                                          'batch', p.graduation_year, 'status', r.status, 'ticket', t.name, 'answers', r.answers,
                                          'waitlist_position', r.waitlist_position, 'team', tm.name, 'registered_at', r.registered_at)
                       order by r.status, r.waitlist_position nulls last, r.registered_at)
        from public.event_registrations r join public.profiles p on p.user_id = r.user_id
        left join public.event_ticket_types t on t.id = r.ticket_type_id left join public.event_teams tm on tm.id = r.team_id
       where r.event_id = p_event), '[]'::jsonb),
    'staff', coalesce((select jsonb_agg(jsonb_build_object('user_id', s.user_id, 'name', p.full_name, 'username', p.username))
                         from public.event_staff s join public.profiles p on p.user_id = s.user_id where s.event_id = p_event), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('body', m.body, 'created_at', m.created_at) order by m.created_at desc)
                            from public.event_messages m where m.event_id = p_event), '[]'::jsonb),
    'feedback', case when v_feedback >= v_min then jsonb_build_object(
        'count', v_feedback, 'average', (select round(avg(f.rating), 1) from public.event_feedback f where f.event_id = p_event),
        'ratings', (select jsonb_object_agg(g.rating, g.n) from (select f.rating, count(*) as n from public.event_feedback f where f.event_id = p_event group by f.rating having count(*) >= v_min) g))
      else jsonb_build_object('count', v_feedback, 'suppressed', true) end);
end;
$$;

create function private.add_event_staff(p_event uuid, p_username text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e public.events;
  v_user uuid;
begin
  e := private.require_event_officer(p_event);
  select p.user_id into v_user from public.profiles p where lower(p.username) = lower(btrim(coalesce(p_username, ''))) and p.role = 'student';
  if v_user is null then
    raise exception 'no student with that username' using errcode = 'P0002';
  end if;
  if (select count(*) from public.event_staff s where s.event_id = p_event) >= 30 then
    raise exception 'an event has at most 30 staff' using errcode = '23514';
  end if;
  insert into public.event_staff (event_id, user_id, added_by) values (p_event, v_user, (select auth.uid())) on conflict do nothing;
  perform private.notify(v_user, (select auth.uid()), 'event_staff_added', 'event', p_event, jsonb_build_object('event', e.title));
end;
$$;

create function private.remove_event_staff(p_event uuid, p_user uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_event_officer(p_event);
  delete from public.event_staff where event_id = p_event and user_id = p_user;
end;
$$;

create function private.message_registrants(p_event uuid, p_body text)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e public.events;
  v_n integer;
begin
  e := private.require_event_officer(p_event);
  if char_length(btrim(coalesce(p_body, ''))) not between 3 and 1000 then
    raise exception 'messages are 3 to 1,000 characters' using errcode = '22023';
  end if;
  if not private.rate_limit('event_message:' || p_event::text, 5, interval '1 day') then
    raise exception 'up to 5 messages a day per event' using errcode = '54000';
  end if;
  insert into public.event_messages (event_id, sender_id, body) values (p_event, (select auth.uid()), btrim(p_body));
  perform private.notify(r.user_id, (select auth.uid()), 'event_message', 'event', p_event,
                         jsonb_build_object('event', e.title, 'body', left(btrim(p_body), 300)))
     from public.event_registrations r where r.event_id = p_event and r.status in ('confirmed', 'held', 'pending', 'waitlisted');
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create function private.submit_event_feedback(p_event uuid, p_rating integer, p_comment text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  e public.events;
begin
  select * into e from public.events where id = p_event and society_id is not null;
  if not found or not exists (select 1 from public.event_registrations r where r.event_id = p_event and r.user_id = v_me and r.status = 'confirmed') then
    raise exception 'event not found' using errcode = 'P0002';
  end if;
  if e.ends_at > now() or e.ends_at < now() - make_interval(days => private.event_limit('feedback_days')) then
    raise exception 'feedback is open for 7 days after the event' using errcode = '55000';
  end if;
  insert into public.event_feedback (event_id, user_id, rating, comment)
  values (p_event, v_me, p_rating, nullif(btrim(coalesce(p_comment, '')), ''));
end;
$$;

-- ---------------------------------------------------------------------------
-- Check-in (officers and event staff)
-- ---------------------------------------------------------------------------
create function private.event_session_for(p_event uuid, p_session uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.id from public.event_sessions s where s.event_id = p_event and s.id = p_session),
    (select s.id from public.event_sessions s where s.event_id = p_event order by abs(extract(epoch from s.starts_at - now())) limit 1));
$$;
revoke all on function private.event_session_for(uuid, uuid) from public;

-- Check someone in for a session. Returns {result: green | amber, name, at, first_at}.
create function private.record_checkin(p_event uuid, p_session uuid, p_user uuid, p_method text, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.event_checkins;
  v_name text := (select full_name from public.profiles where user_id = p_user);
begin
  select * into c from public.event_checkins x where x.session_id = p_session and x.user_id = p_user;
  if found and c.removed_at is null then
    return jsonb_build_object('result', 'amber', 'name', v_name, 'first_at', c.checked_in_at);
  end if;
  if found then
    update public.event_checkins set removed_at = null, removed_by = null, removed_reason = null, checked_in_at = now(),
           checked_in_by = (select auth.uid()), method = p_method, reason = p_reason where id = c.id;
  else
    insert into public.event_checkins (event_id, session_id, user_id, method, checked_in_by, reason)
    values (p_event, p_session, p_user, p_method, (select auth.uid()), p_reason);
  end if;
  update public.event_registrations set checked_in_at = coalesce(checked_in_at, now()) where event_id = p_event and user_id = p_user;
  return jsonb_build_object('result', 'green', 'name', v_name, 'at', now());
end;
$$;
revoke all on function private.record_checkin(uuid, uuid, uuid, text, text) from public;

create function private.check_in_scan(p_event uuid, p_session uuid, p_payload text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e public.events;
  v_session uuid;
  v_reg uuid;
  r public.event_registrations;
begin
  e := private.require_event_staff(p_event);
  if e.status not in ('published', 'live', 'ended') or now() < e.starts_at - interval '2 hours' then
    raise exception 'check-in opens 2 hours before the first session' using errcode = '55000';
  end if;
  v_session := private.event_session_for(p_event, p_session);
  if coalesce(p_payload, '') !~ '^SKT1\.[0-9a-f-]{36}\.[0-9a-f]{24}$' then
    return jsonb_build_object('result', 'red', 'message', 'That isn''t a Skilient ticket.');
  end if;
  v_reg := split_part(p_payload, '.', 2)::uuid;
  select * into r from public.event_registrations where id = v_reg and event_id = p_event;
  if not found or private.ticket_payload(v_reg) is distinct from p_payload then
    return jsonb_build_object('result', 'red', 'message', 'Not registered for this event.');
  end if;
  if r.status <> 'confirmed' then
    return jsonb_build_object('result', 'red', 'message', 'This ticket isn''t confirmed (' || r.status || ').',
                              'name', (select full_name from public.profiles where user_id = r.user_id));
  end if;
  return private.record_checkin(p_event, v_session, r.user_id, 'scan');
end;
$$;

create function private.check_in_search(p_event uuid, p_query text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := btrim(coalesce(p_query, ''));
begin
  perform private.require_event_staff(p_event);
  if char_length(v_q) < 2 then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('user_id', r.user_id, 'name', p.full_name, 'username', p.username, 'status', r.status,
                                        'checked_in', exists (select 1 from public.event_checkins c where c.event_id = p_event and c.user_id = r.user_id and c.removed_at is null))
                     order by p.full_name)
      from public.event_registrations r join public.profiles p on p.user_id = r.user_id
     where r.event_id = p_event and r.status <> 'cancelled'
       and (p.full_name ilike '%' || replace(replace(v_q, '%', ''), '_', '') || '%' or p.username ilike replace(replace(v_q, '%', ''), '_', '') || '%')
     limit 20), '[]'::jsonb);
end;
$$;

-- From search: a registered person, or a walk-in (eligible, seats left) registered on the spot.
create function private.check_in_person(p_event uuid, p_session uuid, p_user uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e public.events;
  r public.event_registrations;
  t public.event_ticket_types;
  v_session uuid;
begin
  e := private.require_event_staff(p_event);
  v_session := private.event_session_for(p_event, p_session);
  select * into r from public.event_registrations x where x.event_id = p_event and x.user_id = p_user;
  if r.user_id is not null and r.status = 'confirmed' then
    return private.record_checkin(p_event, v_session, p_user, 'search');
  end if;
  -- Walk in: the first free ticket that has a seat.
  if private.event_block_reason(p_event, p_user) is not null and private.event_block_reason(p_event, p_user) not like 'Registration%' then
    return jsonb_build_object('result', 'red', 'message', private.event_block_reason(p_event, p_user));
  end if;
  select * into t from public.event_ticket_types x where x.event_id = p_event and x.price_pkr is null order by x.position limit 1 for update;
  if not found or private.ticket_seats_taken(t.id) >= t.capacity then
    return jsonb_build_object('result', 'red', 'message', 'No free seats left for a walk-in.');
  end if;
  insert into public.event_registrations (event_id, user_id, ticket_type_id, status, added_by)
  values (p_event, p_user, t.id, 'confirmed', (select auth.uid()))
  on conflict (event_id, user_id) do update set status = 'confirmed', ticket_type_id = excluded.ticket_type_id, cancelled_at = null,
        waitlist_position = null, hold_expires_at = null, added_by = excluded.added_by;
  return private.record_checkin(p_event, v_session, p_user, 'walk_in');
end;
$$;

-- Add by university email: a person on Skilient is checked in as a walk-in; anyone else is recorded
-- for phase 16 to send the claim email.
create function private.check_in_email(p_event uuid, p_session uuid, p_email text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e public.events;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_user uuid;
  v_session uuid;
  v_attendee uuid;
begin
  e := private.require_event_staff(p_event);
  v_session := private.event_session_for(p_event, p_session);
  if v_email !~ '^[^\s@]+@[^\s@]+$' or char_length(v_email) > 254 then
    raise exception 'enter a valid email address' using errcode = '22023';
  end if;
  if not exists (select 1 from public.university_domains d where d.domain = private.email_domain(v_email) and d.university_id = e.university_id)
     and e.eligibility ->> 'scope' <> 'all' then
    raise exception 'use a university email address of the host university' using errcode = '22023';
  end if;
  select u.id into v_user from auth.users u where lower(u.email) = v_email;
  if v_user is not null and exists (select 1 from public.profiles p where p.user_id = v_user and p.role = 'student') then
    return private.check_in_person(p_event, v_session, v_user);
  end if;
  insert into public.event_email_attendees (event_id, email, added_by) values (p_event, v_email, (select auth.uid()))
  on conflict (event_id, email) do update set email = excluded.email returning id into v_attendee;
  if exists (select 1 from public.event_checkins c where c.session_id = v_session and c.email_attendee_id = v_attendee and c.removed_at is null) then
    return jsonb_build_object('result', 'amber', 'name', v_email,
                              'first_at', (select c.checked_in_at from public.event_checkins c where c.session_id = v_session and c.email_attendee_id = v_attendee));
  end if;
  insert into public.event_checkins (event_id, session_id, email_attendee_id, method, checked_in_by)
  values (p_event, v_session, v_attendee, 'email', (select auth.uid()))
  on conflict (session_id, email_attendee_id) where email_attendee_id is not null do update set removed_at = null, removed_reason = null, removed_by = null;
  return jsonb_build_object('result', 'green', 'name', v_email, 'at', now(), 'claim', true);
end;
$$;

create function private.event_headcount(p_event uuid, p_session uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session uuid;
begin
  perform private.require_event_staff(p_event);
  v_session := private.event_session_for(p_event, p_session);
  return jsonb_build_object(
    'session_id', v_session,
    'checked_in', (select count(*) from public.event_checkins c where c.session_id = v_session and c.removed_at is null),
    'expected', (select count(*) from public.event_registrations r where r.event_id = p_event and r.status = 'confirmed'),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'starts_at', s.starts_at) order by s.position)
                            from public.event_sessions s where s.event_id = p_event), '[]'::jsonb));
end;
$$;

-- The live headcount over Realtime: a broadcast on the private topic event:{id}, readable by its staff.
create function private.event_topic_staff(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_topic ~ '^event:[0-9a-f-]{36}$' then private.is_event_staff(substr(p_topic, 7)::uuid) else false end;
$$;
revoke all on function private.event_topic_staff(text) from public;
grant execute on function private.event_topic_staff(text) to authenticated;
create policy event_headcount_receive on realtime.messages for select to authenticated
  using (realtime.messages.extension = 'broadcast' and private.event_topic_staff((select realtime.topic())));

create function private.broadcast_headcount()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('session_id', new.session_id,
                       'checked_in', (select count(*) from public.event_checkins c where c.session_id = new.session_id and c.removed_at is null)),
    'headcount', 'event:' || new.event_id::text, true);
  return null;
exception when others then
  -- The headcount is a convenience: a broadcast failure never blocks a check-in.
  return null;
end;
$$;
revoke all on function private.broadcast_headcount() from public;
create trigger event_checkins_headcount after insert or update on public.event_checkins
  for each row execute function private.broadcast_headcount();

-- The rotating self check-in code (PRD 5.23) for society events.
create function private.society_event_code(p_event uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.events;
  v_window bigint := floor(extract(epoch from now()) / 30)::bigint;
begin
  e := private.require_event_staff(p_event);
  if e.status = 'cancelled' or now() < e.starts_at - interval '2 hours' or now() > e.ends_at + interval '2 hours' then
    raise exception 'check-in opens 2 hours before the event and closes 2 hours after it' using errcode = '55000';
  end if;
  return jsonb_build_object('token', private.event_code(p_event, v_window), 'changes_at', to_timestamp((v_window + 1) * 30));
end;
$$;

create function private.self_check_in(p_event uuid, p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  e public.events;
  v_window bigint := floor(extract(epoch from now()) / 30)::bigint;
begin
  if not private.rate_limit('event_checkin:' || v_me::text, 20, interval '10 minutes') then
    raise exception 'rate limited' using errcode = '54000';
  end if;
  select * into e from public.events where id = p_event and society_id is not null;
  if not found or not exists (select 1 from public.event_registrations r where r.event_id = p_event and r.user_id = v_me and r.status = 'confirmed') then
    raise exception 'you aren''t registered for this event' using errcode = 'P0002';
  end if;
  if coalesce(p_token, '') not in (private.event_code(p_event, v_window), private.event_code(p_event, v_window - 1)) then
    raise exception 'that code has changed; scan the screen again' using errcode = '22023';
  end if;
  if now() < e.starts_at - interval '2 hours' or now() > e.ends_at + interval '2 hours' then
    raise exception 'check-in is closed' using errcode = '55000';
  end if;
  return private.record_checkin(p_event, private.event_session_for(p_event, null), v_me, 'self');
end;
$$;

-- ---------------------------------------------------------------------------
-- Close-out (72 hours after the last session ends)
-- ---------------------------------------------------------------------------
create function private.event_closeout_open(e public.events)
returns boolean
language sql
stable
set search_path = ''
as $$
  select e.status <> 'cancelled' and now() >= e.ends_at and now() <= e.ends_at + make_interval(hours => private.event_limit('closeout_hours'));
$$;

-- Who earns what, from attendance, results and hours.
create function private.event_issue_preview(p_event uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with e as (select * from public.events where id = p_event),
  sessions as (select count(*)::integer as n from public.event_sessions where event_id = p_event),
  att as (
    select c.user_id, count(distinct c.session_id)::integer as sessions
      from public.event_checkins c where c.event_id = p_event and c.user_id is not null and c.removed_at is null group by c.user_id),
  emails as (select distinct a.email from public.event_checkins c join public.event_email_attendees a on a.id = c.email_attendee_id
              where c.event_id = p_event and c.removed_at is null)
  select jsonb_build_object(
    'attended', case when (select 'attended' = any (record_kinds) from e) then coalesce((select jsonb_agg(att.user_id) from att), '[]'::jsonb) else '[]'::jsonb end,
    'completed', case when (select 'completed' = any (record_kinds) from e) then coalesce((
        select jsonb_agg(att.user_id) from att where att.sessions >= coalesce((select completed_min from e), (select n from sessions))), '[]'::jsonb) else '[]'::jsonb end,
    'results', coalesce((select jsonb_agg(jsonb_build_object('user_id', r.user_id, 'team_id', r.team_id, 'place', r.place, 'label', r.label) order by r.place)
                           from public.event_results r where r.event_id = p_event), '[]'::jsonb),
    'volunteer', coalesce((select jsonb_agg(jsonb_build_object('user_id', v.user_id, 'hours', v.hours)) from public.volunteer_logs v where v.event_id = p_event), '[]'::jsonb),
    'emails', coalesce((select jsonb_agg(emails.email) from emails), '[]'::jsonb));
$$;
revoke all on function private.event_issue_preview(uuid) from public;

create function private.closeout_page(p_event uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.events;
  v_preview jsonb;
begin
  e := private.require_event_officer(p_event);
  v_preview := private.event_issue_preview(p_event);
  return private.event_card_v2(p_event) || jsonb_build_object(
    'open', private.event_closeout_open(e),
    'closes_at', e.ends_at + make_interval(hours => private.event_limit('closeout_hours')),
    'record_kinds', e.record_kinds, 'volunteer_hours', e.volunteer_hours,
    'activity_hours', (select round(sum(extract(epoch from s.ends_at - s.starts_at)) / 3600.0, 2) from public.event_sessions s where s.event_id = p_event),
    'issued', (select jsonb_build_object('at', i.issued_at, 'auto', i.auto, 'status', i.status) from public.event_issuances i where i.event_id = p_event),
    'counts', jsonb_build_object('attended', jsonb_array_length(v_preview->'attended'), 'completed', jsonb_array_length(v_preview->'completed'),
                                 'results', jsonb_array_length(v_preview->'results'), 'volunteer', jsonb_array_length(v_preview->'volunteer'),
                                 'emails', jsonb_array_length(v_preview->'emails')),
    'attendees', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'name', p.full_name, 'username', p.username,
                                          'sessions', (select count(distinct c.session_id) from public.event_checkins c where c.event_id = p_event and c.user_id = p.user_id and c.removed_at is null),
                                          'team_id', r.team_id,
                                          'place', (select x.place from public.event_results x where x.event_id = p_event and x.user_id = p.user_id),
                                          'hours', (select v.hours from public.volunteer_logs v where v.event_id = p_event and v.user_id = p.user_id))
                       order by p.full_name)
        from public.event_registrations r join public.profiles p on p.user_id = r.user_id
       where r.event_id = p_event and r.status = 'confirmed'), '[]'::jsonb),
    'teams', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name,
                                                           'place', (select x.place from public.event_results x where x.event_id = p_event and x.team_id = t.id)) order by t.name)
                         from public.event_teams t where t.event_id = p_event), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'starts_at', s.starts_at) order by s.position)
                            from public.event_sessions s where s.event_id = p_event), '[]'::jsonb),
    'fixes', coalesce((select jsonb_agg(jsonb_build_object('name', coalesce(p.full_name, a.email), 'added', c.removed_at is null, 'reason', coalesce(c.removed_reason, c.reason),
                                                           'at', coalesce(c.removed_at, c.checked_in_at)) order by coalesce(c.removed_at, c.checked_in_at) desc)
                         from public.event_checkins c left join public.profiles p on p.user_id = c.user_id left join public.event_email_attendees a on a.id = c.email_attendee_id
                        where c.event_id = p_event and (c.method = 'manual' or c.removed_at is not null)), '[]'::jsonb));
end;
$$;

-- A manual add or removal needs a reason; the check-in row keeps who, when and why.
create function private.fix_attendance(p_event uuid, p_session uuid, p_user uuid, p_present boolean, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e public.events;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_session uuid;
begin
  e := private.require_event_officer(p_event);
  if not private.event_closeout_open(e) then
    raise exception 'close-out is open for 72 hours after the last session' using errcode = '55000';
  end if;
  if char_length(coalesce(v_reason, '')) < 3 then
    raise exception 'give a reason for the change' using errcode = '22023';
  end if;
  if not exists (select 1 from public.event_registrations r where r.event_id = p_event and r.user_id = p_user and r.status = 'confirmed') then
    raise exception 'they aren''t registered' using errcode = 'P0002';
  end if;
  v_session := private.event_session_for(p_event, p_session);
  if p_present then
    perform private.record_checkin(p_event, v_session, p_user, 'manual', v_reason);
  else
    update public.event_checkins set removed_at = now(), removed_by = (select auth.uid()), removed_reason = v_reason
     where session_id = v_session and user_id = p_user and removed_at is null;
    if not found then
      raise exception 'they weren''t checked in to that session' using errcode = 'P0002';
    end if;
  end if;
end;
$$;

create function private.set_event_result(p_event uuid, p_user uuid, p_team uuid, p_place integer, p_label text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e public.events;
begin
  e := private.require_event_officer(p_event);
  if not private.event_closeout_open(e) then
    raise exception 'close-out is open for 72 hours after the last session' using errcode = '55000';
  end if;
  if not ('result' = any (e.record_kinds)) then
    raise exception 'this event doesn''t give results' using errcode = '55000';
  end if;
  if p_place is null then
    delete from public.event_results where event_id = p_event and (user_id = p_user or team_id = p_team);
    return;
  end if;
  if p_team is not null then
    if not exists (select 1 from public.event_teams t where t.id = p_team and t.event_id = p_event) then
      raise exception 'team not found' using errcode = 'P0002';
    end if;
    insert into public.event_results (event_id, team_id, place, label, set_by) values (p_event, p_team, p_place, nullif(btrim(coalesce(p_label, '')), ''), (select auth.uid()))
    on conflict (event_id, team_id) where team_id is not null do update set place = excluded.place, label = excluded.label, set_by = excluded.set_by;
  else
    if not exists (select 1 from public.event_registrations r where r.event_id = p_event and r.user_id = p_user and r.status = 'confirmed') then
      raise exception 'they aren''t registered' using errcode = 'P0002';
    end if;
    insert into public.event_results (event_id, user_id, place, label, set_by) values (p_event, p_user, p_place, nullif(btrim(coalesce(p_label, '')), ''), (select auth.uid()))
    on conflict (event_id, user_id) where user_id is not null do update set place = excluded.place, label = excluded.label, set_by = excluded.set_by;
  end if;
end;
$$;

-- Volunteer hours per person, capped at the activity's length.
create function private.log_volunteer_hours(p_event uuid, p_user uuid, p_hours numeric)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e public.events;
  v_max numeric;
begin
  e := private.require_event_officer(p_event);
  if not private.event_closeout_open(e) then
    raise exception 'close-out is open for 72 hours after the last session' using errcode = '55000';
  end if;
  if not e.volunteer_hours then
    raise exception 'this event doesn''t log volunteer hours' using errcode = '55000';
  end if;
  select sum(extract(epoch from s.ends_at - s.starts_at)) / 3600.0 into v_max from public.event_sessions s where s.event_id = p_event;
  if p_hours is null or p_hours <= 0 then
    delete from public.volunteer_logs where event_id = p_event and user_id = p_user;
    return;
  end if;
  if p_hours > v_max then
    raise exception 'hours are capped at the event''s length (% h)', round(v_max, 1) using errcode = '22023';
  end if;
  if not exists (select 1 from public.event_registrations r where r.event_id = p_event and r.user_id = p_user and r.status = 'confirmed') then
    raise exception 'they aren''t registered' using errcode = 'P0002';
  end if;
  insert into public.volunteer_logs (event_id, user_id, hours, logged_by) values (p_event, p_user, round(p_hours, 2), (select auth.uid()))
  on conflict (event_id, user_id) do update set hours = excluded.hours, logged_by = excluded.logged_by;
end;
$$;

-- Issue: stores the preview for phase 16 to sign (no Record entries exist yet).
create function private.issue_event_entries(p_event uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e public.events;
  v_preview jsonb;
begin
  e := private.require_event_officer(p_event);
  if not private.event_closeout_open(e) then
    raise exception 'close-out is open for 72 hours after the last session' using errcode = '55000';
  end if;
  if exists (select 1 from public.event_issuances i where i.event_id = p_event) then
    raise exception 'entries for this event are already issued' using errcode = '23505';
  end if;
  v_preview := private.event_issue_preview(p_event);
  insert into public.event_issuances (event_id, preview, issued_by) values (p_event, v_preview, (select auth.uid()));
  return v_preview;
end;
$$;

-- The attendee CSV (formula-escaped in the app, lib/uni/csv.ts).
create function private.event_attendees_rows(p_event uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_event_officer(p_event);
  return coalesce((
    select jsonb_agg(jsonb_build_object('name', p.full_name, 'username', p.username, 'department', p.department, 'batch', p.graduation_year,
                                        'status', r.status, 'ticket', t.name, 'team', tm.name, 'registered_at', r.registered_at,
                                        'checked_in_sessions', (select count(distinct c.session_id) from public.event_checkins c where c.event_id = p_event and c.user_id = r.user_id and c.removed_at is null),
                                        'answers', r.answers)
                     order by p.full_name)
      from public.event_registrations r join public.profiles p on p.user_id = r.user_id
      left join public.event_ticket_types t on t.id = r.ticket_type_id left join public.event_teams tm on tm.id = r.team_id
     where r.event_id = p_event and r.status <> 'cancelled'), '[]'::jsonb);
end;
$$;

-- Officer-only: the society's events, for the society page and manage.
create function private.society_event_list(p_society uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_see_society(p_society) then
    raise exception 'society not found' using errcode = 'P0002';
  end if;
  return coalesce((
    select jsonb_agg(private.event_card_v2(e.id) order by e.starts_at desc)
      from public.events e
     where (e.society_id = p_society or exists (select 1 from public.event_cohosts c where c.event_id = e.id and c.society_id = p_society and c.status = 'accepted'))
       and (e.status <> 'draft' or private.is_society_officer(p_society))
     limit 100), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------
-- Every minute: statuses and reminders (holds and waitlist promotion join in the paid-ticket migration).
create function private.event_tick()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r record;
begin
  update public.events set status = 'live' where society_id is not null and status = 'published' and starts_at <= now();
  update public.events set status = 'ended' where society_id is not null and status in ('published', 'live') and ends_at <= now();
  for r in
    select x.event_id, x.user_id, e.title, e.starts_at,
           case when e.starts_at <= now() + interval '1 hour' then '1h' else '24h' end as which
      from public.event_registrations x join public.events e on e.id = x.event_id
     where e.society_id is not null and e.status = 'published' and x.status = 'confirmed'
       and ((e.starts_at <= now() + interval '24 hours' and e.starts_at > now() + interval '1 hour' and x.reminded_at is null)
            or (e.starts_at <= now() + interval '1 hour' and e.starts_at > now() and x.reminded_1h_at is null))
     limit 2000
  loop
    perform private.notify(r.user_id, null, 'event_reminder', 'event', r.event_id,
                           jsonb_build_object('event', r.title, 'starts_at', r.starts_at, 'when', r.which));
    if r.which = '1h' then
      update public.event_registrations set reminded_1h_at = now(), reminded_at = coalesce(reminded_at, now()) where event_id = r.event_id and user_id = r.user_id;
    else
      update public.event_registrations set reminded_at = now() where event_id = r.event_id and user_id = r.user_id;
    end if;
  end loop;
  perform private.event_tick_payments();
end;
$$;
revoke all on function private.event_tick() from public;

create function private.event_tick_payments()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return;
end;
$$;
revoke all on function private.event_tick_payments() from public;

-- Hourly: when the host hasn't issued, Attended and Completed are stored for issuing at 72 hours.
create function private.event_closeout_tick()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e record;
  v_preview jsonb;
begin
  for e in
    select x.id from public.events x
     where x.society_id is not null and x.status = 'ended'
       and x.ends_at + make_interval(hours => private.event_limit('closeout_hours')) <= now()
       and not exists (select 1 from public.event_issuances i where i.event_id = x.id)
     limit 200
  loop
    v_preview := private.event_issue_preview(e.id);
    -- Results and hours always need the host.
    insert into public.event_issuances (event_id, preview, auto)
    values (e.id, jsonb_build_object('attended', v_preview->'attended', 'completed', v_preview->'completed',
                                     'results', '[]'::jsonb, 'volunteer', '[]'::jsonb, 'emails', v_preview->'emails'), true);
  end loop;
  perform private.event_closeout_payments();
end;
$$;
revoke all on function private.event_closeout_tick() from public;

create function private.event_closeout_payments()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return;
end;
$$;
revoke all on function private.event_closeout_payments() from public;

select cron.schedule('event-tick', '* * * * *', $$select private.event_tick()$$);
select cron.schedule('event-closeout', '23 * * * *', $$select private.event_closeout_tick()$$);

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
  'save_society_event', 'publish_event', 'cancel_society_event', 'event_edit_payload', 'answer_cohost', 'society_events',
  'event_page', 'register_event', 'cancel_registration', 'decide_registration', 'my_tickets', 'event_ticket', 'event_manage',
  'add_event_staff', 'remove_event_staff', 'message_registrants', 'submit_event_feedback', 'check_in_scan', 'check_in_search',
  'check_in_person', 'check_in_email', 'event_headcount', 'society_event_code', 'self_check_in', 'closeout_page',
  'fix_attendance', 'set_event_result', 'log_volunteer_hours', 'issue_event_entries', 'event_attendees_rows', 'society_event_list']);
drop function pg_temp.expose(text[]);
