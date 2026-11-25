import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { actAs, attempt, callCurrentStackSql } from "../src/golden";
import { startPostgres, type TestDatabase } from "../src/postgres";

describe("callCurrentStackSql", () => {
  let pg: TestDatabase;
  let url: string;
  beforeAll(async () => {
    pg = await startPostgres();
    url = pg.container.getConnectionUri();
    await pg.admin.unsafe(`
      create role authenticated nologin;
      grant authenticated to current_user;
      create schema stack;
      grant usage on schema stack to authenticated;
      create table stack.rows (id int primary key, at timestamptz not null default '2026-11-25 10:00:00+00');
      create function stack.whoami() returns text language sql stable as
        $$ select current_user || ':' || coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '-') $$;
      create function stack.refuse() returns void language plpgsql as
        $$ begin raise exception 'not allowed' using errcode = '42501'; end $$;
      grant execute on all functions in schema stack to authenticated;
    `);
  }, 120_000);
  afterAll(async () => {
    await pg?.stop();
  });

  it("runs as the actor with its claims, and rolls back unless asked to commit", async () => {
    const out = await callCurrentStackSql(url, async (tx) => {
      await tx`insert into stack.rows (id) values (1)`;
      await actAs(tx, { role: "authenticated", claims: { sub: "u-1" } });
      const [who] = await tx`select stack.whoami() as who`;
      await actAs(tx, { role: "postgres" });
      const [row] = await tx`select at from stack.rows`;
      return { who: who?.["who"], at: row?.["at"] };
    });
    expect(out).toEqual({ ok: true, value: { who: "authenticated:u-1", at: "2026-11-25 10:00:00+00" } });
    expect(await pg.admin`select count(*)::int as n from stack.rows`).toEqual([{ n: 0 }]);

    await callCurrentStackSql(url, (tx) => tx`insert into stack.rows (id) values (2)`, { commit: true });
    expect(await pg.admin`select count(*)::int as n from stack.rows`).toEqual([{ n: 1 }]);
  });

  it("records a refusal as its SQLSTATE and keeps the transaction usable", async () => {
    const out = await callCurrentStackSql(url, async (tx) => {
      const refused = await attempt(tx, (sp) => sp`select stack.refuse()`);
      const [after] = await tx`select 1 as one`;
      return { refused, after: after?.["one"] };
    });
    expect(out).toEqual({ ok: true, value: { refused: { ok: false, code: "42501", message: "not allowed" }, after: 1 } });
    expect(await callCurrentStackSql(url, (tx) => tx`select stack.refuse()`)).toEqual({ ok: false, code: "42501", message: "not allowed" });
  });
});
