import { createHash } from "node:crypto";
import type { Logger } from "@skilient/platform";

/**
 * Breached-password check (PRD 5.27; prd.md "Passwords": the breached-password check stays), ported from
 * apps/web/lib/security/hibp.ts. Have I Been Pwned's k-anonymity range API: only the first 5 hex characters
 * of the SHA-1 leave the service, with padded responses. Fails open (false) when the API is down or slow,
 * so a password change never hard-depends on it, as today.
 * IDENTITY_HIBP_URL points tests at a local fake; it defaults to the real API.
 */
export function hibpRangeUrl(): string {
  return process.env["IDENTITY_HIBP_URL"] ?? "https://api.pwnedpasswords.com/range/";
}

export async function isBreachedPassword(password: string, options: { fetch?: typeof fetch; logger?: Logger; baseUrl?: string } = {}): Promise<boolean> {
  const sha1 = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const res = await (options.fetch ?? fetch)(`${options.baseUrl ?? hibpRangeUrl()}${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "Skilient" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`http_${res.status}`);
    const text = await res.text();
    for (const line of text.split("\n")) {
      const [hashSuffix, count] = line.trim().split(":");
      if (hashSuffix === suffix && Number(count) > 0) return true;
    }
    return false;
  } catch (err) {
    options.logger?.warn("hibp.unavailable", { action: "hibp.check", outcome: "error", error_code: err instanceof Error ? err.message.slice(0, 60) : "unknown" });
    return false;
  }
}
