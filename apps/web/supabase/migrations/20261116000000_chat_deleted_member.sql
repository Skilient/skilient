-- Chat: a DM whose other member deleted their account (2026-11-15).
--
-- chat_thread_members.user_id cascades from auth.users, so when the other person in a DM is
-- deleted (their own request, or the phase 14 portal clean-up) the thread survives with the
-- caller as its only member. my_threads() built the title from that missing member, returned
-- null, and the thread list crashed on it. The title is now never null.

create or replace function private.my_threads()
returns table (id uuid, type public.chat_thread_type, title text, username text, avatar_path text, venture_id uuid,
               last_message text, last_message_at timestamptz, last_sender_is_me boolean, unread integer, muted boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.type,
         coalesce(
           case when t.type = 'group' then v.title
                when org.name is not null then o.full_name || ' · ' || org.name
                else o.full_name end,
           case when t.type = 'group' then 'Venture chat' else 'Deleted account' end),
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
