import { appendEvents, createConsumer, uuidv7, type Consumer, type LoggedEvent, type Logger } from "@skilient/platform";
import type postgres from "postgres";
import { z } from "zod";
import type { Tx } from "./db";

/**
 * Messaging's event-fed copies and the events that change chats (one consumer, `messaging.copies`). Each
 * event type has one owning producer role; anything else is logged and dropped. Idempotent throughout.
 *
 * | Event (v1)               | From     | Effect                                                                       |
 * | ------------------------ | -------- | ---------------------------------------------------------------------------- |
 * | profile.updated          | people   | visibility, university, read receipts                                        |
 * | friendship.changed       | people   | who may open a DM                                                            |
 * | block.changed            | people   | blocked DMs, hidden messages                                                 |
 * | conversation.allowed     | work (W5) | DMs an accepted application or a skill swap opens                           |
 * | venture.updated          | work (W5) | the venture's owner (pins); the team chat is made the first time (ventures_chat) |
 * | group.member_changed     | work (W5) | team chat membership follows the venture's (venture_members_chat); societies ignored |
 * | moderation.removed          | trust (W10) | a message removed by staff (target_type message)                          |
 * | user.deleted             | identity | the user's messages, memberships, reactions and pins; user.deletion_confirmed |
 */
export const COPIES_CONSUMER = "messaging.copies";
export const COPY_EVENTS = [
  "profile.updated",
  "friendship.changed",
  "block.changed",
  "conversation.allowed",
  "venture.updated",
  "group.member_changed",
  "moderation.removed",
  "user.deleted",
] as const;

const OWNER: Record<(typeof COPY_EVENTS)[number], readonly string[]> = {
  "profile.updated": ["svc_people"],
  "friendship.changed": ["svc_people"],
  "block.changed": ["svc_people"],
  "conversation.allowed": ["svc_work"],
  "venture.updated": ["svc_work"],
  "group.member_changed": ["svc_work", "svc_community"],
  "moderation.removed": ["svc_trust"],
  "user.deleted": ["svc_identity"],
};

const id = z.uuid();
const S = {
  profile: z.object({
    user_id: id,
    university_id: id.nullable(),
    visibility: z.enum(["friends", "university", "global"]),
    status: z.string(),
    read_receipts: z.boolean(),
  }),
  friendship: z.object({ user_a: id, user_b: id, friends: z.boolean() }),
  block: z.object({ blocker_id: id, blocked_id: id, blocked: z.boolean() }),
  allowed: z.object({ user_a: id, user_b: id, reason: z.enum(["application", "swap"]), allowed: z.boolean() }),
  venture: z.object({ venture_id: id, owner_id: id }),
  group: z.object({ kind: z.enum(["venture", "society"]), group_id: id, user_id: id, member: z.boolean() }),
  removal: z.object({ target_type: z.string(), target_id: id, staff_id: id.nullable().optional() }),
};

export type CopyOutcome = "applied" | "ignored" | "wrong_producer" | "invalid_payload" | "unknown_type";

