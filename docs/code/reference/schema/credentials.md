Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# credentials

## private.claim_credential(p_id uuid, p_claim boolean)

[src: supabase/migrations/20261003000000_credentials.sql#claim_credential]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.claim_credential(p_id uuid, p_claim boolean) | plpgsql | true | search_path="" | authenticated | 20261003000000_credentials.sql |

## private.claim_review_flag(p_flag bigint, p_claim boolean)

[src: supabase/migrations/20261003000000_credentials.sql#claim_review_flag]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.claim_review_flag(p_flag bigint, p_claim boolean) | plpgsql | true | search_path="" | authenticated | 20261003000000_credentials.sql |

## private.credential_case(p_id uuid)

[src: supabase/migrations/20261003000000_credentials.sql#credential_case]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.credential_case(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261003000000_credentials.sql |

## private.credential_file_cleanup()

[src: supabase/migrations/20261003000000_credentials.sql#credential_file_cleanup]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.credential_file_cleanup() | plpgsql | true | search_path="" | None | 20261003000000_credentials.sql |

## private.credential_file_unused(p_name text)

[src: supabase/migrations/20261003000000_credentials.sql#credential_file_unused]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.credential_file_unused(p_name text) | sql | true | search_path="" | authenticated | 20261003000000_credentials.sql |

## private.credential_queue(p_status text)

[src: supabase/migrations/20261003000000_credentials.sql#credential_queue]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.credential_queue(p_status text) | plpgsql | true | search_path="" | authenticated | 20261003000000_credentials.sql |

## private.credential_upload_allowed(p_name text)

[src: supabase/migrations/20261003000000_credentials.sql#credential_upload_allowed]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.credential_upload_allowed(p_name text) | sql | true | search_path="" | authenticated | 20261003000000_credentials.sql |

## private.credentials_daily()

[src: supabase/migrations/20261003000000_credentials.sql#credentials_daily]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.credentials_daily() | plpgsql | true | search_path="" | None | 20261003000000_credentials.sql |

## private.credentials_for(p_user uuid)

[src: supabase/migrations/20261003000000_credentials.sql#credentials_for]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.credentials_for(p_user uuid) | sql | true | search_path="" | authenticated | 20261003000000_credentials.sql |

## private.delete_credential(p_id uuid)

[src: supabase/migrations/20261003000000_credentials.sql#delete_credential]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.delete_credential(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261003000000_credentials.sql |

## private.require_trust_reviewer()

[src: supabase/migrations/20261003000000_credentials.sql#require_trust_reviewer]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.require_trust_reviewer() | plpgsql | true | search_path="" | None | 20261003000000_credentials.sql |

## private.resolve_review_flag(p_flag bigint, p_upheld boolean, p_note text)

[src: supabase/migrations/20261003000000_credentials.sql#resolve_review_flag]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.resolve_review_flag(p_flag bigint, p_upheld boolean, p_note text) | plpgsql | true | search_path="" | authenticated | 20261003000000_credentials.sql |

## private.review_credential(p_id uuid, p_approve boolean, p_reason text, p_issuer text)

[src: supabase/migrations/20261003000000_credentials.sql#review_credential]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.review_credential(p_id uuid, p_approve boolean, p_reason text, p_issuer text) | plpgsql | true | search_path="" | authenticated | 20261003000000_credentials.sql |

## private.review_flag_case(p_flag bigint)

[src: supabase/migrations/20261003000000_credentials.sql#review_flag_case]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.review_flag_case(p_flag bigint) | plpgsql | true | search_path="" | authenticated | 20261003000000_credentials.sql |

## private.review_flag_queue()

[src: supabase/migrations/20261003000000_credentials.sql#review_flag_queue]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.review_flag_queue() | plpgsql | true | search_path="" | authenticated | 20261003000000_credentials.sql |

## private.storage_usage()

[src: supabase/migrations/20261003000000_credentials.sql#storage_usage]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.storage_usage() | plpgsql | true | search_path="" | authenticated | 20261003000000_credentials.sql |

## private.submit_credential(p jsonb)

[src: supabase/migrations/20261003000000_credentials.sql#submit_credential]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.submit_credential(p jsonb) | plpgsql | true | search_path="" | authenticated | 20261003000000_credentials.sql |

## private.suggest_issuer(p_issuer text)

[src: supabase/migrations/20261003000000_credentials.sql#suggest_issuer]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.suggest_issuer(p_issuer text) | sql | true | search_path="" | None | 20261003000000_credentials.sql |

## public.claim_credential(p_id uuid, p_claim boolean)

[src: supabase/migrations/20261003000000_credentials.sql#claim_credential]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.claim_credential(p_id uuid, p_claim boolean) | sql | false | search_path="" | authenticated, service_role | 20261003000000_credentials.sql |

## public.claim_review_flag(p_flag bigint, p_claim boolean)

[src: supabase/migrations/20261003000000_credentials.sql#claim_review_flag]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.claim_review_flag(p_flag bigint, p_claim boolean) | sql | false | search_path="" | authenticated, service_role | 20261003000000_credentials.sql |

## public.credential_case(p_id uuid)

[src: supabase/migrations/20261003000000_credentials.sql#credential_case]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.credential_case(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261003000000_credentials.sql |

## public.credential_queue(p_status text)

[src: supabase/migrations/20261003000000_credentials.sql#credential_queue]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.credential_queue(p_status text) | sql | false | search_path="" | authenticated, service_role | 20261003000000_credentials.sql |

## public.credentials_for(p_user uuid)

[src: supabase/migrations/20261003000000_credentials.sql#credentials_for]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.credentials_for(p_user uuid) | sql | false | search_path="" | authenticated, service_role | 20261003000000_credentials.sql |

## public.delete_credential(p_id uuid)

[src: supabase/migrations/20261003000000_credentials.sql#delete_credential]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.delete_credential(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261003000000_credentials.sql |

## public.review_credential(p_id uuid, p_approve boolean, p_reason text, p_issuer text)

[src: supabase/migrations/20261003000000_credentials.sql#review_credential]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.review_credential(p_id uuid, p_approve boolean, p_reason text, p_issuer text) | sql | false | search_path="" | authenticated, service_role | 20261003000000_credentials.sql |

## public.review_flag_case(p_flag bigint)

[src: supabase/migrations/20261003000000_credentials.sql#review_flag_case]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.review_flag_case(p_flag bigint) | sql | false | search_path="" | authenticated, service_role | 20261003000000_credentials.sql |

## public.review_flag_queue()

[src: supabase/migrations/20261003000000_credentials.sql#review_flag_queue]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.review_flag_queue() | sql | false | search_path="" | authenticated, service_role | 20261003000000_credentials.sql |

## public.storage_usage()

[src: supabase/migrations/20261003000000_credentials.sql#storage_usage]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.storage_usage() | sql | false | search_path="" | authenticated, service_role | 20261003000000_credentials.sql |

## public.submit_credential(p jsonb)

[src: supabase/migrations/20261003000000_credentials.sql#submit_credential]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.submit_credential(p jsonb) | sql | false | search_path="" | authenticated, service_role | 20261003000000_credentials.sql |

## public.credentials

[src: supabase/migrations/20261003000000_credentials.sql#credentials]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| user_id | uuid | true | — |  |  | — |
| title | text | true | — |  |  | "default" |
| issuer | text | true | — |  |  | "default" |
| issued_on | date | true | — |  |  | — |
| expires_on | date | false | — |  |  | — |
| verify_url | text | false | — |  |  | "default" |
| file_path | text | true | — |  |  | "default" |
| file_type | text | true | — |  |  | "default" |
| file_bytes | integer | true | — |  |  | — |
| status | credential_status | true | 'pending'::credential_status |  |  | — |
| recognised_issuer_id | text | false | — |  |  | "default" |
| claimed_by | uuid | false | — |  |  | — |
| claimed_at | timestamp with time zone | false | — |  |  | — |
| reviewer_id | uuid | false | — |  |  | — |
| reviewed_at | timestamp with time zone | false | — |  |  | — |
| review_reason | text | false | — |  |  | "default" |
| file_deleted_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
credentials_check: CHECK (expires_on IS NULL OR expires_on > issued_on); -- validated: true
```

```sql
credentials_check1: CHECK (recognised_issuer_id IS NULL OR (status = ANY (ARRAY['approved'::credential_status, 'expired'::credential_status]))); -- validated: true
```

```sql
credentials_check2: CHECK ((status = 'pending'::credential_status) = (reviewed_at IS NULL)); -- validated: true
```

```sql
credentials_claimed_by_fkey: FOREIGN KEY (claimed_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
credentials_file_bytes_check: CHECK (file_bytes > 0); -- validated: true
```

```sql
credentials_file_path_check: CHECK (file_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|webp)$'::text); -- validated: true
```

```sql
credentials_file_path_key: UNIQUE (file_path); -- validated: true
```

```sql
credentials_file_type_check: CHECK (file_type = ANY (ARRAY['pdf'::text, 'image'::text])); -- validated: true
```

```sql
credentials_issued_on_check: CHECK (issued_on >= '1980-01-01'::date); -- validated: true
```

```sql
credentials_issuer_check: CHECK (char_length(btrim(issuer)) >= 2 AND char_length(btrim(issuer)) <= 120); -- validated: true
```

```sql
credentials_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
credentials_recognised_issuer_id_fkey: FOREIGN KEY (recognised_issuer_id) REFERENCES recognised_issuers(id); -- validated: true
```

```sql
credentials_review_reason_check: CHECK (review_reason IS NULL OR char_length(btrim(review_reason)) >= 3 AND char_length(btrim(review_reason)) <= 2000); -- validated: true
```

```sql
credentials_reviewer_id_fkey: FOREIGN KEY (reviewer_id) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
credentials_title_check: CHECK (char_length(btrim(title)) >= 2 AND char_length(btrim(title)) <= 120); -- validated: true
```

```sql
credentials_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
credentials_verify_url_check: CHECK (verify_url IS NULL OR verify_url ~ '^https://[^\s]+$'::text AND char_length(verify_url) <= 500); -- validated: true
```

### Indexes

```sql
CREATE INDEX credentials_claimed_by_idx ON public.credentials USING btree (claimed_by) WHERE (claimed_by IS NOT NULL); -- valid: true
```

```sql
CREATE INDEX credentials_expiry_idx ON public.credentials USING btree (expires_on) WHERE ((status = 'approved'::credential_status) AND (expires_on IS NOT NULL)); -- valid: true
```

```sql
CREATE UNIQUE INDEX credentials_file_path_key ON public.credentials USING btree (file_path); -- valid: true
```

```sql
CREATE INDEX credentials_issuer_idx ON public.credentials USING btree (recognised_issuer_id) WHERE (recognised_issuer_id IS NOT NULL); -- valid: true
```

```sql
CREATE INDEX credentials_pending_idx ON public.credentials USING btree (created_at) WHERE (status = 'pending'::credential_status); -- valid: true
```

```sql
CREATE UNIQUE INDEX credentials_pkey ON public.credentials USING btree (id); -- valid: true
```

```sql
CREATE INDEX credentials_reviewer_idx ON public.credentials USING btree (reviewer_id) WHERE (reviewer_id IS NOT NULL); -- valid: true
```

```sql
CREATE INDEX credentials_user_idx ON public.credentials USING btree (user_id, created_at DESC); -- valid: true
```

### Policies

#### credentials.credentials_read_own

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
CREATE TRIGGER credentials_file_cleanup AFTER DELETE ON credentials FOR EACH ROW EXECUTE FUNCTION private.credential_file_cleanup(); -- enabled: O
```

```sql
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON credentials FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```

## public.recognised_issuers

[src: supabase/migrations/20261003000000_credentials.sql#recognised_issuers]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | text | true | — |  |  | "default" |
| name | text | true | — |  |  | "default" |
| aliases | text[] | true | '{}'::text[] |  |  | "default" |
| retired_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
recognised_issuers_id_check: CHECK (id ~ '^[a-z0-9][a-z0-9-]{1,40}$'::text); -- validated: true
```

```sql
recognised_issuers_name_check: CHECK (char_length(name) >= 2 AND char_length(name) <= 120); -- validated: true
```

```sql
recognised_issuers_pkey: PRIMARY KEY (id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX recognised_issuers_pkey ON public.recognised_issuers USING btree (id); -- valid: true
```

### Policies

#### recognised_issuers.recognised_issuers_read

```json
{
  "roles": [
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
