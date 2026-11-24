-- The Record (phase 16, PRD 5.30). P is a society's president, O an officer, S and S2 students,
-- W a walk-in who signs up later with the address they were checked in with, W2 a second walk-in,
-- Z someone with a different address, T a trust reviewer on two-factor.
begin;
select * from no_plan();

create function pg_temp.u(p text) returns uuid language sql immutable as $$
  select (case p when 'P' then '98000000-0000-0000-0000-000000000001' when 'O' then '98000000-0000-0000-0000-000000000002'
                 when 'S' then '98000000-0000-0000-0000-000000000003' when 'S2' then '98000000-0000-0000-0000-000000000004'
                 when 'W' then '98000000-0000-0000-0000-000000000005' when 'W2' then '98000000-0000-0000-0000-000000000006'
                 when 'Z' then '98000000-0000-0000-0000-000000000007' when 'T' then '98000000-0000-0000-0000-0000000000f1' end)::uuid;
$$;
create function pg_temp.as_user(p text, p_aal text default 'aal2') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(p), 'role', 'authenticated', 'aal', p_aal)::text, true);
  set local role authenticated;
end;
$$;
create function pg_temp.v(p text) returns uuid language sql as $$ select current_setting('test.' || p)::uuid $$;
create function pg_temp.keep(p text, p_value uuid) returns uuid language sql as $$ select set_config('test.' || p, p_value::text, false)::uuid $$;
create function pg_temp.ticket_of(p_event uuid) returns uuid language sql security definer as $$ select id from public.event_ticket_types where event_id = p_event limit 1 $$;
create function pg_temp.payload(p_event uuid, p_user text) returns text language sql security definer as $$
  select private.ticket_payload((select id from public.event_registrations where event_id = p_event and user_id = pg_temp.u(p_user)))
$$;
create function pg_temp.entry(p_user text, p_kind text default 'attended') returns uuid language sql security definer as $$
  select id from public.record_entries where user_id = pg_temp.u(p_user) and kind = p_kind and status not in ('revoked', 'superseded')
   order by created_at desc limit 1
$$;
create function pg_temp.status(p_entry uuid) returns text language sql security definer as $$ select status from public.record_entries where id = p_entry $$;
create function pg_temp.code(p_entry uuid) returns text language sql security definer as $$ select code from public.record_entries where id = p_entry $$;
-- Stands in for the cv-sign worker: prepare, then commit with a code and a well-formed signature.
create function pg_temp.seal(p_entry uuid, p_code text) returns uuid language plpgsql security definer as $$
declare
  p record;
begin
  select * into p from private.record_sign_prepare(p_entry);
  return private.record_sign_commit(p_entry, p_code, 'cv-20260101-0000aaaa', p.issued_at, p.payload, repeat('a', 64), repeat('A', 86));
end;
$$;
grant execute on all functions in schema pg_temp to authenticated, anon;

insert into public.signing_keys (key_id, public_key, active_from, retired_at)
values ('cv-20260101-0000aaaa', repeat('B', 43), now() - interval '2 days', now() - interval '1 day');

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  (pg_temp.u('P'), 'rpres@nutech.edu.pk', '{"full_name":"Rida President"}', now()),
  (pg_temp.u('O'), 'roff@nutech.edu.pk', '{"full_name":"Rafay Officer"}', now()),
  (pg_temp.u('S'), 'rstu@nutech.edu.pk', '{"full_name":"Rumi Student"}', now()),
  (pg_temp.u('S2'), 'rstu2@nutech.edu.pk', '{"full_name":"Ruba Second"}', now()),
  (pg_temp.u('Z'), 'rother@nutech.edu.pk', '{"full_name":"Raza Other"}', now()),
  (pg_temp.u('T'), 'rtrust@nutech.edu.pk', '{"full_name":"Rania Trust"}', now());
update public.profiles set onboarding_complete = true, username = 'p16_' || lower(right(user_id::text, 2)),
       department = 'Computer Science', graduation_year = 2027
 where user_id::text like '98000000-%';
insert into public.staff_roles (user_id, role, granted_by) values (pg_temp.u('T'), 'trust_reviewer', pg_temp.u('T'));

insert into public.societies (id, university_id, slug, name, name_key, category, about, status, created_by, verified_at)
select '98000000-0000-0000-0000-00000000a0c1', p.university_id, 'p16-cs-society', 'Record CS Society', 'record cs society', 'technology',
       'We build things together and run workshops every month.', 'verified', pg_temp.u('P'), now() - interval '60 days'
  from public.profiles p where p.user_id = pg_temp.u('P');
