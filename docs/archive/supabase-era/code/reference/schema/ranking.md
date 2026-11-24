Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# ranking

## private.assign_percentiles_and_tiers(p_on date, p_f jsonb)

[src: supabase/migrations/20261005000000_ranking.sql#assign_percentiles_and_tiers]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.assign_percentiles_and_tiers(p_on date, p_f jsonb) | plpgsql | true | search_path="" | None | 20261005000000_ranking.sql |

## private.claim_ranking_flag(p_id uuid, p_claim boolean)

[src: supabase/migrations/20261005000000_ranking.sql#claim_ranking_flag]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.claim_ranking_flag(p_id uuid, p_claim boolean) | plpgsql | true | search_path="" | authenticated | 20261005000000_ranking.sql |

## private.exam_days(p_university uuid, p_after date, p_through date)

[src: supabase/migrations/20261005000000_ranking.sql#exam_days]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.exam_days(p_university uuid, p_after date, p_through date) | sql | true | search_path="" | None | 20261005000000_ranking.sql |

## private.exam_period_list()

[src: supabase/migrations/20261005000000_ranking.sql#exam_period_list]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.exam_period_list() | plpgsql | true | search_path="" | authenticated | 20261005000000_ranking.sql |

## private.feed_score(p_post uuid, p_viewer uuid)

[src: supabase/migrations/20261005000000_ranking.sql#feed_score]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.feed_score(p_post uuid, p_viewer uuid) | plpgsql | true | search_path="" | None | 20261005000000_ranking.sql |

## private.post_quality(p_post uuid)

[src: supabase/migrations/20261005000000_ranking.sql#post_quality]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.post_quality(p_post uuid) | plpgsql | true | search_path="" | None | 20261005000000_ranking.sql |

## private.ranking_apply(p_run ranking_runs, p_user uuid)

[src: supabase/migrations/20261005000000_ranking.sql#ranking_apply]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ranking_apply(p_run ranking_runs, p_user uuid) | plpgsql | true | search_path="" | None | 20261005000000_ranking.sql |

## private.ranking_flag_case(p_id uuid)

[src: supabase/migrations/20261005000000_ranking.sql#ranking_flag_case]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ranking_flag_case(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261005000000_ranking.sql |

## private.ranking_flag_queue(p_status text)

[src: supabase/migrations/20261005000000_ranking.sql#ranking_flag_queue]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ranking_flag_queue(p_status text) | plpgsql | true | search_path="" | authenticated | 20261005000000_ranking.sql |

## private.ranking_formula()

[src: supabase/migrations/20261005000000_ranking.sql#ranking_formula]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ranking_formula() | sql | true | search_path="" | None | 20261005000000_ranking.sql |

## private.ranking_points(p jsonb)

[src: supabase/migrations/20261005000000_ranking.sql#ranking_points]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ranking_points(p jsonb) | sql | false | search_path="" | None | 20261005000000_ranking.sql |

## private.ranking_run_all(p_as_of timestamp with time zone)

[src: supabase/migrations/20261005000000_ranking.sql#ranking_run_all]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ranking_run_all(p_as_of timestamp with time zone) | plpgsql | true | search_path="" | None | 20261005000000_ranking.sql |

## private.ranking_start(p_as_of timestamp with time zone)

[src: supabase/migrations/20261005000000_ranking.sql#ranking_start]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ranking_start(p_as_of timestamp with time zone) | plpgsql | true | search_path="" | None | 20261005000000_ranking.sql |

## private.ranking_step()

[src: supabase/migrations/20261005000000_ranking.sql#ranking_step]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ranking_step() | plpgsql | true | search_path="" | None | 20261005000000_ranking.sql |

## private.record_venture_completion(p_venture uuid, p_backfilled boolean)

[src: supabase/migrations/20261005000000_ranking.sql#record_venture_completion]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.record_venture_completion(p_venture uuid, p_backfilled boolean) | plpgsql | true | search_path="" | None | 20261005000000_ranking.sql |

## private.require_accounts()

[src: supabase/migrations/20261005000000_ranking.sql#require_accounts]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.require_accounts() | plpgsql | true | search_path="" | None | 20261005000000_ranking.sql |

## private.review_ranking_flag(p_id uuid, p_uphold boolean, p_reason text)

[src: supabase/migrations/20261005000000_ranking.sql#review_ranking_flag]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.review_ranking_flag(p_id uuid, p_uphold boolean, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261005000000_ranking.sql |

## private.score_adjustments(p_user uuid, p_f jsonb, p_as_of timestamp with time zone)

[src: supabase/migrations/20261005000000_ranking.sql#score_adjustments]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.score_adjustments(p_user uuid, p_f jsonb, p_as_of timestamp with time zone) | plpgsql | true | search_path="" | None | 20261005000000_ranking.sql |

## private.score_credentials(p_user uuid, p_f jsonb, p_today date)

[src: supabase/migrations/20261005000000_ranking.sql#score_credentials]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.score_credentials(p_user uuid, p_f jsonb, p_today date) | plpgsql | true | search_path="" | None | 20261005000000_ranking.sql |

## private.score_momentum(p_user uuid, p_f jsonb, p_as_of timestamp with time zone, p_prev_peak numeric)

[src: supabase/migrations/20261005000000_ranking.sql#score_momentum]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.score_momentum(p_user uuid, p_f jsonb, p_as_of timestamp with time zone, p_prev_peak numeric) | plpgsql | true | search_path="" | None | 20261005000000_ranking.sql |

## private.score_skills(p_user uuid, p_f jsonb)

[src: supabase/migrations/20261005000000_ranking.sql#score_skills]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.score_skills(p_user uuid, p_f jsonb) | plpgsql | true | search_path="" | None | 20261005000000_ranking.sql |

## private.score_work(p_user uuid, p_f jsonb)

[src: supabase/migrations/20261005000000_ranking.sql#score_work]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.score_work(p_user uuid, p_f jsonb) | plpgsql | true | search_path="" | None | 20261005000000_ranking.sql |

## private.take_ranking_snapshot(p_on date)

[src: supabase/migrations/20261005000000_ranking.sql#take_ranking_snapshot]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.take_ranking_snapshot(p_on date) | plpgsql | true | search_path="" | None | 20261005000000_ranking.sql |

## private.tier_met(p_ranked boolean, p_total numeric, p_percentile double precision, p_facts jsonb, p_f jsonb)

[src: supabase/migrations/20261005000000_ranking.sql#tier_met]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.tier_met(p_ranked boolean, p_total numeric, p_percentile double precision, p_facts jsonb, p_f jsonb) | plpgsql | false | search_path="" | None | 20261005000000_ranking.sql |

## private.venture_complexity(p_team integer, p_weeks numeric, p_tags integer, p_deliverables integer, p_f jsonb)

[src: supabase/migrations/20261005000000_ranking.sql#venture_complexity]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.venture_complexity(p_team integer, p_weeks numeric, p_tags integer, p_deliverables integer, p_f jsonb) | sql | false | search_path="" | None | 20261005000000_ranking.sql |

## private.venture_outside_evidence(p_venture uuid, p_endorsee uuid)

[src: supabase/migrations/20261005000000_ranking.sql#venture_outside_evidence]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.venture_outside_evidence(p_venture uuid, p_endorsee uuid) | sql | true | search_path="" | None | 20261005000000_ranking.sql |

## private.ventures_record_completion()

[src: supabase/migrations/20261005000000_ranking.sql#ventures_record_completion]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ventures_record_completion() | plpgsql | true | search_path="" | None | 20261005000000_ranking.sql |

## private.verified_entries(p_user uuid)

[src: supabase/migrations/20261005000000_ranking.sql#verified_entries]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.verified_entries(p_user uuid) | sql | true | search_path="" | None | 20261005000000_ranking.sql |

## public.add_exam_period(p_university uuid, p_starts date, p_ends date, p_reason text)

[src: supabase/migrations/20261005000000_ranking.sql#add_exam_period]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.add_exam_period(p_university uuid, p_starts date, p_ends date, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261005000000_ranking.sql |

## public.claim_ranking_flag(p_id uuid, p_claim boolean)

[src: supabase/migrations/20261005000000_ranking.sql#claim_ranking_flag]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.claim_ranking_flag(p_id uuid, p_claim boolean) | sql | false | search_path="" | authenticated, service_role | 20261005000000_ranking.sql |

## public.exam_period_list()

[src: supabase/migrations/20261005000000_ranking.sql#exam_period_list]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.exam_period_list() | sql | false | search_path="" | authenticated, service_role | 20261005000000_ranking.sql |

## public.ranking_flag_case(p_id uuid)

[src: supabase/migrations/20261005000000_ranking.sql#ranking_flag_case]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ranking_flag_case(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261005000000_ranking.sql |

## public.ranking_flag_queue(p_status text)

[src: supabase/migrations/20261005000000_ranking.sql#ranking_flag_queue]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ranking_flag_queue(p_status text) | sql | false | search_path="" | authenticated, service_role | 20261005000000_ranking.sql |

## public.remove_exam_period(p_id uuid, p_reason text)

[src: supabase/migrations/20261005000000_ranking.sql#remove_exam_period]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.remove_exam_period(p_id uuid, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261005000000_ranking.sql |

## public.resolve_case(p_case uuid, p_action text, p_reason text, p_severity text)

[src: supabase/migrations/20261005000000_ranking.sql#resolve_case]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.resolve_case(p_case uuid, p_action text, p_reason text, p_severity text) | sql | false | search_path="" | authenticated, service_role | 20261005000000_ranking.sql |

## public.review_ranking_flag(p_id uuid, p_uphold boolean, p_reason text)

[src: supabase/migrations/20261005000000_ranking.sql#review_ranking_flag]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.review_ranking_flag(p_id uuid, p_uphold boolean, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261005000000_ranking.sql |

## public.anti_gaming_flags

[src: supabase/migrations/20261005000000_ranking.sql#anti_gaming_flags]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| kind | anti_gaming_kind | true | — |  |  | — |
| user_id | uuid | false | — |  |  | — |
| members | uuid[] | true | — |  |  | — |
| endorsement_ids | uuid[] | true | '{}'::uuid[] |  |  | — |
| detail | jsonb | true | '{}'::jsonb |  |  | — |
| status | review_flag_status | true | 'open'::review_flag_status |  |  | — |
| claimed_by | uuid | false | — |  |  | — |
| claimed_at | timestamp with time zone | false | — |  |  | — |
| reviewed_by | uuid | false | — |  |  | — |
| reviewed_at | timestamp with time zone | false | — |  |  | — |
| reason | text | false | — |  |  | "default" |
| applied_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
anti_gaming_flags_check: CHECK ((kind = 'rapid_gain'::anti_gaming_kind) = (user_id IS NOT NULL)); -- validated: true
```

```sql
anti_gaming_flags_check1: CHECK ((status = 'open'::review_flag_status) = (reviewed_at IS NULL)); -- validated: true
```

```sql
anti_gaming_flags_claimed_by_fkey: FOREIGN KEY (claimed_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
anti_gaming_flags_members_check: CHECK (cardinality(members) >= 1); -- validated: true
```

```sql
anti_gaming_flags_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
anti_gaming_flags_reason_check: CHECK (reason IS NULL OR char_length(btrim(reason)) >= 3 AND char_length(btrim(reason)) <= 2000); -- validated: true
```

```sql
anti_gaming_flags_reviewed_by_fkey: FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
anti_gaming_flags_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX anti_gaming_flags_claimed_by_idx ON public.anti_gaming_flags USING btree (claimed_by) WHERE (claimed_by IS NOT NULL); -- valid: true
```

```sql
CREATE INDEX anti_gaming_flags_endorsements_idx ON public.anti_gaming_flags USING gin (endorsement_ids); -- valid: true
```

```sql
CREATE INDEX anti_gaming_flags_members_idx ON public.anti_gaming_flags USING gin (members); -- valid: true
```

```sql
CREATE UNIQUE INDEX anti_gaming_flags_one_open_gain ON public.anti_gaming_flags USING btree (user_id) WHERE ((kind = 'rapid_gain'::anti_gaming_kind) AND (status = 'open'::review_flag_status)); -- valid: true
```

```sql
CREATE INDEX anti_gaming_flags_open_idx ON public.anti_gaming_flags USING btree (created_at) WHERE (status = 'open'::review_flag_status); -- valid: true
```

```sql
CREATE UNIQUE INDEX anti_gaming_flags_pkey ON public.anti_gaming_flags USING btree (id); -- valid: true
```

```sql
CREATE INDEX anti_gaming_flags_reviewed_by_idx ON public.anti_gaming_flags USING btree (reviewed_by) WHERE (reviewed_by IS NOT NULL); -- valid: true
```

```sql
CREATE INDEX anti_gaming_flags_user_idx ON public.anti_gaming_flags USING btree (user_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.exam_periods

[src: supabase/migrations/20261005000000_ranking.sql#exam_periods]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| university_id | uuid | true | — |  |  | — |
| starts_on | date | true | — |  |  | — |
| ends_on | date | true | — |  |  | — |
| reason | text | true | — |  |  | "default" |
| created_by | uuid | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
exam_periods_check: CHECK (ends_on >= starts_on AND (ends_on - starts_on) < 45); -- validated: true
```

```sql
exam_periods_created_by_fkey: FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
exam_periods_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
exam_periods_reason_check: CHECK (char_length(btrim(reason)) >= 3 AND char_length(btrim(reason)) <= 500); -- validated: true
```

```sql
exam_periods_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX exam_periods_created_by_idx ON public.exam_periods USING btree (created_by); -- valid: true
```

```sql
CREATE UNIQUE INDEX exam_periods_pkey ON public.exam_periods USING btree (id); -- valid: true
```

```sql
CREATE INDEX exam_periods_university_idx ON public.exam_periods USING btree (university_id, starts_on); -- valid: true
```

### Policies

#### exam_periods.exam_periods_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((university_id = ( SELECT private.current_university_id() AS current_university_id)) OR ( SELECT private.is_staff('accounts'::staff_role) AS is_staff))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.

## public.ranking_adjustments

[src: supabase/migrations/20261005000000_ranking.sql#ranking_adjustments]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| user_id | uuid | true | — |  |  | — |
| kind | ranking_adjustment_kind | true | — |  |  | — |
| severity | text | false | — |  |  | "default" |
| points | numeric(8,2) | false | — |  |  | — |
| reason | text | true | — |  |  | "default" |
| case_id | uuid | false | — |  |  | — |
| flag_id | uuid | false | — |  |  | — |
| staff_id | uuid | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
ranking_adjustments_case_id_fkey: FOREIGN KEY (case_id) REFERENCES report_cases(id) ON DELETE SET NULL; -- validated: true
```

```sql
ranking_adjustments_check: CHECK ((kind = 'penalty'::ranking_adjustment_kind) = (severity IS NOT NULL)); -- validated: true
```

```sql
ranking_adjustments_check1: CHECK ((kind = 'rapid_gain'::ranking_adjustment_kind) = (points IS NOT NULL)); -- validated: true
```

```sql
ranking_adjustments_flag_id_fkey: FOREIGN KEY (flag_id) REFERENCES anti_gaming_flags(id) ON DELETE SET NULL; -- validated: true
```

```sql
ranking_adjustments_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
ranking_adjustments_points_check: CHECK (points < 0::numeric); -- validated: true
```

```sql
ranking_adjustments_reason_check: CHECK (char_length(btrim(reason)) >= 3 AND char_length(btrim(reason)) <= 2000); -- validated: true
```

```sql
ranking_adjustments_severity_check: CHECK (severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])); -- validated: true
```

```sql
ranking_adjustments_staff_id_fkey: FOREIGN KEY (staff_id) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
ranking_adjustments_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX ranking_adjustments_case_idx ON public.ranking_adjustments USING btree (case_id) WHERE (case_id IS NOT NULL); -- valid: true
```

```sql
CREATE INDEX ranking_adjustments_flag_idx ON public.ranking_adjustments USING btree (flag_id) WHERE (flag_id IS NOT NULL); -- valid: true
```

```sql
CREATE UNIQUE INDEX ranking_adjustments_pkey ON public.ranking_adjustments USING btree (id); -- valid: true
```

```sql
CREATE INDEX ranking_adjustments_staff_idx ON public.ranking_adjustments USING btree (staff_id) WHERE (staff_id IS NOT NULL); -- valid: true
```

```sql
CREATE INDEX ranking_adjustments_user_idx ON public.ranking_adjustments USING btree (user_id, created_at); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.ranking_runs

[src: supabase/migrations/20261005000000_ranking.sql#ranking_runs]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint | true | — | a |  | — |
| run_on | date | true | — |  |  | — |
| as_of | timestamp with time zone | true | — |  |  | — |
| formula_version | integer | true | — |  |  | — |
| formula | jsonb | true | — |  |  | — |
| stage | text | true | 'rings'::text |  |  | "default" |
| cursor | uuid | false | — |  |  | — |
| students | integer | true | 0 |  |  | — |
| held | integer | true | 0 |  |  | — |
| steps | integer | true | 0 |  |  | — |
| job_run_id | uuid | false | — |  |  | — |
| error | text | false | — |  |  | "default" |
| started_at | timestamp with time zone | true | now() |  |  | — |
| finished_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
ranking_runs_check: CHECK ((stage = ANY (ARRAY['done'::text, 'failed'::text])) = (finished_at IS NOT NULL)); -- validated: true
```

```sql
ranking_runs_job_run_id_fkey: FOREIGN KEY (job_run_id) REFERENCES job_runs(id) ON DELETE SET NULL; -- validated: true
```

```sql
ranking_runs_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
ranking_runs_run_on_key: UNIQUE (run_on); -- validated: true
```

```sql
ranking_runs_stage_check: CHECK (stage = ANY (ARRAY['rings'::text, 'students'::text, 'tiers'::text, 'snapshot'::text, 'done'::text, 'failed'::text])); -- validated: true
```

### Indexes

```sql
CREATE INDEX ranking_runs_job_run_idx ON public.ranking_runs USING btree (job_run_id); -- valid: true
```

```sql
CREATE INDEX ranking_runs_open_idx ON public.ranking_runs USING btree (id) WHERE (finished_at IS NULL); -- valid: true
```

```sql
CREATE UNIQUE INDEX ranking_runs_pkey ON public.ranking_runs USING btree (id); -- valid: true
```

```sql
CREATE UNIQUE INDEX ranking_runs_run_on_key ON public.ranking_runs USING btree (run_on); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.ranking_scores

[src: supabase/migrations/20261005000000_ranking.sql#ranking_scores]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| formula_version | integer | true | — |  |  | — |
| components | jsonb | true | — |  |  | — |
| proof | numeric(8,2) | true | — |  |  | — |
| momentum | numeric(8,2) | true | — |  |  | — |
| adjustments | numeric(8,2) | true | — |  |  | — |
| total | numeric(8,2) | true | — |  |  | — |
| ranked | boolean | true | — |  |  | — |
| tier | ranking_tier | false | — |  |  | — |
| tier_met | ranking_tier | false | — |  |  | — |
| percentile | double precision | false | — |  |  | — |
| below_since | date | false | — |  |  | — |
| momentum_peak | numeric(8,2) | true | 0 |  |  | — |
| held | boolean | true | false |  |  | — |
| held_total | numeric(8,2) | false | — |  |  | — |
| computed_at | timestamp with time zone | true | — |  |  | — |
| published_at | timestamp with time zone | true | — |  |  | — |

### Keys and constraints

```sql
ranking_scores_check: CHECK (held = (held_total IS NOT NULL)); -- validated: true
```

```sql
ranking_scores_percentile_check: CHECK (percentile IS NULL OR percentile >= 0::double precision AND percentile <= 1::double precision); -- validated: true
```

```sql
ranking_scores_pkey: PRIMARY KEY (user_id); -- validated: true
```

```sql
ranking_scores_total_check: CHECK (total >= 0::numeric); -- validated: true
```

```sql
ranking_scores_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX ranking_scores_pkey ON public.ranking_scores USING btree (user_id); -- valid: true
```

```sql
CREATE INDEX ranking_scores_ranked_total_idx ON public.ranking_scores USING btree (total DESC) WHERE ranked; -- valid: true
```

### Policies

#### ranking_scores.ranking_scores_owner_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "(user_id = ( SELECT auth.uid() AS uid))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER ranking_scores_analytics_insert AFTER INSERT ON ranking_scores FOR EACH ROW WHEN (new.tier IS NOT NULL) EXECUTE FUNCTION private.analytics_tier(); -- enabled: O
```

```sql
CREATE TRIGGER ranking_scores_analytics_update AFTER UPDATE OF tier ON ranking_scores FOR EACH ROW WHEN (new.tier IS DISTINCT FROM old.tier AND new.tier IS NOT NULL) EXECUTE FUNCTION private.analytics_tier(); -- enabled: O
```

## public.ranking_snapshots

[src: supabase/migrations/20261005000000_ranking.sql#ranking_snapshots]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| week | date | true | — |  |  | — |
| formula_version | integer | true | — |  |  | — |
| components | jsonb | true | — |  |  | — |
| total | numeric(8,2) | true | — |  |  | — |
| ranked | boolean | true | — |  |  | — |
| tier | ranking_tier | false | — |  |  | — |
| percentile | double precision | false | — |  |  | — |

### Keys and constraints

```sql
ranking_snapshots_pkey: PRIMARY KEY (user_id, week); -- validated: true
```

```sql
ranking_snapshots_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX ranking_snapshots_pkey ON public.ranking_snapshots USING btree (user_id, week); -- valid: true
```

```sql
CREATE INDEX ranking_snapshots_week_idx ON public.ranking_snapshots USING btree (week); -- valid: true
```

### Policies

#### ranking_snapshots.ranking_snapshots_owner_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "(user_id = ( SELECT auth.uid() AS uid))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.

## public.venture_completion_members

[src: supabase/migrations/20261005000000_ranking.sql#venture_completion_members]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| venture_id | uuid | true | — |  |  | — |
| user_id | uuid | true | — |  |  | — |
| github_days | integer | true | 0 |  |  | — |
| verified_entries | integer | true | 0 |  |  | — |
| unconfirmed_entries | integer | true | 0 |  |  | — |

### Keys and constraints

```sql
venture_completion_members_github_days_check: CHECK (github_days >= 0); -- validated: true
```

```sql
venture_completion_members_pkey: PRIMARY KEY (venture_id, user_id); -- validated: true
```

```sql
venture_completion_members_unconfirmed_entries_check: CHECK (unconfirmed_entries >= 0); -- validated: true
```

```sql
venture_completion_members_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
venture_completion_members_venture_id_fkey: FOREIGN KEY (venture_id) REFERENCES venture_completions(venture_id) ON DELETE CASCADE; -- validated: true
```

```sql
venture_completion_members_verified_entries_check: CHECK (verified_entries >= 0); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX venture_completion_members_pkey ON public.venture_completion_members USING btree (venture_id, user_id); -- valid: true
```

```sql
CREATE INDEX venture_completion_members_user_idx ON public.venture_completion_members USING btree (user_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.venture_completions

[src: supabase/migrations/20261005000000_ranking.sql#venture_completions]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| venture_id | uuid | true | — |  |  | — |
| owner_id | uuid | false | — |  |  | — |
| completed_at | timestamp with time zone | true | — |  |  | — |
| team_size | smallint | true | — |  |  | — |
| weeks | numeric(7,2) | true | — |  |  | — |
| skill_tags | smallint | true | — |  |  | — |
| deliverables | smallint | true | — |  |  | — |
| verified_members | smallint | true | — |  |  | — |
| backfilled | boolean | true | false |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
venture_completions_deliverables_check: CHECK (deliverables >= 0); -- validated: true
```

```sql
venture_completions_owner_id_fkey: FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
venture_completions_pkey: PRIMARY KEY (venture_id); -- validated: true
```

```sql
venture_completions_skill_tags_check: CHECK (skill_tags >= 0); -- validated: true
```

```sql
venture_completions_team_size_check: CHECK (team_size >= 0 AND team_size <= 6); -- validated: true
```

```sql
venture_completions_venture_id_fkey: FOREIGN KEY (venture_id) REFERENCES ventures(id) ON DELETE CASCADE; -- validated: true
```

```sql
venture_completions_verified_members_check: CHECK (verified_members >= 0); -- validated: true
```

```sql
venture_completions_weeks_check: CHECK (weeks >= 0::numeric); -- validated: true
```

### Indexes

```sql
CREATE INDEX venture_completions_owner_idx ON public.venture_completions USING btree (owner_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX venture_completions_pkey ON public.venture_completions USING btree (venture_id); -- valid: true
```

### Policies

None.

### Triggers

None.
