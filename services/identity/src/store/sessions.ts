import { createHmac, randomBytes } from "node:crypto";
import { appendEvents, refuse, TOKENS_REVOKED, uuidv7 } from "@skilient/platform";
import type postgres from "postgres";
import { ACCESS_TOKEN_SECONDS, type SigningKeys } from "../keys";

/**
 * Sessions (prd.md, "Sign-in and sessions"): a rotating refresh token, stored only as an HMAC with
 * `identity-refresh-pepper`; reuse of an old token ends the whole session. The access token lives
 * 10 minutes and carries the user's token version (`tv`), the session id (`sid`) and the gate flags.
 * Revocation (decision Q11): a local sign-out ends one session; signing out elsewhere or everywhere,
 * "not me", sanctions and role changes bump the token version.
 */
type Tx = postgres.TransactionSql;

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  sessionId: string;
  aal: "aal1" | "aal2";
}

export interface SessionContext {
  keys: SigningKeys;
  refreshPepper: string;
  gateFlags: (tx: Tx, userId: string) => Promise<Record<string, unknown>>;
}

const hashRefresh = (pepper: string, token: string) => createHmac("sha256", pepper).update(token).digest("hex");
const newRefresh = () => randomBytes(32).toString("base64url");

async function accessToken(tx: Tx, ctx: SessionContext, userId: string, sessionId: string, aal: "aal1" | "aal2"): Promise<string> {
  const [user] = await tx<{ token_version: number }[]>`select token_version from identity.users where id = ${userId}`;
  if (!user) throw refuse("not_found", "account not found");
  return ctx.keys.sign({ sub: userId, aal, tv: user.token_version, sid: sessionId, gate: await ctx.gateFlags(tx, userId) });
}

/** Opens a session for a user who has just proved who they are. */
export async function issueSession(
  tx: Tx,
  ctx: SessionContext,
  input: { userId: string; aal: "aal1" | "aal2"; userAgent?: string | null; ipHash?: string | null },
): Promise<SessionTokens> {
  const sessionId = uuidv7();
  await tx`
    insert into identity.sessions (id, user_id, aal, user_agent, ip_hash)
    values (${sessionId}, ${input.userId}, ${input.aal}, ${input.userAgent?.slice(0, 512) ?? null}, ${input.ipHash ?? null})`;
  const refreshToken = newRefresh();
  await tx`insert into identity.refresh_tokens (token_hash, session_id, family) values (${hashRefresh(ctx.refreshPepper, refreshToken)}, ${sessionId}, ${sessionId})`;
  await tx`update identity.users set last_sign_in_at = now(), updated_at = now() where id = ${input.userId}`;
  return { accessToken: await accessToken(tx, ctx, input.userId, sessionId, input.aal), refreshToken, expiresInSeconds: ACCESS_TOKEN_SECONDS, sessionId, aal: input.aal };
}

/** Raises an existing session to aal2 after a second factor, and returns fresh tokens for it. */
export async function stepUpSession(tx: Tx, ctx: SessionContext, userId: string, sessionId: string): Promise<SessionTokens> {
  const done = await tx`update identity.sessions set aal = 'aal2', last_seen_at = now() where id = ${sessionId} and user_id = ${userId} and revoked_at is null`;
  if (done.count !== 1) throw refuse("not_signed_in", "session_ended");
  await tx`update identity.refresh_tokens set used_at = now() where session_id = ${sessionId} and used_at is null`;
  const refreshToken = newRefresh();
  await tx`insert into identity.refresh_tokens (token_hash, session_id, family) values (${hashRefresh(ctx.refreshPepper, refreshToken)}, ${sessionId}, ${sessionId})`;
  return { accessToken: await accessToken(tx, ctx, userId, sessionId, "aal2"), refreshToken, expiresInSeconds: ACCESS_TOKEN_SECONDS, sessionId, aal: "aal2" };
}

/**
 * Rotates a refresh token. A token used before means it was stolen or replayed: the whole session ends
 * (returned as `{ reused: true }` so the caller commits that before refusing). A revoked session, a banned
 * account or an unknown token is refused.
 */
export async function refreshSession(tx: Tx, ctx: SessionContext, refreshToken: string): Promise<SessionTokens | { reused: true }> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(refreshToken)) throw refuse("not_signed_in", "refresh_token_invalid");
  const [row] = await tx<{ session_id: string; family: string; used_at: Date | null; user_id: string; aal: "aal1" | "aal2"; revoked_at: Date | null; banned: boolean }[]>`
    select r.session_id, r.family, r.used_at, s.user_id, s.aal, s.revoked_at,
           coalesce(u.banned_until > now(), false) as banned
      from identity.refresh_tokens r
      join identity.sessions s on s.id = r.session_id
      join identity.users u on u.id = s.user_id
     where r.token_hash = ${hashRefresh(ctx.refreshPepper, refreshToken)}
     for update of r, s`;
  if (!row || row.revoked_at) throw refuse("not_signed_in", "refresh_token_invalid");
  if (row.used_at) {
    // The caller commits this revocation and only then refuses: a rollback would keep the stolen session alive.
    await revokeSession(tx, row.user_id, row.session_id, "refresh_reused");
    return { reused: true };
  }
  if (row.banned) throw refuse("not_allowed", "account_banned");
  const next = newRefresh();
  const nextHash = hashRefresh(ctx.refreshPepper, next);
  await tx`update identity.refresh_tokens set used_at = now(), replaced_by = ${nextHash} where token_hash = ${hashRefresh(ctx.refreshPepper, refreshToken)}`;
  await tx`insert into identity.refresh_tokens (token_hash, session_id, family) values (${nextHash}, ${row.session_id}, ${row.family})`;
  await tx`update identity.sessions set last_seen_at = now() where id = ${row.session_id}`;
  return { accessToken: await accessToken(tx, ctx, row.user_id, row.session_id, row.aal), refreshToken: next, expiresInSeconds: ACCESS_TOKEN_SECONDS, sessionId: row.session_id, aal: row.aal };
}

/** Ends one session (a local sign-out): its refresh tokens stop working at once. */
export async function revokeSession(tx: Tx, userId: string, sessionId: string, reason: string): Promise<number> {
  const done = await tx`update identity.sessions set revoked_at = now() where id = ${sessionId} and user_id = ${userId} and revoked_at is null`;
  if (done.count) await appendEvents(tx, [{ type: "session.revoked", subjects: [userId], payload: { session_id: sessionId, reason } }]);
  return done.count;
}

/**
 * Ends every session of a user except `keep`, and bumps the token version so every service refuses the
 * user's older access tokens within a second (also the kept session's: its next refresh mints a new one).
 */
export async function revokeAllSessions(tx: Tx, userId: string, reason: string, keep: string | null = null): Promise<number> {
  await tx`update identity.sessions set revoked_at = now() where user_id = ${userId} and revoked_at is null and (${keep}::uuid is null or id <> ${keep}::uuid)`;
  return bumpTokenVersion(tx, userId, reason);
}

/** Bumps the token version and tells every service (event `user.tokens_revoked`). Returns the new version. */
export async function bumpTokenVersion(tx: Tx, userId: string, reason: string): Promise<number> {
  const [row] = await tx<{ token_version: number }[]>`
    update identity.users set token_version = token_version + 1, updated_at = now() where id = ${userId} returning token_version`;
  if (!row) throw refuse("not_found", "account not found");
  await appendEvents(tx, [{ type: TOKENS_REVOKED, subjects: [userId], payload: { tv: row.token_version, reason } }]);
  return row.token_version;
}
