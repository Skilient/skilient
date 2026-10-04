# OWASP ASVS 5.0 Level 1 checklist

PRD 10 "Testing before launch"; phase 13 slice 3 (question 14: filed here, not in a wiki). Checked against
**ASVS 5.0.0** (May 2025), all 70 Level 1 requirements, on 2026-10-04 at the slice 3 commit. Requirement text is
OWASP's, shortened; the IDs match the standard.

**Status:** Pass · **Fixed** (failed, fixed in slice 3) · **N/A** (the feature doesn't exist here) · **Accepted** (a
known deviation with a reason). Re-check this list when a chapter's code changes; a pull request that changes a
control updates its row.

Supporting evidence used throughout: RLS on every table with a refusal test (`supabase/tests/00_rls_everywhere`),
`supabase db advisors --fail-on warn` in CI, the CSP sweep (`tests/e2e/csp-sweep.spec.ts`), the ZAP baseline
(`docs/security/zap.md`), gitleaks and `pnpm audit` in CI.

## V1 Encoding and sanitization

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 1.2.1 | Context-aware output encoding | Pass | React escapes all text; lint bans `dangerouslySetInnerHTML`, `innerHTML`, `insertAdjacentHTML` (`eslint.config.mjs` `rawHtmlSelectors`). The CV PDF HTML is built with an escaping helper (`lib/cv/document.ts`, unit-tested against the React markup). |
| 1.2.2 | URLs encoded; only safe protocols | Pass | Every stored URL column is limited to `https://` (or `http(s)://` for contribution evidence) by a CHECK constraint; post and chat links are extracted by trigger with an `https?://` pattern; Ecosphere link blocks are checked in SQL. Rendered links carry `rel="noopener nofollow ugc"`. Path segments use `encodeURIComponent`. |
| 1.2.3 | Encoding when building JavaScript/JSON | Pass | JSON is built with `JSON.stringify`/`jsonb_build_object`; the JSON-LD block on marketing pages is built from our own constants (no user data) and carries the CSP nonce. |
| 1.2.4 | Parameterised queries | Pass | Data access is supabase-js (PostgREST, parameterised) and SQL functions; dynamic SQL uses `format('%I'/'%L')` or `execute … using`. Workers use postgres.js tagged parameters. |
| 1.2.5 | OS command injection | Pass | No shell calls. Chromium for CV PDFs is launched with fixed arguments (`lib/cv/browser.ts`). |
| 1.3.1 | Sanitise WYSIWYG HTML | N/A | No rich-text or HTML input anywhere; all user content is plain text. |
| 1.3.2 | No `eval` | Pass | None in our code; the production CSP has no `'unsafe-eval'` (only `pnpm dev` adds it), so the browser refuses it. |
| 1.5.1 | Safe XML parsers | N/A | No XML is parsed (link previews read `<meta>` tags with patterns over the first 200 KB of a page, `_shared/links/meta.ts`). |

## V2 Validation and business logic

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 2.1.1 | Validation rules documented | Pass | Each feature section of the PRD states its limits; the rules live as Zod schemas in `lib/actions/*` and CHECK constraints in `supabase/migrations/*`, the database being the source of truth. |
| 2.2.1 | Positive validation of business input | Pass | Zod on every server action (CLAUDE.md rule); allow-listed enums, lengths and ranges in SQL; recruiter filters allow-listed (`talent_filters`). |
| 2.2.2 | Validation at a trusted layer | Pass | Server actions and SQL functions validate; client checks are convenience only. Prices, entitlements and user ids are never taken from the client (`create_checkout` prices in SQL; `auth.uid()` everywhere). |
| 2.3.1 | Business flows in order | Pass | Signup → agreement → onboarding is enforced by `lib/auth/gate.ts` (unit-tested decision table) in `proxy.ts`; checkout and billing are SQL state machines (`checkout_sessions`, `billing_apply_event`); applications, reviews and appeals move through checked states (pgTAP `14`, `40`, `44`, `46`). |

