import { CronExpressionParser } from "cron-parser";
import type postgres from "postgres";
import type { Logger } from "./log";

/**
 * The job queue and scheduler (docs/azure/prd.md, "Where the logic goes": jobs and schedules are rows in
 * Postgres; "What was left out": the job table replaces Service Bus). Rows live in `platform.jobs` and
 * `platform.schedules`, each visible only to the service role that owns it.
 *
 * - Claiming: `for update skip locked`, so two workers never take the same job.
 * - A claimed job holds a lease (`locked_until`); a worker that dies loses it and the job runs again.
 * - Failure: retried with backoff; after `max_attempts` the job is `failed` and stays for inspection.
 * - Schedules: cron in UTC. Each due slot enqueues one job with `dedupe_key = name:slot`, so two schedulers
 *   start exactly one run. A missed slot runs once; slots are not caught up (as pg_cron behaves today).
 */
type Db = postgres.Sql | postgres.TransactionSql;

export interface Job {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

export interface EnqueueOptions {
  kind: string;
  payload?: Record<string, unknown>;
  runAt?: Date;
  /** One job per key per service: a repeat enqueue is a no-op and returns null. */
  dedupeKey?: string;
  maxAttempts?: number;
}

/** Enqueues a job, inside the caller's transaction when given one. Returns its id, or null for a duplicate key. */
export async function enqueue(db: Db, options: EnqueueOptions): Promise<string | null> {
  const inserted = await db<{ id: string }[]>`
    insert into platform.jobs (kind, payload, run_at, dedupe_key, max_attempts)
    values (${options.kind}, ${JSON.stringify(options.payload ?? {})}::text::jsonb,
            coalesce(${options.runAt?.toISOString() ?? null}::timestamptz, now()), ${options.dedupeKey ?? null}, ${options.maxAttempts ?? 5})
    on conflict (owner, dedupe_key) do nothing
    returning id::text`;
  return inserted[0]?.id ?? null;
}

export type JobHandler = (tx: postgres.TransactionSql, job: Job) => Promise<void>;

export interface WorkerOptions {
  sql: postgres.Sql;
  /** A name for this replica, recorded on claimed jobs. */
  workerId: string;
  handlers: Record<string, JobHandler>;
  batch?: number;
  leaseMs?: number;
  pollMs?: number;
  /** Delay before attempt n+1, in ms. Default: 2^n seconds, at most 10 minutes. */
  backoffMs?: (attempts: number) => number;
  logger?: Logger;
}

export interface Worker {
  /** Claims and runs one batch; returns how many jobs ran (done or failed). */
  runOnce(): Promise<number>;
  start(): void;
  stop(): Promise<void>;
}

export function createWorker(options: WorkerOptions): Worker {
  const { sql, handlers } = options;
  const kinds = Object.keys(handlers);
  const batch = options.batch ?? 10;
  const leaseMs = options.leaseMs ?? 5 * 60_000;
  const backoff = options.backoffMs ?? ((n: number) => Math.min(600_000, 1000 * 2 ** n));
  let timer: NodeJS.Timeout | undefined;
  let running: Promise<number> | null = null;

  async function runOnce(): Promise<number> {
    const claimed = await sql<Job[]>`
      update platform.jobs j
         set status = 'running', attempts = j.attempts + 1, locked_by = ${options.workerId},
             locked_until = now() + ${`${leaseMs} milliseconds`}::interval
       where j.id in (
         select id from platform.jobs
          where kind = any(${kinds}::text[])
            and ((status = 'queued' and run_at <= now()) or (status = 'running' and locked_until < now()))
          order by run_at, id
          limit ${batch}
          for update skip locked)
      returning j.id::text, j.kind, j.payload, j.attempts, j.max_attempts`;
    for (const job of claimed) {
      try {
        await sql.begin(async (tx) => {
          await handlers[job.kind]!(tx, job);
          await tx`update platform.jobs set status = 'done', finished_at = now(), locked_until = null, last_error = null
                    where id = ${job.id}::bigint and locked_by = ${options.workerId}`;
        });
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 500) : "unknown";
        const failed = job.attempts >= job.max_attempts;
        await sql`
          update platform.jobs
             set status = ${failed ? "failed" : "queued"}, last_error = ${message}, locked_until = null,
                 finished_at = case when ${failed} then now() end,
                 run_at = now() + ${`${backoff(job.attempts)} milliseconds`}::interval
           where id = ${job.id}::bigint and locked_by = ${options.workerId}`;
        options.logger?.warn("jobs.failed", {
          action: `job.${job.kind}`,
          outcome: failed ? "error" : "retry",
          error_code: message.slice(0, 80),
        });
      }
    }
    return claimed.length;
  }

