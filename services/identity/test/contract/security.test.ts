/**
 * Two-factor and passwords on both transports (steps 7 and 8): authenticator enrolment, verification with
 * replay protection, step-up and removal; backup codes; password change and reset. Refusals included:
 * aal1 where aal2 is needed, wrong codes, a replayed TOTP step, and repeats under one idempotency key.
 */
import { Code, ConnectError, type CallOptions } from "@connectrpc/connect";
import { IdentityService } from "@skilient/contracts/identity/v1/identity_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, beforeAll, expect, it } from "vitest";
import { memoryOutbox } from "../../src/deps";
import { base32Decode, totp } from "../../src/domain/totp";
import { startFakeHibp } from "./security-hibp";
import { createUser, DEVICE, identityWorld, IP, stopWorlds, type World } from "./world";

const BREACHED = "Breached-Passw0rd-2026";
const PASSWORD = "Right-Passw0rd-123";
const worlds: World[] = [];
let world: World;
let hibp: Awaited<ReturnType<typeof startFakeHibp>>;
beforeAll(async () => {
  hibp = await startFakeHibp([BREACHED]);
});
afterAll(async () => {
  await stopWorlds(worlds);
  await hibp?.stop();
});

const reason = (e: unknown) => refusalReason(e) ?? `code ${ConnectError.from(e).code}`;
const refusedWith = (r: string) => (e: unknown) => reason(e) === r;

