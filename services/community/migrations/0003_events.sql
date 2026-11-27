-- community: society events (PRD 5.31), ported from apps/web/supabase/migrations/20261111000002_society_events.sql
-- and the society half of 20261019000000_uni_comms.sql (events, event_registrations, event_secrets). University
-- events and fairs are market's (W11); this table holds society events only (society_id is never null).
-- Seats are given out under a row lock on the ticket type (src/store/registrations.ts). Tickets are signed with
-- the event's secret, kept sealed under the Key Vault key community-ticket-key (src/domain/ticket.ts).
-- Forward-only.

create table community.events (
  id uuid primary key,
  university_id uuid not null,
  society_id uuid not null references community.societies (id) on delete cascade,
  created_by uuid,
  type text not null check (type in ('talk', 'workshop', 'hackathon', 'competition', 'other', 'social', 'volunteering')),
  scope text not null default 'university' check (scope in ('university', 'global')),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text check (description is null or char_length(description) <= 4000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text check (location is null or char_length(btrim(location)) between 2 and 120),
  link text check (link is null or (link ~ '^https://[^[:space:]]+$' and char_length(link) <= 500)),
  cancelled_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'published', 'live', 'ended', 'cancelled')),
  record_kinds text[] not null default '{attended}'
    check (record_kinds <@ array['attended', 'completed', 'result']::text[] and cardinality(record_kinds) between 1 and 3),
  completed_min smallint check (completed_min is null or completed_min between 1 and 20),
  volunteer_hours boolean not null default false,
  team_min smallint check (team_min is null or team_min between 2 and 6),
  team_max smallint check (team_max is null or team_max between 2 and 6),
  approval_mode text not null default 'automatic' check (approval_mode in ('automatic', 'manual')),
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  eligibility jsonb not null default '{"scope": "university"}'
    check (jsonb_typeof(eligibility) = 'object' and eligibility ->> 'scope' in ('university', 'all', 'groups')),
  cover_path text check (cover_path is null or cover_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  refund_policy text not null default 'none' check (refund_policy in ('none', 'until')),
  refund_days smallint check (refund_days is null or refund_days between 1 and 60),
  -- The event's post in content (posts are content's; this is its id).
  post_id uuid,
  published_at timestamptz,
  cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at <= starts_at + interval '14 days'),
  check (location is not null or link is not null),
  constraint events_team_range check ((team_min is null) = (team_max is null) and (team_min is null or team_min <= team_max)),
  constraint events_registration_window check (registration_closes_at is null or registration_opens_at is null or registration_closes_at > registration_opens_at),
  constraint events_refund check ((refund_policy = 'until') = (refund_days is not null))
);
create index events_society_idx on community.events (society_id, starts_at);
create index events_status_idx on community.events (status, starts_at);
create index events_university_idx on community.events (university_id, published_at);

-- The event's ticket secret (32 random bytes), sealed: AES-256-GCM under community-ticket-key, the event id bound.
create table community.event_secrets (
  event_id uuid primary key references community.events (id) on delete cascade,
  sealed bytea not null
);

create table community.event_sessions (
  id uuid primary key,
  event_id uuid not null references community.events (id) on delete cascade,
  position smallint not null check (position between 1 and 20),
  title text check (title is null or char_length(btrim(title)) between 2 and 80),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  check (ends_at > starts_at and ends_at <= starts_at + interval '24 hours'),
  unique (event_id, position)
);

create table community.event_ticket_types (
  id uuid primary key,
  event_id uuid not null references community.events (id) on delete cascade,
  position smallint not null check (position between 1 and 5),
  name text not null check (char_length(btrim(name)) between 2 and 40),
  capacity integer not null check (capacity between 1 and 20000),
  price_pkr integer check (price_pkr is null or price_pkr between 1 and 1000000),
  unique (event_id, position)
);
create index event_ticket_types_event_idx on community.event_ticket_types (event_id);

create table community.event_questions (
  event_id uuid not null references community.events (id) on delete cascade,
  position smallint not null check (position between 1 and 8),
  label text not null check (char_length(btrim(label)) between 3 and 200),
  kind text not null check (kind in ('short', 'long', 'single', 'multi')),
  options text[] not null default '{}' check (cardinality(options) <= 10),
  required boolean not null default false,
  primary key (event_id, position),
  check ((kind in ('single', 'multi')) = (cardinality(options) >= 2))
);

