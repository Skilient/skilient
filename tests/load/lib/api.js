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

/** One RPC as an http.batch entry. */
export function rpcRequest(who, fn, args = {}) {
  return ["POST", `${SUPABASE_URL}/rest/v1/rpc/${fn}`, JSON.stringify(args), { headers: json(who.token), tags: { name: `rpc.${fn}`, kind: "rpc" } }];
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

/**
 * A signed-in page's database work, without Vercel in between (decisions 2026-11-05: on Vercel Hobby the
 * platform's DDoS mitigation challenges every non-browser request from one address, and only Pro can bypass
 * it). It replays what the server does for that page, measured on the local stack: the proxy's getUser() and
 * my_gate_state(), then the layout's getUser(), my_restriction(), tour_state(), touch_activity() and profile,
 * with the page's own reads, in parallel as the render runs them. `calls` is a list of [rpc, args] or
 * ["rest", path]. Real pages through Vercel are measured by the vitals scenario's browsers.
 */
export const pageData = new Trend("page_data", true);
export function page(who, name, calls, extra) {
  const auth = { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${who.token}` };
  const start = Date.now();
  const proxyUser = http.get(`${SUPABASE_URL}/auth/v1/user`, { headers: auth, tags: { name: "auth.get_user", kind: "auth" } });
  const gate = http.post(`${SUPABASE_URL}/rest/v1/rpc/my_gate_state`, "{}", { headers: json(who.token), tags: { name: "rpc.my_gate_state", kind: "page" } });
  const all = [
    ["user"],
    ["rpc", "my_restriction", {}],
    ["rpc", "tour_state", { p_tour: "student" }],
    ["rpc", "touch_activity", {}],
    ["rest", `profiles?user_id=eq.${who.userId}&select=full_name,username`],
    ...calls.map((c) => (c[0] === "rest" ? c : ["rpc", c[0], c[1] || {}])),
  ];
  const responses = http.batch(
    all.map(([kind, what, args]) =>
      kind === "user"
        ? ["GET", `${SUPABASE_URL}/auth/v1/user`, null, { headers: auth, tags: { name: "auth.get_user", kind: "auth" } }]
        : kind === "rest"
          ? ["GET", `${SUPABASE_URL}/rest/v1/${what}`, null, { headers: json(who.token), tags: { name: `page.${name}.rest`, kind: "page" } }]
          : ["POST", `${SUPABASE_URL}/rest/v1/rpc/${what}`, JSON.stringify(args), { headers: json(who.token), tags: { name: `rpc.${what}`, kind: "page" } }],
    ),
  );
  const ms = Date.now() - start;
  pageData.add(ms, { page: name });
  if (extra) extra.add(ms, { page: name });
  const failed = [proxyUser, gate, ...responses]
    .map((r, i) => [r, i < 2 ? ["auth.get_user", "my_gate_state"][i] : all[i - 2][1] || "auth.get_user"])
    .filter(([r]) => r.status < 200 || r.status >= 300);
  if (!check(failed, { [`${name} page data`]: (f) => f.length === 0 })) {
    console.warn(`page ${name}: ${failed.map(([r, what]) => `${what} ${r.status}`).join(", ")}`);
  }
  return responses.slice(5);
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
