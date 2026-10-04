import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { originFrom } from "@/lib/actions/context";
import { recordSignIn } from "@/lib/auth/sign-in-record";
import { logger, requestIdFrom } from "@/lib/log";
import { newRequestId } from "@/lib/request-id";
import { hashIp } from "@/lib/security/hash";
import { clientIp, userAgent } from "@/lib/security/request-meta";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Where each email link lands after verification (and on failure). */
const ROUTES: Partial<Record<EmailOtpType, { ok: string; failed: string }>> = {
  email: { ok: "/auth/confirmed", failed: "/auth/confirmed?error=expired" },
  signup: { ok: "/auth/confirmed", failed: "/auth/confirmed?error=expired" },
  magiclink: { ok: "/feed", failed: "/signin?error=link_expired" },
  recovery: { ok: "/reset-password", failed: "/forgot-password?error=expired" },
  email_change: { ok: "/feed", failed: "/signin?error=link_expired" },
};

const TOKEN_HASH = /^[A-Za-z0-9_-]{8,200}$/;

/**
 * Email links (confirmation, sign-in code, password reset, email change) carry a token_hash, so they
 * work in any browser or device, not just the one that started the flow (PKCE).
 *
 * Opening the link (GET) spends nothing: it shows /auth/link, whose Continue button POSTs back here.
 * Mail scanners (Microsoft 365 Safe Links, university gateways, Gmail) open every link in a message
 * before the person does; when GET verified the token, the scanner used it up and the real click
 * read "already used" (decisions 2026-10-04).
 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const origin = originFrom(request.headers);
  if (!tokenHash || !type || !ROUTES[type] || !TOKEN_HASH.test(tokenHash)) {
    return NextResponse.redirect(new URL("/signin?error=link_expired", origin), 303);
  }
  const to = new URL("/auth/link", origin);
  to.searchParams.set("token_hash", tokenHash);
  to.searchParams.set("type", type);
  return NextResponse.redirect(to, 303);
}

/** The Continue button on /auth/link: verify the token, then go where the link leads. */
export async function POST(request: NextRequest) {
  const started = performance.now();
  const requestId = requestIdFrom(request.headers) ?? newRequestId();
  const origin = originFrom(request.headers);
  const form = await request.formData().catch(() => null);
  const tokenHash = typeof form?.get("token_hash") === "string" ? (form.get("token_hash") as string) : null;
  const type = (typeof form?.get("type") === "string" ? form.get("type") : null) as EmailOtpType | null;
  const route = type ? ROUTES[type] : undefined;

  const finish = (outcome: "ok" | "refused", to: string, errorCode?: string, userId?: string) => {
    logger[outcome === "ok" ? "info" : "warn"]("auth.confirm", {
      request_id: requestId,
      action: "POST /auth/confirm",
      duration_ms: Math.round(performance.now() - started),
      outcome,
      error_code: errorCode,
      user_id: userId,
      link_type: type ?? undefined,
    });
    return NextResponse.redirect(new URL(to, origin), 303);
  };

  // Only our own page may submit a token (no signing someone into another account from elsewhere).
  if (!sameOrigin(request.headers, origin)) return finish("refused", "/signin?error=link_expired", "cross_origin");
  if (!tokenHash || !type || !route || !TOKEN_HASH.test(tokenHash)) {
    return finish("refused", "/signin?error=link_expired", "bad_link");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.user) return finish("refused", route.failed, error?.code ?? "verify_failed");

  if (type === "email" || type === "signup" || type === "magiclink" || type === "recovery") {
    await recordSignIn(
      supabase,
      { requestId, ipHash: hashIp(clientIp(request.headers)), userAgent: userAgent(request.headers), origin, headers: request.headers },
      type === "recovery" ? "recovery" : "magic_link",
      data.user.email,
    );
  }
  return finish("ok", route.ok, undefined, data.user.id);
}

function sameOrigin(headers: Headers, origin: string): boolean {
  const sent = headers.get("origin");
  if (sent) return sent === origin;
  return headers.get("sec-fetch-site") === "same-origin";
}
