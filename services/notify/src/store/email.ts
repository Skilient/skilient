import { createHash } from "node:crypto";
import { startCall, type Logger } from "@skilient/platform";
import { mailBody, notificationEmailCategory, SECURITY_NOTIFICATION_TYPES, sendViaAcs, type EmailCategory, type EmailMessage, type SendResult } from "../domain/mail";
import { describeNotification } from "../domain/describe";
import { digestEmail, instantEmail, opsAlertEmail, recordClaimEmail, universityLaunchEmail } from "../domain/email";
import type { Ports } from "../ports";
import { BLOCKED, CHANNEL, type Db, type Tx } from "./db";

/**
 * The email drain (the notify-worker Edge Function's runNotifyWorker, ported): instant emails, digests, the
 * university launch and Record claim emails, and ops alerts. 60 notification emails a UTC day; ops alerts never
 * count and are never held. The cap and Azure's daily quota park everything else until 00:05 UTC. Addresses come from
 * identity (EmailsOf) and actors' names from people (ProfileCards), one batch call each per run.
 */
export interface EmailConfig {
  /** The Communication Services endpoint, https://<resource>.communication.azure.com (NOTIFY_EMAIL_ENDPOINT). */
  endpoint: string;
  /** The managed identity's token for Azure Communication Services. */
  token(): Promise<string>;
  /** Public app origin for links, no trailing slash. */
  appUrl: string;
  /** Spacing between sends (ms). */
  sendGapMs: number;
}

/** Notification emails a UTC day may send before the rest wait for tomorrow (Ahmed, 2026-09-30). */
export const DAILY_CAP = 60;
/** An instant email this old is no longer instant: it stays in-app only. */
const STALE_MS = 12 * 60 * 60 * 1000;
const DIGEST_ITEMS = 20;
const MAX_ATTEMPTS = 5;

export interface EmailRunResult {
  sent: number;
  skipped: number;
  deferred: number;
  failed: number;
}

