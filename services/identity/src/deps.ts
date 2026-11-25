import type { ClientFactory, Logger } from "@skilient/platform";
import type postgres from "postgres";
import type { SigningKeys } from "./keys";

/**
 * What every identity handler module receives. Area modules (src/api/<area>.ts) take `ApiDeps` and return
 * their part of the contract; src/api/index.ts joins them.
 */
export interface ApiDeps {
  sql: postgres.Sql;
  keys: SigningKeys;
  logger: Logger;
  mailer: Mailer;
  clients: ClientFactory;
  /** Secret mixed into stored refresh-token hashes (Key Vault `identity-refresh-pepper`). */
  refreshPepper: string;
  /** 32-byte key that encrypts authenticator secrets (Key Vault `identity-totp-key`, base64url). */
  totpKey: Buffer;
  /** Gate flags carried in access tokens (decision Q1); set by the gate module, empty until then. */
  gateFlags: (tx: postgres.TransactionSql, userId: string) => Promise<Record<string, unknown>>;
  /** Google OAuth client (Google sign-in); undefined when not configured. */
  google?: { clientId: string; clientSecret: string; tokenUrl: string; jwksUrl: string; issuer: string };
  /** Cloudflare Turnstile secret; when absent outside production, captcha checks are skipped (as today). */
  turnstileSecret?: string;
}

// ---------------------------------------------------------------------------
// Mail (decision 2026-11-25, Q6): identity sends its own auth emails. Brevo in Azure, Mailpit locally,
// an in-memory outbox in tests. Codes and links never go into the event log or the logs.
// ---------------------------------------------------------------------------
export interface Email {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** What kind of auth email, for tests and metrics (never the code itself). */
  kind: "signup_code" | "signin_code" | "password_reset" | "new_device" | "sign_in_alert" | "mfa_reset" | "backup_code_used";
}

export interface Mailer {
  send(email: Email): Promise<void>;
}

/** Tests read what identity "sent" here. */
export const memoryOutbox: Email[] = [];
export const memoryMailer: Mailer = {
  async send(email) {
    memoryOutbox.push(email);
  },
};

const FROM = { email: "security@skilient.com", name: "Skilient" };

export function brevoMailer(apiKey: string, doFetch: typeof fetch = fetch): Mailer {
  return {
    async send(email) {
      const res = await doFetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ sender: FROM, to: [{ email: email.to }], subject: email.subject, textContent: email.text, htmlContent: email.html ?? undefined }),
      });
      if (!res.ok) throw new Error(`brevo_${res.status}`);
    },
  };
}

/** Local development: Mailpit's HTTP send API (the local Supabase stack runs one on 54324). */
export function mailpitMailer(baseUrl: string, doFetch: typeof fetch = fetch): Mailer {
  return {
    async send(email) {
      const res = await doFetch(`${baseUrl}/api/v1/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ From: { Email: FROM.email, Name: FROM.name }, To: [{ Email: email.to }], Subject: email.subject, Text: email.text, HTML: email.html ?? "" }),
      });
      if (!res.ok) throw new Error(`mailpit_${res.status}`);
    },
  };
}
