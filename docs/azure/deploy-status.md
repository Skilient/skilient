# Azure deploy: where it stands

Updated 2026-11-26. The live state of the Azure floor, what is blocked, and the next commands in order. Commands live in `deploy/README.md`; this file says which to run and when. Update it whenever a step is done.

## What exists in `skilient-rg` (subscription Skilient-Azure, Central India)

Created by the foundation deploy (`deployApps=false`) on 2026-11-26:

| Resource | Name |
| --- | --- |
| Virtual network (subnets `aca`, `postgres`) | `skilient-vnet` |
| Private DNS zone and its link | `skilient.private.postgres.database.azure.com` |
| Log Analytics, Application Insights | `skilient-logs`, `skilient-appi` |
| Key Vault (RBAC) | `skilient-kv-tohnfutbiqx5` |
| Storage account | `skilientsttohnfutbiqx5a` |
| Budget ($55 a month, alerts at about $40 and $55, from 2026-12-01) | `skilient-rg-budget` |

Not created: the PostgreSQL server (blocked, below) and every container app and job (no images yet).

Also in the group, not part of the floor: `skilient-foundry` (AI Foundry, created 2026-11-25 outside this plan). Deploys ignore it. If it is only for experiments, consider moving it out of the product's resource group.

Ahmed has the role **Key Vault Secrets Officer** on the vault (2026-11-26).

## Key Vault secrets loaded

| Secret | Loaded | Checked |
| --- | --- | --- |
| `github-app-private-key` | 2026-11-26 | PEM, 1,675 characters; a new key, not the September one |
| `github-app-client-secret` | 2026-11-26 | 40 characters |
| `work-github-token-key` | 2026-11-26 | 43 characters (32 bytes, base64url) |

Still to load (`docs/azure/setup-checklist.md` section 4): identity signing key(s), `identity-totp-key`, `identity-refresh-pepper`, service token and log hash keys, CV and Record signing keys and the CV export secret (export from Supabase Vault under two-person review), VAPID keys, Brevo, Turnstile, `github-webhook-secret` (W13).

## Blocked: the database

- **Error:** `SkuNotAvailable` on `Standard_B1ms`, twice.
- **Cause:** the subscription is Sponsored (`quotaId` `Sponsored_2016-01-01`). `az vm list-skus` shows `NotAvailableForSubscription` for B1ms in Central India (region-wide and zones 1 to 3), for B1ms in South India, and for D2ds_v5 in Central India. A block on the subscription, not the size or zone.
- **Fixed on the way:** storage set to classic Premium SSD (`Premium_LRS`, P4); Premium SSD v2 refuses Burstable anyway. An optional `pgZone` parameter exists but is not needed.
- **Support request filed 2026-11-26** (Azure support, Service and subscription limits → Azure Database for PostgreSQL Flexible Server → Region access): Central India, Burstable, 2 vCores, plus a check that Container Apps (Consumption) can be created there. Waiting for Microsoft.
- **Does not block** W6 to W12 (local test containers). Blocks W14 (rehearsals), W15 and W16, and deploying web in W13.

## Next, in order

1. **When support confirms:** rerun the foundation deploy from a checkout that has these changes (`deploy/README.md` "Before the images exist"; zsh-safe prompts):
   ```bash
   printf 'Postgres admin password: '; read -rs PG_PW; echo
   az deployment group what-if -g skilient-rg -n main -f deploy/main.bicep \
     -p deployApps=false -p pgAdminPassword="$PG_PW" -p budgetContactEmails='["<alert email>"]'
   az deployment group create -g skilient-rg -n main -f deploy/main.bicep \
     -p deployApps=false -p pgAdminPassword="$PG_PW" -p budgetContactEmails='["<alert email>"]'
   unset PG_PW
   ```
   Use the same Postgres admin password from the password manager. Expect only the server, its configurations and the `skilient` database to be created.
2. **Load the remaining secrets** (list above), each with the hidden-prompt or file pattern in `deploy/README.md` "Turning GitHub on", step 1.
3. **Images** (later workstream): Dockerfiles for `web` and `jobs` (only `packages/host/Dockerfile` exists), and a workflow that pushes `web`, `services` and `jobs` to GHCR tagged by commit.
4. **Database roles and migrations:** the PRD's implementation plan steps 2 and 3 (not in the Bicep).
5. **Full deploy with GitHub on:** `deploy/README.md` "Turning GitHub on", step 2 (`githubAppId=5098600`, `githubClientId=Iv23lisejML8tk7pljdJ`, `githubAppSlug=skilientapp`). Only after the three GitHub secrets exist, which they now do.
6. **At the cutover, not before:** SkilientApp's Callback URL → `https://www.skilient.com/api/github/callback`, Webhook URL → `https://www.skilient.com/api/github/webhook`, redeliver one delivery and check 200 (`deploy/README.md` step 3; setup checklist section 8). Then revoke the old private key and client secret on the App page.

## Loose ends on Ahmed's machine

- `~/Downloads/skilientapp.2026-09-27.private-key.pem` is the older App private key in plain text. Shred it once production's copy is confirmed stored: `shred -u ~/Downloads/skilientapp.2026-09-27.private-key.pem`.
