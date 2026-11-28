import { describe, expect, it } from "vitest";
import { mailBody, sendViaAcs, senderFor } from "../../src/domain/mail";
import { EMAIL_ENDPOINT, EMAIL_TOKEN, fakeAzureEmail } from "../fakes";

const cfg = { endpoint: EMAIL_ENDPOINT, token: async () => EMAIL_TOKEN };
const email = { category: "notification" as const, to: "amna@notify-a.test", subject: "Hello", html: "<p>Hi</p>", text: "Hi" };
const first = new Date("2026-11-28T10:00:00Z");

describe("Azure Communication Services Email transport", () => {
  it("sends from notify@ (security@ for security notices), signed in, with the request id; a repeat id sends once", async () => {
    expect(mailBody(email)).toMatchObject({ senderAddress: "notify@skilient.com", recipients: { to: [{ address: email.to }] }, content: { subject: "Hello", plainText: "Hi" } });
    expect(senderFor("security").email).toBe("security@skilient.com");
    const az = fakeAzureEmail();
    expect(await sendViaAcs(cfg, az.impl, email, "id-1", first)).toEqual({ ok: true, id: "op-1" });
    expect(await sendViaAcs(cfg, az.impl, email, "id-1", first)).toMatchObject({ ok: true });
    expect(az.sent).toHaveLength(1);
  });

  it("answers: 5xx retries later (uncertain), 429 waits, a quota-length 429 waits for tomorrow, 4xx never", async () => {
    const az = fakeAzureEmail([
      { status: 503, body: { error: { code: "ServiceUnavailable" } } },
      { status: 429, body: { error: { code: "TooManyRequests" } }, headers: { "retry-after": "30" } },
      { status: 429, body: { error: { code: "TooManyRequests" } }, headers: { "retry-after": "7200" } },
      { status: 400, body: { error: { code: "InvalidRecipient", message: "amna@notify-a.test is invalid" } } },
    ]);
    expect(await sendViaAcs(cfg, az.impl, email, "a", first)).toEqual({ ok: false, retry: "later", name: "ServiceUnavailable", status: 503, uncertain: true });
    expect(await sendViaAcs(cfg, az.impl, email, "b", first)).toEqual({ ok: false, retry: "later", name: "TooManyRequests", status: 429, waitSeconds: 30 });
    expect(await sendViaAcs(cfg, az.impl, email, "c", first)).toEqual({ ok: false, retry: "tomorrow", name: "TooManyRequests", status: 429 });
    const never = await sendViaAcs(cfg, az.impl, email, "d", first);
    expect(never).toEqual({ ok: false, retry: "never", name: "InvalidRecipient", status: 400 });
    expect(JSON.stringify(never)).not.toContain("notify-a.test");
  });

  it("a network failure is a retry, never a crash", async () => {
    const down = (async () => {
      throw new Error("ECONNRESET");
    }) as unknown as typeof fetch;
    expect(await sendViaAcs(cfg, down, email, "e", first)).toMatchObject({ ok: false, retry: "later", uncertain: true });
  });
});
