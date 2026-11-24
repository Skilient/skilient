/**
 * Session cookie for every Supabase client (browser, server, proxy): Secure with the `__Secure-` prefix in
 * production builds (ASVS V3.3.1, PRD 10), so a browser never sends or accepts it over plain HTTP. Local
 * development keeps a plain name. All three clients must agree, or they read different cookies. SameSite=Lax
 * and the path come from @supabase/ssr's defaults; the browser client reads the session for Realtime, so the
 * cookie can't be HttpOnly (docs/security/asvs-l1.md V3.3.1).
 */
export function authCookieOptions(production = process.env.NODE_ENV === "production") {
  return production ? { name: "__Secure-skl-auth", secure: true } : { name: "skl-auth", secure: false };
}
