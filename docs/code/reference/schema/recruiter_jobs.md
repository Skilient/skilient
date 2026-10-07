Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# recruiter_jobs

## private.answer_hire_outcome(p_hire uuid, p_answer text)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#answer_hire_outcome]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.answer_hire_outcome(p_hire uuid, p_answer text) | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.application_get(p_id uuid)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#application_get]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.application_get(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.application_label(p_reason text)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#application_label]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.application_label(p_reason text) | sql | false | search_path="" | None | 20261015000000_recruiter_jobs.sql |

## private.apply_to_job(p_job uuid, p_note text)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#apply_to_job]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.apply_to_job(p_job uuid, p_note text) | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.ask_hire_outcomes()

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#ask_hire_outcomes]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ask_hire_outcomes() | plpgsql | true | search_path="" | None | 20261015000000_recruiter_jobs.sql |

## private.bulk_move_applications(p_ids uuid[], p_stage application_stage, p_reason text)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#bulk_move_applications]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.bulk_move_applications(p_ids uuid[], p_stage application_stage, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.candidate_access(p_org uuid, p_student uuid)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#candidate_access]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.candidate_access(p_org uuid, p_student uuid) | sql | true | search_path="" | None | 20261015000000_recruiter_jobs.sql |

## private.close_expired_jobs()

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#close_expired_jobs]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.close_expired_jobs() | sql | true | search_path="" | None | 20261015000000_recruiter_jobs.sql |

## private.close_job(p_id uuid)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#close_job]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.close_job(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.company_page(p_slug text)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#company_page]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.company_page(p_slug text) | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.competition_freeze_candidates()

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#competition_freeze_candidates]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.competition_freeze_candidates() | sql | true | search_path="" | service_role | 20261015000000_recruiter_jobs.sql |

## private.competition_freeze_record(p_team uuid, p_sha text, p_note text)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#competition_freeze_record]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.competition_freeze_record(p_team uuid, p_sha text, p_note text) | sql | true | search_path="" | service_role | 20261015000000_recruiter_jobs.sql |

## private.competition_manage(p_id uuid)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#competition_manage]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.competition_manage(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.competition_public(p_id uuid)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#competition_public]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.competition_public(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.competitions_for_org()

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#competitions_for_org]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.competitions_for_org() | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.competitions_tick()

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#competitions_tick]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.competitions_tick() | sql | true | search_path="" | None | 20261015000000_recruiter_jobs.sql |

## private.create_team(p_competition uuid, p_name text)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#create_team]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.create_team(p_competition uuid, p_name text) | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.finish_competition(p_id uuid)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#finish_competition]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.finish_competition(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.hires_list()

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#hires_list]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.hires_list() | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.invite_team_member(p_team uuid, p_username text)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#invite_team_member]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.invite_team_member(p_team uuid, p_username text) | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.invite_to_apply(p_job uuid, p_students uuid[])

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#invite_to_apply]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.invite_to_apply(p_job uuid, p_students uuid[]) | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.job_applicants(p_job uuid)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#job_applicants]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.job_applicants(p_job uuid) | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.job_get(p_id uuid)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#job_get]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.job_get(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.job_public(p_id uuid)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#job_public]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.job_public(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.jobs_for_org()

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#jobs_for_org]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.jobs_for_org() | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.l3_skills(p_user uuid)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#l3_skills]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.l3_skills(p_user uuid) | sql | true | search_path="" | None | 20261015000000_recruiter_jobs.sql |

## private.l4_skills(p_user uuid)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#l4_skills]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.l4_skills(p_user uuid) | sql | true | search_path="" | None | 20261015000000_recruiter_jobs.sql |

## private.move_application(p_id uuid, p_stage application_stage, p_reason text)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#move_application]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.move_application(p_id uuid, p_stage application_stage, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.move_application_one(p_org uuid, p_actor uuid, p_id uuid, p_stage application_stage, p_reason text)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#move_application_one]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.move_application_one(p_org uuid, p_actor uuid, p_id uuid, p_stage application_stage, p_reason text) | plpgsql | true | search_path="" | None | 20261015000000_recruiter_jobs.sql |

