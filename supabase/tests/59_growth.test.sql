-- Phase 17 (PRD 5.32): paths, proof tasks and the skill swap.
-- S a student, R and R2 eligible reviewers, F S's friend (eligible except for the friendship),
-- K another student (swap teacher), X a student at another university, T a trust reviewer,
-- Q1..Q10 seniors for the data path.
begin;
select * from no_plan();

create function pg_temp.u(p text) returns uuid language sql immutable as $$
  select ('99170000-0000-0000-0000-0000000000' || case p when 'S' then '01' when 'R' then '02' when 'R2' then '03' when 'F' then '04'
    when 'K' then '05' when 'X' then '06' when 'T' then '07' when 'M' then '08'
    else lpad((10 + substr(p, 2)::integer)::text, 2, '0') end)::uuid;
$$;
create function pg_temp.as_user(p text, p_aal text default 'aal2') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(p), 'role', 'authenticated', 'aal', p_aal)::text, true);
  set local role authenticated;
end;
$$;
create function pg_temp.keep(p text, p_value uuid) returns uuid language sql as $$ select set_config('test.' || p, p_value::text, false)::uuid $$;
create function pg_temp.v(p text) returns uuid language sql as $$ select current_setting('test.' || p)::uuid $$;
create function pg_temp.sha(p text) returns text language sql as $$ select encode(extensions.digest(p, 'sha1'), 'hex') $$;
create function pg_temp.attempt(p_id uuid) returns public.task_attempts language sql security definer as $$ select * from public.task_attempts where id = p_id $$;
create function pg_temp.review_of(p_attempt uuid, p_user text) returns uuid language sql security definer as $$
  select id from public.task_reviews where attempt_id = p_attempt and reviewer_id = pg_temp.u(p_user)
$$;
create function pg_temp.task(p_skill text) returns uuid language sql security definer as $$
  select id from public.proof_tasks where skill_id = p_skill and active order by created_at, title limit 1
$$;
create function pg_temp.can_report(p_type public.report_target, p_id uuid) returns boolean language sql security definer as $$ select private.can_report(p_type, p_id) $$;
grant execute on all functions in schema pg_temp to authenticated, anon;

insert into public.universities (id, name, city, slug)
values ('99170000-0000-0000-0000-0000000000a1', 'Growth Other University', 'Lahore', 'growth-other-university');
insert into public.university_domains (university_id, domain, kind) values ('99170000-0000-0000-0000-0000000000a1', 'growth-other.edu.pk', 'both');
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at)
select pg_temp.u(x.k), x.e, jsonb_build_object('full_name', x.n), now()
  from (values ('S', 'gs@nutech.edu.pk', 'Hira Student'), ('R', 'gr@nutech.edu.pk', 'Rehan Reviewer'),
               ('R2', 'gr2@nutech.edu.pk', 'Rabia Reviewer'), ('F', 'gf@nutech.edu.pk', 'Faraz Friend'),
               ('K', 'gk@nutech.edu.pk', 'Ayesha Teacher'), ('X', 'gx@growth-other.edu.pk', 'Xara Elsewhere'),
               ('T', 'gt@nutech.edu.pk', 'Tariq Trust'), ('M', 'gm@nutech.edu.pk', 'Maha Third')) as x(k, e, n);
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at)
select pg_temp.u('Q' || i), 'gq' || i || '@nutech.edu.pk', jsonb_build_object('full_name', 'Senior ' || i), now()
  from generate_series(1, 10) i;
update public.profiles set onboarding_complete = true, username = 'g17_' || right(user_id::text, 2), department = 'Computer Science'
 where user_id::text like '99170000-%';
insert into public.staff_roles (user_id, role, granted_by) values (pg_temp.u('T'), 'trust_reviewer', pg_temp.u('T'));

-- ---------------------------------------------------------------------------
-- Paths
-- ---------------------------------------------------------------------------
select is((select count(*)::integer from public.paths), 8, '8 roles at launch');
select pg_temp.as_user('S');
select is((public.path_view('data')) ->> 'source', 'starter', 'with no seniors a path shows the starter path');
select is((select array_agg(e ->> 'skill_id' order by (e ->> 'position')::integer) from jsonb_array_elements(public.path_view('data') -> 'steps') e),
          array['python', 'sql', 'pandas', 'numpy', 'jupyter', 'matplotlib', 'seaborn', 'scipy', 'plotly', 'postgresql'],
          'in the order paths.seed gives');
