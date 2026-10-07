Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# sanctions_appeals

## private.active_restriction(p_user uuid)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#active_restriction]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.active_restriction(p_user uuid) | sql | true | search_path="" | None | 20261027000000_sanctions_appeals.sql |

## private.appeal_subject(p_type appeal_decision_type, p_id uuid)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#appeal_subject]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.appeal_subject(p_type appeal_decision_type, p_id uuid) | plpgsql | true | search_path="" | None | 20261027000000_sanctions_appeals.sql |

## private.appeals_guard()

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#appeals_guard]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.appeals_guard() | plpgsql | false | search_path="" | None | 20261027000000_sanctions_appeals.sql |

## private.claim_appeal(p_id uuid, p_claim boolean)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#claim_appeal]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.claim_appeal(p_id uuid, p_claim boolean) | plpgsql | true | search_path="" | authenticated | 20261027000000_sanctions_appeals.sql |

## private.decide_appeal(p_id uuid, p_outcome text, p_reason text)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#decide_appeal]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.decide_appeal(p_id uuid, p_outcome text, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261027000000_sanctions_appeals.sql |

## private.file_appeal(p_type appeal_decision_type, p_id uuid, p_body text, p_appellant uuid, p_filed_by uuid)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#file_appeal]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.file_appeal(p_type appeal_decision_type, p_id uuid, p_body text, p_appellant uuid, p_filed_by uuid) | plpgsql | true | search_path="" | None | 20261027000000_sanctions_appeals.sql |

## private.lift_sanction(p_id uuid, p_reason text)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#lift_sanction]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.lift_sanction(p_id uuid, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261027000000_sanctions_appeals.sql |

## private.lift_sanction_row(p_id uuid, p_staff uuid, p_reason text)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#lift_sanction_row]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.lift_sanction_row(p_id uuid, p_staff uuid, p_reason text) | plpgsql | true | search_path="" | None | 20261027000000_sanctions_appeals.sql |

## private.my_appealable()

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#my_appealable]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_appealable() | sql | true | search_path="" | authenticated | 20261027000000_sanctions_appeals.sql |

## private.my_appeals()

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#my_appeals]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_appeals() | sql | true | search_path="" | authenticated | 20261027000000_sanctions_appeals.sql |

## private.my_restriction()

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#my_restriction]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_restriction() | sql | true | search_path="" | authenticated | 20261027000000_sanctions_appeals.sql |

## private.ops_appeal_case(p_id uuid)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#ops_appeal_case]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_appeal_case(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261027000000_sanctions_appeals.sql |

## private.ops_appeals(p_open boolean)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#ops_appeals]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_appeals(p_open boolean) | plpgsql | true | search_path="" | authenticated | 20261027000000_sanctions_appeals.sql |

## private.ops_case_owner(p_case uuid)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#ops_case_owner]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_case_owner(p_case uuid) | plpgsql | true | search_path="" | authenticated | 20261027000000_sanctions_appeals.sql |

## private.ops_file_appeal(p_type text, p_id uuid, p_body text, p_reason text)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#ops_file_appeal]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_file_appeal(p_type text, p_id uuid, p_body text, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261027000000_sanctions_appeals.sql |

## private.ops_find_account(p_query text)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#ops_find_account]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_find_account(p_query text) | plpgsql | true | search_path="" | authenticated | 20261027000000_sanctions_appeals.sql |

## private.ops_inbox(p_queue text)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#ops_inbox]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_inbox(p_queue text) | plpgsql | true | search_path="" | authenticated | 20261027000000_sanctions_appeals.sql |

## private.ops_sanctions(p_active boolean)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#ops_sanctions]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_sanctions(p_active boolean) | plpgsql | true | search_path="" | authenticated | 20261027000000_sanctions_appeals.sql |

## private.org_throttle_check()

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#org_throttle_check]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.org_throttle_check() | plpgsql | true | search_path="" | None | 20261027000000_sanctions_appeals.sql |

## private.overturn_decision(a appeals, p_staff uuid, p_reason text)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#overturn_decision]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.overturn_decision(a appeals, p_staff uuid, p_reason text) | plpgsql | true | search_path="" | None | 20261027000000_sanctions_appeals.sql |

## private.refuse_if_restricted()

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#refuse_if_restricted]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.refuse_if_restricted() | plpgsql | true | search_path="" | None | 20261027000000_sanctions_appeals.sql |

