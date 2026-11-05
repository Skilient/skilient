import { NextResponse, type NextRequest } from "next/server";
import { decideRoute, isPortalPath, isPublicPath, type GateState, type Portals } from "@/lib/auth/gate";
import { CSP_REPORT_PATH } from "@/lib/security/csp-report";
import { buildCsp, newNonce, NONCE_HEADER, reportingEndpoints } from "@/lib/security/headers";
import { busyWithCookies, hasVerifiedFactor, isTransientError, redirectWithCookies, refreshSession, rewriteWithCookies } from "@/lib/supabase/proxy";
import { log } from "@/lib/log";
import { newRequestId, REQUEST_ID_HEADER } from "@/lib/request-id";

export async function proxy(request: NextRequest) {
  // next.config.ts sets skipTrailingSlashRedirect for PostHog's /ingest paths; every other path keeps
  // Next's usual behaviour: "/feed/" redirects to "/feed".
  const { pathname: rawPath } = request.nextUrl;
  if (rawPath.length > 1 && rawPath.endsWith("/")) {
    const url = request.nextUrl.clone();
    url.pathname = rawPath.replace(/\/+$/, "") || "/";
    return NextResponse.redirect(url, 308);
  }

  // Always mint our own id and nonce; never trust ones from the client.
  const requestId = newRequestId();
  const nonce = newNonce();
  const csp = buildCsp({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    dev: process.env.NODE_ENV === "development",
    reportPath: CSP_REPORT_PATH,
  });

  // Rebuilt on every call so refreshed auth cookies (set on request.cookies) reach the render.
  const requestHeaders = () => {
    const headers = new Headers(request.headers);
    headers.set(REQUEST_ID_HEADER, requestId);
    headers.set(NONCE_HEADER, nonce);
    // Next.js reads the nonce for its own scripts from the request's CSP header.
    headers.set("content-security-policy", csp);
    return headers;
  };
  const makeResponse = () => {
    const res = NextResponse.next({ request: { headers: requestHeaders() } });
    res.headers.set(REQUEST_ID_HEADER, requestId);
    res.headers.set("content-security-policy", csp);
    res.headers.set("reporting-endpoints", reportingEndpoints(CSP_REPORT_PATH));
    return res;
  };

  const session = await refreshSession(request, makeResponse);
  const busy = (step: string, error: { code?: string; status?: number }) => {
    log("warn", "proxy.gate_unavailable", { request_id: requestId, action: step, outcome: "error", error_code: error.code ?? String(error.status ?? "") });
    return busyWithCookies(session.response);
  };
  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname) || !session.supabase) return session.response;

  // Route decisions use getUser() (verified with the Auth server), never the cookie alone.
  let user = null;
  let state: GateState | null = null;
  if (session.claims) {
    const { data, error } = await session.supabase.auth.getUser();
    user = data.user;
    // A failed check is not a signed-out or profile-less account: answer 503 and keep the session.
    if (!user && error && isTransientError(error)) return busy("auth.get_user", error);
    if (user) {
      const { data: gate, error: gateError } = await session.supabase.rpc("my_gate_state");
      if (gateError) return busy("rpc.my_gate_state", gateError);
      state = (gate as GateState | null) ?? null;
    }
  }

  // A signed-out visitor on a portal path: the gate still needs to know whether the portal is open.
  let portals: Portals | null = null;
  if (!state && isPortalPath(pathname)) {
    const { data } = await session.supabase.rpc("portals_state");
    portals = (data as Portals | null) ?? null;
  }

  const decision = decideRoute({
    pathname,
    path: `${pathname}${search}`,
    signedIn: !!user,
    aal: session.claims?.aal ?? null,
    hasVerifiedFactor: hasVerifiedFactor(user),
    state,
    portals,
  });

  if (decision.type === "next") return session.response;
  if (decision.type === "not-found") return rewriteWithCookies(request, session.response, "/_closed", requestHeaders());
  if (decision.type === "sign-out") await session.supabase.auth.signOut({ scope: "local" });
  return redirectWithCookies(request, session.response, decision.to);
}

export const config = {
  matcher: [
    // Everything except static assets, image optimisation, the PostHog proxy (/ingest) and the PWA files (sw.js, offline.html).
    "/((?!_next/static|_next/image|ingest/|brand/|icon.svg|manifest.webmanifest|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
