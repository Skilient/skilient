import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dbFrom } from "../../supabase/functions/_shared/github/types.ts";
import { runPushWorker } from "../../supabase/functions/_shared/notify/push.ts";
import { b64urlDecode, b64urlEncode, decryptPayload } from "../../supabase/functions/_shared/notify/webpush.ts";

/**
 * The notify-worker's push channel (PRD 5.34) against the real local database, with the browser's
 * push service faked: the fake decrypts each push with the subscription's own keys and checks the
 * VAPID signature, so what a phone would show is what's asserted. Done-when: a registered student
 * gets the 1-hour event reminder as a push, and turning the category off stops it.
 */
const url = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const sql = postgres(url, { max: 1, onnotice: () => undefined });
const db = dbFrom(sql);

const student = randomUUID();
const email = `push-${student.slice(0, 8)}@nutech.edu.pk`;
const endpoint = `https://fcm.googleapis.com/fcm/send/test-${student.slice(0, 8)}`;

let device: { privateKey: CryptoKey; raw: Uint8Array; auth: Uint8Array };
let vapidVerify: CryptoKey;
let vapidPublic: string;

interface Delivered {
  url: string;
  headers: Record<string, string>;
  message: { title: string; body: string; url: string; tag?: string };
}

/** A push service: answers with the queued statuses (default 201) and opens each message. */
function fakePushService(statuses: number[] = []) {
  const delivered: Delivered[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const target = typeof input === "string" ? input : input.toString();
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const status = statuses.shift() ?? 201;
    const [, t, k] = /^vapid t=([^,]+), k=(.+)$/.exec(headers.authorization ?? "") ?? [];
    expect(k).toBe(vapidPublic);
    const [h, c, sig] = t.split(".");
    expect(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, vapidVerify, b64urlDecode(sig), new TextEncoder().encode(`${h}.${c}`))).toBe(true);
    const plain = await decryptPayload(new Uint8Array(init?.body as Uint8Array), device.privateKey, device.raw, device.auth);
    delivered.push({ url: target, headers, message: JSON.parse(new TextDecoder().decode(plain)) });
    return new Response(null, { status });
  }) as typeof fetch;
  return { impl, delivered };
}

const logs: { event: string; fields?: Record<string, unknown> }[] = [];
const log = (event: string, fields?: Record<string, unknown>) => logs.push({ event, fields });

async function as<T>(query: string, params: unknown[] = []): Promise<T[]> {
  return sql.begin(async (tx) => {
    await tx.unsafe("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: student, role: "authenticated" })]);
    await tx.unsafe("set local role authenticated");
    return tx.unsafe(query, params as never[]) as unknown as T[];
  }) as Promise<T[]>;
}

async function remind() {
  await sql`select private.notify(${student}::uuid, null, 'event_reminder', 'event', ${randomUUID()}::uuid,
            '{"event": "Build with React", "when": "1h"}'::jsonb)`;
}

beforeAll(async () => {
  // VAPID keys in Vault, the way docs/archive/supabase-era/setup-checklist.md puts them there.
  const vapid = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  vapidVerify = vapid.publicKey;
  vapidPublic = b64urlEncode(new Uint8Array(await crypto.subtle.exportKey("raw", vapid.publicKey)));
  const d = (await crypto.subtle.exportKey("jwk", vapid.privateKey)).d!;
  await sql`delete from vault.secrets where name in ('vapid_public_key', 'vapid_private_key', 'vapid_subject')`;
  await sql`select vault.create_secret(${vapidPublic}, 'vapid_public_key'), vault.create_secret(${d}, 'vapid_private_key'),
                   vault.create_secret('https://www.skilient.com', 'vapid_subject')`;

  // The student's phone: an ECDH key pair and an auth secret, subscribed through the app's own function.
  const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  device = { privateKey: pair.privateKey, raw: new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)), auth: crypto.getRandomValues(new Uint8Array(16)) };
  await sql`insert into auth.users (id, email) values (${student}, ${email})`;
  await sql`update public.profiles set onboarding_complete = true, username = ${`push_${student.slice(0, 6)}`}, full_name = 'Push Student' where user_id = ${student}`;
  const [key] = await as<{ push_public_key: string }>("select public.push_public_key()");
  expect(key.push_public_key).toBe(vapidPublic);
  await as("select public.save_push_subscription($1, $2, $3, 'Test phone')", [endpoint, b64urlEncode(device.raw), b64urlEncode(device.auth)]);
});

