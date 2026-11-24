-- The yearbook (PRD 5.33) was removed on 2026-11-23 (20261124000000_remove_yearbook.sql): its tables,
-- functions, jobs, bucket, notifications and config are gone; reports and appeals run on the versions
-- the yearbook had wrapped, with the same grants; people you may know still matches departments.
begin;
select plan(16);

-- ---------------------------------------------------------------------------
-- Gone
-- ---------------------------------------------------------------------------
select is((select count(*)::integer from pg_class c where c.relnamespace = 'public'::regnamespace
            and c.relname in ('yearbooks', 'yearbook_pages', 'yearbook_notes', 'yearbook_votes', 'yearbook_awards')),
          0, 'the yearbook tables are gone');
select is((select count(*)::integer from pg_proc p where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
            and (p.proname ~ 'yearbook' or p.proname = 'set_superlatives_opt_out')),
          0, 'every yearbook function and public wrapper is gone');
select is((select count(*)::integer from pg_proc p where p.pronamespace = 'private'::regnamespace and p.proname ~ '_v17$'),
          0, 'no *_v17 function is left behind');
select hasnt_column('public', 'profiles', 'yearbook_superlatives_opt_out', 'the superlatives opt-out column is gone');
select is((select count(*)::integer from cron.job where jobname in ('yearbook-open', 'yearbook-reveal', 'yearbook-freeze')), 0, 'its jobs are gone');
select is((select count(*)::integer from storage.buckets where id = 'yearbook-photos'), 0, 'its bucket is gone');
select is((select count(*)::integer from pg_policies where policyname ~ 'yearbook'), 0, 'and every yearbook policy');
select is((select count(*)::integer from public.notification_types where category = 'yearbook')
          + (select count(*)::integer from public.notification_categories where category = 'yearbook'), 0,
          'its notification types and category are gone');
select is((select count(*)::integer from public.platform_config where key like 'yearbook.%')
          + (select count(*)::integer from public.config_keys where key like 'yearbook.%'), 0, 'and its config');

-- ---------------------------------------------------------------------------
-- Reports and appeals
-- ---------------------------------------------------------------------------
select ok(has_function_privilege('authenticated', 'private.can_report(public.report_target, uuid)', 'execute'),
          'authenticated can still execute can_report');
select ok(has_function_privilege('authenticated', 'private.resolve_case(uuid, text, text, text)', 'execute'),
          'and resolve_case');
select ok(not has_function_privilege('anon', 'private.can_report(public.report_target, uuid)', 'execute'), 'anon can''t');

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('64000000-0000-0000-0000-000000000001', 'ry1@nutech.edu.pk', '{"full_name": "Rida One"}', now()),
  ('64000000-0000-0000-0000-000000000002', 'ry2@nutech.edu.pk', '{"full_name": "Rida Two"}', now()),
  ('64000000-0000-0000-0000-000000000003', 'ry3@nutech.edu.pk', '{"full_name": "Rida Three"}', now());
update public.profiles set onboarding_complete = true, username = 'ry64_' || right(user_id::text, 1), graduation_year = 2027,
       department = case right(user_id::text, 1) when '1' then 'Computer Science' when '2' then '  computer science ' else 'Physics' end
 where user_id::text like '64000000-%';

select set_config('request.jwt.claims', '{"sub": "64000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
set local role authenticated;
select is(private.can_report('yearbook_page', gen_random_uuid()), false, 'can_report refuses a yearbook page');
select is(private.can_report('yearbook_note', gen_random_uuid()), false, 'and a yearbook note');

-- ---------------------------------------------------------------------------
-- People you may know: department_key matches departments loosely, as before
-- ---------------------------------------------------------------------------
select ok(exists (select 1 from jsonb_array_elements(public.people_you_may_know(30)) x
                   where x ->> 'username' = 'ry64_2' and x ->> 'reason' like 'Same batch%'),
          'same department (case and spaces aside) and batch is still suggested');
select ok(not exists (select 1 from jsonb_array_elements(public.people_you_may_know(30)) x
                       where x ->> 'username' = 'ry64_3' and x ->> 'reason' like 'Same batch%'),
          'another department isn''t "Same batch"');
reset role;

select * from finish();
rollback;