select pg_temp.keep('soc', '98000000-0000-0000-0000-00000000a0c1');
insert into public.society_members (society_id, user_id, role) values
  (pg_temp.v('soc'), pg_temp.u('P'), 'president'), (pg_temp.v('soc'), pg_temp.u('O'), 'officer');

-- RLS: nothing is writable, and nobody reads another student's entries ------------------------
select pg_temp.as_user('S');
select throws_ok($$ insert into public.record_entries (user_id, kind, issuer_type, issuer_name, source, source_id, title, occurred_on)
                    values (pg_temp.u('S'), 'attended', 'skilient', 'Skilient', 'event', gen_random_uuid(), 'Fake', current_date) $$,
  '42501', null, 'nobody writes entries directly');
select throws_ok($$ select * from public.record_claims $$, '42501', null, 'claims are not readable');
select throws_ok($$ update public.record_entries set hidden = true $$, '42501', null, 'nor updated directly');
reset role;
set local role anon;
select throws_ok($$ select * from public.record_entries $$, '42501', null, 'anon can''t read entries');
select throws_ok($$ select * from public.record_share_links $$, '42501', null, 'nor share links');
reset role;

-- An event: S attends by ticket, O (the issuing officer) attends too, two walk-ins by email -----
select pg_temp.as_user('O');
select lives_ok($$ select pg_temp.keep('ev', public.save_society_event(pg_temp.v('soc'), jsonb_build_object(
  'type', 'workshop', 'title', 'Build with React', 'description', 'Hands-on.', 'location', 'Hall B',
  'sessions', jsonb_build_array(jsonb_build_object('starts_at', now() + interval '1 hour', 'ends_at', now() + interval '3 hours')),
  'ticket_types', jsonb_build_array(jsonb_build_object('name', 'Participant', 'capacity', 10)),
  'eligibility', jsonb_build_object('scope', 'university'), 'approval_mode', 'automatic', 'record_kinds', jsonb_build_array('attended')))) $$,
  'an officer creates an event');
select lives_ok($$ select public.publish_event(pg_temp.v('ev')) $$, 'and publishes it');
reset role;
select pg_temp.as_user('S');
select is(public.register_event(pg_temp.v('ev'), jsonb_build_object('ticket_type_id', pg_temp.ticket_of(pg_temp.v('ev')))) ->> 'status', 'confirmed', 'S registers');
reset role;
select pg_temp.as_user('O');
select is(public.register_event(pg_temp.v('ev'), jsonb_build_object('ticket_type_id', pg_temp.ticket_of(pg_temp.v('ev')))) ->> 'status', 'confirmed', 'O registers');
select is(public.check_in_scan(pg_temp.v('ev'), null, pg_temp.payload(pg_temp.v('ev'), 'S'))
  ->> 'result', 'green', 'S checks in');
select is(public.check_in_scan(pg_temp.v('ev'), null, pg_temp.payload(pg_temp.v('ev'), 'O'))
  ->> 'result', 'green', 'O checks in');
select is(public.check_in_email(pg_temp.v('ev'), null, 'rwalk@nutech.edu.pk') ->> 'claim', 'true', 'a walk-in by email');
select is(public.check_in_email(pg_temp.v('ev'), null, 'rwalk2@nutech.edu.pk') ->> 'claim', 'true', 'and another');
reset role;
update public.event_sessions set starts_at = now() - interval '5 hours', ends_at = now() - interval '3 hours' where event_id = pg_temp.v('ev');
update public.events set starts_at = now() - interval '5 hours', ends_at = now() - interval '3 hours', status = 'ended' where id = pg_temp.v('ev');

-- Close-out issues the entries ---------------------------------------------------------------
select pg_temp.as_user('O');
select lives_ok($$ select public.issue_event_entries(pg_temp.v('ev')) $$, 'the officer issues at close-out');
reset role;
select is(pg_temp.status(pg_temp.entry('S')), 'pending', 'S''s Attended entry is queued for signing');
select ok(exists (select 1 from pgmq.q_record_jobs where (message ->> 'entry_id')::uuid = pg_temp.entry('S')), 'on record_jobs');
select is(pg_temp.status(pg_temp.entry('O')), 'awaiting', 'the issuing officer''s own entry waits for a second officer');
select ok(not exists (select 1 from pgmq.q_record_jobs where (message ->> 'entry_id')::uuid = pg_temp.entry('O')), 'and isn''t signed yet');
select is((select count(*)::integer from public.record_entries where status = 'held' and source_id = pg_temp.v('ev')), 2, 'the walk-ins'' entries are held');
select is((select count(*)::integer from public.record_claims where event_id = pg_temp.v('ev')), 2, 'one claim per walk-in');
select is((select count(*)::integer from pgmq.q_notification_emails where message ->> 'kind' = 'record_claim'
             and (message ->> 'claim_id')::uuid in (select id from public.record_claims where event_id = pg_temp.v('ev'))), 2,
  'one claim email queued per person');
