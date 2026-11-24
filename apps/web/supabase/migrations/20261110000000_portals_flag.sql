-- Phase 14 (Student-first track, decisions 2026-11-02): recruiter and university portals off by flag.
--
-- * platform_config `portals.enabled` = {recruiter:false, university:false, faculty:true}, with its
--   config_keys row. `private.portal_enabled(name)` reads it; a missing key keeps the student-first
--   default (recruiter and university closed, faculty open).
-- * `my_gate_state()` returns the flag, so proxy.ts 404s /recruit, /org, /uni, /companies and /fairs
--   while a portal is off; `portals_state()` answers the same for signed-out visitors (anon).
-- * `validate_signup` (the before-user-created hook) refuses recruiter and official signups while
--   their portal is off. handle_new_user is unchanged: accounts made with the Auth admin API (tests,
--   staff) never pass through the hook, and the portals' code and data stay so the flag can come back.
-- * Every recruiter and university-official account is deleted through private.delete_account,
--   with their organisations and the seats and invites they held (Ahmed, 2026-11-02, question 22).
--   Faculty keep their account and any seat they hold. Organisations that hosted a competition with
--   awards stay (memberless), because deleting them would take the awards off students' skills.

-- ---------------------------------------------------------------------------
-- The flag
-- ---------------------------------------------------------------------------
insert into public.platform_config (key, version, value, reason) values
  ('portals.enabled', 1, '{"recruiter": false, "university": false, "faculty": true}',
   'Student-first track (decisions 2026-11-02): recruiter and university portals are off; faculty stays. Switching a portal back on restores its routes and signup.');

insert into public.config_keys (key, area, description, applies, schema) values
  ('portals.enabled', 'portals', 'Which portals are open. While one is off its routes answer 404, its signup is refused and student pages hide its parts.', 'now',
   '{"type": "object", "additionalProperties": false, "required": ["recruiter", "university", "faculty"],
     "properties": {"recruiter": {"type": "boolean"}, "university": {"type": "boolean"}, "faculty": {"type": "boolean"}}}');

create function private.portals_state()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'recruiter', coalesce((c.v ->> 'recruiter')::boolean, false),
    'university', coalesce((c.v ->> 'university')::boolean, false),
    'faculty', coalesce((c.v ->> 'faculty')::boolean, true)
  )
  from (select private.config('portals.enabled') as v) c;
$$;
comment on function private.portals_state() is 'portals.enabled with the student-first defaults filled in (recruiter and university off, faculty on).';

create function private.portal_enabled(p_portal text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((private.portals_state() ->> p_portal)::boolean, false);
$$;
revoke all on function private.portal_enabled(text) from public;

-- Readable signed out: the gate needs it for portal paths before anyone signs in.
revoke all on function private.portals_state() from public;
grant execute on function private.portals_state() to anon, authenticated;
create function public.portals_state()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select private.portals_state() $$;
revoke all on function public.portals_state() from public, anon;
grant execute on function public.portals_state() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The gate state carries the flag
-- ---------------------------------------------------------------------------
create or replace function public.my_gate_state()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'has_profile', p.user_id is not null,
    'role', p.role,
    'university_id', p.university_id,
    'username', p.username,
    'onboarding_complete', coalesce(p.onboarding_complete, false),
    'onboarding_step', coalesce(o.step, 1),
    'agreement_version', v.version,
    'agreement_accepted', v.version is null or exists (
      select 1 from public.agreement_acceptances a
       where a.user_id = (select auth.uid()) and a.version = v.version
    ),
    'email_allowed', private.email_domain_allowed(),
    'status', coalesce(p.status, 'active'),
    'portals', v.portals
  )
  from (select private.current_agreement_version() as version, private.portals_state() as portals) v
  left join public.profiles p on p.user_id = (select auth.uid())
  left join public.onboarding_state o on o.user_id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Signup: as phase 12, plus recruiter and official signups wait for their portal
-- ---------------------------------------------------------------------------
create or replace function private.validate_signup(p_email text, p_role public.account_role, p_university_id uuid default null)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_domain text := private.email_domain(p_email);
  v_kinds public.domain_kind[];
