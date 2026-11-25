/**
 * Golden replay: password change (password.json `password_change`), recorded from the app action
 * `changePassword` (apps/web/lib/actions/auth.ts) driven in a browser. Here the same steps call identity's
 * ChangePassword on both transports, and each recorded browser-level effect is read at service level:
 *   - result codes: identity's refusal reasons, turned into the app's codes and wording by `web` below,
 *     which stands in for the W13 web action (the wording is web's, not identity's);
 *   - "confirm_mismatch" never reaches identity (the contract has no confirm field; web checks it);
 *   - a password grant is a SignInPassword (refused invalid_credentials = the recorded 400);
 *   - a device "after" is where web would send it: its refresh refused -> /signin, its token accepted -> stays.
 * Breached passwords use a local fake of the range API (never the network); the recording has no breached case.
 */
import { join } from "node:path";
import { Code, ConnectError } from "@connectrpc/connect";
import { IdentityService } from "@skilient/contracts/identity/v1/identity_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports, golden } from "@skilient/testing";
import { afterAll, beforeAll, expect, it } from "vitest";
import { startFakeHibp } from "../contract/security-hibp";
import { createUser, DEVICE, identityWorld, IP, stopWorlds, type World } from "../contract/world";

const FILE = join(import.meta.dirname, "../../../../packages/testing/test/golden/identity/password.json");
const OLD = "Golden-old-Passw0rd-2026";
const NEW = "Golden-new-Passw0rd-2026";
const THIRD = "Golden-third-Passw0rd-2026";

const worlds: World[] = [];
let world: World;
let hibp: Awaited<ReturnType<typeof startFakeHibp>>;
beforeAll(async () => {
  hibp = await startFakeHibp([]);
});
afterAll(async () => {
  await stopWorlds(worlds);
  await hibp?.stop();
});

/** The web action's answer for an identity refusal (apps/web/lib/actions/auth.ts wording). */
function web(e: unknown): { code: string; message: string | null } {
  const reason = refusalReason(e) ?? `connect_${ConnectError.from(e).code}`;
  switch (reason) {
    case "invalid_input":
    case "password_too_short":
    case "password_too_long":
    case "same_password":
      return { code: "invalid_input", message: "Check the highlighted fields." };
    case "wrong_password":
      return {
        code: "wrong_password",
        message: 'That isn\'t your current password. Signed up with Google? Use "Forgot password" on the sign-in page to set one.',
      };
    case "rate_limited":
      return { code: "rate_limited", message: "Too many tries. Wait 15 minutes and try again." };
    case "breached_password":
      return { code: "breached_password", message: "This password has appeared in a data breach. Choose a different one." };
    default:
      return { code: reason, message: null };
  }
}

describeTransports(
  ["identity"],
  (env) => {
    const id = () => env().client(IdentityService);

    it("password_change", async () => {
      const email = `golden.password.${env().transport}@golden-uni.test`;
      const uid = await createUser(world.sql, email, OLD);
      const signIn = (password: string) => id().signInPassword({ email, password, deviceHash: DEVICE, ipHash: IP, userAgent: "golden/1.0" }, env().call());
      const page = (await signIn(OLD)).session!;
      const other = (await signIn(OLD)).session!;
      const sessions = async () => (await world.sql<{ n: number }[]>`select count(*)::int as n from identity.sessions where user_id = ${uid} and revoked_at is null`)[0]!.n;
      const events = async () =>
        (await world.sql<{ n: number }[]>`select count(*)::int as n from identity.security_events where user_id = ${uid} and kind = 'password_changed'`)[0]!.n;
      let token = page.accessToken;
      const submit = async (current: string, password: string, confirm: string) => {
        if (password !== confirm) return { code: "invalid_input", message: "Check the highlighted fields." }; // web's own check
        try {
          const r = await id().changePassword({ currentPassword: current, newPassword: password }, env().call({ userToken: token }));
          token = r.session!.accessToken;
          return { code: "ok", message: null };
        } catch (e) {
          return web(e);
        }
      };
      const grant = (password: string) =>
        signIn(password).then(
          () => ({ status: 200, error_code: null }),
          (e: unknown) => ({ status: refusalReason(e) === "invalid_credentials" ? 400 : 500, error_code: refusalReason(e) }),
        );
      const sessionsBefore = await sessions();

      const refusals = {
        confirm_mismatch: await submit(OLD, NEW, `${NEW}x`),
        too_short: await submit(OLD, "short", "short"),
        same_as_current: await submit(OLD, OLD, OLD),
        wrong_current: await submit("not-my-password-at-all", NEW, NEW),
      };
      const eventsBeforeSuccess = await events();
      const success = await submit(OLD, NEW, NEW);
      const effects = {
        sessions_before: sessionsBefore,
        sessions_after: await sessions(),
        password_changed_events_before: eventsBeforeSuccess,
        password_changed_events_after: await events(),
        old_password_grant: await grant(OLD),
        new_password_grant: await grant(NEW),
        other_device_after: await id()
          .refresh({ refreshToken: other.refreshToken }, env().call())
          .then(
            () => "/feed",
            () => "/signin",
          ),
        this_device_after: await id()
          .backupCodesRemaining({}, env().call({ userToken: token }))
          .then(
            () => "/settings/security",
            (e: unknown) => (ConnectError.from(e).code === Code.Unauthenticated ? "/signin" : "error"),
          ),
      };
      const untilLimited: string[] = [];
      for (let i = 0; i < 6; i++) {
        const r = await submit("not-my-password-at-all", THIRD, THIRD);
        untilLimited.push(r.code);
        if (r.code === "rate_limited") break;
      }
      expect(hibp.asked.length).toBeGreaterThan(0); // the breached check ran, against the fake
      const r = golden(FILE, "password_change", { refusals, success, effects, attempts_until_rate_limited: untilLimited });
      if (r.status === "differs") expect(r.actual).toEqual(r.expected);
      expect(r.status).toBe("matched");
    });
  },
  identityWorld((w) => (world = w), worlds),
);
