import { describe, expect, it } from "vitest";
import { handleBrevoWebhook, verifyBrevoAuthorization } from "@/lib/monitoring/brevo-webhook";
import { isVitalsMetric, vitalsRoute } from "@/lib/monitoring/vitals";

const SECRET = "test-brevo-webhook-bearer-secret-32-characters";

function authorized(secret = SECRET) {
  return new Headers({ authorization: `Bearer ${secret}` });
}

describe("verifyBrevoAuthorization", () => {
  it("accepts the independent bearer token", () => {
    expect(verifyBrevoAuthorization(authorized(), SECRET)).toBe(true);
  });
  it("refuses missing/wrong auth, weak configuration and legacy signature headers", () => {
    expect(verifyBrevoAuthorization(authorized("other-token"), SECRET)).toBe(false);
    expect(verifyBrevoAuthorization(new Headers(), SECRET)).toBe(false);
    expect(verifyBrevoAuthorization(authorized("short"), "short")).toBe(false);
    expect(verifyBrevoAuthorization(new Headers({ "svix-signature": "v1,bogus" }), SECRET)).toBe(false);
  });
});

describe("handleBrevoWebhook", () => {
  async function run(body: string, headers: Headers, secret: string | undefined | null = SECRET) {
    const recorded: string[] = [];
    const result = await handleBrevoWebhook({ rawBody: body, headers, secret: secret ?? undefined, record: async (s, key) => {
      expect(key).toMatch(/^[a-f0-9]{64}$/);
      recorded.push(s);
    } });
    return { ...result, recorded };
  }
  it("is not there until the secret is set", async () => {
    const body = JSON.stringify({ event: "hard_bounce" });
    expect((await run(body, authorized(), null)).status).toBe(404);
  });
  it("records deliveries and bounces, ignores other events", async () => {
    for (const [event, signal] of [["delivered", "email_delivered"], ["hard_bounce", "email_bounced"]] as const) {
      const body = JSON.stringify({ event, "message-id": "provider-message", email: "someone@example.com" });
      const r = await run(body, authorized());
      expect(r.status).toBe(200);
      expect(r.recorded).toEqual([signal]);
    }
    const opened = JSON.stringify({ event: "soft_bounce" });
    const r = await run(opened, authorized());
    expect([r.status, r.outcome, r.recorded]).toEqual([200, "ignored", []]);
  });
  it("refuses unauthorized requests before recording, bad JSON and malformed payloads", async () => {
    const body = JSON.stringify({ event: "hard_bounce" });
    const refused = await run(body, authorized("wrong"));
    expect(refused.status).toBe(401);
    expect(refused.recorded).toEqual([]);
    expect((await run("not json", authorized())).status).toBe(400);
    expect((await run(body, authorized())).status).toBe(400);
    expect((await run("null", authorized())).status).toBe(400);
    expect((await run("[]", authorized())).status).toBe(400);
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
