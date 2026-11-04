-- Phase 18 (PRD 5.33): the digital yearbook. The final-year batch's book: each member has a page
-- that friends, venture teammates (current or past) and society co-members in the same batch sign
-- with notes the owner approves; kind superlatives with secret votes inside the department; read-only
-- forever after the freeze at graduation. Signed-in only, never public.
--
-- * yearbooks: one per university and batch, with the dates from platform_config yearbook.calendar.
--   Cron `yearbook-open` (daily) opens it on 1 February and creates every member's page; cron
--   `yearbook-reveal` (hourly) tallies when the vote closes (winners told privately, 48 hours to
--   decline) and reveals; cron `yearbook-freeze` (daily) freezes it on 1 September.
-- * The batch follows the graduation rule (PRD 5.25): the students graduating on 1 September of the
--   opening year, or the university's final_year_batch when it names a later year.
-- * yearbook_pages, yearbook_notes (approved_at, hidden_at), yearbook_votes (no policy at all: nobody
--   reads a vote), yearbook_awards (the winner reads theirs; the batch reads revealed ones).
-- * profiles.yearbook_superlatives_opt_out: never shown as an option to vote for, and doesn't vote.
-- * Photos: private bucket yearbook-photos/{user}/{uuid}.webp (sharp re-encode), read by the batch.
-- * Reports: yearbook_page and yearbook_note; removal hides the item and never names the reporter.

-- ---------------------------------------------------------------------------
-- Config
-- ---------------------------------------------------------------------------
insert into public.platform_config (key, version, value, reason) values
  ('yearbook.calendar', 1,
   '{"open_month": 2, "open_day": 1, "vote_month": 6, "vote_day": 1, "vote_days": 21, "notice_hours": 48, "freeze_month": 9, "freeze_day": 1}',
   'PRD 5.33 (question 9 default): opens 1 February, the vote opens 1 June for 3 weeks, winners are told 48 hours before the reveal, freeze on 1 September (graduation).'),
  ('yearbook.titles', 1,
   '[{"key": "start_a_company", "title": "Most likely to start a company"},
     {"key": "always_helps", "title": "Always ready to help"},
     {"key": "best_teammate", "title": "Best teammate"},
     {"key": "explains_anything", "title": "Can explain anything"},
     {"key": "ships_it", "title": "Most likely to ship it on time"},
     {"key": "kindest", "title": "Kindest person in the batch"},
     {"key": "society_heart", "title": "Heart of every society"},
     {"key": "brightest_future", "title": "Most likely to inspire juniors"}]',
   'PRD 5.33: a fixed list of positive titles only.'),
  ('yearbook.limits', 1, '{"quote": 140, "note": 500, "highlights": 3, "min_votes": 5}',
   'PRD 5.33: quotes up to 140 characters, notes up to 500, up to 3 Record highlights, a winner needs 5 votes or more.');
insert into public.config_keys (key, area, description, applies, schema) values
  ('yearbook.calendar', 'yearbook', 'Yearbook dates (Pakistan time): when it opens, when the superlative vote opens and for how many days, how many hours before the reveal winners are told, and the freeze.', 'now',
   '{"type": "object", "additionalProperties": false,
     "required": ["open_month", "open_day", "vote_month", "vote_day", "vote_days", "notice_hours", "freeze_month", "freeze_day"],
     "properties": {"open_month": {"type": "integer", "minimum": 1, "maximum": 12}, "open_day": {"type": "integer", "minimum": 1, "maximum": 28},
                    "vote_month": {"type": "integer", "minimum": 1, "maximum": 12}, "vote_day": {"type": "integer", "minimum": 1, "maximum": 28},
                    "vote_days": {"type": "integer", "minimum": 3, "maximum": 60}, "notice_hours": {"type": "integer", "minimum": 24, "maximum": 168},
                    "freeze_month": {"type": "integer", "minimum": 1, "maximum": 12}, "freeze_day": {"type": "integer", "minimum": 1, "maximum": 28}}}'),
  ('yearbook.titles', 'yearbook', 'Superlative titles: positive titles only, each with a stable key.', 'now',
   '{"type": "array", "minItems": 1, "maxItems": 20,
     "items": {"type": "object", "additionalProperties": false, "required": ["key", "title"],
               "properties": {"key": {"type": "string", "pattern": "^[a-z][a-z0-9_]{2,40}$"},
                              "title": {"type": "string", "minLength": 5, "maxLength": 60}}}}'),
  ('yearbook.limits', 'yearbook', 'Yearbook limits: quote and note length, Record highlights per page, and the fewest votes a superlative winner needs.', 'now',
   '{"type": "object", "additionalProperties": false, "required": ["quote", "note", "highlights", "min_votes"],
     "properties": {"quote": {"type": "integer", "minimum": 40, "maximum": 280}, "note": {"type": "integer", "minimum": 100, "maximum": 1000},
                    "highlights": {"type": "integer", "minimum": 0, "maximum": 5}, "min_votes": {"type": "integer", "minimum": 3, "maximum": 50}}}');

