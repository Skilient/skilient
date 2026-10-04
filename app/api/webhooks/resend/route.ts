import { NextResponse, type NextRequest } from "next/server";
import { logger, requestIdFrom } from "@/lib/log";
import { handleResendWebhook } from "@/lib/monitoring/resend-webhook";
import { newRequestId } from "@/lib/request-id";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * Resend's delivery webhook (email.delivered, email.bounced), counted for the bounce-rate alert
 * (docs/alerts.md). Acts for no user, so it records with the service role; only the signal kind is stored.
 */
export async function POST(request: NextRequest) {
  const started = performance.now();
  const requestId = requestIdFrom(request.headers) ?? newRequestId();
  const rawBody = await request.text();
  if (rawBody.length > 64 * 1024) return NextResponse.json({ ok: false }, { status: 413 });
  const result = await handleResendWebhook({
    rawBody,
    headers: request.headers,
    secret: process.env.RESEND_WEBHOOK_SECRET,
    record: async (signal) => {
      const { error } = await createServiceClient().rpc("record_service_signal", { p_kind: signal });
      if (error) throw new Error(error.message);
    },
  }).catch(() => ({ status: 500, outcome: "error" as const }));
  logger[result.outcome === "refused" ? "warn" : result.outcome === "error" ? "error" : "info"]("resend.webhook", {
    request_id: requestId,
    action: "POST /api/webhooks/resend",
    duration_ms: Math.round(performance.now() - started),
    outcome: result.outcome === "ignored" ? "ok" : result.outcome,
    status: result.status,
  });
  return NextResponse.json({ ok: result.status === 200 }, { status: result.status });
}
