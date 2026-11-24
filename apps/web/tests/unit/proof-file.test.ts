import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { dhash, hammingDistance, prepareProof, ProofRejected } from "@/lib/images/proof-file";

/**
 * Receipts and society proofs (PRD 5.31): a PDF passes on its header, an image is re-encoded to WebP,
 * and the difference hash lets officers see the same receipt uploaded twice (SQL flags a distance ≤ 4).
 */
async function receipt(shift = 0, quality = 90): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">
    <rect width="400" height="300" fill="#fff"/>
    <rect x="${20 + shift}" y="20" width="200" height="40" fill="#222"/>
    <rect x="20" y="100" width="${300 - shift}" height="20" fill="#555"/>
    <circle cx="320" cy="220" r="50" fill="#999"/>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality }).toBuffer();
}

async function other(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">
    <rect width="400" height="300" fill="#000"/>
    <rect x="200" y="150" width="180" height="140" fill="#eee"/>
    <rect x="10" y="10" width="60" height="260" fill="#aaa"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

const file = (bytes: Buffer, type: string) => new File([new Uint8Array(bytes)], "receipt", { type });

describe("receipt and proof files", () => {
  it("keeps a PDF as uploaded, with its hash and no picture hash", async () => {
    const pdf = Buffer.from("%PDF-1.7\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF");
    const out = await prepareProof(file(pdf, "application/pdf"));
    expect(out.contentType).toBe("application/pdf");
    expect(out.ext).toBe("pdf");
    expect(out.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(out.phash).toBeNull();
  });

  it("re-encodes an image to WebP and hashes it", async () => {
    const out = await prepareProof(file(await receipt(), "image/jpeg"));
    expect(out.contentType).toBe("image/webp");
    expect((await sharp(out.data).metadata()).format).toBe("webp");
    expect(out.phash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("refuses anything that is neither", async () => {
    await expect(prepareProof(file(Buffer.from("<script>alert(1)</script>"), "application/pdf"))).rejects.toBeInstanceOf(ProofRejected);
    await expect(prepareProof(file(Buffer.alloc(0), "image/png"))).rejects.toMatchObject({ reason: "empty" });
    await expect(prepareProof(file(Buffer.alloc(5 * 1024 * 1024 + 1), "image/png"))).rejects.toMatchObject({ reason: "too_big" });
  });

  it("sees the same receipt saved again or nudged as a near match, and a different one as different", async () => {
    const a = await dhash(await receipt(0, 90));
    const resaved = await dhash(await receipt(0, 40));
    const nudged = await dhash(await receipt(4, 85));
    const different = await dhash(await other());
    expect(hammingDistance(a, resaved)).toBeLessThanOrEqual(4);
    expect(hammingDistance(a, nudged)).toBeLessThanOrEqual(4);
    expect(hammingDistance(a, different)).toBeGreaterThan(4);
  });

  it("counts differing bits like SQL's bit_count over the xor", () => {
    expect(hammingDistance("0000000000000000", "0000000000000000")).toBe(0);
    expect(hammingDistance("ffffffffffffffff", "0000000000000000")).toBe(64);
    expect(hammingDistance("8000000000000001", "0000000000000000")).toBe(2);
  });
});