create function private.yearbook_limit(p_field text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select private.cfg_int('yearbook.limits', p_field,
                         case p_field when 'quote' then 140 when 'note' then 500 when 'highlights' then 3 else 5 end);
$$;
revoke all on function private.yearbook_limit(text) from public;

create function private.yearbook_cal(p_field text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select private.cfg_int('yearbook.calendar', p_field,
                         case p_field when 'open_month' then 2 when 'vote_month' then 6 when 'vote_days' then 21
                                      when 'notice_hours' then 48 when 'freeze_month' then 9 else 1 end);
$$;
revoke all on function private.yearbook_cal(text) from public;

create function private.yearbook_titles()
returns table (key text, title text, pos integer)
language sql
stable
security definer
set search_path = ''
as $$
  select t ->> 'key', t ->> 'title', ord::integer
    from jsonb_array_elements(coalesce(private.config('yearbook.titles'), '[]'::jsonb)) with ordinality as x(t, ord);
$$;
revoke all on function private.yearbook_titles() from public;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
alter table public.profiles add column yearbook_superlatives_opt_out boolean not null default false;
comment on column public.profiles.yearbook_superlatives_opt_out is
  'PRD 5.33: out of yearbook superlatives (never an option to vote for, doesn''t vote). Set through set_superlatives_opt_out().';

create table public.yearbooks (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id) on delete cascade,
  batch smallint not null check (batch between 1980 and 2100),
  opens_at timestamptz not null,
  vote_opens_at timestamptz not null,
  vote_closes_at timestamptz not null,
  reveal_at timestamptz not null,
  freezes_at timestamptz not null,
  winners_told_at timestamptz,
  revealed_at timestamptz,
  frozen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (university_id, batch),
  check (vote_opens_at >= opens_at and vote_closes_at > vote_opens_at and reveal_at > vote_closes_at and freezes_at > reveal_at)
);
comment on table public.yearbooks is 'One yearbook per university and final-year batch (PRD 5.33). Created and moved through its dates by the yearbook crons only.';

create table public.yearbook_pages (
  id uuid primary key default gen_random_uuid(),
  yearbook_id uuid not null references public.yearbooks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Grouping on the browse grid and the superlative department; copied when the page is made.
  department text,
  photo_path text check (photo_path is null or photo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  quote text check (quote is null or char_length(btrim(quote)) between 1 and 280),
  highlights uuid[] not null default '{}' check (cardinality(highlights) <= 5),
  visible boolean not null default true,
  removed_at timestamptz,
  removed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (yearbook_id, user_id),
  check (photo_path is null or starts_with(photo_path, user_id::text || '/'))
);
comment on table public.yearbook_pages is 'A member''s yearbook page (PRD 5.33). Written through save_yearbook_page(); a hidden page can''t be signed or voted for.';
create index yearbook_pages_user_idx on public.yearbook_pages (user_id);
create index yearbook_pages_removed_by_idx on public.yearbook_pages (removed_by) where removed_by is not null;
create trigger yearbook_pages_set_updated_at before update on public.yearbook_pages for each row execute function private.set_updated_at();

create table public.yearbook_notes (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.yearbook_pages (id) on delete cascade,
  writer_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  approved_at timestamptz,
  hidden_at timestamptz,
  removed_at timestamptz,
  removed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page_id, writer_id),
  check (approved_at is null or hidden_at is null)
);
comment on table public.yearbook_notes is 'Notes signed on a yearbook page (PRD 5.33): visible to the batch only once the owner approves; hidden notes only to the writer and the owner. Written through sign_yearbook()/decide_yearbook_note().';
create index yearbook_notes_writer_idx on public.yearbook_notes (writer_id);
create index yearbook_notes_removed_by_idx on public.yearbook_notes (removed_by) where removed_by is not null;
create trigger yearbook_notes_set_updated_at before update on public.yearbook_notes for each row execute function private.set_updated_at();

create table public.yearbook_votes (
  yearbook_id uuid not null references public.yearbooks (id) on delete cascade,
  voter_id uuid not null references auth.users (id) on delete cascade,
  title_key text not null check (title_key ~ '^[a-z][a-z0-9_]{2,40}$'),
  nominee_id uuid not null references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (yearbook_id, voter_id, title_key),
  check (voter_id <> nominee_id)
);
comment on table public.yearbook_votes is 'Secret superlative votes (PRD 5.33). No select policy: nobody reads a vote; only private tallies at the close. Deleted at the freeze.';
create index yearbook_votes_voter_idx on public.yearbook_votes (voter_id);
create index yearbook_votes_tally_idx on public.yearbook_votes (yearbook_id, title_key, nominee_id);

create table public.yearbook_awards (
  yearbook_id uuid not null references public.yearbooks (id) on delete cascade,
  title_key text not null check (title_key ~ '^[a-z][a-z0-9_]{2,40}$'),
  title text not null,
  winner_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'told' check (status in ('told', 'declined', 'revealed')),
  told_at timestamptz not null default now(),
  declined_at timestamptz,
  primary key (yearbook_id, title_key, winner_id)
);
comment on table public.yearbook_awards is 'Superlative winners (PRD 5.33): told privately before the reveal, may decline (the title then goes unawarded). No vote counts are stored.';
create index yearbook_awards_winner_idx on public.yearbook_awards (winner_id);

-- ---------------------------------------------------------------------------
-- Membership
-- ---------------------------------------------------------------------------
-- The yearbook a user belongs to: their university's book for their graduation year. Alumni keep it.
create function private.yearbook_of(p_user uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select y.id from public.yearbooks y
    join public.profiles p on p.university_id = y.university_id and p.graduation_year = y.batch
   where p.user_id = p_user and p.role = 'student' and p.status in ('active', 'graduate');
$$;
revoke all on function private.yearbook_of(uuid) from public;

create function private.is_yearbook_member(p_yearbook uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.yearbook_of((select auth.uid())) = p_yearbook, false);
$$;
revoke all on function private.is_yearbook_member(uuid) from public;
grant execute on function private.is_yearbook_member(uuid) to authenticated;

create function private.yearbook_dept(p_department text)
returns text
language sql
immutable
set search_path = ''
as $$ select nullif(lower(btrim(coalesce(p_department, ''))), '') $$;

-- Writers who may sign a page: same batch, not blocked, and friends, venture teammates (current
-- or past) or society co-members.
create function private.can_sign_yearbook(p_writer uuid, p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_writer <> p_owner
     and private.yearbook_of(p_writer) is not null
     and private.yearbook_of(p_writer) = private.yearbook_of(p_owner)
     and not private.is_blocked(p_writer, p_owner)
     and (private.are_friends(p_writer, p_owner)
          or exists (select 1 from public.venture_members a join public.venture_members b on b.venture_id = a.venture_id
                      where a.user_id = p_writer and b.user_id = p_owner)
          or exists (select 1 from public.venture_completion_members a join public.venture_completion_members b on b.venture_id = a.venture_id
                      where a.user_id = p_writer and b.user_id = p_owner)
          or exists (select 1 from public.society_members a join public.society_members b on b.society_id = a.society_id
                      where a.user_id = p_writer and b.user_id = p_owner));
$$;
revoke all on function private.can_sign_yearbook(uuid, uuid) from public;

-- The book is writable until the freeze (and only after it opens).
create function private.require_yearbook_writable(p_yearbook uuid)
returns public.yearbooks
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  y public.yearbooks;
begin
  select * into y from public.yearbooks where id = p_yearbook;
  if y.id is null then
    raise exception 'there''s no yearbook for your batch yet' using errcode = 'P0002';
  end if;
  if y.frozen_at is not null or now() >= y.freezes_at then
    raise exception 'the yearbook is frozen: it''s read-only now' using errcode = '55000';
  end if;
  if now() < y.opens_at then
    raise exception 'the yearbook isn''t open yet' using errcode = '55000';
  end if;
  return y;
end;
$$;
revoke all on function private.require_yearbook_writable(uuid) from public;

-- Defence in depth: no row of a frozen book changes, whoever writes it.
create function private.yearbook_frozen_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_book uuid;
begin
  if tg_table_name = 'yearbook_notes' then
    select p.yearbook_id into v_book from public.yearbook_pages p where p.id = coalesce(new.page_id, old.page_id);
  else
    v_book := coalesce(new.yearbook_id, old.yearbook_id);
  end if;
  -- Moderation (removed_at), account deletion (cascades) and the freeze job itself still apply.
  if tg_op = 'DELETE' or current_setting('skilient.yearbook_freeze', true) = 'on' then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and tg_table_name in ('yearbook_notes', 'yearbook_pages') then
    -- Only these two tables have removed_at; checked in its own branch so votes never read it.
    if to_jsonb(new) -> 'removed_at' is distinct from to_jsonb(old) -> 'removed_at' then
      return new;
    end if;
  end if;
  if exists (select 1 from public.yearbooks y where y.id = v_book and y.frozen_at is not null) then
    raise exception 'the yearbook is frozen: it''s read-only now' using errcode = '55000';
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function private.yearbook_frozen_guard() from public;
create trigger yearbook_pages_frozen before insert or update or delete on public.yearbook_pages
  for each row execute function private.yearbook_frozen_guard();
create trigger yearbook_notes_frozen before insert or update or delete on public.yearbook_notes
  for each row execute function private.yearbook_frozen_guard();
create trigger yearbook_votes_frozen before insert or update or delete on public.yearbook_votes
  for each row execute function private.yearbook_frozen_guard();

-- ---------------------------------------------------------------------------
-- RLS: batch members read visible pages and approved notes; votes are never readable
-- ---------------------------------------------------------------------------
alter table public.yearbooks enable row level security;
alter table public.yearbook_pages enable row level security;
alter table public.yearbook_notes enable row level security;
alter table public.yearbook_votes enable row level security;
alter table public.yearbook_awards enable row level security;
revoke all on table public.yearbooks, public.yearbook_pages, public.yearbook_notes, public.yearbook_votes, public.yearbook_awards
  from anon, authenticated;
grant select on table public.yearbooks, public.yearbook_pages, public.yearbook_notes, public.yearbook_awards to authenticated;
create policy yearbooks_member_read on public.yearbooks for select to authenticated using ((select private.is_yearbook_member(id)));
create policy yearbook_pages_read on public.yearbook_pages for select to authenticated
  using (user_id = (select auth.uid())
         or (visible and removed_at is null and (select private.is_yearbook_member(yearbook_id))));
create policy yearbook_notes_read on public.yearbook_notes for select to authenticated
  using (writer_id = (select auth.uid())
         or exists (select 1 from public.yearbook_pages p where p.id = page_id and p.user_id = (select auth.uid()))
         or (approved_at is not null and hidden_at is null and removed_at is null
             and exists (select 1 from public.yearbook_pages p
                          where p.id = page_id and p.visible and p.removed_at is null
                            and (select private.is_yearbook_member(p.yearbook_id)))));
-- yearbook_votes: RLS on, no policy, no grant. Nobody reads a vote.
create policy yearbook_awards_read on public.yearbook_awards for select to authenticated
  using (winner_id = (select auth.uid())
         or (status = 'revealed' and (select private.is_yearbook_member(yearbook_id))));

do $$
declare
  t text;
begin
  foreach t in array array['yearbook_pages', 'yearbook_notes', 'yearbook_votes'] loop
    execute format('create trigger refuse_if_restricted before insert on public.%I for each row execute function private.refuse_if_restricted()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Photos: private bucket, the owner uploads (re-encoded by the server), the batch reads
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('yearbook-photos', 'yearbook-photos', false, 2097152, array['image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create function private.yearbook_photo_readable(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.yearbook_pages p
                  where p.photo_path = p_name
                    and (p.user_id = (select auth.uid())
                         or (p.visible and p.removed_at is null and private.is_yearbook_member(p.yearbook_id))))
      or (storage.foldername(p_name))[1] = (select auth.uid())::text;
$$;
revoke all on function private.yearbook_photo_readable(text) from public;
grant execute on function private.yearbook_photo_readable(text) to authenticated;

create function private.yearbook_photo_upload_allowed(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
     and (storage.foldername(p_name))[1] = (select auth.uid())::text
     and private.yearbook_of((select auth.uid())) is not null
     and (select count(*) from storage.objects o
           where o.bucket_id = 'yearbook-photos' and (storage.foldername(o.name))[1] = (select auth.uid())::text) < 10;
$$;
revoke all on function private.yearbook_photo_upload_allowed(text) from public;
grant execute on function private.yearbook_photo_upload_allowed(text) to authenticated;

create policy yearbook_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'yearbook-photos' and (select private.yearbook_photo_readable(name)));
create policy yearbook_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'yearbook-photos' and (select private.yearbook_photo_upload_allowed(name)));

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
                      'event-receipts', 'yearbook-photos');
$$;

create function private.yearbook_photo_cleanup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.queue_storage_cleanup('yearbook-photos', old.photo_path);
  elsif old.photo_path is distinct from new.photo_path then
    perform private.queue_storage_cleanup('yearbook-photos', old.photo_path);
  end if;
  return null;
end;
$$;
revoke all on function private.yearbook_photo_cleanup() from public;
create trigger yearbook_pages_photo_cleanup after update of photo_path or delete on public.yearbook_pages
  for each row execute function private.yearbook_photo_cleanup();

-- ---------------------------------------------------------------------------
-- Opening, closing, revealing, freezing
-- ---------------------------------------------------------------------------
create function private.yearbook_at(p_year integer, p_month integer, p_day integer)
returns timestamptz
language sql
immutable
set search_path = ''
as $$ select make_date(p_year, p_month, p_day)::timestamp at time zone 'Asia/Karachi' $$;

-- Make the member's page if it isn't there (members who join the platform after the book opens).
create function private.ensure_yearbook_page(p_user uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_book uuid := private.yearbook_of(p_user);
  v_id uuid;
begin
  if v_book is null then
    return null;
  end if;
  select id into v_id from public.yearbook_pages where yearbook_id = v_book and user_id = p_user;
  if v_id is null and exists (select 1 from public.yearbooks y where y.id = v_book and y.frozen_at is null) then
    insert into public.yearbook_pages (yearbook_id, user_id, department)
    select v_book, p_user, p.department from public.profiles p where p.user_id = p_user
    on conflict (yearbook_id, user_id) do nothing
    returning id into v_id;
  end if;
  return v_id;
end;
$$;
revoke all on function private.ensure_yearbook_page(uuid) from public;

-- Daily: on the opening day each university's final-year batch gets its book and every member a page.
create function private.yearbook_open(p_today date default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_today date := coalesce(p_today, (now() at time zone 'Asia/Karachi')::date);
  v_year integer := extract(year from v_today)::integer;
  v_open timestamptz := private.yearbook_at(v_year, private.yearbook_cal('open_month'), private.yearbook_cal('open_day'));
  v_vote timestamptz := private.yearbook_at(v_year, private.yearbook_cal('vote_month'), private.yearbook_cal('vote_day'));
  v_close timestamptz := v_vote + make_interval(days => private.yearbook_cal('vote_days'));
  v_reveal timestamptz := v_close + make_interval(hours => private.yearbook_cal('notice_hours'));
  v_freeze timestamptz := private.yearbook_at(v_year, private.yearbook_cal('freeze_month'), private.yearbook_cal('freeze_day'));
  y record;
  v_count integer := 0;
begin
  if v_today < (v_open at time zone 'Asia/Karachi')::date or v_today >= (v_freeze at time zone 'Asia/Karachi')::date then
    return 0;
  end if;
  for y in
    insert into public.yearbooks (university_id, batch, opens_at, vote_opens_at, vote_closes_at, reveal_at, freezes_at)
    select u.id, greatest(v_year, coalesce(u.final_year_batch, v_year)), v_open, v_vote, v_close, v_reveal, v_freeze
      from public.universities u
     where exists (select 1 from public.profiles p
                    where p.university_id = u.id and p.role = 'student' and p.status = 'active'
                      and p.graduation_year = greatest(v_year, coalesce(u.final_year_batch, v_year)))
    on conflict (university_id, batch) do nothing
    returning id, university_id, batch
  loop
    v_count := v_count + 1;
    insert into public.yearbook_pages (yearbook_id, user_id, department)
    select y.id, p.user_id, p.department from public.profiles p
     where p.university_id = y.university_id and p.graduation_year = y.batch and p.role = 'student' and p.status in ('active', 'graduate')
    on conflict (yearbook_id, user_id) do nothing;
    perform private.notify(p.user_id, null, 'yearbook_open', 'yearbook', y.id, jsonb_build_object('batch', y.batch))
       from public.profiles p
      where p.university_id = y.university_id and p.graduation_year = y.batch and p.role = 'student' and p.status = 'active';
  end loop;
  return v_count;
end;
$$;
revoke all on function private.yearbook_open(date) from public;

-- Hourly: tell the batch the vote opened; at the close tally and tell winners; at the reveal show them.
create function private.yearbook_reveal_tick()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  y public.yearbooks;
  v_min integer := private.yearbook_limit('min_votes');
  v_done integer := 0;
begin
  -- The vote opened: one notice to every member who can vote.
  for y in select * from public.yearbooks where frozen_at is null and vote_opens_at <= now() and vote_closes_at > now()
             and not exists (select 1 from public.notifications n where n.type = 'yearbook_vote_open' and n.entity_id = yearbooks.id)
  loop
    perform private.notify(p.user_id, null, 'yearbook_vote_open', 'yearbook', y.id, jsonb_build_object('closes_at', y.vote_closes_at))
       from public.yearbook_pages g join public.profiles p on p.user_id = g.user_id
      where g.yearbook_id = y.id and p.status = 'active' and not p.yearbook_superlatives_opt_out;
    v_done := v_done + 1;
  end loop;

  -- The close: per title, the most votes wins if it reaches min_votes (a tie shares the title).
  -- Only votes for nominees still eligible count. Winners are told privately and may decline.
  for y in select * from public.yearbooks where frozen_at is null and winners_told_at is null and vote_closes_at <= now() for update skip locked loop
    with tally as (
      select v.title_key, v.nominee_id, count(*) as n
        from public.yearbook_votes v
        join public.yearbook_pages g on g.yearbook_id = v.yearbook_id and g.user_id = v.nominee_id and g.visible and g.removed_at is null
        join public.profiles p on p.user_id = v.nominee_id and not p.yearbook_superlatives_opt_out
       where v.yearbook_id = y.id and v.title_key in (select t.key from private.yearbook_titles() t)
       group by v.title_key, v.nominee_id
    ), top as (
      select t.*, rank() over (partition by t.title_key order by t.n desc) as r from tally t
    ), winners as (
      insert into public.yearbook_awards (yearbook_id, title_key, title, winner_id)
      select y.id, top.title_key, t.title, top.nominee_id
        from top join private.yearbook_titles() t on t.key = top.title_key
       where top.r = 1 and top.n >= v_min
      on conflict do nothing
      returning winner_id, title_key, title
    )
    select count(*) into v_done from (
      select private.notify(w.winner_id, null, 'yearbook_award', 'yearbook', y.id,
                            jsonb_build_object('title', w.title, 'title_key', w.title_key, 'reveal_at', y.reveal_at))
        from winners w) x;
    update public.yearbooks set winners_told_at = now() where id = y.id;
  end loop;

  -- The reveal: titles not declined are shown on the winners' pages.
  for y in select * from public.yearbooks where frozen_at is null and winners_told_at is not null and revealed_at is null and reveal_at <= now() loop
    update public.yearbook_awards set status = 'revealed' where yearbook_id = y.id and status = 'told';
    update public.yearbooks set revealed_at = now() where id = y.id;
    v_done := v_done + 1;
  end loop;
  return v_done;
end;
$$;
revoke all on function private.yearbook_reveal_tick() from public;

-- Daily: the freeze at graduation. Read-only forever after; the votes are no longer needed.
create function private.yearbook_freeze(p_now timestamptz default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
  v_count integer;
begin
  perform set_config('skilient.yearbook_freeze', 'on', true);
  -- A reveal that hadn't run yet still runs first, so no told winner is lost.
  update public.yearbook_awards a set status = 'revealed'
    from public.yearbooks y where y.id = a.yearbook_id and y.frozen_at is null and y.freezes_at <= v_now and a.status = 'told';
  delete from public.yearbook_votes v using public.yearbooks y
   where y.id = v.yearbook_id and y.frozen_at is null and y.freezes_at <= v_now;
  update public.yearbooks set frozen_at = v_now, revealed_at = coalesce(revealed_at, case when winners_told_at is not null then v_now end)
   where frozen_at is null and freezes_at <= v_now;
  get diagnostics v_count = row_count;
  perform set_config('skilient.yearbook_freeze', 'off', true);
  return v_count;
end;
$$;
revoke all on function private.yearbook_freeze(timestamptz) from public;

-- ---------------------------------------------------------------------------
-- Reads
-- ---------------------------------------------------------------------------
create function private.yearbook_state(y public.yearbooks)
returns text
language sql
stable
set search_path = ''
as $$
  select case when y.id is null then 'none'
              when y.frozen_at is not null then 'frozen'
              when y.revealed_at is not null then 'revealed'
              when now() >= y.vote_closes_at then 'counting'
              when now() >= y.vote_opens_at then 'voting'
              else 'open' end;
$$;

create function private.yearbook_photo(p_page public.yearbook_pages, p_avatar text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select case when p_page.photo_path is not null then jsonb_build_object('bucket', 'yearbook-photos', 'path', p_page.photo_path)
              when p_avatar is not null then jsonb_build_object('bucket', 'avatars', 'path', p_avatar) end;
$$;

-- /yearbook: the batch's pages by department (search), or when it opens if the caller isn't in one.
create function private.yearbook_home(p_q text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_book uuid := private.yearbook_of(v_me);
  y public.yearbooks;
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
  v_profile public.profiles;
  v_year integer := extract(year from (now() at time zone 'Asia/Karachi'))::integer;
begin
  select * into v_profile from public.profiles where user_id = v_me;
  if v_book is null then
    -- Not in a final-year batch: when the caller's book opens.
    return jsonb_build_object('state', 'none', 'batch', v_profile.graduation_year,
      'opens_on', case when v_profile.graduation_year is not null
                       then (private.yearbook_at(v_profile.graduation_year, private.yearbook_cal('open_month'), private.yearbook_cal('open_day'))
                             at time zone 'Asia/Karachi')::date end,
      'this_year', v_year);
  end if;
  perform private.ensure_yearbook_page(v_me);
  select * into y from public.yearbooks where id = v_book;
  return jsonb_build_object(
    'state', private.yearbook_state(y),
    'batch', y.batch,
    'university', (select u.name from public.universities u where u.id = y.university_id),
    'vote_opens_at', y.vote_opens_at, 'vote_closes_at', y.vote_closes_at, 'reveal_at', y.reveal_at, 'freezes_at', y.freezes_at,
    'my_username', v_profile.username,
    'my_notes', (select count(*) from public.yearbook_notes n join public.yearbook_pages g on g.id = n.page_id
                  where g.yearbook_id = y.id and g.user_id = v_me and n.removed_at is null),
    'my_pending', (select count(*) from public.yearbook_notes n join public.yearbook_pages g on g.id = n.page_id
                    where g.yearbook_id = y.id and g.user_id = v_me and n.removed_at is null and n.approved_at is null and n.hidden_at is null),
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object(
               'username', p.username, 'name', p.full_name, 'department', coalesce(g.department, 'Other'),
               'photo', private.yearbook_photo(g, p.avatar_path), 'quote', g.quote, 'me', g.user_id = v_me,
               'awards', coalesce((select jsonb_agg(a.title order by a.title) from public.yearbook_awards a
                                    where a.yearbook_id = y.id and a.winner_id = g.user_id and a.status = 'revealed'), '[]'::jsonb))
             order by coalesce(g.department, 'Other'), p.full_name)
        from public.yearbook_pages g
        join public.profiles p on p.user_id = g.user_id and p.username is not null
       where g.yearbook_id = y.id and g.removed_at is null and (g.visible or g.user_id = v_me)
         and not private.is_blocked(v_me, g.user_id)
         and (v_q is null or p.full_name ilike private.contains_pattern(v_q) or p.username ilike private.contains_pattern(v_q)
              or coalesce(g.department, '') ilike private.contains_pattern(v_q))), '[]'::jsonb));
end;
$$;

-- One page: photo, quote, highlights, revealed titles, approved notes, and the caller's own note.
create function private.yearbook_page(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_owner public.profiles;
  g public.yearbook_pages;
  y public.yearbooks;
  v_mine public.yearbook_notes;
  v_is_owner boolean;
begin
  select * into v_owner from public.profiles where username = lower(btrim(coalesce(p_username, '')));
  if v_owner.user_id is null then
    raise exception 'that page isn''t in your yearbook' using errcode = 'P0002';
  end if;
  select * into g from public.yearbook_pages where user_id = v_owner.user_id and yearbook_id = private.yearbook_of(v_owner.user_id);
  v_is_owner := v_owner.user_id = v_me;
  if g.id is null or not (v_is_owner or (private.is_yearbook_member(g.yearbook_id) and not private.is_blocked(v_me, g.user_id))) then
    raise exception 'that page isn''t in your yearbook' using errcode = 'P0002';
  end if;
  select * into y from public.yearbooks where id = g.yearbook_id;
  if not v_is_owner and (not g.visible or g.removed_at is not null) then
    return jsonb_build_object('state', private.yearbook_state(y), 'hidden', true, 'name', v_owner.full_name, 'username', v_owner.username);
  end if;
  select * into v_mine from public.yearbook_notes where page_id = g.id and writer_id = v_me;
  return jsonb_build_object(
    'state', private.yearbook_state(y),
    'hidden', false,
    'id', g.id,
    'is_owner', v_is_owner,
    'name', v_owner.full_name, 'username', v_owner.username, 'department', g.department, 'batch', y.batch,
    'university', (select u.name from public.universities u where u.id = y.university_id),
    'photo', private.yearbook_photo(g, v_owner.avatar_path),
    'quote', g.quote, 'visible', g.visible, 'removed', g.removed_at is not null,
    'highlights', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'issuer', e.issuer_name, 'occurred_on', e.occurred_on, 'code', e.code)
                                             order by array_position(g.highlights, e.id))
                              from public.record_entries e where e.id = any (g.highlights) and e.user_id = g.user_id and e.status = 'sealed'), '[]'::jsonb),
    'awards', coalesce((select jsonb_agg(a.title order by a.title) from public.yearbook_awards a
                         where a.yearbook_id = y.id and a.winner_id = g.user_id and a.status = 'revealed'), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'writer', w.full_name, 'writer_username', w.username,
                                                           'at', coalesce(n.approved_at, n.created_at)) order by n.approved_at)
                         from public.yearbook_notes n join public.profiles w on w.user_id = n.writer_id
                        where n.page_id = g.id and n.approved_at is not null and n.hidden_at is null and n.removed_at is null
                          and not private.is_blocked(v_me, n.writer_id)), '[]'::jsonb),
    'can_sign', not v_is_owner and g.visible and g.removed_at is null and y.frozen_at is null and now() >= y.opens_at
                and private.can_sign_yearbook(v_me, g.user_id) and (v_mine.id is null or v_mine.approved_at is null),
    -- The writer's own note: pending covers hidden too (the writer is never told).
    'my_note', case when v_mine.id is not null and v_mine.removed_at is null then jsonb_build_object('id', v_mine.id, 'body', v_mine.body,
                    'status', case when v_mine.approved_at is not null then 'approved' else 'pending' end) end);
