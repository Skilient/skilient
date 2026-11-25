import { exportJWK, importJWK, SignJWT, type CryptoKey, type JSONWebKeySet, type JWK } from "jose";
import { USER_TOKEN_AUDIENCE, USER_TOKEN_ISSUER, type Secrets } from "@skilient/platform";

/**
 * User access tokens (prd.md, "Sign-in and sessions"): Ed25519 (EdDSA), 10 minutes, carrying the gate flags,
 * the token version (`tv`) and the session id (`sid`). Private keys are Key Vault secrets named
 * `identity-signing-key-<kid>`, holding a private JWK, and sign inside the service (decision 2026-11-25, Q10).
 * IDENTITY_SIGNING_KIDS lists the key ids, newest first: the first signs, all of them are published, so a
 * rotation adds a key, waits one token lifetime and only then drops the old one.
 */
export const ACCESS_TOKEN_SECONDS = 600;

export interface TokenClaims {
  sub: string;
  aal: "aal1" | "aal2";
  tv: number;
  sid: string;
  /** Gate flags for web (decision 2026-11-25, Q1): what it would otherwise ask for on every page. */
  gate?: Record<string, unknown>;
  /** A suspension or ban in force (decision 2026-11-25, W2 Q10); every service refuses writes while it lasts. */
  rst?: { kind: "suspend" | "ban"; until: string | null };
}

export interface SigningKeys {
  kid: string;
  sign(claims: TokenClaims): Promise<string>;
  jwks(): JSONWebKeySet;
}

export async function loadSigningKeys(secrets: Secrets, kidsVariable: string | undefined): Promise<SigningKeys> {
  const kids = (kidsVariable ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  if (kids.length === 0) throw new Error("IDENTITY_SIGNING_KIDS names no signing key");
  const published: JWK[] = [];
  let current: CryptoKey | undefined;
  for (const kid of kids) {
    const jwk = JSON.parse(await secrets.get(`identity-signing-key-${kid}`)) as JWK;
    if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || !jwk.d) throw new Error(`identity-signing-key-${kid} must be a private Ed25519 JWK`);
    const key = (await importJWK({ ...jwk, alg: "EdDSA" }, "EdDSA", { extractable: false })) as CryptoKey;
    current ??= key;
    const { d: _private, ...pub } = jwk;
    void _private;
    published.push({ ...pub, kid, alg: "EdDSA", use: "sig" });
  }
  const kid = kids[0]!;
  return {
    kid,
    sign: (claims) =>
      new SignJWT({ aal: claims.aal, tv: claims.tv, sid: claims.sid, ...(claims.gate ? { gate: claims.gate } : {}), ...(claims.rst ? { rst: claims.rst } : {}) })
        .setProtectedHeader({ alg: "EdDSA", kid })
        .setSubject(claims.sub)
        .setIssuer(USER_TOKEN_ISSUER)
        .setAudience(USER_TOKEN_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(`${ACCESS_TOKEN_SECONDS}s`)
        .sign(current!),
    jwks: () => ({ keys: published }),
  };
}

/** A new private signing key as a JWK, for tests and for the operator who creates the Key Vault secret. */
export async function generateSigningKey(): Promise<string> {
  const { privateKey } = await import("jose").then((j) => j.generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true }));
  return JSON.stringify(await exportJWK(privateKey));
}
