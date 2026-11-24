Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# platform-storage

## enum: storage.buckettype

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "labels": [
    "STANDARD",
    "ANALYTICS",
    "VECTOR"
  ]
}
```

## storage.allow_any_operation(expected_operations text[])

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| storage.allow_any_operation(expected_operations text[]) | sql | false | (session default) | PUBLIC | (platform/extension) |

## storage.allow_only_operation(expected_operation text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| storage.allow_only_operation(expected_operation text) | sql | false | (session default) | PUBLIC | (platform/extension) |

## storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## storage.enforce_bucket_lifecycle_service_role()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| storage.enforce_bucket_lifecycle_service_role() | plpgsql | false | search_path=pg_catalog | PUBLIC | (platform/extension) |

## storage.enforce_bucket_name_length()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| storage.enforce_bucket_name_length() | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## storage.extension(name text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| storage.extension(name text) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## storage.filename(name text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| storage.filename(name text) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## storage.foldername(name text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| storage.foldername(name text) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) | sql | false | (session default) | PUBLIC | (platform/extension) |

## storage.get_size_by_bucket(noncurrent_versions text, delete_markers text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| storage.get_size_by_bucket(noncurrent_versions text, delete_markers text) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer, next_key_token text, next_upload_token text, raw_prefix_param text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer, next_key_token text, next_upload_token text, raw_prefix_param text) | sql | false | (session default) | PUBLIC | (platform/extension) |

## storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer, start_after text, next_token text, sort_order text, noncurrent_versions text, delete_markers text, next_token_archived_at timestamp with time zone, next_token_version text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer, start_after text, next_token text, sort_order text, noncurrent_versions text, delete_markers text, next_token_archived_at timestamp with time zone, next_token_version text) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## storage.operation()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| storage.operation() | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## storage.protect_bucket_control_columns()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| storage.protect_bucket_control_columns() | plpgsql | false | search_path=pg_catalog | PUBLIC | (platform/extension) |

## storage.protect_delete()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| storage.protect_delete() | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## storage.search(prefix text, bucketname text, limits integer, levels integer, offsets integer, search text, sortcolumn text, sortorder text, noncurrent_versions text, delete_markers text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| storage.search(prefix text, bucketname text, limits integer, levels integer, offsets integer, search text, sortcolumn text, sortorder text, noncurrent_versions text, delete_markers text) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text, noncurrent_versions text, delete_markers text, p_start_after_version text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text, noncurrent_versions text, delete_markers text, p_start_after_version text) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## storage.search_v2(prefix text, bucket_name text, limits integer, levels integer, start_after text, sort_order text, sort_column text, sort_column_after text, noncurrent_versions text, delete_markers text, start_after_archived_at timestamp with time zone, start_after_version text, start_after_is_continuation boolean)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| storage.search_v2(prefix text, bucket_name text, limits integer, levels integer, start_after text, sort_order text, sort_column text, sort_column_after text, noncurrent_versions text, delete_markers text, start_after_archived_at timestamp with time zone, start_after_version text, start_after_is_continuation boolean) | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## storage.update_updated_at_column()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| storage.update_updated_at_column() | plpgsql | false | (session default) | PUBLIC | (platform/extension) |

## storage.buckets

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | text | true | — |  |  | "default" |
| name | text | true | — |  |  | "default" |
| owner | uuid | false | — |  |  | — |
| created_at | timestamp with time zone | false | now() |  |  | — |
| updated_at | timestamp with time zone | false | now() |  |  | — |
| public | boolean | false | false |  |  | — |
| avif_autodetection | boolean | false | false |  |  | — |
| file_size_limit | bigint | false | — |  |  | — |
| allowed_mime_types | text[] | false | — |  |  | "default" |
| owner_id | text | false | — |  |  | "default" |
| type | storage.buckettype | true | 'STANDARD'::storage.buckettype |  |  | — |
| versioning_status | text | true | 'DISABLED'::text |  |  | "default" |
| lifecycle_configuration | jsonb | false | — |  |  | — |
| lifecycle_configuration_generation | uuid | false | — |  |  | — |

### Keys and constraints

```sql
buckets_lifecycle_configuration_pair_check: CHECK ((lifecycle_configuration IS NULL) = (lifecycle_configuration_generation IS NULL)); -- validated: true
```

```sql
buckets_lifecycle_configuration_shape_check: CHECK (lifecycle_configuration IS NULL OR jsonb_typeof(lifecycle_configuration) = 'object'::text AND lifecycle_configuration ? 'rules'::text AND
CASE
    WHEN jsonb_typeof(lifecycle_configuration -> 'rules'::text) = 'array'::text THEN jsonb_array_length(lifecycle_configuration -> 'rules'::text) >= 1 AND jsonb_array_length(lifecycle_configuration -> 'rules'::text) <= 1000
    ELSE false
END); -- validated: true
```

```sql
buckets_lifecycle_configuration_standard_only_check: CHECK (type = 'STANDARD'::storage.buckettype OR lifecycle_configuration IS NULL AND lifecycle_configuration_generation IS NULL); -- validated: true
```

```sql
buckets_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
buckets_versioning_dark_check: CHECK (versioning_status = 'DISABLED'::text); -- validated: true
```

```sql
buckets_versioning_standard_only_check: CHECK (type = 'STANDARD'::storage.buckettype OR versioning_status = 'DISABLED'::text); -- validated: true
```

```sql
buckets_versioning_status_check: CHECK (versioning_status = ANY (ARRAY['DISABLED'::text, 'ENABLED'::text, 'SUSPENDED'::text])); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name); -- valid: true
```

```sql
CREATE UNIQUE INDEX buckets_pkey ON storage.buckets USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

