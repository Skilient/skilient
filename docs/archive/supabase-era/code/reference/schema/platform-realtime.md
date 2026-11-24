Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# platform-realtime

## enum: realtime.action

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "INSERT",
    "UPDATE",
    "DELETE",
    "TRUNCATE",
    "ERROR"
  ]
}
```

## enum: realtime.equality_op

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "eq",
    "neq",
    "lt",
    "lte",
    "gt",
    "gte",
    "in",
    "like",
    "ilike",
    "is",
    "match",
    "imatch",
    "isdistinct"
  ]
}
```

## realtime.apply_rls(wal jsonb, max_record_bytes integer)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| realtime.apply_rls(wal jsonb, max_record_bytes integer) | plpgsql | false | (session default) | PUBLIC, anon, authenticated, dashboard_user, postgres, service_role | (platform/extension) |

## realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) | plpgsql | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[])

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) | sql | false | (session default) | PUBLIC, anon, authenticated, dashboard_user, postgres, service_role | (platform/extension) |

## realtime.cast(val text, type_ regtype)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| realtime.cast(val text, type_ regtype) | plpgsql | false | (session default) | PUBLIC, anon, authenticated, dashboard_user, postgres, service_role | (platform/extension) |

## realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) | plpgsql | false | (session default) | PUBLIC, anon, authenticated, dashboard_user, postgres, service_role | (platform/extension) |

## realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) | plpgsql | false | (session default) | PUBLIC, anon, authenticated, dashboard_user, postgres, service_role | (platform/extension) |

## realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[])

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) | sql | false | (session default) | PUBLIC, anon, authenticated, dashboard_user, postgres, service_role | (platform/extension) |

## realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) | sql | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## realtime.quote_wal2json(entity regclass)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| realtime.quote_wal2json(entity regclass) | sql | false | (session default) | PUBLIC, anon, authenticated, dashboard_user, postgres, service_role | (platform/extension) |

## realtime.send(payload jsonb, event text, topic text, private boolean)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| realtime.send(payload jsonb, event text, topic text, private boolean) | plpgsql | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## realtime.send_binary(payload bytea, event text, topic text, private boolean)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| realtime.send_binary(payload bytea, event text, topic text, private boolean) | plpgsql | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## realtime.subscription_check_filters()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| realtime.subscription_check_filters() | plpgsql | false | (session default) | PUBLIC, anon, authenticated, dashboard_user, postgres, service_role | (platform/extension) |

## realtime.to_regrole(role_name text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| realtime.to_regrole(role_name text) | sql | false | (session default) | PUBLIC, anon, authenticated, dashboard_user, postgres, service_role | (platform/extension) |

## realtime.topic()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| realtime.topic() | sql | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## realtime.wal2json_escape_identifier(name text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| realtime.wal2json_escape_identifier(name text) | sql | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## realtime.messages

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| topic | text | true | — |  |  | "default" |
| extension | text | true | — |  |  | "default" |
| payload | jsonb | false | — |  |  | — |
| event | text | false | — |  |  | "default" |
| private | boolean | false | false |  |  | — |
| updated_at | timestamp without time zone | true | now() |  |  | — |
| inserted_at | timestamp without time zone | true | now() |  |  | — |
| id | uuid | true | gen_random_uuid() |  |  | — |
| binary_payload | bytea | false | — |  |  | — |
| skip_broadcast | boolean | true | false |  |  | — |

### Keys and constraints

```sql
messages_payload_exclusive: CHECK (payload IS NULL OR binary_payload IS NULL) NOT VALID; -- validated: false
```

```sql
messages_pkey: PRIMARY KEY (id, inserted_at); -- validated: true
```

### Indexes

```sql
CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE)); -- valid: true
```

```sql
CREATE UNIQUE INDEX messages_pkey ON ONLY realtime.messages USING btree (id, inserted_at); -- valid: true
```

### Policies

#### messages.thread_broadcast_receive

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((extension = 'broadcast'::text) AND private.thread_topic_member(( SELECT realtime.topic() AS topic)))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

#### messages.thread_broadcast_send

