import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";
import { reencodeToFit } from "@/lib/images/reencode";

/**
 * Proof documents and payment receipts (PRD 5.31): a PDF (checked by its `%PDF-` header) or an
 * image re-encoded with sharp (type from the bytes, EXIF and GPS dropped), up to 5 MB. The sha256
 * of the uploaded bytes and a 64-bit difference hash of the picture let officers see a receipt used
 * twice; neither is shown to anyone.
 */
export const PROOF_MAX_BYTES = 5 * 1024 * 1024;

export interface ProofFile {
  data: Buffer;
  contentType: "application/pdf" | "image/webp";
  ext: "pdf" | "webp";
  sha256: string;
  /** 16 hex characters; null for PDFs. */
  phash: string | null;
}

export class ProofRejected extends Error {
  constructor(readonly reason: "empty" | "too_big" | "unreadable") {
    super(reason);
    this.name = "ProofRejected";
  }
}

export const PROOF_MESSAGES: Record<ProofRejected["reason"], string> = {
  empty: "Choose a file.",
  too_big: "Files can be up to 5 MB.",
  unreadable: "Use a PDF, or a JPEG, PNG or WebP image.",
};

export async function prepareProof(file: File): Promise<ProofFile> {
  if (file.size === 0) throw new ProofRejected("empty");
  if (file.size > PROOF_MAX_BYTES) throw new ProofRejected("too_big");
  const input = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(input).digest("hex");
  if (input.subarray(0, 5).toString("latin1") === "%PDF-") {
    return { data: input, contentType: "application/pdf", ext: "pdf", sha256, phash: null };
  }
  let image: Buffer;
  try {
    image = (await reencodeToFit(input, 2000)).data;
  } catch {
    throw new ProofRejected("unreadable");
  }
  if (image.length > PROOF_MAX_BYTES) throw new ProofRejected("too_big");
  return { data: image, contentType: "image/webp", ext: "webp", sha256, phash: await dhash(image) };
}

/**
 * Difference hash: shrink to 9×8 greyscale and record whether each pixel is brighter than its
 * right neighbour. Two photos of the same receipt differ by a few bits; SQL flags a distance ≤ 4.
 */
export async function dhash(image: Buffer): Promise<string> {
  const { data } = await sharp(image).greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  let hex = "";
  for (let y = 0; y < 8; y++) {
    let byte = 0;
    for (let x = 0; x < 8; x++) byte = (byte << 1) | (data[y * 9 + x] > data[y * 9 + x + 1] ? 1 : 0);
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/** Bits that differ between two hashes (the same measure SQL uses). */
export function hammingDistance(a: string, b: string): number {
  let n = 0;
  for (let i = 0; i < 16; i += 2) {
    let x = parseInt(a.slice(i, i + 2), 16) ^ parseInt(b.slice(i, i + 2), 16);
    while (x) {
      n += x & 1;
      x >>= 1;
    }
  }
  return n;
}
