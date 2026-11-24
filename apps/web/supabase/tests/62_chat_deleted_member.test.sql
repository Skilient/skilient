-- Chat with a deleted member (2026-11-15): when the other person in a DM deletes their account the
-- thread stays for the one who is left, and my_threads() still gives it a title (it used to be
-- null, which crashed /chat).
begin;
select plan(4);

insert into auth.users (id, email) values
  ('62000000-0000-0000-0000-00000000000a', 'a62@nutech.edu.pk'),
  ('62000000-0000-0000-0000-00000000000b', 'b62@nutech.edu.pk');
update public.profiles set onboarding_complete = true, username = 'dm62_' || right(user_id::text, 1),
       full_name = 'Student ' || upper(right(user_id::text, 1))
 where user_id::text like '62000000-%';

create function pg_temp.uid(p_id text) returns uuid language sql as $$ select ('62000000-0000-0000-0000-00000000000' || p_id)::uuid $$;
create function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(p_id), 'role', 'authenticated')::text, true);
end;
$$;
grant execute on all functions in schema pg_temp to authenticated;

insert into public.friendships (user_id_a, user_id_b) values (pg_temp.uid('a'), pg_temp.uid('b'));

set local role authenticated;
select pg_temp.as_user('a');
select set_config('test.dm', public.get_or_create_dm('dm62_b')::text, false);
select public.send_message(current_setting('test.dm')::uuid, 'hello');
select is((select title from public.my_threads()), 'Student B', 'the DM is titled with the other person''s name');

reset role;
delete from auth.users where id = pg_temp.uid('b');
set local role authenticated;
select pg_temp.as_user('a');

select is((select count(*)::integer from public.my_threads()), 1, 'the thread stays for the member who is left');
select is((select title from public.my_threads()), 'Deleted account', 'and its title is never null');
select is((select count(*)::integer from public.thread_people(current_setting('test.dm')::uuid)), 1, 'only the caller is left in it');

select * from finish();
rollback;
