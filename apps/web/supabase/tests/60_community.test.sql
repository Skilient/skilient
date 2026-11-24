-- Phase 18 (PRD 5.34): Openings, share-to-chat, people you may know and push.
-- A, B, C, D, E, F, G students in the batch of 2027 at a test university (Computer Science), H in 2028,
-- X at another university. A–B friends, A–C society co-members; D and E have no tie to A.
begin;
select * from no_plan();

create function pg_temp.u(p text) returns uuid language sql immutable as $$
  select ('99180000-0000-0000-0000-0000000000' || case p when 'A' then '01' when 'B' then '02' when 'C' then '03' when 'D' then '04'
    when 'E' then '05' when 'F' then '06' when 'G' then '07' when 'H' then '08' when 'X' then '09' when 'M' then '0a'
    else lpad((10 + substr(p, 2)::integer)::text, 2, '0') end)::uuid;
$$;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(p), 'role', 'authenticated', 'aal', 'aal1')::text, true);
  set local role authenticated;
end;
$$;
create function pg_temp.keep(p text, p_value uuid) returns uuid language sql as $$ select set_config('test.' || p, p_value::text, false)::uuid $$;
create function pg_temp.v(p text) returns uuid language sql as $$ select current_setting('test.' || p)::uuid $$;
create function pg_temp.queued_push() returns integer language sql security definer as $$ select count(*)::integer from pgmq.q_notification_push $$;
create function pg_temp.can_report(p_type public.report_target, p_id uuid) returns boolean language sql security definer as $$ select private.can_report(p_type, p_id) $$;
grant execute on all functions in schema pg_temp to authenticated;

-- Two universities of the test's own, so data left by other runs (E2E at NUTECH) never changes a count here.
insert into public.universities (id, name, city, slug) values
  ('99180000-0000-0000-0000-0000000000a0', 'Community Test University', 'Islamabad', 'community-test-university'),
  ('99180000-0000-0000-0000-0000000000a1', 'Community Other University', 'Lahore', 'community-other-university');
insert into public.university_domains (university_id, domain, kind) values
  ('99180000-0000-0000-0000-0000000000a0', 'community-test.edu.pk', 'both'),
  ('99180000-0000-0000-0000-0000000000a1', 'community-other.edu.pk', 'both');
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at)
select pg_temp.u(x.k), x.e, jsonb_build_object('full_name', x.n), now()
  from (values ('A', 'ca@community-test.edu.pk', 'Ali Ahmed'), ('B', 'cb@community-test.edu.pk', 'Hira Batool'), ('C', 'cc@community-test.edu.pk', 'Sara Co'),
               ('D', 'cd@community-test.edu.pk', 'Daniyal Dee'), ('E', 'ce@community-test.edu.pk', 'Esha Ee'), ('F', 'cf@community-test.edu.pk', 'Faiz Ef'),
               ('G', 'cg@community-test.edu.pk', 'Gul Gee'), ('H', 'ch@community-test.edu.pk', 'Hamza Junior'), ('X', 'cx@community-other.edu.pk', 'Xara Elsewhere'),
               ('M', 'cm@community-test.edu.pk', 'Mod Erator')) as x(k, e, n);
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at)
select pg_temp.u('V' || i), 'cv' || i || '@community-test.edu.pk', jsonb_build_object('full_name', 'Voter ' || i), now() from generate_series(1, 6) i;
update public.profiles set onboarding_complete = true, username = 'c18_' || right(user_id::text, 2), department = 'Computer Science', graduation_year = 2027
 where user_id::text like '99180000-%';
update public.profiles set graduation_year = 2028 where user_id = pg_temp.u('H');
insert into public.staff_roles (user_id, role, granted_by) values (pg_temp.u('M'), 'moderator', pg_temp.u('M'));
insert into public.friendships (user_id_a, user_id_b) values (least(pg_temp.u('A'), pg_temp.u('B')), greatest(pg_temp.u('A'), pg_temp.u('B')));
insert into public.friendships (user_id_a, user_id_b) values (least(pg_temp.u('B'), pg_temp.u('F')), greatest(pg_temp.u('B'), pg_temp.u('F')));