end;
$$;

-- /yearbook/me: my page settings, my Record entries to pick highlights from, and the notes inbox.
create function private.yearbook_me()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_page uuid := private.ensure_yearbook_page(v_me);
  g public.yearbook_pages;
  y public.yearbooks;
  v_profile public.profiles;
begin
  if v_page is null then
    raise exception 'you''re not in a final-year batch yet' using errcode = 'P0002';
  end if;
  select * into g from public.yearbook_pages where id = v_page;
  select * into y from public.yearbooks where id = g.yearbook_id;
  select * into v_profile from public.profiles where user_id = v_me;
  return jsonb_build_object(
    'state', private.yearbook_state(y),
    'username', v_profile.username, 'name', v_profile.full_name,
    'photo', private.yearbook_photo(g, v_profile.avatar_path), 'own_photo', g.photo_path is not null,
    'quote', g.quote, 'visible', g.visible, 'removed', g.removed_at is not null, 'highlights', to_jsonb(g.highlights),
    'opt_out', v_profile.yearbook_superlatives_opt_out,
    'limits', jsonb_build_object('quote', private.yearbook_limit('quote'), 'note', private.yearbook_limit('note'), 'highlights', private.yearbook_limit('highlights')),
    'entries', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'issuer', e.issuer_name, 'occurred_on', e.occurred_on)
                                          order by e.occurred_on desc)
                           from (select * from public.record_entries e where e.user_id = v_me and e.status = 'sealed' and not e.hidden
                                  order by e.occurred_on desc limit 50) e), '[]'::jsonb),
    'awards', coalesce((select jsonb_agg(jsonb_build_object('title', a.title, 'title_key', a.title_key, 'status', a.status) order by a.title)
                          from public.yearbook_awards a where a.yearbook_id = y.id and a.winner_id = v_me), '[]'::jsonb),
    'reveal_at', y.reveal_at,
    'notes', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'writer', w.full_name, 'writer_username', w.username,
                                                           'status', case when n.approved_at is not null then 'approved'
                                                                          when n.hidden_at is not null then 'hidden' else 'pending' end,
                                                           'at', n.updated_at) order by (n.approved_at is null and n.hidden_at is null) desc, n.updated_at desc)
                         from public.yearbook_notes n join public.profiles w on w.user_id = n.writer_id
                        where n.page_id = g.id and n.removed_at is null), '[]'::jsonb));