## V3 Web frontend security

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 3.2.1 | Content rendered in the right context | Pass | User files are served from Supabase Storage on its own origin, never ours; private buckets only through 5-minute signed URLs; uploads are re-encoded and type-checked from bytes. API routes answer JSON with `nosniff`. |
| 3.2.2 | Text rendered as text | Pass | React text nodes only (see 1.2.1). |
| 3.3.1 | Cookies Secure with a `__Secure-`/`__Host-` prefix | **Fixed** | The Supabase session cookie had neither: now `__Secure-skl-auth`, Secure, SameSite=Lax in production (`lib/supabase/cookie-options.ts`); the app's own cookies (`sk_verify`, `sk_signin_code`, `sk_agree`, `sk_did`, `sk_gh`) now carry `__Secure-` (`lib/security/cookie-name.ts`). E2E `auth.spec.ts` checks the session cookie. The session cookie isn't HttpOnly: the browser client reads it for Realtime, the @supabase/ssr design. |
| 3.4.1 | HSTS, at least a year | Pass | `max-age=63072000; includeSubDomains; preload` (`lib/security/headers.ts`). |
| 3.4.2 | CORS origin fixed or allow-listed | Pass | No route sends `Access-Control-Allow-Origin`; browsers refuse cross-origin reads. The `/api/v1` API is called server-to-server with a bearer token. |
| 3.5.1 | CSRF protection without relying on preflight | Pass | Server actions: Next.js checks `Origin` against the host. Cookie-authenticated POST routes are protected by SameSite=Lax (cookies aren't sent on cross-site POSTs); `/auth/confirm` also checks `Origin`/`Sec-Fetch-Site`. Webhooks are signature-checked and use no cookies. ZAP's "no anti-CSRF token" note is explained in `docs/security/zap.md`. |
| 3.5.2 | Preflight-based protection can't be bypassed | N/A | The app doesn't rely on CORS preflight (see 3.5.1). |
| 3.5.3 | Sensitive functions not on GET | **Fixed** | All writes are POST (server actions, route handlers). Forms without a method submitted as GET before hydration, which put passwords and other fields in the URL (ZAP 10024): every form now has `method="post"` and lint refuses a form without one. No GET changes data. Email links land on an interstitial that POSTs (`/auth/link`); the OAuth return (`/auth/callback`) is a GET by protocol and exchanges a single-use PKCE code. |

## V4 API and web service

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 4.1.1 | Content-Type with charset on bodies | Pass | Next.js sets `text/html; charset=utf-8` and `application/json`; `security.txt` and CSV/PDF exports set theirs. ZAP's "Content-Type missing" hits are bodiless redirects. |
| 4.4.1 | WebSockets over TLS | Pass | Realtime uses `wss://` to Supabase in production (CSP `connect-src` allows only the project's `wss:` origin). |

## V5 File handling

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 5.2.1 | Size limits | Pass | Bucket `file_size_limit` and allowed MIME types on every bucket (migrations), checked again in actions; images downscaled in the browser and capped server-side (6,000 × 6,000 px). |
| 5.2.2 | Extension and content checked | Pass | Images re-encoded with sharp (rejects anything that doesn't decode, strips EXIF/GPS: `lib/images/reencode.ts`); PDFs checked for `%PDF-` (`lib/actions/credentials.ts`, `submit_credential` checks the stored object). |
| 5.3.1 | Uploads never executed | Pass | Uploads live in Supabase Storage, not in the app's deployment; nothing there is executed. |
| 5.3.2 | Server-generated file paths | Pass | Object paths are `{owner}/{uuid}.ext` built on the server; storage RLS ties the first segment to `auth.uid()`. |

## V6 Authentication

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 6.1.1 | Anti-automation documented | Pass | PRD 10 "Accounts and sign-in" as changed by decisions 2026-09-28 (failed password sign-ins slow down by up to a minute and need Turnstile; the emailed code and Google always work, so no one can be locked out on purpose); limits per action in `rate_limit_events`. |
| 6.2.1 | Passwords at least 8 characters | Pass | At least 10 (`lib/auth/password.ts`, Supabase `minimum_password_length = 10`). |
| 6.2.2 | Users can change their password | **Fixed** | Only the emailed reset existed. Settings → Security now has "Change password" (`changePassword` in `lib/actions/auth.ts`); E2E `auth.spec.ts`. |
| 6.2.3 | Change needs the current password | **Fixed** | The new form checks the current password on a separate cookie-less client before updating, rate-limited to 5 tries in 15 minutes. |
| 6.2.4 | Checked against breached passwords | Pass | Have I Been Pwned range lookup at signup, reset and change (`lib/security/hibp.ts`). |
| 6.2.5 | No composition rules | Pass | Length and breach check only (`password_requirements = ""`). |
| 6.2.6 | `type=password` | Pass | `components/auth/password-field.tsx`, with a show button. |
| 6.2.7 | Paste and password managers allowed | Pass | No paste blocking; `autocomplete` set to `current-password`/`new-password`. |
| 6.2.8 | Password used exactly as typed | Pass | Passed through unchanged to Supabase Auth (bcrypt); no trimming or case changes. |
| 6.3.1 | Brute-force controls as documented | Pass | `lib/actions/auth.ts` sign-in throttling + Turnstile after failures, Supabase Auth rate limits; E2E "wrong passwords slow sign-in down…". |
| 6.3.2 | No default accounts | Pass | None in migrations; `seed.sql` creates no users and runs only locally. |
| 6.4.1 | Initial codes random, short-lived, single use | Pass | Supabase one-time codes and links, 15 minutes (`otp_expiry = 900`), spent on use; email links need a POST from the interstitial so scanners don't spend them. |
| 6.4.2 | No hints or secret questions | Pass | None. |

## V7 Session management

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 7.2.1 | Sessions verified by a trusted backend | Pass | `getUser()` (Auth server) for decisions, `getClaims()` (signature-checked) in `proxy.ts`; lint bans `getSession()` in server code. |
| 7.2.2 | Dynamic session tokens | Pass | Supabase JWT access tokens with rotating refresh tokens. |
| 7.2.3 | Reference tokens ≥ 128 bits from a CSPRNG | Pass | Supabase refresh tokens; our own tokens (share links, invites, API keys) are 32 random bytes, stored hashed. |
| 7.2.4 | New session on sign-in | Pass | Each sign-in issues a new Supabase session; two-factor upgrades to a new aal2 session. |
| 7.4.1 | Logout ends the session | Pass | `signOut()` revokes the refresh token; access tokens expire within the hour and `getUser()` refuses revoked sessions. "Sign out of all devices" and a password change end the others. |
| 7.4.2 | Sessions end when an account is disabled or deleted | Pass | Bans are applied at the Auth layer (`banned_until`), which `getUser()` refuses; deletion removes the `auth.users` row and its sessions (pgTAP `39`, `46`). |

## V8 Authorization

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 8.1.1 | Authorization rules documented | Pass | PRD 8 RLS matrix, feature sections, CLAUDE.md code maps. |
| 8.2.1 | Function-level access | Pass | Portals gated in `proxy.ts` (`lib/auth/gate.ts`) and again in SQL (`require_moderator`, `require_super_admin`, `require_org`, `require_uni`, all with aal2 where required). |
| 8.2.2 | Data-level access (IDOR/BOLA) | Pass | RLS default-deny on every table; definer functions check ownership with `auth.uid()`; refusal tests for another university's student, a stranger, a recruiter without entitlement and a signed-out visitor (pgTAP `05`–`55`). |
| 8.3.1 | Enforced at a trusted layer | Pass | The database enforces it; the UI only hides what the database would refuse anyway. |

## V9 Self-contained tokens

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 9.1.1 | Signature checked before use | Pass | Supabase JWTs are verified by `getClaims()`/Auth; CV envelopes are Ed25519-verified (`_shared/cv/sign.ts`); webhook payloads HMAC-checked. |
| 9.1.2 | Algorithm allow-list, no `none` | Pass | Supabase Auth verifies with the project's own keys; CV verification accepts Ed25519 only. |
| 9.1.3 | Keys from trusted, preconfigured sources | Pass | The project's JWKS; CV public keys from our own `/.well-known/skilient-cv-keys.json`, never from the token. |
| 9.2.1 | `exp`/`nbf` checked | Pass | Supabase Auth checks expiry; CV records carry issue dates and revocation is checked by `verify_cv`. |

## V10 OAuth and OIDC

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 10.4.1–10.4.5 | Authorization-server rules (redirect allow-list, single-use short-lived codes, no implicit/password grants, refresh-token replay) | N/A | Skilient runs no authorization server. Sign-in with Google is Supabase Auth's PKCE flow, with redirect URLs allow-listed in Supabase; the GitHub App callback checks a single-use state cookie bound to the user (`lib/github/state.ts`) and binds identity server-side (pgTAP `09`). Supabase rotates refresh tokens and detects reuse (`enable_refresh_token_rotation`). |

## V11 Cryptography

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 11.3.1 | No ECB or weak padding | Pass | No block ciphers in our code; Vault uses libsodium AEAD. |
| 11.3.2 | Approved ciphers and modes | Pass | Vault (authenticated encryption), TLS by Vercel and Supabase. |
| 11.4.1 | Approved hashes only | Pass | SHA-256 and HMAC-SHA256 for tokens, MACs and keyed hashes; Ed25519 signatures. SHA-1 appears only as the Have I Been Pwned range-lookup format (a lookup key, not a protection). |

## V12 Secure communication

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 12.1.1 | TLS 1.2/1.3 only | Pass | Vercel and Supabase terminate TLS 1.2+ (platform defaults). |
| 12.2.1 | TLS everywhere, no fallback | Pass | HSTS preload, `upgrade-insecure-requests`; every outbound call is `https://`. |
| 12.2.2 | Publicly trusted certificates | Pass | Vercel and Supabase managed certificates. |

## V13 Configuration

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 13.4.1 | No source-control metadata deployed | Pass | Vercel serves the build output only; the repository and its `.git` folder are never deployed. |

## V14 Data protection

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 14.2.1 | No sensitive data in URLs | **Fixed** | See 3.5.3 (forms before hydration). Email links carry one-time tokens by design and are spent through the POST interstitial. Accepted: the landing page's email field submits `/join?email=` when JavaScript is off (phase 12 decision), an address the visitor typed to sign up, not a credential. |
| 14.3.1 | Client data cleared on sign-out | Pass | `components/auth/sign-out-button.tsx` clears state in every tab, removes `sb-` and app keys from local storage and resets PostHog (`lib/auth/channel.ts` → `resetAnalytics`). |

## V15 Secure coding and architecture

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 15.1.1 | Remediation time frames documented | Pass | Decided 2026-10-04 (`docs/decisions.md`): critical vulnerabilities in a dependency fixed or mitigated within 7 days (CI already fails on them), high within 30 days, everything else through the weekly Dependabot pull requests within 90 days. |
| 15.2.1 | Components within those time frames | Pass | `pnpm audit --audit-level critical` blocks CI; Dependabot weekly (`.github/dependabot.yml`); no open high or critical advisories at this commit. |
| 15.3.1 | Only needed fields returned | Pass | Reads go through SQL functions that build the exact document a page needs; recruiters read `talent_index`, which has no name or photo column; staff views are separate functions. |

## Reference-build regressions (PRD 10)

| Reference-build bug | Regression test |
| --- | --- |
| `github-sync` trusting a client-supplied user | pgTAP `09_github_connect` (identity only from the GitHub callback ticket) and `tests/worker/github-worker.test.ts` |
| GitHub token exposed in the client session | pgTAP `09_github_connect` (tokens in Vault, unreadable by users) |
| Over-broad unfriend and block deletes | pgTAP `17_friends_blocks` ("touches only the pair") |
| Chat RLS `USING (true)` | pgTAP `23_chat` (a non-member can't read, join or post) and `24_chat_extras` |
| Invite and application decisions keyed by owner instead of the venture | pgTAP `14_ventures` (`decide_application` refuses anyone but the venture's owner) |
