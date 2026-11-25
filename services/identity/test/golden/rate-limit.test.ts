/** Golden replay for `rate_limit` (rate-limit.json), ported as the current definition, against identity's schema. */
import { join } from "node:path";
import { golden } from "@skilient/testing";
import { startPostgres, type TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rateLimit } from "../../src/store/rate-limit";
import { outcome } from "./outcome";

const DIR = join(import.meta.dirname, "../../../../packages/testing/test/golden/identity");
const MIGRATIONS = join(import.meta.dirname, "../../migrations");

describe("rate_limit (rate-limit.json)", () => {
  let pg: TestDatabase;
  let sql: postgres.Sql;
  beforeAll(async () => {
    if (process.env["GOLDEN_RECORD"] === "1") throw new Error("golden replays never record; unset GOLDEN_RECORD");
    pg = await startPostgres();
    sql = await pg.service("identity", MIGRATIONS);
  });
  afterAll(async () => {
    await pg?.stop();
  });

  /** Each recorded case ran in one rolled-back transaction; so does each replay. */
  async function inTx<T>(run: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
    let value!: T;
    await sql
      .begin(async (tx) => {
        value = await run(tx);
        throw new Error("rollback");
      })
      .catch((e: unknown) => {
        if (!(e instanceof Error && e.message === "rollback")) throw e;
      });
    return value;
  }
  const keys = async (tx: postgres.TransactionSql) => (await tx<{ key: string }[]>`select key from platform.rate_limit_events order by key`).map((r) => JSON.stringify({ key: r.key }));
  /** The recording named the old table; the replay reports identity's rows under that name. */
  async function step(tx: postgres.TransactionSql, run: () => Promise<boolean>) {
    const before = await keys(tx);
    const result = await outcome(() => tx.savepoint(() => run()));
    const after = await keys(tx);
    const added = after.filter((k, i) => after.indexOf(k) === i).flatMap((k) => Array(Math.max(0, after.filter((x) => x === k).length - before.filter((x) => x === k).length)).fill(JSON.parse(k)));
    return { result, changes: added.length ? { "private.rate_limit_events": { added, removed: [] } } : {} };
  }

  it("private", async () => {
    const value = await inTx(async (tx) => {
      const hits: Record<string, unknown> = {};
      for (let i = 1; i <= 4; i++) hits[String(i)] = await step(tx, () => rateLimit(tx, "golden:limit", 3, 3600));
      const once = (key: string, limit: number, secs: number) => outcome(() => tx.savepoint((sp) => rateLimit(sp, key, limit, secs)));
      return {
        hits,
        other_key_separate: await once("golden:other", 3, 3600),
        empty_key: await once("", 3, 3600),
        limit_zero: await once("golden:limit", 0, 3600),
        window_too_long: await once("golden:limit", 3, 2 * 86_400),
      };
    });
    const r = golden(join(DIR, "rate-limit.json"), "private", value);
    if (r.status === "differs") expect(r.actual).toEqual(r.expected);
    expect(r.status).toBe("matched");
  });

  it("public (the app's call: limit, window in seconds)", async () => {
    const value = await inTx(async (tx) => {
      const once = (limit: number, secs: number) => outcome(() => tx.savepoint((sp) => rateLimit(sp, "golden:public", limit, secs)));
      const hits: Record<string, unknown> = {};
      for (let i = 1; i <= 3; i++) hits[String(i)] = await once(2, 60);
      return { hits, window_zero: await once(2, 0), signed_out: await once(2, 60) };
    });
    const r = golden(join(DIR, "rate-limit.json"), "public", value);
    if (r.status === "differs") expect(r.actual).toEqual(r.expected);
    expect(r.status).toBe("matched");
  });
});
