Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# uni_ecosphere

## private.answer_uni_question(p_question uuid, p_option integer)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#answer_uni_question]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.answer_uni_question(p_question uuid, p_option integer) | plpgsql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.archive_badge(p_id uuid)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#archive_badge]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.archive_badge(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.award_badge(p_badge uuid, p_student text, p_note text)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#award_badge]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.award_badge(p_badge uuid, p_student text, p_note text) | plpgsql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.awards_for(p_user uuid)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#awards_for]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.awards_for(p_user uuid) | sql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.brand_colour_error(p_colours jsonb)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#brand_colour_error]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.brand_colour_error(p_colours jsonb) | plpgsql | false | search_path="" | None | 20261018000000_uni_ecosphere.sql |

## private.contrast_ratio(p_a text, p_b text)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#contrast_ratio]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.contrast_ratio(p_a text, p_b text) | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## private.cv_snapshot(p_user uuid)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#cv_snapshot]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.cv_snapshot(p_user uuid) | plpgsql | true | search_path="" | None | 20261018000000_uni_ecosphere.sql |

## private.delete_ecosphere_page(p_id uuid)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#delete_ecosphere_page]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.delete_ecosphere_page(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.ecosphere_home(p_slug text)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#ecosphere_home]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ecosphere_home(p_slug text) | plpgsql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.ecosphere_page(p_slug text, p_page text)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#ecosphere_page]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ecosphere_page(p_slug text, p_page text) | plpgsql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.ensure_ecosphere(p_university uuid)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#ensure_ecosphere]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ensure_ecosphere(p_university uuid) | sql | true | search_path="" | None | 20261018000000_uni_ecosphere.sql |

## private.hex_luminance(p_hex text)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#hex_luminance]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.hex_luminance(p_hex text) | plpgsql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## private.is_uni_member(p_university uuid)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#is_uni_member]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.is_uni_member(p_university uuid) | sql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.my_ecosphere()

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#my_ecosphere]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_ecosphere() | sql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.my_uni_questions()

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#my_uni_questions]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_uni_questions() | sql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.ops_uni_questions()

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#ops_uni_questions]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_uni_questions() | plpgsql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.page_blocks_error(p_university uuid, p_blocks jsonb)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#page_blocks_error]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.page_blocks_error(p_university uuid, p_blocks jsonb) | plpgsql | false | search_path="" | None | 20261018000000_uni_ecosphere.sql |

## private.posts_feed_module()

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#posts_feed_module]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.posts_feed_module() | plpgsql | true | search_path="" | None | 20261018000000_uni_ecosphere.sql |

## private.remove_uni_question(p_id uuid)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#remove_uni_question]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.remove_uni_question(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.revoke_award(p_award uuid)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#revoke_award]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.revoke_award(p_award uuid) | plpgsql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.save_badge(p_id uuid, p jsonb)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#save_badge]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.save_badge(p_id uuid, p jsonb) | plpgsql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.save_branding(p jsonb)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#save_branding]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.save_branding(p jsonb) | plpgsql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.save_ecosphere_modules(p jsonb)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#save_ecosphere_modules]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.save_ecosphere_modules(p jsonb) | plpgsql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.save_ecosphere_page(p_id uuid, p jsonb)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#save_ecosphere_page]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.save_ecosphere_page(p_id uuid, p jsonb) | plpgsql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.save_ecosphere_structure(p_labels jsonb, p_categories text[])

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#save_ecosphere_structure]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.save_ecosphere_structure(p_labels jsonb, p_categories text[]) | plpgsql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.save_uni_question(p_prompt text, p_options jsonb)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#save_uni_question]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.save_uni_question(p_prompt text, p_options jsonb) | plpgsql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.sensitive_topic(p_text text)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#sensitive_topic]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.sensitive_topic(p_text text) | sql | false | search_path="" | None | 20261018000000_uni_ecosphere.sql |

