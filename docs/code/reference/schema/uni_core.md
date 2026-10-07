Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# uni_core

## private.accept_uni_invite(p_id uuid)

[src: supabase/migrations/20261017000000_uni_core.sql#accept_uni_invite]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.accept_uni_invite(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.check_profile_department()

[src: supabase/migrations/20261017000000_uni_core.sql#check_profile_department]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.check_profile_department() | plpgsql | true | search_path="" | None | 20261017000000_uni_core.sql |

## private.claim_upload_allowed(p_name text)

[src: supabase/migrations/20261017000000_uni_core.sql#claim_upload_allowed]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.claim_upload_allowed(p_name text) | sql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.decide_final_year_batch(p_id uuid, p_approve boolean, p_reason text)

[src: supabase/migrations/20261017000000_uni_core.sql#decide_final_year_batch]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.decide_final_year_batch(p_id uuid, p_approve boolean, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.decide_uni_claim(p_id uuid, p_approve boolean, p_reason text)

[src: supabase/migrations/20261017000000_uni_core.sql#decide_uni_claim]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.decide_uni_claim(p_id uuid, p_approve boolean, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.decide_uni_domain(p_id uuid, p_approve boolean, p_reason text)

[src: supabase/migrations/20261017000000_uni_core.sql#decide_uni_domain]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.decide_uni_domain(p_id uuid, p_approve boolean, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.delete_department(p_id uuid)

[src: supabase/migrations/20261017000000_uni_core.sql#delete_department]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.delete_department(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.delete_programme(p_id uuid)

[src: supabase/migrations/20261017000000_uni_core.sql#delete_programme]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.delete_programme(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.department_changed()

[src: supabase/migrations/20261017000000_uni_core.sql#department_changed]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.department_changed() | plpgsql | true | search_path="" | None | 20261017000000_uni_core.sql |

## private.department_options()

[src: supabase/migrations/20261017000000_uni_core.sql#department_options]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.department_options() | sql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.email_domain_allowed()

[src: supabase/migrations/20261017000000_uni_core.sql#email_domain_allowed]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.email_domain_allowed() | sql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.guard_uni_admin_email_change()

[src: supabase/migrations/20261017000000_uni_core.sql#guard_uni_admin_email_change]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.guard_uni_admin_email_change() | plpgsql | true | search_path="" | None | 20261017000000_uni_core.sql |

## private.handle_new_user()

[src: supabase/migrations/20261017000000_uni_core.sql#handle_new_user]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.handle_new_user() | plpgsql | true | search_path="" | None | 20261017000000_uni_core.sql |

## private.invite_uni_admin(p_email text, p_role uni_admin_role, p_department uuid, p_token_hash text)

[src: supabase/migrations/20261017000000_uni_core.sql#invite_uni_admin]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.invite_uni_admin(p_email text, p_role uni_admin_role, p_department uuid, p_token_hash text) | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.is_uni_admin_of(p_university uuid)

[src: supabase/migrations/20261017000000_uni_core.sql#is_uni_admin_of]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.is_uni_admin_of(p_university uuid) | sql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.my_uni()

[src: supabase/migrations/20261017000000_uni_core.sql#my_uni]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_uni() | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.my_uni_claim()

[src: supabase/migrations/20261017000000_uni_core.sql#my_uni_claim]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_uni_claim() | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.my_uni_invites()

[src: supabase/migrations/20261017000000_uni_core.sql#my_uni_invites]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_uni_invites() | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.ops_uni_claim(p_id uuid)

[src: supabase/migrations/20261017000000_uni_core.sql#ops_uni_claim]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_uni_claim(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.ops_uni_queue(p_q text)

[src: supabase/migrations/20261017000000_uni_core.sql#ops_uni_queue]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_uni_queue(p_q text) | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.refuse_public_university_domain()

[src: supabase/migrations/20261017000000_uni_core.sql#refuse_public_university_domain]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.refuse_public_university_domain() | plpgsql | true | search_path="" | None | 20261017000000_uni_core.sql |

## private.remove_uni_admin(p_user uuid)

[src: supabase/migrations/20261017000000_uni_core.sql#remove_uni_admin]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.remove_uni_admin(p_user uuid) | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.request_final_year_batch(p_year integer, p_reason text)

[src: supabase/migrations/20261017000000_uni_core.sql#request_final_year_batch]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.request_final_year_batch(p_year integer, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.request_uni_domain(p_domain text, p_kind domain_kind, p_reason text)

[src: supabase/migrations/20261017000000_uni_core.sql#request_uni_domain]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.request_uni_domain(p_domain text, p_kind domain_kind, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.require_uni(p_roles uni_admin_role[])

[src: supabase/migrations/20261017000000_uni_core.sql#require_uni]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.require_uni(p_roles uni_admin_role[]) | plpgsql | true | search_path="" | None | 20261017000000_uni_core.sql |

## private.revoke_uni_invite(p_id uuid)

[src: supabase/migrations/20261017000000_uni_core.sql#revoke_uni_invite]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.revoke_uni_invite(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.save_department(p_id uuid, p_name text)

[src: supabase/migrations/20261017000000_uni_core.sql#save_department]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.save_department(p_id uuid, p_name text) | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.save_programme(p_department uuid, p_name text)

[src: supabase/migrations/20261017000000_uni_core.sql#save_programme]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.save_programme(p_department uuid, p_name text) | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.set_uni_admin_role(p_user uuid, p_role uni_admin_role, p_department uuid)

[src: supabase/migrations/20261017000000_uni_core.sql#set_uni_admin_role]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.set_uni_admin_role(p_user uuid, p_role uni_admin_role, p_department uuid) | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.submit_uni_claim(p jsonb)

[src: supabase/migrations/20261017000000_uni_core.sql#submit_uni_claim]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.submit_uni_claim(p jsonb) | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.sync_profile_department()

[src: supabase/migrations/20261017000000_uni_core.sql#sync_profile_department]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.sync_profile_department() | plpgsql | true | search_path="" | None | 20261017000000_uni_core.sql |

## private.transfer_uni_ownership(p_user uuid)

[src: supabase/migrations/20261017000000_uni_core.sql#transfer_uni_ownership]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.transfer_uni_ownership(p_user uuid) | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.uni_admins_list()

[src: supabase/migrations/20261017000000_uni_core.sql#uni_admins_list]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_admins_list() | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.uni_approve_teacher(p_user uuid)

[src: supabase/migrations/20261017000000_uni_core.sql#uni_approve_teacher]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_approve_teacher(p_user uuid) | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.uni_audit(p_university uuid, p_action text, p_target_type text, p_target_id text, p_detail jsonb)

[src: supabase/migrations/20261017000000_uni_core.sql#uni_audit]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_audit(p_university uuid, p_action text, p_target_type text, p_target_id text, p_detail jsonb) | sql | true | search_path="" | None | 20261017000000_uni_core.sql |

## private.uni_audit_list()

[src: supabase/migrations/20261017000000_uni_core.sql#uni_audit_list]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_audit_list() | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.uni_domains()

[src: supabase/migrations/20261017000000_uni_core.sql#uni_domains]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_domains() | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.uni_entitlements(p_university uuid)

[src: supabase/migrations/20261017000000_uni_core.sql#uni_entitlements]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_entitlements(p_university uuid) | sql | true | search_path="" | None | 20261017000000_uni_core.sql |

## private.uni_import_faculty(p_rows jsonb)

[src: supabase/migrations/20261017000000_uni_core.sql#uni_import_faculty]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_import_faculty(p_rows jsonb) | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.uni_invite_preview(p_token_hash text)

[src: supabase/migrations/20261017000000_uni_core.sql#uni_invite_preview]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_invite_preview(p_token_hash text) | sql | true | search_path="" | anon, authenticated | 20261017000000_uni_core.sql |

## private.uni_revoke_teacher(p_user uuid, p_reason text)

[src: supabase/migrations/20261017000000_uni_core.sql#uni_revoke_teacher]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_revoke_teacher(p_user uuid, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.uni_seat_count(p_university uuid)

[src: supabase/migrations/20261017000000_uni_core.sql#uni_seat_count]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_seat_count(p_university uuid) | sql | true | search_path="" | None | 20261017000000_uni_core.sql |

## private.uni_set_teacher_department(p_user uuid, p_department uuid)

[src: supabase/migrations/20261017000000_uni_core.sql#uni_set_teacher_department]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_set_teacher_department(p_user uuid, p_department uuid) | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.uni_structure()

[src: supabase/migrations/20261017000000_uni_core.sql#uni_structure]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_structure() | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## private.uni_teacher_scope(p_user uuid)

[src: supabase/migrations/20261017000000_uni_core.sql#uni_teacher_scope]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_teacher_scope(p_user uuid) | plpgsql | true | search_path="" | None | 20261017000000_uni_core.sql |

## private.uni_teachers(p_status text)

[src: supabase/migrations/20261017000000_uni_core.sql#uni_teachers]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_teachers(p_status text) | plpgsql | true | search_path="" | authenticated | 20261017000000_uni_core.sql |

## public.accept_uni_invite(p_id uuid)

[src: supabase/migrations/20261017000000_uni_core.sql#accept_uni_invite]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.accept_uni_invite(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.decide_final_year_batch(p_id uuid, p_approve boolean, p_reason text)

[src: supabase/migrations/20261017000000_uni_core.sql#decide_final_year_batch]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.decide_final_year_batch(p_id uuid, p_approve boolean, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.decide_uni_claim(p_id uuid, p_approve boolean, p_reason text)

[src: supabase/migrations/20261017000000_uni_core.sql#decide_uni_claim]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.decide_uni_claim(p_id uuid, p_approve boolean, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.decide_uni_domain(p_id uuid, p_approve boolean, p_reason text)

[src: supabase/migrations/20261017000000_uni_core.sql#decide_uni_domain]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.decide_uni_domain(p_id uuid, p_approve boolean, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.delete_department(p_id uuid)

[src: supabase/migrations/20261017000000_uni_core.sql#delete_department]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.delete_department(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.delete_programme(p_id uuid)

[src: supabase/migrations/20261017000000_uni_core.sql#delete_programme]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.delete_programme(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.department_options()

[src: supabase/migrations/20261017000000_uni_core.sql#department_options]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.department_options() | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.invite_uni_admin(p_email text, p_role uni_admin_role, p_department uuid, p_token_hash text)

[src: supabase/migrations/20261017000000_uni_core.sql#invite_uni_admin]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.invite_uni_admin(p_email text, p_role uni_admin_role, p_department uuid, p_token_hash text) | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.my_uni()

[src: supabase/migrations/20261017000000_uni_core.sql#my_uni]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_uni() | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.my_uni_claim()

[src: supabase/migrations/20261017000000_uni_core.sql#my_uni_claim]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_uni_claim() | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.my_uni_invites()

[src: supabase/migrations/20261017000000_uni_core.sql#my_uni_invites]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_uni_invites() | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.ops_uni_claim(p_id uuid)

[src: supabase/migrations/20261017000000_uni_core.sql#ops_uni_claim]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_uni_claim(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.ops_uni_queue(p_q text)

[src: supabase/migrations/20261017000000_uni_core.sql#ops_uni_queue]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_uni_queue(p_q text) | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.remove_uni_admin(p_user uuid)

[src: supabase/migrations/20261017000000_uni_core.sql#remove_uni_admin]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.remove_uni_admin(p_user uuid) | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.request_final_year_batch(p_year integer, p_reason text)

[src: supabase/migrations/20261017000000_uni_core.sql#request_final_year_batch]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.request_final_year_batch(p_year integer, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.request_uni_domain(p_domain text, p_kind domain_kind, p_reason text)

[src: supabase/migrations/20261017000000_uni_core.sql#request_uni_domain]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.request_uni_domain(p_domain text, p_kind domain_kind, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.revoke_uni_invite(p_id uuid)

[src: supabase/migrations/20261017000000_uni_core.sql#revoke_uni_invite]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.revoke_uni_invite(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.save_department(p_id uuid, p_name text)

[src: supabase/migrations/20261017000000_uni_core.sql#save_department]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.save_department(p_id uuid, p_name text) | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.save_programme(p_department uuid, p_name text)

[src: supabase/migrations/20261017000000_uni_core.sql#save_programme]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.save_programme(p_department uuid, p_name text) | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.set_uni_admin_role(p_user uuid, p_role uni_admin_role, p_department uuid)

[src: supabase/migrations/20261017000000_uni_core.sql#set_uni_admin_role]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.set_uni_admin_role(p_user uuid, p_role uni_admin_role, p_department uuid) | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.submit_uni_claim(p jsonb)

[src: supabase/migrations/20261017000000_uni_core.sql#submit_uni_claim]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.submit_uni_claim(p jsonb) | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.transfer_uni_ownership(p_user uuid)

[src: supabase/migrations/20261017000000_uni_core.sql#transfer_uni_ownership]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.transfer_uni_ownership(p_user uuid) | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.uni_admins_list()

[src: supabase/migrations/20261017000000_uni_core.sql#uni_admins_list]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_admins_list() | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.uni_approve_teacher(p_user uuid)

[src: supabase/migrations/20261017000000_uni_core.sql#uni_approve_teacher]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_approve_teacher(p_user uuid) | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.uni_audit_list()

[src: supabase/migrations/20261017000000_uni_core.sql#uni_audit_list]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_audit_list() | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.uni_domains()

[src: supabase/migrations/20261017000000_uni_core.sql#uni_domains]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_domains() | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.uni_import_faculty(p_rows jsonb)

[src: supabase/migrations/20261017000000_uni_core.sql#uni_import_faculty]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_import_faculty(p_rows jsonb) | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.uni_invite_preview(p_token_hash text)

[src: supabase/migrations/20261017000000_uni_core.sql#uni_invite_preview]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_invite_preview(p_token_hash text) | sql | false | search_path="" | anon, authenticated, service_role | 20261017000000_uni_core.sql |

## public.uni_revoke_teacher(p_user uuid, p_reason text)

[src: supabase/migrations/20261017000000_uni_core.sql#uni_revoke_teacher]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_revoke_teacher(p_user uuid, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.uni_set_teacher_department(p_user uuid, p_department uuid)

[src: supabase/migrations/20261017000000_uni_core.sql#uni_set_teacher_department]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_set_teacher_department(p_user uuid, p_department uuid) | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.uni_structure()

[src: supabase/migrations/20261017000000_uni_core.sql#uni_structure]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_structure() | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.uni_teachers(p_status text)

[src: supabase/migrations/20261017000000_uni_core.sql#uni_teachers]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.uni_teachers(p_status text) | sql | false | search_path="" | authenticated, service_role | 20261017000000_uni_core.sql |

## public.departments

[src: supabase/migrations/20261017000000_uni_core.sql#departments]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| university_id | uuid | true | — |  |  | — |
| name | text | true | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
departments_name_check: CHECK (char_length(btrim(name)) >= 2 AND char_length(btrim(name)) <= 80); -- validated: true
```

```sql
departments_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
departments_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX departments_name_idx ON public.departments USING btree (university_id, lower(name)); -- valid: true
```

```sql
CREATE UNIQUE INDEX departments_pkey ON public.departments USING btree (id); -- valid: true
```

### Policies

#### departments.departments_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "true",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

```sql
CREATE TRIGGER departments_changed AFTER INSERT OR UPDATE OF name ON departments FOR EACH ROW EXECUTE FUNCTION private.department_changed(); -- enabled: O
```

## public.final_year_batch_requests

[src: supabase/migrations/20261017000000_uni_core.sql#final_year_batch_requests]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| university_id | uuid | true | — |  |  | — |
| batch_year | smallint | false | — |  |  | — |
| reason | text | true | — |  |  | "default" |
| requested_by | uuid | false | — |  |  | — |
| status | uni_request_status | true | 'pending'::uni_request_status |  |  | — |
| review_reason | text | false | — |  |  | "default" |
| reviewed_by | uuid | false | — |  |  | — |
| reviewed_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
final_year_batch_requests_batch_year_check: CHECK (batch_year IS NULL OR batch_year >= 2000 AND batch_year <= 2100); -- validated: true
```

```sql
final_year_batch_requests_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
final_year_batch_requests_reason_check: CHECK (char_length(btrim(reason)) >= 3 AND char_length(btrim(reason)) <= 500); -- validated: true
```

```sql
final_year_batch_requests_requested_by_fkey: FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
final_year_batch_requests_review_reason_check: CHECK (review_reason IS NULL OR char_length(review_reason) <= 2000); -- validated: true
```

```sql
final_year_batch_requests_reviewed_by_fkey: FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
final_year_batch_requests_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX final_year_batch_requests_pkey ON public.final_year_batch_requests USING btree (id); -- valid: true
```

```sql
CREATE INDEX final_year_batch_requests_queue_idx ON public.final_year_batch_requests USING btree (status, created_at); -- valid: true
```

```sql
CREATE INDEX final_year_batch_requests_requested_by_idx ON public.final_year_batch_requests USING btree (requested_by); -- valid: true
```

```sql
CREATE INDEX final_year_batch_requests_reviewed_by_idx ON public.final_year_batch_requests USING btree (reviewed_by); -- valid: true
```

```sql
CREATE INDEX final_year_batch_requests_uni_idx ON public.final_year_batch_requests USING btree (university_id, created_at DESC); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.programmes

[src: supabase/migrations/20261017000000_uni_core.sql#programmes]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| department_id | uuid | true | — |  |  | — |
| name | text | true | — |  |  | "default" |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
programmes_department_id_fkey: FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE; -- validated: true
```

```sql
programmes_name_check: CHECK (char_length(btrim(name)) >= 2 AND char_length(btrim(name)) <= 80); -- validated: true
```

```sql
programmes_pkey: PRIMARY KEY (id); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX programmes_name_idx ON public.programmes USING btree (department_id, lower(name)); -- valid: true
```

```sql
CREATE UNIQUE INDEX programmes_pkey ON public.programmes USING btree (id); -- valid: true
```

### Policies

#### programmes.programmes_read

```json
{
  "roles": [
    "authenticated"
  ],
  "using": "true",
  "command": "r",
  "permissive": true,
  "with_check": null
}
```

### Triggers

None.

## public.university_admin_invites

[src: supabase/migrations/20261017000000_uni_core.sql#university_admin_invites]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| university_id | uuid | true | — |  |  | — |
| email | text | true | — |  |  | "default" |
| role | uni_admin_role | true | — |  |  | — |
| department_id | uuid | false | — |  |  | — |
| token_hash | text | true | — |  |  | "default" |
| invited_by | uuid | false | — |  |  | — |
| expires_at | timestamp with time zone | true | — |  |  | — |
| used_at | timestamp with time zone | false | — |  |  | — |
| revoked_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
university_admin_invites_check: CHECK ((role = 'coordinator'::uni_admin_role) = (department_id IS NOT NULL)); -- validated: true
```

```sql
university_admin_invites_department_id_fkey: FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE; -- validated: true
```

```sql
university_admin_invites_email_check: CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+$'::text AND char_length(email) <= 254); -- validated: true
```

```sql
university_admin_invites_invited_by_fkey: FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
university_admin_invites_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
university_admin_invites_role_check: CHECK (role <> 'owner'::uni_admin_role); -- validated: true
```

```sql
university_admin_invites_token_hash_check: CHECK (token_hash ~ '^[0-9a-f]{64}$'::text); -- validated: true
```

```sql
university_admin_invites_token_hash_key: UNIQUE (token_hash); -- validated: true
```

```sql
university_admin_invites_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX university_admin_invites_department_idx ON public.university_admin_invites USING btree (department_id); -- valid: true
```

```sql
CREATE INDEX university_admin_invites_email_idx ON public.university_admin_invites USING btree (email); -- valid: true
```

```sql
CREATE INDEX university_admin_invites_invited_by_idx ON public.university_admin_invites USING btree (invited_by); -- valid: true
```

```sql
CREATE UNIQUE INDEX university_admin_invites_pkey ON public.university_admin_invites USING btree (id); -- valid: true
```

```sql
CREATE UNIQUE INDEX university_admin_invites_token_hash_key ON public.university_admin_invites USING btree (token_hash); -- valid: true
```

```sql
CREATE INDEX university_admin_invites_uni_idx ON public.university_admin_invites USING btree (university_id, created_at DESC); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.university_admins

[src: supabase/migrations/20261017000000_uni_core.sql#university_admins]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| user_id | uuid | true | — |  |  | — |
| university_id | uuid | true | — |  |  | — |
| role | uni_admin_role | true | — |  |  | — |
| department_id | uuid | false | — |  |  | — |
| invited_by | uuid | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
university_admins_check: CHECK ((role = 'coordinator'::uni_admin_role) = (department_id IS NOT NULL)); -- validated: true
```

```sql
university_admins_department_id_fkey: FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT; -- validated: true
```

```sql
university_admins_invited_by_fkey: FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
university_admins_pkey: PRIMARY KEY (user_id); -- validated: true
```

```sql
university_admins_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE; -- validated: true
```

```sql
university_admins_user_id_fkey: FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX university_admins_department_idx ON public.university_admins USING btree (department_id); -- valid: true
```

```sql
CREATE INDEX university_admins_invited_by_idx ON public.university_admins USING btree (invited_by); -- valid: true
```

```sql
CREATE UNIQUE INDEX university_admins_one_owner_idx ON public.university_admins USING btree (university_id) WHERE (role = 'owner'::uni_admin_role); -- valid: true
```

```sql
CREATE UNIQUE INDEX university_admins_pkey ON public.university_admins USING btree (user_id); -- valid: true
```

```sql
CREATE INDEX university_admins_university_idx ON public.university_admins USING btree (university_id, role); -- valid: true
```

### Policies

#### university_admins.university_admins_read_own

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

## public.university_audit_log

[src: supabase/migrations/20261017000000_uni_core.sql#university_audit_log]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint | true | — | a |  | — |
| university_id | uuid | true | — |  |  | — |
| actor_id | uuid | false | — |  |  | — |
| action | text | true | — |  |  | "default" |
| target_type | text | true | — |  |  | "default" |
| target_id | text | false | — |  |  | "default" |
| detail | jsonb | true | '{}'::jsonb |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
university_audit_log_action_check: CHECK (char_length(action) >= 1 AND char_length(action) <= 80); -- validated: true
```

```sql
university_audit_log_actor_id_fkey: FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
university_audit_log_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
university_audit_log_target_id_check: CHECK (target_id IS NULL OR char_length(target_id) <= 200); -- validated: true
```

```sql
university_audit_log_target_type_check: CHECK (char_length(target_type) >= 1 AND char_length(target_type) <= 40); -- validated: true
```

```sql
university_audit_log_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE INDEX university_audit_log_actor_idx ON public.university_audit_log USING btree (actor_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX university_audit_log_pkey ON public.university_audit_log USING btree (id); -- valid: true
```

```sql
CREATE INDEX university_audit_log_uni_idx ON public.university_audit_log USING btree (university_id, created_at DESC); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.university_claims

[src: supabase/migrations/20261017000000_uni_core.sql#university_claims]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| university_id | uuid | true | — |  |  | — |
| requester_id | uuid | true | — |  |  | — |
| title | text | true | — |  |  | "default" |
| note | text | false | — |  |  | "default" |
| letter_path | text | true | — |  |  | "default" |
| letter_bytes | bigint | true | — |  |  | — |
| status | uni_request_status | true | 'pending'::uni_request_status |  |  | — |
| review_reason | text | false | — |  |  | "default" |
| reviewed_by | uuid | false | — |  |  | — |
| reviewed_at | timestamp with time zone | false | — |  |  | — |
| letter_deleted_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
university_claims_check: CHECK ((status = 'pending'::uni_request_status) = (reviewed_at IS NULL)); -- validated: true
```

```sql
university_claims_letter_bytes_check: CHECK (letter_bytes >= 1 AND letter_bytes <= 5242880); -- validated: true
```

```sql
university_claims_letter_path_check: CHECK (letter_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|webp)$'::text); -- validated: true
```

```sql
university_claims_note_check: CHECK (note IS NULL OR char_length(note) <= 1000); -- validated: true
```

```sql
university_claims_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
university_claims_requester_id_fkey: FOREIGN KEY (requester_id) REFERENCES auth.users(id) ON DELETE CASCADE; -- validated: true
```

```sql
university_claims_review_reason_check: CHECK (review_reason IS NULL OR char_length(review_reason) <= 2000); -- validated: true
```

```sql
university_claims_reviewed_by_fkey: FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
university_claims_title_check: CHECK (char_length(btrim(title)) >= 2 AND char_length(btrim(title)) <= 80); -- validated: true
```

```sql
university_claims_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX university_claims_one_open_idx ON public.university_claims USING btree (university_id) WHERE (status = 'pending'::uni_request_status); -- valid: true
```

```sql
CREATE UNIQUE INDEX university_claims_pkey ON public.university_claims USING btree (id); -- valid: true
```

```sql
CREATE INDEX university_claims_queue_idx ON public.university_claims USING btree (status, created_at); -- valid: true
```

```sql
CREATE INDEX university_claims_requester_idx ON public.university_claims USING btree (requester_id); -- valid: true
```

```sql
CREATE INDEX university_claims_reviewed_by_idx ON public.university_claims USING btree (reviewed_by); -- valid: true
```

```sql
CREATE INDEX university_claims_university_idx ON public.university_claims USING btree (university_id, created_at DESC); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.university_domain_requests

[src: supabase/migrations/20261017000000_uni_core.sql#university_domain_requests]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| university_id | uuid | true | — |  |  | — |
| domain | text | true | — |  |  | "default" |
| kind | domain_kind | true | 'both'::domain_kind |  |  | — |
| reason | text | true | — |  |  | "default" |
| requested_by | uuid | false | — |  |  | — |
| status | uni_request_status | true | 'pending'::uni_request_status |  |  | — |
| review_reason | text | false | — |  |  | "default" |
| reviewed_by | uuid | false | — |  |  | — |
| reviewed_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
university_domain_requests_domain_check: CHECK (char_length(domain) <= 253 AND domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'::text); -- validated: true
```

```sql
university_domain_requests_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
university_domain_requests_reason_check: CHECK (char_length(btrim(reason)) >= 3 AND char_length(btrim(reason)) <= 500); -- validated: true
```

```sql
university_domain_requests_requested_by_fkey: FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
university_domain_requests_review_reason_check: CHECK (review_reason IS NULL OR char_length(review_reason) <= 2000); -- validated: true
```

```sql
university_domain_requests_reviewed_by_fkey: FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
university_domain_requests_university_id_fkey: FOREIGN KEY (university_id) REFERENCES universities(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX university_domain_requests_open_idx ON public.university_domain_requests USING btree (domain) WHERE (status = 'pending'::uni_request_status); -- valid: true
```

```sql
CREATE UNIQUE INDEX university_domain_requests_pkey ON public.university_domain_requests USING btree (id); -- valid: true
```

```sql
CREATE INDEX university_domain_requests_queue_idx ON public.university_domain_requests USING btree (status, created_at); -- valid: true
```

```sql
CREATE INDEX university_domain_requests_requested_by_idx ON public.university_domain_requests USING btree (requested_by); -- valid: true
```

```sql
CREATE INDEX university_domain_requests_reviewed_by_idx ON public.university_domain_requests USING btree (reviewed_by); -- valid: true
```

```sql
CREATE INDEX university_domain_requests_uni_idx ON public.university_domain_requests USING btree (university_id, created_at DESC); -- valid: true
```

### Policies

None.

### Triggers

None.
