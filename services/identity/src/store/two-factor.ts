import { createHash, randomInt } from "node:crypto";
import { appendEvents, refuse, uuidv7 } from "@skilient/platform";
import type postgres from "postgres";
import { normalizeBackupCode } from "../domain/backup-codes";
import { base32Encode, decryptTotpSecret, encryptTotpSecret, generateTotpSecret, matchTotp, otpauthUri } from "../domain/totp";
import { rateLimit } from "./rate-limit";
import { bumpTokenVersion } from "./sessions";

/**
 * Two-factor: authenticators (TOTP) and backup codes. Ported from apps/web/lib/actions/mfa.ts (enrolment,
 * verification, removal, which Supabase Auth did) and `private.create_mfa_backup_codes`,
 * `delete_mfa_backup_codes` and `use_mfa_backup_code`. Each runs inside the handler's transaction.
 */
type Tx = postgres.TransactionSql;
export interface Actor {
  id: string;
  aal: "aal1" | "aal2";
}

/** Adding a second authenticator is allowed; more than this is almost certainly a mistake (as today). */
export const MAX_AUTHENTICATORS = 5;
const AAL2 = "two-factor session required";

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

async function verifiedCount(tx: Tx, userId: string): Promise<number> {
  const [row] = await tx<{ n: number }[]>`select count(*)::int as n from identity.totp_factors where user_id = ${userId} and status = 'verified'`;
  return row!.n;
}

/** Two-factor switched on or off for an account (ids and flags only). */
async function twoFactorChanged(tx: Tx, userId: string, on: boolean, reason: string): Promise<void> {
  await appendEvents(tx, [{ type: "user.two_factor_changed", subjects: [userId], payload: { on, reason } }]);
}

async function securityEvent(tx: Tx, userId: string, kind: string): Promise<void> {
  await tx`insert into identity.security_events (id, user_id, kind) values (${uuidv7()}, ${userId}, ${kind})`;
}

// ---------------------------------------------------------------------------
// Authenticators
// ---------------------------------------------------------------------------

/**
 * Starts enrolment: replaces any abandoned set-up and returns the new secret once. Adding a further
 * authenticator needs a two-factor session (as today).
 */
export async function enrollTotp(tx: Tx, key: Buffer, actor: Actor): Promise<{ factorId: string; secret: string; otpauthUri: string }> {
  if (!(await rateLimit(tx, `mfa_enroll:${actor.id}`, 10, 3600))) throw refuse("too_many", "rate limited");
  await tx`delete from identity.totp_factors where user_id = ${actor.id} and status = 'unverified'`;
  const verified = await verifiedCount(tx, actor.id);
  if (verified >= MAX_AUTHENTICATORS) throw refuse("precondition", "too_many_factors");
  if (verified > 0 && actor.aal !== "aal2") throw refuse("not_allowed", AAL2);
  const [user] = await tx<{ email: string }[]>`select email from identity.users where id = ${actor.id}`;
  if (!user) throw refuse("not_found", "account not found");
  const factorId = uuidv7();
  const secret = generateTotpSecret();
  const done = await tx`
    insert into identity.totp_factors (id, user_id, secret_ciphertext, status)
    values (${factorId}, ${actor.id}, ${encryptTotpSecret(key, secret, factorId)}, 'unverified')`;
  if (done.count !== 1) throw refuse("conflict", "enrolment in progress");
  const b32 = base32Encode(secret);
  return { factorId, secret: b32, otpauthUri: otpauthUri(b32, user.email) };
}

export type VerifyResult = { ok: true; factorId: string; enrolled: boolean } | { ok: false; reason: "invalid_code" | "rate_limited" };

/**
 * Checks an authenticator code. With a factor id it checks that factor (an unverified one finishes
 * enrolment); without one it checks every verified authenticator (the sign-in step). A wrong code, a
 * replayed step and the rate limit come back as `ok: false` so the caller commits the attempt and then refuses.
 */
export async function verifyTotp(tx: Tx, key: Buffer, actor: Actor, factorId: string | null, code: string, unixSeconds: number): Promise<VerifyResult> {
  if (!(await rateLimit(tx, `mfa_verify:${actor.id}`, 10, 900))) return { ok: false, reason: "rate_limited" };
  const factors = factorId
    ? await tx<{ id: string; secret_ciphertext: Buffer; status: string; last_used_step: string | null }[]>`
        select id, secret_ciphertext, status, last_used_step from identity.totp_factors
         where id = ${factorId} and user_id = ${actor.id} for update`
    : await tx<{ id: string; secret_ciphertext: Buffer; status: string; last_used_step: string | null }[]>`
        select id, secret_ciphertext, status, last_used_step from identity.totp_factors
         where user_id = ${actor.id} and status = 'verified' order by created_at, id for update`;
  if (factorId && factors.length === 0) throw refuse("not_found", "factor not found");
  if (!factorId && factors.length === 0) throw refuse("precondition", "no_factor");
  for (const f of factors) {
    const step = matchTotp(decryptTotpSecret(key, f.secret_ciphertext, f.id), code, unixSeconds, f.last_used_step == null ? null : Number(f.last_used_step));
    if (step === null) continue;
    const enrolled = f.status === "unverified";
    const done = await tx`
      update identity.totp_factors
         set last_used_step = ${step}, status = 'verified', verified_at = coalesce(verified_at, now())
       where id = ${f.id} and (last_used_step is null or last_used_step < ${step})`;
    if (done.count !== 1) return { ok: false, reason: "invalid_code" };
    if (enrolled) {
      await securityEvent(tx, actor.id, "mfa_enrolled");
      if ((await verifiedCount(tx, actor.id)) === 1) await twoFactorChanged(tx, actor.id, true, "enrolled");
    }
    return { ok: true, factorId: f.id, enrolled };
  }
  return { ok: false, reason: "invalid_code" };
}

