import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createServiceSigner, serviceKeysFrom, verifyServiceToken } from "../src/index";

const key = () => randomBytes(32).toString("base64url");

describe("service tokens", () => {
  it("names the caller for the right audience only", async () => {
    const keys = serviceKeysFrom(key());
    const token = await createServiceSigner(keys, "people")("content");
    expect(await verifyServiceToken(keys, token, "content")).toBe("people");
    expect(await verifyServiceToken(keys, token, "identity")).toBeNull();
  });

  it("accepts the previous key during a rotation, and nothing signed with another key", async () => {
    const old = key();
    const token = await createServiceSigner(serviceKeysFrom(old), "web")("people");
    expect(await verifyServiceToken(serviceKeysFrom(key(), old), token, "people")).toBe("web");
    expect(await verifyServiceToken(serviceKeysFrom(key()), token, "people")).toBeNull();
  });

  it("refuses short keys", () => {
    expect(() => serviceKeysFrom(randomBytes(16).toString("base64url"))).toThrow(/32 bytes/);
  });

  it("reuses a signed token for the same audience", async () => {
    const sign = createServiceSigner(serviceKeysFrom(key()), "web");
    expect(await sign("people")).toBe(await sign("people"));
  });
});
