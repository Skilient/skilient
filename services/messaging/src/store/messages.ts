import { appendEvents, publishRealtime, rateLimit, uuidv7, type NewEvent } from "@skilient/platform";
import { extractLink } from "../domain/text";
import { refused } from "../refusals";
import { blockedWith, dmBlocked, excerptSql, isMember, type Db, type Tx } from "./db";
import { unreadCountsFor } from "./threads";

/**
 * Messages, reactions, pins and search (ported from 20260929050000_chat.sql, _chat_extras_explore,
 * _phase3_answers (one reaction each), _share_reach_push (send_message with a shared post, thread_messages)).
 *
 * A new message, in the same transaction:
 *   - NOTIFY realtime on thread:{id} carrying the message itself (`hidden_from`: members blocked with the
 *     sender, whose sockets realtime skips), and on user:{id} with each other member's chat badge;
 *   - `message.sent {message_id, thread_id, sender_id, recipient_ids}` for notify (W9: the chat notice and
 *     push; recipients exclude the muted and the blocked, as notify_chat_message did) and trust (analytics);
 *   - `badge.count_changed {user_id, key: chat, count}` for people's shell copy.
 */
export interface Media {
  path: string;
  width: number;
  height: number;
}

export interface SendChecks {
  /** The token's restriction (refuse_if_restricted on chat_messages). */
  restricted: () => void;
  /** Whether the shared post is visible to the sender (content's VisiblePosts, asked before the transaction). */
  postVisible: boolean;
  /** Whether media holds the image, uploaded by the sender (W9); until then only the folder is checked. */
  imageOwned?: boolean;
}

/** `send_message(thread, body, media, reply_to, shared_post)`. Returns the new message's id. */
export async function sendMessage(
  tx: Tx,
  me: string | null,
  threadId: string,
  rawBody: string,
  media: Media | null,
  replyTo: string | null,
  sharedPost: string | null,
  checks: SendChecks,
): Promise<string> {
  const [t] = me
    ? await tx<{ member: boolean; blocked: boolean }[]>`
        select ${isMember(tx, me, "t.id")} as member, ${dmBlocked(tx, me, "t.id")} as blocked from messaging.threads t where t.id = ${threadId}`
    : [];
  if (!me || !t?.member) throw refused("not_in_chat");
  if (t.blocked) throw refused("conversation_closed");
  const body = rawBody ?? "";
  if (body.length > 10000) throw refused("message_length");
  if (body.trim() === "" && !media && !sharedPost) throw refused("empty_message");
  if (sharedPost && (media || !checks.postVisible)) throw refused("post_unavailable");
  if (replyTo) {
    const [r] = await tx`select 1 from messaging.messages where id = ${replyTo} and thread_id = ${threadId} and deleted_at is null`;
    if (!r) throw refused("reply_gone");
  }
  // Until media records chat images (W9), the path is checked against the thread's folder only.
  if (media && (media.path.split("/")[0] !== threadId || checks.imageOwned === false)) throw refused("image_missing");
  if (!(await rateLimit(tx, `chat:${me}`, 30, 60))) throw refused("chat_rate_limited");
  checks.restricted();

  const id = uuidv7();
  const [m] = await tx<{ created_at: Date }[]>`
    insert into messaging.messages (id, thread_id, sender_id, body, media_path, media_width, media_height, reply_to_id, link_url, shared_post_id, shared)
    values (${id}, ${threadId}, ${me}, ${body}, ${media?.path ?? null}, ${media?.width ?? null}, ${media?.height ?? null}, ${replyTo},
            ${extractLink(body)}, ${sharedPost}, ${sharedPost !== null})
    returning created_at`;
  await tx`update messaging.threads set last_message_at = now() where id = ${threadId}`;
  await tx`update messaging.members set last_read_at = now() where thread_id = ${threadId} and user_id = ${me}`;
  await deliver(tx, id, threadId, me, { body, media, replyTo, sharedPost, createdAt: m!.created_at });
  return id;
}

