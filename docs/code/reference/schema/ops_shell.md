Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# ops_shell

## private.grant_staff_role(p_email text, p_role staff_role, p_reason text)

[src: supabase/migrations/20261026000000_ops_shell.sql#grant_staff_role]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.grant_staff_role(p_email text, p_role staff_role, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261026000000_ops_shell.sql |

## private.ops_audit_export(p_reason text, p_staff uuid, p_action text, p_target_type text, p_from timestamp with time zone, p_to timestamp with time zone)

[src: supabase/migrations/20261026000000_ops_shell.sql#ops_audit_export]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_audit_export(p_reason text, p_staff uuid, p_action text, p_target_type text, p_from timestamp with time zone, p_to timestamp with time zone) | plpgsql | true | search_path="" | authenticated | 20261026000000_ops_shell.sql |

## private.ops_audit_filters()

[src: supabase/migrations/20261026000000_ops_shell.sql#ops_audit_filters]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_audit_filters() | plpgsql | true | search_path="" | authenticated | 20261026000000_ops_shell.sql |

## private.ops_audit_search(p_staff uuid, p_action text, p_target_type text, p_target_id text, p_from timestamp with time zone, p_to timestamp with time zone, p_before timestamp with time zone, p_limit integer)

[src: supabase/migrations/20261026000000_ops_shell.sql#ops_audit_search]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_audit_search(p_staff uuid, p_action text, p_target_type text, p_target_id text, p_from timestamp with time zone, p_to timestamp with time zone, p_before timestamp with time zone, p_limit integer) | plpgsql | true | search_path="" | authenticated | 20261026000000_ops_shell.sql |

## private.ops_staff()

[src: supabase/migrations/20261026000000_ops_shell.sql#ops_staff]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_staff() | plpgsql | true | search_path="" | authenticated | 20261026000000_ops_shell.sql |

## private.require_super_admin()

[src: supabase/migrations/20261026000000_ops_shell.sql#require_super_admin]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.require_super_admin() | plpgsql | true | search_path="" | None | 20261026000000_ops_shell.sql |

## private.revoke_staff_role(p_user uuid, p_role staff_role, p_reason text)

[src: supabase/migrations/20261026000000_ops_shell.sql#revoke_staff_role]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.revoke_staff_role(p_user uuid, p_role staff_role, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261026000000_ops_shell.sql |

## private.staff_roles_of(p_user uuid)

[src: supabase/migrations/20261026000000_ops_shell.sql#staff_roles_of]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.staff_roles_of(p_user uuid) | sql | true | search_path="" | None | 20261026000000_ops_shell.sql |

## public.grant_staff_role(p_email text, p_role staff_role, p_reason text)

[src: supabase/migrations/20261026000000_ops_shell.sql#grant_staff_role]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.grant_staff_role(p_email text, p_role staff_role, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261026000000_ops_shell.sql |

## public.ops_audit_export(p_reason text, p_staff uuid, p_action text, p_target_type text, p_from timestamp with time zone, p_to timestamp with time zone)

[src: supabase/migrations/20261026000000_ops_shell.sql#ops_audit_export]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_audit_export(p_reason text, p_staff uuid, p_action text, p_target_type text, p_from timestamp with time zone, p_to timestamp with time zone) | sql | false | search_path="" | authenticated, service_role | 20261026000000_ops_shell.sql |

## public.ops_audit_filters()

[src: supabase/migrations/20261026000000_ops_shell.sql#ops_audit_filters]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_audit_filters() | sql | false | search_path="" | authenticated, service_role | 20261026000000_ops_shell.sql |

## public.ops_audit_search(p_staff uuid, p_action text, p_target_type text, p_target_id text, p_from timestamp with time zone, p_to timestamp with time zone, p_before timestamp with time zone, p_limit integer)

[src: supabase/migrations/20261026000000_ops_shell.sql#ops_audit_search]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_audit_search(p_staff uuid, p_action text, p_target_type text, p_target_id text, p_from timestamp with time zone, p_to timestamp with time zone, p_before timestamp with time zone, p_limit integer) | sql | false | search_path="" | authenticated, service_role | 20261026000000_ops_shell.sql |

## public.ops_inbox(p_queue text)

[src: supabase/migrations/20261026000000_ops_shell.sql#ops_inbox]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_inbox(p_queue text) | sql | false | search_path="" | authenticated, service_role | 20261026000000_ops_shell.sql |

## public.ops_staff()

[src: supabase/migrations/20261026000000_ops_shell.sql#ops_staff]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_staff() | sql | false | search_path="" | authenticated, service_role | 20261026000000_ops_shell.sql |

## public.revoke_staff_role(p_user uuid, p_role staff_role, p_reason text)

[src: supabase/migrations/20261026000000_ops_shell.sql#revoke_staff_role]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.revoke_staff_role(p_user uuid, p_role staff_role, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261026000000_ops_shell.sql |
