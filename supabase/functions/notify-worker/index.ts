// notify-worker: drains the notification_emails queue (PRD 5.11): instant emails and the
// daily digest, sent through Brevo; and the notification_push queue (PRD 5.34): web push with
// the VAPID keys in Vault. Woken each minute by pg_cron (private.wake_notify_worker) with a bearer
// secret generated in the database; nothing else may call it.
import postgres from "npm:postgres@3.4.9";
import { dbFrom, jsonLog, safeEqual } from "../_shared/github/types.ts";
import { runPushWorker } from "../_shared/notify/push.ts";
import { notifyConfigFromEnv, runNotifyWorker } from "../_shared/notify/worker.ts";

const db = dbFrom(postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2 }));

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response(null, { status: 405 });
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return new Response(null, { status: 401 });
  const [row] = await db.query<{ secret: string }>(
    "select decrypted_secret as secret from vault.decrypted_secrets where name = 'notify_worker_secret'",
  );
  if (!row || !safeEqual(auth, `Bearer ${row.secret}`)) {
    return new Response(null, { status: 401 });
  }
  // Push needs no email provider: it runs first, whatever the email config says.
  const push = await runPushWorker({ db, fetch, log: jsonLog });
  let cfg;
  try {
    cfg = notifyConfigFromEnv((name) => Deno.env.get(name));
  } catch (error) {
    jsonLog("notify.worker", { outcome: "error", error_code: error instanceof Error ? error.message : "config" });
    return Response.json({ error: "not_configured", push }, { status: 503 });
  }
  return Response.json({ ...(await runNotifyWorker({ db, cfg, fetch, log: jsonLog })), push });
});
