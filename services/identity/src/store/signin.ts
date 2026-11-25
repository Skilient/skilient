import { createHash, randomBytes } from "node:crypto";
import { refuse, uuidv7 } from "@skilient/platform";
import type postgres from "postgres";
import { captchaRequired, signinAccountKey, signinDelaySeconds, signinIpKey } from "../domain/signin";
import { rateLimit } from "./rate-limit";
import { revokeAllSessions } from "./sessions";

/**
 * Sign-in protection and security events, ported from `private.signin_status`, `signin_failed`,
 * `record_sign_in`, `security_not_me`, `log_security_event` and `purge_security_data`. Each runs inside the
 * caller's transaction; the handler that calls it owns the transaction and its events.
 */
type Tx = postgres.TransactionSql;

const HEX64 = /^[0-9a-f]{64}$/;
const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const ipOrNull = (ipHash: string | null | undefined) => (ipHash != null && HEX64.test(ipHash) ? ipHash : null);

async function recentFailures(tx: Tx, key: string): Promise<{ n: number; last: Date | null }> {
  const [row] = await tx<{ n: number; last: Date | null }[]>`
    select count(*)::int as n, max(created_at) as last from identity.auth_failures
     where key = ${key} and created_at > now() - interval '15 minutes'`;
  return row!;
}

/** `signin_status`: whether a captcha is needed and how long to wait, before a password is checked. */
export async function signinStatus(tx: Tx, email: string | null, ipHash: string | null) {
  const acct = await recentFailures(tx, signinAccountKey(email));
  const ipKey = signinIpKey(ipHash);
  const ip = ipKey ? await recentFailures(tx, ipKey) : { n: 0, last: null };
  let wait = 0;
  if (acct.n >= 10) {
    const [row] = await tx<{ wait: number }[]>`
      select greatest(0, ceil(extract(epoch from (${acct.last}::timestamptz + make_interval(secs => ${signinDelaySeconds(acct.n)}) - now()))))::int as wait`;
    wait = row!.wait;
  }
  return { failures: acct.n, captcha_required: captchaRequired(acct.n, ip.n), retry_after_seconds: wait };
}

/** `signin_failed`: counts a failed password, and alerts the account owner at ten failures (once an hour). */
export async function signinFailed(tx: Tx, email: string | null, ipHash: string | null) {
  const acctKey = signinAccountKey(email);
  const ipKey = signinIpKey(ipHash);
  await tx`insert into identity.auth_failures (key) values (${acctKey})`;
  if (ipKey) await tx`insert into identity.auth_failures (key) values (${ipKey})`;
  const acct = await recentFailures(tx, acctKey);
  const ip = ipKey ? await recentFailures(tx, ipKey) : { n: 0, last: null };
  const [user] = await tx<{ id: string }[]>`
    select id from identity.users where email = ${(email ?? "").replace(/^ +| +$/g, "").toLowerCase()} limit 1`;
  let notify = false;
  if (user) {
    await tx`insert into identity.security_events (id, user_id, kind, ip_hash) values (${uuidv7()}, ${user.id}, 'sign_in_failed', ${ipKey ? ipHash : null})`;
    if (acct.n >= 10) {
      const [recent] = await tx`
        select 1 from identity.security_events
         where user_id = ${user.id} and kind = 'sign_in_alert' and created_at > now() - interval '1 hour'`;
      if (!recent) {
        await tx`insert into identity.security_events (id, user_id, kind, ip_hash) values (${uuidv7()}, ${user.id}, 'sign_in_alert', ${ipKey ? ipHash : null})`;
        notify = true;
      }
    }
  }
  return { failures: acct.n, captcha_required: captchaRequired(acct.n, ip.n), retry_after_seconds: signinDelaySeconds(acct.n), notify };
}

const METHODS = new Set(["password", "otp", "magic_link", "google", "recovery"]);

/**
 * `record_sign_in`: remembers the device, logs the sign-in, clears the account's failures, and on a new
 * device (when the account had others) issues a one-time "this wasn't me" token for the alert email.
 */
