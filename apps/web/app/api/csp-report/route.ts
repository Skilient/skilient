import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { logger, requestIdFrom } from "@/lib/log";
import { newRequestId } from "@/lib/request-id";
import { createLimiter, CSP_REPORT_MAX_BYTES, parseCspReports } from "@/lib/security/csp-report";
import { keyedHash } from "@/lib/security/hash";
import { clientIp } from "@/lib/security/request-meta";

export const dynamic = "force-dynamic";

// 30 reports a minute per browser address per server instance; Sentry gets a tenth of what is logged.
const allow = createLimiter(30, 60_000);
const SENTRY_SAMPLE = 0.1;

/** CSP violation reports from browsers (report-uri and report-to). Always 204, so nothing is learned by probing. */
export async function POST(request: NextRequest) {
  const requestId = requestIdFrom(request.headers) ?? newRequestId();
  const done = new NextResponse(null, { status: 204 });
  const raw = await request.text();
  if (raw.length > CSP_REPORT_MAX_BYTES) return done;
  if (!allow(keyedHash(`csp:${clientIp(request.headers) ?? "unknown"}`))) return done;
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return done;
  }
  for (const v of parseCspReports(body)) {
    logger.warn("csp.violation", { request_id: requestId, action: "POST /api/csp-report", outcome: "refused", ...v });
    if (Math.random() < SENTRY_SAMPLE) {
      Sentry.captureMessage(`CSP violation: ${v.directive} ${v.blocked}`, {
        level: "warning",
        tags: { csp_directive: v.directive, csp_blocked: v.blocked, csp_page: v.page },
        fingerprint: ["csp", v.directive, v.blocked],
      });
    }
  }
  return done;
}