## private.require_appeal_decider(a appeals)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#require_appeal_decider]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.require_appeal_decider(a appeals) | plpgsql | true | search_path="" | None | 20261027000000_sanctions_appeals.sql |

## private.sanction_json(s sanctions)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#sanction_json]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.sanction_json(s sanctions) | sql | false | search_path="" | None | 20261027000000_sanctions_appeals.sql |

## private.sanction_org(p_org uuid, p_kind text, p_until timestamp with time zone, p_per_day integer, p_reason text)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#sanction_org]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.sanction_org(p_org uuid, p_kind text, p_until timestamp with time zone, p_per_day integer, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261027000000_sanctions_appeals.sql |

## private.sanction_user(p_user uuid, p_kind text, p_until timestamp with time zone, p_reason text, p_case uuid)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#sanction_user]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.sanction_user(p_user uuid, p_kind text, p_until timestamp with time zone, p_reason text, p_case uuid) | plpgsql | true | search_path="" | authenticated | 20261027000000_sanctions_appeals.sql |

## private.sanctions_role_limits()

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#sanctions_role_limits]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.sanctions_role_limits() | plpgsql | true | search_path="" | None | 20261027000000_sanctions_appeals.sql |

## private.submit_appeal(p_type text, p_id uuid, p_body text)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#submit_appeal]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.submit_appeal(p_type text, p_id uuid, p_body text) | plpgsql | true | search_path="" | authenticated | 20261027000000_sanctions_appeals.sql |

## public.claim_appeal(p_id uuid, p_claim boolean)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#claim_appeal]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.claim_appeal(p_id uuid, p_claim boolean) | sql | false | search_path="" | authenticated, service_role | 20261027000000_sanctions_appeals.sql |

## public.decide_appeal(p_id uuid, p_outcome text, p_reason text)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#decide_appeal]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.decide_appeal(p_id uuid, p_outcome text, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261027000000_sanctions_appeals.sql |

## public.lift_sanction(p_id uuid, p_reason text)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#lift_sanction]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.lift_sanction(p_id uuid, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261027000000_sanctions_appeals.sql |

## public.my_appealable()

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#my_appealable]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_appealable() | sql | false | search_path="" | authenticated, service_role | 20261027000000_sanctions_appeals.sql |

## public.my_appeals()

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#my_appeals]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_appeals() | sql | false | search_path="" | authenticated, service_role | 20261027000000_sanctions_appeals.sql |

## public.my_restriction()

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#my_restriction]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_restriction() | sql | false | search_path="" | authenticated, service_role | 20261027000000_sanctions_appeals.sql |

## public.ops_appeal_case(p_id uuid)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#ops_appeal_case]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_appeal_case(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261027000000_sanctions_appeals.sql |

## public.ops_appeals(p_open boolean)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#ops_appeals]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_appeals(p_open boolean) | sql | false | search_path="" | authenticated, service_role | 20261027000000_sanctions_appeals.sql |

## public.ops_case_owner(p_case uuid)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#ops_case_owner]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_case_owner(p_case uuid) | sql | false | search_path="" | authenticated, service_role | 20261027000000_sanctions_appeals.sql |

## public.ops_file_appeal(p_type text, p_id uuid, p_body text, p_reason text)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#ops_file_appeal]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_file_appeal(p_type text, p_id uuid, p_body text, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261027000000_sanctions_appeals.sql |

## public.ops_find_account(p_query text)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#ops_find_account]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_find_account(p_query text) | sql | false | search_path="" | authenticated, service_role | 20261027000000_sanctions_appeals.sql |

## public.ops_sanctions(p_active boolean)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#ops_sanctions]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_sanctions(p_active boolean) | sql | false | search_path="" | authenticated, service_role | 20261027000000_sanctions_appeals.sql |

## public.sanction_org(p_org uuid, p_kind text, p_until timestamp with time zone, p_per_day integer, p_reason text)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#sanction_org]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.sanction_org(p_org uuid, p_kind text, p_until timestamp with time zone, p_per_day integer, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261027000000_sanctions_appeals.sql |

## public.sanction_user(p_user uuid, p_kind text, p_until timestamp with time zone, p_reason text, p_case uuid)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#sanction_user]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.sanction_user(p_user uuid, p_kind text, p_until timestamp with time zone, p_reason text, p_case uuid) | sql | false | search_path="" | authenticated, service_role | 20261027000000_sanctions_appeals.sql |

