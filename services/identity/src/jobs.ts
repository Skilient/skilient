import type { JobHandler, Schedule } from "@skilient/platform";
import type { ApiDeps } from "./deps";
import { deletionJobs, deletionSchedules } from "./store/deletion";
import { purgeSecurityData } from "./store/signin";

/** identity's scheduled jobs (pg_cron today): name, UTC cron, and the handler each slot runs. */
export function identitySchedules(): Schedule[] {
  return [{ name: "purge-security-data", cron: "23 3 * * *" }, ...deletionSchedules];
}

export function identityJobs(deps: ApiDeps): Record<string, JobHandler> {
  return {
    "purge-security-data": async (tx) => {
      await purgeSecurityData(tx);
    },
    ...deletionJobs(deps),
  };
}
