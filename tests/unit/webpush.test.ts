import { describe, expect, it } from "vitest";
import {
  b64urlDecode,
  b64urlEncode,
  decryptPayload,
  encryptPayload,
  isPushEndpoint,
  pushRequest,
  vapidAuthorization,
} from "../../supabase/functions/_shared/notify/webpush.ts";

/** A browser's side of a subscription: an ECDH key pair and a 16-byte auth secret. */
async function fakeSubscription() {
  const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { privateKey: pair.privateKey, raw, auth, target: { endpoint: "https://fcm.googleapis.com/fcm/send/abc123", p256dh: b64urlEncode(raw), auth: b64urlEncode(auth) } };
}

async function vapidKeys() {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { keys: { publicKey: b64urlEncode(raw), privateKey: jwk.d!, subject: "https://www.skilient.com" }, verifyKey: pair.publicKey };
}

describe("web push (PRD 5.34, RFC 8291 / 8292)", () => {
  it("encrypts a message only the subscription can read", async () => {
    const sub = await fakeSubscription();
    const body = await encryptPayload(sub.target, new TextEncoder().encode('{"title":"In an hour"}'));
    // Header: 16-byte salt, record size 4096, key id length 65, then the sender's public key.
    expect(new DataView(body.buffer).getUint32(16)).toBe(4096);
    expect(body[20]).toBe(65);
    const plain = await decryptPayload(body, sub.privateKey, sub.raw, sub.auth);
    expect(new TextDecoder().decode(plain)).toBe('{"title":"In an hour"}');
    // Another device's keys can't open it.
    const other = await fakeSubscription();
    await expect(decryptPayload(body, other.privateKey, other.raw, other.auth)).rejects.toThrow();
  });

  it("signs a VAPID token for the push service's origin that verifies with the public key", async () => {
    const { keys, verifyKey } = await vapidKeys();
    const now = new Date("2026-11-04T10:00:00Z");
    const header = await vapidAuthorization("https://fcm.googleapis.com/fcm/send/abc", keys, now);
    const [, t, k] = /^vapid t=([^,]+), k=(.+)$/.exec(header)!;
    expect(k).toBe(keys.publicKey);
    const [h, c, sig] = t.split(".");
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(c)));
    expect(claims).toEqual({ aud: "https://fcm.googleapis.com", exp: now.getTime() / 1000 + 12 * 3600, sub: "https://www.skilient.com" });
    expect(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, verifyKey, b64urlDecode(sig), new TextEncoder().encode(`${h}.${c}`))).toBe(true);
  });

  it("builds the request with the encoding, TTL, urgency and a topic", async () => {
    const sub = await fakeSubscription();
    const { keys } = await vapidKeys();
    const req = await pushRequest(sub.target, keys, { title: "t", body: "b", url: "/x", tag: "event1abc" }, { ttl: 3600, urgency: "high" });
    const headers = req.init.headers as Record<string, string>;
    expect(req.url).toBe(sub.target.endpoint);
    expect(headers["Content-Encoding"]).toBe("aes128gcm");
    expect(headers.TTL).toBe("3600");
    expect(headers.Urgency).toBe("high");
    expect(headers.Topic).toBe("event1abc");
    expect(headers.Authorization).toMatch(/^vapid t=/);
  });

  it("only calls the browsers' push services", () => {
    for (const ok of [
      "https://fcm.googleapis.com/fcm/send/x",
      "https://updates.push.services.mozilla.com/wpush/v2/x",
      "https://web.push.apple.com/QG",
      "https://wns2-par02p.notify.windows.com/w/?token=x",
    ]) {
      expect(isPushEndpoint(ok), ok).toBe(true);
    }
    for (const bad of [
      "http://fcm.googleapis.com/fcm/send/x",
      "https://fcm.googleapis.com.evil.test/x",
      "https://127.0.0.1/x",
      "https://fcm.googleapis.com:8443/x",
      "https://user:pw@fcm.googleapis.com/x",
      "https://notify.windows.com/x",
      "not a url",
    ]) {
      expect(isPushEndpoint(bad), bad).toBe(false);
    }
  });
});
