import type { JobHandler, Logger, Schedule } from "@skilient/platform";
import type { Store } from "./storage/store";
import { expirePending, runCleanup } from "./store/files";

/** Media's schedules (pg_cron's storage-cleanup waker today; UTC). */
export function mediaSchedules(): Schedule[] {
  return [
    // Releases queue a run straight away; the minute is the fallback (wake_storage_cleanup_worker).
    { name: "storage-cleanup", cron: "* * * * *" },
    { name: "media-expire-uploads", cron: "17 2 * * *" },
  ];
}

export function mediaJobs(deps: { logger: Logger; store: Store }): Record<string, JobHandler> {
  return {
    "storage-cleanup": async (tx) => {
      const r = await runCleanup(tx, deps.store, deps.logger);
      deps.logger.info("jobs.done", { action: "job.storage-cleanup", outcome: "ok", count: r.deleted });
    },
    "media-expire-uploads": async (tx) => {
      const n = await expirePending(tx);
      deps.logger.info("jobs.done", { action: "job.media-expire-uploads", outcome: "ok", count: n });
    },
  };
}
