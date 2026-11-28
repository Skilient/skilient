/**
 * Every bucket media holds, with the stack's storage rules (storage.buckets and the storage.objects policies, plus
 * the storage-cleanup worker's path rules; docs/azure/media-function-bins.md). Re-encoding stays in web; media
 * checks type, size and path, records the uploader, and keeps the per-folder caps the upload policies had.
 *
 * Folder kinds: `user` (the first folder is the uploader), `group` (a thread, society, organisation or
 * university: the owning service checks the group when it attaches the file), `receipt` (event/registration).
 */
export type Mime = "image/webp" | "application/pdf";
export type FolderKind = "user" | "group" | "receipt";

export interface Bucket {
  public: boolean;
  mimes: readonly Mime[];
  maxBytes: number;
  folder: FolderKind;
  /** Files (not deleted) a folder (or, with `perOwner`, an uploader) may hold at once; the upload policies' caps. */
  cap: number | null;
  perOwner?: boolean;
  /** Only services store files here (web may not ask for an upload link). */
  servicesOnly?: boolean;
  /** The uploader alone may not read it back: the owning service signs every link (chat images: thread members). */
  serviceReadsOnly?: boolean;
}

const WEBP: readonly Mime[] = ["image/webp"];
const BOTH: readonly Mime[] = ["application/pdf", "image/webp"];
const MB = 1024 * 1024;

export const BUCKETS = {
  avatars: { public: true, mimes: WEBP, maxBytes: 5 * MB, folder: "user", cap: null },
  covers: { public: true, mimes: WEBP, maxBytes: 8 * MB, folder: "user", cap: null },
  "post-media": { public: true, mimes: WEBP, maxBytes: 5 * MB, folder: "user", cap: null },
  "chat-media": { public: false, mimes: WEBP, maxBytes: 5 * MB, folder: "group", cap: null, serviceReadsOnly: true },
  credentials: { public: false, mimes: BOTH, maxBytes: 5 * MB, folder: "user", cap: 15, perOwner: true },
  "cv-exports": { public: false, mimes: ["application/pdf"], maxBytes: 2 * MB, folder: "user", cap: 100, perOwner: true },
  "event-receipts": { public: false, mimes: BOTH, maxBytes: 5 * MB, folder: "receipt", cap: 5 },
  feedback: { public: false, mimes: WEBP, maxBytes: 5 * MB, folder: "user", cap: 30, perOwner: true },
  "org-documents": { public: false, mimes: BOTH, maxBytes: 5 * MB, folder: "group", cap: 5 },
  "society-documents": { public: false, mimes: BOTH, maxBytes: 5 * MB, folder: "user", cap: 5 },
  "society-media": { public: true, mimes: WEBP, maxBytes: 2 * MB, folder: "group", cap: 60 },
  "university-claims": { public: false, mimes: BOTH, maxBytes: 5 * MB, folder: "user", cap: 5, perOwner: true },
  "university-media": { public: true, mimes: WEBP, maxBytes: 5 * MB, folder: "group", cap: null },
} as const satisfies Record<string, Bucket>;
export type BucketName = keyof typeof BUCKETS;

export const isBucket = (b: string): b is BucketName => Object.hasOwn(BUCKETS, b);

const U = "[0-9a-f-]{36}";
const ONE = new RegExp(`^(${U})/(${U})\\.(webp|pdf)$`);
const TWO = new RegExp(`^(${U})/(${U})/(${U})\\.(webp|pdf)$`);

/** The storage-cleanup worker's `allowed(bucket, path)`: a path of the bucket's shape and an allowed type. */
export function pathAllowed(bucket: string, path: string): boolean {
  if (!isBucket(bucket)) return false;
  const b: Bucket = BUCKETS[bucket];
  const m = b.folder === "receipt" ? TWO.exec(path) : ONE.exec(path);
  if (!m) return false;
  const ext = m[m.length - 1];
  return b.mimes.includes(ext === "pdf" ? "application/pdf" : "image/webp");
}

/** The folder part a path's cap counts (the registration for receipts). */
export function folderOf(bucket: BucketName, path: string): string {
  const parts = path.split("/");
  return BUCKETS[bucket].folder === "receipt" ? `${parts[0]}/${parts[1]}` : parts[0]!;
}

export const extOf = (mime: Mime) => (mime === "application/pdf" ? "pdf" : "webp");
