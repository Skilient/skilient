/**
 * The world for the service-level journeys (decision 2026-11-25, Q5): each journey mirrors one Playwright
 * spec test and drives identity only through its contract, on both transports, reading email from the
 * memory outbox. Around identity:
 *   - Google's token endpoint and keys, and Have I Been Pwned's range API, are one local fake server;
 *   - the gate facts (university domains and live dates, the portals flag, profile facts) are published as
 *     the owning services will publish them (`appendEvents` as svc_people or svc_trust) and applied by
 *     identity's own gate consumer (`gateFactsConsumer().runOnce`), never written into identity's tables;
 *   - the two lists no event feeds (the personal-email domains and the published agreement version) are
 *     seeded as identity-owned reference data.
 */
import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Code, ConnectError, type CallOptions } from "@connectrpc/connect";
import { AccountRole, IdentityService } from "@skilient/contracts/identity/v1/identity_pb";
import { appendEvents, refusalReason, uuidv7, type Consumer } from "@skilient/platform";
import type { ContractEnv, TransportOptions } from "@skilient/testing";
import { decodeJwt, exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK } from "jose";
import type postgres from "postgres";
import { afterAll } from "vitest";
import { memoryOutbox, type Email } from "../../src/deps";
import { gateFactsConsumer, GATE_CONSUMER } from "../../src/store/gate-copies";
import { identityWorld, type World } from "../contract/world";

export const PASSWORD = "Skilient-e2e-Passw0rd!";
export const BREACHED = "Breached-Journey-Passw0rd-1";
export const GOOGLE_CLIENT = "journey-client.apps.test";
export const GOOGLE_SECRET = "journey-google-secret";
export const VERIFIER = "v".repeat(43);
export const CALLBACK = "http://127.0.0.1:3000/auth/callback";

/** Two live universities (as `nutech.edu.pk` and `nu.edu.pk` are on the local stack), and a personal domain. */
export const NUTECH = { id: "9a000000-0000-4000-8000-0000000000e1", domain: "nutech-journey.test" };
export const NU = { id: "9a000000-0000-4000-8000-0000000000e2", domain: "nu-journey.test" };
export const PERSONAL = "gmail-journey.test";

export const reason = (e: unknown) => refusalReason(e) ?? `code ${ConnectError.from(e).code}`;
export const refusedWith = (r: string) => (e: unknown) => reason(e) === r;
export const unauthenticated = (e: unknown) => ConnectError.from(e).code === Code.Unauthenticated;
export const gateFlagsOf = (accessToken: string) => decodeJwt(accessToken)["gate"] as Record<string, unknown>;
export const device = (c: string) => c.repeat(64);
export const IP = "1".repeat(64);

// ---------------------------------------------------------------------------
// The fake outside world: Google (token endpoint + JWKS) and HIBP (range API).
// ---------------------------------------------------------------------------
interface Fake {
  server: Server;
  grants: Map<string, Record<string, unknown>>;
  n: number;
}
let fake: Fake | undefined;

async function startFake(): Promise<Fake> {
  const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: "g1", alg: "RS256", use: "sig" };
  const breached = createHash("sha1").update(BREACHED).digest("hex").toUpperCase();
  const grants = new Map<string, Record<string, unknown>>();
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      void (async () => {
        const url = new URL(req.url ?? "/", "http://fake");
        if (url.pathname.startsWith("/range/")) {
          const hit = url.pathname.endsWith(breached.slice(0, 5)) ? `${breached.slice(5)}:42\r\n` : "";
          res.writeHead(200, { "content-type": "text/plain" }).end(`${hit}0000000000000000000000000000000000A:0`);
          return;
        }
        if (url.pathname === "/jwks") {
          res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ keys: [jwk] }));
          return;
        }
        if (url.pathname === "/token" && req.method === "POST") {
          const form = new URLSearchParams(Buffer.concat(chunks).toString());
          const claims = grants.get(form.get("code") ?? "");
          const ok =
            claims &&
            form.get("client_id") === GOOGLE_CLIENT &&
            form.get("client_secret") === GOOGLE_SECRET &&
            form.get("code_verifier") === VERIFIER &&
            form.get("redirect_uri") === CALLBACK;
          if (!ok) {
            res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: "invalid_grant" }));
            return;
          }
          grants.delete(form.get("code")!);
          const idToken = await new SignJWT(claims)
            .setProtectedHeader({ alg: "RS256", kid: "g1" })
            .setIssuer("https://accounts.google.com")
            .setAudience(GOOGLE_CLIENT)
            .setIssuedAt()
            .setExpirationTime("5m")
            .sign(privateKey as CryptoKey);
          res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ id_token: idToken, access_token: "unused", token_type: "Bearer" }));
          return;
        }
        res.writeHead(404).end();
      })();
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env["GOOGLE_CLIENT_ID"] = GOOGLE_CLIENT;
  process.env["GOOGLE_TOKEN_URL"] = `${base}/token`;
  process.env["GOOGLE_JWKS_URL"] = `${base}/jwks`;
  process.env["IDENTITY_HIBP_URL"] = `${base}/range/`;
  delete process.env["IDENTITY_APP_URL"];
  return { server, grants, n: 0 };
}

