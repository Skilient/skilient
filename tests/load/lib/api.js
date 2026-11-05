import http from "k6/http";
import encoding from "k6/encoding";
import { check, fail } from "k6";
import { Trend } from "k6/metrics";

export const SUPABASE_URL = __ENV.SUPABASE_URL;
export const PUBLISHABLE_KEY = __ENV.SUPABASE_PUBLISHABLE_KEY;
export const APP_URL = (__ENV.APP_URL || "http://127.0.0.1:3100").replace(/\/$/, "");
export const PASSWORD = __ENV.LOAD_PASSWORD;
// lib/supabase/cookie-options.ts: production builds use the __Secure- name.
const COOKIE = __ENV.LOAD_COOKIE || "__Secure-skl-auth";
// @supabase/ssr splits cookie values longer than this into name.0, name.1, …
const CHUNK = 3180;

export const pageTtfb = new Trend("page_ttfb", true);

/** Signs in with the password grant (the same Auth call the sign-in form makes). Returns the session. */
export function signIn(email) {
  const res = http.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, JSON.stringify({ email, password: PASSWORD }), {
    headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
    tags: { name: "auth.sign_in", kind: "auth" },
  });
  if (!check(res, { "signed in": (r) => r.status === 200 })) fail(`sign-in failed for ${email}: ${res.status} ${res.body}`);
  const session = res.json();
  const value = `base64-${encoding.b64encode(JSON.stringify(session), "rawurl")}`;
  const parts = [];
  if (value.length <= CHUNK) parts.push(`${COOKIE}=${value}`);
  else for (let i = 0; i * CHUNK < value.length; i++) parts.push(`${COOKIE}.${i}=${value.slice(i * CHUNK, (i + 1) * CHUNK)}`);
  return { token: session.access_token, userId: session.user.id, email, cookie: parts.join("; ") };
}

const json = (token) => ({ apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

/** One PostgREST RPC as the user. Fails the check (and the error budget) on anything but 2xx. */
export function rpc(who, fn, args = {}) {
  const res = http.post(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, JSON.stringify(args), { headers: json(who.token), tags: { name: `rpc.${fn}`, kind: "rpc" } });
  check(res, { [`${fn} ok`]: (r) => r.status >= 200 && r.status < 300 });
  return res;
}

/** The same RPC without blocking the event loop (used while a Realtime socket is open). */
export function rpcAsync(who, fn, args = {}) {
  return http.asyncRequest("POST", `${SUPABASE_URL}/rest/v1/rpc/${fn}`, JSON.stringify(args), { headers: json(who.token), tags: { name: `rpc.${fn}`, kind: "rpc" } });
}

export function select(who, path, name) {
  const res = http.get(`${SUPABASE_URL}/rest/v1/${path}`, { headers: json(who.token), tags: { name, kind: "rest" } });
  check(res, { [`${name} ok`]: (r) => r.status === 200 });
  return res;
}

/** A signed-in page, as a browser's first request for it. Records TTFB; fails on a redirect away or an error. */
export function page(who, path, name, extra) {
  const res = http.get(`${APP_URL}${path}`, {
    headers: { Cookie: who.cookie, Accept: "text/html", "Accept-Encoding": "gzip, br" },
    redirects: 0,
    tags: { name: `page.${name}`, kind: "page" },
  });
  pageTtfb.add(res.timings.waiting, { page: name });
  check(res, { [`${name} page 200`]: (r) => r.status === 200 });
  if (extra) extra.add(res.timings.duration, { page: name });
  return res;
}

export function appPost(who, path, body, name) {
  const res = http.post(`${APP_URL}${path}`, JSON.stringify(body), {
    headers: { Cookie: who.cookie, "Content-Type": "application/json", Origin: APP_URL },
    redirects: 0,
    timeout: "60s",
    tags: { name, kind: "route" },
  });
  check(res, { [`${name} ok`]: (r) => r.status === 200 });
  return res;
}
