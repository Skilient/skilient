import type postgres from "postgres";
import { uuidv7 } from "./ids";
import type { Logger } from "./log";

/**
 * The shared event log (docs/azure/prd.md, "Events"): one append-only table, `platform.events`.
 *
 * - Writing: a service appends its events in the same transaction as the change, so both happen or neither.
 * - Reading: each consumer keeps a cursor in `platform.cursors` and reads only events whose transaction is
 *   older than every transaction still open (`txid < pg_snapshot_xmin(...)`), ordered by (txid, seq). A
 *   cursor on (txid, seq) rather than seq alone is what closes the gap where a slow commit would be skipped:
 *   a smaller seq can commit after a larger one, but never with a smaller txid than the reader's horizon.
 * - Speed: the writer sends NOTIFY on `platform_events`, so warm consumers react at once instead of polling.
 * - Delivery: at least once. A handler applies an event only if its id is new in `platform.applied_events`
 *   for that consumer, in the same transaction as the handler's own writes.
 *
 * Payloads are readable by every service: put ids and facts there, never secrets, emails or content.
 */
export const EVENTS_CHANNEL = "platform_events";

const TYPE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

/**
 * Keys an event payload may never hold, at any depth: every service can read every event, so payloads carry
 * ids, flags and hashes only (decision 2026-11-25). Matched case-insensitively on the whole key or its last
 * word (`user_email`, `fullName`).
 */
const FORBIDDEN = new Set(["email", "name", "fullname", "full_name", "first_name", "last_name", "phone", "password", "token", "code", "secret", "ip", "address", "content", "body", "message", "text", "otp"]);

function forbiddenKey(value: unknown, path = "payload"): string | null {
  if (Array.isArray(value)) {
    for (const [i, v] of value.entries()) {
      const hit = forbiddenKey(v, `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const words = k.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase().split(/[_-]/);
      if (FORBIDDEN.has(k.toLowerCase()) || FORBIDDEN.has(words.at(-1) ?? "")) return `${path}.${k}`;
      const hit = forbiddenKey(v, `${path}.${k}`);
      if (hit) return hit;
    }
  }
  return null;
}

export interface NewEvent {
  /** `noun.verb`, e.g. `user.created`. */
  type: string;
  version?: number;
  /** The ids the event is about (a user, a post), for consumers that filter by subject. */
  subjects?: readonly string[];
  payload?: Record<string, unknown>;
  /** Defaults to a fresh UUIDv7. */
  id?: string;
}

export interface LoggedEvent {
  seq: string;
  id: string;
  type: string;
  version: number;
  subjects: string[];
  payload: Record<string, unknown>;
  producer: string;
  at: string;
  txid: string;
}

/** Appends events inside the caller's transaction and wakes consumers when it commits. Returns the event ids. */
export async function appendEvents(tx: postgres.TransactionSql, events: readonly NewEvent[]): Promise<string[]> {
  if (events.length === 0) return [];
  const ids: string[] = [];
  for (const e of events) {
    if (!TYPE.test(e.type)) throw new Error(`event type "${e.type}" must look like noun.verb`);
    const hit = forbiddenKey(e.payload ?? {});
    if (hit) throw new Error(`event ${e.type}: ${hit} looks like personal data; payloads carry ids, flags and hashes only`);
    const id = e.id ?? uuidv7();
    ids.push(id);
    await tx`
      insert into platform.events (id, type, version, subjects, payload)
      values (${id}, ${e.type}, ${e.version ?? 1}, ${[...(e.subjects ?? [])]}::uuid[], ${JSON.stringify(e.payload ?? {})}::text::jsonb)`;
  }
  // NOTIFY is delivered only on commit, and only once per distinct payload per transaction.
  for (const type of new Set(events.map((e) => e.type))) await tx`select pg_notify(${EVENTS_CHANNEL}, ${type})`;
  return ids;
}

export type EventHandler = (tx: postgres.TransactionSql, event: LoggedEvent) => Promise<void>;

export interface ConsumerOptions {
  sql: postgres.Sql;
  /** Unique per consumer and prefixed with the service, e.g. `people.user-created`. */
  name: string;
  /** Event types to read. */
  types: readonly string[];
  handle: EventHandler;
  batch?: number;
  /** Poll interval when no NOTIFY arrives (a safety net, not the main path). */
  pollMs?: number;
  logger?: Logger;
}

export interface Consumer {
  /** Reads and applies one batch; returns the number of events read (applied or already applied). */
  runOnce(): Promise<number>;
  /** Listens for NOTIFY and polls; resolves once listening. */
  start(): Promise<void>;
  stop(): Promise<void>;
}

const CONSUMER = /^[a-z][a-z0-9_.-]{0,99}$/;

export function createConsumer(options: ConsumerOptions): Consumer {
  const { sql, name, types, handle } = options;
  if (!CONSUMER.test(name)) throw new Error(`consumer name "${name}" must match ${CONSUMER}`);
  const batch = options.batch ?? 100;
  let timer: NodeJS.Timeout | undefined;
  let listener: { unlisten(): Promise<void> } | undefined;
  let running: Promise<number> | null = null;
  let again = false;

  async function runOnce(): Promise<number> {
    return sql.begin(async (tx) => {
      await tx`insert into platform.cursors (consumer) values (${name}) on conflict (consumer) do nothing`;
      const [cursor] = await tx<{ last_txid: string; last_seq: string }[]>`
        select last_txid::text, last_seq::text from platform.cursors where consumer = ${name} for update skip locked`;
      if (!cursor) return 0; // another replica holds it
      const rows = await tx<LoggedEvent[]>`
        select seq::text, id, type, version, subjects, payload, producer, at::text, txid::text
          from platform.events
         where (txid, seq) > (${cursor.last_txid}::xid8, ${cursor.last_seq}::bigint)
           and txid < pg_snapshot_xmin(pg_current_snapshot())
           and type = any(${[...types]}::text[])
         order by txid, seq
         limit ${batch}`;
      for (const event of rows) {
        const fresh = await tx`
          insert into platform.applied_events (consumer, event_id) values (${name}, ${event.id})
          on conflict do nothing returning 1`;
        if (fresh.count === 1) await tx.savepoint((sp) => handle(sp, event));
      }
      const last = rows.at(-1);
      if (last)
        await tx`update platform.cursors set last_txid = ${last.txid}::xid8, last_seq = ${last.seq}::bigint, updated_at = now()
                  where consumer = ${name}`;
      return rows.length;
    });
  }

  /** Runs batches until one comes back short; a wake-up during a run queues exactly one more run. */
  function wake(): void {
    if (running) {
      again = true;
      return;
    }
    running = (async () => {
      let total = 0;
      try {
        for (;;) {
          again = false;
          const n = await runOnce();
          total += n;
          if (n < batch && !again) break;
        }
      } catch (error) {
        options.logger?.error("events.consumer_failed", {
          action: `consume.${name}`,
          outcome: "error",
          error_code: error instanceof Error ? error.message.slice(0, 80) : "unknown",
        });
      } finally {
        running = null;
      }
      return total;
    })();
  }

  return {
    runOnce,
    async start() {
      listener = await sql.listen(EVENTS_CHANNEL, (type) => {
        if (types.includes(type)) wake();
      });
      timer = setInterval(wake, options.pollMs ?? 5_000);
      timer.unref();
      wake();
    },
    async stop() {
      if (timer) clearInterval(timer);
      await listener?.unlisten();
      await running;
    },
  };
}
