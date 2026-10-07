Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# venture_views

## private.application_people(p_ids uuid[])

[src: supabase/migrations/20260928200000_venture_views.sql#application_people]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.application_people(p_ids uuid[]) | sql | true | search_path="" | authenticated | 20260928200000_venture_views.sql |

## private.browse_ventures(p_type venture_type, p_status venture_status, p_open_roles boolean, p_my_university boolean, p_before timestamp with time zone, p_limit integer)

[src: supabase/migrations/20260928200000_venture_views.sql#browse_ventures]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.browse_ventures(p_type venture_type, p_status venture_status, p_open_roles boolean, p_my_university boolean, p_before timestamp with time zone, p_limit integer) | sql | true | search_path="" | authenticated | 20260928200000_venture_views.sql |

## private.profile_ventures(p_user uuid)

[src: supabase/migrations/20260928200000_venture_views.sql#profile_ventures]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.profile_ventures(p_user uuid) | sql | true | search_path="" | authenticated | 20260928200000_venture_views.sql |

## public.application_people(p_ids uuid[])

[src: supabase/migrations/20260928200000_venture_views.sql#application_people]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.application_people(p_ids uuid[]) | sql | false | search_path="" | authenticated, service_role | 20260928200000_venture_views.sql |

## public.browse_ventures(p_type venture_type, p_status venture_status, p_open_roles boolean, p_my_university boolean, p_before timestamp with time zone, p_limit integer)

[src: supabase/migrations/20260928200000_venture_views.sql#browse_ventures]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.browse_ventures(p_type venture_type, p_status venture_status, p_open_roles boolean, p_my_university boolean, p_before timestamp with time zone, p_limit integer) | sql | false | search_path="" | authenticated, service_role | 20260928200000_venture_views.sql |

## public.profile_ventures(p_user uuid)

[src: supabase/migrations/20260928200000_venture_views.sql#profile_ventures]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.profile_ventures(p_user uuid) | sql | false | search_path="" | authenticated, service_role | 20260928200000_venture_views.sql |
