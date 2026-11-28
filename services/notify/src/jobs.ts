import { enqueue, startCall, type JobHandler, type Logger, type Schedule } from "@skilient/platform";
import type { VapidKeys } from "./domain/webpush";
import type { Ports } from "./ports";
import { publishCounts, type Tx } from "./store/db";
import { purgeNotifications, queueDigests, runEmailDrain, type EmailConfig } from "./store/email";
import { runPushDrain } from "./store/push";
import { notify } from "./store/write";

/** Notify's schedules (pg_cron today; UTC as there). */
export function notifySchedules(): Schedule[] {
  return [
    // The drains also run as soon as a consumer queues work; the minute is the fallback (wake_notify_worker).
    { name: "email-drain", cron: "* * * * *" },
    { name: "push-drain", cron: "* * * * *" },
    // 18:07 Pakistan time (13:07 UTC): after classes, before the evening.
    { name: "notification-digest", cron: "7 13 * * *" },
    { name: "purge-notifications", cron: "23 3 * * *" },
  ];
}

export interface JobDeps {
  logger: Logger;
  ports: Ports;
  /** Null when the email key is not set up: emails wait in the queue. */
  email: EmailConfig | null;
  vapid: VapidKeys | null;
  fetch: typeof fetch;
  now?: () => Date;
}

const PAGE = 500;

/** The formula notice (the_record.sql's one-off private.notify to every scored student), a page per job. */
export async function formulaNotice(tx: Tx, ports: Ports, payload: Record<string, unknown>): Promise<number> {
  const version = Number(payload["version"]);
  const after = typeof payload["after"] === "string" ? payload["after"] : null;
  const users = await ports.scoredStudents(after, PAGE, startCall());
  const data = version === 2 ? { version: 2, component: "record", max: 100 } : { version };
  let n = 0;
  for (const u of users) if (await notify(tx, { user: u, actor: null, type: "ranking_formula", entityType: "ranking", entityId: u, data })) n++;
  await publishCounts(tx, users);
  if (users.length === PAGE) await enqueue(tx, { kind: "formula-notice", payload: { version, after: users[users.length - 1] }, dedupeKey: `formula:${version}:${users[users.length - 1]}` });
  return n;
}

/** The university launch emails (queue_university_launch): people marks the requests notified and returns them. */
export async function universityLaunch(tx: Tx, ports: Ports, payload: Record<string, unknown>): Promise<number> {
  const r = await ports.launchRecipients(String(payload["university_id"]), startCall());
  for (const x of r.recipients)
    await tx`insert into notify.email_queue (kind, payload) values ('university_launch', ${JSON.stringify({ request_id: x.requestId, email: x.email, university: r.university })}::text::jsonb)`;
  if (r.recipients.length) await enqueue(tx, { kind: "email-drain", dedupeKey: `email-drain:launch:${String(payload["university_id"])}:${Date.now()}` });
  if (r.recipients.length === 500) await enqueue(tx, { kind: "university-launch", payload, dedupeKey: `launch:${String(payload["university_id"])}:more:${Date.now()}` });
  return r.recipients.length;
}

export function notifyJobs(deps: JobDeps): Record<string, JobHandler> {
  const run =
    (name: string, job: (tx: Tx, payload: Record<string, unknown>) => Promise<number>): JobHandler =>
    async (tx, j) => {
      const n = await job(tx, j.payload);
      deps.logger.info("jobs.done", { action: `job.${name}`, outcome: "ok", count: n });
    };
  return {
    "email-drain": run("email-drain", async (tx) => {
      if (!deps.email) {
        deps.logger.warn("notify.email_not_configured", { action: "email.drain", outcome: "refused" });
        return 0;
      }
      const r = await runEmailDrain({ tx, cfg: deps.email, ports: deps.ports, fetch: deps.fetch, logger: deps.logger, ...(deps.now ? { now: deps.now } : {}) });
      return r.sent;
    }),
    "push-drain": run("push-drain", async (tx) => (await runPushDrain({ tx, keys: deps.vapid, ports: deps.ports, fetch: deps.fetch, logger: deps.logger, ...(deps.now ? { now: deps.now } : {}) })).sent),
    "notification-digest": run("notification-digest", async (tx) => {
      const n = await queueDigests(tx);
      if (n) await enqueue(tx, { kind: "email-drain", dedupeKey: `email-drain:digest:${Date.now()}` });
      return n;
    }),
    "purge-notifications": run("purge-notifications", (tx) => purgeNotifications(tx)),
    "university-launch": run("university-launch", (tx, p) => universityLaunch(tx, deps.ports, p)),
    "formula-notice": run("formula-notice", (tx, p) => formulaNotice(tx, deps.ports, p)),
  };
}
