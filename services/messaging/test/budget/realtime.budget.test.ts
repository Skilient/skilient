/**
 * The W4 done-when (docs/azure/prd.md, build plan): "Chat p95 under 150 ms to fan-out; badges update within
 * 500 ms; two realtime replicas deliver every message once."
 *
 * Two hosts share one Postgres and one set of service keys, as two containers would: host A serves identity,
 * people, content, messaging and a realtime replica; host B serves only a second realtime replica, with its own
 * database connection, and asks messaging on A over HTTP/2 whether a socket may listen. Members of one team
 * chat connect half to each replica. Every message must reach every member's socket exactly once (none lost,
 * none twice), and the time from the send call to the last socket receiving it, and from the send to the
 * reader's badge, is measured.
 */
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MessagingService } from "@skilient/contracts/messaging/v1/messaging_pb";
import { createHost, type Host } from "@skilient/host";
import { createLogger, createSecrets, envName, startCall } from "@skilient/platform";
import { testKeys } from "@skilient/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect, messagingWorld, stopWorlds, student, venture, type MessagingWorld, type Socket } from "../contract/world";

const worlds: MessagingWorld[] = [];
let w: MessagingWorld;
let a: Host;
let b: Host;
let urlA = "";
let h1A = "";
let h1B = "";
const MESSAGES = 60;
const p95 = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.floor(xs.length * 0.95)]!;

beforeAll(async () => {
  const opts = await messagingWorld((x) => (w = x), worlds)();
  const keys = await testKeys();
  const logger = createLogger({ level: "warn", write: () => {} });
  const secrets = createSecrets({ env: Object.fromEntries(Object.entries(opts.secrets ?? {}).map(([k, v]) => [envName(k), v])) });
  a = await createHost({
    services: ["identity", "people", "content", "messaging", "realtime"],
    instance: "replica-a",
    keys: keys.keys,
    users: opts.users!,
    logHashKey: randomBytes(16).toString("hex"),
    logger,
    secrets,
    database: opts.database,
    resolveUrl: () => urlA,
  });
  const sa = await a.listen(0, { http1Port: 0, hostname: "127.0.0.1" });
  urlA = `http://127.0.0.1:${sa.port}`;
  h1A = `http://127.0.0.1:${sa.http1Port}`;
  // Replica B: its own login role and connection for LISTEN, and messaging reached over HTTP/2 on A.
  const realtimeB = await w.pg.service("realtime_b", mkdtempSync(join(tmpdir(), "mig-")));
  b = await createHost({
    services: ["realtime"],
    instance: "replica-b",
    keys: keys.keys,
    users: opts.users!,
    logHashKey: randomBytes(16).toString("hex"),
    logger,
    secrets,
    database: () => realtimeB,
    resolveUrl: () => urlA,
  });
  const sb = await b.listen(0, { http1Port: 0, hostname: "127.0.0.1" });
  h1B = `http://127.0.0.1:${sb.http1Port}`;
}, 240_000);

afterAll(async () => {
  await b?.close();
  await a?.close();
  await stopWorlds(worlds);
});

describe("realtime across two replicas", () => {
  it(`${MESSAGES} messages to a team chat: every socket on either replica gets each once; p95 to fan-out under 150 ms; badges under 500 ms`, async () => {
    const owner = await student(w, { fullName: "Replica Owner" });
    const members = await Promise.all(Array.from({ length: 6 }, (_, i) => student(w, { fullName: `Replica Member ${i}` })));
    const vid = await venture(w, owner.id, members.map((m) => m.id));
    const messaging = a.clientsFor("web").client(MessagingService);
    const { threadId } = await messaging.ventureChat({ ventureId: vid }, startCall({ userToken: members[0]!.token }));
    const sockets: { s: Socket; user: string; replica: "a" | "b" }[] = [];
    for (const [i, m] of members.entries()) {
      const replica = i % 2 === 0 ? "a" : "b";
      const s = await connect(replica === "a" ? h1A : h1B, m.token);
      expect((await s.subscribe(`thread:${threadId}`)).type).toBe("subscribed");
      expect((await s.subscribe(`user:${m.id}`)).type).toBe("subscribed");
      sockets.push({ s, user: m.id, replica });
    }
    const fanout: number[] = [];
    const badges: number[] = [];
    const ids: string[] = [];
    for (let i = 0; i < MESSAGES; i++) {
      const t0 = performance.now();
      const { messageId } = await messaging.sendMessage(
        { threadId, body: `message ${i}`, replyToId: "" },
        // Three senders in turn: one sender may send 30 a minute.
        { ...startCall({ userToken: [owner, members[1]!, members[2]!][i % 3]!.token }), headers: { "idempotency-key": crypto.randomUUID() } },
      );
      ids.push(messageId);
      const arrivals = await Promise.all(sockets.map(({ s }) => s.next((m) => m.payload["id"] === messageId, 5_000)));
      fanout.push(Math.max(...arrivals.map((x) => x.at)) - t0);
      const badge = await sockets[0]!.s.next((m) => m.event === "badge" && m.at >= t0, 5_000);
      badges.push(badge.at - t0);
    }
    await new Promise((r) => setTimeout(r, 300));
    for (const { s, replica } of sockets) {
      const got = s.received.filter((m) => m.event === "message.sent").map((m) => String(m.payload["id"]));
      expect({ replica, count: got.length, distinct: new Set(got).size }).toEqual({ replica, count: MESSAGES, distinct: MESSAGES });
      expect(got).toEqual(ids);
    }
    console.info(`realtime, 2 replicas, ${sockets.length} sockets, ${MESSAGES} messages: fan-out p95 ${p95(fanout).toFixed(1)} ms, badge p95 ${p95(badges).toFixed(1)} ms`);
    expect(p95(fanout)).toBeLessThan(150);
    expect(p95(badges)).toBeLessThan(500);
    for (const { s } of sockets) s.close();
  });
});