reset role;

-- Seniors: Shine, 6 of Data's 10 skills at L2, SQL first, then Python 30 days later, then pandas.
insert into public.ranking_scores (user_id, formula_version, components, proof, momentum, adjustments, total, ranked, tier, computed_at, published_at)
select pg_temp.u('Q' || i), 2, '{}', 0, 0, 0, 500, true, 'shine', now(), now() from generate_series(1, 10) i;
insert into public.user_skills (user_id, skill_id, level, l2_at)
select pg_temp.u('Q' || i), x.skill, 2, now() - interval '400 days' + make_interval(days => x.d)
  from generate_series(1, 9) i,
       (values ('sql', 0), ('python', 30), ('pandas', 60), ('numpy', 90), ('jupyter', 120), ('plotly', 150)) as x(skill, d);
select is(private.compute_paths() >= 0, true, 'compute runs');
select is((select source from public.paths where role = 'data'), 'starter', '9 seniors: still the starter path');
insert into public.user_skills (user_id, skill_id, level, l2_at)
select pg_temp.u('Q10'), x.skill, 2, now() - interval '200 days' + make_interval(days => x.d)
  from (values ('sql', 0), ('python', 30), ('pandas', 60), ('numpy', 90), ('jupyter', 120), ('plotly', 150)) as x(skill, d);
select private.compute_paths();
select is((select source from public.paths where role = 'data'), 'data', 'the 10th senior switches the path to the data order');
select is((select seniors from public.paths where role = 'data'), 10, 'based on 10 seniors');
select is((select array_agg(skill_id order by position) from public.path_skills where role = 'data' and position <= 3),
          array['sql', 'python', 'pandas'], 'ordered by the median first L2');
select is((select after_days from public.path_skills where role = 'data' and skill_id = 'python'), 30, 'Python: median 30 days after SQL');
select is((select source from public.paths where role = 'frontend'), 'starter', 'other roles stay on the starter path');

-- A student's squares: SQL proved → Python next.
insert into public.user_skills (user_id, skill_id, level) values (pg_temp.u('S'), 'sql', 2);
select pg_temp.as_user('S');
select is((select e ->> 'state' from jsonb_array_elements(public.path_view('data') -> 'steps') e where e ->> 'skill_id' = 'sql'), 'proved', 'L2 proves a square');
select is(public.path_view('data') -> 'next' ->> 'skill_id', 'python', 'and the next square lights');
select lives_ok($$ select public.follow_path('data', true) $$, 'follow a path');
select lives_ok($$ select public.follow_path('frontend', true) $$, 'and a second');
select throws_ok($$ select public.follow_path('backend', true) $$, '23514', null, 'not a third');
select is(public.next_best_action() ->> 'key', 'path_next', 'the progress card points at the next square');
select throws_ok($$ insert into public.path_follows (user_id, role) values (auth.uid(), 'devops') $$, '42501', null, 'no direct writes to follows');
reset role;
select pg_temp.as_user('R');
select is_empty($$ select 1 from public.path_follows $$, 'others'' follows are unreadable');
reset role;

-- ---------------------------------------------------------------------------
-- Proof tasks
-- ---------------------------------------------------------------------------
insert into public.github_accounts (user_id, github_id, login) values (pg_temp.u('S'), 917001, 'hira'), (pg_temp.u('R'), 917002, 'rehan');
insert into public.github_installations (installation_id, account_id, account_login, account_type) values
  (917001, 917001, 'hira', 'User'), (917002, 917002, 'rehan', 'User');
insert into public.github_repos (repo_id, full_name, owner_id, private, default_branch) values
  (917101, 'hira/api', 917001, false, 'main'), (917102, 'rehan/site', 917002, false, 'main');
insert into public.github_user_repos (user_id, repo_id, installation_id, kind) values
  (pg_temp.u('S'), 917101, 917001, 'owned'), (pg_temp.u('R'), 917102, 917002, 'owned');
