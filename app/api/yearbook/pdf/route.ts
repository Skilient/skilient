import { getYearbookPage } from "@/lib/data/yearbook";
import { logger, requestIdFrom } from "@/lib/log";
import { renderRecordPdf } from "@/lib/record/pdf";
import { newRequestId } from "@/lib/request-id";
import { rateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { yearbookPageHtml } from "@/lib/yearbook/pdf";

/**
 * The caller's own yearbook page as a PDF (PRD 5.33), any time, frozen or not. Printed per request by
 * the same headless Chromium as Record PDFs and returned directly; nothing is stored. Acts for the
 * signed-in student; the page is read through yearbook_page(), which checks the caller.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers) ?? newRequestId();
  const started = performance.now();
  const log = (outcome: "ok" | "refused" | "error", fields: Record<string, unknown> = {}) =>
    logger[outcome === "error" ? "error" : outcome === "refused" ? "warn" : "info"]("yearbook.pdf", {
      request_id: requestId,
      action: "POST /api/yearbook/pdf",
      duration_ms: Math.round(performance.now() - started),
      outcome,
      ...fields,
    });
  const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    log("refused", { error_code: "no_session" });
    return json(401, { error: "no_session", message: "Your session expired. Sign in again to continue." });
  }
  if (!(await rateLimit(supabase, "yearbook_pdf", user.id, 5, 60))) {
    log("refused", { error_code: "rate_limited", user_id: user.id });
    return json(429, { error: "rate_limited", message: "You're downloading too often. Try again in a minute." });
  }
  const { data: me } = await supabase.from("profiles").select("username").eq("user_id", user.id).single();
  if (!me?.username) {
    log("refused", { error_code: "not_found", user_id: user.id });
    return json(404, { error: "not_found", message: "You don't have a yearbook page yet." });
  }
  let page;
  try {
    page = await getYearbookPage(me.username);
  } catch {
    log("refused", { error_code: "not_found", user_id: user.id });
    return json(404, { error: "not_found", message: "You don't have a yearbook page yet." });
  }
  if (page.hidden) {
    log("refused", { error_code: "not_found", user_id: user.id });
    return json(404, { error: "not_found", message: "You don't have a yearbook page yet." });
  }

  let photo: string | null = null;
  if (page.photoUrl) {
    const res = await fetch(page.photoUrl).catch(() => null);
    if (res?.ok) photo = `data:${res.headers.get("content-type") ?? "image/webp"};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  }
  let pdf: Uint8Array;
  try {
    pdf = await renderRecordPdf(
      yearbookPageHtml({
        name: page.name,
        subtitle: [page.department, `Batch of ${page.batch}`, page.university].filter(Boolean).join(" · "),
        quote: page.quote,
        photo,
        awards: page.awards,
        highlights: page.highlights,
        notes: page.notes,
      }),
    );
  } catch (err) {
    log("error", { error_code: "render_failed", user_id: user.id, error: err instanceof Error ? err.message : "unknown" });
    return json(502, { error: "unavailable", message: "We couldn't make the PDF. Try again.", requestId });
  }
  log("ok", { user_id: user.id, bytes: pdf.byteLength, notes: page.notes.length });
  return new Response(pdf as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="skilient-yearbook-page.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