select is((select status from public.event_issuances where event_id = pg_temp.v('ev')), 'signed', 'the close-out is marked issued');

-- No officer issues to themselves alone ----------------------------------------------------------
select pg_temp.as_user('O');
select throws_ok($$ select public.confirm_record_entry(pg_temp.entry('O')) $$, '42501', null, 'O can''t confirm their own entry');
reset role;
select ok(exists (select 1 from public.notifications where user_id = pg_temp.u('P') and type = 'record_confirm'), 'the president is asked to confirm');
select pg_temp.as_user('S');
select throws_ok($$ select public.confirm_record_entry(pg_temp.entry('O')) $$, 'P0002', null, 'a student can''t confirm');
reset role;
select pg_temp.as_user('P');
select lives_ok($$ select public.confirm_record_entry(pg_temp.entry('O')) $$, 'the president confirms it');
reset role;
select is(pg_temp.status(pg_temp.entry('O')), 'pending', 'now it is queued');
select is((select confirmed_by from public.record_entries where id = pg_temp.entry('O')), pg_temp.u('P'), 'with the second officer recorded');

-- Signing seals; verify shows it -----------------------------------------------------------------
select is((select payload -> 'holder' ->> 'name' from private.record_sign_prepare(pg_temp.entry('S'))), 'Rumi Student', 'the payload names the holder');
select is((select payload ->> 'kind' from private.record_sign_prepare(pg_temp.entry('S'))), 'attended', 'and the kind');
select isnt(pg_temp.seal(pg_temp.entry('S'), '7RCD0000A1'), null, 'the worker seals S''s entry');
select is(pg_temp.seal(pg_temp.entry('S'), '7RCD0000A9'), null, 'a second commit changes nothing');
select is(pg_temp.status(pg_temp.entry('S')), 'sealed', 'sealed');
select ok(exists (select 1 from public.notifications where user_id = pg_temp.u('S') and type = 'record_entry'), 'S is told');
select pg_temp.keep('s_entry', pg_temp.entry('S'));
set local role anon;
select is(public.verify_record_entry('7rcd0000a1') ->> 'status', 'sealed', 'anyone can verify the code');
select is(public.verify_record_entry('7RCD0000A1') -> 'payload' ->> 'title', 'Build with React', 'with the signed payload');
select is(public.verify_record_entry('NOPE000000'), null, 'an unknown code is not found');
reset role;
select isnt(pg_temp.seal(pg_temp.entry('O'), '7RCD0000A2'), null, 'O''s confirmed entry seals too');

-- Pins, hide, share links -------------------------------------------------------------------------
select pg_temp.as_user('S');
select lives_ok($$ select public.set_record_display(pg_temp.v('s_entry'), true, false) $$, 'S pins the entry');
select throws_ok($$ select public.set_record_display(pg_temp.v('s_entry'), true, true) $$, '22023', null, 'a hidden entry can''t be pinned');
select lives_ok($$ select pg_temp.keep('link', public.create_record_share_link(repeat('c', 64), 'Scholarship', 30)) $$, 'S makes a share link');
select throws_ok($$ select public.create_record_share_link(repeat('d', 64), null, null) $$, '22023', null, 'a share link always expires');
select is(jsonb_array_length(public.my_record() -> 'entries'), 1, 'my_record lists the entry');
reset role;
set local role anon;
select is(jsonb_array_length(public.open_record_share(repeat('c', 64), null) -> 'entries'), 1, 'the link shows the entry signed-out');
select is(public.open_record_share(repeat('e', 64), null) ->> 'state', 'invalid', 'a wrong token is invalid');
reset role;
select pg_temp.as_user('S');
select lives_ok($$ select public.set_record_display(pg_temp.v('s_entry'), false, true) $$, 'S hides it');
reset role;
set local role anon;
select is(jsonb_array_length(public.open_record_share(repeat('c', 64), null) -> 'entries'), 0, 'hidden entries stay off share links');
reset role;
select pg_temp.as_user('S');
select lives_ok($$ select public.set_record_display(pg_temp.v('s_entry'), false, false) $$, 'and shows it again');
select lives_ok($$ select public.revoke_record_share_link(pg_temp.v('link')) $$, 'revokes the link');
reset role;
set local role anon;
select is(public.open_record_share(repeat('c', 64), null) ->> 'state', 'invalid', 'a revoked link is invalid');
reset role;

