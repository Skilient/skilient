import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbFrom } from "../../supabase/functions/_shared/github/types.ts";
import { handleCvSign, rotateKey } from "../../supabase/functions/_shared/cv/issue.ts";
import { checkRecordEnvelope, drainRecordQueue, recordEnvelopeOf, sealEntry } from "../../supabase/functions/_shared/cv/record.ts";

/**
 * The Record's signing in the cv-sign Edge Function (PRD 5.30): pending entries on record_jobs
 * are sealed with the CV key (RecordEntryV1, RFC 8785), the stored envelope verifies with the
 * key that signed it, any change is caught, a revoked entry is never sealed, and a correction
 * supersedes the entry it corrects when it seals.
 */
const sql = postgres(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres", { max: 1, onnotice: () => undefined });
const db = dbFrom(sql);
const log = () => undefined;
const userId = randomUUID();
const keys: string[] = [];

interface Row {
  id: string;
  status: string;
  code: string;
  key_id: string;
  signed_at: Date;
  payload: Record<string, unknown>;
  envelope_hash: string;
  signature: string;
  public_key: string;
}

async function row(id: string): Promise<Row> {
  const [r] = await sql<Row[]>`
    select e.id, e.status, e.code, e.key_id, e.signed_at, e.payload, e.envelope_hash, e.signature, k.public_key
      from public.record_entries e left join public.signing_keys k on k.key_id = e.key_id where e.id = ${id}`;
  return r;
}

async function check(id: string) {
  const r = await row(id);
  return checkRecordEnvelope(recordEnvelopeOf(r), r.envelope_hash, r.signature, r.public_key);
}

async function entry(title: string, supersedes: string | null = null): Promise<string> {
  const [r] = await sql<{ id: string }[]>`
    select private.issue_record_entry(${userId}, null, 'venture_completed', 'skilient', null, 'Skilient', 'venture', ${randomUUID()},
                                      ${title}, '{"line": "Team of 4 · completed 21 Sep 2026", "team_size": 4}'::jsonb, '2026-09-21',
                                      null, false, ${supersedes}) as id`;
  return r.id;
}

beforeAll(async () => {
  await sql`select pgmq.purge_queue('record_jobs')`;
  await sql`insert into auth.users (id, email) values (${userId}, ${`recsign-${userId.slice(0, 8)}@nutech.edu.pk`})`;
  await sql`update public.profiles set onboarding_complete = true, username = ${`rs_${userId.slice(0, 8)}`}, full_name = 'Rec Signer' where user_id = ${userId}`;
  const { key_id } = await rotateKey({ db, log });
  keys.push(key_id);
});

afterAll(async () => {
  await sql`delete from auth.users where id = ${userId}`;
  await sql`delete from vault.secrets where name = any (${keys.map((k) => `cv_signing_key:${k}`)})`;
  await sql`delete from public.signing_keys where key_id = any (${keys}) and not exists (select 1 from public.cv_records r where r.key_id = signing_keys.key_id)
              and not exists (select 1 from public.record_entries e where e.key_id = signing_keys.key_id)`;
  await sql`select pgmq.purge_queue('record_jobs')`;
  await sql.end();
});

describe("record signing", () => {
  it("seals queued entries in one drain, and they verify", async () => {
    const a = await entry("Timetable");
    const b = await entry("Canteen");
    const [{ secret }] = await sql`select decrypted_secret as secret from vault.decrypted_secrets where name = 'cv_worker_secret'`;
    const out = await handleCvSign({ db, log, verify: async () => null }, `Bearer ${secret}`, { action: "record_drain" });
    expect(out.status).toBe(200);
    expect(out.body.sealed).toBeGreaterThanOrEqual(2);
    for (const id of [a, b]) {
      const r = await row(id);
      expect(r.status).toBe("sealed");
      expect(r.code).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{10}$/);
      expect(r.payload).toMatchObject({ schema: "skilient.record/1", kind: "venture_completed", holder: { name: "Rec Signer" } });
      expect(await check(id)).toBe("valid");
    }
    expect((await drainRecordQueue({ db, log })).sealed).toBe(0);
  });

  it("catches a changed payload or signature", async () => {
    const id = await entry("Library");
    await sealEntry({ db, log }, id);
    const r = await row(id);
    const changed = { ...r, payload: { ...r.payload, title: "Library (edited)" } };
    expect(await checkRecordEnvelope(recordEnvelopeOf(changed), r.envelope_hash, r.signature, r.public_key)).toBe("hash_mismatch");
    const flipped = r.signature.slice(0, -2) + (r.signature.endsWith("AA") ? "BA" : "AA");
    expect(await checkRecordEnvelope(recordEnvelopeOf(r), r.envelope_hash, flipped, r.public_key)).toBe("bad_signature");
  });

  it("never seals a revoked entry", async () => {
    const id = await entry("Bus routes");
    await sql`update public.record_entries set status = 'revoked', revoked_at = now(), revoked_category = 'issued_in_error',
              revoked_reason = 'Wrong student' where id = ${id}`;
    expect(await sealEntry({ db, log }, id)).toEqual({ status: "skipped" });
    expect((await row(id)).code).toBeNull();
  });

  it("supersedes the corrected entry when the correction seals", async () => {
    const old = await entry("Study groups");
    await sealEntry({ db, log }, old);
    const fix = await entry("Study Groups App", old);
    const sealed = await sealEntry({ db, log }, fix);
    expect(sealed.status).toBe("sealed");
    const [o] = await sql`select status, superseded_by from public.record_entries where id = ${old}`;
    expect(o).toEqual({ status: "superseded", superseded_by: fix });
    expect((await row(fix)).payload.supersedes).toBe((await row(old)).code);
    expect(await check(old)).toBe("valid");
  });

  it("keeps codes unique across CVs and entries", async () => {
    const id = await entry("Namespace");
    await sealEntry({ db, log }, id);
    const code = (await row(id)).code;
    await expect(sql`update public.record_entries set code = ${code} where id <> ${id} and code is not null and user_id = ${userId}`).rejects.toThrow();
    await expect(
      sql`insert into public.cv_records (user_id, code, version, snapshot, content_hash, snapshot_hash, signature, key_id, source, issued_at, expires_at)
          values (${userId}, ${code}, 1, '{}', ${"a".repeat(64)}, ${"a".repeat(64)}, ${"A".repeat(86)}, ${keys[0]}, 'first',
                  date_trunc('second', now()), now() + interval '1 year')`,
    ).rejects.toThrow(/taken/);
  });
});
