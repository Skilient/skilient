import { appendEvents, publishRealtime, rateLimit, uuidv7, type NewEvent } from "@skilient/platform";
import { normaliseUsername } from "../domain/profile";
import { refused } from "../refusals";
import { canViewSql, requireOnboarded } from "./profiles";
import type { Db, Tx } from "./publish";

/**
 * Friends, blocks and mutes (ported from 20260928230000_friends_blocks.sql and mute_user/my_mutes in
 * 20260929020000_comments_links.sql). Each command publishes what other services copy:
 *   friendship.changed {user_a, user_b, friends}       content's audience edges, messaging
 *   block.changed {blocker_id, blocked_id, blocked}    content, messaging, work (swaps end on a block)
 *   mute.changed {user_id, muted_id, muted}            content's feed
 *   friend_request.changed {request_id, sender_id, receiver_id, status}   notify (today's notify_friend_requests trigger)
 */
const pair = (a: string, b: string) => (a < b ? [a, b] : [b, a]) as [string, string];

async function userIdFor(db: Db, raw: string | null): Promise<string | null> {
  const [row] = await db<{ id: string }[]>`select user_id::text as id from people.profiles where username = ${normaliseUsername(raw)}`;
  return row?.id ?? null;
}

async function areFriends(db: Db, a: string, b: string): Promise<boolean> {
  const [x, y] = pair(a, b);
  const [row] = await db`select 1 from people.friendships where user_id_a = ${x} and user_id_b = ${y}`;
  return Boolean(row);
}

async function isBlocked(db: Db, a: string, b: string): Promise<boolean> {
  const [row] = await db`
    select 1 from people.blocks where (blocker_id = ${a} and blocked_id = ${b}) or (blocker_id = ${b} and blocked_id = ${a})`;
  return Boolean(row);
}

const friendship = (a: string, b: string, friends: boolean): NewEvent => {
  const [x, y] = pair(a, b);
  return { type: "friendship.changed", subjects: [x, y], payload: { user_a: x, user_b: y, friends } };
};
const requestChanged = (id: string, sender: string, receiver: string, status: string): NewEvent => ({
  type: "friend_request.changed",
  subjects: [receiver, sender],
  payload: { request_id: id, sender_id: sender, receiver_id: receiver, status },
});

/** `clear_pair`: removes the friendship and every request between two people; returns friendships removed. */
async function clearPair(tx: Tx, a: string, b: string, events: NewEvent[]): Promise<number> {
  const [x, y] = pair(a, b);
  const gone = await tx`delete from people.friendships where user_id_a = ${x} and user_id_b = ${y}`;
  const requests = await tx<{ id: string; sender_id: string; receiver_id: string; status: string }[]>`
    delete from people.friend_requests
     where (sender_id = ${a} and receiver_id = ${b}) or (sender_id = ${b} and receiver_id = ${a})
    returning id::text, sender_id::text, receiver_id::text, status`;
  if (gone.count) events.push(friendship(a, b, false));
  for (const r of requests) if (r.status === "pending") events.push(requestChanged(r.id, r.sender_id, r.receiver_id, "cancelled"));
  return gone.count;
}

/**
 * `send_friend_request`: accepts their pending request instead; else one request every 5 seconds. A suspended
 * or banned user (the token's restriction, `restricted` throws) may accept but not send (W2 Q10).
 */
export async function sendFriendRequest(tx: Tx, me: string | null, username: string | null, restricted: () => void = () => {}): Promise<{ request_id: string; status: string }[]> {
  if (!me) throw refused("not_signed_in");
  const other = await userIdFor(tx, username);
  if (!other || (await isBlocked(tx, me, other))) throw refused("no_such_user");
  if (other === me) throw refused("self_request");
  if (await areFriends(tx, me, other)) throw refused("already_friends");
  const [theirs] = await tx<{ id: string }[]>`
    select id::text from people.friend_requests where sender_id = ${other} and receiver_id = ${me} and status = 'pending' for update`;
  if (theirs) {
    await tx`update people.friend_requests set status = 'accepted', responded_at = now() where id = ${theirs.id}`;
    const [x, y] = pair(me, other);
    await tx`insert into people.friendships (user_id_a, user_id_b) values (${x}, ${y}) on conflict do nothing`;
    await appendEvents(tx, [requestChanged(theirs.id, other, me, "accepted"), friendship(me, other, true)]);
    await liveFriendsBadge(tx, me);
    return [{ request_id: theirs.id, status: "accepted" }];
  }
  // refuse_if_restricted guarded the insert of a new request (accepting theirs inserts none).
  restricted();
  if (!(await rateLimit(tx, `friend_request:${me}`, 1, 5))) throw refused("request_rate_limited");
  const id = uuidv7();
  const done = await tx`insert into people.friend_requests (id, sender_id, receiver_id) values (${id}, ${me}, ${other}) on conflict do nothing`;
  if (done.count !== 1) throw refused("request_exists");
  await appendEvents(tx, [requestChanged(id, me, other, "pending")]);
  await liveFriendsBadge(tx, other);
  return [{ request_id: id, status: "pending" }];
}

