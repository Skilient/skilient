-- Portals flag (phase 14, decisions 2026-11-02 "Student-first scope"): recruiter and university
-- portals off, faculty on; signup refused while off; the one-time deletion of recruiter and
-- official accounts keeps students, faculty and faculty seats.
begin;
select plan(25);

-- Defaults ------------------------------------------------------------------
select is(private.portals_state(), '{"recruiter": false, "university": false, "faculty": true}'::jsonb,
  'portals.enabled defaults to recruiter and university off, faculty on');
select ok(exists (select 1 from public.config_keys where key = 'portals.enabled'), 'portals.enabled has its config_keys row');
select ok(extensions.jsonb_matches_schema((select schema from public.config_keys where key = 'portals.enabled')::json,
  private.config('portals.enabled')), 'the stored value matches its schema');
select is(private.portal_enabled('recruiter'), false, 'the recruiter portal is off');
select is(private.portal_enabled('faculty'), true, 'the faculty portal is on');
select is(private.portal_enabled('nonsense'), false, 'an unknown portal is closed');

-- Readable signed out, and part of the gate state
set local role anon;
select is(public.portals_state() ->> 'recruiter', 'false', 'anon reads the flag (the gate needs it before sign-in)');
reset role;

insert into auth.users (id, email, raw_user_meta_data) values
  ('96000000-0000-0000-0000-000000000001', 'stu1@nutech.edu.pk', '{}'),
  ('96000000-0000-0000-0000-000000000002', 'fac1@nutech.edu.pk', '{"role":"faculty"}'),
  ('96000000-0000-0000-0000-000000000003', 'off1@nutech.edu.pk', '{"role":"university_admin"}'),
  ('96000000-0000-0000-0000-000000000004', 'rec1@acmecorp.com', '{"role":"recruiter","full_name":"Rita Recruiter"}'),
  ('96000000-0000-0000-0000-000000000005', 'rec2@giverco.com', '{"role":"recruiter","full_name":"Gita Giver"}');

select set_config('request.jwt.claims', '{"sub": "96000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
set local role authenticated;
select is(public.my_gate_state() -> 'portals', '{"recruiter": false, "university": false, "faculty": true}'::jsonb,
  'my_gate_state() carries the flag');
reset role;

-- Signup refused while a portal is off ---------------------------------------
select is(private.validate_signup('x@acmecorp.com', 'recruiter'),
  'Recruiter accounts aren''t open yet. Talk to us at skilient.com/recruiters.', 'a recruiter signup is refused while the portal is off');
select is(private.validate_signup('x@nutech.edu.pk', 'university_admin'),
  'University accounts aren''t open yet. Talk to us at skilient.com/universities.', 'an official signup is refused while the portal is off');
select is(public.hook_before_user_created(jsonb_build_object('user', jsonb_build_object(
    'email', 'x@acmecorp.com', 'app_metadata', jsonb_build_object('provider', 'email'),
    'user_metadata', jsonb_build_object('role', 'recruiter')))) -> 'error' ->> 'http_code', '403',
  'the before-user-created hook answers 403 for a recruiter');
select is(private.validate_signup('x@nutech.edu.pk', 'faculty'), null, 'faculty signups stay open');
select is(private.validate_signup('x@nutech.edu.pk', 'student'), null, 'student signups stay open');

-- Switching a portal back on restores its signup
insert into public.platform_config (key, version, value, reason)
values ('portals.enabled', 1000, '{"recruiter": true, "university": true, "faculty": true}', 'pgTAP: portals open');
select is(private.validate_signup('x@acmecorp.com', 'recruiter'), null, 'a recruiter signup is accepted once the portal is on');
select is(private.validate_signup('x@nutech.edu.pk', 'university_admin'), null, 'an official signup is accepted once the portal is on');
insert into public.platform_config (key, version, value, reason)
values ('portals.enabled', 1001, '{"recruiter": false, "university": false, "faculty": true}', 'pgTAP: portals closed again');

-- The one-time deletion --------------------------------------------------------
insert into public.organizations (id, slug, name, domain, website, industry, size, city, signer_role, created_by) values
  ('96000000-0000-0000-0000-0000000000a1', 'acme-p14', 'Acme', 'acmecorp.com', 'https://acmecorp.com', 'Software', '11-50', 'Lahore', 'CTO',
   '96000000-0000-0000-0000-000000000004'),
  ('96000000-0000-0000-0000-0000000000a2', 'giver-p14', 'Giver', 'giverco.com', 'https://giverco.com', 'Software', '11-50', 'Lahore', 'CTO',
   '96000000-0000-0000-0000-000000000005');
insert into public.org_members (org_id, user_id, role) values
  ('96000000-0000-0000-0000-0000000000a1', '96000000-0000-0000-0000-000000000004', 'admin'),
  ('96000000-0000-0000-0000-0000000000a2', '96000000-0000-0000-0000-000000000005', 'admin');
insert into public.university_admins (user_id, university_id, role)
select u.id, p.university_id, r.role::public.uni_admin_role
  from (values ('96000000-0000-0000-0000-000000000002'::uuid, 'admin'), ('96000000-0000-0000-0000-000000000003'::uuid, 'owner')) as r(id, role)
  join auth.users u on u.id = r.id
  join public.profiles p on p.user_id = u.id;

-- A competition at Giver awarded a student: Giver stays (memberless) so the award stays.
insert into public.competitions (id, host_type, org_id, title, role, brief, prize, starts_at, ends_at, rubric, status) values
  ('96000000-0000-0000-0000-0000000000c1', 'org', '96000000-0000-0000-0000-0000000000a2', 'Build a thing', 'Frontend',
   repeat('A real brief for a real competition. ', 4), 'PKR 50,000', now() - interval '20 days', now() - interval '10 days', '[]', 'judged');
insert into public.competition_awards (competition_id, student_id, skill_id, kind)
values ('96000000-0000-0000-0000-0000000000c1', '96000000-0000-0000-0000-000000000001', 'python', 'winner');

select lives_ok($$ select private.delete_closed_portal_accounts() $$, 'the deletion runs');
select is((select count(*)::int from public.profiles where role in ('recruiter', 'university_admin')), 0,
  'no recruiter or official account remains');
select is((select count(*)::int from auth.users where id in ('96000000-0000-0000-0000-000000000003', '96000000-0000-0000-0000-000000000004')), 0,
  'their auth users are gone');
select ok(exists (select 1 from public.profiles where user_id = '96000000-0000-0000-0000-000000000001'), 'the student keeps their account');
select ok(exists (select 1 from public.profiles where user_id = '96000000-0000-0000-0000-000000000002'), 'the faculty member keeps their account');
select ok(exists (select 1 from public.university_admins where user_id = '96000000-0000-0000-0000-000000000002'), 'and keeps their seat');
select ok(not exists (select 1 from public.university_admins where user_id = '96000000-0000-0000-0000-000000000003'), 'the official''s seat is gone');
select ok(not exists (select 1 from public.organizations where id = '96000000-0000-0000-0000-0000000000a1'), 'an organisation without awards is deleted');
select ok(exists (select 1 from public.organizations where id = '96000000-0000-0000-0000-0000000000a2'),
  'an organisation whose competition awarded a student stays');
select ok(exists (select 1 from public.competition_awards where student_id = '96000000-0000-0000-0000-000000000001'),
  'so the student keeps the award');

select * from finish();
rollback;
