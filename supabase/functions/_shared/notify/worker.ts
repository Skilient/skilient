/**
 * notify-worker: drains the `notification_emails` queue (PRD 5.11) and sends through
 * Brevo. Shared by the Edge Function (Deno) and its tests (Node): web APIs only.
 *
 * Preserved application budget (60 notification emails/day): instant emails
 * only for categories that allow them (checked again here), digests only when there is
 * something unread, and notification emails stop for the day at 60 (decisions.md
 * 2026-09-30). Supabase Auth SMTP and direct application security emails are separate.
 * Queued account/security notices keep the existing cap; operational alerts bypass it.
 * The application cap and credit refusals park notifications until the next UTC day.
 */
import type { Db, Fetch, Log } from "../github/types.ts";
import { describeNotification } from "./describe.ts";
import { digestEmail, instantEmail, opsAlertEmail, teacherDigestEmail, universityLaunchEmail, type EmailMessage } from "./email.ts";
import { notificationEmailCategory, SECURITY_NOTIFICATION_TYPES, type BrevoConfig, type EmailCategory } from "../email/brevo.ts";
import { sendQueuedEmail, deliveryIdentity } from "../email/delivery.ts";

export interface NotifyConfig extends BrevoConfig {
  /** Public app origin for links, no trailing slash. */
  appUrl: string;
  /** Preserved conservative spacing; Brevo quota/rate responses are handled separately. */
  sendGapMs: number;
}

export function notifyConfigFromEnv(env: (name: string) => string | undefined): NotifyConfig {
  const required = (name: string) => {
    const value = env(name);
    if (!value) throw new Error(`${name} is not set`);
    return value;
  };
  return {
    apiKey: required("BREVO_API_KEY"),
    appUrl: required("APP_URL").replace(/\/$/, ""),
    apiUrl: "https://api.brevo.com/v3",
    sendGapMs: 600,
  };
}

/** Notification emails a UTC day may send before the rest wait for tomorrow (Ahmed, 2026-09-30). */
export const DAILY_CAP = 60;
/** An instant email this old is no longer instant: it stays in-app only. */
const STALE_MS = 12 * 60 * 60 * 1000;
const DIGEST_ITEMS = 20;
const MAX_ATTEMPTS = 5;

interface QueueRow {
  msg_id: number | string;
  read_ct: number;
  enqueued_at: string;
  message: { kind?: string; notification_id?: string; user_id?: string; request_id?: string };
}

export interface NotifyRunResult {
  sent: number;
  skipped: number;
  deferred: number;
  failed: number;
}

