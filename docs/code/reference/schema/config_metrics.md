Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# config_metrics

## private.ops_config_history(p_key text)

[src: supabase/migrations/20261029000000_config_metrics.sql#ops_config_history]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_config_history(p_key text) | plpgsql | true | search_path="" | authenticated | 20261029000000_config_metrics.sql |

## private.ops_config_keys()

[src: supabase/migrations/20261029000000_config_metrics.sql#ops_config_keys]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_config_keys() | plpgsql | true | search_path="" | authenticated | 20261029000000_config_metrics.sql |

## private.ops_edit_skill(p_action text, p_id text, p_name text, p_category text, p_parent text, p_reason text)

[src: supabase/migrations/20261029000000_config_metrics.sql#ops_edit_skill]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_edit_skill(p_action text, p_id text, p_name text, p_category text, p_parent text, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261029000000_config_metrics.sql |

## private.ops_metrics()

[src: supabase/migrations/20261029000000_config_metrics.sql#ops_metrics]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_metrics() | plpgsql | true | search_path="" | authenticated | 20261029000000_config_metrics.sql |

## private.ops_plan_history(p_plan text)

[src: supabase/migrations/20261029000000_config_metrics.sql#ops_plan_history]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_plan_history(p_plan text) | plpgsql | true | search_path="" | authenticated | 20261029000000_config_metrics.sql |

## private.ops_plans()

[src: supabase/migrations/20261029000000_config_metrics.sql#ops_plans]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_plans() | plpgsql | true | search_path="" | authenticated | 20261029000000_config_metrics.sql |

## private.ops_set_config(p_key text, p_value jsonb, p_reason text, p_expected integer)

[src: supabase/migrations/20261029000000_config_metrics.sql#ops_set_config]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_set_config(p_key text, p_value jsonb, p_reason text, p_expected integer) | plpgsql | true | search_path="" | authenticated | 20261029000000_config_metrics.sql |

## private.ops_set_plan_price(p_plan text, p_price_pkr numeric, p_price_usd numeric, p_reason text)

[src: supabase/migrations/20261029000000_config_metrics.sql#ops_set_plan_price]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_set_plan_price(p_plan text, p_price_pkr numeric, p_price_usd numeric, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261029000000_config_metrics.sql |

## private.ops_skills()

[src: supabase/migrations/20261029000000_config_metrics.sql#ops_skills]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_skills() | plpgsql | true | search_path="" | authenticated | 20261029000000_config_metrics.sql |

## private.refresh_ops_metrics()

[src: supabase/migrations/20261029000000_config_metrics.sql#refresh_ops_metrics]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.refresh_ops_metrics() | plpgsql | true | search_path="" | None | 20261029000000_config_metrics.sql |

## public.ops_config_history(p_key text)

[src: supabase/migrations/20261029000000_config_metrics.sql#ops_config_history]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_config_history(p_key text) | sql | false | search_path="" | authenticated, service_role | 20261029000000_config_metrics.sql |

## public.ops_config_keys()

[src: supabase/migrations/20261029000000_config_metrics.sql#ops_config_keys]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_config_keys() | sql | false | search_path="" | authenticated, service_role | 20261029000000_config_metrics.sql |

## public.ops_edit_skill(p_action text, p_id text, p_name text, p_category text, p_parent text, p_reason text)

[src: supabase/migrations/20261029000000_config_metrics.sql#ops_edit_skill]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_edit_skill(p_action text, p_id text, p_name text, p_category text, p_parent text, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261029000000_config_metrics.sql |

## public.ops_metrics()

[src: supabase/migrations/20261029000000_config_metrics.sql#ops_metrics]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_metrics() | sql | false | search_path="" | authenticated, service_role | 20261029000000_config_metrics.sql |

## public.ops_plan_history(p_plan text)

[src: supabase/migrations/20261029000000_config_metrics.sql#ops_plan_history]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_plan_history(p_plan text) | sql | false | search_path="" | authenticated, service_role | 20261029000000_config_metrics.sql |

## public.ops_plans()

[src: supabase/migrations/20261029000000_config_metrics.sql#ops_plans]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_plans() | sql | false | search_path="" | authenticated, service_role | 20261029000000_config_metrics.sql |

## public.ops_set_config(p_key text, p_value jsonb, p_reason text, p_expected integer)

[src: supabase/migrations/20261029000000_config_metrics.sql#ops_set_config]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_set_config(p_key text, p_value jsonb, p_reason text, p_expected integer) | sql | false | search_path="" | authenticated, service_role | 20261029000000_config_metrics.sql |

## public.ops_set_plan_price(p_plan text, p_price_pkr numeric, p_price_usd numeric, p_reason text)

[src: supabase/migrations/20261029000000_config_metrics.sql#ops_set_plan_price]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_set_plan_price(p_plan text, p_price_pkr numeric, p_price_usd numeric, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261029000000_config_metrics.sql |

## public.ops_skills()

[src: supabase/migrations/20261029000000_config_metrics.sql#ops_skills]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_skills() | sql | false | search_path="" | authenticated, service_role | 20261029000000_config_metrics.sql |

## private.ops_metric_snapshots

[src: supabase/migrations/20261029000000_config_metrics.sql#ops_metric_snapshots]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| taken_at | timestamp with time zone | true | — |  |  | — |
| metric | text | true | — |  |  | "default" |
| label | text | true | — |  |  | "default" |
| value | integer | true | — |  |  | — |

### Keys and constraints

```sql
ops_metric_snapshots_label_check: CHECK (char_length(label) >= 1 AND char_length(label) <= 120); -- validated: true
```

```sql
ops_metric_snapshots_metric_check: CHECK (metric = ANY (ARRAY['weekly_actives'::text, 'backlog'::text])); -- validated: true
```

```sql
ops_metric_snapshots_pkey: PRIMARY KEY (metric, taken_at, label); -- validated: true
```

```sql
ops_metric_snapshots_value_check: CHECK (value >= 0); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX ops_metric_snapshots_pkey ON private.ops_metric_snapshots USING btree (metric, taken_at, label); -- valid: true
```

```sql
CREATE INDEX ops_metric_snapshots_recent_idx ON private.ops_metric_snapshots USING btree (metric, taken_at DESC); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.config_keys

[src: supabase/migrations/20261029000000_config_metrics.sql#config_keys]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| key | text | true | — |  |  | "default" |
| area | text | true | — |  |  | "default" |
| description | text | true | — |  |  | "default" |
| applies | text | true | — |  |  | "default" |
| schema | jsonb | true | — |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
config_keys_applies_check: CHECK (applies = ANY (ARRAY['now'::text, 'next_nightly'::text])); -- validated: true
```

```sql
config_keys_area_check: CHECK (area ~ '^[a-z_]{2,30}$'::text); -- validated: true
```

```sql
config_keys_description_check: CHECK (char_length(description) >= 3 AND char_length(description) <= 300); -- validated: true
```

```sql
config_keys_key_check: CHECK (key ~ '^[a-z][a-z0-9_.]{1,80}$'::text); -- validated: true
```

```sql
config_keys_pkey: PRIMARY KEY (key); -- validated: true
```

```sql
config_keys_schema_check: CHECK (jsonb_typeof(schema) = 'object'::text); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX config_keys_pkey ON public.config_keys USING btree (key); -- valid: true
```

### Policies

#### config_keys.config_keys_staff_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "( SELECT private.is_staff() AS is_staff)",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.
