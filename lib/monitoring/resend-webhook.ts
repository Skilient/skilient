import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Resend delivery webhooks (PRD 10 "Email: bounce rate above 5% over a day"). Resend signs with Svix:
 * HMAC-SHA256 over `${svix-id}.${svix-timestamp}.${body}` with the base64 secret after `whsec_`,
 * sent as `svix-signature: v1,<base64> [v1,<base64> …]`. A timestamp more than 5 minutes off is refused.
 */
export type EmailSignal = "email_delivered" | "email_bounced";

const TOLERANCE_S = 300;
const SIGNALS: Record<string, EmailSignal> = { "email.delivered": "email_delivered", "email.bounced": "email_bounced" };

export function verifySvix(rawBody: string, headers: Headers, secret: string, nowMs = Date.now()): boolean {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature");
  if (!id || !timestamp || !signatures || !/^\d{1,12}$/.test(timestamp)) return false;
  if (Math.abs(nowMs / 1000 - Number(timestamp)) > TOLERANCE_S) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  if (key.length === 0) return false;
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest();
  return signatures.split(" ").some((part) => {
    const [version, value] = part.split(",", 2);
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export interface ResendWebhookOutcome {
  status: number;
  outcome: "ok" | "refused" | "ignored";
  signal?: EmailSignal;
}

/** Verify, then turn a delivery or bounce into a signal; every other event type is acknowledged and ignored. */
export async function handleResendWebhook(opts: {
  rawBody: string;
  headers: Headers;
  secret: string | undefined;
  record: (signal: EmailSignal) => Promise<void>;
  nowMs?: number;
}): Promise<ResendWebhookOutcome> {
  if (!opts.secret) return { status: 404, outcome: "refused" };
  if (!verifySvix(opts.rawBody, opts.headers, opts.secret, opts.nowMs)) return { status: 401, outcome: "refused" };
  let type: unknown;
  try {
    type = (JSON.parse(opts.rawBody) as { type?: unknown }).type;
  } catch {
    return { status: 400, outcome: "refused" };
  }
  const signal = typeof type === "string" ? SIGNALS[type] : undefined;
  if (!signal) return { status: 200, outcome: "ignored" };
  await opts.record(signal);
  return { status: 200, outcome: "ok", signal };
}
