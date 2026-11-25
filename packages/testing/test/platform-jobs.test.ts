import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createScheduler, createWorker, enqueue, nextSlot, type Job } from "@skilient/platform";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startPostgres, type TestDatabase } from "../src/postgres";

/** The job queue and scheduler (docs/azure/prd.md, "Where the logic goes") against a real Postgres 17. */
describe("platform job queue and scheduler", () => {
  let pg: TestDatabase;
  let alpha: postgres.Sql;
  let alpha2: postgres.Sql;
  let beta: postgres.Sql;
  const empty = () => mkdtempSync(join(tmpdir(), "mig-"));

  beforeAll(async () => {
    pg = await startPostgres();
    alpha = await pg.service("alpha", empty());
    beta = await pg.service("beta", empty());
    // The service pool holds two connections, so two workers sharing it claim concurrently, as two replicas would.
    alpha2 = alpha;
  }, 120_000);
  afterAll(async () => {
    await pg?.stop();
  });

  it("two workers never run the same job", async () => {
    for (let i = 0; i < 20; i++) await enqueue(alpha, { kind: "count.it", payload: { i } });
    const ran: string[] = [];
    const handlers = { "count.it": async (_tx: postgres.TransactionSql, job: Job) => void ran.push(job.id) };
    const a = createWorker({ sql: alpha, workerId: "a", handlers, batch: 3 });
    const b = createWorker({ sql: alpha2, workerId: "b", handlers, batch: 3 });
    for (let round = 0; round < 10; round++) await Promise.all([a.runOnce(), b.runOnce()]);
    expect(ran).toHaveLength(20);
    expect(new Set(ran).size).toBe(20);
    const [left] = await alpha`select count(*)::int as n from platform.jobs where kind = 'count.it' and status <> 'done'`;
    expect(left?.["n"]).toBe(0);
  });

  it("retries a failing job with backoff and marks it failed after max attempts", async () => {
    await enqueue(alpha, { kind: "always.fails", maxAttempts: 2 });
    const w = createWorker({ sql: alpha, workerId: "w", handlers: { "always.fails": async () => Promise.reject(new Error("boom")) }, backoffMs: () => 0 });
    expect(await w.runOnce()).toBe(1);
    const [mid] = await alpha`select status, attempts, last_error from platform.jobs where kind = 'always.fails'`;
    expect(mid).toMatchObject({ status: "queued", attempts: 1, last_error: "boom" });
    expect(await w.runOnce()).toBe(1);
    const [end] = await alpha`select status, attempts from platform.jobs where kind = 'always.fails'`;
    expect(end).toMatchObject({ status: "failed", attempts: 2 });
    expect(await w.runOnce()).toBe(0);
  });

  it("a handler's writes and the job's completion commit together", async () => {
    await pg.admin`create table if not exists alpha.marks (n int)`;
    await pg.admin`grant insert, select on alpha.marks to svc_alpha`;
    await enqueue(alpha, { kind: "half.done" });
    const w = createWorker({
      sql: alpha,
      workerId: "w",
      backoffMs: () => 0,
      handlers: {
        "half.done": async (tx) => {
          await tx`insert into alpha.marks values (1)`;
          throw new Error("after the write");
        },
      },
    });
    await w.runOnce();
    expect(await alpha`select * from alpha.marks`).toHaveLength(0);
  });

  it("a dedupe key makes a repeat enqueue a no-op", async () => {
    expect(await enqueue(alpha, { kind: "once.only", dedupeKey: "k1" })).not.toBeNull();
    expect(await enqueue(alpha, { kind: "once.only", dedupeKey: "k1" })).toBeNull();
  });

  it("a job whose worker died runs again after its lease", async () => {
    await enqueue(alpha, { kind: "lease.test" });
    await alpha`update platform.jobs set status = 'running', locked_by = 'dead', locked_until = now() - interval '1 second', attempts = 1 where kind = 'lease.test'`;
    const ran: string[] = [];
    const w = createWorker({ sql: alpha, workerId: "alive", handlers: { "lease.test": async (_tx, j) => void ran.push(j.id) } });
    expect(await w.runOnce()).toBe(1);
    expect(ran).toHaveLength(1);
  });

  it("two schedulers start exactly one run per slot, and slots are not caught up", async () => {
    const schedules = [{ name: "hourly.thing", cron: "17 * * * *" }];
    const s1 = createScheduler({ sql: alpha, schedules });
    const s2 = createScheduler({ sql: alpha2, schedules });
    await s1.register();
    await s2.register();
    await alpha`update platform.schedules set next_run_at = now() - interval '5 hours' where name = 'hourly.thing'`;
    const started = await Promise.all([s1.tick(), s2.tick(), s1.tick()]);
    expect(started.reduce((a, b) => a + b, 0)).toBe(1);
    const jobs = await alpha`select dedupe_key from platform.jobs where kind = 'hourly.thing'`;
    expect(jobs).toHaveLength(1);
    const [row] = await alpha<{ next_run_at: Date; now: Date }[]>`select next_run_at, now() from platform.schedules where name = 'hourly.thing'`;
    expect(row!.next_run_at.getTime()).toBeGreaterThan(row!.now.getTime());
    expect(row!.next_run_at.getUTCMinutes()).toBe(17);
  });

  it("evaluates cron in UTC", () => {
    expect(nextSlot("23 3 * * *", new Date("2026-11-25T03:22:00Z")).toISOString()).toBe("2026-11-25T03:23:00.000Z");
    expect(nextSlot("17 * * * *", new Date("2026-11-25T10:17:00Z")).toISOString()).toBe("2026-11-25T11:17:00.000Z");
  });

  it("keeps each service's jobs and schedules to itself", async () => {
    await enqueue(alpha, { kind: "alpha.private" });
    expect(await beta`select * from platform.jobs where kind = 'alpha.private'`).toHaveLength(0);
    expect(await beta`select * from platform.schedules`).toHaveLength(0);
    const w = createWorker({ sql: beta, workerId: "thief", handlers: { "alpha.private": async () => undefined } });
    expect(await w.runOnce()).toBe(0);
  });
});
