Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# billing_core

## private.active_grants(p_type billing_subject, p_id uuid, p_key text)

[src: supabase/migrations/20261023000000_billing_core.sql#active_grants]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.active_grants(p_type billing_subject, p_id uuid, p_key text) | sql | true | search_path="" | None | 20261023000000_billing_core.sql |

## private.add_note(p_student uuid, p_body text)

[src: supabase/migrations/20261023000000_billing_core.sql#add_note]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.add_note(p_student uuid, p_body text) | plpgsql | true | search_path="" | authenticated | 20261023000000_billing_core.sql |

## private.add_to_shortlist(p_list uuid, p_student uuid)

[src: supabase/migrations/20261023000000_billing_core.sql#add_to_shortlist]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.add_to_shortlist(p_list uuid, p_student uuid) | plpgsql | true | search_path="" | authenticated | 20261023000000_billing_core.sql |

## private.billing_forget_subject()

[src: supabase/migrations/20261023000000_billing_core.sql#billing_forget_subject]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.billing_forget_subject() | plpgsql | true | search_path="" | None | 20261023000000_billing_core.sql |

## private.check_grant()

[src: supabase/migrations/20261023000000_billing_core.sql#check_grant]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.check_grant() | plpgsql | true | search_path="" | None | 20261023000000_billing_core.sql |

## private.consume_quota(p_type billing_subject, p_id uuid, p_key text, p_n integer)

[src: supabase/migrations/20261023000000_billing_core.sql#consume_quota]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.consume_quota(p_type billing_subject, p_id uuid, p_key text, p_n integer) | plpgsql | true | search_path="" | service_role | 20261023000000_billing_core.sql |

## private.create_shortlist(p_name text)

[src: supabase/migrations/20261023000000_billing_core.sql#create_shortlist]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.create_shortlist(p_name text) | plpgsql | true | search_path="" | authenticated | 20261023000000_billing_core.sql |

## private.derived_user_values(p_user uuid, p_key text)

[src: supabase/migrations/20261023000000_billing_core.sql#derived_user_values]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.derived_user_values(p_user uuid, p_key text) | sql | true | search_path="" | None | 20261023000000_billing_core.sql |

## private.effective_entitlements(p_type billing_subject, p_id uuid)

[src: supabase/migrations/20261023000000_billing_core.sql#effective_entitlements]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.effective_entitlements(p_type billing_subject, p_id uuid) | sql | true | search_path="" | None | 20261023000000_billing_core.sql |

## private.entitled(p_type billing_subject, p_id uuid, p_key text)

[src: supabase/migrations/20261023000000_billing_core.sql#entitled]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.entitled(p_type billing_subject, p_id uuid, p_key text) | plpgsql | true | search_path="" | service_role | 20261023000000_billing_core.sql |

## private.entitlement_key(p_key text)

[src: supabase/migrations/20261023000000_billing_core.sql#entitlement_key]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.entitlement_key(p_key text) | sql | true | search_path="" | None | 20261023000000_billing_core.sql |

## private.entitlement_value(p_type billing_subject, p_id uuid, p_key text)

[src: supabase/migrations/20261023000000_billing_core.sql#entitlement_value]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.entitlement_value(p_type billing_subject, p_id uuid, p_key text) | plpgsql | true | search_path="" | service_role | 20261023000000_billing_core.sql |

## private.has_entitlement(p_user uuid, p_key text)

[src: supabase/migrations/20261023000000_billing_core.sql#has_entitlement]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.has_entitlement(p_user uuid, p_key text) | sql | true | search_path="" | None | 20261023000000_billing_core.sql |

## private.my_entitlements(p_subject text)

[src: supabase/migrations/20261023000000_billing_core.sql#my_entitlements]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_entitlements(p_subject text) | plpgsql | true | search_path="" | authenticated | 20261023000000_billing_core.sql |

## private.my_subject(p_type billing_subject)

[src: supabase/migrations/20261023000000_billing_core.sql#my_subject]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_subject(p_type billing_subject) | plpgsql | true | search_path="" | None | 20261023000000_billing_core.sql |

## private.org_entitled(p_org uuid, p_key text)

[src: supabase/migrations/20261023000000_billing_core.sql#org_entitled]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.org_entitled(p_org uuid, p_key text) | sql | true | search_path="" | None | 20261023000000_billing_core.sql |

## private.org_limit(p_key text)

[src: supabase/migrations/20261023000000_billing_core.sql#org_limit]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.org_limit(p_key text) | sql | true | search_path="" | None | 20261023000000_billing_core.sql |

## private.org_limit(p_org uuid, p_key text)

[src: supabase/migrations/20261023000000_billing_core.sql#org_limit]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.org_limit(p_org uuid, p_key text) | sql | true | search_path="" | service_role | 20261023000000_billing_core.sql |

## private.org_plan()

[src: supabase/migrations/20261023000000_billing_core.sql#org_plan]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.org_plan() | plpgsql | true | search_path="" | authenticated | 20261023000000_billing_core.sql |

## private.org_seat_count(p_org uuid)

[src: supabase/migrations/20261023000000_billing_core.sql#org_seat_count]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.org_seat_count(p_org uuid) | sql | true | search_path="" | None | 20261023000000_billing_core.sql |

## private.quota_extras(p_type billing_subject, p_id uuid, p_key text)

[src: supabase/migrations/20261023000000_billing_core.sql#quota_extras]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.quota_extras(p_type billing_subject, p_id uuid, p_key text) | sql | true | search_path="" | None | 20261023000000_billing_core.sql |

## private.quota_period_start(p_type billing_subject, p_id uuid, p_key text)

[src: supabase/migrations/20261023000000_billing_core.sql#quota_period_start]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.quota_period_start(p_type billing_subject, p_id uuid, p_key text) | plpgsql | true | search_path="" | None | 20261023000000_billing_core.sql |

## private.quota_status(p_type billing_subject, p_id uuid, p_key text)

[src: supabase/migrations/20261023000000_billing_core.sql#quota_status]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.quota_status(p_type billing_subject, p_id uuid, p_key text) | plpgsql | true | search_path="" | service_role | 20261023000000_billing_core.sql |

## private.release_quota(p_type billing_subject, p_id uuid, p_key text, p_n integer)

[src: supabase/migrations/20261023000000_billing_core.sql#release_quota]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.release_quota(p_type billing_subject, p_id uuid, p_key text, p_n integer) | plpgsql | true | search_path="" | service_role | 20261023000000_billing_core.sql |

## private.rename_shortlist(p_id uuid, p_name text)

[src: supabase/migrations/20261023000000_billing_core.sql#rename_shortlist]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.rename_shortlist(p_id uuid, p_name text) | plpgsql | true | search_path="" | authenticated | 20261023000000_billing_core.sql |

## private.reorder_shortlist(p_list uuid, p_items uuid[])

[src: supabase/migrations/20261023000000_billing_core.sql#reorder_shortlist]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.reorder_shortlist(p_list uuid, p_items uuid[]) | plpgsql | true | search_path="" | authenticated | 20261023000000_billing_core.sql |

## private.require_entitlement(p_key text)

[src: supabase/migrations/20261023000000_billing_core.sql#require_entitlement]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.require_entitlement(p_key text) | plpgsql | true | search_path="" | authenticated | 20261023000000_billing_core.sql |

## private.require_org_entitled(p_key text)

[src: supabase/migrations/20261023000000_billing_core.sql#require_org_entitled]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.require_org_entitled(p_key text) | plpgsql | true | search_path="" | None | 20261023000000_billing_core.sql |

## private.save_hackathon(p_id uuid, p jsonb)

[src: supabase/migrations/20261023000000_billing_core.sql#save_hackathon]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.save_hackathon(p_id uuid, p jsonb) | plpgsql | true | search_path="" | authenticated | 20261023000000_billing_core.sql |

## private.save_job_fair(p_id uuid, p jsonb)

[src: supabase/migrations/20261023000000_billing_core.sql#save_job_fair]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.save_job_fair(p_id uuid, p jsonb) | plpgsql | true | search_path="" | authenticated | 20261023000000_billing_core.sql |

## private.uni_entitled(p_university uuid, p_key text)

[src: supabase/migrations/20261023000000_billing_core.sql#uni_entitled]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_entitled(p_university uuid, p_key text) | plpgsql | true | search_path="" | authenticated, service_role | 20261023000000_billing_core.sql |

## private.uni_fairs()

[src: supabase/migrations/20261023000000_billing_core.sql#uni_fairs]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_fairs() | plpgsql | true | search_path="" | authenticated | 20261023000000_billing_core.sql |

## private.uni_hackathons()

[src: supabase/migrations/20261023000000_billing_core.sql#uni_hackathons]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_hackathons() | plpgsql | true | search_path="" | authenticated | 20261023000000_billing_core.sql |

## private.uni_licence_start(p_university uuid)

[src: supabase/migrations/20261023000000_billing_core.sql#uni_licence_start]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_licence_start(p_university uuid) | sql | true | search_path="" | authenticated, service_role | 20261023000000_billing_core.sql |

## private.uni_limit(p_university uuid, p_key text)

[src: supabase/migrations/20261023000000_billing_core.sql#uni_limit]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_limit(p_university uuid, p_key text) | sql | true | search_path="" | authenticated, service_role | 20261023000000_billing_core.sql |

## private.uni_plan(p_university uuid)

[src: supabase/migrations/20261023000000_billing_core.sql#uni_plan]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_plan(p_university uuid) | sql | true | search_path="" | authenticated, service_role | 20261023000000_billing_core.sql |

## public.my_entitlements(p_subject text)

[src: supabase/migrations/20261023000000_billing_core.sql#my_entitlements]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_entitlements(p_subject text) | sql | false | search_path="" | authenticated, service_role | 20261023000000_billing_core.sql |

## public.require_entitlement(p_key text)

[src: supabase/migrations/20261023000000_billing_core.sql#require_entitlement]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.require_entitlement(p_key text) | sql | false | search_path="" | authenticated, service_role | 20261023000000_billing_core.sql |

## public.entitlement_grants

[src: supabase/migrations/20261023000000_billing_core.sql#entitlement_grants]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| subject_type | billing_subject | true | — |  |  | — |
| subject_id | uuid | true | — |  |  | — |
| key | text | true | — |  |  | "default" |
| value | jsonb | true | — |  |  | — |
| source | grant_source | true | — |  |  | — |
| source_id | uuid | false | — |  |  | — |
| starts_at | timestamp with time zone | true | now() |  |  | — |
| ends_at | timestamp with time zone | false | — |  |  | — |
| reason | text | false | — |  |  | "default" |
| consumed | integer | true | 0 |  |  | — |
| notice_sent_at | timestamp with time zone | false | — |  |  | — |
| created_by | uuid | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| revoked_at | timestamp with time zone | false | — |  |  | — |
| revoked_reason | text | false | — |  |  | "default" |

### Keys and constraints

```sql
entitlement_grants_check: CHECK (ends_at IS NULL OR ends_at > starts_at); -- validated: true
```

```sql
entitlement_grants_check1: CHECK (source <> 'admin'::grant_source OR reason IS NOT NULL); -- validated: true
```

```sql
entitlement_grants_check2: CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL)); -- validated: true
```

```sql
entitlement_grants_consumed_check: CHECK (consumed >= 0); -- validated: true
```

```sql
entitlement_grants_created_by_fkey: FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
entitlement_grants_key_fkey: FOREIGN KEY (key) REFERENCES entitlement_keys(key); -- validated: true
```

```sql
entitlement_grants_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
entitlement_grants_reason_check: CHECK (reason IS NULL OR char_length(btrim(reason)) >= 3 AND char_length(btrim(reason)) <= 500); -- validated: true
```

```sql
entitlement_grants_revoked_reason_check: CHECK (revoked_reason IS NULL OR char_length(btrim(revoked_reason)) >= 3 AND char_length(btrim(revoked_reason)) <= 500); -- validated: true
```

### Indexes

```sql
CREATE INDEX entitlement_grants_created_by_idx ON public.entitlement_grants USING btree (created_by); -- valid: true
```

```sql
CREATE INDEX entitlement_grants_key_idx ON public.entitlement_grants USING btree (key); -- valid: true
```

```sql
CREATE UNIQUE INDEX entitlement_grants_pkey ON public.entitlement_grants USING btree (id); -- valid: true
```

```sql
CREATE INDEX entitlement_grants_source_idx ON public.entitlement_grants USING btree (source, source_id); -- valid: true
```

```sql
CREATE INDEX entitlement_grants_subject_idx ON public.entitlement_grants USING btree (subject_type, subject_id, key) WHERE (revoked_at IS NULL); -- valid: true
```

### Policies

None.

### Triggers

```sql
CREATE TRIGGER entitlement_grants_check BEFORE INSERT OR UPDATE OF key, value, subject_type, source ON entitlement_grants FOR EACH ROW EXECUTE FUNCTION private.check_grant(); -- enabled: O
```

## public.entitlement_key_aliases

[src: supabase/migrations/20261023000000_billing_core.sql#entitlement_key_aliases]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| alias | text | true | — |  |  | "default" |
| key | text | true | — |  |  | "default" |

### Keys and constraints

```sql
entitlement_key_aliases_key_fkey: FOREIGN KEY (key) REFERENCES entitlement_keys(key); -- validated: true
```

```sql
entitlement_key_aliases_pkey: PRIMARY KEY (alias); -- validated: true
```

### Indexes

```sql
CREATE INDEX entitlement_key_aliases_key_idx ON public.entitlement_key_aliases USING btree (key); -- valid: true
```

```sql
CREATE UNIQUE INDEX entitlement_key_aliases_pkey ON public.entitlement_key_aliases USING btree (alias); -- valid: true
```

### Policies

#### entitlement_key_aliases.entitlement_key_aliases_read

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

## public.entitlement_keys

[src: supabase/migrations/20261023000000_billing_core.sql#entitlement_keys]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| key | text | true | — |  |  | "default" |
| subject | billing_subject | true | — |  |  | — |
| kind | entitlement_kind | true | — |  |  | — |
| period | text | true | 'none'::text |  |  | "default" |
| free_value | jsonb | true | — |  |  | — |
| levels | text[] | false | — |  |  | "default" |
| label | text | true | — |  |  | "default" |

### Keys and constraints

```sql
entitlement_keys_check: CHECK ((kind = 'enum'::entitlement_kind) = (levels IS NOT NULL)); -- validated: true
```

```sql
entitlement_keys_check1: CHECK ((kind = 'limit'::entitlement_kind) = (period <> 'none'::text)); -- validated: true
```

```sql
entitlement_keys_key_check: CHECK (key ~ '^[a-z][a-z_]*(\.[a-z_]+)+$'::text); -- validated: true
```

```sql
entitlement_keys_label_check: CHECK (char_length(label) >= 2 AND char_length(label) <= 80); -- validated: true
```

```sql
entitlement_keys_period_check: CHECK (period = ANY (ARRAY['none'::text, 'billing_period'::text, 'month'::text, 'quarter'::text, 'licence_year'::text])); -- validated: true
```

```sql
entitlement_keys_pkey: PRIMARY KEY (key); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX entitlement_keys_pkey ON public.entitlement_keys USING btree (key); -- valid: true
```

### Policies

#### entitlement_keys.entitlement_keys_read

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

## public.plans

[src: supabase/migrations/20261023000000_billing_core.sql#plans]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | text | true | — |  |  | "default" |
| audience | billing_subject | true | — |  |  | — |
| tier | text | true | — |  |  | "default" |
| label | text | true | — |  |  | "default" |
| interval | text | true | — |  |  | "default" |
| price_pkr | numeric(12,2) | false | — |  |  | — |
| price_usd | numeric(12,2) | false | — |  |  | — |
| grants | jsonb | true | — |  |  | — |
| self_serve | boolean | true | false |  |  | — |
| active | boolean | true | true |  |  | — |
| position | smallint | true | 0 |  |  | — |

### Keys and constraints

```sql
plans_grants_check: CHECK (jsonb_typeof(grants) = 'object'::text); -- validated: true
```

```sql
plans_id_check: CHECK (id ~ '^[a-z][a-z0-9_]{2,60}$'::text); -- validated: true
```

```sql
plans_interval_check: CHECK ("interval" = ANY (ARRAY['month'::text, 'year'::text])); -- validated: true
```

```sql
plans_label_check: CHECK (char_length(label) >= 2 AND char_length(label) <= 60); -- validated: true
```

```sql
plans_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
plans_price_pkr_check: CHECK (price_pkr IS NULL OR price_pkr > 0::numeric); -- validated: true
```

```sql
plans_price_usd_check: CHECK (price_usd IS NULL OR price_usd > 0::numeric); -- validated: true
```

```sql
plans_tier_check: CHECK (tier ~ '^[a-z]{3,20}$'::text); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX plans_pkey ON public.plans USING btree (id); -- valid: true
```

### Policies

#### plans.plans_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "active",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.

## public.trial_claims

[src: supabase/migrations/20261023000000_billing_core.sql#trial_claims]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| claimed_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
trial_claims_pkey: PRIMARY KEY (user_id); -- validated: true
```

```sql
trial_claims_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX trial_claims_pkey ON public.trial_claims USING btree (user_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.usage_counters

[src: supabase/migrations/20261023000000_billing_core.sql#usage_counters]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| subject_type | billing_subject | true | — |  |  | — |
| subject_id | uuid | true | — |  |  | — |
| key | text | true | — |  |  | "default" |
| period_start | timestamp with time zone | true | — |  |  | — |
| used | integer | true | 0 |  |  | — |

### Keys and constraints

```sql
usage_counters_key_fkey: FOREIGN KEY (key) REFERENCES entitlement_keys(key); -- validated: true
```

```sql
usage_counters_pkey: PRIMARY KEY (subject_type, subject_id, key, period_start); -- validated: true
```

```sql
usage_counters_used_check: CHECK (used >= 0); -- validated: true
```

### Indexes

```sql
CREATE INDEX usage_counters_key_idx ON public.usage_counters USING btree (key); -- valid: true
```

```sql
CREATE UNIQUE INDEX usage_counters_pkey ON public.usage_counters USING btree (subject_type, subject_id, key, period_start); -- valid: true
```

### Policies

None.

### Triggers

None.
