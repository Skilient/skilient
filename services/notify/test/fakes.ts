import { expect } from "vitest";
import { b64urlDecode, b64urlEncode, decryptPayload, type VapidKeys } from "../src/domain/webpush";

type CryptoKey = import("node:crypto").webcrypto.CryptoKey;
type CryptoKeyPair = import("node:crypto").webcrypto.CryptoKeyPair;

/**
 * Test doubles for notify's two outside services, ported from apps/web's notify-worker and notify-push tests: a push
 * service that checks each VAPID signature and decrypts each message with the device's own keys (so what a phone
 * would show is what's asserted), and Azure Communication Services Email answering from a script. Keys are made here, per test file; they are
 * passed to the service through TransportOptions.secrets and never written anywhere.
 */
export async function makeVapid(): Promise<{ keys: VapidKeys; verify: CryptoKey; secret: string }> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const publicKey = b64urlEncode(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)));
  const privateKey = (await crypto.subtle.exportKey("jwk", pair.privateKey)).d!;
  const keys = { publicKey, privateKey, subject: "https://www.skilient.test" };
  return { keys, verify: pair.publicKey, secret: JSON.stringify({ public_key: publicKey, private_key: privateKey, subject: keys.subject }) };
}

export interface Device {
  privateKey: CryptoKey;
  raw: Uint8Array;
  auth: Uint8Array;
  p256dh: string;
  authB64: string;
  endpoint: string;
}

export async function makeDevice(tag: string): Promise<Device> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { privateKey: pair.privateKey, raw, auth, p256dh: b64urlEncode(raw), authB64: b64urlEncode(auth), endpoint: `https://fcm.googleapis.com/fcm/send/notify-test-${tag}` };
}

export interface Delivered {
  url: string;
  headers: Record<string, string>;
  message: { title: string; body: string; url: string; tag?: string };
}

/** A push service for the given devices: answers with the queued statuses (default 201) and opens each message. */
export function fakePushService(vapid: { keys: VapidKeys; verify: CryptoKey }, devices: Device[], statuses: number[] = []) {
  const delivered: Delivered[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const target = typeof input === "string" ? input : input.toString();
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const status = statuses.shift() ?? 201;
    const [, t, k] = /^vapid t=([^,]+), k=(.+)$/.exec(headers["authorization"] ?? "") ?? [];
    expect(k).toBe(vapid.keys.publicKey);
    const [h, c, sig] = t!.split(".");
    expect(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, vapid.verify, b64urlDecode(sig!), new TextEncoder().encode(`${h}.${c}`))).toBe(true);
    const device = devices.find((d) => d.endpoint === target);
    if (!device) throw new Error("push to an unknown endpoint");
    const plain = await decryptPayload(new Uint8Array(init?.body as Uint8Array), device.privateKey, device.raw, device.auth);
    delivered.push({ url: target, headers, message: JSON.parse(new TextDecoder().decode(plain)) as Delivered["message"] });
    return new Response(null, { status });
  }) as typeof fetch;
  return { impl, delivered };
}

export interface Sent {
  to: string;
  subject: string;
  text: string;
  sender: string;
  /** Azure's repeatability-request-id. */
  requestId: string;
}

/** The token the fake expects (the managed identity's, in production). */
export const EMAIL_TOKEN = "test-entra-token";
export const EMAIL_ENDPOINT = "https://skilient-test.communication.azure.com";

/**
 * Azure Communication Services Email: accepts (202 with an operation id) unless a scripted answer is queued; checks the
 * bearer token and the API path; records what was sent. A repeated request id is accepted again without a second send,
 * as Azure's repeatability does.
 */
export function fakeAzureEmail(answers: { status: number; body?: Record<string, unknown>; headers?: Record<string, string> }[] = []) {
  const sent: Sent[] = [];
  const seen = new Set<string>();
  let n = 0;
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    expect(String(input)).toBe(`${EMAIL_ENDPOINT}/emails:send?api-version=2023-03-31`);
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    expect(headers["authorization"]).toBe(`Bearer ${EMAIL_TOKEN}`);
    expect(headers["repeatability-first-sent"]).toMatch(/GMT$/);
    const body = JSON.parse(String(init?.body)) as {
      senderAddress: string;
      recipients: { to: { address: string }[] };
      content: { subject: string; plainText: string };
    };
    const a = answers.shift() ?? { status: 202, body: { id: `op-${++n}`, status: "Running" } };
    const id = headers["repeatability-request-id"]!;
    if (a.status < 300 && !seen.has(id)) {
      seen.add(id);
      sent.push({ to: body.recipients.to[0]!.address, subject: body.content.subject, text: body.content.plainText, sender: body.senderAddress, requestId: id });
    }
    return new Response(JSON.stringify(a.body ?? {}), { status: a.status, headers: { "content-type": "application/json", ...(a.headers ?? {}) } });
  }) as typeof fetch;
  return { impl, sent };
}