interface QueueRow {
  id: string;
  kind: string;
  payload: Record<string, string | null | undefined>;
  enqueued_at: Date;
  attempts: number;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Stable UUID and opaque ledger key (deliveryIdentity); no recipient or content is kept in the ledger. */
export function deliveryIdentity(key: string): { digest: string; uuid: string } {
  const digest = sha256(key);
  return { digest, uuid: `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}` };
}

/** `claim_brevo_email` and `finish_brevo_email` around one send (sendQueuedEmail), now for Azure's email. */
export async function sendQueuedEmail(db: Db, cfg: EmailConfig, fetchImpl: typeof fetch, email: EmailMessage, key: string): Promise<SendResult> {
  const { digest, uuid } = deliveryIdentity(key);
  const fingerprint = sha256(JSON.stringify({ id: uuid, ...mailBody(email) }));
  const claim = await claimDelivery(db, digest, fingerprint);
  if (claim.state === "accepted") return { ok: true, id: claim.messageId ?? "" };
  if (!claim.claimed)
    return {
      ok: false,
      retry: claim.state === "uncertain" || claim.state === "failed" ? "never" : "later",
      name: claim.state === "uncertain" ? "delivery_needs_reconciliation" : "delivery_busy",
      status: 0,
    };
  // Azure's repeatability: the same id and first-sent time on every try of this send.
  const [first] = await db<{ at: Date }[]>`select first_attempt_at as at from notify.deliveries where send_key = ${digest}`;
  const sent = await sendViaAcs({ endpoint: cfg.endpoint, token: cfg.token }, fetchImpl, email, uuid, first?.at ?? new Date());
  const state = sent.ok ? "accepted" : sent.uncertain ? "pending" : sent.retry === "never" ? "failed" : "retryable";
  await db`
    update notify.deliveries set state = ${state}, message_id = ${sent.ok ? sent.id : null},
           lease_until = case when ${state} = 'pending' then now() + interval '30 seconds' else now() end
     where send_key = ${digest} and state = 'pending'`;
  return sent;
}

async function claimDelivery(db: Db, key: string, hash: string): Promise<{ state: string; messageId: string | null; claimed: boolean }> {
  const fresh = await db`insert into notify.deliveries (send_key, payload_hash, state) values (${key}, ${hash}, 'pending') on conflict do nothing`;
  if (fresh.count) return { state: "pending", messageId: null, claimed: true };
  const [r] = await db<{ state: string; message_id: string | null; lease_until: Date; first_attempt_at: Date; payload_hash: string; busy: boolean; old: boolean }[]>`
    select state, message_id, lease_until, first_attempt_at, payload_hash, lease_until > now() as busy, first_attempt_at < now() - interval '25 minutes' as old
      from notify.deliveries where send_key = ${key} for update`;
  if (!r) return { state: "busy", messageId: null, claimed: false };
  if (r.state === "accepted" || r.state === "failed" || r.state === "uncertain") return { state: r.state, messageId: r.message_id, claimed: false };
  if (r.busy) return { state: "busy", messageId: null, claimed: false };
  if (r.state === "pending" && (r.old || r.payload_hash !== hash)) {
    await db`update notify.deliveries set state = 'uncertain' where send_key = ${key}`;
    return { state: "uncertain", messageId: null, claimed: false };
  }
  await db`
    update notify.deliveries set state = 'pending', payload_hash = ${hash},
           first_attempt_at = case when ${r.state} = 'retryable' then now() else first_attempt_at end,
           lease_until = now() + interval '120 seconds'
     where send_key = ${key}`;
  return { state: "pending", messageId: null, claimed: true };
}

export async function runEmailDrain(opts: { tx: Tx; cfg: EmailConfig; ports: Ports; fetch: typeof fetch; logger: Logger; now?: () => Date; batch?: number }): Promise<EmailRunResult> {
  const { tx, cfg, logger } = opts;
  const now = opts.now ?? (() => new Date());
  const result: EmailRunResult = { sent: 0, skipped: 0, deferred: 0, failed: 0 };
  const rows = await tx<QueueRow[]>`
    select id::text, kind, payload, enqueued_at, attempts from notify.email_queue
     where not_before <= now() order by id limit ${opts.batch ?? 20} for update skip locked`;
  if (rows.length === 0) return result;
  await tx`update notify.email_queue set attempts = attempts + 1 where id = any(${rows.map((r) => r.id)}::bigint[])`;
  for (const r of rows) r.attempts++;

  const done = (id: string) => tx`delete from notify.email_queue where id = ${id}`;
  const deferFor = (id: string, seconds: number) => tx`update notify.email_queue set not_before = now() + make_interval(secs => ${Math.max(1, Math.ceil(seconds))}) where id = ${id}`;
  const sentToday = async () => {
    const [t] = await tx<{ n: number }[]>`select count(*)::int as n from notify.email_sends where sent_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'`;
    return t!.n;
  };
  const parkUntilTomorrow = async () => {
    const midnight = new Date(now());
    midnight.setUTCHours(24, 5, 0, 0);
    const wait = Math.ceil((midnight.getTime() - now().getTime()) / 1000);
    await tx`update notify.email_queue set not_before = now() + make_interval(secs => ${wait}) where kind <> 'ops_alert'`;
  };

  // One batch read each for the run: the notices, the recipients' addresses and the actors' names.
  const ctx = await loadContext(tx, rows, opts.ports, now());

  let first = true;
  let capped = false;
  rows: for (const row of rows) {
    if (row.kind === "ops_alert") {
      const outcome = await sendOpsAlert(tx, cfg, opts.fetch, row, logger);
      if (outcome === "retry" && row.attempts < MAX_ATTEMPTS) {
        await deferFor(row.id, 30 * row.attempts);
        result.deferred++;
      } else {
        await done(row.id);
        if (outcome === "sent") result.sent++;
        else if (outcome === "skipped") result.skipped++;
        else result.failed++;
      }
      continue;
    }
    if (capped) continue;
    const today = await sentToday();
    if (today >= DAILY_CAP) {
      await parkUntilTomorrow();
      capped = true;
      result.deferred++;
      logger.warn("notify.daily_cap", { action: "email.drain", outcome: "refused", daily_count: today, cap: DAILY_CAP });
      continue;
    }
    const built = buildEmail(row, ctx, cfg, now());
    if ("skip" in built) {
      await done(row.id);
      result.skipped++;
      logger.info("notify.skipped", { action: "email.drain", outcome: "ok", reason: built.skip, kind: row.kind });
      continue;
    }
    for (const message of built.emails) {
      if ((await sentToday()) >= DAILY_CAP) {
        await parkUntilTomorrow();
        capped = true;
        result.deferred++;
        continue rows;
      }
      if (!first && cfg.sendGapMs > 0) await new Promise((res) => setTimeout(res, cfg.sendGapMs));
      first = false;
      const messageKey = `${built.key}-${message.category}`;
      const sent = await sendQueuedEmail(tx, cfg, opts.fetch, message, messageKey);
      if (sent.ok) {
        await tx`
          insert into notify.email_sends (kind, user_id, notification_id, provider_message_id, send_key)
          values (${row.kind === "instant" ? "instant" : "digest"}, ${built.userId}, ${built.notificationId}, ${sent.id}, ${deliveryIdentity(messageKey).digest})
          on conflict (send_key) do nothing`;
        logger.info("notify.sent", { action: "email.drain", outcome: "ok", kind: row.kind, daily_count: today + 1 });
        continue;
      }
      if (sent.retry === "tomorrow") {
        await parkUntilTomorrow();
        capped = true;
        result.deferred++;
        logger.error("notify.quota", { action: "email.drain", outcome: "error", error_code: sent.name });
        continue rows;
      }
      if (sent.retry === "later" && row.attempts < MAX_ATTEMPTS) {
        await deferFor(row.id, Math.max(30 * row.attempts, sent.waitSeconds ?? 0));
        result.deferred++;
        logger.warn("notify.deferred", { action: "email.drain", outcome: "error", error_code: sent.name, attempt: row.attempts });
        if (sent.status === 429) break rows;
        continue rows;
      }
      await done(row.id);
      result.failed++;
      logger.error("notify.failed", { action: "email.drain", outcome: "error", error_code: sent.name, status: sent.status, kind: row.kind });
      continue rows;
    }
    if (row.kind === "digest" && built.userId) {
      await tx`
        insert into notify.activity as a (user_id, last_active_at, last_digest_at) values (${built.userId}, '-infinity', ${row.enqueued_at})
        on conflict (user_id) do update set last_digest_at = greatest(a.last_digest_at, excluded.last_digest_at)`;
    }
    await done(row.id);
    result.sent++;
  }
  return result;
}

interface Item {
  id: string;
  user_id: string;
  type: string;
  entity_type: string;
  entity_id: string;
  data: Record<string, unknown>;
  read_at: Date | null;
  created_at: Date;
  actor_id: string | null;
  channel: string;
  blocked: boolean;
  emailed_before: boolean;
}
interface Who {
  user_id: string;
  last_active_at: Date | null;
  last_digest_at: Date | null;
}
interface Context {
  instant: Map<string, Item>;
  digest: Map<string, Item[]>;
  digestTotals: Map<string, Map<EmailCategory, number>>;
  who: Map<string, Who>;
  emails: Map<string, string>;
  names: Map<string, string>;
  walkIns: Map<string, string>;
}

async function loadContext(tx: Tx, rows: QueueRow[], ports: Ports, now: Date): Promise<Context> {
  const ids = rows.filter((r) => r.kind === "instant").map((r) => String(r.payload["notification_id"] ?? ""));
  const digestRows = rows.filter((r) => r.kind === "digest");
  const instant = await tx<Item[]>`
    select n.id::text, n.user_id::text, n.type, n.entity_type, n.entity_id::text, n.data, n.read_at, n.created_at, n.actor_id::text,
           ${tx.unsafe(CHANNEL)} as channel,
           (n.actor_id is not null and ${tx.unsafe(BLOCKED("n.user_id", "n.actor_id"))}) as blocked,
           exists (select 1 from notify.email_sends s where s.notification_id = n.id) as emailed_before
      from notify.notifications n join notify.types t on t.type = n.type join notify.categories c on c.category = t.category
      left join notify.prefs p on p.user_id = n.user_id and p.category = t.category
     where n.id = any(${ids.filter((x) => /^[0-9a-f-]{36}$/.test(x))}::uuid[])`;
  const digestUsers = digestRows.map((r) => String(r.payload["user_id"] ?? "")).filter((x) => /^[0-9a-f-]{36}$/.test(x));
  const who = await tx<Who[]>`
    select u.id::text as user_id, a.last_active_at, a.last_digest_at
      from unnest(${digestUsers}::uuid[]) as u(id) left join notify.activity a on a.user_id = u.id`;
  const digest = new Map<string, Item[]>();
  const digestTotals = new Map<string, Map<EmailCategory, number>>();
  for (const r of digestRows) {
    const user = String(r.payload["user_id"] ?? "");
    if (!digestUsers.includes(user)) continue;
    const items = await tx<(Item & { total: number })[]>`
      select n.id::text, n.user_id::text, n.type, n.entity_type, n.entity_id::text, n.data, n.read_at, n.created_at, n.actor_id::text,
             'digest' as channel, false as blocked, false as emailed_before,
             count(*) over (partition by (n.type = any(${[...SECURITY_NOTIFICATION_TYPES]}::text[])))::int as total
        from notify.notifications n join notify.types t on t.type = n.type join notify.categories c on c.category = t.category
        left join notify.prefs p on p.user_id = n.user_id and p.category = t.category
        left join notify.activity a on a.user_id = n.user_id
       where n.user_id = ${user} and n.read_at is null
         and n.created_at > coalesce(a.last_digest_at, '-infinity'::timestamptz) and n.created_at <= ${r.enqueued_at}
         and ${tx.unsafe(CHANNEL)} = 'digest'
         and (n.actor_id is null or not ${tx.unsafe(BLOCKED("n.user_id", "n.actor_id"))})
       order by n.created_at desc
       limit ${DIGEST_ITEMS}`;
    digest.set(user, items);
    const totals = new Map<EmailCategory, number>();
    for (const i of items) totals.set(notificationEmailCategory(i.type), i.total);
    digestTotals.set(user, totals);
  }
  const users = new Set<string>([...instant.map((i) => i.user_id), ...digest.keys()]);
  const actors = new Set<string>([...instant, ...[...digest.values()].flat()].map((i) => i.actor_id).filter((x): x is string => Boolean(x)));
  const attendees = rows.filter((r) => r.kind === "record_claim").map((r) => String(r.payload["attendee_id"] ?? ""));
  const call = startCall();
  const [emails, cards, walkIns] = await Promise.all([
    ports.emails([...users], call),
    ports.cards([...actors], call),
    attendees.length ? ports.walkInEmails(attendees, call) : Promise.resolve(new Map<string, string>()),
  ]);
  void now;
  return {
    instant: new Map(instant.map((i) => [i.id, i])),
    digest,
    digestTotals,
    who: new Map(who.map((w) => [w.user_id, w])),
    emails,
    names: new Map([...cards].map(([k, v]) => [k, v.name])),
    walkIns,
  };
}

type Built = { skip: string } | { emails: EmailMessage[]; key: string; userId: string | null; notificationId: string | null };

function describeItem(i: Item, ctx: Context) {
  return describeNotification({ type: i.type, actorName: i.actor_id ? (ctx.names.get(i.actor_id) ?? null) : null, entityType: i.entity_type, entityId: i.entity_id, data: i.data ?? {} });
}

function buildEmail(row: QueueRow, ctx: Context, cfg: EmailConfig, now: Date): Built {
  const queuedDay = new Date(row.enqueued_at).toISOString().slice(0, 10);
  switch (row.kind) {
    case "instant": {
      const id = String(row.payload["notification_id"] ?? "");
      const n = ctx.instant.get(id);
      if (!n) return { skip: "gone" };
      if (n.emailed_before) return { skip: "already_emailed" };
      if (n.read_at) return { skip: "already_read" };
      if (n.blocked) return { skip: "blocked" };
      if (n.channel !== "instant_email") return { skip: "not_instant" };
      const to = ctx.emails.get(n.user_id);
      if (!to) return { skip: "no_address" };
      if (now.getTime() - new Date(n.created_at).getTime() > STALE_MS) return { skip: "stale" };
      return { emails: [instantEmail(to, cfg.appUrl, describeItem(n, ctx), notificationEmailCategory(n.type))], key: `notification-${id}`, userId: n.user_id, notificationId: id };
    }
    case "digest": {
      const user = String(row.payload["user_id"] ?? "");
      const to = ctx.emails.get(user);
      if (!to) return { skip: "no_address" };
      const w = ctx.who.get(user);
      if (w?.last_digest_at && new Date(w.last_digest_at).getTime() >= new Date(row.enqueued_at).getTime()) return { skip: "already_covered" };
      if (w?.last_active_at && now.getTime() - new Date(w.last_active_at).getTime() < 24 * 60 * 60 * 1000) return { skip: "active" };
      if (w?.last_digest_at && now.getTime() - new Date(w.last_digest_at).getTime() < 20 * 60 * 60 * 1000) return { skip: "already_sent_today" };
      const items = ctx.digest.get(user) ?? [];
      if (items.length === 0) return { skip: "empty" };
      const groups = new Map<EmailCategory, { text: string; href: string }[]>();
      for (const i of items) {
        const d = describeItem(i, ctx);
        const category = notificationEmailCategory(i.type);
        groups.set(category, [...(groups.get(category) ?? []), { text: d.text, href: d.href }]);
      }
      const totals = ctx.digestTotals.get(user)!;
      return {
        emails: [...groups].map(([category, lines]) => digestEmail(to, cfg.appUrl, lines, Math.max(0, (totals.get(category) ?? lines.length) - lines.length), category)),
        key: `digest-${user}-${queuedDay}`,
        userId: user,
        notificationId: null,
      };
    }
    case "university_launch": {
      const to = row.payload["email"];
      const uni = row.payload["university"];
      if (!to || !uni) return { skip: "not_wanted" };
      return { emails: [universityLaunchEmail(to, cfg.appUrl, uni)], key: `university-launch-${row.payload["request_id"]}`, userId: null, notificationId: null };
    }
    case "record_claim": {
      const to = ctx.walkIns.get(String(row.payload["attendee_id"] ?? ""));
      const event = row.payload["event_title"];
      const society = row.payload["society"];
      if (!to || !event || !society) return { skip: "not_wanted" };
      return { emails: [recordClaimEmail(to, cfg.appUrl, event, society)], key: `record-claim-${row.payload["claim_id"]}`, userId: null, notificationId: null };
    }
    default:
      return { skip: "bad_message" };
  }
}

/** One alert to every recipient. None: skipped (trust keeps the alert's state). */
async function sendOpsAlert(tx: Tx, cfg: EmailConfig, fetchImpl: typeof fetch, row: QueueRow, logger: Logger): Promise<"sent" | "skipped" | "retry" | "failed"> {
  const m = row.payload as { key?: string; state?: string; title?: string; detail?: string; since?: string; recipients?: unknown };
  if (!m.key || !m.title || !m.detail || (m.state !== "firing" && m.state !== "resolved")) return "skipped";
  const recipients = Array.isArray(m.recipients) ? (m.recipients as unknown[]).filter((r): r is string => typeof r === "string") : [];
  if (!recipients.length) {
    logger.warn("notify.skipped", { action: "email.drain", outcome: "refused", reason: "no_recipients", kind: "ops_alert", alert: m.key });
    return "skipped";
  }
  let worst: "sent" | "retry" | "failed" = "sent";
  for (const to of recipients) {
    const email = opsAlertEmail(to, cfg.appUrl, { state: m.state, title: m.title, detail: m.detail, since: m.since ?? "" });
    const sent = await sendQueuedEmail(tx, cfg, fetchImpl, email, `ops-alert-${row.id}-${to.toLowerCase()}`);
    if (!sent.ok) {
      if (sent.retry !== "later") worst = "failed";
      else if (worst !== "failed") worst = "retry";
    }
  }
  logger.info(worst === "sent" ? "notify.sent" : "notify.failed", { action: "email.drain", outcome: worst === "sent" ? "ok" : "error", kind: "ops_alert", alert: m.key, recipients: recipients.length });
  return worst;
}

/** `queue_notification_digests()`: people with unread digest notices since their last digest, inactive for 24 hours. */
export async function queueDigests(tx: Tx): Promise<number> {
  const r = await tx`
    insert into notify.email_queue (kind, payload)
    select 'digest', jsonb_build_object('user_id', due.user_id)
      from (select distinct n.user_id
              from notify.notifications n join notify.types t on t.type = n.type join notify.categories c on c.category = t.category
              left join notify.prefs p on p.user_id = n.user_id and p.category = t.category
              left join notify.activity a on a.user_id = n.user_id
             where n.read_at is null and ${tx.unsafe(CHANNEL)} = 'digest'
               and n.created_at > coalesce(a.last_digest_at, '-infinity'::timestamptz)
               and coalesce(a.last_active_at, '-infinity'::timestamptz) < now() - interval '24 hours') due`;
  return r.count;
}

/** `purge_notifications()`: read notices after 90 days, unread after a year; the send log after 60 days. */
export async function purgeNotifications(tx: Tx): Promise<number> {
  const a = await tx`delete from notify.notifications where (read_at is not null and created_at < now() - interval '90 days') or created_at < now() - interval '365 days'`;
  await tx`delete from notify.email_sends where sent_at < now() - interval '60 days'`;
  await tx`delete from notify.deliveries where first_attempt_at < now() - interval '60 days'`;
  return a.count;
}
