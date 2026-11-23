# UX pilot: how to run (local only)

1. Docker: if `docker info` fails, start `containerd` then `dockerd --containerd=/run/containerd/containerd.sock` (the session hook's dockerd timed out waiting for containerd).
2. `pnpm db:start`; `scripts/ux-pilot/env.local.sh` (git-excluded) holds the ci.yml env, `DATABASE_URL` and `CV_CHROMIUM_PATH`; regenerate it from `supabase status -o env` if the keys change.
3. `ENABLE_UI_GALLERY=1 pnpm build` (Next 16.4.4 stops once with a security-upgrade notice; rerun and it completes), `pnpm start --port 3100`.
4. `node scripts/ux-pilot/seed.mjs` (idempotent; accounts in `docs/ux-pilot/accounts.local.json`, password in the file).
5. Sessions: `node scripts/ux-pilot/run-S01a.ts` … `run-S02b.ts` (`ONLY=T020,T021` runs a subset). `probe.ts <account> <phone|desktop> <url> [click …]` prints one page.

Limits on this container: Edge Functions don't boot (the edge runtime can't fetch npm packages through the proxy's TLS), so worker emails (claim, notifications), GitHub sync, CV signing (`/me/cv` shows "We couldn't prepare your CV") and link previews don't run; the seed seals Record entries with the cv-sign code from Node. Google sign-in and the GitHub App flow need staging.
