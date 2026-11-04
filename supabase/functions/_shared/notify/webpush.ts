/**
 * Web Push without a library (PRD 5.34): VAPID (RFC 8292) and the aes128gcm message encryption
 * (RFC 8291, RFC 8188). Web Crypto only, so it runs in the Edge Function (Deno) and its Node tests.
 * The VAPID keys live in Vault: `vapid_public_key` (65-byte uncompressed P-256 point, base64url),
 * `vapid_private_key` (32-byte scalar, base64url) and `vapid_subject` (a mailto: or https: URL).
 */

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

const enc = new TextEncoder();

export function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(value: string): Uint8Array<ArrayBuffer> {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(parts.reduce((n, p) => n + p.length, 0)));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

async function hmac(key: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

/** The push services browsers use. Anything else is refused, so a subscription can't aim the worker at an internal host. */
const PUSH_HOST = /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|push\.services\.mozilla\.com|web\.push\.apple\.com|([a-z0-9-]+\.)+notify\.windows\.com)$/;

export function isPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  return url.protocol === "https:" && url.port === "" && !url.username && !url.password && PUSH_HOST.test(url.hostname);
}

function vapidJwk(keys: VapidKeys): JsonWebKey {
  const pub = b64urlDecode(keys.publicKey);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error("vapid_public_key must be an uncompressed P-256 point");
  return { kty: "EC", crv: "P-256", d: keys.privateKey, x: b64urlEncode(pub.slice(1, 33)), y: b64urlEncode(pub.slice(33, 65)), ext: true };
}

/** The VAPID Authorization header for one push service origin (valid 12 hours). */
export async function vapidAuthorization(endpoint: string, keys: VapidKeys, now: Date = new Date()): Promise<string> {
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64urlEncode(
    enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now.getTime() / 1000) + 12 * 3600, sub: keys.subject })),
  );
  const key = await crypto.subtle.importKey("jwk", vapidJwk(keys), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  // Web Crypto's ECDSA signature is already JOSE's r || s.
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${claims}`)));
  return `vapid t=${header}.${claims}.${b64urlEncode(signature)}, k=${keys.publicKey}`;
}

const RECORD_SIZE = 4096;

/** RFC 8291 key schedule shared by encrypt and the tests' decrypt. */
async function contentKeys(ecdhSecret: Uint8Array<ArrayBuffer>, authSecret: Uint8Array<ArrayBuffer>, uaPublic: Uint8Array, asPublic: Uint8Array, salt: Uint8Array<ArrayBuffer>) {
  const prkKey = await hmac(authSecret, ecdhSecret);
  const ikm = await hmac(prkKey, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic, new Uint8Array([1])));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
  return { cek, nonce };
}

/** Encrypts one push message for one subscription (a single aes128gcm record). */
export async function encryptPayload(target: PushTarget, payload: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const uaPublic = b64urlDecode(target.p256dh);
  const authSecret = b64urlDecode(target.auth);
  if (uaPublic.length !== 65 || authSecret.length !== 16) throw new Error("bad subscription keys");
  if (payload.length > RECORD_SIZE - 17 - 86) throw new Error("payload too large");
  const ephemeral = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", ephemeral.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, ephemeral.privateKey, 256));
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  const { cek, nonce } = await contentKeys(ecdhSecret, authSecret, uaPublic, asPublic, salt);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // The last (only) record ends with the 0x02 delimiter and no further padding.
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(payload, new Uint8Array([2]))));
  const header = new Uint8Array(new ArrayBuffer(16 + 4 + 1 + 65));
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = 65;
  header.set(asPublic, 21);
  return concat(header, cipher);
}

/** The receiving side of encryptPayload, for tests (the browser does this for real). */
export async function decryptPayload(body: Uint8Array, uaPrivate: CryptoKey, uaPublic: Uint8Array, authSecret: Uint8Array): Promise<Uint8Array> {
  const salt = body.slice(0, 16);
  const idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen);
  const cipher = body.slice(21 + idlen);
  const asKey = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, uaPrivate, 256));
  const { cek, nonce } = await contentKeys(ecdhSecret, new Uint8Array(authSecret), uaPublic, asPublic, salt);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, cipher));
  let end = plain.length - 1;
  while (end >= 0 && plain[end] === 0) end--;
  if (plain[end] !== 2) throw new Error("bad padding delimiter");
  return plain.slice(0, end);
}

/** The request to send one push. */
export async function pushRequest(
  target: PushTarget,
  keys: VapidKeys,
  message: { title: string; body: string; url: string; tag?: string },
  opts: { ttl?: number; urgency?: "very-low" | "low" | "normal" | "high"; now?: Date } = {},
): Promise<{ url: string; init: RequestInit }> {
  const body = await encryptPayload(target, enc.encode(JSON.stringify(message)));
  const headers: Record<string, string> = {
    Authorization: await vapidAuthorization(target.endpoint, keys, opts.now),
    "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream",
    TTL: String(opts.ttl ?? 86_400),
    Urgency: opts.urgency ?? "normal",
  };
  // Topic replaces an undelivered push with the same topic (one per chat or event).
  if (message.tag && /^[A-Za-z0-9_-]{1,32}$/.test(message.tag)) headers.Topic = message.tag;
  return { url: target.endpoint, init: { method: "POST", headers, body } };
}
