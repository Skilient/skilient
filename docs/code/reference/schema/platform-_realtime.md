Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# platform-_realtime

## _realtime.extensions

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | — |  |  | — |
| type | text | false | — |  |  | "default" |
| settings | jsonb | false | — |  |  | — |
| tenant_external_id | text | false | — |  |  | "default" |
| inserted_at | timestamp(0) without time zone | true | — |  |  | — |
| updated_at | timestamp(0) without time zone | true | — |  |  | — |

### Keys and constraints

```sql
extensions_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
extensions_tenant_external_id_fkey: FOREIGN KEY (tenant_external_id) REFERENCES _realtime.tenants(external_id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX extensions_pkey ON _realtime.extensions USING btree (id); -- valid: true
```

```sql
CREATE INDEX extensions_tenant_external_id_index ON _realtime.extensions USING btree (tenant_external_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX extensions_tenant_external_id_type_index ON _realtime.extensions USING btree (tenant_external_id, type); -- valid: true
```

### Policies

None.

### Triggers

None.

## _realtime.feature_flags

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | — |  |  | — |
| name | character varying(255) | true | — |  |  | "default" |
| enabled | boolean | true | false |  |  | — |
| inserted_at | timestamp(0) without time zone | true | — |  |  | — |
| updated_at | timestamp(0) without time zone | true | — |  |  | — |
| rollout_percentage | integer | true | 100 |  |  | — |
| bucket_key | character varying(255) | false | — |  |  | "default" |

### Keys and constraints

```sql
feature_flags_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
rollout_percentage_must_be_between_0_and_100: CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX feature_flags_name_index ON _realtime.feature_flags USING btree (name); -- valid: true
```

```sql
CREATE UNIQUE INDEX feature_flags_pkey ON _realtime.feature_flags USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

None.

## _realtime.schema_migrations

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| version | bigint | true | — |  |  | — |
| inserted_at | timestamp(0) without time zone | false | — |  |  | — |

### Keys and constraints

```sql
schema_migrations_pkey: PRIMARY KEY (version); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX schema_migrations_pkey ON _realtime.schema_migrations USING btree (version); -- valid: true
```

### Policies

None.

### Triggers

None.

## _realtime.tenants

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | — |  |  | — |
| name | text | false | — |  |  | "default" |
| external_id | text | false | — |  |  | "default" |
| jwt_secret | text | false | — |  |  | "default" |
| max_concurrent_users | integer | true | 200 |  |  | — |
| inserted_at | timestamp(0) without time zone | true | — |  |  | — |
| updated_at | timestamp(0) without time zone | true | — |  |  | — |
| max_events_per_second | integer | true | 100 |  |  | — |
| postgres_cdc_default | text | false | 'postgres_cdc_rls'::text |  |  | "default" |
| max_bytes_per_second | integer | true | 100000 |  |  | — |
| max_channels_per_client | integer | true | 100 |  |  | — |
| max_joins_per_second | integer | true | 500 |  |  | — |
| suspend | boolean | false | false |  |  | — |
| jwt_jwks | jsonb | false | — |  |  | — |
| notify_private_alpha | boolean | false | false |  |  | — |
| private_only | boolean | true | false |  |  | — |
| migrations_ran | integer | false | 0 |  |  | — |
| broadcast_adapter | character varying(255) | false | 'gen_rpc'::character varying |  |  | "default" |
| max_presence_events_per_second | integer | false | 1000 |  |  | — |
| max_payload_size_in_kb | integer | false | 3000 |  |  | — |
| max_client_presence_events_per_window | integer | false | — |  |  | — |
| client_presence_window_ms | integer | false | — |  |  | — |
| presence_enabled | boolean | true | false |  |  | — |
| feature_flags | jsonb | true | '{}'::jsonb |  |  | — |
| gcm_migrated_at | timestamp(0) without time zone | false | — |  |  | — |

### Keys and constraints

```sql
jwt_secret_or_jwt_jwks_required: CHECK (jwt_secret IS NOT NULL OR jwt_jwks IS NOT NULL); -- validated: true
```

```sql
tenants_pkey: PRIMARY KEY (id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX tenants_external_id_index ON _realtime.tenants USING btree (external_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX tenants_pkey ON _realtime.tenants USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

None.
