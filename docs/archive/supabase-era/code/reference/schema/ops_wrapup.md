Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# ops_wrapup

## private.add_exam_period(p_university uuid, p_starts date, p_ends date, p_reason text)

[src: supabase/migrations/20261030000000_ops_wrapup.sql#add_exam_period]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.add_exam_period(p_university uuid, p_starts date, p_ends date, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261030000000_ops_wrapup.sql |

## private.my_org_document()

[src: supabase/migrations/20261030000000_ops_wrapup.sql#my_org_document]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.my_org_document() | sql | true | search_path="" | authenticated | 20261030000000_ops_wrapup.sql |

## private.ops_add_uni_domain(p_university uuid, p_domain text, p_kind text, p_reason text)

[src: supabase/migrations/20261030000000_ops_wrapup.sql#ops_add_uni_domain]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_add_uni_domain(p_university uuid, p_domain text, p_kind text, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261030000000_ops_wrapup.sql |

## private.ops_assign_uni_owner(p_university uuid, p_email text, p_reason text)

[src: supabase/migrations/20261030000000_ops_wrapup.sql#ops_assign_uni_owner]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_assign_uni_owner(p_university uuid, p_email text, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261030000000_ops_wrapup.sql |

## private.ops_org_document(p_org uuid)

[src: supabase/migrations/20261030000000_ops_wrapup.sql#ops_org_document]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_org_document(p_org uuid) | plpgsql | true | search_path="" | authenticated | 20261030000000_ops_wrapup.sql |

## private.ops_remove_uni_question(p_id uuid, p_reason text)

[src: supabase/migrations/20261030000000_ops_wrapup.sql#ops_remove_uni_question]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_remove_uni_question(p_id uuid, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261030000000_ops_wrapup.sql |

## private.ops_resolve_spam_review(p_id uuid, p_action text, p_reason text)

[src: supabase/migrations/20261030000000_ops_wrapup.sql#ops_resolve_spam_review]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_resolve_spam_review(p_id uuid, p_action text, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261030000000_ops_wrapup.sql |

## private.ops_uni_list(p_query text)

[src: supabase/migrations/20261030000000_ops_wrapup.sql#ops_uni_list]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_uni_list(p_query text) | plpgsql | true | search_path="" | authenticated | 20261030000000_ops_wrapup.sql |

## private.ops_uni_record(p_id uuid)

[src: supabase/migrations/20261030000000_ops_wrapup.sql#ops_uni_record]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_uni_record(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261030000000_ops_wrapup.sql |

## private.org_doc_readable(p_name text)

[src: supabase/migrations/20261030000000_ops_wrapup.sql#org_doc_readable]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.org_doc_readable(p_name text) | sql | true | search_path="" | authenticated | 20261030000000_ops_wrapup.sql |

## private.org_doc_upload_allowed(p_name text)

[src: supabase/migrations/20261030000000_ops_wrapup.sql#org_doc_upload_allowed]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.org_doc_upload_allowed(p_name text) | sql | true | search_path="" | authenticated | 20261030000000_ops_wrapup.sql |

## private.queue_storage_cleanup(p_bucket text, p_path text)

[src: supabase/migrations/20261030000000_ops_wrapup.sql#queue_storage_cleanup]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.queue_storage_cleanup(p_bucket text, p_path text) | sql | true | search_path="" | None | 20261030000000_ops_wrapup.sql |

## private.remove_exam_period(p_id uuid, p_reason text)

[src: supabase/migrations/20261030000000_ops_wrapup.sql#remove_exam_period]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.remove_exam_period(p_id uuid, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261030000000_ops_wrapup.sql |

## private.submit_org_document(p_path text)

[src: supabase/migrations/20261030000000_ops_wrapup.sql#submit_org_document]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.submit_org_document(p_path text) | plpgsql | true | search_path="" | authenticated | 20261030000000_ops_wrapup.sql |

## public.my_org_document()

[src: supabase/migrations/20261030000000_ops_wrapup.sql#my_org_document]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.my_org_document() | sql | false | search_path="" | authenticated, service_role | 20261030000000_ops_wrapup.sql |

## public.ops_add_uni_domain(p_university uuid, p_domain text, p_kind text, p_reason text)

[src: supabase/migrations/20261030000000_ops_wrapup.sql#ops_add_uni_domain]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_add_uni_domain(p_university uuid, p_domain text, p_kind text, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261030000000_ops_wrapup.sql |

## public.ops_assign_uni_owner(p_university uuid, p_email text, p_reason text)

[src: supabase/migrations/20261030000000_ops_wrapup.sql#ops_assign_uni_owner]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_assign_uni_owner(p_university uuid, p_email text, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261030000000_ops_wrapup.sql |

## public.ops_org_document(p_org uuid)

[src: supabase/migrations/20261030000000_ops_wrapup.sql#ops_org_document]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_org_document(p_org uuid) | sql | false | search_path="" | authenticated, service_role | 20261030000000_ops_wrapup.sql |

## public.ops_uni_list(p_query text)

[src: supabase/migrations/20261030000000_ops_wrapup.sql#ops_uni_list]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_uni_list(p_query text) | sql | false | search_path="" | authenticated, service_role | 20261030000000_ops_wrapup.sql |

## public.ops_uni_record(p_id uuid)

[src: supabase/migrations/20261030000000_ops_wrapup.sql#ops_uni_record]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_uni_record(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261030000000_ops_wrapup.sql |

## public.submit_org_document(p_path text)

[src: supabase/migrations/20261030000000_ops_wrapup.sql#submit_org_document]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.submit_org_document(p_path text) | sql | false | search_path="" | authenticated, service_role | 20261030000000_ops_wrapup.sql |
