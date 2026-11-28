import { appendEvents, publishRealtime, type NewEvent } from "@skilient/platform";
import type postgres from "postgres";

export type Tx = postgres.TransactionSql;
export type Db = postgres.Sql | postgres.TransactionSql;

/**
 * `email_channel_for(user, type)` as a SQL expression over `t` (types), `c` (categories) and `p` (the user's pref):
 * a type never emailed is off; billing is always instant; a stored instant choice on a category that may not email
 * instantly falls back to the digest.
 */
export const CHANNEL = `case when not t.emailed then 'off'
                             when t.category = 'billing' then 'instant_email'
                             when coalesce(p.channel, c.default_channel) = 'instant_email' and not c.allow_instant then 'digest'
                             else coalesce(p.channel, c.default_channel) end`;

/** `push_on(user, type)` without the device check, over `t`, `c` and `pp` (the user's push pref). */
export const PUSHED = `(t.pushed and c.push_default is not null and coalesce(pp.push, c.push_default))`;

/** A block either way between two columns (people's blocks, copied from block.changed). */
export const BLOCKED = (a: string, b: string) =>
  `exists (select 1 from notify.blocks k where (k.blocker_id = ${a} and k.blocked_id = ${b}) or (k.blocker_id = ${b} and k.blocked_id = ${a}))`;

/** A block either way between two people, as a fragment with parameters. */
export const blockedBetween = (db: Db, a: string, b: string) =>
  db`exists (select 1 from notify.blocks k where (k.blocker_id = ${a} and k.blocked_id = ${b}) or (k.blocker_id = ${b} and k.blocked_id = ${a}))`;

export async function publish(tx: Tx, events: NewEvent[]): Promise<void> {
  if (events.length) await appendEvents(tx, events);
}

/**
 * The nav badge: each user's unread count (blocked actors left out, as unread_notification_count did), published as
 * badge.count_changed for people's shell and on the user's realtime topic for open tabs.
 */
export async function publishCounts(tx: Tx, userIds: Iterable<string>): Promise<void> {
  const users = [...new Set(userIds)];
  if (users.length === 0) return;
  const rows = await tx<{ user_id: string; count: number }[]>`
    select u.id::text as user_id,
           (select count(*)::int from notify.notifications n
             where n.user_id = u.id and n.read_at is null
               and (n.actor_id is null or not ${tx.unsafe(BLOCKED("n.user_id", "n.actor_id"))})) as count
      from unnest(${users}::uuid[]) as u(id)`;
  for (const r of rows) await publishRealtime(tx, { topic: `user:${r.user_id}`, event: "badge", payload: { key: "notifications", count: r.count } });
  await publish(
    tx,
    rows.map((r) => ({ type: "badge.count_changed", subjects: [r.user_id], payload: { user_id: r.user_id, key: "notifications", count: r.count } })),
  );
}
