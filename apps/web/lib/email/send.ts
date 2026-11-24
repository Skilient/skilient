import "server-only";

import { logger } from "@/lib/log";
import { randomUUID } from "node:crypto";
import { sendViaBrevo, type EmailMessage } from "@/supabase/functions/_shared/email/brevo";

export type Email = EmailMessage;

/**
 * Direct application email through Brevo; Supabase Auth owns its separate SMTP path.
 * Direct sends have no automatic retries or queue, as before. Each invocation has its own UUID.
 */
export async function sendEmail(email: Email, requestId?: string): Promise<boolean> {
  const key = process.env.BREVO_API_KEY;
  if (!key) {
    logger.warn("email.skipped", { request_id: requestId, action: "email.send", outcome: "ok", error_code: "not_configured" });
    return false;
  }
  try {
    const sent = await sendViaBrevo({ apiKey: key, apiUrl: "https://api.brevo.com/v3" }, fetch, email, randomUUID());
    if (!sent.ok) throw new Error(sent.name);
    logger.info("email.sent", { request_id: requestId, action: "email.send", outcome: "ok" });
    return true;
  } catch (err) {
    logger.error("email.failed", {
      request_id: requestId,
      action: "email.send",
      outcome: "error",
      error_code: err instanceof Error ? err.message.slice(0, 60) : "unknown",
    });
    return false;
  }
}