end;
$$;

-- The superlative ballot: titles with the caller's own choice (their own votes only).
create function private.yearbook_ballot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_book uuid := private.yearbook_of(v_me);
  y public.yearbooks;
begin
  select * into y from public.yearbooks where id = v_book;
  if y.id is null then
    raise exception 'you''re not in a final-year batch yet' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'state', private.yearbook_state(y),
    'vote_opens_at', y.vote_opens_at, 'vote_closes_at', y.vote_closes_at, 'reveal_at', y.reveal_at,
    'opted_out', (select p.yearbook_superlatives_opt_out from public.profiles p where p.user_id = v_me),
    'department', (select g.department from public.yearbook_pages g where g.yearbook_id = y.id and g.user_id = v_me),
    'titles', coalesce((select jsonb_agg(jsonb_build_object('key', t.key, 'title', t.title,
                                 'vote', (select jsonb_build_object('username', p.username, 'name', p.full_name)
                                            from public.yearbook_votes v join public.profiles p on p.user_id = v.nominee_id
                                           where v.yearbook_id = y.id and v.voter_id = v_me and v.title_key = t.key),
                                 'winners', case when y.revealed_at is not null then (
                                   select coalesce(jsonb_agg(jsonb_build_object('username', p.username, 'name', p.full_name)), '[]'::jsonb)
                                     from public.yearbook_awards a join public.profiles p on p.user_id = a.winner_id
                                    where a.yearbook_id = y.id and a.title_key = t.key and a.status = 'revealed') end)
                               order by t.pos)
                          from private.yearbook_titles() t), '[]'::jsonb));