## public.submit_appeal(p_type text, p_id uuid, p_body text)

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#submit_appeal]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.submit_appeal(p_type text, p_id uuid, p_body text) | sql | false | search_path="" | authenticated, service_role | 20261027000000_sanctions_appeals.sql |

## public.appeals

[src: supabase/migrations/20261027000000_sanctions_appeals.sql#appeals]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| decision_type | appeal_decision_type | true | — |  |  | — |
| decision_id | uuid | true | — |  |  | — |
| appellant_id | uuid | true | — |  |  | — |
| org_id | uuid | false | — |  |  | — |
| body | text | true | — |  |  | "default" |
| original_staff_id | uuid | true | — |  |  | — |
| decider_role | staff_role | true | — |  |  | — |
| summary | jsonb | true | '{}'::jsonb |  |  | — |
| filed_by | uuid | false | — |  |  | — |
| status | appeal_status | true | 'pending'::appeal_status |  |  | — |
| claimed_by | uuid | false | — |  |  | — |
| claimed_at | timestamp with time zone | false | — |  |  | — |
| decided_by | uuid | false | — |  |  | — |
| decided_at | timestamp with time zone | false | — |  |  | — |
| decision_reason | text | false | — |  |  | "default" |
| outcome | jsonb | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
appeals_appellant_id_fkey: FOREIGN KEY (appellant_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
appeals_body_check: CHECK (char_length(btrim(body)) >= 10 AND char_length(btrim(body)) <= 2000); -- validated: true
```

```sql
appeals_check: CHECK (decided_by IS NULL OR decided_by <> original_staff_id); -- validated: true
```

```sql
appeals_check1: CHECK (claimed_by IS NULL OR claimed_by <> original_staff_id); -- validated: true
```

```sql
appeals_check2: CHECK ((status = 'pending'::appeal_status) = (decided_at IS NULL)); -- validated: true
```

```sql
appeals_check3: CHECK (status = 'pending'::appeal_status OR decision_reason IS NOT NULL); -- validated: true
```

```sql
appeals_claimed_by_fkey: FOREIGN KEY (claimed_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
appeals_decided_by_fkey: FOREIGN KEY (decided_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
appeals_decision_reason_check: CHECK (decision_reason IS NULL OR char_length(btrim(decision_reason)) >= 3 AND char_length(btrim(decision_reason)) <= 2000); -- validated: true
```

```sql
appeals_decision_type_decision_id_key: UNIQUE (decision_type, decision_id); -- validated: true
```

```sql
appeals_filed_by_fkey: FOREIGN KEY (filed_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
appeals_org_id_fkey: FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE; -- validated: true
```

```sql
appeals_original_staff_id_fkey: FOREIGN KEY (original_staff_id) REFERENCES auth.users(id) ON DELETE RESTRICT; -- validated: true
```

```sql
appeals_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
appeals_summary_check: CHECK (jsonb_typeof(summary) = 'object'::text); -- validated: true
```

### Indexes

```sql
CREATE INDEX appeals_appellant_idx ON public.appeals USING btree (appellant_id, created_at DESC); -- valid: true
```

```sql
CREATE INDEX appeals_claimed_by_idx ON public.appeals USING btree (claimed_by) WHERE (claimed_by IS NOT NULL); -- valid: true
```

```sql
CREATE INDEX appeals_decided_by_idx ON public.appeals USING btree (decided_by) WHERE (decided_by IS NOT NULL); -- valid: true
```

```sql
CREATE UNIQUE INDEX appeals_decision_type_decision_id_key ON public.appeals USING btree (decision_type, decision_id); -- valid: true
```

```sql
CREATE INDEX appeals_filed_by_idx ON public.appeals USING btree (filed_by) WHERE (filed_by IS NOT NULL); -- valid: true
```

```sql
CREATE INDEX appeals_org_idx ON public.appeals USING btree (org_id) WHERE (org_id IS NOT NULL); -- valid: true
```

```sql
CREATE INDEX appeals_original_staff_idx ON public.appeals USING btree (original_staff_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX appeals_pkey ON public.appeals USING btree (id); -- valid: true
```

```sql
CREATE INDEX appeals_queue_idx ON public.appeals USING btree (status, created_at); -- valid: true
```

### Policies

#### appeals.appeals_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((appellant_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_staff(appeals.decider_role) AS is_staff))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER appeals_guard BEFORE UPDATE ON appeals FOR EACH ROW EXECUTE FUNCTION private.appeals_guard(); -- enabled: O
```
