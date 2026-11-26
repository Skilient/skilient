import type { JobHandler, Logger, Schedule } from "@skilient/platform";
import type { Config } from "./domain/config";
import { runStageJob, purgeFeedSessions } from "./store/feed";
import { LINK_JOB, linkPreviewJob, purgeLinkPreviews, type dnsResolver } from "./store/links";

/** Content's scheduled jobs (pg_cron today): name, UTC cron, and the handler each slot runs. */
export function contentSchedules(): Schedule[] {
  return [
    { name: "feed-stage", cron: "*/5 * * * *" },
    { name: "purge-feed-sessions", cron: "53 3 * * *" },
    { name: "purge-link-previews", cron: "41 3 * * *" },
  ];
}

export function contentJobs(deps: { logger: Logger; config: () => Promise<Config>; fetch: typeof fetch; resolve: typeof dnsResolver }): Record<string, JobHandler> {
  const { logger } = deps;
  return {
    "feed-stage": async (tx) => {
      const n = await runStageJob(tx, await deps.config());
      logger.info("feed.stages", { action: "feed-stage", outcome: "ok", changed: n });
    },
    "purge-feed-sessions": async (tx) => {
      logger.info("feed.purge", { action: "purge-feed-sessions", outcome: "ok", deleted: await purgeFeedSessions(tx) });
    },
    "purge-link-previews": async (tx) => {
      logger.info("links.purge", { action: "purge-link-previews", outcome: "ok", deleted: await purgeLinkPreviews(tx) });
    },
    [LINK_JOB]: linkPreviewJob({ fetch: deps.fetch, resolve: deps.resolve, logger }),
  };
}
