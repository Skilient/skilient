Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# marketing

## private.confirm_university_request(p_token text)

[src: supabase/migrations/20261031000000_marketing.sql#confirm_university_request]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.confirm_university_request(p_token text) | plpgsql | true | search_path="" | anon, authenticated | 20261031000000_marketing.sql |

## private.landing_stats()

[src: supabase/migrations/20261031000000_marketing.sql#landing_stats]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.landing_stats() | plpgsql | true | search_path="" | anon, authenticated | 20261031000000_marketing.sql |

## private.ops_open_all_universities(p_reason text)

[src: supabase/migrations/20261031000000_marketing.sql#ops_open_all_universities]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_open_all_universities(p_reason text) | plpgsql | true | search_path="" | authenticated | 20261031000000_marketing.sql |

## private.ops_set_university_live(p_university uuid, p_live boolean, p_reason text)

[src: supabase/migrations/20261031000000_marketing.sql#ops_set_university_live]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_set_university_live(p_university uuid, p_live boolean, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261031000000_marketing.sql |

## private.ops_university_requests()

[src: supabase/migrations/20261031000000_marketing.sql#ops_university_requests]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_university_requests() | plpgsql | true | search_path="" | authenticated | 20261031000000_marketing.sql |

## private.public_plans()

[src: supabase/migrations/20261031000000_marketing.sql#public_plans]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.public_plans() | sql | true | search_path="" | anon, authenticated | 20261031000000_marketing.sql |

## private.refresh_landing_stats()

[src: supabase/migrations/20261031000000_marketing.sql#refresh_landing_stats]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.refresh_landing_stats() | plpgsql | true | search_path="" | None | 20261031000000_marketing.sql |

## private.request_university(p_email text, p_university_name text, p_consent boolean, p_token text)

[src: supabase/migrations/20261031000000_marketing.sql#request_university]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.request_university(p_email text, p_university_name text, p_consent boolean, p_token text) | plpgsql | true | search_path="" | anon, authenticated | 20261031000000_marketing.sql |

## private.university_live(p_university uuid)

[src: supabase/migrations/20261031000000_marketing.sql#university_live]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.university_live(p_university uuid) | sql | true | search_path="" | None | 20261031000000_marketing.sql |

## private.unsubscribe_university_request(p_token text)

[src: supabase/migrations/20261031000000_marketing.sql#unsubscribe_university_request]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.unsubscribe_university_request(p_token text) | plpgsql | true | search_path="" | anon, authenticated | 20261031000000_marketing.sql |

## private.validate_signup(p_email text, p_role account_role, p_university_id uuid)

[src: supabase/migrations/20261031000000_marketing.sql#validate_signup]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.validate_signup(p_email text, p_role account_role, p_university_id uuid) | plpgsql | true | search_path="" | service_role, supabase_auth_admin | 20261031000000_marketing.sql |

## public.confirm_university_request(p_token text)

[src: supabase/migrations/20261031000000_marketing.sql#confirm_university_request]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.confirm_university_request(p_token text) | sql | false | search_path="" | anon, authenticated, service_role | 20261031000000_marketing.sql |

## public.landing_stats()

[src: supabase/migrations/20261031000000_marketing.sql#landing_stats]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.landing_stats() | sql | false | search_path="" | anon, authenticated, service_role | 20261031000000_marketing.sql |

## public.ops_open_all_universities(p_reason text)

[src: supabase/migrations/20261031000000_marketing.sql#ops_open_all_universities]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_open_all_universities(p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261031000000_marketing.sql |

## public.ops_set_university_live(p_university uuid, p_live boolean, p_reason text)

[src: supabase/migrations/20261031000000_marketing.sql#ops_set_university_live]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_set_university_live(p_university uuid, p_live boolean, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261031000000_marketing.sql |

## public.ops_university_requests()

[src: supabase/migrations/20261031000000_marketing.sql#ops_university_requests]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_university_requests() | sql | false | search_path="" | authenticated, service_role | 20261031000000_marketing.sql |

## public.public_plans()

[src: supabase/migrations/20261031000000_marketing.sql#public_plans]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.public_plans() | sql | false | search_path="" | anon, authenticated, service_role | 20261031000000_marketing.sql |

## public.request_university(p_email text, p_university_name text, p_consent boolean, p_token text)

[src: supabase/migrations/20261031000000_marketing.sql#request_university]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.request_university(p_email text, p_university_name text, p_consent boolean, p_token text) | sql | false | search_path="" | anon, authenticated, service_role | 20261031000000_marketing.sql |

## public.unsubscribe_university_request(p_token text)

[src: supabase/migrations/20261031000000_marketing.sql#unsubscribe_university_request]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.unsubscribe_university_request(p_token text) | sql | false | search_path="" | anon, authenticated, service_role | 20261031000000_marketing.sql |

## public.university_requests

[src: supabase/migrations/20261031000000_marketing.sql#university_requests]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| email | text | true | — |  |  | "default" |
| domain | text | true | — |  |  | "default" |
| university_id | uuid | false | — |  |  | — |
| university_name | text | false | — |  |  | "default" |
| consent | boolean | true | — |  |  | — |
| token_hash | text | true | — |  |  | "default" |
| confirmed_at | timestamp with time zone | false | — |  |  | — |
| notified_at | timestamp with time zone | false | — |  |  | — |
| unsubscribed_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
university_requests_check: CHECK (university_id IS NOT NULL OR university_name IS NOT NULL); -- validated: true
```

```sql
university_requests_domain_check: CHECK (char_length(domain) >= 3 AND char_length(domain) <= 253); -- validated: true
```

```sql
university_requests_email_check: CHECK (char_length(email) >= 6 AND char_length(email) <= 254 AND email = lower(email) AND email ~ '^[^\s@]+@[^\s@]+$'::text); -- validated: true
```

```sql
university_requests_email_key: UNIQUE (email); -- validated: true
```

```sql
university_requests_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
university_requests_token_hash_check: CHECK (token_hash ~ '^[0-9a-f]{64}$'::text); -- validated: true
```

```sql
university_requests_token_hash_key: UNIQUE (token_hash); -- validated: true
```

```sql
university_requests_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE SET NULL; -- validated: true
```

```sql
university_requests_university_name_check: CHECK (university_name IS NULL OR char_length(btrim(university_name)) >= 2 AND char_length(btrim(university_name)) <= 200); -- validated: true
```

### Indexes

```sql
CREATE INDEX university_requests_domain_idx ON public.university_requests USING btree (domain, created_at DESC); -- valid: true
```

```sql
CREATE UNIQUE INDEX university_requests_email_key ON public.university_requests USING btree (email); -- valid: true
```

```sql
CREATE UNIQUE INDEX university_requests_pkey ON public.university_requests USING btree (id); -- valid: true
```

```sql
CREATE UNIQUE INDEX university_requests_token_hash_key ON public.university_requests USING btree (token_hash); -- valid: true
```

```sql
CREATE INDEX university_requests_university_idx ON public.university_requests USING btree (university_id) WHERE (university_id IS NOT NULL); -- valid: true
```

### Policies

None.

### Triggers

None.
