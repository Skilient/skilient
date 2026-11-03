-- Phase 15 (PRD 5.31 "Paid tickets", Ahmed 2026-11-02): the student pays the society directly and
-- uploads the receipt; an officer confirms it. Skilient never handles ticket money.
--
-- * society_payment_methods: up to 3; any officer proposes an add, replace or remove, and it takes
--   effect only when a second officer confirms it (society_audit_log keeps before and after).
-- * event_payments: one per held seat, with a reference code, the receipt (private bucket
--   event-receipts/{event}/{registration}/…), its hash and perceptual hash, an optional transaction
--   ID, the officer's decision and the refund state.
-- * Holds: 24 hours to pay and upload; under review the hold waits for the officer; a rejected
--   receipt gets another 24 hours. event-tick frees expired holds and promotes the waitlist.
-- * Refunds are marked between society and student; "Not received" and unanswered "I paid" become
--   report cases (target event_registration) after 72 hours; unmarked refunds on a cancelled event are
--   flagged to staff after 14 days. Receipts are deleted 90 days after the event ends.
-- * Reports gain the targets society, event and event_registration.

create table public.society_payment_methods (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies (id) on delete cascade,
  action text not null default 'add' check (action in ('add', 'replace', 'remove')),
  replaces_id uuid references public.society_payment_methods (id) on delete set null,
  kind text check (kind in ('bank', 'jazzcash', 'easypaisa')),
  bank_name text check (bank_name is null or char_length(btrim(bank_name)) between 2 and 60),
  account_title text check (account_title is null or char_length(btrim(account_title)) between 2 and 80),
  account_number text check (account_number is null or account_number ~ '^[A-Z0-9 -]{6,34}$'),
  status text not null default 'proposed' check (status in ('proposed', 'active', 'rejected', 'ended')),
  proposed_by uuid references auth.users (id) on delete set null,
  proposed_at timestamptz not null default now(),
  confirmed_by uuid references auth.users (id) on delete set null,
  confirmed_at timestamptz,
  effective_at timestamptz,
  ended_at timestamptz,
  check (action = 'remove' or (kind is not null and account_title is not null and account_number is not null
                               and (kind <> 'bank' or bank_name is not null))),
  check (action = 'add' or replaces_id is not null),
  check (confirmed_by is null or confirmed_by is distinct from proposed_by)
);
comment on table public.society_payment_methods is 'Where students pay a society for tickets (PRD 5.31). A change takes effect only when a second officer confirms it.';
create index society_payment_methods_society_idx on public.society_payment_methods (society_id, status);
create index society_payment_methods_replaces_idx on public.society_payment_methods (replaces_id) where replaces_id is not null;
create index society_payment_methods_proposed_by_idx on public.society_payment_methods (proposed_by) where proposed_by is not null;
create index society_payment_methods_confirmed_by_idx on public.society_payment_methods (confirmed_by) where confirmed_by is not null;

create table public.society_audit_log (
  id bigint generated always as identity primary key,
  society_id uuid not null references public.societies (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) between 3 and 60),
  before jsonb not null default '{}',
  after jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index society_audit_log_society_idx on public.society_audit_log (society_id, created_at desc);
create index society_audit_log_actor_idx on public.society_audit_log (actor_id) where actor_id is not null;