/** The live message, the badges and the events of one new message (see the module note). */
async function deliver(
  tx: Tx,
  id: string,
  threadId: string,
  sender: string,
  m: { body: string; media: Media | null; replyTo: string | null; sharedPost: string | null; createdAt: Date },
): Promise<void> {
  const members = await tx<{ user_id: string; muted: boolean; blocked: boolean }[]>`
    select mm.user_id::text, coalesce(mm.muted_until > now(), false) as muted,
           exists (select 1 from messaging.blocks b where (b.blocker_id = mm.user_id and b.blocked_id = ${sender}) or (b.blocker_id = ${sender} and b.blocked_id = mm.user_id)) as blocked
      from messaging.members mm where mm.thread_id = ${threadId} and mm.user_id <> ${sender}`;
  const recipients = members.filter((x) => !x.muted && !x.blocked).map((x) => x.user_id);
  await publishRealtime(
    tx,
    {
      topic: `thread:${threadId}`,
      event: "message.sent",
      payload: {
        id,
        thread_id: threadId,
        sender_id: sender,
        body: m.body,
        media_path: m.media?.path ?? null,
        media_width: m.media?.width ?? null,
        media_height: m.media?.height ?? null,
        reply_to_id: m.replyTo,
        shared_post_id: m.sharedPost,
        shared: m.sharedPost !== null,
        created_at: m.createdAt.toISOString(),
      },
      hidden_from: members.filter((x) => x.blocked).map((x) => x.user_id),
    },
    { id, thread_id: threadId },
  );
  const counts = await unreadCountsFor(tx, members.filter((x) => !x.blocked).map((x) => x.user_id));
  const events: NewEvent[] = [{ type: "message.sent", subjects: [id, threadId, sender], payload: { message_id: id, thread_id: threadId, sender_id: sender, recipient_ids: recipients } }];
  for (const x of members.filter((y) => !y.blocked)) {
    const count = counts.get(x.user_id) ?? 0;
    await publishRealtime(tx, { topic: `user:${x.user_id}`, event: "badge", payload: { key: "chat", count } });
    events.push({ type: "badge.count_changed", subjects: [x.user_id], payload: { user_id: x.user_id, key: "chat", count } });
  }
  await appendEvents(tx, events);
}

/** `edit_message`: the sender's own message, not deleted, not in a blocked DM; the link is read again. */
export async function editMessage(tx: Tx, me: string | null, messageId: string, rawBody: string): Promise<void> {
  const body = rawBody ?? "";
  if (body.length > 10000) throw refused("message_length");
  const [m] = await tx<{ thread_id: string }[]>`
    update messaging.messages m set body = ${body}, edited_at = now(), link_url = ${extractLink(body)}
     where m.id = ${messageId} and m.sender_id = ${me}::uuid and m.deleted_at is null
       and (btrim(${body}) <> '' or m.media_path is not null)
       and not ${dmBlocked(tx, me, "m.thread_id")}
    returning m.thread_id::text`;
  if (!m) throw refused("edit_own_only");
  await publishRealtime(tx, { topic: `thread:${m.thread_id}`, event: "message.edited", payload: { id: messageId, body } }, { id: messageId });
}

/** `delete_message`: blanks the sender's own message; returns its image path. */
export async function deleteMessage(tx: Tx, me: string | null, messageId: string): Promise<string | null> {
  const [m] = await tx<{ thread_id: string; path: string | null }[]>`
    with old as (select id, media_path from messaging.messages where id = ${messageId} and sender_id = ${me}::uuid and deleted_at is null for update)
    update messaging.messages m set deleted_at = now(), body = '', media_path = null, media_width = null, media_height = null, link_url = null
      from old where m.id = old.id
    returning m.thread_id::text, old.media_path as path`;
  if (!m) throw refused("delete_own_only");
  await publishRealtime(tx, { topic: `thread:${m.thread_id}`, event: "message.deleted", payload: { id: messageId } });
  if (m.path) await appendEvents(tx, [{ type: "message.deleted", subjects: [messageId, m.thread_id], payload: { message_ids: [messageId], thread_id: m.thread_id, sender_id: me, media_paths: [m.path] } }]);
  return m.path;
}

export interface MessageRow {
  id: string;
  sender_id: string;
  body: string;
  media_path: string | null;
  media_width: number | null;
  media_height: number | null;
  created_at: Date;
  edited_at: Date | null;
  deleted: boolean;
  reply_to_id: string | null;
  reply_sender_id: string | null;
  reply_excerpt: string | null;
  reactions: { emoji: string; count: number; mine: boolean }[];
  pinned: boolean;
  link_url: string | null;
  shared_post_id: string | null;
  shared: boolean;
}