-- Reviewers: R, R2 and F hold TypeScript at L2; F is S's friend.
insert into public.user_skills (user_id, skill_id, level) values
  (pg_temp.u('R'), 'typescript', 2), (pg_temp.u('R2'), 'typescript', 3), (pg_temp.u('F'), 'typescript', 2), (pg_temp.u('M'), 'typescript', 2);
insert into public.friendships (user_id_a, user_id_b) values (least(pg_temp.u('S'), pg_temp.u('F')), greatest(pg_temp.u('S'), pg_temp.u('F')));

select pg_temp.as_user('S');
select pg_temp.keep('a1', public.start_task(pg_temp.task('typescript')));
select is((pg_temp.attempt(pg_temp.v('a1'))).status, 'started', 'a task starts');
select throws_ok($$ select public.submit_task(pg_temp.v('a1')) $$, '55000', 'link a repository first', 'submitting needs a repository');
select throws_ok($$ select public.link_task_repo(pg_temp.v('a1'), 917102) $$, '22023', null, 'never someone else''s repository');
select lives_ok($$ select public.link_task_repo(pg_temp.v('a1'), 917101) $$, 'link one of mine');
select is(public.submit_task(pg_temp.v('a1')), 'verifying', 'submitted: GitHub first');
reset role;
-- The rescan finds a counted commit since the start that shows TypeScript.
select private.record_commit(pg_temp.u('S'), 917101, jsonb_build_object(
  'sha', pg_temp.sha('t1'), 'committed_at', now(), 'authored_at', now(), 'seen_via', 'harvest', 'meaningful_lines', 40,
  'detections', '[{"skill": "typescript", "kind": "lines", "path": "src/api.ts", "lines": 40}]'::jsonb, 'blobs', '[]'::jsonb));
select is(private.task_github_check(pg_temp.u('S')), 1, 'the worker''s check completes it');
select is((pg_temp.attempt(pg_temp.v('a1'))).verified_by, 'github', 'proved by GitHub, without a peer');
select is((select count(*)::integer from public.task_reviews where attempt_id = pg_temp.v('a1')), 0, 'no peer was asked');
select is((select kind || '/' || issuer_name || '/' || status from public.record_entries where source_id = pg_temp.v('a1')),
          'proof_task/Skilient/pending', 'a Skilient Proof task entry waits for its seal');
-- (Inside one transaction now() never moves: date that commit before the next tasks start.)
update public.skill_evidence set occurred_at = now() - interval '1 day' where user_id = pg_temp.u('S');
select pg_temp.as_user('S');
select is((select count(*)::integer from public.my_skill_proofs('typescript') where kind = 'proof_task'), 1, 'evidence of kind proof_task');
select throws_ok($$ select public.start_task(pg_temp.task('typescript')) $$, '55000', null, 'a done task isn''t started again');

-- Peer route: a task with no commits.
select pg_temp.keep('a2', public.start_task((select id from public.proof_tasks where skill_id = 'typescript' order by title desc limit 1)));
select public.link_task_repo(pg_temp.v('a2'), 917101);
select public.submit_task(pg_temp.v('a2'));
reset role;
update public.task_attempts set submitted_at = now() - interval '2 hours' where id = pg_temp.v('a2');
select private.proof_tasks_tick();
select is((pg_temp.attempt(pg_temp.v('a2'))).status, 'awaiting_peer', 'GitHub had its time: peers are asked');
select is((select count(*)::integer from public.task_reviews where attempt_id = pg_temp.v('a2')), 3, '3 eligible peers (R, R2, M)');
select is(pg_temp.review_of(pg_temp.v('a2'), 'F'), null, 'never a friend');
select is((select count(*)::integer from public.notifications where type = 'task_review_offer'), 3, 'each is notified');
-- Even with an offer forced in, a friend can't review.
insert into public.task_reviews (attempt_id, reviewer_id, round) values (pg_temp.v('a2'), pg_temp.u('F'), 1);
select pg_temp.as_user('F');
select throws_ok($$ select public.accept_task_review(pg_temp.review_of(pg_temp.v('a2'), 'F')) $$, '42501', null, 'a peer can''t review a friend''s task');
reset role;
select pg_temp.as_user('M');
select lives_ok($$ select public.decline_task_review(pg_temp.review_of(pg_temp.v('a2'), 'M')) $$, 'a peer may decline');
reset role;
select pg_temp.as_user('R');
select lives_ok($$ select public.accept_task_review(pg_temp.review_of(pg_temp.v('a2'), 'R')) $$, 'the first to accept reviews');
select is((pg_temp.attempt(pg_temp.v('a2'))).status, 'in_review', 'in review');
select throws_ok($$ select public.review_task(pg_temp.review_of(pg_temp.v('a2'), 'R'), false, '', '[true, false, true, true]') $$,
  '22023', null, 'needs changes needs a note');
