import type { Db } from "../github/types.ts";
import { brevoBody, sendViaBrevo, type BrevoConfig, type EmailMessage, type SendResult } from "./brevo.ts";

async function hash(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))))
    .map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** Stable UUID and opaque ledger key; no recipient or content is persisted in the ledger. */
export async function deliveryIdentity(key: string) {
  const digest = await hash(key);
  const uuid = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
  return { digest, uuid };
}

/** Durable acceptance plus a lease keeps queue redelivery safe beyond Brevo's 30-minute TTL.
 * Ambiguous sends can retry the same payload for 25 minutes only; afterwards manual reconciliation
 * is required. Definitive refusals (429/credits) release the reservation for a later attempt.
 */
export async function sendQueuedEmail(db: Db, cfg: BrevoConfig, fetchImpl: typeof fetch, email: EmailMessage, key: string): Promise<SendResult> {
  const { digest, uuid } = await deliveryIdentity(key);
  const fingerprint = await hash(JSON.stringify(brevoBody(email, uuid)));
  const [claim] = await db.query<{ state: string; message_id: string | null; claimed: boolean }>(
    "select * from private.claim_brevo_email($1, $2)", [digest, fingerprint],
  );
  if (claim?.state === "accepted") return { ok: true, id: claim.message_id ?? "" };
  if (!claim?.claimed) return {
    ok: false, retry: claim?.state === "uncertain" || claim?.state === "failed" ? "never" : "later",
    name: claim?.state === "uncertain" ? "delivery_needs_reconciliation" : "delivery_busy", status: 0,
  };
  const sent = await sendViaBrevo(cfg, fetchImpl, email, uuid);
  await db.query("select private.finish_brevo_email($1, $2, $3)", [
    digest, sent.ok ? "accepted" : sent.uncertain ? "pending" : sent.retry === "never" ? "failed" : "retryable",
    sent.ok ? sent.id : null,
  ]);
  return sent;
}
