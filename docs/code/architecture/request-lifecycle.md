Commit: 4024fe9
Covers: `proxy.ts`, `lib/auth/gate.ts`, `lib/supabase/proxy.ts`, `lib/actions/`, `lib/data/posts.ts`, `lib/api/v1.ts`, `app/(app)/feed/page.tsx`, `lib/actions/friends.ts`, `app/api/v1/candidates/[id]/route.ts`, `lib/security/`, `lib/log.ts`

# Request lifecycle

Three traces: a signed-in page request, a server action, and a bearer-token `/api/v1` call. All three start the same way, at `proxy.ts`.

## Common: `proxy.ts`

`proxy()` runs for every request its `config.matcher` admits (everything except static assets, image optimisation, and `/ingest`) [src: proxy.ts#config]:

1. Strips a trailing slash with a 308 redirect before anything else [src: proxy.ts#rawPath].
2. Mints a request id (`crypto.randomUUID()`) and a 128-bit CSP nonce; both are generated here and never read from the client [src: proxy.ts#newRequestId] [src: proxy.ts#newNonce].
3. Builds the per-request CSP with `buildCsp()` — `script-src` is the origin plus the nonce and `'strict-dynamic'`, Turnstile's frame is separately allowed, Supabase's REST/websocket origin and the Sentry DSN's origin are added to `connect-src`, and the reporting group `csp` points at `CSP_REPORT_PATH` [src: lib/security/headers.ts#buildCsp].
4. `makeResponse()` puts the request id and nonce on both the request headers (so the render can read them) and the response headers (`x-request-id`, `content-security-policy`, `reporting-endpoints`) [src: proxy.ts#makeResponse].
5. `refreshSession()` creates a request-scoped `@supabase/ssr` client, calls `getClaims()` (which verifies the JWT signature) and rebuilds `makeResponse()` whenever Supabase sets refreshed cookies, so the redirect or the render that follows always carries the newest cookies [src: lib/supabase/proxy.ts#refreshSession].
6. If the path `isPublicPath()` or there is no Supabase session, `proxy()` returns the response as-is [src: proxy.ts#isPublicPath] — this is the path taken by every marketing, `/auth`, `/ui`, `/verify` and `/cv` request, and it's also where an unauthenticated request to `/api/v1` and most of `app/api/*` ends up (no gate, no redirect).
7. Otherwise it calls `session.supabase.auth.getUser()` (never `getSession()` — PRD 10/CLAUDE.md) and, only if a user came back, `rpc("my_gate_state")` [src: proxy.ts#getUser].
8. `decideRoute()` turns `{ pathname, signedIn, aal, hasVerifiedFactor, state }` into one of `next` / `redirect` / `sign-out` [src: lib/auth/gate.ts#decideRoute]. A `sign-out` decision (domain no longer allowed, or no profile) calls `auth.signOut({ scope: "local" })` before redirecting to `/signin?error=domain` [src: proxy.ts#decision].
9. A `redirect` decision goes through `redirectWithCookies()`, which 303-redirects while copying over every cookie and the cache-control/request-id/CSP headers `refreshSession()` had already set [src: lib/supabase/proxy.ts#redirectWithCookies].

## Trace 1: a page request — `GET /feed`

1. `proxy.ts` gates the request as above. `/feed` is not in `isPublicPath`, so a session is required; `decideRoute` falls through its checks (profile exists, agreement accepted, onboarding complete, not a recruiter/university-admin-only area) to `next` [src: lib/auth/gate.ts#decideRoute].
2. The render reaches `app/(app)/layout.tsx`, which calls `getCurrentUser()` — itself `supabase.auth.getUser()` plus one `profiles` select — and seeds `CurrentUserProvider`; it also schedules `rpc("touch_activity")` with `after()` so the write doesn't block the response [src: app/(app)/layout.tsx#AppLayout].
3. `FeedPage` calls `getCurrentUser()` again (deduplicated within the request by React's `cache()` [src: lib/auth/current-user.ts#getCurrentUser]) and redirects to `/signin` itself if somehow unauthenticated, then reads `searchParams` for `tab`/`filter` [src: app/(app)/feed/page.tsx#FeedPage].
4. It calls `getFeed(tab, filter)`, which opens a fresh `createClient()` and calls `supabase.rpc("feed_page", { p_audience, p_filter, p_cursor, p_limit })`, then `getPostCards(ids)` for the card data for just those post ids [src: lib/data/posts.ts#getFeed].
5. In Postgres, `public.feed_page` (security invoker) forwards to `private.feed_page` (security definer), which derives the caller from `auth.uid()` itself, raising `42501` if nobody is signed in, and ranks and pages the feed inside the function — the application code never builds the query [src: supabase/migrations/20260929040000_feed_ranking.sql#private.feed_page] [src: supabase/migrations/20260929040000_feed_ranking.sql#public.feed_page].
6. On a SQL error, `getFeed` throws a plain `Error` (`feed_page failed: <code>`) [src: lib/data/posts.ts#getFeed] — this is **not** the typed `ActionResult` path; it's caught by the nearest route-level error boundary, `app/(app)/error.tsx` → `RouteError` → `Sentry.captureException(error)`, showing the ref from `error.digest` so a report maps to the server log line [src: components/app/route-error.tsx#RouteError].
7. The page renders with the data layer's already-shaped `PostCardData[]`; no further request id or log line is attached to this read (reads are not actions — only server actions and `/api/v1` calls call `done()`/`apiCall`'s logger).

## Trace 2: a server action — `sendFriendRequest`

1. `components/friends/add-friend-button.tsx` calls `sendFriendRequest(username)` inside a `useTransition`, from the client [src: components/friends/add-friend-button.tsx#AddFriendButton].
2. `actionContext("friends.send")` reads the request's `headers()` (carrying `x-request-id` set by `proxy.ts`, so a browser POST to a server action keeps the same id as the page load that rendered the form) [src: lib/actions/context.ts#actionContext], hashes the IP with `hashIp()`/`keyedHash()` (HMAC with `IP_HASH_SECRET`, or a logged-once SHA-256 fallback) [src: lib/security/hash.ts#keyedHash], and returns a `done(outcome, fields)` closure that writes one JSON line via `logger` with `duration_ms` computed from `performance.now()` [src: lib/actions/context.ts#actionContext].
3. The username is validated with a Zod regex before any session or database work; a failure calls `ctx.done("refused", { error_code: "invalid_input" })` and returns a `fail()` with per-field messages, never touching the database [src: lib/actions/friends.ts#invalid].
4. `signedIn(ctx)` opens `createClient()` and calls `getUser()`; no session logs `ctx.done("refused", { error_code: "no_session" })` and returns `null`, and the action returns the constant `NO_SESSION` error [src: lib/actions/rpc.ts#signedIn].
5. `call(ctx, supabase, userId, "send_friend_request", { p_username })` invokes `supabase.rpc(fn, args)` [src: lib/actions/rpc.ts#call].
6. In Postgres, `public.send_friend_request` (security invoker) forwards to `private.send_friend_request` (security definer), which re-derives the caller from `auth.uid()`, resolves the username, and raises a SQLSTATE for every refusal case: `42501` not signed in, `P0002` no such user or blocked, `22023` self-request, `23505` already friends [src: supabase/migrations/20260928230000_friends_blocks.sql#private.send_friend_request].
7. Back in `call()`, a returned `error.code` is looked up in `REFUSALS` [src: lib/actions/rpc.ts#REFUSALS]; a known code logs `outcome: "refused"` and returns a `fail()` whose message is `sentence(error.message)` — the SQL exception's own text, capitalised and punctuated [src: lib/actions/rpc.ts#sentence]. An unmapped code logs `outcome: "error"` and returns the generic `"unavailable"` error carrying `ctx.requestId` as `requestId`, which the UI shows as a "Ref" so the user's report matches the log line [src: lib/actions/rpc.ts#call] [src: lib/actions/result.ts#ActionError].
8. On success, `call()` logs `outcome: "ok"`, runs `revalidatePath("/friends")`, and returns `ok(data)` [src: lib/actions/rpc.ts#call]; `sendFriendRequest` then reshapes the first row into `{ status }` [src: lib/actions/friends.ts#sendFriendRequest].
9. The client branches on `result.ok`: success moves the button to its settled state, failure renders `result.message` inline [src: components/friends/add-friend-button.tsx#AddFriendButton] — there is no thrown exception on the happy or the refused path, only on a bug in the action itself (which Next's own error boundary would catch, same as trace 1).

## Trace 3: `/api/v1` — `GET /api/v1/candidates/{id}`

1. `/api/v1` is under `isPublicPath`'s `/api` prefix [src: lib/auth/gate.ts#isPublicPath], so `proxy.ts` never gates it on cookies or redirects it — authentication is the bearer token, checked entirely inside Postgres.
2. The route handler is a two-line wrapper: `apiCall(request, "GET /api/v1/candidates/[id]", "api_candidate", (token) => ({ p_token: token, p_candidate: id }), { id })` [src: app/api/v1/candidates/[id]/route.ts#GET].
3. `apiCall()` reads (or mints) the request id, then validates every id in `ids` as a UUID before anything else — an invalid id answers `404 { error: "not_found" }` without ever reading the `Authorization` header, so malformed ids and unknown ids are indistinguishable to the caller [src: lib/api/v1.ts#apiCall].
4. `bearer(request)` extracts the token with a strict regex (`^Bearer\s+(\S{20,200})$`); missing or malformed is `401` with a `WWW-Authenticate: Bearer` header [src: lib/api/v1.ts#bearer].
5. The call goes out as `createPublicClient().rpc("api_candidate", { p_token, p_candidate })` — an `anon`-role client, so the token itself (hashed inside the SQL function, never compared in application code) is what proves the caller's organisation and plan [src: lib/api/v1.ts#apiCall].
6. `STATUS_BY_CODE` maps SQL error codes to HTTP status: `28000` → 401 invalid token, `42501` → 403 not allowed, `54000` → 429 rate limited (with `Retry-After: 60`), `P0002`/`22P02` → 404 not found [src: lib/api/v1.ts#STATUS_BY_CODE]. An unmapped code is logged as `outcome: "error"` and answered `503 { error: "unavailable", request_id }` [src: lib/api/v1.ts#apiCall].
7. Every branch logs through the same `done()` closure and returns `Cache-Control: no-store` plus `X-Request-Id` on every response, success or refusal [src: lib/api/v1.ts#apiCall].
8. On success, the SQL function's jsonb document is returned as-is via `Response.json(data, { headers })` — the route handler never reshapes it.

## What all three traces share

- The request id originates once per HTTP request in `proxy.ts` [src: proxy.ts#newRequestId] (or, for a request `proxy.ts` never saw reason to touch, is minted fresh by `requestIdFrom(headers) ?? newRequestId()` in `actionContext`/`apiCall`) and is threaded through every log line and surfaced to the user only as an opaque "Ref" on a generic failure.
- Logging is always one JSON line per action/call via `lib/log.ts#log`, never a stack trace or request body [src: lib/log.ts#log].
- The CSP nonce only matters to page renders (trace 1); server actions and `/api/v1` responses carry no nonce because they return data, not `<script>` tags.
- Every refusal surfaces a stable machine `code` (SQLSTATE-derived for actions and `/api/v1`, gate-decision-derived for `proxy.ts`), never a raw database error message beyond `sentence(error.message)`'s cosmetic reformatting.
