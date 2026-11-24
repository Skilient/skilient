Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# recruiter_api

## private.api_auth(p_token text)

[src: supabase/migrations/20261016000000_recruiter_api.sql#api_auth]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.api_auth(p_token text) | plpgsql | true | search_path="" | None | 20261016000000_recruiter_api.sql |

## private.api_candidate(p_token text, p_candidate uuid)

[src: supabase/migrations/20261016000000_recruiter_api.sql#api_candidate]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.api_candidate(p_token text, p_candidate uuid) | plpgsql | true | search_path="" | anon, authenticated | 20261016000000_recruiter_api.sql |

## private.api_job_applications(p_token text, p_job uuid)

[src: supabase/migrations/20261016000000_recruiter_api.sql#api_job_applications]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.api_job_applications(p_token text, p_job uuid) | plpgsql | true | search_path="" | anon, authenticated | 20261016000000_recruiter_api.sql |

## private.api_linked(p_org uuid, p_student uuid)

[src: supabase/migrations/20261016000000_recruiter_api.sql#api_linked]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.api_linked(p_org uuid, p_student uuid) | sql | true | search_path="" | None | 20261016000000_recruiter_api.sql |

## private.api_settings()

[src: supabase/migrations/20261016000000_recruiter_api.sql#api_settings]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.api_settings() | plpgsql | true | search_path="" | authenticated | 20261016000000_recruiter_api.sql |

## private.api_shortlist_candidates(p_token text, p_list uuid)

[src: supabase/migrations/20261016000000_recruiter_api.sql#api_shortlist_candidates]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.api_shortlist_candidates(p_token text, p_list uuid) | plpgsql | true | search_path="" | anon, authenticated | 20261016000000_recruiter_api.sql |

## private.api_shortlists(p_token text)

[src: supabase/migrations/20261016000000_recruiter_api.sql#api_shortlists]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.api_shortlists(p_token text) | plpgsql | true | search_path="" | anon, authenticated | 20261016000000_recruiter_api.sql |

## private.check_org_spam()

[src: supabase/migrations/20261016000000_recruiter_api.sql#check_org_spam]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.check_org_spam() | plpgsql | true | search_path="" | None | 20261016000000_recruiter_api.sql |

## private.contact_accepted_event()

[src: supabase/migrations/20261016000000_recruiter_api.sql#contact_accepted_event]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.contact_accepted_event() | plpgsql | true | search_path="" | None | 20261016000000_recruiter_api.sql |

## private.create_api_token(p_name text, p_token_hash text)

[src: supabase/migrations/20261016000000_recruiter_api.sql#create_api_token]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.create_api_token(p_name text, p_token_hash text) | plpgsql | true | search_path="" | authenticated | 20261016000000_recruiter_api.sql |

## private.create_webhook(p_url text, p_events text[])

[src: supabase/migrations/20261016000000_recruiter_api.sql#create_webhook]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.create_webhook(p_url text, p_events text[]) | plpgsql | true | search_path="" | authenticated | 20261016000000_recruiter_api.sql |

## private.delete_webhook(p_id uuid)

[src: supabase/migrations/20261016000000_recruiter_api.sql#delete_webhook]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.delete_webhook(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261016000000_recruiter_api.sql |

## private.emit_org_event(p_org uuid, p_event text, p_data jsonb)

[src: supabase/migrations/20261016000000_recruiter_api.sql#emit_org_event]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.emit_org_event(p_org uuid, p_event text, p_data jsonb) | sql | true | search_path="" | None | 20261016000000_recruiter_api.sql |

## private.ops_org_reputation(p_org uuid)

[src: supabase/migrations/20261016000000_recruiter_api.sql#ops_org_reputation]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_org_reputation(p_org uuid) | plpgsql | true | search_path="" | authenticated | 20261016000000_recruiter_api.sql |

## private.ops_spam_reviews(p_status text)

[src: supabase/migrations/20261016000000_recruiter_api.sql#ops_spam_reviews]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_spam_reviews(p_status text) | plpgsql | true | search_path="" | authenticated | 20261016000000_recruiter_api.sql |

## private.org_analytics(p_days integer)

[src: supabase/migrations/20261016000000_recruiter_api.sql#org_analytics]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.org_analytics(p_days integer) | plpgsql | true | search_path="" | authenticated | 20261016000000_recruiter_api.sql |

## private.org_response_stats(p_org uuid)

[src: supabase/migrations/20261016000000_recruiter_api.sql#org_response_stats]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.org_response_stats(p_org uuid) | plpgsql | true | search_path="" | authenticated | 20261016000000_recruiter_api.sql |

## private.recruit_candidate_for_code(p_code text)

[src: supabase/migrations/20261016000000_recruiter_api.sql#recruit_candidate_for_code]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.recruit_candidate_for_code(p_code text) | plpgsql | true | search_path="" | authenticated | 20261016000000_recruiter_api.sql |

## private.require_api_admin()

[src: supabase/migrations/20261016000000_recruiter_api.sql#require_api_admin]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.require_api_admin() | plpgsql | true | search_path="" | None | 20261016000000_recruiter_api.sql |

## private.revoke_api_token(p_id uuid)

[src: supabase/migrations/20261016000000_recruiter_api.sql#revoke_api_token]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.revoke_api_token(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261016000000_recruiter_api.sql |

## private.wake_webhook_worker()

[src: supabase/migrations/20261016000000_recruiter_api.sql#wake_webhook_worker]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.wake_webhook_worker() | plpgsql | true | search_path="" | None | 20261016000000_recruiter_api.sql |

## private.webhook_due(p_limit integer)

[src: supabase/migrations/20261016000000_recruiter_api.sql#webhook_due]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.webhook_due(p_limit integer) | sql | true | search_path="" | service_role | 20261016000000_recruiter_api.sql |

## private.webhook_result(p_id bigint, p_ok boolean, p_status integer, p_error text)

[src: supabase/migrations/20261016000000_recruiter_api.sql#webhook_result]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.webhook_result(p_id bigint, p_ok boolean, p_status integer, p_error text) | plpgsql | true | search_path="" | service_role | 20261016000000_recruiter_api.sql |

## public.api_candidate(p_token text, p_candidate uuid)

[src: supabase/migrations/20261016000000_recruiter_api.sql#api_candidate]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.api_candidate(p_token text, p_candidate uuid) | sql | false | search_path="" | anon, authenticated, service_role | 20261016000000_recruiter_api.sql |

## public.api_job_applications(p_token text, p_job uuid)

[src: supabase/migrations/20261016000000_recruiter_api.sql#api_job_applications]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.api_job_applications(p_token text, p_job uuid) | sql | false | search_path="" | anon, authenticated, service_role | 20261016000000_recruiter_api.sql |

## public.api_settings()

[src: supabase/migrations/20261016000000_recruiter_api.sql#api_settings]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.api_settings() | sql | false | search_path="" | authenticated, service_role | 20261016000000_recruiter_api.sql |

## public.api_shortlist_candidates(p_token text, p_list uuid)

[src: supabase/migrations/20261016000000_recruiter_api.sql#api_shortlist_candidates]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.api_shortlist_candidates(p_token text, p_list uuid) | sql | false | search_path="" | anon, authenticated, service_role | 20261016000000_recruiter_api.sql |

## public.api_shortlists(p_token text)

[src: supabase/migrations/20261016000000_recruiter_api.sql#api_shortlists]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.api_shortlists(p_token text) | sql | false | search_path="" | anon, authenticated, service_role | 20261016000000_recruiter_api.sql |

## public.create_api_token(p_name text, p_token_hash text)

[src: supabase/migrations/20261016000000_recruiter_api.sql#create_api_token]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.create_api_token(p_name text, p_token_hash text) | sql | false | search_path="" | authenticated, service_role | 20261016000000_recruiter_api.sql |

## public.create_webhook(p_url text, p_events text[])

[src: supabase/migrations/20261016000000_recruiter_api.sql#create_webhook]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.create_webhook(p_url text, p_events text[]) | sql | false | search_path="" | authenticated, service_role | 20261016000000_recruiter_api.sql |

## public.delete_webhook(p_id uuid)

[src: supabase/migrations/20261016000000_recruiter_api.sql#delete_webhook]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.delete_webhook(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261016000000_recruiter_api.sql |

## public.ops_org_reputation(p_org uuid)

[src: supabase/migrations/20261016000000_recruiter_api.sql#ops_org_reputation]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_org_reputation(p_org uuid) | sql | false | search_path="" | authenticated, service_role | 20261016000000_recruiter_api.sql |

## public.ops_resolve_spam_review(p_id uuid, p_action text, p_reason text)

[src: supabase/migrations/20261016000000_recruiter_api.sql#ops_resolve_spam_review]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_resolve_spam_review(p_id uuid, p_action text, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261016000000_recruiter_api.sql |

## public.ops_spam_reviews(p_status text)

[src: supabase/migrations/20261016000000_recruiter_api.sql#ops_spam_reviews]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_spam_reviews(p_status text) | sql | false | search_path="" | authenticated, service_role | 20261016000000_recruiter_api.sql |

## public.org_analytics(p_days integer)

[src: supabase/migrations/20261016000000_recruiter_api.sql#org_analytics]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.org_analytics(p_days integer) | sql | false | search_path="" | authenticated, service_role | 20261016000000_recruiter_api.sql |

## public.org_response_stats(p_org uuid)

[src: supabase/migrations/20261016000000_recruiter_api.sql#org_response_stats]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.org_response_stats(p_org uuid) | sql | false | search_path="" | authenticated, service_role | 20261016000000_recruiter_api.sql |

## public.recruit_candidate_for_code(p_code text)

[src: supabase/migrations/20261016000000_recruiter_api.sql#recruit_candidate_for_code]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.recruit_candidate_for_code(p_code text) | sql | false | search_path="" | authenticated, service_role | 20261016000000_recruiter_api.sql |

## public.revoke_api_token(p_id uuid)

[src: supabase/migrations/20261016000000_recruiter_api.sql#revoke_api_token]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.revoke_api_token(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261016000000_recruiter_api.sql |

## public.api_tokens

[src: supabase/migrations/20261016000000_recruiter_api.sql#api_tokens]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| org_id | uuid | true | — |  |  | — |
| name | text | true | — |  |  | "default" |
| token_hash | text | true | — |  |  | "default" |
| created_by | uuid | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| last_used_at | timestamp with time zone | false | — |  |  | — |
| revoked_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
api_tokens_created_by_fkey: FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
api_tokens_name_check: CHECK (char_length(btrim(name)) >= 1 AND char_length(btrim(name)) <= 60); -- validated: true
```

```sql
api_tokens_org_id_fkey: FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE; -- validated: true
```

```sql
api_tokens_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
api_tokens_token_hash_check: CHECK (token_hash ~ '^[0-9a-f]{64}$'::text); -- validated: true
```

```sql
api_tokens_token_hash_key: UNIQUE (token_hash); -- validated: true
```

### Indexes

```sql
CREATE INDEX api_tokens_org_idx ON public.api_tokens USING btree (org_id, created_at DESC); -- valid: true
```

```sql
CREATE UNIQUE INDEX api_tokens_pkey ON public.api_tokens USING btree (id); -- valid: true
```

```sql
CREATE UNIQUE INDEX api_tokens_token_hash_key ON public.api_tokens USING btree (token_hash); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.api_webhook_deliveries

[src: supabase/migrations/20261016000000_recruiter_api.sql#api_webhook_deliveries]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint | true | — | a |  | — |
| webhook_id | uuid | true | — |  |  | — |
| event | text | true | — |  |  | "default" |
| payload | jsonb | true | — |  |  | — |
| attempt | integer | true | 0 |  |  | — |
| status | text | true | 'pending'::text |  |  | "default" |
| next_attempt_at | timestamp with time zone | true | now() |  |  | — |
| last_status | integer | false | — |  |  | — |
| last_error | text | false | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |
| delivered_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
api_webhook_deliveries_last_error_check: CHECK (last_error IS NULL OR char_length(last_error) <= 300); -- validated: true
```

```sql
api_webhook_deliveries_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
api_webhook_deliveries_status_check: CHECK (status = ANY (ARRAY['pending'::text, 'delivered'::text, 'failed'::text])); -- validated: true
```

```sql
api_webhook_deliveries_webhook_id_fkey: FOREIGN KEY (webhook_id) REFERENCES api_webhooks(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX api_webhook_deliveries_due_idx ON public.api_webhook_deliveries USING btree (next_attempt_at) WHERE (status = 'pending'::text); -- valid: true
```

```sql
CREATE INDEX api_webhook_deliveries_hook_idx ON public.api_webhook_deliveries USING btree (webhook_id, created_at DESC); -- valid: true
```

```sql
CREATE UNIQUE INDEX api_webhook_deliveries_pkey ON public.api_webhook_deliveries USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.api_webhooks

[src: supabase/migrations/20261016000000_recruiter_api.sql#api_webhooks]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| org_id | uuid | true | — |  |  | — |
| url | text | true | — |  |  | "default" |
| secret | text | true | — |  |  | "default" |
| events | text[] | true | — |  |  | "default" |
| active | boolean | true | true |  |  | — |
| consecutive_failures | integer | true | 0 |  |  | — |
| created_by | uuid | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
api_webhooks_created_by_fkey: FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
api_webhooks_events_check: CHECK (events <@ ARRAY['application.created'::text, 'contact.accepted'::text] AND cardinality(events) >= 1); -- validated: true
```

```sql
api_webhooks_org_id_fkey: FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE; -- validated: true
```

```sql
api_webhooks_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
api_webhooks_url_check: CHECK (url ~ '^https://[^[:space:]]+$'::text AND char_length(url) <= 300); -- validated: true
```

### Indexes

```sql
CREATE INDEX api_webhooks_org_idx ON public.api_webhooks USING btree (org_id) WHERE active; -- valid: true
```

```sql
CREATE UNIQUE INDEX api_webhooks_pkey ON public.api_webhooks USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.org_spam_reviews

[src: supabase/migrations/20261016000000_recruiter_api.sql#org_spam_reviews]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| org_id | uuid | true | — |  |  | — |
| requests | integer | true | — |  |  | — |
| declined | integer | true | — |  |  | — |
| rate | numeric(4,3) | true | — |  |  | — |
| status | text | true | 'open'::text |  |  | "default" |
| opened_at | timestamp with time zone | true | now() |  |  | — |
| resolved_by | uuid | false | — |  |  | — |
| resolved_at | timestamp with time zone | false | — |  |  | — |
| note | text | false | — |  |  | "default" |

### Keys and constraints

```sql
org_spam_reviews_note_check: CHECK (note IS NULL OR char_length(note) <= 2000); -- validated: true
```

```sql
org_spam_reviews_org_id_fkey: FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE; -- validated: true
```

```sql
org_spam_reviews_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
org_spam_reviews_resolved_by_fkey: FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
org_spam_reviews_status_check: CHECK (status = ANY (ARRAY['open'::text, 'cleared'::text, 'suspended'::text])); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX org_spam_reviews_open_idx ON public.org_spam_reviews USING btree (org_id) WHERE (status = 'open'::text); -- valid: true
```

```sql
CREATE UNIQUE INDEX org_spam_reviews_pkey ON public.org_spam_reviews USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

None.
