import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Store } from "./store";

/**
 * An in-memory store for tests: signed links are `memory://<bucket>/<path>?op=&exp=&sig=` with an HMAC over the
 * operation, bucket, path and expiry, so a test can prove a link opens only its own file and only until it
 * expires. `upload(link, bytes)` and `fetch(link)` stand in for the browser.
 */
export interface MemoryStore extends Store {
  files: Map<string, { bytes: Uint8Array; mime: string }>;
  /** What the browser's PUT to an upload link does. Throws for a bad or expired link. */
  upload(url: string, bytes: Uint8Array, mime: string): void;
  /** What the browser's GET of a link does: the bytes, or null when refused or missing. */
  read(url: string): Uint8Array | null;
  removed: string[];
  /** Make the next `remove` call fail (the cleanup retries). */
  failNext: number;
}

export function memoryStore(now: () => Date = () => new Date()): MemoryStore {
  const key = randomBytes(32);
  const files = new Map<string, { bytes: Uint8Array; mime: string }>();
  const sign = (op: string, bucket: string, path: string, exp: number) => createHmac("sha256", key).update(`${op}\n${bucket}\n${path}\n${exp}`).digest("base64url");
  const link = (op: string, bucket: string, path: string, at: Date) => {
    const exp = Math.floor(at.getTime() / 1000);
    return `memory://${bucket}/${path}?op=${op}&exp=${exp}&sig=${sign(op, bucket, path, exp)}`;
  };
  const check = (url: string, op: string): { bucket: string; path: string } | null => {
    const u = new URL(url);
    if (u.protocol !== "memory:") return null;
    const bucket = u.host;
    const path = u.pathname.replace(/^\//, "");
    const exp = Number(u.searchParams.get("exp"));
    const sig = Buffer.from(u.searchParams.get("sig") ?? "");
    const want = Buffer.from(sign(op, bucket, path, exp));
    if (u.searchParams.get("op") !== op || sig.length !== want.length || !timingSafeEqual(sig, want)) return null;
    if (exp * 1000 < now().getTime()) return null;
    return { bucket, path };
  };
  const store: MemoryStore = {
    files,
    removed: [],
    failNext: 0,
    async uploadLink(bucket, path, mime, expiresAt) {
      return { url: link("put", bucket, path, expiresAt), headers: { "content-type": mime } };
    },
    async downloadLink(bucket, path, expiresAt) {
      return link("get", bucket, path, expiresAt);
    },
    publicUrl(bucket, path) {
      return `memory://${bucket}/${path}`;
    },
    async head(bucket, path) {
      const f = files.get(`${bucket}/${path}`);
      return f ? { bytes: f.bytes.length, mime: f.mime } : null;
    },
    async put(bucket, path, mime, data) {
      files.set(`${bucket}/${path}`, { bytes: data, mime });
    },
    async remove(bucket, paths) {
      if (store.failNext > 0) {
        store.failNext--;
        throw new Error("store unavailable");
      }
      for (const p of paths) {
        files.delete(`${bucket}/${p}`);
        store.removed.push(`${bucket}/${p}`);
      }
    },
    upload(url, bytes, mime) {
      const t = check(url, "put");
      if (!t) throw new Error("upload link refused");
      files.set(`${t.bucket}/${t.path}`, { bytes, mime });
    },
    read(url) {
      const u = new URL(url);
      if (!u.search) return files.get(`${u.host}${u.pathname}`)?.bytes ?? null;
      const t = check(url, "get");
      return t ? (files.get(`${t.bucket}/${t.path}`)?.bytes ?? null) : null;
    },
  };
  return store;
}