-- pgTAP refuses every cross-user read --------------------------------------------------------------
select pg_temp.as_user('S2');
select is((select count(*)::integer from public.record_entries), 0, 'S2 reads none of S''s or O''s entries');
select is((select count(*)::integer from public.record_share_links), 0, 'nor their share links');
select is((select count(*)::integer from public.record_corrections), 0, 'nor their mistake reports');
select is((select count(*)::integer from public.record_pdf_exports), 0, 'nor their PDFs');
select is(public.record_highlights(pg_temp.u('S')), '[]'::jsonb, 'unpinned entries aren''t on S''s profile');
select throws_ok($$ select public.society_record_page(pg_temp.v('soc')) $$, 'P0002', null, 'a student can''t open the society''s Record tab');
reset role;
select pg_temp.as_user('O');
select is((select count(*)::integer from public.record_entries where issuer_id = pg_temp.v('soc')), 2, 'officers read what their society issued (not held ones)');
select is(jsonb_array_length(public.society_record_page(pg_temp.v('soc')) -> 'entries'), 2, 'and see them on the Record tab');
reset role;

-- Report a mistake → a correction supersedes ------------------------------------------------------
select pg_temp.as_user('S');
select lives_ok($$ select public.report_record_mistake(pg_temp.v('s_entry'), 'The workshop was called React Basics.') $$, 'S reports a mistake');
select throws_ok($$ select public.report_record_mistake(pg_temp.v('s_entry'), 'The workshop was called React Basics.') $$, '23505', null, 'once at a time');
reset role;
select ok(exists (select 1 from public.notifications where user_id = pg_temp.u('O') and type = 'record_mistake'), 'the officers are told');
select pg_temp.as_user('O');
select lives_ok($$ select pg_temp.keep('fix', public.correct_record_entry(pg_temp.v('s_entry'), jsonb_build_object('title', 'React Basics'), 'Renamed')) $$,
  'an officer corrects it');
reset role;
select is(pg_temp.status(pg_temp.v('fix')), 'pending', 'the correction is queued');
select is(pg_temp.status(pg_temp.v('s_entry')), 'sealed', 'the old entry stands until it seals');
select isnt(pg_temp.seal(pg_temp.v('fix'), '7RCD0000A3'), null, 'the correction seals');
select is(pg_temp.status(pg_temp.v('s_entry')), 'superseded', 'the old entry is superseded');
set local role anon;
select is(public.verify_record_entry('7RCD0000A1') ->> 'superseded_by_code', '7RCD0000A3', 'its code reads "superseded by" the new one');
select is(public.verify_record_entry('7RCD0000A3') -> 'payload' ->> 'supersedes', '7RCD0000A1', 'and the new one names it');
reset role;
select is((select status from public.record_corrections where entry_id = pg_temp.v('s_entry')), 'corrected', 'the report is closed');

-- CV "Leadership and activities" ---------------------------------------------------------------------
select pg_temp.as_user('S');
select lives_ok($$ select public.save_cv_activities(array[pg_temp.v('fix')]) $$, 'S puts the entry on the CV');
select throws_ok($$ select public.save_cv_activities(array[pg_temp.entry('O')]) $$, 'P0002', null, 'not someone else''s');
reset role;
select is(private.cv_activities(pg_temp.u('S')) -> 0 ->> 'label', 'Attended React Basics', 'the CV prints it plainly');
select is(private.cv_activities(pg_temp.u('S')) -> 0 ->> 'code', '7RCD0000A3', 'with the code the verify page opens');
select ok((select 'activities' = any (sections) from public.cv_settings where user_id = pg_temp.u('S')), 'and the section is on');

