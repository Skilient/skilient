Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# billing_lifecycle

## private.apply_org_limits(p_org uuid)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#apply_org_limits]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.apply_org_limits(p_org uuid) | plpgsql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.apply_subscription_payment(c checkout_sessions, e jsonb, p_gateway text, p_payment uuid)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#apply_subscription_payment]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.apply_subscription_payment(c checkout_sessions, e jsonb, p_gateway text, p_payment uuid) | plpgsql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.bill_to(p_type billing_subject, p_id uuid)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#bill_to]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.bill_to(p_type billing_subject, p_id uuid) | sql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.billing_apply_event(p_id bigint)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#billing_apply_event]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.billing_apply_event(p_id bigint) | plpgsql | true | search_path="" | service_role | 20261024000000_billing_lifecycle.sql |

## private.billing_company()

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#billing_company]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.billing_company() | sql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.billing_history(p_type billing_subject, p_id uuid)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#billing_history]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.billing_history(p_type billing_subject, p_id uuid) | sql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.billing_job_done(p_msg bigint)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#billing_job_done]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.billing_job_done(p_msg bigint) | sql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.billing_job_failed(p_msg bigint, p_read integer, p_job jsonb, p_error text)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#billing_job_failed]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.billing_job_failed(p_msg bigint, p_read integer, p_job jsonb, p_error text) | plpgsql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.billing_jobs_read(p_max integer)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#billing_jobs_read]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.billing_jobs_read(p_max integer) | sql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.billing_live_mode()

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#billing_live_mode]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.billing_live_mode() | sql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.billing_notify(p_type billing_subject, p_id uuid, p_ntype text, p_entity uuid, p_data jsonb)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#billing_notify]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.billing_notify(p_type billing_subject, p_id uuid, p_ntype text, p_entity uuid, p_data jsonb) | sql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.billing_overview(p_subject text)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#billing_overview]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.billing_overview(p_subject text) | plpgsql | true | search_path="" | authenticated | 20261024000000_billing_lifecycle.sql |

## private.billing_process_events(p_max integer)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#billing_process_events]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.billing_process_events(p_max integer) | plpgsql | true | search_path="" | service_role | 20261024000000_billing_lifecycle.sql |

## private.billing_quote(p_type billing_subject, p_id uuid, p_lines jsonb, p_currency text)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#billing_quote]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.billing_quote(p_type billing_subject, p_id uuid, p_lines jsonb, p_currency text) | plpgsql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.billing_readers(p_type billing_subject, p_id uuid)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#billing_readers]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.billing_readers(p_type billing_subject, p_id uuid) | sql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.billing_subject_name(p_type billing_subject, p_id uuid)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#billing_subject_name]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.billing_subject_name(p_type billing_subject, p_id uuid) | sql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.billing_subject_of_caller(p_subject text)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#billing_subject_of_caller]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.billing_subject_of_caller(p_subject text) | plpgsql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.billing_tick()

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#billing_tick]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.billing_tick() | plpgsql | true | search_path="" | service_role | 20261024000000_billing_lifecycle.sql |

## private.billing_tick_job()

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#billing_tick_job]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.billing_tick_job() | plpgsql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.cancel_checkout(p_id uuid)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#cancel_checkout]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.cancel_checkout(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261024000000_billing_lifecycle.sql |

## private.cancel_subscription(p_subject text, p_resume boolean)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#cancel_subscription]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.cancel_subscription(p_subject text, p_resume boolean) | plpgsql | true | search_path="" | authenticated | 20261024000000_billing_lifecycle.sql |

## private.check_gateway(p_gateway text, p_currency text)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#check_gateway]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.check_gateway(p_gateway text, p_currency text) | sql | false | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.checkout_session(p_id uuid)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#checkout_session]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.checkout_session(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261024000000_billing_lifecycle.sql |

## private.checkout_session_title(p_id uuid)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#checkout_session_title]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.checkout_session_title(p_id uuid) | sql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.choose_seats(p_keep uuid[])

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#choose_seats]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.choose_seats(p_keep uuid[]) | plpgsql | true | search_path="" | authenticated | 20261024000000_billing_lifecycle.sql |

## private.company_complete(p_with_tax boolean)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#company_complete]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.company_complete(p_with_tax boolean) | sql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.consume_quota(p_org uuid, p_key text, p_amount integer)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#consume_quota]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.consume_quota(p_org uuid, p_key text, p_amount integer) | plpgsql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.create_add_on_checkout(p_kind text, p_quantity integer, p_job uuid, p_currency text, p_gateway text, p_key text)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#create_add_on_checkout]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.create_add_on_checkout(p_kind text, p_quantity integer, p_job uuid, p_currency text, p_gateway text, p_key text) | plpgsql | true | search_path="" | authenticated | 20261024000000_billing_lifecycle.sql |

## private.create_checkout(p_subject text, p_plan text, p_currency text, p_gateway text, p_key text)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#create_checkout]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.create_checkout(p_subject text, p_plan text, p_currency text, p_gateway text, p_key text) | plpgsql | true | search_path="" | authenticated | 20261024000000_billing_lifecycle.sql |

## private.create_invoice_checkout(p_subject text, p_invoice uuid, p_gateway text, p_key text)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#create_invoice_checkout]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.create_invoice_checkout(p_subject text, p_invoice uuid, p_gateway text, p_key text) | plpgsql | true | search_path="" | authenticated | 20261024000000_billing_lifecycle.sql |

## private.current_subscription(p_type billing_subject, p_id uuid)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#current_subscription]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.current_subscription(p_type billing_subject, p_id uuid) | sql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.current_subscription_period(p_type billing_subject, p_id uuid)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#current_subscription_period]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.current_subscription_period(p_type billing_subject, p_id uuid) | sql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.dispute_hire_fee(p_id uuid, p_kind text, p_reason text)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#dispute_hire_fee]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.dispute_hire_fee(p_id uuid, p_kind text, p_reason text) | plpgsql | true | search_path="" | authenticated | 20261024000000_billing_lifecycle.sql |

