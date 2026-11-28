import { MessagingService } from "@skilient/contracts/messaging/v1/messaging_pb";
import { defineService, type Consumer } from "@skilient/platform";
import type postgres from "postgres";
import { createApi } from "./api";
import { callers } from "./authorize";
import { contentPort, mediaPort, peoplePort, venturePort } from "./ports";
import { copiesConsumer } from "./store/copies";

let sql: postgres.Sql | undefined;
let consumers: Consumer[] = [];

/**
 * messaging (W4): chat threads, members, messages, reactions, pins, read marks, chat search, and the chat half
 * of sharing a post. Reads no secrets. Live delivery: a NOTIFY on the `realtime` channel in each write's
 * transaction (packages/platform/src/realtime.ts), forwarded by the realtime service.
 * Variables: MESSAGING_JOBS (off to run no background work: no consumers; for tests).
 */
export default defineService({
  name: "messaging",
  contract: MessagingService,
  callers,
  async create(deps) {
    sql = deps.database();
    if (process.env["MESSAGING_JOBS"] !== "off") {
      consumers = [copiesConsumer({ sql, logger: deps.logger })];
      for (const c of consumers) await c.start();
    }
    return createApi({
      sql,
      logger: deps.logger,
      people: peoplePort(deps.clients),
      content: contentPort(deps.clients),
      ventures: venturePort(deps.clients),
      // Chat images are media's (W9); MEDIA_CHECKS=off keeps the path rule for tests that don't host media.
      ...(process.env["MEDIA_CHECKS"] === "off" ? {} : { media: mediaPort(deps.clients) }),
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
  },
});
