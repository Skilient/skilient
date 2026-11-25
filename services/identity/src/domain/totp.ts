import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Authenticator codes (RFC 6238 TOTP over RFC 4226 HOTP): HMAC-SHA1, 6 digits, 30-second steps, as Supabase
 * Auth issued them, so imported secrets keep working and nobody re-enrols (prd.md, "Two-factor").
 * A code is accepted for the current step and one step either side; a step at or before the factor's
 * last used step is refused, so a code can never be used twice.
 * Secrets are stored only encrypted, with AES-256-GCM under `identity-totp-key` (decision Q10), bound to
 * their factor id as additional data so a ciphertext cannot be moved to another factor.
 */
export const TOTP_PERIOD = 30;
export const TOTP_DIGITS = 6;
export const TOTP_WINDOW = 1;
export const TOTP_ISSUER = "Skilient";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 base32, upper case, without padding (what authenticator apps and Supabase use). */
export function base32Encode(bytes: Uint8Array): string {
  let out = "";
  let buffer = 0;
  let bits = 0;
  for (const b of bytes) {
    buffer = (buffer << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(buffer << (5 - bits)) & 31];
  return out;
}

/** Decodes base32 (case-insensitive, spaces and padding ignored); null when it is not base32. */
export function base32Decode(text: string): Buffer | null {
  const clean = text.replace(/[\s=]/g, "").toUpperCase();
  if (!/^[A-Z2-7]*$/.test(clean)) return null;
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    buffer = (buffer << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new 160-bit secret (RFC 4226 recommends the HMAC-SHA1 output size). */
export function generateTotpSecret(): Buffer {
  return randomBytes(20);
}

/** RFC 4226 HOTP. */
export function hotp(secret: Uint8Array, counter: number, digits = TOTP_DIGITS): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", secret).update(msg).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const bin = ((mac[offset]! & 0x7f) << 24) | (mac[offset + 1]! << 16) | (mac[offset + 2]! << 8) | mac[offset + 3]!;
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export const totpStep = (unixSeconds: number) => Math.floor(unixSeconds / TOTP_PERIOD);

/** RFC 6238 TOTP at a moment (seconds since the epoch). */
export function totp(secret: Uint8Array, unixSeconds: number, digits = TOTP_DIGITS): string {
  return hotp(secret, totpStep(unixSeconds), digits);
}

/**
 * Checks a code against the steps around `unixSeconds`. Returns the step it matched, or null when it
 * matches none or only a step at or before `lastUsedStep` (a replay).
 */
export function matchTotp(secret: Uint8Array, code: string, unixSeconds: number, lastUsedStep: number | null): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const now = totpStep(unixSeconds);
  let matched: number | null = null;
  for (let step = now - TOTP_WINDOW; step <= now + TOTP_WINDOW; step++) {
    // Every candidate is compared, in constant time, so timing does not tell which step matched.
    const ok = timingSafeEqual(Buffer.from(hotp(secret, step)), Buffer.from(code));
    if (ok && matched === null && (lastUsedStep === null || step > lastUsedStep)) matched = step;
  }
  return matched;
}

/** The otpauth:// URI an authenticator app reads from the QR code. */
export function otpauthUri(secretBase32: string, account: string): string {
  const label = encodeURIComponent(`${TOTP_ISSUER}:${account}`);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${TOTP_ISSUER}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
}

const VERSION = 1;

/** AES-256-GCM: version byte, 12-byte nonce, 16-byte tag, ciphertext. `factorId` is bound as additional data. */
export function encryptTotpSecret(key: Buffer, secret: Uint8Array, factorId: string): Buffer {
  if (key.length !== 32) throw new Error("totp key must be 32 bytes");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(factorId, "utf8"));
  const body = Buffer.concat([cipher.update(secret), cipher.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), body]);
}

/** Decrypts a stored secret; throws when the key, the factor id or the bytes do not match. */
export function decryptTotpSecret(key: Buffer, blob: Uint8Array, factorId: string): Buffer {
  const buf = Buffer.from(blob);
  if (buf.length < 1 + 12 + 16 + 1 || buf[0] !== VERSION) throw new Error("totp secret: unknown format");
  const decipher = createDecipheriv("aes-256-gcm", key, buf.subarray(1, 13));
  decipher.setAAD(Buffer.from(factorId, "utf8"));
  decipher.setAuthTag(buf.subarray(13, 29));
  return Buffer.concat([decipher.update(buf.subarray(29)), decipher.final()]);
}