## private.document_for_payment(p_payment uuid, p_quote jsonb, p_purpose text)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#document_for_payment]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.document_for_payment(p_payment uuid, p_quote jsonb, p_purpose text) | plpgsql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.email_channel_for(p_user uuid, p_type text)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#email_channel_for]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.email_channel_for(p_user uuid, p_type text) | sql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.expire_subscription(p_sub uuid, p_reason text)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#expire_subscription]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.expire_subscription(p_sub uuid, p_reason text) | plpgsql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.fulfil_add_on(p_order uuid)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#fulfil_add_on]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.fulfil_add_on(p_order uuid) | plpgsql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.insert_payment(p_type billing_subject, p_id uuid, p_kind text, p_amount numeric, p_currency text, p_gateway text, p_payment_id text, p_method text, p_live boolean, p_sub uuid, p_session uuid, p_mor_ref text)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#insert_payment]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.insert_payment(p_type billing_subject, p_id uuid, p_kind text, p_amount numeric, p_currency text, p_gateway text, p_payment_id text, p_method text, p_live boolean, p_sub uuid, p_session uuid, p_mor_ref text) | plpgsql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.invoice_document(p_id uuid)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#invoice_document]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.invoice_document(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261024000000_billing_lifecycle.sql |

## private.invoice_immutable()

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#invoice_immutable]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.invoice_immutable() | plpgsql | false | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.issue_invoice(p_type billing_subject, p_id uuid, p_kind text, p_purpose text, p_quote jsonb, p_live boolean, p_status text, p_due_at timestamp with time zone, p_payment uuid, p_po text, p_credits uuid, p_by uuid)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#issue_invoice]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.issue_invoice(p_type billing_subject, p_id uuid, p_kind text, p_purpose text, p_quote jsonb, p_live boolean, p_status text, p_due_at timestamp with time zone, p_payment uuid, p_po text, p_credits uuid, p_by uuid) | plpgsql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.lifecycle(p_key text)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#lifecycle]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.lifecycle(p_key text) | sql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.next_invoice_number(p_series text)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#next_invoice_number]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.next_invoice_number(p_series text) | plpgsql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.on_hire_recorded()

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#on_hire_recorded]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.on_hire_recorded() | plpgsql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.open_session(p_type billing_subject, p_id uuid, p_purpose text, p_plan text, p_change text, p_add_on uuid, p_invoice uuid, p_quote jsonb, p_gateway text, p_key text)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#open_session]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.open_session(p_type billing_subject, p_id uuid, p_purpose text, p_plan text, p_change text, p_add_on uuid, p_invoice uuid, p_quote jsonb, p_gateway text, p_key text) | plpgsql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.opportunities(p_tab text, p_after integer)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#opportunities]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.opportunities(p_tab text, p_after integer) | plpgsql | true | search_path="" | authenticated | 20261024000000_billing_lifecycle.sql |

## private.plan_interval(p_plan text)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#plan_interval]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.plan_interval(p_plan text) | sql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.plan_rank(p_plan text)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#plan_rank]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.plan_rank(p_plan text) | sql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.queue_charge(p_sub uuid)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#queue_charge]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.queue_charge(p_sub uuid) | plpgsql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.record_billing_event(p_gateway text, p_event_id text, p_type text, p_payload jsonb, p_event jsonb, p_live boolean)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#record_billing_event]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.record_billing_event(p_gateway text, p_event_id text, p_type text, p_payload jsonb, p_event jsonb, p_live boolean) | plpgsql | true | search_path="" | service_role | 20261024000000_billing_lifecycle.sql |

## private.renewal_quote(p_sub uuid)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#renewal_quote]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.renewal_quote(p_sub uuid) | plpgsql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.reopen_paused_job(p_id uuid)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#reopen_paused_job]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.reopen_paused_job(p_id uuid) | plpgsql | true | search_path="" | authenticated | 20261024000000_billing_lifecycle.sql |

## private.request_licence(p_level text, p_note text)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#request_licence]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.request_licence(p_level text, p_note text) | plpgsql | true | search_path="" | authenticated | 20261024000000_billing_lifecycle.sql |

## private.roll_period(p_sub uuid, p_amount numeric)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#roll_period]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.roll_period(p_sub uuid, p_amount numeric) | plpgsql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.save_billing_details(p_subject text, p jsonb)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#save_billing_details]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.save_billing_details(p_subject text, p jsonb) | plpgsql | true | search_path="" | authenticated | 20261024000000_billing_lifecycle.sql |

## private.schedule_plan_change(p_subject text, p_plan text)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#schedule_plan_change]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.schedule_plan_change(p_subject text, p_plan text) | plpgsql | true | search_path="" | authenticated | 20261024000000_billing_lifecycle.sql |

## private.start_trial()

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#start_trial]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.start_trial() | plpgsql | true | search_path="" | authenticated | 20261024000000_billing_lifecycle.sql |

## private.subject_province(p_type billing_subject, p_id uuid)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#subject_province]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.subject_province(p_type billing_subject, p_id uuid) | sql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.subscription_json(s subscriptions)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#subscription_json]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.subscription_json(s subscriptions) | sql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.sync_plan_grants(p_sub uuid)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#sync_plan_grants]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.sync_plan_grants(p_sub uuid) | plpgsql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.tax_rate_for(p_province text, p_on date)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#tax_rate_for]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.tax_rate_for(p_province text, p_on date) | sql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## private.wake_billing_worker()

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#wake_billing_worker]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| private.wake_billing_worker() | plpgsql | true | search_path="" | None | 20261024000000_billing_lifecycle.sql |

