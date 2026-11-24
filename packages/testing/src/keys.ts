import { randomBytes } from "node:crypto";
import { exportJWK, generateKeyPair, SignJWT, type JSONWebKeySet } from "jose";
import {
  createUserTokenVerifier,
  serviceKeysFrom,
  USER_TOKEN_AUDIENCE,
  USER_TOKEN_ISSUER,
  type ServiceKeys,
  type UserTokenVerifier,
} from "@skilient/platform";

export interface TestKeys {
  serviceKeySecret: string;
  keys: ServiceKeys;
  jwks: JSONWebKeySet;
  users: UserTokenVerifier;
  /** A user access token as `identity` will mint it. */
  userToken(userId: string, options?: { aal?: "aal1" | "aal2"; expiresIn?: string; issuer?: string }): Promise<string>;
}

/** Fresh keys for one test file: a service-token key and an Ed25519 user-token key pair. */
export async function testKeys(): Promise<TestKeys> {
  const serviceKeySecret = randomBytes(32).toString("base64url");
  const { publicKey, privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519" });
  const jwk = { ...(await exportJWK(publicKey)), kid: "test", alg: "EdDSA", use: "sig" };
  const jwks: JSONWebKeySet = { keys: [jwk] };
  return {
    serviceKeySecret,
    keys: serviceKeysFrom(serviceKeySecret),
    jwks,
    users: createUserTokenVerifier(jwks),
    userToken: (userId, options = {}) =>
      new SignJWT({ aal: options.aal ?? "aal1" })
        .setProtectedHeader({ alg: "EdDSA", kid: "test" })
        .setSubject(userId)
        .setIssuer(options.issuer ?? USER_TOKEN_ISSUER)
        .setAudience(USER_TOKEN_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(options.expiresIn ?? "5m")
        .sign(privateKey),
  };
}
