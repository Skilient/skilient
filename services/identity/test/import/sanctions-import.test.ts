/**
 * Existing sanctions reach identity at cutover (W14 obligation): fixture `public.sanctions` rows (no network,
 * no production data) are parsed by tools/cutover and written by identity into `identity.sanction_marks`.
 */
import { join } from "node:path";
import { uuidv7 } from "@skilient/platform";
import { startPostgres, type TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseSanctionExport } from "../../../../tools/cutover/src/auth-import";
import { importSanctionMarks } from "../../src/store/import";

const MIGRATIONS = join(import.meta.dirname, "../../migrations");

describe("sanctions import", () => {
  let pg: TestDatabase;
  let sql: postgres.Sql;
  beforeAll(async () => {
    pg = await startPostgres();
    sql = await pg.service("identity", MIGRATIONS);
  });
  afterAll(async () => {
    await pg?.stop();
  });

  it("carries user sanctions across, skips organisation sanctions and throttles, and reports missing accounts", async () => {
    const user = uuidv7();
    await sql`insert into identity.users (id, email, email_confirmed_at) values (${user}, ${`sanctioned-${user.slice(-6)}@imported-uni.test`}, now())`;
    const staff = uuidv7();
    const base = { reason: "Repeated spam.", staff_id: staff, created_at: "2026-03-01T00:00:00Z", lifted_at: null, lifted_by: null, lift_reason: null };
    const rows = [
      { ...base, id: uuidv7(), user_id: user, kind: "suspend", until: "2099-01-01T00:00:00Z" },
      { ...base, id: uuidv7(), user_id: null, kind: "suspend", until: "2099-01-01T00:00:00Z" },
      { ...base, id: uuidv7(), user_id: user, kind: "throttle", until: null },
      { ...base, id: uuidv7(), user_id: uuidv7(), kind: "ban", until: null },
    ];
    const parsed = parseSanctionExport(rows.map((r) => JSON.stringify(r)).join("\n"));
    expect(await importSanctionMarks(sql, parsed)).toEqual({ imported: 1, skipped: 2, missingAccounts: [rows[3]!.id] });
    expect(await importSanctionMarks(sql, parsed)).toMatchObject({ imported: 0 });
    const marks = await sql`select kind, until is not null as timed from identity.sanction_marks where user_id = ${user}`;
    expect(marks).toEqual([{ kind: "suspend", timed: true }]);
  });
});