## private.ops_competitions(p_status text)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#ops_competitions]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_competitions(p_status text) | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.ops_review_competition(p_id uuid, p_approve boolean, p_reason text)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#ops_review_competition]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_review_competition(p_id uuid, p_approve boolean, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.publish_job(p_id uuid)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#publish_job]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.publish_job(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.respond_team_invite(p_team uuid, p_accept boolean)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#respond_team_invite]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.respond_team_invite(p_team uuid, p_accept boolean) | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.rubric_ok(p jsonb)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#rubric_ok]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.rubric_ok(p jsonb) | sql | false | search_path="" | None | 20261015000000_recruiter_jobs.sql |

## private.save_competition(p_id uuid, p jsonb)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#save_competition]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.save_competition(p_id uuid, p jsonb) | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.save_job(p_id uuid, p jsonb)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#save_job]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.save_job(p_id uuid, p jsonb) | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.score_team(p_team uuid, p_scores jsonb, p_feedback text)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#score_team]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.score_team(p_team uuid, p_scores jsonb, p_feedback text) | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.submit_competition(p_id uuid)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#submit_competition]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.submit_competition(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.submit_repo(p_team uuid, p_url text)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#submit_repo]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.submit_repo(p_team uuid, p_url text) | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## private.unmet_requirements(p_student uuid, p_tier ranking_tier, p_skills jsonb)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#unmet_requirements]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.unmet_requirements(p_student uuid, p_tier ranking_tier, p_skills jsonb) | sql | true | search_path="" | None | 20261015000000_recruiter_jobs.sql |

## private.valid_skill_requirements(p jsonb)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#valid_skill_requirements]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.valid_skill_requirements(p jsonb) | sql | false | search_path="" | None | 20261015000000_recruiter_jobs.sql |

## private.wake_competition_freeze()

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#wake_competition_freeze]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.wake_competition_freeze() | plpgsql | true | search_path="" | None | 20261015000000_recruiter_jobs.sql |

## private.withdraw_job_application(p_id uuid)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#withdraw_job_application]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.withdraw_job_application(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261015000000_recruiter_jobs.sql |

## public.answer_hire_outcome(p_hire uuid, p_answer text)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#answer_hire_outcome]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.answer_hire_outcome(p_hire uuid, p_answer text) | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.application_get(p_id uuid)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#application_get]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.application_get(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.apply_to_job(p_job uuid, p_note text)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#apply_to_job]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.apply_to_job(p_job uuid, p_note text) | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.bulk_move_applications(p_ids uuid[], p_stage application_stage, p_reason text)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#bulk_move_applications]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.bulk_move_applications(p_ids uuid[], p_stage application_stage, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.close_job(p_id uuid)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#close_job]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.close_job(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.company_page(p_slug text)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#company_page]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.company_page(p_slug text) | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.competition_manage(p_id uuid)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#competition_manage]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.competition_manage(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.competition_public(p_id uuid)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#competition_public]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.competition_public(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.competitions_for_org()

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#competitions_for_org]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.competitions_for_org() | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.create_team(p_competition uuid, p_name text)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#create_team]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.create_team(p_competition uuid, p_name text) | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.finish_competition(p_id uuid)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#finish_competition]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.finish_competition(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.hires_list()

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#hires_list]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.hires_list() | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.invite_team_member(p_team uuid, p_username text)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#invite_team_member]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.invite_team_member(p_team uuid, p_username text) | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.invite_to_apply(p_job uuid, p_students uuid[])

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#invite_to_apply]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.invite_to_apply(p_job uuid, p_students uuid[]) | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.job_applicants(p_job uuid)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#job_applicants]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.job_applicants(p_job uuid) | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.job_get(p_id uuid)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#job_get]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.job_get(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.job_public(p_id uuid)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#job_public]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.job_public(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.jobs_for_org()

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#jobs_for_org]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.jobs_for_org() | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.move_application(p_id uuid, p_stage application_stage, p_reason text)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#move_application]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.move_application(p_id uuid, p_stage application_stage, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.ops_competitions(p_status text)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#ops_competitions]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_competitions(p_status text) | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.ops_review_competition(p_id uuid, p_approve boolean, p_reason text)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#ops_review_competition]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_review_competition(p_id uuid, p_approve boolean, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.publish_job(p_id uuid)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#publish_job]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.publish_job(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.respond_team_invite(p_team uuid, p_accept boolean)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#respond_team_invite]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.respond_team_invite(p_team uuid, p_accept boolean) | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.save_competition(p_id uuid, p jsonb)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#save_competition]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.save_competition(p_id uuid, p jsonb) | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.save_job(p_id uuid, p jsonb)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#save_job]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.save_job(p_id uuid, p jsonb) | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.score_team(p_team uuid, p_scores jsonb, p_feedback text)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#score_team]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.score_team(p_team uuid, p_scores jsonb, p_feedback text) | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.submit_competition(p_id uuid)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#submit_competition]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.submit_competition(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.submit_repo(p_team uuid, p_url text)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#submit_repo]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.submit_repo(p_team uuid, p_url text) | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.withdraw_job_application(p_id uuid)

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#withdraw_job_application]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.withdraw_job_application(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261015000000_recruiter_jobs.sql |