create table public.event_payments (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references public.event_registrations (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  society_id uuid not null references public.societies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_pkr integer not null check (amount_pkr between 1 and 1000000),
  reference_code text not null unique check (reference_code ~ '^SKL-[A-Z0-9]{4}$'),
  receipt_path text check (receipt_path is null or receipt_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|pdf)$'),
  receipt_hash text check (receipt_hash is null or receipt_hash ~ '^[0-9a-f]{64}$'),
  receipt_phash text check (receipt_phash is null or receipt_phash ~ '^[0-9a-f]{16}$'),
  transaction_id text check (transaction_id is null or char_length(btrim(transaction_id)) between 4 and 40),
  status text not null default 'awaiting' check (status in ('awaiting', 'under_review', 'approved', 'rejected', 'released')),
  uploaded_at timestamptz,
  reject_reason text check (reject_reason is null or char_length(reject_reason) <= 300),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  issue_raised_at timestamptz,
  refund_status text check (refund_status in ('requested', 'sent', 'received', 'disputed')),
  refund_requested_at timestamptz,
  refund_sent_at timestamptz,
  refund_note text check (refund_note is null or char_length(refund_note) <= 300),
  refund_answered_at timestamptz,
  case_id uuid references public.report_cases (id) on delete set null,
  receipt_deleted_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.event_payments is 'A ticket paid to the society directly (PRD 5.31). The receipt is private to the student, the society''s officers and staff on a report.';
create index event_payments_event_idx on public.event_payments (event_id, status);
create index event_payments_society_idx on public.event_payments (society_id);
create index event_payments_user_idx on public.event_payments (user_id);
create index event_payments_hash_idx on public.event_payments (society_id, receipt_hash) where receipt_hash is not null;
create index event_payments_txn_idx on public.event_payments (society_id, lower(transaction_id)) where transaction_id is not null;
create index event_payments_decided_by_idx on public.event_payments (decided_by) where decided_by is not null;
create index event_payments_case_idx on public.event_payments (case_id) where case_id is not null;

do $$
declare
  t text;
begin
  foreach t in array array['society_payment_methods', 'society_audit_log', 'event_payments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
  foreach t in array array['society_payment_methods', 'event_payments'] loop
    execute format('create trigger refuse_if_restricted before insert on public.%I for each row execute function private.refuse_if_restricted()', t);
  end loop;
end;
$$;

insert into public.notification_types (type, category, emailed) values
  ('payment_review', 'societies', false),
  ('payment_decided', 'societies', true),
  ('hold_expired', 'societies', true),
  ('refund_requested', 'societies', true),
  ('refund_sent', 'societies', true),
  ('refund_answered', 'societies', false),
  ('payment_details_proposed', 'societies', true),
  ('payment_details_confirmed', 'societies', true);

-- ---------------------------------------------------------------------------
-- Receipts bucket: event-receipts/{event}/{registration}/{uuid}.webp|pdf
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-receipts', 'event-receipts', false, 5242880, array['application/pdf', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- The student uploads into their own registration's folder while a receipt is wanted.
create function private.receipt_upload_allowed(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|pdf)$'
     and exists (select 1 from public.event_payments p join public.event_registrations r on r.id = p.registration_id
                  where r.id::text = (storage.foldername(p_name))[2] and r.event_id::text = (storage.foldername(p_name))[1]
                    and r.user_id = (select auth.uid()) and p.status in ('awaiting', 'rejected'))
     and (select count(*) from storage.objects o
           where o.bucket_id = 'event-receipts' and (storage.foldername(o.name))[2] = (storage.foldername(p_name))[2]) < 5;
$$;
revoke all on function private.receipt_upload_allowed(text) from public;
grant execute on function private.receipt_upload_allowed(text) to authenticated;

-- Readable by the student, the society's officers, and moderators once it is on a report.
create function private.receipt_readable(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.event_registrations r
     where r.id::text = (storage.foldername(p_name))[2] and r.event_id::text = (storage.foldername(p_name))[1]
       and (r.user_id = (select auth.uid())
            or private.is_event_officer(r.event_id)
            or (private.is_staff('moderator')
                and exists (select 1 from public.report_cases c where c.target_type = 'event_registration' and c.target_id = r.id))));
$$;
revoke all on function private.receipt_readable(text) from public;
grant execute on function private.receipt_readable(text) to authenticated;

create policy event_receipts_read on storage.objects for select to authenticated
  using (bucket_id = 'event-receipts' and (select private.receipt_readable(name)));
create policy event_receipts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'event-receipts' and (select private.receipt_upload_allowed(name)));

-- ---------------------------------------------------------------------------
-- Payment details (two officers)
-- ---------------------------------------------------------------------------
create or replace function private.society_has_payment_details(p_society uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.society_payment_methods m where m.society_id = p_society and m.status = 'active');
$$;

-- p: {action: add|replace|remove, replaces_id?, kind, bank_name?, account_title, account_number}
create function private.propose_payment_method(p_society uuid, p jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.societies;
  v_action text := coalesce(p->>'action', 'add');
  v_replaces uuid := nullif(p->>'replaces_id', '')::uuid;
  v_id uuid;
begin
  s := private.require_society_officer(p_society);
  if s.status <> 'verified' then
    raise exception 'payment details open once the society is verified' using errcode = '55000';
  end if;
  if v_action not in ('add', 'replace', 'remove') then
    raise exception 'unknown change' using errcode = '22023';
  end if;
  if v_action in ('replace', 'remove')
     and not exists (select 1 from public.society_payment_methods m where m.id = v_replaces and m.society_id = p_society and m.status = 'active') then
    raise exception 'pick a method to change' using errcode = 'P0002';
  end if;
  if v_action = 'add' and (select count(*) from public.society_payment_methods m where m.society_id = p_society and m.status in ('active', 'proposed') and m.action <> 'remove') >= 3 then
    raise exception 'a society has up to 3 payment methods' using errcode = '23514';
  end if;
  insert into public.society_payment_methods (society_id, action, replaces_id, kind, bank_name, account_title, account_number, proposed_by)
  values (p_society, v_action, v_replaces,
          case when v_action <> 'remove' then p->>'kind' end,
          case when v_action <> 'remove' and p->>'kind' = 'bank' then nullif(btrim(coalesce(p->>'bank_name', '')), '') end,
          case when v_action <> 'remove' then nullif(btrim(coalesce(p->>'account_title', '')), '') end,
          case when v_action <> 'remove' then upper(nullif(btrim(coalesce(p->>'account_number', '')), '')) end,
          (select auth.uid()))
  returning id into v_id;
  insert into public.society_audit_log (society_id, actor_id, action, before, after)
  values (p_society, (select auth.uid()), 'payment_method.propose',
          coalesce((select to_jsonb(m) - 'society_id' from public.society_payment_methods m where m.id = v_replaces), '{}'::jsonb),
          (select to_jsonb(m) - 'society_id' from public.society_payment_methods m where m.id = v_id));
  perform private.notify_society_officers(p_society, (select auth.uid()), 'payment_details_proposed', 'society', p_society,
                                          jsonb_build_object('society', s.name, 'slug', s.slug, 'action', v_action));
  return v_id;
end;
$$;

-- A second officer confirms (or rejects); the proposer can't.
create function private.confirm_payment_method(p_method uuid, p_accept boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  m public.society_payment_methods;
  s public.societies;
  v_before jsonb;
begin
  select * into m from public.society_payment_methods where id = p_method and status = 'proposed' for update;
  if not found then
    raise exception 'change not found' using errcode = 'P0002';
  end if;
  s := private.require_society_officer(m.society_id);
  if m.proposed_by = (select auth.uid()) then
    raise exception 'a second officer confirms this change' using errcode = '42501';
  end if;
  v_before := coalesce((select to_jsonb(x) - 'society_id' from public.society_payment_methods x where x.id = m.replaces_id), '{}'::jsonb);
  if not p_accept then
    update public.society_payment_methods set status = 'rejected', confirmed_by = (select auth.uid()), confirmed_at = now() where id = m.id;
  else
    if m.action in ('replace', 'remove') then
      update public.society_payment_methods set status = 'ended', ended_at = now() where id = m.replaces_id and status = 'active';
    end if;
    update public.society_payment_methods
       set status = case when m.action = 'remove' then 'ended' else 'active' end, confirmed_by = (select auth.uid()), confirmed_at = now(),
           effective_at = now(), ended_at = case when m.action = 'remove' then now() end
     where id = m.id;
  end if;
  insert into public.society_audit_log (society_id, actor_id, action, before, after)
  values (m.society_id, (select auth.uid()), case when p_accept then 'payment_method.confirm' else 'payment_method.reject' end,
          v_before, (select to_jsonb(x) - 'society_id' from public.society_payment_methods x where x.id = m.id));
  perform private.notify_society_officers(m.society_id, null, 'payment_details_confirmed', 'society', m.society_id,
                                          jsonb_build_object('society', s.name, 'slug', s.slug, 'accepted', p_accept, 'action', m.action));
end;
$$;

create function private.payment_details_page(p_society uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.societies;
begin
  s := private.require_society_officer(p_society);
  return jsonb_build_object(
    'society', private.society_card(p_society), 'paid_paused', s.paid_paused,
    'active', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.kind, 'bank_name', m.bank_name, 'account_title', m.account_title,
                                                            'account_number', m.account_number, 'effective_at', m.effective_at) order by m.effective_at)
                          from public.society_payment_methods m where m.society_id = p_society and m.status = 'active'), '[]'::jsonb),
    'proposals', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'action', m.action, 'replaces_id', m.replaces_id, 'kind', m.kind,
                                                               'bank_name', m.bank_name, 'account_title', m.account_title, 'account_number', m.account_number,
                                                               'proposed_by', p.full_name, 'proposed_at', m.proposed_at,
                                                               'mine', m.proposed_by = (select auth.uid())) order by m.proposed_at)
                             from public.society_payment_methods m left join public.profiles p on p.user_id = m.proposed_by
                            where m.society_id = p_society and m.status = 'proposed'), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object('action', a.action, 'actor', p.full_name, 'at', a.created_at) order by a.created_at desc)
                           from public.society_audit_log a left join public.profiles p on p.user_id = a.actor_id
                          where a.society_id = p_society and a.action like 'payment_method.%'), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- Holds and payments
