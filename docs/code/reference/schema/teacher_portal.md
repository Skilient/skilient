Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# teacher_portal

## private.approve_teacher(p_user uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#approve_teacher]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.approve_teacher(p_user uuid) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.can_view_venture(p_venture uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#can_view_venture]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.can_view_venture(p_venture uuid) | sql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.close_review_request(p_request uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#close_review_request]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.close_review_request(p_request uuid) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.code_check_queue(p_status text)

[src: supabase/migrations/20261012000000_teacher_portal.sql#code_check_queue]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.code_check_queue(p_status text) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.code_check_snippet_access(p_check uuid, p_user uuid, p_aal text)

[src: supabase/migrations/20261012000000_teacher_portal.sql#code_check_snippet_access]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.code_check_snippet_access(p_check uuid, p_user uuid, p_aal text) | sql | true | search_path="" | None | 20261012000000_teacher_portal.sql |

## private.code_checks_route()

[src: supabase/migrations/20261012000000_teacher_portal.sql#code_checks_route]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.code_checks_route() | plpgsql | true | search_path="" | None | 20261012000000_teacher_portal.sql |

## private.compute_ranking(p_user uuid, p_as_of timestamp with time zone, p_f jsonb, p_prev_peak numeric)

[src: supabase/migrations/20261012000000_teacher_portal.sql#compute_ranking]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.compute_ranking(p_user uuid, p_as_of timestamp with time zone, p_f jsonb, p_prev_peak numeric) | plpgsql | true | search_path="" | None | 20261012000000_teacher_portal.sql |

## private.detect_rings(p_f jsonb)

[src: supabase/migrations/20261012000000_teacher_portal.sql#detect_rings]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.detect_rings(p_f jsonb) | plpgsql | true | search_path="" | None | 20261012000000_teacher_portal.sql |

## private.detect_rings_base(p_f jsonb)

[src: supabase/migrations/20261012000000_teacher_portal.sql#detect_rings_base]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.detect_rings_base(p_f jsonb) | plpgsql | true | search_path="" | None | 20261012000000_teacher_portal.sql |

## private.detect_teacher_concentration()

[src: supabase/migrations/20261012000000_teacher_portal.sql#detect_teacher_concentration]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.detect_teacher_concentration() | plpgsql | true | search_path="" | None | 20261012000000_teacher_portal.sql |

## private.domain_admits_faculty(p_domain text, p_university_id uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#domain_admits_faculty]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.domain_admits_faculty(p_domain text, p_university_id uuid) | sql | true | search_path="" | None | 20261012000000_teacher_portal.sql |

## private.end_supervision(p_venture uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#end_supervision]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.end_supervision(p_venture uuid) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.endorsements_for(p_user uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#endorsements_for]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.endorsements_for(p_user uuid) | sql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.idea_get(p_id uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#idea_get]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.idea_get(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.idea_is_open(i project_ideas)

[src: supabase/migrations/20261012000000_teacher_portal.sql#idea_is_open]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.idea_is_open(i project_ideas) | sql | true | search_path="" | None | 20261012000000_teacher_portal.sql |

## private.idea_json(i project_ideas)

[src: supabase/migrations/20261012000000_teacher_portal.sql#idea_json]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.idea_json(i project_ideas) | sql | true | search_path="" | None | 20261012000000_teacher_portal.sql |

## private.idea_teams(p_idea uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#idea_teams]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.idea_teams(p_idea uuid) | sql | true | search_path="" | None | 20261012000000_teacher_portal.sql |

## private.ideas_list(p_mine boolean, p_skill text, p_difficulty text, p_limit integer)

[src: supabase/migrations/20261012000000_teacher_portal.sql#ideas_list]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ideas_list(p_mine boolean, p_skill text, p_difficulty text, p_limit integer) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.import_faculty_csv(p_university uuid, p_rows jsonb)

[src: supabase/migrations/20261012000000_teacher_portal.sql#import_faculty_csv]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.import_faculty_csv(p_university uuid, p_rows jsonb) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.invite_supervisor(p_venture uuid, p_teacher uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#invite_supervisor]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.invite_supervisor(p_venture uuid, p_teacher uuid) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.is_approved_teacher(p_user uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#is_approved_teacher]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.is_approved_teacher(p_user uuid) | sql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.is_venture_supervisor(p_venture uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#is_venture_supervisor]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.is_venture_supervisor(p_venture uuid) | sql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.is_venture_teacher(p_venture uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#is_venture_teacher]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.is_venture_teacher(p_venture uuid) | sql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.notify_teacher_decided(p_user uuid, p_approved boolean)

[src: supabase/migrations/20261012000000_teacher_portal.sql#notify_teacher_decided]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.notify_teacher_decided(p_user uuid, p_approved boolean) | sql | true | search_path="" | None | 20261012000000_teacher_portal.sql |

## private.ops_universities()

[src: supabase/migrations/20261012000000_teacher_portal.sql#ops_universities]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_universities() | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.pk_week_start()

[src: supabase/migrations/20261012000000_teacher_portal.sql#pk_week_start]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.pk_week_start() | sql | false | search_path="" | None | 20261012000000_teacher_portal.sql |

## private.post_supervisor_comment(p_venture uuid, p_body text)

[src: supabase/migrations/20261012000000_teacher_portal.sql#post_supervisor_comment]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.post_supervisor_comment(p_venture uuid, p_body text) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.queue_teacher_digests()

[src: supabase/migrations/20261012000000_teacher_portal.sql#queue_teacher_digests]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.queue_teacher_digests() | plpgsql | true | search_path="" | None | 20261012000000_teacher_portal.sql |

## private.refresh_peer_verified(p_user uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#refresh_peer_verified]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.refresh_peer_verified(p_user uuid) | sql | true | search_path="" | None | 20261012000000_teacher_portal.sql |

## private.request_review(p_venture uuid, p_teacher uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#request_review]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.request_review(p_venture uuid, p_teacher uuid) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.request_teacher_role(p_department text, p_title text)

[src: supabase/migrations/20261012000000_teacher_portal.sql#request_teacher_role]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.request_teacher_role(p_department text, p_title text) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.require_accounts_or_admin(p_university uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#require_accounts_or_admin]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.require_accounts_or_admin(p_university uuid) | plpgsql | true | search_path="" | None | 20261012000000_teacher_portal.sql |

## private.require_teacher()

[src: supabase/migrations/20261012000000_teacher_portal.sql#require_teacher]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.require_teacher() | plpgsql | true | search_path="" | None | 20261012000000_teacher_portal.sql |

## private.respond_supervision(p_venture uuid, p_accept boolean)

[src: supabase/migrations/20261012000000_teacher_portal.sql#respond_supervision]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.respond_supervision(p_venture uuid, p_accept boolean) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.review_requests_for(p_venture uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#review_requests_for]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.review_requests_for(p_venture uuid) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.review_teacher_flag(p_id uuid, p_upheld boolean, p_reason text)

[src: supabase/migrations/20261012000000_teacher_portal.sql#review_teacher_flag]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.review_teacher_flag(p_id uuid, p_upheld boolean, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.revoke_teacher(p_user uuid, p_reason text)

[src: supabase/migrations/20261012000000_teacher_portal.sql#revoke_teacher]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.revoke_teacher(p_user uuid, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.save_idea(p_id uuid, p jsonb)

[src: supabase/migrations/20261012000000_teacher_portal.sql#save_idea]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.save_idea(p_id uuid, p jsonb) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.save_teacher_settings(p_opt_in boolean, p_cap integer, p_skills text[], p_digest boolean)

[src: supabase/migrations/20261012000000_teacher_portal.sql#save_teacher_settings]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.save_teacher_settings(p_opt_in boolean, p_cap integer, p_skills text[], p_digest boolean) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.score_endorsements(p_user uuid, p_f jsonb)

[src: supabase/migrations/20261012000000_teacher_portal.sql#score_endorsements]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.score_endorsements(p_user uuid, p_f jsonb) | plpgsql | true | search_path="" | None | 20261012000000_teacher_portal.sql |

## private.set_idea_status(p_id uuid, p_open boolean)

[src: supabase/migrations/20261012000000_teacher_portal.sql#set_idea_status]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.set_idea_status(p_id uuid, p_open boolean) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.start_review(p_venture uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#start_review]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.start_review(p_venture uuid) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.start_venture_from_idea(p_idea uuid, p jsonb)

[src: supabase/migrations/20261012000000_teacher_portal.sql#start_venture_from_idea]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.start_venture_from_idea(p_idea uuid, p jsonb) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.submit_review(p_request uuid, p_rubric jsonb, p_comments text)

[src: supabase/migrations/20261012000000_teacher_portal.sql#submit_review]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.submit_review(p_request uuid, p_rubric jsonb, p_comments text) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.supervision_for(p_venture uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#supervision_for]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.supervision_for(p_venture uuid) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.supervisor_confirm_contribution(p_entry uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#supervisor_confirm_contribution]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.supervisor_confirm_contribution(p_entry uuid) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.supervisor_thread(p_venture uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#supervisor_thread]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.supervisor_thread(p_venture uuid) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.teacher_claim_code_check(p_id uuid, p_claim boolean)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_claim_code_check]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.teacher_claim_code_check(p_id uuid, p_claim boolean) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.teacher_code_check_case(p_id uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_code_check_case]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.teacher_code_check_case(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.teacher_code_check_queue(p_status text)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_code_check_queue]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.teacher_code_check_queue(p_status text) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.teacher_conflict(p_teacher uuid, p_student uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_conflict]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.teacher_conflict(p_teacher uuid, p_student uuid) | sql | true | search_path="" | None | 20261012000000_teacher_portal.sql |

## private.teacher_contributions(p_venture uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_contributions]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.teacher_contributions(p_venture uuid) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.teacher_deliverables(p_venture uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_deliverables]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.teacher_deliverables(p_venture uuid) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.teacher_digest_data(p_user uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_digest_data]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.teacher_digest_data(p_user uuid) | sql | true | search_path="" | None | 20261012000000_teacher_portal.sql |

## private.teacher_endorse(p_endorsee uuid, p_venture uuid, p_items jsonb, p_note text)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_endorse]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.teacher_endorse(p_endorsee uuid, p_venture uuid, p_items jsonb, p_note text) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.teacher_endorse_options(p_venture uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_endorse_options]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.teacher_endorse_options(p_venture uuid) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.teacher_flag_queue(p_status text)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_flag_queue]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.teacher_flag_queue(p_status text) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.teacher_grade_code_check(p_id uuid, p_rubric jsonb, p_feedback text)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_grade_code_check]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.teacher_grade_code_check(p_id uuid, p_rubric jsonb, p_feedback text) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.teacher_home()

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_home]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.teacher_home() | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.teacher_limit(p_name text)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_limit]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.teacher_limit(p_name text) | sql | true | search_path="" | None | 20261012000000_teacher_portal.sql |

## private.teacher_may_endorse(p_teacher uuid, p_venture uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_may_endorse]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.teacher_may_endorse(p_teacher uuid, p_venture uuid) | sql | true | search_path="" | None | 20261012000000_teacher_portal.sql |

## private.teacher_reminders()

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_reminders]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.teacher_reminders() | plpgsql | true | search_path="" | None | 20261012000000_teacher_portal.sql |

## private.teacher_requests(p_status text)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_requests]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.teacher_requests(p_status text) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.teacher_review_request(p_request uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_review_request]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.teacher_review_request(p_request uuid) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.teacher_review_requests(p_status text)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_review_requests]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.teacher_review_requests(p_status text) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.teacher_settings_get()

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_settings_get]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.teacher_settings_get() | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.teacher_state()

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_state]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.teacher_state() | sql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.teacher_venture(p_venture uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_venture]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.teacher_venture(p_venture uuid) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.teacher_ventures()

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_ventures]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.teacher_ventures() | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.teacher_week_grading(p_user uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_week_grading]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.teacher_week_grading(p_user uuid) | sql | true | search_path="" | None | 20261012000000_teacher_portal.sql |

## private.teachers_available(p_student uuid, p_skill text)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teachers_available]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.teachers_available(p_student uuid, p_skill text) | sql | true | search_path="" | None | 20261012000000_teacher_portal.sql |

## private.teachers_for_venture(p_venture uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teachers_for_venture]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.teachers_for_venture(p_venture uuid) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## private.user_skills_peer_verified()

[src: supabase/migrations/20261012000000_teacher_portal.sql#user_skills_peer_verified]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.user_skills_peer_verified() | plpgsql | true | search_path="" | None | 20261012000000_teacher_portal.sql |

## private.venture_reviews_for(p_venture uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#venture_reviews_for]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.venture_reviews_for(p_venture uuid) | plpgsql | true | search_path="" | authenticated | 20261012000000_teacher_portal.sql |

## public.approve_teacher(p_user uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#approve_teacher]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.approve_teacher(p_user uuid) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.close_review_request(p_request uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#close_review_request]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.close_review_request(p_request uuid) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.end_supervision(p_venture uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#end_supervision]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.end_supervision(p_venture uuid) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.endorsements_for(p_user uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#endorsements_for]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.endorsements_for(p_user uuid) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.idea_get(p_id uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#idea_get]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.idea_get(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.ideas_list(p_mine boolean, p_skill text, p_difficulty text, p_limit integer)

[src: supabase/migrations/20261012000000_teacher_portal.sql#ideas_list]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ideas_list(p_mine boolean, p_skill text, p_difficulty text, p_limit integer) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.import_faculty_csv(p_university uuid, p_rows jsonb)

[src: supabase/migrations/20261012000000_teacher_portal.sql#import_faculty_csv]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.import_faculty_csv(p_university uuid, p_rows jsonb) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.invite_supervisor(p_venture uuid, p_teacher uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#invite_supervisor]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.invite_supervisor(p_venture uuid, p_teacher uuid) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.ops_universities()

[src: supabase/migrations/20261012000000_teacher_portal.sql#ops_universities]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_universities() | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.post_supervisor_comment(p_venture uuid, p_body text)

[src: supabase/migrations/20261012000000_teacher_portal.sql#post_supervisor_comment]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.post_supervisor_comment(p_venture uuid, p_body text) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.request_review(p_venture uuid, p_teacher uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#request_review]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.request_review(p_venture uuid, p_teacher uuid) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.request_teacher_role(p_department text, p_title text)

[src: supabase/migrations/20261012000000_teacher_portal.sql#request_teacher_role]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.request_teacher_role(p_department text, p_title text) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.respond_supervision(p_venture uuid, p_accept boolean)

[src: supabase/migrations/20261012000000_teacher_portal.sql#respond_supervision]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.respond_supervision(p_venture uuid, p_accept boolean) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.review_requests_for(p_venture uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#review_requests_for]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.review_requests_for(p_venture uuid) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.review_teacher_flag(p_id uuid, p_upheld boolean, p_reason text)

[src: supabase/migrations/20261012000000_teacher_portal.sql#review_teacher_flag]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.review_teacher_flag(p_id uuid, p_upheld boolean, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.revoke_teacher(p_user uuid, p_reason text)

[src: supabase/migrations/20261012000000_teacher_portal.sql#revoke_teacher]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.revoke_teacher(p_user uuid, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.save_idea(p_id uuid, p jsonb)

[src: supabase/migrations/20261012000000_teacher_portal.sql#save_idea]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.save_idea(p_id uuid, p jsonb) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.save_teacher_settings(p_opt_in boolean, p_cap integer, p_skills text[], p_digest boolean)

[src: supabase/migrations/20261012000000_teacher_portal.sql#save_teacher_settings]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.save_teacher_settings(p_opt_in boolean, p_cap integer, p_skills text[], p_digest boolean) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.set_idea_status(p_id uuid, p_open boolean)

[src: supabase/migrations/20261012000000_teacher_portal.sql#set_idea_status]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.set_idea_status(p_id uuid, p_open boolean) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.start_review(p_venture uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#start_review]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.start_review(p_venture uuid) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.start_venture_from_idea(p_idea uuid, p jsonb)

[src: supabase/migrations/20261012000000_teacher_portal.sql#start_venture_from_idea]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.start_venture_from_idea(p_idea uuid, p jsonb) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.submit_review(p_request uuid, p_rubric jsonb, p_comments text)

[src: supabase/migrations/20261012000000_teacher_portal.sql#submit_review]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.submit_review(p_request uuid, p_rubric jsonb, p_comments text) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.supervision_for(p_venture uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#supervision_for]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.supervision_for(p_venture uuid) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.supervisor_confirm_contribution(p_entry uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#supervisor_confirm_contribution]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.supervisor_confirm_contribution(p_entry uuid) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.supervisor_thread(p_venture uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#supervisor_thread]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.supervisor_thread(p_venture uuid) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.teacher_claim_code_check(p_id uuid, p_claim boolean)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_claim_code_check]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.teacher_claim_code_check(p_id uuid, p_claim boolean) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.teacher_code_check_case(p_id uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_code_check_case]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.teacher_code_check_case(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.teacher_code_check_queue(p_status text)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_code_check_queue]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.teacher_code_check_queue(p_status text) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.teacher_contributions(p_venture uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_contributions]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.teacher_contributions(p_venture uuid) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.teacher_deliverables(p_venture uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_deliverables]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.teacher_deliverables(p_venture uuid) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.teacher_endorse(p_endorsee uuid, p_venture uuid, p_items jsonb, p_note text)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_endorse]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.teacher_endorse(p_endorsee uuid, p_venture uuid, p_items jsonb, p_note text) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.teacher_endorse_options(p_venture uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_endorse_options]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.teacher_endorse_options(p_venture uuid) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.teacher_flag_queue(p_status text)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_flag_queue]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.teacher_flag_queue(p_status text) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.teacher_grade_code_check(p_id uuid, p_rubric jsonb, p_feedback text)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_grade_code_check]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.teacher_grade_code_check(p_id uuid, p_rubric jsonb, p_feedback text) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.teacher_home()

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_home]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.teacher_home() | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.teacher_requests(p_status text)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_requests]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.teacher_requests(p_status text) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.teacher_review_request(p_request uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_review_request]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.teacher_review_request(p_request uuid) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.teacher_review_requests(p_status text)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_review_requests]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.teacher_review_requests(p_status text) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.teacher_settings_get()

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_settings_get]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.teacher_settings_get() | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.teacher_state()

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_state]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.teacher_state() | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.teacher_venture(p_venture uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_venture]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.teacher_venture(p_venture uuid) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.teacher_ventures()

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_ventures]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.teacher_ventures() | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.teachers_for_venture(p_venture uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#teachers_for_venture]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.teachers_for_venture(p_venture uuid) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.venture_reviews_for(p_venture uuid)

[src: supabase/migrations/20261012000000_teacher_portal.sql#venture_reviews_for]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.venture_reviews_for(p_venture uuid) | sql | false | search_path="" | authenticated, service_role | 20261012000000_teacher_portal.sql |

## public.faculty_csv_entries

[src: supabase/migrations/20261012000000_teacher_portal.sql#faculty_csv_entries]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| university_id | uuid | true | — |  |  | — |
| email | text | true | — |  |  | "default" |
| department | text | false | — |  |  | "default" |
| title | text | false | — |  |  | "default" |
| imported_by | uuid | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
faculty_csv_entries_department_check: CHECK (department IS NULL OR char_length(department) <= 80); -- validated: true
```

```sql
faculty_csv_entries_email_check: CHECK (email = lower(email) AND email ~ '^[^@\s]+@[^@\s]+$'::text AND char_length(email) <= 254); -- validated: true
```

```sql
faculty_csv_entries_imported_by_fkey: FOREIGN KEY (imported_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
faculty_csv_entries_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
faculty_csv_entries_title_check: CHECK (title IS NULL OR char_length(title) <= 80); -- validated: true
```

```sql
faculty_csv_entries_university_id_email_key: UNIQUE (university_id, email); -- validated: true
```

```sql
faculty_csv_entries_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX faculty_csv_entries_imported_by_idx ON public.faculty_csv_entries USING btree (imported_by) WHERE (imported_by IS NOT NULL); -- valid: true
```

```sql
CREATE UNIQUE INDEX faculty_csv_entries_pkey ON public.faculty_csv_entries USING btree (id); -- valid: true
```

```sql
CREATE UNIQUE INDEX faculty_csv_entries_university_id_email_key ON public.faculty_csv_entries USING btree (university_id, email); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.project_ideas

[src: supabase/migrations/20261012000000_teacher_portal.sql#project_ideas]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| teacher_id | uuid | true | — |  |  | — |
| university_id | uuid | true | — |  |  | — |
| title | text | true | — |  |  | "default" |
| brief | text | true | — |  |  | "default" |
| skills | text[] | true | '{}'::text[] |  |  | "default" |
| difficulty | idea_difficulty | true | — |  |  | — |
| team_size | smallint | true | — |  |  | — |
| duration_weeks | smallint | true | — |  |  | — |
| deliverables | text | true | — |  |  | "default" |
| max_teams | smallint | true | 3 |  |  | — |
| deadline | date | false | — |  |  | — |
| course_label | text | false | — |  |  | "default" |
| audience | idea_audience | true | 'university'::idea_audience |  |  | — |
| status | idea_status | true | 'open'::idea_status |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
project_ideas_brief_check: CHECK (char_length(btrim(brief)) >= 1 AND char_length(btrim(brief)) <= 2000); -- validated: true
```

```sql
project_ideas_course_label_check: CHECK (course_label IS NULL OR char_length(btrim(course_label)) >= 1 AND char_length(btrim(course_label)) <= 60); -- validated: true
```

```sql
project_ideas_deliverables_check: CHECK (char_length(btrim(deliverables)) >= 1 AND char_length(btrim(deliverables)) <= 500); -- validated: true
```

```sql
project_ideas_duration_weeks_check: CHECK (duration_weeks >= 1 AND duration_weeks <= 52); -- validated: true
```

```sql
project_ideas_max_teams_check: CHECK (max_teams >= 1 AND max_teams <= 50); -- validated: true
```

```sql
project_ideas_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
project_ideas_skills_check: CHECK (cardinality(skills) >= 1 AND cardinality(skills) <= 10); -- validated: true
```

```sql
project_ideas_teacher_id_fkey: FOREIGN KEY (teacher_id) REFERENCES teacher_profiles(user_id) ON DELETE CASCADE; -- validated: true
```

```sql
project_ideas_team_size_check: CHECK (team_size >= 2 AND team_size <= 6); -- validated: true
```

```sql
project_ideas_title_check: CHECK (char_length(btrim(title)) >= 3 AND char_length(btrim(title)) <= 100); -- validated: true
```

```sql
project_ideas_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE RESTRICT; -- validated: true
```

### Indexes

```sql
CREATE INDEX project_ideas_browse_idx ON public.project_ideas USING btree (university_id, created_at DESC) WHERE (status = 'open'::idea_status); -- valid: true
```

```sql
CREATE INDEX project_ideas_global_idx ON public.project_ideas USING btree (created_at DESC) WHERE ((status = 'open'::idea_status) AND (audience = 'global'::idea_audience)); -- valid: true
```

```sql
CREATE UNIQUE INDEX project_ideas_pkey ON public.project_ideas USING btree (id); -- valid: true
```

```sql
CREATE INDEX project_ideas_skills_idx ON public.project_ideas USING gin (skills); -- valid: true
```

```sql
CREATE INDEX project_ideas_teacher_idx ON public.project_ideas USING btree (teacher_id, created_at DESC); -- valid: true
```

```sql
CREATE INDEX project_ideas_university_idx ON public.project_ideas USING btree (university_id); -- valid: true
```

### Policies

#### project_ideas.project_ideas_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((teacher_id = ( SELECT auth.uid() AS uid)) OR (audience = 'global'::idea_audience) OR (university_id = ( SELECT private.current_university_id() AS current_university_id)))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER project_ideas_updated_at BEFORE UPDATE ON project_ideas FOR EACH ROW EXECUTE FUNCTION private.set_updated_at(); -- enabled: O
```

```sql
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON project_ideas FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```

## public.review_requests

[src: supabase/migrations/20261012000000_teacher_portal.sql#review_requests]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| venture_id | uuid | true | — |  |  | — |
| teacher_id | uuid | true | — |  |  | — |
| requested_by | uuid | true | — |  |  | — |
| status | review_request_status | true | 'open'::review_request_status |  |  | — |
| due_at | timestamp with time zone | true | — |  |  | — |
| remind7_at | timestamp with time zone | false | — |  |  | — |
| remind12_at | timestamp with time zone | false | — |  |  | — |
| closed_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
review_requests_check: CHECK ((status = 'open'::review_request_status) = (closed_at IS NULL)); -- validated: true
```

```sql
review_requests_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
review_requests_requested_by_fkey: FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
review_requests_teacher_id_fkey: FOREIGN KEY (teacher_id) REFERENCES teacher_profiles(user_id) ON DELETE CASCADE; -- validated: true
```

```sql
review_requests_venture_id_fkey: FOREIGN KEY (venture_id) REFERENCES ventures(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX review_requests_one_open ON public.review_requests USING btree (venture_id, teacher_id) WHERE (status = 'open'::review_request_status); -- valid: true
```

```sql
CREATE UNIQUE INDEX review_requests_pkey ON public.review_requests USING btree (id); -- valid: true
```

```sql
CREATE INDEX review_requests_requested_by_idx ON public.review_requests USING btree (requested_by); -- valid: true
```

```sql
CREATE INDEX review_requests_teacher_idx ON public.review_requests USING btree (teacher_id, status, due_at); -- valid: true
```

```sql
CREATE INDEX review_requests_venture_idx ON public.review_requests USING btree (venture_id); -- valid: true
```

### Policies

#### review_requests.review_requests_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((teacher_id = ( SELECT auth.uid() AS uid)) OR (requested_by = ( SELECT auth.uid() AS uid)) OR private.is_venture_member(venture_id))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON review_requests FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```

## public.supervisor_comments

[src: supabase/migrations/20261012000000_teacher_portal.sql#supervisor_comments]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint | true | — | a |  | — |
| venture_id | uuid | true | — |  |  | — |
| author_id | uuid | true | — |  |  | — |
| body | text | true | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
supervisor_comments_author_id_fkey: FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
supervisor_comments_body_check: CHECK (char_length(btrim(body)) >= 1 AND char_length(btrim(body)) <= 2000); -- validated: true
```

```sql
supervisor_comments_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
supervisor_comments_venture_id_fkey: FOREIGN KEY (venture_id) REFERENCES ventures(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX supervisor_comments_author_idx ON public.supervisor_comments USING btree (author_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX supervisor_comments_pkey ON public.supervisor_comments USING btree (id); -- valid: true
```

```sql
CREATE INDEX supervisor_comments_venture_idx ON public.supervisor_comments USING btree (venture_id, created_at); -- valid: true
```

### Policies

#### supervisor_comments.supervisor_comments_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "(private.is_venture_member(venture_id) OR private.is_venture_supervisor(venture_id))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON supervisor_comments FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```

## public.teacher_concentration_flags

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_concentration_flags]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| teacher_id | uuid | true | — |  |  | — |
| student_id | uuid | true | — |  |  | — |
| given | integer | true | — |  |  | — |
| total | integer | true | — |  |  | — |
| status | review_flag_status | true | 'open'::review_flag_status |  |  | — |
| reviewed_by | uuid | false | — |  |  | — |
| reviewed_at | timestamp with time zone | false | — |  |  | — |
| reason | text | false | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
teacher_concentration_flags_check: CHECK (total >= given); -- validated: true
```

```sql
teacher_concentration_flags_check1: CHECK ((status = 'open'::review_flag_status) = (reviewed_at IS NULL)); -- validated: true
```

```sql
teacher_concentration_flags_given_check: CHECK (given >= 1); -- validated: true
```

```sql
teacher_concentration_flags_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
teacher_concentration_flags_reason_check: CHECK (reason IS NULL OR char_length(btrim(reason)) >= 3 AND char_length(btrim(reason)) <= 2000); -- validated: true
```

```sql
teacher_concentration_flags_reviewed_by_fkey: FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
teacher_concentration_flags_student_id_fkey: FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
teacher_concentration_flags_teacher_id_fkey: FOREIGN KEY (teacher_id) REFERENCES teacher_profiles(user_id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX teacher_concentration_flags_one_open ON public.teacher_concentration_flags USING btree (teacher_id, student_id) WHERE (status = 'open'::review_flag_status); -- valid: true
```

```sql
CREATE UNIQUE INDEX teacher_concentration_flags_pkey ON public.teacher_concentration_flags USING btree (id); -- valid: true
```

```sql
CREATE INDEX teacher_concentration_flags_reviewed_by_idx ON public.teacher_concentration_flags USING btree (reviewed_by) WHERE (reviewed_by IS NOT NULL); -- valid: true
```

```sql
CREATE INDEX teacher_concentration_flags_student_idx ON public.teacher_concentration_flags USING btree (student_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.teacher_profiles

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_profiles]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| university_id | uuid | true | — |  |  | — |
| department | text | true | — |  |  | "default" |
| title | text | true | — |  |  | "default" |
| status | teacher_status | true | 'pending'::teacher_status |  |  | — |
| requested_at | timestamp with time zone | true | now() |  |  | — |
| approved_by | uuid | false | — |  |  | — |
| approved_at | timestamp with time zone | false | — |  |  | — |
| approval_source | text | false | — |  |  | "default" |
| revoked_by | uuid | false | — |  |  | — |
| revoked_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
teacher_profiles_approval_source_check: CHECK (approval_source = ANY (ARRAY['staff'::text, 'university_admin'::text, 'csv'::text])); -- validated: true
```

```sql
teacher_profiles_approved_by_fkey: FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
teacher_profiles_check: CHECK (status <> 'approved'::teacher_status OR approved_at IS NOT NULL); -- validated: true
```

```sql
teacher_profiles_check1: CHECK (status <> 'revoked'::teacher_status OR revoked_at IS NOT NULL); -- validated: true
```

```sql
teacher_profiles_department_check: CHECK (char_length(btrim(department)) >= 2 AND char_length(btrim(department)) <= 80); -- validated: true
```

```sql
teacher_profiles_pkey: PRIMARY KEY (user_id); -- validated: true
```

```sql
teacher_profiles_revoked_by_fkey: FOREIGN KEY (revoked_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
teacher_profiles_title_check: CHECK (char_length(btrim(title)) >= 2 AND char_length(btrim(title)) <= 80); -- validated: true
```

```sql
teacher_profiles_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE RESTRICT; -- validated: true
```

```sql
teacher_profiles_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX teacher_profiles_approved_by_idx ON public.teacher_profiles USING btree (approved_by) WHERE (approved_by IS NOT NULL); -- valid: true
```

```sql
CREATE UNIQUE INDEX teacher_profiles_pkey ON public.teacher_profiles USING btree (user_id); -- valid: true
```

```sql
CREATE INDEX teacher_profiles_revoked_by_idx ON public.teacher_profiles USING btree (revoked_by) WHERE (revoked_by IS NOT NULL); -- valid: true
```

```sql
CREATE INDEX teacher_profiles_university_idx ON public.teacher_profiles USING btree (university_id, status); -- valid: true
```

### Policies

#### teacher_profiles.teacher_profiles_read_own

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "(user_id = ( SELECT auth.uid() AS uid))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.

## public.teacher_settings

[src: supabase/migrations/20261012000000_teacher_portal.sql#teacher_settings]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| grading_opt_in | boolean | true | false |  |  | — |
| weekly_grading_cap | smallint | true | 10 |  |  | — |
| grading_skills | text[] | true | '{}'::text[] |  |  | "default" |
| digest | boolean | true | true |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
teacher_settings_grading_skills_check: CHECK (cardinality(grading_skills) <= 30); -- validated: true
```

```sql
teacher_settings_pkey: PRIMARY KEY (user_id); -- validated: true
```

```sql
teacher_settings_user_id_fkey: FOREIGN KEY (user_id) REFERENCES teacher_profiles(user_id) ON DELETE CASCADE; -- validated: true
```

```sql
teacher_settings_weekly_grading_cap_check: CHECK (weekly_grading_cap >= 1 AND weekly_grading_cap <= 50); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX teacher_settings_pkey ON public.teacher_settings USING btree (user_id); -- valid: true
```

### Policies

#### teacher_settings.teacher_settings_read_own

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "(user_id = ( SELECT auth.uid() AS uid))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.

## public.venture_reviews

[src: supabase/migrations/20261012000000_teacher_portal.sql#venture_reviews]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| request_id | uuid | true | — |  |  | — |
| venture_id | uuid | true | — |  |  | — |
| teacher_id | uuid | true | — |  |  | — |
| rubric | jsonb | true | — |  |  | — |
| comments | text | false | — |  |  | "default" |
| average | numeric(3,2) | true | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
venture_reviews_average_check: CHECK (average >= 1::numeric AND average <= 5::numeric); -- validated: true
```

```sql
venture_reviews_comments_check: CHECK (comments IS NULL OR char_length(comments) <= 2000); -- validated: true
```

```sql
venture_reviews_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
venture_reviews_request_id_fkey: FOREIGN KEY (request_id) REFERENCES review_requests(id) ON DELETE CASCADE; -- validated: true
```

```sql
venture_reviews_request_id_key: UNIQUE (request_id); -- validated: true
```

```sql
venture_reviews_rubric_check: CHECK (jsonb_typeof(rubric) = 'object'::text); -- validated: true
```

```sql
venture_reviews_teacher_id_fkey: FOREIGN KEY (teacher_id) REFERENCES teacher_profiles(user_id) ON DELETE CASCADE; -- validated: true
```

```sql
venture_reviews_venture_id_fkey: FOREIGN KEY (venture_id) REFERENCES ventures(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX venture_reviews_pkey ON public.venture_reviews USING btree (id); -- valid: true
```

```sql
CREATE UNIQUE INDEX venture_reviews_request_id_key ON public.venture_reviews USING btree (request_id); -- valid: true
```

```sql
CREATE INDEX venture_reviews_teacher_idx ON public.venture_reviews USING btree (teacher_id); -- valid: true
```

```sql
CREATE INDEX venture_reviews_venture_idx ON public.venture_reviews USING btree (venture_id); -- valid: true
```

### Policies

#### venture_reviews.venture_reviews_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((teacher_id = ( SELECT auth.uid() AS uid)) OR private.is_venture_member(venture_id))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON venture_reviews FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```

## public.venture_supervisors

[src: supabase/migrations/20261012000000_teacher_portal.sql#venture_supervisors]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| venture_id | uuid | true | — |  |  | — |
| teacher_id | uuid | true | — |  |  | — |
| status | supervisor_status | true | 'invited'::supervisor_status |  |  | — |
| invited_by | uuid | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| started_at | timestamp with time zone | false | — |  |  | — |
| ended_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
venture_supervisors_check: CHECK (status <> 'active'::supervisor_status OR started_at IS NOT NULL); -- validated: true
```

```sql
venture_supervisors_check1: CHECK (status <> 'ended'::supervisor_status OR ended_at IS NOT NULL); -- validated: true
```

```sql
venture_supervisors_invited_by_fkey: FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
venture_supervisors_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
venture_supervisors_teacher_id_fkey: FOREIGN KEY (teacher_id) REFERENCES teacher_profiles(user_id) ON DELETE CASCADE; -- validated: true
```

```sql
venture_supervisors_venture_id_fkey: FOREIGN KEY (venture_id) REFERENCES ventures(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX venture_supervisors_invited_by_idx ON public.venture_supervisors USING btree (invited_by) WHERE (invited_by IS NOT NULL); -- valid: true
```

```sql
CREATE UNIQUE INDEX venture_supervisors_one_current ON public.venture_supervisors USING btree (venture_id) WHERE (status = ANY (ARRAY['invited'::supervisor_status, 'active'::supervisor_status])); -- valid: true
```

```sql
CREATE UNIQUE INDEX venture_supervisors_pkey ON public.venture_supervisors USING btree (id); -- valid: true
```

```sql
CREATE INDEX venture_supervisors_teacher_idx ON public.venture_supervisors USING btree (teacher_id, status); -- valid: true
```

### Policies

#### venture_supervisors.venture_supervisors_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "((teacher_id = ( SELECT auth.uid() AS uid)) OR private.is_venture_member(venture_id))",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.
