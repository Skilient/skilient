-- credentials: the Record (ported from 20261112000001_the_record.sql), the society officers it checks (a copy of
-- group.member_changed from community) and the PDF render jobs. Forward-only.

-- One row per entry. Held entries (user_id null, claim_email_hash set) wait for a walk-in to sign up; awaiting
-- entries wait for a second officer; pending entries have a record-sign job queued; sealed entries are immutable
-- (a correction issues a new entry that supersedes the old one; a revocation keeps the row with its reason).
create table credentials.record_entries (
  id uuid primary key,
  user_id uuid,
  claim_email_hash text check (claim_email_hash is null or claim_email_hash ~ '^[0-9a-f]{64}$'),
  kind text not null check (kind in ('attended', 'completed', 'result', 'office_bearer', 'volunteer', 'venture_completed', 'taught', 'proof_task')),
  issuer_type text not null check (issuer_type in ('society', 'skilient')),
  issuer_id uuid,
  issuer_name text not null check (char_length(btrim(issuer_name)) between 2 and 80),
  source text not null check (source in ('event', 'session', 'term', 'venture', 'swap', 'task')),
  source_id uuid not null,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  evidence jsonb not null default '{}' check (jsonb_typeof(evidence) = 'object' and char_length(coalesce(evidence ->> 'line', '')) <= 140),
  occurred_on date not null,
  issued_by uuid,
  confirmed_by uuid,
  issued_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('held', 'awaiting', 'pending', 'sealed', 'revoked', 'superseded')),
  supersedes uuid references credentials.record_entries (id) on delete set null,
  superseded_by uuid references credentials.record_entries (id) on delete set null,
  code text unique check (code is null or code ~ '^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{10}$'),
  key_id text references credentials.signing_keys (key_id),
  payload jsonb check (payload is null or jsonb_typeof(payload) = 'object'),
  envelope_hash text check (envelope_hash is null or envelope_hash ~ '^[0-9a-f]{64}$'),
  signature text check (signature is null or signature ~ '^[A-Za-z0-9_-]{86}$'),
  signed_at timestamptz check (signed_at is null or signed_at = date_trunc('second', signed_at)),
  revoked_at timestamptz,
  revoked_by uuid,
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
create unique index record_entries_one_live on credentials.record_entries (user_id, kind, source_id)
  where user_id is not null and status not in ('revoked', 'superseded') and supersedes is null;
create unique index record_entries_one_held on credentials.record_entries (claim_email_hash, kind, source_id) where status = 'held';
create unique index record_entries_one_correction on credentials.record_entries (supersedes) where supersedes is not null and status not in ('revoked', 'superseded');
create index record_entries_user_idx on credentials.record_entries (user_id, occurred_on desc) where user_id is not null;
create index record_entries_issuer_idx on credentials.record_entries (issuer_id, issued_at desc) where issuer_id is not null;
create index record_entries_source_idx on credentials.record_entries (source_id);
create index record_entries_status_idx on credentials.record_entries (status) where status in ('held', 'awaiting', 'pending');
create index record_entries_issued_by_idx on credentials.record_entries (issued_by) where issued_by is not null;
create index record_entries_confirmed_by_idx on credentials.record_entries (confirmed_by) where confirmed_by is not null;
create index record_entries_revoked_by_idx on credentials.record_entries (revoked_by) where revoked_by is not null;
create index record_entries_superseded_by_idx on credentials.record_entries (superseded_by) where superseded_by is not null;
create index record_entries_key_idx on credentials.record_entries (key_id) where key_id is not null;

