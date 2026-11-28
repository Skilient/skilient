-- credentials: verified CVs (ported from 20261008000000_verified_cv.sql, 20261009000000_cv_control.sql and
-- 20261109000000_cv_recruiter_layout.sql), the shared code namespace, settings, entitlement copies and the audit
-- log. Forward-only. Every table: row-level security enabled and forced, one policy for the owning role
-- (docs/azure/prd.md, "Layout"). No foreign keys to other services' data: user ids are plain uuids.

-- Signing keys: public halves only. The private half is the Key Vault secret credentials-signing-key (the service
-- installs a new key id when the secret changes, and retires the old one). Rows are never deleted, so every CV and
-- Record entry ever signed can still be checked with the key that signed it.
create table credentials.signing_keys (
  key_id text primary key check (key_id ~ '^cv-[0-9]{8}-[0-9a-f]{8}$'),
  algorithm text not null default 'Ed25519' check (algorithm = 'Ed25519'),
  public_key text not null unique check (public_key ~ '^[A-Za-z0-9_-]{43}$'),
  active_from timestamptz not null default now(),
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  check (retired_at is null or retired_at >= active_from)
);
create unique index signing_keys_one_active_idx on credentials.signing_keys ((true)) where retired_at is null;

-- One namespace for /verify/[code]: a CV version and a Record entry never share a code (record_code_free).
create table credentials.codes (
  code text primary key check (code ~ '^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{10}$'),
  kind text not null check (kind in ('cv', 'record')),
  created_at timestamptz not null default now()
);

-- CV settings: which sections, in what order, what the header shows, and the Record entries on the CV.
create table credentials.cv_settings (
  user_id uuid primary key,
  sections text[] not null default array['summary', 'projects', 'open_source', 'skills', 'activities', 'endorsements', 'credentials', 'education'],
  -- null: follow the leaderboard setting (opted out = off).
  show_percentile boolean,
  show_email boolean not null default false,
  visibility text not null default 'link' check (visibility in ('private', 'link', 'recruiters')),
  record_entries uuid[] not null default '{}' check (cardinality(record_entries) <= 20),
  updated_at timestamptz not null default now()
);

-- One row per signed version. The signature covers the RFC 8785 canonical JSON of
-- {v, code, key_id, issued_at, expires_at, snapshot}; snapshot_hash is its SHA-256 (hex). user_id is kept null
-- when an account goes, so verify still says Revoked.
create table credentials.cv_records (
  id uuid primary key,
  user_id uuid,
  code text not null unique check (code ~ '^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{10}$'),
  version integer not null check (version >= 1),
  template text not null default 'standard' check (template ~ '^[a-z]{3,20}$'),
  snapshot jsonb check (snapshot is null or jsonb_typeof(snapshot) = 'object'),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  snapshot_hash text not null check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  signature text not null check (signature ~ '^[A-Za-z0-9_-]{86}$'),
  key_id text not null references credentials.signing_keys (key_id),
  source text not null check (source in ('first', 'monthly', 'on_demand', 'reissue')),
  issued_at timestamptz not null check (issued_at = date_trunc('second', issued_at)),
  expires_at timestamptz not null check (expires_at > issued_at),
  superseded_by uuid references credentials.cv_records (id) on delete set null,
  revoked_at timestamptz,
  revoked_reason text check (revoked_reason is null or revoked_reason in ('owner', 'staff', 'suspended', 'deleted')),
  revoked_by uuid,
  created_at timestamptz not null default now(),
  unique (user_id, version),
  check ((revoked_at is null) = (revoked_reason is null)),
  check (snapshot is not null or revoked_at is not null)
);
create index cv_records_user_idx on credentials.cv_records (user_id, version desc);
create index cv_records_key_idx on credentials.cv_records (key_id);
create index cv_records_superseded_idx on credentials.cv_records (superseded_by) where superseded_by is not null;
create index cv_records_revoked_by_idx on credentials.cv_records (revoked_by) where revoked_by is not null;

-- Share links (Spark and above): token hash only; always open the newest version.
create table credentials.cv_share_links (
  id uuid primary key,
  user_id uuid not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  label text check (label is null or char_length(btrim(label)) between 1 and 60),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text check (revoked_reason is null or revoked_reason in ('owner', 'staff', 'suspended', 'deleted')),
  view_count integer not null default 0 check (view_count >= 0),
  last_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((revoked_at is null) = (revoked_reason is null))
);
create index cv_share_links_user_idx on credentials.cv_share_links (user_id, created_at desc);

-- Who opened a CV: one per viewer key per link per day (Pakistan time).
create table credentials.cv_views (
  id uuid primary key,
  user_id uuid not null,
  record_id uuid references credentials.cv_records (id) on delete set null,
  link_id uuid references credentials.cv_share_links (id) on delete set null,
  source text not null check (source in ('share_link', 'recruiter')),
  viewer_org_id uuid,
  viewer_key text not null check (viewer_key ~ '^[0-9a-f]{64}$'),
  day date not null default ((now() at time zone 'Asia/Karachi')::date),
  viewed_at timestamptz not null default now(),
  unique (link_id, viewer_key, day)
);
create index cv_views_user_idx on credentials.cv_views (user_id, viewed_at desc);
create index cv_views_record_idx on credentials.cv_views (record_id);

