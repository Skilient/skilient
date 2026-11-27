import type { JobHandler, Logger, Schedule } from "@skilient/platform";
import { closeoutTick, eventTick } from "./store/closeout";
import { societyTick } from "./store/inductions";

/** Community's schedules (pg_cron today; UTC as there) and their handlers. */
export function communitySchedules(): Schedule[] {
  return [
    { name: "society-tick", cron: "7 * * * *" },
    { name: "event-tick", cron: "* * * * *" },
    { name: "event-closeout", cron: "23 * * * *" },
  ];
}

export function communityJobs(deps: { logger: Logger }): Record<string, JobHandler> {
  const run =
    (name: string, job: (tx: Parameters<JobHandler>[0]) => Promise<number>): JobHandler =>
    async (tx) => {
      const n = await job(tx);
      deps.logger.info("jobs.done", { action: `job.${name}`, outcome: "ok", count: n });
    };
  return {
    "society-tick": run("society-tick", societyTick),
    "event-tick": run("event-tick", eventTick),
    "event-closeout": run("event-closeout", closeoutTick),
  };
}