```json
{
  "roles": [
    "authenticated"
  ],
  "using": null,
  "command": "a",
  "permissive": true,
  "with_check": "((extension = 'broadcast'::text) AND private.thread_topic_member(( SELECT realtime.topic() AS topic)))"
}
```

### Triggers

None.

## realtime.messages_2026_10_06

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| topic | text | true | — |  |  | "default" |
| extension | text | true | — |  |  | "default" |
| payload | jsonb | false | — |  |  | — |
| event | text | false | — |  |  | "default" |
| private | boolean | false | false |  |  | — |
| updated_at | timestamp without time zone | true | now() |  |  | — |
| inserted_at | timestamp without time zone | true | now() |  |  | — |
| id | uuid | true | gen_random_uuid() |  |  | — |
| binary_payload | bytea | false | — |  |  | — |
| skip_broadcast | boolean | true | false |  |  | — |

### Keys and constraints

```sql
messages_2026_10_06_pkey: PRIMARY KEY (id, inserted_at); -- validated: true
```

```sql
messages_payload_exclusive: CHECK (payload IS NULL OR binary_payload IS NULL); -- validated: true
```

### Indexes

```sql
CREATE INDEX messages_2026_10_06_inserted_at_topic_idx ON realtime.messages_2026_10_06 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE)); -- valid: true
```

```sql
CREATE UNIQUE INDEX messages_2026_10_06_pkey ON realtime.messages_2026_10_06 USING btree (id, inserted_at); -- valid: true
```

### Policies

None.

### Triggers

None.

## realtime.messages_2026_10_07

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| topic | text | true | — |  |  | "default" |
| extension | text | true | — |  |  | "default" |
| payload | jsonb | false | — |  |  | — |
| event | text | false | — |  |  | "default" |
| private | boolean | false | false |  |  | — |
| updated_at | timestamp without time zone | true | now() |  |  | — |
| inserted_at | timestamp without time zone | true | now() |  |  | — |
| id | uuid | true | gen_random_uuid() |  |  | — |
| binary_payload | bytea | false | — |  |  | — |
| skip_broadcast | boolean | true | false |  |  | — |

### Keys and constraints

```sql
messages_2026_10_07_pkey: PRIMARY KEY (id, inserted_at); -- validated: true
```

```sql
messages_payload_exclusive: CHECK (payload IS NULL OR binary_payload IS NULL); -- validated: true
```

### Indexes

```sql
CREATE INDEX messages_2026_10_07_inserted_at_topic_idx ON realtime.messages_2026_10_07 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE)); -- valid: true
```

```sql
CREATE UNIQUE INDEX messages_2026_10_07_pkey ON realtime.messages_2026_10_07 USING btree (id, inserted_at); -- valid: true
```

### Policies

None.

### Triggers

None.

## realtime.messages_2026_10_08

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| topic | text | true | — |  |  | "default" |
| extension | text | true | — |  |  | "default" |
| payload | jsonb | false | — |  |  | — |
| event | text | false | — |  |  | "default" |
| private | boolean | false | false |  |  | — |
| updated_at | timestamp without time zone | true | now() |  |  | — |
| inserted_at | timestamp without time zone | true | now() |  |  | — |
| id | uuid | true | gen_random_uuid() |  |  | — |
| binary_payload | bytea | false | — |  |  | — |
| skip_broadcast | boolean | true | false |  |  | — |

### Keys and constraints

```sql
messages_2026_10_08_pkey: PRIMARY KEY (id, inserted_at); -- validated: true
```

```sql
messages_payload_exclusive: CHECK (payload IS NULL OR binary_payload IS NULL); -- validated: true
```

### Indexes

```sql
CREATE INDEX messages_2026_10_08_inserted_at_topic_idx ON realtime.messages_2026_10_08 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE)); -- valid: true
```

```sql
CREATE UNIQUE INDEX messages_2026_10_08_pkey ON realtime.messages_2026_10_08 USING btree (id, inserted_at); -- valid: true
```

### Policies

None.

### Triggers

None.

