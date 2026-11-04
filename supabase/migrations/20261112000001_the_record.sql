-- Phase 16 (PRD 5.30): The Record, a signed co-curricular transcript.
--
-- * record_entries: one row per entry. Held entries (user_id null, claim_email_hash set) wait for
--   a walk-in to sign up; awaiting entries wait for a second officer (no officer issues to
--   themselves alone); pending entries are queued on pgmq record_jobs; the cv-sign Edge Function
--   signs RecordEntryV1 (lib/record/types.ts) with the CV key and seals them. Sealed entries are
--   immutable: a correction issues a new entry that supersedes the old one, and a revocation keeps
--   the row with its reason.
-- * Issuing: event close-out (a trigger on event_issuances, which phase 15 writes by hand or at
--   72 hours), a confirmed office-bearer term, and a venture completion (Skilient).
-- * record_claims: one claim email per person per event, held 180 days, matched at signup only
--   to the same verified email, then moved into the Record with "Claim".
-- * record_share_links (token hash only), record_corrections (Report a mistake), record_pdf_exports
--   (certificate and transcript hashes, recorded with the PDF route's MAC).
-- * CV "Leadership and activities": cv_settings.record_entries, the snapshot's `activities`.
-- * Ranking formula v2: score_record joins compute_ranking (at most 100 points, merit only).

-- ---------------------------------------------------------------------------
-- Config
-- ---------------------------------------------------------------------------
insert into public.platform_config (key, version, value, reason) values
  ('record.limits', 1,
   '{"claim_days": 180, "pins": 3, "share_links": 10, "cv_entries": 8, "batch": 50}',
   'PRD 5.30: unclaimed entries expire after 180 days, 3 pinned highlights, 10 active share links, 8 entries on the CV, 50 entries signed per worker pass.');
insert into public.config_keys (key, area, description, applies, schema) values
  ('record.limits', 'record', 'The Record: how long held entries wait for a claim, pins, share links, CV entries and the signing batch.', 'now',
   '{"type": "object", "additionalProperties": false,
     "required": ["claim_days", "pins", "share_links", "cv_entries", "batch"],
     "properties": {
       "claim_days": {"type": "integer", "minimum": 7, "maximum": 365},
       "pins": {"type": "integer", "minimum": 0, "maximum": 6},
       "share_links": {"type": "integer", "minimum": 1, "maximum": 50},
       "cv_entries": {"type": "integer", "minimum": 0, "maximum": 20},
       "batch": {"type": "integer", "minimum": 1, "maximum": 500}}}');

create function private.record_limit(p_key text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (c.value ->> p_key)::integer from public.platform_config c
                    where c.key = 'record.limits' and c.effective_at <= now()
                    order by c.effective_at desc, c.version desc limit 1),
                  case p_key when 'claim_days' then 180 when 'pins' then 3 when 'share_links' then 10
                             when 'cv_entries' then 8 else 50 end);
$$;
revoke all on function private.record_limit(text) from public;

-- Academic years run September to August: 2026-09-01 .. 2027-08-31 is 2026.
create function private.academic_year(p date)
returns integer
language sql
immutable
set search_path = ''
as $$ select case when extract(month from p) >= 9 then extract(year from p)::integer else extract(year from p)::integer - 1 end $$;

create function private.ordinal(n integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select n::text || case when n % 100 between 11 and 13 then 'th'
                         when n % 10 = 1 then 'st' when n % 10 = 2 then 'nd' when n % 10 = 3 then 'rd' else 'th' end;
$$;

create function private.email_hash(p text)
returns text
language sql
immutable
set search_path = ''
as $$ select encode(extensions.digest(lower(btrim(p)), 'sha256'), 'hex') $$;
revoke all on function private.academic_year(date), private.ordinal(integer), private.email_hash(text) from public;

-- ---------------------------------------------------------------------------
-- Entries
-- ---------------------------------------------------------------------------
create table public.record_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  claim_email_hash text check (claim_email_hash is null or claim_email_hash ~ '^[0-9a-f]{64}$'),
  kind text not null check (kind in ('attended', 'completed', 'result', 'office_bearer', 'volunteer', 'venture_completed', 'taught', 'proof_task')),
  issuer_type text not null check (issuer_type in ('society', 'skilient')),
  issuer_id uuid references public.societies (id) on delete set null,
  issuer_name text not null check (char_length(btrim(issuer_name)) between 2 and 80),
  source text not null check (source in ('event', 'session', 'term', 'venture', 'swap', 'task')),
  source_id uuid not null,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  -- Integers and strings only (the signed payload copies it): line, place, entrants, minutes, ...
  evidence jsonb not null default '{}' check (jsonb_typeof(evidence) = 'object' and char_length(coalesce(evidence ->> 'line', '')) <= 140),
  occurred_on date not null,
  issued_by uuid references auth.users (id) on delete set null,
  -- The second officer, when the entry names the officer who issued it.
  confirmed_by uuid references auth.users (id) on delete set null,
  issued_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('held', 'awaiting', 'pending', 'sealed', 'revoked', 'superseded')),
  supersedes uuid references public.record_entries (id) on delete set null,
  superseded_by uuid references public.record_entries (id) on delete set null,
  -- Set when sealed: the signed envelope is {v, type, code, key_id, issued_at: signed_at, entry: payload}.
  code text unique check (code is null or code ~ '^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{10}$'),
  key_id text references public.signing_keys (key_id),
  payload jsonb check (payload is null or jsonb_typeof(payload) = 'object'),
  envelope_hash text check (envelope_hash is null or envelope_hash ~ '^[0-9a-f]{64}$'),
  signature text check (signature is null or signature ~ '^[A-Za-z0-9_-]{86}$'),
  signed_at timestamptz check (signed_at is null or signed_at = date_trunc('second', signed_at)),
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  revoked_category text check (revoked_category is null or revoked_category in ('issued_in_error', 'not_earned', 'misconduct', 'other')),
  revoked_reason text check (revoked_reason is null or char_length(btrim(revoked_reason)) between 3 and 500),
  hidden boolean not null default false,
  pinned_at timestamptz,
  created_at timestamptz not null default now(),
  check ((user_id is null) = (status = 'held')),
  check (status <> 'held' or claim_email_hash is not null),
  check ((issuer_type = 'society') = (issuer_id is not null) or status in ('revoked', 'superseded', 'sealed')),
  check ((code is null) = (signed_at is null) and (code is null) = (signature is null) and (code is null) = (payload is null)
         and (code is null) = (envelope_hash is null) and (code is null) = (key_id is null)),
  check (status not in ('sealed', 'superseded') or code is not null),
  check ((status = 'revoked') = (revoked_at is not null) and (revoked_at is null) = (revoked_category is null)
         and (revoked_at is null) = (revoked_reason is null)),
  check (not (hidden and pinned_at is not null))
);
comment on table public.record_entries is
  'The Record (PRD 5.30): signed co-curricular entries. Written only by security definer functions and the cv-sign worker.';
-- One live entry per person, kind and source (re-running an issue never duplicates).
create unique index record_entries_one_live on public.record_entries (user_id, kind, source_id)
  where user_id is not null and status not in ('revoked', 'superseded') and supersedes is null;
create unique index record_entries_one_held on public.record_entries (claim_email_hash, kind, source_id) where status = 'held';
create unique index record_entries_one_correction on public.record_entries (supersedes) where supersedes is not null and status not in ('revoked', 'superseded');
create index record_entries_user_idx on public.record_entries (user_id, occurred_on desc) where user_id is not null;
create index record_entries_issuer_idx on public.record_entries (issuer_id, issued_at desc) where issuer_id is not null;
create index record_entries_source_idx on public.record_entries (source_id);
create index record_entries_status_idx on public.record_entries (status) where status in ('held', 'awaiting', 'pending');
create index record_entries_issued_by_idx on public.record_entries (issued_by) where issued_by is not null;
create index record_entries_confirmed_by_idx on public.record_entries (confirmed_by) where confirmed_by is not null;
create index record_entries_revoked_by_idx on public.record_entries (revoked_by) where revoked_by is not null;
create index record_entries_superseded_by_idx on public.record_entries (superseded_by) where superseded_by is not null;
create index record_entries_key_idx on public.record_entries (key_id) where key_id is not null;

-- Codes share the /verify/[code] namespace with CVs: neither table may take the other's code.
create function private.record_code_free()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.code is null then
    return new;
  end if;
  if tg_table_name = 'record_entries' and exists (select 1 from public.cv_records r where r.code = new.code) then
    raise exception 'code % is taken', new.code using errcode = '23505', constraint = 'record_entries_code_key';
  elsif tg_table_name = 'cv_records' and exists (select 1 from public.record_entries e where e.code = new.code) then
    raise exception 'code % is taken', new.code using errcode = '23505', constraint = 'cv_records_code_key';
  end if;
  return new;
end;
$$;
revoke all on function private.record_code_free() from public;
create trigger record_code_free before insert or update of code on public.record_entries
  for each row execute function private.record_code_free();
create trigger record_code_free before insert on public.cv_records
  for each row execute function private.record_code_free();

create table public.record_claims (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  event_id uuid not null references public.events (id) on delete cascade,
  email_attendee_id uuid references public.event_email_attendees (id) on delete set null,
  -- The account whose verified email matched (at signup or verification), before Claim.
  user_id uuid references auth.users (id) on delete cascade,
  matched_at timestamptz,
  claimed_at timestamptz,
  sent_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (email_hash, event_id),
  check ((user_id is null) = (matched_at is null)),
  check (claimed_at is null or user_id is not null)
);
comment on table public.record_claims is
  'Entries held for a walk-in''s university email (PRD 5.30): one claim email per person per event, 180 days, same verified email only.';
create index record_claims_user_idx on public.record_claims (user_id) where user_id is not null;
create index record_claims_event_idx on public.record_claims (event_id);
create index record_claims_attendee_idx on public.record_claims (email_attendee_id) where email_attendee_id is not null;
create index record_claims_expires_idx on public.record_claims (expires_at) where claimed_at is null;

create table public.record_share_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- SHA-256 of the 32-byte token; the token is shown once and never stored.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  label text check (label is null or char_length(btrim(label)) between 1 and 60),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  view_count integer not null default 0 check (view_count >= 0),
  last_viewed_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.record_share_links is 'Record share links (PRD 5.30, the cv_share_links pattern): token hash only, always with an expiry.';
create index record_share_links_user_idx on public.record_share_links (user_id, created_at desc);

create table public.record_corrections (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.record_entries (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  note text not null check (char_length(btrim(note)) between 10 and 1000),
  status text not null default 'open' check (status in ('open', 'corrected', 'declined')),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(btrim(decision_note)) between 3 and 500),
  created_at timestamptz not null default now(),
  check ((status = 'open') = (decided_at is null))
);
comment on table public.record_corrections is '"Report a mistake" on a Record entry (PRD 5.30): the issuer''s officers correct it (a new entry) or decline.';
create unique index record_corrections_one_open on public.record_corrections (entry_id) where status = 'open';
create index record_corrections_user_idx on public.record_corrections (user_id);
create index record_corrections_decided_by_idx on public.record_corrections (decided_by) where decided_by is not null;

