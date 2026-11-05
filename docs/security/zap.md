# ZAP baseline

OWASP ZAP passive baseline (PRD 10; phase 13 question 13). Workflow `.github/workflows/zap.yml`: every Monday, by
hand (Actions → ZAP baseline → Run workflow), and on pull requests that change `proxy.ts`, `next.config.ts`,
`lib/security/` or the ZAP files. It builds the app against the local Supabase stack (there is no staging) and fails
on any **High** finding (`scripts/zap-gate.mjs`); the report is attached to the run and summarised on its page.

**Before launch:** run it once by hand with `target` set to the production URL, and note the date and result below.

Run it locally (Docker): `pnpm build && pnpm start`, then
`docker run --rm --network host -v "$PWD/zap:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:2.17.0 zap-baseline.py -t http://127.0.0.1:3000 -c rules.tsv -J report.json -I`
(copy `.zap/rules.tsv` into `zap/` first) and `node scripts/zap-gate.mjs zap/report.json`.

## Results

| Date | Target | High | Medium | Notes |
| --- | --- | --- | --- | --- |
| 2026-10-04 | Local production build | 0 | 2 (accepted below) | Fixed in slice 3: forms submitted as GET before hydration put passwords in the URL (10024). |
| 2026-11-05 | **Production** `https://www.skilient.com` ([run 27](https://github.com/Skilient/skilient/actions/runs/42115345259), self-hosted runner) | 0 | 3 (accepted below) | 146 URLs, 57 rules passed. New: 10098 on public static files; the cache notices (10015, 10049, 10050) and COEP (90004) are Low or informational. |

## Accepted findings

| Rule | Risk | Why it stays |
| --- | --- | --- |
| 10055 CSP: `style-src 'unsafe-inline'` | Medium | Radix and the motion library set inline `style` attributes; nonces can't cover attributes. Scripts stay nonce-only with `'strict-dynamic'`, which is what stops XSS; inline styles alone can't run code. Revisit if the libraries offer a nonce-friendly mode. |
| 10202 Absence of anti-CSRF tokens | Medium | Forms post to Next.js server actions, which reject requests whose `Origin` doesn't match the host; session cookies are SameSite=Lax, so other sites can't post with them. ZAP only looks for a token field. |
| 10098 Cross-domain misconfiguration (`Access-Control-Allow-Origin: *`) | Medium | Only on public static files Vercel serves (fonts, the logo, `robots.txt`): no cookies are sent with them and they hold nothing private. Pages and API routes don't send the header. |
| 90004 Cross-Origin-Embedder-Policy missing | Low | COEP is only needed for cross-origin isolation (SharedArrayBuffer, high-resolution timers), which the app doesn't use; setting it would block third-party images such as link previews. |
| 10015, 10049, 10050 cache notices | Low / informational | Signed-in pages are `no-store` on purpose; static assets are cached by Vercel's CDN. |
| 10055 CSP notices | Low | Informational notes about directives without a fallback (`form-action`, `frame-ancestors` are set explicitly). |
| 10024 Email in a URL (`/join?email=`, `/request-university?email=`) | Informational | The landing page's email field works without JavaScript by submitting to `/join` (phase 12). It's the address the visitor typed to sign up, not a credential. |
| 10019 Content-Type missing | Informational | Bodiless redirects. |
| 10031 User-controllable attribute | Informational | Form values echoed into `value` attributes by React, which escapes them. |
| 2 Private IP disclosure | Ignored in `.zap/rules.tsv` | Numbers in the team portrait SVG paths (for example `10.6.6.3`), not addresses. |
| 10111 Authentication request identified | Ignored | Informational: the sign-in form. |
