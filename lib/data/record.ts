import "server-only";

import { headers } from "next/headers";
import { rpcJson } from "@/lib/data/rpc-json";
import { dayLabel, clockTime } from "@/lib/format/time";
import { logger, requestIdFrom } from "@/lib/log";
import { academicYearLabel, KIND_LABELS, KIND_ORDER } from "@/lib/record/constants";
import type { RecordEntryV1, RecordKind } from "@/lib/record/types";
import { keyedHash, sha256Hex } from "@/lib/security/hash";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp, userAgent } from "@/lib/security/request-meta";
import { createClient } from "@/lib/supabase/server";
import { checkRecordEnvelope, recordEnvelopeOf } from "@/supabase/functions/_shared/cv/record.ts";
import { normaliseCode } from "@/supabase/functions/_shared/cv/sign.ts";

/**
 * The Record's reads (PRD 5.30): the owner's ledger, share links, verify for entries and
 * transcripts, the society's Record tab, profile highlights and the claim count. Every read is
 * one SQL function that checks the caller; dates are formatted here, on the server.
 */

export interface RecordEntry {
  id: string;
  kind: RecordKind;
  title: string;
  issuerType: "society" | "skilient";
  issuerName: string;
  issuerSlug: string | null;
  line: string;
  occurredOn: string;
  dateLabel: string;
  status: "awaiting" | "pending" | "sealed" | "revoked" | "superseded";
  code: string | null;
  sealedLabel: string | null;
  hidden: boolean;
  pinned: boolean;
  revokedLabel: string | null;
  revokedReason: string | null;
  revokedCategory: string | null;
  supersededByCode: string | null;
  academicYear: number;
  mistakeOpen: boolean;
  appealable: boolean;
}

interface RawEntry {
  id: string;
  kind: RecordKind;
  title: string;
  issuer_type: "society" | "skilient";
  issuer_name: string;
  issuer_slug: string | null;
  line: string | null;
  occurred_on: string;
  status: RecordEntry["status"];
  code: string | null;
  signed_at: string | null;
  hidden: boolean;
  pinned: boolean;
  revoked_at: string | null;
  revoked_reason: string | null;
  revoked_category: string | null;
  superseded_by_code: string | null;
  academic_year: number;
  mistake_open: boolean;
  appealable: boolean;
}

function entryFrom(r: RawEntry): RecordEntry {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    issuerType: r.issuer_type,
    issuerName: r.issuer_name,
    issuerSlug: r.issuer_slug,
    line: r.line ?? "",
    occurredOn: r.occurred_on,
    dateLabel: dayLabel(r.occurred_on),
    status: r.status,
    code: r.code,
    sealedLabel: r.signed_at ? `Sealed · ${clockTime(r.signed_at)}` : null,
    hidden: r.hidden,
    pinned: r.pinned,
    revokedLabel: r.revoked_at ? dayLabel(r.revoked_at) : null,
    revokedReason: r.revoked_reason,
    revokedCategory: r.revoked_category,
    supersededByCode: r.superseded_by_code,
    academicYear: r.academic_year,
    mistakeOpen: r.mistake_open,
    appealable: r.appealable,
  };
}

export interface RecordYear {
  year: number;
  label: string;
  entries: RecordEntry[];
}

/** Rows grouped by academic year (September to August), newest first. */
export function groupByYear<T extends { academicYear: number }>(entries: T[]): { year: number; label: string; entries: T[] }[] {
  const years = new Map<number, T[]>();
  for (const e of entries) years.set(e.academicYear, [...(years.get(e.academicYear) ?? []), e]);
  return [...years.entries()].sort((a, b) => b[0] - a[0]).map(([year, list]) => ({ year, label: academicYearLabel(year), entries: list }));
}

export interface MyRecord {
  entries: RecordEntry[];
  superseded: RecordEntry[];
  counts: { kind: RecordKind; count: number }[];
  waiting: number;
  pins: number;
  links: { id: string; label: string | null; expiresLabel: string; viewCount: number; createdLabel: string }[];
  nextEvent: { id: string; title: string; society: string; whenLabel: string } | null;
}

export async function getMyRecord(): Promise<MyRecord> {
  const raw = await rpcJson<{
    entries: RawEntry[];
    superseded: RawEntry[];
    waiting: number;
    pins: number;
    links: { id: string; label: string | null; expires_at: string; view_count: number; created_at: string }[];
    next_event: { id: string; title: string; society: string; starts_at: string } | null;
  }>("my_record");
  const entries = raw.entries.map(entryFrom);
  const sealed = entries.filter((e) => e.status === "sealed");
  return {
    entries,
    superseded: raw.superseded.map(entryFrom),
    counts: KIND_ORDER.map((kind) => ({ kind, count: sealed.filter((e) => e.kind === kind).length })).filter((c) => c.count > 0),
    waiting: raw.waiting,
    pins: raw.pins,
    links: raw.links.map((l) => ({ id: l.id, label: l.label, expiresLabel: dayLabel(l.expires_at), viewCount: l.view_count, createdLabel: dayLabel(l.created_at) })),
    nextEvent: raw.next_event
      ? { id: raw.next_event.id, title: raw.next_event.title, society: raw.next_event.society, whenLabel: dayLabel(raw.next_event.starts_at) }
      : null,
  };
}