begin
  if v_domain is null then
    return 'Enter a valid email address.';
  end if;
  if p_role = 'recruiter' and not private.portal_enabled('recruiter') then
    return 'Recruiter accounts aren''t open yet. Talk to us at skilient.com/recruiters.';
  end if;
  if p_role = 'university_admin' and not private.portal_enabled('university') then
    return 'University accounts aren''t open yet. Talk to us at skilient.com/universities.';
  end if;
  if p_role = 'faculty' and not private.portal_enabled('faculty') then
    return 'Faculty accounts aren''t open yet.';
  end if;
  if p_role = 'recruiter' then
    if exists (select 1 from public.personal_email_domains d where d.domain = v_domain) then
      return 'Use your work email.';
    end if;
    if exists (select 1 from public.university_domains d where d.domain = v_domain) then
      return 'Use your company email, not a university one.';
    end if;
    return null;
  end if;
  if exists (select 1 from public.personal_email_domains d where d.domain = v_domain) then
    return 'Use your university email.';
  end if;
  if p_role in ('faculty', 'university_admin') then
    if not private.domain_admits_faculty(v_domain, null) then
      return 'Your university isn''t on Skilient yet.';
    end if;
    if p_university_id is not null and not private.domain_admits_faculty(v_domain, p_university_id) then
      return 'That university doesn''t use this email domain.';
    end if;
    v_kinds := array['faculty', 'both']::public.domain_kind[];
  elsif p_role = 'student' then
    if not private.domain_admits_students(v_domain, null) then
      return 'Your university isn''t on Skilient yet.';
    end if;
    if p_university_id is not null and not private.domain_admits_students(v_domain, p_university_id) then
      return 'That university doesn''t use this email domain.';
    end if;
    v_kinds := array['student', 'both']::public.domain_kind[];
  else
    return 'This kind of account can''t sign up here yet.';
  end if;
  if p_role <> 'university_admin' and not exists (
       select 1 from public.university_domains d
        where d.domain = v_domain and d.kind = any (v_kinds)
          and (p_university_id is null or d.university_id = p_university_id)
          and private.university_live(d.university_id)) then
    return 'Your university isn''t on Skilient yet.';
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Delete every recruiter and university-official account (one time)
-- ---------------------------------------------------------------------------
-- One function so pgTAP can run it on fixtures; this migration runs it once. The read-only query in
-- scripts/portals/delete-counts.sql reports what it deletes. Returns the counts.
create function private.delete_closed_portal_accounts()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_accounts integer := 0;
  v_orgs integer := 0;
  v_kept_orgs integer := 0;
  v_seats integer := 0;
  v_invites integer := 0;
begin
  -- Seats held by the accounts below go with them (cascade); faculty seats stay.
  select count(*) into v_seats
    from public.university_admins a
    join public.profiles p on p.user_id = a.user_id
   where p.role in ('recruiter', 'university_admin');

  -- Pending official invites: nobody can take them up while the portal is off.
  delete from public.university_admin_invites;
  get diagnostics v_invites = row_count;

  -- Claim letters of the claimants about to go.
  perform private.queue_storage_cleanup('university-claims', c.letter_path)
     from public.university_claims c
     join public.profiles p on p.user_id = c.requester_id
    where p.role = 'university_admin' and c.letter_path is not null;

  -- Organisations: every member is a recruiter. Keep the ones whose competitions awarded students.
  select count(*) into v_kept_orgs
    from public.organizations o
   where exists (select 1 from public.competitions c join public.competition_awards a on a.competition_id = c.id
                  where c.org_id = o.id);
  perform private.queue_storage_cleanup('org-documents', o.registration_doc_path)
     from public.organizations o
    where o.registration_doc_path is not null
      and not exists (select 1 from public.competitions c join public.competition_awards a on a.competition_id = c.id
                       where c.org_id = o.id);
  delete from public.organizations o
   where not exists (select 1 from public.competitions c join public.competition_awards a on a.competition_id = c.id
                      where c.org_id = o.id);
  get diagnostics v_orgs = row_count;

  -- The accounts, through the same path as a student's own deletion.
  for v_user in
    select p.user_id from public.profiles p where p.role in ('recruiter', 'university_admin') order by p.user_id
  loop
    update public.profiles set status = 'deleting', delete_after = now() where user_id = v_user;
    perform private.delete_account(v_user);
    v_accounts := v_accounts + 1;
  end loop;

  return jsonb_build_object('accounts', v_accounts, 'organisations', v_orgs, 'organisations_kept', v_kept_orgs,
                            'seats', v_seats, 'invites', v_invites);
