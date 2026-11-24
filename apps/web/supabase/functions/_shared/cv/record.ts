/**
 * The Record's signing (PRD 5.30): RecordEntryV1, signed by the cv-sign Edge Function with the
 * CV signing key and the same RFC 8785 canonical JSON. The envelope is
 * {v: 1, type: "record_entry", code, key_id, issued_at, entry}; the signature is Ed25519 over
 * the SHA-256 of its canonical bytes, as for CVs. Codes share the /verify namespace with CVs.
 * Web APIs only: shared by the Edge Function, the verify page and the Node tests.
 */
import { canonicalBytes } from "./canonical.ts";
import { fromBase64Url, isoSeconds, newCode, sha256, toBase64Url, type SignatureCheck } from "./sign.ts";
import type { Db, Log } from "../github/types.ts";

export interface RecordEnvelope {
  v: 1;
  type: "record_entry";
  code: string;
  key_id: string;
  issued_at: string;
  entry: Record<string, unknown>;
}

/** The envelope a sealed entry was signed as, rebuilt from its columns. */
export function recordEnvelopeOf(row: { code: string; key_id: string; signed_at: string | Date; payload: Record<string, unknown> }): RecordEnvelope {
  return { v: 1, type: "record_entry", code: row.code, key_id: row.key_id, issued_at: isoSeconds(row.signed_at), entry: row.payload };
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(text: string): Uint8Array {
  return Uint8Array.from(text.match(/../g) ?? [], (h) => parseInt(h, 16));
}

export async function recordEnvelopeHash(envelope: RecordEnvelope): Promise<string> {
  return hex(await sha256(canonicalBytes(envelope)));
}

export async function signRecordEnvelope(envelope: RecordEnvelope, privateKeyPkcs8: string): Promise<{ hash: string; signature: string }> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(privateKeyPkcs8), (c) => c.charCodeAt(0)) as BufferSource,
    { name: "Ed25519" },
    false,
    ["sign"],
  );
  const hash = await recordEnvelopeHash(envelope);
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, key, fromHex(hash) as BufferSource));
  return { hash, signature: toBase64Url(signature) };
}

export async function checkRecordEnvelope(envelope: RecordEnvelope, storedHash: string, signature: string, publicKey: string): Promise<SignatureCheck> {
  const hash = await recordEnvelopeHash(envelope);
  if (hash !== storedHash) return "hash_mismatch";
  try {
    const key = await crypto.subtle.importKey("raw", fromBase64Url(publicKey) as BufferSource, { name: "Ed25519" }, false, ["verify"]);
    const ok = await crypto.subtle.verify({ name: "Ed25519" }, key, fromBase64Url(signature) as BufferSource, fromHex(hash) as BufferSource);
    return ok ? "valid" : "bad_signature";
  } catch {
    return "bad_signature";
  }
}

export class NoRecordKey extends Error {}

function isCodeClash(error: unknown): boolean {
  const e = error as { code?: string; constraint_name?: string; message?: string };
  return e?.code === "23505" && (e.constraint_name === "record_entries_code_key" || /record_entries_code_key/.test(e.message ?? ""));
}

/** Seals one pending entry. "skipped" when it is no longer pending (revoked, already sealed). */
export async function sealEntry(deps: { db: Db; log: Log }, entryId: string): Promise<{ status: "sealed"; code: string } | { status: "skipped" }> {
  const [prep] = await deps.db.query<{ payload: Record<string, unknown>; issued_at: string }>(
    "select payload, issued_at from private.record_sign_prepare($1::uuid)",
    [entryId],
  );
  if (!prep) return { status: "skipped" };
  const [key] = await deps.db.query<{ key_id: string; private_key: string }>("select * from private.cv_active_key()");
  if (!key) throw new NoRecordKey("no active signing key: run select private.cv_rotate_key()");
  for (let attempt = 0; attempt < 5; attempt++) {
    const envelope: RecordEnvelope = {
      v: 1,
      type: "record_entry",
      code: newCode(),
      key_id: key.key_id,
      issued_at: isoSeconds(prep.issued_at),
      entry: prep.payload,
    };
    const { hash, signature } = await signRecordEnvelope(envelope, key.private_key);
    try {
      const [row] = await deps.db.query<{ id: string | null }>(
        "select private.record_sign_commit($1::uuid, $2, $3, $4::timestamptz, $5::jsonb, $6, $7) as id",
        [entryId, envelope.code, key.key_id, envelope.issued_at, prep.payload, hash, signature],
      );
      if (!row?.id) return { status: "skipped" };
      return { status: "sealed", code: envelope.code };
    } catch (error) {
      if (!isCodeClash(error)) throw error;
    }
  }
  throw new Error("could not find a free Record code");
}

interface QueueMessage {
  msg_id: string;
  read_ct: number;
  message: { entry_id?: unknown };
}

/** One pass over record_jobs: failed messages come back after 2 minutes, 5 tries. */
export async function drainRecordQueue(deps: { db: Db; log: Log }, batch = 50) {
  const out = { sealed: 0, skipped: 0, failed: 0, dropped: 0 };
  const messages = await deps.db.query<QueueMessage>("select msg_id, read_ct, message from pgmq.read('record_jobs', 120, $1)", [batch]);
  for (const m of messages) {
    const entryId = typeof m.message?.entry_id === "string" ? m.message.entry_id : null;
    if (!entryId || m.read_ct > 5) {
      await deps.db.query("select pgmq.archive('record_jobs', $1::bigint)", [m.msg_id]);
      out.dropped++;
      deps.log("record.sign", { level: "error", outcome: "dropped", msg_id: String(m.msg_id) });
      continue;
    }
    try {
      const r = await sealEntry(deps, entryId);
      if (r.status === "sealed") out.sealed++;
      else out.skipped++;
      await deps.db.query("select pgmq.delete('record_jobs', $1::bigint)", [m.msg_id]);
    } catch (error) {
      out.failed++;
      deps.log("record.sign", { level: "error", outcome: "error", error: error instanceof Error ? error.message : "unknown" });
      if (error instanceof NoRecordKey) break;
    }
  }
  if (out.sealed) deps.log("record.sign", { outcome: "ok", sealed: out.sealed });
  return out;
}
