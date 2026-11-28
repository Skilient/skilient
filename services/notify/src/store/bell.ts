import { uuidv7 } from "@skilient/platform";
import { isPushEndpoint } from "../domain/webpush";
import { refused } from "../refusals";
import { BLOCKED, publishCounts, type Db, type Tx } from "./db";

/**
 * The bell, email preferences and push settings (ported from 20260929000000_notifications.sql and
 * 20261114000003_share_reach_push.sql; each function keeps its SQL name in its comment). The caller is always the
 * token's user.
 */

export interface Row {
  id: string;
  type: string;
  category: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string;
  data: Record<string, unknown>;
  read_at: Date | null;
  created_at: Date;
}

/** `my_notifications(before, limit)`: newest first, at most 50; notices from a blocked actor left out. */
export async function myNotifications(db: Db, me: string, before: string | null, limit: number): Promise<Row[]> {
  const n = Math.min(Math.max(limit || 50, 1), 50);
  return db<Row[]>`
    select n.id::text, n.type, t.category, n.actor_id::text, n.entity_type, n.entity_id::text, n.data, n.read_at, n.created_at
      from notify.notifications n join notify.types t on t.type = n.type
     where n.user_id = ${me}
       and (${before}::timestamptz is null or n.created_at < ${before}::timestamptz)
       and (n.actor_id is null or not ${db.unsafe(BLOCKED("n.user_id", "n.actor_id"))})
     order by n.created_at desc, n.id desc
     limit ${n}`;
}

/** `unread_notification_count()` */
export async function unreadCount(db: Db, me: string): Promise<number> {
  const [r] = await db<{ n: number }[]>`
    select count(*)::int as n from notify.notifications n
     where n.user_id = ${me} and n.read_at is null and (n.actor_id is null or not ${db.unsafe(BLOCKED("n.user_id", "n.actor_id"))})`;
  return r!.n;
}

/** `mark_notification_read(id)` */
export async function markRead(tx: Tx, me: string, id: string): Promise<void> {
  const r = await tx`update notify.notifications set read_at = coalesce(read_at, now()) where id = ${id} and user_id = ${me}`;
  if (r.count === 0) throw refused("notification_not_found");
  await publishCounts(tx, [me]);
}

/** `mark_all_notifications_read()`: how many were unread. */
export async function markAllRead(tx: Tx, me: string): Promise<number> {
  const r = await tx`update notify.notifications set read_at = now() where user_id = ${me} and read_at is null`;
  if (r.count) await publishCounts(tx, [me]);
  return r.count;
}

/** `touch_activity()`: at most one write an hour. */
export async function touchActivity(tx: Tx, me: string): Promise<void> {
  await tx`
    insert into notify.activity (user_id) values (${me})
    on conflict (user_id) do update set last_active_at = now() where notify.activity.last_active_at < now() - interval '1 hour'`;
}

export interface Setting {
  category: string;
  label: string;
  description: string;
  channel: "instant_email" | "digest" | "off";
  allow_instant: boolean;
}

/** `my_notification_settings()`: every category in order, the stored instant choice folded to digest where not allowed. */
export async function mySettings(db: Db, me: string): Promise<Setting[]> {
  return db<Setting[]>`
    select c.category, c.label, c.description,
           case when coalesce(p.channel, c.default_channel) = 'instant_email' and not c.allow_instant then 'digest'
                else coalesce(p.channel, c.default_channel) end as channel,
           c.allow_instant
      from notify.categories c left join notify.prefs p on p.category = c.category and p.user_id = ${me}
     -- The stack ordered by position alone; its one tie (10: trust, added before feedback) fell in table order.
     order by c.position, c.category desc`;
}

/** `set_notification_pref(category, channel)` */
export async function setPref(tx: Tx, me: string, category: string, channel: "instant_email" | "digest" | "off"): Promise<void> {
  const [c] = await tx<{ allow_instant: boolean }[]>`select allow_instant from notify.categories where category = ${category}`;
  if (!c) throw refused("unknown_category");
  if (channel === "instant_email" && !c.allow_instant) throw refused("not_instant");
  await tx`
    insert into notify.prefs (user_id, category, channel) values (${me}, ${category}, ${channel})
    on conflict (user_id, category) do update set channel = excluded.channel, updated_at = now()`;
}

