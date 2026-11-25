/**
 * Refusal tests for the tables of migration 0005 (sanction marks, deleted accounts, deletion confirmations):
 * forced row-level security, and the services that drive them (trust sanctions, every service confirms
 * deletions) can neither read nor write them; they go through identity's commands and events. Identity's own
 * role cannot rewrite a confirmation or remove a sanction mark (append and lift only).
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startPostgres, type TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS = join(import.meta.dirname, "../../migrations");
const TABLES = ["sanction_marks", "deleted_accounts", "deletion_confirmations"];

describe("migration 0005 tables refuse other services", () => {
  let pg: TestDatabase;
  let identity: postgres.Sql;
  let trust: postgres.Sql;
  let people: postgres.Sql;
  beforeAll(async () => {
    pg = await startPostgres();
    identity = await pg.service("identity", MIGRATIONS);
    trust = await pg.service("trust", mkdtempSync(join(tmpdir(), "mig-")));
    people = await pg.service("people", mkdtempSync(join(tmpdir(), "mig-")));
  });
  afterAll(async () => {
    await pg?.stop();
  });

  it("each is under forced row-level security", async () => {
    const rows = await pg.admin<{ relname: string; rls: boolean; forced: boolean }[]>`
      select c.relname, c.relrowsecurity as rls, c.relforcerowsecurity as forced
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'identity' and c.relname = any(${TABLES})`;
    expect(rows.map((r) => [r.relname, r.rls, r.forced]).sort()).toEqual(TABLES.map((t) => [t, true, true]).sort());
  });

  it.each(TABLES)("%s: trust and people cannot read, write or delete", async (table) => {
    for (const db of [trust, people]) {
      await expect(db.unsafe(`select * from identity.${table} limit 1`)).rejects.toThrow(/permission denied/);
      await expect(db.unsafe(`insert into identity.${table} default values`)).rejects.toThrow(/permission denied/);
      await expect(db.unsafe(`delete from identity.${table}`)).rejects.toThrow(/permission denied/);
    }
  });

  it("trust cannot set a ban or a deletion date on identity.users", async () => {
    await expect(trust.unsafe(`update identity.users set banned_until = now()`)).rejects.toThrow(/permission denied/);
    await expect(people.unsafe(`update identity.users set status = 'deleting', delete_after = now()`)).rejects.toThrow(/permission denied/);
  });

  it("identity may lift a sanction mark but not delete one, and may not rewrite a confirmation", async () => {
    await expect(identity.unsafe(`delete from identity.sanction_marks`)).rejects.toThrow(/permission denied/);
    await expect(identity.unsafe(`update identity.deletion_confirmations set service = 'x'`)).rejects.toThrow(/permission denied/);
    await expect(identity.unsafe(`select count(*) from identity.sanction_marks`)).resolves.toBeDefined();
  });

  it("the deletion state is consistent: deleting always has a date, and only then", async () => {
    const id = "0190f0b2-0000-7000-8000-0000000000d1";
    await identity`insert into identity.users (id, email) values (${id}, 'state@golden-uni.test')`;
    await expect(identity`update identity.users set status = 'deleting' where id = ${id}`).rejects.toThrow(/users_deletion_state/);
    await expect(identity`update identity.users set delete_after = now() where id = ${id}`).rejects.toThrow(/users_deletion_state/);
    await identity`update identity.users set status = 'deleting', delete_after = now() where id = ${id}`;
  });
});