export async function getRecordWaiting(): Promise<number> {
  return rpcJson<number>("record_waiting");
}

export interface SharedEntry {
  kind: RecordKind;
  title: string;
  issuerName: string;
  line: string;
  dateLabel: string;
  code: string;
  academicYear: number;
}

export type SharedRecord =
  | { state: "invalid" }
  | { state: "ok"; person: { name: string; username: string; university: string; department: string | null }; expiresLabel: string; entries: SharedEntry[] };

export async function getSharedRecord(token: string): Promise<SharedRecord> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { state: "invalid" };
  const h = await headers();
  const supabase = await createClient();
  const viewerKey = keyedHash(`record-view:${clientIp(h) ?? "unknown"}|${userAgent(h)}`);
  const { data, error } = await supabase.rpc("open_record_share", { p_token_hash: sha256Hex(token), p_viewer_key: viewerKey });
  if (error) throw new Error(`shared record: ${error.code}`);
  const d = data as unknown as {
    state: string;
    expires_at?: string;
    person?: { name: string; username: string; university: string; department: string | null };
    entries?: { kind: RecordKind; title: string; issuer_name: string; line: string | null; occurred_on: string; code: string; academic_year: number }[];
  } | null;
  if (!d || d.state !== "ok" || !d.person) return { state: "invalid" };
  return {
    state: "ok",
    person: d.person,
    expiresLabel: dayLabel(d.expires_at ?? new Date().toISOString()),
    entries: (d.entries ?? []).map((e) => ({
      kind: e.kind,
      title: e.title,
      issuerName: e.issuer_name,
      line: e.line ?? "",
      dateLabel: dayLabel(e.occurred_on),
      code: e.code,
      academicYear: e.academic_year,
    })),
  };
}

export type EntryVerify =
  | { status: "rate_limited" }
  | { status: "not_found" }
  | { status: "revoked"; code: string; sealedLabel: string; revokedLabel: string; category: string | null }
  | {
      status: "valid" | "superseded" | "altered";
      code: string;
      sealedLabel: string;
      keyId: string;
      entry: RecordEntryV1;
      supersededByCode: string | null;
      signatureValid: boolean;
    };

/** /verify/[code] for an entry: null when the code isn't a Record entry (it may be a CV). */
export async function verifyRecordCode(rawCode: string): Promise<EntryVerify | null> {
  const code = normaliseCode(rawCode);
  if (!code) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_record_entry", { p_code: code });
  if (error) throw new Error(`verify entry: ${error.code}`);
  const d = data as unknown as {
    code: string;
    status: "sealed" | "revoked" | "superseded";
    signed_at: string;
    revoked_at?: string;
    revoked_category?: string | null;
    key_id?: string;
    public_key?: string;
    payload?: Record<string, unknown>;
    envelope_hash?: string;
    signature?: string;
    superseded_by_code?: string | null;
  } | null;
  if (!d) return null;
  if (d.status === "revoked") {
    return { status: "revoked", code: d.code, sealedLabel: dayLabel(d.signed_at), revokedLabel: dayLabel(d.revoked_at ?? d.signed_at), category: d.revoked_category ?? null };
  }
  const signatureValid =
    !!d.payload && !!d.key_id && !!d.public_key && !!d.envelope_hash && !!d.signature &&
    (await checkRecordEnvelope(recordEnvelopeOf({ code: d.code, key_id: d.key_id, signed_at: d.signed_at, payload: d.payload }), d.envelope_hash, d.signature, d.public_key)) === "valid";
  if (!signatureValid) {
    logger.error("record.verify", { request_id: requestIdFrom(await headers()), action: "record.verify", outcome: "error", error_code: "signature_mismatch" });
  }
  return {
    status: !signatureValid ? "altered" : d.status === "superseded" ? "superseded" : "valid",
    code: d.code,
    sealedLabel: dayLabel(d.signed_at),
    keyId: d.key_id ?? "",
    entry: d.payload as unknown as RecordEntryV1,
    supersededByCode: d.superseded_by_code ?? null,
    signatureValid,
  };
}

/** The verify page's rate limit, shared by CVs and entries (30 a minute per IP). */
export async function verifyAllowed(): Promise<boolean> {
  const h = await headers();
  const supabase = await createClient();
  return rateLimit(supabase, "cv_verify", clientIp(h) ?? "unknown", 30, 60);
}