/**
 * Removes an authenticator (two-factor session required). Removing the last one turns two-factor off: the
 * backup codes go and the account's sessions drop to aal1. The token version is bumped either way, since
 * the account's assurance changed.
 */
export async function removeTotp(tx: Tx, actor: Actor, factorId: string): Promise<void> {
  if (actor.aal !== "aal2") throw refuse("not_allowed", AAL2);
  const done = await tx`delete from identity.totp_factors where id = ${factorId} and user_id = ${actor.id}`;
  if (done.count !== 1) throw refuse("not_found", "factor not found");
  await securityEvent(tx, actor.id, "mfa_unenrolled");
  if ((await verifiedCount(tx, actor.id)) === 0) {
    await tx`delete from identity.totp_factors where user_id = ${actor.id}`;
    await tx`delete from identity.mfa_backup_codes where user_id = ${actor.id}`;
    await tx`update identity.sessions set aal = 'aal1' where user_id = ${actor.id} and revoked_at is null`;
    await twoFactorChanged(tx, actor.id, false, "removed");
  }
  await bumpTokenVersion(tx, actor.id, "mfa_removed");
}

// ---------------------------------------------------------------------------
// Backup codes (`private.mfa_backup_codes`): 10 single-use codes, xxxxx-xxxxx from an unambiguous
// alphabet, stored as sha256 of the normalised form.
// ---------------------------------------------------------------------------
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

function newBackupCode(): string {
  let code = "";
  for (let i = 0; i < 10; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

/** `create_mfa_backup_codes`: replaces the codes with 10 new ones, returned once (aal2 required). */
export async function createBackupCodes(tx: Tx, actor: Actor | null): Promise<string[]> {
  if (!actor || actor.aal !== "aal2") throw refuse("not_allowed", AAL2);
  if ((await verifiedCount(tx, actor.id)) === 0) throw refuse("precondition", "no_factor");
  if (!(await rateLimit(tx, `mfa_backup_codes:${actor.id}`, 10, 3600))) throw refuse("too_many", "rate limited");
  await tx`delete from identity.mfa_backup_codes where user_id = ${actor.id}`;
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const code = newBackupCode();
    codes.push(`${code.slice(0, 5)}-${code.slice(5)}`);
  }
  const done = await tx`
    insert into identity.mfa_backup_codes (user_id, code_hash)
    select ${actor.id}, h from unnest(${codes.map((c) => sha256(normalizeBackupCode(c)))}::text[]) as h`;
  if (done.count !== 10) throw refuse("conflict", "backup codes collided");
  await securityEvent(tx, actor.id, "mfa_backup_codes_created");
  return codes;
}

/**
 * `use_mfa_backup_code`: a password-verified session signs in with a backup code instead of the app. The
 * code is used up, the authenticators and the other codes are removed (two-factor is off until set up
 * again), and the use is logged. A wrong or used code returns false. At most 10 tries in 15 minutes.
 */
export async function useBackupCode(tx: Tx, userId: string, code: string): Promise<boolean> {
  if (!(await rateLimit(tx, `mfa_backup_use:${userId}`, 10, 900))) throw refuse("too_many", "rate limited");
  const used = await tx`
    update identity.mfa_backup_codes set used_at = now()
     where user_id = ${userId} and code_hash = ${sha256(normalizeBackupCode(code))} and used_at is null`;
  if (used.count === 0) return false;
  await tx`delete from identity.totp_factors where user_id = ${userId}`;
  await tx`delete from identity.mfa_backup_codes where user_id = ${userId} and used_at is null`;
  await securityEvent(tx, userId, "mfa_backup_code_used");
  await twoFactorChanged(tx, userId, false, "backup_code_used");
  return true;
}

/** `delete_mfa_backup_codes`; while an authenticator is on, it needs a two-factor session. */
export async function deleteBackupCodes(tx: Tx, actor: Actor): Promise<null> {
  if (actor.aal !== "aal2" && (await verifiedCount(tx, actor.id)) > 0) throw refuse("not_allowed", AAL2);
  await tx`delete from identity.mfa_backup_codes where user_id = ${actor.id}`;
  return null;
}
