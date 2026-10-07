Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# alerts

## private.alert_conditions()

[src: supabase/migrations/20261105000000_alerts.sql#alert_conditions]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.alert_conditions() | plpgsql | true | search_path="" | None | 20261105000000_alerts.sql |

## private.alert_limit(p_name text)

[src: supabase/migrations/20261105000000_alerts.sql#alert_limit]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.alert_limit(p_name text) | sql | true | search_path="" | None | 20261105000000_alerts.sql |

## private.job_watchdog()

[src: supabase/migrations/20261105000000_alerts.sql#job_watchdog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.job_watchdog() | plpgsql | true | search_path="" | None | 20261105000000_alerts.sql |

## private.purge_monitoring()

[src: supabase/migrations/20261105000000_alerts.sql#purge_monitoring]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.purge_monitoring() | sql | true | search_path="" | None | 20261105000000_alerts.sql |

## private.queue_alert_email(p_key text, p_state text, p_title text, p_detail text, p_since timestamp with time zone)

[src: supabase/migrations/20261105000000_alerts.sql#queue_alert_email]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.queue_alert_email(p_key text, p_state text, p_title text, p_detail text, p_since timestamp with time zone) | sql | true | search_path="" | None | 20261105000000_alerts.sql |

## private.record_service_signal(p_kind text, p_value numeric)

[src: supabase/migrations/20261105000000_alerts.sql#record_service_signal]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.record_service_signal(p_kind text, p_value numeric) | sql | true | search_path="" | service_role | 20261105000000_alerts.sql |

## private.record_web_vitals(p_route text, p_metrics jsonb)

[src: supabase/migrations/20261105000000_alerts.sql#record_web_vitals]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.record_web_vitals(p_route text, p_metrics jsonb) | plpgsql | true | search_path="" | anon, authenticated | 20261105000000_alerts.sql |

## public.record_service_signal(p_kind text, p_value numeric)

[src: supabase/migrations/20261105000000_alerts.sql#record_service_signal]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.record_service_signal(p_kind text, p_value numeric) | sql | false | search_path="" | service_role | 20261105000000_alerts.sql |

## public.record_web_vitals(p_route text, p_metrics jsonb)

[src: supabase/migrations/20261105000000_alerts.sql#record_web_vitals]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.record_web_vitals(p_route text, p_metrics jsonb) | sql | false | search_path="" | anon, authenticated, service_role | 20261105000000_alerts.sql |

## private.alert_state

[src: supabase/migrations/20261105000000_alerts.sql#alert_state]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| key | text | true | — |  |  | "default" |
| title | text | true | — |  |  | "default" |
| detail | text | true | — |  |  | "default" |
| first_seen_at | timestamp with time zone | true | now() |  |  | — |
| last_seen_at | timestamp with time zone | true | now() |  |  | — |
| last_sent_at | timestamp with time zone | false | — |  |  | — |
| resolved_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
alert_state_key_check: CHECK (key ~ '^[a-z0-9_:.-]{3,120}$'::text); -- validated: true
```

```sql
alert_state_pkey: PRIMARY KEY (key); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX alert_state_pkey ON private.alert_state USING btree (key); -- valid: true
```

### Policies

None.

### Triggers

None.

## private.service_signals

[src: supabase/migrations/20261105000000_alerts.sql#service_signals]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint | true | — | a |  | — |
| kind | text | true | — |  |  | "default" |
| value | numeric | true | 1 |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
service_signals_kind_check: CHECK (kind = ANY (ARRAY['billing_webhook_rejected'::text, 'billing_webhook_error'::text, 'email_delivered'::text, 'email_bounced'::text, 'github_headroom'::text])); -- validated: true
```

```sql
service_signals_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
service_signals_value_check: CHECK (value >= 0::numeric); -- validated: true
```

### Indexes

```sql
CREATE INDEX service_signals_kind_created_idx ON private.service_signals USING btree (kind, created_at DESC); -- valid: true
```

```sql
CREATE UNIQUE INDEX service_signals_pkey ON private.service_signals USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

None.

## private.web_vitals

[src: supabase/migrations/20261105000000_alerts.sql#web_vitals]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint | true | — | a |  | — |
| route | text | true | — |  |  | "default" |
| metric | text | true | — |  |  | "default" |
| value | numeric | true | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
web_vitals_metric_check: CHECK (metric = ANY (ARRAY['LCP'::text, 'INP'::text, 'CLS'::text])); -- validated: true
```

```sql
web_vitals_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
web_vitals_route_check: CHECK (route ~ '^/[A-Za-z0-9/:_.-]{0,120}$'::text); -- validated: true
```

```sql
web_vitals_value_check: CHECK (value >= 0::numeric AND value < 600000::numeric); -- validated: true
```

### Indexes

```sql
CREATE INDEX web_vitals_metric_created_idx ON private.web_vitals USING btree (metric, created_at DESC); -- valid: true
```

```sql
CREATE UNIQUE INDEX web_vitals_pkey ON private.web_vitals USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

None.
