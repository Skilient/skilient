-- ranking: the formula, the published scores and their history, anti-gaming flags, adjustments, exam periods,
-- the nightly runs, what was last published to people, and the audit log of staff actions. Ported from
-- _ranking.sql, _leaderboard.sql and the formula v2 parts of _the_record.sql. Forward-only.

-- The score formula (platform_config 'ranking.formula' today). Its version is the formula version every score
-- records; the one in force is the newest whose effective_at has passed. Versions 1 and 2 as on the stack;
-- config.changed (trust, W10) adds later ones.
create table ranking.formulas (
  version integer primary key check (version >= 1),
  value jsonb not null,
  effective_at timestamptz not null default now(),
  reason text not null default ''
);
insert into ranking.formulas (version, value, effective_at, reason) values
  (1, '{"caps": {"work": 1125, "skills": 500, "momentum": 375, "credentials": 125, "endorsements": 375}, "work": {"member": 1.0, "pr_cap": 200, "creator": 1.3, "pr_points": 10, "venture_points": 150, "unconfirmed_entry": 0.25}, "decay": {"floor": 0.4, "weekly": 0.02, "grace_days": 14}, "rings": {"window_days": 180}, "tiers": {"flare": 250, "shine": 500, "spark": 100, "radiant": 1000, "luminary": 2000, "drop_days": 14, "radiant_top": 0.1, "shine_level": 3, "luminary_top": 0.02, "flare_ventures": 2, "shine_completed": 1, "flare_endorsements": 3}, "skills": {"span_bonus": 0.1, "level_points": {"2": 15, "3": 20, "4": 25}, "span_categories": 3}, "momentum": {"weeks": 12, "join_cap": 40, "join_hours": 72, "confirm_cap": 40, "content_cap": 175, "join_points": 4, "min_answers": 5, "week_points": 10, "confirm_points": 2, "citizenship_cap": 80, "consistency_cap": 120, "min_non_friends": 3}, "penalties": {"low": 50, "high": 300, "medium": 150, "months": 12}, "batch_size": 500, "complexity": {"base": 0.8, "span": 0.5, "max_tags": 8, "min_team": 2, "min_weeks": 1, "team_range": 4, "weeks_range": 15, "max_extra_deliverables": 3}, "rapid_gain": {"points": 150, "completions": 2, "completion_days": 7}, "credentials": {"points": 40, "recognised": 1.5}, "endorsements": {"mutual": 0.5, "points": 15, "tier_weights": {"raw": 0.5, "none": 0.5, "flare": 0.9, "shine": 1.1, "spark": 0.7, "radiant": 1.3, "luminary": 1.5}}}',
   '2026-10-10 19:55:03.650194+00', 'PRD 5.13 formula v1 with the phase 4 answers (decisions.md 2026-09-30)'),
  (2, '{"caps": {"work": 1125, "record": 100, "skills": 500, "momentum": 375, "credentials": 125, "endorsements": 375}, "work": {"member": 1.0, "pr_cap": 200, "creator": 1.3, "pr_points": 10, "venture_points": 150, "unconfirmed_entry": 0.25}, "decay": {"floor": 0.4, "weekly": 0.02, "grace_days": 14}, "rings": {"window_days": 180}, "tiers": {"flare": 250, "shine": 500, "spark": 100, "radiant": 1000, "luminary": 2000, "drop_days": 14, "radiant_top": 0.1, "shine_level": 3, "luminary_top": 0.02, "flare_ventures": 2, "shine_completed": 1, "flare_endorsements": 3}, "record": {"places": {"1": 30, "2": 20, "3": 15}, "officer": 25, "finalist": 10, "hold_days": 30, "president": 35, "society_cap": 50, "min_entrants": 5, "volunteer_hour": 2, "volunteer_year_cap": 20}, "skills": {"span_bonus": 0.1, "level_points": {"2": 15, "3": 20, "4": 25}, "span_categories": 3}, "momentum": {"weeks": 12, "join_cap": 40, "join_hours": 72, "confirm_cap": 40, "content_cap": 175, "join_points": 4, "min_answers": 5, "week_points": 10, "confirm_points": 2, "citizenship_cap": 80, "consistency_cap": 120, "min_non_friends": 3}, "penalties": {"low": 50, "high": 300, "medium": 150, "months": 12}, "batch_size": 500, "complexity": {"base": 0.8, "span": 0.5, "max_tags": 8, "min_team": 2, "min_weeks": 1, "team_range": 4, "weeks_range": 15, "max_extra_deliverables": 3}, "rapid_gain": {"points": 150, "completions": 2, "completion_days": 7}, "credentials": {"points": 40, "recognised": 1.5}, "endorsements": {"mutual": 0.5, "points": 15, "tier_weights": {"raw": 0.5, "none": 0.5, "flare": 0.9, "shine": 1.1, "spark": 0.7, "radiant": 1.3, "luminary": 1.5}}}',
   '2026-11-24 21:26:48.006301+00', 'PRD 5.30 formula v2: adds the Record component (at most 100 points; office-bearer terms, results with 5+ entrants, volunteer hours; 50 per society; attendance never counts)');

