/**
 * Sign-up, email codes, the agreement, the gate state, sign-up details for people and Google sign-in, on both
 * transports (W1 steps 3, 4 and 6). Google and Have I Been Pwned are a local fake server: no real network.
 */
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Code, ConnectError } from "@connectrpc/connect";
import { AccountRole, IdentityService } from "@skilient/contracts/identity/v1/identity_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { decodeJwt, exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK } from "jose";
import { afterAll, expect, it } from "vitest";
import { memoryOutbox } from "../../src/deps";
import { applyDomainsChanged, applyPortalsChanged } from "../../src/store/gate-copies";
import { createUser, DEVICE, identityWorld, IP, stopWorlds, type World } from "./world";

const worlds: World[] = [];
let world: World;
const CLIENT_ID = "contract-client.apps.test";
const UNI = "9a000000-0000-4000-8000-0000000000c1";
const BREACHED = "Breached-Passw0rd-1";
const PASSWORD = "Contract-Passw0rd-1";
const VERIFIER = "v".repeat(43);

// ---------------------------------------------------------------------------
// The fake: Google's token endpoint and keys, and HIBP's range API.
// ---------------------------------------------------------------------------
let fake: Server;
let base = "";
let googleKey: CryptoKey;
let googleJwk: JWK;
let otherKey: CryptoKey;
/** Authorization code → the id_token claims Google would return for it. */
const grants = new Map<string, Record<string, unknown>>();
let grantCount = 0;