const EMOJI = ["👍", "❤️", "😂", "🎉", "😮", "🙏"] as const;

/** `thread_messages(thread, before, limit)`: newest first, with replies, reactions and pins, in one query. */
export async function threadMessages(db: Db, me: string | null, threadId: string, before: string | null, rawLimit: number | null): Promise<MessageRow[]> {
  if (!me) throw refused("not_signed_in");
  const limit = Math.min(Math.max(rawLimit ?? 50, 1), 100);
  return db<MessageRow[]>`
    with page as (
      select m.* from messaging.messages m
       where m.thread_id = ${threadId} and ${isMember(db, me, "m.thread_id")} and not ${dmBlocked(db, me, "m.thread_id")}
         and (${before}::text is null or m.created_at < ${before}::text::timestamptz)
       order by m.created_at desc
       limit ${limit})
    select m.id::text, m.sender_id::text, m.body, m.media_path, m.media_width, m.media_height, m.created_at, m.edited_at,
           m.deleted_at is not null as deleted, m.reply_to_id::text, r.sender_id::text as reply_sender_id,
           ${db.unsafe(`case when r.id is null then null else ${excerptSql("r")} end`)} as reply_excerpt,
           coalesce((
             select jsonb_agg(jsonb_build_object('emoji', x.emoji, 'count', x.n, 'mine', x.mine) order by array_position(${EMOJI as unknown as string[]}::text[], x.emoji))
               from (select mr.emoji, count(*)::int as n, bool_or(mr.user_id = ${me}::uuid) as mine
                       from messaging.reactions mr
                      where mr.message_id = m.id and (mr.user_id = ${me}::uuid or not ${blockedWith(db, me, "mr.user_id")})
                      group by mr.emoji) x), '[]'::jsonb) as reactions,
           exists (select 1 from messaging.pins cp where cp.message_id = m.id) as pinned,
           case when m.deleted_at is null then m.link_url end as link_url,
           case when m.deleted_at is null then m.shared_post_id::text end as shared_post_id,
           m.shared and m.deleted_at is null as shared
      from page m left join messaging.messages r on r.id = m.reply_to_id
     order by m.created_at desc`;
}

/** `toggle_reaction`: adds, switches or removes the reader's one reaction. Returns whether one is on. */
export async function toggleReaction(tx: Tx, me: string | null, messageId: string, emoji: string, restricted: () => void): Promise<boolean> {
  const [m] = await tx<{ thread_id: string; ok: boolean }[]>`
    select m.thread_id::text, ${isMember(tx, me, "m.thread_id")} and not ${dmBlocked(tx, me, "m.thread_id")} as ok
      from messaging.messages m where m.id = ${messageId} and m.deleted_at is null`;
  if (!m?.ok) throw refused("message_unavailable");
  if (!(EMOJI as readonly string[]).includes(emoji)) throw refused("reaction_choice");
  const removed = await tx`delete from messaging.reactions where message_id = ${messageId} and user_id = ${me} and emoji = ${emoji}`;
  let on = false;
  if (removed.count === 0) {
    if (!(await rateLimit(tx, `react:${me}`, 60, 60))) throw refused("reaction_rate_limited");
    restricted();
    await tx`
      insert into messaging.reactions (message_id, thread_id, user_id, emoji) values (${messageId}, ${m.thread_id}, ${me}, ${emoji})
      on conflict (message_id, user_id) do update set emoji = excluded.emoji, created_at = now()`;
    on = true;
  }
  await publishRealtime(tx, { topic: `thread:${m.thread_id}`, event: "reaction.changed", payload: { message_id: messageId } });
  return on;
}

/** `reaction_summary(messages)`: each message's reactions for the reader (members only; blocked users' left out). */
export async function reactionSummary(db: Db, me: string | null, ids: readonly string[]): Promise<{ message_id: string; reactions: { emoji: string; count: number; mine: boolean }[] }[]> {
  if (!me) throw refused("not_signed_in");
  return db`
    select r.message_id::text, jsonb_agg(jsonb_build_object('emoji', r.emoji, 'count', r.n, 'mine', r.mine)
                                         order by array_position(${EMOJI as unknown as string[]}::text[], r.emoji)) as reactions
      from (select mr.message_id, mr.emoji, count(*)::int as n, bool_or(mr.user_id = ${me}::uuid) as mine
              from messaging.reactions mr
             where mr.message_id = any(${ids as string[]}::uuid[])
               and ${isMember(db, me, "mr.thread_id")} and not ${dmBlocked(db, me, "mr.thread_id")}
               and (mr.user_id = ${me}::uuid or not ${blockedWith(db, me, "mr.user_id")})
             group by mr.message_id, mr.emoji) r
     group by r.message_id`;
}