## realtime.messages_2026_10_09

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| topic | text | true | — |  |  | "default" |
| extension | text | true | — |  |  | "default" |
| payload | jsonb | false | — |  |  | — |
| event | text | false | — |  |  | "default" |
| private | boolean | false | false |  |  | — |
| updated_at | timestamp without time zone | true | now() |  |  | — |
| inserted_at | timestamp without time zone | true | now() |  |  | — |
| id | uuid | true | gen_random_uuid() |  |  | — |
| binary_payload | bytea | false | — |  |  | — |
| skip_broadcast | boolean | true | false |  |  | — |

### Keys and constraints

```sql
messages_2026_10_09_pkey: PRIMARY KEY (id, inserted_at); -- validated: true
```

```sql
messages_payload_exclusive: CHECK (payload IS NULL OR binary_payload IS NULL); -- validated: true
```

### Indexes

```sql
CREATE INDEX messages_2026_10_09_inserted_at_topic_idx ON realtime.messages_2026_10_09 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE)); -- valid: true
```

```sql
CREATE UNIQUE INDEX messages_2026_10_09_pkey ON realtime.messages_2026_10_09 USING btree (id, inserted_at); -- valid: true
```

### Policies

None.

### Triggers

None.

## realtime.messages_2026_10_10

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| topic | text | true | — |  |  | "default" |
| extension | text | true | — |  |  | "default" |
| payload | jsonb | false | — |  |  | — |
| event | text | false | — |  |  | "default" |
| private | boolean | false | false |  |  | — |
| updated_at | timestamp without time zone | true | now() |  |  | — |
| inserted_at | timestamp without time zone | true | now() |  |  | — |
| id | uuid | true | gen_random_uuid() |  |  | — |
| binary_payload | bytea | false | — |  |  | — |
| skip_broadcast | boolean | true | false |  |  | — |

### Keys and constraints

```sql
messages_2026_10_10_pkey: PRIMARY KEY (id, inserted_at); -- validated: true
```

```sql
messages_payload_exclusive: CHECK (payload IS NULL OR binary_payload IS NULL); -- validated: true
```

### Indexes

```sql
CREATE INDEX messages_2026_10_10_inserted_at_topic_idx ON realtime.messages_2026_10_10 USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE)); -- valid: true
```

```sql
CREATE UNIQUE INDEX messages_2026_10_10_pkey ON realtime.messages_2026_10_10 USING btree (id, inserted_at); -- valid: true
```

### Policies

None.

### Triggers

None.

## realtime.schema_migrations

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| version | bigint | true | — |  |  | — |
| inserted_at | timestamp(0) without time zone | false | now() |  |  | — |

### Keys and constraints

```sql
schema_migrations_pkey: PRIMARY KEY (version); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX schema_migrations_pkey ON realtime.schema_migrations USING btree (version); -- valid: true
```

### Policies

None.

### Triggers

None.

## realtime.subscription

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint | true | — | a |  | — |
| subscription_id | uuid | true | — |  |  | — |
| entity | regclass | true | — |  |  | — |
| filters | realtime.user_defined_filter[] | true | '{}'::realtime.user_defined_filter[] |  |  | — |
| claims | jsonb | true | — |  |  | — |
| claims_role | regrole | true | realtime.to_regrole((claims ->> 'role'::text)) |  | s | — |
| created_at | timestamp without time zone | true | timezone('utc'::text, now()) |  |  | — |
| action_filter | text | false | '*'::text |  |  | "default" |
| selected_columns | text[] | false | — |  |  | "default" |

### Keys and constraints

```sql
pk_subscription: PRIMARY KEY (id); -- validated: true
```

```sql
subscription_action_filter_check: CHECK (action_filter = ANY (ARRAY['*'::text, 'INSERT'::text, 'UPDATE'::text, 'DELETE'::text])); -- validated: true
```

### Indexes

```sql
CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity); -- valid: true
```

```sql
CREATE UNIQUE INDEX pk_subscription ON realtime.subscription USING btree (id); -- valid: true
```

```sql
CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_action_filter_selec ON realtime.subscription USING btree (subscription_id, entity, filters, action_filter, COALESCE(selected_columns, '{}'::text[])); -- valid: true
```

### Policies

None.

### Triggers

```sql
CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters(); -- enabled: O
```