-- ---------------------------------------------------------------------------
create or replace function private.open_payment(p_registration uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r public.event_registrations;
  t public.event_ticket_types;
  e public.events;
  v_code text;
begin
  select * into r from public.event_registrations where id = p_registration;
  select * into t from public.event_ticket_types where id = r.ticket_type_id;
  select * into e from public.events where id = r.event_id;
  if t.price_pkr is null then
    return;
  end if;
  loop
    v_code := 'SKL-' || string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::integer, 1), '') from generate_series(1, 4);
    exit when not exists (select 1 from public.event_payments p where p.reference_code = v_code);
  end loop;
  insert into public.event_payments (registration_id, event_id, society_id, user_id, amount_pkr, reference_code)
  values (r.id, r.event_id, e.society_id, r.user_id, t.price_pkr, v_code)
  on conflict (registration_id) do update
    set status = 'awaiting', amount_pkr = excluded.amount_pkr, reject_reason = null, decided_by = null, decided_at = null,
        receipt_path = null, receipt_hash = null, receipt_phash = null, transaction_id = null, uploaded_at = null,
        refund_status = null, issue_raised_at = null;
end;
$$;

-- The buyer's sheet: amount, the society's details, the reference code, the hold, the state.
create function private.ticket_payment(p_event uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  r public.event_registrations;
  p public.event_payments;
  e public.events;
begin
  select * into r from public.event_registrations x where x.event_id = p_event and x.user_id = v_me;
  select * into p from public.event_payments x where x.registration_id = r.id;
  select * into e from public.events where id = p_event;
  if p.id is null then
    raise exception 'no payment for this ticket' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'payment_id', p.id, 'registration_id', r.id, 'event_id', p_event, 'amount_pkr', p.amount_pkr, 'reference_code', p.reference_code,
    'status', p.status, 'reject_reason', p.reject_reason, 'uploaded_at', p.uploaded_at, 'hold_expires_at', r.hold_expires_at,
    'registration_status', r.status, 'refund_status', p.refund_status, 'refund_note', p.refund_note,
    'refund_policy', e.refund_policy, 'refund_days', e.refund_days, 'has_receipt', p.receipt_path is not null,
    'issue_raised_at', p.issue_raised_at,
    'society', (select jsonb_build_object('name', s.name, 'slug', s.slug) from public.societies s where s.id = p.society_id),
    'methods', case when p.status in ('awaiting', 'rejected', 'under_review') then coalesce((
        select jsonb_agg(jsonb_build_object('kind', m.kind, 'bank_name', m.bank_name, 'account_title', m.account_title,
                                            'account_number', m.account_number, 'updated_at', m.effective_at) order by m.effective_at)
          from public.society_payment_methods m where m.society_id = p.society_id and m.status = 'active'), '[]'::jsonb) end);