create table community.event_cohosts (
  event_id uuid not null references community.events (id) on delete cascade,
  society_id uuid not null references community.societies (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  primary key (event_id, society_id)
);
create index event_cohosts_society_idx on community.event_cohosts (society_id);

create table community.event_teams (
  id uuid primary key,
  event_id uuid not null references community.events (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 40),
  code text not null check (code ~ '^[A-Z0-9]{6}$'),
  captain_id uuid,
  created_at timestamptz not null default now(),
  unique (event_id, code)
);

create table community.event_registrations (
  id uuid primary key,
  event_id uuid not null references community.events (id) on delete cascade,
  user_id uuid not null,
  ticket_type_id uuid references community.event_ticket_types (id) on delete set null,
  status text not null default 'confirmed' check (status in ('confirmed', 'pending', 'waitlisted', 'held', 'cancelled', 'declined')),
  waitlist_position integer check (waitlist_position is null or waitlist_position >= 1),
  answers jsonb not null default '[]' check (jsonb_typeof(answers) = 'array'),
  team_id uuid references community.event_teams (id) on delete set null,
  added_by uuid,
  registered_at timestamptz not null default now(),
  cancelled_at timestamptz,
  checked_in_at timestamptz,
  reminded_at timestamptz,
  reminded_1h_at timestamptz,
  hold_expires_at timestamptz,
  decided_at timestamptz,
  unique (event_id, user_id)
);
create index event_registrations_ticket_idx on community.event_registrations (ticket_type_id, status);
create index event_registrations_user_status_idx on community.event_registrations (user_id, status);
create index event_registrations_team_idx on community.event_registrations (team_id) where team_id is not null;
create index event_registrations_hold_idx on community.event_registrations (hold_expires_at) where status = 'held';

create table community.event_staff (
  event_id uuid not null references community.events (id) on delete cascade,
  user_id uuid not null,
  added_by uuid,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_staff_user_idx on community.event_staff (user_id);

-- Walk-ins added by university email who aren't on Skilient yet; credentials (W8) sends the claim email from
-- event.closed (its email_hash, never the address).
create table community.event_email_attendees (
  id uuid primary key,
  event_id uuid not null references community.events (id) on delete cascade,
  email text not null check (char_length(email) between 6 and 254 and email = lower(email) and email ~ '^[^\s@]+@[^\s@]+$'),
  added_by uuid,
  claimed_by uuid,
  created_at timestamptz not null default now(),
  unique (event_id, email)
);

create table community.event_checkins (
  id uuid primary key,
  event_id uuid not null references community.events (id) on delete cascade,
  session_id uuid not null references community.event_sessions (id) on delete cascade,
  user_id uuid,
  email_attendee_id uuid references community.event_email_attendees (id) on delete cascade,
  method text not null check (method in ('scan', 'search', 'email', 'self', 'manual', 'walk_in')),
  checked_in_by uuid,
  checked_in_at timestamptz not null default now(),
  reason text check (reason is null or char_length(reason) <= 300),
  removed_at timestamptz,
  removed_by uuid,
  removed_reason text check (removed_reason is null or char_length(removed_reason) <= 300),
  check ((user_id is null) <> (email_attendee_id is null)),
  check ((removed_at is null) = (removed_reason is null))
);
create unique index event_checkins_user_once on community.event_checkins (session_id, user_id) where user_id is not null;
create unique index event_checkins_email_once on community.event_checkins (session_id, email_attendee_id) where email_attendee_id is not null;
create index event_checkins_event_idx on community.event_checkins (event_id);
create index event_checkins_user_idx on community.event_checkins (user_id) where user_id is not null;

create table community.event_results (
  id uuid primary key,
  event_id uuid not null references community.events (id) on delete cascade,
  user_id uuid,
  team_id uuid references community.event_teams (id) on delete cascade,
  place smallint not null check (place between 1 and 50),
  label text check (label is null or char_length(btrim(label)) between 2 and 60),
  set_by uuid,
  created_at timestamptz not null default now(),
  check ((user_id is null) <> (team_id is null))
);
create unique index event_results_user_once on community.event_results (event_id, user_id) where user_id is not null;
create unique index event_results_team_once on community.event_results (event_id, team_id) where team_id is not null;

create table community.volunteer_logs (
  event_id uuid not null references community.events (id) on delete cascade,
  user_id uuid not null,
  hours numeric(5, 2) not null check (hours > 0 and hours <= 336),
  logged_by uuid,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index volunteer_logs_user_idx on community.volunteer_logs (user_id);

-- Close-out's issue: who earns Attended, Completed, Results and Volunteer hours. Handed to credentials (W8) as
-- event.closed in the same transaction (status 'signed' = handed over, as the stack's trigger set it).
create table community.event_issuances (
  event_id uuid primary key references community.events (id) on delete cascade,
  preview jsonb not null check (jsonb_typeof(preview) = 'object'),
  status text not null default 'queued' check (status in ('queued', 'signed')),
  auto boolean not null default false,
  issued_by uuid,
  issued_at timestamptz not null default now()
);

create table community.event_feedback (
  event_id uuid not null references community.events (id) on delete cascade,
  user_id uuid not null,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table community.event_messages (
  id uuid primary key,
  event_id uuid not null references community.events (id) on delete cascade,
  sender_id uuid,
  body text not null check (char_length(btrim(body)) between 3 and 1000),
  created_at timestamptz not null default now()
);
create index event_messages_event_idx on community.event_messages (event_id, created_at desc);

alter table community.events enable row level security;
alter table community.events force row level security;
create policy events_owner on community.events for all to svc_community using (true) with check (true);
alter table community.event_secrets enable row level security;
alter table community.event_secrets force row level security;
create policy event_secrets_owner on community.event_secrets for all to svc_community using (true) with check (true);
alter table community.event_sessions enable row level security;
alter table community.event_sessions force row level security;
create policy event_sessions_owner on community.event_sessions for all to svc_community using (true) with check (true);
alter table community.event_ticket_types enable row level security;
alter table community.event_ticket_types force row level security;
create policy event_ticket_types_owner on community.event_ticket_types for all to svc_community using (true) with check (true);
alter table community.event_questions enable row level security;
alter table community.event_questions force row level security;
create policy event_questions_owner on community.event_questions for all to svc_community using (true) with check (true);
alter table community.event_cohosts enable row level security;
alter table community.event_cohosts force row level security;
create policy event_cohosts_owner on community.event_cohosts for all to svc_community using (true) with check (true);
alter table community.event_teams enable row level security;
alter table community.event_teams force row level security;
create policy event_teams_owner on community.event_teams for all to svc_community using (true) with check (true);
alter table community.event_registrations enable row level security;
alter table community.event_registrations force row level security;
create policy event_registrations_owner on community.event_registrations for all to svc_community using (true) with check (true);
alter table community.event_staff enable row level security;
alter table community.event_staff force row level security;
create policy event_staff_owner on community.event_staff for all to svc_community using (true) with check (true);
alter table community.event_email_attendees enable row level security;
alter table community.event_email_attendees force row level security;
create policy event_email_attendees_owner on community.event_email_attendees for all to svc_community using (true) with check (true);
alter table community.event_checkins enable row level security;
alter table community.event_checkins force row level security;
create policy event_checkins_owner on community.event_checkins for all to svc_community using (true) with check (true);
alter table community.event_results enable row level security;
alter table community.event_results force row level security;
create policy event_results_owner on community.event_results for all to svc_community using (true) with check (true);
alter table community.volunteer_logs enable row level security;
alter table community.volunteer_logs force row level security;
create policy volunteer_logs_owner on community.volunteer_logs for all to svc_community using (true) with check (true);
alter table community.event_issuances enable row level security;
alter table community.event_issuances force row level security;
create policy event_issuances_owner on community.event_issuances for all to svc_community using (true) with check (true);
alter table community.event_feedback enable row level security;
alter table community.event_feedback force row level security;
create policy event_feedback_owner on community.event_feedback for all to svc_community using (true) with check (true);
alter table community.event_messages enable row level security;
alter table community.event_messages force row level security;
create policy event_messages_owner on community.event_messages for all to svc_community using (true) with check (true);

grant select, insert, update, delete on community.events, community.event_secrets, community.event_sessions, community.event_ticket_types,
  community.event_questions, community.event_cohosts, community.event_teams, community.event_registrations, community.event_staff,
  community.event_email_attendees, community.event_checkins, community.event_results, community.volunteer_logs, community.event_issuances,
  community.event_feedback, community.event_messages to svc_community;