beforeEach(async () => {
  await sql`select pgmq.purge_queue('notification_push')`;
  await sql`delete from public.notification_push_prefs where user_id = ${student}`;
  logs.length = 0;
});

afterAll(async () => {
  await sql`select pgmq.purge_queue('notification_push')`;
  await sql`delete from vault.secrets where name in ('vapid_public_key', 'vapid_private_key', 'vapid_subject')`;
  await sql`delete from auth.users where id = ${student}`;
  await sql.end();
});

describe("notify-worker push", () => {
  it("delivers the 1-hour event reminder as an encrypted push the phone can read", async () => {
    await remind();
    const fake = fakePushService();
    const result = await runPushWorker({ db, fetch: fake.impl, log });
    expect(result.sent).toBe(1);
    expect(fake.delivered).toHaveLength(1);
    const [push] = fake.delivered;
    expect(push.url).toBe(endpoint);
    expect(push.headers["content-encoding"]).toBe("aes128gcm");
    expect(push.headers.urgency).toBe("high");
    expect(push.headers.ttl).toBe("3600");
    expect(push.message.body).toBe("In an hour: Build with React. Have your ticket ready.");
    expect(push.message.url).toMatch(/^\/events\/[0-9a-f-]{36}\/ticket$/);
    const [sub] = await sql<{ last_used_at: Date | null }[]>`select last_used_at from public.push_subscriptions where endpoint = ${endpoint}`;
    expect(sub.last_used_at).not.toBeNull();
  });

  it("stops when the student turns the category off", async () => {
    await as("select public.set_push_pref('societies', false)");
    await remind();
    const fake = fakePushService();
    await runPushWorker({ db, fetch: fake.impl, log });
    expect(fake.delivered).toHaveLength(0);
  });

  it("drops a push queued before the category was turned off", async () => {
    await remind();
    await as("select public.set_push_pref('societies', false)");
    const fake = fakePushService();
    const result = await runPushWorker({ db, fetch: fake.impl, log });
    expect(fake.delivered).toHaveLength(0);
    expect(result.skipped).toBe(1);
  });

  it("skips a notification already read in the app", async () => {
    await remind();
    await sql`update public.notifications set read_at = now() where user_id = ${student} and read_at is null`;
    const fake = fakePushService();
    await runPushWorker({ db, fetch: fake.impl, log });
    expect(fake.delivered).toHaveLength(0);
  });

  it("retries a push the service couldn't take, then removes a gone subscription", async () => {
    await remind();
    const busy = fakePushService([503]);
    const first = await runPushWorker({ db, fetch: busy.impl, log });
    expect(first.deferred).toBe(1);
    await sql`update pgmq.q_notification_push set vt = now()`;
    const gone = fakePushService([410]);
    await runPushWorker({ db, fetch: gone.impl, log });
    const subs = await sql`select 1 from public.push_subscriptions where endpoint = ${endpoint}`;
    expect(subs).toHaveLength(0);
    // Subscribe again for any later run.
    await as("select public.save_push_subscription($1, $2, $3, 'Test phone')", [endpoint, b64urlEncode(device.raw), b64urlEncode(device.auth)]);
  });

  it("never calls an endpoint outside the browsers' push services", async () => {
    await sql`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
              values (${student}, 'https://internal.example.test/hook', ${b64urlEncode(device.raw)}, ${b64urlEncode(device.auth)})`;
    await remind();
    const fake = fakePushService();
    const result = await runPushWorker({ db, fetch: fake.impl, log });
    expect(fake.delivered.map((d) => d.url)).toEqual([endpoint]);
    expect(result.removed).toBe(1);
  });

  it("skips quietly while the VAPID keys aren't set up", async () => {
    const saved = await sql<{ name: string; secret: string }[]>`select name, decrypted_secret as secret from vault.decrypted_secrets where name like 'vapid_%'`;
    await sql`delete from vault.secrets where name like 'vapid_%'`;
    await remind();
    const fake = fakePushService();
    const result = await runPushWorker({ db, fetch: fake.impl, log });
    expect(fake.delivered).toHaveLength(0);
    expect(result.skipped).toBe(1);
    expect(logs.some((l) => l.event === "notify.push_not_configured")).toBe(true);
    for (const s of saved) await sql`select vault.create_secret(${s.secret}, ${s.name})`;
  });
});
