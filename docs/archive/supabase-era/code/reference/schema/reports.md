Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# reports

## private.appropriate_signal()

[src: supabase/migrations/20260929070000_reports.sql#appropriate_signal]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.appropriate_signal() | plpgsql | true | search_path="" | None | 20260929070000_reports.sql |

## private.can_report(p_type report_target, p_target uuid)

[src: supabase/migrations/20260929070000_reports.sql#can_report]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.can_report(p_type report_target, p_target uuid) | sql | true | search_path="" | authenticated | 20260929070000_reports.sql |

## private.claim_case(p_case uuid, p_claim boolean)

[src: supabase/migrations/20260929070000_reports.sql#claim_case]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.claim_case(p_case uuid, p_claim boolean) | plpgsql | true | search_path="" | authenticated | 20260929070000_reports.sql |

## private.get_profile_card(p_username text)

[src: supabase/migrations/20260929070000_reports.sql#get_profile_card]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.get_profile_card(p_username text) | sql | true | search_path="" | authenticated | 20260929070000_reports.sql |

## private.open_case(p_type report_target, p_target uuid, p_owner uuid, p_snapshot jsonb, p_report boolean, p_soft boolean)

[src: supabase/migrations/20260929070000_reports.sql#open_case]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.open_case(p_type report_target, p_target uuid, p_owner uuid, p_snapshot jsonb, p_report boolean, p_soft boolean) | plpgsql | true | search_path="" | None | 20260929070000_reports.sql |

## private.ops_case(p_case uuid)

[src: supabase/migrations/20260929070000_reports.sql#ops_case]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_case(p_case uuid) | plpgsql | true | search_path="" | authenticated | 20260929070000_reports.sql |

## private.ops_queue(p_status text)

[src: supabase/migrations/20260929070000_reports.sql#ops_queue]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_queue(p_status text) | plpgsql | true | search_path="" | authenticated | 20260929070000_reports.sql |

## private.report_snapshot(p_type report_target, p_target uuid)

[src: supabase/migrations/20260929070000_reports.sql#report_snapshot]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.report_snapshot(p_type report_target, p_target uuid) | sql | true | search_path="" | None | 20260929070000_reports.sql |

## private.require_moderator()

[src: supabase/migrations/20260929070000_reports.sql#require_moderator]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.require_moderator() | plpgsql | true | search_path="" | authenticated | 20260929070000_reports.sql |

## private.submit_report(p_type report_target, p_target uuid, p_reason report_reason, p_detail text, p_messages uuid[])

[src: supabase/migrations/20260929070000_reports.sql#submit_report]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.submit_report(p_type report_target, p_target uuid, p_reason report_reason, p_detail text, p_messages uuid[]) | plpgsql | true | search_path="" | authenticated | 20260929070000_reports.sql |

## public.claim_case(p_case uuid, p_claim boolean)

[src: supabase/migrations/20260929070000_reports.sql#claim_case]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.claim_case(p_case uuid, p_claim boolean) | sql | false | search_path="" | authenticated, service_role | 20260929070000_reports.sql |

## public.get_profile_card(p_username text)

[src: supabase/migrations/20260929070000_reports.sql#get_profile_card]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.get_profile_card(p_username text) | sql | false | search_path="" | authenticated, service_role | 20260929070000_reports.sql |

## public.ops_case(p_case uuid)

[src: supabase/migrations/20260929070000_reports.sql#ops_case]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_case(p_case uuid) | sql | false | search_path="" | authenticated, service_role | 20260929070000_reports.sql |

## public.ops_queue(p_status text)

[src: supabase/migrations/20260929070000_reports.sql#ops_queue]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_queue(p_status text) | sql | false | search_path="" | authenticated, service_role | 20260929070000_reports.sql |

## public.submit_report(p_type report_target, p_target uuid, p_reason report_reason, p_detail text, p_messages uuid[])

[src: supabase/migrations/20260929070000_reports.sql#submit_report]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.submit_report(p_type report_target, p_target uuid, p_reason report_reason, p_detail text, p_messages uuid[]) | sql | false | search_path="" | authenticated, service_role | 20260929070000_reports.sql |

## public.report_cases

[src: supabase/migrations/20260929070000_reports.sql#report_cases]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| target_type | report_target | true | — |  |  | — |
| target_id | uuid | true | — |  |  | — |
| owner_id | uuid | false | — |  |  | — |
| snapshot | jsonb | true | '{}'::jsonb |  |  | — |
| reports | integer | true | 0 |  |  | — |
| soft_signal | boolean | true | false |  |  | — |
| status | report_case_status | true | 'open'::report_case_status |  |  | — |
| claimed_by | uuid | false | — |  |  | — |
| claimed_at | timestamp with time zone | false | — |  |  | — |
| resolved_by | uuid | false | — |  |  | — |
| resolved_at | timestamp with time zone | false | — |  |  | — |
| resolution_reason | text | false | — |  |  | "default" |
| opened_at | timestamp with time zone | true | now() |  |  | — |
| last_reported_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
report_cases_check: CHECK ((status = 'open'::report_case_status) = (resolved_at IS NULL)); -- validated: true
```

```sql
report_cases_claimed_by_fkey: FOREIGN KEY (claimed_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
report_cases_owner_id_fkey: FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
report_cases_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
report_cases_reports_check: CHECK (reports >= 0); -- validated: true
```

```sql
report_cases_resolution_reason_check: CHECK (resolution_reason IS NULL OR char_length(resolution_reason) <= 2000); -- validated: true
```

```sql
report_cases_resolved_by_fkey: FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
report_cases_target_type_target_id_key: UNIQUE (target_type, target_id); -- validated: true
```

### Indexes

```sql
CREATE INDEX report_cases_claimed_by_idx ON public.report_cases USING btree (claimed_by); -- valid: true
```

```sql
CREATE INDEX report_cases_owner_idx ON public.report_cases USING btree (owner_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX report_cases_pkey ON public.report_cases USING btree (id); -- valid: true
```

```sql
CREATE INDEX report_cases_queue_idx ON public.report_cases USING btree (status, opened_at); -- valid: true
```

```sql
CREATE INDEX report_cases_resolved_by_idx ON public.report_cases USING btree (resolved_by); -- valid: true
```

```sql
CREATE UNIQUE INDEX report_cases_target_type_target_id_key ON public.report_cases USING btree (target_type, target_id); -- valid: true
```

### Policies

#### report_cases.report_cases_staff_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "( SELECT private.is_staff('moderator'::staff_role) AS is_staff)",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER report_cases_university_hide AFTER UPDATE OF status ON report_cases FOR EACH ROW EXECUTE FUNCTION private.university_hide_decided(); -- enabled: O
```

## public.report_messages

[src: supabase/migrations/20260929070000_reports.sql#report_messages]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| report_id | uuid | true | — |  |  | — |
| message_id | uuid | true | — |  |  | — |
| sender_id | uuid | false | — |  |  | — |
| body | text | true | — |  |  | "default" |
| had_image | boolean | true | false |  |  | — |
| sent_at | timestamp with time zone | true | — |  |  | — |
| is_reported | boolean | true | false |  |  | — |

### Keys and constraints

```sql
report_messages_pkey: PRIMARY KEY (report_id, message_id); -- validated: true
```

```sql
report_messages_report_id_fkey: FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE; -- validated: true
```

```sql
report_messages_sender_id_fkey: FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX report_messages_pkey ON public.report_messages USING btree (report_id, message_id); -- valid: true
```

```sql
CREATE INDEX report_messages_sender_idx ON public.report_messages USING btree (sender_id); -- valid: true
```

### Policies

#### report_messages.report_messages_staff_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "( SELECT private.is_staff('moderator'::staff_role) AS is_staff)",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.

## public.reports

[src: supabase/migrations/20260929070000_reports.sql#reports]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| case_id | uuid | true | — |  |  | — |
| reporter_id | uuid | true | — |  |  | — |
| target_type | report_target | true | — |  |  | — |
| target_id | uuid | true | — |  |  | — |
| reason | report_reason | true | — |  |  | — |
| detail | text | false | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
reports_case_id_fkey: FOREIGN KEY (case_id) REFERENCES report_cases(id) ON DELETE CASCADE; -- validated: true
```

```sql
reports_detail_check: CHECK (detail IS NULL OR char_length(detail) <= 500); -- validated: true
```

```sql
reports_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
reports_reporter_id_fkey: FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
reports_reporter_id_target_type_target_id_key: UNIQUE (reporter_id, target_type, target_id); -- validated: true
```

### Indexes

```sql
CREATE INDEX reports_case_idx ON public.reports USING btree (case_id, created_at); -- valid: true
```

```sql
CREATE UNIQUE INDEX reports_pkey ON public.reports USING btree (id); -- valid: true
```

```sql
CREATE UNIQUE INDEX reports_reporter_id_target_type_target_id_key ON public.reports USING btree (reporter_id, target_type, target_id); -- valid: true
```

### Policies

#### reports.reports_staff_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "( SELECT private.is_staff('moderator'::staff_role) AS is_staff)",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.

## public.sanctions

[src: supabase/migrations/20260929070000_reports.sql#sanctions]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| user_id | uuid | false | — |  |  | — |
| kind | sanction_kind | true | — |  |  | — |
| until | timestamp with time zone | false | — |  |  | — |
| reason | text | true | — |  |  | "default" |
| staff_id | uuid | true | — |  |  | — |
| case_id | uuid | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| org_id | uuid | false | — |  |  | — |
| per_day | integer | false | — |  |  | — |
| lifted_at | timestamp with time zone | false | — |  |  | — |
| lifted_by | uuid | false | — |  |  | — |
| lift_reason | text | false | — |  |  | "default" |

### Keys and constraints

```sql
sanctions_case_id_fkey: FOREIGN KEY (case_id) REFERENCES report_cases(id) ON DELETE SET NULL; -- validated: true
```

```sql
sanctions_kind_fits_subject: CHECK (
CASE
    WHEN org_id IS NOT NULL THEN kind = ANY (ARRAY['warn'::sanction_kind, 'throttle'::sanction_kind, 'suspend'::sanction_kind])
    ELSE kind = ANY (ARRAY['warn'::sanction_kind, 'suspend'::sanction_kind, 'ban'::sanction_kind])
END); -- validated: true
```

```sql
sanctions_lift_reason: CHECK ((lifted_at IS NULL) = (lift_reason IS NULL)); -- validated: true
```

```sql
sanctions_lift_reason_check: CHECK (lift_reason IS NULL OR char_length(btrim(lift_reason)) >= 3 AND char_length(btrim(lift_reason)) <= 2000); -- validated: true
```

```sql
sanctions_lifted_by_fkey: FOREIGN KEY (lifted_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
sanctions_one_subject: CHECK ((user_id IS NULL) <> (org_id IS NULL)); -- validated: true
```

```sql
sanctions_org_id_fkey: FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE; -- validated: true
```

```sql
sanctions_per_day_check: CHECK (per_day IS NULL OR per_day >= 1 AND per_day <= 50); -- validated: true
```

```sql
sanctions_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
sanctions_reason_check: CHECK (char_length(btrim(reason)) >= 3 AND char_length(btrim(reason)) <= 2000); -- validated: true
```

```sql
sanctions_staff_id_fkey: FOREIGN KEY (staff_id) REFERENCES auth.users(id) ON DELETE RESTRICT; -- validated: true
```

```sql
sanctions_throttle_per_day: CHECK ((kind = 'throttle'::sanction_kind) = (per_day IS NOT NULL)); -- validated: true
```

```sql
sanctions_throttle_until: CHECK (kind <> 'throttle'::sanction_kind OR until IS NOT NULL); -- validated: true
```

```sql
sanctions_until_after_start: CHECK (until IS NULL OR until > created_at); -- validated: true
```

```sql
sanctions_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
sanctions_user_suspend_until: CHECK (kind <> 'suspend'::sanction_kind OR org_id IS NOT NULL OR until IS NOT NULL); -- validated: true
```

### Indexes

```sql
CREATE INDEX sanctions_active_user_idx ON public.sanctions USING btree (user_id) WHERE ((lifted_at IS NULL) AND (kind = ANY (ARRAY['suspend'::sanction_kind, 'ban'::sanction_kind]))); -- valid: true
```

```sql
CREATE INDEX sanctions_case_idx ON public.sanctions USING btree (case_id); -- valid: true
```

```sql
CREATE INDEX sanctions_lifted_by_idx ON public.sanctions USING btree (lifted_by) WHERE (lifted_by IS NOT NULL); -- valid: true
```

```sql
CREATE INDEX sanctions_org_idx ON public.sanctions USING btree (org_id, created_at DESC) WHERE (org_id IS NOT NULL); -- valid: true
```

```sql
CREATE UNIQUE INDEX sanctions_pkey ON public.sanctions USING btree (id); -- valid: true
```

```sql
CREATE INDEX sanctions_staff_idx ON public.sanctions USING btree (staff_id); -- valid: true
```

```sql
CREATE INDEX sanctions_user_idx ON public.sanctions USING btree (user_id, created_at DESC); -- valid: true
```

### Policies

#### sanctions.sanctions_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_staff('moderator'::staff_role) AS is_staff))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER sanctions_role_limits BEFORE INSERT OR UPDATE ON sanctions FOR EACH ROW EXECUTE FUNCTION private.sanctions_role_limits(); -- enabled: O
```
