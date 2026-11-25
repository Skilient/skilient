/**
 * "Imported hashes verify" (prd.md W1 done-when), with local fixture hashes only. Fixture accounts are
 * created on the LOCAL Supabase stack through its Auth admin API (so Supabase itself hashes their known
 * passwords), exported from local `auth.users`, imported into identity's schema in a test container, and
 * checked with identity's verifier. They are deleted from the local stack afterwards.
 * Needs: GOLDEN_STACK_DB_URL, E2E_SUPABASE_URL and E2E_SUPABASE_SECRET_KEY (all local; checked by
 * assertLocalStack). Without them only the unit cases run.
 */
import { join } from "node:path";
import { hashAlgorithm, verifyPassword } from "../../src/domain/password";
import { assertLocalStack, callCurrentStackSql } from "@skilient/testing";
import { startPostgres, type TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { importUsers } from "../../src/store/import";
import { parseExport, type ExportedUser } from "../../../../tools/cutover/src/auth-import";

const DB = process.env["GOLDEN_STACK_DB_URL"];
const AUTH = process.env["E2E_SUPABASE_URL"];
const SECRET = process.env["E2E_SUPABASE_SECRET_KEY"];
const LOCAL = Boolean(DB && AUTH && SECRET);
if (DB !== undefined) assertLocalStack(DB);
if (AUTH !== undefined) assertLocalStack(AUTH);

const MIGRATIONS = join(import.meta.dirname, "../../migrations");
// Fixture accounts and passwords for the local stack only; not secrets.
const FIXTURES = [
  { email: "golden.import.one@nutech.edu.pk", password: "Golden-import-Passw0rd-1" },
  { email: "golden.import.two@nutech.edu.pk", password: "Golden-import-Passw0rd-2" },
];

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

describe.skipIf(!LOCAL)("imported hashes verify (local fixtures)", () => {
  let pg: TestDatabase;
  let identity: postgres.Sql;
  let exported: ExportedUser[];

  async function admin(path: string, init: RequestInit): Promise<Response> {
    return fetch(`${AUTH}/auth/v1/admin/${path}`, { ...init, headers: { apikey: SECRET!, authorization: `Bearer ${SECRET}`, "content-type": "application/json" } });
  }
  async function removeFixtures(): Promise<void> {
    const out = await callCurrentStackSql(DB!, (tx) => tx`delete from auth.users where email = any(${FIXTURES.map((f) => f.email)})`, { commit: true });
    if (!out.ok) throw new Error(`cleanup: ${out.code} ${out.message}`);
  }

  beforeAll(async () => {
    await removeFixtures();
    for (const f of FIXTURES) {
      const res = await admin("users", { method: "POST", body: JSON.stringify({ email: f.email, password: f.password, email_confirm: true }) });
      if (!res.ok) throw new Error(`create fixture: ${res.status}`);
    }
    const rows = await callCurrentStackSql(
      DB!,
      (tx) => tx<ExportedUser[]>`
        select id::text, email, encrypted_password, email_confirmed_at::text, created_at::text, last_sign_in_at::text, banned_until::text
          from auth.users where email = any(${FIXTURES.map((f) => f.email)}) order by email`,
    );
    if (!rows.ok) throw new Error(rows.message);
    exported = parseExport(rows.value.map((r) => JSON.stringify(r)).join("\n"));
    pg = await startPostgres();
    identity = await pg.service("identity", MIGRATIONS);
  });
  afterAll(async () => {
    await removeFixtures();
    await pg?.stop();
  });

  it("Supabase stored bcrypt hashes for the fixtures", () => {
    expect(exported).toHaveLength(2);
    for (const u of exported) expect(hashAlgorithm(u.encrypted_password!)).toBe("bcrypt");
  });

  it("imports them unchanged, once, and each verifies against its password", async () => {
    expect(await importUsers(identity, exported)).toEqual({ users: 2, passwords: 2, withoutPassword: 0, unknownHashes: [] });
    expect(await importUsers(identity, exported)).toEqual({ users: 0, passwords: 0, withoutPassword: 0, unknownHashes: [] });
    for (const u of exported) {
      const [row] = await identity<{ hash: string; algorithm: string; imported: boolean }[]>`
        select hash, algorithm, imported from identity.password_credentials where user_id = ${u.id}`;
      expect(row).toEqual({ hash: u.encrypted_password, algorithm: "bcrypt", imported: true });
      const f = FIXTURES.find((x) => x.email === u.email)!;
      expect(await verifyPassword(row!.hash, f.password)).toBe(true);
      expect(await verifyPassword(row!.hash, `${f.password}x`)).toBe(false);
    }
  });

  it("an unknown hash format stops the import before anything is written", async () => {
    const odd = { ...exported[0]!, id: "0190f0b2-0000-7000-8000-0000000000ff", email: "odd@golden.test", encrypted_password: "$1$md5$notsupported" };
    expect(await importUsers(identity, [odd])).toEqual({ users: 0, passwords: 0, withoutPassword: 0, unknownHashes: [odd.id] });
    expect(await identity`select 1 from identity.users where id = ${odd.id}`).toHaveLength(0);
  });
});
