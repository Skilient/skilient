/**
 * Media for any service's tests: wraps a world's start so the same Postgres also holds media's schema, puts the
 * in-memory store in place (src/storage/memory.ts; decisions.md, W9), and turns the owners' file checks on
 * (MEDIA_CHECKS). Add "media" to the hosted services. `upload` does what the browser does: asks media for a link as
 * the user, then PUTs the bytes.
 */
import { join } from "node:path";
import { MediaService } from "@skilient/contracts/media/v1/media_pb";
import type { ContractEnv, TransportOptions } from "@skilient/testing";
import type postgres from "postgres";
import { MEDIA_CONSUMER, MEDIA_EVENTS, mediaConsumer } from "../src/consumers";
import { testing } from "../src/index";
import { runCleanup } from "../src/store/files";
import { memoryStore, type MemoryStore } from "../src/storage/memory";

export const MEDIA_MIGRATIONS = join(import.meta.dirname, "../migrations");

export interface MediaParts {
  media: postgres.Sql;
  store: MemoryStore;
}

/** Call before the world is built (MEDIA_CHECKS is read when each service starts). */
export function useMedia(): void {
  process.env["MEDIA_CHECKS"] = "on";
  process.env["MEDIA_JOBS"] = "off";
}

export function withMedia<W extends { pg: { service(name: string, dir: string): Promise<postgres.Sql> } }>(
  start: () => Promise<TransportOptions>,
  base: () => W,
  onParts: (p: MediaParts) => void,
): () => Promise<TransportOptions> {
  useMedia();
  return async () => {
    const o = await start();
    const media = await base().pg.service("media", MEDIA_MIGRATIONS);
    const store = memoryStore();
    testing.store = store;
    onParts({ media, store });
    const db = o.database!;
    return { ...o, database: (s: string) => (s === "media" ? media : db(s)) };
  };
}

/** Runs media's consumer until it has read every event it handles, then the storage cleanup (as the worker would). */
export async function settleMedia(p: MediaParts): Promise<{ deleted: number }> {
  const quiet = { info() {}, warn() {}, error() {}, debug() {} } as never;
  const c = mediaConsumer({ sql: p.media, logger: quiet });
  for (let i = 0; i < 100; i++) {
    const [r] = await p.media<{ n: number }[]>`
      select count(*)::int as n from platform.events e
       where e.type = any(${[...MEDIA_EVENTS]}::text[])
         and not exists (select 1 from platform.applied_events a where a.consumer = ${MEDIA_CONSUMER} and a.event_id = e.id)`;
    if (r!.n === 0) break;
    await c.runOnce();
  }
  const out = await p.media.begin((tx) => runCleanup(tx, p.store, quiet));
  return { deleted: out.deleted };
}

/** The browser's upload: a link from media as the user, then the PUT. Returns the path. */
export async function upload(env: ContractEnv, store: MemoryStore, token: string, bucket: string, opts: { folder?: string; mime?: string; bytes?: Uint8Array } = {}): Promise<string> {
  const mime = opts.mime ?? "image/webp";
  const bytes = opts.bytes ?? new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]);
  const r = await env.client(MediaService).createUpload(
    { bucket, mime, bytes: BigInt(bytes.length), folder: opts.folder ?? "" },
    { ...env.call({ userToken: token }), headers: { "idempotency-key": crypto.randomUUID() } },
  );
  store.upload(r.url, bytes, mime);
  return r.path;
}
