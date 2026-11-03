-- Phase 15 (Student-first track, PRD 5.31): societies.
--
-- * societies (pending → verified by trust staff; invisible to everyone but the requester, its
--   officers and staff until then), society_requests (proof in the private society-documents bucket,
--   the submit_org_document pattern), logo and cover in the public society-media bucket.
-- * society_members (president, officers, members; one president), society_terms (officer terms:
--   the roll call, former officers and the term-end confirmations phase 16 issues from),
--   society_invites (officer invites and handovers, both accepted by the invitee),
--   society_join_requests (Request mode), society_follows.
-- * induction_rounds / induction_roles / induction_questions / induction_applications (the
--   venture_roles, venture_questions and application_threads pattern).
-- * posts.society_id: officers post as the society; event posts become officer-only; the feed
--   gains a Societies chip.
-- * Staff: ops_societies, ops_society_case, claim_society, decide_society (audited before/after).
-- * society-tick (hourly): term-end tasks for presidents, rounds close at the deadline and
--   applications nobody decided are declined 14 days later.
-- Every table: RLS on, no direct access; reads and writes go through the functions below.

create type public.society_status as enum ('pending', 'more_info', 'verified', 'rejected', 'suspended');
create type public.society_role as enum ('president', 'officer', 'member');

-- "CS Society", "The CS Club" and "cs  society!" are the same name at one university.
create function private.society_name_key(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(
           btrim(regexp_replace(regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')),
           '^(the )|( (society|club|soc))+$', '', 'g'));
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.societies (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
  name text not null check (char_length(btrim(name)) between 3 and 80),
  name_key text not null check (char_length(name_key) between 1 and 80),
  category text not null check (category in ('technology', 'business', 'debating', 'arts', 'sports', 'community', 'religious', 'other')),
  about text not null check (char_length(btrim(about)) between 20 and 1000),
  logo_path text check (logo_path is null or logo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  cover_path text check (cover_path is null or cover_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  status public.society_status not null default 'pending',
  status_reason text check (status_reason is null or char_length(status_reason) <= 1000),
  membership_mode text not null default 'request' check (membership_mode in ('open', 'request', 'inductions')),
  -- Staff can pause a society's paid tickets without suspending it (PRD 5.31 "Disputes and limits").
  paid_paused boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  verified_by uuid references auth.users (id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.societies is 'Campus societies (PRD 5.31). Visible to students once verified; read through society_page/societies_directory.';
create unique index societies_name_unique on public.societies (university_id, name_key) where status <> 'rejected';
create index societies_university_idx on public.societies (university_id, status);
create index societies_created_by_idx on public.societies (created_by);
create index societies_verified_by_idx on public.societies (verified_by) where verified_by is not null;
create trigger societies_set_updated_at before update on public.societies for each row execute function private.set_updated_at();

create table public.society_requests (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies (id) on delete cascade,
  requester_id uuid not null references auth.users (id) on delete cascade,
  proof_path text check (proof_path is null or proof_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|webp)$'),
  proof_url text check (proof_url is null or (proof_url ~ '^https://[^[:space:]]+$' and char_length(proof_url) <= 500)),
  office_bearer boolean not null check (office_bearer),
  status text not null default 'pending' check (status in ('pending', 'more_info', 'approved', 'rejected')),
  staff_note text check (staff_note is null or char_length(staff_note) <= 1000),
  claimed_by uuid references auth.users (id) on delete set null,
  claimed_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (proof_path is not null or proof_url is not null)
);
comment on table public.society_requests is 'A student''s request to list a society, with its proof (PRD 5.31). One open request per student.';
create unique index society_requests_one_open on public.society_requests (requester_id) where status in ('pending', 'more_info');
create index society_requests_society_idx on public.society_requests (society_id);
create index society_requests_queue_idx on public.society_requests (status, created_at);
create index society_requests_claimed_by_idx on public.society_requests (claimed_by) where claimed_by is not null;
create trigger society_requests_set_updated_at before update on public.society_requests for each row execute function private.set_updated_at();

create table public.society_members (
  society_id uuid not null references public.societies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.society_role not null default 'member',
  title text check (title is null or char_length(btrim(title)) between 2 and 40),
  team_title text check (team_title is null or char_length(btrim(team_title)) between 2 and 40),
  joined_at timestamptz not null default now(),
  primary key (society_id, user_id)
);
comment on table public.society_members is 'Who belongs to a society and in what role (PRD 5.31). Exactly one president per society.';
create unique index society_members_one_president on public.society_members (society_id) where role = 'president';
create index society_members_user_idx on public.society_members (user_id);

create table public.society_terms (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.society_role not null check (role in ('president', 'officer')),
  title text not null check (char_length(btrim(title)) between 2 and 40),
  term_start date not null,
  term_end date not null check (term_end >= term_start),
  ended_at timestamptz,
  ended_notified_at timestamptz,
  confirmed_by uuid references auth.users (id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((confirmed_by is null) = (confirmed_at is null))
);
comment on table public.society_terms is 'Officer terms: the roll call and former officers, and the term-end confirmations phase 16 issues Office bearer entries from.';
create index society_terms_society_idx on public.society_terms (society_id, term_end);
create index society_terms_user_idx on public.society_terms (user_id);
create index society_terms_confirmed_by_idx on public.society_terms (confirmed_by) where confirmed_by is not null;
create unique index society_terms_one_open on public.society_terms (society_id, user_id) where ended_at is null;

create table public.society_invites (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies (id) on delete cascade,
  kind text not null check (kind in ('officer', 'handover')),
  invitee_id uuid not null references auth.users (id) on delete cascade,
  invited_by uuid references auth.users (id) on delete set null,
  title text check (title is null or char_length(btrim(title)) between 2 and 40),
  term_start date,
  term_end date,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  check (kind = 'handover' or (title is not null and term_start is not null and term_end is not null and term_end >= term_start))
);
create unique index society_invites_one_pending on public.society_invites (society_id, invitee_id, kind) where status = 'pending';
create index society_invites_invitee_idx on public.society_invites (invitee_id) where status = 'pending';
create index society_invites_invited_by_idx on public.society_invites (invited_by) where invited_by is not null;

create table public.society_join_requests (
  society_id uuid not null references public.societies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (society_id, user_id)
);
create index society_join_requests_user_idx on public.society_join_requests (user_id);

create table public.society_follows (
  society_id uuid not null references public.societies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (society_id, user_id)
);
create index society_follows_user_idx on public.society_follows (user_id);

create table public.induction_rounds (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 80),
  description text check (description is null or char_length(description) <= 1500),
  deadline timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  created_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  undecided_closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index induction_rounds_society_idx on public.induction_rounds (society_id, status);
create index induction_rounds_open_idx on public.induction_rounds (deadline) where status = 'open';
create index induction_rounds_created_by_idx on public.induction_rounds (created_by) where created_by is not null;

create table public.induction_roles (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.induction_rounds (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 40),
  seats smallint not null check (seats between 1 and 50),
  filled smallint not null default 0 check (filled >= 0 and filled <= seats),
  skill_ids text[] not null default '{}' check (cardinality(skill_ids) <= 5),
  position smallint not null default 1
);
create index induction_roles_round_idx on public.induction_roles (round_id);

create table public.induction_questions (
  round_id uuid not null references public.induction_rounds (id) on delete cascade,
  position smallint not null check (position between 1 and 3),
  body text not null check (char_length(btrim(body)) between 5 and 300),
  primary key (round_id, position)
);

create table public.induction_applications (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.induction_rounds (id) on delete cascade,
  role_id uuid not null references public.induction_roles (id) on delete cascade,
  applicant_id uuid not null references auth.users (id) on delete cascade,
  answers jsonb not null default '[]' check (jsonb_typeof(answers) = 'array'),
  status text not null default 'pending' check (status in ('pending', 'shortlisted', 'accepted', 'declined')),
  note text check (note is null or char_length(note) <= 500),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (round_id, applicant_id)
);
create index induction_applications_role_idx on public.induction_applications (role_id);
create index induction_applications_applicant_idx on public.induction_applications (applicant_id);
create index induction_applications_decided_by_idx on public.induction_applications (decided_by) where decided_by is not null;

alter table public.posts add column society_id uuid references public.societies (id) on delete set null;
create index posts_society_idx on public.posts (society_id, created_at desc) where society_id is not null;
alter table public.feed_sessions drop constraint if exists feed_sessions_filter_check;
alter table public.feed_sessions add constraint feed_sessions_filter_check
  check (filter in ('all', 'ventures', 'events', 'announcements', 'shipped', 'societies'));

do $$
declare
  t text;
begin
  foreach t in array array['societies', 'society_requests', 'society_members', 'society_terms', 'society_invites',
                           'society_join_requests', 'society_follows', 'induction_rounds', 'induction_roles',
                           'induction_questions', 'induction_applications'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
  -- People creating things while suspended are refused (phase 11).
  foreach t in array array['societies', 'society_requests', 'society_join_requests', 'society_follows', 'induction_rounds',
                           'induction_applications', 'society_invites'] loop
    execute format('create trigger refuse_if_restricted before insert on public.%I for each row execute function private.refuse_if_restricted()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: proof documents (private) and logos/covers (public)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('society-documents', 'society-documents', false, 5242880, array['application/pdf', 'image/webp']),
  ('society-media', 'society-media', true, 2097152, array['image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- society-documents/{user_id}/{uuid}.pdf|webp: the requester's own folder, at most 5 files.
create function private.society_doc_upload_allowed(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|webp)$'
     and (storage.foldername(p_name))[1] = (select auth.uid())::text
     and (select count(*) from storage.objects o
           where o.bucket_id = 'society-documents' and (storage.foldername(o.name))[1] = (select auth.uid())::text) < 5;
$$;
revoke all on function private.society_doc_upload_allowed(text) from public;
grant execute on function private.society_doc_upload_allowed(text) to authenticated;

-- The requester, and trust staff reviewing it.
create function private.society_doc_readable(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (storage.foldername(p_name))[1] = (select auth.uid())::text or private.is_staff('trust_reviewer');
$$;
revoke all on function private.society_doc_readable(text) from public;
grant execute on function private.society_doc_readable(text) to authenticated;

create policy society_documents_read on storage.objects for select to authenticated
  using (bucket_id = 'society-documents' and (select private.society_doc_readable(name)));
create policy society_documents_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'society-documents' and (select private.society_doc_upload_allowed(name)));

-- society-media/{society_id}/{uuid}.webp (logo, cover, event covers; at most 60 live files, replaced
-- ones are deleted by storage-cleanup): the server action re-encodes with sharp, then uploads as
-- the officer (or the requester while pending).
create function private.is_society_officer(p_society uuid, p_user uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.society_members m
                  where m.society_id = p_society and m.user_id = coalesce(p_user, (select auth.uid()))
                    and m.role in ('president', 'officer'));
$$;
revoke all on function private.is_society_officer(uuid, uuid) from public;
grant execute on function private.is_society_officer(uuid, uuid) to authenticated;

create function private.society_media_upload_allowed(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
     and exists (select 1 from public.societies s
                  where s.id::text = (storage.foldername(p_name))[1]
                    and s.status in ('pending', 'more_info', 'verified')
                    and (private.is_society_officer(s.id) or s.created_by = (select auth.uid())))
     and (select count(*) from storage.objects o
           where o.bucket_id = 'society-media' and (storage.foldername(o.name))[1] = (storage.foldername(p_name))[1]) < 60;
$$;
revoke all on function private.society_media_upload_allowed(text) from public;
grant execute on function private.society_media_upload_allowed(text) to authenticated;
create policy society_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'society-media' and (select private.society_media_upload_allowed(name)));

create or replace function private.queue_storage_cleanup(p_bucket text, p_path text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  select pgmq.send('storage_cleanup', jsonb_build_object('bucket', p_bucket, 'path', p_path))
   where p_path is not null
     and p_bucket in ('post-media', 'chat-media', 'avatars', 'credentials', 'cv-exports', 'feedback',
                      'university-claims', 'university-media', 'org-documents', 'society-documents', 'society-media',
                      'event-receipts');
$$;

-- Replaced images and documents go to the storage worker.
create function private.society_files_cleanup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'societies' then
    if tg_op = 'DELETE' then
      perform private.queue_storage_cleanup('society-media', old.logo_path);
      perform private.queue_storage_cleanup('society-media', old.cover_path);
    else
      if old.logo_path is distinct from new.logo_path then perform private.queue_storage_cleanup('society-media', old.logo_path); end if;
      if old.cover_path is distinct from new.cover_path then perform private.queue_storage_cleanup('society-media', old.cover_path); end if;
    end if;
  elsif tg_table_name = 'society_requests' then
    if tg_op = 'DELETE' then
      perform private.queue_storage_cleanup('society-documents', old.proof_path);
    elsif old.proof_path is distinct from new.proof_path then
      perform private.queue_storage_cleanup('society-documents', old.proof_path);
    end if;
  end if;
  return null;
end;
$$;
revoke all on function private.society_files_cleanup() from public;
create trigger societies_files_cleanup after update of logo_path, cover_path or delete on public.societies
  for each row execute function private.society_files_cleanup();
create trigger society_requests_files_cleanup after update of proof_path or delete on public.society_requests
  for each row execute function private.society_files_cleanup();

-- ---------------------------------------------------------------------------
-- Config, notifications, analytics
-- ---------------------------------------------------------------------------
insert into public.platform_config (key, version, value, reason) values
  ('societies.limits', 1,
   '{"max_officers": 15, "induction_questions": 3, "induction_max_days": 30, "undecided_decline_days": 14, "review_days": 3}',
   'PRD 5.31: at most 15 officers, 3 induction questions, rounds up to 30 days, undecided applications declined 14 days after the deadline, reviewed within 3 working days.');
insert into public.config_keys (key, area, description, applies, schema) values
  ('societies.limits', 'societies', 'Limits on societies: officers, induction questions and round length, when undecided applications are declined, and the review promise.', 'now',
   '{"type": "object", "additionalProperties": false,
     "required": ["max_officers", "induction_questions", "induction_max_days", "undecided_decline_days", "review_days"],
     "properties": {
       "max_officers": {"type": "integer", "minimum": 1, "maximum": 50},
       "induction_questions": {"type": "integer", "minimum": 0, "maximum": 10},
       "induction_max_days": {"type": "integer", "minimum": 1, "maximum": 90},
       "undecided_decline_days": {"type": "integer", "minimum": 1, "maximum": 60},
       "review_days": {"type": "integer", "minimum": 1, "maximum": 14}}}');

insert into public.notification_categories (category, label, description, position, default_channel, allow_instant) values
  ('societies', 'Societies and events', 'Societies you follow or belong to, their posts and events, and your tickets.', 24, 'digest', true);
insert into public.notification_types (type, category, emailed) values
  ('society_decided', 'societies', true),
  ('society_invite', 'societies', true),
  ('society_invite_answered', 'societies', false),
  ('society_join_request', 'societies', false),
  ('society_joined', 'societies', false),
  ('society_post', 'societies', false),
  ('induction_published', 'societies', false),
  ('induction_applied', 'societies', false),
  ('induction_decided', 'societies', true),
  ('term_ended', 'societies', true);

create function private.society_analytics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.track(new.created_by, 'society_requested', jsonb_build_object('category', new.category), null, null);
  elsif old.status <> 'verified' and new.status = 'verified' then
    perform private.track(new.created_by, 'society_verified', jsonb_build_object('category', new.category), null, null);
  end if;
  return null;
end;
$$;
revoke all on function private.society_analytics() from public;
create trigger societies_analytics after insert or update of status on public.societies
  for each row execute function private.society_analytics();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function private.society_limit(p_key text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (coalesce(private.config('societies.limits'), '{}'::jsonb) ->> p_key)::integer;
$$;
revoke all on function private.society_limit(text) from public;

create function private.is_society_president(p_society uuid, p_user uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.society_members m
                  where m.society_id = p_society and m.user_id = coalesce(p_user, (select auth.uid())) and m.role = 'president');
$$;
revoke all on function private.is_society_president(uuid, uuid) from public;

-- Who can see a society: verified ones at the viewer's university (or any for faculty/staff); pending
-- ones only the requester, its officers and trust staff.
create function private.can_see_society(p_society uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.societies s
     where s.id = p_society
       and (
         (s.status = 'verified' and exists (select 1 from public.profiles v where v.user_id = (select auth.uid()) and v.status <> 'deleting'))
         or s.created_by = (select auth.uid())
         or private.is_society_officer(s.id)
         or private.is_staff('trust_reviewer')
         or private.is_staff('moderator')));
$$;
revoke all on function private.can_see_society(uuid) from public;
grant execute on function private.can_see_society(uuid) to authenticated;

create function private.require_society_officer(p_society uuid, p_president boolean default false)
returns public.societies
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.societies;
begin
  select * into s from public.societies where id = p_society;
  if not found or not private.is_society_officer(p_society) then
    raise exception 'society not found' using errcode = 'P0002';
  end if;
  if p_president and not private.is_society_president(p_society) then
    raise exception 'only the president can do that' using errcode = '42501';
  end if;
  if s.status = 'suspended' then
    raise exception 'this society is suspended' using errcode = '55000';
  end if;
  return s;
end;
$$;
revoke all on function private.require_society_officer(uuid, boolean) from public;

create function private.notify_society_officers(p_society uuid, p_actor uuid, p_type text, p_entity_type text, p_entity uuid, p_data jsonb)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  select private.notify(m.user_id, p_actor, p_type, p_entity_type, p_entity, p_data)
    from public.society_members m
   where m.society_id = p_society and m.role in ('president', 'officer') and m.user_id is distinct from p_actor;
$$;
revoke all on function private.notify_society_officers(uuid, uuid, text, text, uuid, jsonb) from public;

create function private.society_slug(p_name text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_base text := left(btrim(regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'), '-'), 50);
  v_slug text;
begin
  if char_length(v_base) < 3 then
    v_base := 'society';
  end if;
  v_slug := v_base;
  while exists (select 1 from public.societies where slug = v_slug) loop
    v_slug := v_base || '-' || substr(md5(random()::text), 1, 4);
  end loop;
  return v_slug;
end;
$$;
revoke all on function private.society_slug(text) from public;

-- A society's card: what directories, the feed byline and pages share.
create function private.society_card(p_society uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'id', s.id, 'slug', s.slug, 'name', s.name, 'category', s.category, 'about', s.about,
           'logo_path', s.logo_path, 'cover_path', s.cover_path, 'status', s.status, 'membership_mode', s.membership_mode,
           'university', u.name, 'university_id', s.university_id,
           'members', (select count(*) from public.society_members m where m.society_id = s.id),
           'followers', (select count(*) from public.society_follows f where f.society_id = s.id),
           'open_rounds', (select count(*) from public.induction_rounds r where r.society_id = s.id and r.status = 'open'),
           'updated_at', s.updated_at)
    from public.societies s join public.universities u on u.id = s.university_id
   where s.id = p_society;
$$;
revoke all on function private.society_card(uuid) from public;

-- ---------------------------------------------------------------------------
-- Request a society
-- ---------------------------------------------------------------------------
-- The live name check: is a society with this name already listed at the caller's university?
create function private.society_name_check(p_name text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'available', s.id is null,
           'name', s.name,
           'university', u.name)
    from (select private.current_university_id() as uni) me
    left join public.universities u on u.id = me.uni
    left join lateral (select x.id, x.name from public.societies x
                        where x.university_id = me.uni and x.status <> 'rejected'
                          and x.name_key = private.society_name_key(p_name) limit 1) s on true;
$$;

-- p: {name, category, about, proof_path?, proof_url?, office_bearer}
create function private.request_society(p jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_uni uuid;
  v_name text := btrim(coalesce(p->>'name', ''));
  v_key text := private.society_name_key(p->>'name');
  v_id uuid;
  v_path text := nullif(btrim(coalesce(p->>'proof_path', '')), '');
  v_url text := nullif(btrim(coalesce(p->>'proof_url', '')), '');
begin
  select pr.university_id into v_uni from public.profiles pr
   where pr.user_id = v_me and pr.role = 'student' and pr.onboarding_complete and pr.status = 'active';
  if v_uni is null then
    raise exception 'only students at a university on Skilient can request a society' using errcode = '42501';
  end if;
  if coalesce((p->>'office_bearer')::boolean, false) is not true then
    raise exception 'confirm that you are an office bearer of this society' using errcode = '22023';
  end if;
  if v_path is null and v_url is null then
    raise exception 'add a proof document or an official link' using errcode = '22023';
  end if;
  if v_path is not null and (split_part(v_path, '/', 1) <> v_me::text
      or not exists (select 1 from storage.objects o where o.bucket_id = 'society-documents' and o.name = v_path)) then
    raise exception 'upload the proof again' using errcode = '22023';
  end if;
  if exists (select 1 from public.society_requests r where r.requester_id = v_me and r.status in ('pending', 'more_info')) then
    raise exception 'you already have a society request waiting for review' using errcode = '23505';
  end if;
  if exists (select 1 from public.societies s where s.university_id = v_uni and s.name_key = v_key and s.status <> 'rejected') then
    raise exception 'A society with this name is already on Skilient at your university' using errcode = '23505';
  end if;
  if not private.rate_limit('society_request:' || v_me::text, 3, interval '1 day') then
    raise exception 'too many requests today; try again tomorrow' using errcode = '54000';
  end if;
  insert into public.societies (university_id, slug, name, name_key, category, about, created_by)
  values (v_uni, private.society_slug(v_name), v_name, v_key, p->>'category', btrim(coalesce(p->>'about', '')), v_me)
  returning id into v_id;
  insert into public.society_requests (society_id, requester_id, proof_path, proof_url, office_bearer)
  values (v_id, v_me, v_path, v_url, true);
  return v_id;
end;
$$;

-- After "more info": the requester edits and resubmits. p: {about?, category?, proof_path?, proof_url?}
create function private.resubmit_society(p_society uuid, p jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  r public.society_requests;
  v_path text := nullif(btrim(coalesce(p->>'proof_path', '')), '');
begin
  select * into r from public.society_requests x
   where x.society_id = p_society and x.requester_id = v_me and x.status = 'more_info' for update;
  if not found then
    raise exception 'nothing to resubmit' using errcode = 'P0002';
  end if;
  if v_path is not null and (split_part(v_path, '/', 1) <> v_me::text
      or not exists (select 1 from storage.objects o where o.bucket_id = 'society-documents' and o.name = v_path)) then
    raise exception 'upload the proof again' using errcode = '22023';
  end if;
  update public.societies
     set about = coalesce(nullif(btrim(coalesce(p->>'about', '')), ''), about),
         category = coalesce(nullif(p->>'category', ''), category),
         status = 'pending', status_reason = null
   where id = p_society;
  update public.society_requests
     set status = 'pending', proof_path = coalesce(v_path, proof_path),
         proof_url = coalesce(nullif(btrim(coalesce(p->>'proof_url', '')), ''), proof_url),
         claimed_by = null, claimed_at = null
   where id = r.id;
end;
$$;

create function private.my_society_requests()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'society_id', s.id, 'slug', s.slug, 'name', s.name, 'status', r.status, 'reason', s.status_reason,
           'created_at', r.created_at, 'updated_at', r.updated_at,
           'review_days', private.society_limit('review_days'))
           order by r.created_at desc), '[]'::jsonb)
    from public.society_requests r join public.societies s on s.id = r.society_id
   where r.requester_id = (select auth.uid());
$$;

-- Logo and cover, uploaded by the server action as the officer or requester.
create function private.set_society_images(p_society uuid, p_logo text, p_cover text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  s public.societies;
begin
  select * into s from public.societies where id = p_society for update;
  if not found or not (private.is_society_officer(p_society) or (s.created_by = v_me and s.status in ('pending', 'more_info'))) then
    raise exception 'society not found' using errcode = 'P0002';
  end if;
  if (p_logo is not null and (split_part(p_logo, '/', 1) <> p_society::text
        or not exists (select 1 from storage.objects o where o.bucket_id = 'society-media' and o.name = p_logo)))
     or (p_cover is not null and (split_part(p_cover, '/', 1) <> p_society::text
        or not exists (select 1 from storage.objects o where o.bucket_id = 'society-media' and o.name = p_cover))) then
    raise exception 'upload the image again' using errcode = '22023';
  end if;
  update public.societies set logo_path = coalesce(p_logo, logo_path), cover_path = coalesce(p_cover, cover_path) where id = p_society;
end;
$$;

-- p: {about?, category?}
create function private.update_society(p_society uuid, p jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_society_officer(p_society);
  update public.societies
     set about = coalesce(nullif(btrim(coalesce(p->>'about', '')), ''), about),
         category = coalesce(nullif(p->>'category', ''), category)
   where id = p_society;
end;
$$;

create function private.set_membership_mode(p_society uuid, p_mode text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_society_officer(p_society);
  if p_mode not in ('open', 'request', 'inductions') then
    raise exception 'unknown membership mode' using errcode = '22023';
  end if;
  update public.societies set membership_mode = p_mode where id = p_society;
end;
$$;

-- ---------------------------------------------------------------------------
-- Directory and page
-- ---------------------------------------------------------------------------
create function private.societies_directory(p_query text default null, p_category text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_uni uuid := private.current_university_id();
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
begin
  return jsonb_build_object(
    'university', (select name from public.universities where id = v_uni),
    'items', coalesce((
      select jsonb_agg(private.society_card(s.id) || jsonb_build_object(
               'following', exists (select 1 from public.society_follows f where f.society_id = s.id and f.user_id = v_me),
               'member', exists (select 1 from public.society_members m where m.society_id = s.id and m.user_id = v_me))
             order by (s.university_id = v_uni) desc, s.name)
        from (select x.* from public.societies x
               where x.status = 'verified'
                 and (v_q is null or x.name ilike '%' || replace(replace(v_q, '%', ''), '_', '') || '%')
                 and (p_category is null or p_category = '' or x.category = p_category)
               order by (x.university_id = v_uni) desc, x.name
               limit 200) s), '[]'::jsonb),
    'mine', private.my_society_requests());
end;
$$;

create function private.society_page(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  s public.societies;
  v_officer boolean;
  v_president boolean;
  m public.society_members;
begin
  select * into s from public.societies where slug = p_slug;
  if not found or not private.can_see_society(s.id) then
    raise exception 'society not found' using errcode = 'P0002';
  end if;
  v_officer := private.is_society_officer(s.id);
  v_president := private.is_society_president(s.id);
  select * into m from public.society_members x where x.society_id = s.id and x.user_id = v_me;
  return private.society_card(s.id) || jsonb_build_object(
    'status_reason', case when v_officer or s.created_by = v_me then s.status_reason end,
    'officer', v_officer,
    'president', v_president,
    'my_role', m.role,
    'my_team', m.team_title,
    'following', exists (select 1 from public.society_follows f where f.society_id = s.id and f.user_id = v_me),
    'join_requested', exists (select 1 from public.society_join_requests j where j.society_id = s.id and j.user_id = v_me),
    'roll_call', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', x.user_id, 'name', p.full_name, 'username', p.username, 'avatar_path', p.avatar_path,
                                          'role', x.role, 'title', coalesce(x.title, initcap(x.role::text)))
                       order by (x.role = 'president') desc, x.joined_at)
        from public.society_members x join public.profiles p on p.user_id = x.user_id
       where x.society_id = s.id and x.role in ('president', 'officer')), '[]'::jsonb),
    'former', coalesce((
      select jsonb_agg(jsonb_build_object('name', p.full_name, 'username', p.username,
                                          'title', 'Former ' || t.title, 'term_start', t.term_start, 'term_end', t.term_end)
                       order by t.term_end desc)
        from public.society_terms t join public.profiles p on p.user_id = t.user_id
       where t.society_id = s.id and t.ended_at is not null), '[]'::jsonb),
    'rounds', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'title', r.title, 'deadline', r.deadline, 'status', r.status,
                                          'seats', (select coalesce(sum(ro.seats - ro.filled), 0) from public.induction_roles ro where ro.round_id = r.id))
                       order by r.deadline)
        from public.induction_rounds r
       where r.society_id = s.id and (r.status = 'open' or (v_officer and r.status = 'draft'))), '[]'::jsonb),
    'checklist', case when v_officer then jsonb_build_object(
        'logo', s.logo_path is not null,
        'officers', (select count(*) from public.society_members x where x.society_id = s.id and x.role in ('president', 'officer')) > 1
                    or exists (select 1 from public.society_invites i where i.society_id = s.id and i.kind = 'officer' and i.status = 'pending'),
        'mode', s.membership_mode <> 'request' or s.updated_at > s.verified_at,
        'event', false) end);
end;
$$;

-- The officers' view: members, requests, invites, terms.
create function private.society_manage(p_society uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.societies;
begin
  s := private.require_society_officer(p_society);
  return private.society_card(s.id) || jsonb_build_object(
    'president', private.is_society_president(s.id),
    'paid_paused', s.paid_paused,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', p.full_name, 'username', p.username,
                                          'role', m.role, 'title', m.title, 'team_title', m.team_title, 'joined_at', m.joined_at)
                       order by m.role, m.joined_at)
        from public.society_members m join public.profiles p on p.user_id = m.user_id where m.society_id = s.id), '[]'::jsonb),
    'join_requests', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', j.user_id, 'name', p.full_name, 'username', p.username, 'created_at', j.created_at)
                       order by j.created_at)
        from public.society_join_requests j join public.profiles p on p.user_id = j.user_id where j.society_id = s.id), '[]'::jsonb),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'kind', i.kind, 'name', p.full_name, 'username', p.username,
                                          'title', i.title, 'term_start', i.term_start, 'term_end', i.term_end, 'created_at', i.created_at)
                       order by i.created_at)
        from public.society_invites i join public.profiles p on p.user_id = i.invitee_id
       where i.society_id = s.id and i.status = 'pending'), '[]'::jsonb),
    'terms', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'user_id', t.user_id, 'name', p.full_name, 'role', t.role, 'title', t.title,
                                          'term_start', t.term_start, 'term_end', t.term_end, 'ended_at', t.ended_at,
                                          'confirmed_at', t.confirmed_at, 'due', t.term_end < current_date and t.confirmed_at is null,
                                          'can_confirm', t.confirmed_at is null and t.term_end <= current_date
                                                         and t.user_id <> (select auth.uid())
                                                         and (private.is_society_president(s.id) or t.role = 'president'))
                       order by t.term_end)
        from public.society_terms t join public.profiles p on p.user_id = t.user_id where t.society_id = s.id), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- Follow, join, leave