end;
$$;

-- After the server action checked and stored the receipt (sharp re-encode or %PDF-).
create function private.submit_receipt(p_registration uuid, p_path text, p_hash text, p_phash text, p_transaction_id text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  r public.event_registrations;
  p public.event_payments;
  e public.events;
begin
  select * into r from public.event_registrations where id = p_registration and user_id = v_me for update;
  select * into p from public.event_payments where registration_id = p_registration for update;
  if r.id is null or p.id is null then
    raise exception 'ticket not found' using errcode = 'P0002';
  end if;
  if p.status not in ('awaiting', 'rejected') or r.status <> 'held' then
    raise exception 'this ticket isn''t waiting for a receipt' using errcode = '55000';
  end if;
  if r.hold_expires_at is not null and r.hold_expires_at < now() then
    raise exception 'the hold on your seat has expired' using errcode = '55000';
  end if;
  if split_part(p_path, '/', 1) <> r.event_id::text or split_part(p_path, '/', 2) <> r.id::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'event-receipts' and o.name = p_path) then
    raise exception 'upload the receipt again' using errcode = '22023';
  end if;
  if p.receipt_path is not null and p.receipt_path <> p_path then
    perform private.queue_storage_cleanup('event-receipts', p.receipt_path);
  end if;
  update public.event_payments
     set receipt_path = p_path, receipt_hash = p_hash, receipt_phash = nullif(p_phash, ''),
         transaction_id = nullif(btrim(coalesce(p_transaction_id, '')), ''), status = 'under_review', uploaded_at = now(), reject_reason = null
   where id = p.id;
  -- The hold lasts until an officer decides.
  update public.event_registrations set hold_expires_at = null where id = r.id;
  select * into e from public.events where id = r.event_id;
  perform private.notify_society_officers(p.society_id, v_me, 'payment_review', 'event', r.event_id,
                                          jsonb_build_object('event', e.title, 'reference_code', p.reference_code));
