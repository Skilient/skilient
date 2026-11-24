-- Phase 18 (PRD 5.34): share-to-chat, people you may know, and web push.
--
-- * Share-to-chat (supersedes "no share-to-chat" in 5.28 and CLAUDE.md): chat_messages.shared_post_id
--   (set null when the post goes; `shared` keeps the card as "This post isn't available"),
--   send_message accepts it, share_post sends one post to up to 5 DMs or venture chats (the chat
--   rate limit and blocks apply), undo_share takes it back within 15 seconds. The card is rendered
--   for the reader through post_cards (can_view_post). Shares are never counted or shown on the post.
-- * people_you_may_know(limit): same department and batch, mutual friends, shared ventures, shared
--   societies, with a reason line; other universities only through a venture or society; dismissed
--   people never return (pymk_dismissals); blocks and mutes respected.
-- * Push: push_subscriptions; notification_types.pushed marks what is pushed; per-category prefs in
--   notification_push_prefs (default from notification_categories.push_default); private.notify
--   queues pgmq `notification_push` for the notify-worker, which sends Web Push with the VAPID keys
--   in Vault (vapid_public_key, vapid_private_key, vapid_subject).

-- ===========================================================================
-- Share-to-chat
-- ===========================================================================
alter table public.chat_messages
  add column shared_post_id uuid references public.posts (id) on delete set null,
  add column shared boolean not null default false,
  add constraint chat_messages_shared check (shared_post_id is null or shared);
alter table public.chat_messages drop constraint chat_messages_check;
alter table public.chat_messages add constraint chat_messages_check
  check (deleted_at is not null or char_length(btrim(body)) > 0 or media_path is not null or shared);
create index chat_messages_shared_post_idx on public.chat_messages (shared_post_id) where shared_post_id is not null;
comment on column public.chat_messages.shared_post_id is
  'A post shared into the chat (PRD 5.34). Rendered for each reader through post_cards (can_view_post); never counted.';