## private.set_branding_image(p_kind text, p_path text)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#set_branding_image]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.set_branding_image(p_kind text, p_path text) | plpgsql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.set_ui_state(p_key text, p_value jsonb)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#set_ui_state]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.set_ui_state(p_key text, p_value jsonb) | plpgsql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.uni_add_exam_period(p_starts date, p_ends date, p_reason text)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#uni_add_exam_period]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_add_exam_period(p_starts date, p_ends date, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.uni_badges()

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#uni_badges]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_badges() | plpgsql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.uni_calendar()

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#uni_calendar]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_calendar() | plpgsql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.uni_change_slug(p_slug text)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#uni_change_slug]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_change_slug(p_slug text) | plpgsql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.uni_daily()

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#uni_daily]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_daily() | plpgsql | true | search_path="" | None | 20261018000000_uni_ecosphere.sql |

## private.uni_delete_semester(p_id uuid)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#uni_delete_semester]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_delete_semester(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.uni_ecosphere()

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#uni_ecosphere]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_ecosphere() | plpgsql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.uni_feature_options()

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#uni_feature_options]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_feature_options() | plpgsql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.uni_media_cleanup()

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#uni_media_cleanup]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_media_cleanup() | plpgsql | true | search_path="" | None | 20261018000000_uni_ecosphere.sql |

## private.uni_media_writer(p_name text)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#uni_media_writer]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_media_writer(p_name text) | sql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.uni_module(p_university uuid, p_key text)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#uni_module]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_module(p_university uuid, p_key text) | sql | true | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## private.uni_questions()

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#uni_questions]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_questions() | plpgsql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.uni_remove_exam_period(p_id uuid, p_reason text)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#uni_remove_exam_period]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_remove_exam_period(p_id uuid, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## private.uni_save_semester(p_name text, p_starts date, p_ends date)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#uni_save_semester]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_save_semester(p_name text, p_starts date, p_ends date) | plpgsql | true | search_path="" | authenticated | 20261018000000_uni_ecosphere.sql |

## public.answer_uni_question(p_question uuid, p_option integer)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#answer_uni_question]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.answer_uni_question(p_question uuid, p_option integer) | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.archive_badge(p_id uuid)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#archive_badge]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.archive_badge(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.award_badge(p_badge uuid, p_student text, p_note text)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#award_badge]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.award_badge(p_badge uuid, p_student text, p_note text) | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.awards_for(p_user uuid)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#awards_for]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.awards_for(p_user uuid) | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.delete_ecosphere_page(p_id uuid)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#delete_ecosphere_page]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.delete_ecosphere_page(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.ecosphere_home(p_slug text)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#ecosphere_home]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ecosphere_home(p_slug text) | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.ecosphere_page(p_slug text, p_page text)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#ecosphere_page]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ecosphere_page(p_slug text, p_page text) | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.my_ecosphere()

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#my_ecosphere]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_ecosphere() | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.my_uni_questions()

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#my_uni_questions]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_uni_questions() | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.ops_remove_uni_question(p_id uuid, p_reason text)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#ops_remove_uni_question]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_remove_uni_question(p_id uuid, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.ops_uni_questions()

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#ops_uni_questions]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_uni_questions() | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.remove_uni_question(p_id uuid)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#remove_uni_question]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.remove_uni_question(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.revoke_award(p_award uuid)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#revoke_award]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.revoke_award(p_award uuid) | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.save_badge(p_id uuid, p jsonb)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#save_badge]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.save_badge(p_id uuid, p jsonb) | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.save_branding(p jsonb)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#save_branding]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.save_branding(p jsonb) | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.save_ecosphere_modules(p jsonb)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#save_ecosphere_modules]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.save_ecosphere_modules(p jsonb) | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.save_ecosphere_page(p_id uuid, p jsonb)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#save_ecosphere_page]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.save_ecosphere_page(p_id uuid, p jsonb) | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.save_ecosphere_structure(p_labels jsonb, p_categories text[])

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#save_ecosphere_structure]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.save_ecosphere_structure(p_labels jsonb, p_categories text[]) | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.save_uni_question(p_prompt text, p_options jsonb)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#save_uni_question]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.save_uni_question(p_prompt text, p_options jsonb) | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.set_branding_image(p_kind text, p_path text)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#set_branding_image]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.set_branding_image(p_kind text, p_path text) | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.uni_add_exam_period(p_starts date, p_ends date, p_reason text)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#uni_add_exam_period]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_add_exam_period(p_starts date, p_ends date, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.uni_badges()

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#uni_badges]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_badges() | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.uni_calendar()

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#uni_calendar]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_calendar() | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.uni_change_slug(p_slug text)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#uni_change_slug]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_change_slug(p_slug text) | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.uni_delete_semester(p_id uuid)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#uni_delete_semester]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_delete_semester(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.uni_ecosphere()

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#uni_ecosphere]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_ecosphere() | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.uni_feature_options()

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#uni_feature_options]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_feature_options() | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.uni_questions()

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#uni_questions]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_questions() | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.uni_remove_exam_period(p_id uuid, p_reason text)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#uni_remove_exam_period]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_remove_exam_period(p_id uuid, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.uni_save_semester(p_name text, p_starts date, p_ends date)

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#uni_save_semester]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_save_semester(p_name text, p_starts date, p_ends date) | sql | false | search_path="" | authenticated, service_role | 20261018000000_uni_ecosphere.sql |

