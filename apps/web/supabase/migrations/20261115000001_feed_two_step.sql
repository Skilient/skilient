-- Feed first page (Load test, decisions 2026-11-05): two-step ranking in build_feed, and the
-- feed.window score_pool setting (editable in /ops/config).

insert into public.platform_config (key, version, value, reason)
select 'feed.window', c.version + 1, c.value || '{"score_pool": 1000}'::jsonb,
       'Two-step feed ranking: score at most score_pool posts (friends, followed ventures and own posts always; then the newest and the most-discussed)'
  from public.platform_config c
 where c.key = 'feed.window'
   and c.version = (select max(version) from public.platform_config where key = 'feed.window')
   and not (c.value ? 'score_pool');

update public.config_keys
   set schema = jsonb_set(schema, '{properties,score_pool}', '{"type": "integer", "minimum": 1}'::jsonb)
                || jsonb_build_object('required', (schema -> 'required') || '["score_pool"]'::jsonb),
       updated_at = now()
 where key = 'feed.window' and not (schema -> 'properties' ? 'score_pool');

CREATE OR REPLACE FUNCTION private.build_feed(p_viewer uuid, p_audience post_audience, p_filter text, p_exclude uuid[])
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  wc jsonb := coalesce(private.config('feed.window'), '{}'::jsonb);
  dc jsonb := coalesce(private.config('feed.diversity'), '{}'::jsonb);
  v_uni uuid;
  v_page integer := coalesce((dc->>'page_size')::integer, 20);
  v_same numeric := coalesce((dc->>'same_author_page')::numeric, 0.5);
  v_every integer := coalesce((wc->>'exploration_every')::integer, 5);
  v_out uuid[] := '{}';
  v_last_author uuid;
  v_page_authors jsonb := '{}'::jsonb;
  v_pick record;
  v_n integer;
  i integer := 0;
  v_explore_ids uuid[];
  v_ix integer := 1;
  v_pool integer := greatest(coalesce((wc->>'score_pool')::integer, 1000), 1);
