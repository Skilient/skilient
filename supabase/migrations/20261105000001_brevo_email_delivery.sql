-- CLI-created 20261014153755; ordered after the repository's existing alerts migration.
-- Local source only: apply before deploying the Brevo worker/webhook.
alter table private.email_sends add column provider_message_id text;
alter table private.email_sends add column send_key text unique;
comment on column private.email_sends.resend_id is 'Historical provider IDs only; Brevo writes provider_message_id.';

create table private.brevo_email_attempts (
  send_key text primary key check (send_key ~ '^[0-9a-f]{64}$'),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  state text not null check (state in ('pending', 'retryable', 'accepted', 'failed', 'uncertain')),
  first_attempt_at timestamptz not null default now(),
  lease_until timestamptz not null default now() + interval '120 seconds',
  message_id text
);
alter table private.brevo_email_attempts enable row level security;
revoke all on private.brevo_email_attempts from public, anon, authenticated;
comment on table private.brevo_email_attempts is 'Opaque delivery tombstones, hashes and provider IDs only. Never email addresses, tokens or content. Retain to prevent delayed queue replays.';

create function private.claim_brevo_email(p_key text, p_hash text)
returns table(state text, message_id text, claimed boolean)
language plpgsql volatile security definer set search_path = '' as $$
declare
  r private.brevo_email_attempts;
begin
  insert into private.brevo_email_attempts (send_key, payload_hash, state)
    values (p_key, p_hash, 'pending') on conflict do nothing;
  if found then
    return query select 'pending'::text, null::text, true;
    return;
  end if;
  select * into r from private.brevo_email_attempts a where a.send_key = p_key for update;
  if r.state in ('accepted', 'failed', 'uncertain') then
    return query select r.state, r.message_id, false;
  elsif r.lease_until > now() then
    return query select 'busy'::text, null::text, false;
  elsif r.state = 'pending' and (r.first_attempt_at < now() - interval '25 minutes' or r.payload_hash <> p_hash) then
    update private.brevo_email_attempts a set state = 'uncertain' where a.send_key = p_key;
    return query select 'uncertain'::text, null::text, false;
  else
    update private.brevo_email_attempts a
       set state = 'pending', payload_hash = p_hash,
           first_attempt_at = case when r.state = 'retryable' then now() else r.first_attempt_at end,
           lease_until = now() + interval '120 seconds'
     where a.send_key = p_key;
    return query select 'pending'::text, null::text, true;
  end if;
end;
$$;
revoke all on function private.claim_brevo_email(text, text) from public, anon, authenticated;

create function private.finish_brevo_email(p_key text, p_state text, p_id text)
returns void language sql volatile security definer set search_path = '' as $$
  update private.brevo_email_attempts set state = p_state, message_id = p_id,
    lease_until = case when p_state = 'pending' then now() + interval '30 seconds' else now() end
    where send_key = p_key and state = 'pending';
$$;
revoke all on function private.finish_brevo_email(text, text, text) from public, anon, authenticated;

-- Event receipt and monitoring signal commit together, so webhook retries cannot inflate counts.
create table private.brevo_webhook_receipts (
  event_key text primary key check (event_key ~ '^[0-9a-f]{64}$'),
  received_at timestamptz not null default now()
);
alter table private.brevo_webhook_receipts enable row level security;
revoke all on private.brevo_webhook_receipts from public, anon, authenticated;

create function private.record_brevo_email_signal(p_event_key text, p_kind text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_kind not in ('email_delivered', 'email_bounced') or p_kind is null then
    raise exception 'invalid email signal' using errcode = '22023';
  end if;
  insert into private.brevo_webhook_receipts (event_key) values (p_event_key) on conflict do nothing;
  if found then
    perform private.record_service_signal(p_kind, 1);
  end if;
end;
$$;
revoke all on function private.record_brevo_email_signal(text, text) from public, anon, authenticated;
grant execute on function private.record_brevo_email_signal(text, text) to service_role;

create function public.record_brevo_email_signal(p_event_key text, p_kind text)
returns void language sql volatile security invoker set search_path = '' as $$
  select private.record_brevo_email_signal(p_event_key, p_kind);
$$;
revoke all on function public.record_brevo_email_signal(text, text) from public, anon, authenticated;
grant execute on function public.record_brevo_email_signal(text, text) to service_role;