export interface TranscriptVerify {
  kind: "certificate" | "transcript";
  holderName: string;
  createdLabel: string;
  pdfHash: string;
  entries: { code: string; status: string; title: string | null; issuerName: string | null; dateLabel: string | null }[];
}

export async function verifyTranscript(id: string): Promise<TranscriptVerify | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_record_transcript", { p_id: id });
  if (error) throw new Error(`verify transcript: ${error.code}`);
  const d = data as unknown as {
    kind: "certificate" | "transcript";
    holder_name: string;
    created_at: string;
    pdf_hash: string;
    entries: { code: string; status: string; title: string | null; issuer_name: string | null; occurred_on: string | null }[];
  } | null;
  if (!d) return null;
  return {
    kind: d.kind,
    holderName: d.holder_name,
    createdLabel: dayLabel(d.created_at),
    pdfHash: d.pdf_hash,
    entries: d.entries.map((e) => ({ code: e.code, status: e.status, title: e.title, issuerName: e.issuer_name, dateLabel: e.occurred_on ? dayLabel(e.occurred_on) : null })),
  };
}

export interface SocietyRecord {
  awaiting: { id: string; kind: RecordKind; title: string; line: string; name: string; canConfirm: boolean }[];
  mistakes: { id: string; entryId: string; kind: RecordKind; title: string; line: string; code: string; note: string; name: string; place: number | null; hours: number | null }[];
  entries: { id: string; kind: RecordKind; title: string; line: string; status: string; code: string | null; name: string; issuedLabel: string }[];
  held: number;
}

export async function getSocietyRecord(societyId: string): Promise<SocietyRecord> {
  const d = await rpcJson<{
    awaiting: { id: string; kind: RecordKind; title: string; line: string | null; name: string; can_confirm: boolean }[];
    mistakes: { id: string; entry_id: string; kind: RecordKind; title: string; line: string | null; code: string; note: string; name: string; place: number | null; minutes: number | null }[];
    entries: { id: string; kind: RecordKind; title: string; line: string | null; status: string; code: string | null; name: string; issued_at: string }[];
    held: number;
  }>("society_record_page", { p_society: societyId });
  return {
    awaiting: d.awaiting.map((a) => ({ id: a.id, kind: a.kind, title: a.title, line: a.line ?? "", name: a.name, canConfirm: a.can_confirm })),
    mistakes: d.mistakes.map((m) => ({
      id: m.id, entryId: m.entry_id, kind: m.kind, title: m.title, line: m.line ?? "", code: m.code, note: m.note, name: m.name,
      place: m.place, hours: m.minutes !== null && m.minutes !== undefined ? Math.round((m.minutes / 60) * 10) / 10 : null,
    })),
    entries: d.entries.map((e) => ({ id: e.id, kind: e.kind, title: e.title, line: e.line ?? "", status: e.status, code: e.code, name: e.name, issuedLabel: dayLabel(e.issued_at) })),
    held: d.held,
  };
}

export interface Highlight {
  id: string;
  kind: RecordKind;
  title: string;
  issuerName: string;
  line: string;
  dateLabel: string;
  code: string;
}

export async function getRecordHighlights(userId: string): Promise<Highlight[]> {
  const d = await rpcJson<{ id: string; kind: RecordKind; title: string; issuer_name: string; line: string | null; occurred_on: string; code: string }[]>(
    "record_highlights",
    { p_user: userId },
  );
  return d.map((h) => ({ id: h.id, kind: h.kind, title: h.title, issuerName: h.issuer_name, line: h.line ?? "", dateLabel: dayLabel(h.occurred_on), code: h.code }));
}

export async function getOpsRecordEntry(code: string): Promise<(RecordEntry & { holder: string | null; username: string | null; issuedBy: string | null }) | null> {
  const d = await rpcJson<(RawEntry & { holder: string | null; username: string | null; issued_by: string | null }) | null>("ops_record_entry", { p_code: code });
  if (!d) return null;
  return { ...entryFrom(d), holder: d.holder, username: d.username, issuedBy: d.issued_by };
}

/** The CV picker: sealed entries, the ones on the CV, and the limit. */
export async function getCvActivityChoices(): Promise<{ entries: { id: string; label: string; meta: string }[]; selected: string[]; max: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { entries: [], selected: [], max: 8 };
  const [{ data: rows }, { data: settings }] = await Promise.all([
    supabase.from("record_entries").select("id, kind, title, issuer_name, occurred_on").eq("user_id", user.id).eq("status", "sealed").order("occurred_on", { ascending: false }).limit(200),
    supabase.from("cv_settings").select("record_entries").eq("user_id", user.id).maybeSingle(),
  ]);
  return {
    entries: (rows ?? []).map((r) => ({ id: r.id, label: `${KIND_LABELS[r.kind as RecordKind]}: ${r.title}`, meta: `${r.issuer_name} · ${dayLabel(r.occurred_on)}` })),
    selected: (settings?.record_entries as string[] | undefined) ?? [],
    max: 8,
  };
}
