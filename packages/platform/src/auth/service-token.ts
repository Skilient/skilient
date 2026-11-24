import { jwtVerify, SignJWT } from "jose";

/**
 * Service tokens name the caller (docs/azure/prd.md, "Typed calls"). HS256 with
 * one key per environment, held in Key Vault as `service-token-key`; `previous`
 * keeps calls working while the key rotates. Lifetime 60 s; signed tokens are
 * cached for 45 s per audience.
 */
export interface ServiceKeys {
  current: Uint8Array;
  previous?: Uint8Array;
}

const ISSUER_PREFIX = "skilient-service:";
const LIFETIME_S = 60;
const REUSE_MS = 45_000;

export function serviceKeysFrom(current: string, previous?: string): ServiceKeys {
  const decode = (v: string) => {
    const bytes = Buffer.from(v, "base64url");
    if (bytes.length < 32) throw new Error("service-token-key must be at least 32 bytes, base64url");
    return new Uint8Array(bytes);
  };
  return previous ? { current: decode(current), previous: decode(previous) } : { current: decode(current) };
}

export function createServiceSigner(keys: ServiceKeys, caller: string) {
  const cache = new Map<string, { token: string; until: number }>();
  return async (audience: string): Promise<string> => {
    const hit = cache.get(audience);
    const now = Date.now();
    if (hit && hit.until > now) return hit.token;
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(ISSUER_PREFIX + caller)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(`${LIFETIME_S}s`)
      .sign(keys.current);
    cache.set(audience, { token, until: now + REUSE_MS });
    return token;
  };
}

/** Returns the caller's name, or null when the token is missing, forged, expired or for another audience. */
export async function verifyServiceToken(keys: ServiceKeys, token: string, audience: string): Promise<string | null> {
  for (const key of keys.previous ? [keys.current, keys.previous] : [keys.current]) {
    try {
      const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"], audience, clockTolerance: 5 });
      if (typeof payload.iss === "string" && payload.iss.startsWith(ISSUER_PREFIX)) {
        const caller = payload.iss.slice(ISSUER_PREFIX.length);
        if (/^[a-z][a-z0-9-]{1,31}$/.test(caller)) return caller;
      }
      return null;
    } catch {
      // try the previous key
    }
  }
  return null;
}
