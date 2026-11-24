Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# leaderboard

## private.last_snapshot_week()

[src: supabase/migrations/20261006000000_leaderboard.sql#last_snapshot_week]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.last_snapshot_week() | sql | true | search_path="" | authenticated | 20261006000000_leaderboard.sql |

## private.leaderboard(p_scope text, p_department text, p_batch smallint, p_after integer)

[src: supabase/migrations/20261006000000_leaderboard.sql#leaderboard]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.leaderboard(p_scope text, p_department text, p_batch smallint, p_after integer) | plpgsql | true | search_path="" | authenticated | 20261006000000_leaderboard.sql |

## private.leaderboard_filters()

[src: supabase/migrations/20261006000000_leaderboard.sql#leaderboard_filters]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.leaderboard_filters() | sql | true | search_path="" | authenticated | 20261006000000_leaderboard.sql |

## private.leaderboard_me(p_scope text, p_department text, p_batch smallint)

[src: supabase/migrations/20261006000000_leaderboard.sql#leaderboard_me]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.leaderboard_me(p_scope text, p_department text, p_batch smallint) | plpgsql | true | search_path="" | authenticated | 20261006000000_leaderboard.sql |

## private.my_score()

[src: supabase/migrations/20261006000000_leaderboard.sql#my_score]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_score() | plpgsql | true | search_path="" | authenticated | 20261006000000_leaderboard.sql |

## private.next_tier_requirements(p_user uuid)

[src: supabase/migrations/20261006000000_leaderboard.sql#next_tier_requirements]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.next_tier_requirements(p_user uuid) | plpgsql | true | search_path="" | None | 20261006000000_leaderboard.sql |

## private.set_leaderboard_opt_out(p_out boolean)

[src: supabase/migrations/20261006000000_leaderboard.sql#set_leaderboard_opt_out]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.set_leaderboard_opt_out(p_out boolean) | plpgsql | true | search_path="" | authenticated | 20261006000000_leaderboard.sql |

## private.tiers_for(p_users uuid[])

[src: supabase/migrations/20261006000000_leaderboard.sql#tiers_for]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.tiers_for(p_users uuid[]) | plpgsql | true | search_path="" | authenticated | 20261006000000_leaderboard.sql |

## public.leaderboard(p_scope text, p_department text, p_batch smallint, p_after integer)

[src: supabase/migrations/20261006000000_leaderboard.sql#leaderboard]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.leaderboard(p_scope text, p_department text, p_batch smallint, p_after integer) | sql | false | search_path="" | authenticated, service_role | 20261006000000_leaderboard.sql |

## public.leaderboard_filters()

[src: supabase/migrations/20261006000000_leaderboard.sql#leaderboard_filters]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.leaderboard_filters() | sql | false | search_path="" | authenticated, service_role | 20261006000000_leaderboard.sql |

## public.leaderboard_me(p_scope text, p_department text, p_batch smallint)

[src: supabase/migrations/20261006000000_leaderboard.sql#leaderboard_me]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.leaderboard_me(p_scope text, p_department text, p_batch smallint) | sql | false | search_path="" | authenticated, service_role | 20261006000000_leaderboard.sql |

## public.my_score()

[src: supabase/migrations/20261006000000_leaderboard.sql#my_score]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_score() | sql | false | search_path="" | authenticated, service_role | 20261006000000_leaderboard.sql |

## public.set_leaderboard_opt_out(p_out boolean)

[src: supabase/migrations/20261006000000_leaderboard.sql#set_leaderboard_opt_out]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.set_leaderboard_opt_out(p_out boolean) | sql | false | search_path="" | authenticated, service_role | 20261006000000_leaderboard.sql |

## public.tiers_for(p_users uuid[])

[src: supabase/migrations/20261006000000_leaderboard.sql#tiers_for]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.tiers_for(p_users uuid[]) | sql | false | search_path="" | authenticated, service_role | 20261006000000_leaderboard.sql |
