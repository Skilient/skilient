import { NextResponse, type NextRequest } from "next/server";
import { logger, requestIdFrom } from "@/lib/log";
import { handleBrevoWebhook, verifyBrevoAuthorization } from "@/lib/monitoring/brevo-webhook";
import { newRequestId } from "@/lib/request-id";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/** Brevo transactional deliveries/final bounces; bearer authenticated and durably deduplicated. */
export async function POST(request: NextRequest) {
  const started = performance.now();
  const requestId = requestIdFrom(request.headers) ?? newRequestId();
  const secret = process.env.BREVO_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ ok: false }, { status: 404 });
  // Authenticate before reading a body, then cap actual streamed bytes (not just Content-Length).
  if (!verifyBrevoAuthorization(request.headers, secret)) return NextResponse.json({ ok: false }, { status: 401 });
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 64 * 1024) {
        await reader.cancel();
        return NextResponse.json({ ok: false }, { status: 413 });
      }
      chunks.push(value);
    }
  }
  const rawBody = Buffer.concat(chunks).toString("utf8");
  const result = await handleBrevoWebhook({
    rawBody, headers: request.headers, secret,
    record: async (signal, eventKey) => {
      const { error } = await createServiceClient().rpc("record_brevo_email_signal", { p_kind: signal, p_event_key: eventKey });
      if (error) throw new Error("email_signal_record_failed");
    },
  }).catch(() => ({ status: 500, outcome: "error" as const }));
  logger[result.outcome === "refused" ? "warn" : result.outcome === "error" ? "error" : "info"]("brevo.webhook", {
    request_id: requestId, action: "POST /api/webhooks/brevo", duration_ms: Math.round(performance.now() - started),
    outcome: result.outcome === "ignored" ? "ok" : result.outcome, status: result.status,
  });
  return NextResponse.json({ ok: result.status === 200 }, { status: result.status });
}
