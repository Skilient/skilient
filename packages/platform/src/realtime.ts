import type postgres from "postgres";

/**
 * Live delivery (docs/azure/prd.md, "Realtime"): a service sends a Postgres NOTIFY on the `realtime` channel,
 * inside the transaction that made the change, carrying the topic and the message itself. Every `realtime`
 * replica listens and forwards it to the sockets subscribed to that topic. A NOTIFY is delivered only if the
 * transaction commits, once to each listening connection.
 */
export const REALTIME_CHANNEL = "realtime";
/** Postgres refuses a NOTIFY payload of 8,000 bytes or more; past this the payload goes as a reference. */
export const REALTIME_MAX_BYTES = 7_600;

export interface RealtimeMessage {
  /** user:{id} | thread:{id} | event:{id} | feed:{university id or GLOBAL_FEED} */
  topic: string;
  /** What happened, e.g. "message.sent", "badge". */
  event: string;
  payload: Record<string, unknown>;
  /** Users subscribed to the topic who must not receive this one (e.g. members blocked with a message's sender). */
  hidden_from?: string[];
}

const TOPIC = /^(user|thread|event|feed):[0-9a-f-]{36}$/;
/** The Global Feed's topic id (a university's feed uses the university's id). */
export const GLOBAL_FEED = "00000000-0000-0000-0000-000000000000";

/** Queues one live message for after the commit. A payload too large for NOTIFY is sent as `{too_large: true}` plus its `ref`. */
export async function publishRealtime(tx: postgres.TransactionSql, m: RealtimeMessage, ref?: Record<string, unknown>): Promise<void> {
  if (!TOPIC.test(m.topic)) throw new Error(`realtime topic "${m.topic}" must be user:, thread:, event: or feed: and an id`);
  let text = JSON.stringify({ ...m, id: crypto.randomUUID() });
  if (Buffer.byteLength(text) > REALTIME_MAX_BYTES) text = JSON.stringify({ ...m, payload: { too_large: true, ...(ref ?? {}) }, id: crypto.randomUUID() });
  await tx`select pg_notify(${REALTIME_CHANNEL}, ${text})`;
}
