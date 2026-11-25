/**
 * identity's contract on both transports (prd.md, "Typed calls"), against a real Postgres 17 with identity's
 * migrations and a generated signing key. Methods not built yet must answer Unimplemented, never succeed.
 */
import { join } from "node:path";
import { Code, ConnectError } from "@connectrpc/connect";
import { IdentityService, StaffRole } from "@skilient/contracts/identity/v1/identity_pb";
import { createUserTokenVerifier, refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { startPostgres, type TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, expect, it } from "vitest";
import { generateSigningKey, loadSigningKeys } from "../../src/keys";
import { contractEnv, testSecrets } from "./world";

const MIGRATIONS = join(import.meta.dirname, "../../migrations");
const STUDENT = "0190f0b2-0000-7000-8000-0000000000a1";
const STAFF = "0190f0b2-0000-7000-8000-0000000000a2";
const containers: TestDatabase[] = [];
let sql: postgres.Sql;
let signingKey: string;

contractEnv();

afterAll(async () => {
  await Promise.all(containers.map((c) => c.stop()));
});

describeTransports(
  ["identity"],
  (env) => {
    it("serves its public signing keys, and a token it signs verifies with them", async () => {
      if (env().transport !== "http2") return; // the HTTP/1.1 port exists only for a listening server
      const res = await fetch(`${env().http1Url}/.well-known/jwks.json`);
      expect(res.status).toBe(200);
      const jwks = (await res.json()) as { keys: { kid: string; d?: string }[] };
      expect(jwks.keys.map((k) => k.kid)).toEqual(["k1"]);
      expect(jwks.keys[0]!.d).toBeUndefined(); // never the private half
      const keys = await loadSigningKeys({ get: async () => signingKey }, "k1");
      const token = await keys.sign({ sub: STUDENT, aal: "aal1", tv: 3, sid: "s-1" });
      expect(await createUserTokenVerifier(jwks as never).verify(token)).toMatchObject({ id: STUDENT, tokenVersion: 3, sessionId: "s-1" });
    });

    it("SigninStatus answers a signed-out caller", async () => {
      const r = await env().client(IdentityService).signinStatus({ email: "a@golden-uni.test", ipHash: "" }, env().call());
      expect(r).toMatchObject({ failures: 0, captchaRequired: false, retryAfterSeconds: 0 });
    });

    it("StaffRolesOf reads many users in one call", async () => {
      const r = await env().client(IdentityService).staffRolesOf({ userIds: [STAFF, STUDENT] }, env().call());
      expect(r.users.map((u) => [u.userId, u.roles])).toEqual([
        [STAFF, [StaffRole.MODERATOR]],
        [STUDENT, []],
      ]);
      await expect(env().client(IdentityService).staffRolesOf({ userIds: ["nope"] }, env().call())).rejects.toSatisfy(
        (e) => refusalReason(e) === "invalid_input",
      );
    });

    it("LogSecurityEvent needs a signed-in user, records once per idempotency key", async () => {
      const client = env().client(IdentityService);
      await expect(client.logSecurityEvent({ kind: "password_changed" }, env().call())).rejects.toSatisfy(
        (e) => ConnectError.from(e).code === Code.Unauthenticated,
      );
      const userToken = await env().keys.userToken(STUDENT);
      const options = { ...env().call({ userToken }), headers: { "idempotency-key": `key-${env().transport}-0001` } };
      await client.logSecurityEvent({ kind: "password_changed", ipHash: "1".repeat(64) }, options);
      await client.logSecurityEvent({ kind: "password_changed", ipHash: "1".repeat(64) }, options);
      const [row] = await sql`select count(*)::int as n from identity.security_events where user_id = ${STUDENT} and kind = 'password_changed'`;
      expect(row?.["n"]).toBe(1);
      await expect(client.logSecurityEvent({ kind: "sign_in" }, { ...env().call({ userToken }), headers: { "idempotency-key": `key-${env().transport}-0002` } })).rejects.toSatisfy(
        (e) => refusalReason(e) === "invalid event kind",
      );
    });

    it("refuses a caller not on a method's list (web may not sanction)", async () => {
      await expect(env().client(IdentityService).sanctionUser({ userId: STUDENT, kind: "ban" }, env().call())).rejects.toSatisfy(
        (e) => refusalReason(e) === "caller_not_allowed",
      );
    });

    it("implements every method in the contract (none answers Unimplemented)", async () => {
      const { createApi } = await import("../../src/api");
      const api = createApi({} as never) as Record<string, unknown>;
      const missing = IdentityService.methods.filter((m) => typeof api[m.localName] !== "function").map((m) => m.name);
      expect(missing).toEqual([]);
    });
  },
  async () => {
    const pg = await startPostgres();
    containers.push(pg);
    sql = await pg.service("identity", MIGRATIONS);
    await sql`insert into identity.users (id, email) values (${STUDENT}, 'golden.student@golden-uni.test'), (${STAFF}, 'golden.mod@golden-uni.test')`;
    await sql`insert into identity.staff_roles (user_id, role) values (${STAFF}, 'moderator')`;
    signingKey ??= await generateSigningKey();
    return { database: () => sql, secrets: testSecrets(signingKey) };
  },
);
