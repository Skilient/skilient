import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * The GitHub tokens of a student, sealed at rest (docs/decisions.md 2026-11-26): AES-256-GCM under the Key Vault
 * secret `work-github-token-key` (32 bytes, base64url), as identity seals TOTP secrets. Layout: version byte,
 * 12-byte nonce, 16-byte tag, ciphertext. The user id is bound as additional data, so a sealed token moved to
 * another row does not open.
 */
const VERSION = 1;

export function sealToken(key: Buffer, token: string, userId: string): Buffer {
  if (key.length !== 32) throw new Error("token key must be 32 bytes");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(userId, "utf8"));
  const body = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), body]);
}

export function openToken(key: Buffer, blob: Uint8Array, userId: string): string {
  const buf = Buffer.from(blob);
  if (buf.length < 1 + 12 + 16 + 1 || buf[0] !== VERSION) throw new Error("token: unknown format");
  const decipher = createDecipheriv("aes-256-gcm", key, buf.subarray(1, 13));
  decipher.setAAD(Buffer.from(userId, "utf8"));
  decipher.setAuthTag(buf.subarray(13, 29));
  return Buffer.concat([decipher.update(buf.subarray(29)), decipher.final()]).toString("utf8");
}