-- PDF exports: one row per file; the hash stays after the file goes (30 days).
create table credentials.cv_pdf_exports (
  id uuid primary key,
  record_id uuid not null references credentials.cv_records (id),
  user_id uuid,
  template text not null check (template in ('standard', 'classic', 'compact', 'modern', 'academic')),
  paper text not null check (paper in ('a4', 'letter')),
  pdf_hash text not null check (pdf_hash ~ '^[0-9a-f]{64}$'),
  path text not null unique check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'),
  bytes integer not null check (bytes > 0),
  file_deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index cv_pdf_exports_record_idx on credentials.cv_pdf_exports (record_id, pdf_hash);
create index cv_pdf_exports_user_idx on credentials.cv_pdf_exports (user_id, created_at desc);
create index cv_pdf_exports_live_idx on credentials.cv_pdf_exports (created_at) where file_deleted_at is null;

-- entitlement.changed (billing, W12): Student Pro features (cv.pdf_export, cv.templates, cv.refresh_on_demand).
create table credentials.entitlements (
  subject_id uuid not null,
  key text not null check (key ~ '^[a-z_]+\.[a-z_]+$'),
  value jsonb not null,
  primary key (subject_id, key)
);

-- Settings (platform_config today): values copied from the current stack.
create table credentials.config (
  key text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into credentials.config (key, value) values
  ('record.limits', '{"claim_days": 180, "pins": 3, "share_links": 10, "cv_entries": 8, "batch": 50}'::jsonb);

-- Actions on credentials' data with the state before and after: staff (ops_audit_log today; trust builds /ops from
-- audit.recorded) and society officers on the Record (society_audit_log today).
create table credentials.audit_log (
  id uuid primary key,
  scope text not null check (scope in ('staff', 'society')),
  actor_id uuid,
  society_id uuid,
  action text not null check (action ~ '^[a-z][a-z0-9_.]{0,99}$'),
  target_type text not null,
  target_id text not null,
  reason text,
  before jsonb not null default '{}',
  after jsonb not null default '{}',
  created_at timestamptz not null default now(),
  check ((scope = 'society') = (society_id is not null))
);
create index audit_log_target_idx on credentials.audit_log (target_type, target_id, created_at);
create index audit_log_actor_idx on credentials.audit_log (actor_id, created_at);
create index audit_log_society_idx on credentials.audit_log (society_id, created_at) where society_id is not null;

alter table credentials.signing_keys enable row level security;
alter table credentials.signing_keys force row level security;
create policy signing_keys_owner on credentials.signing_keys for all to svc_credentials using (true) with check (true);
grant select, insert, update on credentials.signing_keys to svc_credentials;

alter table credentials.codes enable row level security;
alter table credentials.codes force row level security;
create policy codes_owner on credentials.codes for all to svc_credentials using (true) with check (true);
grant select, insert on credentials.codes to svc_credentials;

alter table credentials.cv_settings enable row level security;
alter table credentials.cv_settings force row level security;
create policy cv_settings_owner on credentials.cv_settings for all to svc_credentials using (true) with check (true);
grant select, insert, update, delete on credentials.cv_settings to svc_credentials;

alter table credentials.cv_records enable row level security;
alter table credentials.cv_records force row level security;
create policy cv_records_owner on credentials.cv_records for all to svc_credentials using (true) with check (true);
grant select, insert, update on credentials.cv_records to svc_credentials;

alter table credentials.cv_share_links enable row level security;
alter table credentials.cv_share_links force row level security;
create policy cv_share_links_owner on credentials.cv_share_links for all to svc_credentials using (true) with check (true);
grant select, insert, update, delete on credentials.cv_share_links to svc_credentials;

alter table credentials.cv_views enable row level security;
alter table credentials.cv_views force row level security;
create policy cv_views_owner on credentials.cv_views for all to svc_credentials using (true) with check (true);
grant select, insert, delete on credentials.cv_views to svc_credentials;

alter table credentials.cv_pdf_exports enable row level security;
alter table credentials.cv_pdf_exports force row level security;
create policy cv_pdf_exports_owner on credentials.cv_pdf_exports for all to svc_credentials using (true) with check (true);
grant select, insert, update on credentials.cv_pdf_exports to svc_credentials;

alter table credentials.entitlements enable row level security;
alter table credentials.entitlements force row level security;
create policy entitlements_owner on credentials.entitlements for all to svc_credentials using (true) with check (true);
grant select, insert, update, delete on credentials.entitlements to svc_credentials;

alter table credentials.config enable row level security;
alter table credentials.config force row level security;
create policy config_owner on credentials.config for all to svc_credentials using (true) with check (true);
grant select, insert, update on credentials.config to svc_credentials;

alter table credentials.audit_log enable row level security;
alter table credentials.audit_log force row level security;
create policy audit_log_owner on credentials.audit_log for all to svc_credentials using (true) with check (true);
grant select, insert, update on credentials.audit_log to svc_credentials;
