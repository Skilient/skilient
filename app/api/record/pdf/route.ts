import { createHash, createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { siteUrl } from "@/lib/cv/site";
import { dayLabel } from "@/lib/format/time";
import { logger, requestIdFrom } from "@/lib/log";
import { certificateHtml, renderRecordPdf, transcriptHtml, type PdfEntry } from "@/lib/record/pdf";
import type { RecordKind } from "@/lib/record/types";
import { newRequestId } from "@/lib/request-id";
import { rateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * Certificate and transcript PDFs (PRD 5.30): the student downloads them from their own account
 * only. The route prints the PDF, records its SHA-256 and the codes on it with a MAC only it can
 * make (CV_EXPORT_SECRET, also in Vault as cv_export_secret), and returns the file. Nothing is
 * stored: the transcript's QR opens /verify/transcript/[id], which checks every entry on it today.
 * Acts for the signed-in student; no service-role key.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("certificate"), entryId: z.uuid() }),
  z.object({ kind: z.literal("transcript") }),
]);

interface Row {
  id: string;
  kind: RecordKind;
  title: string;
  issuer_name: string;
  evidence: { line?: string } | null;
  occurred_on: string;
  code: string;
}

function academicYear(iso: string): number {
  const [y, m] = iso.split("-").map(Number);
  return m >= 9 ? y : y - 1;
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers) ?? newRequestId();
  const started = performance.now();
  const log = (outcome: "ok" | "refused" | "error", fields: Record<string, unknown> = {}) =>
    logger[outcome === "error" ? "error" : outcome === "refused" ? "warn" : "info"]("record.pdf", {
      request_id: requestId,
      action: "POST /api/record/pdf",
      duration_ms: Math.round(performance.now() - started),
      outcome,
      ...fields,
    });
  const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    log("refused", { error_code: "invalid_input" });
    return json(400, { error: "invalid_input", message: "Choose an entry or the transcript." });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    log("refused", { error_code: "no_session" });
    return json(401, { error: "no_session", message: "Your session expired. Sign in again to continue." });
  }
  const secret = process.env.CV_EXPORT_SECRET;
  if (!secret) {
    log("error", { error_code: "not_configured", user_id: user.id });
    return json(503, { error: "not_configured", message: "PDFs aren't set up yet." });
  }
  if (!(await rateLimit(supabase, "record_pdf", user.id, 5, 60))) {
    log("refused", { error_code: "rate_limited", user_id: user.id });
    return json(429, { error: "rate_limited", message: "You're downloading too often. Try again in a minute." });
  }

  // Ownership: RLS shows the student their own entries (and officers their society's; filtered to the student here).
  let query = supabase
    .from("record_entries")
    .select("id, kind, title, issuer_name, evidence, occurred_on, code")
    .eq("user_id", user.id)
    .eq("status", "sealed")
    .order("occurred_on", { ascending: false });
  query = parsed.data.kind === "certificate" ? query.eq("id", parsed.data.entryId) : query.eq("hidden", false);
  const [{ data: rows, error }, { data: me }] = await Promise.all([
    query.limit(500),
    supabase.from("profiles").select("full_name, department, universities(name)").eq("user_id", user.id).single(),
  ]);
  if (error || !rows?.length) {
    log("refused", { error_code: "not_found", user_id: user.id });
    return json(404, { error: "not_found", message: parsed.data.kind === "certificate" ? "That entry isn't sealed on your Record." : "Your Record has no sealed entries to print yet." });
  }
  const entries: PdfEntry[] = (rows as unknown as Row[]).map((r) => ({
    kind: r.kind,
    title: r.title,
    issuerName: r.issuer_name,
    line: r.evidence?.line ?? "",
    dateLabel: dayLabel(r.occurred_on),
    code: r.code,
    academicYear: academicYear(r.occurred_on),
  }));
  const profile = me as unknown as { full_name: string; department: string | null; universities: { name: string } | null } | null;
  const holder = profile?.full_name ?? "Student";
  const university = profile?.universities?.name ?? "";
  const exportId = randomUUID();

  let pdf: Uint8Array;
  try {
    const html =
      parsed.data.kind === "certificate"
        ? await certificateHtml({ holder, university, entry: entries[0], siteUrl: siteUrl() })
        : await transcriptHtml({ holder, university, department: profile?.department ?? null, entries, exportId, issuedLabel: dayLabel(new Date().toISOString()), siteUrl: siteUrl() });
    pdf = await renderRecordPdf(html);
  } catch (err) {
    log("error", { error_code: "render_failed", user_id: user.id, error: err instanceof Error ? err.message : "unknown" });
    return json(502, { error: "unavailable", message: "We couldn't make the PDF. Try again.", requestId });
  }

  const hash = createHash("sha256").update(pdf).digest("hex");
  const codes = entries.map((e) => e.code);
  const entryId = parsed.data.kind === "certificate" ? parsed.data.entryId : "";
  const mac = createHmac("sha256", secret).update(`${exportId}|${parsed.data.kind}|${entryId}|${codes.join(",")}|${hash}|${pdf.byteLength}`).digest("hex");
  const { error: recordError } = await supabase.rpc("record_pdf_export", {
    p_export: exportId,
    p_kind: parsed.data.kind,
    p_entry: entryId || (null as unknown as string),
    p_codes: codes,
    p_pdf_hash: hash,
    p_bytes: pdf.byteLength,
    p_mac: mac,
  });
  if (recordError) {
    const status = recordError.code === "54000" ? 429 : recordError.code === "P0002" ? 404 : 502;
    log(status === 502 ? "error" : "refused", { error_code: recordError.code ?? "unknown", user_id: user.id });
    return json(status, { error: "refused", message: status === 429 ? "Up to 30 PDFs a day. Try again tomorrow." : "Something went wrong on our side. Try again.", requestId });
  }
  log("ok", { user_id: user.id, kind: parsed.data.kind, bytes: pdf.byteLength, entries: codes.length });
  const name = parsed.data.kind === "certificate" ? `skilient-certificate-${codes[0]}.pdf` : `skilient-record-${exportId.slice(0, 8)}.pdf`;
  return new Response(pdf as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
      "X-Record-Export": exportId,
      "X-Record-Sha256": hash,
    },
  });
}