-- A verified society at NUTECH with A and C, plus X (another university) as a member.
select pg_temp.keep('soc', gen_random_uuid());
insert into public.societies (id, university_id, slug, name, name_key, category, about, status, verified_at)
select pg_temp.v('soc'), p.university_id, 'c18-cs-society', 'C18 CS Society', 'c18 cs society', 'technology',
       'A society for computing students at the university.', 'verified', now()
  from public.profiles p where p.user_id = pg_temp.u('A');
insert into public.society_members (society_id, user_id, role) values
  (pg_temp.v('soc'), pg_temp.u('A'), 'president'), (pg_temp.v('soc'), pg_temp.u('C'), 'member'), (pg_temp.v('soc'), pg_temp.u('X'), 'member');

-- ===========================================================================
-- Openings
-- ===========================================================================
select pg_temp.as_user('A');
select is((select jsonb_array_length(public.openings_overview() -> 'cards')), 7, 'portals off: seven cards in one call');
select ok(not exists (select 1 from jsonb_array_elements(public.openings_overview() -> 'cards') c where c ->> 'category' in ('jobs', 'contact_requests', 'applications', 'job_fairs', 'competitions')),
          'no jobs, contact requests, applications, fairs or competitions card while the portals are off');
select throws_ok($$ select public.openings('jobs', 'newest', false, null, 0) $$, '22023', 'unknown category', 'a portal category refuses while its portal is off');
select is((select (c ->> 'count')::integer from jsonb_array_elements(public.openings_overview() -> 'cards') c where c ->> 'category' = 'inductions'), 0,
          'inductions: empty');
select ok(public.nav_badges() ? 'openings' and not public.nav_badges() ? 'opportunities', 'the nav badge key is openings');
reset role;

select pg_temp.keep('round', gen_random_uuid());
insert into public.induction_rounds (id, society_id, title, deadline, status, published_at)
values (pg_temp.v('round'), pg_temp.v('soc'), 'Design team intake', now() + interval '10 days', 'open', now());
insert into public.induction_roles (round_id, title, seats, skill_ids) values (pg_temp.v('round'), 'Designer', 3, '{figma}');

select pg_temp.as_user('D');
select is((select c -> 'latest' ->> 'title' from jsonb_array_elements(public.openings_overview() -> 'cards') c where c ->> 'category' = 'inductions'),
          'Design team intake', 'the inductions card features its latest opening');
select is((select (c ->> 'new')::boolean from jsonb_array_elements(public.openings_overview() -> 'cards') c where c ->> 'category' = 'inductions'),
          true, 'new since the last visit');
select is((public.nav_badges() ->> 'openings')::integer, 1, 'the nav badge counts the new induction');
select public.mark_openings_seen('inductions');
select public.mark_openings_seen('overview');
select is((select (c ->> 'new')::boolean from jsonb_array_elements(public.openings_overview() -> 'cards') c where c ->> 'category' = 'inductions'),
          false, 'seen: no dot');
select is((public.nav_badges() ->> 'openings')::integer, 0, 'seen: no badge');
select is((public.openings('inductions', 'deadline', false, null, 0) ->> 'total')::integer, 1, 'the category page lists it');
select is((public.openings('inductions', 'deadline', true, null, 0) ->> 'total')::integer, 0, 'matches only: none (no figma skill)');
select is((public.openings('inductions', 'newest', false, 'nothing like this', 0) ->> 'total')::integer, 0, 'search filters');
select throws_ok($$ select public.openings('inductions', 'sponsored', false, null, 0) $$, '22023', null, 'only newest or deadline sorts exist');
select is((select count(*)::integer from public.openings_seen where user_id <> pg_temp.u('D')), 0, 'nobody reads another student''s seen rows');
reset role;
select pg_temp.as_user('X');
select is((select (c ->> 'count')::integer from jsonb_array_elements(public.openings_overview() -> 'cards') c where c ->> 'category' = 'inductions'), 0,
          'inductions are for the society''s university');