  function tick(): void {
    if (running) return;
    running = runOnce()
      .catch((error: unknown) => {
        options.logger?.error("jobs.worker_failed", {
          action: "jobs.claim",
          outcome: "error",
          error_code: error instanceof Error ? error.message.slice(0, 80) : "unknown",
        });
        return 0;
      })
      .finally(() => {
        running = null;
      });
  }

  return {
    runOnce,
    start() {
      timer = setInterval(tick, options.pollMs ?? 1_000);
      timer.unref();
      tick();
    },
    async stop() {
      if (timer) clearInterval(timer);
      await running;
    },
  };
}

export interface Schedule {
  /** Also the job kind enqueued for each slot. */
  name: string;
  /** Five-field cron, evaluated in UTC. */
  cron: string;
}

/** The next slot strictly after `after`, in UTC. */
export function nextSlot(cron: string, after: Date): Date {
  return CronExpressionParser.parse(cron, { currentDate: after, tz: "UTC" }).next().toDate();
}

export interface Scheduler {
  /** Upserts this service's schedules (a changed cron resets the next slot). */
  register(): Promise<void>;
  /** Enqueues one job for each due schedule; returns how many slots it started. */
  tick(): Promise<number>;
  start(): Promise<void>;
  stop(): void;
}

export function createScheduler(options: { sql: postgres.Sql; schedules: readonly Schedule[]; everyMs?: number; logger?: Logger }): Scheduler {
  const { sql, schedules } = options;
  let timer: NodeJS.Timeout | undefined;

  async function register(): Promise<void> {
    const [now] = await sql<{ now: Date }[]>`select now()`;
    for (const s of schedules) {
      const next = nextSlot(s.cron, now!.now);
      await sql`
        insert into platform.schedules (name, cron, next_run_at) values (${s.name}, ${s.cron}, ${next})
        on conflict (owner, name) do update
          set cron = excluded.cron,
              next_run_at = case when platform.schedules.cron = excluded.cron then platform.schedules.next_run_at else excluded.next_run_at end`;
    }
  }

  async function tick(): Promise<number> {
    return sql.begin(async (tx) => {
      const due = await tx<{ name: string; cron: string; next_run_at: Date; now: Date }[]>`
        select name, cron, next_run_at, now() as now from platform.schedules
         where next_run_at <= now() and name = any(${schedules.map((s) => s.name)}::text[])
         for update skip locked`;
      for (const s of due) {
        await enqueue(tx, { kind: s.name, dedupeKey: `${s.name}:${s.next_run_at.toISOString()}`, payload: { slot: s.next_run_at.toISOString() } });
        await tx`update platform.schedules set last_run_at = now(), next_run_at = ${nextSlot(s.cron, s.now)}
                  where name = ${s.name}`;
      }
      return due.length;
    });
  }

  return {
    register,
    tick,
    async start() {
      await register();
      timer = setInterval(() => {
        tick().catch((error: unknown) =>
          options.logger?.error("jobs.scheduler_failed", {
            action: "jobs.schedule",
            outcome: "error",
            error_code: error instanceof Error ? error.message.slice(0, 80) : "unknown",
          }),
        );
      }, options.everyMs ?? 30_000);
      timer.unref();
    },
    stop() {
      if (timer) clearInterval(timer);
    },
  };
}
