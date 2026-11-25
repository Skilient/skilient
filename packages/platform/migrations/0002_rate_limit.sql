-- Rate limiting for every service (decision 2026-11-25, Q12): one implementation in packages/platform,
-- each service's hits visible only to its own role. Forward-only.
create table platform.rate_limit_events (
  owner text not null default current_user,
  key text not null check (char_length(key) between 1 and 200),
  created_at timestamptz not null default now()
);
create index rate_limit_events_owner_key on platform.rate_limit_events (owner, key, created_at);
alter table platform.rate_limit_events enable row level security;
alter table platform.rate_limit_events force row level security;
create policy rate_limit_events_own on platform.rate_limit_events for all to svc using (owner = current_user) with check (owner = current_user);
grant select, insert, delete on platform.rate_limit_events to svc;
