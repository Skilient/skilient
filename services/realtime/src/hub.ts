import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { REALTIME_CHANNEL, type Logger, type User, type UserTokenVerifier } from "@skilient/platform";
import type postgres from "postgres";
import { WebSocket, WebSocketServer } from "ws";
import { z } from "zod";

/**
 * The realtime hub (docs/azure/prd.md, "Realtime"): one WebSocket per visible tab. A socket authenticates with
 * the user's access token (first frame), then subscribes to topics; each subscription is checked once with
 * the topic's owner and the answer cached for 60 s. The hub LISTENs on the `realtime` channel (one connection
 * per replica) and forwards each NOTIFY to the sockets on that replica subscribed to its topic, skipping any
 * user the message is `hidden_from`. Every replica hears every NOTIFY, and a socket lives on one replica, so
 * each socket gets each message once.
 *
 * Protocol (JSON text frames): {"type":"auth","token"} → {"type":"ready"} | close 4401;
 * {"type":"subscribe","topic"} → {"type":"subscribed","topic"} | {"type":"refused","topic","reason"};
 * {"type":"unsubscribe","topic"}; delivered: {"type":"message","topic","event","payload","id"}.
 */
export type Topic = `user:${string}` | `thread:${string}` | `event:${string}` | `feed:${string}`;
const TOPIC = /^(user|thread|event|feed):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

export interface HubOptions {
  /** A connection for LISTEN (the service's own role; it reads no tables). */
  sql: postgres.Sql;
  users: UserTokenVerifier;
  /** Whether a user may listen to thread:{id} (messaging's CanListen). */
  canListenThread: (userId: string, threadId: string) => Promise<boolean>;
  /** Whether a user may listen to feed:{university or global} (content's CanListenFeed; the new-posts pill). */
  canListenFeed: (userId: string, feedId: string) => Promise<boolean>;
  logger?: Logger;
  /** How long a permission answer is kept (ms). */
  cacheMs?: number;
  /** How long a socket may stay unauthenticated (ms). */
  authTimeoutMs?: number;
}

const Frame = z.discriminatedUnion("type", [
  z.object({ type: z.literal("auth"), token: z.string().min(1).max(4096) }),
  z.object({ type: z.literal("subscribe"), topic: z.string().max(80) }),
  z.object({ type: z.literal("unsubscribe"), topic: z.string().max(80) }),
]);

const Notice = z.object({ topic: z.string(), event: z.string(), payload: z.record(z.string(), z.unknown()), hidden_from: z.array(z.string()).optional(), id: z.string() });

interface Client {
  ws: WebSocket;
  user: User | null;
  topics: Set<string>;
}

export interface Hub {
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void;
  /** Starts listening on the channel. */
  start(): Promise<void>;
  stats(): { sockets: number; subscriptions: number; delivered: number };
  close(): Promise<void>;
}

export function createHub(options: HubOptions): Hub {
  const cacheMs = options.cacheMs ?? 60_000;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 });
  const clients = new Set<Client>();
  const byTopic = new Map<string, Set<Client>>();
  const allowed = new Map<string, { ok: boolean; at: number }>();
  let delivered = 0;
  let listening: { unlisten(): Promise<void> } | undefined;

  const send = (c: Client, frame: Record<string, unknown>) => {
    if (c.ws.readyState === WebSocket.OPEN) c.ws.send(JSON.stringify(frame));
  };

  async function may(user: User, topic: string): Promise<{ ok: boolean; reason?: string }> {
    const m = TOPIC.exec(topic);
    if (!m) return { ok: false, reason: "bad_topic" };
    const [, kind, id] = m;
    if (kind === "user") return id === user.id ? { ok: true } : { ok: false, reason: "not_allowed" };
    // event:{id} headcounts are community's (W7); until it answers, nobody listens.
    if (kind === "event") return { ok: false, reason: "not_available" };
    const key = `${user.id}|${topic}`;
    const hit = allowed.get(key);
    if (hit && Date.now() - hit.at < cacheMs) return hit.ok ? { ok: true } : { ok: false, reason: "not_allowed" };
    const ok = kind === "feed" ? await options.canListenFeed(user.id, id!) : await options.canListenThread(user.id, id!);
    allowed.set(key, { ok, at: Date.now() });
    return ok ? { ok: true } : { ok: false, reason: "not_allowed" };
  }

  function unsubscribe(c: Client, topic: string) {
    c.topics.delete(topic);
    const set = byTopic.get(topic);
    set?.delete(c);
    if (set && set.size === 0) byTopic.delete(topic);
  }

  wss.on("connection", (ws) => {
    const c: Client = { ws, user: null, topics: new Set() };
    clients.add(c);
    const timer = setTimeout(() => {
      if (!c.user) ws.close(4401, "auth_required");
    }, options.authTimeoutMs ?? 10_000);
    timer.unref();
    ws.on("message", async (raw) => {
      let frame: z.infer<typeof Frame>;
      try {
        frame = Frame.parse(JSON.parse(String(raw)));
      } catch {
        return void ws.close(4400, "bad_frame");
      }
      if (frame.type === "auth") {
        const user = await options.users.verify(frame.token);
        if (!user) return void ws.close(4401, "bad_token");
        c.user = user;
        clearTimeout(timer);
        return send(c, { type: "ready" });
      }
      if (!c.user) return void ws.close(4401, "auth_required");
      if (frame.type === "unsubscribe") return unsubscribe(c, frame.topic);
      try {
        const r = await may(c.user, frame.topic);
        if (!r.ok) return send(c, { type: "refused", topic: frame.topic, reason: r.reason });
        c.topics.add(frame.topic);
        if (!byTopic.has(frame.topic)) byTopic.set(frame.topic, new Set());
        byTopic.get(frame.topic)!.add(c);
        send(c, { type: "subscribed", topic: frame.topic });
      } catch {
        send(c, { type: "refused", topic: frame.topic, reason: "unavailable" });
      }
    });
    ws.on("close", () => {
      clearTimeout(timer);
      for (const t of [...c.topics]) unsubscribe(c, t);
      clients.delete(c);
    });
    ws.on("error", () => ws.terminate());
  });

  function dispatch(text: string) {
    let n: z.infer<typeof Notice>;
    try {
      n = Notice.parse(JSON.parse(text));
    } catch {
      return options.logger?.warn("realtime.bad_notice", { action: "dispatch", outcome: "skipped" });
    }
    const hidden = new Set(n.hidden_from ?? []);
    for (const c of byTopic.get(n.topic) ?? []) {
      if (c.user && hidden.has(c.user.id)) continue;
      send(c, { type: "message", topic: n.topic, event: n.event, payload: n.payload, id: n.id });
      delivered++;
    }
  }

  return {
    handleUpgrade(req, socket, head) {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    },
    async start() {
      listening = await options.sql.listen(REALTIME_CHANNEL, dispatch);
    },
    stats() {
      let subscriptions = 0;
      for (const c of clients) subscriptions += c.topics.size;
      return { sockets: clients.size, subscriptions, delivered };
    },
    async close() {
      await listening?.unlisten();
      for (const c of clients) c.ws.terminate();
      clients.clear();
      byTopic.clear();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    },
  };
}