select throws_ok($$ select public.review_task(pg_temp.review_of(pg_temp.v('a2'), 'R'), true, null, '[true, false, true, true]') $$,
  '22023', null, 'confirm only when every item is met');
select lives_ok($$ select public.review_task(pg_temp.review_of(pg_temp.v('a2'), 'R'), false, 'Add a README with how to run it.', '[true, true, true, false]') $$,
  'needs changes with a note');
reset role;
select is((pg_temp.attempt(pg_temp.v('a2'))).status, 'needs_changes', 'the task goes back to the student');
select pg_temp.as_user('R2');
select throws_ok($$ select public.accept_task_review(pg_temp.review_of(pg_temp.v('a2'), 'R2')) $$, '55000', null, 'other offers in the round close');
reset role;
-- Resubmitted, then 3 more peers after GitHub's time; only R2 was never asked... except R2 was: nobody new.
select pg_temp.as_user('S');
select public.submit_task(pg_temp.v('a2'));
reset role;
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at)
values ('99170000-0000-0000-0000-0000000000f1', 'gnew@nutech.edu.pk', '{"full_name":"Nadia New"}', now());
update public.profiles set onboarding_complete = true, username = 'g17_new' where user_id = '99170000-0000-0000-0000-0000000000f1';
insert into public.user_skills (user_id, skill_id, level) values ('99170000-0000-0000-0000-0000000000f1', 'typescript', 2);
update public.task_attempts set submitted_at = now() - interval '2 hours' where id = pg_temp.v('a2');
select private.proof_tasks_tick();
select is((select array_agg(reviewer_id) from public.task_reviews where attempt_id = pg_temp.v('a2') and round = 2),
          array['99170000-0000-0000-0000-0000000000f1'::uuid], 'a peer is never asked twice for the same task');
