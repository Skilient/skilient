import { startCall, type Logger } from "@skilient/platform";
import { describeNotification } from "../domain/describe";
import { isPushEndpoint, pushRequest, type VapidKeys } from "../domain/webpush";
import type { Ports } from "../ports";
import { BLOCKED, PUSHED, type Tx } from "./db";

/**
 * The push drain (the notify-worker's runPushWorker, ported): one Web Push per device for each queued notice that
 * is still unread, still pushed and not stale. Endpoints are limited to the browsers' push services, so a
 * subscription can't aim notify anywhere else. VAPID keys come from Key Vault (notify-vapid-keys); without them
 * pushes are dropped and logged (the bell still has everything).
 */
const MAX_FAILURES = 5;
const MAX_ATTEMPTS = 3;
/** A push older than this isn't worth showing. */
const STALE_MS = 6 * 60 * 60 * 1000;

export interface PushRunResult {
  sent: number;
  skipped: number;
  deferred: number;
  failed: number;
  removed: number;
}

/** Chat pushes replace each other per thread; others per notice type and target. */
export function topicFor(type: string, entityId: string): string {
  const short = entityId.replace(/-/g, "").slice(0, 24);
  return type === "chat_message" ? `c${short}` : `${type.split("_")[0]!.slice(0, 7)}${short}`;
}

