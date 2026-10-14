/** Shared Node/Deno transport. Category, never the runtime, chooses the sender. */
export type EmailCategory = "security" | "notification";
export interface EmailMessage {
  category: EmailCategory;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export function senderFor(category: EmailCategory) {
  return { name: "Skilient", email: category === "security" ? "security@skilient.com" : "notify@skilient.com" };
}

/** Account events protect access, identity and account state; other product updates are notifications. */
export function notificationEmailCategory(type: string): EmailCategory {
  return SECURITY_NOTIFICATION_TYPES.has(type) ? "security" : "notification";
}
export const SECURITY_NOTIFICATION_TYPES = new Set([
  "content_removed", "moderation_warning", "deletion_requested", "deletion_cancelled",
  "content_hidden_by_university", "content_restored", "account_restricted", "restriction_lifted",
  "org_sanctioned", "appeal_decided", "account_viewed", "mfa_reset",
]);

export interface BrevoConfig { apiKey: string; apiUrl: string }
export type SendResult =
  | { ok: true; id: string }
  | { ok: false; retry: "later" | "tomorrow" | "never"; name: string; status: number; uncertain?: boolean; waitSeconds?: number };

export function brevoBody(email: EmailMessage, idempotencyKey: string) {
  const sender = senderFor(email.category);
  return {
    sender,
    replyTo: sender,
    subject: email.subject,
    htmlContent: email.html,
    textContent: email.text,
    // A one-version batch uses Brevo's documented batch idempotency mechanism.
    messageVersions: [{ to: [{ email: email.to }] }],
    headers: { idempotencyKey },
  };
}

/** No internal retry: the caller owns queue visibility and durable duplicate protection. */
export async function sendViaBrevo(cfg: BrevoConfig, fetchImpl: typeof fetch, email: EmailMessage, key: string): Promise<SendResult> {
  let res: Response;
  let body: Record<string, unknown>;
  try {
    res = await fetchImpl(`${cfg.apiUrl}/smtp/email`, {
      method: "POST",
      headers: { "api-key": cfg.apiKey, accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(brevoBody(email, key)),
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
    const parsed: unknown = await res.json();
    body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return { ok: false, retry: "later", name: "network_or_response_error", status: 0, uncertain: true };
  }
  if (res.ok) {
    const id = typeof body.messageId === "string" ? body.messageId : Array.isArray(body.messageIds) ? body.messageIds[0] : undefined;
    if (typeof id !== "string" || !id) return { ok: false, retry: "later", name: "missing_message_id", status: res.status, uncertain: true };
    return { ok: true, id };
  }
  // Do not log provider messages: they can include recipient addresses or submitted content.
  const name = typeof body.code === "string" && /^[a-z_]{1,64}$/.test(body.code) ? body.code : "provider_error";
  if (name === "duplicate_parameter" && typeof body.message === "string" && /idempotency/i.test(body.message)) {
    return { ok: true, id: "" }; // same UUID accepted within the provider's window
  }
  if (name === "not_enough_credits") return { ok: false, retry: "tomorrow", name, status: res.status };
  if (res.status === 429) {
    const value = res.headers.get("retry-after") ?? res.headers.get("x-sib-ratelimit-reset");
    const waitSeconds = value && /^\d+$/.test(value) ? Math.min(86400, Math.max(1, Number(value))) : undefined;
    return { ok: false, retry: "later", name, status: res.status, waitSeconds };
  }
  if (res.status >= 500) return { ok: false, retry: "later", name, status: res.status, uncertain: true };
  return { ok: false, retry: "never", name, status: res.status };
}
