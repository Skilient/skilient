import { RankingService } from "@skilient/contracts/ranking/v1/ranking_pb";
import { createScheduler, createWorker, defineService, type Consumer, type Scheduler, type Worker } from "@skilient/platform";
import type postgres from "postgres";
import { createApi } from "./api";
import { callers } from "./authorize";
import { identityPort } from "./identity";
import { rankingJobs, rankingSchedules } from "./jobs";
import { copiesConsumer } from "./store/copies";

let sql: postgres.Sql | undefined;
let consumers: Consumer[] = [];
let worker: Worker | undefined;
let scheduler: Scheduler | undefined;

/**
 * ranking (W6): the score formula, the nightly run, tiers, leaderboards, the score page, anti-gaming flags,
 * adjustments, snapshots and exam periods. Every fact it scores arrives as an event-fed copy (src/store/copies.ts).
 *
 * Variables: RANKING_JOBS (off to run no background work: no consumer, schedules or job worker; for tests).
 * No secrets.
 */
export default defineService({
  name: "ranking",
  contract: RankingService,
  callers,
  async create(deps) {
    sql = deps.database();
    if (process.env["RANKING_JOBS"] !== "off") {
      consumers = [copiesConsumer({ sql, logger: deps.logger })];
      for (const c of consumers) await c.start();
      worker = createWorker({ sql, workerId: deps.instance, handlers: rankingJobs({ logger: deps.logger }), logger: deps.logger });
      scheduler = createScheduler({ sql, schedules: rankingSchedules(), logger: deps.logger });
      worker.start();
      scheduler.start();
    }
    return createApi({ sql, logger: deps.logger, identity: identityPort(deps.clients) });
  },
  async ready() {
    if (!sql) return false;
    await sql`select 1`;
    return true;
  },
  async close() {
    await scheduler?.stop();
    await worker?.stop();
    for (const c of consumers) await c.stop();
    consumers = [];
    worker = undefined;
    scheduler = undefined;
  },
});
