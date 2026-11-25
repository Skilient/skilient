import { refuse } from "@skilient/platform";

/**
 * Cloudflare Turnstile, checked when sign-in protection asks for it (3 account failures or 5 from one IP).
 * Without a secret the check is skipped outside production, as the current app does; in production a
 * missing secret refuses (SKILIENT_ENV=production).
 */
export async function requireCaptcha(secret: string | undefined, token: string, ipHash: string | null, doFetch: typeof fetch = fetch): Promise<void> {
  if (!secret) {
    if (process.env["SKILIENT_ENV"] === "production") throw refuse("unavailable", "captcha_unavailable");
    return;
  }
  if (!token) throw refuse("precondition", "captcha_required");
  const body = new URLSearchParams({ secret, response: token });
  void ipHash; // Turnstile takes the raw IP, which identity never sees; the token alone is checked.
  const res = await doFetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(3000) }).catch(
    () => null,
  );
  if (!res?.ok) throw refuse("unavailable", "captcha_unavailable");
  const result = (await res.json()) as { success?: boolean };
  if (!result.success) throw refuse("precondition", "captcha_invalid");
}

/** The address identity's emails link to (the web app), from IDENTITY_APP_URL. */
export function appUrl(): string {
  return (process.env["IDENTITY_APP_URL"] ?? "http://127.0.0.1:3000").replace(/\/$/, "");
}
