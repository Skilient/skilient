Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# phase3_answers

## private.avatar_cleanup()

[src: supabase/migrations/20260930000000_phase3_answers.sql#avatar_cleanup]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.avatar_cleanup() | plpgsql | true | search_path="" | None | 20260930000000_phase3_answers.sql |

## private.chat_media_cleanup()

[src: supabase/migrations/20260930000000_phase3_answers.sql#chat_media_cleanup]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.chat_media_cleanup() | plpgsql | true | search_path="" | None | 20260930000000_phase3_answers.sql |

## private.my_moderation_notice(p_case uuid)

[src: supabase/migrations/20260930000000_phase3_answers.sql#my_moderation_notice]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_moderation_notice(p_case uuid) | sql | true | search_path="" | authenticated | 20260930000000_phase3_answers.sql |

## private.post_media_cleanup()

[src: supabase/migrations/20260930000000_phase3_answers.sql#post_media_cleanup]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.post_media_cleanup() | plpgsql | true | search_path="" | None | 20260930000000_phase3_answers.sql |

## private.post_removed_cleanup()

[src: supabase/migrations/20260930000000_phase3_answers.sql#post_removed_cleanup]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.post_removed_cleanup() | plpgsql | true | search_path="" | None | 20260930000000_phase3_answers.sql |

## private.search_people(p_q text, p_department text, p_skill text, p_university text, p_offset integer, p_batch smallint)

[src: supabase/migrations/20260930000000_phase3_answers.sql#search_people]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.search_people(p_q text, p_department text, p_skill text, p_university text, p_offset integer, p_batch smallint) | plpgsql | true | search_path="" | authenticated | 20260930000000_phase3_answers.sql |

## private.toggle_reaction(p_message uuid, p_emoji text)

[src: supabase/migrations/20260930000000_phase3_answers.sql#toggle_reaction]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.toggle_reaction(p_message uuid, p_emoji text) | plpgsql | true | search_path="" | authenticated | 20260930000000_phase3_answers.sql |

## private.wake_storage_cleanup_worker()

[src: supabase/migrations/20260930000000_phase3_answers.sql#wake_storage_cleanup_worker]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.wake_storage_cleanup_worker() | plpgsql | true | search_path="" | None | 20260930000000_phase3_answers.sql |

## public.my_moderation_notice(p_case uuid)

[src: supabase/migrations/20260930000000_phase3_answers.sql#my_moderation_notice]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_moderation_notice(p_case uuid) | sql | false | search_path="" | authenticated, service_role | 20260930000000_phase3_answers.sql |

## public.search_people(p_q text, p_department text, p_skill text, p_university text, p_offset integer, p_batch smallint)

[src: supabase/migrations/20260930000000_phase3_answers.sql#search_people]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.search_people(p_q text, p_department text, p_skill text, p_university text, p_offset integer, p_batch smallint) | sql | false | search_path="" | authenticated, service_role | 20260930000000_phase3_answers.sql |