## public.billing_overview(p_subject text)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#billing_overview]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.billing_overview(p_subject text) | sql | false | search_path="" | authenticated, service_role | 20261024000000_billing_lifecycle.sql |

## public.cancel_checkout(p_id uuid)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#cancel_checkout]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.cancel_checkout(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261024000000_billing_lifecycle.sql |

## public.cancel_subscription(p_subject text, p_resume boolean)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#cancel_subscription]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.cancel_subscription(p_subject text, p_resume boolean) | sql | false | search_path="" | authenticated, service_role | 20261024000000_billing_lifecycle.sql |

## public.checkout_session(p_id uuid)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#checkout_session]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.checkout_session(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261024000000_billing_lifecycle.sql |

## public.choose_seats(p_keep uuid[])

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#choose_seats]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.choose_seats(p_keep uuid[]) | sql | false | search_path="" | authenticated, service_role | 20261024000000_billing_lifecycle.sql |

## public.create_add_on_checkout(p_kind text, p_quantity integer, p_job uuid, p_currency text, p_gateway text, p_key text)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#create_add_on_checkout]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.create_add_on_checkout(p_kind text, p_quantity integer, p_job uuid, p_currency text, p_gateway text, p_key text) | sql | false | search_path="" | authenticated, service_role | 20261024000000_billing_lifecycle.sql |

## public.create_checkout(p_subject text, p_plan text, p_currency text, p_gateway text, p_key text)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#create_checkout]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.create_checkout(p_subject text, p_plan text, p_currency text, p_gateway text, p_key text) | sql | false | search_path="" | authenticated, service_role | 20261024000000_billing_lifecycle.sql |

## public.create_invoice_checkout(p_subject text, p_invoice uuid, p_gateway text, p_key text)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#create_invoice_checkout]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.create_invoice_checkout(p_subject text, p_invoice uuid, p_gateway text, p_key text) | sql | false | search_path="" | authenticated, service_role | 20261024000000_billing_lifecycle.sql |

## public.dispute_hire_fee(p_id uuid, p_kind text, p_reason text)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#dispute_hire_fee]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.dispute_hire_fee(p_id uuid, p_kind text, p_reason text) | sql | false | search_path="" | authenticated, service_role | 20261024000000_billing_lifecycle.sql |

## public.invoice_document(p_id uuid)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#invoice_document]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.invoice_document(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261024000000_billing_lifecycle.sql |

## public.record_billing_event(p_gateway text, p_event_id text, p_type text, p_payload jsonb, p_event jsonb, p_live boolean)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#record_billing_event]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.record_billing_event(p_gateway text, p_event_id text, p_type text, p_payload jsonb, p_event jsonb, p_live boolean) | sql | false | search_path="" | service_role | 20261024000000_billing_lifecycle.sql |

## public.reopen_paused_job(p_id uuid)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#reopen_paused_job]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.reopen_paused_job(p_id uuid) | sql | false | search_path="" | authenticated, service_role | 20261024000000_billing_lifecycle.sql |

## public.request_licence(p_level text, p_note text)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#request_licence]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.request_licence(p_level text, p_note text) | sql | false | search_path="" | authenticated, service_role | 20261024000000_billing_lifecycle.sql |

## public.save_billing_details(p_subject text, p jsonb)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#save_billing_details]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.save_billing_details(p_subject text, p jsonb) | sql | false | search_path="" | authenticated, service_role | 20261024000000_billing_lifecycle.sql |

## public.schedule_plan_change(p_subject text, p_plan text)

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#schedule_plan_change]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.schedule_plan_change(p_subject text, p_plan text) | sql | false | search_path="" | authenticated, service_role | 20261024000000_billing_lifecycle.sql |

## public.start_trial()

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#start_trial]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| public.start_trial() | sql | false | search_path="" | authenticated, service_role | 20261024000000_billing_lifecycle.sql |

