/**
 * Google-only accounts keep signing in with Google after cutover (decision 2026-11-25: 8 Google-only accounts
 * and 1 linked account). Fixture `auth.identities` rows (no network, no production data) are parsed by
 * tools/cutover and written by identity; the mapped account then signs in through the same lookup
 * SignInWithGoogle uses.
 */
import { join } from "node:path";
import { startPostgres, type TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseIdentities } from "../../../../tools/cutover/src/identities-import";
import { findGoogleAccount } from "../../src/store/google";
import { importIdentities } from "../../src/store/import-identities";
import { importUsers } from "../../src/store/import";

const MIGRATIONS = join(import.meta.dirname, "../../migrations");
const GOOGLE_ONLY = "0190f0b2-0000-7000-8000-0000000000a1";
const LINKED = "0190f0b2-0000-7000-8000-0000000000a2";
const MISSING = "0190f0b2-0000-7000-8000-0000000000a9";
const user = (id: string, email: string, hash: string | null) => ({
  id,
  email,
  encrypted_password: hash,
  email_confirmed_at: "2026-01-01T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
  last_sign_in_at: null,
  banned_until: null,
});

describe("Google identities import", () => {
  let pg: TestDatabase;
  let sql: postgres.Sql;
  beforeAll(async () => {
    pg = await startPostgres();
    sql = await pg.service("identity", MIGRATIONS);
    await importUsers(sql, [
      user(GOOGLE_ONLY, "only.google@import-uni.test", null),
      user(LINKED, "linked@import-uni.test", "$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234"),
    ]);
  });
  afterAll(async () => {
    await pg?.stop();
  });

  const exportLines = (rows: object[]) => rows.map((r) => JSON.stringify(r)).join("\n");

  it("refuses the whole import when a row names an account that was not imported", async () => {
    const rows = parseIdentities(exportLines([{ provider: "google", provider_id: "g-1", user_id: GOOGLE_ONLY }, { provider: "google", provider_id: "g-9", user_id: MISSING }]));
    expect(await importIdentities(sql, rows)).toEqual({ identities: 0, skipped: 0, missingUsers: [MISSING] });
    expect(await sql`select count(*)::int as n from identity.identities`).toEqual([{ n: 0 }]);
  });

  it("maps Google identities, skips email ones, and is safe to run twice", async () => {
    const rows = parseIdentities(
      exportLines([
        { provider: "google", provider_id: "g-1", user_id: GOOGLE_ONLY, email: "Only.Google@import-uni.test", identity_data: { name: "kept out" } },
        { provider: "google", provider_id: "g-2", user_id: LINKED, email: "linked@import-uni.test" },
        { provider: "email", provider_id: LINKED, user_id: LINKED, email: "linked@import-uni.test" },
      ]),
    );
    expect(await importIdentities(sql, rows)).toEqual({ identities: 2, skipped: 1, missingUsers: [] });
    expect(await importIdentities(sql, rows)).toEqual({ identities: 0, skipped: 1, missingUsers: [] });
    expect(await sql`select provider_user_id, user_id::text, email_at_link from identity.identities order by provider_user_id`).toEqual([
      { provider_user_id: "g-1", user_id: GOOGLE_ONLY, email_at_link: "only.google@import-uni.test" },
      { provider_user_id: "g-2", user_id: LINKED, email_at_link: "linked@import-uni.test" },
    ]);
    // The linked account keeps its password too.
    expect(await sql`select user_id::text from identity.password_credentials`).toEqual([{ user_id: LINKED }]);
  });

  it("a mapped account is found by its Google id, whatever address Google now reports", async () => {
    const found = await sql.begin((tx) => findGoogleAccount(tx, { sub: "g-1", email: "changed@import-uni.test", name: null }));
    expect(found).toEqual({ userId: GOOGLE_ONLY, linked: true });
  });
});