export async function runNotifyWorker(opts: {
  db: Db;
  cfg: NotifyConfig;
  fetch: Fetch;
  log: Log;
  now?: () => Date;
  batch?: number;
}): Promise<NotifyRunResult> {
  const { db, cfg, log } = opts;
  const now = opts.now ?? (() => new Date());
  const result: NotifyRunResult = { sent: 0, skipped: 0, deferred: 0, failed: 0 };
  const rows = await db.query<QueueRow>(
    "select msg_id, read_ct, enqueued_at::text as enqueued_at, message from pgmq.read('notification_emails', 120, $1::integer)",
    [opts.batch ?? 20],
  );

  const archive = (id: QueueRow["msg_id"]) => db.query("select pgmq.archive('notification_emails', $1::bigint)", [id]);
  const deferUntil = (id: QueueRow["msg_id"], seconds: number) =>
    db.query("select pgmq.set_vt('notification_emails', $1::bigint, $2::integer)", [id, Math.max(1, Math.ceil(seconds))]);

  const sentToday = async () => {
    const [{ today }] = await db.query<{ today: number }>(
      "select count(*)::integer as today from private.email_sends where sent_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'",
    );
    return today;
  };
  const parkUntilTomorrow = async () => {
    const midnight = new Date(now());
    midnight.setUTCHours(24, 5, 0, 0);
    const wait = (midnight.getTime() - now().getTime()) / 1000;
    // Operational alerts are never held back by the notification cap (they don't count toward it either).
    await db.query(
      "select pgmq.set_vt('notification_emails', msg_id, $1::integer) from pgmq.q_notification_emails where message ->> 'kind' is distinct from 'ops_alert'",
      [Math.ceil(wait)],
    );
  };

  let first = true;
  let capped = false;
  rows: for (const row of rows) {
    const kind = row.message?.kind;
    if (kind === "ops_alert") {
      const sent = await sendOpsAlert(db, cfg, opts.fetch, row, log);
      if (sent === "retry" && row.read_ct < MAX_ATTEMPTS) {
        await deferUntil(row.msg_id, 30 * row.read_ct);
        result.deferred++;
      } else {
        await archive(row.msg_id);
        if (sent === "sent") result.sent++;
        else if (sent === "skipped") result.skipped++;
        else result.failed++;
      }
      continue;
    }
    if (capped) continue; // already parked until tomorrow
    const today = await sentToday();
    if (today >= DAILY_CAP) {
      await parkUntilTomorrow();
      capped = true;
      result.deferred++;
      log("notify.daily_cap", { level: "warn", outcome: "refused", daily_count: today, cap: DAILY_CAP });
      continue;
    }
    let email: EmailMessage | null = null;
    let key = "";
    let userId: string | null = null;
    let notificationId: string | null = null;
    let digestEmails: EmailMessage[] | null = null;
    const queuedDay = new Date(row.enqueued_at).toISOString().slice(0, 10);

    if (kind === "instant" && row.message.notification_id) {
      notificationId = row.message.notification_id;
      const built = await buildInstant(db, cfg, notificationId, now());
      if ("skip" in built) {
        await archive(row.msg_id);
        result.skipped++;
        log("notify.skipped", { outcome: "ok", reason: built.skip, notification_id: notificationId });
        continue;
      }
      ({ email, userId } = built);
      key = `notification-${notificationId}`;
    } else if (kind === "digest" && row.message.user_id) {
      userId = row.message.user_id;
      const built = await buildDigest(db, cfg, userId, now(), row.enqueued_at);
      if ("skip" in built) {
        await archive(row.msg_id);
        result.skipped++;
        log("notify.skipped", { outcome: "ok", reason: built.skip, kind: "digest" });
        continue;
      }
      digestEmails = built.emails;
      key = `digest-${userId}-${queuedDay}`;
    } else if (kind === "teacher_digest" && row.message.user_id) {
      // The teacher portal's one weekly email (PRD 5.21), instead of per-event emails.
      userId = row.message.user_id;
      const built = await buildTeacherDigest(db, cfg, userId);
      if ("skip" in built) {
        await archive(row.msg_id);
        result.skipped++;
        log("notify.skipped", { outcome: "ok", reason: built.skip, kind: "teacher_digest" });
        continue;
      }
      email = built.email;
      key = `teacher-digest-${userId}-${queuedDay}`;
    } else if (kind === "university_launch" && row.message.request_id) {
      // A requester's university went live (PRD 5.1): the one launch email, queued by the live_at trigger.
      const [r] = await db.query<{ email: string; university: string }>("select email, university from private.university_launch_email($1::uuid)", [
        row.message.request_id,
      ]);
      if (!r) {
        await archive(row.msg_id);
        result.skipped++;
        log("notify.skipped", { outcome: "ok", reason: "not_wanted", kind: "university_launch" });
        continue;
      }
      email = universityLaunchEmail(r.email, cfg.appUrl, r.university);
      key = `university-launch-${row.message.request_id}`;
    } else {
      await archive(row.msg_id);
      result.skipped++;
      log("notify.skipped", { outcome: "refused", reason: "bad_message" });
      continue;
    }

    for (const message of digestEmails ?? (email ? [email] : [])) {
      if (await sentToday() >= DAILY_CAP) {
        await parkUntilTomorrow();
        capped = true;
        result.deferred++;
        continue rows;
      }
      if (!first && cfg.sendGapMs > 0) await new Promise((r) => setTimeout(r, cfg.sendGapMs));
      first = false;
      const messageKey = `${key}-${message.category}`;
      const sent = await sendQueuedEmail(db, cfg, opts.fetch, message, messageKey);
      if (sent.ok) {
        await db.query("insert into private.email_sends (kind, user_id, notification_id, provider_message_id, send_key) values ($1, $2::uuid, $3::uuid, $4, $5) on conflict (send_key) do nothing", [
          kind === "instant" ? "instant" : "digest",
          userId,
          notificationId,
          sent.id,
          (await deliveryIdentity(messageKey)).digest,
        ]);
        log("notify.sent", { outcome: "ok", kind, daily_count: today + 1 });
        continue;
      }

      if (sent.retry === "tomorrow") {
        // Park this and every other message until the quota resets at 00:00 UTC.
        await parkUntilTomorrow();
        capped = true;
        result.deferred++;
        log("notify.quota", { level: "error", outcome: "error", error_code: sent.name });
        continue rows;
      }
      if (sent.retry === "later" && row.read_ct < MAX_ATTEMPTS) {
        await deferUntil(row.msg_id, Math.max(30 * row.read_ct, sent.waitSeconds ?? 0));
        result.deferred++;
        log("notify.deferred", { level: "warn", outcome: "error", error_code: sent.name, attempt: row.read_ct });
        if (sent.status === 429) break rows;
        continue rows;
      }
      await archive(row.msg_id);
      result.failed++;
      log("notify.failed", { level: "error", outcome: "error", error_code: sent.name, status: sent.status, kind });
      continue rows;
    }
    if (kind === "digest") {
      await db.query(
        `insert into private.user_activity as activity (user_id, last_active_at, last_digest_at) values ($1::uuid, '-infinity', $2::timestamptz)
         on conflict (user_id) do update set last_digest_at = greatest(activity.last_digest_at, excluded.last_digest_at)`,
        [userId, row.enqueued_at],
      );
    }
    await archive(row.msg_id);
    result.sent++;
  }
  return result;
}