begin
  select university_id into v_uni from public.profiles where user_id = p_viewer;

  if to_regclass('pg_temp.feed_candidates') is null then
    create temporary table feed_candidates (id uuid primary key, author_id uuid, score numeric, stage public.post_stage, created_at timestamptz) on commit drop;
  else
    truncate pg_temp.feed_candidates;
  end if;
  -- Two steps (decisions 2026-11-05, Ahmed): scoring every post in the window cost about 2.5 s a first
  -- page at 5,000 students. Step 1 is cheap: posts from the viewer, a friend or a followed venture (the
  -- newest score_pool of them), plus the newest and the most-discussed score_pool / 2 each (every post
  -- when there are no more than score_pool). Step 2 checks visibility and scores only those, as before.
  insert into pg_temp.feed_candidates (id, author_id, score, stage, created_at)
  select p.id, p.author_id, private.feed_score(p.id, p_viewer), p.stage, p.created_at
    from (
      select e.id, e.author_id, e.stage, e.created_at
        from (
          select n.*, row_number() over (partition by n.near order by n.created_at desc) as by_near
            from (
          select p.id, p.author_id, p.stage, p.created_at,
                 count(*) over () as eligible,
                 row_number() over (order by p.created_at desc) as by_new,
                 row_number() over (order by coalesce(st.answers, 0) + coalesce(st.positives, 0) + 2 * coalesce(st.commenters, 0) desc,
                                             p.created_at desc) as by_talk,
                 (p.author_id = p_viewer
                  or exists (select 1 from public.friendships f
                              where f.user_id_a = least(p.author_id, p_viewer) and f.user_id_b = greatest(p.author_id, p_viewer))
                  or (p.venture_id is not null
                      and exists (select 1 from public.venture_follows vf where vf.venture_id = p.venture_id and vf.user_id = p_viewer))) as near
            from public.posts p
            left join public.post_stats st on st.post_id = p.id
           where p.stage <> 'held'
           and not (p.id = any (coalesce(p_exclude, '{}')))
           and (p.pinned_until is null or p.pinned_until <= now())
           and p.created_at > now() - make_interval(days => case when p.type = 'shipped'
                                                                 then coalesce((wc->>'shipped_age_days')::integer, 14)
                                                                 else coalesce((wc->>'max_age_days')::integer, 7) end)
           and case p_audience when 'university' then p.university_id = v_uni else p.audience = 'global' end
           and case p_filter
                 when 'ventures' then p.type = 'invite'
                 when 'events' then p.type = 'event'
                 when 'announcements' then p.type = 'announcement'
                 when 'shipped' then p.type = 'shipped'
                 when 'societies' then p.society_id is not null
                 else true
               end
           and not exists (select 1 from public.post_hides h where h.user_id = p_viewer and h.post_id = p.id)
           and not exists (select 1 from public.user_mutes m where m.user_id = p_viewer and m.muted_id = p.author_id)
            ) n
        ) e
       where e.eligible <= v_pool or (e.near and e.by_near <= v_pool) or e.by_new <= v_pool / 2 or e.by_talk <= v_pool / 2
    ) p
   where private.can_view_post(p.id)
     -- Seed posts reach only their seed audience (plus exploration slots, below).
     and (p.stage <> 'seed' or private.in_seed_audience(p.id, p_viewer))
   order by 3 desc
   limit coalesce((wc->>'candidates')::integer, 300);

  select count(*) into v_n from pg_temp.feed_candidates;
  -- The exploration posts for the whole list, drawn at random once (one query, not one per slot; the
  -- same rule: Seed posts under 2 hours old, outside the candidates, not yet seen).
  v_explore_ids := array(
    select p.id
      from public.posts p
         where p.stage = 'seed'
           and p.created_at > now() - make_interval(hours => coalesce((wc->>'exploration_max_hours')::integer, 2))
           and p.author_id <> p_viewer
           and not (p.id = any (coalesce(p_exclude, '{}')))
           and not exists (select 1 from pg_temp.feed_candidates fc where fc.id = p.id)
           and private.can_view_post(p.id)
           and case p_audience when 'university' then p.university_id = v_uni else p.audience = 'global' end
           and (p_filter = 'all' or (p_filter = 'societies' and p.society_id is not null)
                or (p_filter <> 'societies' and p.type = case p_filter when 'ventures' then 'invite' when 'events' then 'event'
                                                            when 'announcements' then 'announcement' else 'shipped' end::public.post_type))
           and not exists (select 1 from public.post_hides h where h.user_id = p_viewer and h.post_id = p.id)
           and not exists (select 1 from public.user_mutes m where m.user_id = p_viewer and m.muted_id = p.author_id)
           and not exists (select 1 from public.post_views pv where pv.post_id = p.id and pv.user_id = p_viewer)
         order by random()
         limit v_n / greatest(v_every - 1, 1) + 2
  );
  loop
    i := i + 1;
    -- Exploration: every 5th slot, a Seed post under 2 hours old from outside the list.
    if i % v_every = 0 and v_ix <= coalesce(cardinality(v_explore_ids), 0) then
      v_out := v_out || v_explore_ids[v_ix];
      v_ix := v_ix + 1;
      continue;
    end if;
    exit when v_n = 0;
    -- Best adjusted score, avoiding the same author twice in a row when possible.
    select fc.id, fc.author_id into v_pick
      from pg_temp.feed_candidates fc
     order by (fc.author_id = v_last_author) asc,
              fc.score * power(v_same, coalesce((v_page_authors->>fc.author_id::text)::integer, 0)) desc,
              fc.created_at desc
     limit 1;
    exit when v_pick.id is null;
    v_out := v_out || v_pick.id;
    delete from pg_temp.feed_candidates where id = v_pick.id;
    v_n := v_n - 1;
    v_last_author := v_pick.author_id;
    if array_length(v_out, 1) % v_page = 0 then
      v_page_authors := '{}'::jsonb;
    else
      v_page_authors := jsonb_set(v_page_authors, array[v_pick.author_id::text],
                                  to_jsonb(coalesce((v_page_authors->>v_pick.author_id::text)::integer, 0) + 1));
    end if;
  end loop;
  return v_out;
end;
$function$;
revoke all on function private.build_feed(uuid, public.post_audience, text, uuid[]) from public;
