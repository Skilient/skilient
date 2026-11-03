-- Societies and society events (phase 15, PRD 5.31). P requests a society and becomes president,
-- O an officer, M a member, S and S2/S3 students, X a student at another university, T a trust
-- reviewer and MO a moderator (both on two-factor).
begin;
select * from no_plan();

create function pg_temp.u(p text) returns uuid language sql immutable as $$
  select (case p when 'P' then '97000000-0000-0000-0000-000000000001' when 'O' then '97000000-0000-0000-0000-000000000002'
                 when 'M' then '97000000-0000-0000-0000-000000000003' when 'S' then '97000000-0000-0000-0000-000000000004'
                 when 'S2' then '97000000-0000-0000-0000-000000000005' when 'S3' then '97000000-0000-0000-0000-000000000006'
                 when 'X' then '97000000-0000-0000-0000-000000000007' when 'T' then '97000000-0000-0000-0000-0000000000f1'
                 when 'MO' then '97000000-0000-0000-0000-0000000000f2' end)::uuid;
$$;
create function pg_temp.as_user(p text, p_aal text default 'aal2') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(p), 'role', 'authenticated', 'aal', p_aal)::text, true);
  set local role authenticated;
end;
$$;
create function pg_temp.v(p text) returns uuid language sql as $$ select current_setting('test.' || p)::uuid $$;
create function pg_temp.keep(p text, p_value uuid) returns uuid language sql as $$ select set_config('test.' || p, p_value::text, false)::uuid $$;
-- Fixture reads the tests make as the owner (students can't read these tables directly).
create function pg_temp.slug(p_society uuid) returns text language sql security definer as $$ select slug from public.societies where id = p_society $$;
create function pg_temp.role_of(p_round uuid) returns uuid language sql security definer as $$ select id from public.induction_roles where round_id = p_round limit 1 $$;
create function pg_temp.ticket_of(p_event uuid) returns uuid language sql security definer as $$ select id from public.event_ticket_types where event_id = p_event limit 1 $$;
create function pg_temp.payment_of(p_registration uuid) returns uuid language sql security definer as $$ select id from public.event_payments where registration_id = p_registration $$;
create function pg_temp.payload(p_registration uuid) returns text language sql security definer as $$ select private.ticket_payload(p_registration) $$;
create function pg_temp.has_details(p_society uuid) returns boolean language sql security definer as $$ select private.society_has_payment_details(p_society) $$;
create function pg_temp.reference_of(p_registration uuid) returns text language sql security definer as $$ select reference_code from public.event_payments where registration_id = p_registration $$;
grant execute on all functions in schema pg_temp to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  (pg_temp.u('P'), 'pres@nutech.edu.pk', '{"full_name":"Pari President"}'),
  (pg_temp.u('O'), 'off@nutech.edu.pk', '{"full_name":"Omar Officer"}'),
  (pg_temp.u('M'), 'mem@nutech.edu.pk', '{"full_name":"Maha Member"}'),
  (pg_temp.u('S'), 'stu@nutech.edu.pk', '{"full_name":"Saad Student"}'),
  (pg_temp.u('S2'), 'stu2@nutech.edu.pk', '{"full_name":"Sana Second"}'),
  (pg_temp.u('S3'), 'stu3@nutech.edu.pk', '{"full_name":"Sami Third"}'),
  (pg_temp.u('X'), 'other@nu.edu.pk', '{"full_name":"Xara Other"}'),
  (pg_temp.u('T'), 'trust@nutech.edu.pk', '{"full_name":"Tara Trust"}'),
  (pg_temp.u('MO'), 'mod@nutech.edu.pk', '{"full_name":"Moiz Mod"}');
update public.profiles set onboarding_complete = true, username = 'p15_' || lower(right(user_id::text, 2)),
       department = 'Computer Science', graduation_year = 2027
 where user_id::text like '97000000-%';
insert into public.staff_roles (user_id, role, granted_by) values
  (pg_temp.u('T'), 'trust_reviewer', pg_temp.u('T')), (pg_temp.u('MO'), 'moderator', pg_temp.u('MO'));
insert into storage.objects (bucket_id, name, owner_id, metadata)
values ('society-documents', pg_temp.u('P')::text || '/97000000-0000-0000-0000-00000000d0c1.pdf', pg_temp.u('P')::text, '{"mimetype":"application/pdf","size":1000}');

-- RLS: nothing is readable or writable directly ------------------------------------------
select pg_temp.as_user('S');
select throws_ok($$ select * from public.societies $$, '42501', null, 'societies are not directly readable');
select throws_ok($$ select * from public.event_payments $$, '42501', null, 'payments are not directly readable');
select throws_ok($$ select * from public.society_payment_methods $$, '42501', null, 'payment methods are not directly readable');
select throws_ok($$ insert into public.society_members (society_id, user_id) values (gen_random_uuid(), pg_temp.u('S')) $$, '42501', null,
  'nobody writes memberships directly');
select throws_ok($$ select * from public.event_checkins $$, '42501', null, 'check-ins are not directly readable');
reset role;

-- Request → verify → president --------------------------------------------------------------
select pg_temp.as_user('P');
select is((public.society_name_check('CS Society') ->> 'available')::boolean, true, 'the name is free');
select lives_ok($$ select pg_temp.keep('soc', public.request_society(jsonb_build_object(
  'name', 'CS Society', 'category', 'technology', 'about', 'We build things together and run workshops every month.',
  'proof_path', pg_temp.u('P')::text || '/97000000-0000-0000-0000-00000000d0c1.pdf', 'office_bearer', true))) $$, 'a student requests a society');
select throws_ok($$ select public.request_society(jsonb_build_object('name', 'Debate Club', 'category', 'debating',
  'about', 'We debate every Thursday in the main hall.', 'proof_url', 'https://example.com/letter', 'office_bearer', true)) $$,
  '23505', null, 'one open request per student');
reset role;
select pg_temp.as_user('S');
select throws_ok($$ select public.society_page(pg_temp.slug(pg_temp.v('soc'))) $$, 'P0002', null,
  'a pending society is invisible to other students');
select is((public.society_name_check('The cs  club!') ->> 'available')::boolean, false, 'normalised names are unique per university');
reset role;

select pg_temp.as_user('S');
select throws_ok($$ select public.decide_society(pg_temp.v('soc'), 'approve', null) $$, '42501', null, 'students can''t verify');
reset role;
select pg_temp.as_user('T');
select ok(public.ops_societies('open') @> jsonb_build_array(jsonb_build_object('society_id', pg_temp.v('soc'))), 'the request is in the queue');
select ok((public.ops_inbox('societies') -> 'items') @> jsonb_build_array(jsonb_build_object('queue', 'societies', 'id', pg_temp.v('soc')::text)),
  'and in the ops inbox');
select lives_ok($$ select public.claim_society(pg_temp.v('soc')) $$, 'a trust reviewer claims it');
select lives_ok($$ select public.claim_society(pg_temp.v('soc'), false) $$, 'can release it');
select lives_ok($$ select public.claim_society(pg_temp.v('soc')) $$, 'and claim it again');
select lives_ok($$ select public.decide_society(pg_temp.v('soc'), 'approve', null) $$, 'and approves it');
reset role;
select is((select after ->> 'status' from public.ops_audit_log where action = 'society.approve' and target_id = pg_temp.v('soc')::text),
  'verified', 'the decision is audited with an after');
select ok((select before ? 'status' from public.ops_audit_log where action = 'society.approve' and target_id = pg_temp.v('soc')::text),
  'and a before');
select is((select role::text from public.society_members where society_id = pg_temp.v('soc') and user_id = pg_temp.u('P')), 'president',
  'the requester opens it as president');

-- Officers, join modes, an induction round end to end ---------------------------------------
select pg_temp.as_user('P');
select lives_ok($$ select pg_temp.keep('inv', public.invite_officer(pg_temp.v('soc'), 'p15_02', 'Events Lead', current_date, (current_date + 180)::date)) $$,
  'the president invites an officer');
reset role;
select pg_temp.as_user('O');
select lives_ok($$ select public.answer_society_invite(pg_temp.v('inv'), true) $$, 'who accepts');
reset role;
select is((select role::text from public.society_members where society_id = pg_temp.v('soc') and user_id = pg_temp.u('O')), 'officer', 'they join the roll call');
select pg_temp.as_user('O');
select throws_ok($$ select public.invite_officer(pg_temp.v('soc'), 'p15_03', 'Design', current_date, (current_date + 30)::date) $$,
  '42501', null, 'only the president invites officers');
select lives_ok($$ select public.set_membership_mode(pg_temp.v('soc'), 'inductions') $$, 'officers set the membership mode');
reset role;
select pg_temp.as_user('M');
select throws_ok($$ select public.join_society(pg_temp.v('soc')) $$, '55000', null, 'inductions-only societies refuse a plain join');
reset role;
select pg_temp.as_user('O');
select lives_ok($$ select pg_temp.keep('round', public.save_induction_round(pg_temp.v('soc'), jsonb_build_object(
  'title', 'Design team, fall', 'deadline', now() + interval '10 days',
  'roles', jsonb_build_array(jsonb_build_object('title', 'Design team', 'seats', 2)), 'questions', jsonb_build_array('Show us something you made')))) $$,
  'an officer drafts a round');
select lives_ok($$ select public.publish_induction_round(pg_temp.v('round')) $$, 'and publishes it');
reset role;
select pg_temp.as_user('M');
select lives_ok($$ select pg_temp.keep('app', public.apply_induction(pg_temp.v('round'), jsonb_build_object(
  'role_id', pg_temp.role_of(pg_temp.v('round')), 'answers', jsonb_build_array('My portfolio')))) $$,
  'a student applies');
select throws_ok($$ select public.apply_induction(pg_temp.v('round'), jsonb_build_object(
  'role_id', pg_temp.role_of(pg_temp.v('round')), 'answers', jsonb_build_array('Again'))) $$,
  '23505', null, 'one application per round');
reset role;
select pg_temp.as_user('P');
select lives_ok($$ select public.decide_induction_application(pg_temp.v('app'), 'accept', 'Welcome!') $$, 'the president accepts');
reset role;
select is((select team_title from public.society_members where society_id = pg_temp.v('soc') and user_id = pg_temp.u('M')), 'Design team',
  'the applicant is a member with a team title');

-- Students can't create events -------------------------------------------------------------
select pg_temp.as_user('S');
select throws_ok($$ select public.save_society_event(pg_temp.v('soc'), '{}'::jsonb) $$, 'P0002', null, 'a student can''t create a society event');
select throws_ok($$ select public.create_post(jsonb_build_object('type', 'event', 'body', 'My party', 'event', jsonb_build_object('starts_at', now() + interval '1 day'))) $$,
  '42501', null, 'nor an event post');
reset role;

-- A free event: waitlist, promotion, check-in once ---------------------------------------
select pg_temp.as_user('O');
select lives_ok($$ select pg_temp.keep('ev', public.save_society_event(pg_temp.v('soc'), jsonb_build_object(
  'type', 'workshop', 'title', 'Build with React', 'description', 'Hands-on.', 'location', 'Hall B',
  'sessions', jsonb_build_array(jsonb_build_object('starts_at', now() + interval '1 hour', 'ends_at', now() + interval '3 hours')),
  'ticket_types', jsonb_build_array(jsonb_build_object('name', 'Participant', 'capacity', 1)),
  'eligibility', jsonb_build_object('scope', 'university'), 'approval_mode', 'automatic', 'record_kinds', jsonb_build_array('attended')))) $$,
  'an officer creates an event');
select throws_ok($$ select public.save_society_event(pg_temp.v('soc'), jsonb_build_object(
  'type', 'talk', 'title', 'Cover test', 'location', 'Hall B', 'cover_path', gen_random_uuid() || '/' || gen_random_uuid() || '.webp',
  'sessions', jsonb_build_array(jsonb_build_object('starts_at', now() + interval '1 day', 'ends_at', now() + interval '1 day 1 hour')),
  'ticket_types', jsonb_build_array(jsonb_build_object('name', 'General', 'capacity', 5)))) $$,
  '22023', 'upload the cover again', 'a cover must be in the society''s own folder');
select lives_ok($$ select public.publish_event(pg_temp.v('ev')) $$, 'and publishes it');
reset role;
select pg_temp.as_user('M');
select ok(not (public.events_list('upcoming') @> jsonb_build_array(jsonb_build_object('id', pg_temp.v('ev')))),
  'society events stay out of the university portal''s event list');
reset role;
select ok((select post_id from public.events where id = pg_temp.v('ev')) is not null, 'publishing posts it under the society''s byline');
select is((select society_id from public.posts where id = (select post_id from public.events where id = pg_temp.v('ev'))), pg_temp.v('soc'), 'with the society on the post');

select pg_temp.as_user('M');
select is(public.register_event(pg_temp.v('ev'), jsonb_build_object('ticket_type_id', pg_temp.ticket_of(pg_temp.v('ev')))) ->> 'status',
  'confirmed', 'the first registrant is confirmed');
reset role;
select pg_temp.as_user('S');
select is(public.register_event(pg_temp.v('ev'), jsonb_build_object('ticket_type_id', pg_temp.ticket_of(pg_temp.v('ev')))) ->> 'waitlist_position',
  '1', 'the next one is waitlisted #1');
reset role;
select pg_temp.as_user('X');
select throws_ok($$ select public.register_event(pg_temp.v('ev'), jsonb_build_object('ticket_type_id', pg_temp.ticket_of(pg_temp.v('ev')))) $$,
  '55000', null, 'a student at another university is refused with the reason');
reset role;
select pg_temp.as_user('M');
select lives_ok($$ select public.cancel_registration(pg_temp.v('ev')) $$, 'cancelling frees the seat');
reset role;
select is((select status from public.event_registrations where event_id = pg_temp.v('ev') and user_id = pg_temp.u('S')), 'confirmed',
  'and the waitlist is promoted in order');

select pg_temp.keep('reg', (select id from public.event_registrations where event_id = pg_temp.v('ev') and user_id = pg_temp.u('S')));
select pg_temp.as_user('O');
select is(public.check_in_scan(pg_temp.v('ev'), null, pg_temp.payload(pg_temp.v('reg'))) ->> 'result', 'green', 'a signed ticket checks in');
select is(public.check_in_scan(pg_temp.v('ev'), null, pg_temp.payload(pg_temp.v('reg'))) ->> 'result', 'amber', 'a second scan is refused');
select ok(public.check_in_scan(pg_temp.v('ev'), null, pg_temp.payload(pg_temp.v('reg'))) ->> 'first_at' is not null, 'with the first time');
select is(public.check_in_scan(pg_temp.v('ev'), null, 'SKT1.' || pg_temp.v('reg')::text || '.000000000000000000000000') ->> 'result', 'red',
  'a forged signature is red');
select is(public.check_in_email(pg_temp.v('ev'), null, 'walkin@nutech.edu.pk') ->> 'claim', 'true', 'a walk-in by email is recorded for a later claim');
reset role;
select pg_temp.as_user('S');
select throws_ok($$ select public.check_in_scan(pg_temp.v('ev'), null, 'x') $$, 'P0002', null, 'students aren''t check-in staff');
reset role;

-- Close-out lists every checked-in attendee ---------------------------------------------------
update public.event_sessions set starts_at = now() - interval '5 hours', ends_at = now() - interval '3 hours' where event_id = pg_temp.v('ev');
update public.events set starts_at = now() - interval '5 hours', ends_at = now() - interval '3 hours', status = 'ended' where id = pg_temp.v('ev');
select pg_temp.as_user('O');
select is((public.closeout_page(pg_temp.v('ev')) -> 'counts' ->> 'attended')::integer, 1, 'close-out lists the checked-in attendee');
select throws_ok($$ select public.fix_attendance(pg_temp.v('ev'), null, pg_temp.u('S'), false, '') $$, '22023', null, 'a fix needs a reason');
select ok(public.issue_event_entries(pg_temp.v('ev')) -> 'attended' @> to_jsonb(array[pg_temp.u('S')]), 'issuing stores every attendee for phase 16');
reset role;

-- Paid tickets: two officers for payment details ---------------------------------------------
select pg_temp.as_user('P');
select lives_ok($$ select pg_temp.keep('pm', public.propose_payment_method(pg_temp.v('soc'), jsonb_build_object(
  'action', 'add', 'kind', 'jazzcash', 'account_title', 'CS Society', 'account_number', '03001234567'))) $$, 'an officer proposes payment details');
select throws_ok($$ select public.confirm_payment_method(pg_temp.v('pm'), true) $$, '42501', null, 'the proposer can''t confirm their own change');
select is(pg_temp.has_details(pg_temp.v('soc')), false, 'nothing takes effect yet');
reset role;
select pg_temp.as_user('O');
select lives_ok($$ select public.confirm_payment_method(pg_temp.v('pm'), true) $$, 'a second officer confirms');
reset role;
select is(pg_temp.has_details(pg_temp.v('soc')), true, 'now the details are live');
select is((select count(*)::integer from public.society_audit_log where society_id = pg_temp.v('soc') and action like 'payment_method.%'), 2,
  'the proposal and the confirmation are audited');

-- A paid ticket confirms only on the officer's approval; an unpaid hold frees the seat ------------
select pg_temp.as_user('O');
select lives_ok($$ select pg_temp.keep('paid', public.save_society_event(pg_temp.v('soc'), jsonb_build_object(
  'type', 'social', 'title', 'Annual dinner', 'location', 'Lawn',
  'sessions', jsonb_build_array(jsonb_build_object('starts_at', now() + interval '3 days', 'ends_at', now() + interval '3 days 3 hours')),
  'ticket_types', jsonb_build_array(jsonb_build_object('name', 'Dinner', 'capacity', 5, 'price_pkr', 500)),
  'eligibility', jsonb_build_object('scope', 'university'), 'refund_policy', 'until', 'refund_days', 2))) $$, 'a paid event');
select lives_ok($$ select public.publish_event(pg_temp.v('paid')) $$, 'publishes once payment details are confirmed');
reset role;
select pg_temp.as_user('M');
select is(public.register_event(pg_temp.v('paid'), jsonb_build_object('ticket_type_id', pg_temp.ticket_of(pg_temp.v('paid')))) ->> 'status',
  'held', 'a paid registration holds a seat');
select ok(public.ticket_payment(pg_temp.v('paid')) ->> 'reference_code' ~ '^SKL-[A-Z0-9]{4}$', 'with a reference code');
reset role;
select pg_temp.keep('mreg', (select id from public.event_registrations where event_id = pg_temp.v('paid') and user_id = pg_temp.u('M')));
insert into storage.objects (bucket_id, name, owner_id, metadata)
values ('event-receipts', pg_temp.v('paid')::text || '/' || pg_temp.v('mreg')::text || '/97000000-0000-0000-0000-0000000000e1.webp', pg_temp.u('M')::text, '{"mimetype":"image/webp","size":1000}');
select pg_temp.as_user('M');
select lives_ok($$ select public.submit_receipt(pg_temp.v('mreg'), pg_temp.v('paid')::text || '/' || pg_temp.v('mreg')::text || '/97000000-0000-0000-0000-0000000000e1.webp',
  repeat('a', 64), 'ffffffffffffffff', 'TXN-1234') $$, 'the student uploads the receipt');
reset role;
select is((select status from public.event_registrations where id = pg_temp.v('mreg')), 'held', 'the seat isn''t confirmed by an upload alone');
select pg_temp.as_user('O');
select lives_ok($$ select public.review_payment(pg_temp.payment_of(pg_temp.v('mreg')), true, null) $$,
  'the officer approves the receipt');
reset role;
select is((select status from public.event_registrations where id = pg_temp.v('mreg')), 'confirmed', 'only then is the ticket confirmed');

select pg_temp.as_user('S2');
select is(public.register_event(pg_temp.v('paid'), jsonb_build_object('ticket_type_id', pg_temp.ticket_of(pg_temp.v('paid')))) ->> 'status',
  'held', 'another hold');
reset role;
update public.event_registrations set hold_expires_at = now() - interval '1 minute' where event_id = pg_temp.v('paid') and user_id = pg_temp.u('S2');
select private.event_tick_payments();
select is((select status from public.event_registrations where event_id = pg_temp.v('paid') and user_id = pg_temp.u('S2')), 'cancelled',
  'an unpaid hold frees the seat after it expires');
select is((select p.status from public.event_payments p join public.event_registrations r on r.id = p.registration_id
            where r.event_id = pg_temp.v('paid') and r.user_id = pg_temp.u('S2')), 'released', 'and its payment is released');

-- A reused receipt or transaction ID is flagged ----------------------------------------------
select pg_temp.as_user('S3');
select lives_ok($$ select public.register_event(pg_temp.v('paid'), jsonb_build_object('ticket_type_id', pg_temp.ticket_of(pg_temp.v('paid')))) $$,
  'a third student holds a seat');
reset role;
select pg_temp.keep('s3reg', (select id from public.event_registrations where event_id = pg_temp.v('paid') and user_id = pg_temp.u('S3')));
insert into storage.objects (bucket_id, name, owner_id, metadata)
values ('event-receipts', pg_temp.v('paid')::text || '/' || pg_temp.v('s3reg')::text || '/97000000-0000-0000-0000-0000000000e2.webp', pg_temp.u('S3')::text, '{"mimetype":"image/webp","size":1000}');
select pg_temp.as_user('S3');
select lives_ok($$ select public.submit_receipt(pg_temp.v('s3reg'), pg_temp.v('paid')::text || '/' || pg_temp.v('s3reg')::text || '/97000000-0000-0000-0000-0000000000e2.webp',
  repeat('b', 64), 'fffffffffffffffe', 'txn-1234') $$, 'uploads a receipt with the same transaction ID');
reset role;
select pg_temp.as_user('O');
select ok(jsonb_array_length((select x -> 'duplicates' from jsonb_array_elements(public.payments_review(pg_temp.v('paid'))) x
                               where x ->> 'reference_code' = pg_temp.reference_of(pg_temp.v('s3reg')))) >= 1,
  'the review card flags the reused transaction ID');
reset role;

-- Receipts are private to the student, the officers and staff on a report ---------------------
select pg_temp.as_user('M');
select is((select count(*)::integer from storage.objects where bucket_id = 'event-receipts' and name like '%' || pg_temp.v('mreg')::text || '%'), 1, 'the student reads their receipt');
reset role;
select pg_temp.as_user('O');
select is((select count(*)::integer from storage.objects where bucket_id = 'event-receipts' and name like '%' || pg_temp.v('mreg')::text || '%'), 1, 'an officer reads it');
reset role;
select pg_temp.as_user('S');
select is((select count(*)::integer from storage.objects where bucket_id = 'event-receipts'), 0, 'another student reads none');
reset role;
select pg_temp.as_user('MO');
select is((select count(*)::integer from storage.objects where bucket_id = 'event-receipts' and name like '%' || pg_temp.v('mreg')::text || '%'), 0,
  'staff read none without a report');
reset role;
select private.open_case('event_registration', pg_temp.v('mreg'), pg_temp.u('P'), '{}'::jsonb, false, false);
select pg_temp.as_user('MO');
select is((select count(*)::integer from storage.objects where bucket_id = 'event-receipts' and name like '%' || pg_temp.v('mreg')::text || '%'), 1,
  'a moderator reads it once it is on a report');
reset role;

-- Reports cover societies and events ---------------------------------------------------------
select pg_temp.as_user('S');
select lives_ok($$ select public.submit_report('society', pg_temp.v('soc'), 'spam', 'Fake society') $$, 'a society can be reported');
reset role;

select * from finish();
rollback;
