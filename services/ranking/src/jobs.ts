import { enqueue, type JobHandler, type Logger, type Schedule } from "@skilient/platform";
import { startRun, step } from "./store/run";

/**
 * Ranking's schedules (pg_cron today; UTC as there) and job handlers. `ranking-nightly` starts the day's run at
 * 03:07 PKT; each `ranking-step` job is one committed step and queues the next one at once, so a run no longer
 * waits a minute between batches. The minute schedule stays as the safety net for a step whose job was lost.
 */
export function rankingSchedules(): Schedule[] {
  return [
    { name: "ranking-nightly", cron: "7 22 * * *" },
    { name: "ranking-step", cron: "* * * * *" },
  ];
}

export function rankingJobs(deps: { logger: Logger }): Record<string, JobHandler> {
  const { logger } = deps;
  return {
    "ranking-nightly": async (tx) => {
      const id = await startRun(tx);
      if (id) await enqueue(tx, { kind: "ranking-step", dedupeKey: `ranking-step:${id}:0` });
      logger.info("jobs.done", { action: "job.ranking-nightly", outcome: id ? "started" : "already_started" });
    },
    "ranking-step": async (tx) => {
      const stage = await step(tx);
      if (stage !== null && stage !== "done" && stage !== "failed") {
        const [r] = await tx<{ id: string; steps: number }[]>`select id::text, steps from ranking.ranking_runs where finished_at is null order by id limit 1`;
        if (r) await enqueue(tx, { kind: "ranking-step", dedupeKey: `ranking-step:${r.id}:${r.steps}` });
      }
      if (stage !== null) logger.info("jobs.done", { action: "job.ranking-step", outcome: stage });
    },
  };
}
