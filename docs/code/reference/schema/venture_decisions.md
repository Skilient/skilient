Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# venture_decisions

## private.confirm_contribution(p_entry uuid)

[src: supabase/migrations/20260928220000_venture_decisions.sql#confirm_contribution]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.confirm_contribution(p_entry uuid) | plpgsql | true | search_path="" | authenticated | 20260928220000_venture_decisions.sql |

## private.venture_team(p_venture uuid)

[src: supabase/migrations/20260928220000_venture_decisions.sql#venture_team]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.venture_team(p_venture uuid) | sql | true | search_path="" | authenticated | 20260928220000_venture_decisions.sql |

## private.verified_contributors(p_venture uuid)

[src: supabase/migrations/20260928220000_venture_decisions.sql#verified_contributors]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.verified_contributors(p_venture uuid) | sql | true | search_path="" | None | 20260928220000_venture_decisions.sql |

## public.venture_team(p_venture uuid)

[src: supabase/migrations/20260928220000_venture_decisions.sql#venture_team]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.venture_team(p_venture uuid) | sql | false | search_path="" | authenticated, service_role | 20260928220000_venture_decisions.sql |