end;
$$;

-- The officer's Payments tab, with duplicate flags (same receipt or transaction ID in this society).
create function private.payments_review(p_event uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_event_officer(p_event);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id, 'name', pr.full_name, 'username', pr.username, 'amount_pkr', p.amount_pkr, 'reference_code', p.reference_code,
             'transaction_id', p.transaction_id, 'status', p.status, 'uploaded_at', p.uploaded_at, 'receipt_path', p.receipt_path,
             'reject_reason', p.reject_reason, 'refund_status', p.refund_status, 'refund_requested_at', p.refund_requested_at,
             'issue_raised_at', p.issue_raised_at,
             'duplicates', coalesce((
               select jsonb_agg(jsonb_build_object('name', op.full_name, 'event', oe.title, 'at', o.uploaded_at,
                                                   'why', case when o.transaction_id is not null and lower(o.transaction_id) = lower(p.transaction_id) then 'transaction' else 'receipt' end))
                 from public.event_payments o join public.profiles op on op.user_id = o.user_id join public.events oe on oe.id = o.event_id
                where o.society_id = p.society_id and o.id <> p.id
                  and ((p.receipt_hash is not null and o.receipt_hash = p.receipt_hash)
                       or (p.receipt_phash is not null and o.receipt_phash is not null
                           and bit_count(('x' || o.receipt_phash)::bit(64) # ('x' || p.receipt_phash)::bit(64)) <= 4)
                       or (p.transaction_id is not null and lower(o.transaction_id) = lower(p.transaction_id)))), '[]'::jsonb))
             order by (p.status = 'under_review') desc, p.uploaded_at nulls last)
      from public.event_payments p join public.profiles pr on pr.user_id = p.user_id
     where p.event_id = p_event), '[]'::jsonb);
end;
$$;