async function startFake(): Promise<void> {
  ({ privateKey: googleKey } = await generateKeyPair("RS256", { extractable: true }).then(async (k) => {
    googleJwk = { ...(await exportJWK(k.publicKey)), kid: "g1", alg: "RS256", use: "sig" };
    return k;
  }));
  ({ privateKey: otherKey } = await generateKeyPair("RS256"));
  const sha = createHash("sha1").update(BREACHED).digest("hex").toUpperCase();
  fake = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      void (async () => {
        const url = new URL(req.url ?? "/", "http://fake");
        if (url.pathname.startsWith("/range/")) {
          const lines = url.pathname.endsWith(sha.slice(0, 5)) ? `${sha.slice(5)}:42\r\n0000000000000000000000000000000000A:0` : "0000000000000000000000000000000000A:0";
          res.writeHead(200, { "content-type": "text/plain" }).end(lines);
          return;
        }
        if (url.pathname === "/jwks") {
          res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ keys: [googleJwk] }));
          return;
        }
        if (url.pathname === "/token" && req.method === "POST") {
          const form = new URLSearchParams(Buffer.concat(chunks).toString());
          const claims = grants.get(form.get("code") ?? "");
          const ok =
            claims &&
            form.get("grant_type") === "authorization_code" &&
            form.get("client_id") === CLIENT_ID &&
            form.get("client_secret") === "contract-google-secret" &&
            form.get("code_verifier") === VERIFIER &&
            form.get("redirect_uri") === "http://127.0.0.1:3000/auth/callback";
          if (!ok) {
            res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: "invalid_grant" }));
            return;
          }
          grants.delete(form.get("code")!); // one use, as at Google
          const { _key, _aud, ...rest } = claims as Record<string, unknown> & { _key?: string; _aud?: string };
          const token = await new SignJWT(rest)
            .setProtectedHeader({ alg: "RS256", kid: "g1" })
            .setIssuer("https://accounts.google.com")
            .setAudience(_aud ?? CLIENT_ID)
            .setIssuedAt()
            .setExpirationTime("5m")
            .sign(_key === "other" ? otherKey : googleKey);
          res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ id_token: token, access_token: "unused", token_type: "Bearer" }));
          return;
        }
        res.writeHead(404).end();
      })();
    });
  });
  await new Promise<void>((r) => fake.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`;
  process.env["GOOGLE_CLIENT_ID"] = CLIENT_ID;
  process.env["GOOGLE_TOKEN_URL"] = `${base}/token`;
  process.env["GOOGLE_JWKS_URL"] = `${base}/jwks`;
  process.env["IDENTITY_HIBP_URL"] = `${base}/range/`;
  delete process.env["IDENTITY_APP_URL"];
}

/** A Google authorization code that yields these claims. */
function grant(claims: Record<string, unknown>): string {
  const code = `code-${++grantCount}`;
  grants.set(code, { email_verified: true, ...claims });
  return code;
}

const world0 = identityWorld((w) => (world = w), worlds);
async function options() {
  if (!fake) await startFake();
  const o = await world0();
  // Gate copies as people and trust would send them; agreement version 1 is current.
  await world.sql.begin(async (tx) => {
    await applyPortalsChanged(tx, { recruiter: false, university: false, faculty: true });
    await applyDomainsChanged(tx, { university_id: UNI, live_at: "2026-01-01T00:00:00Z", domains: [{ domain: "contract-uni.test", kind: "both" }] });
    await tx`insert into identity.personal_email_domains (domain) values ('contract-mail.test')`;
    await tx`insert into identity.agreement_versions (version, title, published_at) values (1, 'v1', now() - interval '1 day')`;
  });
  return { ...o, secrets: { ...o.secrets, "google-oauth-client-secret": "contract-google-secret" } };
}
afterAll(async () => {
  await stopWorlds(worlds);
  await new Promise((r) => fake?.close(r));
});

const reason = (e: unknown) => refusalReason(e) ?? `code ${ConnectError.from(e).code}`;
const codeIn = (to: string, kind: string) => {
  const mail = [...memoryOutbox].reverse().find((m) => m.to === to && m.kind === kind);
  return /\b(\d{6})\b/.exec(mail?.text ?? "")?.[1];
};

describeTransports(
  ["identity"],
  (env) => {
    const id = (as?: string) => env().client(IdentityService, as);
    const t = () => env().transport;
    const as = (accessToken: string) => env().call({ userToken: accessToken });
    const signUp = (email: string, extra: Partial<{ password: string; role: AccountRole; fullName: string; agreementVersion: number; universityId: string }> = {}) =>
      id().signUp({ email, password: PASSWORD, role: AccountRole.STUDENT, fullName: "Contract Person", agreementVersion: 1, universityId: "", captchaToken: "", ...extra }, env().call());
    const google = (code: string, extra: Partial<{ redirectUri: string }> = {}) =>
      id().signInWithGoogle(
        { code, codeVerifier: VERIFIER, redirectUri: "http://127.0.0.1:3000/auth/callback", deviceHash: DEVICE, ipHash: IP, userAgent: "contract/1.0", agreementVersion: 0, ...extra },
        env().call(),
      );

    it("signs up, emails a code, verifies it into a session, and gives people the name", async () => {
      const email = `new-${t()}@contract-uni.test`;
      const r = await signUp(email);
      expect(r.verificationSent).toBe(true);
      const code = codeIn(email, "signup_code");
      expect(code).toMatch(/^\d{6}$/);
      const [row] = await world.sql`select role, email_confirmed_at from identity.users where id = ${r.userId}`;
      expect(row).toEqual({ role: "student", email_confirmed_at: null });
      // user.created: ids and flags only.
      const [event] = await world.sql<{ payload: Record<string, unknown> }[]>`select payload from platform.events where type = 'user.created' and ${r.userId}::uuid = any(subjects)`;
      expect(event!.payload).toMatchObject({ role: "student", university_id: UNI, provider: "email", onboarding_step: 1, agreement_accepted: true });
      expect(JSON.stringify(event!.payload)).not.toMatch(/contract-uni|Contract Person/);
      // People reads the name in one batch call; web may not.
      const details = await id("people").getSignupDetails({ userIds: [r.userId, "9a000000-0000-4000-8000-0000000000ff"] }, env().call());
      expect(details.users).toEqual([expect.objectContaining({ userId: r.userId, fullName: "Contract Person", role: AccountRole.STUDENT, universityId: UNI })]);
      await expect(id().getSignupDetails({ userIds: [r.userId] }, env().call())).rejects.toSatisfy((e) => ConnectError.from(e).code === Code.PermissionDenied);
      await expect(id("people").getSignupDetails({ userIds: ["nope"] }, env().call())).rejects.toSatisfy((e) => reason(e) === "invalid_input");

      await expect(id().verifyEmail({ email, code: code === "000000" ? "111111" : "000000" }, env().call())).rejects.toSatisfy((e) => reason(e) === "invalid_code");
      const v = await id().verifyEmail({ email, code: code! }, env().call());
      expect(v.session?.accessToken).toBeTruthy();
      await expect(id().verifyEmail({ email, code: code! }, env().call())).rejects.toSatisfy((e) => reason(e) === "invalid_code"); // used up

      const gate = await id().getGateState({}, as(v.session!.accessToken));
      expect(gate).toMatchObject({ hasProfile: true, role: AccountRole.STUDENT, universityId: UNI, onboardingComplete: false, onboardingStep: 1, agreementVersion: 1, agreementAccepted: true, emailAllowed: true, status: "active" });
      expect(gate.portals).toMatchObject({ recruiter: false, university: false, faculty: true });
      // The same flags travel in the access token (decision Q1).
      expect(decodeJwt(v.session!.accessToken)["gate"]).toMatchObject({ has_profile: true, email_allowed: true, agreement_accepted: true, role: "student" });
    });

    it("refuses each signup gate with a short reason, and tells a registered address to sign in", async () => {
      await expect(signUp(`x-${t()}@contract-mail.test`)).rejects.toSatisfy((e) => reason(e) === "personal_email");
      await expect(signUp(`x-${t()}@nowhere.test`)).rejects.toSatisfy((e) => reason(e) === "university_not_on_skilient");
      await expect(signUp(`hr-${t()}@company.test`, { role: AccountRole.RECRUITER })).rejects.toSatisfy((e) => reason(e) === "recruiter_portal_closed");
      await expect(signUp(`x-${t()}@contract-uni.test`, { universityId: "9a000000-0000-4000-8000-0000000000ff" })).rejects.toSatisfy((e) => reason(e) === "wrong_university");
      await expect(signUp(`x-${t()}@contract-uni.test`, { password: "short" })).rejects.toSatisfy((e) => reason(e) === "invalid_input");
      await expect(signUp(`x-${t()}@contract-uni.test`, { password: BREACHED })).rejects.toSatisfy((e) => reason(e) === "breached_password");
      expect(await world.sql`select 1 from identity.users where email like ${`x-${t()}@%`}`).toEqual([]);

      const email = `taken-${t()}@contract-uni.test`;
      const uid = await createUser(world.sql, email, PASSWORD);
      const before = memoryOutbox.length;
      await expect(signUp(email)).rejects.toSatisfy((e) => reason(e) === "already_registered"); // as today (Ahmed, 2026-11-25)
      void uid;
      expect(memoryOutbox.slice(before).filter((m) => m.to === email)).toEqual([]); // confirmed: nothing sent
      expect(await world.sql`select count(*)::int as n from identity.users where email = ${email}`).toEqual([{ n: 1 }]);

      // An address that never confirmed gets a fresh code, as Supabase resent the confirmation.
      const pending = `pending-${t()}@contract-uni.test`;
      const pid = await createUser(world.sql, pending, PASSWORD, { confirmed: false });
      const sent = memoryOutbox.length;
      expect(await signUp(pending)).toMatchObject({ userId: pid, verificationSent: true });
      expect(memoryOutbox.slice(sent).filter((m) => m.to === pending).map((m) => m.kind)).toEqual(["signup_code"]);
    });

    it("a code stops working after five wrong tries", async () => {
      const email = `tries-${t()}@contract-uni.test`;
      await signUp(email);
      const code = codeIn(email, "signup_code")!;
      const wrong = code === "123456" ? "654321" : "123456";
      for (let i = 0; i < 5; i++) await expect(id().verifyEmail({ email, code: wrong }, env().call())).rejects.toSatisfy((e) => reason(e) === "invalid_code");
      await expect(id().verifyEmail({ email, code }, env().call())).rejects.toSatisfy((e) => reason(e) === "too_many_attempts");
      const [row] = await world.sql`select c.attempts from identity.email_codes c join identity.users u on u.id = c.user_id where u.email = ${email} and c.used_at is null`;
      expect(row?.["attempts"]).toBe(5);
    });

    it("emails a sign-in code only to an existing account, and the code signs in once", async () => {
      const email = `code-${t()}@contract-uni.test`;
      await createUser(world.sql, email, PASSWORD);
      const before = memoryOutbox.length;
      await id().requestEmailCode({ email: `ghost-${t()}@contract-uni.test`, captchaToken: "" }, env().call());
      expect(memoryOutbox.length).toBe(before); // same answer, no email
      await id().requestEmailCode({ email, captchaToken: "" }, env().call());
      const code = codeIn(email, "signin_code")!;
      const r = await id().signInWithCode({ email, code, deviceHash: DEVICE, ipHash: IP, userAgent: "contract/1.0" }, env().call());
      expect(r.session?.aal).toBe("aal1");
      await expect(id().signInWithCode({ email, code, deviceHash: DEVICE, ipHash: IP, userAgent: "contract/1.0" }, env().call())).rejects.toSatisfy(
        (e) => reason(e) === "invalid_code",
      );
      await expect(id().signInWithCode({ email: `ghost-${t()}@contract-uni.test`, code, deviceHash: DEVICE, ipHash: IP, userAgent: "x" }, env().call())).rejects.toSatisfy(
        (e) => reason(e) === "invalid_code",
      );
      for (let i = 0; i < 4; i++) await id().requestEmailCode({ email, captchaToken: "" }, env().call());
      await expect(id().requestEmailCode({ email, captchaToken: "" }, env().call())).rejects.toSatisfy((e) => reason(e) === "rate_limited"); // 5 an hour
    });

    it("accepts the current agreement once; a stale version or a signed-out caller is refused", async () => {
      const email = `agree-${t()}@contract-uni.test`;
      await signUp(email, { agreementVersion: 0 });
      const s = (await id().verifyEmail({ email, code: codeIn(email, "signup_code")! }, env().call())).session!;
      expect((await id().getGateState({}, as(s.accessToken))).agreementAccepted).toBe(false);
      await expect(id().acceptAgreement({ version: 2, ipHash: IP }, as(s.accessToken))).rejects.toSatisfy((e) => reason(e) === "stale_version");
      await id().acceptAgreement({ version: 1, ipHash: IP }, as(s.accessToken));
      await id().acceptAgreement({ version: 1, ipHash: IP }, as(s.accessToken)); // again: done, no second row
      const [n] = await world.sql`select count(*)::int as n from identity.agreement_acceptances a join identity.users u on u.id = a.user_id where u.email = ${email}`;
      expect(n?.["n"]).toBe(1);
      expect((await id().getGateState({}, as(s.accessToken))).agreementAccepted).toBe(true);
      await expect(id().acceptAgreement({ version: 1, ipHash: IP }, env().call())).rejects.toSatisfy((e) => ConnectError.from(e).code === Code.Unauthenticated);
      await expect(id().getGateState({}, env().call())).rejects.toSatisfy((e) => ConnectError.from(e).code === Code.Unauthenticated);
    });

    it("Google: a university account signs up as a student, then signs in by its Google id", async () => {
      const email = `g-${t()}@contract-uni.test`;
      const sub = `sub-${t()}-1`;
      const first = await google(grant({ sub, email, name: "Google Person" }));
      expect(first.newAccount).toBe(true);
      const [user] = await world.sql<{ id: string; role: string; confirmed: boolean }[]>`
        select id, role, email_confirmed_at is not null as confirmed from identity.users where email = ${email}`;
      expect([user?.role, user?.confirmed]).toEqual(["student", true]);
      expect(await world.sql`select provider, user_id from identity.identities where provider_user_id = ${sub}`).toEqual([{ provider: "google", user_id: user!.id }]);
      const details = await id("people").getSignupDetails({ userIds: [user!.id] }, env().call());
      expect(details.users[0]?.fullName).toBe("Google Person");
      const again = await google(grant({ sub, email: `renamed-${t()}@contract-uni.test` }));
      expect(again.newAccount).toBe(false);
      expect(decodeJwt(again.session!.accessToken).sub).toBe(user!.id);
    });

    it("Google: links an existing account by its verified address, and refuses what today's gate refuses", async () => {
      const email = `pw-then-g-${t()}@contract-uni.test`;
      const uid = await createUser(world.sql, email, PASSWORD);
      await world.sql`insert into identity.profile_facts (user_id, has_profile, role, university_id, onboarding_complete, onboarding_step) values (${uid}, true, 'student', ${UNI}, true, 6)`;
      const linked = await google(grant({ sub: `sub-${t()}-2`, email }));
      expect(linked.newAccount).toBe(false);
      expect(decodeJwt(linked.session!.accessToken).sub).toBe(uid);

      await expect(google(grant({ sub: `sub-${t()}-3`, email: `x-${t()}@contract-mail.test` }))).rejects.toSatisfy((e) => reason(e) === "google_domain");
      await expect(google(grant({ sub: `sub-${t()}-4`, email: `x-${t()}@contract-uni.test`, email_verified: false }))).rejects.toSatisfy(
        (e) => reason(e) === "google_email_unverified",
      );
      await expect(google(grant({ sub: `sub-${t()}-5`, email: `x-${t()}@contract-uni.test`, _aud: "someone-else" }))).rejects.toSatisfy(
        (e) => reason(e) === "google_token_invalid",
      );
      await expect(google(grant({ sub: `sub-${t()}-6`, email: `x-${t()}@contract-uni.test`, _key: "other" }))).rejects.toSatisfy((e) => reason(e) === "google_token_invalid");
      await expect(google("never-issued")).rejects.toSatisfy((e) => reason(e) === "google_exchange_failed");
      await expect(google(grant({ sub: `sub-${t()}-7`, email }), { redirectUri: "https://evil.test/auth/callback" })).rejects.toSatisfy(
        (e) => reason(e) === "redirect_uri_invalid",
      );
      expect(await world.sql`select 1 from identity.users where email like ${`x-${t()}@%`}`).toEqual([]);
    });
  },
  options,
);
