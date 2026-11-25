/**
 * Sign-in and sessions on both transports (step 5): password sign-in with failure counting, bcrypt rehash to
 * Argon2id, refresh rotation with reuse detection, and the three sign-out scopes (decision Q11).
 */
import bcrypt from "bcryptjs";
import { Code, ConnectError } from "@connectrpc/connect";
import { IdentityService, SignOutScope } from "@skilient/contracts/identity/v1/identity_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, expect, it } from "vitest";
import { memoryOutbox } from "../../src/deps";
import { createUser, DEVICE, identityWorld, IP, stopWorlds, type World } from "./world";

const worlds: World[] = [];
let world: World;
afterAll(() => stopWorlds(worlds));

const reason = (e: unknown) => refusalReason(e) ?? `code ${ConnectError.from(e).code}`;

describeTransports(
  ["identity"],
  (env) => {
    const id = () => env().client(IdentityService);
    const signIn = (email: string, password: string, device = DEVICE) =>
      id().signInPassword({ email, password, deviceHash: device, ipHash: IP, userAgent: "contract/1.0" }, env().call());
    const as = (accessToken: string) => env().call({ userToken: accessToken });
    const t = () => env().transport;

    it("signs in, counts a wrong password, and refuses an unknown email the same way", async () => {
      const email = `pw-${t()}@golden-uni.test`;
      await createUser(world.sql, email, "Right-Passw0rd-123");
      await expect(signIn(email, "wrong-password")).rejects.toSatisfy((e) => reason(e) === "invalid_credentials");
      await expect(signIn(`nobody-${t()}@golden-uni.test`, "whatever-123")).rejects.toSatisfy((e) => reason(e) === "invalid_credentials");
      const [fails] = await world.sql`select count(*)::int as n from identity.security_events e join identity.users u on u.id = e.user_id
                                       where u.email = ${email} and e.kind = 'sign_in_failed'`;
      expect(fails?.["n"]).toBe(1);
      const r = await signIn(email, "Right-Passw0rd-123");
      expect(r.session?.accessToken).toBeTruthy();
      expect(r.session?.aal).toBe("aal1");
      expect(r.twoFactorRequired).toBe(false);
      // A wrong password before the right one is cleared by the sign-in.
      expect((await id().signinStatus({ email, ipHash: "" }, env().call())).failures).toBe(0);
    });

    it("refuses an unconfirmed email and a banned account after checking the password", async () => {
      const unconfirmed = `unconfirmed-${t()}@golden-uni.test`;
      await createUser(world.sql, unconfirmed, "Right-Passw0rd-123", { confirmed: false });
      await expect(signIn(unconfirmed, "Right-Passw0rd-123")).rejects.toSatisfy((e) => reason(e) === "email_not_confirmed");
      const banned = `banned-${t()}@golden-uni.test`;
      const bid = await createUser(world.sql, banned, "Right-Passw0rd-123");
      await world.sql`update identity.users set banned_until = now() + interval '1 day' where id = ${bid}`;
      await expect(signIn(banned, "Right-Passw0rd-123")).rejects.toSatisfy((e) => reason(e) === "account_banned");
    });

    it("an imported bcrypt hash signs in and is rehashed to Argon2id", async () => {
      const email = `bcrypt-${t()}@golden-uni.test`;
      const uid = await createUser(world.sql, email, "Imported-Passw0rd-1", { hash: await bcrypt.hash("Imported-Passw0rd-1", 10) });
      await signIn(email, "Imported-Passw0rd-1");
      const [row] = await world.sql<{ algorithm: string; hash: string }[]>`select algorithm, hash from identity.password_credentials where user_id = ${uid}`;
      expect(row?.algorithm).toBe("argon2id");
      expect(row?.hash.startsWith("$argon2id$")).toBe(true);
      await signIn(email, "Imported-Passw0rd-1"); // the new hash verifies too
    });

    it("a second device gets a new-device email with a 'not me' link", async () => {
      const email = `device-${t()}@golden-uni.test`;
      await createUser(world.sql, email, "Right-Passw0rd-123");
      await signIn(email, "Right-Passw0rd-123", "a".repeat(64));
      const before = memoryOutbox.length;
      await signIn(email, "Right-Passw0rd-123", "b".repeat(64));
      const mail = memoryOutbox.slice(before).find((m) => m.to === email);
      expect(mail?.kind).toBe("new_device");
      expect(mail?.text).toMatch(/not-me\?token=[0-9a-f]{64}/);
    });

    it("refresh rotates; reusing an old refresh token ends the session", async () => {
      const email = `refresh-${t()}@golden-uni.test`;
      await createUser(world.sql, email, "Right-Passw0rd-123");
      const first = (await signIn(email, "Right-Passw0rd-123")).session!;
      const second = (await id().refresh({ refreshToken: first.refreshToken }, env().call())).session!;
      expect(second.refreshToken).not.toBe(first.refreshToken);
      expect(second.sessionId).toBe(first.sessionId);
      await expect(id().refresh({ refreshToken: first.refreshToken }, env().call())).rejects.toSatisfy((e) => reason(e) === "refresh_token_reused");
      // The theft ended the session: even the newest token no longer works.
      await expect(id().refresh({ refreshToken: second.refreshToken }, env().call())).rejects.toSatisfy((e) => reason(e) === "refresh_token_invalid");
      await expect(id().refresh({ refreshToken: "not-a-token" }, env().call())).rejects.toSatisfy((e) => reason(e) === "refresh_token_invalid");
    });

    it("local sign-out ends one device; global sign-out revokes every token within a second", async () => {
      const email = `signout-${t()}@golden-uni.test`;
      await createUser(world.sql, email, "Right-Passw0rd-123");
      const laptop = (await signIn(email, "Right-Passw0rd-123")).session!;
      const phone = (await signIn(email, "Right-Passw0rd-123")).session!;
      await id().signOut({ scope: SignOutScope.LOCAL }, as(laptop.accessToken));
      await expect(id().refresh({ refreshToken: laptop.refreshToken }, env().call())).rejects.toSatisfy((e) => reason(e) === "refresh_token_invalid");
      const phoneAgain = (await id().refresh({ refreshToken: phone.refreshToken }, env().call())).session!; // the phone is untouched
      await id().backupCodesRemaining({}, as(phoneAgain.accessToken)); // and its token is accepted

      await id().signOut({ scope: SignOutScope.GLOBAL }, as(phoneAgain.accessToken));
      const t0 = Date.now();
      let refused = false;
      while (!refused && Date.now() - t0 < 2_000) {
        refused = await id()
          .backupCodesRemaining({}, as(phoneAgain.accessToken))
          .then(() => false)
          .catch((e: unknown) => ConnectError.from(e).code === Code.Unauthenticated);
        if (!refused) await new Promise((r) => setTimeout(r, 25));
      }
      expect(refused).toBe(true);
      expect(Date.now() - t0).toBeLessThan(1_000);
      await expect(id().refresh({ refreshToken: phoneAgain.refreshToken }, env().call())).rejects.toSatisfy((e) => reason(e) === "refresh_token_invalid");
    });

    it("Settings → Security reads: recent activity and authenticators, own account only", async () => {
      const email = `activity-${t()}@golden-uni.test`;
      await createUser(world.sql, email, "Right-Passw0rd-123");
      const s = (await signIn(email, "Right-Passw0rd-123")).session!;
      const events = (await id().listSecurityEvents({}, as(s.accessToken))).events;
      expect(events[0]).toMatchObject({ kind: "sign_in", method: "password", newDevice: true, userAgent: "contract/1.0" });
      expect((await id().listAuthenticators({}, as(s.accessToken))).authenticators).toEqual([]);
      await expect(id().listSecurityEvents({}, env().call())).rejects.toSatisfy((e) => ConnectError.from(e).code === Code.Unauthenticated);
    });

    it("sign-out needs a signed-in user and a scope", async () => {
      await expect(id().signOut({ scope: SignOutScope.GLOBAL }, env().call())).rejects.toSatisfy((e) => ConnectError.from(e).code === Code.Unauthenticated);
    });
  },
  identityWorld((w) => (world = w), worlds),
);