-- Exam periods pause Momentum decay for that university's students (PRD 5.13). At most 45 days, both ends included.
create table ranking.exam_periods (
  id uuid primary key,
  university_id uuid not null,
  starts_on date not null,
  ends_on date not null,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  created_by uuid,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on < 45)
);
create index exam_periods_university_idx on ranking.exam_periods (university_id, starts_on);

-- One row per student: the published score. held_total is a computed score waiting on a rapid-gain review.
create table ranking.ranking_scores (
  user_id uuid primary key,
  formula_version integer not null,
  components jsonb not null,
  proof numeric(8, 2) not null,
  momentum numeric(8, 2) not null,
  adjustments numeric(8, 2) not null,
  total numeric(8, 2) not null check (total >= 0),
  ranked boolean not null,
  tier text check (tier in ('raw', 'spark', 'flare', 'shine', 'radiant', 'luminary')),
  tier_met text check (tier_met in ('raw', 'spark', 'flare', 'shine', 'radiant', 'luminary')),
  percentile double precision check (percentile is null or percentile between 0 and 1),
  below_since date,
  momentum_peak numeric(8, 2) not null default 0,
  held boolean not null default false,
  held_total numeric(8, 2),
  computed_at timestamptz not null,
  published_at timestamptz not null,
  check (held = (held_total is not null))
);
create index ranking_scores_ranked_total_idx on ranking.ranking_scores (total desc) where ranked;

create table ranking.ranking_snapshots (
  user_id uuid not null,
  week date not null,
  formula_version integer not null,
  components jsonb not null,
  total numeric(8, 2) not null,
  ranked boolean not null,
  tier text,
  percentile double precision,
  primary key (user_id, week)
);
create index ranking_snapshots_week_idx on ranking.ranking_snapshots (week);

-- Rings and rapid gains (found by the run), swap repeats and rings (work's swap.flagged), for trust reviewers.
create table ranking.anti_gaming_flags (
  id uuid primary key,
  kind text not null check (kind in ('ring', 'rapid_gain', 'swap_ring', 'swap_repeat')),
  user_id uuid,
  members uuid[] not null check (cardinality(members) >= 1),
  endorsement_ids uuid[] not null default '{}',
  detail jsonb not null default '{}',
  status text not null default 'open' check (status in ('open', 'cleared', 'upheld')),
  claimed_by uuid,
  claimed_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  reason text check (reason is null or char_length(btrim(reason)) between 3 and 2000),
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'rapid_gain') = (user_id is not null)),
  check ((status = 'open') = (reviewed_at is null))
);
create unique index anti_gaming_flags_one_open_gain on ranking.anti_gaming_flags (user_id) where kind = 'rapid_gain' and status = 'open';
create index anti_gaming_flags_open_idx on ranking.anti_gaming_flags (created_at) where status = 'open';
create index anti_gaming_flags_members_idx on ranking.anti_gaming_flags using gin (members);
create index anti_gaming_flags_endorsements_idx on ranking.anti_gaming_flags using gin (endorsement_ids);