drop function public.send_message(uuid, text, jsonb, uuid);
drop function private.send_message(uuid, text, jsonb, uuid);
create function private.send_message(p_thread uuid, p_body text, p_media jsonb default null, p_reply_to uuid default null,
                                     p_shared_post uuid default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_body text := coalesce(p_body, '');
  v_id uuid;
begin
  if v_me is null or not private.is_thread_member(p_thread) then
    raise exception 'you''re not in this chat' using errcode = '42501';
  end if;
  if private.dm_blocked(p_thread) then
    raise exception 'this conversation is closed' using errcode = '42501';
  end if;
  if char_length(v_body) > 10000 then
    raise exception 'messages are up to 10,000 characters' using errcode = '23514';
  end if;
  if btrim(v_body) = '' and p_media is null and p_shared_post is null then
    raise exception 'write a message or add an image' using errcode = '23514';
  end if;
  if p_shared_post is not null and (p_media is not null or not private.can_view_post(p_shared_post)) then
    raise exception 'that post isn''t available to share' using errcode = '22023';
  end if;
  if p_reply_to is not null and not exists (
       select 1 from public.chat_messages r where r.id = p_reply_to and r.thread_id = p_thread and r.deleted_at is null) then
    raise exception 'that message is no longer here to reply to' using errcode = '22023';
  end if;
  if p_media is not null and (
       split_part(p_media->>'path', '/', 1) <> p_thread::text
       or not exists (select 1 from storage.objects o where o.bucket_id = 'chat-media' and o.name = p_media->>'path'
                       and o.owner_id = v_me::text)) then
    raise exception 'the image is missing; attach it again' using errcode = '22023';
  end if;
  if not private.rate_limit('chat:' || v_me::text, 30, interval '1 minute') then
    raise exception 'you''re sending messages too fast' using errcode = '54000';
  end if;
  insert into public.chat_messages (thread_id, sender_id, body, media_path, media_width, media_height, reply_to_id, shared_post_id, shared)
  values (p_thread, v_me, v_body, p_media->>'path', (p_media->>'width')::integer, (p_media->>'height')::integer, p_reply_to,
          p_shared_post, p_shared_post is not null)
  returning id into v_id;
  update public.chat_threads set last_message_at = now() where id = p_thread;
  update public.chat_thread_members set last_read_at = now() where thread_id = p_thread and user_id = v_me;
  return v_id;
end;
$$;
revoke all on function private.send_message(uuid, text, jsonb, uuid, uuid) from public;
grant execute on function private.send_message(uuid, text, jsonb, uuid, uuid) to authenticated;
create function public.send_message(p_thread uuid, p_body text, p_media jsonb default null, p_reply_to uuid default null,
                                    p_shared_post uuid default null) returns uuid
  language sql volatile security invoker set search_path = ''
  as $$ select private.send_message(p_thread, p_body, p_media, p_reply_to, p_shared_post) $$;
revoke all on function public.send_message(uuid, text, jsonb, uuid, uuid) from public, anon;
grant execute on function public.send_message(uuid, text, jsonb, uuid, uuid) to authenticated;

-- Where a post can be shared: the caller's DMs (not blocked) and venture chats, most recent first.
create function private.share_targets(p_q text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x ->> 'last_at' desc nulls last), '[]'::jsonb)
    from (select jsonb_build_object(
                   'id', t.id, 'type', t.type,
                   'title', case when t.type = 'group' then v.title else o.full_name end,
                   'username', case when t.type = 'dm' and private.can_view_profile(o.user_id) then o.username end,
                   'avatar_path', case when t.type = 'dm' and private.can_view_profile(o.user_id) then o.avatar_path end,
                   'last_at', t.last_message_at) as x
            from public.chat_thread_members me
            join public.chat_threads t on t.id = me.thread_id
            left join public.ventures v on v.id = t.venture_id
            left join lateral (
              select p.* from public.chat_thread_members om join public.profiles p on p.user_id = om.user_id
               where om.thread_id = t.id and om.user_id <> me.user_id limit 1
            ) o on t.type = 'dm'
           where me.user_id = (select auth.uid())
             and not private.dm_blocked(t.id)
             and (t.type = 'group' and t.venture_id is not null or (t.type = 'dm' and o.user_id is not null))
             and (nullif(btrim(coalesce(p_q, '')), '') is null
                  or coalesce(case when t.type = 'group' then v.title else o.full_name end, '') ilike private.contains_pattern(p_q))
           order by t.last_message_at desc nulls last
           limit 30) s;
$$;

-- One post into up to 5 chats with an optional note. Each send is an ordinary message (blocks and
-- the 30-a-minute limit apply). Returns the message ids for Undo.
create function private.share_post(p_post uuid, p_threads uuid[], p_note text default null)
returns uuid[]
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_ids uuid[] := '{}';
  t uuid;
begin
  if p_post is null or not private.can_view_post(p_post) then
    raise exception 'that post isn''t available to share' using errcode = 'P0002';
  end if;
  if p_threads is null or cardinality(p_threads) = 0 then
    raise exception 'pick a chat' using errcode = '22023';
  end if;
  if cardinality(p_threads) > 5 then
    raise exception 'share to up to 5 chats at once' using errcode = '23514';
  end if;
  if char_length(coalesce(p_note, '')) > 1000 then
    raise exception 'notes are up to 1,000 characters' using errcode = '23514';
  end if;
  foreach t in array (select array_agg(distinct x) from unnest(p_threads) x) loop
    if not exists (select 1 from public.chat_threads ct where ct.id = t and (ct.type = 'dm' or ct.venture_id is not null)) then
      raise exception 'you can share into DMs and venture chats' using errcode = '42501';
    end if;
    v_ids := v_ids || private.send_message(t, btrim(coalesce(p_note, '')), null, null, p_post);
  end loop;
  return v_ids;
end;
$$;

-- Undo within 15 seconds: the shares are taken back as if never sent.
create function private.undo_share(p_messages uuid[])
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_n integer;
begin
  delete from public.chat_messages
   where id = any (coalesce(p_messages, '{}')) and sender_id = v_me and shared and created_at > now() - interval '15 seconds';
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'too late to undo' using errcode = '55000';
  end if;
  delete from public.notifications n
   where n.type = 'chat_message' and n.actor_id = v_me and n.read_at is null and n.created_at > now() - interval '15 seconds'
     and not exists (select 1 from public.chat_messages m where m.thread_id = n.entity_id and m.sender_id = v_me
                      and m.created_at > now() - interval '15 seconds');
  return v_n;
