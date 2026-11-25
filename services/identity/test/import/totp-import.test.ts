/**
 * Authenticator secrets survive the cutover (prd.md, "Two-factor": nobody re-enrols). Fixture factors with
 * generated secrets (no real data, no network) are exported as Supabase stores them (`auth.mfa_factors`,
 * base32 secret), imported into identity's schema encrypted with `identity-totp-key`, and the codes an
 * authenticator app would show for the original secret then verify through identity's own check.
 */
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { startPostgres, type TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { base32Encode, decryptTotpSecret, generateTotpSecret, totp } from "../../src/domain/totp";
import { importTotpFactors, importUsers } from "../../src/store/import";
import { verifyTotp } from "../../src/store/two-factor";
import { parseExport, parseFactorExport } from "../../../../tools/cutover/src/auth-import";

const MIGRATIONS = join(import.meta.dirname, "../../migrations");
const U1 = "0190f0b2-0000-7000-8000-000000000101";
const U2 = "0190f0b2-0000-7000-8000-000000000102";
const MISSING = "0190f0b2-0000-7000-8000-0000000001ff";
const F = (n: number) => `0190f0b2-0000-7000-8000-0000000002${String(n).padStart(2, "0")}`;

const user = (id: string, email: string) => ({
  id,
  email,
  encrypted_password: null,
  email_confirmed_at: "2026-01-01T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
  last_sign_in_at: null,
  banned_until: null,
});

describe("authenticator secrets import (local fixtures)", () => {
  let pg: TestDatabase;
  let sql: postgres.Sql;
  const key = randomBytes(32);
  const s1 = generateTotpSecret();
  const s2 = generateTotpSecret();
  const s3 = generateTotpSecret();
  const rows = [
    { id: F(1), user_id: U1, factor_type: "totp", status: "verified", secret: base32Encode(s1) },
    { id: F(2), user_id: U1, factor_type: "totp", status: "unverified", secret: base32Encode(generateTotpSecret()) },
    { id: F(3), user_id: U2, factor_type: "totp", status: "verified", secret: base32Encode(s2).toLowerCase() },
    { id: F(4), user_id: U2, factor_type: "totp", status: "verified", secret: base32Encode(s3) },
    { id: F(5), user_id: U2, factor_type: "phone", status: "verified", secret: null },
    { id: F(6), user_id: MISSING, factor_type: "totp", status: "verified", secret: base32Encode(generateTotpSecret()) },
  ];

  beforeAll(async () => {
    pg = await startPostgres();
    sql = await pg.service("identity", MIGRATIONS);
    await importUsers(sql, parseExport([user(U1, "one@golden-uni.test"), user(U2, "two@golden-uni.test")].map((u) => JSON.stringify(u)).join("\n")));
  });
  afterAll(async () => {
    await pg?.stop();
  });

  it("parses the factor export and names only the bad field", () => {
    expect(parseFactorExport(rows.map((r) => JSON.stringify(r)).join("\n") + "\n")).toHaveLength(6);
    const bad = JSON.stringify({ ...rows[0], user_id: "nope", secret: "JBSWY3DPEHPK3PXP" });
    expect(() => parseFactorExport(bad)).toThrow(/factor export line 1: user_id/);
    expect(() => parseFactorExport(bad)).not.toThrow(/JBSWY3DPEHPK3PXP/);
  });

  it("a secret that is not base32 stops the import before anything is written", async () => {
    const odd = { id: F(9), user_id: U1, factor_type: "totp", status: "verified", secret: '{"key_id":"x","nonce":"y"}' };
    expect(await importTotpFactors(sql, key, [rows[0]!, odd])).toEqual({ factors: 0, skipped: 0, orphans: [], unknownSecrets: [F(9)] });
    expect(await sql`select 1 from identity.totp_factors`).toHaveLength(0);
  });

  it("imports verified TOTP factors once, encrypted, and skips the rest", async () => {
    const parsed = parseFactorExport(rows.map((r) => JSON.stringify(r)).join("\n"));
    expect(await importTotpFactors(sql, key, parsed)).toEqual({ factors: 3, skipped: 2, orphans: [F(6)], unknownSecrets: [] });
    expect(await importTotpFactors(sql, key, parsed)).toEqual({ factors: 0, skipped: 2, orphans: [F(6)], unknownSecrets: [] });
    const stored = await sql<{ id: string; user_id: string; status: string; secret_ciphertext: Buffer }[]>`
      select id::text, user_id::text, status, secret_ciphertext from identity.totp_factors order by id`;
    expect(stored.map((r) => [r.id, r.user_id, r.status])).toEqual([
      [F(1), U1, "verified"],
      [F(3), U2, "verified"],
      [F(4), U2, "verified"],
    ]);
    const plain = new Map([
      [F(1), s1],
      [F(3), s2],
      [F(4), s3],
    ]);
    for (const r of stored) {
      expect(r.secret_ciphertext.includes(plain.get(r.id)!)).toBe(false);
      expect(decryptTotpSecret(key, r.secret_ciphertext, r.id)).toEqual(plain.get(r.id));
    }
  });

  it("the codes the authenticator app shows verify after import, once", async () => {
    const now = Date.now() / 1000;
    await sql.begin(async (tx) => {
      expect(await verifyTotp(tx, key, { id: U1, aal: "aal1" }, null, totp(s1, now), now)).toEqual({ ok: true, factorId: F(1), enrolled: false });
      expect(await verifyTotp(tx, key, { id: U1, aal: "aal1" }, null, totp(s1, now), now)).toEqual({ ok: false, reason: "invalid_code" });
      // Either of a user's authenticators works.
      expect(await verifyTotp(tx, key, { id: U2, aal: "aal1" }, null, totp(s3, now), now)).toEqual({ ok: true, factorId: F(4), enrolled: false });
    });
  });
});