-- Revocation: with a reason, notified, audited, appealable ---------------------------------------------
select pg_temp.as_user('S2');
select throws_ok($$ select public.revoke_record_entry(pg_temp.v('fix'), 'not_earned', 'No') $$, 'P0002', null, 'a student can''t revoke');
reset role;
select pg_temp.as_user('O');
select throws_ok($$ select public.revoke_record_entry(pg_temp.v('fix'), 'not_earned', '') $$, '22023', null, 'a revocation needs a reason');
select lives_ok($$ select public.revoke_record_entry(pg_temp.v('fix'), 'not_earned', 'Checked in but left after ten minutes.') $$, 'an officer revokes it');
reset role;
select is(pg_temp.status(pg_temp.v('fix')), 'revoked', 'revoked');
set local role anon;
select is(public.verify_record_entry('7RCD0000A3') ->> 'status', 'revoked', 'verify shows revoked');
select is(public.verify_record_entry('7RCD0000A3') ->> 'revoked_category', 'not_earned', 'with the reason''s category');
select ok(not (public.verify_record_entry('7RCD0000A3') ? 'payload'), 'and nothing else');
reset role;
select ok(exists (select 1 from public.notifications where user_id = pg_temp.u('S') and type = 'record_revoked'
                   and data ->> 'reason' = 'Checked in but left after ten minutes.'), 'S is told why');
select ok(exists (select 1 from public.society_audit_log where society_id = pg_temp.v('soc') and action = 'record.revoke'), 'audited in the society log');
select is((select record_entries from public.cv_settings where user_id = pg_temp.u('S')), '{}'::uuid[], 'and it leaves the CV');
select pg_temp.as_user('S');
select ok(public.my_appealable() @> jsonb_build_array(jsonb_build_object('type', 'record_revocation', 'id', pg_temp.v('fix'))), 'S can appeal it');
select lives_ok($$ select pg_temp.keep('appeal', public.submit_appeal('record_revocation', pg_temp.v('fix'), 'I stayed for the whole workshop, ask the host.')) $$,
  'and appeals');
reset role;
select is((select decider_role::text from public.appeals where id = pg_temp.v('appeal')), 'trust_reviewer', 'a trust reviewer decides it');
select pg_temp.as_user('T');
select lives_ok($$ select public.claim_appeal(pg_temp.v('appeal'), true) $$, 'T claims the appeal');
select lives_ok($$ select public.decide_appeal(pg_temp.v('appeal'), 'overturned', 'The host confirmed the attendance.') $$, 'and overturns it');
reset role;
select is(pg_temp.status(pg_temp.entry('S')), 'pending', 'the entry is issued again under a new code');

-- Staff revoke, audited before and after -----------------------------------------------------------------
select pg_temp.as_user('T');
select lives_ok($$ select public.revoke_record_entry(pg_temp.entry('O'), 'misconduct', 'Issued during a suspension review.') $$, 'a trust reviewer revokes');
select is(public.ops_record_entry('7RCD0000A2') ->> 'status', 'revoked', 'and finds it by code');
reset role;
select ok((select before ? 'status' and after ? 'status' from public.ops_audit_log where action = 'record.revoke'
             and target_id = (select id::text from public.record_entries where code = '7RCD0000A2')), 'the staff revocation is audited before and after');

-- Claim by email: only the same verified address ------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  (pg_temp.u('W'), 'rwalk@nutech.edu.pk', '{"full_name":"Rehan Walkin"}', now());
insert into auth.users (id, email, raw_user_meta_data) values
  (pg_temp.u('W2'), 'rwalk2@nutech.edu.pk', '{"full_name":"Reem Walkin"}');
update public.profiles set onboarding_complete = true, username = 'p16_' || lower(right(user_id::text, 2)) where user_id in (pg_temp.u('W'), pg_temp.u('W2'));
select pg_temp.as_user('W');
select is(public.record_waiting(), 1, 'W signs up with the same verified address: 1 entry waiting');
reset role;
select pg_temp.as_user('W2');
select is(public.record_waiting(), 0, 'W2 hasn''t verified the address yet: nothing waits');
reset role;
select pg_temp.as_user('Z');
select is(public.record_waiting(), 0, 'a different address: nothing waits');
select is(public.claim_record_entries(), 0, 'and claiming finds nothing');
reset role;
select is((select payload_count from (select count(*) as payload_count from private.record_claim_email(
            (select id from public.record_claims where event_id = pg_temp.v('ev') and email_hash = private.email_hash('rwalk2@nutech.edu.pk')))) q), 0::bigint,
  'no claim email goes to an address that already has an account');
select pg_temp.as_user('W');
select is(public.claim_record_entries(), 1, 'W claims the entry');
select is(public.claim_record_entries(), 0, 'once');
reset role;
select is(pg_temp.status(pg_temp.entry('W')), 'pending', 'it joins W''s Record and is queued for signing');
select is((select claimed_by from public.event_email_attendees where event_id = pg_temp.v('ev') and email = 'rwalk@nutech.edu.pk'), pg_temp.u('W'),
  'the walk-in row knows who claimed it');
