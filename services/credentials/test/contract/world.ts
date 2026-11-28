/**
 * The contract world for credentials: community's world (identity, people, content, messaging, realtime, work,
 * ranking and community, each under its own role) plus credentials' schema, with a signing key and an export secret
 * made for the run and passed as the Key Vault secrets credentials-signing-key and credentials-export-secret through
 * TransportOptions.secrets (never stored). Credentials' background work is off: tests run its consumers with
 * `drain` (which runs everyone else's too) and its jobs with `jobs`.
 */
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { createClientFactory, startCall, type Job } from "@skilient/platform";
import type { TransportOptions } from "@skilient/testing";
import type postgres from "postgres";
import { communityWorld, drain as drainCommunity, type CommunityWorld } from "../../../community/test/contract/world";
import { credentialsJobs } from "../../src/jobs";
import { ports, type Files, type Renderer } from "../../src/ports";
import { signingSecret } from "../../src/signing/keys";
import { generateSigningKey, type SigningKey } from "../../src/signing/sign";
import { copiesConsumer, COPIES_CONSUMER, COPY_EVENTS, issuingConsumer, ISSUING_CONSUMER, ISSUING_EVENTS } from "../../src/store/consumers";

export const MIGRATIONS = join(import.meta.dirname, "../../migrations");
export { NU, NUTECH, stopWorlds, student } from "../../../community/test/contract/world";

export interface CredentialsWorld extends CommunityWorld {
  credentials: postgres.Sql;
  signingKey: SigningKey;
  exportSecret: string;
  /** The files media would hold (W9): path → bytes. */
  files: Map<string, Uint8Array>;
}

const signingKey = generateSigningKey();
const exportSecret = randomBytes(32).toString("hex");

export function credentialsWorld(onWorld: (w: CredentialsWorld) => void, worlds: CredentialsWorld[] = []): () => Promise<TransportOptions> {
  process.env["CREDENTIALS_JOBS"] = "off";
  let base: CommunityWorld | undefined;
  const start = communityWorld((w) => (base = w), []);
  return async () => {
    const o = await start();
    const credentials = await base!.pg.service("credentials", MIGRATIONS);
    const w: CredentialsWorld = { ...base!, credentials, signingKey, exportSecret, files: new Map() };
    worlds.push(w);
    onWorld(w);
    const db = o.database!;
    return {
      ...o,
      secrets: { ...o.secrets, "credentials-signing-key": signingSecret(signingKey), "credentials-export-secret": exportSecret },
      database: (s: string) => (s === "credentials" ? credentials : db(s)),
    };
  };
}

async function pending(sql: postgres.Sql, consumer: string, types: readonly string[]): Promise<number> {
  const [r] = await sql<{ n: number }[]>`
    select count(*)::int as n from platform.events e
     where e.type = any(${[...types]}::text[])
       and not exists (select 1 from platform.applied_events a where a.consumer = ${consumer} and a.event_id = e.id)`;
  return r!.n;
}

/** The ports the jobs and the issuing consumer use, calling the host's services as credentials. */
export const portsOf = (host: { clientsFor(caller: string): ReturnType<typeof createClientFactory> }) => ports(host.clientsFor("credentials"));

/** Runs every consumer until all have read what they handle: everyone else's, credentials' two, then everyone's again. */
export async function drain(w: CredentialsWorld, host: { clientsFor(caller: string): ReturnType<typeof createClientFactory> }): Promise<void> {
  await drainCommunity(w);
  const p = portsOf(host);
  for (const [c, name, types] of [
    [copiesConsumer({ sql: w.credentials }), COPIES_CONSUMER, COPY_EVENTS],
    [issuingConsumer({ sql: w.credentials, ports: p }), ISSUING_CONSUMER, ISSUING_EVENTS],
  ] as const) {
    for (let i = 0; i < 200 && (await pending(w.credentials, name, types)) > 0; i++) await c.runOnce();
    if ((await pending(w.credentials, name, types)) > 0) throw new Error(`${name} did not catch up`);
  }
  await drainCommunity(w);
}

/** The files and renderer fakes (media and the render job's Chromium, W9 and W13). */
export const fakeFiles = (w: CredentialsWorld): Files => ({
  size: async (path) => w.files.get(path)?.length ?? null,
  put: async (path, bytes) => void w.files.set(path, bytes),
});
export const fakeRenderer: Renderer = { render: async (kind, doc) => new TextEncoder().encode(`%PDF-1.7 ${kind} ${JSON.stringify(doc).length}`) };

/** Runs credentials' queued jobs of these kinds (as the worker would), each committed; returns how many ran. */
export async function jobs(w: CredentialsWorld, host: { clientsFor(caller: string): ReturnType<typeof createClientFactory> }, kinds: string[] = ["record-sign", "cv-issue", "render"]): Promise<number> {
  const handlers = credentialsJobs({
    logger: { info() {}, warn() {}, error() {}, debug() {} } as never,
    ports: portsOf(host),
    key: { keyId: w.signingKey.keyId, privateKey: w.signingKey.privateKey },
    files: fakeFiles(w),
    renderer: fakeRenderer,
  });
  let n = 0;
  for (let round = 0; round < 5; round++) {
    const queued = await w.credentials<Job[]>`
      select id::text, kind, payload, attempts, max_attempts from platform.jobs where owner = 'svc_credentials' and status = 'queued' and kind = any(${kinds}::text[]) order by id`;
    if (!queued.length) break;
    for (const j of queued) {
      await w.credentials.begin((tx) => handlers[j.kind]!(tx, j));
      await w.credentials`update platform.jobs set status = 'done', finished_at = now() where id = ${j.id}::bigint`;
      n++;
    }
  }
  void startCall;
  return n;
}

/** Credentials' events of a type (what ranking, notify, people and media read). */
export const eventsOf = (w: CredentialsWorld, type: string) =>
  w.credentials<{ payload: Record<string, unknown>; producer: string }[]>`select payload, producer from platform.events where type = ${type} order by seq`.then((r) => [...r]);
