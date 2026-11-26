/**
 * The realtime hub on its own: a real HTTP server and real sockets, a fake LISTEN connection and fake token and
 * permission checks. Covers the protocol, the topic rules, the 60-second permission cache, hidden_from and
 * unsubscribing.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { User, UserTokenVerifier } from "@skilient/platform";
import type postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { createHub, type Hub } from "../../src/hub";

const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";
const THREAD = "33333333-3333-4333-8333-333333333333";
const OTHER = "44444444-4444-4444-8444-444444444444";

let hub: Hub;
let server: http.Server;
let url: string;
let notify: (text: string) => void;
let asked = 0;

const users: UserTokenVerifier = {
  async verify(token) {
    const id = token === "alice" ? ALICE : token === "bob" ? BOB : null;
    return id ? ({ id, aal: "aal1" } as User) : null;
  },
};

beforeEach(async () => {
  asked = 0;
  const sql = {
    async listen(_channel: string, fn: (t: string) => void) {
      notify = fn;
      return { unlisten: async () => {} };
    },
  } as unknown as postgres.Sql;
  hub = createHub({
    sql,
    users,
    canListenThread: async (userId, threadId) => {
      asked++;
      return threadId === THREAD && (userId === ALICE || userId === BOB);
    },
    canListenFeed: async (_userId, feedId) => feedId === OTHER,
    authTimeoutMs: 500,
  });
  await hub.start();
  server = http.createServer();
  server.on("upgrade", (req, socket, head) => hub.handleUpgrade(req, socket, head));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}/realtime`;
});

afterEach(async () => {
  await hub.close();
  await new Promise<void>((r) => server.close(() => r()));
});

async function client(token?: string) {
  const ws = new WebSocket(url);
  const frames: Record<string, unknown>[] = [];
  let closed: number | null = null;
  ws.on("message", (raw) => frames.push(JSON.parse(String(raw)) as Record<string, unknown>));
  ws.on("close", (code) => (closed = code));
  await new Promise<void>((r) => ws.once("open", () => r()));
  const wait = async (pred: () => boolean) => {
    for (let i = 0; i < 100 && !pred(); i++) await new Promise((r) => setTimeout(r, 10));
  };
  if (token) {
    ws.send(JSON.stringify({ type: "auth", token }));
    await wait(() => frames.some((f) => f["type"] === "ready") || closed !== null);
  }
  return {
    ws,
    frames,
    closed: () => closed,
    wait,
    async sub(topic: string) {
      ws.send(JSON.stringify({ type: "subscribe", topic }));
      await wait(() => frames.some((f) => f["topic"] === topic && (f["type"] === "subscribed" || f["type"] === "refused")));
      return frames.find((f) => f["topic"] === topic && f["type"] !== "message");
    },
  };
}

describe("realtime hub", () => {
  it("refuses a bad token, a missing auth, and a malformed frame", async () => {
    const bad = await client("mallory");
    await bad.wait(() => bad.closed() !== null);
    expect(bad.closed()).toBe(4401);
    const silent = await client();
    await silent.wait(() => silent.closed() !== null);
    expect(silent.closed()).toBe(4401);
    const junk = await client("alice");
    junk.ws.send("not json");
    await junk.wait(() => junk.closed() !== null);
    expect(junk.closed()).toBe(4400);
  });

  it("topics: your own user topic only; threads by the owner's answer (cached); event topics wait for community", async () => {
    const a = await client("alice");
    expect(await a.sub(`user:${ALICE}`)).toMatchObject({ type: "subscribed" });
    expect(await a.sub(`user:${BOB}`)).toMatchObject({ type: "refused", reason: "not_allowed" });
    expect(await a.sub(`thread:${THREAD}`)).toMatchObject({ type: "subscribed" });
    expect(await a.sub(`thread:${OTHER}`)).toMatchObject({ type: "refused", reason: "not_allowed" });
    expect(await a.sub(`event:${OTHER}`)).toMatchObject({ type: "refused", reason: "not_available" });
    expect(await a.sub("nonsense")).toMatchObject({ type: "refused", reason: "bad_topic" });
    const before = asked;
    const again = await client("alice");
    expect(await again.sub(`thread:${THREAD}`)).toMatchObject({ type: "subscribed" });
    expect(asked).toBe(before);
    expect(hub.stats()).toMatchObject({ sockets: 2, subscriptions: 3 });
  });

  it("forwards a NOTIFY to the topic's sockets once, skips hidden_from, and stops after unsubscribe", async () => {
    const a = await client("alice");
    const b = await client("bob");
    await a.sub(`thread:${THREAD}`);
    await b.sub(`thread:${THREAD}`);
    notify(JSON.stringify({ topic: `thread:${THREAD}`, event: "message.sent", payload: { id: "m1" }, id: "d1" }));
    notify(JSON.stringify({ topic: `thread:${THREAD}`, event: "message.sent", payload: { id: "m2" }, hidden_from: [BOB], id: "d2" }));
    notify(JSON.stringify({ topic: `thread:${OTHER}`, event: "message.sent", payload: { id: "m3" }, id: "d3" }));
    notify("not json");
    await a.wait(() => a.frames.filter((f) => f["type"] === "message").length >= 2);
    await new Promise((r) => setTimeout(r, 100));
    const ids = (c: Awaited<ReturnType<typeof client>>) => c.frames.filter((f) => f["type"] === "message").map((f) => (f["payload"] as { id: string }).id);
    expect(ids(a)).toEqual(["m1", "m2"]);
    expect(ids(b)).toEqual(["m1"]);
    a.ws.send(JSON.stringify({ type: "unsubscribe", topic: `thread:${THREAD}` }));
    await new Promise((r) => setTimeout(r, 50));
    notify(JSON.stringify({ topic: `thread:${THREAD}`, event: "message.sent", payload: { id: "m4" }, id: "d4" }));
    await b.wait(() => ids(b).includes("m4"));
    expect(ids(a)).toEqual(["m1", "m2"]);
    expect(hub.stats().delivered).toBe(4);
  });
});
