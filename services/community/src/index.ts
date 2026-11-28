import { CommunityService } from "@skilient/contracts/community/v1/community_pb";
import { createScheduler, createWorker, defineService, type Consumer, type Scheduler, type Worker } from "@skilient/platform";
import type postgres from "postgres";
import { createApi } from "./api";
import { callers } from "./authorize";
import { communityJobs, communitySchedules } from "./jobs";
import { mediaFiles, ports } from "./ports";
import { copiesConsumer } from "./store/copies";
import { pathRuleOnly } from "./store/societies";
import { tickets } from "./store/tickets";

let sql: postgres.Sql | undefined;
let consumers: Consumer[] = [];
let worker: Worker | undefined;
let scheduler: Scheduler | undefined;

/**
 * community (W7): societies (requests and review, members, officers and terms, invites, join requests, follows,
 * induction rounds), society events (sessions, ticket types and the seat lock, the form, co-hosts, teams, staff,
 * registrations and the waitlist, signed tickets, check-in per session, close-out, feedback, messages) and paid
 * tickets (payment details confirmed by a second officer, receipts, holds, refunds, disputes). University events
 * and fairs are market's (W11).
 *
 * Variables: COMMUNITY_JOBS (off to run no background work: no consumer, schedules or job worker; for tests).
 * Secrets (Key Vault): community-ticket-key (32 bytes, base64url; seals each event's ticket secret).
 */
export default defineService({
  name: "community",
  contract: CommunityService,
  callers,
  async create(deps) {
    sql = deps.database();
    const key = Buffer.from(await deps.secrets.get("community-ticket-key"), "base64url");
    if (process.env["COMMUNITY_JOBS"] !== "off") {
      consumers = [copiesConsumer({ sql, logger: deps.logger })];
      for (const c of consumers) await c.start();
      worker = createWorker({ sql, workerId: deps.instance, handlers: communityJobs({ logger: deps.logger }), logger: deps.logger });
      scheduler = createScheduler({ sql, schedules: communitySchedules(), logger: deps.logger });
      worker.start();
      await scheduler.start();
    }
    // Files are media's (W9); MEDIA_CHECKS=off keeps the path rule for tests that don't host media.
    const files = process.env["MEDIA_CHECKS"] === "off" ? pathRuleOnly : mediaFiles(deps.clients);
    return createApi({ sql, logger: deps.logger, ports: ports(deps.clients), tickets: tickets(key), files });
  },
  async ready() {
    if (!sql) return false;
    await sql`select 1`;
    return true;
  },
  async close() {
    scheduler?.stop();
    await worker?.stop();
    for (const c of consumers) await c.stop();
    consumers = [];
    worker = undefined;
    scheduler = undefined;
  },
});
