import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate, readMigrations } from "@skilient/platform/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startPostgres, type TestDatabase } from "../src/postgres";

const fixtures = join(import.meta.dirname, "fixtures");

describe("Postgres harness", () => {
  let pg: TestDatabase;
  beforeAll(async () => {
    pg = await startPostgres();
  }, 120_000);
  afterAll(async () => {
    await pg?.stop();
  });

  it("gives each service its own schema and role, and applies its migrations once", async () => {
    const notes = await pg.service("notes", join(fixtures, "notes"));
    await notes`insert into notes.notes (body) values ('x')`;
    expect(await notes`select body from notes.notes`).toEqual([{ body: "x" }]);
    expect(await migrate(pg.admin, "notes", readMigrations(join(fixtures, "notes")))).toEqual([]);
  });

  it("refuses a query that names another service's schema", async () => {
    const other = await pg.service("other", join(fixtures, "other"));
    await expect(other`select * from notes.notes`).rejects.toThrow(/permission denied for schema notes/);
    await expect(other`insert into notes.notes (body) values ('y')`).rejects.toThrow(/permission denied/);
  });

  it("refuses a migration that changed after it was applied", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mig-"));
    writeFileSync(join(dir, "0001_a.sql"), "create table fwd.a (id int);");
    await pg.admin`create schema fwd`;
    expect(await migrate(pg.admin, "fwd", readMigrations(dir))).toEqual(["0001_a.sql"]);
    writeFileSync(join(dir, "0001_a.sql"), "create table fwd.a (id bigint);");
    await expect(migrate(pg.admin, "fwd", readMigrations(dir))).rejects.toThrow(/changed after it was applied/);
  });

  it("rolls back a failing migration whole", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mig-"));
    writeFileSync(join(dir, "0001_ok.sql"), "create table bad.ok (id int);");
    writeFileSync(join(dir, "0002_broken.sql"), "create table bad.broken (id int); select 1/0;");
    await expect(migrate(pg.admin, "bad", readMigrations(dir))).rejects.toThrow(/division by zero/);
    expect(await pg.admin`select to_regclass('bad.ok') as t`).toEqual([{ t: null }]);
  });

  it("refuses migration files that are not named NNNN_what.sql", () => {
    const dir = mkdtempSync(join(tmpdir(), "mig-"));
    writeFileSync(join(dir, "init.sql"), "select 1;");
    expect(() => readMigrations(dir)).toThrow(/NNNN_what\.sql/);
  });
});
