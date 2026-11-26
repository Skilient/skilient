import { appendEvents, uuidv7 } from "@skilient/platform";
import { refused } from "../refusals";
import { blockedWith, canViewProfile, dmBlocked, excerptSql, isMember, type Db, type Tx } from "./db";

/**
 * Threads and members (ported from 20260929050000_chat.sql with the later get_or_create_dm (_skill_swap),
 * my_threads (_chat_deleted_member), dm_blocked and thread_people (_recruiter_talent) and dm_receipt
 * (_chat_extras_explore)). Reading a thread publishes `thread.read {thread_id, user_id}` for notify (its
 * chat notices for the thread are read, W9).
 */
const pair = (a: string, b: string) => (a < b ? [a, b] : [b, a]) as [string, string];

/** `get_or_create_dm`: `other` is the username's user id (people's ResolveUsernames), or null. */
export async function getOrCreateDm(tx: Tx, me: string | null, other: string | null): Promise<string> {
  if (!me) throw refused("not_signed_in");
  const [x, y] = other ? pair(me, other) : [me, me];
  const [rel] = other
    ? await tx<{ blocked: boolean; allowed: boolean }[]>`
        select exists (select 1 from messaging.blocks b where (b.blocker_id = ${me} and b.blocked_id = ${other}) or (b.blocker_id = ${other} and b.blocked_id = ${me})) as blocked,
               exists (select 1 from messaging.friendships f where f.user_id_a = ${x} and f.user_id_b = ${y})
                 or exists (select 1 from messaging.dm_allowances a where a.user_id_a = ${x} and a.user_id_b = ${y}) as allowed`
    : [];
  if (!other || rel!.blocked) throw refused("no_such_user");
  if (other === me) throw refused("self_message");
  if (!rel!.allowed) throw refused("dm_not_allowed");
  const key = `${x}:${y}`;
  // Serialise the pair so two parallel first messages make one thread.
  await tx`select pg_advisory_xact_lock(hashtextextended(${"dm:" + key}, 0))`;
  const [found] = await tx<{ id: string }[]>`select id::text from messaging.threads where type = 'dm' and dm_key = ${key}`;
  if (found) return found.id;
  const id = uuidv7();
  await tx`insert into messaging.threads (id, type, dm_key) values (${id}, 'dm', ${key})`;
  await tx`insert into messaging.members (thread_id, user_id) values (${id}, ${me}), (${id}, ${other})`;
  return id;
}

export interface ThreadRow {
  id: string;
  type: string;
  venture_id: string | null;
  org_id: string | null;
  other_id: string | null;
  other_visible: boolean;
  last_message: string | null;
  last_message_at: Date;
  last_sender_is_me: boolean | null;
  unread: number;
  muted: boolean;
}

/** `my_threads`: every thread the reader is in (a DM only once it has a message), newest first. */
export async function myThreads(db: Db, me: string | null): Promise<ThreadRow[]> {
  if (!me) throw refused("not_signed_in");
  return db<ThreadRow[]>`
    select t.id::text, t.type, t.venture_id::text, t.org_id::text, o.user_id::text as other_id,
           coalesce(o.user_id is not null and ${canViewProfile(db, me, "o.user_id")}, false) as other_visible,
           ${db.unsafe(`case when lm.id is null then null else ${excerptSql("lm")} end`)} as last_message,
           coalesce(lm.created_at, t.created_at) as last_message_at,
           lm.sender_id = ${me}::uuid as last_sender_is_me,
           (select count(*)::int from messaging.messages cm
             where cm.thread_id = t.id and cm.created_at > me.last_read_at and cm.sender_id <> ${me}::uuid
               and cm.deleted_at is null and not ${blockedWith(db, me, "cm.sender_id")}) as unread,
           coalesce(me.muted_until > now(), false) as muted
      from messaging.members me
      join messaging.threads t on t.id = me.thread_id
      left join lateral (select om.user_id from messaging.members om where om.thread_id = t.id and om.user_id <> me.user_id limit 1) o on t.type = 'dm'
      left join lateral (
        select cm.* from messaging.messages cm
         where cm.thread_id = t.id and (cm.sender_id = me.user_id or not ${blockedWith(db, me, "cm.sender_id")})
         order by cm.created_at desc limit 1) lm on true
     where me.user_id = ${me}::uuid
       and not ${dmBlocked(db, me, "t.id")}
       and (t.type = 'group' or lm.id is not null)
     order by coalesce(lm.created_at, t.created_at) desc`;
}

/** `unread_chat_count`: unread messages in threads that are not muted (the nav badge). One query. */
export async function unreadChatCount(db: Db, me: string | null): Promise<number> {
  if (!me) throw refused("not_signed_in");
  const [r] = await db<{ n: number }[]>`
    select coalesce(sum((select count(*) from messaging.messages cm
                          where cm.thread_id = t.id and cm.created_at > me.last_read_at and cm.sender_id <> ${me}::uuid
                            and cm.deleted_at is null and not ${blockedWith(db, me, "cm.sender_id")})), 0)::int as n
      from messaging.members me join messaging.threads t on t.id = me.thread_id
     where me.user_id = ${me}::uuid and not coalesce(me.muted_until > now(), false)
       and not ${dmBlocked(db, me, "t.id")}
       and (t.type = 'group' or exists (select 1 from messaging.messages x where x.thread_id = t.id
                                          and (x.sender_id = me.user_id or not ${blockedWith(db, me, "x.sender_id")})))`;
  return r!.n;
}