create table public.record_pdf_exports (
  id uuid primary key,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('certificate', 'transcript')),
  entry_id uuid references public.record_entries (id) on delete set null,
  holder_name text not null,
  codes text[] not null check (cardinality(codes) between 1 and 500),
  pdf_hash text not null check (pdf_hash ~ '^[0-9a-f]{64}$'),
  bytes integer not null check (bytes > 0),
  created_at timestamptz not null default now(),
  check ((kind = 'certificate') = (entry_id is not null))
);
comment on table public.record_pdf_exports is
  'Certificate and transcript PDFs (PRD 5.30): recorded only by record_pdf_export with the PDF route''s MAC. The file itself is downloaded, never stored.';
create index record_pdf_exports_user_idx on public.record_pdf_exports (user_id, created_at desc);
create index record_pdf_exports_entry_idx on public.record_pdf_exports (entry_id) where entry_id is not null;

-- RLS: the owner reads their own; officers read what their society issued; the rest is functions.
alter table public.record_entries enable row level security;
alter table public.record_claims enable row level security;
alter table public.record_share_links enable row level security;
alter table public.record_corrections enable row level security;
alter table public.record_pdf_exports enable row level security;
revoke all on table public.record_entries, public.record_claims, public.record_share_links, public.record_corrections,
  public.record_pdf_exports from anon, authenticated;
grant select on table public.record_entries, public.record_share_links, public.record_corrections, public.record_pdf_exports to authenticated;

create policy record_entries_read on public.record_entries for select to authenticated
  using (user_id = (select auth.uid())
         or (issuer_type = 'society' and issuer_id is not null and status <> 'held' and private.is_society_officer(issuer_id)));
create policy record_share_links_owner_read on public.record_share_links for select to authenticated
  using (user_id = (select auth.uid()));
create policy record_corrections_read on public.record_corrections for select to authenticated
  using (user_id = (select auth.uid())
         or exists (select 1 from public.record_entries e where e.id = entry_id and e.issuer_type = 'society'
                      and private.is_society_officer(e.issuer_id)));
create policy record_pdf_exports_owner_read on public.record_pdf_exports for select to authenticated
  using (user_id = (select auth.uid()));

create trigger refuse_if_restricted before insert on public.record_share_links
  for each row execute function private.refuse_if_restricted();
create trigger refuse_if_restricted before insert on public.record_corrections
  for each row execute function private.refuse_if_restricted();

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
insert into public.notification_categories (category, label, description, position, default_channel, allow_instant) values
  ('record', 'Your Record', 'New entries on your Record, revocations, corrections and the ones you confirm as an officer.', 25, 'digest', true);
insert into public.notification_types (type, category, emailed) values
  ('record_entry', 'record', false),
  ('record_revoked', 'record', true),
  ('record_confirm', 'record', true),
  ('record_mistake', 'record', true),
  ('record_mistake_declined', 'record', false),
  ('ranking_formula', 'record', false);

-- ---------------------------------------------------------------------------
-- Signing: queue, wake, prepare and commit (cv-sign "record_drain")
-- ---------------------------------------------------------------------------
select pgmq.create('record_jobs');

create function private.record_enqueue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
    perform pgmq.send('record_jobs', jsonb_build_object('entry_id', new.id));
  end if;
  return null;
end;
$$;
revoke all on function private.record_enqueue() from public;
create trigger record_entries_enqueue after insert or update of status on public.record_entries
  for each row execute function private.record_enqueue();

create function private.wake_record_worker()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from pgmq.q_record_jobs where vt <= now()) then
    perform private.cv_call_worker('{"action":"record_drain"}'::jsonb);
  end if;
end;
$$;
revoke all on function private.wake_record_worker() from public;

-- What the worker signs (RecordEntryV1.entry): only for a pending entry with an owner.
create function private.record_sign_prepare(p_entry uuid)
returns table (payload jsonb, issued_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'schema', 'skilient.record/1',
           'id', e.id::text,
           'kind', e.kind,
           'title', e.title,
           'issuer', jsonb_build_object('type', e.issuer_type, 'name', e.issuer_name),
           'holder', jsonb_build_object('name', p.full_name, 'university', u.name),
           'date', to_char(e.occurred_on, 'YYYY-MM-DD'),
           'evidence', e.evidence,
           'supersedes', (select o.code from public.record_entries o where o.id = e.supersedes)),
         date_trunc('second', now())
    from public.record_entries e
    join public.profiles p on p.user_id = e.user_id
    join public.universities u on u.id = p.university_id
   where e.id = p_entry and e.status = 'pending' and e.user_id is not null;
$$;
revoke all on function private.record_sign_prepare(uuid) from public;