-- Entries held for a walk-in's address: one claim per person per event, 180 days, matched only to the same
-- confirmed address (identity's EmailsOf, read when the account asks).
create table credentials.record_claims (
  id uuid primary key,
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  event_id uuid not null,
  email_attendee_id uuid,
  user_id uuid,
  matched_at timestamptz,
  claimed_at timestamptz,
  sent_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (email_hash, event_id),
  check ((user_id is null) = (matched_at is null)),
  check (claimed_at is null or user_id is not null)
);
create index record_claims_user_idx on credentials.record_claims (user_id) where user_id is not null;
create index record_claims_event_idx on credentials.record_claims (event_id);
create index record_claims_expires_idx on credentials.record_claims (expires_at) where claimed_at is null;

create table credentials.record_share_links (
  id uuid primary key,
  user_id uuid not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  label text check (label is null or char_length(btrim(label)) between 1 and 60),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  view_count integer not null default 0 check (view_count >= 0),
  last_viewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index record_share_links_user_idx on credentials.record_share_links (user_id, created_at desc);

create table credentials.record_corrections (
  id uuid primary key,
  entry_id uuid not null references credentials.record_entries (id) on delete cascade,
  user_id uuid not null,
  note text not null check (char_length(btrim(note)) between 10 and 1000),
  status text not null default 'open' check (status in ('open', 'corrected', 'declined')),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(btrim(decision_note)) between 3 and 500),
  created_at timestamptz not null default now(),
  check ((status = 'open') = (decided_at is null))
);
create unique index record_corrections_one_open on credentials.record_corrections (entry_id) where status = 'open';
create index record_corrections_user_idx on credentials.record_corrections (user_id);
create index record_corrections_decided_by_idx on credentials.record_corrections (decided_by) where decided_by is not null;

create table credentials.record_pdf_exports (
  id uuid primary key,
  user_id uuid,
  kind text not null check (kind in ('certificate', 'transcript')),
  entry_id uuid references credentials.record_entries (id) on delete set null,
  holder_name text not null,
  codes text[] not null check (cardinality(codes) between 1 and 500),
  pdf_hash text not null check (pdf_hash ~ '^[0-9a-f]{64}$'),
  bytes integer not null check (bytes > 0),
  created_at timestamptz not null default now(),
  check ((kind = 'certificate') = (entry_id is not null) or entry_id is null)
);
create index record_pdf_exports_user_idx on credentials.record_pdf_exports (user_id, created_at desc);
create index record_pdf_exports_entry_idx on credentials.record_pdf_exports (entry_id) where entry_id is not null;

-- group.member_changed {kind society} (community): who may confirm, correct, decline and revoke a society's
-- entries, and who hears that one waits (is_society_officer).
create table credentials.society_officers (
  society_id uuid not null,
  user_id uuid not null,
  role text not null check (role in ('president', 'officer')),
  primary key (society_id, user_id)
);
create index society_officers_user_idx on credentials.society_officers (user_id);

-- PDFs asked for (the render job): one row per request; the file is media's.
create table credentials.pdf_renders (
  id uuid primary key,
  user_id uuid not null,
  kind text not null check (kind in ('cv', 'certificate', 'transcript')),
  record_id uuid references credentials.cv_records (id),
  entry_id uuid references credentials.record_entries (id) on delete set null,
  template text not null default 'standard',
  paper text not null default 'a4' check (paper in ('a4', 'letter')),
  status text not null default 'queued' check (status in ('queued', 'done', 'failed')),
  path text,
  pdf_hash text check (pdf_hash is null or pdf_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index pdf_renders_user_idx on credentials.pdf_renders (user_id, created_at desc);

alter table credentials.record_entries enable row level security;
alter table credentials.record_entries force row level security;
create policy record_entries_owner on credentials.record_entries for all to svc_credentials using (true) with check (true);
grant select, insert, update, delete on credentials.record_entries to svc_credentials;

alter table credentials.record_claims enable row level security;
alter table credentials.record_claims force row level security;
create policy record_claims_owner on credentials.record_claims for all to svc_credentials using (true) with check (true);
grant select, insert, update, delete on credentials.record_claims to svc_credentials;

alter table credentials.record_share_links enable row level security;
alter table credentials.record_share_links force row level security;
create policy record_share_links_owner on credentials.record_share_links for all to svc_credentials using (true) with check (true);
grant select, insert, update, delete on credentials.record_share_links to svc_credentials;

alter table credentials.record_corrections enable row level security;
alter table credentials.record_corrections force row level security;
create policy record_corrections_owner on credentials.record_corrections for all to svc_credentials using (true) with check (true);
grant select, insert, update, delete on credentials.record_corrections to svc_credentials;

alter table credentials.record_pdf_exports enable row level security;
alter table credentials.record_pdf_exports force row level security;
create policy record_pdf_exports_owner on credentials.record_pdf_exports for all to svc_credentials using (true) with check (true);
grant select, insert, update on credentials.record_pdf_exports to svc_credentials;

alter table credentials.society_officers enable row level security;
alter table credentials.society_officers force row level security;
create policy society_officers_owner on credentials.society_officers for all to svc_credentials using (true) with check (true);
grant select, insert, update, delete on credentials.society_officers to svc_credentials;

alter table credentials.pdf_renders enable row level security;
alter table credentials.pdf_renders force row level security;
create policy pdf_renders_owner on credentials.pdf_renders for all to svc_credentials using (true) with check (true);
grant select, insert, update, delete on credentials.pdf_renders to svc_credentials;
