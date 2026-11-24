Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# uni_records

## private.hide_small(p_n bigint)

[src: supabase/migrations/20261021000000_uni_records.sql#hide_small]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.hide_small(p_n bigint) | sql | false | search_path="" | None | 20261021000000_uni_records.sql |

## private.my_record_viewers()

[src: supabase/migrations/20261021000000_uni_records.sql#my_record_viewers]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_record_viewers() | plpgsql | true | search_path="" | authenticated | 20261021000000_uni_records.sql |

## private.uni_benchmark_compute()

[src: supabase/migrations/20261021000000_uni_records.sql#uni_benchmark_compute]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_benchmark_compute() | sql | true | search_path="" | None | 20261021000000_uni_records.sql |

## private.uni_dashboard(p_area text)

[src: supabase/migrations/20261021000000_uni_records.sql#uni_dashboard]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_dashboard(p_area text) | plpgsql | true | search_path="" | authenticated | 20261021000000_uni_records.sql |

## private.uni_home()

[src: supabase/migrations/20261021000000_uni_records.sql#uni_home]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_home() | plpgsql | true | search_path="" | authenticated | 20261021000000_uni_records.sql |

## private.uni_recent_feed()

[src: supabase/migrations/20261021000000_uni_records.sql#uni_recent_feed]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_recent_feed() | plpgsql | true | search_path="" | authenticated | 20261021000000_uni_records.sql |

## private.uni_stats_compute(p_university uuid)

[src: supabase/migrations/20261021000000_uni_records.sql#uni_stats_compute]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_stats_compute(p_university uuid) | plpgsql | true | search_path="" | None | 20261021000000_uni_records.sql |

## private.uni_stats_run()

[src: supabase/migrations/20261021000000_uni_records.sql#uni_stats_run]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_stats_run() | plpgsql | true | search_path="" | service_role | 20261021000000_uni_records.sql |

## private.uni_students(p_q text, p_department uuid, p_batch integer, p_offset integer)

[src: supabase/migrations/20261021000000_uni_records.sql#uni_students]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_students(p_q text, p_department uuid, p_batch integer, p_offset integer) | plpgsql | true | search_path="" | authenticated | 20261021000000_uni_records.sql |

## private.university_student_record(p_student uuid)

[src: supabase/migrations/20261021000000_uni_records.sql#university_student_record]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.university_student_record(p_student uuid) | plpgsql | true | search_path="" | authenticated | 20261021000000_uni_records.sql |

## public.my_record_viewers()

[src: supabase/migrations/20261021000000_uni_records.sql#my_record_viewers]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_record_viewers() | sql | false | search_path="" | authenticated, service_role | 20261021000000_uni_records.sql |

## public.uni_dashboard(p_area text)

[src: supabase/migrations/20261021000000_uni_records.sql#uni_dashboard]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_dashboard(p_area text) | sql | false | search_path="" | authenticated, service_role | 20261021000000_uni_records.sql |

## public.uni_home()

[src: supabase/migrations/20261021000000_uni_records.sql#uni_home]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_home() | sql | false | search_path="" | authenticated, service_role | 20261021000000_uni_records.sql |

## public.uni_recent_feed()

[src: supabase/migrations/20261021000000_uni_records.sql#uni_recent_feed]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_recent_feed() | sql | false | search_path="" | authenticated, service_role | 20261021000000_uni_records.sql |

## public.uni_sponsorship()

[src: supabase/migrations/20261021000000_uni_records.sql#uni_sponsorship]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_sponsorship() | sql | false | search_path="" | authenticated, service_role | 20261021000000_uni_records.sql |

## public.uni_students(p_q text, p_department uuid, p_batch integer, p_offset integer)

[src: supabase/migrations/20261021000000_uni_records.sql#uni_students]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_students(p_q text, p_department uuid, p_batch integer, p_offset integer) | sql | false | search_path="" | authenticated, service_role | 20261021000000_uni_records.sql |

## public.university_student_record(p_student uuid)

[src: supabase/migrations/20261021000000_uni_records.sql#university_student_record]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.university_student_record(p_student uuid) | sql | false | search_path="" | authenticated, service_role | 20261021000000_uni_records.sql |

## public.student_record_access_log

[src: supabase/migrations/20261021000000_uni_records.sql#student_record_access_log]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint | true | — | a |  | — |
| university_id | uuid | true | — |  |  | — |
| viewer_id | uuid | false | — |  |  | — |
| viewer_name | text | true | — |  |  | "default" |
| viewer_role | uni_admin_role | true | — |  |  | — |
| student_id | uuid | true | — |  |  | — |
| at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
student_record_access_log_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
student_record_access_log_student_id_fkey: FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
student_record_access_log_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE; -- validated: true
```

```sql
student_record_access_log_viewer_id_fkey: FOREIGN KEY (viewer_id) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX student_record_access_log_pkey ON public.student_record_access_log USING btree (id); -- valid: true
```

```sql
CREATE INDEX student_record_access_log_student_idx ON public.student_record_access_log USING btree (student_id, at DESC); -- valid: true
```

```sql
CREATE INDEX student_record_access_log_uni_idx ON public.student_record_access_log USING btree (university_id, at DESC); -- valid: true
```

```sql
CREATE INDEX student_record_access_log_viewer_idx ON public.student_record_access_log USING btree (viewer_id, at DESC); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.uni_stats

[src: supabase/migrations/20261021000000_uni_records.sql#uni_stats]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| university_id | uuid | true | — |  |  | — |
| area | text | true | — |  |  | "default" |
| data | jsonb | true | — |  |  | — |
| computed_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
uni_stats_area_check: CHECK (area = ANY (ARRAY['home'::text, 'adoption'::text, 'activity'::text, 'skills'::text, 'skills_gap'::text, 'tiers'::text, 'outcomes'::text, 'faculty'::text, 'benchmark'::text])); -- validated: true
```

```sql
uni_stats_pkey: PRIMARY KEY (university_id, area); -- validated: true
```

```sql
uni_stats_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX uni_stats_pkey ON public.uni_stats USING btree (university_id, area); -- valid: true
```

### Policies

None.

### Triggers

None.