-- Seals a pending entry with its signature. Returns null when it is no longer pending.
create function private.record_sign_commit(p_entry uuid, p_code text, p_key_id text, p_issued_at timestamptz,
                                           p_payload jsonb, p_hash text, p_signature text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e public.record_entries;
begin
  update public.record_entries
     set status = 'sealed', code = p_code, key_id = p_key_id, signed_at = p_issued_at, payload = p_payload,
         envelope_hash = p_hash, signature = p_signature
   where id = p_entry and status = 'pending'
  returning * into e;
  if e.id is null then
    return null;
  end if;
  -- A correction seals: the entry it corrects reads "Superseded by <code>", and the CV follows.
  if e.supersedes is not null then
    update public.record_entries set status = 'superseded', superseded_by = e.id, pinned_at = null
     where id = e.supersedes and status = 'sealed';
    update public.cv_settings set record_entries = array_replace(record_entries, e.supersedes, e.id)
     where user_id = e.user_id and e.supersedes = any (record_entries);
  end if;
  perform private.notify(e.user_id, null, 'record_entry', 'record_entry', e.id,
                         jsonb_build_object('kind', e.kind, 'title', e.title, 'issuer', e.issuer_name, 'code', e.code,
                                            'date', to_char(e.occurred_on, 'FMDD Mon YYYY'), 'corrected', e.supersedes is not null));
  perform private.track(e.user_id, 'record_entry_sealed', jsonb_build_object('kind', e.kind, 'issuer_type', e.issuer_type), null, null);
  return e.id;
end;
$$;
revoke all on function private.record_sign_commit(uuid, text, text, timestamptz, jsonb, text, text) from public;

-- ---------------------------------------------------------------------------
-- Issuing
-- ---------------------------------------------------------------------------
-- Internal: one entry. Society entries that name an officer who took part in issuing them wait
-- for a second officer (p_self). Returns the id, or null when it already exists.
create function private.issue_record_entry(p_user uuid, p_email_hash text, p_kind text, p_issuer_type text, p_issuer uuid,
                                           p_issuer_name text, p_source text, p_source_id uuid, p_title text, p_evidence jsonb,
                                           p_on date, p_issued_by uuid, p_self boolean default false, p_supersedes uuid default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_status text := case when p_user is null then 'held' when p_self then 'awaiting' else 'pending' end;
begin
  if p_user is null then
    insert into public.record_entries (claim_email_hash, kind, issuer_type, issuer_id, issuer_name, source, source_id, title,
                                       evidence, occurred_on, issued_by, status)
    values (p_email_hash, p_kind, p_issuer_type, p_issuer, p_issuer_name, p_source, p_source_id, left(btrim(p_title), 120),
            p_evidence, p_on, p_issued_by, 'held')
    on conflict (claim_email_hash, kind, source_id) where status = 'held' do nothing
    returning id into v_id;
  elsif p_supersedes is null then
    insert into public.record_entries (user_id, kind, issuer_type, issuer_id, issuer_name, source, source_id, title,
                                       evidence, occurred_on, issued_by, status)
    values (p_user, p_kind, p_issuer_type, p_issuer, p_issuer_name, p_source, p_source_id, left(btrim(p_title), 120),
            p_evidence, p_on, p_issued_by, v_status)
    on conflict (user_id, kind, source_id) where user_id is not null and status not in ('revoked', 'superseded') and supersedes is null do nothing
    returning id into v_id;
  else
    insert into public.record_entries (user_id, kind, issuer_type, issuer_id, issuer_name, source, source_id, title,
                                       evidence, occurred_on, issued_by, status, supersedes)
    values (p_user, p_kind, p_issuer_type, p_issuer, p_issuer_name, p_source, p_source_id, left(btrim(p_title), 120),
            p_evidence, p_on, p_issued_by, v_status, p_supersedes)
    returning id into v_id;
  end if;
  if v_id is not null and v_status = 'awaiting' then
    -- Every other officer of the issuing society can confirm it.
    perform private.notify(m.user_id, null, 'record_confirm', 'record_entry', v_id,
                           jsonb_build_object('title', p_title, 'society', p_issuer_name,
                                              'slug', (select s.slug from public.societies s where s.id = p_issuer)))
       from public.society_members m
      where m.society_id = p_issuer and m.role in ('president', 'officer') and m.user_id <> p_user;
  end if;
  return v_id;
end;
$$;
revoke all on function private.issue_record_entry(uuid, text, text, text, uuid, text, text, uuid, text, jsonb, date, uuid, boolean, uuid) from public;

-- An event's close-out becomes entries: Attended, Completed, Results and Volunteer hours, and
-- held entries for walk-ins added by email (with one claim email each).
create function private.issue_event_record(p_event uuid, p_preview jsonb, p_issued_by uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e public.events;
  s public.societies;
  v_on date;
  v_sessions integer;
  v_entrants integer;
  v_n integer := 0;
  v_hours numeric;
  v_id uuid;
  r record;
  v_hash text;
  v_user uuid;
  v_claim uuid;
begin
  select * into e from public.events where id = p_event;
  select * into s from public.societies where id = e.society_id;
  -- Only verified societies issue; a suspended one can't.
  if s.id is null or s.status <> 'verified' then
    return 0;
  end if;
  v_on := (e.ends_at at time zone 'Asia/Karachi')::date;
  select count(*)::integer into v_sessions from public.event_sessions where event_id = p_event;
  select round(sum(extract(epoch from x.ends_at - x.starts_at)) / 3600.0, 2) into v_hours from public.event_sessions x where x.event_id = p_event;

  -- Attended: the first check-in time is the evidence. Needs a second officer when the person
  -- is the issuing officer, or added their own check-in by hand.
  for r in
    select x.user_id,
           to_char(min(c.checked_in_at) at time zone 'Asia/Karachi', 'HH24:MI') as at,
           bool_or(c.checked_in_by = x.user_id and c.method in ('manual', 'search', 'email', 'walk_in')) as self_added
      from jsonb_array_elements_text(coalesce(p_preview -> 'attended', '[]')) a(user_id_text)
      cross join lateral (select a.user_id_text::uuid as user_id) x
      join public.event_checkins c on c.event_id = p_event and c.user_id = x.user_id and c.removed_at is null
     group by x.user_id
  loop
    v_id := private.issue_record_entry(r.user_id, null, 'attended', 'society', s.id, s.name, 'event', p_event, e.title,
                                       jsonb_build_object('line', 'Checked in ' || r.at), v_on, p_issued_by,
                                       r.user_id = p_issued_by or r.self_added);
    v_n := v_n + (v_id is not null)::integer;
  end loop;

  -- Completed: at least N of M sessions.
  for r in
    select x.user_id, count(distinct c.session_id)::integer as n,
           bool_or(c.checked_in_by = x.user_id and c.method in ('manual', 'search', 'email', 'walk_in')) as self_added
      from jsonb_array_elements_text(coalesce(p_preview -> 'completed', '[]')) a(user_id_text)
      cross join lateral (select a.user_id_text::uuid as user_id) x
      join public.event_checkins c on c.event_id = p_event and c.user_id = x.user_id and c.removed_at is null
     group by x.user_id
  loop
    v_id := private.issue_record_entry(r.user_id, null, 'completed', 'society', s.id, s.name, 'event', p_event, e.title,
                                       jsonb_build_object('line', r.n || ' of ' || v_sessions || ' sessions', 'sessions', r.n, 'of', v_sessions),
                                       v_on, p_issued_by, r.user_id = p_issued_by or r.self_added);
    v_n := v_n + (v_id is not null)::integer;
  end loop;

  -- Results: entrants are the teams (or people) that took part; each team member gets the placing.
  if jsonb_array_length(coalesce(p_preview -> 'results', '[]')) > 0 then
    if e.team_min is not null then
      select count(distinct t.id)::integer into v_entrants
        from public.event_teams t
       where t.event_id = p_event
         and (exists (select 1 from public.event_registrations g join public.event_checkins c on c.event_id = p_event and c.user_id = g.user_id and c.removed_at is null
                       where g.event_id = p_event and g.team_id = t.id and g.status = 'confirmed')
              or exists (select 1 from public.event_results x where x.event_id = p_event and x.team_id = t.id));
    else
      select count(*)::integer into v_entrants
        from (select c.user_id from public.event_checkins c where c.event_id = p_event and c.user_id is not null and c.removed_at is null
              union select x.user_id from public.event_results x where x.event_id = p_event and x.user_id is not null) q;
    end if;
    for r in
      select coalesce(g.user_id, x.user_id) as user_id, x.place, x.label, x.set_by
        from public.event_results x
        left join public.event_registrations g on x.team_id is not null and g.event_id = p_event and g.team_id = x.team_id and g.status = 'confirmed'
       where x.event_id = p_event and coalesce(g.user_id, x.user_id) is not null
    loop
      v_id := private.issue_record_entry(r.user_id, null, 'result', 'society', s.id, s.name, 'event', p_event, e.title,
                                         jsonb_build_object('line', coalesce(r.label, private.ordinal(r.place)) || ' of ' || v_entrants
                                                                    || case when e.team_min is not null then ' teams' else '' end,
                                                            'place', r.place, 'entrants', v_entrants),
                                         v_on, p_issued_by, r.user_id = p_issued_by or r.user_id = r.set_by);
      v_n := v_n + (v_id is not null)::integer;
    end loop;
  end if;

  -- Volunteer hours, capped at the activity's length when they were logged.
  for r in
    select v.user_id, v.hours, v.logged_by from public.volunteer_logs v
     where v.event_id = p_event and v.user_id in (select (x ->> 'user_id')::uuid from jsonb_array_elements(coalesce(p_preview -> 'volunteer', '[]')) x)
  loop
    v_id := private.issue_record_entry(r.user_id, null, 'volunteer', 'society', s.id, s.name, 'event', p_event, e.title,
                                       jsonb_build_object('line', trim_scale(round(r.hours, 1))::text || ' h · ' || e.title,
                                                          'minutes', round(r.hours * 60)::integer),
                                       v_on, p_issued_by, r.user_id = p_issued_by or r.user_id = r.logged_by);
    v_n := v_n + (v_id is not null)::integer;
  end loop;

  -- Walk-ins added by email: an account with that verified email gets the entry now; otherwise
  -- it is held and one claim email goes out.
  for r in
    select a.id, a.email, to_char(min(c.checked_in_at) at time zone 'Asia/Karachi', 'HH24:MI') as at
      from public.event_email_attendees a
      join public.event_checkins c on c.email_attendee_id = a.id and c.removed_at is null
     where a.event_id = p_event and a.email in (select jsonb_array_elements_text(coalesce(p_preview -> 'emails', '[]')))
     group by a.id, a.email
  loop
    if not ('attended' = any (e.record_kinds)) then
      exit;
    end if;
    v_hash := private.email_hash(r.email);
    select u.id into v_user from auth.users u where lower(u.email) = r.email and u.email_confirmed_at is not null limit 1;
    if v_user is not null then
      v_id := private.issue_record_entry(v_user, null, 'attended', 'society', s.id, s.name, 'event', p_event, e.title,
                                         jsonb_build_object('line', 'Checked in ' || r.at), v_on, p_issued_by, v_user = p_issued_by);
      update public.event_email_attendees set claimed_by = v_user where id = r.id and claimed_by is null;
    else
      v_id := private.issue_record_entry(null, v_hash, 'attended', 'society', s.id, s.name, 'event', p_event, e.title,
                                         jsonb_build_object('line', 'Checked in ' || r.at), v_on, p_issued_by);
      insert into public.record_claims (email_hash, event_id, email_attendee_id, expires_at)
      values (v_hash, p_event, r.id, now() + make_interval(days => private.record_limit('claim_days')))
      on conflict (email_hash, event_id) do nothing
      returning id into v_claim;
      if v_claim is not null then
        perform pgmq.send('notification_emails', jsonb_build_object('kind', 'record_claim', 'claim_id', v_claim));
      end if;
    end if;
    v_n := v_n + (v_id is not null)::integer;
  end loop;
  return v_n;
end;
$$;
revoke all on function private.issue_event_record(uuid, jsonb, uuid) from public;

-- Phase 15 stores the close-out in event_issuances (the officer's Issue, or the job at 72 hours):
-- the entries are made in the same transaction.
create function private.event_issuance_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.issue_event_record(new.event_id, new.preview, new.issued_by);
  update public.event_issuances set status = 'signed' where event_id = new.event_id;
  return null;
end;
$$;
revoke all on function private.event_issuance_record() from public;
create trigger event_issuances_record after insert on public.event_issuances
  for each row execute function private.event_issuance_record();

-- Office bearer: the term's confirmation (always by another officer, phase 15) issues it.
create function private.term_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.societies;
begin
  select * into s from public.societies where id = new.society_id;
  if s.status <> 'verified' then
    return null;
  end if;
  perform private.issue_record_entry(new.user_id, null, 'office_bearer', 'society', s.id, s.name, 'term', new.id, new.title,
                                     jsonb_build_object('line', new.title || ' · ' || to_char(new.term_start, 'Mon YYYY') || ' – ' || to_char(new.term_end, 'Mon YYYY'),
                                                        'role', new.role::text,
                                                        'from', to_char(new.term_start, 'YYYY-MM-DD'), 'to', to_char(new.term_end, 'YYYY-MM-DD')),
                                     new.term_end, new.confirmed_by, new.confirmed_by = new.user_id);
  return null;
end;
$$;
revoke all on function private.term_record() from public;
create trigger society_terms_record after update of confirmed_at on public.society_terms
  for each row when (old.confirmed_at is null and new.confirmed_at is not null) execute function private.term_record();

-- Venture completed (Skilient): each member with verified work at completion.
create function private.venture_completion_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.venture_completions;
  v_title text;
begin
  if new.verified_entries + new.github_days = 0 then
    return null;
  end if;
  select * into c from public.venture_completions where venture_id = new.venture_id;
  select v.title into v_title from public.ventures v where v.id = new.venture_id;
  perform private.issue_record_entry(new.user_id, null, 'venture_completed', 'skilient', null, 'Skilient', 'venture', new.venture_id,
                                     coalesce(v_title, 'Venture'),
                                     jsonb_build_object('line', 'Team of ' || c.team_size || ' · completed '
                                                                || to_char((c.completed_at at time zone 'Asia/Karachi')::date, 'FMDD Mon YYYY'),
                                                        'team_size', c.team_size::integer),
                                     (c.completed_at at time zone 'Asia/Karachi')::date, null);
  return null;
end;
$$;
revoke all on function private.venture_completion_record() from public;
create trigger venture_completion_members_record after insert on public.venture_completion_members
  for each row execute function private.venture_completion_record();

-- ---------------------------------------------------------------------------
-- Officers: confirm, correct, decline, revoke; the society's Record page
-- ---------------------------------------------------------------------------
create function private.require_entry_officer(p_entry uuid)
returns public.record_entries
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.record_entries;
begin
  select * into e from public.record_entries where id = p_entry;
  if e.id is null or e.issuer_type <> 'society' or e.status = 'held' or not private.is_society_officer(e.issuer_id) then
    raise exception 'entry not found' using errcode = 'P0002';
  end if;
  return e;
end;
$$;
revoke all on function private.require_entry_officer(uuid) from public;

create function private.confirm_record_entry(p_entry uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  e public.record_entries;
begin
  e := private.require_entry_officer(p_entry);
  if e.user_id = v_me or e.issued_by = v_me then
    raise exception 'a second officer confirms this entry' using errcode = '42501';
  end if;
  update public.record_entries set confirmed_by = v_me, status = 'pending' where id = p_entry and status = 'awaiting';
  if not found then
    raise exception 'this entry isn''t waiting for a confirmation' using errcode = '55000';
  end if;
  insert into public.society_audit_log (society_id, actor_id, action, before, after)
  values (e.issuer_id, v_me, 'record.confirm', jsonb_build_object('entry', e.id, 'status', 'awaiting'), jsonb_build_object('status', 'pending'));
end;
$$;

-- p: {title?, line?, place?, hours?}. A new entry supersedes the old one once it is signed.
create function private.correct_record_entry(p_entry uuid, p jsonb, p_note text default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  e public.record_entries;
  v_evidence jsonb;
  v_title text;
  v_id uuid;
begin
  e := private.require_entry_officer(p_entry);
  if e.status not in ('sealed', 'pending', 'awaiting') then
    raise exception 'only a live entry can be corrected' using errcode = '55000';
  end if;
  if e.status <> 'sealed' then
    raise exception 'wait until the entry is sealed, then correct it' using errcode = '55000';
  end if;
  if exists (select 1 from public.record_entries x where x.supersedes = e.id and x.status not in ('revoked', 'superseded')) then
    raise exception 'a correction of this entry is already waiting' using errcode = '23505';
  end if;
  v_title := coalesce(nullif(btrim(coalesce(p ->> 'title', '')), ''), e.title);
  if char_length(v_title) not between 2 and 120 then
    raise exception 'the title is 2 to 120 characters' using errcode = '22023';
  end if;
  v_evidence := e.evidence;
  if p ? 'place' and e.kind = 'result' then
    if (p ->> 'place')::integer not between 1 and 50 then
      raise exception 'a place is 1 to 50' using errcode = '22023';
    end if;
    v_evidence := v_evidence || jsonb_build_object('place', (p ->> 'place')::integer,
                                                   'line', private.ordinal((p ->> 'place')::integer) || ' of ' || (e.evidence ->> 'entrants')
                                                           || case when e.evidence ->> 'line' like '% teams' then ' teams' else '' end);
  end if;
  if p ? 'hours' and e.kind = 'volunteer' then
    if (p ->> 'hours')::numeric <= 0 or (p ->> 'hours')::numeric > 336 then
      raise exception 'hours are more than 0 and at most 336' using errcode = '22023';
    end if;
    v_evidence := v_evidence || jsonb_build_object('minutes', round((p ->> 'hours')::numeric * 60)::integer,
                                                   'line', trim_scale(round((p ->> 'hours')::numeric, 1))::text || ' h · ' || v_title);
  end if;
  if nullif(btrim(coalesce(p ->> 'line', '')), '') is not null then
    if char_length(btrim(p ->> 'line')) > 140 then
      raise exception 'the evidence line is at most 140 characters' using errcode = '22023';
    end if;
    v_evidence := v_evidence || jsonb_build_object('line', btrim(p ->> 'line'));
  end if;
  if v_title = e.title and v_evidence = e.evidence then
    raise exception 'nothing changed' using errcode = '22023';
  end if;
  v_id := private.issue_record_entry(e.user_id, null, e.kind, e.issuer_type, e.issuer_id, e.issuer_name, e.source, e.source_id,
                                     v_title, v_evidence, e.occurred_on, v_me, e.user_id = v_me, e.id);
  update public.record_entries set hidden = e.hidden, pinned_at = e.pinned_at where id = v_id and not e.hidden;
  update public.record_corrections set status = 'corrected', decided_by = v_me, decided_at = now(),
         decision_note = nullif(btrim(coalesce(p_note, '')), '')
   where entry_id = e.id and status = 'open';
  insert into public.society_audit_log (society_id, actor_id, action, before, after)
  values (e.issuer_id, v_me, 'record.correct', jsonb_build_object('entry', e.id, 'title', e.title, 'evidence', e.evidence),
          jsonb_build_object('entry', v_id, 'title', v_title, 'evidence', v_evidence));
  return v_id;
end;
$$;

create function private.decline_record_mistake(p_correction uuid, p_note text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  c public.record_corrections;
  e public.record_entries;
begin
  select * into c from public.record_corrections where id = p_correction and status = 'open';
  if c.id is null then
    raise exception 'report not found' using errcode = 'P0002';
  end if;
  e := private.require_entry_officer(c.entry_id);
  if char_length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'say why the entry stays as it is' using errcode = '22023';
  end if;
  update public.record_corrections set status = 'declined', decided_by = v_me, decided_at = now(), decision_note = btrim(p_note)
   where id = p_correction;
  perform private.notify(c.user_id, null, 'record_mistake_declined', 'record_entry', e.id,
                         jsonb_build_object('title', e.title, 'issuer', e.issuer_name, 'note', btrim(p_note)));
end;
$$;

-- p_category: issued_in_error | not_earned | misconduct | other. Officers of the issuing society,
-- or staff (trust reviewers and moderators; audited before and after).
create function private.revoke_record_entry(p_entry uuid, p_category text, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  e public.record_entries;
  v_staff boolean := private.is_staff('trust_reviewer') or private.is_staff('moderator');
begin
  select * into e from public.record_entries where id = p_entry for update;
  if e.id is null or e.status = 'held'
     or not (v_staff or (e.issuer_type = 'society' and private.is_society_officer(e.issuer_id))) then
    raise exception 'entry not found' using errcode = 'P0002';
  end if;
  if e.status not in ('sealed', 'pending', 'awaiting') then
    raise exception 'this entry is already %', e.status using errcode = '55000';
  end if;
  if p_category is null or p_category not in ('issued_in_error', 'not_earned', 'misconduct', 'other') then
    raise exception 'choose why it is revoked' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'give the reason the student will see' using errcode = '22023';
  end if;
  update public.record_entries
     set status = 'revoked', revoked_at = now(), revoked_by = v_me, revoked_category = p_category,
         revoked_reason = btrim(p_reason), pinned_at = null
   where id = p_entry;
  update public.cv_settings set record_entries = array_remove(record_entries, p_entry)
   where user_id = e.user_id and p_entry = any (record_entries);
  if v_staff and not (e.issuer_type = 'society' and private.is_society_officer(e.issuer_id)) then
    insert into public.ops_audit_log (staff_id, action, target_type, target_id, reason, before, after)
    values (v_me, 'record.revoke', 'record_entry', e.id::text, btrim(p_reason),
            jsonb_build_object('status', e.status, 'code', e.code), jsonb_build_object('status', 'revoked', 'category', p_category));
  else
    insert into public.society_audit_log (society_id, actor_id, action, before, after)
    values (e.issuer_id, v_me, 'record.revoke', jsonb_build_object('entry', e.id, 'status', e.status, 'code', e.code),
            jsonb_build_object('status', 'revoked', 'category', p_category, 'reason', btrim(p_reason)));
  end if;
  if e.status = 'sealed' then
    perform private.notify(e.user_id, null, 'record_revoked', 'record_entry', e.id,
                           jsonb_build_object('title', e.title, 'issuer', e.issuer_name, 'code', e.code, 'reason', btrim(p_reason)));
  end if;
end;
$$;

-- Everything an officer needs on the society's Record tab.
create function private.society_record_page(p_society uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
begin
  if not private.is_society_officer(p_society) then
    raise exception 'society not found' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'awaiting', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'title', e.title, 'line', e.evidence ->> 'line',
                                          'name', p.full_name, 'username', p.username, 'issued_at', e.issued_at,
                                          'can_confirm', e.user_id <> v_me and coalesce(e.issued_by <> v_me, true))
                       order by e.issued_at)
        from public.record_entries e join public.profiles p on p.user_id = e.user_id
       where e.issuer_id = p_society and e.status = 'awaiting'), '[]'::jsonb),
    'mistakes', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'entry_id', e.id, 'kind', e.kind, 'title', e.title, 'line', e.evidence ->> 'line',
                                          'place', e.evidence -> 'place', 'minutes', e.evidence -> 'minutes',
                                          'code', e.code, 'note', c.note, 'name', p.full_name, 'created_at', c.created_at)
                       order by c.created_at)
        from public.record_corrections c join public.record_entries e on e.id = c.entry_id join public.profiles p on p.user_id = c.user_id
       where e.issuer_id = p_society and c.status = 'open'), '[]'::jsonb),
    'entries', coalesce((
      select jsonb_agg(x order by (x ->> 'issued_at') desc)
        from (select jsonb_build_object('id', e.id, 'kind', e.kind, 'title', e.title, 'line', e.evidence ->> 'line', 'status', e.status,
                                        'code', e.code, 'name', p.full_name, 'username', p.username, 'issued_at', e.issued_at) as x
                from public.record_entries e join public.profiles p on p.user_id = e.user_id
               where e.issuer_id = p_society and e.status in ('pending', 'sealed', 'revoked', 'superseded')
               order by e.issued_at desc limit 200) q), '[]'::jsonb),
    'held', (select count(*) from public.record_entries e where e.issuer_id = p_society and e.status = 'held'));
