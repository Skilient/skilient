import { appendEvents } from "@skilient/platform";
import { refused } from "../refusals";
import { canViewProfile, dmBlocked, type Db, type Tx } from "./db";
import { sendMessage } from "./messages";

/**
 * The chat half of sharing a post (ported from 20261114000003_share_reach_push.sql: share_targets, share_post,
 * undo_share). Whether the sharer may see the post is content's (VisiblePosts, asked once before the
 * transaction); each shared message goes through sendMessage, so it is delivered and counted like any other.
 */
export interface TargetRow {
  id: string;
  type: string;
  venture_id: string | null;
  other_id: string | null;
  other_visible: boolean;
  last_at: Date | null;
}

/** `share_targets(q)`: the reader's DMs and venture chats (not blocked), newest 30; names matched by the caller. */
export async function shareTargets(db: Db, me: string | null): Promise<TargetRow[]> {
  if (!me) throw refused("not_signed_in");
  return db<TargetRow[]>`
    select t.id::text, t.type, t.venture_id::text, o.user_id::text as other_id,
           coalesce(o.user_id is not null and ${canViewProfile(db, me, "o.user_id")}, false) as other_visible, t.last_message_at as last_at
      from messaging.members me
      join messaging.threads t on t.id = me.thread_id
      left join lateral (select om.user_id from messaging.members om where om.thread_id = t.id and om.user_id <> me.user_id limit 1) o on t.type = 'dm'
     where me.user_id = ${me}
       and not ${dmBlocked(db, me, "t.id")}
       and ((t.type = 'group' and t.venture_id is not null) or (t.type = 'dm' and o.user_id is not null))
     order by t.last_message_at desc nulls last`;
}

/**
 * `share_post(post, threads, note)`: the post into up to 5 DMs or venture chats, each a message with the note.
 * `visible` is content's answer for the sharer.
 */
export async function sharePost(
  tx: Tx,
  me: string | null,
  postId: string | null,
  threads: readonly string[] | null,
  note: string | null,
  visible: boolean,
  restricted: () => void,
): Promise<string[]> {
  if (!me) throw refused("not_signed_in_plain");
  if (!postId || !visible) throw refused("share_unavailable");
  if (!threads || threads.length === 0) throw refused("pick_chat");
  if (threads.length > 5) throw refused("share_max");
  if ((note ?? "").length > 1000) throw refused("note_length");
  const ids: string[] = [];
  for (const t of [...new Set(threads)]) {
    const [ok] = await tx`select 1 from messaging.threads where id = ${t} and (type = 'dm' or venture_id is not null)`;
    if (!ok) throw refused("share_where");
    ids.push(await sendMessage(tx, me, t, (note ?? "").trim(), null, null, postId, { restricted, postVisible: true }));
  }
  return ids;
}

/** `undo_share(messages)`: the sharer's shared messages from the last 15 seconds. Returns how many went. */
export async function undoShare(tx: Tx, me: string | null, messageIds: readonly string[]): Promise<number> {
  if (!me) throw refused("not_signed_in_plain");
  const gone = await tx<{ id: string; thread_id: string }[]>`
    delete from messaging.messages
     where id = any(${messageIds as string[]}::uuid[]) and sender_id = ${me} and shared and created_at > now() - interval '15 seconds'
    returning id::text, thread_id::text`;
  if (gone.length === 0) throw refused("undo_late");
  // notify takes back the chat notices those messages raised (W9).
  const byThread = new Map<string, string[]>();
  for (const g of gone) byThread.set(g.thread_id, [...(byThread.get(g.thread_id) ?? []), g.id]);
  await appendEvents(
    tx,
    [...byThread].map(([threadId, ids]) => ({
      type: "message.deleted",
      subjects: [threadId, me],
      payload: { message_ids: ids, thread_id: threadId, sender_id: me, media_paths: [], undone_share: true },
    })),
  );
  return gone.length;
}