/** Unread totals (not muted) for many readers at once: the chat badge after a message (one query). */
export async function unreadCountsFor(db: Db, users: readonly string[]): Promise<Map<string, number>> {
  if (users.length === 0) return new Map();
  const rows = await db<{ user_id: string; n: number }[]>`
    select me.user_id::text, coalesce(sum((
             select count(*) from messaging.messages cm
              where cm.thread_id = me.thread_id and cm.created_at > me.last_read_at and cm.sender_id <> me.user_id and cm.deleted_at is null
                and not exists (select 1 from messaging.blocks b where (b.blocker_id = me.user_id and b.blocked_id = cm.sender_id)
                                                              or (b.blocker_id = cm.sender_id and b.blocked_id = me.user_id)))), 0)::int as n
      from messaging.members me
     where me.user_id = any(${users as string[]}::uuid[]) and not coalesce(me.muted_until > now(), false)
       and not exists (
         select 1 from messaging.threads bt join messaging.members bm on bm.thread_id = bt.id
          where bt.id = me.thread_id and bt.type = 'dm' and bm.user_id <> me.user_id
            and (bt.closed_at is not null
                 or exists (select 1 from messaging.blocks b where (b.blocker_id = me.user_id and b.blocked_id = bm.user_id)
                                                          or (b.blocker_id = bm.user_id and b.blocked_id = me.user_id))))
     group by me.user_id`;
  return new Map(rows.map((r) => [r.user_id, r.n]));
}

/** `venture_chat(venture)`: the team chat, if the reader is in it. */
export async function ventureChat(db: Db, me: string | null, ventureId: string): Promise<string | null> {
  if (!me) throw refused("not_signed_in");
  const [r] = await db<{ id: string }[]>`
    select t.id::text from messaging.threads t where t.type = 'group' and t.venture_id = ${ventureId} and ${isMember(db, me, "t.id")}`;
  return r?.id ?? null;
}

export interface PersonRow {
  user_id: string;
  blocked: boolean;
  visible: boolean;
  is_me: boolean;
  org_id: string | null;
}

/** `thread_people(thread)`: the members, for a member of a thread that is not a blocked DM. */
export async function threadPeople(db: Db, me: string | null, threadId: string): Promise<PersonRow[]> {
  if (!me) throw refused("not_signed_in");
  return db<PersonRow[]>`
    select m.user_id::text, ${blockedWith(db, me, "m.user_id")} as blocked,
           not ${blockedWith(db, me, "m.user_id")} and ${canViewProfile(db, me, "m.user_id")} as visible,
           m.user_id = ${me}::uuid as is_me, t.org_id::text
      from messaging.members m join messaging.threads t on t.id = m.thread_id
     where m.thread_id = ${threadId} and ${isMember(db, me, "t.id")} and not ${dmBlocked(db, me, "t.id")}`;
}

/** `mute_thread`: hours ≤ 0 unmutes; a year or more mutes until unmuted. */
export async function muteThread(tx: Tx, me: string | null, threadId: string, hours: number): Promise<void> {
  const until = hours <= 0 ? null : hours >= 8760 ? tx`'infinity'::timestamptz` : tx`now() + make_interval(hours => ${hours})`;
  const done = await tx`update messaging.members set muted_until = ${until} where thread_id = ${threadId} and user_id = ${me}::uuid`;
  if (done.count !== 1) throw refused("not_in_chat");
}

/** `mark_thread_read`: the reader's read mark to now; notify marks the thread's chat notices read (thread.read). */
export async function markThreadRead(tx: Tx, me: string | null, threadId: string): Promise<void> {
  const done = await tx`update messaging.members set last_read_at = now() where thread_id = ${threadId} and user_id = ${me}::uuid`;
  if (done.count !== 1) throw refused("not_in_chat");
  await appendEvents(tx, [{ type: "thread.read", subjects: [threadId, me!], payload: { thread_id: threadId, user_id: me } }]);
}

/** `dm_receipt`: when the other person last read the DM, if both have read receipts on. */
export async function dmReceipt(db: Db, me: string | null, threadId: string): Promise<Date | null> {
  if (!me) throw refused("not_signed_in");
  const [r] = await db<{ at: Date }[]>`
    select o.last_read_at as at
      from messaging.threads t
      join messaging.members o on o.thread_id = t.id and o.user_id <> ${me}::uuid
      join messaging.profiles op on op.user_id = o.user_id and op.read_receipts
      join messaging.profiles mp on mp.user_id = ${me}::uuid and mp.read_receipts
     where t.id = ${threadId} and t.type = 'dm' and ${isMember(db, me, "t.id")} and not ${dmBlocked(db, me, "t.id")}`;
  return r?.at ?? null;
}

/** OpenContactThread (market, W11): the pair's DM, labelled with the organisation; opened again if it was closed. */
export async function openContactThread(tx: Tx, student: string, recruiter: string, orgId: string): Promise<string> {
  const [x, y] = pair(student, recruiter);
  const key = `${x}:${y}`;
  await tx`select pg_advisory_xact_lock(hashtextextended(${"dm:" + key}, 0))`;
  const [found] = await tx<{ id: string }[]>`
    update messaging.threads set org_id = ${orgId}, closed_at = null where type = 'dm' and dm_key = ${key} returning id::text`;
  if (found) return found.id;
  const id = uuidv7();
  await tx`insert into messaging.threads (id, type, dm_key, org_id) values (${id}, 'dm', ${key}, ${orgId})`;
  await tx`insert into messaging.members (thread_id, user_id) values (${id}, ${student}), (${id}, ${recruiter})`;
  return id;
}

/** CloseThread (market, W11): `close_contact_chat`'s thread half. */
export async function closeThread(tx: Tx, threadId: string): Promise<boolean> {
  return (await tx`update messaging.threads set closed_at = coalesce(closed_at, now()) where id = ${threadId} and org_id is not null`).count === 1;
}
