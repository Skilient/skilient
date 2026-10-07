Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# billing_ops

## private.billing_audit(p_action text, p_type text, p_id text, p_reason text, p_before jsonb, p_after jsonb)

[src: supabase/migrations/20261025000000_billing_ops.sql#billing_audit]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.billing_audit(p_action text, p_type text, p_id text, p_reason text, p_before jsonb, p_after jsonb) | plpgsql | true | search_path="" | None | 20261025000000_billing_ops.sql |

## private.final_year_of(p_university uuid)

[src: supabase/migrations/20261025000000_billing_ops.sql#final_year_of]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.final_year_of(p_university uuid) | sql | true | search_path="" | None | 20261025000000_billing_ops.sql |

## private.may_use_simulated()

[src: supabase/migrations/20261025000000_billing_ops.sql#may_use_simulated]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.may_use_simulated() | sql | true | search_path="" | authenticated | 20261025000000_billing_ops.sql |

## private.ops_billing_search(p_q text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_billing_search]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_billing_search(p_q text) | plpgsql | true | search_path="" | authenticated | 20261025000000_billing_ops.sql |

## private.ops_billing_subject(p_type text, p_id uuid)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_billing_subject]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_billing_subject(p_type text, p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261025000000_billing_ops.sql |

## private.ops_billing_tasks()

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_billing_tasks]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_billing_tasks() | plpgsql | true | search_path="" | authenticated | 20261025000000_billing_ops.sql |

## private.ops_close_task(p_task uuid, p_note text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_close_task]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_close_task(p_task uuid, p_note text) | plpgsql | true | search_path="" | authenticated | 20261025000000_billing_ops.sql |

## private.ops_comp_plan(p_type text, p_id uuid, p_plan text, p_months integer, p_reason text, p_po text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_comp_plan]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_comp_plan(p_type text, p_id uuid, p_plan text, p_months integer, p_reason text, p_po text) | plpgsql | true | search_path="" | authenticated | 20261025000000_billing_ops.sql |

## private.ops_end_subscription(p_sub uuid, p_reason text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_end_subscription]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_end_subscription(p_sub uuid, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261025000000_billing_ops.sql |

## private.ops_gateway_activity()

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_gateway_activity]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_gateway_activity() | plpgsql | true | search_path="" | authenticated | 20261025000000_billing_ops.sql |

## private.ops_grant(p_type text, p_id uuid, p_key text, p_value jsonb, p_ends_at timestamp with time zone, p_reason text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_grant]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_grant(p_type text, p_id uuid, p_key text, p_value jsonb, p_ends_at timestamp with time zone, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261025000000_billing_ops.sql |

## private.ops_issue_licence(p_university uuid, p_level text, p_starts date, p_po text, p_reason text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_issue_licence]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_issue_licence(p_university uuid, p_level text, p_starts date, p_po text, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261025000000_billing_ops.sql |

## private.ops_mark_invoice_paid(p_invoice uuid, p_reference text, p_reason text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_mark_invoice_paid]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_mark_invoice_paid(p_invoice uuid, p_reference text, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261025000000_billing_ops.sql |

## private.ops_quota_override(p_type text, p_id uuid, p_key text, p_used integer, p_reason text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_quota_override]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_quota_override(p_type text, p_id uuid, p_key text, p_used integer, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261025000000_billing_ops.sql |

## private.ops_refund(p_payment uuid, p_amount numeric, p_reason text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_refund]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_refund(p_payment uuid, p_amount numeric, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261025000000_billing_ops.sql |

## private.ops_resolve_hire_fee(p_fee uuid, p_outcome text, p_reason text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_resolve_hire_fee]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_resolve_hire_fee(p_fee uuid, p_outcome text, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261025000000_billing_ops.sql |

## private.ops_revenue()

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_revenue]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_revenue() | plpgsql | true | search_path="" | authenticated | 20261025000000_billing_ops.sql |

## private.ops_revoke_grant(p_grant uuid, p_reason text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_revoke_grant]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_revoke_grant(p_grant uuid, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261025000000_billing_ops.sql |

## private.ops_set_tax_rate(p_province text, p_label text, p_rate numeric, p_from date, p_reason text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_set_tax_rate]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_set_tax_rate(p_province text, p_label text, p_rate numeric, p_from date, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261025000000_billing_ops.sql |

## private.ops_simulate(p_sub uuid, p_action text, p_reason text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_simulate]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_simulate(p_sub uuid, p_action text, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261025000000_billing_ops.sql |

## private.ops_void_invoice(p_invoice uuid, p_reason text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_void_invoice]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.ops_void_invoice(p_invoice uuid, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261025000000_billing_ops.sql |

## private.sponsorship_eligible(p_university uuid)

