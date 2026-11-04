-- Phase 18 (PRD 5.34): Openings replaces the Opportunities hub. One page of category cards, each
-- with its latest opening, read in one call; a category page with filters; This week, rebuilt
-- nightly per university.
--
-- * private.openings_items(user, category): every open item of one category for one student,
--   with `matched` (the item needs a skill the student holds at L2+, or is on a followed path).
--   Never ordered or filtered by payment: nothing here reads a sponsorship or plan.
-- * openings_overview(): one jsonb with every card (latest item, count, updated_at, new dot).
--   Jobs, contact requests, applications, job fairs and competitions only while their portal
--   is on (portals.enabled).
-- * openings(category, sort, matched_only, q, after): one page of a category.
-- * openings_seen: when the student last opened each category (the new dot; the nav badge).
-- * openings_weekly: This week per university, rebuilt by cron `openings-this-week`.
-- * opportunities(tab) stays as it is (a wrapper the portals still use while they're off).

-- ---------------------------------------------------------------------------
-- Config
-- ---------------------------------------------------------------------------
insert into public.platform_config (key, version, value, reason) values
  ('openings.limits', 1, '{"page": 30, "this_week_posts": 5, "this_week_min_informative": 3}',
   'PRD 5.34: category pages show 30 items at a time; This week lists the 5 most informative posts with at least 3 people finding them informative.');
insert into public.config_keys (key, area, description, applies, schema) values
  ('openings.limits', 'openings', 'Openings: items per category page, and how many informative posts This week lists (and the fewest "informative" answers a post needs).', 'now',
   '{"type": "object", "additionalProperties": false, "required": ["page", "this_week_posts", "this_week_min_informative"],
     "properties": {"page": {"type": "integer", "minimum": 10, "maximum": 100},
                    "this_week_posts": {"type": "integer", "minimum": 1, "maximum": 20},
                    "this_week_min_informative": {"type": "integer", "minimum": 1, "maximum": 50}}}');

create function private.openings_limit(p_field text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select private.cfg_int('openings.limits', p_field,
                         case p_field when 'page' then 30 when 'this_week_posts' then 5 else 3 end);
$$;
revoke all on function private.openings_limit(text) from public;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.openings_seen (
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category ~ '^[a-z_]{2,30}$'),
  seen_at timestamptz not null default now(),
  primary key (user_id, category)
);
comment on table public.openings_seen is 'When a student last opened each Openings category (PRD 5.34 new dot); "overview" is /openings itself. Owner-only; written by mark_openings_seen().';

create table public.openings_weekly (
  university_id uuid primary key references public.universities (id) on delete cascade,
  week_start date not null,
  built_at timestamptz not null default now(),
  -- Ids and the informative count only; titles and visibility are read live (can_view_post).
  posts jsonb not null default '[]' check (jsonb_typeof(posts) = 'array'),
  events uuid[] not null default '{}',
  inductions uuid[] not null default '{}',
  ventures uuid[] not null default '{}'
);
comment on table public.openings_weekly is 'This week (PRD 5.34) per university: the week''s most informative posts, upcoming society events, new inductions and new ventures. Rebuilt nightly; read through openings_this_week().';

alter table public.openings_seen enable row level security;
alter table public.openings_weekly enable row level security;
revoke all on table public.openings_seen, public.openings_weekly from anon, authenticated;
grant select on table public.openings_seen, public.openings_weekly to authenticated;
create policy openings_seen_owner_read on public.openings_seen for select to authenticated using (user_id = (select auth.uid()));
create policy openings_weekly_member_read on public.openings_weekly for select to authenticated
  using (university_id = (select private.current_university_id()));

-- New-since-last-visit lookups.
create index induction_rounds_published_idx on public.induction_rounds (published_at) where status = 'open';
create index events_society_published_idx on public.events (university_id, published_at) where society_id is not null;

-- ---------------------------------------------------------------------------
-- Items
-- ---------------------------------------------------------------------------
-- Categories in card order. Portal cards come last and only while their portal is on.
create function private.openings_categories()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array['venture_roles', 'inductions', 'events', 'ideas', 'paths', 'swaps', 'this_week']
         || case when private.portal_enabled('recruiter') then array['jobs', 'contact_requests', 'applications'] else '{}'::text[] end
         || case when private.portal_enabled('recruiter') or private.portal_enabled('university') then array['competitions'] else '{}'::text[] end
         || case when private.portal_enabled('recruiter') and private.portal_enabled('university') then array['job_fairs'] else '{}'::text[] end;
$$;
revoke all on function private.openings_categories() from public;

-- The caller's L2+ skills.
create function private.my_l2_skills(p_user uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(u.skill_id), '{}') from public.user_skills u where u.user_id = p_user and u.level >= 2;
$$;
revoke all on function private.my_l2_skills(uuid) from public;

create function private.openings_items(p_user uuid, p_category text)
returns table (id uuid, kind text, title text, host text, detail text, href text, deadline timestamptz,
               created_at timestamptz, matched boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uni uuid := (select p.university_id from public.profiles p where p.user_id = p_user);
  v_skills text[] := private.my_l2_skills(p_user);
  v_week public.openings_weekly;
begin
  if p_category = 'venture_roles' then
    -- Open seats on recruiting or running ventures the student can see and isn't on.
    return query
    select r.id, 'venture_role'::text, r.title, v.title,
           (r.slots - r.filled)::text || ' of ' || r.slots::text || ' open' ||
             coalesce(' · ' || (select string_agg(k.name, ', ' order by k.name) from public.skills k where k.id = any (r.skill_ids)), ''),
           '/ventures/' || v.id::text || '#roles', null::timestamptz, r.created_at,
           r.skill_ids && v_skills
      from public.venture_roles r
      join public.ventures v on v.id = r.venture_id
     where v.status in ('recruiting', 'in_progress') and r.filled < r.slots
       and v.owner_id <> p_user
       and not exists (select 1 from public.venture_members m where m.venture_id = v.id and m.user_id = p_user)
       and not private.is_blocked(p_user, v.owner_id)
       and (v.visibility = 'public' or (v.visibility = 'university' and v.university_id = v_uni))
     order by r.created_at desc
     limit 300;
  elsif p_category = 'inductions' then
    return query
    select ir.id, 'induction'::text, ir.title, s.name,
           (select string_agg(x.title, ', ' order by x.position) from public.induction_roles x where x.round_id = ir.id),
           '/societies/' || s.slug || '/inductions/' || ir.id::text, ir.deadline, coalesce(ir.published_at, ir.created_at),
           exists (select 1 from public.induction_roles x where x.round_id = ir.id and x.skill_ids && v_skills)
      from public.induction_rounds ir
      join public.societies s on s.id = ir.society_id and s.status = 'verified' and s.university_id = v_uni
     where ir.status = 'open' and ir.deadline > now()
     order by coalesce(ir.published_at, ir.created_at) desc
     limit 300;
  elsif p_category = 'events' then
    -- Society events open for registration to this student.
    return query
    select e.id, 'event'::text, e.title, s.name,
           to_char(e.starts_at at time zone 'Asia/Karachi', 'DD Mon · HH24:MI') || coalesce(' · ' || e.location, ' · Online'),
           '/events/' || e.id::text, coalesce(e.registration_closes_at, e.starts_at), coalesce(e.published_at, e.created_at), false
      from public.events e
      join public.societies s on s.id = e.society_id and s.status = 'verified'
     where e.status = 'published' and e.starts_at > now()
       and (e.university_id = v_uni or e.eligibility ->> 'scope' = 'all')
       and private.event_block_reason(e.id, p_user) is null
     order by coalesce(e.published_at, e.created_at) desc
     limit 300;
  elsif p_category = 'ideas' then
    return query
    select i.id, 'idea'::text, i.title, tp.full_name,
           initcap(i.difficulty::text) || ' · teams of ' || i.team_size::text || ' · ' || i.duration_weeks::text || ' weeks',
           '/ideas/' || i.id::text, i.deadline::timestamptz, i.created_at, i.skills && v_skills
      from public.project_ideas i
      join public.profiles tp on tp.user_id = i.teacher_id
     where i.status = 'open' and (i.deadline is null or i.deadline >= current_date)
       and (i.university_id = v_uni or i.audience = 'global')
     order by i.created_at desc
     limit 300;
  elsif p_category = 'paths' then
    -- The next square on each path the student follows.
    return query
    select null::uuid, 'path_square'::text, st.name, p.name, 'Next on your path',
           '/me/paths?role=' || p.role || '&skill=' || st.skill_id, null::timestamptz, f.created_at, true
      from public.path_follows f
      join public.paths p on p.role = f.role
      cross join lateral (select s.skill_id, s.name from private.path_steps(p_user, p.role) s where s.state = 'next' order by s.pos limit 1) st
     where f.user_id = p_user
     order by f.created_at desc;
  elsif p_category = 'swaps' then
    -- Teachers at the student's university for what the student wants to learn.
    return query
    select null::uuid, 'swap_teacher'::text, k.name || ' with ' || split_part(tp.full_name, ' ', 1), tp.full_name,
           'L' || us.level::text || ' · ' || private.swap_hours_label(private.swap_minutes_taught(o.user_id)) || ' taught',
           '/swaps?skill=' || k.id, null::timestamptz, o.created_at, true
      from public.swap_wants w
      join public.swap_offers o on o.skill_id = w.skill_id and o.user_id <> p_user
      join public.user_skills us on us.user_id = o.user_id and us.skill_id = o.skill_id and us.level >= 2
      join public.profiles tp on tp.user_id = o.user_id and tp.university_id = v_uni and tp.role = 'student'
                             and tp.status <> 'deleting' and tp.username is not null
      join public.skills k on k.id = w.skill_id
     where w.user_id = p_user and not private.is_blocked(p_user, o.user_id)
     order by o.created_at desc
     limit 300;
  elsif p_category = 'this_week' then
    select * into v_week from public.openings_weekly ow where ow.university_id = v_uni;
    return query
    select p.id, 'post'::text, left(regexp_replace(p.body, '\s+', ' ', 'g'), 120), a.full_name,
           (x ->> 'informative') || ' found this informative', '/post/' || p.id::text, null::timestamptz, p.created_at, false
      from jsonb_array_elements(coalesce(v_week.posts, '[]'::jsonb)) x
      join public.posts p on p.id = (x ->> 'id')::uuid
      join public.profiles a on a.user_id = p.author_id
     where private.can_view_post(p.id);
  elsif p_category in ('jobs', 'contact_requests', 'applications', 'competitions', 'job_fairs') then
    if not (p_category = any (private.openings_categories())) then
      return;
    end if;
    return query
    select o.id, o.kind, o.title, o.org_name, o.detail, replace(o.href, '/opportunities/', '/openings/'), o.starts_at, o.starts_at, false
      from private.opportunities(p_category, 0) o;
  else
    raise exception 'unknown category' using errcode = '22023';
  end if;
end;
$$;
revoke all on function private.openings_items(uuid, text) from public;

-- ---------------------------------------------------------------------------
-- Reads
-- ---------------------------------------------------------------------------
-- Every card in one call: the latest item (title, host, deadline), the count, when it last
-- changed and whether something is new since the student last opened that category.
create function private.openings_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_cards jsonb := '[]'::jsonb;
  c text;
  v_seen timestamptz;
  v_count integer;
  v_updated timestamptz;
  v_latest jsonb;
  v_uni text := (select u.name from public.universities u where u.id = private.current_university_id());
begin
  foreach c in array private.openings_categories() loop
    select s.seen_at into v_seen from public.openings_seen s where s.user_id = v_me and s.category = c;
    select count(*)::integer, max(i.created_at),
           (array_agg(jsonb_build_object('title', i.title, 'host', i.host, 'deadline', i.deadline, 'href', i.href, 'detail', i.detail)
                      order by i.matched desc, i.created_at desc nulls last))[1]
      into v_count, v_updated, v_latest
      from private.openings_items(v_me, c) i;
    v_cards := v_cards || jsonb_build_array(jsonb_build_object(
      'category', c, 'count', v_count, 'updated_at', v_updated, 'latest', v_latest,
      'new', v_updated is not null and (v_seen is null or v_updated > v_seen)));
  end loop;
  return jsonb_build_object('university', v_uni, 'cards', v_cards,
    'week_built_at', (select w.built_at from public.openings_weekly w where w.university_id = private.current_university_id()));
end;
$$;

-- One category: matches first, then deadline soonest or newest; optional text search.
create function private.openings(p_category text, p_sort text default 'newest', p_matched_only boolean default false,
                                 p_q text default null, p_after integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_page integer := private.openings_limit('page');
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  if p_category is null or not (p_category = any (private.openings_categories())) then
    raise exception 'unknown category' using errcode = '22023';
  end if;
  if p_sort not in ('newest', 'deadline') then
    raise exception 'sort by newest or deadline' using errcode = '22023';
  end if;
  if v_q is not null and char_length(v_q) > 80 then
    raise exception 'search is up to 80 characters' using errcode = '22023';
  end if;
  return (
    with items as (
      select i.* from private.openings_items(v_me, p_category) i
       where (not coalesce(p_matched_only, false) or i.matched)
         and (v_q is null or i.title ilike private.contains_pattern(v_q) or coalesce(i.host, '') ilike private.contains_pattern(v_q))
    ), ordered as (
      select i.*, row_number() over (order by i.matched desc,
                                              case when p_sort = 'deadline' then i.deadline end asc nulls last,
                                              i.created_at desc nulls last, i.title) as n
        from items i
    )
    select jsonb_build_object(
      'category', p_category,
      'total', (select count(*) from items),
      'items', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'kind', o.kind, 'title', o.title, 'host', o.host,
                                                             'detail', o.detail, 'href', o.href, 'deadline', o.deadline,
                                                             'created_at', o.created_at, 'matched', o.matched) order by o.n)
                           from ordered o where o.n > greatest(coalesce(p_after, 0), 0) and o.n <= greatest(coalesce(p_after, 0), 0) + v_page), '[]'::jsonb),
      'next', case when (select count(*) from items) > greatest(coalesce(p_after, 0), 0) + v_page
                   then greatest(coalesce(p_after, 0), 0) + v_page end));