interface InstantRow {
  id: string;
  user_id: string;
  type: string;
  entity_type: string;
  entity_id: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string | Date;
  email: string | null;
  actor_name: string | null;
  channel: string | null;
  blocked: boolean;
}

async function buildInstant(
  db: Db,
  cfg: NotifyConfig,
  id: string,
  now: Date,
): Promise<{ skip: string } | { email: EmailMessage; userId: string }> {
  const [n] = await db.query<InstantRow>(
    `select n.id, n.user_id, n.type, n.entity_type, n.entity_id, n.data, n.read_at, n.created_at, u.email,
            ap.full_name as actor_name,
            private.email_channel_for(n.user_id, n.type)::text as channel,
            (n.actor_id is not null and private.is_blocked(n.user_id, n.actor_id)) as blocked
       from public.notifications n
       join auth.users u on u.id = n.user_id
       left join public.profiles ap on ap.user_id = n.actor_id
      where n.id = $1::uuid`,
    [id],
  );
  if (!n) return { skip: "gone" };
  const [prior] = await db.query<{ id: number }>("select id from private.email_sends where notification_id = $1::uuid limit 1", [id]);
  if (prior) return { skip: "already_emailed" };
  if (n.read_at) return { skip: "already_read" };
  if (n.blocked) return { skip: "blocked" };
  if (n.channel !== "instant_email") return { skip: "not_instant" };
  if (!n.email) return { skip: "no_address" };
  if (now.getTime() - new Date(n.created_at).getTime() > STALE_MS) return { skip: "stale" };
  const d = describeNotification({ type: n.type, actorName: n.actor_name, entityType: n.entity_type, entityId: n.entity_id, data: n.data ?? {} });
  return { email: instantEmail(n.email, cfg.appUrl, d, notificationEmailCategory(n.type)), userId: n.user_id };
}