end;
$$;

-- Who the caller may vote for: same book and department, visible page, not opted out, not blocked.
create function private.yearbook_nominees(p_q text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_book uuid := private.yearbook_of(v_me);
  v_dept text := private.yearbook_dept((select g.department from public.yearbook_pages g where g.yearbook_id = v_book and g.user_id = v_me));
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  if v_book is null then
    raise exception 'you''re not in a final-year batch yet' using errcode = 'P0002';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('username', x.username, 'name', x.full_name) order by x.full_name)
      from (select p.username, p.full_name
              from public.yearbook_pages g
              join public.profiles p on p.user_id = g.user_id and p.username is not null and not p.yearbook_superlatives_opt_out
             where g.yearbook_id = v_book and g.user_id <> v_me and g.visible and g.removed_at is null
               and private.yearbook_dept(g.department) is not distinct from v_dept
               and not private.is_blocked(v_me, g.user_id)
               and (v_q is null or p.full_name ilike private.contains_pattern(v_q) or p.username ilike private.contains_pattern(v_q))
             order by p.full_name limit 50) x), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Writes
-- ---------------------------------------------------------------------------
create function private.save_yearbook_page(p_quote text, p_highlights uuid[], p_visible boolean, p_photo text default null,
                                           p_clear_photo boolean default false)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_page uuid := private.ensure_yearbook_page(v_me);
  g public.yearbook_pages;
  v_quote text := nullif(btrim(coalesce(p_quote, '')), '');
  v_highlights uuid[] := coalesce(p_highlights, '{}');