end;
$$;

create function private.mark_openings_seen(p_category text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
begin
  if p_category is null or not (p_category = 'overview' or p_category = any (private.openings_categories())) then
    raise exception 'unknown category' using errcode = '22023';
  end if;
  insert into public.openings_seen (user_id, category, seen_at) values (v_me, p_category, now())
  on conflict (user_id, category) do update set seen_at = excluded.seen_at;
end;
$$;

-- This week, live: titles and visibility checked now, not when the week was built.
create function private.openings_this_week()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  w public.openings_weekly;
begin
  select * into w from public.openings_weekly x where x.university_id = private.current_university_id();
  if w.university_id is null then
    return jsonb_build_object('built_at', null, 'posts', '[]'::jsonb, 'events', '[]'::jsonb, 'inductions', '[]'::jsonb, 'ventures', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'built_at', w.built_at,
    'week_start', w.week_start,
    'posts', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'informative', (x ->> 'informative')::integer) order by x.ord)
                         from jsonb_array_elements(w.posts) with ordinality as x(x, ord)
                         join public.posts p on p.id = (x.x ->> 'id')::uuid
                        where private.can_view_post(p.id)), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'host', s.name,
                                                            'starts_at', e.starts_at, 'href', '/events/' || e.id::text) order by e.starts_at)
                          from public.events e join public.societies s on s.id = e.society_id and s.status = 'verified'
                         where e.id = any (w.events) and e.status in ('published', 'live') and e.ends_at > now()), '[]'::jsonb),
    'inductions', coalesce((select jsonb_agg(jsonb_build_object('id', ir.id, 'title', ir.title, 'host', s.name, 'deadline', ir.deadline,
                                                                'href', '/societies/' || s.slug || '/inductions/' || ir.id::text) order by ir.deadline)
                              from public.induction_rounds ir join public.societies s on s.id = ir.society_id and s.status = 'verified'
                             where ir.id = any (w.inductions) and ir.status = 'open'), '[]'::jsonb),
    'ventures', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'title', v.title, 'type', v.type, 'href', '/ventures/' || v.id::text)
                                           order by v.created_at desc)
                            from public.ventures v
                           where v.id = any (w.ventures) and private.can_view_venture(v.id)
                             and not private.is_blocked(v_me, v.owner_id)), '[]'::jsonb));