/** `pin_message`: the venture owner, in the team chat, at most 3 pins. */
export async function pinMessage(tx: Tx, me: string | null, messageId: string, pin: boolean, restricted: () => void): Promise<void> {
  const [t] = await tx<{ id: string }[]>`
    select t.id::text from messaging.messages m
      join messaging.threads t on t.id = m.thread_id and t.type = 'group'
      join messaging.ventures v on v.venture_id = t.venture_id and v.owner_id = ${me}::uuid
     where m.id = ${messageId} and m.deleted_at is null and ${isMember(tx, me, "t.id")}`;
  if (!t) throw refused("pin_owner_only");
  if (!pin) {
    await tx`delete from messaging.pins where message_id = ${messageId}`;
    return;
  }
  // Serialise pins per thread so two parallel pins can't make a fourth.
  await tx`select 1 from messaging.threads where id = ${t.id} for update`;
  const [state] = await tx<{ pinned: boolean; n: number }[]>`
    select exists (select 1 from messaging.pins where message_id = ${messageId}) as pinned, (select count(*)::int from messaging.pins where thread_id = ${t.id}) as n`;
  if (state!.pinned) return;
  if (state!.n >= 3) throw refused("pins_full");
  restricted();
  await tx`insert into messaging.pins (message_id, thread_id, pinned_by) values (${messageId}, ${t.id}, ${me})`;
}

/** `thread_pins(thread)`. */
export async function threadPins(db: Db, me: string | null, threadId: string): Promise<{ message_id: string; sender_id: string; excerpt: string; pinned_at: Date }[]> {
  if (!me) throw refused("not_signed_in");
  return db`
    select p.message_id::text, m.sender_id::text, case when m.body = '' then 'Image' else left(m.body, 140) end as excerpt, p.pinned_at
      from messaging.pins p join messaging.messages m on m.id = p.message_id
     where p.thread_id = ${threadId} and ${isMember(db, me, "p.thread_id")} and m.deleted_at is null
     order by p.pinned_at`;
}

/** `prefix_tsquery`: words of letters and digits, 2+ characters, at most 8, each a prefix; null when none. */
export function prefixQuery(q: string): string | null {
  const words = q
    .slice(0, 100)
    .split(/[^\p{L}\p{N}]+/u)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length >= 2)
    .slice(0, 8);
  return words.length ? words.map((w) => `'${w.replace(/'/g, "''")}':*`).join(" & ") : null;
}

export interface HitRow {
  message_id: string;
  thread_id: string;
  thread_type: string;
  venture_id: string | null;
  other_id: string | null;
  sender_id: string;
  excerpt: string;
  created_at: Date;
}

/** `search_chats(q, thread)`: the reader's messages, newest 30. */
export async function searchChats(db: Db, me: string | null, q: string, threadId: string | null): Promise<HitRow[]> {
  if (!me) throw refused("not_signed_in");
  const query = prefixQuery(q);
  if (!query || q.trim().length < 2) return [];
  return db<HitRow[]>`
    select m.id::text as message_id, m.thread_id::text, t.type as thread_type, t.venture_id::text, o.user_id::text as other_id,
           m.sender_id::text, left(m.body, 200) as excerpt, m.created_at
      from messaging.members me
      join messaging.threads t on t.id = me.thread_id
      join messaging.messages m on m.thread_id = t.id
      left join lateral (select om.user_id from messaging.members om where om.thread_id = t.id and om.user_id <> me.user_id limit 1) o on t.type = 'dm'
     where me.user_id = ${me}
       and (${threadId}::uuid is null or t.id = ${threadId}::uuid)
       and not ${dmBlocked(db, me, "t.id")}
       and m.deleted_at is null
       and m.search @@ to_tsquery('simple', ${query})
       and (m.sender_id = ${me} or not ${blockedWith(db, me, "m.sender_id")})
     order by m.created_at desc
     limit 30`;
}