describeTransports(
  ["identity"],
  (env) => {
    const id = () => env().client(IdentityService);
    const t = () => env().transport;
    const as = (accessToken: string): CallOptions => env().call({ userToken: accessToken });
    const withKey = (accessToken: string | null, key: string): CallOptions => ({
      ...(accessToken ? env().call({ userToken: accessToken }) : env().call()),
      headers: { "idempotency-key": `${key}-${t()}` },
    });
    const signIn = async (email: string, password = PASSWORD) =>
      (await id().signInPassword({ email, password, deviceHash: DEVICE, ipHash: IP, userAgent: "contract/1.0" }, env().call())).session!;
    const events = async (userId: string, kind: string) =>
      (await world.sql<{ n: number }[]>`select count(*)::int as n from identity.security_events where user_id = ${userId} and kind = ${kind}`)[0]!.n;
    const userId = async (email: string) => (await world.sql<{ id: string }[]>`select id from identity.users where email = ${email}`)[0]!.id;
    /** Polls until the token is refused (revocation reaches the gate within a second). */
    async function refusedWithinASecond(accessToken: string): Promise<number> {
      const t0 = Date.now();
      while (Date.now() - t0 < 2_000) {
        const refused = await id()
          .backupCodesRemaining({}, as(accessToken))
          .then(() => false)
          .catch((e: unknown) => ConnectError.from(e).code === Code.Unauthenticated);
        if (refused) return Date.now() - t0;
        await new Promise((r) => setTimeout(r, 25));
      }
      return Infinity;
    }
    /** A student with an authenticator on, and an aal2 session from finishing enrolment. */
    async function enrolled(email: string) {
      await createUser(world.sql, email, PASSWORD);
      const s = await signIn(email);
      const e = await id().enrollTotp({}, as(s.accessToken));
      const secret = base32Decode(e.secret)!;
      const t0 = Date.now() / 1000;
      const v = await id().verifyTotp({ factorId: e.factorId, code: totp(secret, t0) }, as(s.accessToken));
      return { secret, t0, factorId: e.factorId, session: v.session!, uid: await userId(email) };
    }

    it("enrols an authenticator: secret once, verified with a code, session raised to aal2", async () => {
      const email = `totp-${t()}@golden-uni.test`;
      await createUser(world.sql, email, PASSWORD);
      const s = await signIn(email);
      const first = await id().enrollTotp({}, withKey(s.accessToken, "enrol-1"));
      expect(first.secret).toMatch(/^[A-Z2-7]{32}$/);
      expect(first.otpauthUri).toBe(
        `otpauth://totp/Skilient%3A${encodeURIComponent(email)}?secret=${first.secret}&issuer=Skilient&algorithm=SHA1&digits=6&period=30`,
      );
      // The secret is returned once: a repeat under the same key refuses, and nothing stores it in the clear.
      await expect(id().enrollTotp({}, withKey(s.accessToken, "enrol-1"))).rejects.toSatisfy(refusedWith("already_applied"));
      const [row] = await world.sql<{ secret_ciphertext: Buffer; status: string }[]>`select secret_ciphertext, status from identity.totp_factors where id = ${first.factorId}`;
      expect(row?.status).toBe("unverified");
      expect(row!.secret_ciphertext.includes(base32Decode(first.secret)!)).toBe(false);
      const [stored] = await world.sql`select response from platform.idempotency where key = ${`enrol-1-${t()}`}`;
      expect(stored?.["response"]).toBeNull();

      // Enrolling again replaces the abandoned set-up (one unverified factor at a time).
      const e = await id().enrollTotp({}, as(s.accessToken));
      expect(await world.sql`select 1 from identity.totp_factors where id = ${first.factorId}`).toHaveLength(0);
      const secret = base32Decode(e.secret)!;
      await expect(id().verifyTotp({ factorId: e.factorId, code: "12345" }, as(s.accessToken))).rejects.toSatisfy(refusedWith("invalid_input"));
      const wrong = totp(secret, Date.now() / 1000 + 600);
      await expect(id().verifyTotp({ factorId: e.factorId, code: wrong }, as(s.accessToken))).rejects.toSatisfy(refusedWith("invalid_code"));
      const v = await id().verifyTotp({ factorId: e.factorId, code: totp(secret, Date.now() / 1000) }, as(s.accessToken));
      expect(v.session?.aal).toBe("aal2");
      expect(v.session?.sessionId).toBe(s.sessionId);
      const uid = await userId(email);
      expect(await events(uid, "mfa_enrolled")).toBe(1);
      const [ev] = await world.sql`select payload from platform.events where type = 'user.two_factor_changed' and ${uid} = any(subjects)`;
      expect(ev?.["payload"]).toEqual({ on: true, reason: "enrolled" });
    });

    it("needs a signed-in user; a second authenticator needs a two-factor session", async () => {
      await expect(id().enrollTotp({}, env().call())).rejects.toSatisfy((e) => ConnectError.from(e).code === Code.Unauthenticated);
      const email = `totp2-${t()}@golden-uni.test`;
      const { session } = await enrolled(email);
      const aal1 = await signIn(email);
      await expect(id().enrollTotp({}, as(aal1.accessToken))).rejects.toSatisfy(refusedWith("two-factor session required"));
      const second = await id().enrollTotp({}, as(session.accessToken));
      expect(second.factorId).toBeTruthy();
    });

    it("sign-in step: steps up with a new code, refuses a replayed step", async () => {
      const email = `stepup-${t()}@golden-uni.test`;
      const { secret, t0 } = await enrolled(email);
      const s = (await id().signInPassword({ email, password: PASSWORD, deviceHash: DEVICE, ipHash: IP, userAgent: "contract/1.0" }, env().call()));
      expect(s.twoFactorRequired).toBe(true);
      expect(s.session?.aal).toBe("aal1");
      // The code that finished enrolment cannot be used again.
      await expect(id().verifyTotp({ factorId: "", code: totp(secret, t0) }, as(s.session!.accessToken))).rejects.toSatisfy(refusedWith("invalid_code"));
      const up = await id().verifyTotp({ factorId: "", code: totp(secret, t0 + 30) }, as(s.session!.accessToken));
      expect(up.session?.aal).toBe("aal2");
      expect(up.session?.sessionId).toBe(s.session!.sessionId);
      // The same step again, even on another session, is refused.
      const other = await signIn(email);
      await expect(id().verifyTotp({ factorId: "", code: totp(secret, t0 + 30) }, as(other.accessToken))).rejects.toSatisfy(refusedWith("invalid_code"));
      // The refreshed session stays aal2.
      const refreshed = await id().refresh({ refreshToken: up.session!.refreshToken }, env().call());
      expect(refreshed.session?.aal).toBe("aal2");
    });

    it("counts wrong codes: the eleventh try in 15 minutes is rate limited", async () => {
      const email = `totp-rl-${t()}@golden-uni.test`;
      const { secret } = await enrolled(email);
      const s = await signIn(email);
      const now = Date.now() / 1000;
      const near = new Set([-30, 0, 30, 60].map((d) => totp(secret, now + d)));
      let wrong = 100000;
      while (near.has(String(wrong))) wrong++;
      // Enrolment used one of the ten.
      for (let i = 0; i < 9; i++)
        await expect(id().verifyTotp({ factorId: "", code: String(wrong) }, as(s.accessToken))).rejects.toSatisfy(refusedWith("invalid_code"));
      await expect(id().verifyTotp({ factorId: "", code: totp(secret, now + 30) }, as(s.accessToken))).rejects.toSatisfy(refusedWith("rate_limited"));
    });

    it("removing an authenticator needs aal2, logs it, drops backup codes and revokes older tokens", async () => {
      const email = `remove-${t()}@golden-uni.test`;
      const { factorId, session, uid } = await enrolled(email);
      await id().createBackupCodes({}, as(session.accessToken));
      const aal1 = await signIn(email);
      await expect(id().removeTotp({ factorId }, as(aal1.accessToken))).rejects.toSatisfy(refusedWith("two-factor session required"));
      await expect(id().removeTotp({ factorId: "nope" }, as(session.accessToken))).rejects.toSatisfy(refusedWith("invalid_input"));
      await expect(id().removeTotp({ factorId: "0190f0b2-0000-7000-8000-000000000001" }, as(session.accessToken))).rejects.toSatisfy(refusedWith("factor not found"));
      await id().removeTotp({ factorId }, withKey(session.accessToken, "remove-1"));
      expect(await events(uid, "mfa_unenrolled")).toBe(1);
      expect(await world.sql`select 1 from identity.totp_factors where user_id = ${uid}`).toHaveLength(0);
      expect(await world.sql`select 1 from identity.mfa_backup_codes where user_id = ${uid}`).toHaveLength(0);
      expect(await world.sql`select 1 from identity.sessions where user_id = ${uid} and aal = 'aal2' and revoked_at is null`).toHaveLength(0);
      expect(await refusedWithinASecond(session.accessToken)).toBeLessThan(1_000);
      // The session lives on at aal1: its next refresh mints a token with the new version.
      const next = await id().refresh({ refreshToken: session.refreshToken }, env().call());
      expect(next.session?.aal).toBe("aal1");
      expect(await id().backupCodesRemaining({}, as(next.session!.accessToken))).toEqual(expect.objectContaining({ remaining: 0 }));
    });

    it("backup codes: aal2 to create, returned once, single use, and a used code turns two-factor off", async () => {
      const email = `backup-${t()}@golden-uni.test`;
      const { session, uid } = await enrolled(email);
      const aal1 = await signIn(email);
      await expect(id().createBackupCodes({}, as(aal1.accessToken))).rejects.toSatisfy(refusedWith("two-factor session required"));
      await expect(id().createBackupCodes({}, env().call())).rejects.toSatisfy((e) => ConnectError.from(e).code === Code.Unauthenticated);
      const { codes } = await id().createBackupCodes({}, withKey(session.accessToken, "codes-1"));
      expect(codes).toHaveLength(10);
      for (const c of codes) expect(c).toMatch(/^[2-9a-z]{5}-[2-9a-z]{5}$/);
      expect(new Set(codes).size).toBe(10);
      await expect(id().createBackupCodes({}, withKey(session.accessToken, "codes-1"))).rejects.toSatisfy(refusedWith("already_applied"));
      expect((await id().backupCodesRemaining({}, as(aal1.accessToken))).remaining).toBe(10);

      const wrong = await id().useBackupCode({ code: "zzzzz-zzzzz" }, as(aal1.accessToken));
      expect(wrong).toEqual(expect.objectContaining({ ok: false }));
      expect(wrong.session).toBeUndefined();
      const before = memoryOutbox.length;
      const used = await id().useBackupCode({ code: ` ${codes[0]!.toUpperCase()} ` }, as(aal1.accessToken));
      expect(used.ok).toBe(true);
      expect(used.session?.aal).toBe("aal2");
      expect(used.session?.sessionId).toBe(aal1.sessionId);
      expect(memoryOutbox.slice(before).filter((m) => m.to === email).map((m) => m.kind)).toEqual(["backup_code_used"]);
      expect(await events(uid, "mfa_backup_code_used")).toBe(1);
      expect(await world.sql`select 1 from identity.totp_factors where user_id = ${uid}`).toHaveLength(0);
      expect((await id().useBackupCode({ code: codes[1]! }, as(aal1.accessToken))).ok).toBe(false);
      expect((await id().useBackupCode({ code: codes[0]! }, as(aal1.accessToken))).ok).toBe(false);
      void session;
    });

    it("deleting backup codes needs aal2 while an authenticator is on", async () => {
      const email = `delete-${t()}@golden-uni.test`;
      const { session, uid } = await enrolled(email);
      await id().createBackupCodes({}, as(session.accessToken));
      const aal1 = await signIn(email);
      await expect(id().deleteBackupCodes({}, as(aal1.accessToken))).rejects.toSatisfy(refusedWith("two-factor session required"));
      await id().deleteBackupCodes({}, as(session.accessToken));
      expect(await world.sql`select 1 from identity.mfa_backup_codes where user_id = ${uid}`).toHaveLength(0);
    });

    it("changes a password: checks, breached refusal, other sessions end, fresh session here", async () => {
      const email = `change-${t()}@golden-uni.test`;
      await createUser(world.sql, email, PASSWORD);
      const uid = await userId(email);
      const here = await signIn(email);
      const there = await signIn(email);
      const change = (current: string, next: string, key?: string) =>
        id().changePassword({ currentPassword: current, newPassword: next }, key ? withKey(here.accessToken, key) : as(here.accessToken));
      await expect(id().changePassword({ currentPassword: PASSWORD, newPassword: "New-Passw0rd-2026" }, env().call())).rejects.toSatisfy(
        (e) => ConnectError.from(e).code === Code.Unauthenticated,
      );
      await expect(change(PASSWORD, "short")).rejects.toSatisfy(refusedWith("password_too_short"));
      await expect(change(PASSWORD, PASSWORD)).rejects.toSatisfy(refusedWith("same_password"));
      await expect(change("not-my-password", "New-Passw0rd-2026")).rejects.toSatisfy(refusedWith("wrong_password"));
      await expect(change(PASSWORD, BREACHED)).rejects.toSatisfy(refusedWith("breached_password"));
      expect(hibp.asked.length).toBeGreaterThan(0);
      for (const prefix of hibp.asked) expect(prefix).toMatch(/^[0-9A-F]{5}$/);

      const r = await change(PASSWORD, "New-Passw0rd-2026", "change-1");
      expect(r.session?.aal).toBe("aal1");
      // A repeat under the same key changes nothing: it refuses (already_applied, or the old token is already revoked).
      await expect(change(PASSWORD, "New-Passw0rd-2026", "change-1")).rejects.toSatisfy((e) => ["already_applied", "user_token_invalid"].includes(reason(e)));
      expect(await events(uid, "password_changed")).toBe(1);
      expect(await world.sql`select 1 from identity.sessions where user_id = ${uid} and revoked_at is null`).toHaveLength(1);
      await expect(id().refresh({ refreshToken: there.refreshToken }, env().call())).rejects.toSatisfy(refusedWith("refresh_token_invalid"));
      expect(await refusedWithinASecond(there.accessToken)).toBeLessThan(1_000);
      expect((await id().backupCodesRemaining({}, as(r.session!.accessToken))).remaining).toBe(0);
      await expect(signIn(email, PASSWORD)).rejects.toSatisfy(refusedWith("invalid_credentials"));
      await signIn(email, "New-Passw0rd-2026");
      const [cred] = await world.sql<{ algorithm: string }[]>`select algorithm from identity.password_credentials where user_id = ${uid}`;
      expect(cred?.algorithm).toBe("argon2id");
    });

    it("password change attempts: 5 per 15 minutes per account", async () => {
      const email = `change-rl-${t()}@golden-uni.test`;
      await createUser(world.sql, email, PASSWORD);
      const s = await signIn(email);
      const codes: string[] = [];
      for (let i = 0; i < 6; i++)
        codes.push(await id().changePassword({ currentPassword: "not-my-password", newPassword: "New-Passw0rd-2026" }, as(s.accessToken)).then(() => "ok", reason));
      expect(codes).toEqual([...Array<string>(5).fill("wrong_password"), "rate_limited"]);
    });

    it("password reset: same answer for any address, one-hour single-use link, every session ends", async () => {
      const email = `reset-${t()}@golden-uni.test`;
      await createUser(world.sql, email, PASSWORD);
      const uid = await userId(email);
      const old = await signIn(email);
      const before = memoryOutbox.length;
      expect(await id().requestPasswordReset({ email: `nobody-${t()}@golden-uni.test`, captchaToken: "" }, env().call())).toEqual(
        await id().requestPasswordReset({ email: email.toUpperCase(), captchaToken: "" }, env().call()),
      );
      const mails = memoryOutbox.slice(before);
      expect(mails.map((m) => [m.to, m.kind])).toEqual([[email, "password_reset"]]);
      const token = /reset-password\?token=([A-Za-z0-9_-]{43})/.exec(mails[0]!.text)![1]!;
      const [stored] = await world.sql<{ token_hash: string }[]>`select token_hash from identity.password_reset_tokens where user_id = ${uid}`;
      expect(stored?.token_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(stored?.token_hash).not.toContain(token);

      await expect(id().resetPassword({ token, newPassword: "short" }, env().call())).rejects.toSatisfy(refusedWith("password_too_short"));
      await expect(id().resetPassword({ token, newPassword: BREACHED }, env().call())).rejects.toSatisfy(refusedWith("breached_password"));
      await expect(id().resetPassword({ token: "x".repeat(43), newPassword: "Reset-Passw0rd-2026" }, env().call())).rejects.toSatisfy(refusedWith("reset_link_expired"));
      const r = await id().resetPassword({ token, newPassword: "Reset-Passw0rd-2026" }, env().call());
      expect(r.session?.aal).toBe("aal1");
      await expect(id().resetPassword({ token, newPassword: "Reset-Passw0rd-2027" }, env().call())).rejects.toSatisfy(refusedWith("reset_link_expired"));
      expect(await refusedWithinASecond(old.accessToken)).toBeLessThan(1_000);
      await expect(id().refresh({ refreshToken: old.refreshToken }, env().call())).rejects.toSatisfy(refusedWith("refresh_token_invalid"));
      await signIn(email, "Reset-Passw0rd-2026");
      expect(await events(uid, "password_changed")).toBe(1);

      // An expired link no longer works.
      await id().requestPasswordReset({ email, captchaToken: "" }, env().call());
      const second = /token=([A-Za-z0-9_-]{43})/.exec(memoryOutbox.at(-1)!.text)![1]!;
      await world.sql`update identity.password_reset_tokens set expires_at = now() - interval '1 second' where user_id = ${uid}`;
      await expect(id().resetPassword({ token: second, newPassword: "Reset-Passw0rd-2028" }, env().call())).rejects.toSatisfy(refusedWith("reset_link_expired"));
    });

    it("reset emails: 3 per hour per address, counted for unknown addresses too", async () => {
      const ask = (email: string) => id().requestPasswordReset({ email, captchaToken: "" }, env().call()).then(() => "ok", reason);
      for (const email of [`reset-rl-${t()}@golden-uni.test`, `reset-rl-nobody-${t()}@golden-uni.test`]) {
        if (email.startsWith("reset-rl-g")) await createUser(world.sql, email, PASSWORD);
        expect([await ask(email), await ask(email), await ask(email), await ask(email)]).toEqual(["ok", "ok", "ok", "rate_limited"]);
      }
      expect(await ask("not-an-email")).toBe("invalid_email");
    });
  },
  identityWorld((w) => (world = w), worlds),
);
