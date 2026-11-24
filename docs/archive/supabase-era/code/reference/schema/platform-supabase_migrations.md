Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# platform-supabase_migrations

## supabase_migrations.schema_migrations

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| version | text | true | — |  |  | "default" |
| statements | text[] | false | — |  |  | "default" |
| name | text | false | — |  |  | "default" |

### Keys and constraints

```sql
schema_migrations_pkey: PRIMARY KEY (version); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX schema_migrations_pkey ON supabase_migrations.schema_migrations USING btree (version); -- valid: true
```

### Policies

None.

### Triggers

None.

## supabase_migrations.seed_files

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: false; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| path | text | true | — |  |  | "default" |
| hash | text | true | — |  |  | "default" |

### Keys and constraints

```sql
seed_files_pkey: PRIMARY KEY (path); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX seed_files_pkey ON supabase_migrations.seed_files USING btree (path); -- valid: true
```

### Policies

None.

### Triggers

None.