begin
  if v_page is null then
    raise exception 'you''re not in a final-year batch yet' using errcode = 'P0002';
  end if;
  select * into g from public.yearbook_pages where id = v_page for update;
  perform private.require_yearbook_writable(g.yearbook_id);
  if v_quote is not null and char_length(v_quote) > private.yearbook_limit('quote') then
    raise exception 'your quote is up to % characters', private.yearbook_limit('quote') using errcode = '23514';
  end if;
  if cardinality(v_highlights) > private.yearbook_limit('highlights') then
    raise exception 'pick up to % highlights', private.yearbook_limit('highlights') using errcode = '23514';
  end if;
  if exists (select 1 from unnest(v_highlights) h
              where not exists (select 1 from public.record_entries e where e.id = h and e.user_id = v_me and e.status = 'sealed')) then
    raise exception 'highlights come from sealed entries on your Record' using errcode = '22023';
  end if;
  if p_photo is not null and (
       not starts_with(p_photo, v_me::text || '/')
       or not exists (select 1 from storage.objects o where o.bucket_id = 'yearbook-photos' and o.name = p_photo and o.owner_id = v_me::text)) then
    raise exception 'the photo is missing; upload it again' using errcode = '22023';
  end if;
  update public.yearbook_pages
     set quote = v_quote,
         highlights = (select coalesce(array_agg(distinct h), '{}') from unnest(v_highlights) h),
         visible = coalesce(p_visible, visible),
         photo_path = case when p_clear_photo then null else coalesce(p_photo, photo_path) end
   where id = v_page;
end;
$$;

