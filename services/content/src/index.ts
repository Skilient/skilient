import { ContentService } from "@skilient/contracts/content/v1/content_pb";
import { createScheduler, createWorker, defineService, type Consumer, type Scheduler, type Worker } from "@skilient/platform";
import type postgres from "postgres";
import { createApi } from "./api";
import { callers } from "./authorize";
import { noMediaCheck, noSocieties, noVentures } from "./deps";
import { contentJobs, contentSchedules } from "./jobs";
import { identityPort, peoplePort, shippedNames } from "./ports";
import { cachedConfig } from "./store/config";
import { copiesConsumer } from "./store/copies";
import { dnsResolver } from "./store/links";
import { PoolCache } from "./store/pool";

let sql: postgres.Sql | undefined;
let worker: Worker | undefined;
let scheduler: Scheduler | undefined;
let consumers: Consumer[] = [];

/**
 * content (W3): posts, comments, polls, post RSVPs, hides, link previews, the micro-survey, views and stats,
 * the ranked feed, and the post side of sharing. Reads no secrets.
 * Variables: CONTENT_JOBS (off to run no background work: no consumers, schedules or worker; for tests),
 * CONTENT_FEED_POOL_MS (how long a feed candidate pool is held; default 60000).
 * Consumes identity's, people's and (as they land) work's, community's, market's, billing's and trust's events
 * into its copies (content.copies); runs link previews, the 5-minute stage job and nightly purges.
 */
export default defineService({
  name: "content",
  contract: ContentService,
  callers,
  async create(deps) {
    sql = deps.database();
    const people = peoplePort(deps.clients);
    const config = cachedConfig(sql);
    if (process.env["CONTENT_JOBS"] !== "off") {
      worker = createWorker({ sql, workerId: deps.instance, handlers: contentJobs({ logger: deps.logger, config, fetch, resolve: dnsResolver }), logger: deps.logger });
      scheduler = createScheduler({ sql, schedules: contentSchedules(), logger: deps.logger });
      await scheduler.start();
      worker.start();
      consumers = [copiesConsumer({ sql, names: shippedNames(people), logger: deps.logger })];
      for (const c of consumers) await c.start();
    }
    return createApi({
      sql,
      logger: deps.logger,
      people,
      identity: identityPort(deps.clients),
      ventures: noVentures,
      societies: noSocieties,
      media: noMediaCheck,
      config,
      pools: new PoolCache(Number(process.env["CONTENT_FEED_POOL_MS"] ?? 60_000)),
    });
  },
  async ready() {
    if (!sql) return false;
    await sql`select 1`;
    return true;
  },
  async close() {
    for (const c of consumers) await c.stop();
    consumers = [];
    scheduler?.stop();
    await worker?.stop();
  },
});