```sql
CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length(); -- enabled: O
```

```sql
CREATE TRIGGER protect_bucket_control_insert BEFORE INSERT ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns('service_role'); -- enabled: O
```

```sql
CREATE TRIGGER protect_bucket_control_update BEFORE UPDATE OF lifecycle_configuration, lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns(); -- enabled: O
```

```sql
CREATE TRIGGER protect_bucket_control_update_role AFTER UPDATE OF lifecycle_configuration, lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_lifecycle_service_role('service_role'); -- enabled: O
```

```sql
CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete(); -- enabled: O
```

## storage.buckets_analytics

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| name | text | true | — |  |  | "default" |
| type | storage.buckettype | true | 'ANALYTICS'::storage.buckettype |  |  | — |
| format | text | true | 'ICEBERG'::text |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |
| id | uuid | true | gen_random_uuid() |  |  | — |
| deleted_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
buckets_analytics_pkey: PRIMARY KEY (id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX buckets_analytics_pkey ON storage.buckets_analytics USING btree (id); -- valid: true
```

```sql
CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL); -- valid: true
```

### Policies

None.

### Triggers

None.

## storage.buckets_vectors

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | text | true | — |  |  | "default" |
| type | storage.buckettype | true | 'VECTOR'::storage.buckettype |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
buckets_vectors_pkey: PRIMARY KEY (id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX buckets_vectors_pkey ON storage.buckets_vectors USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

None.

## storage.iceberg_namespaces

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| bucket_name | text | true | — |  |  | "default" |
| name | text | true | — |  |  | "C" |
| created_at | timestamp with time zone | true | now() |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |
| metadata | jsonb | true | '{}'::jsonb |  |  | — |
| catalog_id | uuid | true | — |  |  | — |

### Keys and constraints

```sql
iceberg_namespaces_catalog_id_fkey: FOREIGN KEY (catalog_id) REFERENCES storage.buckets_analytics(id) ON DELETE CASCADE; -- validated: true
```

```sql
iceberg_namespaces_pkey: PRIMARY KEY (id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX iceberg_namespaces_pkey ON storage.iceberg_namespaces USING btree (id); -- valid: true
```

```sql
CREATE UNIQUE INDEX idx_iceberg_namespaces_bucket_id ON storage.iceberg_namespaces USING btree (catalog_id, name); -- valid: true
```

### Policies

None.

### Triggers

None.

## storage.iceberg_tables

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| namespace_id | uuid | true | — |  |  | — |
| bucket_name | text | true | — |  |  | "default" |
| name | text | true | — |  |  | "C" |
| location | text | true | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |
| remote_table_id | text | false | — |  |  | "default" |
| shard_key | text | false | — |  |  | "default" |
| shard_id | text | false | — |  |  | "default" |
| catalog_id | uuid | true | — |  |  | — |

### Keys and constraints

```sql
iceberg_tables_catalog_id_fkey: FOREIGN KEY (catalog_id) REFERENCES storage.buckets_analytics(id) ON DELETE CASCADE; -- validated: true
```

```sql
iceberg_tables_namespace_id_fkey: FOREIGN KEY (namespace_id) REFERENCES storage.iceberg_namespaces(id) ON DELETE CASCADE; -- validated: true
```

```sql
iceberg_tables_pkey: PRIMARY KEY (id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX iceberg_tables_pkey ON storage.iceberg_tables USING btree (id); -- valid: true
```

```sql
CREATE UNIQUE INDEX idx_iceberg_tables_location ON storage.iceberg_tables USING btree (location); -- valid: true
```

```sql
CREATE UNIQUE INDEX idx_iceberg_tables_namespace_id ON storage.iceberg_tables USING btree (catalog_id, namespace_id, name); -- valid: true
```

### Policies

None.

### Triggers

None.

## storage.migrations

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | integer | true | — |  |  | — |
| name | character varying(100) | true | — |  |  | "default" |
| hash | character varying(40) | true | — |  |  | "default" |
| executed_at | timestamp without time zone | false | CURRENT_TIMESTAMP |  |  | — |

### Keys and constraints

```sql
migrations_name_key: UNIQUE (name); -- validated: true
```

```sql
migrations_pkey: PRIMARY KEY (id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX migrations_name_key ON storage.migrations USING btree (name); -- valid: true
```

```sql
CREATE UNIQUE INDEX migrations_pkey ON storage.migrations USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

None.

## storage.objects

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| bucket_id | text | false | — |  |  | "default" |
| name | text | false | — |  |  | "default" |
| owner | uuid | false | — |  |  | — |
| created_at | timestamp with time zone | false | now() |  |  | — |
| updated_at | timestamp with time zone | false | now() |  |  | — |
| last_accessed_at | timestamp with time zone | false | now() |  |  | — |
| metadata | jsonb | false | — |  |  | — |
| path_tokens | text[] | false | string_to_array(name, '/'::text) |  | s | "default" |
| version | text | false | — |  |  | "default" |
| owner_id | text | false | — |  |  | "default" |
| user_metadata | jsonb | false | — |  |  | — |
| archived_at | timestamp with time zone | false | — |  |  | — |
| is_delete_marker | boolean | true | false |  |  | — |
| is_versioned | boolean | true | false |  |  | — |

### Keys and constraints

```sql
objects_bucketId_fkey: FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id); -- validated: true
```

```sql
objects_pkey: PRIMARY KEY (id); -- validated: true
```

### Indexes

```sql
CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C"); -- valid: true
```

```sql
CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C"); -- valid: true
```

```sql
CREATE UNIQUE INDEX idx_objects_current_version ON storage.objects USING btree (bucket_id, name COLLATE "C") WHERE (archived_at IS NULL); -- valid: true
```

```sql
CREATE INDEX idx_objects_delete_markers ON storage.objects USING btree (bucket_id, name COLLATE "C") WHERE is_delete_marker; -- valid: true
```

```sql
CREATE UNIQUE INDEX idx_objects_null_version ON storage.objects USING btree (bucket_id, name COLLATE "C") WHERE (NOT is_versioned); -- valid: true
```

```sql
CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops); -- valid: true
```

```sql
CREATE UNIQUE INDEX objects_bucket_id_name_version_key ON storage.objects USING btree (bucket_id, name COLLATE "C", version) NULLS NOT DISTINCT; -- valid: true
```

```sql
CREATE UNIQUE INDEX objects_pkey ON storage.objects USING btree (id); -- valid: true
```

### Policies

#### objects.chat_media_member_insert

```json
{
  "roles": [
    "authenticated"
  ],
  "using": null,
  "command": "a",
  "permissive": true,
  "with_check": "((bucket_id = 'chat-media'::text) AND private.storage_thread_member(name))"
}
```

#### objects.chat_media_member_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((bucket_id = 'chat-media'::text) AND private.storage_thread_member(name))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

#### objects.chat_media_owner_delete

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((bucket_id = 'chat-media'::text) AND (owner_id = (( SELECT auth.uid() AS uid))::text))",
  "command": "d",
  "permissive": true,
  "with_check": null
}
```

#### objects.credentials_files_delete

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((bucket_id = 'credentials'::text) AND (owner_id = (( SELECT auth.uid() AS uid))::text) AND private.credential_file_unused(name))",
  "command": "d",
  "permissive": true,
  "with_check": null
}
```

#### objects.credentials_files_insert

```json
{
  "roles": [
    "authenticated"
  ],
  "using": null,
  "command": "a",
  "permissive": true,
  "with_check": "((bucket_id = 'credentials'::text) AND private.credential_upload_allowed(name))"
}
```

#### objects.credentials_files_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((bucket_id = 'credentials'::text) AND (((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) OR ( SELECT private.is_staff('trust_reviewer'::staff_role) AS is_staff)))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

#### objects.cv_exports_insert

```json
{
  "roles": [
    "authenticated"
  ],
  "using": null,
  "command": "a",
  "permissive": true,
  "with_check": "((bucket_id = 'cv-exports'::text) AND private.cv_export_upload_allowed(name))"
}
```

#### objects.cv_exports_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((bucket_id = 'cv-exports'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

#### objects.feedback_files_delete

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((bucket_id = 'feedback'::text) AND (owner_id = (( SELECT auth.uid() AS uid))::text) AND private.feedback_file_unused(name))",
  "command": "d",
  "permissive": true,
  "with_check": null
}
```

#### objects.feedback_files_insert

```json
{
  "roles": [
    "authenticated"
  ],
  "using": null,
  "command": "a",
  "permissive": true,
  "with_check": "((bucket_id = 'feedback'::text) AND private.feedback_upload_allowed(name))"
}
```

#### objects.feedback_files_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((bucket_id = 'feedback'::text) AND (((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) OR ( SELECT private.is_staff() AS is_staff)))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

#### objects.org_documents_insert

```json
{
  "roles": [
    "authenticated"
  ],
  "using": null,
  "command": "a",
  "permissive": true,
  "with_check": "((bucket_id = 'org-documents'::text) AND ( SELECT private.org_doc_upload_allowed(objects.name) AS org_doc_upload_allowed))"
}
```

#### objects.org_documents_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((bucket_id = 'org-documents'::text) AND ( SELECT private.org_doc_readable(objects.name) AS org_doc_readable))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

#### objects.post_media_delete_own

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((bucket_id = 'post-media'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))",
  "command": "d",
  "permissive": true,
  "with_check": null
}
```

#### objects.post_media_insert_own

```json
{
  "roles": [
    "authenticated"
  ],
  "using": null,
  "command": "a",
  "permissive": true,
  "with_check": "((bucket_id = 'post-media'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))"
}
```

#### objects.post_media_select_own

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((bucket_id = 'post-media'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

#### objects.profile_images_delete_own

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((bucket_id = ANY (ARRAY['avatars'::text, 'covers'::text])) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))",
  "command": "d",
  "permissive": true,
  "with_check": null
}
```

#### objects.profile_images_insert_own

```json
{
  "roles": [
    "authenticated"
  ],
  "using": null,
  "command": "a",
  "permissive": true,
  "with_check": "((bucket_id = ANY (ARRAY['avatars'::text, 'covers'::text])) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))"
}
```

#### objects.profile_images_select_own

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((bucket_id = ANY (ARRAY['avatars'::text, 'covers'::text])) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

#### objects.university_claims_files_insert

```json
{
  "roles": [
    "authenticated"
  ],
  "using": null,
  "command": "a",
  "permissive": true,
  "with_check": "((bucket_id = 'university-claims'::text) AND private.claim_upload_allowed(name))"
}
```

#### objects.university_claims_files_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((bucket_id = 'university-claims'::text) AND (((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) OR ( SELECT private.is_staff('accounts'::staff_role) AS is_staff)))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

#### objects.university_media_delete

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((bucket_id = 'university-media'::text) AND private.uni_media_writer(name))",
  "command": "d",
  "permissive": true,
  "with_check": null
}
```

#### objects.university_media_insert

```json
{
  "roles": [
    "authenticated"
  ],
  "using": null,
  "command": "a",
  "permissive": true,
  "with_check": "((bucket_id = 'university-media'::text) AND private.uni_media_writer(name))"
}
```

### Triggers

```sql
CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete(); -- enabled: O
```

```sql
CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column(); -- enabled: O
```

## storage.s3_multipart_uploads

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | text | true | — |  |  | "default" |
| in_progress_size | bigint | true | 0 |  |  | — |
| upload_signature | text | true | — |  |  | "default" |
| bucket_id | text | true | — |  |  | "default" |
| key | text | true | — |  |  | "C" |
| version | text | true | — |  |  | "default" |
| owner_id | text | false | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |
| user_metadata | jsonb | false | — |  |  | — |
| metadata | jsonb | false | — |  |  | — |

### Keys and constraints

```sql
s3_multipart_uploads_bucket_id_fkey: FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id); -- validated: true
```

```sql
s3_multipart_uploads_pkey: PRIMARY KEY (id); -- validated: true
```

### Indexes

```sql
CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at); -- valid: true
```

```sql
CREATE UNIQUE INDEX s3_multipart_uploads_pkey ON storage.s3_multipart_uploads USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

None.

## storage.s3_multipart_uploads_parts

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| upload_id | text | true | — |  |  | "default" |
| size | bigint | true | 0 |  |  | — |
| part_number | integer | true | — |  |  | — |
| bucket_id | text | true | — |  |  | "default" |
| key | text | true | — |  |  | "C" |
| etag | text | true | — |  |  | "default" |
| owner_id | text | false | — |  |  | "default" |
| version | text | true | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
s3_multipart_uploads_parts_bucket_id_fkey: FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id); -- validated: true
```

```sql
s3_multipart_uploads_parts_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
s3_multipart_uploads_parts_upload_id_fkey: FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX s3_multipart_uploads_parts_pkey ON storage.s3_multipart_uploads_parts USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

None.

## storage.vector_indexes

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | text | true | gen_random_uuid() |  |  | "default" |
| name | text | true | — |  |  | "C" |
| bucket_id | text | true | — |  |  | "default" |
| data_type | text | true | — |  |  | "default" |
| dimension | integer | true | — |  |  | — |
| distance_metric | text | true | — |  |  | "default" |
| metadata_configuration | jsonb | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
vector_indexes_bucket_id_fkey: FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id); -- validated: true
```

```sql
vector_indexes_pkey: PRIMARY KEY (id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX vector_indexes_pkey ON storage.vector_indexes USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

None.
