/**
 * RecordEntryV1: what private.record_sign_prepare() builds and cv-sign signs (PRD 5.30). The
 * signed envelope is {v: 1, type: "record_entry", code, key_id, issued_at, entry}, Ed25519 over
 * the SHA-256 of its RFC 8785 canonical JSON (supabase/functions/_shared/cv/record.ts).
 * Integers and strings only. Client-safe.
 */
export type RecordKind = "attended" | "completed" | "result" | "office_bearer" | "volunteer" | "venture_completed" | "taught" | "proof_task";

export interface RecordEntryV1 {
  schema: "skilient.record/1";
  id: string;
  kind: RecordKind;
  title: string;
  issuer: { type: "society" | "skilient"; name: string };
  holder: { name: string; university: string };
  /** The day it happened, YYYY-MM-DD (PKT). */
  date: string;
  /** The evidence line plus kind-specific integers (place, entrants, minutes, sessions, ...). */
  evidence: { line?: string } & Record<string, string | number>;
  /** The code of the entry this one corrects, or null. */
  supersedes: string | null;
}
