import { WorkService } from "@skilient/contracts/work/v1/work_pb";
import { createScheduler, createWorker, defineService, type Consumer, type Scheduler, type Worker } from "@skilient/platform";
import type postgres from "postgres";
import { createApi } from "./api";
import { callers } from "./authorize";
import { mediaFileLookup, mediaPort, noMediaCheck, type GithubDeps } from "./deps";
import { workJobs, workSchedules } from "./jobs";
import { identityPort } from "./identity";
import { peoplePort } from "./ports";
import { copiesConsumer } from "./store/copies";
import { recomputeUserSkills } from "./store/skills";

let sql: postgres.Sql | undefined;
let consumers: Consumer[] = [];
let worker: Worker | undefined;
let scheduler: Scheduler | undefined;

/**
 * work (W5): ventures, the contribution log, the GitHub connection and evidence, skills and levels,
 * endorsements, credentials, code checks, paths, proof tasks and skill swaps.
 *
 * Variables: WORK_JOBS (off to run no background work: no consumers, schedules or job worker; for tests);
 * WORK_GITHUB_APP_ID and WORK_GITHUB_CLIENT_ID (public ids of the GitHub App; GitHub stays unconfigured
 * without them), WORK_GITHUB_API_URL and WORK_GITHUB_WEB_URL (tests point them at a fake GitHub).
 * Secrets (Key Vault): github-app-private-key, github-app-client-secret, work-github-token-key.
 */
export default defineService({
  name: "work",
  contract: WorkService,
  callers,
  async create(deps) {
    sql = deps.database();
    const env = process.env;
    let github: GithubDeps | undefined;
    if (env["WORK_GITHUB_APP_ID"] && env["WORK_GITHUB_CLIENT_ID"]) {
      github = {
        cfg: {
          appId: env["WORK_GITHUB_APP_ID"],
          clientId: env["WORK_GITHUB_CLIENT_ID"],
          clientSecret: await deps.secrets.get("github-app-client-secret"),
          privateKey: (await deps.secrets.get("github-app-private-key")).replace(/\\n/g, "\n"),
          apiUrl: (env["WORK_GITHUB_API_URL"] ?? "https://api.github.com").replace(/\/$/, ""),
          webUrl: (env["WORK_GITHUB_WEB_URL"] ?? "https://github.com").replace(/\/$/, ""),
        },
        tokenKey: Buffer.from(await deps.secrets.get("work-github-token-key"), "base64url"),
      };
    }
    if (env["WORK_JOBS"] !== "off") {
      consumers = [copiesConsumer({ sql, logger: deps.logger })];
      for (const c of consumers) await c.start();
      worker = createWorker({ sql, workerId: deps.instance, handlers: workJobs({ logger: deps.logger, harvest: github ? { ...github, logger: deps.logger } : null }), logger: deps.logger });
      scheduler = createScheduler({ sql, schedules: workSchedules(), logger: deps.logger });
      worker.start();
      scheduler.start();
    }
    // Files are media's (W9); MEDIA_CHECKS=off keeps the path rule for tests that don't host media.
    const media = process.env["MEDIA_CHECKS"] === "off" ? null : deps.clients;
    return createApi({
      sql,
      logger: deps.logger,
      people: peoplePort(deps.clients),
      identity: identityPort(deps.clients),
      media: media ? mediaPort(media) : noMediaCheck,
      ...(media ? { files: mediaFileLookup(media) } : {}),
      recompute: recomputeUserSkills,
      ...(github ? { github } : {}),
    });
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
