import { enqueue, uuidv7, type Logger } from "@skilient/platform";
import type postgres from "postgres";
import { BUCKETS, extOf, folderOf, isBucket, pathAllowed, type Bucket, type BucketName, type Mime } from "../domain/buckets";
import { refused } from "../refusals";
import type { Store } from "../storage/store";

export type Tx = postgres.TransactionSql;
export type Db = postgres.Sql | postgres.TransactionSql;

/** An upload link lasts this long. */
const UPLOAD_MINUTES = 15;

/**
 * Makes the path and the signed upload link (the storage upload policies: the bucket's types, size and folder rule,
 * and its per-folder cap). The uploader is the token's user; for group buckets the folder is the caller's, checked
 * by the owning service when it attaches the file.
 */
export async function createUpload(
  tx: Tx,
  store: Store,
  me: string,
  req: { bucket: string; mime: string; bytes: number; folder: string | null },
): Promise<{ path: string; url: string; headers: Record<string, string>; expiresAt: Date }> {
  if (!isBucket(req.bucket)) throw refused("unknown_bucket");
  const b = BUCKETS[req.bucket];
  if (!(b.mimes as readonly string[]).includes(req.mime)) throw refused("file_type");
  if (req.bytes <= 0 || req.bytes > b.maxBytes) throw refused("file_size");
  let folder: string;
  if (b.folder === "user") {
    if (req.folder && req.folder !== me) throw refused("not_your_folder");
    folder = me;
  } else {
    const shape = b.folder === "receipt" ? /^[0-9a-f-]{36}\/[0-9a-f-]{36}$/ : /^[0-9a-f-]{36}$/;
    if (!req.folder || !shape.test(req.folder)) throw refused("folder_needed");
    folder = req.folder;
  }
  const path = `${folder}/${uuidv7()}.${extOf(req.mime as Mime)}`;
  if (!pathAllowed(req.bucket, path)) throw refused("invalid_input");
  const capFolder = folderOf(req.bucket, path);
  if (b.cap !== null) {
    const [n] = await tx<{ n: number }[]>`
      select count(*)::int as n from media.files
       where bucket = ${req.bucket} and status in ('pending', 'stored')
         and ${"perOwner" in b && b.perOwner ? tx`owner_id = ${me}` : tx`folder = ${capFolder}`}`;
    if (n!.n >= b.cap) throw refused("too_many_files");
  }
  const [r] = await tx<{ expires: Date }[]>`
    insert into media.files (bucket, path, folder, owner_id, mime, max_bytes, upload_expires_at)
    values (${req.bucket}, ${path}, ${capFolder}, ${me}, ${req.mime}, ${b.maxBytes}, now() + make_interval(mins => ${UPLOAD_MINUTES}))
    returning upload_expires_at as expires`;
  const link = await store.uploadLink(req.bucket, path, req.mime, r!.expires);
  return { path, url: link.url, headers: link.headers, expiresAt: r!.expires };
}

/** A service stores bytes it made (credentials' render job): checked like an upload, recorded as stored. */
export async function putFile(tx: Tx, store: Store, req: { bucket: string; path: string; owner: string | null; mime: string; data: Uint8Array }): Promise<void> {
  if (!isBucket(req.bucket) || !pathAllowed(req.bucket, req.path)) throw refused("invalid_input");
  const b = BUCKETS[req.bucket];
  if (!(b.mimes as readonly string[]).includes(req.mime) || !req.path.endsWith(`.${extOf(req.mime as Mime)}`)) throw refused("file_type");
  if (req.data.length === 0 || req.data.length > b.maxBytes) throw refused("file_size");
  const [taken] = await tx`select 1 from media.files where bucket = ${req.bucket} and path = ${req.path} and status <> 'pending'`;
  if (taken) throw refused("path_taken");
  await store.put(req.bucket, req.path, req.mime, req.data);
  await tx`
    insert into media.files (bucket, path, folder, owner_id, mime, max_bytes, bytes, status, stored_at)
    values (${req.bucket}, ${req.path}, ${folderOf(req.bucket, req.path)}, ${req.owner}, ${req.mime}, ${b.maxBytes}, ${req.data.length}, 'stored', now())
    on conflict (bucket, path) do update set status = 'stored', bytes = excluded.bytes, stored_at = now(), owner_id = excluded.owner_id`;
}

export interface FileFacts {
  path: string;
  stored: boolean;
  owner: string | null;
  mime: string;
  bytes: number;
}

