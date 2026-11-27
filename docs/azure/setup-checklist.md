# Setup checklist: Azure move

Things only a human can do. Nothing in this file is a value. Secrets are typed into Key Vault or a password manager, never into the repo, an image, a CI log or a chat. Tick a box when it is done; add the date and who did it, not the value.

Source for each item: [`prd.md`](prd.md). Items marked **(suggestion)** are not in the PRD.

## 1. Azure account and budget

- [ ] Use the existing Azure account that has the $5k startup credits (PRD decision 5). Record the subscription's display name here: ____
- [x] Resource group `skilient-rg` (2026-11-26). Region: UAE North (`uaenorth`), decision 2026-11-26 (it replaced Central India).
- [ ] Re-check prices in the Azure pricing calculator for UAE North before committing (B1ms $0.0200 an hour there on 2026-11-26): B1ms Flexible Server, Container Apps (vCPU and GiB rates, idle rate), Blob Storage LRS hot, Key Vault Standard, Log Analytics. The PRD's prices were not re-fetched.
- [ ] Check whether B1ms is still offered. The PRD flags it as planned for retirement. If it is gone, the database size changes and the cost table needs redoing.
- [ ] Create a monthly cost budget with alerts at **$40** and **$55** (actual cost), sent to Ahmed's email.
- [ ] Choose the Postgres admin login name and generate its password in the password manager. Put the password in Key Vault only after `deploy/` creates the vault. Not in the repo.

## 2. Network and database decisions to confirm

- [ ] Confirm the database is private, reachable only through the virtual network (decision 6). This cannot be changed after the server is created.
- [x] Decided 2026-11-22: `realtime` gets its own container (+$6 a month). Floor $57.49, accepted by Ahmed. Recorded in `decisions.md` and PRD record 12.

## 3. GitHub to Azure deploy access (suggestion)

The PRD says infrastructure is deployed by GitHub Actions from Bicep in `deploy/`. It does not say how Actions gets rights in Azure. The usual way without a stored password is a federated credential:

- [ ] (suggestion) Create a Microsoft Entra app registration, or a user-assigned managed identity, for the deploy workflow.
- [ ] (suggestion) Add a federated credential for `repo:Skilient/skilient` limited to the branch or environment that deploys (`azure` for the floor, `main` after cutover).
- [ ] (suggestion) Give that identity Contributor on the resource group only, not the subscription.
- [ ] (suggestion) Store the tenant id, client id and subscription id as GitHub repository variables. They are identifiers, not secrets. No client secret is created.

No Azure connector is installed in this environment. Everything above is done in the Azure portal or with the Azure CLI by Ahmed.

## 4. Key Vault and secrets

Key Vault is created by `deploy/`. Each secret below is entered by Ahmed once, and each container reads only the secrets it needs through its managed identity.

