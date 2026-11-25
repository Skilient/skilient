import { IdentityService } from "@skilient/contracts/identity/v1/identity_pb";
import { createScheduler, createWorker, defineService, type Consumer, type Scheduler, type Worker } from "@skilient/platform";
import type postgres from "postgres";
import { createApi } from "./api";
import { callers } from "./authorize";
import { brevoMailer, mailpitMailer, memoryMailer, type ApiDeps, type Mailer } from "./deps";
import { identityJobs, identitySchedules } from "./jobs";
import { loadSigningKeys } from "./keys";
import { gateFlags } from "./store/gate";
import { gateFactsConsumer } from "./store/gate-copies";

let sql: postgres.Sql | undefined;
let worker: Worker | undefined;
let scheduler: Scheduler | undefined;
let gateFacts: Consumer | undefined;

/**
 * identity (W1): accounts, sign-in, sessions, two-factor, signup gates, agreement versions, staff roles and
 * deletion. Reads, from Key Vault (or SECRET_<NAME> locally): identity-signing-key-<kid>, identity-refresh-pepper,
 * identity-totp-key, and when used brevo-api-key, google-oauth-client-secret, turnstile-secret-key.
 * Variables: IDENTITY_SIGNING_KIDS, IDENTITY_MAILER (brevo | mailpit | memory), MAILPIT_URL, IDENTITY_APP_URL,
 * GOOGLE_CLIENT_ID, IDENTITY_JOBS (off to run no background jobs, for tests).
 * Serves its public keys at GET /.well-known/jwks.json on the HTTP/1.1 port.
 */
export default defineService({
  name: "identity",
  contract: IdentityService,
  callers,
  async create(deps) {
    sql = deps.database();
    const env = process.env;
    const keys = await loadSigningKeys(deps.secrets, env["IDENTITY_SIGNING_KIDS"]);
    const totpKey = Buffer.from(await deps.secrets.get("identity-totp-key"), "base64url");
    if (totpKey.length !== 32) throw new Error("identity-totp-key must be 32 bytes, base64url");
    const mailerKind = env["IDENTITY_MAILER"] ?? (env["SKILIENT_ENV"] === "production" ? "brevo" : "memory");
    let mailer: Mailer;
    if (mailerKind === "brevo") mailer = brevoMailer(await deps.secrets.get("brevo-api-key"));
    else if (mailerKind === "mailpit") mailer = mailpitMailer(env["MAILPIT_URL"] ?? "http://127.0.0.1:54324");
    else if (mailerKind === "memory" && env["SKILIENT_ENV"] !== "production") mailer = memoryMailer;
    else throw new Error(`IDENTITY_MAILER=${mailerKind} is not allowed here`);
    const googleId = env["GOOGLE_CLIENT_ID"];
    const api: ApiDeps = {
      sql,
      keys,
      logger: deps.logger,
      mailer,
      clients: deps.clients,
      refreshPepper: await deps.secrets.get("identity-refresh-pepper"),
      totpKey,
      gateFlags,
      turnstileSecret: await deps.secrets.get("turnstile-secret-key").catch(() => undefined),
      google: googleId
        ? {
            clientId: googleId,
            clientSecret: await deps.secrets.get("google-oauth-client-secret"),
            tokenUrl: env["GOOGLE_TOKEN_URL"] ?? "https://oauth2.googleapis.com/token",
            jwksUrl: env["GOOGLE_JWKS_URL"] ?? "https://www.googleapis.com/oauth2/v3/certs",
            issuer: "https://accounts.google.com",
          }
        : undefined,
    };
    deps.http.get("/.well-known/jwks.json", async () => ({ status: 200, body: keys.jwks(), headers: { "cache-control": "public, max-age=300" } }));
    if (env["IDENTITY_JOBS"] !== "off") {
      worker = createWorker({ sql, workerId: deps.instance, handlers: identityJobs(api), logger: deps.logger });
      scheduler = createScheduler({ sql, schedules: identitySchedules(), logger: deps.logger });
      await scheduler.start();
      worker.start();
      // Keeps identity's copies of the gate facts current (decision Q1).
      gateFacts = gateFactsConsumer({ sql, logger: deps.logger });
      await gateFacts.start();
    }
    return createApi(api);
  },
  async ready() {
    if (!sql) return false;
    await sql`select 1`;
    return true;
  },
  async close() {
    await gateFacts?.stop();
    scheduler?.stop();
    await worker?.stop();
  },
});