reset role;

-- This week: a post three people found informative.
select pg_temp.keep('post', gen_random_uuid());
insert into public.posts (id, author_id, university_id, audience, type, body)
select pg_temp.v('post'), pg_temp.u('B'), p.university_id, 'university', 'general', 'How we set up CI for our FYP in an afternoon'
  from public.profiles p where p.user_id = pg_temp.u('B');
insert into public.post_survey_counts (post_id, dimension, assigned, ticks) values (pg_temp.v('post'), 'informative', 3, 3)
on conflict (post_id, dimension) do update set ticks = 3;
select ok(private.build_openings_weekly() >= 1, 'This week builds for universities with students');
select pg_temp.as_user('D');
select is((select (x ->> 'informative')::integer from jsonb_array_elements(public.openings_this_week() -> 'posts') x where (x ->> 'id')::uuid = pg_temp.v('post')),
          3, 'This week lists the informative post (the micro-survey line, never a like count)');
reset role;
select pg_temp.as_user('X');
select is(jsonb_array_length(public.openings_this_week() -> 'posts'), 0, 'another university''s week is its own');
select is((select count(*)::integer from public.openings_weekly where university_id = '99180000-0000-0000-0000-0000000000a0'), 0,
          'and its row isn''t readable directly');
reset role;

-- ===========================================================================
-- Share-to-chat
-- ===========================================================================
select pg_temp.as_user('A');
select pg_temp.keep('dm', public.get_or_create_dm('c18_02'));
select pg_temp.keep('shares', (public.share_post(pg_temp.v('post'), array[pg_temp.v('dm')], 'Worth a read'))[1]);
select is((select shared_post_id from public.thread_messages(pg_temp.v('dm')) where id = pg_temp.v('shares')), pg_temp.v('post'), 'the share carries the post');
select throws_ok($$ select public.share_post(current_setting('test.post')::uuid, array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()]) $$,
                 '23514', null, 'up to 5 chats at once');
reset role;
select pg_temp.as_user('D');
select throws_ok($$ select public.share_post(current_setting('test.post')::uuid, array[current_setting('test.dm')::uuid]) $$, '42501', null,
                 'only into chats you''re in');
reset role;
-- The recipient (B) can see the post; once B blocks its author... B is the author here, so use X as a reader.
select pg_temp.as_user('X');
select is((select count(*)::integer from public.post_cards(array[pg_temp.v('post')])), 0,
          'a university post at another university: post_cards returns nothing, so the card shows "isn''t available"');
reset role;
-- Removal hides it from the recipient's card too, and the message keeps saying it was a share.
update public.posts set removed_at = now() where id = pg_temp.v('post');
select pg_temp.as_user('B');
select is((select count(*)::integer from public.post_cards(array[pg_temp.v('post')])), 0, 'a removed post isn''t available');
reset role;
delete from public.posts where id = pg_temp.v('post');
select pg_temp.as_user('B');
select is((select row(shared_post_id, shared)::text from public.thread_messages(pg_temp.v('dm')) where id = pg_temp.v('shares')),
          row(null::uuid, true)::text, 'a deleted post: the share stays as unavailable');
reset role;
select ok(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name in ('posts', 'post_stats') and column_name ~ 'share'),
          'shares are never counted on a post');
-- Undo within 15 seconds.
insert into public.posts (id, author_id, university_id, audience, type, body)
select pg_temp.keep('post2', gen_random_uuid()), pg_temp.u('A'), p.university_id, 'university', 'general', 'Second post'
  from public.profiles p where p.user_id = pg_temp.u('A');
select pg_temp.as_user('A');
select pg_temp.keep('share2', (public.share_post(pg_temp.v('post2'), array[pg_temp.v('dm')]))[1]);
select is(public.undo_share(array[pg_temp.v('share2')]), 1, 'Undo takes the share back');
select is((select count(*)::integer from public.thread_messages(pg_temp.v('dm')) where id = pg_temp.v('share2')), 0, 'as if never sent');
reset role;