end;
$$;

-- ---------------------------------------------------------------------------
-- Students: the Record, pins, hide, mistakes, share links, claims
-- ---------------------------------------------------------------------------
create function private.record_entry_json(e public.record_entries)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', e.id, 'kind', e.kind, 'title', e.title, 'issuer_type', e.issuer_type, 'issuer_name', e.issuer_name,
    'issuer_slug', (select s.slug from public.societies s where s.id = e.issuer_id),
    'issuer_logo', (select s.logo_path from public.societies s where s.id = e.issuer_id),
    'line', e.evidence ->> 'line', 'occurred_on', e.occurred_on, 'status', e.status, 'code', e.code, 'signed_at', e.signed_at,
    'issued_at', e.issued_at, 'hidden', e.hidden, 'pinned', e.pinned_at is not null, 'revoked_at', e.revoked_at,
    'revoked_reason', e.revoked_reason, 'revoked_category', e.revoked_category,
    'superseded_by_code', (select n.code from public.record_entries n where n.id = e.superseded_by),
    'academic_year', private.academic_year(e.occurred_on),
    'mistake_open', exists (select 1 from public.record_corrections c where c.entry_id = e.id and c.status = 'open'),
    'appealable', e.status = 'revoked' and e.revoked_at > now() - interval '30 days'
                  and not exists (select 1 from public.appeals a where a.decision_type = 'record_revocation' and a.decision_id = e.id));
$$;
revoke all on function private.record_entry_json(public.record_entries) from public;

create function private.my_record()
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
    'entries', coalesce((select jsonb_agg(private.record_entry_json(e) order by e.occurred_on desc, e.issued_at desc)
                           from public.record_entries e where e.user_id = v_me and e.status <> 'superseded'), '[]'::jsonb),
    'superseded', coalesce((select jsonb_agg(private.record_entry_json(e) order by e.occurred_on desc)
                              from public.record_entries e where e.user_id = v_me and e.status = 'superseded'), '[]'::jsonb),
    'waiting', private.record_waiting_count(v_me),
    'links', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'label', l.label, 'expires_at', l.expires_at,
                                                           'view_count', l.view_count, 'last_viewed_at', l.last_viewed_at, 'created_at', l.created_at)
                                        order by l.created_at desc)
                         from public.record_share_links l where l.user_id = v_me and l.revoked_at is null and l.expires_at > now()), '[]'::jsonb),
    'pins', private.record_limit('pins'),
    -- The empty state's suggestion: the next society event the student can register for.
    'next_event', (select jsonb_build_object('id', e.id, 'title', e.title, 'starts_at', e.starts_at,
                                             'society', (select s.name from public.societies s where s.id = e.society_id))
                     from public.events e
                    where e.society_id is not null and e.status = 'published' and e.starts_at > now()
                      and (e.university_id = private.current_university_id() or e.eligibility ->> 'scope' = 'all')
                    order by e.starts_at limit 1));
end;
$$;

-- Pin (3 at most) and hide (stays on the Record and its PDFs, not on the profile or share links).
create function private.set_record_display(p_entry uuid, p_pinned boolean, p_hidden boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  e public.record_entries;
begin
  select * into e from public.record_entries where id = p_entry and user_id = v_me for update;
  if e.id is null then
    raise exception 'entry not found' using errcode = 'P0002';
  end if;
  if p_pinned and (p_hidden or e.status <> 'sealed') then
    raise exception 'only a sealed entry you show can be pinned' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('record-pins:' || v_me::text, 0));
  if p_pinned and e.pinned_at is null
     and (select count(*) from public.record_entries x where x.user_id = v_me and x.pinned_at is not null) >= private.record_limit('pins') then
    raise exception 'up to % pinned entries: unpin one first', private.record_limit('pins') using errcode = '23514';
  end if;
  update public.record_entries
     set hidden = p_hidden, pinned_at = case when p_pinned then coalesce(pinned_at, now()) end
   where id = p_entry;
end;
$$;

