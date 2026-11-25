import { createLocalJWKSet, createRemoteJWKSet, jwtVerify, type JSONWebKeySet } from "jose";
import type { User } from "../context";
import { refuse } from "../errors";

/**
 * User access tokens are minted by `identity` (W1) and verified here, in every
 * service, against cached public keys. No service calls `identity` to check a
 * token (docs/azure/prd.md, "Typed calls").
 */
export const USER_TOKEN_ISSUER = "skilient-identity";
export const USER_TOKEN_AUDIENCE = "skilient";

export interface UserTokenVerifier {
  /** The verified user, or null when the token is invalid or expired. */
  verify(token: string): Promise<User | null>;
}

/** Where a verifier learns that a user's tokens below some version are revoked (see revocation.ts). */
export interface RevocationCheck {
  isRevoked(userId: string, tokenVersion: number): boolean;
}

export function createUserTokenVerifier(keys: JSONWebKeySet | URL, options: { revocations?: RevocationCheck } = {}): UserTokenVerifier {
  const keySet = keys instanceof URL ? createRemoteJWKSet(keys, { cacheMaxAge: 10 * 60_000 }) : createLocalJWKSet(keys);
  return {
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, keySet, {
          issuer: USER_TOKEN_ISSUER,
          audience: USER_TOKEN_AUDIENCE,
          algorithms: ["EdDSA", "ES256"],
          clockTolerance: 5,
        });
        if (typeof payload.sub !== "string" || payload.sub.length === 0) return null;
        const tv = typeof payload["tv"] === "number" && Number.isInteger(payload["tv"]) ? payload["tv"] : 0;
        if (options.revocations?.isRevoked(payload.sub, tv)) return null;
        const sid = typeof payload["sid"] === "string" ? payload["sid"] : undefined;
        const restriction = restrictionOf(payload["rst"]);
        return { id: payload.sub, aal: payload["aal"] === "aal2" ? "aal2" : "aal1", tokenVersion: tv, ...(sid ? { sessionId: sid } : {}), ...(restriction ? { restriction } : {}) };
      } catch {
        return null;
      }
    },
  };
}

/** Refuses every token: used until `identity` publishes its keys. */
export const noUserTokens: UserTokenVerifier = { verify: async () => null };

/** The `rst` claim (decision 2026-11-25, W2 Q10): a suspension or ban, ignored once its end has passed. */
export function restrictionOf(claim: unknown, now = Date.now()): User["restriction"] | undefined {
  if (!claim || typeof claim !== "object") return undefined;
  const { kind, until } = claim as { kind?: unknown; until?: unknown };
  if (kind !== "suspend" && kind !== "ban") return undefined;
  if (until != null && (typeof until !== "string" || !(Date.parse(until) > now))) return undefined;
  return { kind, until: (until as string | null | undefined) ?? null };
}

/** Today's wording from `private.refuse_if_restricted`. */
export const RESTRICTED = "your account is suspended, so you can only read, appeal or delete your account";

/**
 * `refuse_if_restricted`: a suspended or banned user may read, appeal or delete their account, and create
 * nothing. Call it in every command that writes what the trigger guarded (the restriction is the token's).
 */
export function refuseIfRestricted(user: User | null): void {
  if (user?.restriction && restrictionOf(user.restriction) !== undefined) throw refuse("not_allowed", RESTRICTED);
}
