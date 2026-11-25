/**
 * Journeys mirroring the sign-in, password, session and two-factor tests of apps/web/tests/e2e/auth.spec.ts,
 * on both transports (decision 2026-11-25, Q5). Identity is driven only through its contract; accounts are
 * made as the spec's `createStudent` makes them (sign-up, emailed code, agreement, people's onboarding event);
 * email is read from the memory outbox. A "browser" or "device" is its own device hash and session.
 */
import { SignOutScope } from "@skilient/contracts/identity/v1/identity_pb";
import { describeTransports } from "@skilient/testing";
import { afterAll, expect, it } from "vitest";
import { memoryOutbox } from "../../src/deps";
import { base32Decode, totp } from "../../src/domain/totp";
import { codeFrom, device, gateFlagsOf, IP, journeyClient, journeyWorlds, latestEmail, mailsTo, NU, NUTECH, PASSWORD, refusedWith, unauthenticated } from "./journey";

const worlds = journeyWorlds();
afterAll(() => worlds.stop());

describeTransports(
  ["identity"],
  (env) => {
    const { id, as, unique, signIn, createStudent, refusedWithin } = journeyClient(env);
    const w = () => worlds.current();
    worlds.stopEachTransport();
    /** identity's security log for an account, newest first (what Settings -> Security lists as recent activity). */
    const activity = async (userId: string) =>
      (await w().sql<{ kind: string }[]>`select kind from identity.security_events where user_id = ${userId} order by created_at desc, id desc`).map((r) => r.kind);

    // auth.spec.ts:104
    it("reset password by email, then sign in with the new one", async () => {
      const student = await createStudent(w(), { fullName: "Reset Person" });
      const since = memoryOutbox.length;
      await id().requestPasswordReset({ email: student.email, captchaToken: "" }, env().call());
      const mail = await latestEmail(student.email, "password_reset", since);
      const token = /reset-password\?token=([A-Za-z0-9_-]{43})/.exec(mail.text)?.[1];
      expect(token).toBeTruthy();
      // Opening the link spends nothing (a mail scanner may open it first): only ResetPassword uses the token.
      const fresh = "Brand-new-Passw0rd-2026";
      const reset = await id().resetPassword({ token: token!, newPassword: fresh }, env().call());
      expect(reset.session?.aal).toBe("aal1");
      // Lands signed in on the feed: onboarded, agreement accepted.
      expect(await id().getGateState({}, as(reset.session!.accessToken))).toMatchObject({ hasProfile: true, onboardingComplete: true, agreementAccepted: true });
      await id().signOut({ scope: SignOutScope.LOCAL }, as(reset.session!.accessToken));
      await expect(signIn(student.email, PASSWORD)).rejects.toSatisfy(refusedWith("invalid_credentials"));
      expect((await signIn(student.email, fresh)).session?.accessToken).toBeTruthy();
      await expect(id().resetPassword({ token: token!, newPassword: "Another-Passw0rd-2026" }, env().call())).rejects.toSatisfy(refusedWith("reset_link_expired"));
    });
    it.todo("W13: a mail scanner's GET of the reset page spends nothing, and the page asks for Continue before the form (web route)");

    // auth.spec.ts:135
    it("change the password in settings: current password checked, other devices signed out", async () => {
      const student = await createStudent(w(), { fullName: "Change Person" });
      const here = (await signIn(student.email, PASSWORD, device("a"))).session!;
      const other = (await signIn(student.email, PASSWORD, device("b"))).session!;
      const fresh = "Changed-in-settings-2026";
      // "That isn't your current password"
      await expect(id().changePassword({ currentPassword: "not-my-password-at-all", newPassword: fresh }, as(here.accessToken))).rejects.toSatisfy(refusedWith("wrong_password"));
      const changed = await id().changePassword({ currentPassword: PASSWORD, newPassword: fresh }, as(here.accessToken));
      expect(changed.session?.accessToken).toBeTruthy();
      // The other browser is signed out: its token is refused within a second and its refresh fails.
      expect(await refusedWithin(other.accessToken)).toBeLessThan(1_000);
      await expect(id().refresh({ refreshToken: other.refreshToken }, env().call())).rejects.toSatisfy(refusedWith("refresh_token_invalid"));
      // This browser carries on with the fresh session, then signs out and back in with the new password.
      await id().getGateState({}, as(changed.session!.accessToken));
      await id().signOut({ scope: SignOutScope.LOCAL }, as(changed.session!.accessToken));
      await expect(signIn(student.email, PASSWORD)).rejects.toSatisfy(refusedWith("invalid_credentials"));
      expect((await signIn(student.email, fresh)).session?.accessToken).toBeTruthy();
      expect(await activity(student.id)).toContain("password_changed");
    });
    it.todo("W13: the session cookie is __Secure- prefixed, Secure and SameSite=Lax (web sets the cookie)");

    // auth.spec.ts:169
    it("sign out, then sign in as another student: zero residue, other tabs follow", async () => {
      const a = await createStudent(w(), { uni: NUTECH, fullName: "Aisha Alpha" });
      const b = await createStudent(w(), { uni: NU, fullName: "Bilal Bravo" });
      const aSession = (await signIn(a.email)).session!;
      expect((await id().getGateState({}, as(aSession.accessToken))).universityId).toBe(NUTECH.id);
      // Sign out in one tab: the session ends, so the other tab's next refresh fails and it signs out too.
      await id().signOut({ scope: SignOutScope.LOCAL }, as(aSession.accessToken));
      await expect(id().refresh({ refreshToken: aSession.refreshToken }, env().call())).rejects.toSatisfy(refusedWith("refresh_token_invalid"));
      // Bilal signs in on the same device: his token sees only his own account.
      const bSession = (await signIn(b.email)).session!;
      const gate = await id().getGateState({}, as(bSession.accessToken));
      expect(gate.universityId).toBe(NU.id);
      expect(JSON.parse(Buffer.from(bSession.accessToken.split(".")[1]!, "base64url").toString())).toMatchObject({ sub: b.id });
      expect((await id().backupCodesRemaining({}, as(bSession.accessToken))).remaining).toBe(0);
      expect(bSession.sessionId).not.toBe(aSession.sessionId);
    });
    it.todo("W13: the composer draft, sessionStorage and localStorage are cleared and other tabs follow the sign-out (browser state)");

    // auth.spec.ts:202
    it("wrong passwords slow sign-in down but never lock it, and the emailed code always works", async () => {
      const student = await createStudent(w(), { fullName: "Slow Down" });
      const status = () => id().signinStatus({ email: student.email, ipHash: IP }, env().call());
      /** Ten wrong passwords: nine refused with no wait, the tenth starts a wait of about two seconds. */
      async function tenWrong(): Promise<number> {
        for (let i = 1; i <= 9; i++) await expect(signIn(student.email, `wrong-password-${i}`)).rejects.toSatisfy(refusedWith("invalid_credentials"));
        expect((await status()).retryAfterSeconds).toBe(0); // "That email and password don't match."
        await expect(signIn(student.email, "wrong-password-10")).rejects.toSatisfy(refusedWith("invalid_credentials"));
        const wait = (await status()).retryAfterSeconds; // "Wait 2 seconds"
        expect(wait).toBeGreaterThanOrEqual(1);
        expect(wait).toBeLessThanOrEqual(2);
        // During the wait even the right password is refused.
        await expect(signIn(student.email, PASSWORD)).rejects.toSatisfy(refusedWith("retry_later"));
        return wait;
      }
      // Seconds, not a lockout: the right password works once the wait is over.
      const wait = await tenWrong();
      await new Promise((r) => setTimeout(r, wait * 1000 + 100));
      const byPassword = (await signIn(student.email, PASSWORD)).session!;
      expect((await status()).failures).toBe(0);
      await id().signOut({ scope: SignOutScope.LOCAL }, as(byPassword.accessToken));

      // The emailed sign-in code works even while password sign-in is slowed.
      await tenWrong();
      const since = memoryOutbox.length;
      await id().requestEmailCode({ email: student.email, captchaToken: "" }, env().call());
      const mail = await latestEmail(student.email, "signin_code", since);
      expect(mail.subject).toMatch(/^Your Skilient sign-in code: \d{6}$/);
      const code = codeFrom(mail.subject);
      const signInWithCode = (c: string) => id().signInWithCode({ email: student.email, code: c, deviceHash: device("d"), ipHash: IP, userAgent: "journey/1.0" }, env().call());
      await expect(signInWithCode(code === "000000" ? "111111" : "000000")).rejects.toSatisfy(refusedWith("invalid_code")); // "That code is wrong"
      const byCode = (await signInWithCode(code)).session!;
      expect(await id().getGateState({}, as(byCode.accessToken))).toMatchObject({ onboardingComplete: true }); // lands on the feed
    });
    it.todo("W13: the sign-in and code pages pass axe and show the wait on the button (web)");

    // auth.spec.ts:247
    it("asking for a code never reveals whether an account exists", async () => {
      const student = await createStudent(w(), { uni: NU, fullName: "Known Person" });
      const nobody = unique(NU.domain, "nobody");
      const since = memoryOutbox.length;
      const forNobody = await id().requestEmailCode({ email: nobody, captchaToken: "" }, env().call());
      const forStudent = await id().requestEmailCode({ email: student.email, captchaToken: "" }, env().call());
      // The same answer either way ("Check your inbox"); only the real account gets an email.
      expect(forNobody).toEqual(forStudent);
      expect(mailsTo(nobody, since)).toEqual([]);
      expect(mailsTo(student.email, since).map((m) => m.kind)).toEqual(["signin_code"]);
      // A guessed code for the unknown address is refused like a wrong one.
      await expect(id().signInWithCode({ email: nobody, code: "123456", deviceHash: device("d"), ipHash: IP, userAgent: "journey/1.0" }, env().call())).rejects.toSatisfy(
        refusedWith("invalid_code"),
      );
    });

    // auth.spec.ts:257
    it("two-factor: backup codes at set-up, a second authenticator, and signing in with a backup code", async () => {
      const student = await createStudent(w(), { uni: NU, fullName: "Totp Tester" });
      const s = (await signIn(student.email)).session!;
      // Set up two-factor: the secret, then a code from the app.
      const first = await id().enrollTotp({}, as(s.accessToken));
      expect(first.secret).toMatch(/^[A-Z2-7]+=*$/);
      const secret1 = base32Decode(first.secret)!;
      const enrolled = await id().verifyTotp({ factorId: first.factorId, code: totp(secret1, Date.now() / 1000) }, as(s.accessToken));
      expect(enrolled.session?.aal).toBe("aal2");
      // Ten backup codes, shown once.
      const { codes } = await id().createBackupCodes({}, as(enrolled.session!.accessToken));
      expect(codes).toHaveLength(10);
      expect(codes.every((c) => /^[a-z2-9]{5}-[a-z2-9]{5}$/.test(c))).toBe(true);
      expect((await id().backupCodesRemaining({}, as(enrolled.session!.accessToken))).remaining).toBe(10); // "10 of 10 left."

      // A second authenticator; no new codes.
      const second = await id().enrollTotp({}, as(enrolled.session!.accessToken));
      expect(second.secret).not.toBe(first.secret);
      const secret2 = base32Decode(second.secret)!;
      await id().verifyTotp({ factorId: second.factorId, code: totp(secret2, Date.now() / 1000) }, as(enrolled.session!.accessToken));
      expect((await id().backupCodesRemaining({}, as(enrolled.session!.accessToken))).remaining).toBe(10);
      expect(await w().sql`select 1 from identity.totp_factors where user_id = ${student.id} and status = 'verified'`).toHaveLength(2);

      // Either app's code works at sign-in; until then the session is aal1 and nothing needing two-factor opens.
      await id().signOut({ scope: SignOutScope.LOCAL }, as(enrolled.session!.accessToken));
      const again = await signIn(student.email);
      expect(again.twoFactorRequired).toBe(true);
      expect(again.session?.aal).toBe("aal1");
      expect(gateFlagsOf(again.session!.accessToken)).toBeTruthy();
      await expect(id().createBackupCodes({}, as(again.session!.accessToken))).rejects.toSatisfy(refusedWith("two-factor session required"));
      // The next 30-second step: enrolment already used this one.
      const up = await id().verifyTotp({ factorId: "", code: totp(secret2, Date.now() / 1000 + 30) }, as(again.session!.accessToken));
      expect(up.session?.aal).toBe("aal2");

      // Lost phone: a backup code gets in once, and turns two-factor off.
      await id().signOut({ scope: SignOutScope.LOCAL }, as(up.session!.accessToken));
      const lost = (await signIn(student.email)).session!;
      expect((await id().useBackupCode({ code: "zzzzz-zzzzz" }, as(lost.accessToken))).ok).toBe(false); // "That code didn't work."
      const since = memoryOutbox.length;
      const used = await id().useBackupCode({ code: codes[3]!.toUpperCase() }, as(lost.accessToken));
      expect(used.ok).toBe(true);
      expect(used.session?.aal).toBe("aal2");
      expect(mailsTo(student.email, since).map((m) => m.kind)).toEqual(["backup_code_used"]);
      // "two-factor is now off": the next sign-in asks for no code, and "Set up two-factor" is offered again.
      expect((await signIn(student.email)).twoFactorRequired).toBe(false);
      expect((await id().backupCodesRemaining({}, as(used.session!.accessToken))).remaining).toBe(0);
      // "Signed in with a backup code (two-factor turned off)" in recent activity.
      expect(await activity(student.id)).toContain("mfa_backup_code_used");
      expect(await id().useBackupCode({ code: codes[3]! }, as(lost.accessToken))).toEqual(expect.objectContaining({ ok: false }));
    });
    it.todo("W13: Settings -> Security lists the authenticators (\"Authenticator app 2\") and recent activity: the contract has no read for either yet");
    it.todo("W13: /signin/mfa holds every page until the code is entered, and the backup-code pages pass axe (web gate)");

    // auth.spec.ts:323
    it("a new device shows up in recent activity", async () => {
      const student = await createStudent(w(), { fullName: "Two Devices" });
      const since = memoryOutbox.length;
      await signIn(student.email, PASSWORD, device("1"));
      expect(mailsTo(student.email, since)).toEqual([]); // the first device is not "new"
      await signIn(student.email, PASSWORD, device("2"));
      const alert = await latestEmail(student.email, "new_device", since);
      expect(alert.text).toMatch(/not-me\?token=[0-9a-f]{64}/);
      // "Signed in from a new device"
      const log = await activity(student.id);
      expect(log[0]).toBe("new_device");
      expect(log.filter((k) => k === "sign_in")).toHaveLength(2);
    });

    // auth.spec.ts:339
    it("route gates: signed-out, agreement, signed-in on auth pages", async () => {
      // Signed out: no gate state, so web sends /settings/security to /signin?next=...
      await expect(id().getGateState({}, env().call())).rejects.toSatisfy(unauthenticated);
      // No acceptance yet (like a Google signup): the agreement comes first.
      const student = await createStudent(w(), { uni: NU, fullName: "Gate Keeper", agreement: false });
      const s = (await signIn(student.email)).session!;
      expect((await id().getGateState({}, as(s.accessToken))).agreementAccepted).toBe(false);
      expect(gateFlagsOf(s.accessToken)).toMatchObject({ agreement_accepted: false });
      const { version } = await id().currentAgreementVersion({}, env().call());
      await id().acceptAgreement({ version, ipHash: IP }, as(s.accessToken)); // "I agree"
      expect((await id().getGateState({}, as(s.accessToken))).agreementAccepted).toBe(true);
      // The next token web refreshes carries the new flags, so the page opens.
      const refreshed = (await id().refresh({ refreshToken: s.refreshToken }, env().call())).session!;
      expect(gateFlagsOf(refreshed.accessToken)).toMatchObject({ agreement_accepted: true, has_profile: true, onboarding_complete: true, email_allowed: true });
    });
    it.todo("W13: the redirects themselves (/signin?next=, /agreement?next=, signed-in /signin to /feed) are web's proxy");

    // auth.spec.ts:362
    it.todo("W13: auth pages have no axe-core violations or CSP errors in light and dark (web pages only; no identity half)");

    // auth.spec.ts:384
    it.todo("W13: pages carry a per-request nonce CSP (web headers only; no identity half)");
  },
  worlds.options,
);
