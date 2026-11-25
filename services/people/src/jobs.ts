import type { JobHandler, Logger, Schedule } from "@skilient/platform";
import { graduateRollover } from "./store/universities";

/** people's scheduled jobs (pg_cron today): name, UTC cron, and the handler each slot runs. */
export function peopleSchedules(): Schedule[] {
  return [{ name: "graduate-rollover", cron: "10 19 * * *" }];
}

export function peopleJobs(logger: Logger): Record<string, JobHandler> {
  return {
    "graduate-rollover": async (tx) => {
      const n = await graduateRollover(tx);
      logger.info("graduation.run", { action: "graduate-rollover", outcome: "ok", graduated: n });
    },
  };
}