end;
$$;

-- Nightly: rebuild This week for every university with students.
create function private.build_openings_weekly(p_today date default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_today date := coalesce(p_today, (now() at time zone 'Asia/Karachi')::date);
  v_from timestamptz := (v_today - 7)::timestamp at time zone 'Asia/Karachi';
  v_posts integer := private.openings_limit('this_week_posts');
  v_min integer := private.openings_limit('this_week_min_informative');
  v_count integer;
begin
  insert into public.openings_weekly as w (university_id, week_start, built_at, posts, events, inductions, ventures)
  select u.id, v_today - 7, now(),
         coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'informative', t.ticks) order by t.ticks desc, t.created_at desc)
                     from (select p.id, p.created_at, sc.ticks
                             from public.posts p
                             join public.profiles a on a.user_id = p.author_id and a.university_id = u.id
                             join public.post_survey_counts sc on sc.post_id = p.id and sc.dimension = 'informative'
                            where p.created_at >= v_from and p.removed_at is null
                              and sc.ticks >= v_min
                            order by sc.ticks desc, p.created_at desc
                            limit v_posts) t), '[]'::jsonb),
         coalesce(array(select e.id from public.events e join public.societies s on s.id = e.society_id and s.status = 'verified'
                         where e.university_id = u.id and e.status = 'published'
                           and e.starts_at > now() and e.starts_at < now() + interval '7 days'
                         order by e.starts_at limit 10), '{}'),
         coalesce(array(select ir.id from public.induction_rounds ir join public.societies s on s.id = ir.society_id and s.status = 'verified'
                         where s.university_id = u.id and ir.status = 'open' and ir.deadline > now()
                           and coalesce(ir.published_at, ir.created_at) >= v_from
                         order by ir.deadline limit 10), '{}'),
         coalesce(array(select v.id from public.ventures v
                         where v.university_id = u.id and v.created_at >= v_from and v.visibility <> 'unlisted'
                           and v.status in ('recruiting', 'in_progress')
                         order by v.created_at desc limit 10), '{}')
    from public.universities u
   where exists (select 1 from public.profiles p where p.university_id = u.id and p.role = 'student')
  on conflict (university_id) do update
     set week_start = excluded.week_start, built_at = excluded.built_at, posts = excluded.posts,
         events = excluded.events, inductions = excluded.inductions, ventures = excluded.ventures;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function private.build_openings_weekly(date) from public;