/** `respond_friend_request` */
export async function respondFriendRequest(tx: Tx, me: string | null, requestId: string, accept: boolean): Promise<void> {
  if (!me) throw refused("not_signed_in");
  const [req] = await tx<{ sender_id: string }[]>`
    select sender_id::text from people.friend_requests where id = ${requestId} and receiver_id = ${me} and status = 'pending' for update`;
  if (!req) throw refused("request_not_pending");
  if (accept && (await isBlocked(tx, me, req.sender_id))) throw refused("request_not_pending");
  await tx`update people.friend_requests set status = ${accept ? "accepted" : "declined"}, responded_at = now() where id = ${requestId}`;
  const events = [requestChanged(requestId, req.sender_id, me, accept ? "accepted" : "declined")];
  if (accept) {
    const [x, y] = pair(me, req.sender_id);
    await tx`insert into people.friendships (user_id_a, user_id_b) values (${x}, ${y}) on conflict do nothing`;
    events.push(friendship(me, req.sender_id, true));
  }
  await appendEvents(tx, events);
  await liveFriendsBadge(tx, me);
}

/** `cancel_friend_request` */
export async function cancelFriendRequest(tx: Tx, me: string | null, requestId: string): Promise<void> {
  if (!me) throw refused("not_signed_in");
  const [gone] = await tx<{ receiver_id: string }[]>`
    delete from people.friend_requests where id = ${requestId} and sender_id = ${me} and status = 'pending' returning receiver_id::text`;
  if (!gone) throw refused("request_not_pending");
  await appendEvents(tx, [requestChanged(requestId, me, gone.receiver_id, "cancelled")]);
  await liveFriendsBadge(tx, gone.receiver_id);
}

/**
 * The Friends badge, live (W4): the receiver's pending-request count to their user:{id} topic, sent by realtime
 * when this transaction commits (the open page updates without a reload).
 */
async function liveFriendsBadge(tx: Tx, userId: string): Promise<void> {
  const [row] = await tx<{ n: number }[]>`select count(*)::int as n from people.friend_requests where receiver_id = ${userId} and status = 'pending'`;
  await publishRealtime(tx, { topic: `user:${userId}`, event: "badge", payload: { key: "friends", count: row!.n } });
}

/** `unfriend` */
export async function unfriend(tx: Tx, me: string | null, username: string | null): Promise<void> {
  if (!me) throw refused("not_signed_in");
  const other = await userIdFor(tx, username);
  const events: NewEvent[] = [];
  if (!other || other === me || (await clearPair(tx, me, other, events)) === 0) throw refused("not_friends");
  await appendEvents(tx, events);
}

/** `block_user`: ends the friendship and requests; the other person isn't told. */
export async function blockUser(tx: Tx, me: string | null, username: string | null): Promise<void> {
  if (!me) throw refused("not_signed_in");
  const other = await userIdFor(tx, username);
  if (!other) throw refused("no_such_user");
  if (other === me) throw refused("self_block");
  const events: NewEvent[] = [];
  await clearPair(tx, me, other, events);
  const added = await tx`insert into people.blocks (blocker_id, blocked_id) values (${me}, ${other}) on conflict do nothing`;
  if (added.count) events.push({ type: "block.changed", subjects: [me, other], payload: { blocker_id: me, blocked_id: other, blocked: true } });
  await appendEvents(tx, events);
}

/** `unblock_user` */
export async function unblockUser(tx: Tx, me: string | null, username: string | null): Promise<void> {
  if (!me) throw refused("not_signed_in");
  const other = await userIdFor(tx, username);
  const gone = other ? await tx`delete from people.blocks where blocker_id = ${me} and blocked_id = ${other}` : { count: 0 };
  if (gone.count === 0) throw refused("not_blocked");
  await appendEvents(tx, [{ type: "block.changed", subjects: [me, other!], payload: { blocker_id: me, blocked_id: other, blocked: false } }]);
}

/** `mute_user` (mute or unmute) */
export async function muteUser(tx: Tx, me: string | null, username: string | null, mute: boolean): Promise<void> {
  if (!me) throw refused("not_signed_in");
  const other = await userIdFor(tx, username);
  if (!other || (await isBlocked(tx, me, other))) throw refused("no_such_user");
  if (other === me) throw refused("self_mute");
  const done = mute
    ? await tx`insert into people.user_mutes (user_id, muted_id) values (${me}, ${other}) on conflict do nothing`
    : await tx`delete from people.user_mutes where user_id = ${me} and muted_id = ${other}`;
  if (done.count) await appendEvents(tx, [{ type: "mute.changed", subjects: [me, other], payload: { user_id: me, muted_id: other, muted: mute } }]);
}

