import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { logger, requestIdFrom } from "@/lib/log";
import { newRequestId } from "@/lib/request-id";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const Body = z.object({
  route: z.string().regex(/^\/[A-Za-z0-9/:_.-]{0,120}$/),
  metrics: z
    .object({ LCP: z.number().min(0).max(600000), INP: z.number().min(0).max(600000), CLS: z.number().min(0).max(100) })
    .partial()
    .strict()
    .refine((m) => Object.keys(m).length > 0),
});

/** Sampled real-user web vitals (components/analytics/web-vitals.tsx) for the performance alert. */
export async function POST(request: NextRequest) {
  const requestId = requestIdFrom(request.headers) ?? newRequestId();
  const raw = await request.text();
  if (raw.length > 2048) return new NextResponse(null, { status: 413 });
  let parsed;
  try {
    parsed = Body.safeParse(JSON.parse(raw));
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_web_vitals", { p_route: parsed.data.route, p_metrics: parsed.data.metrics });
  if (error) {
    logger.warn("vitals.record", { request_id: requestId, action: "POST /api/vitals", outcome: "error", error_code: error.code });
    return new NextResponse(null, { status: 400 });
  }
  return new NextResponse(null, { status: 204 });
}
