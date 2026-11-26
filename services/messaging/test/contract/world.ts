/**
 * The contract world for messaging and realtime: content's world (identity, people, content, each under its
 * own role) plus messaging's schema and realtime's login role (it owns no tables; it only LISTENs). Users are
 * made with people's helpers; messaging learns about them from people's and work's events through its copies
 * consumer. Venture facts are published as work will publish them (W5), from a role named for work.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendEvents } from "@skilient/platform";
import type { TransportOptions } from "@skilient/testing";
import type postgres from "postgres";
import { WebSocket } from "ws";
import { contentWorld, drainCopies as drainContent, type ContentWorld } from "../../../content/test/contract/world";
import { copiesConsumer, COPIES_CONSUMER, COPY_EVENTS } from "../../src/store/copies";

export const MIGRATIONS = join(import.meta.dirname, "../../migrations");
export { student, NU, NUTECH } from "../../../content/test/contract/world";

export interface MessagingWorld extends ContentWorld {
  messaging: postgres.Sql;
  realtime: postgres.Sql;
  /** Another service's role, made on first use (to publish its events). */
  roleOf(service: string): Promise<postgres.Sql>;
}

export function messagingWorld(onWorld: (w: MessagingWorld) => void, worlds: MessagingWorld[] = []): () => Promise<TransportOptions> {
  process.env["MESSAGING_JOBS"] = "off";
  let base: ContentWorld | undefined;
  const start = contentWorld((w) => (base = w), []);
  return async () => {
    const o = await start();
    const messaging = await base!.pg.service("messaging", MIGRATIONS);
    const realtime = await base!.pg.service("realtime", mkdtempSync(join(tmpdir(), "mig-")));
    const roles: Record<string, postgres.Sql> = {};
    const w: MessagingWorld = {
      ...base!,
      messaging,
      realtime,
      roleOf: async (service) => (roles[service] ??= await base!.pg.service(service, mkdtempSync(join(tmpdir(), "mig-")))),
    };
    worlds.push(w);
    onWorld(w);
    const db = o.database!;
    return { ...o, database: (s: string) => (s === "messaging" ? messaging : s === "realtime" ? realtime : db(s)) };
  };
}

export { stopWorlds } from "../../../content/test/contract/world";

/** Runs messaging's copies consumer (and content's) until every event they handle has been read. */
export async function drainCopies(w: MessagingWorld): Promise<void> {
  await drainContent(w);
  const c = copiesConsumer({ sql: w.messaging });
  for (let i = 0; i < 100; i++) {
    const [pending] = await w.messaging`
      select count(*)::int as n from platform.events e
       where e.type = any(${[...COPY_EVENTS]}::text[])
         and not exists (select 1 from platform.applied_events a where a.consumer = ${COPIES_CONSUMER} and a.event_id = e.id)`;
    if (pending!.n === 0) return;
    await c.runOnce();
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("messaging's copies consumer did not catch up");
}

/** Publishes an event as another service would, from that service's own role. */
export async function publishAs(w: MessagingWorld, service: string, type: string, subjects: string[], payload: Record<string, unknown>): Promise<void> {
  const role = await w.roleOf(service);
  await role.begin((tx) => appendEvents(tx, [{ type, subjects, payload }]));
}

/** A venture with its owner and members, as work will announce it (W5). */
export async function venture(w: MessagingWorld, owner: string, members: string[]): Promise<string> {
  const id = crypto.randomUUID();
  await publishAs(w, "work", "venture.updated", [id], { venture_id: id, owner_id: owner, university_id: null, status: "in_progress", visibility: "university" });
  for (const m of [owner, ...members]) await publishAs(w, "work", "group.member_changed", [id, m], { kind: "venture", group_id: id, user_id: m, member: true });
  await drainCopies(w);
  return id;
}

/** A realtime socket client: authenticates, subscribes, and collects what arrives. */
export interface Socket {
  ws: WebSocket;
  received: { topic: string; event: string; payload: Record<string, unknown>; id: string; at: number }[];
  subscribe(topic: string): Promise<{ type: string; reason?: string }>;
  /** Resolves with the first message matching `match`, or rejects after `ms`. */
  next(match: (m: Socket["received"][number]) => boolean, ms?: number): Promise<Socket["received"][number]>;
  close(): void;
}

export async function connect(http1Url: string, token: string): Promise<Socket> {
  const ws = new WebSocket(`${http1Url.replace(/^http/, "ws")}/realtime`);
  const received: Socket["received"] = [];
  const control: { type: string; topic?: string; reason?: string }[] = [];
  const waiters: (() => void)[] = [];
  ws.on("message", (raw) => {
    const f = JSON.parse(String(raw)) as { type: string; topic: string; event: string; payload: Record<string, unknown>; id: string; reason?: string };
    if (f.type === "message") received.push({ topic: f.topic, event: f.event, payload: f.payload, id: f.id, at: performance.now() });
    else control.push(f);
    for (const w of waiters.splice(0)) w();
  });
  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
  const until = async <T>(find: () => T | undefined, ms = 5_000): Promise<T> => {
    const t0 = Date.now();
    for (;;) {
      const hit = find();
      if (hit !== undefined) return hit;
      if (Date.now() - t0 > ms) throw new Error("realtime: timed out waiting");
      await new Promise<void>((r) => {
        waiters.push(r);
        setTimeout(r, 50);
      });
    }
  };
  ws.send(JSON.stringify({ type: "auth", token }));
  await until(() => control.find((c) => c.type === "ready"));
  return {
    ws,
    received,
    async subscribe(topic) {
      ws.send(JSON.stringify({ type: "subscribe", topic }));
      return until(() => control.find((c) => (c.type === "subscribed" || c.type === "refused") && c.topic === topic));
    },
    next: (match, ms) => until(() => received.find(match), ms),
    close: () => ws.close(),
  };
}