[src: supabase/migrations/20261025000000_billing_ops.sql#sponsorship_eligible]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.sponsorship_eligible(p_university uuid) | sql | true | search_path="" | None | 20261025000000_billing_ops.sql |

## private.sponsorship_end_date()

[src: supabase/migrations/20261025000000_billing_ops.sql#sponsorship_end_date]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.sponsorship_end_date() | sql | true | search_path="" | None | 20261025000000_billing_ops.sql |

## private.sponsorship_sync()

[src: supabase/migrations/20261025000000_billing_ops.sql#sponsorship_sync]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.sponsorship_sync() | plpgsql | true | search_path="" | service_role | 20261025000000_billing_ops.sql |

## private.sponsorship_sync_job()

[src: supabase/migrations/20261025000000_billing_ops.sql#sponsorship_sync_job]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.sponsorship_sync_job() | plpgsql | true | search_path="" | None | 20261025000000_billing_ops.sql |

## private.uni_sponsorship()

[src: supabase/migrations/20261025000000_billing_ops.sql#uni_sponsorship]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.uni_sponsorship() | plpgsql | true | search_path="" | authenticated | 20261025000000_billing_ops.sql |

## private.void_invoice(p_invoice uuid, p_reason text, p_by uuid)

[src: supabase/migrations/20261025000000_billing_ops.sql#void_invoice]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.void_invoice(p_invoice uuid, p_reason text, p_by uuid) | plpgsql | true | search_path="" | None | 20261025000000_billing_ops.sql |

## public.may_use_simulated()

[src: supabase/migrations/20261025000000_billing_ops.sql#may_use_simulated]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.may_use_simulated() | sql | false | search_path="" | authenticated, service_role | 20261025000000_billing_ops.sql |

## public.ops_billing_search(p_q text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_billing_search]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_billing_search(p_q text) | sql | false | search_path="" | authenticated, service_role | 20261025000000_billing_ops.sql |

## public.ops_billing_subject(p_type text, p_id uuid)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_billing_subject]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_billing_subject(p_type text, p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261025000000_billing_ops.sql |

## public.ops_billing_tasks()

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_billing_tasks]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_billing_tasks() | sql | false | search_path="" | authenticated, service_role | 20261025000000_billing_ops.sql |

## public.ops_close_task(p_task uuid, p_note text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_close_task]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_close_task(p_task uuid, p_note text) | sql | false | search_path="" | authenticated, service_role | 20261025000000_billing_ops.sql |

## public.ops_comp_plan(p_type text, p_id uuid, p_plan text, p_months integer, p_reason text, p_po text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_comp_plan]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_comp_plan(p_type text, p_id uuid, p_plan text, p_months integer, p_reason text, p_po text) | sql | false | search_path="" | authenticated, service_role | 20261025000000_billing_ops.sql |

## public.ops_end_subscription(p_sub uuid, p_reason text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_end_subscription]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_end_subscription(p_sub uuid, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261025000000_billing_ops.sql |

## public.ops_gateway_activity()

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_gateway_activity]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_gateway_activity() | sql | false | search_path="" | authenticated, service_role | 20261025000000_billing_ops.sql |

## public.ops_grant(p_type text, p_id uuid, p_key text, p_value jsonb, p_ends_at timestamp with time zone, p_reason text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_grant]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_grant(p_type text, p_id uuid, p_key text, p_value jsonb, p_ends_at timestamp with time zone, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261025000000_billing_ops.sql |

## public.ops_issue_licence(p_university uuid, p_level text, p_starts date, p_po text, p_reason text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_issue_licence]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_issue_licence(p_university uuid, p_level text, p_starts date, p_po text, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261025000000_billing_ops.sql |

## public.ops_mark_invoice_paid(p_invoice uuid, p_reference text, p_reason text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_mark_invoice_paid]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_mark_invoice_paid(p_invoice uuid, p_reference text, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261025000000_billing_ops.sql |

## public.ops_quota_override(p_type text, p_id uuid, p_key text, p_used integer, p_reason text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_quota_override]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_quota_override(p_type text, p_id uuid, p_key text, p_used integer, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261025000000_billing_ops.sql |

## public.ops_refund(p_payment uuid, p_amount numeric, p_reason text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_refund]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_refund(p_payment uuid, p_amount numeric, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261025000000_billing_ops.sql |

## public.ops_resolve_hire_fee(p_fee uuid, p_outcome text, p_reason text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_resolve_hire_fee]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_resolve_hire_fee(p_fee uuid, p_outcome text, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261025000000_billing_ops.sql |

## public.ops_revenue()

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_revenue]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_revenue() | sql | false | search_path="" | authenticated, service_role | 20261025000000_billing_ops.sql |

## public.ops_revoke_grant(p_grant uuid, p_reason text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_revoke_grant]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_revoke_grant(p_grant uuid, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261025000000_billing_ops.sql |

## public.ops_set_tax_rate(p_province text, p_label text, p_rate numeric, p_from date, p_reason text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_set_tax_rate]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_set_tax_rate(p_province text, p_label text, p_rate numeric, p_from date, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261025000000_billing_ops.sql |

## public.ops_simulate(p_sub uuid, p_action text, p_reason text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_simulate]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_simulate(p_sub uuid, p_action text, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261025000000_billing_ops.sql |

## public.ops_void_invoice(p_invoice uuid, p_reason text)

[src: supabase/migrations/20261025000000_billing_ops.sql#ops_void_invoice]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.ops_void_invoice(p_invoice uuid, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261025000000_billing_ops.sql |