/** Applies one event (the consumer's handler; exported for tests and replays). */
export async function applyCopyEvent(tx: Tx, event: Pick<LoggedEvent, "type" | "producer" | "payload" | "version" | "subjects">): Promise<CopyOutcome> {
  if (event.version !== 1) return "invalid_payload";
  const type = event.type as (typeof COPY_EVENTS)[number];
  if (!(type in OWNER)) return "unknown_type";
  if (!OWNER[type].includes(event.producer)) return "wrong_producer";
  const parse = <T>(schema: z.ZodType<T>): T | null => {
    const r = schema.safeParse(event.payload);
    return r.success ? r.data : null;
  };
  const pair = (a: string, b: string) => (a < b ? [a, b] : [b, a]) as [string, string];
  switch (type) {
    case "profile.updated": {
      const p = parse(S.profile);
      if (!p) return "invalid_payload";
      await tx`
        insert into messaging.profiles (user_id, university_id, visibility, read_receipts, status) values (${p.user_id}, ${p.university_id}, ${p.visibility}, ${p.read_receipts}, ${p.status})
        on conflict (user_id) do update set university_id = excluded.university_id, visibility = excluded.visibility,
          read_receipts = excluded.read_receipts, status = excluded.status, updated_at = now()`;
      return "applied";
    }
    case "friendship.changed": {
      const p = parse(S.friendship);
      if (!p) return "invalid_payload";
      const [a, b] = pair(p.user_a, p.user_b);
      if (p.friends) await tx`insert into messaging.friendships (user_id_a, user_id_b) values (${a}, ${b}) on conflict do nothing`;
      else await tx`delete from messaging.friendships where user_id_a = ${a} and user_id_b = ${b}`;
      return "applied";
    }
    case "block.changed": {
      const p = parse(S.block);
      if (!p) return "invalid_payload";
      if (p.blocked) await tx`insert into messaging.blocks (blocker_id, blocked_id) values (${p.blocker_id}, ${p.blocked_id}) on conflict do nothing`;
      else await tx`delete from messaging.blocks where blocker_id = ${p.blocker_id} and blocked_id = ${p.blocked_id}`;
      return "applied";
    }
    case "conversation.allowed": {
      const p = parse(S.allowed);
      if (!p) return "invalid_payload";
      const [a, b] = pair(p.user_a, p.user_b);
      if (p.allowed) await tx`insert into messaging.dm_allowances (user_id_a, user_id_b, reason) values (${a}, ${b}, ${p.reason}) on conflict do nothing`;
      else await tx`delete from messaging.dm_allowances where user_id_a = ${a} and user_id_b = ${b} and reason = ${p.reason}`;
      return "applied";
    }
    case "venture.updated": {
      const p = parse(S.venture);
      if (!p) return "invalid_payload";
      await tx`
        insert into messaging.ventures (venture_id, owner_id) values (${p.venture_id}, ${p.owner_id})
        on conflict (venture_id) do update set owner_id = excluded.owner_id, updated_at = now()`;
      await tx`insert into messaging.threads (id, type, venture_id) values (${uuidv7()}, 'group', ${p.venture_id}) on conflict (venture_id) do nothing`;
      return "applied";
    }
    case "group.member_changed": {
      const p = parse(S.group);
      if (!p) return "invalid_payload";
      if (p.kind !== "venture") return "ignored";
      if (event.producer !== "svc_work") return "wrong_producer";
      await tx`insert into messaging.threads (id, type, venture_id) values (${uuidv7()}, 'group', ${p.group_id}) on conflict (venture_id) do nothing`;
      if (p.member)
        await tx`
          insert into messaging.members (thread_id, user_id)
          select t.id, ${p.user_id} from messaging.threads t where t.type = 'group' and t.venture_id = ${p.group_id}
          on conflict do nothing`;
      else
        await tx`
          delete from messaging.members m using messaging.threads t
           where t.id = m.thread_id and t.type = 'group' and t.venture_id = ${p.group_id} and m.user_id = ${p.user_id}`;
      return "applied";
    }
    case "moderation.removed": {
      const p = parse(S.removal);
      if (!p) return "invalid_payload";
      if (p.target_type !== "message") return "ignored";
      await tx`
        update messaging.messages set removed_by = ${p.staff_id ?? null}, deleted_at = coalesce(deleted_at, now()), body = '',
               media_path = null, media_width = null, media_height = null, link_url = null
         where id = ${p.target_id}`;
      return "applied";
    }
    case "user.deleted": {
      const user = event.subjects[0] ?? (typeof event.payload["user_id"] === "string" ? event.payload["user_id"] : null);
      if (!user || !id.safeParse(user).success) return "invalid_payload";
      await deleteUser(tx, user);
      return "applied";
    }
  }
}

/** user.deleted: as the stack's cascades from auth.users: the user's messages, memberships, reactions and pins. */
export async function deleteUser(tx: Tx, userId: string): Promise<void> {
  const media = await tx<{ path: string; thread_id: string }[]>`
    select media_path as path, thread_id::text from messaging.messages where sender_id = ${userId} and media_path is not null`;
  await tx`delete from messaging.pins where pinned_by = ${userId}`;
  await tx`delete from messaging.reactions where user_id = ${userId}`;
  await tx`delete from messaging.messages where sender_id = ${userId}`;
  await tx`delete from messaging.members where user_id = ${userId}`;
  await tx`delete from messaging.profiles where user_id = ${userId}`;
  await tx`delete from messaging.friendships where user_id_a = ${userId} or user_id_b = ${userId}`;
  await tx`delete from messaging.blocks where blocker_id = ${userId} or blocked_id = ${userId}`;
  await tx`delete from messaging.dm_allowances where user_id_a = ${userId} or user_id_b = ${userId}`;
  await tx`insert into messaging.deleted_accounts (user_id) values (${userId}) on conflict do nothing`;
  await appendEvents(tx, [
    ...(media.length
      ? [{ type: "message.deleted", subjects: [userId], payload: { message_ids: [], thread_id: null, sender_id: userId, media_paths: media.map((m) => m.path) } }]
      : []),
    { type: "user.deletion_confirmed", subjects: [userId], payload: { user_id: userId } },
  ]);
}

export function copiesConsumer(options: { sql: postgres.Sql; logger?: Logger; pollMs?: number }): Consumer {
  return createConsumer({
    sql: options.sql,
    name: COPIES_CONSUMER,
    types: COPY_EVENTS,
    pollMs: options.pollMs,
    logger: options.logger,
    handle: async (tx, event) => {
      const outcome = await applyCopyEvent(tx, event);
      if (outcome !== "applied" && outcome !== "ignored") options.logger?.warn("copies.skipped", { action: `consume.${event.type}`, outcome: "skipped", error_code: outcome });
    },
  });
}