-- Penalties (trust's case.resolved, by severity; the last 12 months count) and upheld rapid gains. A penalty's
-- reason stays with trust's case (event payloads carry no free text); case_id names it.
create table ranking.ranking_adjustments (
  id uuid primary key,
  user_id uuid not null,
  kind text not null check (kind in ('penalty', 'rapid_gain')),
  severity text check (severity in ('low', 'medium', 'high')),
  points numeric(8, 2) check (points < 0),
  reason text check (reason is null or char_length(btrim(reason)) between 3 and 2000),
  case_id uuid,
  flag_id uuid references ranking.anti_gaming_flags (id) on delete set null,
  staff_id uuid,
  created_at timestamptz not null default now(),
  check ((kind = 'penalty') = (severity is not null)),
  check ((kind = 'rapid_gain') = (points is not null))
);
create index ranking_adjustments_user_idx on ranking.ranking_adjustments (user_id, created_at);
create unique index ranking_adjustments_case_idx on ranking.ranking_adjustments (case_id) where case_id is not null;

-- The nightly runs, advanced one committed step at a time (the ranking-step job).
create table ranking.ranking_runs (
  id bigint generated always as identity primary key,
  run_on date not null unique,
  as_of timestamptz not null,
  formula_version integer not null,
  formula jsonb not null,
  stage text not null default 'rings' check (stage in ('rings', 'students', 'tiers', 'snapshot', 'done', 'failed')),
  cursor uuid,
  students integer not null default 0,
  held integer not null default 0,
  steps integer not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  check ((stage in ('done', 'failed')) = (finished_at is not null))
);
create index ranking_runs_open_idx on ranking.ranking_runs (id) where finished_at is null;

-- What ranking last told others about each student (tier.changed, fact.value_changed), so a run publishes only changes.
create table ranking.published (
  user_id uuid not null,
  key text not null,
  value jsonb not null,
  published_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Staff actions on ranking's data, with the state before and after (ops_audit_log today; trust builds the /ops
-- audit view from audit.recorded, W10).
create table ranking.audit_log (
  id uuid primary key,
  staff_id uuid not null,
  action text not null check (action ~ '^[a-z][a-z0-9_.]{0,99}$'),
  target_type text not null,
  target_id text not null,
  reason text not null,
  before jsonb not null default '{}',
  after jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_staff_idx on ranking.audit_log (staff_id, created_at);
create index audit_log_target_idx on ranking.audit_log (target_type, target_id, created_at);

-- Row-level security: enabled and forced on every table, one policy for the owning role.
alter table ranking.formulas enable row level security;
alter table ranking.formulas force row level security;
create policy formulas_owner on ranking.formulas for all to svc_ranking using (true) with check (true);
grant select, insert, update on ranking.formulas to svc_ranking;

alter table ranking.exam_periods enable row level security;
alter table ranking.exam_periods force row level security;
create policy exam_periods_owner on ranking.exam_periods for all to svc_ranking using (true) with check (true);
grant select, insert, update, delete on ranking.exam_periods to svc_ranking;

alter table ranking.ranking_scores enable row level security;
alter table ranking.ranking_scores force row level security;
create policy ranking_scores_owner on ranking.ranking_scores for all to svc_ranking using (true) with check (true);
grant select, insert, update, delete on ranking.ranking_scores to svc_ranking;

alter table ranking.ranking_snapshots enable row level security;
alter table ranking.ranking_snapshots force row level security;
create policy ranking_snapshots_owner on ranking.ranking_snapshots for all to svc_ranking using (true) with check (true);
grant select, insert, update, delete on ranking.ranking_snapshots to svc_ranking;

alter table ranking.anti_gaming_flags enable row level security;
alter table ranking.anti_gaming_flags force row level security;
create policy anti_gaming_flags_owner on ranking.anti_gaming_flags for all to svc_ranking using (true) with check (true);
grant select, insert, update, delete on ranking.anti_gaming_flags to svc_ranking;

alter table ranking.ranking_adjustments enable row level security;
alter table ranking.ranking_adjustments force row level security;
create policy ranking_adjustments_owner on ranking.ranking_adjustments for all to svc_ranking using (true) with check (true);
grant select, insert, update, delete on ranking.ranking_adjustments to svc_ranking;

alter table ranking.ranking_runs enable row level security;
alter table ranking.ranking_runs force row level security;
create policy ranking_runs_owner on ranking.ranking_runs for all to svc_ranking using (true) with check (true);
grant select, insert, update, delete on ranking.ranking_runs to svc_ranking;

alter table ranking.published enable row level security;
alter table ranking.published force row level security;
create policy published_owner on ranking.published for all to svc_ranking using (true) with check (true);
grant select, insert, update, delete on ranking.published to svc_ranking;

alter table ranking.audit_log enable row level security;
alter table ranking.audit_log force row level security;
create policy audit_log_owner on ranking.audit_log for all to svc_ranking using (true) with check (true);
grant select, insert on ranking.audit_log to svc_ranking;