update auth.users set email_confirmed_at = now() where id = pg_temp.u('W2');
select pg_temp.as_user('W2');
select is(public.record_waiting(), 1, 'once W2 verifies, their entry waits');
reset role;

-- One claim email per person per event, and it expires ---------------------------------------------------
insert into public.record_claims (email_hash, event_id, expires_at)
values (private.email_hash('rlater@nutech.edu.pk'), pg_temp.v('ev'), now() + interval '180 days');
select throws_ok($$ insert into public.record_claims (email_hash, event_id, expires_at)
                    values (private.email_hash('rlater@nutech.edu.pk'), pg_temp.v('ev'), now() + interval '180 days') $$,
  '23505', null, 'one claim per address per event');
update public.record_claims set expires_at = now() - interval '1 second' where event_id = pg_temp.v('ev') and user_id = pg_temp.u('W2');
select is(private.record_claims_expire(), 1, 'the nightly job removes the expired held entry');
select pg_temp.as_user('W2');
select is(public.record_waiting(), 0, 'and nothing waits any more');
reset role;

-- Office bearer: a confirmed term ---------------------------------------------------------------------
insert into public.society_terms (id, society_id, user_id, role, title, term_start, term_end)
values ('98000000-0000-0000-0000-00000000e001', pg_temp.v('soc'), pg_temp.u('O'), 'officer', 'Events Lead', '2025-09-01', '2026-06-30');
select pg_temp.as_user('P');
select lives_ok($$ select public.confirm_term('98000000-0000-0000-0000-00000000e001') $$, 'the president confirms O''s term');
reset role;
select is(pg_temp.status(pg_temp.entry('O', 'office_bearer')), 'pending', 'an Office bearer entry is queued');
select is((select evidence ->> 'line' from public.record_entries where id = pg_temp.entry('O', 'office_bearer')), 'Events Lead · Sep 2025 – Jun 2026',
  'with the term as its evidence');
select isnt(pg_temp.seal(pg_temp.entry('O', 'office_bearer'), '7RCD0000A4'), null, 'and seals');

-- Rank: merit entries count, attendance never; the 30-day hold --------------------------------------------
select is((private.compute_ranking(pg_temp.u('O')) -> 'record' ->> 'points')::numeric, 25.00, 'an officer''s term counts 25');
select isnt(pg_temp.seal(pg_temp.entry('S'), '7RCD0000A5'), null, 'S''s reissued Attended entry seals');
select is((private.compute_ranking(pg_temp.u('S')) -> 'record' ->> 'points')::numeric, 0::numeric, 'attendance never adds rank');
update public.societies set verified_at = now() - interval '10 days' where id = pg_temp.v('soc');
select is((private.compute_ranking(pg_temp.u('O')) -> 'record' ->> 'points')::numeric, 0::numeric, 'a society verified 10 days ago is held');
select is((private.ranking_points(private.compute_ranking(pg_temp.u('O'))) ->> 'record')::numeric, 0::numeric, 'ranking_points carries the component');
update public.societies set verified_at = now() - interval '60 days' where id = pg_temp.v('soc');
select is((select version from private.ranking_formula()), 2, 'formula v2 is in force');
select ok(exists (select 1 from public.config_keys where key = 'ranking.formula' and schema -> 'properties' ? 'record'), 'its schema knows the component');
select ok(extensions.jsonb_matches_schema((select schema::json from public.config_keys where key = 'ranking.formula'),
                                          (select value from private.ranking_formula())), 'and v2 matches it');

-- Reports and limits ------------------------------------------------------------------------------------
select pg_temp.as_user('S');
select lives_ok($$ select public.set_record_display(pg_temp.entry('S'), true, false) $$, 'S pins the new entry');
reset role;
select pg_temp.as_user('S2');
select ok(private.can_report('record_entry', pg_temp.entry('S')), 'a pinned entry can be reported');
select is(jsonb_array_length(public.record_highlights(pg_temp.u('S'))), 1, 'and shows on S''s profile');
reset role;
select ok(exists (select 1 from public.config_keys where key = 'record.limits'), 'record.limits has a config_keys row');
select ok(extensions.jsonb_matches_schema((select schema::json from public.config_keys where key = 'record.limits'),
                                          (select value from public.platform_config where key = 'record.limits')), 'and matches its schema');

select * from finish();
rollback;
