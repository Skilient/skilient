-- work: a copy of ranking's anti-gaming flags (W6, `ranking_flag.changed`): the proof-task peer-review check
-- (task_peer_ok) never pairs two members of an open or upheld ring, swap ring or swap repeat flag. Only those kinds
-- are kept; a flag that is cleared is deleted. Forward-only.

create table work.ranking_flags (
  flag_id uuid primary key,
  kind text not null check (kind in ('ring', 'swap_ring', 'swap_repeat')),
  members uuid[] not null,
  status text not null check (status in ('open', 'upheld')),
  updated_at timestamptz not null default now()
);
create index ranking_flags_members_idx on work.ranking_flags using gin (members);

alter table work.ranking_flags enable row level security;
alter table work.ranking_flags force row level security;
create policy ranking_flags_owner on work.ranking_flags for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.ranking_flags to svc_work;
