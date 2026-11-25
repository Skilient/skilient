-- identity: two-factor and passwords (W1 steps 7 and 8). Forward-only.

-- Several authenticators per account, as today (apps/web/lib/actions/mfa.ts allows up to 5; the limit is
-- in the service). At most one unverified factor per account (an abandoned set-up is replaced).
drop index identity.totp_factors_one_verified;
create index totp_factors_user on identity.totp_factors (user_id);
create unique index totp_factors_one_unverified on identity.totp_factors (user_id) where status = 'unverified';
alter table identity.totp_factors add column verified_at timestamptz;

-- Password reset links: the token is sent by email and only its SHA-256 is stored. One hour, single use;
-- asking again replaces the account's earlier links.
create table identity.password_reset_tokens (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references identity.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 hour',
  used_at timestamptz
);
create index password_reset_tokens_user on identity.password_reset_tokens (user_id);
alter table identity.password_reset_tokens enable row level security;
alter table identity.password_reset_tokens force row level security;
create policy password_reset_tokens_owner on identity.password_reset_tokens for all to svc_identity using (true) with check (true);
grant select, insert, update, delete on identity.password_reset_tokens to svc_identity;