-- ---------------------------------------------------------------------------
-- Nav badge: the key `opportunities` becomes `openings`. The count is society inductions and
-- events opened at the student's university since they last looked at /openings (capped at 99).
-- ---------------------------------------------------------------------------
create or replace function private.nav_badges()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_uni uuid := private.current_university_id();
  v_seen timestamptz := coalesce((select s.seen_at from public.openings_seen s where s.user_id = v_me and s.category = 'overview'),
                                 now() - interval '7 days');
begin
  return jsonb_build_object(
    'chat', private.unread_chat_count(),
    'notifications', (select count(*)::integer from public.notifications n where n.user_id = v_me and n.read_at is null),
    'friends', private.pending_friend_request_count(),
    'ventures',
      (select count(*)::integer from public.application_threads t where t.owner_id = v_me and t.status = 'pending')
      + (select count(*)::integer from public.venture_invites i where i.invitee_id = v_me and i.status = 'pending'),
    'openings', least(99,
      (select count(*)::integer from public.induction_rounds ir
         join public.societies s on s.id = ir.society_id and s.status = 'verified' and s.university_id = v_uni
        where ir.status = 'open' and ir.published_at > v_seen and ir.deadline > now())
      + (select count(*)::integer from public.events e
          where e.university_id = v_uni and e.society_id is not null and e.status = 'published'
            and e.published_at > v_seen and e.starts_at > now())));
