import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import { createScheduler, createWorker, defineService, type Consumer, type Scheduler, type Worker } from "@skilient/platform";
import type postgres from "postgres";
import { createApi } from "./api";
import { callers } from "./authorize";
import { identityPort } from "./identity";
import { peopleJobs, peopleSchedules } from "./jobs";
import { copiesConsumer } from "./store/copies";
import { lifecycleConsumer } from "./store/lifecycle";
import { communityLabels } from "./store/labels";

let sql: postgres.Sql | undefined;
let worker: Worker | undefined;
let scheduler: Scheduler | undefined;
let consumers: Consumer[] = [];

/**
 * people (W2): profiles, universities and departments, friends, blocks, mutes, privacy settings, onboarding,
 * tours and tips, the page shell, people search and suggestions. Reads no secrets.
 * Variables: PEOPLE_JOBS (off to run no background work: no consumers, schedules or worker; for tests).
 * Consumes identity's account events (people.lifecycle) and other services' shell facts (people.copies).
 */
export default defineService({
  name: "people",
  contract: PeopleService,
  callers,
  async create(deps) {
    sql = deps.database();
    const identity = identityPort(deps.clients);
    if (process.env["PEOPLE_JOBS"] !== "off") {
      worker = createWorker({ sql, workerId: deps.instance, handlers: peopleJobs(deps.logger), logger: deps.logger });
      scheduler = createScheduler({ sql, schedules: peopleSchedules(), logger: deps.logger });
      await scheduler.start();
      worker.start();
      consumers = [lifecycleConsumer({ sql, details: identity.signupDetails, logger: deps.logger }), copiesConsumer({ sql, logger: deps.logger })];
      for (const c of consumers) await c.start();
    }
    return createApi({ sql, logger: deps.logger, identity, labels: communityLabels(deps.clients) });
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