/**
 * What media knows about files, confirming pending uploads against the store first (a file over its size or of the
 * wrong type is deleted and never counts as stored).
 */
export async function checkFiles(tx: Tx, store: Store, bucket: string, paths: readonly string[], logger?: Logger): Promise<FileFacts[]> {
  if (!isBucket(bucket)) throw refused("unknown_bucket");
  const rows = await tx<{ path: string; owner_id: string | null; mime: string; max_bytes: number; bytes: number | null; status: string }[]>`
    select path, owner_id::text, mime, max_bytes, bytes, status from media.files
     where bucket = ${bucket} and path = any(${[...new Set(paths)]}::text[]) for update`;
  const byPath = new Map(rows.map((r) => [r.path, r]));
  for (const r of rows.filter((x) => x.status === "pending")) {
    const h = await store.head(bucket, r.path);
    if (!h) continue;
    if (h.bytes > r.max_bytes || h.bytes === 0 || (h.mime !== "" && h.mime !== r.mime)) {
      await store.remove(bucket, [r.path]);
      await tx`update media.files set status = 'deleted', deleted_at = now() where bucket = ${bucket} and path = ${r.path}`;
      r.status = "deleted";
      logger?.warn("media.refused_upload", { action: "media.check", outcome: "refused", bucket, reason: h.bytes > r.max_bytes ? "too_big" : "wrong_type" });
      continue;
    }
    await tx`update media.files set status = 'stored', bytes = ${h.bytes}, stored_at = now() where bucket = ${bucket} and path = ${r.path}`;
    r.status = "stored";
    r.bytes = h.bytes;
  }
  return paths.map((p) => {
    const r = byPath.get(p);
    return { path: p, stored: r?.status === "stored", owner: r?.owner_id ?? null, mime: r?.mime ?? "", bytes: r?.status === "stored" ? (r.bytes ?? 0) : 0 };
  });
}

/** Signed links for the stored files the caller may read: every file for a service, the caller's own for web. */
export async function downloadLinks(db: Db, store: Store, bucket: string, paths: readonly string[], reader: { service: true } | { user: string | null }, ttlSeconds: number): Promise<{ path: string; url: string }[]> {
  if (!isBucket(bucket)) throw refused("unknown_bucket");
  const b: Bucket = BUCKETS[bucket];
  if (!("service" in reader) && b.serviceReadsOnly) return [];
  const rows = await db<{ path: string; owner_id: string | null }[]>`
    select path, owner_id::text from media.files where bucket = ${bucket} and status = 'stored' and path = any(${[...new Set(paths)]}::text[])`;
  const allowed = rows.filter((r) => b.public || "service" in reader || (reader.user !== null && r.owner_id === reader.user));
  const until = new Date(Date.now() + ttlSeconds * 1000);
  return Promise.all(allowed.map(async (r) => ({ path: r.path, url: b.public ? store.publicUrl(bucket, r.path) : await store.downloadLink(bucket, r.path, until) })));
}

/** `storage_usage()`: files and bytes per bucket, largest first. */
export async function storageUsage(db: Db): Promise<{ bucket: string; objects: number; bytes: number }[]> {
  const rows = await db<{ bucket: string; objects: number; bytes: number }[]>`
    select b.bucket, count(f.path)::int as objects, coalesce(sum(f.bytes), 0)::bigint as bytes
      from unnest(${Object.keys(BUCKETS)}::text[]) as b(bucket)
      left join media.files f on f.bucket = b.bucket and f.status = 'stored'
     group by b.bucket order by 3 desc, b.bucket`;
  return rows.map((r) => ({ bucket: r.bucket, objects: Number(r.objects), bytes: Number(r.bytes) }));
}

/**
 * Lets files go (the stack's cleanup triggers, now events): marks them released and queues their delete. A path of
 * the bucket's shape that media never recorded (a file from before the move) is queued too; anything else is
 * dropped and logged, as the cleanup worker refused a bad message.
 */
