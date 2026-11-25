import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendEvents, createRevocationCache, createUserTokenVerifier, TOKENS_REVOKED, USER_TOKEN_AUDIENCE, USER_TOKEN_ISSUER } from "@skilient/platform";
import { exportJWK, generateKeyPair, SignJWT, type JSONWebKeySet } from "jose";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startPostgres, type TestDatabase } from "../src/postgres";

/** Token-version revocation (prd.md, identity: revocation) through the event log, against Postgres 17. */
describe("token-version revocation", () => {
  let pg: TestDatabase;
  let identity: postgres.Sql;
  let reader: postgres.Sql;
  let jwks: JSONWebKeySet;
  let mint: (sub: string, tv: number) => Promise<string>;
  const USER = "0190f0b2-0000-7000-8000-000000000001";
  const OTHER = "0190f0b2-0000-7000-8000-000000000002";

  beforeAll(async () => {
    pg = await startPostgres();
    identity = await pg.service("idp", mkdtempSync(join(tmpdir(), "mig-")));
    reader = await pg.service("reader", mkdtempSync(join(tmpdir(), "mig-")));
    const { publicKey, privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519" });
    jwks = { keys: [{ ...(await exportJWK(publicKey)), kid: "k1", alg: "EdDSA", use: "sig" }] };
    mint = (sub, tv) =>
      new SignJWT({ aal: "aal1", tv, sid: "s-1" })
        .setProtectedHeader({ alg: "EdDSA", kid: "k1" })
        .setSubject(sub)
        .setIssuer(USER_TOKEN_ISSUER)
        .setAudience(USER_TOKEN_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime("10m")
        .sign(privateKey);
  }, 120_000);
  afterAll(async () => {
    await pg?.stop();
  });

  const bump = (user: string, tv: number) =>
    identity.begin((tx) => appendEvents(tx, [{ type: TOKENS_REVOKED, subjects: [user], payload: { tv } }]));

  it("a bump makes a running service refuse older tokens within a second", async () => {
    const cache = createRevocationCache({ sql: reader, pollMs: 60_000 });
    await cache.start();
    const verifier = createUserTokenVerifier(jwks, { revocations: cache });
    const old = await mint(USER, 0);
    expect(await verifier.verify(old)).toMatchObject({ id: USER, tokenVersion: 0, sessionId: "s-1" });
    const t0 = Date.now();
    await bump(USER, 1);
    while ((await verifier.verify(old)) !== null && Date.now() - t0 < 3_000) await new Promise((r) => setTimeout(r, 10));
    expect(Date.now() - t0).toBeLessThan(1_000);
    expect(await verifier.verify(old)).toBeNull();
    expect(await verifier.verify(await mint(USER, 1))).toMatchObject({ id: USER, tokenVersion: 1 }); // a token minted after the bump
    expect(await verifier.verify(await mint(OTHER, 0))).toMatchObject({ id: OTHER }); // nobody else is affected
    await cache.stop();
  });

  it("a service that starts after the bump still refuses (it reads the last eleven minutes)", async () => {
    await bump(OTHER, 3);
    const cold = createRevocationCache({ sql: reader });
    await cold.start();
    expect(cold.floor(OTHER)).toBe(3);
    const verifier = createUserTokenVerifier(jwks, { revocations: cold });
    expect(await verifier.verify(await mint(OTHER, 2))).toBeNull();
    expect(await verifier.verify(await mint(OTHER, 3))).not.toBeNull();
    await cold.stop();
  });

  it("a token without tv counts as version 0", async () => {
    const verifier = createUserTokenVerifier(jwks);
    expect(await verifier.verify(await mint(USER, 0))).toMatchObject({ tokenVersion: 0 });
  });
});