/** A Google authorization code the fake exchanges for an id_token with these claims. */
export function googleGrant(claims: Record<string, unknown>): string {
  const code = `journey-code-${++fake!.n}`;
  fake!.grants.set(code, { email_verified: true, ...claims });
  return code;
}

// ---------------------------------------------------------------------------
// One world per transport: Postgres with identity, people and trust roles, and identity's gate consumer.
// ---------------------------------------------------------------------------
export interface JourneyWorld extends World {
  people: postgres.Sql;
  trust: postgres.Sql;
  gate: Consumer;
}

export function journeyWorlds(): {
  options: () => Promise<TransportOptions>;
  current: () => JourneyWorld;
  all: World[];
  /** Call inside the describeTransports body: stops the transport's revocation follower before its host closes the shared connection. */
  stopEachTransport: () => void;
  stop: () => Promise<void>;
} {
  const all: World[] = [];
  let latest: JourneyWorld | undefined;
  let base: World | undefined;
  const stopped = new Set<World>();
  const start = identityWorld((w) => (base = w), all);
  // describeTransports runs `options()` in each transport's beforeAll, just before that transport's tests,
  // so `current()` is the world of the transport under test.
  return {
    all,
    current: () => latest!,
    stopEachTransport() {
      // Hooks run in reverse order of registration, so this runs before describeTransports closes the host
      // (which ends the connection the revocation follower listens on).
      afterAll(async () => {
        if (latest && !stopped.has(latest)) {
          stopped.add(latest);
          await latest.revocations.stop();
        }
      });
    },
    async options() {
      fake ??= await startFake();
      const o = await start();
      const empty = () => mkdtempSync(join(tmpdir(), "journey-mig-"));
      const w: JourneyWorld = { ...base!, people: await base!.pg.service("people", empty()), trust: await base!.pg.service("trust", empty()), gate: gateFactsConsumer({ sql: base!.sql }) };
      latest = w;
      // Reference data no event feeds: the personal-email list and the published agreement.
      await w.sql`insert into identity.personal_email_domains (domain) values (${PERSONAL})`;
      await w.sql`insert into identity.agreement_versions (version, title, published_at) values (1, 'v1', now() - interval '1 day')`;
      // The gate facts, as people and trust publish them.
      await publish(w, "trust", "config.portals_changed", { recruiter: false, university: false, faculty: true });
      for (const u of [NUTECH, NU]) await publish(w, "people", "university.domains_changed", { university_id: u.id, live_at: "2026-01-01T00:00:00Z", domains: [{ domain: u.domain, kind: "both" }] });
      return { ...o, secrets: { ...o.secrets, "google-oauth-client-secret": GOOGLE_SECRET } };
    },
    async stop() {
      for (const w of all) if (!stopped.has(w)) await w.revocations.stop().catch(() => {});
      for (const w of all) await w.pg.stop();
      await new Promise((r) => (fake ? fake.server.close(r) : r(undefined)));
    },
  };
}

/**
 * Publishes an event as its owning service and waits until identity's gate consumer has applied it (the
 * consumer reads only committed transactions older than every open one, so it may take a few runs).
 */
