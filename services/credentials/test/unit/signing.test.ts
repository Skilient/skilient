/**
 * The signing port: apps/web/tests/unit/cv-canonical.test.ts's cases run against the service's code, and a
 * cross-check with the web's own Web Crypto code (the Edge Function's) both ways, so a signature made here is what
 * the Edge Function made and every old one still verifies.
 */
import { describe, expect, it } from "vitest";
import { checkRecordEnvelope, signRecordEnvelope } from "../../../../apps/web/supabase/functions/_shared/cv/record.ts";
import { checkEnvelope, signEnvelope } from "../../../../apps/web/supabase/functions/_shared/cv/sign.ts";
import { parseSigningSecret, signingSecret } from "../../src/signing/keys";
import { CanonicalError, canonicalize } from "../../src/signing/canonical";
import { check, cvEnvelopeOf, generateSigningKey, newCode, normaliseCode, publicKeyOf, recordEnvelopeOf, sign, type CvEnvelope } from "../../src/signing/sign";

function fromBits(hex: string): number {
  const view = new DataView(new ArrayBuffer(8));
  view.setBigUint64(0, BigInt(`0x${hex}`));
  return view.getFloat64(0);
}

describe("RFC 8785 canonical JSON (the web's cases)", () => {
  it("matches the RFC's section 3.2.2 example", () => {
    const input = JSON.parse(
      '{"numbers": [333333333.33333329, 1E30, 4.50, 2e-3, 0.000000000000000000000000001],' +
        '"string": "\\u20ac$\\u000F\\u000aA\'\\u0042\\u0022\\u005c\\\\\\"\\/",' +
        '"literals": [null, true, false]}',
    );
    expect(canonicalize(input)).toBe(
      '{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\\u000f\\nA\'B\\"\\\\\\\\\\"/"}',
    );
  });

  it("sorts keys by UTF-16 code units (section 3.2.3)", () => {
    const input = JSON.parse(
      '{"\\u20ac": "Euro Sign", "\\r": "Carriage Return", "\\ufb33": "Hebrew Letter Dalet With Dagesh", "1": "One",' +
        '"\\ud83d\\ude00": "Emoji: Grinning Face", "\\u0080": "Control", "\\u00f6": "Latin Small Letter O With Diaeresis"}',
    );
    expect(canonicalize(input)).toBe(
      '{"\\r":"Carriage Return","1":"One","\u0080":"Control","ö":"Latin Small Letter O With Diaeresis",' +
        '"€":"Euro Sign","😀":"Emoji: Grinning Face","דּ":"Hebrew Letter Dalet With Dagesh"}',
    );
  });

  it("serialises numbers as in Appendix B and refuses what isn't I-JSON", () => {
    const cases: [string, string][] = [
      ["0000000000000000", "0"],
      ["8000000000000000", "0"],
      ["0000000000000001", "5e-324"],
      ["7fefffffffffffff", "1.7976931348623157e+308"],
      ["4340000000000000", "9007199254740992"],
      ["4430000000000000", "295147905179352830000"],
      ["44b52d02c7e14af6", "1e+23"],
      ["444b1ae4d6e2ef50", "1e+21"],
      ["3eb0c6f7a0b5ed8d", "0.000001"],
      ["41b3de4355555555", "333333333.3333333"],
      ["becbf647612f3696", "-0.0000033333333333333333"],
      ["43143ff3c1cb0959", "1424953923781206.2"],
    ];
    for (const [bits, text] of cases) expect(canonicalize(fromBits(bits))).toBe(text);
    expect(() => canonicalize(fromBits("7ff0000000000000"))).toThrow(CanonicalError);
    expect(() => canonicalize(NaN)).toThrow(CanonicalError);
    expect(() => canonicalize({ a: "\ud800" })).toThrow(CanonicalError);
    expect(() => canonicalize({ a: () => 1 })).toThrow(CanonicalError);
    expect(canonicalize({ b: [], a: {}, c: "😀" })).toBe('{"a":{},"b":[],"c":"😀"}');
  });
});

