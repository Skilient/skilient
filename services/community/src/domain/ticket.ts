import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Signed tickets (PRD 5.31). Each event has a 32-byte secret (event_secrets on the stack), kept sealed at rest:
 * AES-256-GCM under the Key Vault secret `community-ticket-key` (32 bytes, base64url), the event id bound as
 * additional data (decisions 2026-11-27). The ticket is SKT1.<registration>.<first 24 hex of
 * HMAC-SHA256(secret, "ticket:<event>:<registration>:<user>")>, exactly as `private.ticket_payload` made it, so
 * tickets issued before the cutover still scan once their secrets are imported and sealed. The rotating self
 * check-in code is the first 24 hex of HMAC-SHA256(secret, "<event>:<30-second window>") (`private.event_code`).
 */
const VERSION = 1;

export const newSecret = () => randomBytes(32);

export function sealSecret(key: Buffer, secret: Buffer, eventId: string): Buffer {
  if (key.length !== 32) throw new Error("ticket key must be 32 bytes");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(eventId, "utf8"));
  const body = Buffer.concat([cipher.update(secret), cipher.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), body]);
}

export function openSecret(key: Buffer, sealed: Uint8Array, eventId: string): Buffer {
  const buf = Buffer.from(sealed);
  if (buf.length < 1 + 12 + 16 + 1 || buf[0] !== VERSION) throw new Error("ticket secret: unknown format");
  const decipher = createDecipheriv("aes-256-gcm", key, buf.subarray(1, 13));
  decipher.setAAD(Buffer.from(eventId, "utf8"));
  decipher.setAuthTag(buf.subarray(13, 29));
  return Buffer.concat([decipher.update(buf.subarray(29)), decipher.final()]);
}

const hmac24 = (secret: Buffer, text: string) => createHmac("sha256", secret).update(text, "utf8").digest("hex").slice(0, 24);

export function ticketPayload(secret: Buffer, eventId: string, registrationId: string, userId: string): string {
  return `SKT1.${registrationId}.${hmac24(secret, `ticket:${eventId}:${registrationId}:${userId}`)}`;
}

export const PAYLOAD = /^SKT1\.([0-9a-f-]{36})\.([0-9a-f]{24})$/;

/** Whether a scanned payload is this registration's ticket (constant time). */
export function payloadMatches(secret: Buffer, eventId: string, registrationId: string, userId: string, payload: string): boolean {
  const want = Buffer.from(ticketPayload(secret, eventId, registrationId, userId));
  const got = Buffer.from(payload);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** The 30-second window number of a moment. */
export const windowOf = (at: Date) => Math.floor(at.getTime() / 1000 / 30);

export const eventCode = (secret: Buffer, eventId: string, window: number) => hmac24(secret, `${eventId}:${window}`);
