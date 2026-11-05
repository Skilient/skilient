import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { readPublicEnv } from "@/lib/env";
import { authCookieOptions } from "./cookie-options";

export interface ProxySession {
  response: NextResponse;
  supabase: SupabaseClient<Database> | null;
  /** Verified JWT claims (signature checked), or null when signed out. */
  claims: { sub: string; aal?: string } | null;
}

/**
 * Refreshes the auth session cookies proactively (PRD 10: proxy.ts uses getClaims()).
 * Returns the response carrying any refreshed cookies, plus the client and claims so the
 * caller can make route decisions with getUser().
 */
export async function refreshSession(request: NextRequest, makeResponse: () => NextResponse): Promise<ProxySession> {
  let response = makeResponse();
  const env = readPublicEnv();
  if (!env) return { response, supabase: null, claims: null };

  const supabase = createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: authCookieOptions(),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = makeResponse();
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Don't put code between client creation and getClaims(): it can cause random sign-outs.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims ? { sub: data.claims.sub, aal: data.claims.aal as string | undefined } : null;
  return { get response() { return response; }, supabase, claims };
}

/** A redirect that keeps the refreshed auth cookies (and headers) from `from`. */
export function redirectWithCookies(request: NextRequest, from: NextResponse, to: string): NextResponse {
  const res = NextResponse.redirect(new URL(to, request.url), 303);
  for (const cookie of from.cookies.getAll()) res.cookies.set(cookie);
  for (const key of ["cache-control", "expires", "pragma", "x-request-id", "content-security-policy"]) {
    const value = from.headers.get(key);
    if (value) res.headers.set(key, value);
  }
  return res;
}

/**
 * Renders a path that has no page (an underscore folder is never a route), so the visitor gets the
 * app's not-found page with a 404 while the URL stays as typed. Used for closed portals (phase 14).
 */
export function rewriteWithCookies(request: NextRequest, from: NextResponse, to: string, requestHeaders: Headers): NextResponse {
  const res = NextResponse.rewrite(new URL(to, request.url), { request: { headers: requestHeaders }, status: 404 });
  for (const cookie of from.cookies.getAll()) res.cookies.set(cookie);
  for (const key of ["cache-control", "expires", "pragma", "x-request-id", "content-security-policy", "reporting-endpoints"]) {
    const value = from.headers.get(key);
    if (value) res.headers.set(key, value);
  }
  return res;
}

/**
 * True when a failed Auth or database call says nothing about the session: the network, a timeout, a
 * full connection pool or a 5xx. The proxy then answers 503 and keeps the session, instead of reading
 * the failure as "no profile" and signing the student out (found by the phase 13 load test).
 */
export function isTransientError(error: { status?: number; name?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.name === "AuthRetryableFetchError") return true;
  const status = error.status;
  // Postgres: statement timeout (57014), too many connections (53300), cannot connect now (57P03); PostgREST: no database or pool timeout (PGRST000-003).
  if (error.code && ["57014", "53300", "57P03", "PGRST000", "PGRST001", "PGRST002", "PGRST003"].includes(error.code)) return true;
  return status === undefined || status === 0 || status >= 500;
}

/** A 503 that keeps the refreshed auth cookies: the page is busy, the session is untouched. */
export function busyWithCookies(from: NextResponse): NextResponse {
  const body =
    '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    "<title>Skilient is busy</title><h1>Skilient is busy</h1><p>We could not load this page just now. You are still signed in.</p>" +
    '<p><a href="">Try again</a></p></html>';
  const res = new NextResponse(body, { status: 503, headers: { "content-type": "text/html; charset=utf-8", "retry-after": "5", "cache-control": "no-store" } });
  for (const cookie of from.cookies.getAll()) res.cookies.set(cookie);
  for (const key of ["x-request-id", "content-security-policy", "reporting-endpoints"]) {
    const value = from.headers.get(key);
    if (value) res.headers.set(key, value);
  }
  return res;
}

export function hasVerifiedFactor(user: User | null): boolean {
  return !!user?.factors?.some((f) => f.status === "verified");
}
