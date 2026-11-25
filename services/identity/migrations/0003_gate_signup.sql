-- identity, steps 3, 4 and 6 of the W1 plan: gate-fact copies, sign-up, email codes, Google identities.
-- Forward-only. Every table: row-level security enabled and forced, one policy for the owning role.

-- ---------------------------------------------------------------------------
-- Gate-fact copies (decision 2026-11-25, Q1). Read-only copies of other services' facts, written only by
-- identity's event consumers (src/store/gate-copies.ts). `allowed_domains` (0001) holds the university
-- domains (`university.domains_changed` from people).
-- ---------------------------------------------------------------------------

-- Platform settings the gates read; today only `portals.enabled` (`config.portals_changed` from trust).
-- No row means the defaults: recruiter and university off, faculty on (`private.portals_state`).
create table identity.gate_config (
  key text primary key check (key in ('portals.enabled')),
  value jsonb not null check (jsonb_typeof(value) = 'object'),
  updated_at timestamptz not null default now()
);
alter table identity.gate_config enable row level security;
alter table identity.gate_config force row level security;
create policy gate_config_owner on identity.gate_config for all to svc_identity using (true) with check (true);
grant select, insert, update, delete on identity.gate_config to svc_identity;

-- Per-user profile facts the gate needs (`profile.gate_changed` from people). Seeded at sign-up with the
-- defaults identity sends in `user.created`, so the gate is right before people has handled the event.
create table identity.profile_facts (
  user_id uuid primary key references identity.users (id) on delete cascade,
  has_profile boolean not null,
  role text not null check (role in ('student', 'faculty', 'recruiter', 'university_admin')),
  university_id uuid,
  onboarding_complete boolean not null default false,
  onboarding_step integer not null default 1 check (onboarding_step between 1 and 99),
  status text not null default 'active' check (status in ('active', 'graduate', 'deleting')),
  updated_at timestamptz not null default now()
);
alter table identity.profile_facts enable row level security;
alter table identity.profile_facts force row level security;
create policy profile_facts_owner on identity.profile_facts for all to svc_identity using (true) with check (true);
grant select, insert, update, delete on identity.profile_facts to svc_identity;

-- A recruiter's company domain (`org.member_changed` from market); no row when not in an organisation.
create table identity.recruiter_org_domains (
  user_id uuid primary key references identity.users (id) on delete cascade,
  org_domain text not null check (org_domain = lower(org_domain) and char_length(org_domain) between 1 and 253),
  updated_at timestamptz not null default now()
);
alter table identity.recruiter_org_domains enable row level security;
alter table identity.recruiter_org_domains force row level security;
create policy recruiter_org_domains_owner on identity.recruiter_org_domains for all to svc_identity using (true) with check (true);
grant select, insert, update, delete on identity.recruiter_org_domains to svc_identity;

-- ---------------------------------------------------------------------------
-- Sign-up
-- ---------------------------------------------------------------------------

-- What a new account entered at sign-up. Event payloads never carry names, so people reads the name here
-- through GetSignupDetails after `user.created` (decision 2026-11-25).
create table identity.signup_details (
  user_id uuid primary key references identity.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 60),
  role text not null check (role in ('student', 'faculty', 'recruiter', 'university_admin')),
  university_id uuid,
  provider text not null check (provider in ('email', 'google')),
  created_at timestamptz not null default now()
);
alter table identity.signup_details enable row level security;
alter table identity.signup_details force row level security;
create policy signup_details_owner on identity.signup_details for all to svc_identity using (true) with check (true);
grant select, insert, update, delete on identity.signup_details to svc_identity;

-- One-time email codes: confirming a new address (signup) and signing in (signin). Only an HMAC of the code
-- is stored; a code expires after 15 minutes and stops working after 5 wrong tries.
create table identity.email_codes (
  id uuid primary key,
  user_id uuid not null references identity.users (id) on delete cascade,
  purpose text not null check (purpose in ('signup', 'signin')),
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  attempts integer not null default 0 check (attempts >= 0),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index email_codes_open on identity.email_codes (user_id, purpose, created_at) where used_at is null;
alter table identity.email_codes enable row level security;
alter table identity.email_codes force row level security;
create policy email_codes_owner on identity.email_codes for all to svc_identity using (true) with check (true);
grant select, insert, update, delete on identity.email_codes to svc_identity;

-- Sign-in providers linked to an account (Google). Imported Google-only accounts are mapped here at cutover.
create table identity.identities (
  provider text not null check (provider in ('google')),
  provider_user_id text not null check (char_length(provider_user_id) between 1 and 255),
  user_id uuid not null references identity.users (id) on delete cascade,
  email_at_link text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  primary key (provider, provider_user_id),
  unique (user_id, provider)
);
alter table identity.identities enable row level security;
alter table identity.identities force row level security;
create policy identities_owner on identity.identities for all to svc_identity using (true) with check (true);
grant select, insert, update, delete on identity.identities to svc_identity;