select set_config('request.jwt.claims', json_build_object('sub', '99170000-0000-0000-0000-0000000000f1', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.accept_task_review((select id from public.task_reviews where attempt_id = pg_temp.v('a2') and round = 2));
select lives_ok($$ select public.review_task((select id from public.task_reviews where attempt_id = pg_temp.v('a2') and round = 2), true, null, '[true, true, true, true]') $$,
  'a second peer confirms');
reset role;
select is((pg_temp.attempt(pg_temp.v('a2'))).verified_by, 'peer', 'done by a peer');
-- Nobody reviewed in 7 days: 3 more peers.
select pg_temp.as_user('S');
select pg_temp.keep('a3', public.start_task(pg_temp.task('react')));
select public.link_task_repo(pg_temp.v('a3'), 917101);
select public.submit_task(pg_temp.v('a3'));
reset role;
insert into public.user_skills (user_id, skill_id, level) values (pg_temp.u('R'), 'react', 2);
update public.task_attempts set submitted_at = now() - interval '2 hours' where id = pg_temp.v('a3');
select private.proof_tasks_tick();
update public.task_attempts set offered_at = now() - interval '8 days' where id = pg_temp.v('a3');
insert into public.user_skills (user_id, skill_id, level) values (pg_temp.u('R2'), 'react', 2);
select private.proof_tasks_tick();
select is((select round from public.task_attempts where id = pg_temp.v('a3')), 2::smallint, 'after 7 days the next round goes out');
select is((select status from public.task_reviews where attempt_id = pg_temp.v('a3') and reviewer_id = pg_temp.u('R')), 'expired', 'the old offer expires');
-- Reviewer cap: 5 a week.
update public.task_reviews set status = 'confirmed', responded_at = now() where reviewer_id = pg_temp.u('R2') and attempt_id = pg_temp.v('a3');
insert into public.task_reviews (attempt_id, reviewer_id, round, status, responded_at)
select pg_temp.v('a1'), pg_temp.u('R2'), 1, 'confirmed', now();
insert into public.task_reviews (attempt_id, reviewer_id, round, status, responded_at)
select pg_temp.v('a2'), pg_temp.u('M'), 1, 'confirmed', now() on conflict do nothing;
select is(private.task_peer_ok(pg_temp.u('R2'), pg_temp.u('X'), 'typescript'), true, 'R2 under the weekly cap');
insert into public.task_attempts (id, user_id, task_id, skill_id, status, submitted_at)
select gen_random_uuid(), pg_temp.u('Q' || i), pg_temp.task('typescript'), 'typescript', 'verifying', now() from generate_series(1, 3) i;
insert into public.task_reviews (attempt_id, reviewer_id, round, status, responded_at)
select a.id, pg_temp.u('R2'), 1, 'confirmed', now() from public.task_attempts a where a.user_id::text like '99170000-0000-0000-0000-00000000001%' and a.status = 'verifying';
select is(private.task_peer_ok(pg_temp.u('R2'), pg_temp.u('X'), 'typescript'), false, 'at 5 reviews this week a peer is not asked');
-- Active limit.
select pg_temp.as_user('S');
select public.start_task(pg_temp.task('sql'));
select public.start_task(pg_temp.task('javascript'));
select throws_ok($$ select public.start_task(pg_temp.task('python')) $$, '23514', null, 'at most 3 active tasks');
-- Cross-user reads and writes.
select throws_ok($$ insert into public.task_attempts (user_id, task_id, skill_id) values (auth.uid(), pg_temp.task('css'), 'css') $$, '42501', null, 'no direct inserts');
select throws_ok($$ update public.task_attempts set status = 'done' $$, '42501', null, 'no direct updates');
select throws_ok($$ insert into public.proof_tasks (skill_id, title, difficulty, brief, checklist) values ('css', 'Mine', 'core', repeat('x', 50), '["a","b","c"]') $$,
  '42501', null, 'students don''t write the bank');
reset role;
select pg_temp.as_user('R');
select is_empty($$ select 1 from public.task_attempts where user_id = pg_temp.u('S') $$, 'others'' attempts are unreadable');
select throws_ok($$ select public.my_task(pg_temp.v('a1')) $$, 'P0002', null, 'and so is their task page');
select throws_ok($$ select public.link_task_repo(pg_temp.v('a3'), 917102) $$, 'P0002', null, 'nor can a peer link a repository');
select throws_ok($$ update public.task_reviews set status = 'confirmed' $$, '42501', null, 'no direct review writes');
reset role;
select pg_temp.as_user('S');
select is_empty($$ select 1 from public.task_reviews $$, 'the student can''t read reviewers'' rows');
select throws_ok($$ select public.ops_save_proof_task(null, '{"skill_id":"css"}', 'no') $$, '42501', null, 'the bank is staff-only');
reset role;
select pg_temp.as_user('T');
select lives_ok($$ select public.ops_save_proof_task(null, jsonb_build_object('skill_id', 'css', 'title', 'Dark mode with custom properties',
  'difficulty', 'core', 'brief', 'Add a dark theme to a page using CSS custom properties and prefers-color-scheme.',
  'checklist', jsonb_build_array('Colours come from custom properties', 'Dark mode follows the system setting', 'Contrast stays at 4.5:1')), 'New task for CSS') $$,
  'a trust reviewer adds a task');
select is((select count(*)::integer from public.ops_audit_log where action = 'proof_task.add' and before = '{}'::jsonb and after ? 'title'), 1,
  'audited with before and after');
reset role;

-- ---------------------------------------------------------------------------
-- Skill swap
-- ---------------------------------------------------------------------------
insert into public.user_skills (user_id, skill_id, level) values (pg_temp.u('K'), 'react', 3), (pg_temp.u('X'), 'react', 2)
  on conflict (user_id, skill_id) do update set level = excluded.level;
select pg_temp.as_user('K');
select throws_ok($$ select public.save_swap_offer('rust', null, true) $$, '42501', null, 'offers need L2');
select lives_ok($$ select public.save_swap_offer('react', 'Hooks and state', true) $$, 'offer React');
reset role;
select pg_temp.as_user('X');
select public.save_swap_offer('react', null, true);
reset role;
select pg_temp.as_user('S');
select lives_ok($$ select public.save_swap_want('react', null, true) $$, 'want React');
select is((select jsonb_agg(t ->> 'username') from jsonb_array_elements(public.swap_teachers('react')) t), '["g17_05"]'::jsonb,
  'matches are teachers at the same university');
select throws_ok($$ select public.request_swap('g17_06', 'react', 'Please', null) $$, '42501', null, 'never another university');
select pg_temp.keep('sw', public.request_swap('g17_05', 'react', 'I want to learn hooks', 'Evenings', 'sql'));
select throws_ok($$ select public.request_swap('g17_05', 'react', 'Again', null) $$, '23505', null, 'one open swap per pair per skill');
select throws_ok($$ select public.get_or_create_dm('g17_05') $$, '42501', null, 'no DM before the swap is accepted');
reset role;
select pg_temp.as_user('M');
select is_empty($$ select 1 from public.swaps $$, 'a third person can''t read the swap');
select throws_ok($$ select public.respond_swap(pg_temp.v('sw'), true) $$, 'P0002', null, 'nor answer it');
select throws_ok($$ insert into public.swaps (teacher_id, learner_id, skill_id, expires_at) values (pg_temp.u('K'), auth.uid(), 'react', now()) $$,
  '42501', null, 'no direct swap writes');
select is(pg_temp.can_report('swap', pg_temp.v('sw')), false, 'nor report it');
reset role;
select pg_temp.as_user('K');
select lives_ok($$ select public.respond_swap(pg_temp.v('sw'), true) $$, 'the teacher accepts');
reset role;
select is((select status from public.swaps where id = pg_temp.v('sw')), 'accepted', 'accepted');
select isnt((select thread_id from public.swaps where id = pg_temp.v('sw')), null, 'a DM opens');
select is((select count(*)::integer from public.swaps where mutual_of = pg_temp.v('sw') and teacher_id = pg_temp.u('S') and skill_id = 'sql'), 1,
  'the skill offered back makes a mutual swap');
select pg_temp.as_user('S');
select lives_ok($$ select public.get_or_create_dm('g17_05') $$, 'the learner can message the teacher');
select is(pg_temp.can_report('swap', pg_temp.v('sw')), true, 'either side can report it');
select pg_temp.keep('x1', public.propose_swap_session(pg_temp.v('sw'), now() + interval '2 days', 90, 'Library, room 2'));
select throws_ok($$ select public.respond_swap_session(pg_temp.v('x1'), true) $$, '42501', null, 'the other side accepts');
reset role;
select pg_temp.as_user('K');
select public.respond_swap_session(pg_temp.v('x1'), true);
reset role;
update public.swap_sessions set starts_at = now() - interval '3 hours' where id = pg_temp.v('x1');
select private.swap_tick();
select is((select count(*)::integer from public.notifications where type = 'swap_session_ask' and user_id = pg_temp.u('S')), 1,
  'after the session the learner is asked');
select pg_temp.as_user('K');
select throws_ok($$ select public.confirm_swap_session(pg_temp.v('x1'), true, 90, null, null) $$, '42501', null, 'only the learner confirms');
reset role;
select pg_temp.as_user('S');
select throws_ok($$ select public.confirm_swap_session(pg_temp.v('x1'), true, 300, null, null) $$, '22023', null, 'a session is at most 4 hours');
select lives_ok($$ select public.confirm_swap_session(pg_temp.v('x1'), true, 90, null, 'Thank you, hooks finally make sense!') $$, 'Yes, 90 minutes, with a note');
reset role;
select is((select status from public.swap_notes where session_id = pg_temp.v('x1')), 'pending', 'the note waits for the teacher');
select pg_temp.as_user('M');
select is((public.swap_notes_for(pg_temp.u('K')) -> 'notes'), '[]'::jsonb, 'not on the profile yet');
reset role;
select pg_temp.as_user('K');
select public.decide_swap_note((select id from public.swap_notes where session_id = pg_temp.v('x1')), true);
reset role;
select pg_temp.as_user('M');
select is((public.swap_notes_for(pg_temp.u('K')) -> 'notes' -> 0 ->> 'body'), 'Thank you, hooks finally make sense!', 'approved notes show on the profile');
select is_empty($$ select 1 from public.swap_notes $$, 'the note rows stay private');
reset role;
-- Pair limit: 10 confirmed hours a week.
insert into public.swap_sessions (swap_id, proposed_by, starts_at, minutes, place, status)
select pg_temp.v('sw'), pg_temp.u('S'), now() - interval '2 hours' - make_interval(mins => i), 240, 'Online', 'accepted' from generate_series(1, 3) i;
select pg_temp.as_user('S');
select lives_ok($$ select public.confirm_swap_session((select id from public.swap_sessions where swap_id = pg_temp.v('sw') and status = 'accepted' order by starts_at desc limit 1), true, 240, null, null) $$,
  'a second session (5.5 h so far)');
select lives_ok($$ select public.confirm_swap_session((select id from public.swap_sessions where swap_id = pg_temp.v('sw') and status = 'accepted' order by starts_at desc limit 1), true, 240, null, null) $$,
  'a third (9.5 h)');
select throws_ok($$ select public.confirm_swap_session((select id from public.swap_sessions where swap_id = pg_temp.v('sw') and status = 'accepted' order by starts_at desc limit 1), true, 240, null, null) $$,
  '23514', null, 'not past 10 hours a week for the pair');
reset role;
select is((select count(*)::integer from public.anti_gaming_flags where kind = 'swap_repeat' and members @> array[pg_temp.u('S'), pg_temp.u('K')]), 1,
  '3 confirmations in a day are flagged');
-- One confirmed swap, one Taught entry.
select pg_temp.as_user('K');
select lives_ok($$ select public.end_swap(pg_temp.v('sw')) $$, 'either side ends the swap');
reset role;
select is((select count(*)::integer from public.record_entries where kind = 'taught' and source_id = pg_temp.v('sw')), 1, 'exactly one Taught entry');
select is((select user_id from public.record_entries where kind = 'taught' and source_id = pg_temp.v('sw')), pg_temp.u('K'), 'on the teacher''s Record');
select is((select title || ' · ' || (evidence ->> 'line') from public.record_entries where kind = 'taught' and source_id = pg_temp.v('sw')),
  'Taught React to Hira · 3 sessions · 9.5 h', 'with sessions and hours');
select is((select count(*)::integer from public.record_entries where kind = 'taught' and user_id = pg_temp.u('S')), 0,
  'the mutual side had no confirmed session: no entry for it');
select private.close_swap(pg_temp.v('sw'), 'ended', null);
select is((select count(*)::integer from public.record_entries where kind = 'taught' and source_id = pg_temp.v('sw')), 1, 'closing again never adds another');
-- A block ends a swap.
select pg_temp.as_user('M');
select public.save_swap_want('react', null, true);
select pg_temp.keep('sw2', public.request_swap('g17_05', 'react', null, null));
reset role;
select pg_temp.as_user('K');
select public.respond_swap(pg_temp.v('sw2'), true);
reset role;
insert into public.blocks (blocker_id, blocked_id) values (pg_temp.u('K'), pg_temp.u('M'));
select is((select status || '/' || close_reason from public.swaps where id = pg_temp.v('sw2')), 'closed/blocked', 'blocks end swaps');
-- Request expiry.
select pg_temp.as_user('S');
select public.save_swap_want('typescript', null, true);
reset role;
update public.user_skills set level = 2 where user_id = pg_temp.u('R') and skill_id = 'typescript';
select pg_temp.as_user('R');
select public.save_swap_offer('typescript', null, true);
reset role;
select pg_temp.as_user('S');
select pg_temp.keep('sw3', public.request_swap('g17_02', 'typescript', null, null));
reset role;
update public.swaps set expires_at = now() - interval '1 minute' where id = pg_temp.v('sw3');
select private.swap_tick();
select is((select status from public.swaps where id = pg_temp.v('sw3')), 'expired', 'unanswered requests expire after 7 days');

select * from finish();
rollback;
