-- Removes the yearbook (PRD 5.33, phase 18) from the product (decisions 2026-11-23). Production held no
-- yearbook data when this was written; the guard below stops the deploy rather than delete any.
--
-- Kept: the report_target values 'yearbook_page' and 'yearbook_note' (Postgres can't drop an enum
-- value without rebuilding the type and every function that takes it; can_report refuses them),
-- universities.final_year_batch (graduation uses it), and the department key that people you may
-- know used, now private.department_key.
--
-- The analytics events this feature wrote (tests/unit/analytics.test.ts reads these lines):
-- retired-event: yearbook_signed
-- retired-event: yearbook_voted

-- ---------------------------------------------------------------------------
-- a. Guard: never delete student data
-- ---------------------------------------------------------------------------
do $$
declare
  v_books bigint := (select count(*) from public.yearbooks);
  v_pages bigint := (select count(*) from public.yearbook_pages);
  v_notes bigint := (select count(*) from public.yearbook_notes);
  v_votes bigint := (select count(*) from public.yearbook_votes);
  v_awards bigint := (select count(*) from public.yearbook_awards);
  v_photos bigint := (select count(*) from storage.objects where bucket_id = 'yearbook-photos');
begin
  if v_books + v_pages + v_notes + v_votes + v_awards + v_photos > 0 then
    raise exception 'yearbook data exists: yearbooks %, pages %, notes %, votes %, awards %, photos %; export it before removing the yearbook',
      v_books, v_pages, v_notes, v_votes, v_awards, v_photos;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- b. Jobs
-- ---------------------------------------------------------------------------
select cron.unschedule(jobname) from cron.job where jobname in ('yearbook-open', 'yearbook-reveal', 'yearbook-freeze');

-- ---------------------------------------------------------------------------
-- c. Reports and appeals: the four wrappers give way to the versions they wrapped. Each restored
--    function gets exactly the grants the wrapper had (authenticated where it had them, never public).
-- ---------------------------------------------------------------------------
do $$
declare
  f record;
  v_acl aclitem[];
  v_owner oid;
  g record;
begin
  for f in select * from (values
      ('report_snapshot', 'public.report_target, uuid'),
      ('can_report', 'public.report_target, uuid'),
      ('resolve_case', 'uuid, text, text, text'),
      ('overturn_decision', 'public.appeals, uuid, text')) as x(name, args)
  loop
    if to_regprocedure(format('private.%I_v17(%s)', f.name, f.args)) is null then
      raise exception 'private.%_v17(%) is missing', f.name, f.args;
    end if;
    select p.proacl, p.proowner into v_acl, v_owner from pg_proc p where p.oid = to_regprocedure(format('private.%I(%s)', f.name, f.args));
    v_acl := coalesce(v_acl, acldefault('f', v_owner));
    execute format('drop function private.%I(%s)', f.name, f.args);
    execute format('alter function private.%I(%s) rename to %I', f.name || '_v17', f.args, f.name);
    execute format('revoke all on function private.%I(%s) from public, anon, authenticated, service_role', f.name, f.args);
    for g in select distinct e.grantee from aclexplode(v_acl) e where e.privilege_type = 'EXECUTE' and e.grantee <> v_owner loop
      execute format('grant execute on function private.%I(%s) to %s', f.name, f.args,
                     case when g.grantee = 0 then 'public' else quote_ident((select r.rolname from pg_roles r where r.oid = g.grantee)) end);
    end loop;
  end loop;
end;
$$;

-- Every caller still resolves: the four names exist, and nothing calls a *_v17 name any more.
do $$
declare
  v_bad text;
begin
  if to_regprocedure('private.report_snapshot(public.report_target, uuid)') is null
     or to_regprocedure('private.can_report(public.report_target, uuid)') is null
     or to_regprocedure('private.resolve_case(uuid, text, text, text)') is null
     or to_regprocedure('private.overturn_decision(public.appeals, uuid, text)') is null
     or to_regprocedure('public.resolve_case(uuid, text, text, text)') is null then
    raise exception 'a report or appeal function is missing after the unwind';
  end if;
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_proc p
   where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
     and p.prosrc ~ '(report_snapshot|can_report|resolve_case|overturn_decision)_v17';
  if v_bad is not null then
    raise exception 'still calling a *_v17 function: %', v_bad;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- d. People you may know: the department key gets its own name (same body as before)
-- ---------------------------------------------------------------------------
create function private.department_key(p_department text)
returns text
language sql
immutable
set search_path = ''
as $$ select nullif(lower(btrim(coalesce(p_department, ''))), '') $$;
revoke all on function private.department_key(text) from public;
comment on function private.department_key(text) is
  'Department names compared loosely (trimmed, lower case, empty is none). Used by people_you_may_know.';

