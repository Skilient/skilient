import { createConsumer, startCall, type Consumer, type LoggedEvent, type Logger } from "@skilient/platform";
import type postgres from "postgres";
import { z } from "zod";
import { build, emptyWants, NOTICE_EVENTS, want, type Facts, type NoticeEvent } from "../domain/notices";
import { emptyCommunity, emptyCredentials, emptyWork, type Ports } from "../ports";
import { deleteUser } from "./bell";
import { publish, publishCounts, type Tx } from "./db";
import { apply } from "./write";

/**
 * Notify's consumers. Each event type has its owning producer role; anything else is logged and dropped. Idempotent
 * (the platform records applied event ids).
 *
 * | Event (v1)               | From      | Consumer       | Effect                                                     |
 * | ------------------------ | --------- | -------------- | ---------------------------------------------------------- |
 * | block.changed            | people    | notify.copies  | the blocks copy (no notice between the two; none shown)    |
 * | user.deleted             | identity  | notify.copies  | notices, choices, devices go; user.deletion_confirmed      |
 * | (NOTICE_EVENTS)          | each      | notify.notices | the notices of src/domain/notices.ts                       |
 */
export const COPIES_CONSUMER = "notify.copies";
export const NOTICES_CONSUMER = "notify.notices";
export const COPY_EVENTS = ["block.changed", "user.deleted"] as const;
export const NOTICE_TYPES = Object.keys(NOTICE_EVENTS) as NoticeEvent[];

const COPY_OWNER: Record<(typeof COPY_EVENTS)[number], string> = { "block.changed": "svc_people", "user.deleted": "svc_identity" };

export type Outcome = "applied" | "ignored" | "wrong_producer" | "invalid_payload" | "unknown_type";
type Event = Pick<LoggedEvent, "type" | "producer" | "payload" | "version" | "subjects"> & { at?: string };

const id = z.uuid();
const Block = z.object({ blocker_id: id, blocked_id: id, blocked: z.boolean() });

/** Applies one copy event (the consumer's handler; exported for tests). */
export async function applyCopyEvent(tx: Tx, event: Event): Promise<Outcome> {
  if (event.version !== 1) return "invalid_payload";
  const owner = COPY_OWNER[event.type as keyof typeof COPY_OWNER];
  if (!owner) return "unknown_type";
  if (owner !== event.producer) return "wrong_producer";
  if (event.type === "block.changed") {
    const r = Block.safeParse(event.payload);
    if (!r.success) return "invalid_payload";
    const p = r.data;
    if (p.blocked) await tx`insert into notify.blocks (blocker_id, blocked_id) values (${p.blocker_id}, ${p.blocked_id}) on conflict do nothing`;
    else await tx`delete from notify.blocks where blocker_id = ${p.blocker_id} and blocked_id = ${p.blocked_id}`;
    // The badge leaves out (or counts again) the blocked person's notices.
    await publishCounts(tx, [p.blocker_id, p.blocked_id]);
    return "applied";
  }
  const user = event.subjects[0] ?? (typeof event.payload["user_id"] === "string" ? event.payload["user_id"] : null);
  if (!user || !id.safeParse(user).success) return "invalid_payload";
  await deleteUser(tx, user);
  await publish(tx, [{ type: "user.deletion_confirmed", subjects: [user], payload: { user_id: user } }]);
  return "applied";
}

function ownerOk(event: Event): Outcome | null {
  if (event.version !== 1) return "invalid_payload";
  const owner = NOTICE_EVENTS[event.type as NoticeEvent] as string | undefined;
  if (!owner) return "unknown_type";
  if (!owner.split("|").includes(event.producer)) return "wrong_producer";
  return null;
}

const settle = async <T>(p: Promise<T>, fallback: T, logger: Logger | undefined, what: string): Promise<T> => {
  try {
    return await p;
  } catch (e) {
    // A decoration never fails a notification: the notice is written without it (decisions.md, W9).
    logger?.warn("notices.decoration_failed", { action: `prepare.${what}`, outcome: "error", error: e instanceof Error ? e.message.slice(0, 120) : "unknown" });
    return fallback;
  }
};

/** What one batch of notice events reads from other services: one batch call per owner, in parallel. */
export async function gatherFacts(events: readonly Event[], ports: Ports, logger?: Logger): Promise<Facts> {
  const w = emptyWants();
  for (const e of events) if (!ownerOk(e)) want(e, w);
  const call = startCall();
  const c = w.community;
  const needCommunity = Object.values(c).some((s) => s.size > 0);
  const needWork = Object.values(w.work).some((s) => s.size > 0);
  const cr = w.credentials;
  const [comments, messages, community, credentials, cards] = await Promise.all([
    w.comments.size ? settle(ports.commentExcerpts([...w.comments], call), new Map(), logger, "content") : new Map<string, string>(),
    w.messages.size ? settle(ports.messageExcerpts([...w.messages], call), new Map(), logger, "messaging") : new Map(),
    needCommunity ? settle(ports.community(c, call), emptyCommunity(), logger, "community") : emptyCommunity(),
    cr.entryIds.size || cr.correctionIds.size || cr.recordIds.size
      ? settle(ports.credentials({ entryIds: [...cr.entryIds], correctionIds: [...cr.correctionIds], recordIds: [...cr.recordIds] }, call), emptyCredentials(), logger, "credentials")
      : emptyCredentials(),
    w.cards.size ? settle(ports.cards([...w.cards], call), new Map(), logger, "people") : new Map(),
  ]);
  // A team chat's venture title comes from work too: asked with the batch's other ventures, after messaging says which.
  for (const m of (messages as Map<string, { ventureId: string | null }>).values()) if (m.ventureId) w.work.ventureIds.add(m.ventureId);
  const work = needWork || w.work.ventureIds.size ? await settle(ports.work(w.work, call), emptyWork(), logger, "work") : emptyWork();
  return {
    comments,
    messages,
    work,
    community,
    credentials,
    names: new Map([...(cards as Map<string, { name: string; username: string }>)].map(([k, v]) => [k, { name: v.name, username: v.username }])),
  };
}

/** Applies one notice event (the consumer's handler; exported for tests and replays). */
export async function applyNoticeEvent(tx: Tx, event: Event, facts: Facts): Promise<Outcome> {
  const bad = ownerOk(event);
  if (bad) return bad;
  const ops = build({ type: event.type, payload: event.payload, ...(event.at ? { at: event.at } : {}) }, facts);
  if (ops.length === 0) return "ignored";
  await apply(tx, ops);
  return "applied";
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
      if (outcome !== "applied") options.logger?.warn("copies.skipped", { action: `consume.${event.type}`, outcome: "skipped", error_code: outcome });
    },
  });
}

export function noticesConsumer(options: { sql: postgres.Sql; ports: Ports; logger?: Logger; pollMs?: number }): Consumer {
  return createConsumer({
    sql: options.sql,
    name: NOTICES_CONSUMER,
    types: NOTICE_TYPES,
    pollMs: options.pollMs,
    logger: options.logger,
    batch: 50,
    prepare: (events) => gatherFacts(events, options.ports, options.logger),
    handle: async (tx, event, facts) => {
      const outcome = await applyNoticeEvent(tx, event, facts);
      if (outcome !== "applied" && outcome !== "ignored") options.logger?.warn("notices.skipped", { action: `consume.${event.type}`, outcome: "skipped", error_code: outcome });
    },
  });
}
