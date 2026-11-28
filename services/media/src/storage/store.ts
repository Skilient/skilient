/**
 * Where the bytes live: Azure Blob Storage in production (one container per bucket; src/storage/azure.ts), and an
 * in-memory store in tests (src/storage/memory.ts; decisions.md 2026-11-28, W9: a fake behind this port rather than
 * the Azurite emulator, which doesn't sign user-delegation links). Media never streams bytes itself except for
 * `put` (a service's own file, such as a rendered PDF): uploads and reads go straight to the store with signed links.
 */
export interface Store {
  /** A link the uploader PUTs one file to, with the headers it must send. */
  uploadLink(bucket: string, path: string, mime: string, expiresAt: Date): Promise<{ url: string; headers: Record<string, string> }>;
  /** A link to read one private file until `expiresAt`. */
  downloadLink(bucket: string, path: string, expiresAt: Date): Promise<string>;
  /** A public bucket's plain address. */
  publicUrl(bucket: string, path: string): string;
  /** A stored file's size and type, or null when there is none. */
  head(bucket: string, path: string): Promise<{ bytes: number; mime: string } | null>;
  put(bucket: string, path: string, mime: string, data: Uint8Array): Promise<void>;
  /** Deletes files; a file that is already gone is not an error. */
  remove(bucket: string, paths: readonly string[]): Promise<void>;
}
