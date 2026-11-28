import { NotifyService } from "@skilient/contracts/notify/v1/notify_pb";
import { createScheduler, createWorker, defineService, type Consumer, type Scheduler, type Secrets, type Worker } from "@skilient/platform";
import type postgres from "postgres";
import { createApi } from "./api";
import { callers } from "./authorize";
import { notifyJobs, notifySchedules } from "./jobs";
import { ports } from "./ports";
import { copiesConsumer, noticesConsumer } from "./store/consumers";
import type { EmailConfig } from "./store/email";
import { managedIdentityToken } from "./domain/mail";
import { parseVapidSecret } from "./store/push";

let sql: postgres.Sql | undefined;
let consumers: Consumer[] = [];
let worker: Worker | undefined;
let scheduler: Scheduler | undefined;

/** Tests set the outside world (fake Azure email and push services) before the host starts; production leaves it unset. */
export const testing: { fetch: typeof fetch | undefined; token: (() => Promise<string>) | undefined } = { fetch: undefined, token: undefined };

async function optional(secrets: Secrets, name: string): Promise<string | null> {
  try {
    return await secrets.get(name);
  } catch {
    return null;
  }
}

/**
 * notify (W9): in-app notifications from other services' events, the bell and its nav badge (badge.count_changed),
 * email preferences, the daily digest and instant email through Azure Communication Services (60 a UTC day), web
 * push, and the one-off emails (university launch, Record claims, ops alerts).
 *
 * Variables: NOTIFY_JOBS (off: no consumers, schedules or job worker; for tests), APP_URL (links in emails),
 * NOTIFY_EMAIL_ENDPOINT (https://<resource>.communication.azure.com; email signs in with the managed identity, no key).
 * Secret (Key Vault): notify-vapid-keys (JSON {public_key, private_key, subject}). Either missing: that channel waits
 * (emails stay queued; pushes are dropped, as the stack did), and startup logs it.
 */
export default defineService({
  name: "notify",
  contract: NotifyService,
  callers,
  async create(deps) {
    sql = deps.database();
    const p = ports(deps.clients);
    const endpoint = process.env["NOTIFY_EMAIL_ENDPOINT"];
    const vapid = parseVapidSecret(await optional(deps.secrets, "notify-vapid-keys"));
    if (!endpoint) deps.logger.error("notify.email_not_configured", { action: "startup", outcome: "error" });
    if (!vapid) deps.logger.warn("notify.push_not_configured", { action: "startup", outcome: "refused" });
    const email: EmailConfig | null = endpoint
      ? {
          endpoint: endpoint.replace(/\/$/, ""),
          token: testing.token ?? managedIdentityToken(),
          appUrl: (process.env["APP_URL"] ?? "https://skilient.com").replace(/\/$/, ""),
          sendGapMs: Number(process.env["NOTIFY_SEND_GAP_MS"] ?? 600),
        }
      : null;
    if (process.env["NOTIFY_JOBS"] !== "off") {
      consumers = [copiesConsumer({ sql, logger: deps.logger }), noticesConsumer({ sql, ports: p, logger: deps.logger })];
      for (const c of consumers) await c.start();
      worker = createWorker({ sql, workerId: deps.instance, handlers: notifyJobs({ logger: deps.logger, ports: p, email, vapid, fetch: (...a) => (testing.fetch ?? fetch)(...a) }), logger: deps.logger });
      scheduler = createScheduler({ sql, schedules: notifySchedules(), logger: deps.logger });
      worker.start();
      await scheduler.start();
    }
    return createApi({ sql, logger: deps.logger, ports: p, vapidPublicKey: vapid?.publicKey ?? "" });
  },
  async ready() {
    if (!sql) return false;
    await sql`select 1`;
    return true;
  },
  async close() {
    scheduler?.stop();
    await worker?.stop();
    for (const c of consumers) await c.stop();
    consumers = [];
    worker = undefined;
    scheduler = undefined;
  },
});
