/** TOTP (RFC 6238 / RFC 4226 test vectors), base32, secret encryption and the breached-password check. */
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isBreachedPassword } from "../../src/domain/breached";
import {
  base32Decode,
  base32Encode,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  hotp,
  matchTotp,
  otpauthUri,
  totp,
  totpStep,
} from "../../src/domain/totp";

const RFC_SECRET = Buffer.from("12345678901234567890", "ascii");

describe("TOTP", () => {
  it("matches the RFC 4226 HOTP vectors", () => {
    const expected = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
    expect(expected.map((_, i) => hotp(RFC_SECRET, i))).toEqual(expected);
  });

  it("matches the RFC 6238 SHA-1 vectors (8 digits, and their last 6)", () => {
    const vectors: [number, string][] = [
      [59, "94287082"],
      [1111111109, "07081804"],
      [1111111111, "14050471"],
      [1234567890, "89005924"],
      [2000000000, "69279037"],
      [20000000000, "65353130"],
    ];
    for (const [t, code] of vectors) {
      expect(totp(RFC_SECRET, t, 8)).toBe(code);
      expect(totp(RFC_SECRET, t)).toBe(code.slice(2));
    }
  });

  it("accepts one step either side, never further, and never a used step again", () => {
    const t = 1_700_000_000;
    const step = totpStep(t);
    expect(matchTotp(RFC_SECRET, totp(RFC_SECRET, t), t, null)).toBe(step);
    expect(matchTotp(RFC_SECRET, totp(RFC_SECRET, t - 30), t, null)).toBe(step - 1);
    expect(matchTotp(RFC_SECRET, totp(RFC_SECRET, t + 30), t, null)).toBe(step + 1);
    expect(matchTotp(RFC_SECRET, totp(RFC_SECRET, t - 60), t, null)).toBeNull();
    expect(matchTotp(RFC_SECRET, totp(RFC_SECRET, t + 60), t, null)).toBeNull();
    // Replay protection: the step already used, or an older one, is refused.
    expect(matchTotp(RFC_SECRET, totp(RFC_SECRET, t), t, step)).toBeNull();
    expect(matchTotp(RFC_SECRET, totp(RFC_SECRET, t - 30), t, step - 1)).toBeNull();
    expect(matchTotp(RFC_SECRET, totp(RFC_SECRET, t + 30), t, step)).toBe(step + 1);
    for (const bad of ["", "12345", "1234567", "abcdef", " 12345"]) expect(matchTotp(RFC_SECRET, bad, t, null)).toBeNull();
  });

  it("base32 round-trips and matches RFC 4648", () => {
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
    expect(base32Decode("MZXW6YTBOI======")?.toString()).toBe("foobar");
    expect(base32Decode("mzxw 6ytb oi")?.toString()).toBe("foobar");
    expect(base32Decode("not base32!")).toBeNull();
    const s = generateTotpSecret();
    expect(s).toHaveLength(20);
    expect(base32Decode(base32Encode(s))).toEqual(s);
  });

  it("builds the otpauth URI apps read", () => {
    expect(otpauthUri("JBSWY3DPEHPK3PXP", "a@b.test")).toBe(
      "otpauth://totp/Skilient%3Aa%40b.test?secret=JBSWY3DPEHPK3PXP&issuer=Skilient&algorithm=SHA1&digits=6&period=30",
    );
  });

  it("encrypts secrets bound to their factor, and refuses another key or factor", () => {
    const key = randomBytes(32);
    const secret = generateTotpSecret();
    const blob = encryptTotpSecret(key, secret, "f1");
    expect(blob.includes(secret)).toBe(false);
    expect(decryptTotpSecret(key, blob, "f1")).toEqual(secret);
    expect(() => decryptTotpSecret(key, blob, "f2")).toThrow();
    expect(() => decryptTotpSecret(randomBytes(32), blob, "f1")).toThrow();
    expect(() => encryptTotpSecret(randomBytes(16), secret, "f1")).toThrow();
  });
});

describe("breached passwords", () => {
  // SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
  const fake = (body: string, status = 200) => (async () => new Response(body, { status })) as unknown as typeof fetch;

  it("finds the suffix in the range, and sends only the prefix", async () => {
    let asked = "";
    const spy = (async (url: string) => {
      asked = url;
      return new Response("1E4C9B93F3F0682250B6CF8331B7EE68FD8:3\r\n0000000000000000000000000000000000A:0\r\n");
    }) as unknown as typeof fetch;
    expect(await isBreachedPassword("password", { fetch: spy, baseUrl: "http://fake/range/" })).toBe(true);
    expect(asked).toBe("http://fake/range/5BAA6");
  });

  it("a padded zero count is not a breach; an absent suffix is not either", async () => {
    expect(await isBreachedPassword("password", { fetch: fake("1E4C9B93F3F0682250B6CF8331B7EE68FD8:0\n") })).toBe(false);
    expect(await isBreachedPassword("password", { fetch: fake("ABC:9\n") })).toBe(false);
  });

  it("fails open when the API errors", async () => {
    expect(await isBreachedPassword("password", { fetch: fake("", 503) })).toBe(false);
    const down = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await isBreachedPassword("password", { fetch: down })).toBe(false);
  });
});