## public.badge_awards

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#badge_awards]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| badge_id | uuid | true | — |  |  | — |
| student_id | uuid | true | — |  |  | — |
| awarded_by | uuid | false | — |  |  | — |
| note | text | false | — |  |  | "default" |
| awarded_at | timestamp with time zone | true | now() |  |  | — |
| revoked_at | timestamp with time zone | false | — |  |  | — |
| revoked_by | uuid | false | — |  |  | — |

### Keys and constraints

```sql
badge_awards_awarded_by_fkey: FOREIGN KEY (awarded_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
badge_awards_badge_id_fkey: FOREIGN KEY (badge_id) REFERENCES university_badges(id) ON DELETE CASCADE; -- validated: true
```

```sql
badge_awards_note_check: CHECK (note IS NULL OR char_length(note) <= 300); -- validated: true
```

```sql
badge_awards_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
badge_awards_revoked_by_fkey: FOREIGN KEY (revoked_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
badge_awards_student_id_fkey: FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX badge_awards_active_idx ON public.badge_awards USING btree (badge_id, student_id) WHERE (revoked_at IS NULL); -- valid: true
```

```sql
CREATE INDEX badge_awards_awarded_by_idx ON public.badge_awards USING btree (awarded_by); -- valid: true
```

```sql
CREATE UNIQUE INDEX badge_awards_pkey ON public.badge_awards USING btree (id); -- valid: true
```

```sql
CREATE INDEX badge_awards_revoked_by_idx ON public.badge_awards USING btree (revoked_by); -- valid: true
```

```sql
CREATE INDEX badge_awards_student_idx ON public.badge_awards USING btree (student_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.ecosphere_config

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#ecosphere_config]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| university_id | uuid | true | — |  |  | — |
| modules | jsonb | true | '{"feed": true, "ideas": true, "events": true, "teachers": true, "job_board": true, "leaderboard": true}'::jsonb |  |  | — |
| branding | jsonb | true | '{}'::jsonb |  |  | — |
| welcome | text | false | — |  |  | "default" |
| batch_labels | jsonb | true | '{}'::jsonb |  |  | — |
| announcement_categories | text[] | true | '{}'::text[] |  |  | "default" |
| updated_by | uuid | false | — |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
ecosphere_config_announcement_categories_check: CHECK (cardinality(announcement_categories) <= 20); -- validated: true
```

```sql
ecosphere_config_batch_labels_check: CHECK (jsonb_typeof(batch_labels) = 'object'::text); -- validated: true
```

