-- The `platform` schema: the shared event log and job queue (docs/azure/prd.md, "Layout" and "Events").
-- No service owns it. Every service's login role is a member of the nologin role `svc` and reaches these
-- tables only through it. Rows a service writes carry its role name (`owner` / `producer`), and every
-- policy except "read the event log" lets a role see only its own rows.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'svc') then
    create role svc nologin;
  end if;
end
$$;

grant usage on schema platform to svc;

-- ---------------------------------------------------------------------------
-- Event log. Append-only. Written in the same transaction as the change it describes.
-- `txid` lets a reader skip nothing: it reads only events whose transaction is older than every
-- transaction still open (pg_snapshot_xmin), ordered by (txid, seq).
-- ---------------------------------------------------------------------------
create table platform.events (
  seq bigint generated always as identity primary key,
  id uuid not null unique,
  type text not null check (type ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  version integer not null default 1 check (version >= 1),
  subjects uuid[] not null default '{}',
  payload jsonb not null default '{}' check (jsonb_typeof(payload) = 'object'),
  producer text not null default current_user,
  at timestamptz not null default now(),
  txid xid8 not null default pg_current_xact_id()
);
create index events_txid_seq on platform.events (txid, seq);
create index events_type_txid_seq on platform.events (type, txid, seq);
alter table platform.events enable row level security;
alter table platform.events force row level security;
-- Every service may read the log (that is what it is for); each writes only as itself and never updates or deletes.
create policy events_read on platform.events for select to svc using (true);
create policy events_append on platform.events for insert to svc with check (producer = current_user);
grant select, insert on platform.events to svc;

-- Where each consumer has read to. One row per consumer, claimed with FOR UPDATE SKIP LOCKED so one replica works at a time.
create table platform.cursors (
  consumer text primary key check (consumer ~ '^[a-z][a-z0-9_.-]{0,99}$'),
  owner text not null default current_user,
  last_txid xid8 not null default '0'::xid8,
  last_seq bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table platform.cursors enable row level security;
alter table platform.cursors force row level security;
create policy cursors_own on platform.cursors for all to svc using (owner = current_user) with check (owner = current_user);
grant select, insert, update on platform.cursors to svc;

-- Delivery is at least once: a handler applies an event only if this insert succeeds (prd.md, "Events").
create table platform.applied_events (
  consumer text not null,
  event_id uuid not null,
  owner text not null default current_user,
  applied_at timestamptz not null default now(),
  primary key (consumer, event_id)
);
alter table platform.applied_events enable row level security;
alter table platform.applied_events force row level security;
create policy applied_events_own on platform.applied_events for all to svc using (owner = current_user) with check (owner = current_user);
grant select, insert, delete on platform.applied_events to svc;

-- ---------------------------------------------------------------------------
-- Job queue and schedules ("Where the logic goes": jobs and schedules are rows in Postgres).
-- ---------------------------------------------------------------------------
create table platform.jobs (
  id bigint generated always as identity primary key,
  owner text not null default current_user,
  kind text not null check (kind ~ '^[a-z][a-z0-9_.-]{0,99}$'),
  payload jsonb not null default '{}' check (jsonb_typeof(payload) = 'object'),
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  run_at timestamptz not null default now(),
  attempts integer not null default 0,
  max_attempts integer not null default 5 check (max_attempts between 1 and 50),
  locked_by text,
  locked_until timestamptz,
  last_error text,
  dedupe_key text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (owner, dedupe_key)
);
create index jobs_ready on platform.jobs (owner, run_at) where status = 'queued';
create index jobs_running on platform.jobs (owner, locked_until) where status = 'running';
alter table platform.jobs enable row level security;
alter table platform.jobs force row level security;
create policy jobs_own on platform.jobs for all to svc using (owner = current_user) with check (owner = current_user);
grant select, insert, update, delete on platform.jobs to svc;

create table platform.schedules (
  owner text not null default current_user,
  name text not null check (name ~ '^[a-z][a-z0-9_.-]{0,99}$'),
  cron text not null,
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  primary key (owner, name)
);
alter table platform.schedules enable row level security;
alter table platform.schedules force row level security;
create policy schedules_own on platform.schedules for all to svc using (owner = current_user) with check (owner = current_user);
grant select, insert, update, delete on platform.schedules to svc;

-- ---------------------------------------------------------------------------
-- Client idempotency keys (prd.md, call rules: "Writes carry a client-made idempotency key; a repeat
-- returns the first result"). The response is stored as the method's encoded reply.
-- ---------------------------------------------------------------------------
create table platform.idempotency (
  owner text not null default current_user,
  actor text not null,
  method text not null,
  key text not null check (char_length(key) between 8 and 200),
  request_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'done')),
  response bytea,
  created_at timestamptz not null default now(),
  primary key (owner, actor, method, key)
);
create index idempotency_created on platform.idempotency (created_at);
alter table platform.idempotency enable row level security;
alter table platform.idempotency force row level security;
create policy idempotency_own on platform.idempotency for all to svc using (owner = current_user) with check (owner = current_user);
grant select, insert, update, delete on platform.idempotency to svc;