create function private.review_payment(p_payment uuid, p_approve boolean, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  p public.event_payments;
  e public.events;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into p from public.event_payments where id = p_payment for update;
  if not found then
    raise exception 'payment not found' using errcode = 'P0002';
  end if;
  e := private.require_event_officer(p.event_id);
  if p.status <> 'under_review' then
    raise exception 'this payment isn''t waiting for review' using errcode = '55000';
  end if;
  if not p_approve and char_length(coalesce(v_reason, '')) < 3 then
    raise exception 'say why ("Amount doesn''t match")' using errcode = '22023';
  end if;
  if p_approve then
    update public.event_payments set status = 'approved', decided_by = (select auth.uid()), decided_at = now(), issue_raised_at = null where id = p.id;
    update public.event_registrations set status = 'confirmed', hold_expires_at = null, decided_at = now() where id = p.registration_id and status = 'held';
  else
    update public.event_payments set status = 'rejected', reject_reason = v_reason, decided_by = (select auth.uid()), decided_at = now() where id = p.id;
    update public.event_registrations set hold_expires_at = now() + make_interval(hours => private.event_limit('hold_hours'))
     where id = p.registration_id and status = 'held';
  end if;
  perform private.notify(p.user_id, (select auth.uid()), 'payment_decided', 'event', p.event_id,
                         jsonb_build_object('event', e.title, 'approved', p_approve, 'reason', v_reason));
end;
$$;

-- "I paid but wasn't confirmed": the society first; a report after 72 hours.
create function private.raise_payment_issue(p_registration uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  p public.event_payments;
begin
  select * into p from public.event_payments where registration_id = p_registration and user_id = (select auth.uid()) for update;
  if not found or p.status <> 'under_review' then
    raise exception 'nothing to raise' using errcode = 'P0002';
  end if;
  update public.event_payments set issue_raised_at = coalesce(issue_raised_at, now()) where id = p.id;
  perform private.notify_society_officers(p.society_id, p.user_id, 'payment_review', 'event', p.event_id,
                                          jsonb_build_object('reference_code', p.reference_code, 'issue', true));
end;
$$;

-- Cancelling: a paid seat within the refund policy becomes "Refund requested"; an unpaid hold is released.
create or replace function private.registration_cancelled_payment(p_registration uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  p public.event_payments;
  e public.events;
begin
  select * into p from public.event_payments where registration_id = p_registration for update;
  if not found then
    return;
  end if;
  select * into e from public.events where id = p.event_id;
  if p.status in ('awaiting', 'under_review', 'rejected') then
    update public.event_payments set status = 'released' where id = p.id;
  elsif p.status = 'approved' and e.refund_policy = 'until' and now() <= e.starts_at - make_interval(days => e.refund_days) then
    update public.event_payments set refund_status = 'requested', refund_requested_at = now() where id = p.id;
    perform private.notify_society_officers(p.society_id, p.user_id, 'refund_requested', 'event', p.event_id,
                                            jsonb_build_object('event', e.title, 'reference_code', p.reference_code));
  end if;
end;
$$;

-- The host cancels a paid event: every paid registrant is owed a refund.
create or replace function private.event_cancelled_refunds(p_event uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.event_payments set refund_status = 'requested', refund_requested_at = now()
   where event_id = p_event and status = 'approved' and refund_status is null;
  update public.event_payments set status = 'released' where event_id = p_event and status in ('awaiting', 'under_review', 'rejected');
end;
$$;

create function private.mark_refund_sent(p_payment uuid, p_note text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  p public.event_payments;
  e public.events;
begin
  select * into p from public.event_payments where id = p_payment for update;
  if not found then
    raise exception 'payment not found' using errcode = 'P0002';
  end if;
  e := private.require_event_officer(p.event_id);
  if p.refund_status not in ('requested', 'disputed') then
    raise exception 'no refund is waiting' using errcode = '55000';
  end if;
  update public.event_payments set refund_status = 'sent', refund_sent_at = now(), refund_note = nullif(btrim(coalesce(p_note, '')), '') where id = p.id;
  perform private.notify(p.user_id, (select auth.uid()), 'refund_sent', 'event', p.event_id,
                         jsonb_build_object('event', e.title, 'reference_code', p.reference_code));
end;
$$;

-- The student marks the refund Received, or Not received (a report after 72 hours unanswered).
create function private.confirm_refund(p_payment uuid, p_received boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  p public.event_payments;
begin
  select * into p from public.event_payments where id = p_payment and user_id = (select auth.uid()) for update;
  if not found or p.refund_status not in ('sent', 'requested') then
    raise exception 'no refund to confirm' using errcode = 'P0002';
  end if;
  update public.event_payments
     set refund_status = case when p_received then 'received' else 'disputed' end, refund_answered_at = now()
   where id = p.id;
  perform private.notify_society_officers(p.society_id, p.user_id, 'refund_answered', 'event', p.event_id,
                                          jsonb_build_object('reference_code', p.reference_code, 'received', p_received));
end;
$$;

-- Held seats with no receipt (or a rejected one) after their hold: freed, and the waitlist moves.
create or replace function private.event_tick_payments()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select x.id, x.event_id, x.user_id, x.ticket_type_id, e.title
      from public.event_registrations x join public.events e on e.id = x.event_id
     where x.status = 'held' and x.hold_expires_at is not null and x.hold_expires_at < now()
     order by x.hold_expires_at
     limit 500
  loop
    perform 1 from public.event_ticket_types where id = r.ticket_type_id for update;
    update public.event_registrations set status = 'cancelled', cancelled_at = now(), hold_expires_at = null
     where id = r.id and status = 'held' and hold_expires_at < now();
    if found then
      update public.event_payments set status = 'released' where registration_id = r.id and status in ('awaiting', 'rejected');
      perform private.notify(r.user_id, null, 'hold_expired', 'event', r.event_id, jsonb_build_object('event', r.title));
      perform private.promote_waitlist(r.ticket_type_id);
    end if;
  end loop;
end;
$$;

-- Hourly: disputes become report cases after 72 hours; unmarked refunds on a cancelled event are
-- flagged after 14 days; receipts are deleted 90 days after the event.
create or replace function private.event_closeout_payments()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  p record;
  s record;
  v_case uuid;
begin
  for p in
    select x.*, e.title, e.cancelled_at as event_cancelled_at
      from public.event_payments x join public.events e on e.id = x.event_id
     where x.case_id is null
       and ((x.issue_raised_at is not null and x.status = 'under_review' and x.issue_raised_at < now() - make_interval(hours => private.event_limit('dispute_hours')))
            or (x.refund_status = 'disputed' and x.refund_answered_at < now() - make_interval(hours => private.event_limit('dispute_hours')))
            or (x.refund_status = 'requested' and e.cancelled_at is not null and e.cancelled_at < now() - make_interval(days => private.event_limit('refund_flag_days'))))
     limit 200
  loop
    select * into s from private.report_snapshot('event_registration', p.registration_id);
    v_case := private.open_case('event_registration', p.registration_id, s.owner_id, s.snapshot, false, false);
    update public.event_payments set case_id = v_case where id = p.id;
  end loop;
  for p in
    select x.id, x.receipt_path from public.event_payments x join public.events e on e.id = x.event_id
     where x.receipt_path is not null and e.ends_at < now() - make_interval(days => private.event_limit('receipt_delete_days'))
     limit 500
  loop
    perform private.queue_storage_cleanup('event-receipts', p.receipt_path);
    update public.event_payments set receipt_path = null, receipt_deleted_at = now() where id = p.id;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reports: societies, events and registrations (disputes)
-- ---------------------------------------------------------------------------
create or replace function private.report_snapshot(p_type public.report_target, p_target uuid)
returns table (owner_id uuid, snapshot jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select p.author_id, jsonb_build_object('body', p.body, 'type', p.type, 'audience', p.audience, 'author', a.full_name,
                                         'author_username', a.username, 'created_at', p.created_at,
                                         'images', (select count(*) from public.post_media m where m.post_id = p.id))
    from public.posts p join public.profiles a on a.user_id = p.author_id
   where p_type = 'post' and p.id = p_target
  union all
  select c.author_id, jsonb_build_object('body', c.body, 'post_id', c.post_id, 'author', a.full_name,
                                         'author_username', a.username, 'created_at', c.created_at)
    from public.post_comments c join public.profiles a on a.user_id = c.author_id
   where p_type = 'comment' and c.id = p_target
  union all
  select m.sender_id, jsonb_build_object('body', m.body, 'thread_type', t.type, 'author', a.full_name,
                                         'author_username', a.username, 'created_at', m.created_at, 'had_image', m.media_path is not null)
    from public.chat_messages m join public.chat_threads t on t.id = m.thread_id join public.profiles a on a.user_id = m.sender_id
   where p_type = 'message' and m.id = p_target
  union all
  select p.user_id, jsonb_build_object('author', p.full_name, 'author_username', p.username, 'bio', p.bio,
                                       'department', p.department, 'had_avatar', p.avatar_path is not null)
    from public.profiles p
   where p_type = 'profile' and p.user_id = p_target
  union all
  select v.owner_id, jsonb_build_object('title', v.title, 'body', v.description, 'venture_type', v.type,
                                        'author', o.full_name, 'author_username', o.username, 'created_at', v.created_at)
    from public.ventures v join public.profiles o on o.user_id = v.owner_id
   where p_type = 'venture' and v.id = p_target
  union all
  select (select m.user_id from public.society_members m where m.society_id = s.id and m.role = 'president'),
         jsonb_build_object('title', s.name, 'body', s.about, 'society_slug', s.slug, 'status', s.status, 'created_at', s.created_at)
    from public.societies s
   where p_type = 'society' and s.id = p_target
  union all
  select e.created_by, jsonb_build_object('title', e.title, 'body', e.description, 'event_type', e.type, 'starts_at', e.starts_at,
                                          'society', (select s.name from public.societies s where s.id = e.society_id), 'created_at', e.created_at)
    from public.events e
   where p_type = 'event' and e.id = p_target
  union all
  select (select m.user_id from public.society_members m where m.society_id = e.society_id and m.role = 'president'),
         jsonb_build_object('title', e.title, 'student', a.full_name, 'student_username', a.username, 'status', r.status,
                            'payment', (select jsonb_build_object('amount_pkr', x.amount_pkr, 'reference_code', x.reference_code, 'status', x.status,
                                                                  'refund_status', x.refund_status, 'transaction_id', x.transaction_id,
                                                                  'receipt_path', x.receipt_path, 'uploaded_at', x.uploaded_at)
                                          from public.event_payments x where x.registration_id = r.id),
                            'society', (select s.name from public.societies s where s.id = e.society_id), 'created_at', r.registered_at)
    from public.event_registrations r join public.events e on e.id = r.event_id join public.profiles a on a.user_id = r.user_id
   where p_type = 'event_registration' and r.id = p_target;
$$;

create or replace function private.can_report(p_type public.report_target, p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_type
    when 'post' then private.can_view_post(p_target)
    when 'comment' then exists (select 1 from public.post_comments c
                                 where c.id = p_target and c.deleted_at is null and private.can_view_post(c.post_id))
    when 'message' then exists (select 1 from public.chat_messages m
                                 where m.id = p_target and m.deleted_at is null
                                   and private.is_thread_member(m.thread_id) and not private.dm_blocked(m.thread_id))
    when 'profile' then exists (select 1 from public.profiles p where p.user_id = p_target and p.onboarding_complete)
    when 'venture' then private.can_view_venture(p_target)
    when 'society' then private.can_see_society(p_target)
    when 'event' then exists (select 1 from public.events e where e.id = p_target and e.society_id is not null and e.status <> 'draft'
                                and (e.university_id = private.current_university_id() or e.eligibility ->> 'scope' = 'all'))
    -- A registration is reported by its own student (a payment dispute).
    when 'event_registration' then exists (select 1 from public.event_registrations r where r.id = p_target and r.user_id = (select auth.uid()))
    else false
  end;
$$;

-- ---------------------------------------------------------------------------
-- Public wrappers
-- ---------------------------------------------------------------------------
create function pg_temp.expose(p_names text[])
returns void
language plpgsql
as $$
declare
  n text;
  r record;
  v_names text;
begin
  foreach n in array p_names loop
    select p.oid, p.proname, p.provolatile, p.proargnames,
           pg_get_function_arguments(p.oid) as args,
           pg_get_function_identity_arguments(p.oid) as ident,
           pg_get_function_result(p.oid) as result
      into r
      from pg_proc p where p.pronamespace = 'private'::regnamespace and p.proname = n;
    if r.oid is null then
      raise exception 'no private function %', n;
    end if;
    select coalesce(string_agg(a, ', ' order by ord), '') into v_names
      from unnest(coalesce(r.proargnames, '{}'::text[])) with ordinality as t(a, ord);
    execute format('revoke all on function private.%I(%s) from public', n, r.ident);
    execute format('grant execute on function private.%I(%s) to authenticated', n, r.ident);
    execute format('create function public.%I(%s) returns %s language sql %s security invoker set search_path = %L as $f$ select private.%I(%s) $f$',
                   n, r.args, r.result, case r.provolatile when 'v' then 'volatile' else 'stable' end, '', n, v_names);
    execute format('revoke all on function public.%I(%s) from public, anon', n, r.ident);
    execute format('grant execute on function public.%I(%s) to authenticated', n, r.ident);
  end loop;
end;
$$;

select pg_temp.expose(array[
  'propose_payment_method', 'confirm_payment_method', 'payment_details_page', 'ticket_payment', 'submit_receipt',
  'payments_review', 'review_payment', 'raise_payment_issue', 'mark_refund_sent', 'confirm_refund']);
drop function pg_temp.expose(text[]);
