import { createHash } from "node:crypto";

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/** `private.signin_account_key`: failures are counted per account under a hash of the email, never the email. */
export function signinAccountKey(email: string | null | undefined): string {
  return `acct:${sha256((email ?? "").replace(/^ +| +$/g, "").toLowerCase())}`;
}

/** `private.signin_ip_key`: only a well-formed IP hash is counted. */
export function signinIpKey(ipHash: string | null | undefined): string | null {
  return ipHash != null && /^[0-9a-f]{64}$/.test(ipHash) ? `ip:${ipHash}` : null;
}

/** `private.signin_delay_seconds`: no wait below 10 failures, then 2, 4, 8 ... seconds, at most 60. */
export function signinDelaySeconds(failures: number): number {
  return failures < 10 ? 0 : Math.min(60, 2 ** Math.min(failures - 9, 6));
}

/** `signin_status` / `signin_failed`: a captcha after 3 account failures or 5 from one IP. */
export function captchaRequired(accountFailures: number, ipFailures: number): boolean {
  return accountFailures >= 3 || ipFailures >= 5;
}
