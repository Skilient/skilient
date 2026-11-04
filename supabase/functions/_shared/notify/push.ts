/**
 * The notify-worker's push channel (PRD 5.34): drains pgmq `notification_push` (queued by
 * private.notify when the type is pushed, the category's push preference is on and the person has a
 * subscribed device) and sends one Web Push per device. Shared by the Edge Function (Deno) and its
 * tests (Node): web APIs only. VAPID keys come from Vault; push endpoints are limited to the browsers'
 * push services (isPushEndpoint), so a subscription can't point the worker anywhere else.
 */
import type { Db, Fetch, Log } from "../github/types.ts";
import { describeNotification } from "./describe.ts";
import { isPushEndpoint, pushRequest, type VapidKeys } from "./webpush.ts";

const MAX_FAILURES = 5;
const MAX_ATTEMPTS = 3;
/** A push older than this isn't worth showing (an event reminder for an event that started, a chat already read). */
const STALE_MS = 6 * 60 * 60 * 1000;

interface QueueRow {
  msg_id: number | string;
  read_ct: number;
  message: { notification_id?: string };
}

export interface PushRunResult {
  sent: number;
  skipped: number;
  deferred: number;
  failed: number;
  removed: number;
}

export async function loadVapidKeys(db: Db): Promise<VapidKeys | null> {
  const rows = await db.query<{ name: string; secret: string }>(
    "select name, decrypted_secret as secret from vault.decrypted_secrets where name in ('vapid_public_key', 'vapid_private_key', 'vapid_subject')",
  );
  const get = (n: string) => rows.find((r) => r.name === n)?.secret ?? null;
  const publicKey = get("vapid_public_key");
  const privateKey = get("vapid_private_key");
  const subject = get("vapid_subject");
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

/** Chat pushes replace each other per thread; others per notification type and target. */
function topicFor(type: string, entityId: string): string {
  const short = entityId.replace(/-/g, "").slice(0, 24);
  return type === "chat_message" ? `c${short}` : `${type.split("_")[0].slice(0, 7)}${short}`;
}

export async function runPushWorker(opts: { db: Db; fetch: Fetch; log: Log; now?: () => Date; batch?: number }): Promise<PushRunResult> {
  const { db, log } = opts;
  const now = opts.now ?? (() => new Date());
  const result: PushRunResult = { sent: 0, skipped: 0, deferred: 0, failed: 0, removed: 0 };
  const rows = await db.query<QueueRow>("select msg_id, read_ct, message from pgmq.read('notification_push', 60, $1::integer)", [opts.batch ?? 50]);
  if (!rows.length) return result;
  const archive = (id: QueueRow["msg_id"]) => db.query("select pgmq.archive('notification_push', $1::bigint)", [id]);

  const keys = await loadVapidKeys(db);
  if (!keys) {
    // Not set up yet (docs/setup-checklist.md): pushes are best effort, the bell still has everything.
    for (const row of rows) await archive(row.msg_id);
    result.skipped += rows.length;
    log("notify.push_not_configured", { level: "warn", outcome: "refused", count: rows.length });
    return result;
  }

  for (const row of rows) {
    const id = row.message?.notification_id;
    if (!id) {
      await archive(row.msg_id);
      result.skipped++;
      continue;
    }
    const [n] = await db.query<{
      user_id: string;
      type: string;
      entity_type: string;
      entity_id: string;
      data: Record<string, unknown>;
      read_at: string | null;
      created_at: string | Date;
      actor_name: string | null;
      push_on: boolean;
      blocked: boolean;
    }>(
      `select n.user_id, n.type, n.entity_type, n.entity_id, n.data, n.read_at, n.created_at, ap.full_name as actor_name,
              private.push_on(n.user_id, n.type) as push_on,
              (n.actor_id is not null and private.is_blocked(n.user_id, n.actor_id)) as blocked
         from public.notifications n left join public.profiles ap on ap.user_id = n.actor_id
        where n.id = $1::uuid`,
      [id],
    );
    // Turned off since it was queued, already read, blocked or stale: nothing to push.
    const skip = !n ? "gone" : n.read_at ? "already_read" : !n.push_on ? "off" : n.blocked ? "blocked" : now().getTime() - new Date(n.created_at).getTime() > STALE_MS ? "stale" : null;
    if (skip || !n) {
      await archive(row.msg_id);
      result.skipped++;
      log("notify.push_skipped", { outcome: "ok", reason: skip, notification_id: id });
      continue;
    }
    const d = describeNotification({ type: n.type, actorName: n.actor_name, entityType: n.entity_type, entityId: n.entity_id, data: n.data ?? {} });
    const message = { title: d.subject, body: d.text, url: d.href, tag: topicFor(n.type, n.entity_id) };
    const subs = await db.query<{ id: string; endpoint: string; p256dh: string; auth: string; failures: number }>(
      "select id, endpoint, p256dh, auth, failures from public.push_subscriptions where user_id = $1::uuid",
      [n.user_id],
    );
    let delivered = 0;
    let transient = 0;
    for (const sub of subs) {
      if (!isPushEndpoint(sub.endpoint)) {
        await db.query("delete from public.push_subscriptions where id = $1::uuid", [sub.id]);
        result.removed++;
        continue;
      }
      let status = 0;
      try {
        const req = await pushRequest(sub, keys, message, { urgency: n.type === "event_reminder" ? "high" : "normal", ttl: n.type === "event_reminder" ? 3600 : 86_400, now: now() });
        const res = await opts.fetch(req.url, req.init);
        status = res.status;
      } catch {
        status = 0;
      }
      if (status >= 200 && status < 300) {
        delivered++;
        await db.query("update public.push_subscriptions set last_used_at = now(), failures = 0 where id = $1::uuid", [sub.id]);
      } else if (status === 404 || status === 410) {
        // The browser unsubscribed or the subscription expired.
        await db.query("delete from public.push_subscriptions where id = $1::uuid", [sub.id]);
        result.removed++;
      } else {
        transient++;
        const failures = sub.failures + 1;
        if (failures >= MAX_FAILURES || (status >= 400 && status < 500 && status !== 429)) {
          await db.query("delete from public.push_subscriptions where id = $1::uuid", [sub.id]);
          result.removed++;
        } else {
          await db.query("update public.push_subscriptions set failures = $2::smallint where id = $1::uuid", [sub.id, failures]);
        }
        log("notify.push_failed", { level: "warn", outcome: "error", status, notification_id: id });
      }
    }
    if (delivered === 0 && transient > 0 && row.read_ct < MAX_ATTEMPTS) {
      await db.query("select pgmq.set_vt('notification_push', $1::bigint, $2::integer)", [row.msg_id, 60 * row.read_ct]);
      result.deferred++;
      continue;
    }
    await archive(row.msg_id);
    if (delivered) {
      result.sent++;
      log("notify.push_sent", { outcome: "ok", type: n.type, devices: delivered });
    } else if (transient) result.failed++;
    else result.skipped++;
  }
  return result;
}
