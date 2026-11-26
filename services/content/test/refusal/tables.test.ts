/**
 * Default-deny refusal tests for every content table (prd.md, "Rules for the new code": no table without an
 * owning service, default-deny row-level security, and a refusal test). Another service's role can neither
 * read nor write any of them; content's own role can. Ported from the current stack's RLS refusals: there,
 * readers saw posts through policies and wrote only through functions; here nobody but content touches them.
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
const TABLES = [...SQL.matchAll(/create table content\.([a-z_]+)/g)].map((m) => m[1]!);

describe("content tables refuse every other service", () => {
  let pg: TestDatabase;
  let content: postgres.Sql;
  let people: postgres.Sql;
  beforeAll(async () => {
    pg = await startPostgres();
    content = await pg.service("content", MIGRATIONS);
    people = await pg.service("people", mkdtempSync(join(tmpdir(), "mig-")));
  });
  afterAll(async () => {
    await pg?.stop();
  });

  it("has every table under forced row-level security with one policy, for content's role", async () => {
    expect(TABLES.length).toBe(33);
    const rows = await pg.admin<{ relname: string; rls: boolean; forced: boolean; policies: string[] }[]>`
      select c.relname, c.relrowsecurity as rls, c.relforcerowsecurity as forced,
             coalesce((select array_agg(array_to_string(p.roles::text[], ',')) from pg_policies p where p.schemaname = 'content' and p.tablename = c.relname), '{}') as policies
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'content' and c.relkind = 'r' and c.relname <> '_migrations'`;
    expect(rows.map((r) => r.relname).sort()).toEqual([...TABLES].sort());
    for (const r of rows) expect([r.relname, r.rls, r.forced, r.policies]).toEqual([r.relname, true, true, ["svc_content"]]);
  });

  it.each(TABLES)("%s: another service cannot read, write or delete", async (table) => {
    await expect(people.unsafe(`select * from content.${table} limit 1`)).rejects.toThrow(/permission denied/);
    await expect(people.unsafe(`delete from content.${table}`)).rejects.toThrow(/permission denied/);
    await expect(people.unsafe(`insert into content.${table} default values`)).rejects.toThrow(/permission denied/);
    await expect(people.unsafe(`update content.${table} set ${table === "survey_questions" ? "active" : "user_id"} = null`)).rejects.toThrow(/permission denied/);
  });

  it("content's own role reads its tables", async () => {
    for (const table of TABLES) await expect(content.unsafe(`select count(*) from content.${table}`)).resolves.toBeDefined();
  });

  it("the web app has no database role at all: content's rows are reachable only through its methods", async () => {
    const [row] = await pg.admin<{ n: number }[]>`select count(*)::int as n from pg_roles where rolname in ('anon', 'authenticated', 'svc_web')`;
    expect(row!.n).toBe(0);
  });
});
