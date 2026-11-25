import { createLocalJWKSet, createRemoteJWKSet, jwtVerify, type JSONWebKeySet } from "jose";
import type { User } from "../context";

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
        return { id: payload.sub, aal: payload["aal"] === "aal2" ? "aal2" : "aal1", tokenVersion: tv, ...(sid ? { sessionId: sid } : {}) };
      } catch {
        return null;
      }
    },
  };
}

/** Refuses every token: used until `identity` publishes its keys. */
export const noUserTokens: UserTokenVerifier = { verify: async () => null };
