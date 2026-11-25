-- identity: accounts, sign-in, sessions, two-factor, signup gates, agreement versions, staff roles
-- (docs/azure/prd.md, service catalogue and "Sign-in and sessions"). Forward-only.
-- Every table: row-level security enabled and forced, one policy for the owning role (prd.md, "Layout").

create table identity.users (
  id uuid primary key,
  email text not null unique check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+$'),
  email_confirmed_at timestamptz,
  role text not null default 'student' check (role in ('student', 'faculty', 'recruiter', 'university_admin')),
  token_version integer not null default 0 check (token_version >= 0),
  banned_until timestamptz,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table identity.users enable row level security;
alter table identity.users force row level security;
create policy users_owner on identity.users for all to svc_identity using (true) with check (true);
grant select, insert, update, delete on identity.users to svc_identity;

create table identity.password_credentials (
  user_id uuid primary key references identity.users (id) on delete cascade,
  hash text not null,
  -- bcrypt hashes are imported unchanged and rehashed to argon2id at the next successful sign-in.
  algorithm text not null check (algorithm in ('bcrypt', 'argon2id')),
  imported boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table identity.password_credentials enable row level security;
alter table identity.password_credentials force row level security;
create policy password_credentials_owner on identity.password_credentials for all to svc_identity using (true) with check (true);
grant select, insert, update, delete on identity.password_credentials to svc_identity;

create table identity.totp_factors (
  id uuid primary key,
  user_id uuid not null references identity.users (id) on delete cascade,
  -- Encrypted with a Key Vault key (never stored in the clear); the key name is pending Ahmed.
  secret_ciphertext bytea not null,
  status text not null default 'unverified' check (status in ('unverified', 'verified')),
  last_used_step bigint,
  created_at timestamptz not null default now()
);
create unique index totp_factors_one_verified on identity.totp_factors (user_id) where status = 'verified';
alter table identity.totp_factors enable row level security;
alter table identity.totp_factors force row level security;
create policy totp_factors_owner on identity.totp_factors for all to svc_identity using (true) with check (true);
grant select, insert, update, delete on identity.totp_factors to svc_identity;

create table identity.mfa_backup_codes (
  user_id uuid not null references identity.users (id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  primary key (user_id, code_hash)
);
alter table identity.mfa_backup_codes enable row level security;
alter table identity.mfa_backup_codes force row level security;
create policy mfa_backup_codes_owner on identity.mfa_backup_codes for all to svc_identity using (true) with check (true);
grant select, insert, update, delete on identity.mfa_backup_codes to svc_identity;

create table identity.sessions (
  id uuid primary key,
  user_id uuid not null references identity.users (id) on delete cascade,
  aal text not null default 'aal1' check (aal in ('aal1', 'aal2')),
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index sessions_user on identity.sessions (user_id) where revoked_at is null;
alter table identity.sessions enable row level security;
alter table identity.sessions force row level security;
create policy sessions_owner on identity.sessions for all to svc_identity using (true) with check (true);
grant select, insert, update, delete on identity.sessions to svc_identity;

create table identity.refresh_tokens (
  token_hash text primary key,
  session_id uuid not null references identity.sessions (id) on delete cascade,
  family uuid not null,
  issued_at timestamptz not null default now(),
  used_at timestamptz,
  replaced_by text
);
create index refresh_tokens_family on identity.refresh_tokens (family);
alter table identity.refresh_tokens enable row level security;
alter table identity.refresh_tokens force row level security;
create policy refresh_tokens_owner on identity.refresh_tokens for all to svc_identity using (true) with check (true);
grant select, insert, update, delete on identity.refresh_tokens to svc_identity;

create table identity.security_events (
  id uuid primary key,
  user_id uuid not null references identity.users (id) on delete cascade,
  kind text not null,
  ip_hash text,
  user_agent text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index security_events_user on identity.security_events (user_id, created_at);
alter table identity.security_events enable row level security;
alter table identity.security_events force row level security;
create policy security_events_owner on identity.security_events for all to svc_identity using (true) with check (true);
grant select, insert, update, delete on identity.security_events to svc_identity;

create table identity.auth_failures (
  key text not null,
  created_at timestamptz not null default now()
);
create index auth_failures_key on identity.auth_failures (key, created_at);
alter table identity.auth_failures enable row level security;
alter table identity.auth_failures force row level security;
create policy auth_failures_owner on identity.auth_failures for all to svc_identity using (true) with check (true);
grant select, insert, update, delete on identity.auth_failures to svc_identity;

create table identity.security_alert_tokens (
  token_hash text primary key,
  user_id uuid not null references identity.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz
);
alter table identity.security_alert_tokens enable row level security;
alter table identity.security_alert_tokens force row level security;
create policy security_alert_tokens_owner on identity.security_alert_tokens for all to svc_identity using (true) with check (true);
grant select, insert, update, delete on identity.security_alert_tokens to svc_identity;

create table identity.user_devices (
  user_id uuid not null references identity.users (id) on delete cascade,
  device_hash text not null check (device_hash ~ '^[0-9a-f]{64}$'),
  user_agent text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, device_hash)
);
alter table identity.user_devices enable row level security;
alter table identity.user_devices force row level security;
create policy user_devices_owner on identity.user_devices for all to svc_identity using (true) with check (true);
grant select, insert, update, delete on identity.user_devices to svc_identity;

create table identity.agreement_versions (
  version integer primary key,
  title text not null,
  summary_md text not null default '',
  body_md text not null default '',
  published_at timestamptz
);
alter table identity.agreement_versions enable row level security;
alter table identity.agreement_versions force row level security;
create policy agreement_versions_owner on identity.agreement_versions for all to svc_identity using (true) with check (true);
grant select, insert, update, delete on identity.agreement_versions to svc_identity;

create table identity.agreement_acceptances (
  user_id uuid not null references identity.users (id) on delete cascade,
  version integer not null references identity.agreement_versions (version),
  accepted_at timestamptz not null default now(),
  ip_hash text,
  primary key (user_id, version)
);
alter table identity.agreement_acceptances enable row level security;
alter table identity.agreement_acceptances force row level security;
create policy agreement_acceptances_owner on identity.agreement_acceptances for all to svc_identity using (true) with check (true);
grant select, insert, update, delete on identity.agreement_acceptances to svc_identity;

create table identity.staff_roles (
  user_id uuid not null references identity.users (id) on delete cascade,
  role text not null check (role in ('moderator', 'trust_reviewer', 'accounts', 'super_admin')),
  granted_by uuid references identity.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);
alter table identity.staff_roles enable row level security;
alter table identity.staff_roles force row level security;
create policy staff_roles_owner on identity.staff_roles for all to svc_identity using (true) with check (true);
grant select, insert, update, delete on identity.staff_roles to svc_identity;

create table identity.rate_limit_events (
  key text not null check (char_length(key) between 1 and 200),
  created_at timestamptz not null default now()
);
create index rate_limit_events_key on identity.rate_limit_events (key, created_at);
alter table identity.rate_limit_events enable row level security;
alter table identity.rate_limit_events force row level security;
create policy rate_limit_events_owner on identity.rate_limit_events for all to svc_identity using (true) with check (true);
grant select, insert, update, delete on identity.rate_limit_events to svc_identity;

create table identity.allowed_domains (
  -- Identity's own copy of the university email domains, fed by a people event (decision 2026-11-25).
  domain text not null,
  university_id uuid not null,
  kind text not null check (kind in ('student', 'faculty', 'both')),
  university_live_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (domain, university_id)
);
create index allowed_domains_domain on identity.allowed_domains (domain);
alter table identity.allowed_domains enable row level security;
alter table identity.allowed_domains force row level security;
create policy allowed_domains_owner on identity.allowed_domains for all to svc_identity using (true) with check (true);
grant select, insert, update, delete on identity.allowed_domains to svc_identity;

create table identity.personal_email_domains (
  domain text primary key check (domain = lower(domain))
);
alter table identity.personal_email_domains enable row level security;
alter table identity.personal_email_domains force row level security;
create policy personal_email_domains_owner on identity.personal_email_domains for all to svc_identity using (true) with check (true);
grant select, insert, update, delete on identity.personal_email_domains to svc_identity;

create table identity.signing_keys (
  -- Public halves only; private keys live in Key Vault (names pending Ahmed).
  kid text primary key,
  public_jwk jsonb not null,
  created_at timestamptz not null default now(),
  retired_at timestamptz
);
alter table identity.signing_keys enable row level security;
alter table identity.signing_keys force row level security;
create policy signing_keys_owner on identity.signing_keys for all to svc_identity using (true) with check (true);
grant select, insert, update, delete on identity.signing_keys to svc_identity;