create function private.sign_yearbook(p_username text, p_body text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_owner uuid := (select p.user_id from public.profiles p where p.username = lower(btrim(coalesce(p_username, ''))));
  g public.yearbook_pages;
  n public.yearbook_notes;
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  if v_owner is null then
    raise exception 'that page isn''t in your yearbook' using errcode = 'P0002';
  end if;
  select * into g from public.yearbook_pages where user_id = v_owner and yearbook_id = private.yearbook_of(v_owner);
  if g.id is null or not private.is_yearbook_member(g.yearbook_id) then
    raise exception 'that page isn''t in your yearbook' using errcode = 'P0002';
  end if;
  perform private.require_yearbook_writable(g.yearbook_id);
  if not g.visible or g.removed_at is not null then
    raise exception 'this page isn''t taking notes' using errcode = '42501';
  end if;
  if not private.can_sign_yearbook(v_me, v_owner) then
    raise exception 'only friends, teammates and society co-members in your batch can sign' using errcode = '42501';
  end if;
  if v_body = '' then
    raise exception 'write a note' using errcode = '23514';
  end if;
  if char_length(v_body) > private.yearbook_limit('note') then
    raise exception 'notes are up to % characters', private.yearbook_limit('note') using errcode = '23514';
  end if;
  if not private.rate_limit('yearbook_sign:' || v_me::text, 30, interval '1 hour') then
    raise exception 'you''re signing too fast' using errcode = '54000';
  end if;
  select * into n from public.yearbook_notes where page_id = g.id and writer_id = v_me for update;
  if n.id is not null then
    if n.removed_at is not null then
      raise exception 'this note can''t be changed' using errcode = '55000';
    end if;
    if n.approved_at is not null then
      raise exception 'your note is approved: it can''t be edited now' using errcode = '55000';
    end if;
    update public.yearbook_notes set body = v_body where id = n.id;
    return n.id;
  end if;
  insert into public.yearbook_notes (page_id, writer_id, body) values (g.id, v_me, v_body) returning id into v_id;
  perform private.notify(v_owner, v_me, 'yearbook_note', 'yearbook_note', v_id, '{}'::jsonb);
  return v_id;
end;
$$;

-- The owner approves (shown to the batch) or hides (never shown to anyone else; the writer isn't told).
create function private.decide_yearbook_note(p_note uuid, p_approve boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  n public.yearbook_notes;
  g public.yearbook_pages;
begin
  select * into n from public.yearbook_notes where id = p_note for update;
  select * into g from public.yearbook_pages where id = n.page_id;
  if n.id is null or g.user_id is distinct from v_me then
    raise exception 'that note isn''t on your page' using errcode = 'P0002';
  end if;
  perform private.require_yearbook_writable(g.yearbook_id);
  if n.removed_at is not null then
    raise exception 'this note was removed' using errcode = '55000';
  end if;
  update public.yearbook_notes
     set approved_at = case when p_approve then coalesce(approved_at, now()) end,
         hidden_at = case when p_approve then null else coalesce(hidden_at, now()) end
   where id = p_note;
end;
$$;

-- One secret vote per title, for someone in the caller's department; changeable until the close.
-- A null username takes the vote back.
create function private.cast_yearbook_vote(p_title text, p_username text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_book uuid := private.yearbook_of(v_me);
  y public.yearbooks;
  v_nominee uuid;
  v_dept text;
begin
  if v_book is null then
    raise exception 'you''re not in a final-year batch yet' using errcode = 'P0002';
  end if;
  y := private.require_yearbook_writable(v_book);
  if now() < y.vote_opens_at or now() >= y.vote_closes_at then
    raise exception 'the vote isn''t open' using errcode = '55000';
  end if;
  if not exists (select 1 from private.yearbook_titles() t where t.key = p_title) then
    raise exception 'unknown title' using errcode = '22023';
  end if;
  if (select p.yearbook_superlatives_opt_out from public.profiles p where p.user_id = v_me) then
    raise exception 'you''ve opted out of superlatives; opt back in under Settings, Privacy to vote' using errcode = '42501';
  end if;
  if p_username is null or btrim(p_username) = '' then
    delete from public.yearbook_votes where yearbook_id = v_book and voter_id = v_me and title_key = p_title;
    return;
  end if;
  v_dept := private.yearbook_dept((select g.department from public.yearbook_pages g where g.yearbook_id = v_book and g.user_id = v_me));
  select g.user_id into v_nominee
    from public.yearbook_pages g
    join public.profiles p on p.user_id = g.user_id and not p.yearbook_superlatives_opt_out
   where g.yearbook_id = v_book and p.username = lower(btrim(p_username)) and g.visible and g.removed_at is null
     and private.yearbook_dept(g.department) is not distinct from v_dept and g.user_id <> v_me
     and not private.is_blocked(v_me, g.user_id);
  if v_nominee is null then
    raise exception 'you can vote for someone in your department''s yearbook (not yourself)' using errcode = '22023';
  end if;
  if not private.rate_limit('yearbook_vote:' || v_me::text, 60, interval '1 hour') then
    raise exception 'you''re voting too fast' using errcode = '54000';
  end if;
  insert into public.yearbook_votes (yearbook_id, voter_id, title_key, nominee_id) values (v_book, v_me, p_title, v_nominee)
  on conflict (yearbook_id, voter_id, title_key) do update set nominee_id = excluded.nominee_id, updated_at = now();
end;
$$;

-- A winner may decline before the reveal: the title then goes unawarded.
create function private.decline_yearbook_award(p_title text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_book uuid := private.yearbook_of(v_me);
  y public.yearbooks;
begin
  y := private.require_yearbook_writable(v_book);
  if y.revealed_at is not null or now() >= y.reveal_at then
    raise exception 'the titles are already revealed' using errcode = '55000';
  end if;
  update public.yearbook_awards set status = 'declined', declined_at = now()
   where yearbook_id = v_book and winner_id = v_me and title_key = p_title and status = 'told';
  if not found then
    raise exception 'there''s no title to decline' using errcode = 'P0002';
  end if;
end;
$$;

create function private.set_superlatives_opt_out(p_on boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
begin
  update public.profiles set yearbook_superlatives_opt_out = coalesce(p_on, false) where user_id = v_me;
  if coalesce(p_on, false) then
    -- Opting out after being told declines the title; votes cast by the caller go too.
    update public.yearbook_awards set status = 'declined', declined_at = now() where winner_id = v_me and status = 'told';
    delete from public.yearbook_votes v using public.yearbooks y
     where v.voter_id = v_me and y.id = v.yearbook_id and y.frozen_at is null;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reports (5.12): pages and notes; the owner of a note is its writer
-- ---------------------------------------------------------------------------
alter function private.report_snapshot(public.report_target, uuid) rename to report_snapshot_v17;
create function private.report_snapshot(p_type public.report_target, p_target uuid)
returns table (owner_id uuid, snapshot jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.report_snapshot_v17(p_type, p_target) where p_type not in ('yearbook_page', 'yearbook_note')
  union all
  select g.user_id, jsonb_build_object('title', 'Yearbook page', 'body', g.quote, 'author', p.full_name, 'author_username', p.username,
                                       'created_at', g.created_at)
    from public.yearbook_pages g join public.profiles p on p.user_id = g.user_id
   where p_type = 'yearbook_page' and g.id = p_target
  union all
  select n.writer_id, jsonb_build_object('title', 'Yearbook note on ' || o.full_name || '''s page', 'body', n.body,
                                         'author', w.full_name, 'author_username', w.username, 'created_at', n.created_at)
    from public.yearbook_notes n
    join public.yearbook_pages g on g.id = n.page_id
    join public.profiles o on o.user_id = g.user_id
    join public.profiles w on w.user_id = n.writer_id
   where p_type = 'yearbook_note' and n.id = p_target;
$$;
revoke all on function private.report_snapshot_v17(public.report_target, uuid), private.report_snapshot(public.report_target, uuid) from public;

alter function private.can_report(public.report_target, uuid) rename to can_report_v17;
create function private.can_report(p_type public.report_target, p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_type
    when 'yearbook_page' then exists (select 1 from public.yearbook_pages g
                                       where g.id = p_target and g.user_id <> (select auth.uid()) and g.visible and g.removed_at is null
                                         and private.is_yearbook_member(g.yearbook_id))
    when 'yearbook_note' then exists (select 1 from public.yearbook_notes n join public.yearbook_pages g on g.id = n.page_id
                                       where n.id = p_target and n.writer_id <> (select auth.uid()) and n.removed_at is null
                                         and (g.user_id = (select auth.uid())
                                              or (n.approved_at is not null and n.hidden_at is null and g.visible
                                                  and private.is_yearbook_member(g.yearbook_id))))
    else private.can_report_v17(p_type, p_target)
  end;
$$;
revoke all on function private.can_report_v17(public.report_target, uuid) from public;
revoke all on function private.can_report(public.report_target, uuid) from public;
grant execute on function private.can_report(public.report_target, uuid) to authenticated;

-- Remove hides the page or note (frozen books too); the writer is told it was removed, never by whom.
alter function private.resolve_case(uuid, text, text, text) rename to resolve_case_v17;
create function private.resolve_case(p_case uuid, p_action text, p_reason text, p_severity text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_moderator();
  c public.report_cases;
  v_severity text := nullif(p_severity, '');
begin
  select * into c from public.report_cases where id = p_case;
  if c.id is null or c.target_type not in ('yearbook_page', 'yearbook_note') or p_action <> 'remove' then
    perform private.resolve_case_v17(p_case, p_action, p_reason, p_severity);
    return;
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'give a reason' using errcode = '23514';
  end if;
  select * into c from public.report_cases where id = p_case for update;
  if c.status <> 'open' then
    raise exception 'this case is already closed' using errcode = '55000';
  end if;
  if c.claimed_by is distinct from v_me then
    raise exception 'claim the case first' using errcode = '55000';
  end if;
  if v_severity is null or v_severity not in ('low', 'medium', 'high') then
    raise exception 'choose a severity: low, medium or high' using errcode = '22023';
  end if;
  if c.target_type = 'yearbook_page' then
    update public.yearbook_pages set removed_at = coalesce(removed_at, now()), removed_by = v_me where id = c.target_id;
  else
    update public.yearbook_notes set removed_at = coalesce(removed_at, now()), removed_by = v_me where id = c.target_id;
  end if;
  perform private.notify(c.owner_id, null, 'content_removed', 'report_case', c.id,
                         jsonb_build_object('target_type', c.target_type, 'action', 'removed',
                                            'excerpt', left(coalesce(c.snapshot ->> 'body', c.snapshot ->> 'title', ''), 120)));
  if c.owner_id is not null then
    insert into public.ranking_adjustments (user_id, kind, severity, reason, case_id, staff_id)
    values (c.owner_id, 'penalty', v_severity, btrim(p_reason), c.id, v_me);
  end if;
  update public.report_cases
     set status = 'removed', resolved_by = v_me, resolved_at = now(), resolution_reason = btrim(p_reason)
   where id = p_case;
  insert into public.ops_audit_log (staff_id, action, target_type, target_id, reason, before, after)
  values (v_me, 'report.remove', 'report_case', p_case::text, btrim(p_reason),
          jsonb_build_object('status', c.status, 'target_type', c.target_type, 'target_id', c.target_id),
          jsonb_build_object('removed', true, 'severity', v_severity, 'status', 'removed'));
end;
$$;
revoke all on function private.resolve_case_v17(uuid, text, text, text), private.resolve_case(uuid, text, text, text) from public;
grant execute on function private.resolve_case(uuid, text, text, text) to authenticated;

-- An overturned removal shows the page or note again.
alter function private.overturn_decision(public.appeals, uuid, text) rename to overturn_decision_v17;
create function private.overturn_decision(a public.appeals, p_staff uuid, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.report_cases;
  v_out jsonb;
begin
  v_out := private.overturn_decision_v17(a, p_staff, p_reason);
  if a.decision_type = 'report_case' then
    select * into c from public.report_cases where id = a.decision_id;
    if c.target_type = 'yearbook_page' then
      update public.yearbook_pages set removed_at = null, removed_by = null where id = c.target_id and removed_at is not null;
      v_out := coalesce(v_out, '{}'::jsonb) || jsonb_build_object('content_restored', found);
    elsif c.target_type = 'yearbook_note' then
      update public.yearbook_notes set removed_at = null, removed_by = null where id = c.target_id and removed_at is not null;
      v_out := coalesce(v_out, '{}'::jsonb) || jsonb_build_object('content_restored', found);
    end if;
  end if;
  return v_out;
end;
$$;
revoke all on function private.overturn_decision(public.appeals, uuid, text), private.overturn_decision_v17(public.appeals, uuid, text) from public;

-- ---------------------------------------------------------------------------
-- Notifications and analytics
-- ---------------------------------------------------------------------------
insert into public.notification_categories (category, label, description, position, default_channel, allow_instant) values
  ('yearbook', 'Yearbook', 'Your final-year yearbook: when it opens, notes on your page, the superlative vote and your titles.', 27, 'digest', true);
insert into public.notification_types (type, category, emailed) values
  ('yearbook_open', 'yearbook', true),
  ('yearbook_note', 'yearbook', true),
  ('yearbook_vote_open', 'yearbook', true),
  ('yearbook_award', 'yearbook', true);

create function private.yearbook_analytics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'yearbook_notes' then
    perform private.track(new.writer_id, 'yearbook_signed', jsonb_build_object('note_id', new.id));
  elsif tg_table_name = 'yearbook_votes' and tg_op = 'INSERT' then
    perform private.track(new.voter_id, 'yearbook_voted', jsonb_build_object('title', new.title_key));
  end if;
  return null;
end;
$$;
revoke all on function private.yearbook_analytics() from public;
create trigger yearbook_notes_analytics after insert on public.yearbook_notes for each row execute function private.yearbook_analytics();
create trigger yearbook_votes_analytics after insert on public.yearbook_votes for each row execute function private.yearbook_analytics();

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------
select cron.schedule('yearbook-open', '11 19 * * *', $$select private.yearbook_open()$$);       -- 00:11 PKT
select cron.schedule('yearbook-reveal', '13 * * * *', $$select private.yearbook_reveal_tick()$$);
select cron.schedule('yearbook-freeze', '17 19 * * *', $$select private.yearbook_freeze()$$);   -- 00:17 PKT

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
  'yearbook_home', 'yearbook_page', 'yearbook_me', 'yearbook_ballot', 'yearbook_nominees', 'save_yearbook_page',
  'sign_yearbook', 'decide_yearbook_note', 'cast_yearbook_vote', 'decline_yearbook_award', 'set_superlatives_opt_out']);
drop function pg_temp.expose(text[]);
