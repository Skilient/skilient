import { MediaService } from "@skilient/contracts/media/v1/media_pb";
import { createScheduler, createWorker, defineService, type Consumer, type Scheduler, type Worker } from "@skilient/platform";
import type postgres from "postgres";
import { createApi } from "./api";
import { callers } from "./authorize";
import { mediaConsumer } from "./consumers";
import { mediaJobs, mediaSchedules } from "./jobs";
import { azureStore } from "./storage/azure";
import { memoryStore, type MemoryStore } from "./storage/memory";
import type { Store } from "./storage/store";

export { memoryStore, type MemoryStore } from "./storage/memory";
export type { Store } from "./storage/store";
export { BUCKETS, pathAllowed } from "./domain/buckets";

let sql: postgres.Sql | undefined;
let consumer: Consumer | undefined;
let worker: Worker | undefined;
let scheduler: Scheduler | undefined;

/**
 * The store tests use (an in-memory store they can upload into and read from); set before the host starts. In
 * production it stays unset and MEDIA_BLOB_URL names the storage account.
 */
export const testing: { store: MemoryStore | undefined } = { store: undefined };

/**
 * media (W9): signed upload and download links, one row per file with its owner and bucket, the file checks other
 * services make before they attach a file, and deleting files other services let go (the storage-cleanup worker).
 *
 * Variables: MEDIA_BLOB_URL (https://<account>.blob.core.windows.net; required in Azure), MEDIA_JOBS (off: no
 * consumer, schedules or job worker; for tests), MEDIA_QUOTA_BYTES (storage.quota_bytes, default 1 GiB). No secrets:
 * the store is reached with the container app's managed identity.
 */
export default defineService({
  name: "media",
  contract: MediaService,
  callers,
  async create(deps) {
    sql = deps.database();
    const blob = process.env["MEDIA_BLOB_URL"];
    if (!blob && !testing.store && process.env["KEY_VAULT_URL"]) throw new Error("MEDIA_BLOB_URL is not set");
    const store: Store = testing.store ?? (blob ? azureStore({ url: blob }) : memoryStore());
    if (process.env["MEDIA_JOBS"] !== "off") {
      consumer = mediaConsumer({ sql, logger: deps.logger });
      await consumer.start();
      worker = createWorker({ sql, workerId: deps.instance, handlers: mediaJobs({ logger: deps.logger, store }), logger: deps.logger });
      scheduler = createScheduler({ sql, schedules: mediaSchedules(), logger: deps.logger });
      worker.start();
      await scheduler.start();
    }
    return createApi({ sql, logger: deps.logger, store, clients: deps.clients, quotaBytes: Number(process.env["MEDIA_QUOTA_BYTES"] ?? 1_073_741_824) });
  },
  async ready() {
    if (!sql) return false;
    await sql`select 1`;
    return true;
  },
  async close() {
    scheduler?.stop();
    await worker?.stop();
    await consumer?.stop();
    consumer = undefined;
    worker = undefined;
    scheduler = undefined;
  },
});