/** `my_friends`: avatars only where the viewer may see the profile. */
export async function myFriends(db: Db, me: string | null) {
  if (!me) throw refused("not_signed_in");
  return db<{ user_id: string; username: string | null; full_name: string; avatar_path: string | null; department: string | null; graduation_year: number | null; since: Date }[]>`
    select p.user_id::text, p.username, p.full_name, case when ${canViewSql(db, me)} then p.avatar_path end as avatar_path,
           p.department, p.graduation_year, f.created_at as since
      from people.friendships f
      join people.profiles p on p.user_id = case when f.user_id_a = ${me} then f.user_id_b else f.user_id_a end
     where ${me} in (f.user_id_a, f.user_id_b)
     order by p.full_name, p.username`;
}

/** `my_friend_requests`: pending, received and sent, newest first. */
export async function myFriendRequests(db: Db, me: string | null) {
  if (!me) throw refused("not_signed_in");
  return db<{ id: string; direction: string; user_id: string; username: string | null; full_name: string; avatar_path: string | null; department: string | null; graduation_year: number | null; created_at: Date }[]>`
    select r.id::text, case when r.receiver_id = ${me} then 'received' else 'sent' end as direction,
           p.user_id::text, p.username, p.full_name, case when ${canViewSql(db, me)} then p.avatar_path end as avatar_path,
           p.department, p.graduation_year, r.created_at
      from people.friend_requests r
      join people.profiles p on p.user_id = case when r.receiver_id = ${me} then r.sender_id else r.receiver_id end
     where r.status = 'pending' and ${me} in (r.sender_id, r.receiver_id)
     order by r.created_at desc, r.id`;
}

/** `my_blocks` */
export async function myBlocks(db: Db, me: string | null) {
  if (!me) throw refused("not_signed_in");
  return db<{ username: string | null; full_name: string; created_at: Date }[]>`
    select p.username, p.full_name, b.created_at from people.blocks b join people.profiles p on p.user_id = b.blocked_id
     where b.blocker_id = ${me} order by b.created_at desc, p.username`;
}

/** `my_mutes` */
export async function myMutes(db: Db, me: string | null) {
  if (!me) throw refused("not_signed_in");
  return db<{ username: string | null; full_name: string; created_at: Date }[]>`
    select p.username, p.full_name, m.created_at from people.user_mutes m join people.profiles p on p.user_id = m.muted_id
     where m.user_id = ${me} order by m.created_at desc, p.username`;
}

/** `friendship_state`: nothing when the username is unknown or they blocked the viewer. */
export async function friendshipState(db: Db, me: string | null, username: string | null) {
  if (!me) throw refused("not_signed_in");
  return db<{ state: string; request_id: string | null }[]>`
    with o as (select user_id as id from people.profiles where username = ${normaliseUsername(username)})
    select case
             when o.id = ${me} then 'self'
             when exists (select 1 from people.blocks b where b.blocker_id = ${me} and b.blocked_id = o.id) then 'blocked'
             when exists (select 1 from people.friendships f where f.user_id_a = least(${me}::uuid, o.id) and f.user_id_b = greatest(${me}::uuid, o.id)) then 'friends'
             when r.receiver_id = ${me} then 'received'
             when r.sender_id = ${me} then 'sent'
             else 'none'
           end as state,
           r.id::text as request_id
      from o
      left join people.friend_requests r
        on r.status = 'pending' and ((r.sender_id = ${me} and r.receiver_id = o.id) or (r.sender_id = o.id and r.receiver_id = ${me}))
     where not exists (select 1 from people.blocks b where b.blocker_id = o.id and b.blocked_id = ${me})`;
}

/** `pending_friend_request_count` */
export async function pendingFriendRequestCount(db: Db, me: string | null): Promise<number> {
  if (!me) throw refused("not_signed_in_plain");
  const [row] = await db<{ n: number }[]>`select count(*)::int as n from people.friend_requests where receiver_id = ${me} and status = 'pending'`;
  return row!.n;
}

/** `dismiss_suggestion` */
export async function dismissSuggestion(tx: Tx, me: string | null, username: string | null): Promise<void> {
  const user = await requireOnboarded(tx, me);
  const other = await userIdFor(tx, (username ?? "").replace(/^ +| +$/g, ""));
  if (!other || other === user) throw refused("no_such_user");
  await tx`insert into people.pymk_dismissals (user_id, dismissed_id) values (${user}, ${other}) on conflict do nothing`;
}
