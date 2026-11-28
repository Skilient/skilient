/**
 * Sending email through Azure Communication Services Email (decisions.md 2026-11-28, W9: replaces Brevo). The message
 * shape, the senders by category and the security types are the Brevo transport's (_shared/email/brevo.ts); the
 * request is ACS's `emails:send`, signed in with the container app's managed identity (no key anywhere). A retried
 * send carries the same `repeatability-request-id`, so Azure accepts it once, as Brevo's idempotency key did.
 */
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

export interface MailConfig {
  /** https://<resource>.communication.azure.com */
  endpoint: string;
  /** An Entra token for https://communication.azure.com (the managed identity's). */
  token(): Promise<string>;
}
export type SendResult =
  | { ok: true; id: string }
  | { ok: false; retry: "later" | "tomorrow" | "never"; name: string; status: number; uncertain?: boolean; waitSeconds?: number };

export const API_VERSION = "2023-03-31";

/** The request body (also what the delivery ledger fingerprints). */
export function mailBody(email: EmailMessage) {
  const sender = senderFor(email.category);
  return {
    senderAddress: sender.email,
    recipients: { to: [{ address: email.to }] },
    content: { subject: email.subject, html: email.html, plainText: email.text },
    replyTo: [{ address: sender.email, displayName: sender.name }],
  };
}

/** One send. No internal retry: the caller owns the queue's timing and the duplicate protection. */
export async function sendViaAcs(cfg: MailConfig, fetchImpl: typeof fetch, email: EmailMessage, key: string, firstSent: Date): Promise<SendResult> {
  let res: Response;
  let body: Record<string, unknown> = {};
  try {
    res = await fetchImpl(`${cfg.endpoint.replace(/\/$/, "")}/emails:send?api-version=${API_VERSION}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${await cfg.token()}`,
        "content-type": "application/json",
        "repeatability-request-id": key,
        "repeatability-first-sent": firstSent.toUTCString(),
      },
      body: JSON.stringify(mailBody(email)),
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
    const text = await res.text();
    if (text) {
      const parsed: unknown = JSON.parse(text);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
    }
  } catch {
    return { ok: false, retry: "later", name: "network_or_response_error", status: 0, uncertain: true };
  }
  if (res.status === 202 || res.status === 200) {
    const id = typeof body["id"] === "string" ? body["id"] : (res.headers.get("operation-location") ?? "");
    return { ok: true, id };
  }
  // Never log Azure's message: it can name the recipient.
  const err = (body["error"] ?? {}) as Record<string, unknown>;
  const name = typeof err["code"] === "string" && /^[A-Za-z_]{1,64}$/.test(err["code"]) ? err["code"] : "provider_error";
  if (res.status === 429) {
    const value = res.headers.get("retry-after");
    const waitSeconds = value && /^\d+$/.test(value) ? Math.min(86400, Math.max(1, Number(value))) : undefined;
    // Azure's daily sending quota answers 429 too; a long wait means tomorrow.
    if (waitSeconds !== undefined && waitSeconds >= 3600) return { ok: false, retry: "tomorrow", name, status: 429 };
    return { ok: false, retry: "later", name, status: 429, ...(waitSeconds ? { waitSeconds } : {}) };
  }
  if (res.status >= 500) return { ok: false, retry: "later", name, status: res.status, uncertain: true };
  return { ok: false, retry: "never", name, status: res.status };
}

/** The container app's managed identity token for ACS, cached until a minute before it expires. */
export function managedIdentityToken(env: NodeJS.ProcessEnv = process.env, doFetch: typeof fetch = fetch): () => Promise<string> {
  let cached: { value: string; until: number } | undefined;
  return async () => {
    if (cached && cached.until > Date.now()) return cached.value;
    const endpoint = env["IDENTITY_ENDPOINT"];
    const header = env["IDENTITY_HEADER"];
    if (!endpoint || !header) throw new Error("managed identity is not available (IDENTITY_ENDPOINT)");
    const url = new URL(endpoint);
    url.searchParams.set("resource", "https://communication.azure.com");
    url.searchParams.set("api-version", "2019-08-01");
    if (env["AZURE_CLIENT_ID"]) url.searchParams.set("client_id", env["AZURE_CLIENT_ID"]);
    const res = await doFetch(url, { headers: { "x-identity-header": header } });
    if (!res.ok) throw new Error(`managed identity token request failed: ${res.status}`);
    const b = (await res.json()) as { access_token: string; expires_on: string | number };
    cached = { value: b.access_token, until: Number(b.expires_on) * 1000 - 60_000 };
    return cached.value;
  };
}