/** `my_push_settings()`: devices and each pushed category's choice. */
export async function myPushSettings(db: Db, me: string): Promise<{ devices: number; categories: { category: string; label: string; push: boolean }[] }> {
  const [r] = await db<{ devices: number; categories: { category: string; label: string; push: boolean }[] }[]>`
    select (select count(*)::int from notify.push_subscriptions s where s.user_id = ${me}) as devices,
           coalesce((select json_agg(json_build_object('category', c.category, 'label', c.label, 'push', coalesce(pp.push, c.push_default)) order by c.position, c.category)
                       from notify.categories c left join notify.push_prefs pp on pp.user_id = ${me} and pp.category = c.category
                      where c.push_default is not null), '[]') as categories`;
  return r!;
}

/** `set_push_pref(category, on)` */
export async function setPushPref(tx: Tx, me: string, category: string, on: boolean): Promise<void> {
  const [c] = await tx`select 1 from notify.categories where category = ${category} and push_default is not null`;
  if (!c) throw refused("not_pushed");
  await tx`
    insert into notify.push_prefs (user_id, category, push) values (${me}, ${category}, ${on})
    on conflict (user_id, category) do update set push = excluded.push, updated_at = now()`;
}

/** `save_push_subscription(endpoint, p256dh, auth, user_agent)`: a shared device moves to whoever subscribed last. */
export async function savePushSubscription(tx: Tx, me: string, s: { endpoint: string; p256dh: string; auth: string; userAgent: string }): Promise<void> {
  if (!isPushEndpoint(s.endpoint)) throw refused("push_service");
  if (!/^[A-Za-z0-9_-]{80,100}$/.test(s.p256dh) || !/^[A-Za-z0-9_-]{16,30}$/.test(s.auth)) throw refused("bad_subscription");
  const [n] = await tx<{ n: number }[]>`select count(*)::int as n from notify.push_subscriptions where user_id = ${me} and endpoint <> ${s.endpoint}`;
  if (n!.n >= 10) throw refused("push_devices");
  const ua = s.userAgent.trim().slice(0, 200) || null;
  await tx`
    insert into notify.push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent)
    values (${uuidv7()}, ${me}, ${s.endpoint}, ${s.p256dh}, ${s.auth}, ${ua})
    on conflict (endpoint) do update
       set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent, failures = 0,
           created_at = case when notify.push_subscriptions.user_id = excluded.user_id then notify.push_subscriptions.created_at else now() end`;
}

/** `delete_push_subscription(endpoint)`: one device, or all of the caller's (null). */
export async function deletePushSubscription(tx: Tx, me: string, endpoint: string | null): Promise<void> {
  await tx`delete from notify.push_subscriptions where user_id = ${me} and (${endpoint}::text is null or endpoint = ${endpoint})`;
}

/** user.deleted: the user's notices, choices, devices, activity and blocks go; others' notices lose the actor. */
export async function deleteUser(tx: Tx, userId: string): Promise<void> {
  await tx`delete from notify.notifications where user_id = ${userId}`;
  await tx`update notify.notifications set actor_id = null where actor_id = ${userId}`;
  await tx`delete from notify.prefs where user_id = ${userId}`;
  await tx`delete from notify.push_prefs where user_id = ${userId}`;
  await tx`delete from notify.push_subscriptions where user_id = ${userId}`;
  await tx`delete from notify.activity where user_id = ${userId}`;
  await tx`delete from notify.blocks where blocker_id = ${userId} or blocked_id = ${userId}`;
  await tx`update notify.email_sends set user_id = null where user_id = ${userId}`;
  await tx`delete from notify.email_queue where payload ->> 'user_id' = ${userId}`;
}