- [ ] CV and Record signing keys: Ed25519 private keys, one secret per key id. Export from Supabase Vault under two-person review (see section 5). Public keys do not change.
- [ ] CV export secret (the MAC key for PDF exports). Export from Supabase Vault under the same review.
- [x] Web Push VAPID key pair. Done 2026-11-22: the old private key could not be exported, so a new pair was generated with `web-push` and loaded into Supabase Vault as `vapid_public_key`, `vapid_private_key` and `vapid_subject`. Vercel `NEXT_PUBLIC_VAPID_PUBLIC_KEY` set to match. Zero push subscriptions existed, so no devices needed re-subscribing. Test push on 2026-11-22 reached a phone. Azure: copy the three values into Key Vault at cutover (do not use `scripts/restore/vapid-keys.mjs`). See `decisions.md`.
- [ ] Brevo API key and the Brevo webhook bearer secret.
- [ ] Cloudflare Turnstile secret key (the site key is public and goes in the web configuration).
- [x] (private key and client secret loaded 2026-11-26 by Ahmed into `skilient-kv-tohnfutbiqx5` in UAE North; webhook secret still to do) GitHub App private key and webhook secret. work reads them as `github-app-private-key` and `github-app-client-secret` (the App's client secret), with the App id and client id as plain variables `WORK_GITHUB_APP_ID` and `WORK_GITHUB_CLIENT_ID` (W5), passed as deploy parameters. Commands: `deploy/README.md` "Turning GitHub on".
- [x] (loaded 2026-11-26 by Ahmed) `work-github-token-key`: 32 random bytes (base64url) that seal students' GitHub tokens in work's database (decision 2026-11-26, W5). Tokens in Supabase Vault are not exported: students reconnect GitHub after the cutover (decision 2026-11-26).
- [ ] `community-ticket-key`: 32 random bytes (base64url) that seal each society event's ticket secret in community's database (decision 2026-11-27, W7); make it as `work-github-token-key` was. The events' secrets themselves move at the cutover (W14). Community stops at startup without it.
- [ ] Payment gateway sandbox credentials, only when the billing gateway is switched on. Billing ships dormant, so this is not needed for the cutover.
- [ ] PostHog and Sentry project keys, if they change host or project.
- [ ] Identity signing key(s): `identity-signing-key-<kid>`, each a private Ed25519 JWK, with `IDENTITY_SIGNING_KIDS` (a plain variable, newest first) naming them. Generate one with `generateSigningKey()` in `services/identity/src/keys.ts`; never paste it into chat or a file (decision 2026-11-25, Q10).
- [ ] `identity-totp-key`: the key that encrypts imported and new authenticator secrets (decision 2026-11-25, Q10).
- [ ] `identity-refresh-pepper`: the secret mixed into stored refresh-token hashes (decision 2026-11-25, Q10).

## 5. Exports from Supabase (first rehearsal)

Done under two-person review. Nothing is written to disk in plain text; the PRD's rule is that the values go straight to Key Vault.

- [ ] Password hashes and two-factor authenticator secrets from `auth.users` and its factor tables. Test that the export works in the first rehearsal. If it cannot be exported, users re-enrol and the PRD's identity section changes.
- [ ] Vault secrets listed in section 4.
- [ ] Confirm `/.well-known/skilient-cv-keys.json` and the backups in `docs/signing-keys/` still match the keys that signed existing CVs and Record entries.

## 6. Cloudflare (free plan)

- [ ] Keep the zone and DNS on Cloudflare. Today it points at Vercel. The switch happens at cutover, not before.
- [ ] Before cutover, create the custom domain names and certificates for `web` and `realtime` in Azure (the PRD's implementation plan, step 1.4).
- [ ] At cutover, restrict the Azure origins to Cloudflare's published address ranges (PRD network rule).

## 7. Image registry

- [ ] Use GitHub Container Registry for the images. The PRD says it is free at this size. Check the current pricing page for GHCR storage and bandwidth before the first push; the PRD's source for "free" is a secondary page.

## 8. Third-party accounts (no change now; cutover URLs later)

These stay as they are until cutover, when the URLs change:

- [ ] Brevo webhook URL (PRD cutover, T+45 minutes).
- [ ] GitHub App webhook and callback URLs. SkilientApp (App ID 5098600, https://github.com/apps/skilientapp), General page: Callback URL → `https://www.skilient.com/api/github/callback`, Webhook URL → `https://www.skilient.com/api/github/webhook`; then redeliver one delivery and check for 200. Steps in `deploy/README.md` "Turning GitHub on", step 3.
- [ ] Turnstile hostnames.

## 9. Rehearsals and sign-off

- [ ] Two full rehearsals and one rollback rehearsal completed and verified clean (PRD implementation plan, section 4).
- [ ] Restore drill passed against Azure (PRD build plan, done-when).
- [ ] Ahmed's go or no-go for the cutover day, given one day before.
- [ ] Supabase and Vercel left read-only for 14 days, then a final Supabase backup saved to Blob Storage and both projects closed (PRD section 6, day 14).