describe("signatures and codes", () => {
  const envelope = (snapshot: Record<string, unknown>, code = "ABCDE12345"): CvEnvelope => ({
    v: 1,
    code,
    key_id: "cv-20261001-aaaaaaaa",
    issued_at: "2026-10-01T19:30:00Z",
    expires_at: "2027-10-01T19:30:00Z",
    snapshot,
  });

  it("verifies with the signing key only, and catches any change", () => {
    const key = generateSigningKey(new Date("2026-10-01T00:00:00Z"));
    const other = generateSigningKey();
    expect(key.keyId).toMatch(/^cv-20261001-[0-9a-f]{8}$/);
    expect(publicKeyOf(key.privateKey)).toBe(key.publicKey);
    const env = envelope({ person: { name: "Ayesha" }, skills: [{ id: "react", level: 3 }] });
    const { hash, signature } = sign(env, key.privateKey);
    expect(signature).toMatch(/^[A-Za-z0-9_-]{86}$/);
    expect(check(env, hash, signature, key.publicKey)).toBe("valid");
    expect(check(env, hash, signature, other.publicKey)).toBe("bad_signature");
    const reordered = { ...env, snapshot: { skills: [{ level: 3, id: "react" }], person: { name: "Ayesha" } } };
    expect(check(reordered, hash, signature, key.publicKey)).toBe("valid");
    expect(check(envelope({ person: { name: "Ayesha" }, skills: [{ id: "react", level: 4 }] }), hash, signature, key.publicKey)).toBe("hash_mismatch");
    expect(check(envelope(env.snapshot, "ZZZZZ99999"), hash, signature, key.publicKey)).toBe("hash_mismatch");
  });

  it("signs exactly as the Edge Function did: each side verifies the other's, byte for byte", async () => {
    const key = generateSigningKey();
    const cv = cvEnvelopeOf({ code: newCode(), key_id: key.keyId, issued_at: new Date("2026-11-01T10:00:00.400Z"), expires_at: "2027-11-01T10:00:00Z", snapshot: { a: 1, b: "ü" } });
    expect(cv.issued_at).toBe("2026-11-01T10:00:00Z");
    const ours = sign(cv, key.privateKey);
    const theirs = await signEnvelope(cv, key.privateKey);
    expect(ours).toEqual(theirs);
    expect(await checkEnvelope(cv, ours.hash, ours.signature, key.publicKey)).toBe("valid");
    const entry = recordEnvelopeOf({ code: newCode(), key_id: key.keyId, signed_at: "2026-11-01T10:00:00Z", payload: { schema: "skilient.record/1", kind: "attended" } });
    const mine = sign(entry, key.privateKey);
    expect(mine).toEqual(await signRecordEnvelope(entry, key.privateKey));
    expect(await checkRecordEnvelope(entry, mine.hash, mine.signature, key.publicKey)).toBe("valid");
    expect(check(entry, mine.hash, mine.signature, key.publicKey)).toBe("valid");
  });

  it("makes 10-character Crockford codes and reads them back forgivingly", () => {
    const codes = new Set(Array.from({ length: 200 }, () => newCode()));
    expect(codes.size).toBe(200);
    for (const code of codes) expect(code).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{10}$/);
    expect(normaliseCode("abcde-12345")).toBe("ABCDE12345");
    expect(normaliseCode("0Il1o-ABCDE")).toBe("01110ABCDE");
    expect(normaliseCode("ABCDU12345")).toBeNull();
  });

  it("reads the Key Vault secret {key_id, private_key} and refuses anything else", () => {
    const key = generateSigningKey();
    expect(parseSigningSecret(signingSecret(key))).toEqual({ keyId: key.keyId, privateKey: key.privateKey });
    expect(() => parseSigningSecret("not json")).toThrow();
    expect(() => parseSigningSecret(JSON.stringify({ key_id: "bad", private_key: key.privateKey }))).toThrow();
  });
});