```sql
ecosphere_config_branding_check: CHECK (jsonb_typeof(branding) = 'object'::text); -- validated: true
```

```sql
ecosphere_config_modules_check: CHECK (jsonb_typeof(modules) = 'object'::text); -- validated: true
```

```sql
ecosphere_config_pkey: PRIMARY KEY (university_id); -- validated: true
```

```sql
ecosphere_config_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE; -- validated: true
```

```sql
ecosphere_config_updated_by_fkey: FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
ecosphere_config_welcome_check: CHECK (welcome IS NULL OR char_length(welcome) <= 1000); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX ecosphere_config_pkey ON public.ecosphere_config USING btree (university_id); -- valid: true
```

```sql
CREATE INDEX ecosphere_config_updated_by_idx ON public.ecosphere_config USING btree (updated_by); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.ecosphere_pages

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#ecosphere_pages]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| university_id | uuid | true | — |  |  | — |
| slug | text | true | — |  |  | "default" |
| title | text | true | — |  |  | "default" |
| blocks | jsonb | true | '[]'::jsonb |  |  | — |
| published | boolean | true | false |  |  | — |
| position | smallint | true | 1 |  |  | — |
| updated_by | uuid | false | — |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
ecosphere_pages_blocks_check: CHECK (jsonb_typeof(blocks) = 'array'::text); -- validated: true
```

```sql
ecosphere_pages_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
ecosphere_pages_position_check: CHECK ("position" >= 1 AND "position" <= 10); -- validated: true
```

```sql
ecosphere_pages_slug_check: CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text AND char_length(slug) <= 40); -- validated: true
```

```sql
ecosphere_pages_title_check: CHECK (char_length(btrim(title)) >= 2 AND char_length(btrim(title)) <= 80); -- validated: true
```

```sql
ecosphere_pages_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE; -- validated: true
```

```sql
ecosphere_pages_university_id_slug_key: UNIQUE (university_id, slug); -- validated: true
```

```sql
ecosphere_pages_updated_by_fkey: FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX ecosphere_pages_pkey ON public.ecosphere_pages USING btree (id); -- valid: true
```

```sql
CREATE UNIQUE INDEX ecosphere_pages_university_id_slug_key ON public.ecosphere_pages USING btree (university_id, slug); -- valid: true
```

```sql
CREATE INDEX ecosphere_pages_updated_by_idx ON public.ecosphere_pages USING btree (updated_by); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.semesters

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#semesters]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| university_id | uuid | true | — |  |  | — |
| name | text | true | — |  |  | "default" |
| starts_on | date | true | — |  |  | — |
| ends_on | date | true | — |  |  | — |
| created_by | uuid | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
semesters_check: CHECK (ends_on > starts_on AND (ends_on - starts_on) <= 366); -- validated: true
```

```sql
semesters_created_by_fkey: FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
semesters_name_check: CHECK (char_length(btrim(name)) >= 2 AND char_length(btrim(name)) <= 60); -- validated: true
```

```sql
semesters_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
semesters_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX semesters_created_by_idx ON public.semesters USING btree (created_by); -- valid: true
```

```sql
CREATE UNIQUE INDEX semesters_pkey ON public.semesters USING btree (id); -- valid: true
```

```sql
CREATE INDEX semesters_uni_idx ON public.semesters USING btree (university_id, starts_on); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.university_badges

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#university_badges]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| university_id | uuid | true | — |  |  | — |
| name | text | true | — |  |  | "default" |
| description | text | false | — |  |  | "default" |
| icon | text | true | 'trophy'::text |  |  | "default" |
| created_by | uuid | false | — |  |  | — |
| archived_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
university_badges_created_by_fkey: FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
university_badges_description_check: CHECK (description IS NULL OR char_length(description) <= 300); -- validated: true
```

