import { CredentialsService } from "@skilient/contracts/credentials/v1/credentials_pb";
import { createScheduler, createWorker, defineService, type Consumer, type Scheduler, type Worker } from "@skilient/platform";
import type postgres from "postgres";
import { createApi } from "./api";
import { callers } from "./authorize";
import { credentialsJobs, credentialsSchedules } from "./jobs";
import { noFiles, noRenderer, ports } from "./ports";
import { installKey, parseSigningSecret } from "./signing/keys";
import { copiesConsumer, issuingConsumer } from "./store/consumers";

let sql: postgres.Sql | undefined;
let consumers: Consumer[] = [];
let worker: Worker | undefined;
let scheduler: Scheduler | undefined;

/**
 * credentials (W8): the Record (entries signed with the CV key, claims, share links, corrections, officers'
 * confirm, correct, decline and revoke, transcripts and certificates, verify) and verified CVs (snapshots, settings,
 * signed versions, re-issue and the monthly refresh, the public key file, share links and views, verify, revoke,
 * PDF exports), with the signing itself (ported from the cv-sign Edge Function) as platform jobs.
 *
 * Variables: CREDENTIALS_JOBS (off to run no background work: no consumers, schedules or job worker; for tests).
 * Secrets (Key Vault): credentials-signing-key (JSON {key_id, private_key}: the Ed25519 key, PKCS#8 base64; a new key
 * id installs itself and retires the old one) and credentials-export-secret (the MAC key web's PDF routes share).
 */
export default defineService({
  name: "credentials",
  contract: CredentialsService,
  callers,
  async create(deps) {
    sql = deps.database();
    const key = await installKey(sql, parseSigningSecret(await deps.secrets.get("credentials-signing-key")));
    const exportSecret = await deps.secrets.get("credentials-export-secret");
    const p = ports(deps.clients);
    // Files are media's and the Chromium renderer is the render job's image (W9, W13); until then neither exists.
    const files = noFiles;
    const renderer = noRenderer;
    if (process.env["CREDENTIALS_JOBS"] !== "off") {
      consumers = [copiesConsumer({ sql, logger: deps.logger }), issuingConsumer({ sql, ports: p, logger: deps.logger })];
      for (const c of consumers) await c.start();
      worker = createWorker({ sql, workerId: deps.instance, handlers: credentialsJobs({ logger: deps.logger, ports: p, key, files, renderer }), logger: deps.logger });
      scheduler = createScheduler({ sql, schedules: credentialsSchedules(), logger: deps.logger });
      worker.start();
      await scheduler.start();
    }
    return createApi({ sql, logger: deps.logger, ports: p, key, exportSecret, files, renderer });
  },
  async ready() {
    if (!sql) return false;
    await sql`select 1`;
    return true;
  },
  async close() {
    scheduler?.stop();
    await worker?.stop();
    for (const c of consumers) await c.stop();
    consumers = [];
    worker = undefined;
    scheduler = undefined;
  },
});