export async function runPushDrain(opts: { tx: Tx; keys: VapidKeys | null; ports: Ports; fetch: typeof fetch; logger: Logger; now?: () => Date; batch?: number }): Promise<PushRunResult> {
  const { tx, logger } = opts;
  const now = opts.now ?? (() => new Date());
  const result: PushRunResult = { sent: 0, skipped: 0, deferred: 0, failed: 0, removed: 0 };
  const rows = await tx<{ id: string; notification_id: string; attempts: number }[]>`
    update notify.push_queue q set attempts = q.attempts + 1
     where q.id in (select id from notify.push_queue where not_before <= now() order by id limit ${opts.batch ?? 50} for update skip locked)
    returning q.id::text, q.notification_id::text, q.attempts`;
  if (rows.length === 0) return result;
  const done = (id: string) => tx`delete from notify.push_queue where id = ${id}`;
  if (!opts.keys) {
    await tx`delete from notify.push_queue where id = any(${rows.map((r) => r.id)}::bigint[])`;
    result.skipped += rows.length;
    logger.warn("notify.push_not_configured", { action: "push.drain", outcome: "refused", count: rows.length });
    return result;
  }
  const notices = await tx<
    { id: string; user_id: string; type: string; entity_type: string; entity_id: string; data: Record<string, unknown>; read_at: Date | null; created_at: Date; actor_id: string | null; push_on: boolean; blocked: boolean }[]
  >`
    select n.id::text, n.user_id::text, n.type, n.entity_type, n.entity_id::text, n.data, n.read_at, n.created_at, n.actor_id::text,
           ${tx.unsafe(PUSHED)} and exists (select 1 from notify.push_subscriptions s where s.user_id = n.user_id) as push_on,
           (n.actor_id is not null and ${tx.unsafe(BLOCKED("n.user_id", "n.actor_id"))}) as blocked
      from notify.notifications n join notify.types t on t.type = n.type join notify.categories c on c.category = t.category
      left join notify.push_prefs pp on pp.user_id = n.user_id and pp.category = t.category
     where n.id = any(${rows.map((r) => r.notification_id)}::uuid[])`;
  const byId = new Map(notices.map((n) => [n.id, n]));
  const actors = [...new Set(notices.map((n) => n.actor_id).filter((x): x is string => Boolean(x)))];
  const names = actors.length ? await opts.ports.cards(actors, startCall()) : new Map();
  const subs = await tx<{ id: string; user_id: string; endpoint: string; p256dh: string; auth: string; failures: number }[]>`
    select id::text, user_id::text, endpoint, p256dh, auth, failures from notify.push_subscriptions where user_id = any(${[...new Set(notices.map((n) => n.user_id))]}::uuid[])`;

  for (const row of rows) {
    const n = byId.get(row.notification_id);
    const skip = !n ? "gone" : n.read_at ? "already_read" : !n.push_on ? "off" : n.blocked ? "blocked" : now().getTime() - new Date(n.created_at).getTime() > STALE_MS ? "stale" : null;
    if (skip || !n) {
      await done(row.id);
      result.skipped++;
      logger.info("notify.push_skipped", { action: "push.drain", outcome: "ok", reason: skip });
      continue;
    }
    const d = describeNotification({ type: n.type, actorName: n.actor_id ? (names.get(n.actor_id)?.name ?? null) : null, entityType: n.entity_type, entityId: n.entity_id, data: n.data ?? {} });
    const message = { title: d.subject, body: d.text, url: d.href, tag: topicFor(n.type, n.entity_id) };
    let delivered = 0;
    let transient = 0;
    for (const sub of subs.filter((s) => s.user_id === n.user_id)) {
      if (!isPushEndpoint(sub.endpoint)) {
        await tx`delete from notify.push_subscriptions where id = ${sub.id}`;
        result.removed++;
        continue;
      }
      let status = 0;
      try {
        const req = await pushRequest(sub, opts.keys, message, { urgency: n.type === "event_reminder" ? "high" : "normal", ttl: n.type === "event_reminder" ? 3600 : 86_400, now: now() });
        const res = await opts.fetch(req.url, { ...req.init, redirect: "error", signal: AbortSignal.timeout(10_000) });
        status = res.status;
      } catch {
        status = 0;
      }
      if (status >= 200 && status < 300) {
        delivered++;
        await tx`update notify.push_subscriptions set last_used_at = now(), failures = 0 where id = ${sub.id}`;
      } else if (status === 404 || status === 410) {
        await tx`delete from notify.push_subscriptions where id = ${sub.id}`;
        result.removed++;
      } else {
        transient++;
        const failures = sub.failures + 1;
        if (failures >= MAX_FAILURES || (status >= 400 && status < 500 && status !== 429)) {
          await tx`delete from notify.push_subscriptions where id = ${sub.id}`;
          result.removed++;
        } else {
          await tx`update notify.push_subscriptions set failures = ${failures} where id = ${sub.id}`;
          sub.failures = failures;
        }
        logger.warn("notify.push_failed", { action: "push.drain", outcome: "error", status });
      }
    }
    if (delivered === 0 && transient > 0 && row.attempts < MAX_ATTEMPTS) {
      await tx`update notify.push_queue set not_before = now() + make_interval(secs => ${60 * row.attempts}) where id = ${row.id}`;
      result.deferred++;
      continue;
    }
    await done(row.id);
    if (delivered) {
      result.sent++;
      logger.info("notify.push_sent", { action: "push.drain", outcome: "ok", type: n.type, devices: delivered });
    } else if (transient) result.failed++;
    else result.skipped++;
  }
  return result;
}

/** notify-vapid-keys (Key Vault): JSON {public_key, private_key, subject}; a placeholder or bad value means none. */
export function parseVapidSecret(value: string | null): VapidKeys | null {
  if (!value) return null;
  try {
    const v = JSON.parse(value) as { public_key?: unknown; private_key?: unknown; subject?: unknown };
    if (typeof v.public_key !== "string" || typeof v.private_key !== "string" || typeof v.subject !== "string") return null;
    if (!/^[A-Za-z0-9_-]{87}$/.test(v.public_key) || !/^[A-Za-z0-9_-]{43}$/.test(v.private_key) || !/^(mailto:|https:)/.test(v.subject)) return null;
    return { publicKey: v.public_key, privateKey: v.private_key, subject: v.subject };
  } catch {
    return null;
  }
}