async function buildDigest(
  db: Db,
  cfg: NotifyConfig,
  userId: string,
  now: Date,
  cutoff: string,
): Promise<{ skip: string } | { emails: EmailMessage[] }> {
  const [who] = await db.query<{ email: string | null; last_active_at: string | Date | null; last_digest_at: string | Date | null }>(
    `select u.email, a.last_active_at, a.last_digest_at
       from auth.users u left join private.user_activity a on a.user_id = u.id
      where u.id = $1::uuid`,
    [userId],
  );
  if (!who?.email) return { skip: "no_address" };
  if (who.last_digest_at && new Date(who.last_digest_at).getTime() >= new Date(cutoff).getTime()) return { skip: "already_covered" };
  if (who.last_active_at && now.getTime() - new Date(who.last_active_at).getTime() < 24 * 60 * 60 * 1000) {
    return { skip: "active" };
  }
  if (who.last_digest_at && now.getTime() - new Date(who.last_digest_at).getTime() < 20 * 60 * 60 * 1000) {
    return { skip: "already_sent_today" };
  }
  const items = await db.query<{ type: string; entity_type: string; entity_id: string; data: Record<string, unknown>; actor_name: string | null; total: number }>(
    `select n.type, n.entity_type, n.entity_id, n.data, ap.full_name as actor_name,
            count(*) over (partition by (n.type = any($2::text[])))::integer as total
       from public.notifications n
       left join private.user_activity a on a.user_id = n.user_id
       left join public.profiles ap on ap.user_id = n.actor_id
      where n.user_id = $1::uuid
        and n.read_at is null
        and n.created_at > coalesce(a.last_digest_at, '-infinity'::timestamptz)
        and n.created_at <= $3::timestamptz
        and private.email_channel_for(n.user_id, n.type) = 'digest'
        and (n.actor_id is null or not private.is_blocked(n.user_id, n.actor_id))
      order by n.created_at desc
      limit ${DIGEST_ITEMS}`,
    [userId, [...SECURITY_NOTIFICATION_TYPES], cutoff],
  );
  if (!items.length) return { skip: "empty" };
  const groups = new Map<EmailCategory, { text: string; href: string }[]>();
  for (const i of items) {
    const d = describeNotification({ type: i.type, actorName: i.actor_name, entityType: i.entity_type, entityId: i.entity_id, data: i.data ?? {} });
    const category = notificationEmailCategory(i.type);
    const lines = groups.get(category) ?? [];
    lines.push({ text: d.text, href: d.href });
    groups.set(category, lines);
  }
  return { emails: [...groups].map(([category, lines]) => digestEmail(
    who.email!, cfg.appUrl, lines,
    Math.max(0, (items.find((item) => notificationEmailCategory(item.type) === category)?.total ?? lines.length) - lines.length), category,
  )) };
}

async function buildTeacherDigest(db: Db, cfg: NotifyConfig, userId: string): Promise<{ skip: string } | { email: EmailMessage }> {
  const [who] = await db.query<{ email: string | null; digest: boolean | null; counts: Record<string, number> | null }>(
    `select u.email, coalesce(s.digest, true) as digest, private.teacher_digest_data(u.id) as counts
       from auth.users u
       join public.teacher_profiles t on t.user_id = u.id and t.status = 'approved'
       left join public.teacher_settings s on s.user_id = u.id
      where u.id = $1::uuid`,
    [userId],
  );
  if (!who?.email) return { skip: "no_address" };
  if (who.digest === false) return { skip: "opted_out" };
  const counts = who.counts ?? {};
  const total = Object.values(counts).reduce((n, v) => n + Number(v), 0);
  if (total === 0) return { skip: "empty" };
  return { email: teacherDigestEmail(who.email, cfg.appUrl, counts) };
}

/** One alert to every address in alerts.recipients. Nobody set up yet: skipped (state stays in private.alert_state). */
async function sendOpsAlert(db: Db, cfg: NotifyConfig, fetchImpl: Fetch, row: QueueRow, log: Log): Promise<"sent" | "skipped" | "retry" | "failed"> {
  const m = row.message as { key?: string; state?: string; title?: string; detail?: string; since?: string };
  if (!m.key || !m.title || !m.detail || (m.state !== "firing" && m.state !== "resolved")) {
    log("notify.skipped", { outcome: "refused", reason: "bad_message", kind: "ops_alert" });
    return "skipped";
  }
  const [cfgRow] = await db.query<{ recipients: unknown }>("select private.config('alerts.recipients') as recipients");
  const recipients = Array.isArray(cfgRow?.recipients) ? (cfgRow.recipients as unknown[]).filter((r): r is string => typeof r === "string") : [];
  if (!recipients.length) {
    log("notify.skipped", { level: "warn", outcome: "refused", reason: "no_recipients", kind: "ops_alert", alert: m.key });
    return "skipped";
  }
  let worst: "sent" | "retry" | "failed" = "sent";
  for (const to of recipients) {
    const email = opsAlertEmail(to, cfg.appUrl, { state: m.state, title: m.title, detail: m.detail, since: m.since ?? "" });
    const sent = await sendQueuedEmail(db, cfg, fetchImpl, email, `ops-alert-${row.msg_id}-${to.toLowerCase()}`);
    if (!sent.ok) {
      if (sent.retry !== "later") worst = "failed";
      else if (worst !== "failed") worst = "retry";
    }
  }
  log(worst === "sent" ? "notify.sent" : "notify.failed", {
    level: worst === "sent" ? "info" : "error",
    outcome: worst === "sent" ? "ok" : "error",
    kind: "ops_alert",
    alert: m.key,
    state: m.state,
    recipients: recipients.length,
  });
  return worst;
}