export async function recordSignIn(tx: Tx, userId: string | null, deviceHash: string | null, ipHash: string | null, userAgent: string | null, method: string | null) {
  if (userId == null) throw refuse("not_signed_in", "not signed in");
  if (deviceHash == null || !HEX64.test(deviceHash)) throw refuse("invalid_input", "invalid device");
  if (method == null || !METHODS.has(method)) throw refuse("invalid_input", "invalid sign-in method");
  if (!(await rateLimit(tx, `record_sign_in:${userId}`, 30, 3600))) return { new_device: false, alert_token: null };
  const ip = ipOrNull(ipHash);
  const ua = userAgent == null ? null : userAgent.slice(0, 512);
  const [seen] = await tx<{ known: boolean; had: boolean }[]>`
    select exists (select 1 from identity.user_devices d where d.user_id = ${userId} and d.device_hash = ${deviceHash}) as known,
           exists (select 1 from identity.user_devices d where d.user_id = ${userId}) as had`;
  await tx`
    insert into identity.user_devices (user_id, device_hash, user_agent) values (${userId}, ${deviceHash}, ${ua})
    on conflict (user_id, device_hash) do update set last_seen_at = now(), user_agent = excluded.user_agent`;
  await tx`
    insert into identity.security_events (id, user_id, kind, ip_hash, user_agent, meta)
    values (${uuidv7()}, ${userId}, 'sign_in', ${ip}, ${ua}, ${JSON.stringify({ method, new_device: !seen!.known })}::text::jsonb)`;
  await tx`delete from identity.auth_failures where key = (select 'acct:' || encode(sha256(convert_to(email, 'UTF8')), 'hex') from identity.users where id = ${userId})`;
  let token: string | null = null;
  if (!seen!.known && seen!.had) {
    token = randomBytes(32).toString("hex");
    await tx`insert into identity.security_alert_tokens (token_hash, user_id) values (${sha256(token)}, ${userId})`;
    await tx`insert into identity.security_events (id, user_id, kind, ip_hash, user_agent) values (${uuidv7()}, ${userId}, 'new_device', ${ip}, ${ua})`;
  }
  return { new_device: !seen!.known, alert_token: token };
}

/**
 * `security_not_me`: the owner of an alert token says a sign-in was not them. Every session ends at once:
 * sessions are revoked and the token version is bumped, so services refuse the old tokens within a second.
 */
export async function securityNotMe(tx: Tx, token: string | null) {
  if (token == null || !HEX64.test(token)) return { ok: false };
  const [hit] = await tx<{ user_id: string }[]>`
    update identity.security_alert_tokens set used_at = now()
     where token_hash = ${sha256(token)} and used_at is null and expires_at > now()
    returning user_id`;
  if (!hit) return { ok: false };
  await revokeAllSessions(tx, hit.user_id, "not_me");
  const [user] = await tx<{ email: string }[]>`select email from identity.users where id = ${hit.user_id}`;
  await tx`insert into identity.security_events (id, user_id, kind) values (${uuidv7()}, ${hit.user_id}, 'not_me')`;
  return { ok: true, email: user!.email };
}

const EVENT_KINDS = new Set(["password_changed", "mfa_enrolled", "mfa_unenrolled", "signed_out_everywhere"]);

/** `log_security_event`: the few events the signed-in user's own actions record. */
export async function logSecurityEvent(tx: Tx, userId: string | null, kind: string, ipHash: string | null, userAgent: string | null): Promise<null> {
  if (userId == null) throw refuse("not_signed_in", "not signed in");
  if (!EVENT_KINDS.has(kind)) throw refuse("invalid_input", "invalid event kind");
  if (!(await rateLimit(tx, `security_event:${userId}`, 30, 3600))) return null;
  await tx`
    insert into identity.security_events (id, user_id, kind, ip_hash, user_agent)
    values (${uuidv7()}, ${userId}, ${kind}, ${ipOrNull(ipHash)}, ${userAgent == null ? null : userAgent.slice(0, 512)})`;
  return null;
}

/** `purge_security_data` (daily at 03:23 UTC): drops what is no longer needed. Returns the rows removed. */
export async function purgeSecurityData(tx: Tx): Promise<number> {
  let rows = 0;
  rows += (await tx`delete from platform.rate_limit_events where created_at < now() - interval '1 day'`).count;
  rows += (await tx`delete from identity.auth_failures where created_at < now() - interval '1 day'`).count;
  rows += (await tx`delete from identity.security_alert_tokens where expires_at < now() - interval '1 day'`).count;
  rows += (await tx`delete from identity.mfa_backup_codes where used_at < now() - interval '1 year'`).count;
  rows += (await tx`delete from identity.security_events where created_at < now() - interval '1 year'`).count;
  // Reset links live an hour; expired ones go with the rest (identity-only table, so no golden row to compare).
  rows += (await tx`delete from identity.password_reset_tokens where expires_at < now() - interval '1 day'`).count;
  return rows;
}

export const SCHEDULES = [{ name: "purge-security-data", cron: "23 3 * * *" }] as const;
