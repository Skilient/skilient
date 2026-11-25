/** The export parser and hash formats; the import itself is tested in services/identity/test/import. */
import { hashAlgorithm } from "@skilient/identity/domain/password";
import { describe, expect, it } from "vitest";
import { parseExport, parseFactorExport } from "../src/auth-import";

describe("hash formats", () => {
  it("recognises bcrypt and refuses anything else", () => {
    expect(hashAlgorithm("$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234")).toBe("bcrypt");
    expect(hashAlgorithm("$2b$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234")).toBe("bcrypt");
    for (const h of ["", "plaintext", "$1$md5$x", "$2a$10$short", "pbkdf2_sha256$1$x$y"]) expect(hashAlgorithm(h)).toBeNull();
  });

  it("parses an export and rejects a malformed line", () => {
    const line = JSON.stringify({ id: "0190f0b2-0000-7000-8000-000000000001", email: "a@b.test", encrypted_password: null, email_confirmed_at: null, created_at: "2026-01-01T00:00:00Z", last_sign_in_at: null, banned_until: null });
    expect(parseExport(`${line}\n\n`)).toHaveLength(1);
    expect(() => parseExport(`{"id":"nope"}`)).toThrow(/export line 1/);
  });
});

describe("factor export", () => {
  it("parses auth.mfa_factors rows and never echoes a secret in its errors", () => {
    const row = { id: "0190f0b2-0000-7000-8000-000000000201", user_id: "0190f0b2-0000-7000-8000-000000000101", factor_type: "totp", status: "verified", secret: "JBSWY3DPEHPK3PXP" };
    expect(parseFactorExport(`${JSON.stringify(row)}\n`)).toEqual([row]);
    expect(parseFactorExport(JSON.stringify({ ...row, factor_type: "phone", secret: null }))[0]?.secret).toBeNull();
    const bad = JSON.stringify({ ...row, id: "nope" });
    expect(() => parseFactorExport(bad)).toThrow(/factor export line 1: id/);
    expect(() => parseFactorExport(bad)).not.toThrow(/JBSWY3DPEHPK3PXP/);
  });
});
