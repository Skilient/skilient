Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# recruiter_talent

## private.activity_band(p_at timestamp with time zone)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#activity_band]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.activity_band(p_at timestamp with time zone) | sql | false | search_path="" | None | 20261014000000_recruiter_talent.sql |

## private.close_contact_chat(p_id uuid)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#close_contact_chat]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.close_contact_chat(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261014000000_recruiter_talent.sql |

## private.delete_note(p_id uuid)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#delete_note]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.delete_note(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261014000000_recruiter_talent.sql |

## private.delete_saved_search(p_id uuid)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#delete_saved_search]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.delete_saved_search(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261014000000_recruiter_talent.sql |

## private.delete_shortlist(p_id uuid)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#delete_shortlist]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.delete_shortlist(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261014000000_recruiter_talent.sql |

## private.dm_blocked(p_thread uuid)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#dm_blocked]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.dm_blocked(p_thread uuid) | sql | true | search_path="" | authenticated | 20261014000000_recruiter_talent.sql |

## private.expire_contact_requests()

[src: supabase/migrations/20261014000000_recruiter_talent.sql#expire_contact_requests]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.expire_contact_requests() | sql | true | search_path="" | None | 20261014000000_recruiter_talent.sql |

## private.my_contact_requests()

[src: supabase/migrations/20261014000000_recruiter_talent.sql#my_contact_requests]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_contact_requests() | plpgsql | true | search_path="" | authenticated | 20261014000000_recruiter_talent.sql |

## private.my_profile_viewers()

[src: supabase/migrations/20261014000000_recruiter_talent.sql#my_profile_viewers]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_profile_viewers() | plpgsql | true | search_path="" | authenticated | 20261014000000_recruiter_talent.sql |

## private.my_recruiter_prefs()

[src: supabase/migrations/20261014000000_recruiter_talent.sql#my_recruiter_prefs]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_recruiter_prefs() | plpgsql | true | search_path="" | authenticated | 20261014000000_recruiter_talent.sql |

## private.my_threads()

[src: supabase/migrations/20261014000000_recruiter_talent.sql#my_threads]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_threads() | sql | true | search_path="" | authenticated | 20261014000000_recruiter_talent.sql |

## private.notes_for(p_student uuid)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#notes_for]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.notes_for(p_student uuid) | plpgsql | true | search_path="" | authenticated | 20261014000000_recruiter_talent.sql |

## private.org_activity(p_limit integer)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#org_activity]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.org_activity(p_limit integer) | plpgsql | true | search_path="" | authenticated | 20261014000000_recruiter_talent.sql |

## private.org_contact_requests()

[src: supabase/migrations/20261014000000_recruiter_talent.sql#org_contact_requests]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.org_contact_requests() | plpgsql | true | search_path="" | authenticated | 20261014000000_recruiter_talent.sql |

## private.org_log(p_org uuid, p_student uuid, p_kind text)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#org_log]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.org_log(p_org uuid, p_student uuid, p_kind text) | sql | true | search_path="" | None | 20261014000000_recruiter_talent.sql |

## private.profile_talent_sync()

[src: supabase/migrations/20261014000000_recruiter_talent.sql#profile_talent_sync]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.profile_talent_sync() | plpgsql | true | search_path="" | None | 20261014000000_recruiter_talent.sql |

## private.recruit_candidate(p_student uuid)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#recruit_candidate]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.recruit_candidate(p_student uuid) | plpgsql | true | search_path="" | authenticated | 20261014000000_recruiter_talent.sql |

## private.recruit_on_user_delete()

[src: supabase/migrations/20261014000000_recruiter_talent.sql#recruit_on_user_delete]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.recruit_on_user_delete() | plpgsql | true | search_path="" | None | 20261014000000_recruiter_talent.sql |

## private.refresh_talent_index(p_student uuid)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#refresh_talent_index]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.refresh_talent_index(p_student uuid) | sql | true | search_path="" | None | 20261014000000_recruiter_talent.sql |

## private.remove_from_shortlist(p_item uuid)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#remove_from_shortlist]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.remove_from_shortlist(p_item uuid) | plpgsql | true | search_path="" | authenticated | 20261014000000_recruiter_talent.sql |

## private.respond_contact_request(p_id uuid, p_accept boolean, p_reason text)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#respond_contact_request]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.respond_contact_request(p_id uuid, p_accept boolean, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261014000000_recruiter_talent.sql |

## private.run_saved_searches()

[src: supabase/migrations/20261014000000_recruiter_talent.sql#run_saved_searches]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.run_saved_searches() | plpgsql | true | search_path="" | None | 20261014000000_recruiter_talent.sql |

## private.save_recruiter_prefs(p_availability text[], p_city text, p_remote boolean)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#save_recruiter_prefs]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.save_recruiter_prefs(p_availability text[], p_city text, p_remote boolean) | plpgsql | true | search_path="" | authenticated | 20261014000000_recruiter_talent.sql |

## private.save_search(p_name text, p_filters jsonb, p_frequency text)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#save_search]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.save_search(p_name text, p_filters jsonb, p_frequency text) | plpgsql | true | search_path="" | authenticated | 20261014000000_recruiter_talent.sql |

## private.saved_searches_list()

[src: supabase/migrations/20261014000000_recruiter_talent.sql#saved_searches_list]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.saved_searches_list() | plpgsql | true | search_path="" | authenticated | 20261014000000_recruiter_talent.sql |

## private.send_contact_request(p_student uuid, p_role text, p_message text)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#send_contact_request]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.send_contact_request(p_student uuid, p_role text, p_message text) | plpgsql | true | search_path="" | authenticated | 20261014000000_recruiter_talent.sql |

## private.shortlist_get(p_list uuid)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#shortlist_get]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.shortlist_get(p_list uuid) | plpgsql | true | search_path="" | authenticated | 20261014000000_recruiter_talent.sql |

## private.shortlists_list()

[src: supabase/migrations/20261014000000_recruiter_talent.sql#shortlists_list]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.shortlists_list() | plpgsql | true | search_path="" | authenticated | 20261014000000_recruiter_talent.sql |

## private.talent_facets()

[src: supabase/migrations/20261014000000_recruiter_talent.sql#talent_facets]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.talent_facets() | plpgsql | true | search_path="" | authenticated | 20261014000000_recruiter_talent.sql |

## private.talent_filters(p jsonb)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#talent_filters]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.talent_filters(p jsonb) | plpgsql | true | search_path="" | None | 20261014000000_recruiter_talent.sql |

## private.talent_matches(p_org uuid, p_filters jsonb, p_limit integer, p_offset integer, p_since timestamp with time zone)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#talent_matches]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.talent_matches(p_org uuid, p_filters jsonb, p_limit integer, p_offset integer, p_since timestamp with time zone) | plpgsql | true | search_path="" | None | 20261014000000_recruiter_talent.sql |

## private.talent_rows(p_student uuid)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#talent_rows]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.talent_rows(p_student uuid) | sql | true | search_path="" | None | 20261014000000_recruiter_talent.sql |

## private.thread_people(p_thread uuid)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#thread_people]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.thread_people(p_thread uuid) | sql | true | search_path="" | authenticated | 20261014000000_recruiter_talent.sql |

## private.why_match(p_skills jsonb, p_checked text[], p_required jsonb, p_active timestamp with time zone, p_tier ranking_tier)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#why_match]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.why_match(p_skills jsonb, p_checked text[], p_required jsonb, p_active timestamp with time zone, p_tier ranking_tier) | sql | true | search_path="" | None | 20261014000000_recruiter_talent.sql |

## public.add_note(p_student uuid, p_body text)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#add_note]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.add_note(p_student uuid, p_body text) | sql | false | search_path="" | authenticated, service_role | 20261014000000_recruiter_talent.sql |

## public.add_to_shortlist(p_list uuid, p_student uuid)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#add_to_shortlist]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.add_to_shortlist(p_list uuid, p_student uuid) | sql | false | search_path="" | authenticated, service_role | 20261014000000_recruiter_talent.sql |

## public.close_contact_chat(p_id uuid)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#close_contact_chat]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.close_contact_chat(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261014000000_recruiter_talent.sql |

## public.create_shortlist(p_name text)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#create_shortlist]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.create_shortlist(p_name text) | sql | false | search_path="" | authenticated, service_role | 20261014000000_recruiter_talent.sql |

## public.delete_note(p_id uuid)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#delete_note]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.delete_note(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261014000000_recruiter_talent.sql |

## public.delete_saved_search(p_id uuid)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#delete_saved_search]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.delete_saved_search(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261014000000_recruiter_talent.sql |

## public.delete_shortlist(p_id uuid)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#delete_shortlist]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.delete_shortlist(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261014000000_recruiter_talent.sql |

## public.my_contact_requests()

[src: supabase/migrations/20261014000000_recruiter_talent.sql#my_contact_requests]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_contact_requests() | sql | false | search_path="" | authenticated, service_role | 20261014000000_recruiter_talent.sql |

## public.my_profile_viewers()

[src: supabase/migrations/20261014000000_recruiter_talent.sql#my_profile_viewers]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_profile_viewers() | sql | false | search_path="" | authenticated, service_role | 20261014000000_recruiter_talent.sql |

## public.my_recruiter_prefs()

[src: supabase/migrations/20261014000000_recruiter_talent.sql#my_recruiter_prefs]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_recruiter_prefs() | sql | false | search_path="" | authenticated, service_role | 20261014000000_recruiter_talent.sql |

## public.notes_for(p_student uuid)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#notes_for]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.notes_for(p_student uuid) | sql | false | search_path="" | authenticated, service_role | 20261014000000_recruiter_talent.sql |

## public.org_activity(p_limit integer)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#org_activity]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.org_activity(p_limit integer) | sql | false | search_path="" | authenticated, service_role | 20261014000000_recruiter_talent.sql |

## public.org_contact_requests()

[src: supabase/migrations/20261014000000_recruiter_talent.sql#org_contact_requests]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.org_contact_requests() | sql | false | search_path="" | authenticated, service_role | 20261014000000_recruiter_talent.sql |

## public.recruit_candidate(p_student uuid)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#recruit_candidate]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.recruit_candidate(p_student uuid) | sql | false | search_path="" | authenticated, service_role | 20261014000000_recruiter_talent.sql |

## public.remove_from_shortlist(p_item uuid)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#remove_from_shortlist]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.remove_from_shortlist(p_item uuid) | sql | false | search_path="" | authenticated, service_role | 20261014000000_recruiter_talent.sql |

## public.rename_shortlist(p_id uuid, p_name text)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#rename_shortlist]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.rename_shortlist(p_id uuid, p_name text) | sql | false | search_path="" | authenticated, service_role | 20261014000000_recruiter_talent.sql |

## public.reorder_shortlist(p_list uuid, p_items uuid[])

[src: supabase/migrations/20261014000000_recruiter_talent.sql#reorder_shortlist]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.reorder_shortlist(p_list uuid, p_items uuid[]) | sql | false | search_path="" | authenticated, service_role | 20261014000000_recruiter_talent.sql |

## public.respond_contact_request(p_id uuid, p_accept boolean, p_reason text)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#respond_contact_request]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.respond_contact_request(p_id uuid, p_accept boolean, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261014000000_recruiter_talent.sql |

## public.save_recruiter_prefs(p_availability text[], p_city text, p_remote boolean)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#save_recruiter_prefs]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.save_recruiter_prefs(p_availability text[], p_city text, p_remote boolean) | sql | false | search_path="" | authenticated, service_role | 20261014000000_recruiter_talent.sql |

## public.save_search(p_name text, p_filters jsonb, p_frequency text)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#save_search]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.save_search(p_name text, p_filters jsonb, p_frequency text) | sql | false | search_path="" | authenticated, service_role | 20261014000000_recruiter_talent.sql |

## public.saved_searches_list()

[src: supabase/migrations/20261014000000_recruiter_talent.sql#saved_searches_list]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.saved_searches_list() | sql | false | search_path="" | authenticated, service_role | 20261014000000_recruiter_talent.sql |

## public.search_talent(p_filters jsonb, p_offset integer)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#search_talent]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.search_talent(p_filters jsonb, p_offset integer) | sql | false | search_path="" | authenticated, service_role | 20261014000000_recruiter_talent.sql |

## public.send_contact_request(p_student uuid, p_role text, p_message text)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#send_contact_request]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.send_contact_request(p_student uuid, p_role text, p_message text) | sql | false | search_path="" | authenticated, service_role | 20261014000000_recruiter_talent.sql |

## public.shortlist_get(p_list uuid)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#shortlist_get]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.shortlist_get(p_list uuid) | sql | false | search_path="" | authenticated, service_role | 20261014000000_recruiter_talent.sql |

## public.shortlists_list()

[src: supabase/migrations/20261014000000_recruiter_talent.sql#shortlists_list]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.shortlists_list() | sql | false | search_path="" | authenticated, service_role | 20261014000000_recruiter_talent.sql |

## public.talent_explore(p_filters jsonb, p_offset integer)

[src: supabase/migrations/20261014000000_recruiter_talent.sql#talent_explore]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.talent_explore(p_filters jsonb, p_offset integer) | sql | false | search_path="" | authenticated, service_role | 20261014000000_recruiter_talent.sql |

## public.talent_facets()

[src: supabase/migrations/20261014000000_recruiter_talent.sql#talent_facets]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.talent_facets() | sql | false | search_path="" | authenticated, service_role | 20261014000000_recruiter_talent.sql |

## public.contact_requests

[src: supabase/migrations/20261014000000_recruiter_talent.sql#contact_requests]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| org_id | uuid | true | — |  |  | — |
| recruiter_id | uuid | false | — |  |  | — |
| student_id | uuid | true | — |  |  | — |
| role_title | text | true | — |  |  | "default" |
| message | text | true | — |  |  | "default" |
| status | contact_status | true | 'pending'::contact_status |  |  | — |
| decline_reason | text | false | — |  |  | "default" |
| thread_id | uuid | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| expires_at | timestamp with time zone | true | — |  |  | — |
| decided_at | timestamp with time zone | false | — |  |  | — |
| closed_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
contact_requests_decline_reason_check: CHECK (decline_reason IS NULL OR char_length(decline_reason) <= 500); -- validated: true
```

```sql
contact_requests_message_check: CHECK (char_length(message) >= 50 AND char_length(message) <= 1000); -- validated: true
```

```sql
contact_requests_org_id_fkey: FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE; -- validated: true
```

```sql
contact_requests_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
contact_requests_recruiter_id_fkey: FOREIGN KEY (recruiter_id) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
contact_requests_role_title_check: CHECK (char_length(btrim(role_title)) >= 2 AND char_length(btrim(role_title)) <= 80); -- validated: true
```

```sql
contact_requests_student_id_fkey: FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
contact_requests_thread_id_fkey: FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE SET NULL; -- validated: true
```

### Indexes

```sql
CREATE INDEX contact_requests_org_idx ON public.contact_requests USING btree (org_id, created_at DESC); -- valid: true
```

```sql
CREATE INDEX contact_requests_pending_expiry_idx ON public.contact_requests USING btree (expires_at) WHERE (status = 'pending'::contact_status); -- valid: true
```

```sql
CREATE UNIQUE INDEX contact_requests_pending_idx ON public.contact_requests USING btree (org_id, student_id) WHERE (status = 'pending'::contact_status); -- valid: true
```

```sql
CREATE UNIQUE INDEX contact_requests_pkey ON public.contact_requests USING btree (id); -- valid: true
```

```sql
CREATE INDEX contact_requests_recruiter_idx ON public.contact_requests USING btree (recruiter_id, created_at DESC); -- valid: true
```

```sql
CREATE INDEX contact_requests_student_idx ON public.contact_requests USING btree (student_id, created_at DESC); -- valid: true
```

### Policies

None.

### Triggers

```sql
CREATE TRIGGER contact_requests_accepted AFTER UPDATE OF status ON contact_requests FOR EACH ROW EXECUTE FUNCTION private.contact_accepted_event(); -- enabled: O
```

```sql
CREATE TRIGGER contact_requests_analytics_accepted AFTER UPDATE OF status ON contact_requests FOR EACH ROW WHEN (new.status = 'accepted'::contact_status AND old.status IS DISTINCT FROM 'accepted'::contact_status) EXECUTE FUNCTION private.analytics_contact_accepted(); -- enabled: O
```

```sql
CREATE TRIGGER contact_requests_analytics_sent AFTER INSERT ON contact_requests FOR EACH ROW EXECUTE FUNCTION private.analytics_contact_sent(); -- enabled: O
```

```sql
CREATE TRIGGER org_throttle_check BEFORE INSERT ON contact_requests FOR EACH ROW EXECUTE FUNCTION private.org_throttle_check(); -- enabled: O
```

```sql
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON contact_requests FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```

## public.org_events

[src: supabase/migrations/20261014000000_recruiter_talent.sql#org_events]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint | true | — | a |  | — |
| org_id | uuid | true | — |  |  | — |
| actor_id | uuid | false | — |  |  | — |
| student_id | uuid | false | — |  |  | — |
| kind | text | true | — |  |  | "default" |
| at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
org_events_actor_id_fkey: FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
org_events_kind_check: CHECK (kind = ANY (ARRAY['viewed'::text, 'contact_sent'::text, 'shortlisted'::text, 'noted'::text, 'invited_to_apply'::text, 'hired'::text])); -- validated: true
```

```sql
org_events_org_id_fkey: FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE; -- validated: true
```

```sql
org_events_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
org_events_student_id_fkey: FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX org_events_org_idx ON public.org_events USING btree (org_id, at DESC); -- valid: true
```

```sql
CREATE UNIQUE INDEX org_events_pkey ON public.org_events USING btree (id); -- valid: true
```

```sql
CREATE INDEX org_events_student_idx ON public.org_events USING btree (org_id, student_id, at DESC); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.profile_views

[src: supabase/migrations/20261014000000_recruiter_talent.sql#profile_views]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint | true | — | a |  | — |
| org_id | uuid | true | — |  |  | — |
| student_id | uuid | true | — |  |  | — |
| viewer_id | uuid | false | — |  |  | — |
| day | date | true | ((now() AT TIME ZONE 'utc'::text))::date |  |  | — |
| at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
profile_views_org_id_fkey: FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE; -- validated: true
```

```sql
profile_views_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
profile_views_student_id_fkey: FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
profile_views_viewer_id_fkey: FOREIGN KEY (viewer_id) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
profile_views_viewer_id_student_id_day_key: UNIQUE (viewer_id, student_id, day); -- validated: true
```

### Indexes

```sql
CREATE INDEX profile_views_org_idx ON public.profile_views USING btree (org_id, at DESC); -- valid: true
```

```sql
CREATE UNIQUE INDEX profile_views_pkey ON public.profile_views USING btree (id); -- valid: true
```

```sql
CREATE INDEX profile_views_student_idx ON public.profile_views USING btree (student_id, at DESC); -- valid: true
```

```sql
CREATE UNIQUE INDEX profile_views_viewer_id_student_id_day_key ON public.profile_views USING btree (viewer_id, student_id, day); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.recruiter_notes

[src: supabase/migrations/20261014000000_recruiter_talent.sql#recruiter_notes]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| org_id | uuid | true | — |  |  | — |
| student_id | uuid | false | — |  |  | — |
| author_id | uuid | false | — |  |  | — |
| body | text | true | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
recruiter_notes_author_id_fkey: FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
recruiter_notes_body_check: CHECK (char_length(btrim(body)) >= 1 AND char_length(btrim(body)) <= 2000); -- validated: true
```

```sql
recruiter_notes_org_id_fkey: FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE; -- validated: true
```

```sql
recruiter_notes_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
recruiter_notes_student_id_fkey: FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX recruiter_notes_pkey ON public.recruiter_notes USING btree (id); -- valid: true
```

```sql
CREATE INDEX recruiter_notes_student_idx ON public.recruiter_notes USING btree (org_id, student_id, created_at DESC); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.recruiter_shortlists

[src: supabase/migrations/20261014000000_recruiter_talent.sql#recruiter_shortlists]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| org_id | uuid | true | — |  |  | — |
| name | text | true | — |  |  | "default" |
| created_by | uuid | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
recruiter_shortlists_created_by_fkey: FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
recruiter_shortlists_name_check: CHECK (char_length(btrim(name)) >= 1 AND char_length(btrim(name)) <= 60); -- validated: true
```

```sql
recruiter_shortlists_org_id_fkey: FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE; -- validated: true
```

```sql
recruiter_shortlists_pkey: PRIMARY KEY (id); -- validated: true
```

### Indexes

```sql
CREATE INDEX recruiter_shortlists_org_idx ON public.recruiter_shortlists USING btree (org_id, created_at); -- valid: true
```

```sql
CREATE UNIQUE INDEX recruiter_shortlists_pkey ON public.recruiter_shortlists USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.saved_searches

[src: supabase/migrations/20261014000000_recruiter_talent.sql#saved_searches]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| org_id | uuid | true | — |  |  | — |
| user_id | uuid | true | — |  |  | — |
| name | text | true | — |  |  | "default" |
| filters | jsonb | true | — |  |  | — |
| frequency | text | true | — |  |  | "default" |
| last_run_at | timestamp with time zone | true | now() |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
saved_searches_frequency_check: CHECK (frequency = ANY (ARRAY['daily'::text, 'weekly'::text])); -- validated: true
```

```sql
saved_searches_name_check: CHECK (char_length(btrim(name)) >= 1 AND char_length(btrim(name)) <= 60); -- validated: true
```

```sql
saved_searches_org_id_fkey: FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE; -- validated: true
```

```sql
saved_searches_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
saved_searches_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX saved_searches_due_idx ON public.saved_searches USING btree (last_run_at); -- valid: true
```

```sql
CREATE UNIQUE INDEX saved_searches_pkey ON public.saved_searches USING btree (id); -- valid: true
```

```sql
CREATE INDEX saved_searches_user_idx ON public.saved_searches USING btree (user_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.search_audit

[src: supabase/migrations/20261014000000_recruiter_talent.sql#search_audit]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint | true | — | a |  | — |
| org_id | uuid | true | — |  |  | — |
| user_id | uuid | false | — |  |  | — |
| mode | text | true | — |  |  | "default" |
| filters | jsonb | true | — |  |  | — |
| result_count | integer | true | — |  |  | — |
| at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
search_audit_mode_check: CHECK (mode = ANY (ARRAY['explore'::text, 'full'::text])); -- validated: true
```

```sql
search_audit_org_id_fkey: FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE; -- validated: true
```

```sql
search_audit_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
search_audit_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

### Indexes

```sql
CREATE INDEX search_audit_org_idx ON public.search_audit USING btree (org_id, at DESC); -- valid: true
```

```sql
CREATE UNIQUE INDEX search_audit_pkey ON public.search_audit USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.shortlist_items

[src: supabase/migrations/20261014000000_recruiter_talent.sql#shortlist_items]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| shortlist_id | uuid | true | — |  |  | — |
| student_id | uuid | true | — |  |  | — |
| position | integer | true | 0 |  |  | — |
| added_by | uuid | false | — |  |  | — |
| hidden | boolean | true | false |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
shortlist_items_added_by_fkey: FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
shortlist_items_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
shortlist_items_shortlist_id_fkey: FOREIGN KEY (shortlist_id) REFERENCES recruiter_shortlists(id) ON DELETE CASCADE; -- validated: true
```

```sql
shortlist_items_shortlist_id_student_id_key: UNIQUE (shortlist_id, student_id); -- validated: true
```

```sql
shortlist_items_student_id_fkey: FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX shortlist_items_pkey ON public.shortlist_items USING btree (id); -- valid: true
```

```sql
CREATE UNIQUE INDEX shortlist_items_shortlist_id_student_id_key ON public.shortlist_items USING btree (shortlist_id, student_id); -- valid: true
```

```sql
CREATE INDEX shortlist_items_student_idx ON public.shortlist_items USING btree (student_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.talent_index

[src: supabase/migrations/20261014000000_recruiter_talent.sql#talent_index]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| student_id | uuid | true | — |  |  | — |
| university_id | uuid | true | — |  |  | — |
| department | text | false | — |  |  | "default" |
| graduation_year | smallint | false | — |  |  | — |
| tier | ranking_tier | false | — |  |  | — |
| skills | jsonb | true | '{}'::jsonb |  |  | — |
| checked_skills | text[] | true | '{}'::text[] |  |  | "default" |
| last_active_at | timestamp with time zone | false | — |  |  | — |
| looking_for | text[] | true | '{}'::text[] |  |  | "default" |
| availability | text[] | true | '{}'::text[] |  |  | "default" |
| city | text | false | — |  |  | "default" |
| remote_ok | boolean | true | false |  |  | — |
| first_indexed_at | timestamp with time zone | true | now() |  |  | — |
| refreshed_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
talent_index_pkey: PRIMARY KEY (student_id); -- validated: true
```

```sql
talent_index_student_id_fkey: FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
talent_index_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX talent_index_active_idx ON public.talent_index USING btree (last_active_at DESC); -- valid: true
```

```sql
CREATE UNIQUE INDEX talent_index_pkey ON public.talent_index USING btree (student_id); -- valid: true
```

```sql
CREATE INDEX talent_index_skills_idx ON public.talent_index USING gin (skills); -- valid: true
```

```sql
CREATE INDEX talent_index_tier_idx ON public.talent_index USING btree (tier); -- valid: true
```

```sql
CREATE INDEX talent_index_university_idx ON public.talent_index USING btree (university_id); -- valid: true
```

### Policies

None.

### Triggers

None.