end;
$$;

-- Messages carry the share; the reader's post card comes from post_cards.
drop function public.thread_messages(uuid, timestamptz, integer);
drop function private.thread_messages(uuid, timestamptz, integer);
create function private.thread_messages(p_thread uuid, p_before timestamptz default null, p_limit integer default 50)
returns table (id uuid, sender_id uuid, body text, media_path text, media_width integer, media_height integer,
               created_at timestamptz, edited_at timestamptz, deleted boolean,
               reply_to_id uuid, reply_sender_id uuid, reply_excerpt text,
               reactions jsonb, pinned boolean, link jsonb, shared_post_id uuid, shared boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with page as (
    select m.* from public.chat_messages m
     where m.thread_id = p_thread and private.is_thread_member(p_thread) and not private.dm_blocked(p_thread)
       and (p_before is null or m.created_at < p_before)
     order by m.created_at desc
     limit least(greatest(coalesce(p_limit, 50), 1), 100)
  )
  select m.id, m.sender_id, m.body, m.media_path, m.media_width, m.media_height, m.created_at, m.edited_at,
         m.deleted_at is not null,
         m.reply_to_id, r.sender_id,
         case when r.id is null then null
              when r.deleted_at is not null then 'Message deleted'
              when r.shared and r.body = '' then 'Shared a post'
              when r.body = '' then 'Image'
              else left(r.body, 140) end,
         coalesce(rs.reactions, '[]'::jsonb),
         exists (select 1 from public.chat_pins cp where cp.message_id = m.id),
         case when m.deleted_at is null then (
           select jsonb_build_object('url', lp.url, 'title', lp.title, 'description', lp.description, 'site_name', lp.site_name)
             from public.link_previews lp
            where m.link_url is not null and lp.url_hash = private.url_hash(m.link_url) and lp.status = 'ok') end,
         case when m.deleted_at is null then m.shared_post_id end,
         m.shared and m.deleted_at is null
    from page m
    left join public.chat_messages r on r.id = m.reply_to_id
    left join private.reaction_summary(array(select id from page)) rs on rs.message_id = m.id
   order by m.created_at desc;
$$;
revoke all on function private.thread_messages(uuid, timestamptz, integer) from public;
grant execute on function private.thread_messages(uuid, timestamptz, integer) to authenticated;
create function public.thread_messages(p_thread uuid, p_before timestamptz default null, p_limit integer default 50)
returns table (id uuid, sender_id uuid, body text, media_path text, media_width integer, media_height integer,
               created_at timestamptz, edited_at timestamptz, deleted boolean,
               reply_to_id uuid, reply_sender_id uuid, reply_excerpt text,
               reactions jsonb, pinned boolean, link jsonb, shared_post_id uuid, shared boolean)
  language sql stable security invoker set search_path = ''
  as $$ select * from private.thread_messages(p_thread, p_before, p_limit) $$;
revoke all on function public.thread_messages(uuid, timestamptz, integer) from public, anon;
grant execute on function public.thread_messages(uuid, timestamptz, integer) to authenticated;

-- The chat list and notifications word a share as "Shared a post".
create or replace function private.my_threads()
returns table (id uuid, type public.chat_thread_type, title text, username text, avatar_path text, venture_id uuid,
               last_message text, last_message_at timestamptz, last_sender_is_me boolean, unread integer, muted boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.type,
         case when t.type = 'group' then v.title
              when org.name is not null then o.full_name || ' · ' || org.name
              else o.full_name end,
         case when t.type = 'dm' and private.can_view_profile(o.user_id) then o.username end,
         case when t.type = 'dm' and private.can_view_profile(o.user_id) then o.avatar_path end,
         t.venture_id,
         case when lm.deleted_at is not null then 'Message deleted'
              when lm.id is not null and lm.body = '' and lm.shared then 'Shared a post'
              when lm.id is not null and lm.body = '' then 'Image'
              else left(lm.body, 140) end,
         coalesce(lm.created_at, t.created_at),
         lm.sender_id = (select auth.uid()),
         (select count(*)::integer from public.chat_messages cm
           where cm.thread_id = t.id and cm.created_at > me.last_read_at and cm.sender_id <> (select auth.uid())
             and cm.deleted_at is null and not private.is_blocked_with(cm.sender_id)),
         coalesce(me.muted_until > now(), false)
    from public.chat_thread_members me
    join public.chat_threads t on t.id = me.thread_id
    left join public.ventures v on v.id = t.venture_id
    left join public.organizations org on org.id = t.org_id
    left join lateral (
      select p.* from public.chat_thread_members om join public.profiles p on p.user_id = om.user_id
       where om.thread_id = t.id and om.user_id <> me.user_id limit 1
    ) o on t.type = 'dm'
    left join lateral (
      select cm.* from public.chat_messages cm
       where cm.thread_id = t.id and (cm.sender_id = me.user_id or not private.is_blocked_with(cm.sender_id))
       order by cm.created_at desc limit 1
    ) lm on true
   where me.user_id = (select auth.uid())
     and not private.dm_blocked(t.id)
     and (t.type = 'group' or lm.id is not null)
   order by coalesce(lm.created_at, t.created_at) desc;
$$;

create or replace function private.notify_chat_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  m record;
  v_thread public.chat_threads;
  v_data jsonb;
  v_title text;
begin
  select * into v_thread from public.chat_threads where id = new.thread_id;
  if v_thread.type = 'group' then
    select v.title into v_title from public.ventures v where v.id = v_thread.venture_id;
  end if;
  v_data := jsonb_build_object('thread_id', new.thread_id, 'venture_title', v_title,
                               'excerpt', case when new.body <> '' then left(new.body, 120)
                                               when new.shared then 'Shared a post' else 'Sent an image' end);
  for m in
    select cm.user_id from public.chat_thread_members cm
     where cm.thread_id = new.thread_id and cm.user_id <> new.sender_id
       and (cm.muted_until is null or cm.muted_until < now())
       and not private.is_blocked(cm.user_id, new.sender_id)
  loop
    update public.notifications n
       set actor_id = new.sender_id, data = v_data, created_at = now()
     where n.user_id = m.user_id and n.type = 'chat_message' and n.entity_id = new.thread_id and n.read_at is null;
    if not found then
      perform private.notify(m.user_id, new.sender_id, 'chat_message', 'chat_thread', new.thread_id, v_data);
    elsif private.push_on(m.user_id, 'chat_message') then
      -- A collapsed chat notification still pushes the new message (the device replaces it by thread).
      perform pgmq.send('notification_push', jsonb_build_object('notification_id',
        (select n.id from public.notifications n where n.user_id = m.user_id and n.type = 'chat_message'
            and n.entity_id = new.thread_id and n.read_at is null limit 1)));
    end if;
  end loop;
  return null;
end;
$$;

create function private.share_analytics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.shared then
    perform private.track(new.sender_id, 'post_shared', jsonb_build_object('thread_type',
      (select t.type from public.chat_threads t where t.id = new.thread_id)));
  end if;
  return null;
end;
$$;
revoke all on function private.share_analytics() from public;
create trigger chat_messages_share_analytics after insert on public.chat_messages
  for each row when (new.shared) execute function private.share_analytics();

-- ===========================================================================
-- People you may know
-- ===========================================================================
create table public.pymk_dismissals (
  user_id uuid not null references auth.users (id) on delete cascade,
  dismissed_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, dismissed_id),
  check (user_id <> dismissed_id)
);
comment on table public.pymk_dismissals is 'People a student dismissed from People you may know (PRD 5.34): they never return. Owner-only.';
create index pymk_dismissals_dismissed_idx on public.pymk_dismissals (dismissed_id);
alter table public.pymk_dismissals enable row level security;
revoke all on table public.pymk_dismissals from anon, authenticated;
grant select on table public.pymk_dismissals to authenticated;
create policy pymk_dismissals_owner_read on public.pymk_dismissals for select to authenticated using (user_id = (select auth.uid()));

create function private.people_you_may_know(p_limit integer default 8)
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
         and private.yearbook_dept(p.department) = private.yearbook_dept(me.department) and p.graduation_year = me.graduation_year
         and p.user_id <> v_me
      union all
      select p.user_id, 1, 'Same department', 2
        from public.profiles p
       where me.university_id is not null and p.university_id = me.university_id
         and private.yearbook_dept(p.department) = private.yearbook_dept(me.department)
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

create function private.dismiss_suggestion(p_username text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
  v_other uuid := (select p.user_id from public.profiles p where p.username = lower(btrim(coalesce(p_username, ''))));
begin
  if v_other is null or v_other = v_me then
    raise exception 'no one has that username' using errcode = 'P0002';
  end if;
  insert into public.pymk_dismissals (user_id, dismissed_id) values (v_me, v_other) on conflict do nothing;
end;
$$;

-- ===========================================================================
-- Web push
-- ===========================================================================
select pgmq.create('notification_push');

alter table public.notification_categories add column push_default boolean;
comment on column public.notification_categories.push_default is
  'Web push (PRD 5.34): null means the category is never pushed; otherwise the default while a device is subscribed.';
update public.notification_categories set push_default = true where category in ('messages', 'societies', 'record', 'growth', 'yearbook');

alter table public.notification_types add column pushed boolean not null default false;
comment on column public.notification_types.pushed is 'Sent as a web push to subscribed devices when the category''s push preference is on (PRD 5.34).';
update public.notification_types set pushed = true
 where type in ('chat_message', 'event_reminder', 'event_changed', 'event_cancelled', 'record_entry', 'induction_decided',
                'swap_request', 'swap_session_reminder', 'yearbook_note');

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://[^[:space:]]+$' and char_length(endpoint) <= 1000),
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{80,100}$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{16,30}$'),
  user_agent text check (user_agent is null or char_length(user_agent) <= 200),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  failures smallint not null default 0
);
comment on table public.push_subscriptions is 'A device''s Web Push subscription (PRD 5.34). The owner reads; written by save_push_subscription(); used only by the notify-worker.';
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table public.notification_push_prefs (
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null references public.notification_categories (category),
  push boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);
comment on table public.notification_push_prefs is 'Push on or off per category (PRD 5.34); a missing row means the category default.';
create index notification_push_prefs_category_idx on public.notification_push_prefs (category);

alter table public.push_subscriptions enable row level security;
alter table public.notification_push_prefs enable row level security;
revoke all on table public.push_subscriptions, public.notification_push_prefs from anon, authenticated;
grant select on table public.push_subscriptions, public.notification_push_prefs to authenticated;
create policy push_subscriptions_owner_read on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy notification_push_prefs_owner_read on public.notification_push_prefs for select to authenticated using (user_id = (select auth.uid()));

-- Push hosts the worker may call: the browsers' push services only (no SSRF through a subscription).
create function private.is_push_endpoint(p_endpoint text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(substring(p_endpoint from '^https://([a-z0-9.-]+)(?:/|$)') ~
    '^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|push\.services\.mozilla\.com|web\.push\.apple\.com|([a-z0-9-]+\.)+notify\.windows\.com)$', false);
$$;

-- Whether a notification of this type reaches this user's devices.
create function private.push_on(p_user uuid, p_type text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select t.pushed and c.push_default is not null and coalesce(pp.push, c.push_default)
      from public.notification_types t
      join public.notification_categories c on c.category = t.category
      left join public.notification_push_prefs pp on pp.user_id = p_user and pp.category = t.category
     where t.type = p_type), false)
    and exists (select 1 from public.push_subscriptions s where s.user_id = p_user);
$$;
revoke all on function private.push_on(uuid, text) from public;

-- The one place notifications are created (phase 6 version) plus the push queue.
create or replace function private.notify(p_user uuid, p_actor uuid, p_type text, p_entity_type text, p_entity_id uuid,
                                          p_data jsonb default '{}'::jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_actor uuid := p_actor;
  v_going uuid := nullif(current_setting('skilient.deleting_user', true), '')::uuid;
begin
  if p_user is null or p_user = v_actor or p_user = v_going then
    return null;
  end if;
  if v_actor = v_going then
    v_actor := null;
  end if;
  if v_actor is not null and private.is_blocked(p_user, v_actor) then
    return null;
  end if;
  insert into public.notifications (user_id, actor_id, type, entity_type, entity_id, data)
  values (p_user, v_actor, p_type, p_entity_type, p_entity_id, coalesce(p_data, '{}'::jsonb))
  returning id into v_id;
  if private.email_channel_for(p_user, p_type) = 'instant_email' then
    perform pgmq.send('notification_emails', jsonb_build_object('kind', 'instant', 'notification_id', v_id));
  end if;
  if private.push_on(p_user, p_type) then
    perform pgmq.send('notification_push', jsonb_build_object('notification_id', v_id));
  end if;
  return v_id;
end;
$$;

-- The worker wakes for push too.
create or replace function private.wake_notify_worker()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from pgmq.q_notification_emails where vt <= now())
     and not exists (select 1 from pgmq.q_notification_push where vt <= now()) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notify_worker_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/notify-worker',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
end;
$$;
revoke all on function private.wake_notify_worker() from public;

-- The browser needs the VAPID public key to subscribe. Never the private key.
create function private.push_public_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'vapid_public_key';
$$;

create function private.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
begin
  if not private.is_push_endpoint(p_endpoint) then
    raise exception 'this browser''s push service isn''t supported' using errcode = '22023';
  end if;
  if coalesce(p_p256dh, '') !~ '^[A-Za-z0-9_-]{80,100}$' or coalesce(p_auth, '') !~ '^[A-Za-z0-9_-]{16,30}$' then
    raise exception 'that subscription isn''t valid' using errcode = '22023';
  end if;
  if (select count(*) from public.push_subscriptions s where s.user_id = v_me and s.endpoint <> p_endpoint) >= 10 then
    raise exception 'up to 10 devices get push; turn it off on one first' using errcode = '23514';
  end if;
  -- A shared device moves to whoever subscribed last.
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (v_me, p_endpoint, p_p256dh, p_auth, left(nullif(btrim(coalesce(p_user_agent, '')), ''), 200))
  on conflict (endpoint) do update
     set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent,
         failures = 0, created_at = case when push_subscriptions.user_id = excluded.user_id then push_subscriptions.created_at else now() end;
end;
$$;

create function private.delete_push_subscription(p_endpoint text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
begin
  delete from public.push_subscriptions where user_id = v_me and (p_endpoint is null or endpoint = p_endpoint);
end;
$$;

create function private.my_push_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
begin
  return jsonb_build_object(
    'devices', (select count(*) from public.push_subscriptions s where s.user_id = v_me),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('category', c.category, 'label', c.label,
                                                                'push', coalesce(pp.push, c.push_default)) order by c.position, c.category)
                              from public.notification_categories c
                              left join public.notification_push_prefs pp on pp.user_id = v_me and pp.category = c.category
                             where c.push_default is not null), '[]'::jsonb));
end;
$$;

create function private.set_push_pref(p_category text, p_on boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.require_user();
begin
  if not exists (select 1 from public.notification_categories c where c.category = p_category and c.push_default is not null) then
    raise exception 'this kind of notification isn''t pushed' using errcode = 'P0002';
  end if;
  insert into public.notification_push_prefs (user_id, category, push) values (v_me, p_category, coalesce(p_on, false))
  on conflict (user_id, category) do update set push = excluded.push, updated_at = now();
end;
$$;

create function private.push_analytics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.track(new.user_id, 'push_enabled', '{}'::jsonb);
  return null;
end;
$$;
revoke all on function private.push_analytics() from public;
create trigger push_subscriptions_analytics after insert on public.push_subscriptions
  for each row execute function private.push_analytics();

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

select pg_temp.expose(array[
  'share_targets', 'share_post', 'undo_share', 'people_you_may_know', 'dismiss_suggestion',
  'push_public_key', 'save_push_subscription', 'delete_push_subscription', 'my_push_settings', 'set_push_pref']);
drop function pg_temp.expose(text[]);
