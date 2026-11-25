import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { uuidv7 } from "@skilient/platform";
import type postgres from "postgres";

/**
 * One-time email codes (PRD 5.27): six digits, 15 minutes, five tries. Only an HMAC of the code with
 * `identity-refresh-pepper` is stored, bound to the account and the purpose; a new code replaces any open
 * one of the same purpose ("use the newest one"). The code itself only ever travels in the email.
 */
type Tx = postgres.TransactionSql;
export type CodePurpose = "signup" | "signin";

export const CODE_TTL_SECONDS = 15 * 60;
export const CODE_MAX_ATTEMPTS = 5;
export const CODE_PATTERN = /^\d{6}$/;

const hashCode = (pepper: string, userId: string, purpose: CodePurpose, code: string) =>
  createHmac("sha256", pepper).update(`${purpose}:${userId}:${code}`).digest("hex");

/** A stable, non-reversible key for per-address rate limits (never the address itself). */
export const emailKey = (email: string) => createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("hex");

/** Issues a new code for the account and purpose; older open codes of that purpose stop working. */
export async function issueCode(tx: Tx, pepper: string, userId: string, purpose: CodePurpose): Promise<string> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await tx`update identity.email_codes set used_at = now() where user_id = ${userId} and purpose = ${purpose} and used_at is null`;
  await tx`
    insert into identity.email_codes (id, user_id, purpose, code_hash, expires_at)
    values (${uuidv7()}, ${userId}, ${purpose}, ${hashCode(pepper, userId, purpose, code)}, now() + make_interval(secs => ${CODE_TTL_SECONDS}))`;
  return code;
}

/**
 * Checks a code against the account's newest open code of that purpose. A wrong code counts a try (the
 * caller must commit before refusing, so the count survives); the right one is used up.
 */
export async function consumeCode(tx: Tx, pepper: string, userId: string, purpose: CodePurpose, code: string): Promise<boolean> {
  if (!CODE_PATTERN.test(code)) return false;
  const [open] = await tx<{ id: string; code_hash: string; attempts: number; expired: boolean }[]>`
    select id, code_hash, attempts, expires_at <= now() as expired from identity.email_codes
     where user_id = ${userId} and purpose = ${purpose} and used_at is null
     order by created_at desc limit 1
     for update`;
  if (!open || open.expired || open.attempts >= CODE_MAX_ATTEMPTS) return false;
  const want = Buffer.from(open.code_hash, "hex");
  const got = Buffer.from(hashCode(pepper, userId, purpose, code), "hex");
  if (!timingSafeEqual(want, got)) {
    await tx`update identity.email_codes set attempts = attempts + 1 where id = ${open.id}`;
    return false;
  }
  const used = await tx`update identity.email_codes set used_at = now() where id = ${open.id} and used_at is null`;
  return used.count === 1;
}