## public.add_on_orders

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#add_on_orders]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| subject_type | billing_subject | true | — |  |  | — |
| subject_id | uuid | true | — |  |  | — |
| kind | text | true | — |  |  | "default" |
| quantity | integer | true | — |  |  | — |
| job_id | uuid | false | — |  |  | — |
| amount | numeric(12,2) | true | — |  |  | — |
| currency | text | true | — |  |  | "default" |
| status | text | true | 'pending'::text |  |  | "default" |
| live | boolean | true | — |  |  | — |
| fulfilled_at | timestamp with time zone | false | — |  |  | — |
| grant_id | uuid | false | — |  |  | — |
| created_by | uuid | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
add_on_orders_amount_check: CHECK (amount > 0::numeric); -- validated: true
```

```sql
add_on_orders_check: CHECK ((kind = 'sponsored_post'::text) = (job_id IS NOT NULL) OR status <> 'pending'::text); -- validated: true
```

```sql
add_on_orders_created_by_fkey: FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
add_on_orders_currency_check: CHECK (currency = ANY (ARRAY['PKR'::text, 'USD'::text])); -- validated: true
```

```sql
add_on_orders_grant_id_fkey: FOREIGN KEY (grant_id) REFERENCES entitlement_grants(id) ON DELETE SET NULL; -- validated: true
```

```sql
add_on_orders_job_id_fkey: FOREIGN KEY (job_id) REFERENCES job_posts(id) ON DELETE SET NULL; -- validated: true
```

```sql
add_on_orders_kind_check: CHECK (kind = ANY (ARRAY['contact_credits'::text, 'sponsored_post'::text])); -- validated: true
```

```sql
add_on_orders_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
add_on_orders_quantity_check: CHECK (quantity >= 1 AND quantity <= 100); -- validated: true
```

```sql
add_on_orders_status_check: CHECK (status = ANY (ARRAY['pending'::text, 'fulfilled'::text, 'cancelled'::text, 'refunded'::text])); -- validated: true
```

```sql
add_on_orders_subject_id_fkey: FOREIGN KEY (subject_id) REFERENCES organizations(id) ON DELETE CASCADE; -- validated: true
```

```sql
add_on_orders_subject_type_check: CHECK (subject_type = 'org'::billing_subject); -- validated: true
```

### Indexes

```sql
CREATE INDEX add_on_orders_created_by_idx ON public.add_on_orders USING btree (created_by); -- valid: true
```

```sql
CREATE INDEX add_on_orders_grant_idx ON public.add_on_orders USING btree (grant_id); -- valid: true
```

```sql
CREATE INDEX add_on_orders_job_idx ON public.add_on_orders USING btree (job_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX add_on_orders_pkey ON public.add_on_orders USING btree (id); -- valid: true
```

```sql
CREATE INDEX add_on_orders_subject_idx ON public.add_on_orders USING btree (subject_id, created_at DESC); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.billing_reminders

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#billing_reminders]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| subscription_id | uuid | true | — |  |  | — |
| period_end | timestamp with time zone | true | — |  |  | — |
| kind | text | true | — |  |  | "default" |
| sent_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
billing_reminders_pkey: PRIMARY KEY (subscription_id, period_end, kind); -- validated: true
```

```sql
billing_reminders_subscription_id_fkey: FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX billing_reminders_pkey ON public.billing_reminders USING btree (subscription_id, period_end, kind); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.billing_tasks

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#billing_tasks]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| kind | text | true | — |  |  | "default" |
| subject_type | billing_subject | true | — |  |  | — |
| subject_id | uuid | true | — |  |  | — |
| ref_id | uuid | false | — |  |  | — |
| detail | jsonb | true | '{}'::jsonb |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| done_at | timestamp with time zone | false | — |  |  | — |
| done_by | uuid | false | — |  |  | — |
| note | text | false | — |  |  | "default" |

### Keys and constraints

```sql
billing_tasks_done_by_fkey: FOREIGN KEY (done_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
billing_tasks_kind_check: CHECK (kind = ANY (ARRAY['offer_follow_up'::text, 'unreported_hire'::text, 'amount_mismatch'::text, 'licence_request'::text])); -- validated: true
```

```sql
billing_tasks_kind_ref_id_key: UNIQUE (kind, ref_id); -- validated: true
```

```sql
billing_tasks_pkey: PRIMARY KEY (id); -- validated: true
```

### Indexes

```sql
CREATE INDEX billing_tasks_done_by_idx ON public.billing_tasks USING btree (done_by); -- valid: true
```

```sql
CREATE UNIQUE INDEX billing_tasks_kind_ref_id_key ON public.billing_tasks USING btree (kind, ref_id); -- valid: true
```

```sql
CREATE INDEX billing_tasks_open_idx ON public.billing_tasks USING btree (created_at) WHERE (done_at IS NULL); -- valid: true
```

```sql
CREATE UNIQUE INDEX billing_tasks_pkey ON public.billing_tasks USING btree (id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.billing_webhook_events

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#billing_webhook_events]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | bigint | true | — | a |  | — |
| gateway | text | true | — |  |  | "default" |
| event_id | text | true | — |  |  | "default" |
| type | text | true | — |  |  | "default" |
| payload | jsonb | true | — |  |  | — |
| event | jsonb | true | — |  |  | — |
| live | boolean | true | — |  |  | — |
| received_at | timestamp with time zone | true | now() |  |  | — |
| processed_at | timestamp with time zone | false | — |  |  | — |
| outcome | text | false | — |  |  | "default" |
| attempts | integer | true | 0 |  |  | — |
| error | text | false | — |  |  | "default" |

### Keys and constraints

```sql
billing_webhook_events_event_id_check: CHECK (char_length(event_id) >= 3 AND char_length(event_id) <= 200); -- validated: true
```

```sql
billing_webhook_events_gateway_check: CHECK (gateway = ANY (ARRAY['simulated'::text, 'safepay'::text, 'payfast'::text, 'paddle'::text, 'worker'::text])); -- validated: true
```

```sql
billing_webhook_events_gateway_event_id_key: UNIQUE (gateway, event_id); -- validated: true
```

```sql
billing_webhook_events_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
billing_webhook_events_type_check: CHECK (char_length(type) >= 3 AND char_length(type) <= 80); -- validated: true
```

### Indexes

```sql
CREATE INDEX billing_webhook_events_failed_idx ON public.billing_webhook_events USING btree (received_at) WHERE (processed_at IS NULL); -- valid: true
```

```sql
CREATE UNIQUE INDEX billing_webhook_events_gateway_event_id_key ON public.billing_webhook_events USING btree (gateway, event_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX billing_webhook_events_pkey ON public.billing_webhook_events USING btree (id); -- valid: true
```

```sql
CREATE INDEX billing_webhook_events_received_idx ON public.billing_webhook_events USING btree (gateway, received_at DESC); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.checkout_sessions

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#checkout_sessions]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| subject_type | billing_subject | true | — |  |  | — |
| subject_id | uuid | true | — |  |  | — |
| created_by | uuid | false | — |  |  | — |
| purpose | text | true | — |  |  | "default" |
| plan_id | text | false | — |  |  | "default" |
| change | text | false | — |  |  | "default" |
| add_on_order_id | uuid | false | — |  |  | — |
| invoice_id | uuid | false | — |  |  | — |
| quote | jsonb | true | — |  |  | — |
| amount | numeric(12,2) | true | — |  |  | — |
| currency | text | true | — |  |  | "default" |
| gateway | text | true | — |  |  | "default" |
| live | boolean | true | — |  |  | — |
| gateway_session_ref | text | false | — |  |  | "default" |
| idempotency_key | text | true | — |  |  | "default" |
| status | text | true | 'open'::text |  |  | "default" |
| failure_reason | text | false | — |  |  | "default" |
| subscription_id | uuid | false | — |  |  | — |
| expires_at | timestamp with time zone | true | — |  |  | — |
| completed_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
checkout_sessions_add_on_fk: FOREIGN KEY (add_on_order_id) REFERENCES add_on_orders(id) ON DELETE CASCADE; -- validated: true
```

```sql
checkout_sessions_amount_check: CHECK (amount > 0::numeric); -- validated: true
```

```sql
checkout_sessions_change_check: CHECK (change IS NULL OR (change = ANY (ARRAY['new'::text, 'upgrade'::text, 'renew_prepaid'::text]))); -- validated: true
```

```sql
checkout_sessions_check: CHECK ((purpose = 'subscription'::text) = (plan_id IS NOT NULL AND change IS NOT NULL)); -- validated: true
```

```sql
checkout_sessions_check1: CHECK ((purpose = 'add_on'::text) = (add_on_order_id IS NOT NULL)); -- validated: true
```

```sql
checkout_sessions_check2: CHECK ((purpose = 'invoice'::text) = (invoice_id IS NOT NULL)); -- validated: true
```

```sql
checkout_sessions_created_by_fkey: FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
checkout_sessions_created_by_idempotency_key_key: UNIQUE (created_by, idempotency_key); -- validated: true
```

```sql
checkout_sessions_currency_check: CHECK (currency = ANY (ARRAY['PKR'::text, 'USD'::text])); -- validated: true
```

```sql
checkout_sessions_gateway_check: CHECK (gateway = ANY (ARRAY['simulated'::text, 'safepay'::text, 'payfast'::text, 'paddle'::text])); -- validated: true
```

```sql
checkout_sessions_idempotency_key_check: CHECK (char_length(idempotency_key) >= 16 AND char_length(idempotency_key) <= 80); -- validated: true
```

```sql
checkout_sessions_invoice_fk: FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE; -- validated: true
```

```sql
checkout_sessions_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
checkout_sessions_plan_id_fkey: FOREIGN KEY (plan_id) REFERENCES plans(id); -- validated: true
```

```sql
checkout_sessions_purpose_check: CHECK (purpose = ANY (ARRAY['subscription'::text, 'add_on'::text, 'invoice'::text])); -- validated: true
```

```sql
checkout_sessions_status_check: CHECK (status = ANY (ARRAY['open'::text, 'paid'::text, 'failed'::text, 'cancelled'::text, 'expired'::text])); -- validated: true
```

```sql
checkout_sessions_subscription_fk: FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL; -- validated: true
```

### Indexes

```sql
CREATE INDEX checkout_sessions_add_on_idx ON public.checkout_sessions USING btree (add_on_order_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX checkout_sessions_created_by_idempotency_key_key ON public.checkout_sessions USING btree (created_by, idempotency_key); -- valid: true
```

```sql
CREATE INDEX checkout_sessions_created_by_idx ON public.checkout_sessions USING btree (created_by); -- valid: true
```

```sql
CREATE INDEX checkout_sessions_invoice_idx ON public.checkout_sessions USING btree (invoice_id); -- valid: true
```

```sql
CREATE INDEX checkout_sessions_open_idx ON public.checkout_sessions USING btree (expires_at) WHERE (status = 'open'::text); -- valid: true
```

```sql
CREATE UNIQUE INDEX checkout_sessions_pkey ON public.checkout_sessions USING btree (id); -- valid: true
```

```sql
CREATE INDEX checkout_sessions_plan_idx ON public.checkout_sessions USING btree (plan_id); -- valid: true
```

```sql
CREATE INDEX checkout_sessions_subject_idx ON public.checkout_sessions USING btree (subject_type, subject_id, created_at DESC); -- valid: true
```

```sql
CREATE INDEX checkout_sessions_subscription_idx ON public.checkout_sessions USING btree (subscription_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.hire_fees

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#hire_fees]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| hire_id | uuid | false | — |  |  | — |
| org_id | uuid | true | — |  |  | — |
| kind | text | true | — |  |  | "default" |
| amount | numeric(12,2) | true | — |  |  | — |
| currency | text | true | 'PKR'::text |  |  | "default" |
| status | text | true | — |  |  | "default" |
| invoice_id | uuid | false | — |  |  | — |
| due_at | timestamp with time zone | false | — |  |  | — |
| dispute_kind | text | false | — |  |  | "default" |
| dispute_reason | text | false | — |  |  | "default" |
| disputed_at | timestamp with time zone | false | — |  |  | — |
| resolved_at | timestamp with time zone | false | — |  |  | — |
| resolved_by | uuid | false | — |  |  | — |
| resolution_reason | text | false | — |  |  | "default" |
| overdue_notified_at | timestamp with time zone | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
hire_fees_amount_check: CHECK (amount >= 0::numeric); -- validated: true
```

```sql
hire_fees_currency_check: CHECK (currency = 'PKR'::text); -- validated: true
```

```sql
hire_fees_dispute_kind_check: CHECK (dispute_kind IS NULL OR (dispute_kind = ANY (ARRAY['candidate_withdrew'::text, 'marked_in_error'::text]))); -- validated: true
```

```sql
hire_fees_dispute_reason_check: CHECK (dispute_reason IS NULL OR char_length(btrim(dispute_reason)) >= 10 AND char_length(btrim(dispute_reason)) <= 1000); -- validated: true
```

```sql
hire_fees_hire_id_fkey: FOREIGN KEY (hire_id) REFERENCES hires(id) ON DELETE SET NULL; -- validated: true
```

```sql
hire_fees_hire_id_key: UNIQUE (hire_id); -- validated: true
```

```sql
hire_fees_invoice_id_fkey: FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL; -- validated: true
```

```sql
hire_fees_kind_check: CHECK (kind = ANY (ARRAY['intern'::text, 'full_time'::text])); -- validated: true
```

```sql
hire_fees_org_id_fkey: FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE; -- validated: true
```

```sql
hire_fees_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
hire_fees_resolved_by_fkey: FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
hire_fees_status_check: CHECK (status = ANY (ARRAY['pending'::text, 'invoiced'::text, 'paid'::text, 'disputed'::text, 'void'::text, 'waived'::text])); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX hire_fees_hire_id_key ON public.hire_fees USING btree (hire_id); -- valid: true
```

```sql
CREATE INDEX hire_fees_invoice_idx ON public.hire_fees USING btree (invoice_id); -- valid: true
```

```sql
CREATE INDEX hire_fees_org_idx ON public.hire_fees USING btree (org_id, created_at DESC); -- valid: true
```

```sql
CREATE INDEX hire_fees_overdue_idx ON public.hire_fees USING btree (due_at) WHERE (status = 'invoiced'::text); -- valid: true
```

```sql
CREATE UNIQUE INDEX hire_fees_pkey ON public.hire_fees USING btree (id); -- valid: true
```

```sql
CREATE INDEX hire_fees_resolved_by_idx ON public.hire_fees USING btree (resolved_by); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.invoice_counters

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#invoice_counters]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| series | text | true | — |  |  | "default" |
| year | integer | true | — |  |  | — |
| last | integer | true | 0 |  |  | — |

### Keys and constraints

```sql
invoice_counters_pkey: PRIMARY KEY (series, year); -- validated: true
```

```sql
invoice_counters_series_check: CHECK (series = ANY (ARRAY['SKL'::text, 'TEST'::text, 'SKL-CN'::text, 'TEST-CN'::text])); -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX invoice_counters_pkey ON public.invoice_counters USING btree (series, year); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.invoices

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#invoices]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| number | text | true | — |  |  | "default" |
| series | text | true | — |  |  | "default" |
| kind | text | true | — |  |  | "default" |
| subject_type | billing_subject | true | — |  |  | — |
| subject_id | uuid | true | — |  |  | — |
| credits_invoice_id | uuid | false | — |  |  | — |
| payment_id | uuid | false | — |  |  | — |
| purpose | text | true | — |  |  | "default" |
| lines | jsonb | true | — |  |  | — |
| subtotal | numeric(12,2) | true | — |  |  | — |
| tax_lines | jsonb | true | '[]'::jsonb |  |  | — |
| tax_total | numeric(12,2) | true | 0 |  |  | — |
| total | numeric(12,2) | true | — |  |  | — |
| currency | text | true | — |  |  | "default" |
| status | text | true | — |  |  | "default" |
| issued_at | timestamp with time zone | true | now() |  |  | — |
| due_at | timestamp with time zone | false | — |  |  | — |
| paid_at | timestamp with time zone | false | — |  |  | — |
| voided_at | timestamp with time zone | false | — |  |  | — |
| void_reason | text | false | — |  |  | "default" |
| po_number | text | false | — |  |  | "default" |
| bill_to | jsonb | true | — |  |  | — |
| seller | jsonb | true | — |  |  | — |
| draft_reasons | text[] | true | '{}'::text[] |  |  | "default" |
| live | boolean | true | — |  |  | — |
| content_hash | text | true | — |  |  | "default" |
| created_by | uuid | false | — |  |  | — |

### Keys and constraints

```sql
invoices_check: CHECK ((kind = 'credit_note'::text) = (credits_invoice_id IS NOT NULL)); -- validated: true
```

```sql
invoices_content_hash_check: CHECK (content_hash ~ '^[0-9a-f]{64}$'::text); -- validated: true
```

```sql
invoices_created_by_fkey: FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
invoices_credits_invoice_id_fkey: FOREIGN KEY (credits_invoice_id) REFERENCES invoices(id); -- validated: true
```

```sql
invoices_currency_check: CHECK (currency = ANY (ARRAY['PKR'::text, 'USD'::text])); -- validated: true
```

```sql
invoices_kind_check: CHECK (kind = ANY (ARRAY['invoice'::text, 'receipt'::text, 'credit_note'::text])); -- validated: true
```

```sql
invoices_lines_check: CHECK (jsonb_typeof(lines) = 'array'::text); -- validated: true
```

```sql
invoices_number_key: UNIQUE (number); -- validated: true
```

```sql
invoices_payment_id_fkey: FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL; -- validated: true
```

```sql
invoices_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
invoices_purpose_check: CHECK (purpose = ANY (ARRAY['subscription'::text, 'add_on'::text, 'hire_fee'::text, 'licence'::text, 'refund'::text])); -- validated: true
```

```sql
invoices_status_check: CHECK (status = ANY (ARRAY['issued'::text, 'paid'::text, 'void'::text])); -- validated: true
```

```sql
invoices_tax_lines_check: CHECK (jsonb_typeof(tax_lines) = 'array'::text); -- validated: true
```

### Indexes

```sql
CREATE INDEX invoices_created_by_idx ON public.invoices USING btree (created_by); -- valid: true
```

```sql
CREATE INDEX invoices_credits_idx ON public.invoices USING btree (credits_invoice_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX invoices_number_key ON public.invoices USING btree (number); -- valid: true
```

```sql
CREATE INDEX invoices_open_idx ON public.invoices USING btree (due_at) WHERE (status = 'issued'::text); -- valid: true
```

```sql
CREATE INDEX invoices_payment_idx ON public.invoices USING btree (payment_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX invoices_pkey ON public.invoices USING btree (id); -- valid: true
```

```sql
CREATE INDEX invoices_subject_idx ON public.invoices USING btree (subject_type, subject_id, issued_at DESC); -- valid: true
```

### Policies

None.

### Triggers

```sql
CREATE TRIGGER invoices_immutable BEFORE DELETE OR UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION private.invoice_immutable(); -- enabled: O
```

## public.payments

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#payments]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| subject_type | billing_subject | true | — |  |  | — |
| subject_id | uuid | true | — |  |  | — |
| subscription_id | uuid | false | — |  |  | — |
| checkout_session_id | uuid | false | — |  |  | — |
| invoice_id | uuid | false | — |  |  | — |
| kind | text | true | — |  |  | "default" |
| amount | numeric(12,2) | true | — |  |  | — |
| currency | text | true | — |  |  | "default" |
| gateway | text | true | — |  |  | "default" |
| gateway_payment_id | text | true | — |  |  | "default" |
| method | text | true | — |  |  | "default" |
| status | text | true | 'succeeded'::text |  |  | "default" |
| refunded_amount | numeric(12,2) | true | 0 |  |  | — |
| mor_invoice_ref | text | false | — |  |  | "default" |
| live | boolean | true | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
payments_amount_check: CHECK (amount > 0::numeric); -- validated: true
```

```sql
payments_check: CHECK (refunded_amount <= amount); -- validated: true
```

```sql
payments_checkout_session_id_fkey: FOREIGN KEY (checkout_session_id) REFERENCES checkout_sessions(id) ON DELETE SET NULL; -- validated: true
```

```sql
payments_currency_check: CHECK (currency = ANY (ARRAY['PKR'::text, 'USD'::text])); -- validated: true
```

```sql
payments_gateway_gateway_payment_id_key: UNIQUE (gateway, gateway_payment_id); -- validated: true
```

```sql
payments_gateway_payment_id_check: CHECK (char_length(gateway_payment_id) >= 3 AND char_length(gateway_payment_id) <= 200); -- validated: true
```

```sql
payments_invoice_fk: FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL; -- validated: true
```

```sql
payments_kind_check: CHECK (kind = ANY (ARRAY['subscription'::text, 'add_on'::text, 'hire_fee'::text, 'licence'::text, 'invoice'::text])); -- validated: true
```

```sql
payments_method_check: CHECK (method = ANY (ARRAY['card'::text, 'wallet'::text, 'bank_transfer'::text])); -- validated: true
```

```sql
payments_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
payments_refunded_amount_check: CHECK (refunded_amount >= 0::numeric); -- validated: true
```

```sql
payments_status_check: CHECK (status = ANY (ARRAY['succeeded'::text, 'refunded'::text, 'partially_refunded'::text])); -- validated: true
```

```sql
payments_subscription_id_fkey: FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL; -- validated: true
```

### Indexes

```sql
CREATE UNIQUE INDEX payments_gateway_gateway_payment_id_key ON public.payments USING btree (gateway, gateway_payment_id); -- valid: true
```

```sql
CREATE INDEX payments_invoice_idx ON public.payments USING btree (invoice_id); -- valid: true
```

```sql
CREATE INDEX payments_live_idx ON public.payments USING btree (created_at) WHERE live; -- valid: true
```

```sql
CREATE UNIQUE INDEX payments_pkey ON public.payments USING btree (id); -- valid: true
```

```sql
CREATE INDEX payments_session_idx ON public.payments USING btree (checkout_session_id); -- valid: true
```

```sql
CREATE INDEX payments_subject_idx ON public.payments USING btree (subject_type, subject_id, created_at DESC); -- valid: true
```

```sql
CREATE INDEX payments_subscription_idx ON public.payments USING btree (subscription_id); -- valid: true
```

### Policies

None.

### Triggers

None.

## public.subscriptions

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#subscriptions]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| subject_type | billing_subject | true | — |  |  | — |
| subject_id | uuid | true | — |  |  | — |
| plan_id | text | true | — |  |  | "default" |
| status | subscription_status | true | — |  |  | — |
| gateway | text | true | — |  |  | "default" |
| live | boolean | true | — |  |  | — |
| payment_method | text | true | — |  |  | "default" |
| currency | text | true | 'PKR'::text |  |  | "default" |
| period_amount | numeric(12,2) | true | 0 |  |  | — |
| gateway_customer_ref | text | false | — |  |  | "default" |
| gateway_subscription_ref | text | false | — |  |  | "default" |
| saved_method_ref | text | false | — |  |  | "default" |
| current_period_start | timestamp with time zone | true | — |  |  | — |
| current_period_end | timestamp with time zone | true | — |  |  | — |
| cancel_at_period_end | boolean | true | false |  |  | — |
| next_period_paid | boolean | true | false |  |  | — |
| next_plan_id | text | false | — |  |  | "default" |
| trial_ends_at | timestamp with time zone | false | — |  |  | — |
| grace_ends_at | timestamp with time zone | false | — |  |  | — |
| retry_count | smallint | true | 0 |  |  | — |
| next_retry_at | timestamp with time zone | false | — |  |  | — |
| charge_pending | boolean | true | false |  |  | — |
| pending_charge | jsonb | false | — |  |  | — |
| simulate_fail_next | boolean | true | false |  |  | — |
| po_number | text | false | — |  |  | "default" |
| renewal_invoice_id | uuid | false | — |  |  | — |
| created_by | uuid | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |
| updated_at | timestamp with time zone | true | now() |  |  | — |
| ended_at | timestamp with time zone | false | — |  |  | — |
| ended_reason | text | false | — |  |  | "default" |

### Keys and constraints

```sql
subscriptions_check: CHECK (current_period_end > current_period_start); -- validated: true
```

```sql
subscriptions_created_by_fkey: FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
subscriptions_currency_check: CHECK (currency = ANY (ARRAY['PKR'::text, 'USD'::text])); -- validated: true
```

```sql
subscriptions_gateway_check: CHECK (gateway = ANY (ARRAY['simulated'::text, 'safepay'::text, 'payfast'::text, 'paddle'::text, 'manual'::text, 'comp'::text, 'none'::text])); -- validated: true
```

```sql
subscriptions_next_plan_id_fkey: FOREIGN KEY (next_plan_id) REFERENCES plans(id); -- validated: true
```

```sql
subscriptions_payment_method_check: CHECK (payment_method = ANY (ARRAY['card'::text, 'wallet'::text, 'bank_transfer'::text, 'none'::text])); -- validated: true
```

```sql
subscriptions_period_amount_check: CHECK (period_amount >= 0::numeric); -- validated: true
```

```sql
subscriptions_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
subscriptions_plan_id_fkey: FOREIGN KEY (plan_id) REFERENCES plans(id); -- validated: true
```

```sql
subscriptions_po_number_check: CHECK (po_number IS NULL OR char_length(btrim(po_number)) >= 1 AND char_length(btrim(po_number)) <= 60); -- validated: true
```

```sql
subscriptions_renewal_invoice_fk: FOREIGN KEY (renewal_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL; -- validated: true
```

### Indexes

```sql
CREATE INDEX subscriptions_created_by_idx ON public.subscriptions USING btree (created_by); -- valid: true
```

```sql
CREATE INDEX subscriptions_due_idx ON public.subscriptions USING btree (current_period_end) WHERE (status = ANY (ARRAY['trialing'::subscription_status, 'active'::subscription_status, 'past_due'::subscription_status])); -- valid: true
```

```sql
CREATE INDEX subscriptions_gateway_ref_idx ON public.subscriptions USING btree (gateway, gateway_subscription_ref) WHERE (gateway_subscription_ref IS NOT NULL); -- valid: true
```

```sql
CREATE INDEX subscriptions_next_plan_idx ON public.subscriptions USING btree (next_plan_id); -- valid: true
```

```sql
CREATE UNIQUE INDEX subscriptions_one_current_idx ON public.subscriptions USING btree (subject_type, subject_id) WHERE (status = ANY (ARRAY['trialing'::subscription_status, 'active'::subscription_status, 'past_due'::subscription_status])); -- valid: true
```

```sql
CREATE UNIQUE INDEX subscriptions_pkey ON public.subscriptions USING btree (id); -- valid: true
```

```sql
CREATE INDEX subscriptions_plan_idx ON public.subscriptions USING btree (plan_id); -- valid: true
```

```sql
CREATE INDEX subscriptions_renewal_invoice_idx ON public.subscriptions USING btree (renewal_invoice_id); -- valid: true
```

```sql
CREATE INDEX subscriptions_subject_idx ON public.subscriptions USING btree (subject_type, subject_id, created_at DESC); -- valid: true
```

### Policies

None.

### Triggers

```sql
CREATE TRIGGER subscriptions_analytics_insert AFTER INSERT ON subscriptions FOR EACH ROW EXECUTE FUNCTION private.analytics_subscription(); -- enabled: O
```

```sql
CREATE TRIGGER subscriptions_analytics_update AFTER UPDATE OF status, cancel_at_period_end ON subscriptions FOR EACH ROW WHEN (new.cancel_at_period_end AND NOT old.cancel_at_period_end OR new.status = 'cancelled'::subscription_status AND old.status <> 'cancelled'::subscription_status) EXECUTE FUNCTION private.analytics_subscription(); -- enabled: O
```

```sql
CREATE TRIGGER subscriptions_set_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION private.set_updated_at(); -- enabled: O
```

## public.tax_rates

[src: supabase/migrations/20261024000000_billing_lifecycle.sql#tax_rates]

RLS: true; FORCE RLS: false.

| Column | Type | NOT NULL | Default | Identity | Generated | Collation |
| --- | --- | --- | --- | --- | --- | --- |
| id | uuid | true | gen_random_uuid() |  |  | — |
| province | text | true | — |  |  | "default" |
| label | text | true | — |  |  | "default" |
| rate | numeric(6,4) | true | — |  |  | — |
| effective_from | date | true | — |  |  | — |
| reason | text | true | — |  |  | "default" |
| entered_by | uuid | false | — |  |  | — |
| created_at | timestamp with time zone | true | now() |  |  | — |

### Keys and constraints

```sql
tax_rates_entered_by_fkey: FOREIGN KEY (entered_by) REFERENCES auth.users(id) ON DELETE SET NULL; -- validated: true
```

```sql
tax_rates_label_check: CHECK (char_length(btrim(label)) >= 3 AND char_length(btrim(label)) <= 60); -- validated: true
```

```sql
tax_rates_pkey: PRIMARY KEY (id); -- validated: true
```

```sql
tax_rates_province_check: CHECK (province = ANY (ARRAY['Punjab'::text, 'Sindh'::text, 'KP'::text, 'Balochistan'::text, 'ICT'::text, 'AJK'::text, 'GB'::text])); -- validated: true
```

```sql
tax_rates_province_effective_from_key: UNIQUE (province, effective_from); -- validated: true
```

```sql
tax_rates_rate_check: CHECK (rate >= 0::numeric AND rate <= 0.5); -- validated: true
```

```sql
tax_rates_reason_check: CHECK (char_length(btrim(reason)) >= 3 AND char_length(btrim(reason)) <= 500); -- validated: true
```

### Indexes

```sql
CREATE INDEX tax_rates_entered_by_idx ON public.tax_rates USING btree (entered_by); -- valid: true
```

```sql
CREATE UNIQUE INDEX tax_rates_pkey ON public.tax_rates USING btree (id); -- valid: true
```

```sql
CREATE UNIQUE INDEX tax_rates_province_effective_from_key ON public.tax_rates USING btree (province, effective_from); -- valid: true
```

### Policies

None.

### Triggers

None.
