import { createHash, randomBytes } from "node:crypto";
import { refuse, uuidv7 } from "@skilient/platform";
import type postgres from "postgres";
import { hashPassword, verifyPassword } from "../domain/password";
import { rateLimit } from "./rate-limit";
import { revokeAllSessions } from "./sessions";

/**
 * Passwords: change (Settings -> Security) and reset by email link. Ported from apps/web/lib/actions/auth.ts
 * (`changePassword`, `requestPasswordReset`, `resetPassword`), where Supabase Auth held the hash. New hashes
 * are Argon2id. Each runs inside the handler's transaction.
 */
type Tx = postgres.TransactionSql;

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;
/** Reset tokens: 32 random bytes, base64url (43 characters). */
export const RESET_TOKEN = /^[A-Za-z0-9_-]{43}$/;

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/** Length rules for a new password (PRD 5.27); the breached check is separate. */
export function newPasswordProblem(password: string): "password_too_short" | "password_too_long" | null {
  if (password.length < PASSWORD_MIN) return "password_too_short";
  if (password.length > PASSWORD_MAX) return "password_too_long";
  return null;
}

/** Sets an Argon2id hash, adding the credential when the account had none (Google-only accounts). */
async function setPassword(tx: Tx, userId: string, password: string): Promise<void> {
  const hash = await hashPassword(password);
  const done = await tx`
    insert into identity.password_credentials (user_id, hash, algorithm, imported, updated_at)
    values (${userId}, ${hash}, 'argon2id', false, now())
    on conflict (user_id) do update set hash = excluded.hash, algorithm = 'argon2id', imported = false, updated_at = now()`;
  if (done.count !== 1) throw refuse("not_found", "account not found");
}

export type ChangeCheck = { ok: true } | { ok: false; reason: "rate_limited" | "wrong_password" };

/**
 * First half of a password change: counts the attempt (5 per 15 minutes per account) and checks the current
 * password. A refusal is returned, not thrown, so the caller commits the counted attempt before refusing.
 */
export async function checkCurrentPassword(tx: Tx, userId: string, current: string): Promise<ChangeCheck> {
  if (!(await rateLimit(tx, `password_change:${userId}`, 5, 900))) return { ok: false, reason: "rate_limited" };
  const [row] = await tx<{ hash: string }[]>`select hash from identity.password_credentials where user_id = ${userId} for update`;
  if (!row || !(await verifyPassword(row.hash, current))) return { ok: false, reason: "wrong_password" };
  return { ok: true };
}

/**
 * Second half: the new password is set, every session ends and the token version is bumped (a password
 * change ends every other session, PRD 10; decision Q11). The caller opens a fresh session for this device.
 */
export async function applyNewPassword(tx: Tx, userId: string, password: string, reason: "password_changed" | "password_reset"): Promise<void> {
  await setPassword(tx, userId, password);
  await revokeAllSessions(tx, userId, reason);
  await tx`insert into identity.security_events (id, user_id, kind) values (${uuidv7()}, ${userId}, 'password_changed')`;
}

/**
 * A reset link for `email`. Returns the token to mail, or null when there is no such account; the caller
 * answers the same either way. At most 3 per hour per address (keyed by its hash), counted for unknown
 * addresses too so the limit reveals nothing. A new link replaces the account's earlier ones.
 */
export async function createResetToken(tx: Tx, email: string): Promise<{ token: string } | null> {
  if (!(await rateLimit(tx, `reset_email:${sha256(email)}`, 3, 3600))) throw refuse("too_many", "rate_limited");
  const [user] = await tx<{ id: string }[]>`select id from identity.users where email = ${email}`;
  if (!user) return null;
  await tx`delete from identity.password_reset_tokens where user_id = ${user.id}`;
  const token = randomBytes(32).toString("base64url");
  const done = await tx`insert into identity.password_reset_tokens (token_hash, user_id) values (${sha256(token)}, ${user.id})`;
  if (done.count !== 1) throw refuse("conflict", "reset link collided");
  return { token };
}

/** Uses up a reset token (one hour, single use). Returns the account, or refuses an expired or unknown link. */
export async function consumeResetToken(tx: Tx, token: string): Promise<string> {
  if (!RESET_TOKEN.test(token)) throw refuse("precondition", "reset_link_expired");
  const [row] = await tx<{ user_id: string; banned: boolean }[]>`
    update identity.password_reset_tokens r set used_at = now()
      from identity.users u
     where r.token_hash = ${sha256(token)} and r.used_at is null and r.expires_at > now() and u.id = r.user_id
    returning r.user_id, coalesce(u.banned_until > now(), false) as banned`;
  if (!row) throw refuse("precondition", "reset_link_expired");
  if (row.banned) throw refuse("not_allowed", "account_banned");
  // The link reached the mailbox, which proves the address (as Supabase's recovery link did).
  await tx`update identity.users set email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = ${row.user_id}`;
  return row.user_id;
}