end;
$$;
revoke all on function private.delete_closed_portal_accounts() from public;

do $$
begin
  raise notice 'portals: deleted %', private.delete_closed_portal_accounts();
end;
$$;

-- ---------------------------------------------------------------------------
-- "Talk to us" on /recruiters too (decisions 2026-11-02, "Marketing routes")
-- ---------------------------------------------------------------------------
alter table public.sales_leads drop constraint sales_leads_kind_check;
alter table public.sales_leads add constraint sales_leads_kind_check check (kind in ('university', 'recruiter'));
comment on table public.sales_leads is
  '"Talk to us" requests from /universities and /recruiters (PRD 5.1, phase 14), worked by accounts staff in /ops/leads. Never read by the app outside /ops.';

drop function public.submit_sales_lead(text, text, text, text, text);
drop function private.submit_sales_lead(text, text, text, text, text);

-- Signed out, from the Talk to us form (the action checks Turnstile, the honeypot and the per-IP limit).
create function private.submit_sales_lead(p_name text, p_role text, p_organisation text, p_email text, p_message text,
                                          p_kind text default 'university')
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_domain text := private.email_domain(p_email);
  v_id uuid;
begin
  if p_kind is null or p_kind not in ('university', 'recruiter') then
    raise exception 'unknown kind' using errcode = '22023';
  end if;
  if v_domain is null or char_length(v_email) > 254 then
    raise exception 'Enter a valid email address.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 80 then
    raise exception 'Enter your name.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_role, ''))) not between 2 and 80 then
    raise exception 'Enter your role.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_organisation, ''))) not between 2 and 200 then
    raise exception '%', case p_kind when 'recruiter' then 'Enter your company.' else 'Enter your university.' end using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_message, ''))) not between 10 and 2000 then
    raise exception 'Tell us a little about what you need (10 to 2,000 characters).' using errcode = '22023';
  end if;
  -- The same address can't flood the queue: one open lead per email.
  if exists (select 1 from public.sales_leads l where l.email = v_email and l.status in ('new', 'contacted')) then
    raise exception 'We already have your message and will reply soon.' using errcode = '23505';
  end if;
  insert into public.sales_leads (kind, name, role, organisation, university_id, email, message)
  values (p_kind, btrim(p_name), btrim(p_role), btrim(p_organisation),
          case when p_kind = 'university' then
            (select d.university_id from public.university_domains d where d.domain = v_domain order by d.university_id limit 1) end,
          v_email, btrim(p_message))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function private.submit_sales_lead(text, text, text, text, text, text) from public;
grant execute on function private.submit_sales_lead(text, text, text, text, text, text) to anon, authenticated;
create function public.submit_sales_lead(p_name text, p_role text, p_organisation text, p_email text, p_message text,
                                         p_kind text default 'university')
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$ select private.submit_sales_lead(p_name, p_role, p_organisation, p_email, p_message, p_kind) $$;
revoke all on function public.submit_sales_lead(text, text, text, text, text, text) from public, anon;
grant execute on function public.submit_sales_lead(text, text, text, text, text, text) to anon, authenticated;

-- /ops/leads shows which page a lead came from.
create or replace function private.ops_sales_leads()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_accounts();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', l.id, 'kind', l.kind, 'name', l.name, 'role', l.role, 'organisation', l.organisation, 'email', l.email,
             'university_id', l.university_id, 'university', u.name, 'message', l.message, 'status', l.status,
             'claimed_by', p.full_name, 'mine', l.claimed_by = v_me, 'staff_note', l.staff_note, 'created_at', l.created_at)
             order by l.status in ('won', 'lost'), l.created_at desc)
      from (select * from public.sales_leads order by status in ('won', 'lost'), created_at desc limit 200) l
      left join public.universities u on u.id = l.university_id
      left join public.profiles p on p.user_id = l.claimed_by), '[]'::jsonb);
end;
$$;
