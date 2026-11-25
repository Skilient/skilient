/**
 * Journeys mirroring the sign-up tests of apps/web/tests/e2e/auth.spec.ts and the domain states of
 * marketing.spec.ts, on both transports (decision 2026-11-25, Q5). Identity is driven only through its
 * contract; gate facts arrive as people's and trust's events; email is read from the memory outbox.
 */
import { AccountRole } from "@skilient/contracts/identity/v1/identity_pb";
import { describeTransports } from "@skilient/testing";
import { afterAll, expect, it } from "vitest";
import { memoryOutbox } from "../../src/deps";
import {
  BREACHED,
  CALLBACK,
  codeFrom,
  device,
  gateFlagsOf,
  googleGrant,
  IP,
  journeyClient,
  journeyWorlds,
  latestEmail,
  mailsTo,
  NU,
  NUTECH,
  PERSONAL,
  publish,
  refusedWith,
  unauthenticated,
  VERIFIER,
} from "./journey";

const worlds = journeyWorlds();
afterAll(() => worlds.stop());

describeTransports(
  ["identity"],
  (env) => {
    const { id, as, unique, signUp, signIn, createStudent } = journeyClient(env);
    const w = () => worlds.current();
    worlds.stopEachTransport();
    const accountsAt = async (email: string) => (await w().sql<{ n: number }[]>`select count(*)::int as n from identity.users where email = ${email}`)[0]!.n;

    // auth.spec.ts:42
    it("sign up with a university email, confirm with the code, land in onboarding", async () => {
      const email = unique(NUTECH.domain);
      const since = memoryOutbox.length;
      const r = await signUp(email);
      expect(r.verificationSent).toBe(true);
      // The code is in the subject, as today's template puts it ("Your Skilient code: 123456").
      const mail = await latestEmail(email, "signup_code", since);
      expect(mail.subject).toMatch(/^Your Skilient code: \d{6}$/);
      const v = await id().verifyEmail({ email, code: codeFrom(mail.subject) }, env().call());
      expect(v.session?.aal).toBe("aal1");
      // Onboarding next: a student of the university the domain belongs to, onboarding not done, agreement accepted.
      const gate = await id().getGateState({}, as(v.session!.accessToken));
      expect(gate).toMatchObject({ hasProfile: true, role: AccountRole.STUDENT, universityId: NUTECH.id, onboardingComplete: false, onboardingStep: 1, agreementAccepted: true, emailAllowed: true, status: "active" });
      expect(gateFlagsOf(v.session!.accessToken)).toMatchObject({ has_profile: true, onboarding_complete: false, onboarding_step: 1 });
    });
    it.todo("W13: the form names the university (\"Signing up as a student of ...\") and the browser console stays clean (web and people's university names)");

    // auth.spec.ts:61
    it("personal and unknown email domains are refused", async () => {
      const personal = unique(PERSONAL, "someone");
      const unknown = unique("example-journey.org", "someone");
      await expect(signUp(personal)).rejects.toSatisfy(refusedWith("personal_email")); // "Use your university email."
      await expect(signUp(unknown)).rejects.toSatisfy(refusedWith("university_not_on_skilient")); // "Your university isn't on Skilient yet."
      expect([await accountsAt(personal), await accountsAt(unknown)]).toEqual([0, 0]);
    });
    it.todo("W13: the signup form shows the refusal as the address is typed (web's detection, before any call)");

    // auth.spec.ts:70
    it("the server refuses a personal email even without the form's check", async () => {
      const email = unique(PERSONAL, "someone");
      const since = memoryOutbox.length;
      // Straight to the contract, as a client that skipped the form would.
      await expect(signUp(email, { fullName: "Hina Test" })).rejects.toSatisfy(refusedWith("personal_email"));
      // Google is held to the same gate.
      await expect(
        id().signInWithGoogle(
          { code: googleGrant({ sub: `sub-${email}`, email }), codeVerifier: VERIFIER, redirectUri: CALLBACK, deviceHash: device("e"), ipHash: IP, userAgent: "journey/1.0", agreementVersion: 1 },
          env().call(),
        ),
      ).rejects.toSatisfy(refusedWith("google_domain"));
      expect(await accountsAt(email)).toBe(0);
      expect(mailsTo(email, since)).toEqual([]);
    });

    // auth.spec.ts:78
    it("a duplicate email is told to sign in instead", async () => {
      const existing = await createStudent(w(), { uni: NU, fullName: "Dup Licate" });
      const since = memoryOutbox.length;
      await expect(signUp(existing.email, { password: "Another-Passw0rd-99" })).rejects.toSatisfy(refusedWith("already_registered"));
      // Web shows "This email is already registered. Sign in instead." (decision 2026-11-25, Ahmed). No second
      // account, no code to a confirmed address, and the existing password is untouched.
      expect(await accountsAt(existing.email)).toBe(1);
      expect(mailsTo(existing.email, since)).toEqual([]);
      await expect(signIn(existing.email, "Another-Passw0rd-99")).rejects.toSatisfy(refusedWith("invalid_credentials"));
      expect((await signIn(existing.email)).session?.accessToken).toBeTruthy();
    });
    it.todo("W13: web maps the already_registered refusal to \"This email is already registered. Sign in instead.\"");

    // auth.spec.ts:86
    it("confirming from the email link in a second tab advances the first", async () => {
      const email = unique(NU.domain);
      const since = memoryOutbox.length;
      await signUp(email, { fullName: "Tab Two" });
      // First tab: waiting on "Check your inbox"; the account cannot sign in yet.
      await expect(signIn(email)).rejects.toSatisfy(refusedWith("email_not_confirmed"));
      // Second tab: confirms with what the email carries.
      const code = codeFrom((await latestEmail(email, "signup_code", since)).subject);
      const second = await id().verifyEmail({ email, code }, env().call());
      expect(second.session?.accessToken).toBeTruthy();
      // The code works once: the first tab cannot spend it again ...
      await expect(id().verifyEmail({ email, code }, env().call())).rejects.toSatisfy(refusedWith("invalid_code"));
      // ... and does not need to: the address is confirmed, so its sign-in now works and lands in onboarding.
      const first = (await signIn(email)).session!;
      const gate = await id().getGateState({}, as(first.accessToken));
      expect(gate).toMatchObject({ hasProfile: true, onboardingComplete: false, onboardingStep: 1 });
    });
    it.todo("W13: the first tab notices the confirmation on its own (web polls), and the email carries a link (identity's email carries the code only)");

    // auth.spec.ts:378
    it("a refused Google account is told to use its university account", async () => {
      const google = (email: string, sub: string) =>
        id().signInWithGoogle(
          { code: googleGrant({ sub, email, name: "Google Person" }), codeVerifier: VERIFIER, redirectUri: CALLBACK, deviceHash: device("e"), ipHash: IP, userAgent: "journey/1.0", agreementVersion: 1 },
          env().call(),
        );
      const tag = `${env().transport}-${Date.now().toString(36)}`;
      // A personal or unknown Google account: refused with the code web turns into "Use your university Google account."
      await expect(google(`p-${tag}@${PERSONAL}`, `sub-p-${tag}`)).rejects.toSatisfy(refusedWith("google_domain"));
      await expect(google(`u-${tag}@unknown-journey.test`, `sub-u-${tag}`)).rejects.toSatisfy(refusedWith("google_domain"));
      expect(await w().sql`select 1 from identity.identities where provider_user_id in (${`sub-p-${tag}`}, ${`sub-u-${tag}`})`).toEqual([]);
      // The university account it is told to use works.
      const ok = await google(`ok-${tag}@${NUTECH.domain}`, `sub-ok-${tag}`);
      expect(ok.newAccount).toBe(true);
      expect((await id().getGateState({}, as(ok.session!.accessToken))).universityId).toBe(NUTECH.id);
    });
    it.todo("W13: /auth/callback?error=access_denied redirects to /signin?error=google_domain and shows the message (web route)");

    // marketing.spec.ts:219
    it("live, personal, unknown and not-live domains; a request is sent once", async () => {
      const tag = `${env().transport}-${Date.now().toString(36)}`;
      const closed = { id: crypto.randomUUID(), domain: `closed-${tag}.test` };
      // A university people knows but has not opened (live_at null).
      await publish(w(), "people", "university.domains_changed", { university_id: closed.id, live_at: null, domains: [{ domain: closed.domain, kind: "both" }] });
      const live = await signUp(unique(NUTECH.domain, "hira"));
      expect(live.verificationSent).toBe(true);
      await expect(signUp(unique(PERSONAL, "hira"))).rejects.toSatisfy(refusedWith("personal_email"));
      await expect(signUp(unique("unknown-e2e.test", "hira"))).rejects.toSatisfy(refusedWith("university_not_on_skilient"));
      const waiting = unique(closed.domain, "hira");
      await expect(signUp(waiting)).rejects.toSatisfy(refusedWith("university_not_on_skilient"));
      expect(await accountsAt(waiting)).toBe(0);
      // When people opens it, the same address signs up.
      await publish(w(), "people", "university.domains_changed", { university_id: closed.id, live_at: new Date(Date.now() - 1000).toISOString(), domains: [{ domain: closed.domain, kind: "both" }] });
      const since = memoryOutbox.length;
      await signUp(waiting);
      const code = codeFrom((await latestEmail(waiting, "signup_code", since)).subject);
      const s = (await id().verifyEmail({ email: waiting, code }, env().call())).session!;
      expect((await id().getGateState({}, as(s.accessToken))).universityId).toBe(closed.id);
    });
    it.todo("W2/W13: the landing field's wording (\"X isn't on Skilient yet\", \"We don't recognise this university\") and university requests sent once are people's and web's");

    it("sign-up refusals carry codes and create nothing (breached, short, signed-out gate)", async () => {
      const email = unique(NUTECH.domain);
      await expect(signUp(email, { password: BREACHED })).rejects.toSatisfy(refusedWith("breached_password"));
      await expect(signUp(email, { password: "short" })).rejects.toSatisfy(refusedWith("invalid_input"));
      expect(await accountsAt(email)).toBe(0);
      await expect(id().getGateState({}, env().call())).rejects.toSatisfy(unauthenticated);
    });
  },
  worlds.options,
);