## public.application_events

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#application_events]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint | true | — | a |  | — |
| application_id | uuid | true | — |  |  | — |
| stage | application_stage | true | — |  |  | — |
| reject_reason | text | false | — |  |  | "default" |
| actor_id | uuid | false | — |  |  | — |
| at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
application_events_actor_id_fkey: FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
application_events_application_id_fkey: FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE CASCADE; -- validated: true
```

```sql
application_events_pkey: PRIMARY KEY (id); -- validated: true
```

### Indexes

```sql
CREATE INDEX application_events_app_idx ON public.application_events USING btree (application_id, at); -- valid: true
```

```sql
CREATE UNIQUE INDEX application_events_pkey ON public.application_events USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.competition_awards

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#competition_awards]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| student_id | uuid | true | — |  |  | — |
| competition_id | uuid | true | — |  |  | — |
| skill_id | text | true | — |  |  | "default" |
| kind | text | true | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
competition_awards_competition_id_fkey: FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE; -- validated: true
```

```sql
competition_awards_kind_check: CHECK (kind = ANY (ARRAY['participant'::text, 'winner'::text])); -- validated: true
```

```sql
competition_awards_pkey: PRIMARY KEY (student_id, competition_id, skill_id); -- validated: true
```

```sql
competition_awards_skill_id_fkey: FOREIGN KEY (skill_id) REFERENCES skills(id); -- validated: true
```

```sql
competition_awards_student_id_fkey: FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX competition_awards_pkey ON public.competition_awards USING btree (student_id, competition_id, skill_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.competition_team_members

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#competition_team_members]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| team_id | uuid | true | — |  |  | — |
| competition_id | uuid | true | — |  |  | — |
| student_id | uuid | true | — |  |  | — |
| status | text | true | 'invited'::text |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
competition_team_members_competition_id_fkey: FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE; -- validated: true
```

```sql
competition_team_members_competition_id_student_id_key: UNIQUE (competition_id, student_id); -- validated: true
```

```sql
competition_team_members_pkey: PRIMARY KEY (team_id, student_id); -- validated: true
```

```sql
competition_team_members_status_check: CHECK (status = ANY (ARRAY['invited'::text, 'joined'::text])); -- validated: true
```

```sql
competition_team_members_student_id_fkey: FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
competition_team_members_team_id_fkey: FOREIGN KEY (team_id) REFERENCES competition_teams(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX competition_team_members_competition_id_student_id_key ON public.competition_team_members USING btree (competition_id, student_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX competition_team_members_pkey ON public.competition_team_members USING btree (team_id, student_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.competition_teams

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#competition_teams]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| competition_id | uuid | true | — |  |  | — |
| name | text | true | — |  |  | "default" |
| lead_id | uuid | true | — |  |  | — |
| repo_url | text | false | — |  |  | "default" |
| submitted_at | timestamp with time zone | false | — |  |  | — |
| frozen_sha | text | false | — |  |  | "default" |
| frozen_checked_at | timestamp with time zone | false | — |  |  | — |
| frozen_note | text | false | — |  |  | "default" |
| scores | jsonb | false | — |  |  | — |
| total | numeric(6,2) | false | — |  |  | — |
| feedback | text | false | — |  |  | "default" |
| placement | integer | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
competition_teams_competition_id_fkey: FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE CASCADE; -- validated: true
```

```sql
competition_teams_competition_id_name_key: UNIQUE (competition_id, name); -- validated: true
```

```sql
competition_teams_feedback_check: CHECK (feedback IS NULL OR char_length(feedback) <= 2000); -- validated: true
```

```sql
competition_teams_frozen_note_check: CHECK (frozen_note IS NULL OR char_length(frozen_note) <= 200); -- validated: true
```

```sql
competition_teams_frozen_sha_check: CHECK (frozen_sha IS NULL OR frozen_sha ~ '^[0-9a-f]{40}$'::text); -- validated: true
```

```sql
competition_teams_lead_id_fkey: FOREIGN KEY (lead_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
competition_teams_name_check: CHECK (char_length(btrim(name)) >= 2 AND char_length(btrim(name)) <= 60); -- validated: true
```

```sql
competition_teams_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
competition_teams_repo_url_check: CHECK (repo_url IS NULL OR repo_url ~ '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'::text); -- validated: true
```

### Indexes

```sql
CREATE INDEX competition_teams_comp_idx ON public.competition_teams USING btree (competition_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX competition_teams_competition_id_name_key ON public.competition_teams USING btree (competition_id, name); -- valid: true
```

```sql
CREATE UNIQUE INDEX competition_teams_pkey ON public.competition_teams USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

```sql
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON competition_teams FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```

## public.competitions

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#competitions]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| org_id | uuid | false | — |  |  | — |
| created_by | uuid | false | — |  |  | — |
| title | text | true | — |  |  | "default" |
| role | text | true | — |  |  | "default" |
| skills | jsonb | true | '[]'::jsonb |  |  | — |
| brief | text | true | — |  |  | "default" |
| brief_template | text | false | — |  |  | "default" |
| starts_at | timestamp with time zone | true | — |  |  | — |
| ends_at | timestamp with time zone | true | — |  |  | — |
| team_size | smallint | true | 1 |  |  | — |
| eligible_universities | uuid[] | true | '{}'::uuid[] |  |  | — |
| min_tier | ranking_tier | false | — |  |  | — |
| prize | text | true | — |  |  | "default" |
| rubric | jsonb | true | — |  |  | — |
| status | competition_status | true | 'draft'::competition_status |  |  | — |
| review_note | text | false | — |  |  | "default" |
| reviewed_by | uuid | false | — |  |  | — |
| reviewed_at | timestamp with time zone | false | — |  |  | — |
| winner_team_id | uuid | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| host_type | text | true | 'org'::text |  |  | "default" |
| university_id | uuid | false | — |  |  | — |

### Keys and constraints

```sql
competitions_brief_check: CHECK (char_length(brief) >= 100 AND char_length(brief) <= 6000); -- validated: true
```

```sql
competitions_brief_template_check: CHECK (brief_template IS NULL OR char_length(brief_template) <= 40); -- validated: true
```

```sql
competitions_created_by_fkey: FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
competitions_host_check: CHECK (host_type = 'org'::text AND org_id IS NOT NULL AND university_id IS NULL OR host_type = 'university'::text AND university_id IS NOT NULL AND org_id IS NULL); -- validated: true
```

```sql
competitions_host_type_check: CHECK (host_type = ANY (ARRAY['org'::text, 'university'::text])); -- validated: true
```

```sql
competitions_length_check: CHECK (
CASE
    WHEN host_type = 'org'::text THEN ends_at >= (starts_at + '7 days'::interval) AND ends_at <= (starts_at + '22 days'::interval)
    ELSE ends_at >= (starts_at + '1 day'::interval) AND ends_at <= (starts_at + '22 days'::interval)
END); -- validated: true
```

```sql
competitions_org_id_fkey: FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE; -- validated: true
```

```sql
competitions_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
competitions_prize_check: CHECK (char_length(btrim(prize)) >= 3 AND char_length(btrim(prize)) <= 300); -- validated: true
```

```sql
competitions_review_note_check: CHECK (review_note IS NULL OR char_length(review_note) <= 2000); -- validated: true
```

```sql
competitions_reviewed_by_fkey: FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
competitions_role_check: CHECK (char_length(btrim(role)) >= 2 AND char_length(btrim(role)) <= 80); -- validated: true
```

```sql
competitions_rubric_check: CHECK (jsonb_typeof(rubric) = 'array'::text); -- validated: true
```

```sql
competitions_skills_check: CHECK (jsonb_typeof(skills) = 'array'::text); -- validated: true
```

```sql
competitions_team_size_check: CHECK (team_size >= 1 AND team_size <= 3); -- validated: true
```

```sql
competitions_title_check: CHECK (char_length(btrim(title)) >= 3 AND char_length(btrim(title)) <= 100); -- validated: true
```

```sql
competitions_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX competitions_org_idx ON public.competitions USING btree (org_id, created_at DESC); -- valid: true
```

```sql
CREATE UNIQUE INDEX competitions_pkey ON public.competitions USING btree (id); -- valid: true
```

```sql
CREATE INDEX competitions_status_idx ON public.competitions USING btree (status, starts_at); -- valid: true
```

```sql
CREATE INDEX competitions_university_idx ON public.competitions USING btree (university_id, created_at DESC) WHERE (university_id IS NOT NULL); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.hire_outcomes

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#hire_outcomes]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| hire_id | uuid | true | — |  |  | — |
| asked_at | timestamp with time zone | true | now() |  |  | — |
| answer | text | false | — |  |  | "default" |
| answered_at | timestamp with time zone | false | — |  |  | — |
| answered_by | uuid | false | — |  |  | — |

### Keys and constraints

```sql
hire_outcomes_answer_check: CHECK (answer IS NULL OR (answer = ANY (ARRAY['yes'::text, 'partly'::text, 'no'::text, 'left'::text]))); -- validated: true
```

```sql
hire_outcomes_answered_by_fkey: FOREIGN KEY (answered_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
hire_outcomes_check: CHECK ((answer IS NULL) = (answered_at IS NULL)); -- validated: true
```

```sql
hire_outcomes_hire_id_fkey: FOREIGN KEY (hire_id) REFERENCES hires(id) ON DELETE CASCADE; -- validated: true
```

```sql
hire_outcomes_pkey: PRIMARY KEY (hire_id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX hire_outcomes_pkey ON public.hire_outcomes USING btree (hire_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.hires

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#hires]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| org_id | uuid | true | — |  |  | — |
| student_id | uuid | false | — |  |  | — |
| job_id | uuid | false | — |  |  | — |
| application_id | uuid | false | — |  |  | — |
| hired_by | uuid | false | — |  |  | — |
| job_type | text | true | — |  |  | "default" |
| kind | text | true | — |  |  | "default" |
| hired_at | timestamp with time zone | true | now() |  |  | — |
| fee_status | text | true | 'unbilled'::text |  |  | "default" |

### Keys and constraints

```sql
hires_application_id_fkey: FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE SET NULL; -- validated: true
```

```sql
hires_application_id_key: UNIQUE (application_id); -- validated: true
```

```sql
hires_fee_status_check: CHECK (fee_status = ANY (ARRAY['unbilled'::text, 'invoiced'::text, 'waived'::text])); -- validated: true
```

```sql
hires_hired_by_fkey: FOREIGN KEY (hired_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
hires_job_id_fkey: FOREIGN KEY (job_id) REFERENCES job_posts(id) ON DELETE SET NULL; -- validated: true
```

```sql
hires_job_type_check: CHECK (job_type = ANY (ARRAY['internship'::text, 'full_time'::text, 'part_time'::text])); -- validated: true
```

```sql
hires_kind_check: CHECK (kind = ANY (ARRAY['intern'::text, 'full_time'::text])); -- validated: true
```

```sql
hires_org_id_fkey: FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE; -- validated: true
```

```sql
hires_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
hires_student_id_fkey: FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX hires_application_id_key ON public.hires USING btree (application_id); -- valid: true
```

```sql
CREATE INDEX hires_org_idx ON public.hires USING btree (org_id, hired_at DESC); -- valid: true
```

```sql
CREATE UNIQUE INDEX hires_pkey ON public.hires USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

```sql
CREATE TRIGGER hires_analytics AFTER INSERT ON hires FOR EACH ROW EXECUTE FUNCTION private.analytics_hire(); -- enabled: O
```

```sql
CREATE TRIGGER hires_fee AFTER INSERT ON hires FOR EACH ROW EXECUTE FUNCTION private.on_hire_recorded(); -- enabled: O
```

## public.job_applications

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#job_applications]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| job_id | uuid | true | — |  |  | — |
| student_id | uuid | true | — |  |  | — |
| note | text | false | — |  |  | "default" |
| stage | application_stage | true | 'applied'::application_stage |  |  | — |
| reject_reason | text | false | — |  |  | "default" |
| cv_code | text | false | — |  |  | "default" |
| applied_at | timestamp with time zone | true | now() |  |  | — |
| stage_changed_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
job_applications_check: CHECK ((stage = 'rejected'::application_stage) = (reject_reason IS NOT NULL)); -- validated: true
```

```sql
job_applications_job_id_fkey: FOREIGN KEY (job_id) REFERENCES job_posts(id) ON DELETE CASCADE; -- validated: true
```

```sql
job_applications_job_id_student_id_key: UNIQUE (job_id, student_id); -- validated: true
```

```sql
job_applications_note_check: CHECK (note IS NULL OR char_length(note) <= 300); -- validated: true
```

```sql
job_applications_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
job_applications_reject_reason_check: CHECK (reject_reason IS NULL OR (reject_reason = ANY (ARRAY['skills_gap'::text, 'position_filled'::text, 'other'::text]))); -- validated: true
```

```sql
job_applications_student_id_fkey: FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX job_applications_job_id_student_id_key ON public.job_applications USING btree (job_id, student_id); -- valid: true
```

```sql
CREATE INDEX job_applications_job_idx ON public.job_applications USING btree (job_id, stage); -- valid: true
```

```sql
CREATE UNIQUE INDEX job_applications_pkey ON public.job_applications USING btree (id); -- valid: true
```

```sql
CREATE INDEX job_applications_student_idx ON public.job_applications USING btree (student_id, applied_at DESC); -- valid: true
```

### Policies

None.

### Triggers

```sql
CREATE TRIGGER job_applications_analytics_insert AFTER INSERT ON job_applications FOR EACH ROW EXECUTE FUNCTION private.analytics_application(); -- enabled: O
```

```sql
CREATE TRIGGER job_applications_analytics_update AFTER UPDATE OF stage ON job_applications FOR EACH ROW WHEN (new.stage IS DISTINCT FROM old.stage) EXECUTE FUNCTION private.analytics_application(); -- enabled: O
```

```sql
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON job_applications FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```

## public.job_invites

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#job_invites]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| job_id | uuid | true | — |  |  | — |
| student_id | uuid | true | — |  |  | — |
| invited_by | uuid | false | — |  |  | — |
| at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
job_invites_invited_by_fkey: FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
job_invites_job_id_fkey: FOREIGN KEY (job_id) REFERENCES job_posts(id) ON DELETE CASCADE; -- validated: true
```

```sql
job_invites_pkey: PRIMARY KEY (job_id, student_id); -- validated: true
```

```sql
job_invites_student_id_fkey: FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX job_invites_pkey ON public.job_invites USING btree (job_id, student_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.job_posts

[src: supabase/migrations/20261015000000_recruiter_jobs.sql#job_posts]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| org_id | uuid | true | — |  |  | — |
| created_by | uuid | false | — |  |  | — |
| title | text | true | — |  |  | "default" |
| type | text | true | — |  |  | "default" |
| location | text | false | — |  |  | "default" |
| remote | boolean | true | false |  |  | — |
| salary_min | integer | true | — |  |  | — |
| salary_max | integer | true | — |  |  | — |
| currency | text | true | 'PKR'::text |  |  | "default" |
| pay_period | text | true | 'month'::text |  |  | "default" |
| min_tier | ranking_tier | false | — |  |  | — |
| min_skill_levels | jsonb | true | '[]'::jsonb |  |  | — |
| openings | integer | true | 1 |  |  | — |
| deadline | date | true | — |  |  | — |
| description | text | true | — |  |  | "default" |
| status | job_status | true | 'draft'::job_status |  |  | — |
| published_at | timestamp with time zone | false | — |  |  | — |
| closed_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |
| sponsored_until | timestamp with time zone | false | — |  |  | — |
| paused_at | timestamp with time zone | false | — |  |  | — |

### Keys and constraints

```sql
job_posts_check: CHECK (salary_max >= salary_min); -- validated: true
```

```sql
job_posts_check1: CHECK (remote OR location IS NOT NULL); -- validated: true
```

```sql
job_posts_created_by_fkey: FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
job_posts_currency_check: CHECK (currency = ANY (ARRAY['PKR'::text, 'USD'::text])); -- validated: true
```

```sql
job_posts_description_check: CHECK (char_length(description) >= 50 AND char_length(description) <= 5000); -- validated: true
```

```sql
job_posts_location_check: CHECK (location IS NULL OR char_length(btrim(location)) >= 2 AND char_length(btrim(location)) <= 80); -- validated: true
```

```sql
job_posts_min_skill_levels_check: CHECK (jsonb_typeof(min_skill_levels) = 'array'::text); -- validated: true
```

```sql
job_posts_openings_check: CHECK (openings >= 1 AND openings <= 100); -- validated: true
```

```sql
job_posts_org_id_fkey: FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE; -- validated: true
```

```sql
job_posts_pay_period_check: CHECK (pay_period = ANY (ARRAY['month'::text, 'year'::text])); -- validated: true
```

```sql
job_posts_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
job_posts_salary_min_check: CHECK (salary_min > 0); -- validated: true
```

```sql
job_posts_title_check: CHECK (char_length(btrim(title)) >= 3 AND char_length(btrim(title)) <= 100); -- validated: true
```

```sql
job_posts_type_check: CHECK (type = ANY (ARRAY['internship'::text, 'full_time'::text, 'part_time'::text])); -- validated: true
```

### Indexes

```sql
CREATE INDEX job_posts_live_idx ON public.job_posts USING btree (published_at DESC) WHERE (status = 'live'::job_status); -- valid: true
```

```sql
CREATE INDEX job_posts_org_idx ON public.job_posts USING btree (org_id, status, created_at DESC); -- valid: true
```

```sql
CREATE UNIQUE INDEX job_posts_pkey ON public.job_posts USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

```sql
CREATE TRIGGER job_posts_set_updated_at BEFORE UPDATE ON job_posts FOR EACH ROW EXECUTE FUNCTION private.set_updated_at(); -- enabled: O
```

```sql
CREATE TRIGGER refuse_if_restricted BEFORE INSERT ON job_posts FOR EACH ROW EXECUTE FUNCTION private.refuse_if_restricted(); -- enabled: O
```
