/**
 * Notify for any service's tests: wraps a world's start so the same Postgres also holds notify's schema, with the
 * VAPID keys made for the run (TransportOptions.secrets, never stored; email needs no key). Add "notify" to the hosted
 * services. `settleNotify` runs notify's consumers as the host would; `notifyJobs` runs its drains with the fakes.
 */
import { join } from "node:path";
import { createClientFactory, type Job } from "@skilient/platform";
import type { TransportOptions } from "@skilient/testing";
import type postgres from "postgres";
import type { VapidKeys } from "../src/domain/webpush";
import { notifyJobs } from "../src/jobs";
import { ports } from "../src/ports";
import { copiesConsumer, COPIES_CONSUMER, COPY_EVENTS, noticesConsumer, NOTICES_CONSUMER, NOTICE_TYPES } from "../src/store/consumers";
import { EMAIL_ENDPOINT, EMAIL_TOKEN, makeVapid } from "./fakes";

export const NOTIFY_MIGRATIONS = join(import.meta.dirname, "../migrations");

export interface NotifyParts {
  notify: postgres.Sql;
  vapid: { keys: VapidKeys; verify: import("node:crypto").webcrypto.CryptoKey };
}
type Host = { clientsFor(caller: string): ReturnType<typeof createClientFactory> };
const quiet = { info() {}, warn() {}, error() {}, debug() {} } as never;

export function withNotify<W extends { pg: { service(name: string, dir: string): Promise<postgres.Sql> } }>(
  start: () => Promise<TransportOptions>,
  base: () => W,
  onParts: (p: NotifyParts) => void,
): () => Promise<TransportOptions> {
  process.env["NOTIFY_JOBS"] = "off";
  return async () => {
    const o = await start();
    const notify = await base().pg.service("notify", NOTIFY_MIGRATIONS);
    const v = await makeVapid();
    onParts({ notify, vapid: { keys: v.keys, verify: v.verify } });
    const db = o.database!;
    return {
      ...o,
      secrets: { ...o.secrets, "notify-vapid-keys": v.secret },
      database: (s: string) => (s === "notify" ? notify : db(s)),
    };
  };
}

async function pending(sql: postgres.Sql, consumer: string, types: readonly string[]): Promise<number> {
  const [r] = await sql<{ n: number }[]>`
    select count(*)::int as n from platform.events e
     where e.type = any(${[...types]}::text[])
       and not exists (select 1 from platform.applied_events a where a.consumer = ${consumer} and a.event_id = e.id)`;
  return r!.n;
}

/** Runs notify's two consumers until they have read every event they handle. */
export async function settleNotify(p: NotifyParts, host: Host): Promise<void> {
  const x = ports(host.clientsFor("notify"));
  for (const [c, name, types] of [
    [copiesConsumer({ sql: p.notify, logger: quiet }), COPIES_CONSUMER, COPY_EVENTS],
    [noticesConsumer({ sql: p.notify, ports: x, logger: quiet }), NOTICES_CONSUMER, NOTICE_TYPES],
  ] as const) {
    for (let i = 0; i < 200 && (await pending(p.notify, name, types)) > 0; i++) await c.runOnce();
    if ((await pending(p.notify, name, types)) > 0) throw new Error(`${name} did not catch up`);
  }
}

/** Runs notify's queued jobs of these kinds (as the worker would), each committed, against the given outside world. */
export async function runNotifyJobs(
  p: NotifyParts,
  host: Host,
  outside: { fetch: typeof fetch; now?: () => Date },
  kinds: string[] = ["email-drain", "push-drain", "university-launch", "formula-notice"],
): Promise<number> {
  const handlers = notifyJobs({
    logger: quiet,
    ports: ports(host.clientsFor("notify")),
    email: { endpoint: EMAIL_ENDPOINT, token: async () => EMAIL_TOKEN, appUrl: "https://skilient.test", sendGapMs: 0 },
    vapid: p.vapid.keys,
    fetch: outside.fetch,
    ...(outside.now ? { now: outside.now } : {}),
  });
  let n = 0;
  for (let round = 0; round < 5; round++) {
    const queued = await p.notify<Job[]>`
      select id::text, kind, payload, attempts, max_attempts from platform.jobs where owner = 'svc_notify' and status = 'queued' and kind = any(${kinds}::text[]) order by id`;
    if (!queued.length) break;
    for (const j of queued) {
      await p.notify.begin((tx) => handlers[j.kind]!(tx, j));
      await p.notify`update platform.jobs set status = 'done', finished_at = now() where id = ${j.id}::bigint`;
      n++;
    }
  }
  return n;
}

/** A schedule's slot now: one job of the kind, then run. */
export async function runSchedule(p: NotifyParts, host: Host, kind: string, outside: { fetch: typeof fetch; now?: () => Date }): Promise<void> {
  await p.notify`insert into platform.jobs (kind, payload) values (${kind}, '{}'::jsonb)`;
  await runNotifyJobs(p, host, outside, [kind]);
}

/** Notify's rows for a user (its own schema), oldest first. */
export const noticesOf = (p: NotifyParts, userId: string) =>
  p.notify<{ type: string; actor_id: string | null; data: Record<string, unknown>; read_at: Date | null }[]>`
    select type, actor_id::text, data, read_at from notify.notifications where user_id = ${userId} order by created_at, id`.then((r) => [...r]);
