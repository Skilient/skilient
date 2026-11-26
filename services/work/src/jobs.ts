import type { JobHandler, Logger, Schedule } from "@skilient/platform";
import { harvestHandler, type HarvestDeps } from "./harvest/stages";
import { codeChecksTick } from "./store/code-checks";
import { credentialsDaily } from "./store/credentials";
import { JOB_KIND, nightlySync, purgeGithubData } from "./store/github";
import { computePaths } from "./store/paths";
import { swapTick } from "./store/swaps";
import { proofTasksTick } from "./store/tasks";

/**
 * Work's schedules (pg_cron today; UTC as there) and job handlers. `github` jobs are the harvest stages; the
 * `harvest` container runs them (docs/azure/prd.md, "Jobs"), and so does the service where no harvest container
 * runs (tests, local). The `github-worker` cron that woke the queue every minute is gone: jobs run when queued.
 */
export function workSchedules(): Schedule[] {
  return [
    { name: "github-nightly-sync", cron: "17 21 * * *" },
    { name: "purge-github-data", cron: "37 3 * * *" },
    { name: "credentials-daily", cron: "13 19 * * *" },
    { name: "code-checks-tick", cron: "*/5 * * * *" },
    { name: "paths-weekly", cron: "23 21 * * 0" },
    { name: "proof-tasks-tick", cron: "*/5 * * * *" },
    { name: "swap-tick", cron: "*/15 * * * *" },
  ];
}

export function workJobs(deps: { logger: Logger; harvest: HarvestDeps | null }): Record<string, JobHandler> {
  const { logger } = deps;
  const handlers: Record<string, JobHandler> = {
    "github-nightly-sync": async (tx) => {
      const n = await nightlySync(tx);
      logger.info("jobs.done", { action: "job.github-nightly-sync", outcome: "ok", count: n });
    },
    "purge-github-data": async (tx) => {
      const n = await purgeGithubData(tx);
      logger.info("jobs.done", { action: "job.purge-github-data", outcome: "ok", count: n });
    },
  };
  const run = (name: string, job: (tx: Parameters<JobHandler>[0]) => Promise<number>): JobHandler => async (tx) => {
    const n = await job(tx);
    logger.info("jobs.done", { action: `job.${name}`, outcome: "ok", count: n });
  };
  handlers["credentials-daily"] = run("credentials-daily", credentialsDaily);
  handlers["code-checks-tick"] = run("code-checks-tick", codeChecksTick);
  handlers["paths-weekly"] = run("paths-weekly", computePaths);
  handlers["proof-tasks-tick"] = run("proof-tasks-tick", proofTasksTick);
  handlers["swap-tick"] = run("swap-tick", swapTick);
  if (deps.harvest) handlers[JOB_KIND] = harvestHandler(deps.harvest);
  return handlers;
}
