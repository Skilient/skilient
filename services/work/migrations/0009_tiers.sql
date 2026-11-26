-- work: a copy of each student's ranking tier (ranking's, W6, by its tier event), read by compute_paths to
-- find the seniors a role path is learned from. Empty until ranking publishes: every path stays a starter path,
-- as on a stack with no ranked students. Forward-only.

create table work.ranking_tiers (
  user_id uuid primary key,
  tier text not null check (tier in ('raw', 'spark', 'flare', 'shine', 'radiant', 'luminary')),
  ranked boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table work.ranking_tiers enable row level security;
alter table work.ranking_tiers force row level security;
create policy ranking_tiers_owner on work.ranking_tiers for all to svc_work using (true) with check (true);
grant select, insert, update, delete on work.ranking_tiers to svc_work;
