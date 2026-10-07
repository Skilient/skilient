Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# foundations

## public.health_check()

[src: supabase/migrations/20260927000000_foundations.sql#health_check]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.health_check() | sql | false | search_path="" | anon, authenticated, service_role | 20260927000000_foundations.sql |

## public.job_run_finish(p_id uuid, p_status job_run_status, p_rows integer, p_error text)

[src: supabase/migrations/20260927000000_foundations.sql#job_run_finish]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.job_run_finish(p_id uuid, p_status job_run_status, p_rows integer, p_error text) | plpgsql | false | search_path="" | service_role | 20260927000000_foundations.sql |

## public.job_run_start(p_job text, p_meta jsonb)

[src: supabase/migrations/20260927000000_foundations.sql#job_run_start]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.job_run_start(p_job text, p_meta jsonb) | plpgsql | false | search_path="" | service_role | 20260927000000_foundations.sql |

## public.job_runs

[src: supabase/migrations/20260927000000_foundations.sql#job_runs]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| job | text | true | — |  |  | "default" |
| started_at | timestamp with time zone | true | now() |  |  | — |
| finished_at | timestamp with time zone | false | — |  |  | — |
| status | job_run_status | true | 'running'::job_run_status |  |  | — |
| rows | integer | false | — |  |  | — |
| error | text | false | — |  |  | "default" |
| meta | jsonb | true | '{}'::jsonb |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
job_runs_finished_consistent: CHECK (status = 'running'::job_run_status AND finished_at IS NULL OR status <> 'running'::job_run_status AND finished_at IS NOT NULL); -- validated: true
```

```sql
job_runs_job_check: CHECK (job ~ '^[a-z0-9][a-z0-9_-]{0,62}$'::text); -- validated: true
```

```sql
job_runs_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
job_runs_rows_check: CHECK (rows IS NULL OR rows >= 0); -- validated: true
```

### Indexes

```sql
CREATE INDEX job_runs_job_started_at_idx ON public.job_runs USING btree (job, started_at DESC); -- valid: true
```

```sql
CREATE UNIQUE INDEX job_runs_pkey ON public.job_runs USING btree (id); -- valid: true
```

```sql
CREATE INDEX job_runs_running_idx ON public.job_runs USING btree (started_at) WHERE (status = 'running'::job_run_status); -- valid: true
```

### Policies

#### job_runs.job_runs_staff_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "( SELECT private.is_staff() AS is_staff)",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.