create function private.report_record_mistake(p_entry uuid, p_note text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  e public.record_entries;
  v_id uuid;
begin
  select * into e from public.record_entries where id = p_entry and user_id = v_me;
  if e.id is null or e.status <> 'sealed' then
    raise exception 'entry not found' using errcode = 'P0002';
  end if;
  if e.issuer_type <> 'society' then
    raise exception 'Skilient entries come from your work itself: report it through Feedback' using errcode = '55000';
  end if;
  if char_length(btrim(coalesce(p_note, ''))) not between 10 and 1000 then
    raise exception 'say what is wrong in 10 to 1,000 characters' using errcode = '22023';
  end if;
  if not private.rate_limit('record-mistake:' || v_me::text, 10, interval '1 day') then
    raise exception 'up to 10 reports a day' using errcode = '54000';
  end if;
  insert into public.record_corrections (entry_id, user_id, note) values (p_entry, v_me, btrim(p_note))
  returning id into v_id;
  perform private.notify(m.user_id, v_me, 'record_mistake', 'record_entry', e.id,
                         jsonb_build_object('title', e.title, 'society', e.issuer_name,
                                            'slug', (select s.slug from public.societies s where s.id = e.issuer_id)))
     from public.society_members m where m.society_id = e.issuer_id and m.role in ('president', 'officer');
  return v_id;
exception when unique_violation then
  raise exception 'you already reported a mistake on this entry' using errcode = '23505';
end;
$$;

create function private.create_record_share_link(p_token_hash text, p_label text, p_days integer)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_id uuid;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or p_days is null or p_days not in (7, 30, 90) then
    raise exception 'invalid share link' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('record-links:' || v_me::text, 0));
  if (select count(*) from public.record_share_links l where l.user_id = v_me and l.revoked_at is null and l.expires_at > now())
       >= private.record_limit('share_links') then
    raise exception 'up to % active share links: revoke one first', private.record_limit('share_links') using errcode = '23514';
  end if;
  insert into public.record_share_links (user_id, token_hash, label, expires_at)
  values (v_me, p_token_hash, nullif(btrim(p_label), ''), now() + make_interval(days => p_days))
  returning id into v_id;
  return v_id;
end;
$$;

create function private.revoke_record_share_link(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.record_share_links set revoked_at = now()
   where id = p_id and user_id = (select auth.uid()) and revoked_at is null;
  if not found then
    raise exception 'share link not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Anyone with the link: the entries the student shows, newest first. Counted once per viewer a day.
create function private.open_record_share(p_token_hash text, p_viewer_key text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  l public.record_share_links;
begin
  select * into l from public.record_share_links
   where token_hash = p_token_hash and revoked_at is null and expires_at > now();
  if l.id is null then
    return jsonb_build_object('state', 'invalid');
  end if;
  if coalesce(p_viewer_key ~ '^[0-9a-f]{64}$', false) then
    if private.rate_limit('record-view:' || l.id::text || ':' || p_viewer_key, 1, interval '1 day') then
      update public.record_share_links set view_count = view_count + 1, last_viewed_at = now() where id = l.id;
    end if;
  end if;
  return jsonb_build_object(
    'state', 'ok',
    'expires_at', l.expires_at,
    'person', (select jsonb_build_object('name', p.full_name, 'username', p.username, 'university', u.name, 'department', p.department)
                 from public.profiles p join public.universities u on u.id = p.university_id where p.user_id = l.user_id),
    'entries', coalesce((select jsonb_agg(jsonb_build_object('kind', e.kind, 'title', e.title, 'issuer_name', e.issuer_name,
                                                             'issuer_type', e.issuer_type, 'line', e.evidence ->> 'line',
                                                             'occurred_on', e.occurred_on, 'code', e.code,
                                                             'academic_year', private.academic_year(e.occurred_on))
                                          order by e.occurred_on desc, e.signed_at desc)
                           from public.record_entries e where e.user_id = l.user_id and e.status = 'sealed' and not e.hidden), '[]'::jsonb));
end;
$$;

-- Pinned highlights on a profile, for anyone who can see that profile.
create function private.record_highlights(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'title', e.title, 'issuer_name', e.issuer_name,
                                               'line', e.evidence ->> 'line', 'occurred_on', e.occurred_on, 'code', e.code)
                            order by e.pinned_at), '[]'::jsonb)
    from public.record_entries e
   where e.user_id = p_user and e.status = 'sealed' and e.pinned_at is not null and not e.hidden
     and (select auth.uid()) is not null
     and not private.is_blocked(p_user, (select auth.uid()));
$$;

-- Claims: a verified address is matched to held claims at signup (or when it is verified).
create function private.record_match_claims()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is not null and new.email_confirmed_at is not null then
    update public.record_claims set user_id = new.id, matched_at = now()
     where email_hash = private.email_hash(new.email) and user_id is null and claimed_at is null and expires_at > now();
  end if;
  return null;
end;
$$;
revoke all on function private.record_match_claims() from public;
create trigger record_match_claims_insert after insert on auth.users
  for each row execute function private.record_match_claims();
create trigger record_match_claims_verified after update of email_confirmed_at on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null) execute function private.record_match_claims();