export async function publish(w: JourneyWorld, producer: "people" | "trust", type: string, payload: Record<string, unknown>): Promise<void> {
  const db = producer === "people" ? w.people : w.trust;
  const id = uuidv7();
  const subjects = typeof payload["user_id"] === "string" ? [payload["user_id"]] : [];
  await db.begin((tx) => appendEvents(tx, [{ id, type, subjects, payload }]));
  const t0 = Date.now();
  while (Date.now() - t0 < 10_000) {
    await w.gate.runOnce();
    const [done] = await w.sql`select 1 from platform.applied_events where consumer = ${GATE_CONSUMER} and event_id = ${id}`;
    if (done) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`event ${type} was not applied by ${GATE_CONSUMER}`);
}

/** people's `profile.gate_changed` for a student who finished onboarding. */
export function onboard(w: JourneyWorld, userId: string, universityId: string, status: "active" | "deleting" = "active"): Promise<void> {
  return publish(w, "people", "profile.gate_changed", {
    user_id: userId,
    has_profile: true,
    role: "student",
    university_id: universityId,
    onboarding_complete: true,
    onboarding_step: 6,
    status,
  });
}

// ---------------------------------------------------------------------------
// Mail
// ---------------------------------------------------------------------------
/** The newest email of `kind` to `to` sent after `since` (an outbox index); polls, as reset mail is not awaited. */
export async function latestEmail(to: string, kind: Email["kind"], since = 0): Promise<Email> {
  const t0 = Date.now();
  while (Date.now() - t0 < 5_000) {
    const mail = memoryOutbox
      .slice(since)
      .reverse()
      .find((m) => m.to === to && m.kind === kind);
    if (mail) return mail;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`no ${kind} email to ${to}`);
}
export const codeFrom = (subject: string) => /(\d{6})/.exec(subject)?.[1] ?? "";
export const mailsTo = (to: string, since: number) => memoryOutbox.slice(since).filter((m) => m.to === to);

// ---------------------------------------------------------------------------
// Contract helpers (what web's server actions will call).
// ---------------------------------------------------------------------------
export function journeyClient(env: () => ContractEnv) {
  const id = () => env().client(IdentityService);
  const as = (accessToken: string): CallOptions => env().call({ userToken: accessToken });
  let n = 0;
  const unique = (domain: string, tag = "e2e") => `${tag}-${env().transport}-${Date.now().toString(36)}-${++n}@${domain}`;
  const signUp = (email: string, extra: Partial<{ password: string; role: AccountRole; fullName: string; agreementVersion: number; universityId: string }> = {}) =>
    id().signUp({ email, password: PASSWORD, role: AccountRole.STUDENT, fullName: "Hina Test", agreementVersion: 1, universityId: "", captchaToken: "", ...extra }, env().call());
  const signIn = (email: string, password = PASSWORD, dev = device("d")) =>
    id().signInPassword({ email, password, deviceHash: dev, ipHash: IP, userAgent: "journey/1.0", captchaToken: "" }, env().call());

  /**
   * `createStudent` from apps/web/tests/e2e/support.ts, through the contract: sign up, confirm with the
   * emailed code, accept the agreement (unless `agreement: false`), and finish onboarding as people reports it.
   */
  async function createStudent(w: JourneyWorld, opts: { uni?: typeof NUTECH; fullName?: string; agreement?: boolean; onboarded?: boolean } = {}) {
    const uni = opts.uni ?? NUTECH;
    const email = unique(uni.domain);
    const since = memoryOutbox.length;
    const { userId } = await signUp(email, { fullName: opts.fullName ?? "Test Student", agreementVersion: opts.agreement === false ? 0 : 1 });
    const code = codeFrom((await latestEmail(email, "signup_code", since)).subject);
    const session = (await id().verifyEmail({ email, code }, env().call())).session!;
    if (opts.onboarded ?? true) await onboard(w, userId, uni.id);
    return { id: userId, email, password: PASSWORD, session };
  }

  /** Polls until a call with this access token is refused as signed out; returns the milliseconds it took. */
  async function refusedWithin(accessToken: string, ms = 2_000): Promise<number> {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const refused = await id()
        .getGateState({}, as(accessToken))
        .then(() => false)
        .catch(unauthenticated);
      if (refused) return Date.now() - t0;
      await new Promise((r) => setTimeout(r, 25));
    }
    return Infinity;
  }

  return { id, as, unique, signUp, signIn, createStudent, refusedWithin };
}