-- ===========================================================================
-- People you may know
-- ===========================================================================
select pg_temp.as_user('A');
select ok(exists (select 1 from jsonb_array_elements(public.people_you_may_know(30)) x where x ->> 'username' = 'c18_04' and x ->> 'reason' like 'Same batch%'),
          'same department and batch, with its reason');
select ok(exists (select 1 from jsonb_array_elements(public.people_you_may_know(30)) x where x ->> 'username' = 'c18_06' and x ->> 'reason' like '%1 mutual friend%'),
          'mutual friends');
select ok(exists (select 1 from jsonb_array_elements(public.people_you_may_know(30)) x where x ->> 'username' = 'c18_09' and x ->> 'reason' = 'In C18 CS Society with you'),
          'another university only through a shared society');
select ok(not exists (select 1 from jsonb_array_elements(public.people_you_may_know(30)) x where x ->> 'username' = 'c18_02'), 'friends aren''t suggested');
select public.dismiss_suggestion('c18_04');
select ok(not exists (select 1 from jsonb_array_elements(public.people_you_may_know(30)) x where x ->> 'username' = 'c18_04'), 'a dismissed person never returns');
reset role;
insert into public.blocks (blocker_id, blocked_id) values (pg_temp.u('E'), pg_temp.u('A'));
select pg_temp.as_user('A');
select ok(not exists (select 1 from jsonb_array_elements(public.people_you_may_know(30)) x where x ->> 'username' = 'c18_05'), 'blocks are respected');
select is((select count(*)::integer from public.pymk_dismissals where user_id <> pg_temp.u('A')), 0, 'dismissals are private');
reset role;

-- ===========================================================================
-- Push
-- ===========================================================================
select pg_temp.as_user('D');
select is(public.push_public_key(), null, 'no VAPID key yet: push isn''t offered');
select throws_ok($$ select public.save_push_subscription('https://10.0.0.1/hook', repeat('A', 87), repeat('B', 22)) $$, '22023', null,
                 'only the browsers'' push services');
select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/c18-d', repeat('A', 87), repeat('B', 22), 'Test');
reset role;
select pg_temp.as_user('A');
select is((select count(*)::integer from public.push_subscriptions), 0, 'nobody reads another person''s devices');
reset role;
select pg_temp.as_user('D');
select public.set_push_pref('growth', false);
reset role;
select pg_temp.as_user('A');
select is((select count(*)::integer from public.notification_push_prefs), 0, 'or their push preferences');
select throws_ok($$ insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (auth.uid(), 'https://fcm.googleapis.com/x', repeat('A', 87), repeat('B', 22)) $$,
                 '42501', null, 'subscriptions are written only through save_push_subscription');
reset role;
select pgmq.purge_queue('notification_push');
select private.notify(pg_temp.u('D'), null, 'event_reminder', 'event', gen_random_uuid(), '{"event": "Build with React", "when": "1h"}');
select is(pg_temp.queued_push(), 1, 'the 1-hour reminder is queued as a push');
select pg_temp.as_user('D');
select public.set_push_pref('societies', false);
reset role;
select private.notify(pg_temp.u('D'), null, 'event_reminder', 'event', gen_random_uuid(), '{"event": "Build with React", "when": "1h"}');
select is(pg_temp.queued_push(), 1, 'with the category off, no new push');
select private.notify(pg_temp.u('D'), null, 'endorsement_received', 'venture', gen_random_uuid(), '{}');
select is(pg_temp.queued_push(), 1, 'types that aren''t pushed never queue');
select pg_temp.as_user('D');
select throws_ok($$ select public.set_push_pref('billing', true) $$, 'P0002', null, 'categories that aren''t pushed have no switch');
select public.delete_push_subscription(null);
select is((public.my_push_settings() ->> 'devices')::integer, 0, 'turning push off removes the device');
reset role;

select * from finish();
rollback;
