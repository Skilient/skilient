Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# auth_decisions

## private.create_mfa_backup_codes()

[src: supabase/migrations/20260928123000_auth_decisions.sql#create_mfa_backup_codes]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.create_mfa_backup_codes() | plpgsql | true | search_path="" | authenticated | 20260928123000_auth_decisions.sql |

## private.delete_mfa_backup_codes()

[src: supabase/migrations/20260928123000_auth_decisions.sql#delete_mfa_backup_codes]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.delete_mfa_backup_codes() | sql | true | search_path="" | authenticated | 20260928123000_auth_decisions.sql |

## private.mfa_backup_codes_remaining()

[src: supabase/migrations/20260928123000_auth_decisions.sql#mfa_backup_codes_remaining]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.mfa_backup_codes_remaining() | sql | true | search_path="" | authenticated | 20260928123000_auth_decisions.sql |

## private.normalize_backup_code(p_code text)

[src: supabase/migrations/20260928123000_auth_decisions.sql#normalize_backup_code]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.normalize_backup_code(p_code text) | sql | false | search_path="" | None | 20260928123000_auth_decisions.sql |

## private.purge_security_data()

[src: supabase/migrations/20260928123000_auth_decisions.sql#purge_security_data]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.purge_security_data() | plpgsql | true | search_path="" | None | 20260928123000_auth_decisions.sql |

## private.signin_delay_seconds(p_failures integer)

[src: supabase/migrations/20260928123000_auth_decisions.sql#signin_delay_seconds]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.signin_delay_seconds(p_failures integer) | sql | false | search_path="" | None | 20260928123000_auth_decisions.sql |

## private.signin_failed(p_email text, p_ip_hash text)

[src: supabase/migrations/20260928123000_auth_decisions.sql#signin_failed]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.signin_failed(p_email text, p_ip_hash text) | plpgsql | true | search_path="" | anon, authenticated | 20260928123000_auth_decisions.sql |

## private.signin_status(p_email text, p_ip_hash text)

[src: supabase/migrations/20260928123000_auth_decisions.sql#signin_status]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.signin_status(p_email text, p_ip_hash text) | plpgsql | true | search_path="" | anon, authenticated | 20260928123000_auth_decisions.sql |

## private.use_mfa_backup_code(p_code text)

[src: supabase/migrations/20260928123000_auth_decisions.sql#use_mfa_backup_code]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.use_mfa_backup_code(p_code text) | plpgsql | true | search_path="" | authenticated | 20260928123000_auth_decisions.sql |

## public.create_mfa_backup_codes()

[src: supabase/migrations/20260928123000_auth_decisions.sql#create_mfa_backup_codes]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.create_mfa_backup_codes() | sql | false | search_path="" | authenticated, service_role | 20260928123000_auth_decisions.sql |

## public.delete_mfa_backup_codes()

[src: supabase/migrations/20260928123000_auth_decisions.sql#delete_mfa_backup_codes]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.delete_mfa_backup_codes() | sql | false | search_path="" | authenticated, service_role | 20260928123000_auth_decisions.sql |

## public.mfa_backup_codes_remaining()

[src: supabase/migrations/20260928123000_auth_decisions.sql#mfa_backup_codes_remaining]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.mfa_backup_codes_remaining() | sql | false | search_path="" | authenticated, service_role | 20260928123000_auth_decisions.sql |

## public.use_mfa_backup_code(p_code text)

[src: supabase/migrations/20260928123000_auth_decisions.sql#use_mfa_backup_code]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.use_mfa_backup_code(p_code text) | sql | false | search_path="" | authenticated, service_role | 20260928123000_auth_decisions.sql |

## private.mfa_backup_codes

[src: supabase/migrations/20260928123000_auth_decisions.sql#mfa_backup_codes]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| code_hash | text | true | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |
| used_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
mfa_backup_codes_code_hash_check: CHECK (code_hash ~ '^[0-9a-f]{64}$'::text); -- validated: true
```

```sql
mfa_backup_codes_pkey: PRIMARY KEY (user_id, code_hash); -- validated: true
```

```sql
mfa_backup_codes_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX mfa_backup_codes_pkey ON private.mfa_backup_codes USING btree (user_id, code_hash); -- valid: true
```

### Policies

None.

### Triggers

None.
