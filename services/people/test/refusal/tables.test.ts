/**
 * Default-deny refusal tests for every people table (prd.md, "Rules for the new code": no table without an
 * owning service, default-deny row-level security, and a refusal test). Another service's role can neither
 * read nor write any of them; people's own role can. The audit log is append-only even for people.
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
const TABLES = [...SQL.matchAll(/create table people\.([a-z_]+)/g)].map((m) => m[1]!);

describe("people tables refuse every other service", () => {
  let pg: TestDatabase;
  let people: postgres.Sql;
  let content: postgres.Sql;
  beforeAll(async () => {
    pg = await startPostgres();
    people = await pg.service("people", MIGRATIONS);
    content = await pg.service("content", mkdtempSync(join(tmpdir(), "mig-")));
  });
  afterAll(async () => {
    await pg?.stop();
  });

  it("has every table under forced row-level security with one policy, for people's role", async () => {
    expect(TABLES.length).toBe(22);
    const rows = await pg.admin<{ relname: string; rls: boolean; forced: boolean; policies: string[] }[]>`
      select c.relname, c.relrowsecurity as rls, c.relforcerowsecurity as forced,
             coalesce((select array_agg(array_to_string(p.roles::text[], ',')) from pg_policies p where p.schemaname = 'people' and p.tablename = c.relname), '{}') as policies
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'people' and c.relkind = 'r' and c.relname <> '_migrations'`;
    expect(rows.map((r) => r.relname).sort()).toEqual([...TABLES].sort());
    for (const r of rows) expect([r.relname, r.rls, r.forced, r.policies]).toEqual([r.relname, true, true, ["svc_people"]]);
  });

  it.each(TABLES)("%s: another service cannot read, write or delete", async (table) => {
    await expect(content.unsafe(`select * from people.${table} limit 1`)).rejects.toThrow(/permission denied/);
    await expect(content.unsafe(`delete from people.${table}`)).rejects.toThrow(/permission denied/);
    await expect(content.unsafe(`insert into people.${table} default values`)).rejects.toThrow(/permission denied/);
    await expect(content.unsafe(`update people.${table} set ${table === "audit_log" ? "reason" : "updated_at"} = null`)).rejects.toThrow(/permission denied/);
  });

  it("people's own role reads its tables", async () => {
    for (const table of TABLES) await expect(people.unsafe(`select count(*) from people.${table}`)).resolves.toBeDefined();
  });

  it("the audit log is append-only: people may add and read rows, never change or remove them", async () => {
    await people`insert into people.audit_log (id, staff_id, action, target_type, target_id, reason) values (gen_random_uuid(), gen_random_uuid(), 'uni.open', 'university', 'x', 'test')`;
    await expect(people`update people.audit_log set reason = 'changed'`).rejects.toThrow(/permission denied/);
    await expect(people`delete from people.audit_log`).rejects.toThrow(/permission denied/);
  });

  it("the web app has no database role at all: people's rows are reachable only through its methods", async () => {
    const [row] = await pg.admin<{ n: number }[]>`select count(*)::int as n from pg_roles where rolname in ('anon', 'authenticated', 'svc_web')`;
    expect(row!.n).toBe(0);
  });
});
