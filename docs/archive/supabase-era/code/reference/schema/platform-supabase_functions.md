Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# platform-supabase_functions

## supabase_functions.http_request()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| supabase_functions.http_request() | plpgsql | true | search_path=supabase_functions | anon, authenticated, postgres, service_role | (platform/extension) |

## supabase_functions.hooks

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint | true | nextval('supabase_functions.hooks_id_seq'::regclass) |  |  | — |
| hook_table_id | integer | true | — |  |  | — |
| hook_name | text | true | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |
| request_id | bigint | false | — |  |  | — |

### Keys and constraints

```sql
hooks_pkey: PRIMARY KEY (id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX hooks_pkey ON supabase_functions.hooks USING btree (id); -- valid: true
```

```sql
CREATE INDEX supabase_functions_hooks_h_table_id_h_name_idx ON supabase_functions.hooks USING btree (hook_table_id, hook_name); -- valid: true
```

```sql
CREATE INDEX supabase_functions_hooks_request_id_idx ON supabase_functions.hooks USING btree (request_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## supabase_functions.migrations

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| version | text | true | — |  |  | "default" |
| inserted_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
migrations_pkey: PRIMARY KEY (version); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX migrations_pkey ON supabase_functions.migrations USING btree (version); -- valid: true
```

### Policies

None.

### Triggers

None.