```sql
university_badges_icon_check: CHECK (icon = ANY (ARRAY['trophy'::text, 'medal'::text, 'star'::text, 'certificate'::text, 'lightbulb'::text, 'rocket'::text, 'code'::text, 'users'::text, 'flask'::text, 'globe'::text])); -- validated: true
```

```sql
university_badges_name_check: CHECK (char_length(btrim(name)) >= 2 AND char_length(btrim(name)) <= 60); -- validated: true
```

```sql
university_badges_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
university_badges_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX university_badges_created_by_idx ON public.university_badges USING btree (created_by); -- valid: true
```

```sql
CREATE UNIQUE INDEX university_badges_name_idx ON public.university_badges USING btree (university_id, lower(name)) WHERE (archived_at IS NULL); -- valid: true
```

```sql
CREATE UNIQUE INDEX university_badges_pkey ON public.university_badges USING btree (id); -- valid: true
```

```sql
CREATE INDEX university_badges_uni_idx ON public.university_badges USING btree (university_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.university_question_answers

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#university_question_answers]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| question_id | uuid | true | — |  |  | — |
| user_id | uuid | true | — |  |  | — |
| option_index | smallint | true | — |  |  | — |
| answered_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
university_question_answers_option_index_check: CHECK (option_index >= 0 AND option_index <= 5); -- validated: true
```

```sql
university_question_answers_pkey: PRIMARY KEY (question_id, user_id); -- validated: true
```

```sql
university_question_answers_question_id_fkey: FOREIGN KEY (question_id) REFERENCES university_questions(id) ON DELETE CASCADE; -- validated: true
```

```sql
university_question_answers_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX university_question_answers_pkey ON public.university_question_answers USING btree (question_id, user_id); -- valid: true
```

```sql
CREATE INDEX university_question_answers_user_idx ON public.university_question_answers USING btree (user_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.university_questions

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#university_questions]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| university_id | uuid | true | — |  |  | — |
| prompt | text | true | — |  |  | "default" |
| options | jsonb | true | — |  |  | — |
| created_by | uuid | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| removed_at | timestamp with time zone | false | — |  |  | — |
| removed_by | uuid | false | — |  |  | — |
| removed_reason | text | false | — |  |  | "default" |
| removed_by_staff | boolean | true | false |  |  | — |

### Keys and constraints

```sql
university_questions_created_by_fkey: FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
university_questions_options_check: CHECK (jsonb_typeof(options) = 'array'::text AND jsonb_array_length(options) >= 2 AND jsonb_array_length(options) <= 6); -- validated: true
```

```sql
university_questions_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
university_questions_prompt_check: CHECK (char_length(btrim(prompt)) >= 5 AND char_length(btrim(prompt)) <= 200); -- validated: true
```

```sql
university_questions_removed_by_fkey: FOREIGN KEY (removed_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
university_questions_removed_reason_check: CHECK (removed_reason IS NULL OR char_length(removed_reason) <= 500); -- validated: true
```

```sql
university_questions_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX university_questions_created_by_idx ON public.university_questions USING btree (created_by); -- valid: true
```

```sql
CREATE UNIQUE INDEX university_questions_pkey ON public.university_questions USING btree (id); -- valid: true
```

```sql
CREATE INDEX university_questions_removed_by_idx ON public.university_questions USING btree (removed_by); -- valid: true
```

```sql
CREATE INDEX university_questions_uni_idx ON public.university_questions USING btree (university_id) WHERE (removed_at IS NULL); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.university_slug_history

[src: supabase/migrations/20261018000000_uni_ecosphere.sql#university_slug_history]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| slug | text | true | — |  |  | "default" |
| university_id | uuid | true | — |  |  | — |
| released_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
university_slug_history_pkey: PRIMARY KEY (slug); -- validated: true
```

```sql
university_slug_history_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX university_slug_history_pkey ON public.university_slug_history USING btree (slug); -- valid: true
```

```sql
CREATE INDEX university_slug_history_uni_idx ON public.university_slug_history USING btree (university_id); -- valid: true
```

### Policies

None.

### Triggers

None.
