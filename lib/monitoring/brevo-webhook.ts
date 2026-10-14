import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type EmailSignal = "email_delivered" | "email_bounced";

/** Brevo supports webhook auth.type=bearer. This is an independent shared secret, not an API key or Svix signature. */
export function verifyBrevoAuthorization(headers: Headers, secret: string): boolean {
  if (secret.length < 32) return false;
  const given = headers.get("authorization") ?? "";
  return timingSafeEqual(
    createHash("sha256").update(given).digest(),
    createHash("sha256").update(`Bearer ${secret}`).digest(),
  );
}

export async function handleBrevoWebhook(opts: {
  rawBody: string;
  headers: Headers;
  secret: string | undefined;
  record: (signal: EmailSignal, eventKey: string) => Promise<void>;
}): Promise<{ status: number; outcome: "ok" | "refused" | "ignored" }> {
  if (!opts.secret) return { status: 404, outcome: "refused" };
  if (!verifyBrevoAuthorization(opts.headers, opts.secret)) return { status: 401, outcome: "refused" };
  let parsed: unknown;
  try { parsed = JSON.parse(opts.rawBody); } catch { return { status: 400, outcome: "refused" }; }
  // Configure unbatched transactional email webhooks. Reject malformed shapes before writes.
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { status: 400, outcome: "refused" };
  const event = parsed as Record<string, unknown>;
  const signal: EmailSignal | undefined = event.event === "delivered" ? "email_delivered" : event.event === "hard_bounce" ? "email_bounced" : undefined;
  if (!signal) return { status: 200, outcome: "ignored" };
  if (typeof event["message-id"] !== "string" || !event["message-id"] || event["message-id"].length > 1000 ||
      typeof event.email !== "string" || !event.email.includes("@") || event.email.length > 254) {
    return { status: 400, outcome: "refused" };
  }
  // One delivery / final bounce per message and recipient. No recipient, content, IP or token retained.
  const eventKey = createHmac("sha256", opts.secret)
    .update(JSON.stringify([signal, event["message-id"], event.email.trim().toLowerCase()])).digest("hex");
  await opts.record(signal, eventKey);
  return { status: 200, outcome: "ok" };
}
