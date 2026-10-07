Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# marketing_leads

## private.ops_sales_leads()

[src: supabase/migrations/20261101000000_marketing_leads.sql#ops_sales_leads]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_sales_leads() | plpgsql | true | search_path="" | authenticated | 20261101000000_marketing_leads.sql |

## private.ops_update_sales_lead(p_id uuid, p_status sales_lead_status, p_note text)

[src: supabase/migrations/20261101000000_marketing_leads.sql#ops_update_sales_lead]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_update_sales_lead(p_id uuid, p_status sales_lead_status, p_note text) | plpgsql | true | search_path="" | authenticated | 20261101000000_marketing_leads.sql |

## private.public_pricing_extras()

[src: supabase/migrations/20261101000000_marketing_leads.sql#public_pricing_extras]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.public_pricing_extras() | sql | true | search_path="" | anon, authenticated | 20261101000000_marketing_leads.sql |

## private.submit_sales_lead(p_name text, p_role text, p_organisation text, p_email text, p_message text)

[src: supabase/migrations/20261101000000_marketing_leads.sql#submit_sales_lead]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.submit_sales_lead(p_name text, p_role text, p_organisation text, p_email text, p_message text) | plpgsql | true | search_path="" | anon, authenticated | 20261101000000_marketing_leads.sql |

## public.ops_sales_leads()

[src: supabase/migrations/20261101000000_marketing_leads.sql#ops_sales_leads]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_sales_leads() | sql | false | search_path="" | authenticated, service_role | 20261101000000_marketing_leads.sql |

## public.ops_update_sales_lead(p_id uuid, p_status sales_lead_status, p_note text)

[src: supabase/migrations/20261101000000_marketing_leads.sql#ops_update_sales_lead]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_update_sales_lead(p_id uuid, p_status sales_lead_status, p_note text) | sql | false | search_path="" | authenticated, service_role | 20261101000000_marketing_leads.sql |

## public.public_pricing_extras()

[src: supabase/migrations/20261101000000_marketing_leads.sql#public_pricing_extras]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.public_pricing_extras() | sql | false | search_path="" | anon, authenticated, service_role | 20261101000000_marketing_leads.sql |

## public.submit_sales_lead(p_name text, p_role text, p_organisation text, p_email text, p_message text)

[src: supabase/migrations/20261101000000_marketing_leads.sql#submit_sales_lead]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.submit_sales_lead(p_name text, p_role text, p_organisation text, p_email text, p_message text) | sql | false | search_path="" | anon, authenticated, service_role | 20261101000000_marketing_leads.sql |

## public.sales_leads

[src: supabase/migrations/20261101000000_marketing_leads.sql#sales_leads]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| kind | text | true | 'university'::text |  |  | "default" |
| name | text | true | — |  |  | "default" |
| role | text | true | — |  |  | "default" |
| organisation | text | true | — |  |  | "default" |
| university_id | uuid | false | — |  |  | — |
| email | text | true | — |  |  | "default" |
| message | text | true | — |  |  | "default" |
| status | sales_lead_status | true | 'new'::sales_lead_status |  |  | — |
| claimed_by | uuid | false | — |  |  | — |
| staff_note | text | false | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
sales_leads_claimed_by_fkey: FOREIGN KEY (claimed_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
sales_leads_email_check: CHECK (char_length(email) >= 6 AND char_length(email) <= 254 AND email = lower(email) AND email ~ '^[^\s@]+@[^\s@]+$'::text); -- validated: true
```

```sql
sales_leads_kind_check: CHECK (kind = 'university'::text); -- validated: true
```

```sql
sales_leads_message_check: CHECK (char_length(btrim(message)) >= 10 AND char_length(btrim(message)) <= 2000); -- validated: true
```

```sql
sales_leads_name_check: CHECK (char_length(btrim(name)) >= 2 AND char_length(btrim(name)) <= 80); -- validated: true
```

```sql
sales_leads_organisation_check: CHECK (char_length(btrim(organisation)) >= 2 AND char_length(btrim(organisation)) <= 200); -- validated: true
```

```sql
sales_leads_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
sales_leads_role_check: CHECK (char_length(btrim(role)) >= 2 AND char_length(btrim(role)) <= 80); -- validated: true
```

```sql
sales_leads_staff_note_check: CHECK (staff_note IS NULL OR char_length(staff_note) <= 2000); -- validated: true
```

```sql
sales_leads_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE SET NULL; -- validated: true
```

### Indexes

```sql
CREATE INDEX sales_leads_claimed_by_idx ON public.sales_leads USING btree (claimed_by) WHERE (claimed_by IS NOT NULL); -- valid: true
```

```sql
CREATE UNIQUE INDEX sales_leads_pkey ON public.sales_leads USING btree (id); -- valid: true
```

```sql
CREATE INDEX sales_leads_queue_idx ON public.sales_leads USING btree (status, created_at DESC); -- valid: true
```

```sql
CREATE INDEX sales_leads_university_idx ON public.sales_leads USING btree (university_id) WHERE (university_id IS NOT NULL); -- valid: true
```

### Policies

None.

### Triggers

```sql
CREATE TRIGGER sales_leads_set_updated_at BEFORE UPDATE ON sales_leads FOR EACH ROW EXECUTE FUNCTION private.set_updated_at(); -- enabled: O
```
