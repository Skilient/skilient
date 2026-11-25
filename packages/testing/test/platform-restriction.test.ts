/**
 * The restriction claim (decision 2026-11-25, advisor, W2 Q10): identity puts an active suspension or ban in
 * the access token as `rst`, every service's verifier reads it into `User.restriction`, and
 * `refuseIfRestricted` refuses writes with today's wording from `private.refuse_if_restricted`.
 */
import { Code, ConnectError } from "@connectrpc/connect";
import { createUserTokenVerifier, refuseIfRestricted, refusalReason, restrictionOf, RESTRICTED, USER_TOKEN_AUDIENCE, USER_TOKEN_ISSUER } from "@skilient/platform";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, it } from "vitest";

describe("restriction claim", async () => {
  const { privateKey, publicKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const jwk = { ...(await exportJWK(publicKey)), kid: "t1", alg: "EdDSA" };
  const verifier = createUserTokenVerifier({ keys: [jwk] });
  const token = (extra: Record<string, unknown>) =>
    new SignJWT({ aal: "aal1", tv: 0, ...extra })
      .setProtectedHeader({ alg: "EdDSA", kid: "t1" })
      .setSubject("0190f0b2-0000-7000-8000-000000000001")
      .setIssuer(USER_TOKEN_ISSUER)
      .setAudience(USER_TOKEN_AUDIENCE)
      .setExpirationTime("5m")
      .sign(privateKey);

  it("reads a suspension with an end, a ban without one, and nothing else", async () => {
    const until = new Date(Date.now() + 3_600_000).toISOString();
    expect((await verifier.verify(await token({ rst: { kind: "suspend", until } })))?.restriction).toEqual({ kind: "suspend", until });
    expect((await verifier.verify(await token({ rst: { kind: "ban", until: null } })))?.restriction).toEqual({ kind: "ban", until: null });
    expect((await verifier.verify(await token({})))?.restriction).toBeUndefined();
    expect((await verifier.verify(await token({ rst: { kind: "warn", until: null } })))?.restriction).toBeUndefined();
    expect((await verifier.verify(await token({ rst: { kind: "suspend", until: new Date(Date.now() - 1000).toISOString() } })))?.restriction).toBeUndefined();
    expect(restrictionOf({ kind: "suspend", until: "not a date" })).toBeUndefined();
  });

  it("refuseIfRestricted refuses a restricted user with today's wording and lets others through", () => {
    const user = { id: "u", aal: "aal1" as const };
    expect(() => refuseIfRestricted(user)).not.toThrow();
    expect(() => refuseIfRestricted(null)).not.toThrow();
    try {
      refuseIfRestricted({ ...user, restriction: { kind: "suspend", until: new Date(Date.now() + 60_000).toISOString() } });
      expect.unreachable();
    } catch (e) {
      expect([ConnectError.from(e).code, refusalReason(e)]).toEqual([Code.PermissionDenied, RESTRICTED]);
    }
    // A suspension that ended while the token was still valid no longer refuses.
    expect(() => refuseIfRestricted({ ...user, restriction: { kind: "suspend", until: new Date(Date.now() - 1).toISOString() } })).not.toThrow();
  });
});
