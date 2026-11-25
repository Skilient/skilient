/**
 * Default-deny refusal tests for every identity table (prd.md, "Rules for the new code": no table without an
 * owning service, default-deny row-level security, and a refusal test). Another service's role can neither
 * read nor write any of them; identity's own role can.
 */
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startPostgres, type TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS = join(import.meta.dirname, "../../migrations");
const SQL = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(MIGRATIONS, f), "utf8"))
  .join("\n");
const DROPPED = new Set([...SQL.matchAll(/drop table identity\.([a-z_]+)/g)].map((m) => m[1]!));
const TABLES = [...SQL.matchAll(/create table identity\.([a-z_]+)/g)].map((m) => m[1]!).filter((t) => !DROPPED.has(t));

describe("identity tables refuse every other service", () => {
  let pg: TestDatabase;
  let identity: postgres.Sql;
  let people: postgres.Sql;
  beforeAll(async () => {
    pg = await startPostgres();
    identity = await pg.service("identity", MIGRATIONS);
    people = await pg.service("people", mkdtempSync(join(tmpdir(), "mig-")));
  });
  afterAll(async () => {
    await pg?.stop();
  });

  it("has every table under forced row-level security", async () => {
    expect(TABLES.length).toBeGreaterThanOrEqual(18);
    const rows = await pg.admin<{ relname: string; rls: boolean; forced: boolean }[]>`
      select c.relname, c.relrowsecurity as rls, c.relforcerowsecurity as forced
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'identity' and c.relkind = 'r' and c.relname <> '_migrations'`;
    expect(rows.map((r) => r.relname).sort()).toEqual([...TABLES].sort());
    for (const r of rows) expect([r.relname, r.rls, r.forced]).toEqual([r.relname, true, true]);
  });

  it.each(TABLES)("%s: another service cannot read, write or delete", async (table) => {
    await expect(people.unsafe(`select * from identity.${table} limit 1`)).rejects.toThrow(/permission denied/);
    await expect(people.unsafe(`delete from identity.${table}`)).rejects.toThrow(/permission denied/);
    await expect(people.unsafe(`insert into identity.${table} default values`)).rejects.toThrow(/permission denied/);
  });

  it("identity's own role reads its tables", async () => {
    for (const table of TABLES) await expect(identity.unsafe(`select count(*) from identity.${table}`)).resolves.toBeDefined();
  });
});