-- Held entries waiting for this account: matched claims whose hash is still the account's own verified email.
create function private.record_waiting_count(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
    from public.record_claims c
    join auth.users u on u.id = c.user_id
    join public.record_entries e on e.claim_email_hash = c.email_hash and e.source_id = c.event_id and e.status = 'held'
   where c.user_id = p_user and c.claimed_at is null and c.expires_at > now()
     and u.email_confirmed_at is not null and private.email_hash(u.email) = c.email_hash;
$$;
revoke all on function private.record_waiting_count(uuid) from public;

create function private.record_waiting()
returns integer
language sql
stable
security definer
set search_path = ''
as $$ select private.record_waiting_count((select auth.uid())) $$;

create function private.claim_record_entries()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_hash text;
  v_n integer := 0;
  v_k integer;
  c record;
begin
  select private.email_hash(u.email) into v_hash from auth.users u where u.id = v_me and u.email_confirmed_at is not null;
  if v_hash is null then
    raise exception 'verify your email first' using errcode = '42501';
  end if;
  for c in
    select * from public.record_claims
     where user_id = v_me and email_hash = v_hash and claimed_at is null and expires_at > now()
     for update
  loop
    -- An entry already on the Record for the same event (signed up before close-out) wins.
    update public.record_entries x set user_id = v_me, claim_email_hash = null, status = 'pending'
     where x.claim_email_hash = c.email_hash and x.source_id = c.event_id and x.status = 'held'
       and not exists (select 1 from public.record_entries y where y.user_id = v_me and y.kind = x.kind and y.source_id = x.source_id
                         and y.status not in ('revoked', 'superseded'));
    get diagnostics v_k = row_count;
    delete from public.record_entries where claim_email_hash = c.email_hash and source_id = c.event_id and status = 'held';
    update public.record_claims set claimed_at = now() where id = c.id;
    update public.event_email_attendees set claimed_by = v_me where id = c.email_attendee_id and claimed_by is null;
    v_n := v_n + v_k;
  end loop;
  if v_n > 0 then
    perform private.track(v_me, 'record_entries_claimed', jsonb_build_object('entries', v_n), null, null);
  end if;
  return v_n;
end;
$$;

-- What the notify worker needs for one claim email; marks it sent. Nothing once claimed, expired,
-- or when the address already belongs to an account.
create function private.record_claim_email(p_claim uuid)
returns table (email text, event_title text, society text, event_on date)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c public.record_claims;
  v_email text;
begin
  select * into c from public.record_claims where id = p_claim and claimed_at is null and user_id is null and expires_at > now() and sent_at is null
   for update;
  if c.id is null then
    return;
  end if;
  select a.email into v_email from public.event_email_attendees a where a.id = c.email_attendee_id;
  if v_email is null or private.email_hash(v_email) <> c.email_hash
     or exists (select 1 from auth.users u where lower(u.email) = v_email) then
    return;
  end if;
  update public.record_claims set sent_at = now() where id = c.id;
  return query
    select v_email, e.title, s.name, (e.ends_at at time zone 'Asia/Karachi')::date
      from public.events e join public.societies s on s.id = e.society_id where e.id = c.event_id;
end;
$$;
revoke all on function private.record_claim_email(uuid) from public, anon, authenticated;

-- Nightly: unclaimed entries go after 180 days, with their claims.
create function private.record_claims_expire()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  with gone as (
    delete from public.record_claims c where c.claimed_at is null and c.expires_at <= now() returning c.email_hash, c.event_id
  ), entries as (
    delete from public.record_entries e using gone g
     where e.status = 'held' and e.claim_email_hash = g.email_hash and e.source_id = g.event_id
    returning e.id
  )
  select count(*)::integer into v_n from entries;
  -- Held entries without a claim row (never emailed) follow the same clock.
  delete from public.record_entries
   where status = 'held' and issued_at <= now() - make_interval(days => private.record_limit('claim_days'));
  return v_n;
end;
$$;
revoke all on function private.record_claims_expire() from public;

-- ---------------------------------------------------------------------------
-- Verify (anyone) and PDFs
-- ---------------------------------------------------------------------------
-- A revoked entry shows only its code, dates and the reason's category.
create function private.verify_record_entry(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when e.status = 'revoked' then
           jsonb_build_object('code', e.code, 'status', 'revoked', 'signed_at', e.signed_at, 'revoked_at', e.revoked_at,
                              'revoked_category', e.revoked_category)
         else
           jsonb_build_object('code', e.code, 'status', e.status, 'signed_at', e.signed_at, 'key_id', e.key_id,
                              'public_key', k.public_key, 'payload', e.payload, 'envelope_hash', e.envelope_hash,
                              'signature', e.signature,
                              'superseded_by_code', (select n.code from public.record_entries n where n.id = e.superseded_by))
         end
    from public.record_entries e
    join public.signing_keys k on k.key_id = e.key_id
   where e.code = upper(p_code) and e.status in ('sealed', 'revoked', 'superseded');
$$;

-- The transcript's QR: who it was made for, and every entry on it with its status today.
create function private.verify_record_transcript(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', x.id, 'kind', x.kind, 'holder_name', x.holder_name, 'created_at', x.created_at, 'pdf_hash', x.pdf_hash,
    'entries', coalesce((select jsonb_agg(jsonb_build_object('code', c.code, 'status', coalesce(e.status, 'not_found'),
                                                             'title', case when e.status <> 'revoked' then e.title end,
                                                             'issuer_name', case when e.status <> 'revoked' then e.issuer_name end,
                                                             'occurred_on', case when e.status <> 'revoked' then e.occurred_on end)
                                          order by c.ord)
                           from unnest(x.codes) with ordinality as c(code, ord)
                           left join public.record_entries e on e.code = c.code), '[]'::jsonb))
    from public.record_pdf_exports x where x.id = p_id;
$$;

-- Records a certificate or transcript the PDF route made (MAC with Vault cv_export_secret,
-- the same secret as CV exports): every code must be the student's own sealed entry.
create function private.record_pdf_export(p_export uuid, p_kind text, p_entry uuid, p_codes text[], p_pdf_hash text,
                                          p_bytes integer, p_mac text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_secret text;
  v_name text;
begin
  if p_kind not in ('certificate', 'transcript') or p_codes is null or cardinality(p_codes) = 0 or p_pdf_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid export' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_codes) c
              where not exists (select 1 from public.record_entries e where e.code = c and e.user_id = v_me and e.status = 'sealed'))
     or (p_kind = 'certificate' and (cardinality(p_codes) <> 1
                                     or not exists (select 1 from public.record_entries e where e.id = p_entry and e.code = p_codes[1]))) then
    raise exception 'entry not found' using errcode = 'P0002';
  end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cv_export_secret';
  if v_secret is null or p_mac is null or p_mac <> encode(extensions.hmac(
       p_export::text || '|' || p_kind || '|' || coalesce(p_entry::text, '') || '|' || array_to_string(p_codes, ',') || '|' || p_pdf_hash || '|' || p_bytes::text,
       v_secret, 'sha256'), 'hex') then
    raise exception 'this export wasn''t made by Skilient' using errcode = '42501';
  end if;
  if not private.rate_limit('record-pdf:' || v_me::text, 30, interval '1 day') then
    raise exception 'up to 30 PDFs a day' using errcode = '54000';
  end if;
  select full_name into v_name from public.profiles where user_id = v_me;
  insert into public.record_pdf_exports (id, user_id, kind, entry_id, holder_name, codes, pdf_hash, bytes)
  values (p_export, v_me, p_kind, case when p_kind = 'certificate' then p_entry end, v_name, p_codes, p_pdf_hash, p_bytes);
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff: look up an entry by code (revocation is revoke_record_entry, audited)
-- ---------------------------------------------------------------------------
create function private.ops_record_entry(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.is_staff('trust_reviewer') or private.is_staff('moderator')) then
    raise exception 'trust reviewers and moderators only, with two-factor on' using errcode = '42501';
  end if;
  return (select private.record_entry_json(e) || jsonb_build_object('holder', p.full_name, 'username', p.username,
                                                                     'evidence', e.evidence, 'issued_by', ib.full_name)
            from public.record_entries e
            left join public.profiles p on p.user_id = e.user_id
            left join public.profiles ib on ib.user_id = e.issued_by
           where e.code = upper(btrim(coalesce(p_code, ''))));
end;
$$;

-- ---------------------------------------------------------------------------
-- Reports (5.12): an entry can be reported by anyone who can see it
-- ---------------------------------------------------------------------------
create or replace function private.report_snapshot(p_type public.report_target, p_target uuid)
returns table (owner_id uuid, snapshot jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select p.author_id, jsonb_build_object('body', p.body, 'type', p.type, 'audience', p.audience, 'author', a.full_name,
                                         'author_username', a.username, 'created_at', p.created_at,
                                         'images', (select count(*) from public.post_media m where m.post_id = p.id))
    from public.posts p join public.profiles a on a.user_id = p.author_id
   where p_type = 'post' and p.id = p_target
  union all
  select c.author_id, jsonb_build_object('body', c.body, 'post_id', c.post_id, 'author', a.full_name,
                                         'author_username', a.username, 'created_at', c.created_at)
    from public.post_comments c join public.profiles a on a.user_id = c.author_id
   where p_type = 'comment' and c.id = p_target
  union all
  select m.sender_id, jsonb_build_object('body', m.body, 'thread_type', t.type, 'author', a.full_name,
                                         'author_username', a.username, 'created_at', m.created_at, 'had_image', m.media_path is not null)
    from public.chat_messages m join public.chat_threads t on t.id = m.thread_id join public.profiles a on a.user_id = m.sender_id
   where p_type = 'message' and m.id = p_target
  union all
  select p.user_id, jsonb_build_object('author', p.full_name, 'author_username', p.username, 'bio', p.bio,
                                       'department', p.department, 'had_avatar', p.avatar_path is not null)
    from public.profiles p
   where p_type = 'profile' and p.user_id = p_target
  union all
  select v.owner_id, jsonb_build_object('title', v.title, 'body', v.description, 'venture_type', v.type,
                                        'author', o.full_name, 'author_username', o.username, 'created_at', v.created_at)
    from public.ventures v join public.profiles o on o.user_id = v.owner_id
   where p_type = 'venture' and v.id = p_target
  union all
  select (select m.user_id from public.society_members m where m.society_id = s.id and m.role = 'president'),
         jsonb_build_object('title', s.name, 'body', s.about, 'society_slug', s.slug, 'status', s.status, 'created_at', s.created_at)
    from public.societies s
   where p_type = 'society' and s.id = p_target
  union all
  select e.created_by, jsonb_build_object('title', e.title, 'body', e.description, 'event_type', e.type, 'starts_at', e.starts_at,
                                          'society', (select s.name from public.societies s where s.id = e.society_id), 'created_at', e.created_at)
    from public.events e
   where p_type = 'event' and e.id = p_target
  union all
  select (select m.user_id from public.society_members m where m.society_id = e.society_id and m.role = 'president'),
         jsonb_build_object('title', e.title, 'student', a.full_name, 'student_username', a.username, 'status', r.status,
                            'payment', (select jsonb_build_object('amount_pkr', x.amount_pkr, 'reference_code', x.reference_code, 'status', x.status,
                                                                  'refund_status', x.refund_status, 'transaction_id', x.transaction_id,
                                                                  'receipt_path', x.receipt_path, 'uploaded_at', x.uploaded_at)
                                          from public.event_payments x where x.registration_id = r.id),
                            'society', (select s.name from public.societies s where s.id = e.society_id), 'created_at', r.registered_at)
    from public.event_registrations r join public.events e on e.id = r.event_id join public.profiles a on a.user_id = r.user_id
   where p_type = 'event_registration' and r.id = p_target
  union all
  -- The entry's holder owns the case; the snapshot names the issuer and what it says.
  select e.user_id, jsonb_build_object('title', e.title, 'body', e.evidence ->> 'line', 'kind', e.kind, 'issuer', e.issuer_name,
                                       'code', e.code, 'author', a.full_name, 'author_username', a.username, 'created_at', e.signed_at)
    from public.record_entries e join public.profiles a on a.user_id = e.user_id
   where p_type = 'record_entry' and e.id = p_target;
$$;

create or replace function private.can_report(p_type public.report_target, p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_type
    when 'post' then private.can_view_post(p_target)
    when 'comment' then exists (select 1 from public.post_comments c
                                 where c.id = p_target and c.deleted_at is null and private.can_view_post(c.post_id))
    when 'message' then exists (select 1 from public.chat_messages m
                                 where m.id = p_target and m.deleted_at is null
                                   and private.is_thread_member(m.thread_id) and not private.dm_blocked(m.thread_id))
    when 'profile' then exists (select 1 from public.profiles p where p.user_id = p_target and p.onboarding_complete)
    when 'venture' then private.can_view_venture(p_target)
    when 'society' then private.can_see_society(p_target)
    when 'event' then exists (select 1 from public.events e where e.id = p_target and e.society_id is not null and e.status <> 'draft'
                                and (e.university_id = private.current_university_id() or e.eligibility ->> 'scope' = 'all'))
    when 'event_registration' then exists (select 1 from public.event_registrations r where r.id = p_target and r.user_id = (select auth.uid()))
    -- A pinned (visible) entry, or one an officer of its society can see.
    when 'record_entry' then exists (select 1 from public.record_entries e
                                      where e.id = p_target and e.status = 'sealed' and e.user_id <> (select auth.uid())
                                        and ((e.pinned_at is not null and not e.hidden)
                                             or (e.issuer_type = 'society' and private.is_society_officer(e.issuer_id))))
    else false
  end;
$$;

-- ---------------------------------------------------------------------------
-- Appeals (5.26): a revocation can be appealed; overturned issues it again under a new code
-- ---------------------------------------------------------------------------
create or replace function private.appeal_subject(p_type public.appeal_decision_type, p_id uuid)
returns table (owner_id uuid, org_id uuid, staff_id uuid, decided_at timestamptz, decider_role public.staff_role, summary jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_type = 'sanction' then
    return query
    select s.user_id, s.org_id, s.staff_id, s.created_at,
           (case when s.org_id is not null then 'accounts' when s.kind = 'ban' then 'super_admin' else 'moderator' end)::public.staff_role,
           jsonb_build_object('kind', s.kind, 'until', s.until, 'per_day', s.per_day, 'reason', s.reason,
                              'org_name', (select o.name from public.organizations o where o.id = s.org_id))
      from public.sanctions s
     where s.id = p_id and s.lifted_at is null and (s.until is null or s.until > now())
       and not (s.kind = 'warn' and s.case_id is not null);
  elsif p_type = 'report_case' then
    return query
    select c.owner_id, null::uuid, c.resolved_by, c.resolved_at, 'moderator'::public.staff_role,
           jsonb_build_object('status', c.status, 'target_type', c.target_type, 'reason', c.resolution_reason,
                              'excerpt', left(coalesce(c.snapshot->>'body', c.snapshot->>'bio', c.snapshot->>'title', ''), 200))
      from public.report_cases c
     where c.id = p_id and c.status in ('removed', 'warned') and c.owner_id is not null and c.resolved_by is not null;
  elsif p_type = 'cv_revocation' then
    return query
    select r.user_id, null::uuid, r.revoked_by, r.revoked_at, 'trust_reviewer'::public.staff_role,
           jsonb_build_object('code', r.code, 'version', r.version)
      from public.cv_records r
     where r.id = p_id and r.revoked_reason = 'staff' and r.revoked_by is not null and r.user_id is not null;
  elsif p_type = 'credential' then
    return query
    select c.user_id, null::uuid, c.reviewer_id, c.reviewed_at, 'trust_reviewer'::public.staff_role,
           jsonb_build_object('title', c.title, 'issuer', c.issuer, 'reason', c.review_reason)
      from public.credentials c
     where c.id = p_id and c.status = 'rejected' and c.reviewer_id is not null;
  elsif p_type = 'code_check' then
    return query
    select c.user_id, null::uuid, c.grader_id, c.graded_at, 'trust_reviewer'::public.staff_role,
           jsonb_build_object('skill', (select k.name from public.skills k where k.id = c.skill_id), 'feedback', c.feedback)
      from public.code_checks c
     where c.id = p_id and c.status = 'failed' and c.grader_id is not null;
  elsif p_type = 'record_revocation' then
    -- Revoked by the society's officers or by staff; a trust reviewer decides the appeal.
    return query
    select e.user_id, null::uuid, e.revoked_by, e.revoked_at, 'trust_reviewer'::public.staff_role,
           jsonb_build_object('code', e.code, 'title', e.title, 'issuer', e.issuer_name, 'category', e.revoked_category,
                              'reason', e.revoked_reason)
      from public.record_entries e
     where e.id = p_id and e.status = 'revoked' and e.user_id is not null and e.code is not null;
  end if;
end;
$$;

create or replace function private.my_appealable()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  candidates as (
    select 'sanction'::public.appeal_decision_type as t, s.id from public.sanctions s, me
     where s.user_id = me.id or s.org_id in (select om.org_id from public.org_members om where om.user_id = me.id and om.role = 'admin' and om.status = 'active')
    union all select 'report_case', c.id from public.report_cases c, me where c.owner_id = me.id
    union all select 'cv_revocation', r.id from public.cv_records r, me where r.user_id = me.id and r.revoked_reason = 'staff'
    union all select 'credential', c.id from public.credentials c, me where c.user_id = me.id and c.status = 'rejected'
    union all select 'code_check', c.id from public.code_checks c, me where c.user_id = me.id and c.status = 'failed'
    union all select 'record_revocation', e.id from public.record_entries e, me where e.user_id = me.id and e.status = 'revoked'
  )
  select coalesce(jsonb_agg(jsonb_build_object('type', c.t, 'id', c.id, 'decided_at', x.decided_at, 'summary', x.summary,
                                               'deadline', x.decided_at + interval '30 days')
                            order by x.decided_at desc), '[]'::jsonb)
    from candidates c
    cross join lateral private.appeal_subject(c.t, c.id) x
   where x.decided_at > now() - interval '30 days'
     and not exists (select 1 from public.appeals a where a.decision_type = c.t and a.decision_id = c.id);
$$;

create or replace function private.submit_appeal(p_type text, p_id uuid, p_body text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if p_type not in ('sanction', 'report_case', 'cv_revocation', 'credential', 'code_check', 'record_revocation') then
    raise exception 'this decision can''t be appealed' using errcode = '22023';
  end if;
  return private.file_appeal(p_type::public.appeal_decision_type, p_id, p_body, v_me, null);
end;
$$;

create or replace function private.ops_file_appeal(p_type text, p_id uuid, p_body text, p_reason text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_any_staff();
  x record;
  v_id uuid;
begin
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'give a reason' using errcode = '22023';
  end if;
  if p_type not in ('sanction', 'report_case', 'cv_revocation', 'credential', 'code_check', 'record_revocation') then
    raise exception 'this decision can''t be appealed' using errcode = '22023';
  end if;
  select * into x from private.appeal_subject(p_type::public.appeal_decision_type, p_id);
  if x.decided_at is null or x.owner_id is null then
    raise exception 'this decision can''t be appealed' using errcode = 'P0002';
  end if;
  v_id := private.file_appeal(p_type::public.appeal_decision_type, p_id, p_body, x.owner_id, v_me);
  insert into public.ops_audit_log (staff_id, action, target_type, target_id, reason, before, after)
  values (v_me, 'appeal.file_for_user', 'appeal', v_id::text, btrim(p_reason), null,
          jsonb_build_object('decision_type', p_type, 'decision_id', p_id, 'appellant_id', x.owner_id));
  return v_id;
end;
$$;

-- The original overturn_decision, renamed; the new one handles Record revocations and defers the rest.
alter function private.overturn_decision(public.appeals, uuid, text) rename to overturn_decision_base;
create function private.overturn_decision(a public.appeals, p_staff uuid, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e public.record_entries;
  v_id uuid;
begin
  if a.decision_type <> 'record_revocation' then
    return private.overturn_decision_base(a, p_staff, p_reason);
  end if;
  -- A signed revocation stands; the same entry is issued again under a new code.
  select * into e from public.record_entries where id = a.decision_id;
  v_id := private.issue_record_entry(e.user_id, null, e.kind, e.issuer_type, e.issuer_id, e.issuer_name, e.source, e.source_id,
                                     e.title, e.evidence, e.occurred_on, p_staff);
  return jsonb_build_object('reissued', v_id is not null, 'entry_id', v_id);
end;
$$;
revoke all on function private.overturn_decision(public.appeals, uuid, text), private.overturn_decision_base(public.appeals, uuid, text) from public;

-- ---------------------------------------------------------------------------
-- CV: "Leadership and activities" (the student picks entries; evidence stays on the verify page)
-- ---------------------------------------------------------------------------
alter table public.cv_settings
  add column record_entries uuid[] not null default '{}' check (cardinality(record_entries) <= 20);

create or replace function private.cv_all_sections()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['summary', 'projects', 'open_source', 'skills', 'activities', 'endorsements', 'credentials', 'education'] $$;
alter table public.cv_settings alter column sections set default private.cv_all_sections();
update public.cv_settings
   set sections = private.cv_all_sections()
 where sections = array['summary', 'projects', 'open_source', 'skills', 'endorsements', 'credentials', 'education'];

create function private.save_cv_activities(p_entries uuid[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_ids uuid[] := coalesce((select array_agg(distinct x) from unnest(coalesce(p_entries, '{}')) x), '{}');
begin
  if cardinality(v_ids) > private.record_limit('cv_entries') then
    raise exception 'up to % entries on your CV', private.record_limit('cv_entries') using errcode = '23514';
  end if;
  if exists (select 1 from unnest(v_ids) x
              where not exists (select 1 from public.record_entries e where e.id = x and e.user_id = v_me and e.status = 'sealed')) then
    raise exception 'entry not found' using errcode = 'P0002';
  end if;
  -- Keep the student's order of the Record (newest first) rather than the order picked.
  v_ids := coalesce((select array_agg(e.id order by e.occurred_on desc, e.signed_at desc) from public.record_entries e where e.id = any (v_ids)), '{}');
  insert into public.cv_settings (user_id, record_entries) values (v_me, v_ids)
  on conflict (user_id) do update
    set record_entries = excluded.record_entries,
        sections = case when cardinality(excluded.record_entries) > 0 and not ('activities' = any (public.cv_settings.sections))
                        then public.cv_settings.sections || array['activities'] else public.cv_settings.sections end,
        updated_at = now();
end;
$$;

create function private.cv_activities(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind', e.kind,
           'label', case e.kind
                      when 'office_bearer' then e.title
                      when 'result' then coalesce(case when (e.evidence ->> 'place')::integer <= 3 then private.ordinal((e.evidence ->> 'place')::integer) || ' place'
                                                       else 'Finalist' end, 'Result') || ', ' || e.title
                      when 'volunteer' then 'Volunteer, ' || e.title
                      when 'attended' then 'Attended ' || e.title
                      when 'completed' then 'Completed ' || e.title
                      when 'venture_completed' then 'Completed project ' || e.title
                      when 'taught' then 'Taught ' || e.title
                      else e.title end,
           'issuer', e.issuer_name,
           'when', case when e.kind = 'office_bearer' and e.evidence ? 'from'
                        then to_char((e.evidence ->> 'from')::date, 'Mon YYYY') || ' – ' || to_char((e.evidence ->> 'to')::date, 'Mon YYYY')
                        else to_char(e.occurred_on, 'Mon YYYY') end,
           'line', coalesce(e.evidence ->> 'line', ''),
           'code', e.code)
           order by e.occurred_on desc, e.signed_at desc), '[]'::jsonb)
    from public.cv_settings s
    join public.record_entries e on e.id = any (s.record_entries) and e.user_id = s.user_id and e.status = 'sealed'
   where s.user_id = p_user;
$$;
revoke all on function private.cv_activities(uuid) from public;

-- The snapshot gains `activities` (CvSnapshotV1.activities, optional for older CVs).
alter function private.cv_snapshot(uuid) rename to cv_snapshot_v15;
create function private.cv_snapshot(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb := private.cv_snapshot_v15(p_user);
begin
  if v is null then
    return v;
  end if;
  return v || jsonb_build_object('activities', private.cv_activities(p_user));
end;
$$;
revoke all on function private.cv_snapshot(uuid), private.cv_snapshot_v15(uuid) from public;

-- ---------------------------------------------------------------------------
-- Ranking formula v2 (PRD 5.30): a Record component, at most 100 points, merit only
-- ---------------------------------------------------------------------------
insert into public.platform_config (key, version, value, reason)
select 'ranking.formula', 2,
       jsonb_set(c.value, '{caps,record}', '100'::jsonb)
         || jsonb_build_object('record', jsonb_build_object(
              'president', 35, 'officer', 25,
              'places', jsonb_build_object('1', 30, '2', 20, '3', 15), 'finalist', 10, 'min_entrants', 5,
              'volunteer_hour', 2, 'volunteer_year_cap', 20, 'society_cap', 50, 'hold_days', 30)),
       'PRD 5.30 formula v2: adds the Record component (at most 100 points; office-bearer terms, results with 5+ entrants, volunteer hours; 50 per society; attendance never counts)'
  from public.platform_config c where c.key = 'ranking.formula' and c.version = 1;

update public.config_keys
   set schema = jsonb_set(jsonb_set(jsonb_set(schema, '{properties,caps,properties,record}', '{"type": "number", "minimum": 0}'),
                                    '{properties,caps,required}', (schema #> '{properties,caps,required}') || '["record"]'::jsonb),
                          '{properties,record}', '{"type": "object", "additionalProperties": false,
                            "required": ["president", "officer", "places", "finalist", "min_entrants", "volunteer_hour", "volunteer_year_cap", "society_cap", "hold_days"],
                            "properties": {"president": {"type": "number", "minimum": 0}, "officer": {"type": "number", "minimum": 0},
                              "places": {"type": "object", "additionalProperties": {"type": "number", "minimum": 0}},
                              "finalist": {"type": "number", "minimum": 0}, "min_entrants": {"type": "integer", "minimum": 1},
                              "volunteer_hour": {"type": "number", "minimum": 0}, "volunteer_year_cap": {"type": "number", "minimum": 0},
                              "society_cap": {"type": "number", "minimum": 0}, "hold_days": {"type": "integer", "minimum": 0}}}'::jsonb)
         || jsonb_build_object('required', (schema -> 'required') || '["record"]'::jsonb),
       updated_at = now()
 where key = 'ranking.formula' and not (schema -> 'properties' ? 'record');

-- Record: counted entries are sealed society entries of a merit kind, from a society verified at
-- least hold_days before as_of. One office-bearer term per society per academic year (the
-- higher), results with at least min_entrants, volunteer hours capped per academic year, then
-- at most society_cap per society and the component cap overall. Attendance never counts.
create function private.score_record(p_user uuid, p_f jsonb, p_as_of timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r jsonb := p_f -> 'record';
  v_items jsonb;
  v_societies jsonb;
  v_sum numeric;
begin
  if r is null then
    return jsonb_build_object('points', 0, 'items', '[]'::jsonb, 'societies', '[]'::jsonb);
  end if;
  with base as (
    select e.id, e.kind, e.issuer_id, e.occurred_on, e.evidence, private.academic_year(e.occurred_on) as year
      from public.record_entries e
      join public.societies s on s.id = e.issuer_id
     where e.user_id = p_user and e.status = 'sealed' and e.issuer_type = 'society'
       and e.kind in ('office_bearer', 'result', 'volunteer')
       and s.verified_at is not null and s.verified_at + make_interval(days => (r ->> 'hold_days')::integer) <= p_as_of
       and e.signed_at <= p_as_of
  ),
  terms as (
    select distinct on (b.issuer_id, b.year) b.id, b.kind, b.issuer_id, b.year,
           case when b.evidence ->> 'role' = 'president' then (r ->> 'president')::numeric else (r ->> 'officer')::numeric end as points
      from base b where b.kind = 'office_bearer'
     order by b.issuer_id, b.year, case when b.evidence ->> 'role' = 'president' then 0 else 1 end, b.occurred_on desc, b.id
  ),
  results as (
    select b.id, b.kind, b.issuer_id, b.year,
           coalesce((r -> 'places' ->> ((b.evidence ->> 'place')::integer)::text)::numeric, (r ->> 'finalist')::numeric) as points
      from base b
     where b.kind = 'result' and coalesce((b.evidence ->> 'entrants')::integer, 0) >= (r ->> 'min_entrants')::integer
  ),
  vol_raw as (
    select b.id, b.kind, b.issuer_id, b.year, b.occurred_on,
           (r ->> 'volunteer_hour')::numeric * coalesce((b.evidence ->> 'minutes')::numeric, 0) / 60.0 as raw
      from base b where b.kind = 'volunteer'
  ),
  -- The yearly volunteer cap fills in date order.
  vol as (
    select v.id, v.kind, v.issuer_id, v.year,
           greatest(0, least(v.raw, (r ->> 'volunteer_year_cap')::numeric
                                    - coalesce(sum(v.raw) over (partition by v.year order by v.occurred_on, v.id
                                                                rows between unbounded preceding and 1 preceding), 0))) as points
      from vol_raw v
  ),
  items as (select * from terms union all select * from results union all select * from vol),
  per_society as (
    select i.issuer_id, sum(i.points) as raw, least((r ->> 'society_cap')::numeric, sum(i.points)) as points
      from items i group by i.issuer_id
  )
  select coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'kind', i.kind, 'society_id', i.issuer_id, 'year', i.year,
                                                       'points', round(i.points, 2)) order by i.issuer_id, i.year, i.kind, i.id)
                     from items i), '[]'::jsonb),
         coalesce((select jsonb_agg(jsonb_build_object('society_id', p.issuer_id, 'raw', round(p.raw, 2), 'points', round(p.points, 2))
                                    order by p.issuer_id) from per_society p), '[]'::jsonb),
         coalesce((select sum(p.points) from per_society p), 0)
    into v_items, v_societies, v_sum;
  return jsonb_build_object('points', round(least((p_f -> 'caps' ->> 'record')::numeric, v_sum), 2),
                            'items', v_items, 'societies', v_societies);
end;
$$;
revoke all on function private.score_record(uuid, jsonb, timestamptz) from public;

create or replace function private.compute_ranking(p_user uuid, p_as_of timestamptz default now(), p_f jsonb default null,
                                                   p_prev_peak numeric default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  f jsonb := coalesce(p_f, (select value from private.ranking_formula()));
  v_work jsonb;
  v_skills jsonb;
  v_endorsements jsonb;
  v_credentials jsonb;
  v_record jsonb;
  v_momentum jsonb;
  v_adjustments jsonb;
  v_proof numeric;
  v_facts jsonb;
begin
  v_work := private.score_work(p_user, f);
  v_skills := private.score_skills(p_user, f);
  v_endorsements := private.score_endorsements(p_user, f);
  v_credentials := private.score_credentials(p_user, f, (p_as_of at time zone 'Asia/Karachi')::date);
  -- Formula v2 (PRD 5.30); a v1 formula has no record weights and scores it 0.
  v_record := private.score_record(p_user, f, p_as_of);
  v_momentum := private.score_momentum(p_user, f, p_as_of,
                                       coalesce(p_prev_peak, (select s.momentum_peak from public.ranking_scores s where s.user_id = p_user), 0));
  v_adjustments := private.score_adjustments(p_user, f, p_as_of);
  v_proof := (v_work->>'points')::numeric + (v_skills->>'points')::numeric + (v_endorsements->>'points')::numeric
             + (v_credentials->>'points')::numeric + (v_record->>'points')::numeric;
  select jsonb_build_object(
           'peer_verified_entries', (select count(*) from private.verified_entries(p_user)),
           'active_ventures', (select count(distinct x.venture_id) from private.verified_entries(p_user) x
                                 join public.ventures v on v.id = x.venture_id and v.status in ('in_progress', 'completed')),
           'counting_endorsements', (v_endorsements->>'counting')::integer,
           'completed_ventures', jsonb_array_length(v_work->'ventures'),
           'max_level', coalesce((select max(u.level) from public.user_skills u where u.user_id = p_user), 0),
           'teacher_endorsement', exists (select 1 from jsonb_array_elements(v_endorsements->'items') i
                                           join public.endorsements en on en.id = (i->>'id')::uuid
                                          where en.endorser_kind = 'teacher' and (i->>'points')::numeric > 0),
           'hire', false)
    into v_facts;
  return jsonb_build_object(
    'work', v_work, 'skills', v_skills, 'endorsements', v_endorsements, 'credentials', v_credentials, 'record', v_record,
    'momentum', v_momentum, 'adjustments', v_adjustments, 'facts', v_facts,
    'proof', round(v_proof, 2),
    'total', greatest(0, round(v_proof + (v_momentum->>'points')::numeric + (v_adjustments->>'points')::numeric, 2)),
    'as_of', p_as_of);
end;
$$;

create or replace function private.ranking_points(p jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('work', p->'work'->'points', 'skills', p->'skills'->'points',
                            'endorsements', p->'endorsements'->'points', 'credentials', p->'credentials'->'points',
                            'record', coalesce(p->'record'->'points', '0'::jsonb),
                            'momentum', p->'momentum'->'points', 'adjustments', p->'adjustments'->'points', 'total', p->'total');
$$;

-- /me/score names the counted Record entries.
create or replace function private.my_score()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  s public.ranking_scores;
  c jsonb;
  v_today date := (now() at time zone 'Asia/Karachi')::date;
begin
  select * into s from public.ranking_scores where user_id = v_me;
  if not found then
    return jsonb_build_object('scored', false, 'next', private.next_tier_requirements(v_me),
                              'formula_version', (select version from private.ranking_formula()));
  end if;
  c := s.components;
  return jsonb_build_object(
    'scored', true,
    'formula_version', s.formula_version,
    'components', c,
    'total', s.total, 'proof', s.proof, 'momentum', s.momentum, 'adjustments', s.adjustments,
    'ranked', s.ranked, 'tier', s.tier, 'tier_met', s.tier_met, 'percentile', s.percentile, 'below_since', s.below_since,
    'held', s.held, 'held_total', s.held_total, 'published_at', s.published_at,
    'last_week', (select jsonb_build_object('week', n.week, 'total', n.total, 'components', n.components, 'tier', n.tier)
                    from public.ranking_snapshots n where n.user_id = v_me and n.week < v_today order by n.week desc limit 1),
    'exam', (select jsonb_build_object('starts_on', e.starts_on, 'ends_on', e.ends_on)
               from public.exam_periods e join public.profiles p on p.university_id = e.university_id
              where p.user_id = v_me and v_today between e.starts_on and e.ends_on limit 1),
    'next', private.next_tier_requirements(v_me),
    'names', jsonb_build_object(
      'ventures', coalesce((select jsonb_object_agg(v.id, v.title) from public.ventures v
                             where v.id in (select (x->>'venture_id')::uuid from jsonb_array_elements(c->'work'->'ventures') x)), '{}'::jsonb),
      'skills', coalesce((select jsonb_object_agg(k.id, k.name) from public.skills k
                           where k.id in (select x->>'skill_id' from jsonb_array_elements(c->'skills'->'items') x
                                          union select x->>'skill_id' from jsonb_array_elements(c->'endorsements'->'items') x)), '{}'::jsonb),
      'people', coalesce((select jsonb_object_agg(p.user_id, jsonb_build_object('name', p.full_name, 'username', p.username))
                           from public.profiles p
                          where p.user_id in (select (x->>'endorser_id')::uuid from jsonb_array_elements(c->'endorsements'->'items') x)), '{}'::jsonb),
      'credentials', coalesce((select jsonb_object_agg(k.id, k.title) from public.credentials k
                                where k.user_id = v_me and k.id in (select (x->>'id')::uuid from jsonb_array_elements(c->'credentials'->'items') x)), '{}'::jsonb),
      'record', coalesce((select jsonb_object_agg(e.id, jsonb_build_object('title', e.title, 'issuer', e.issuer_name, 'line', e.evidence ->> 'line', 'code', e.code))
                           from public.record_entries e
                          where e.user_id = v_me and e.id in (select (x->>'id')::uuid from jsonb_array_elements(coalesce(c->'record'->'items', '[]')) x)), '{}'::jsonb),
      'posts', coalesce((select jsonb_object_agg(p.id, left(p.body, 80)) from public.posts p
                          where p.author_id = v_me and p.id in (select (x->>'post_id')::uuid from jsonb_array_elements(c->'momentum'->'content'->'posts') x)), '{}'::jsonb)));
end;
$$;

-- The change is announced in-app to every scored student (PRD 5.13) and applied by the next nightly run.
select private.notify(s.user_id, null, 'ranking_formula', 'ranking', null,
                      jsonb_build_object('version', 2, 'component', 'record', 'max', 100))
  from public.ranking_scores s;

-- ---------------------------------------------------------------------------
-- Jobs and backfill
-- ---------------------------------------------------------------------------
select cron.schedule('record-worker', '* * * * *', $$select private.wake_record_worker()$$);
select cron.schedule('record-claims-expire', '41 20 * * *', $$select private.record_claims_expire()$$); -- 01:41 PKT

-- Close-outs and confirmations stored before this migration become entries now.
select private.issue_event_record(i.event_id, i.preview, i.issued_by) from public.event_issuances i where i.status = 'queued';
update public.event_issuances set status = 'signed' where status = 'queued';
do $$
declare
  t public.society_terms;
  s public.societies;
begin
  for t in select * from public.society_terms where confirmed_at is not null loop
    select * into s from public.societies where id = t.society_id;
    if s.status = 'verified' then
      perform private.issue_record_entry(t.user_id, null, 'office_bearer', 'society', s.id, s.name, 'term', t.id, t.title,
                                         jsonb_build_object('line', t.title || ' · ' || to_char(t.term_start, 'Mon YYYY') || ' – ' || to_char(t.term_end, 'Mon YYYY'),
                                                            'role', t.role::text,
                                                            'from', to_char(t.term_start, 'YYYY-MM-DD'), 'to', to_char(t.term_end, 'YYYY-MM-DD')),
                                         t.term_end, t.confirmed_by, t.confirmed_by = t.user_id);
    end if;
  end loop;
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
  'confirm_record_entry', 'correct_record_entry', 'decline_record_mistake', 'revoke_record_entry', 'society_record_page',
  'my_record', 'set_record_display', 'report_record_mistake', 'create_record_share_link', 'revoke_record_share_link',
  'record_highlights', 'record_waiting', 'claim_record_entries', 'record_pdf_export', 'ops_record_entry', 'save_cv_activities']);
drop function pg_temp.expose(text[]);

-- Anyone, signed in or not: verify an entry or a transcript, open a share link.
do $$
declare
  n text;
begin
  foreach n in array array['verify_record_entry(text)', 'verify_record_transcript(uuid)', 'open_record_share(text, text)'] loop
    execute format('revoke all on function private.%s from public', n);
    execute format('grant execute on function private.%s to anon, authenticated', n);
  end loop;
end;
$$;
create function public.verify_record_entry(p_code text) returns jsonb
  language sql stable security invoker set search_path = '' as $$ select private.verify_record_entry(p_code) $$;
create function public.verify_record_transcript(p_id uuid) returns jsonb
  language sql stable security invoker set search_path = '' as $$ select private.verify_record_transcript(p_id) $$;
create function public.open_record_share(p_token_hash text, p_viewer_key text) returns jsonb
  language sql volatile security invoker set search_path = '' as $$ select private.open_record_share(p_token_hash, p_viewer_key) $$;
revoke all on function public.verify_record_entry(text), public.verify_record_transcript(uuid), public.open_record_share(text, text) from public;
grant execute on function public.verify_record_entry(text), public.verify_record_transcript(uuid), public.open_record_share(text, text) to anon, authenticated;

revoke all on function private.record_entry_json(public.record_entries), private.cv_activities(uuid) from public;
