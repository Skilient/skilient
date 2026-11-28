/**
 * Signing for CVs and Record entries, ported from apps/web/supabase/functions/_shared/cv/sign.ts and record.ts:
 * the envelopes, Ed25519 over the SHA-256 of their RFC 8785 canonical bytes, the 10-character codes and key ids.
 * Web Crypto, as there, so a signature made here is byte-for-byte what the Edge Function made. Keys live only in
 * Key Vault (credentials-signing-key) and in memory.
 */
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, sign as edSign, verify as edVerify } from "node:crypto";
import { canonicalBytes } from "./canonical";

/** Crockford base32: no I, L, O or U, so codes read aloud and typed by hand survive. */
export const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const CODE = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{10}$/;

export interface CvEnvelope {
  v: 1;
  code: string;
  key_id: string;
  issued_at: string;
  expires_at: string;
  snapshot: Record<string, unknown>;
}

export interface RecordEnvelope {
  v: 1;
  type: "record_entry";
  code: string;
  key_id: string;
  issued_at: string;
  entry: Record<string, unknown>;
}

export type SignatureCheck = "valid" | "hash_mismatch" | "bad_signature";

/** The envelope a stored CV version was signed as, rebuilt from its columns. */
export function cvEnvelopeOf(r: { code: string; key_id: string; issued_at: string | Date; expires_at: string | Date; snapshot: Record<string, unknown> }): CvEnvelope {
  return { v: 1, code: r.code, key_id: r.key_id, issued_at: isoSeconds(r.issued_at), expires_at: isoSeconds(r.expires_at), snapshot: r.snapshot };
}

/** The envelope a sealed entry was signed as, rebuilt from its columns. */
export function recordEnvelopeOf(r: { code: string; key_id: string; signed_at: string | Date; payload: Record<string, unknown> }): RecordEnvelope {
  return { v: 1, type: "record_entry", code: r.code, key_id: r.key_id, issued_at: isoSeconds(r.signed_at), entry: r.payload };
}

export function newCode(): string {
  return Array.from(randomBytes(10), (b) => CODE_ALPHABET[b & 31]).join("");
}

/** Accepts "abcde-fghjk", lower case, and the usual misreadings (I/L → 1, O → 0). */
export function normaliseCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, "").replace(/[IL]/g, "1").replace(/O/g, "0");
  return CODE.test(code) ? code : null;
}

/** "2026-10-01T19:30:00Z": timestamps in envelopes have whole seconds and a Z. */
export function isoSeconds(value: string | Date): string {
  return new Date(value).toISOString().replace(/\.\d{3}Z$/, "Z");
}

export const toBase64Url = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64url");
export const fromBase64Url = (text: string): Uint8Array => new Uint8Array(Buffer.from(text, "base64url"));
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");
const fromHex = (text: string) => new Uint8Array(Buffer.from(text, "hex"));

/** A raw Ed25519 public key wrapped as SPKI DER (the fixed 12-byte prefix), for node:crypto. */
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const publicKeyObject = (raw: Uint8Array) => createPublicKey({ key: Buffer.concat([SPKI_PREFIX, Buffer.from(raw)]), format: "der", type: "spki" });
const privateKeyObject = (pkcs8: string) => createPrivateKey({ key: Buffer.from(pkcs8, "base64"), format: "der", type: "pkcs8" });

export function sha256(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(createHash("sha256").update(bytes).digest());
}

/** SHA-256 (hex) of an envelope's canonical JSON: what the signature covers. */
export function envelopeHash(envelope: CvEnvelope | RecordEnvelope): string {
  return hex(sha256(canonicalBytes(envelope)));
}

export interface SigningKey {
  keyId: string;
  /** Raw 32 bytes, base64url. */
  publicKey: string;
  /** PKCS#8, base64. */
  privateKey: string;
}

/** The public half (raw, base64url) of a PKCS#8 private key. */
export function publicKeyOf(privateKeyPkcs8: string): string {
  const spki = createPublicKey(privateKeyObject(privateKeyPkcs8)).export({ format: "der", type: "spki" });
  return toBase64Url(new Uint8Array(spki.subarray(spki.length - 32)));
}

/** A new Ed25519 key; its id carries the day and the start of the public key's hash (as the Edge Function made). */
export function generateSigningKey(now = new Date()): SigningKey {
  const { privateKey } = generateKeyPairSync("ed25519");
  const pkcs8 = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
  const publicKey = publicKeyOf(pkcs8);
  const day = now.toISOString().slice(0, 10).replace(/-/g, "");
  return { keyId: `cv-${day}-${hex(sha256(fromBase64Url(publicKey))).slice(0, 8)}`, publicKey, privateKey: pkcs8 };
}

/** Ed25519 over the 32 bytes of the envelope's SHA-256 (deterministic: the same bytes the Edge Function signed). */
export function sign(envelope: CvEnvelope | RecordEnvelope, privateKeyPkcs8: string): { hash: string; signature: string } {
  const hash = envelopeHash(envelope);
  const signature = edSign(null, fromHex(hash), privateKeyObject(privateKeyPkcs8));
  return { hash, signature: toBase64Url(new Uint8Array(signature)) };
}

/** The envelope rebuilt from stored columns must hash to the stored hash, and the signature must verify with the key. */
export function check(envelope: CvEnvelope | RecordEnvelope, storedHash: string, signature: string, publicKey: string): SignatureCheck {
  const hash = envelopeHash(envelope);
  if (hash !== storedHash) return "hash_mismatch";
  try {
    const raw = fromBase64Url(publicKey);
    if (raw.length !== 32) return "bad_signature";
    return edVerify(null, fromHex(hash), publicKeyObject(raw), fromBase64Url(signature)) ? "valid" : "bad_signature";
  } catch {
    return "bad_signature";
  }
}

