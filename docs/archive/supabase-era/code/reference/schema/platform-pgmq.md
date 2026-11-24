Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# platform-pgmq

## extension: pgmq.pgmq

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "version": "1.5.1"
}
```

## pgmq._belongs_to_pgmq(table_name text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq._belongs_to_pgmq(table_name text) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq._ensure_pg_partman_installed()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq._ensure_pg_partman_installed() | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq._extension_exists(extension_name text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq._extension_exists(extension_name text) | sql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq._get_partition_col(partition_interval text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq._get_partition_col(partition_interval text) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq._get_pg_partman_major_version()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq._get_pg_partman_major_version() | sql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq._get_pg_partman_schema()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq._get_pg_partman_schema() | sql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.archive(queue_name text, msg_id bigint)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.archive(queue_name text, msg_id bigint) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.archive(queue_name text, msg_ids bigint[])

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.archive(queue_name text, msg_ids bigint[]) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.convert_archive_partitioned(table_name text, partition_interval text, retention_interval text, leading_partition integer)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.convert_archive_partitioned(table_name text, partition_interval text, retention_interval text, leading_partition integer) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.create(queue_name text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.create(queue_name text) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.create_non_partitioned(queue_name text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.create_non_partitioned(queue_name text) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.create_partitioned(queue_name text, partition_interval text, retention_interval text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.create_partitioned(queue_name text, partition_interval text, retention_interval text) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.create_unlogged(queue_name text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.create_unlogged(queue_name text) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.delete(queue_name text, msg_id bigint)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.delete(queue_name text, msg_id bigint) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.delete(queue_name text, msg_ids bigint[])

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.delete(queue_name text, msg_ids bigint[]) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.detach_archive(queue_name text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.detach_archive(queue_name text) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.drop_queue(queue_name text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.drop_queue(queue_name text) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.drop_queue(queue_name text, partitioned boolean)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.drop_queue(queue_name text, partitioned boolean) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.format_table_name(queue_name text, prefix text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.format_table_name(queue_name text, prefix text) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.list_queues()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.list_queues() | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.metrics(queue_name text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.metrics(queue_name text) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.metrics_all()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.metrics_all() | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.pop(queue_name text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.pop(queue_name text) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.purge_queue(queue_name text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.purge_queue(queue_name text) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.read(queue_name text, vt integer, qty integer, conditional jsonb)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.read(queue_name text, vt integer, qty integer, conditional jsonb) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.read_with_poll(queue_name text, vt integer, qty integer, max_poll_seconds integer, poll_interval_ms integer, conditional jsonb)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.read_with_poll(queue_name text, vt integer, qty integer, max_poll_seconds integer, poll_interval_ms integer, conditional jsonb) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.send(queue_name text, msg jsonb)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.send(queue_name text, msg jsonb) | sql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.send(queue_name text, msg jsonb, delay integer)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.send(queue_name text, msg jsonb, delay integer) | sql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.send(queue_name text, msg jsonb, delay timestamp with time zone)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.send(queue_name text, msg jsonb, delay timestamp with time zone) | sql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.send(queue_name text, msg jsonb, headers jsonb)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.send(queue_name text, msg jsonb, headers jsonb) | sql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.send(queue_name text, msg jsonb, headers jsonb, delay integer)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.send(queue_name text, msg jsonb, headers jsonb, delay integer) | sql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.send(queue_name text, msg jsonb, headers jsonb, delay timestamp with time zone)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.send(queue_name text, msg jsonb, headers jsonb, delay timestamp with time zone) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.send_batch(queue_name text, msgs jsonb[])

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.send_batch(queue_name text, msgs jsonb[]) | sql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.send_batch(queue_name text, msgs jsonb[], delay integer)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.send_batch(queue_name text, msgs jsonb[], delay integer) | sql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.send_batch(queue_name text, msgs jsonb[], delay timestamp with time zone)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.send_batch(queue_name text, msgs jsonb[], delay timestamp with time zone) | sql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.send_batch(queue_name text, msgs jsonb[], headers jsonb[])

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.send_batch(queue_name text, msgs jsonb[], headers jsonb[]) | sql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.send_batch(queue_name text, msgs jsonb[], headers jsonb[], delay integer)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.send_batch(queue_name text, msgs jsonb[], headers jsonb[], delay integer) | sql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.send_batch(queue_name text, msgs jsonb[], headers jsonb[], delay timestamp with time zone)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.send_batch(queue_name text, msgs jsonb[], headers jsonb[], delay timestamp with time zone) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.set_vt(queue_name text, msg_id bigint, vt integer)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.set_vt(queue_name text, msg_id bigint, vt integer) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.validate_queue_name(queue_name text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| pgmq.validate_queue_name(queue_name text) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## pgmq.a_analytics

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| msg_id | bigint | true | — |  |  | — |
| read_ct | integer | true | 0 |  |  | — |
| enqueued_at | timestamp with time zone | true | now() |  |  | — |
| archived_at | timestamp with time zone | true | now() |  |  | — |
| vt | timestamp with time zone | true | — |  |  | — |
| message | jsonb | false | — |  |  | — |
| headers | jsonb | false | — |  |  | — |

### Keys and constraints

```sql
a_analytics_pkey: PRIMARY KEY (msg_id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX a_analytics_pkey ON pgmq.a_analytics USING btree (msg_id); -- valid: true
```

```sql
CREATE INDEX archived_at_idx_analytics ON pgmq.a_analytics USING btree (archived_at); -- valid: true
```

### Policies

None.

### Triggers

None.

## pgmq.a_billing_events

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| msg_id | bigint | true | — |  |  | — |
| read_ct | integer | true | 0 |  |  | — |
| enqueued_at | timestamp with time zone | true | now() |  |  | — |
| archived_at | timestamp with time zone | true | now() |  |  | — |
| vt | timestamp with time zone | true | — |  |  | — |
| message | jsonb | false | — |  |  | — |
| headers | jsonb | false | — |  |  | — |

### Keys and constraints

```sql
a_billing_events_pkey: PRIMARY KEY (msg_id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX a_billing_events_pkey ON pgmq.a_billing_events USING btree (msg_id); -- valid: true
```

```sql
CREATE INDEX archived_at_idx_billing_events ON pgmq.a_billing_events USING btree (archived_at); -- valid: true
```

### Policies

None.

### Triggers

None.

## pgmq.a_billing_jobs

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| msg_id | bigint | true | — |  |  | — |
| read_ct | integer | true | 0 |  |  | — |
| enqueued_at | timestamp with time zone | true | now() |  |  | — |
| archived_at | timestamp with time zone | true | now() |  |  | — |
| vt | timestamp with time zone | true | — |  |  | — |
| message | jsonb | false | — |  |  | — |
| headers | jsonb | false | — |  |  | — |

### Keys and constraints

```sql
a_billing_jobs_pkey: PRIMARY KEY (msg_id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX a_billing_jobs_pkey ON pgmq.a_billing_jobs USING btree (msg_id); -- valid: true
```

```sql
CREATE INDEX archived_at_idx_billing_jobs ON pgmq.a_billing_jobs USING btree (archived_at); -- valid: true
```

### Policies

None.

### Triggers

None.

## pgmq.a_cv_jobs

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| msg_id | bigint | true | — |  |  | — |
| read_ct | integer | true | 0 |  |  | — |
| enqueued_at | timestamp with time zone | true | now() |  |  | — |
| archived_at | timestamp with time zone | true | now() |  |  | — |
| vt | timestamp with time zone | true | — |  |  | — |
| message | jsonb | false | — |  |  | — |
| headers | jsonb | false | — |  |  | — |

### Keys and constraints

```sql
a_cv_jobs_pkey: PRIMARY KEY (msg_id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX a_cv_jobs_pkey ON pgmq.a_cv_jobs USING btree (msg_id); -- valid: true
```

```sql
CREATE INDEX archived_at_idx_cv_jobs ON pgmq.a_cv_jobs USING btree (archived_at); -- valid: true
```

### Policies

None.

### Triggers

None.

## pgmq.a_github_jobs

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| msg_id | bigint | true | — |  |  | — |
| read_ct | integer | true | 0 |  |  | — |
| enqueued_at | timestamp with time zone | true | now() |  |  | — |
| archived_at | timestamp with time zone | true | now() |  |  | — |
| vt | timestamp with time zone | true | — |  |  | — |
| message | jsonb | false | — |  |  | — |
| headers | jsonb | false | — |  |  | — |

### Keys and constraints

```sql
a_github_jobs_pkey: PRIMARY KEY (msg_id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX a_github_jobs_pkey ON pgmq.a_github_jobs USING btree (msg_id); -- valid: true
```

```sql
CREATE INDEX archived_at_idx_github_jobs ON pgmq.a_github_jobs USING btree (archived_at); -- valid: true
```

### Policies

None.

### Triggers

None.

## pgmq.a_link_previews

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| msg_id | bigint | true | — |  |  | — |
| read_ct | integer | true | 0 |  |  | — |
| enqueued_at | timestamp with time zone | true | now() |  |  | — |
| archived_at | timestamp with time zone | true | now() |  |  | — |
| vt | timestamp with time zone | true | — |  |  | — |
| message | jsonb | false | — |  |  | — |
| headers | jsonb | false | — |  |  | — |

### Keys and constraints

```sql
a_link_previews_pkey: PRIMARY KEY (msg_id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX a_link_previews_pkey ON pgmq.a_link_previews USING btree (msg_id); -- valid: true
```

```sql
CREATE INDEX archived_at_idx_link_previews ON pgmq.a_link_previews USING btree (archived_at); -- valid: true
```

### Policies

None.

### Triggers

None.

## pgmq.a_notification_emails

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| msg_id | bigint | true | — |  |  | — |
| read_ct | integer | true | 0 |  |  | — |
| enqueued_at | timestamp with time zone | true | now() |  |  | — |
| archived_at | timestamp with time zone | true | now() |  |  | — |
| vt | timestamp with time zone | true | — |  |  | — |
| message | jsonb | false | — |  |  | — |
| headers | jsonb | false | — |  |  | — |

### Keys and constraints

```sql
a_notification_emails_pkey: PRIMARY KEY (msg_id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX a_notification_emails_pkey ON pgmq.a_notification_emails USING btree (msg_id); -- valid: true
```

```sql
CREATE INDEX archived_at_idx_notification_emails ON pgmq.a_notification_emails USING btree (archived_at); -- valid: true
```

### Policies

None.

### Triggers

None.

## pgmq.a_storage_cleanup

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| msg_id | bigint | true | — |  |  | — |
| read_ct | integer | true | 0 |  |  | — |
| enqueued_at | timestamp with time zone | true | now() |  |  | — |
| archived_at | timestamp with time zone | true | now() |  |  | — |
| vt | timestamp with time zone | true | — |  |  | — |
| message | jsonb | false | — |  |  | — |
| headers | jsonb | false | — |  |  | — |

### Keys and constraints

```sql
a_storage_cleanup_pkey: PRIMARY KEY (msg_id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX a_storage_cleanup_pkey ON pgmq.a_storage_cleanup USING btree (msg_id); -- valid: true
```

```sql
CREATE INDEX archived_at_idx_storage_cleanup ON pgmq.a_storage_cleanup USING btree (archived_at); -- valid: true
```

### Policies

None.

### Triggers

None.

## pgmq.meta

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| queue_name | character varying | true | — |  |  | "default" |
| is_partitioned | boolean | true | — |  |  | — |
| is_unlogged | boolean | true | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
meta_queue_name_key: UNIQUE (queue_name); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX meta_queue_name_key ON pgmq.meta USING btree (queue_name); -- valid: true
```

### Policies

None.

### Triggers

None.

## pgmq.q_analytics

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| msg_id | bigint | true | — | a |  | — |
| read_ct | integer | true | 0 |  |  | — |
| enqueued_at | timestamp with time zone | true | now() |  |  | — |
| vt | timestamp with time zone | true | — |  |  | — |
| message | jsonb | false | — |  |  | — |
| headers | jsonb | false | — |  |  | — |

### Keys and constraints

```sql
q_analytics_pkey: PRIMARY KEY (msg_id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX q_analytics_pkey ON pgmq.q_analytics USING btree (msg_id); -- valid: true
```

```sql
CREATE INDEX q_analytics_vt_idx ON pgmq.q_analytics USING btree (vt); -- valid: true
```

### Policies

None.

### Triggers

None.

## pgmq.q_billing_events

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| msg_id | bigint | true | — | a |  | — |
| read_ct | integer | true | 0 |  |  | — |
| enqueued_at | timestamp with time zone | true | now() |  |  | — |
| vt | timestamp with time zone | true | — |  |  | — |
| message | jsonb | false | — |  |  | — |
| headers | jsonb | false | — |  |  | — |

### Keys and constraints

```sql
q_billing_events_pkey: PRIMARY KEY (msg_id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX q_billing_events_pkey ON pgmq.q_billing_events USING btree (msg_id); -- valid: true
```

```sql
CREATE INDEX q_billing_events_vt_idx ON pgmq.q_billing_events USING btree (vt); -- valid: true
```

### Policies

None.

### Triggers

None.

## pgmq.q_billing_jobs

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| msg_id | bigint | true | — | a |  | — |
| read_ct | integer | true | 0 |  |  | — |
| enqueued_at | timestamp with time zone | true | now() |  |  | — |
| vt | timestamp with time zone | true | — |  |  | — |
| message | jsonb | false | — |  |  | — |
| headers | jsonb | false | — |  |  | — |

### Keys and constraints

```sql
q_billing_jobs_pkey: PRIMARY KEY (msg_id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX q_billing_jobs_pkey ON pgmq.q_billing_jobs USING btree (msg_id); -- valid: true
```

```sql
CREATE INDEX q_billing_jobs_vt_idx ON pgmq.q_billing_jobs USING btree (vt); -- valid: true
```

### Policies

None.

### Triggers

None.

## pgmq.q_cv_jobs

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| msg_id | bigint | true | — | a |  | — |
| read_ct | integer | true | 0 |  |  | — |
| enqueued_at | timestamp with time zone | true | now() |  |  | — |
| vt | timestamp with time zone | true | — |  |  | — |
| message | jsonb | false | — |  |  | — |
| headers | jsonb | false | — |  |  | — |

### Keys and constraints

```sql
q_cv_jobs_pkey: PRIMARY KEY (msg_id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX q_cv_jobs_pkey ON pgmq.q_cv_jobs USING btree (msg_id); -- valid: true
```

```sql
CREATE INDEX q_cv_jobs_vt_idx ON pgmq.q_cv_jobs USING btree (vt); -- valid: true
```

### Policies

None.

### Triggers

None.

## pgmq.q_github_jobs

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| msg_id | bigint | true | — | a |  | — |
| read_ct | integer | true | 0 |  |  | — |
| enqueued_at | timestamp with time zone | true | now() |  |  | — |
| vt | timestamp with time zone | true | — |  |  | — |
| message | jsonb | false | — |  |  | — |
| headers | jsonb | false | — |  |  | — |

### Keys and constraints

```sql
q_github_jobs_pkey: PRIMARY KEY (msg_id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX q_github_jobs_pkey ON pgmq.q_github_jobs USING btree (msg_id); -- valid: true
```

```sql
CREATE INDEX q_github_jobs_vt_idx ON pgmq.q_github_jobs USING btree (vt); -- valid: true
```

### Policies

None.

### Triggers

None.

## pgmq.q_link_previews

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| msg_id | bigint | true | — | a |  | — |
| read_ct | integer | true | 0 |  |  | — |
| enqueued_at | timestamp with time zone | true | now() |  |  | — |
| vt | timestamp with time zone | true | — |  |  | — |
| message | jsonb | false | — |  |  | — |
| headers | jsonb | false | — |  |  | — |

### Keys and constraints

```sql
q_link_previews_pkey: PRIMARY KEY (msg_id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX q_link_previews_pkey ON pgmq.q_link_previews USING btree (msg_id); -- valid: true
```

```sql
CREATE INDEX q_link_previews_vt_idx ON pgmq.q_link_previews USING btree (vt); -- valid: true
```

### Policies

None.

### Triggers

None.

## pgmq.q_notification_emails

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| msg_id | bigint | true | — | a |  | — |
| read_ct | integer | true | 0 |  |  | — |
| enqueued_at | timestamp with time zone | true | now() |  |  | — |
| vt | timestamp with time zone | true | — |  |  | — |
| message | jsonb | false | — |  |  | — |
| headers | jsonb | false | — |  |  | — |

### Keys and constraints

```sql
q_notification_emails_pkey: PRIMARY KEY (msg_id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX q_notification_emails_pkey ON pgmq.q_notification_emails USING btree (msg_id); -- valid: true
```

```sql
CREATE INDEX q_notification_emails_vt_idx ON pgmq.q_notification_emails USING btree (vt); -- valid: true
```

### Policies

None.

### Triggers

None.

## pgmq.q_storage_cleanup

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| msg_id | bigint | true | — | a |  | — |
| read_ct | integer | true | 0 |  |  | — |
| enqueued_at | timestamp with time zone | true | now() |  |  | — |
| vt | timestamp with time zone | true | — |  |  | — |
| message | jsonb | false | — |  |  | — |
| headers | jsonb | false | — |  |  | — |

### Keys and constraints

```sql
q_storage_cleanup_pkey: PRIMARY KEY (msg_id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX q_storage_cleanup_pkey ON pgmq.q_storage_cleanup USING btree (msg_id); -- valid: true
```

```sql
CREATE INDEX q_storage_cleanup_vt_idx ON pgmq.q_storage_cleanup USING btree (vt); -- valid: true
```

### Policies

None.

### Triggers

None.
