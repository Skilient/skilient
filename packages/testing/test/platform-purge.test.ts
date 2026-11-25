import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendEvents, createConsumer, purgePlatform } from "@skilient/platform";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startPostgres, type TestDatabase } from "../src/postgres";

/** The daily platform purge (decision Q8) against Postgres 17. */
describe("platform purge", () => {
  let pg: TestDatabase;
  let alpha: postgres.Sql;
  beforeAll(async () => {
    pg = await startPostgres();
    alpha = await pg.service("alpha", mkdtempSync(join(tmpdir(), "mig-")));
  }, 120_000);
  afterAll(async () => {
    await pg?.stop();
  });

  it("keeps an old event a consumer has not passed, removes it once passed, and ages out the rest", async () => {
    const consumer = createConsumer({ sql: alpha, name: "alpha.slow", types: ["old.thing"], handle: async () => undefined });
    await alpha`insert into platform.cursors (consumer) values ('alpha.slow')`; // registered, has read nothing
    await alpha.begin((tx) => appendEvents(tx, [{ type: "old.thing", payload: {} }]));
    await pg.admin`update platform.events set at = now() - interval '31 days' where type = 'old.thing'`;
    await pg.admin`insert into platform.idempotency (owner, actor, method, key, request_hash, created_at)
                   values ('svc_alpha', 'user:x', 'm', 'old-key-0001', 'h', now() - interval '25 hours'),
                          ('svc_alpha', 'user:x', 'm', 'new-key-0001', 'h', now())`;
    await pg.admin`insert into platform.applied_events (consumer, event_id, owner, applied_at)
                   values ('alpha.slow', gen_random_uuid(), 'svc_alpha', now() - interval '31 days')`;

    await pg.admin`insert into platform.rate_limit_events (owner, key, created_at) values ('svc_alpha', 'k', now() - interval '2 days'), ('svc_alpha', 'k', now())`;
    expect(await purgePlatform(pg.admin)).toEqual({ events: 0, applied: 1, idempotency: 1, rateLimits: 1 });
    expect(await pg.admin`select 1 from platform.events where type = 'old.thing'`).toHaveLength(1);

    expect(await consumer.runOnce()).toBe(1);
    expect((await purgePlatform(pg.admin)).events).toBe(1);
    expect(await pg.admin`select key from platform.idempotency`).toEqual([{ key: "new-key-0001" }]);
  });

  it("a service role cannot purge other services' rows", async () => {
    await expect(alpha`delete from platform.events`).rejects.toThrow(/permission denied/);
  });

  it("rate limits: a service sees and counts only its own hits", async () => {
    const { rateLimit } = await import("@skilient/platform");
    const beta = await pg.service("beta", mkdtempSync(join(tmpdir(), "mig-")));
    const hit = (sql: postgres.Sql) => sql.begin((tx) => rateLimit(tx, "shared:key", 1, 60));
    expect(await hit(alpha)).toBe(true);
    expect(await hit(alpha)).toBe(false);
    expect(await hit(beta)).toBe(true); // the same key in another service is another limit
    expect(await beta`select count(*)::int as n from platform.rate_limit_events`).toEqual([{ n: 1 }]);
  });
});