export async function release(tx: Tx, bucket: string, paths: readonly string[], logger?: Logger): Promise<number> {
  const ok = paths.filter((p) => pathAllowed(bucket, p));
  if (ok.length < paths.length) logger?.warn("media.release_refused", { action: "media.release", outcome: "refused", reason: "bad_path", count: paths.length - ok.length });
  if (ok.length === 0) return 0;
  await tx`update media.files set status = 'released', released_at = now() where bucket = ${bucket} and path = any(${ok}::text[]) and status in ('pending', 'stored')`;
  await tx`
    insert into media.deletions (bucket, path)
    select ${bucket}, p from unnest(${ok}::text[]) as p
     where not exists (select 1 from media.deletions d where d.bucket = ${bucket} and d.path = p)
       and not exists (select 1 from media.files f where f.bucket = ${bucket} and f.path = p and f.status = 'deleted')`;
  await enqueue(tx, { kind: "storage-cleanup", dedupeKey: `storage-cleanup:${Math.floor(Date.now() / 10_000)}` });
  return ok.length;
}

/** user.deleted: every file in the buckets people own (their own folder) goes. Group files go with their owners' events. */
export async function releaseOwner(tx: Tx, userId: string, logger?: Logger): Promise<number> {
  const rows = await tx<{ bucket: BucketName; path: string }[]>`
    select bucket, path from media.files
     where owner_id = ${userId} and status in ('pending', 'stored') and bucket = any(${Object.entries(BUCKETS).filter(([, b]) => b.folder === "user").map(([k]) => k)}::text[])`;
  const byBucket = new Map<string, string[]>();
  for (const r of rows) byBucket.set(r.bucket, [...(byBucket.get(r.bucket) ?? []), r.path]);
  let n = 0;
  for (const [bucket, paths] of byBucket) n += await release(tx, bucket, paths, logger);
  await tx`update media.files set owner_id = null where owner_id = ${userId}`;
  return n;
}

const MAX_TRIES = 5;

/** The storage-cleanup worker (runStorageCleanup): deletes queued files in batches, one store call per bucket. */
export async function runCleanup(tx: Tx, store: Store, logger: Logger, batch = 50): Promise<{ deleted: number; failed: number; dropped: number }> {
  const out = { deleted: 0, failed: 0, dropped: 0 };
  const rows = await tx<{ id: string; bucket: string; path: string; attempts: number }[]>`
    update media.deletions d set attempts = d.attempts + 1
     where d.id in (select id from media.deletions where not_before <= now() order by id limit ${batch} for update skip locked)
    returning d.id::text, d.bucket, d.path, d.attempts`;
  type Due = { id: string; bucket: string; path: string; attempts: number };
  const byBucket = new Map<string, Due[]>();
  for (const r of rows) {
    if (!pathAllowed(r.bucket, r.path)) {
      await tx`delete from media.deletions where id = ${r.id}`;
      out.dropped++;
      logger.warn("storage.cleanup", { action: "media.cleanup", outcome: "refused", reason: "bad_message" });
      continue;
    }
    byBucket.set(r.bucket, [...(byBucket.get(r.bucket) ?? []), r]);
  }
  for (const [bucket, group] of byBucket) {
    try {
      await store.remove(
        bucket,
        group.map((r) => r.path),
      );
      await tx`delete from media.deletions where id = any(${group.map((r) => r.id)}::bigint[])`;
      await tx`update media.files set status = 'deleted', deleted_at = now() where bucket = ${bucket} and path = any(${group.map((r) => r.path)}::text[])`;
      out.deleted += group.length;
      logger.info("storage.cleanup", { action: "media.cleanup", outcome: "ok", bucket, count: group.length });
    } catch (error) {
      for (const r of group) {
        if (r.attempts >= MAX_TRIES) {
          await tx`delete from media.deletions where id = ${r.id}`;
          out.dropped++;
        } else {
          await tx`update media.deletions set not_before = now() + interval '1 minute' where id = ${r.id}`;
          out.failed++;
        }
      }
      logger.error("storage.cleanup", { action: "media.cleanup", outcome: "error", bucket, error: error instanceof Error ? error.message.slice(0, 120) : "unknown" });
    }
  }
  return out;
}

/** Upload links that were never used: the row goes to deleted (a late upload, if any, is deleted with it). */
export async function expirePending(tx: Tx): Promise<number> {
  const rows = await tx<{ bucket: string; path: string }[]>`
    update media.files set status = 'released', released_at = now()
     where status = 'pending' and upload_expires_at < now() - interval '1 day'
    returning bucket, path`;
  if (rows.length)
    await tx`insert into media.deletions (bucket, path) select b, p from unnest(${rows.map((r) => r.bucket)}::text[], ${rows.map((r) => r.path)}::text[]) as x(b, p)`;
  return rows.length;
}
