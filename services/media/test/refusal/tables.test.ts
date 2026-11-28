/**
 * Default-deny refusal tests for every media table (prd.md, "Rules for the new code": no table without an
 * owning service, default-deny row-level security, and a refusal test). Another service's role can neither
 * read nor write any of them; media's own role can. Ported from the storage policies: there, students read their own
 * private files through the Storage API. Here files are read only through the signed links media makes.
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
const FIRST = Object.fromEntries([...SQL.matchAll(/create table media\.([a-z_0-9]+) \(\n\s+"?([a-z_]+)"?/gi)].map((m) => [m[1]!, m[2]!]));
const TABLES = Object.keys(FIRST);

describe("media tables refuse every other service", () => {
  let pg: TestDatabase;
  let media: postgres.Sql;
  let content: postgres.Sql;
  beforeAll(async () => {
    pg = await startPostgres();
    media = await pg.service("media", MIGRATIONS);
    content = await pg.service("content", mkdtempSync(join(tmpdir(), "mig-")));
  });
  afterAll(async () => {
    await pg?.stop();
  });

  it("has every table under forced row-level security with one policy, for media' role", async () => {
    expect(TABLES.length).toBe(2);
    const rows = await pg.admin<{ relname: string; rls: boolean; forced: boolean; policies: string[] }[]>`
      select c.relname, c.relrowsecurity as rls, c.relforcerowsecurity as forced,
             coalesce((select array_agg(array_to_string(p.roles::text[], ',')) from pg_policies p where p.schemaname = 'media' and p.tablename = c.relname), '{}') as policies
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'media' and c.relkind = 'r' and c.relname <> '_migrations'`;
    expect(rows.map((r) => r.relname).sort()).toEqual([...TABLES].sort());
    for (const r of rows) expect([r.relname, r.rls, r.forced, r.policies]).toEqual([r.relname, true, true, ["svc_media"]]);
  });

  it.each(TABLES)("%s: another service cannot read, write or delete", async (table) => {
    await expect(content.unsafe(`select * from media.${table} limit 1`)).rejects.toThrow(/permission denied/);
    await expect(content.unsafe(`delete from media.${table}`)).rejects.toThrow(/permission denied/);
    await expect(content.unsafe(`insert into media.${table} default values`)).rejects.toThrow(/permission denied/);
    await expect(content.unsafe(`update media.${table} set ${FIRST[table]!} = null`)).rejects.toThrow(/permission denied/);
  });

  it("media' own role reads its tables", async () => {
    for (const table of TABLES) await expect(media.unsafe(`select count(*) from media.${table}`)).resolves.toBeDefined();
  });

  it("the web app has no database role at all: media' rows are reachable only through its methods", async () => {
    const [row] = await pg.admin<{ n: number }[]>`select count(*)::int as n from pg_roles where rolname in ('anon', 'authenticated', 'svc_web')`;
    expect(row!.n).toBe(0);
  });
});
