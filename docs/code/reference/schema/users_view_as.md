Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# users_view_as

## private.ops_github_resync(p_user uuid, p_reason text)

[src: supabase/migrations/20261028000000_users_view_as.sql#ops_github_resync]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_github_resync(p_user uuid, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261028000000_users_view_as.sql |

## private.ops_recompute_skills(p_user uuid, p_reason text)

[src: supabase/migrations/20261028000000_users_view_as.sql#ops_recompute_skills]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_recompute_skills(p_user uuid, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261028000000_users_view_as.sql |

## private.ops_reset_mfa(p_user uuid, p_identity_note text)

[src: supabase/migrations/20261028000000_users_view_as.sql#ops_reset_mfa]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_reset_mfa(p_user uuid, p_identity_note text) | plpgsql | true | search_path="" | authenticated | 20261028000000_users_view_as.sql |

## private.ops_user_record(p_user uuid)

[src: supabase/migrations/20261028000000_users_view_as.sql#ops_user_record]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_user_record(p_user uuid) | plpgsql | true | search_path="" | authenticated | 20261028000000_users_view_as.sql |

## private.ops_user_search(p_query text)

[src: supabase/migrations/20261028000000_users_view_as.sql#ops_user_search]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_user_search(p_query text) | plpgsql | true | search_path="" | authenticated | 20261028000000_users_view_as.sql |

## private.ops_view_as_page(p_user uuid, p_page text)

[src: supabase/migrations/20261028000000_users_view_as.sql#ops_view_as_page]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_view_as_page(p_user uuid, p_page text) | plpgsql | true | search_path="" | authenticated | 20261028000000_users_view_as.sql |

## private.ops_view_as_start(p_user uuid, p_reason text)

[src: supabase/migrations/20261028000000_users_view_as.sql#ops_view_as_start]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_view_as_start(p_user uuid, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261028000000_users_view_as.sql |

## public.ops_github_resync(p_user uuid, p_reason text)

[src: supabase/migrations/20261028000000_users_view_as.sql#ops_github_resync]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_github_resync(p_user uuid, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261028000000_users_view_as.sql |

## public.ops_recompute_skills(p_user uuid, p_reason text)

[src: supabase/migrations/20261028000000_users_view_as.sql#ops_recompute_skills]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_recompute_skills(p_user uuid, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261028000000_users_view_as.sql |

## public.ops_reset_mfa(p_user uuid, p_identity_note text)

[src: supabase/migrations/20261028000000_users_view_as.sql#ops_reset_mfa]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_reset_mfa(p_user uuid, p_identity_note text) | sql | false | search_path="" | authenticated, service_role | 20261028000000_users_view_as.sql |

## public.ops_user_record(p_user uuid)

[src: supabase/migrations/20261028000000_users_view_as.sql#ops_user_record]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_user_record(p_user uuid) | sql | false | search_path="" | authenticated, service_role | 20261028000000_users_view_as.sql |

## public.ops_user_search(p_query text)

[src: supabase/migrations/20261028000000_users_view_as.sql#ops_user_search]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_user_search(p_query text) | sql | false | search_path="" | authenticated, service_role | 20261028000000_users_view_as.sql |

## public.ops_view_as_page(p_user uuid, p_page text)

[src: supabase/migrations/20261028000000_users_view_as.sql#ops_view_as_page]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_view_as_page(p_user uuid, p_page text) | sql | false | search_path="" | authenticated, service_role | 20261028000000_users_view_as.sql |

## public.ops_view_as_start(p_user uuid, p_reason text)

[src: supabase/migrations/20261028000000_users_view_as.sql#ops_view_as_start]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_view_as_start(p_user uuid, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261028000000_users_view_as.sql |

## public.ops_view_sessions

[src: supabase/migrations/20261028000000_users_view_as.sql#ops_view_sessions]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| staff_id | uuid | true | — |  |  | — |
| user_id | uuid | true | — |  |  | — |
| reason | text | true | — |  |  | "default" |
| pages | text[] | true | '{}'::text[] |  |  | "default" |
| started_at | timestamp with time zone | true | now() |  |  | — |
| expires_at | timestamp with time zone | true | (now() + '01:00:00'::interval) |  |  | — |

### Keys and constraints

```sql
ops_view_sessions_check: CHECK (expires_at > started_at); -- validated: true
```

```sql
ops_view_sessions_check1: CHECK (staff_id <> user_id); -- validated: true
```

```sql
ops_view_sessions_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
ops_view_sessions_reason_check: CHECK (char_length(btrim(reason)) >= 3 AND char_length(btrim(reason)) <= 500); -- validated: true
```

```sql
ops_view_sessions_staff_id_fkey: FOREIGN KEY (staff_id) REFERENCES auth.users(id) ON DELETE RESTRICT; -- validated: true
```

```sql
ops_view_sessions_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX ops_view_sessions_pkey ON public.ops_view_sessions USING btree (id); -- valid: true
```

```sql
CREATE INDEX ops_view_sessions_staff_idx ON public.ops_view_sessions USING btree (staff_id, user_id, expires_at DESC); -- valid: true
```

```sql
CREATE INDEX ops_view_sessions_user_idx ON public.ops_view_sessions USING btree (user_id, started_at DESC); -- valid: true
```

### Policies

None.

### Triggers

None.
