Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# verified_cv

## private.cv_active_key()

[src: supabase/migrations/20261008000000_verified_cv.sql#cv_active_key]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.cv_active_key() | sql | true | search_path="" | None | 20261008000000_verified_cv.sql |

## private.cv_all_sections()

[src: supabase/migrations/20261008000000_verified_cv.sql#cv_all_sections]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.cv_all_sections() | sql | false | search_path="" | None | 20261008000000_verified_cv.sql |

## private.cv_call_worker(p_body jsonb)

[src: supabase/migrations/20261008000000_verified_cv.sql#cv_call_worker]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.cv_call_worker(p_body jsonb) | plpgsql | true | search_path="" | None | 20261008000000_verified_cv.sql |

## private.cv_eligible(p_user uuid)

[src: supabase/migrations/20261008000000_verified_cv.sql#cv_eligible]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.cv_eligible(p_user uuid) | sql | true | search_path="" | None | 20261008000000_verified_cv.sql |

## private.cv_install_key(p_key_id text, p_public_key text, p_private_key text)

[src: supabase/migrations/20261008000000_verified_cv.sql#cv_install_key]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.cv_install_key(p_key_id text, p_public_key text, p_private_key text) | plpgsql | true | search_path="" | None | 20261008000000_verified_cv.sql |

## private.cv_issue_prepare(p_user uuid)

[src: supabase/migrations/20261008000000_verified_cv.sql#cv_issue_prepare]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.cv_issue_prepare(p_user uuid) | plpgsql | true | search_path="" | None | 20261008000000_verified_cv.sql |

## private.cv_join_names(p text[])

[src: supabase/migrations/20261008000000_verified_cv.sql#cv_join_names]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.cv_join_names(p text[]) | sql | false | search_path="" | None | 20261008000000_verified_cv.sql |

## private.cv_refresh_start(p_force boolean)

[src: supabase/migrations/20261008000000_verified_cv.sql#cv_refresh_start]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.cv_refresh_start(p_force boolean) | plpgsql | true | search_path="" | None | 20261008000000_verified_cv.sql |

## private.cv_rotate_key()

[src: supabase/migrations/20261008000000_verified_cv.sql#cv_rotate_key]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.cv_rotate_key() | plpgsql | true | search_path="" | None | 20261008000000_verified_cv.sql |

## private.cv_sections_valid(p text[])

[src: supabase/migrations/20261008000000_verified_cv.sql#cv_sections_valid]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.cv_sections_valid(p text[]) | sql | false | search_path="" | None | 20261008000000_verified_cv.sql |

## private.wake_cv_worker()

[src: supabase/migrations/20261008000000_verified_cv.sql#wake_cv_worker]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.wake_cv_worker() | plpgsql | true | search_path="" | None | 20261008000000_verified_cv.sql |

## public.cv_records

[src: supabase/migrations/20261008000000_verified_cv.sql#cv_records]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| user_id | uuid | false | — |  |  | — |
| code | text | true | — |  |  | "default" |
| version | integer | true | — |  |  | — |
| template | text | true | 'standard'::text |  |  | "default" |
| snapshot | jsonb | false | — |  |  | — |
| content_hash | text | true | — |  |  | "default" |
| snapshot_hash | text | true | — |  |  | "default" |
| signature | text | true | — |  |  | "default" |
| key_id | text | true | — |  |  | "default" |
| source | text | true | — |  |  | "default" |
| issued_at | timestamp with time zone | true | — |  |  | — |
| expires_at | timestamp with time zone | true | — |  |  | — |
| superseded_by | uuid | false | — |  |  | — |
| revoked_at | timestamp with time zone | false | — |  |  | — |
| revoked_reason | text | false | — |  |  | "default" |
| revoked_by | uuid | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
cv_records_check: CHECK (expires_at > issued_at); -- validated: true
```

```sql
cv_records_check1: CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL)); -- validated: true
```

```sql
cv_records_check2: CHECK (snapshot IS NOT NULL OR revoked_at IS NOT NULL); -- validated: true
```

```sql
cv_records_code_check: CHECK (code ~ '^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{10}$'::text); -- validated: true
```

```sql
cv_records_code_key: UNIQUE (code); -- validated: true
```

```sql
cv_records_content_hash_check: CHECK (content_hash ~ '^[0-9a-f]{64}$'::text); -- validated: true
```

```sql
cv_records_issued_at_check: CHECK (issued_at = date_trunc('second'::text, issued_at)); -- validated: true
```

```sql
cv_records_key_id_fkey: FOREIGN KEY (key_id) REFERENCES signing_keys(key_id); -- validated: true
```

```sql
cv_records_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
cv_records_revoked_by_fkey: FOREIGN KEY (revoked_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
cv_records_revoked_reason_check: CHECK (revoked_reason IS NULL OR (revoked_reason = ANY (ARRAY['owner'::text, 'staff'::text, 'suspended'::text, 'deleted'::text]))); -- validated: true
```

```sql
cv_records_signature_check: CHECK (signature ~ '^[A-Za-z0-9_-]{86}$'::text); -- validated: true
```

```sql
cv_records_snapshot_check: CHECK (snapshot IS NULL OR jsonb_typeof(snapshot) = 'object'::text); -- validated: true
```

```sql
cv_records_snapshot_hash_check: CHECK (snapshot_hash ~ '^[0-9a-f]{64}$'::text); -- validated: true
```

```sql
cv_records_source_check: CHECK (source = ANY (ARRAY['first'::text, 'monthly'::text, 'on_demand'::text, 'reissue'::text])); -- validated: true
```

```sql
cv_records_superseded_by_fkey: FOREIGN KEY (superseded_by) REFERENCES cv_records(id) ON DELETE SET NULL; -- validated: true
```

```sql
cv_records_template_check: CHECK (template ~ '^[a-z]{3,20}$'::text); -- validated: true
```

```sql
cv_records_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
cv_records_user_id_version_key: UNIQUE (user_id, version); -- validated: true
```

```sql
cv_records_version_check: CHECK (version >= 1); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX cv_records_code_key ON public.cv_records USING btree (code); -- valid: true
```

```sql
CREATE INDEX cv_records_key_idx ON public.cv_records USING btree (key_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX cv_records_pkey ON public.cv_records USING btree (id); -- valid: true
```

```sql
CREATE INDEX cv_records_revoked_by_idx ON public.cv_records USING btree (revoked_by) WHERE (revoked_by IS NOT NULL); -- valid: true
```

```sql
CREATE INDEX cv_records_superseded_idx ON public.cv_records USING btree (superseded_by) WHERE (superseded_by IS NOT NULL); -- valid: true
```

```sql
CREATE UNIQUE INDEX cv_records_user_id_version_key ON public.cv_records USING btree (user_id, version); -- valid: true
```

```sql
CREATE INDEX cv_records_user_idx ON public.cv_records USING btree (user_id, version DESC); -- valid: true
```

### Policies

#### cv_records.cv_records_owner_read

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
CREATE TRIGGER cv_refreshed_notice AFTER INSERT ON cv_records FOR EACH ROW WHEN (new.source = 'monthly'::text) EXECUTE FUNCTION private.cv_refreshed_notice(); -- enabled: O
```

## public.cv_settings

[src: supabase/migrations/20261008000000_verified_cv.sql#cv_settings]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| sections | text[] | true | private.cv_all_sections() |  |  | "default" |
| show_percentile | boolean | false | — |  |  | — |
| show_email | boolean | true | false |  |  | — |
| visibility | cv_visibility | true | 'link'::cv_visibility |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
cv_settings_pkey: PRIMARY KEY (user_id); -- validated: true
```

```sql
cv_settings_sections_check: CHECK (private.cv_sections_valid(sections)); -- validated: true
```

```sql
cv_settings_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX cv_settings_pkey ON public.cv_settings USING btree (user_id); -- valid: true
```

### Policies

#### cv_settings.cv_settings_owner_read

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

## public.signing_keys

[src: supabase/migrations/20261008000000_verified_cv.sql#signing_keys]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| key_id | text | true | — |  |  | "default" |
| algorithm | text | true | 'Ed25519'::text |  |  | "default" |
| public_key | text | true | — |  |  | "default" |
| active_from | timestamp with time zone | true | now() |  |  | — |
| retired_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
signing_keys_algorithm_check: CHECK (algorithm = 'Ed25519'::text); -- validated: true
```

```sql
signing_keys_check: CHECK (retired_at IS NULL OR retired_at >= active_from); -- validated: true
```

```sql
signing_keys_key_id_check: CHECK (key_id ~ '^cv-[0-9]{8}-[0-9a-f]{8}$'::text); -- validated: true
```

```sql
signing_keys_pkey: PRIMARY KEY (key_id); -- validated: true
```

```sql
signing_keys_public_key_check: CHECK (public_key ~ '^[A-Za-z0-9_-]{43}$'::text); -- validated: true
```

```sql
signing_keys_public_key_key: UNIQUE (public_key); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX signing_keys_one_active_idx ON public.signing_keys USING btree ((true)) WHERE (retired_at IS NULL); -- valid: true
```

```sql
CREATE UNIQUE INDEX signing_keys_pkey ON public.signing_keys USING btree (key_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX signing_keys_public_key_key ON public.signing_keys USING btree (public_key); -- valid: true
```

### Policies

#### signing_keys.signing_keys_read

```json
{
  "roles": [
    "anon",
    "authenticated"
  ],
  "using": "true",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.