end;
$$;

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------
select cron.schedule('openings-this-week', '17 21 * * *', $$select private.build_openings_weekly()$$); -- 02:17 PKT

-- ---------------------------------------------------------------------------
-- Public wrappers
-- ---------------------------------------------------------------------------
create function pg_temp.expose(p_names text[])
returns void
language plpgsql
as $$
declare
  n text;
  r record;
  v_names text;
begin
  foreach n in array p_names loop
    select p.oid, p.proname, p.provolatile, p.proargnames,
           pg_get_function_arguments(p.oid) as args,
           pg_get_function_identity_arguments(p.oid) as ident,
           pg_get_function_result(p.oid) as result
      into r
      from pg_proc p where p.pronamespace = 'private'::regnamespace and p.proname = n;
    if r.oid is null then
      raise exception 'no private function %', n;
    end if;
    select coalesce(string_agg(a, ', ' order by ord), '') into v_names
      from unnest(coalesce(r.proargnames, '{}'::text[])) with ordinality as t(a, ord);
    execute format('revoke all on function private.%I(%s) from public', n, r.ident);
    execute format('grant execute on function private.%I(%s) to authenticated', n, r.ident);
    execute format('create function public.%I(%s) returns %s language sql %s security invoker set search_path = %L as $f$ select private.%I(%s) $f$',
                   n, r.args, r.result, case r.provolatile when 'v' then 'volatile' else 'stable' end, '', n, v_names);
    execute format('revoke all on function public.%I(%s) from public, anon', n, r.ident);
    execute format('grant execute on function public.%I(%s) to authenticated', n, r.ident);
  end loop;
end;
$$;

select pg_temp.expose(array['openings_overview', 'openings', 'mark_openings_seen', 'openings_this_week']);
drop function pg_temp.expose(text[]);
