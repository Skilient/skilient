import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { handleResendWebhook, verifySvix } from "@/lib/monitoring/resend-webhook";
import { isVitalsMetric, vitalsRoute } from "@/lib/monitoring/vitals";

const KEY = Buffer.from("test-signing-key-for-svix").toString("base64");
const SECRET = `whsec_${KEY}`;
const NOW = 1_790_000_000_000;

function signed(body: string, opts: { id?: string; at?: number; key?: string } = {}) {
  const id = opts.id ?? "msg_1";
  const ts = String(Math.floor((opts.at ?? NOW) / 1000));
  const sig = createHmac("sha256", Buffer.from(opts.key ?? KEY, "base64")).update(`${id}.${ts}.${body}`).digest("base64");
  return new Headers({ "svix-id": id, "svix-timestamp": ts, "svix-signature": `v1,bogus v1,${sig}` });
}

describe("verifySvix", () => {
  const body = JSON.stringify({ type: "email.bounced" });
  it("accepts a correct signature among several", () => {
    expect(verifySvix(body, signed(body), SECRET, NOW)).toBe(true);
  });
  it("refuses a changed body, another key, an old timestamp or missing headers", () => {
    expect(verifySvix(`${body} `, signed(body), SECRET, NOW)).toBe(false);
    expect(verifySvix(body, signed(body, { key: Buffer.from("other").toString("base64") }), SECRET, NOW)).toBe(false);
    expect(verifySvix(body, signed(body, { at: NOW - 10 * 60_000 }), SECRET, NOW)).toBe(false);
    expect(verifySvix(body, new Headers(), SECRET, NOW)).toBe(false);
  });
});

describe("handleResendWebhook", () => {
  async function run(body: string, headers: Headers, secret: string | undefined | null = SECRET) {
    const recorded: string[] = [];
    const result = await handleResendWebhook({ rawBody: body, headers, secret: secret ?? undefined, nowMs: NOW, record: async (s) => void recorded.push(s) });
    return { ...result, recorded };
  }
  it("is not there until the secret is set", async () => {
    const body = JSON.stringify({ type: "email.bounced" });
    expect((await run(body, signed(body), null)).status).toBe(404);
  });
  it("records deliveries and bounces, ignores other events", async () => {
    for (const [type, signal] of [["email.delivered", "email_delivered"], ["email.bounced", "email_bounced"]] as const) {
      const body = JSON.stringify({ type, data: { to: ["someone@example.com"] } });
      const r = await run(body, signed(body));
      expect(r.status).toBe(200);
      expect(r.recorded).toEqual([signal]);
    }
    const opened = JSON.stringify({ type: "email.opened" });
    const r = await run(opened, signed(opened));
    expect([r.status, r.outcome, r.recorded]).toEqual([200, "ignored", []]);
  });
  it("refuses bad signatures and bad JSON", async () => {
    const body = JSON.stringify({ type: "email.bounced" });
    expect((await run(body, signed("{}"))).status).toBe(401);
    expect((await run("not json", signed("not json"))).status).toBe(400);
  });
});

describe("vitalsRoute", () => {
  it("folds ids and keeps routes short and safe", () => {
    expect(vitalsRoute("/post/0b8f5a7e-1d2c-4e3f-9a8b-7c6d5e4f3a2b")).toBe("/post/:id");
    expect(vitalsRoute("/ventures/42/chat?x=1#top")).toBe("/ventures/:id/chat");
    expect(vitalsRoute("/")).toBe("/");
    expect(vitalsRoute(`/${"a".repeat(300)}`)).toHaveLength(120);
    expect(vitalsRoute("/feed/<script>")).toBe("/feed/script");
  });
  it("knows its metrics", () => {
    expect(isVitalsMetric("LCP")).toBe(true);
    expect(isVitalsMetric("FID")).toBe(false);
  });
});