-- ---------------------------------------------------------------------------
create function private.follow_society(p_society uuid, p_on boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
begin
  if not exists (select 1 from public.societies s where s.id = p_society and s.status = 'verified') then
    raise exception 'society not found' using errcode = 'P0002';
  end if;
  if p_on then
    insert into public.society_follows (society_id, user_id) values (p_society, v_me) on conflict do nothing;
  else
    delete from public.society_follows where society_id = p_society and user_id = v_me;
  end if;
end;
$$;

-- Returns member | requested.
create function private.join_society(p_society uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  s public.societies;
begin
  select * into s from public.societies where id = p_society;
  if not found or s.status <> 'verified' then
    raise exception 'society not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = v_me and p.role = 'student' and p.university_id = s.university_id) then
    raise exception 'only students at this university can join' using errcode = '42501';
  end if;
  if exists (select 1 from public.society_members m where m.society_id = p_society and m.user_id = v_me) then
    return 'member';
  end if;
  if s.membership_mode = 'inductions' then
    raise exception 'this society takes members through induction rounds; apply to an open round' using errcode = '55000';
  end if;
  if s.membership_mode = 'open' then
    insert into public.society_members (society_id, user_id) values (p_society, v_me);
    insert into public.society_follows (society_id, user_id) values (p_society, v_me) on conflict do nothing;
    return 'member';
  end if;
  insert into public.society_join_requests (society_id, user_id) values (p_society, v_me) on conflict do nothing;
  perform private.notify_society_officers(p_society, v_me, 'society_join_request', 'society', p_society, jsonb_build_object('society', s.name, 'slug', s.slug));
  return 'requested';
end;
$$;

create function private.decide_join_request(p_society uuid, p_user uuid, p_accept boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.societies;
begin
  s := private.require_society_officer(p_society);
  delete from public.society_join_requests where society_id = p_society and user_id = p_user;
  if not found then
    raise exception 'that request is gone' using errcode = 'P0002';
  end if;
  if p_accept then
    insert into public.society_members (society_id, user_id) values (p_society, p_user) on conflict do nothing;
    insert into public.society_follows (society_id, user_id) values (p_society, p_user) on conflict do nothing;
    perform private.notify(p_user, (select auth.uid()), 'society_joined', 'society', p_society, jsonb_build_object('society', s.name, 'slug', s.slug));
  end if;
end;
$$;

create function private.leave_society(p_society uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
begin
  if private.is_society_president(p_society) then
    raise exception 'hand the presidency over before you leave' using errcode = '55000';
  end if;
  update public.society_terms set ended_at = now(), term_end = least(term_end, current_date)
   where society_id = p_society and user_id = v_me and ended_at is null;
  delete from public.society_members where society_id = p_society and user_id = v_me;
  if not found then
    raise exception 'you aren''t a member' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Officers, handover, terms
-- ---------------------------------------------------------------------------
create function private.invite_officer(p_society uuid, p_username text, p_title text, p_term_start date, p_term_end date)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.societies;
  v_user uuid;
  v_id uuid;
begin
  s := private.require_society_officer(p_society, true);
  if s.status <> 'verified' then
    raise exception 'officers join once the society is verified' using errcode = '55000';
  end if;
  select p.user_id into v_user from public.profiles p
   where lower(p.username) = lower(btrim(coalesce(p_username, ''))) and p.role = 'student' and p.university_id = s.university_id;
  if v_user is null then
    raise exception 'no student with that username at this university' using errcode = 'P0002';
  end if;
  if private.is_society_officer(p_society, v_user) then
    raise exception 'they are already an officer' using errcode = '23505';
  end if;
  if p_term_start is null or p_term_end is null or p_term_end < p_term_start or p_term_end > p_term_start + interval '2 years' then
    raise exception 'a term runs from a start month to an end month, up to 2 years' using errcode = '22023';
  end if;
  if (select count(*) from public.society_members m where m.society_id = p_society and m.role in ('president', 'officer'))
     + (select count(*) from public.society_invites i where i.society_id = p_society and i.kind = 'officer' and i.status = 'pending')
     >= private.society_limit('max_officers') then
    raise exception 'a society has at most % officers', private.society_limit('max_officers') using errcode = '23514';
  end if;
  insert into public.society_invites (society_id, kind, invitee_id, invited_by, title, term_start, term_end)
  values (p_society, 'officer', v_user, (select auth.uid()), btrim(p_title), p_term_start, p_term_end)
  returning id into v_id;
  perform private.notify(v_user, (select auth.uid()), 'society_invite', 'society', p_society,
                         jsonb_build_object('society', s.name, 'slug', s.slug, 'kind', 'officer', 'title', btrim(p_title), 'invite_id', v_id));
  return v_id;
end;
$$;

-- The president offers the presidency to an officer or member.
create function private.offer_handover(p_society uuid, p_username text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.societies;
  v_user uuid;
  v_id uuid;
begin
  s := private.require_society_officer(p_society, true);
  select m.user_id into v_user from public.society_members m join public.profiles p on p.user_id = m.user_id
   where m.society_id = p_society and lower(p.username) = lower(btrim(coalesce(p_username, ''))) and m.role <> 'president';
  if v_user is null then
    raise exception 'pick an officer or member of this society' using errcode = 'P0002';
  end if;
  update public.society_invites set status = 'withdrawn', answered_at = now()
   where society_id = p_society and kind = 'handover' and status = 'pending';
  insert into public.society_invites (society_id, kind, invitee_id, invited_by)
  values (p_society, 'handover', v_user, (select auth.uid())) returning id into v_id;
  perform private.notify(v_user, (select auth.uid()), 'society_invite', 'society', p_society,
                         jsonb_build_object('society', s.name, 'slug', s.slug, 'kind', 'handover', 'invite_id', v_id));
  return v_id;
end;
$$;

create function private.answer_society_invite(p_invite uuid, p_accept boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  i public.society_invites;
  s public.societies;
  v_old uuid;
begin
  select * into i from public.society_invites where id = p_invite and invitee_id = v_me and status = 'pending' for update;
  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;
  select * into s from public.societies where id = i.society_id for update;
  if s.status <> 'verified' then
    raise exception 'this society isn''t active' using errcode = '55000';
  end if;
  update public.society_invites set status = case when p_accept then 'accepted' else 'declined' end, answered_at = now() where id = i.id;
  if p_accept and i.kind = 'officer' then
    insert into public.society_members (society_id, user_id, role, title) values (i.society_id, v_me, 'officer', i.title)
    on conflict (society_id, user_id) do update set role = 'officer', title = excluded.title;
    insert into public.society_follows (society_id, user_id) values (i.society_id, v_me) on conflict do nothing;
    insert into public.society_terms (society_id, user_id, role, title, term_start, term_end)
    values (i.society_id, v_me, 'officer', i.title, i.term_start, i.term_end);
  elsif p_accept and i.kind = 'handover' then
    select m.user_id into v_old
      from public.society_members m where m.society_id = i.society_id and m.role = 'president' for update;
    -- The old president's term ends and they stay on as a member ("Former President, <term>").
    update public.society_terms set ended_at = now(), term_end = least(term_end, current_date)
     where society_id = i.society_id and user_id = v_old and ended_at is null;
    update public.society_members set role = 'member', title = null where society_id = i.society_id and user_id = v_old;
    update public.society_terms set ended_at = now(), term_end = least(term_end, current_date)
     where society_id = i.society_id and user_id = v_me and ended_at is null;
    insert into public.society_members (society_id, user_id, role, title) values (i.society_id, v_me, 'president', 'President')
    on conflict (society_id, user_id) do update set role = 'president', title = 'President';
    insert into public.society_terms (society_id, user_id, role, title, term_start, term_end)
    values (i.society_id, v_me, 'president', 'President', current_date, (current_date + interval '1 year')::date);
  end if;
  perform private.notify(i.invited_by, v_me, 'society_invite_answered', 'society', i.society_id,
                         jsonb_build_object('society', s.name, 'slug', s.slug, 'kind', i.kind, 'accepted', p_accept));
end;
$$;

create function private.my_society_invites()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'kind', i.kind, 'title', i.title, 'society', s.name, 'slug', s.slug,
                                               'term_start', i.term_start, 'term_end', i.term_end, 'created_at', i.created_at)
                            order by i.created_at desc), '[]'::jsonb)
    from public.society_invites i join public.societies s on s.id = i.society_id
   where i.invitee_id = (select auth.uid()) and i.status = 'pending';
$$;

create function private.remove_officer(p_society uuid, p_user uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_society_officer(p_society, true);
  if private.is_society_president(p_society, p_user) then
    raise exception 'hand the presidency over instead' using errcode = '55000';
  end if;
  update public.society_members set role = 'member', title = null where society_id = p_society and user_id = p_user and role = 'officer';
  if not found then
    raise exception 'they aren''t an officer' using errcode = 'P0002';
  end if;
  update public.society_terms set ended_at = now(), term_end = least(term_end, current_date)
   where society_id = p_society and user_id = p_user and ended_at is null;
end;
$$;

-- The president confirms an officer's term once it has ended; the president's own term is confirmed
-- by another officer. Stored for phase 16, which issues the Office bearer entry.
create function private.confirm_term(p_term uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  t public.society_terms;
begin
  select * into t from public.society_terms where id = p_term for update;
  if not found or not private.is_society_officer(t.society_id) then
    raise exception 'term not found' using errcode = 'P0002';
  end if;
  if t.user_id = v_me then
    raise exception 'another officer confirms your own term' using errcode = '42501';
  end if;
  if t.role <> 'president' and not private.is_society_president(t.society_id) then
    raise exception 'the president confirms officers'' terms' using errcode = '42501';
  end if;
  if t.term_end > current_date then
    raise exception 'confirm a term once it has ended' using errcode = '55000';
  end if;
  if t.confirmed_at is not null then
    return;
  end if;
  update public.society_terms set confirmed_by = v_me, confirmed_at = now() where id = p_term;
end;
$$;

-- ---------------------------------------------------------------------------
-- Induction rounds
-- ---------------------------------------------------------------------------
-- p: {id?, title, description?, deadline, roles: [{title, seats, skill_ids?}], questions: [text]}
create function private.save_induction_round(p_society uuid, p jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.societies;
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_deadline timestamptz;
  v_roles jsonb := coalesce(p->'roles', '[]'::jsonb);
  v_questions jsonb := coalesce(p->'questions', '[]'::jsonb);
  r jsonb;
  i integer := 0;
begin
  s := private.require_society_officer(p_society);
  if s.status <> 'verified' then
    raise exception 'induction rounds open once the society is verified' using errcode = '55000';
  end if;
  begin
    v_deadline := (p->>'deadline')::timestamptz;
  exception when others then
    raise exception 'pick a deadline' using errcode = '22023';
  end;
  if v_deadline is null or v_deadline <= now() or v_deadline > now() + make_interval(days => private.society_limit('induction_max_days')) then
    raise exception 'the deadline is within the next % days', private.society_limit('induction_max_days') using errcode = '22023';
  end if;
  if jsonb_typeof(v_roles) <> 'array' or jsonb_array_length(v_roles) not between 1 and 10 then
    raise exception 'a round has 1 to 10 roles' using errcode = '22023';
  end if;
  if jsonb_typeof(v_questions) <> 'array' or jsonb_array_length(v_questions) > private.society_limit('induction_questions') then
    raise exception 'up to % questions', private.society_limit('induction_questions') using errcode = '22023';
  end if;
  if v_id is null then
    insert into public.induction_rounds (society_id, title, description, deadline, created_by)
    values (p_society, btrim(coalesce(p->>'title', '')), nullif(btrim(coalesce(p->>'description', '')), ''), v_deadline, (select auth.uid()))
    returning id into v_id;
  else
    update public.induction_rounds set title = btrim(coalesce(p->>'title', '')), description = nullif(btrim(coalesce(p->>'description', '')), ''),
           deadline = v_deadline
     where id = v_id and society_id = p_society and status = 'draft';
    if not found then
      raise exception 'only a draft round can change' using errcode = '55000';
    end if;
    delete from public.induction_roles where round_id = v_id;
    delete from public.induction_questions where round_id = v_id;
  end if;
  for r in select value from jsonb_array_elements(v_roles) loop
    i := i + 1;
    insert into public.induction_roles (round_id, title, seats, skill_ids, position)
    values (v_id, btrim(coalesce(r->>'title', '')), coalesce((r->>'seats')::smallint, 1),
            coalesce(array(select jsonb_array_elements_text(coalesce(r->'skill_ids', '[]'::jsonb))), '{}'), i);
  end loop;
  i := 0;
  for r in select value from jsonb_array_elements(v_questions) loop
    i := i + 1;
    insert into public.induction_questions (round_id, position, body) values (v_id, i, btrim(r #>> '{}'));
  end loop;
  return v_id;
end;
$$;

create function private.publish_induction_round(p_round uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r public.induction_rounds;
  s public.societies;
begin
  select * into r from public.induction_rounds where id = p_round for update;
  if not found then
    raise exception 'round not found' using errcode = 'P0002';
  end if;
  s := private.require_society_officer(r.society_id);
  if r.status <> 'draft' then
    raise exception 'this round is already published' using errcode = '55000';
  end if;
  if r.deadline <= now() then
    raise exception 'move the deadline into the future first' using errcode = '55000';
  end if;
  update public.induction_rounds set status = 'open', published_at = now() where id = p_round;
  perform private.notify(x.user_id, (select auth.uid()), 'induction_published', 'induction_round', p_round,
                         jsonb_build_object('society', s.name, 'slug', s.slug, 'round', r.title, 'deadline', r.deadline))
     from (select f.user_id from public.society_follows f where f.society_id = s.id
           union select m.user_id from public.society_members m where m.society_id = s.id) x
    where x.user_id <> (select auth.uid());
end;
$$;

create function private.induction_round_page(p_round uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  r public.induction_rounds;
  v_officer boolean;
begin
  select * into r from public.induction_rounds where id = p_round;
  if not found or not private.can_see_society(r.society_id) then
    raise exception 'round not found' using errcode = 'P0002';
  end if;
  v_officer := private.is_society_officer(r.society_id);
  if r.status = 'draft' and not v_officer then
    raise exception 'round not found' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'id', r.id, 'title', r.title, 'description', r.description, 'deadline', r.deadline, 'status', r.status,
    'closed', r.status = 'closed' or r.deadline <= now(),
    'society', private.society_card(r.society_id),
    'officer', v_officer,
    'roles', coalesce((select jsonb_agg(jsonb_build_object('id', ro.id, 'title', ro.title, 'seats', ro.seats, 'filled', ro.filled,
                                                           'skill_ids', ro.skill_ids) order by ro.position)
                         from public.induction_roles ro where ro.round_id = r.id), '[]'::jsonb),
    'questions', coalesce((select jsonb_agg(q.body order by q.position) from public.induction_questions q where q.round_id = r.id), '[]'::jsonb),
    'mine', (select jsonb_build_object('id', a.id, 'status', a.status, 'note', a.note, 'role_id', a.role_id, 'created_at', a.created_at)
               from public.induction_applications a where a.round_id = r.id and a.applicant_id = v_me),
    'applications', case when v_officer then coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'name', p.full_name, 'username', p.username, 'role_id', a.role_id,
                                          'answers', a.answers, 'status', a.status, 'note', a.note, 'created_at', a.created_at)
                       order by a.created_at)
        from public.induction_applications a join public.profiles p on p.user_id = a.applicant_id where a.round_id = r.id), '[]'::jsonb) end);
end;
$$;

-- p: {role_id, answers: [text]}
create function private.apply_induction(p_round uuid, p jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  r public.induction_rounds;
  s public.societies;
  v_answers jsonb := coalesce(p->'answers', '[]'::jsonb);
  v_questions integer;
  v_id uuid;
begin
  select * into r from public.induction_rounds where id = p_round;
  if not found or r.status <> 'open' or not private.can_see_society(r.society_id) then
    raise exception 'round not found' using errcode = 'P0002';
  end if;
  select * into s from public.societies where id = r.society_id;
  if r.deadline <= now() then
    raise exception 'this round has closed' using errcode = '55000';
  end if;
  if not exists (select 1 from public.profiles pr where pr.user_id = v_me and pr.role = 'student' and pr.university_id = s.university_id) then
    raise exception 'only students at this university can apply' using errcode = '42501';
  end if;
  if not exists (select 1 from public.induction_roles ro where ro.id = (p->>'role_id')::uuid and ro.round_id = p_round) then
    raise exception 'pick a role' using errcode = '22023';
  end if;
  select count(*) into v_questions from public.induction_questions q where q.round_id = p_round;
  if jsonb_typeof(v_answers) <> 'array' or jsonb_array_length(v_answers) <> v_questions
     or exists (select 1 from jsonb_array_elements_text(v_answers) a where char_length(btrim(a)) not between 1 and 1000) then
    raise exception 'answer every question (up to 1,000 characters each)' using errcode = '22023';
  end if;
  if exists (select 1 from public.induction_applications a where a.round_id = p_round and a.applicant_id = v_me) then
    raise exception 'you''ve already applied to this round' using errcode = '23505';
  end if;
  insert into public.induction_applications (round_id, role_id, applicant_id, answers)
  values (p_round, (p->>'role_id')::uuid, v_me, v_answers) returning id into v_id;
  perform private.notify_society_officers(s.id, v_me, 'induction_applied', 'induction_round', p_round,
                                          jsonb_build_object('society', s.name, 'slug', s.slug, 'round', r.title, 'round_id', p_round));
  return v_id;
end;
$$;

-- p_action: shortlist | accept | decline
create function private.decide_induction_application(p_application uuid, p_action text, p_note text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.induction_applications;
  r public.induction_rounds;
  ro public.induction_roles;
  s public.societies;
begin
  select * into a from public.induction_applications where id = p_application for update;
  if not found then
    raise exception 'application not found' using errcode = 'P0002';
  end if;
  select * into r from public.induction_rounds where id = a.round_id;
  s := private.require_society_officer(r.society_id);
  if a.status in ('accepted', 'declined') then
    raise exception 'already decided' using errcode = '55000';
  end if;
  if p_action = 'shortlist' then
    update public.induction_applications set status = 'shortlisted' where id = a.id;
    return;
  end if;
  if p_action not in ('accept', 'decline') then
    raise exception 'unknown action' using errcode = '22023';
  end if;
  if p_action = 'accept' then
    -- Seats are counted under the role's row lock.
    select * into ro from public.induction_roles where id = a.role_id for update;
    if ro.filled >= ro.seats then
      raise exception 'this role is full' using errcode = '23514';
    end if;
    update public.induction_roles set filled = filled + 1 where id = ro.id;
    insert into public.society_members (society_id, user_id, team_title) values (s.id, a.applicant_id, ro.title)
    on conflict (society_id, user_id) do update set team_title = excluded.team_title;
    insert into public.society_follows (society_id, user_id) values (s.id, a.applicant_id) on conflict do nothing;
  end if;
  update public.induction_applications
     set status = case p_action when 'accept' then 'accepted' else 'declined' end,
         note = nullif(btrim(coalesce(p_note, '')), ''), decided_by = (select auth.uid()), decided_at = now()
   where id = a.id;
  perform private.notify(a.applicant_id, (select auth.uid()), 'induction_decided', 'induction_round', r.id,
                         jsonb_build_object('society', s.name, 'slug', s.slug, 'round', r.title, 'accepted', p_action = 'accept',
                                            'team', ro.title, 'note', nullif(btrim(coalesce(p_note, '')), '')));
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff: the verification queue (trust reviewers), audited before and after
-- ---------------------------------------------------------------------------
create function private.ops_societies(p_status text default 'open')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_trust_reviewer();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'society_id', s.id, 'name', s.name, 'slug', s.slug, 'category', s.category, 'university', u.name,
             'status', s.status, 'request_status', r.status, 'requester', p.full_name, 'created_at', r.created_at,
             'age_hours', floor(extract(epoch from now() - r.created_at) / 3600),
             'claimed_by', c.full_name, 'mine', r.claimed_by = v_me)
             order by r.created_at)
      from public.society_requests r
      join public.societies s on s.id = r.society_id
      join public.universities u on u.id = s.university_id
      join public.profiles p on p.user_id = r.requester_id
      left join public.profiles c on c.user_id = r.claimed_by
     where case p_status when 'open' then r.status = 'pending' when 'more_info' then r.status = 'more_info'
                         when 'decided' then r.status in ('approved', 'rejected') else true end
     limit 200), '[]'::jsonb);
end;
$$;

create function private.ops_society_case(p_society uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_trust_reviewer();
  r public.society_requests;
begin
  select * into r from public.society_requests where society_id = p_society order by created_at desc limit 1;
  if not found then
    raise exception 'society not found' using errcode = 'P0002';
  end if;
  return private.society_card(p_society) || jsonb_build_object(
    'request_id', r.id, 'request_status', r.status, 'proof_path', r.proof_path, 'proof_url', r.proof_url,
    'office_bearer', r.office_bearer, 'staff_note', r.staff_note, 'created_at', r.created_at,
    'claimed_by', (select full_name from public.profiles where user_id = r.claimed_by), 'mine', r.claimed_by = v_me,
    'requester', (select jsonb_build_object('name', p.full_name, 'username', p.username, 'department', p.department, 'graduation_year', p.graduation_year)
                    from public.profiles p where p.user_id = r.requester_id),
    'status_reason', (select status_reason from public.societies where id = p_society));
end;
$$;

create function private.claim_society(p_society uuid, p_claim boolean default true)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_trust_reviewer();
  r public.society_requests;
begin
  select * into r from public.society_requests where society_id = p_society and status = 'pending' for update;
  if not found then
    raise exception 'nothing to claim' using errcode = 'P0002';
  end if;
  if r.claimed_by is not null and r.claimed_by <> v_me then
    raise exception 'someone else is reviewing this' using errcode = '55000';
  end if;
  update public.society_requests
     set claimed_by = case when p_claim then v_me end, claimed_at = case when p_claim then now() end
   where id = r.id;
  insert into public.ops_audit_log (staff_id, action, target_type, target_id, reason, before, after)
  values (v_me, case when p_claim then 'society.claim' else 'society.release' end, 'society', p_society::text,
          case when p_claim then 'claim society request' else 'release society request' end,
          jsonb_build_object('claimed_by', r.claimed_by), jsonb_build_object('claimed_by', case when p_claim then v_me end));
end;
$$;

-- p_action: approve | more_info | reject | suspend | reinstate | pause_paid | resume_paid
create function private.decide_society(p_society uuid, p_action text, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_trust_reviewer();
  s public.societies;
  r public.society_requests;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_to public.society_status;
begin
  select * into s from public.societies where id = p_society for update;
  if not found then
    raise exception 'society not found' using errcode = 'P0002';
  end if;
  select * into r from public.society_requests where society_id = p_society order by created_at desc limit 1 for update;
  if p_action in ('more_info', 'reject', 'suspend', 'pause_paid') and char_length(coalesce(v_reason, '')) < 3 then
    raise exception 'give a reason the society can read' using errcode = '22023';
  end if;
  if p_action in ('pause_paid', 'resume_paid') then
    if s.status <> 'verified' then
      raise exception 'only a verified society sells tickets' using errcode = '55000';
    end if;
    update public.societies set paid_paused = (p_action = 'pause_paid') where id = p_society;
    insert into public.ops_audit_log (staff_id, action, target_type, target_id, reason, before, after)
    values (v_me, 'society.' || p_action, 'society', p_society::text, coalesce(v_reason, p_action),
            jsonb_build_object('paid_paused', s.paid_paused), jsonb_build_object('paid_paused', p_action = 'pause_paid'));
    return;
  end if;
  v_to := case p_action when 'approve' then 'verified' when 'more_info' then 'more_info' when 'reject' then 'rejected'
                        when 'suspend' then 'suspended' when 'reinstate' then 'verified' end;
  if v_to is null then
    raise exception 'unknown action' using errcode = '22023';
  end if;
  if (p_action in ('approve', 'more_info', 'reject') and s.status <> 'pending')
     or (p_action = 'suspend' and s.status <> 'verified')
     or (p_action = 'reinstate' and s.status <> 'suspended') then
    raise exception 'this society is % and can''t do that', s.status using errcode = '55000';
  end if;
  update public.societies
     set status = v_to, status_reason = v_reason,
         verified_by = case when p_action = 'approve' then v_me else verified_by end,
         verified_at = case when p_action = 'approve' then now() else verified_at end
   where id = p_society;
  if p_action in ('approve', 'more_info', 'reject') and r.id is not null then
    update public.society_requests
       set status = case p_action when 'approve' then 'approved' when 'reject' then 'rejected' else 'more_info' end,
           staff_note = v_reason, decided_at = case when p_action <> 'more_info' then now() end
     where id = r.id;
  end if;
  if p_action = 'approve' then
    -- The requester opens the society as its President.
    insert into public.society_members (society_id, user_id, role, title) values (p_society, r.requester_id, 'president', 'President')
    on conflict (society_id, user_id) do update set role = 'president', title = 'President';
    insert into public.society_follows (society_id, user_id) values (p_society, r.requester_id) on conflict do nothing;
    insert into public.society_terms (society_id, user_id, role, title, term_start, term_end)
    values (p_society, r.requester_id, 'president', 'President', current_date, (current_date + interval '1 year')::date)
    on conflict do nothing;
  end if;
  insert into public.ops_audit_log (staff_id, action, target_type, target_id, reason, before, after)
  values (v_me, 'society.' || p_action, 'society', p_society::text, coalesce(v_reason, p_action || ' society'),
          jsonb_build_object('status', s.status, 'request_status', r.status), jsonb_build_object('status', v_to));
  if r.requester_id is not null then
    perform private.notify(r.requester_id, null, 'society_decided', 'society', p_society,
                           jsonb_build_object('society', s.name, 'slug', s.slug, 'status', v_to, 'reason', v_reason));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Posts as the society; event posts are officer-only
-- ---------------------------------------------------------------------------
create or replace function private.create_post(p jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_uni uuid;
  v_type public.post_type;
  v_audience public.post_audience;
  v_body text := btrim(coalesce(p->>'body', ''));
  v_media jsonb := coalesce(p->'media', '[]'::jsonb);
  v_venture public.ventures;
  v_society public.societies;
  v_id uuid;
  v_pin timestamptz;
  v_options jsonb;
  v_starts timestamptz;
  i integer;
begin
  if v_me is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  select pr.university_id into v_uni from public.profiles pr where pr.user_id = v_me and pr.onboarding_complete;
  if not found then
    raise exception 'finish setting up your account first' using errcode = '42501';
  end if;
  begin
    v_type := (p->>'type')::public.post_type;
    v_audience := coalesce(p->>'audience', 'university')::public.post_audience;
  exception when invalid_text_representation then
    raise exception 'unknown post type or audience' using errcode = '22023';
  end;
  if v_type = 'shipped' then
    raise exception 'Shipped posts are created when a venture completes' using errcode = '42501';
  end if;
  if char_length(v_body) not between 1 and 2000 then
    raise exception 'posts are 1 to 2,000 characters' using errcode = '23514';
  end if;
  perform private.check_media(v_media);
  if jsonb_array_length(v_media) > 0 and v_type not in ('general', 'invite', 'event') then
    raise exception 'images go on general, invite and event posts' using errcode = '22023';
  end if;

  -- Posting as a society (phase 15): officers of a verified society, to its university feed.
  if nullif(p->>'society_id', '') is not null then
    select * into v_society from public.societies s where s.id = (p->>'society_id')::uuid;
    if not found or v_society.status <> 'verified' or not private.is_society_officer(v_society.id) then
      raise exception 'only officers post as a society' using errcode = '42501';
    end if;
    if v_type not in ('general', 'event', 'poll') then
      raise exception 'a society posts general, event or poll posts' using errcode = '22023';
    end if;
    v_audience := 'university';
    v_uni := v_society.university_id;
  end if;
  -- Students can't create events; only societies do (PRD 5.31).
  if v_type = 'event' and v_society.id is null then
    raise exception 'only society officers post events' using errcode = '42501';
  end if;

  if v_type = 'announcement' then
    if not private.is_staff() then
      raise exception 'only Skilient staff post announcements for now' using errcode = '42501';
    end if;
    v_audience := 'global';
    if coalesce((p->>'pin_days')::integer, 0) > 0 then
      v_pin := now() + make_interval(days => least((p->>'pin_days')::integer, 7));
    end if;
  end if;

  if v_type = 'invite' then
    select * into v_venture from public.ventures v where v.id = (p->>'venture_id')::uuid for share;
    if not found or v_venture.owner_id <> v_me then
      raise exception 'only the owner of a venture can post an invite for it' using errcode = '42501';
    end if;
    if v_venture.status not in ('recruiting', 'in_progress') then
      raise exception 'this venture isn''t taking applications' using errcode = '55000';
    end if;
    if v_venture.visibility = 'unlisted' then
      raise exception 'unlisted ventures take members by invite only' using errcode = '22023';
    end if;
    if v_venture.visibility = 'university' and v_audience = 'global' then
      raise exception 'a university-only venture can only be posted to your University Feed' using errcode = '22023';
    end if;
  end if;

  if v_type = 'event' then
    begin
      v_starts := (p->'event'->>'starts_at')::timestamptz;
    exception when others then
      raise exception 'give the event a date and time' using errcode = '22023';
    end;
    if v_starts is null or v_starts < now() - interval '1 hour' or v_starts > now() + interval '1 year' then
      raise exception 'events start within the next year' using errcode = '22023';
    end if;
  end if;

  if v_type = 'poll' then
    v_options := p->'poll'->'options';
    if v_options is null or jsonb_typeof(v_options) <> 'array' or jsonb_array_length(v_options) not between 2 and 4 then
      raise exception 'polls have 2 to 4 options' using errcode = '23514';
    end if;
    if coalesce((p->'poll'->>'days')::integer, 0) not between 1 and 7 then
      raise exception 'polls close after 1 to 7 days' using errcode = '23514';
    end if;
  end if;

  if not private.rate_limit('post:' || v_me::text, 1, interval '30 seconds') then
    raise exception 'wait 30 seconds between posts' using errcode = '54000';
  end if;

  insert into public.posts (author_id, university_id, audience, type, body, venture_id, pinned_until, society_id)
  values (v_me, v_uni, v_audience, v_type, v_body, case when v_type = 'invite' then v_venture.id end, v_pin, v_society.id)
  returning id into v_id;

  if v_pin is not null then
    update public.posts set pinned_until = null where pinned_until is not null and id <> v_id;
  end if;

  insert into public.post_media (post_id, position, path, width, height)
  select v_id, e.ord, e.m->>'path', (e.m->>'width')::integer, (e.m->>'height')::integer
    from jsonb_array_elements(v_media) with ordinality as e(m, ord);

  if v_type = 'event' then
    insert into public.post_events (post_id, starts_at, place, url)
    values (v_id, v_starts, nullif(btrim(p->'event'->>'place'), ''), nullif(btrim(p->'event'->>'url'), ''));
  end if;
  if v_type = 'poll' then
    insert into public.post_polls (post_id, closes_at)
    values (v_id, now() + make_interval(days => (p->'poll'->>'days')::integer));
    for i in 0 .. jsonb_array_length(v_options) - 1 loop
      insert into public.poll_options (post_id, position, label) values (v_id, i + 1, btrim(v_options->>i));
    end loop;
  end if;

  if v_society.id is not null then
    perform private.notify(x.user_id, v_me, 'society_post', 'post', v_id, jsonb_build_object('society', v_society.name, 'slug', v_society.slug))
       from (select f.user_id from public.society_follows f where f.society_id = v_society.id
             union select m.user_id from public.society_members m where m.society_id = v_society.id) x
      where x.user_id <> v_me;
  end if;
  return v_id;
end;
$$;

-- The societies an officer can post as (the composer's "Post as" picker).
create function private.my_officer_societies()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug, 'logo_path', s.logo_path) order by s.name), '[]'::jsonb)
    from public.society_members m join public.societies s on s.id = m.society_id
   where m.user_id = (select auth.uid()) and m.role in ('president', 'officer') and s.status = 'verified';
$$;

-- post_cards gains the society byline (logo and name; the officer stays named in the post menu).
drop function public.post_cards(uuid[]);
drop function private.post_cards(uuid[]);
create function private.post_cards(p_ids uuid[])
returns table (
  id uuid, type public.post_type, audience public.post_audience, body text, created_at timestamptz,
  edited_at timestamptz, pinned_until timestamptz, stage public.post_stage,
  author_id uuid, author_username text, author_name text, author_avatar_path text, is_mine boolean,
  can_edit boolean, media jsonb, event jsonb, poll jsonb, venture jsonb,
  comment_count integer, link jsonb, author_muted boolean, society jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.type, p.audience, p.body, p.created_at, p.edited_at, p.pinned_until, p.stage,
         p.author_id, a.username, a.full_name,
         case when private.can_view_profile(p.author_id) then a.avatar_path end,
         p.author_id = (select auth.uid()),
         p.author_id = (select auth.uid()) and p.type <> 'shipped' and now() < p.created_at + interval '15 minutes',
         coalesce((select jsonb_agg(jsonb_build_object('path', m.path, 'width', m.width, 'height', m.height) order by m.position)
                     from public.post_media m where m.post_id = p.id), '[]'::jsonb),
         (select jsonb_build_object(
                   'starts_at', e.starts_at, 'place', e.place, 'url', e.url,
                   'going', (select count(*) from public.event_rsvps r where r.post_id = e.post_id and r.status = 'going'),
                   'interested', (select count(*) from public.event_rsvps r where r.post_id = e.post_id and r.status = 'interested'),
                   'mine', (select r.status from public.event_rsvps r where r.post_id = e.post_id and r.user_id = (select auth.uid())))
            from public.post_events e where e.post_id = p.id),
         (select jsonb_build_object(
                   'closes_at', pl.closes_at,
                   'closed', now() >= pl.closes_at,
                   'my_vote', mv.position,
                   'total', (select count(*) from public.poll_votes v where v.post_id = pl.post_id),
                   'options', (select jsonb_agg(jsonb_build_object(
                                 'position', o.position, 'label', o.label,
                                 'votes', case when mv.position is not null or now() >= pl.closes_at or p.author_id = (select auth.uid())
                                               then (select count(*) from public.poll_votes v where v.post_id = o.post_id and v.position = o.position) end)
                               order by o.position)
                                 from public.poll_options o where o.post_id = pl.post_id))
            from public.post_polls pl
            left join public.poll_votes mv on mv.post_id = pl.post_id and mv.user_id = (select auth.uid())
           where pl.post_id = p.id),
         (select case when private.can_view_venture(v.id) then jsonb_build_object(
                   'id', v.id, 'title', v.title, 'type', v.type, 'status', v.status, 'visibility', v.visibility,
                   'members', (select count(*) from public.venture_members vm where vm.venture_id = v.id),
                   'team_size', v.team_size,
                   'is_member', private.is_venture_member(v.id),
                   'my_application', (select t.status from public.application_threads t
                                       where t.venture_id = v.id and t.candidate_id = (select auth.uid())
                                       order by t.created_at desc limit 1),
                   'roles', coalesce((select jsonb_agg(jsonb_build_object('title', r.title, 'open', r.slots - r.filled) order by r.created_at)
                                        from public.venture_roles r where r.venture_id = v.id and r.filled < r.slots), '[]'::jsonb),
                   'team', case when p.type = 'shipped' then
                             coalesce((select jsonb_agg(jsonb_build_object(
                                         'name', mp.full_name,
                                         'username', case when private.can_view_profile(vm.user_id) then mp.username end)
                                       order by (vm.user_id = v.owner_id) desc, vm.joined_at)
                                         from public.venture_members vm join public.profiles mp on mp.user_id = vm.user_id
                                        where vm.venture_id = v.id and not private.is_blocked_with(vm.user_id)), '[]'::jsonb) end)
                 end
            from public.ventures v where v.id = p.venture_id),
         (select count(*)::integer from public.post_comments c
           where c.post_id = p.id and c.deleted_at is null
             and (c.author_id = (select auth.uid()) or not private.is_blocked_with(c.author_id))),
         (select jsonb_build_object('url', lp.url, 'title', lp.title, 'description', lp.description,
                                    'image_url', lp.image_url, 'site_name', lp.site_name)
            from public.link_previews lp
           where p.link_url is not null and lp.url_hash = private.url_hash(p.link_url) and lp.status = 'ok'),
         exists (select 1 from public.user_mutes m where m.user_id = (select auth.uid()) and m.muted_id = p.author_id),
         (select jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug, 'logo_path', s.logo_path)
            from public.societies s where s.id = p.society_id)
    from unnest(p_ids) with ordinality as ids(id, ord)
    join public.posts p on p.id = ids.id
    join public.profiles a on a.user_id = p.author_id
   where private.can_view_post(p.id)
   order by ids.ord;
$$;
revoke all on function private.post_cards(uuid[]) from public;
grant execute on function private.post_cards(uuid[]) to authenticated;
create function public.post_cards(p_ids uuid[])
returns table (
  id uuid, type public.post_type, audience public.post_audience, body text, created_at timestamptz,
  edited_at timestamptz, pinned_until timestamptz, stage public.post_stage,
  author_id uuid, author_username text, author_name text, author_avatar_path text, is_mine boolean,
  can_edit boolean, media jsonb, event jsonb, poll jsonb, venture jsonb,
  comment_count integer, link jsonb, author_muted boolean, society jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.post_cards(p_ids) $$;
revoke all on function public.post_cards(uuid[]) from public, anon;
grant execute on function public.post_cards(uuid[]) to authenticated;

-- The Societies chip (PRD 5.31 "Posts as the society"): build_feed and feed_page learn the filter.
CREATE OR REPLACE FUNCTION private.build_feed(p_viewer uuid, p_audience post_audience, p_filter text, p_exclude uuid[])
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  wc jsonb := coalesce(private.config('feed.window'), '{}'::jsonb);
  dc jsonb := coalesce(private.config('feed.diversity'), '{}'::jsonb);
  v_uni uuid;
  v_page integer := coalesce((dc->>'page_size')::integer, 20);
  v_same numeric := coalesce((dc->>'same_author_page')::numeric, 0.5);
  v_every integer := coalesce((wc->>'exploration_every')::integer, 5);
  v_out uuid[] := '{}';
  v_last_author uuid;
  v_page_authors jsonb := '{}'::jsonb;
  v_pick record;
  v_explore uuid;
  v_n integer;
  i integer := 0;
begin
  select university_id into v_uni from public.profiles where user_id = p_viewer;

  if to_regclass('pg_temp.feed_candidates') is null then
    create temporary table feed_candidates (id uuid primary key, author_id uuid, score numeric, stage public.post_stage, created_at timestamptz) on commit drop;
  else
    truncate pg_temp.feed_candidates;
  end if;
  insert into pg_temp.feed_candidates (id, author_id, score, stage, created_at)
  select p.id, p.author_id, private.feed_score(p.id, p_viewer), p.stage, p.created_at
    from public.posts p
   where private.can_view_post(p.id)
     and p.stage <> 'held'
     and not (p.id = any (coalesce(p_exclude, '{}')))
     and (p.pinned_until is null or p.pinned_until <= now())
     and p.created_at > now() - make_interval(days => case when p.type = 'shipped'
                                                           then coalesce((wc->>'shipped_age_days')::integer, 14)
                                                           else coalesce((wc->>'max_age_days')::integer, 7) end)
     and case p_audience when 'university' then p.university_id = v_uni else p.audience = 'global' end
     and case p_filter
           when 'ventures' then p.type = 'invite'
           when 'events' then p.type = 'event'
           when 'announcements' then p.type = 'announcement'
           when 'shipped' then p.type = 'shipped'
           when 'societies' then p.society_id is not null
           else true
         end
     and not exists (select 1 from public.post_hides h where h.user_id = p_viewer and h.post_id = p.id)
     and not exists (select 1 from public.user_mutes m where m.user_id = p_viewer and m.muted_id = p.author_id)
     -- Seed posts reach only their seed audience (plus exploration slots, below).
     and (p.stage <> 'seed' or private.in_seed_audience(p.id, p_viewer))
   order by 3 desc
   limit coalesce((wc->>'candidates')::integer, 300);

  select count(*) into v_n from pg_temp.feed_candidates;
  loop
    i := i + 1;
    -- Exploration: every 5th slot, a Seed post under 2 hours old from outside the list.
    if i % v_every = 0 then
      select p.id into v_explore
        from public.posts p
       where p.stage = 'seed'
         and p.created_at > now() - make_interval(hours => coalesce((wc->>'exploration_max_hours')::integer, 2))
         and p.author_id <> p_viewer
         and not (p.id = any (v_out)) and not (p.id = any (coalesce(p_exclude, '{}')))
         and not exists (select 1 from pg_temp.feed_candidates fc where fc.id = p.id)
         and private.can_view_post(p.id)
         and case p_audience when 'university' then p.university_id = v_uni else p.audience = 'global' end
         and (p_filter = 'all' or (p_filter = 'societies' and p.society_id is not null)
              or (p_filter <> 'societies' and p.type = case p_filter when 'ventures' then 'invite' when 'events' then 'event'
                                                          when 'announcements' then 'announcement' else 'shipped' end::public.post_type))
         and not exists (select 1 from public.post_hides h where h.user_id = p_viewer and h.post_id = p.id)
         and not exists (select 1 from public.user_mutes m where m.user_id = p_viewer and m.muted_id = p.author_id)
         and not exists (select 1 from public.post_views pv where pv.post_id = p.id and pv.user_id = p_viewer)
       order by random()
       limit 1;
      if v_explore is not null then
        v_out := v_out || v_explore;
        v_explore := null;
        continue;
      end if;
    end if;
    exit when v_n = 0;
    -- Best adjusted score, avoiding the same author twice in a row when possible.
    select fc.id, fc.author_id into v_pick
      from pg_temp.feed_candidates fc
     order by (fc.author_id = v_last_author) asc,
              fc.score * power(v_same, coalesce((v_page_authors->>fc.author_id::text)::integer, 0)) desc,
              fc.created_at desc
     limit 1;
    exit when v_pick.id is null;
    v_out := v_out || v_pick.id;
    delete from pg_temp.feed_candidates where id = v_pick.id;
    v_n := v_n - 1;
    v_last_author := v_pick.author_id;
    if array_length(v_out, 1) % v_page = 0 then
      v_page_authors := '{}'::jsonb;
    else
      v_page_authors := jsonb_set(v_page_authors, array[v_pick.author_id::text],
                                  to_jsonb(coalesce((v_page_authors->>v_pick.author_id::text)::integer, 0) + 1));
    end if;
  end loop;
  return v_out;
end;
$function$;

CREATE OR REPLACE FUNCTION private.feed_page(p_audience post_audience, p_filter text, p_cursor text, p_limit integer DEFAULT 20)
 RETURNS TABLE(post_id uuid, rank integer, next_cursor text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_me uuid := (select auth.uid());
  v_filter text := coalesce(nullif(p_filter, ''), 'all');
  v_session public.feed_sessions;
  v_minutes integer := coalesce((private.config('feed.window')->>'session_minutes')::integer, 10);
  v_sid uuid;
  v_offset integer := 0;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_ids uuid[];
  v_served uuid[];
begin
  if v_me is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if v_filter not in ('all', 'ventures', 'events', 'announcements', 'shipped', 'societies') then
    raise exception 'unknown filter' using errcode = '22023';
  end if;
  if p_cursor is not null then
    begin
      v_sid := split_part(p_cursor, ':', 1)::uuid;
      v_offset := greatest(split_part(p_cursor, ':', 2)::integer, 0);
    exception when others then
      raise exception 'bad cursor' using errcode = '22023';
    end;
    select * into v_session from public.feed_sessions
     where session_id = v_sid and user_id = v_me and audience = p_audience and filter = v_filter;
  end if;

  if v_session.session_id is not null and v_session.created_at > now() - make_interval(mins => v_minutes) then
    v_ids := v_session.post_ids;
  else
    v_served := case when v_session.session_id is not null then v_session.post_ids[1:v_offset] else '{}' end;
    if v_session.session_id is null then
      v_offset := 0;
    end if;
    v_ids := v_served || private.build_feed(v_me, p_audience, v_filter, v_served);
    insert into public.feed_sessions (user_id, audience, filter, post_ids)
    values (v_me, p_audience, v_filter, v_ids)
    returning session_id into v_sid;
    -- Keep a reader's sessions bounded.
    delete from public.feed_sessions f
     where f.user_id = v_me and f.session_id not in (
       select f2.session_id from public.feed_sessions f2 where f2.user_id = v_me order by f2.created_at desc limit 10);
  end if;

  return query
  select x.id, (v_offset + x.ord)::integer,
         case when v_offset + v_limit < coalesce(cardinality(v_ids), 0) then v_sid::text || ':' || (v_offset + v_limit)::text end
    from unnest(v_ids[v_offset + 1 : v_offset + v_limit]) with ordinality as x(id, ord)
   where private.can_view_post(x.id)
   order by x.ord;
end;
$function$;

-- ---------------------------------------------------------------------------
-- society-tick (hourly): term ends, round deadlines, undecided applications
-- ---------------------------------------------------------------------------
create function private.society_tick()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  t record;
begin
  -- A term ended: the president gets "Confirm your officers' terms" (another officer for the president's own).
  for t in
    select st.id, st.society_id, st.user_id, st.role, st.title, s.name, s.slug
      from public.society_terms st join public.societies s on s.id = st.society_id
     where st.term_end < current_date and st.confirmed_at is null and st.ended_notified_at is null and s.status = 'verified'
     limit 500
  loop
    if t.role = 'president' then
      perform private.notify(m.user_id, null, 'term_ended', 'society', t.society_id,
                             jsonb_build_object('society', t.name, 'slug', t.slug, 'title', t.title, 'term_id', t.id))
         from public.society_members m where m.society_id = t.society_id and m.role = 'officer' and m.user_id <> t.user_id;
    else
      perform private.notify(m.user_id, null, 'term_ended', 'society', t.society_id,
                             jsonb_build_object('society', t.name, 'slug', t.slug, 'title', t.title, 'term_id', t.id))
         from public.society_members m where m.society_id = t.society_id and m.role = 'president';
    end if;
    update public.society_terms set ended_notified_at = now() where id = t.id;
  end loop;
  update public.induction_rounds set status = 'closed' where status = 'open' and deadline <= now();
  -- Undecided applications are declined 14 days after the deadline, with a polite notice.
  for t in
    select r.id, r.title, s.name, s.slug from public.induction_rounds r join public.societies s on s.id = r.society_id
     where r.status = 'closed' and r.undecided_closed_at is null
       and r.deadline + make_interval(days => private.society_limit('undecided_decline_days')) <= now()
     limit 200
  loop
    perform private.notify(a.applicant_id, null, 'induction_decided', 'induction_round', t.id,
                           jsonb_build_object('society', t.name, 'slug', t.slug, 'round', t.title, 'accepted', false, 'expired', true))
       from public.induction_applications a where a.round_id = t.id and a.status in ('pending', 'shortlisted');
    update public.induction_applications set status = 'declined', decided_at = now(), note = 'The round closed before a decision.'
     where round_id = t.id and status in ('pending', 'shortlisted');
    update public.induction_rounds set undecided_closed_at = now() where id = t.id;
  end loop;
end;
$$;
revoke all on function private.society_tick() from public;
select cron.schedule('society-tick', '7 * * * *', $$select private.society_tick()$$);

-- The ops inbox gains the society requests queue (trust reviewers, 3 working days ≈ 72 hours).
create or replace function private.ops_inbox(p_queue text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_any_staff();
  v_mod boolean := private.is_staff('moderator');
  v_trust boolean := private.is_staff('trust_reviewer');
  v_acc boolean := private.is_staff('accounts');
  v_items jsonb;
  v_queues jsonb;
begin
  with items as (
    select 'reports'::text as queue, c.id::text as id, c.target_type::text as title,
           left(coalesce(c.snapshot->>'body', c.snapshot->>'bio', c.snapshot->>'title', ''), 120) as detail,
           c.opened_at as waiting_since, c.claimed_by, '/ops/reports/' || c.id as href
      from public.report_cases c
     where v_mod and c.status = 'open'
    union all
    select 'credentials', c.id::text, c.title, c.issuer, c.created_at, c.claimed_by, '/ops/evidence/credentials/' || c.id
      from public.credentials c
     where v_trust and c.status = 'pending'
    union all
    select 'github_flags', f.id::text, f.kind::text, null, f.created_at, f.claimed_by, '/ops/evidence/flags/' || f.id
      from public.review_flags f
     where v_trust and f.status = 'open'
    union all
    select 'code_checks', c.id::text, c.skill_id, null, coalesce(c.routed_to_staff_at, c.submitted_at), c.claimed_by,
           '/ops/evidence/code-checks/' || c.id
      from public.code_checks c
     where v_trust and c.status = 'submitted' and c.routed_to_staff_at is not null
    union all
    select 'ranking_flags', f.id::text, f.kind::text, null, f.created_at, f.claimed_by, '/ops/evidence/ranking/' || f.id
      from public.anti_gaming_flags f
     where v_trust and f.status = 'open'
    union all
    select 'teachers', t.user_id::text, t.title, t.department, t.requested_at, null::uuid, '/ops/teachers'
      from public.teacher_profiles t
     where (v_acc or v_trust) and t.status = 'pending'
    union all
    select 'orgs', o.id::text, o.name, o.domain, o.created_at, null::uuid, '/ops/orgs/' || o.id
      from public.organizations o
     where v_acc and o.status = 'pending'
    union all
    select 'uni_claims', c.id::text, u.name, c.title, c.created_at, null::uuid, '/ops/universities/claims/' || c.id
      from public.university_claims c
      join public.universities u on u.id = c.university_id
     where v_acc and c.status = 'pending'
    union all
    select 'uni_domains', d.id::text, u.name, d.domain, d.created_at, null::uuid, '/ops/universities'
      from public.university_domain_requests d
      join public.universities u on u.id = d.university_id
     where v_acc and d.status = 'pending'
    union all
    select 'billing_tasks', b.id::text, b.kind, b.subject_type::text, b.created_at, null::uuid, '/ops/billing#tasks-h'
      from public.billing_tasks b
     where v_acc and b.done_at is null
    union all
    select 'feedback', f.id::text, f.type::text, left(f.body, 120), f.created_at, f.claimed_by, '/ops/feedback/' || f.id
      from public.feedback f
     where f.status in ('received', 'reviewing')
    union all
    select 'appeals', a.id::text, a.decision_type::text, left(a.body, 120), a.created_at, a.claimed_by, '/ops/appeals/' || a.id
      from public.appeals a
     where a.status = 'pending' and private.is_staff(a.decider_role)
    union all
    select 'societies', s.id::text, s.name, u.name, r.created_at, r.claimed_by, '/ops/societies/' || s.id
      from public.society_requests r
      join public.societies s on s.id = r.society_id
      join public.universities u on u.id = s.university_id
     where v_trust and r.status = 'pending'
  ),
  sla(queue, hours, claimable) as (
    values ('reports', 24, true), ('credentials', 72, true), ('github_flags', 72, true), ('code_checks', 48, true),
           ('ranking_flags', 72, true), ('teachers', 72, false), ('orgs', 48, false), ('uni_claims', 72, false),
           ('uni_domains', 72, false), ('billing_tasks', 72, false), ('feedback', 168, true),
           ('appeals', 72, true), ('societies', 72, true)
  ),
  agg as (
    select i.queue, count(*)::integer as total,
           count(*) filter (where i.claimed_by is null)::integer as unclaimed,
           count(*) filter (where i.claimed_by = v_me)::integer as mine,
           count(*) filter (where i.waiting_since < now() - make_interval(hours => s.hours))::integer as overdue,
           min(i.waiting_since) as oldest
      from items i join sla s using (queue)
     group by i.queue
  )
  select
    coalesce((select jsonb_agg(jsonb_build_object(
        'queue', a.queue, 'total', a.total, 'unclaimed', a.unclaimed, 'mine', a.mine,
        'overdue', a.overdue, 'oldest', a.oldest, 'sla_hours', s.hours, 'claimable', s.claimable)
        order by a.oldest)
      from agg a join sla s using (queue)), '[]'::jsonb),
    coalesce((select jsonb_agg(x.item order by x.waiting_since) from (
      select i.waiting_since, jsonb_build_object(
               'queue', i.queue, 'id', i.id, 'title', i.title, 'detail', i.detail,
               'waiting_since', i.waiting_since, 'href', i.href, 'claimable', s.claimable,
               'overdue', i.waiting_since < now() - make_interval(hours => s.hours),
               'claimed_by_name', p.full_name, 'claimed_by_me', i.claimed_by = v_me) as item
        from items i
        join sla s using (queue)
        left join public.profiles p on p.user_id = i.claimed_by
       where p_queue is null or i.queue = p_queue
       order by i.waiting_since
       limit 200) x), '[]'::jsonb)
    into v_queues, v_items;
  return jsonb_build_object('queues', v_queues, 'items', v_items);
end;
$$;

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
  'society_name_check', 'request_society', 'resubmit_society', 'my_society_requests', 'set_society_images', 'update_society',
  'set_membership_mode', 'societies_directory', 'society_page', 'society_manage', 'follow_society', 'join_society',
  'decide_join_request', 'leave_society', 'invite_officer', 'offer_handover', 'answer_society_invite', 'my_society_invites',
  'remove_officer', 'confirm_term', 'save_induction_round', 'publish_induction_round', 'induction_round_page',
  'apply_induction', 'decide_induction_application', 'my_officer_societies',
  'ops_societies', 'ops_society_case', 'claim_society', 'decide_society']);
drop function pg_temp.expose(text[]);