-- Same body as 20261114000003_share_reach_push.sql, with department_key; signature and grants unchanged.
create or replace function private.people_you_may_know(p_limit integer default 8)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  me public.profiles;
begin
  select * into me from public.profiles where user_id = v_me;
  return coalesce((
    with friends as (
      select case when f.user_id_a = v_me then f.user_id_b else f.user_id_a end as id
        from public.friendships f where v_me in (f.user_id_a, f.user_id_b)
    ), signals as (
      -- Same department and batch (same university only).
      select p.user_id as id, 3 as score, 'Same batch' as reason, 1 as kind
        from public.profiles p
       where me.university_id is not null and p.university_id = me.university_id
         and private.department_key(p.department) = private.department_key(me.department) and p.graduation_year = me.graduation_year
         and p.user_id <> v_me
      union all
      select p.user_id, 1, 'Same department', 2
        from public.profiles p
       where me.university_id is not null and p.university_id = me.university_id
         and private.department_key(p.department) = private.department_key(me.department)
         and p.graduation_year is distinct from me.graduation_year and p.user_id <> v_me
      union all
      -- Mutual friends (2 points each), same university only.
      select x.id, 2 * count(*)::integer, count(*)::text || case when count(*) = 1 then ' mutual friend' else ' mutual friends' end, 3
        from (select case when f.user_id_a = fr.id then f.user_id_b else f.user_id_a end as id
                from friends fr join public.friendships f on fr.id in (f.user_id_a, f.user_id_b)) x
        join public.profiles p on p.user_id = x.id and p.university_id = me.university_id
       where x.id <> v_me
       group by x.id
      union all
      -- Shared ventures (any university).
      select b.user_id, 4, 'In ' || min(v.title) || ' with you', 4
        from public.venture_members a
        join public.venture_members b on b.venture_id = a.venture_id and b.user_id <> v_me
        join public.ventures v on v.id = a.venture_id
       where a.user_id = v_me
       group by b.user_id
      union all
      -- Shared societies (any university).
      select b.user_id, 3, 'In ' || min(s.name) || ' with you', 5
        from public.society_members a
        join public.society_members b on b.society_id = a.society_id and b.user_id <> v_me
        join public.societies s on s.id = a.society_id
       where a.user_id = v_me
       group by b.user_id
    ), ranked as (
      select s.id, sum(s.score) as score,
             (array_agg(s.reason order by s.score desc, s.kind))[1:2] as reasons,
             bool_or(s.kind in (4, 5)) as shared
        from signals s
       where s.id <> all (select id from friends)
       group by s.id
    )
    select jsonb_agg(jsonb_build_object('username', p.username, 'name', p.full_name, 'avatar_path', p.avatar_path,
                                        'department', p.department, 'graduation_year', p.graduation_year,
                                        'reason', array_to_string(case when 'Same batch' = any (r.reasons) and 'Same department' = any (r.reasons)
                                                                       then array_remove(r.reasons, 'Same department') else r.reasons end, ' · '))
                     order by r.score desc, p.full_name)
      from (select * from ranked order by score desc limit 200) r
      join public.profiles p on p.user_id = r.id and p.role = 'student' and p.status = 'active'
                            and p.username is not null and p.onboarding_complete
     where not exists (select 1 from public.pymk_dismissals d where d.user_id = v_me and d.dismissed_id = r.id)
       and not private.is_blocked(v_me, r.id)
       and not exists (select 1 from public.user_mutes m where m.user_id = v_me and m.muted_id = r.id)
       and not exists (select 1 from public.friend_requests fr
                        where fr.status = 'pending'
                          and ((fr.sender_id = v_me and fr.receiver_id = r.id) or (fr.sender_id = r.id and fr.receiver_id = v_me)))
       -- A shared venture or society already shows each other's names (member lists), whatever the profile setting.
       and (r.shared or private.can_view_profile(r.id))
     limit least(greatest(coalesce(p_limit, 8), 1), 30)), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- e. Storage clean-up no longer knows the yearbook bucket
-- ---------------------------------------------------------------------------
create or replace function private.queue_storage_cleanup(p_bucket text, p_path text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  select pgmq.send('storage_cleanup', jsonb_build_object('bucket', p_bucket, 'path', p_path))
   where p_path is not null
     and p_bucket in ('post-media', 'chat-media', 'avatars', 'credentials', 'cv-exports', 'feedback',
                      'university-claims', 'university-media', 'org-documents', 'society-documents', 'society-media',
                      'event-receipts');
$$;

-- ---------------------------------------------------------------------------
-- f. Drop the feature
-- ---------------------------------------------------------------------------
drop trigger yearbook_pages_set_updated_at on public.yearbook_pages;
drop trigger yearbook_notes_set_updated_at on public.yearbook_notes;
drop trigger yearbook_pages_frozen on public.yearbook_pages;
drop trigger yearbook_notes_frozen on public.yearbook_notes;
drop trigger yearbook_votes_frozen on public.yearbook_votes;
drop trigger yearbook_pages_photo_cleanup on public.yearbook_pages;
drop trigger yearbook_notes_analytics on public.yearbook_notes;
drop trigger yearbook_votes_analytics on public.yearbook_votes;
-- (refuse_if_restricted on pages, notes and votes goes with the tables; its function is shared.)

drop function public.yearbook_home(text);
drop function public.yearbook_page(text);
drop function public.yearbook_me();
drop function public.yearbook_ballot();
drop function public.yearbook_nominees(text);
drop function public.save_yearbook_page(text, uuid[], boolean, text, boolean);
drop function public.sign_yearbook(text, text);
drop function public.decide_yearbook_note(uuid, boolean);
drop function public.cast_yearbook_vote(text, text);
drop function public.decline_yearbook_award(text);
drop function public.set_superlatives_opt_out(boolean);

drop policy yearbook_photos_read on storage.objects;
drop policy yearbook_photos_insert on storage.objects;

-- Functions first (some take the tables' row types); is_yearbook_member last, after the tables'
-- policies that call it.
drop function private.yearbook_home(text);
drop function private.yearbook_page(text);
drop function private.yearbook_me();
drop function private.yearbook_ballot();
drop function private.yearbook_nominees(text);
drop function private.save_yearbook_page(text, uuid[], boolean, text, boolean);
drop function private.sign_yearbook(text, text);
drop function private.decide_yearbook_note(uuid, boolean);
drop function private.cast_yearbook_vote(text, text);
drop function private.decline_yearbook_award(text);
drop function private.set_superlatives_opt_out(boolean);
drop function private.yearbook_open(date);
drop function private.yearbook_reveal_tick();
drop function private.yearbook_freeze(timestamptz);
drop function private.ensure_yearbook_page(uuid);
drop function private.yearbook_state(public.yearbooks);
drop function private.yearbook_photo(public.yearbook_pages, text);
drop function private.require_yearbook_writable(uuid);
drop function private.can_sign_yearbook(uuid, uuid);
drop function private.yearbook_photo_readable(text);
drop function private.yearbook_photo_upload_allowed(text);
drop function private.yearbook_photo_cleanup();
drop function private.yearbook_frozen_guard();
drop function private.yearbook_analytics();
drop function private.yearbook_at(integer, integer, integer);
drop function private.yearbook_titles();
drop function private.yearbook_cal(text);
drop function private.yearbook_limit(text);
drop function private.yearbook_dept(text);

drop table public.yearbook_votes;
drop table public.yearbook_awards;
drop table public.yearbook_notes;
drop table public.yearbook_pages;
drop table public.yearbooks;

drop function private.is_yearbook_member(uuid);
drop function private.yearbook_of(uuid);

alter table public.profiles drop column yearbook_superlatives_opt_out;

-- The bucket, only when it holds nothing (the guard above already checked; checked again here).
do $$
begin
  if exists (select 1 from storage.objects where bucket_id = 'yearbook-photos') then
    raise exception 'the yearbook-photos bucket still holds files';
  end if;
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.buckets where id = 'yearbook-photos';
  perform set_config('storage.allow_delete_query', 'false', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- g. Notifications
-- ---------------------------------------------------------------------------
delete from public.notifications where type in ('yearbook_open', 'yearbook_note', 'yearbook_vote_open', 'yearbook_award');
delete from public.notification_prefs where category = 'yearbook';
delete from public.notification_push_prefs where category = 'yearbook';
delete from public.notification_types where type in ('yearbook_open', 'yearbook_note', 'yearbook_vote_open', 'yearbook_award');
delete from public.notification_categories where category = 'yearbook';

-- ---------------------------------------------------------------------------
-- h. Config. Each key's history is its own rows in platform_config, and nothing references them.
--    platform_config is append-only (platform_config_no_update); the guard is lifted for this one
--    delete only, inside this migration's transaction (decisions 2026-11-23).
-- ---------------------------------------------------------------------------
alter table public.platform_config disable trigger platform_config_no_update;
delete from public.platform_config where key in ('yearbook.calendar', 'yearbook.titles', 'yearbook.limits');
alter table public.platform_config enable trigger platform_config_no_update;
delete from public.config_keys where key in ('yearbook.calendar', 'yearbook.titles', 'yearbook.limits');
