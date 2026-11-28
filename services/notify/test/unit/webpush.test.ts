import { describe, expect, it } from "vitest";
import { isPushEndpoint, pushRequest } from "../../src/domain/webpush";
import { parseVapidSecret, topicFor } from "../../src/store/push";
import { fakePushService, makeDevice, makeVapid } from "../fakes";

describe("web push (VAPID, aes128gcm) as web's notify-push and webpush tests held it", () => {
  it("a push decrypts on the device to the message, signed with the VAPID key", async () => {
    const vapid = await makeVapid();
    const device = await makeDevice("unit");
    const push = fakePushService(vapid, [device]);
    const message = { title: "Event reminder", body: "Dawn Count starts in an hour.", url: "/events/x", tag: "event99c0" };
    const req = await pushRequest({ endpoint: device.endpoint, p256dh: device.p256dh, auth: device.authB64 }, vapid.keys, message, { ttl: 3600, urgency: "high" });
    const res = await push.impl(req.url, req.init);
    expect(res.status).toBe(201);
    expect(push.delivered[0]!.message).toEqual(message);
    expect(push.delivered[0]!.headers).toMatchObject({ "content-encoding": "aes128gcm", ttl: "3600", urgency: "high", topic: "event99c0" });
  });

  it("only the browsers' push services are endpoints", () => {
    expect(isPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isPushEndpoint("https://web.push.apple.com/x")).toBe(true);
    expect(isPushEndpoint("https://db5p.notify.windows.com/w/?token=1")).toBe(true);
    for (const bad of ["http://fcm.googleapis.com/x", "https://fcm.googleapis.com:8443/x", "https://user@fcm.googleapis.com/x", "https://169.254.169.254/latest", "https://push.example.test/x", "not a url"])
      expect(isPushEndpoint(bad), bad).toBe(false);
  });

  it("topics: one per chat thread, otherwise per type and target", () => {
    const id = "99c00000-0000-4000-8000-000000000001";
    const short = id.replace(/-/g, "").slice(0, 24);
    expect(topicFor("chat_message", id)).toBe(`c${short}`);
    expect(topicFor("event_reminder", id)).toBe(`event${short}`);
    expect(topicFor("event_reminder", id)).toMatch(/^[A-Za-z0-9_-]{1,32}$/);
  });

  it("the Key Vault secret: JSON with the three values; anything else means push is off", async () => {
    const v = await makeVapid();
    expect(parseVapidSecret(v.secret)).toEqual(v.keys);
    for (const bad of [null, "", "placeholder", "{}", JSON.stringify({ public_key: "x", private_key: "y", subject: "mailto:a@b.test" })]) expect(parseVapidSecret(bad)).toBeNull();
  });
});
