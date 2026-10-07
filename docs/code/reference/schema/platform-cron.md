Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# platform-cron

## cron.alter_job(job_id bigint, schedule text, command text, database text, username text, active boolean)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| cron.alter_job(job_id bigint, schedule text, command text, database text, username text, active boolean) | c | false | (session default) | postgres | (platform/extension) |

## cron.job_cache_invalidate()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| cron.job_cache_invalidate() | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## cron.schedule(job_name text, schedule text, command text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| cron.schedule(job_name text, schedule text, command text) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## cron.schedule(schedule text, command text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| cron.schedule(schedule text, command text) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## cron.schedule_in_database(job_name text, schedule text, command text, database text, username text, active boolean)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| cron.schedule_in_database(job_name text, schedule text, command text, database text, username text, active boolean) | c | false | (session default) | postgres | (platform/extension) |

## cron.unschedule(job_id bigint)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| cron.unschedule(job_id bigint) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## cron.unschedule(job_name text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| cron.unschedule(job_name text) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## cron.job

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| jobid | bigint | true | nextval('cron.jobid_seq'::regclass) |  |  | — |
| schedule | text | true | — |  |  | "default" |
| command | text | true | — |  |  | "default" |
| nodename | text | true | 'localhost'::text |  |  | "default" |
| nodeport | integer | true | inet_server_port() |  |  | — |
| database | text | true | current_database() |  |  | "default" |
| username | text | true | CURRENT_USER |  |  | "default" |
| active | boolean | true | true |  |  | — |
| jobname | text | false | — |  |  | "default" |

### Keys and constraints

```sql
job_pkey: PRIMARY KEY (jobid); -- validated: true
```

```sql
jobname_username_uniq: UNIQUE (jobname, username); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX job_pkey ON cron.job USING btree (jobid); -- valid: true
```

```sql
CREATE UNIQUE INDEX jobname_username_uniq ON cron.job USING btree (jobname, username); -- valid: true
```

### Policies

#### job.cron_job_policy

```json
{
  "roles": [
    "PUBLIC"
  ],
  "using": "(username = CURRENT_USER)",
  "command": "*",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER cron_job_cache_invalidate AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON cron.job FOR EACH STATEMENT EXECUTE FUNCTION cron.job_cache_invalidate(); -- enabled: O
```

## cron.job_run_details

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| jobid | bigint | false | — |  |  | — |
| runid | bigint | true | nextval('cron.runid_seq'::regclass) |  |  | — |
| job_pid | integer | false | — |  |  | — |
| database | text | false | — |  |  | "default" |
| username | text | false | — |  |  | "default" |
| command | text | false | — |  |  | "default" |
| status | text | false | — |  |  | "default" |
| return_message | text | false | — |  |  | "default" |
| start_time | timestamp with time zone | false | — |  |  | — |
| end_time | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
job_run_details_pkey: PRIMARY KEY (runid); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX job_run_details_pkey ON cron.job_run_details USING btree (runid); -- valid: true
```

### Policies

#### job_run_details.cron_job_run_details_policy

```json
{
  "roles": [
    "PUBLIC"
  ],
  "using": "(username = CURRENT_USER)",
  "command": "*",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.
