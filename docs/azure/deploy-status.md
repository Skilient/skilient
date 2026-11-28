# Azure deploy: where it stands

Updated 2026-11-27. The live state of the Azure floor, what is blocked, and the next commands in order. Commands live in `deploy/README.md`; this file says which to run and when. Update it whenever a step is done.

## Region: UAE North (decided 2026-11-26)

The floor moves from Central India to **UAE North** (`uaenorth`, Dubai). Measured from Pakistan on 2026-11-26: traffic enters Microsoft's network in the UAE after about 65 ms, then takes about 155 ms more inside it to reach Central India (about 200 to 220 ms round trip). UAE North offers Container Apps, its jobs and PostgreSQL Flexible Server; B1ms is $0.0200 an hour there against $0.0245 in Central India; Container Apps prices are the same. `deploy/main.bicep` now defaults to `uaenorth`.

## What exists in `skilient-rg` now (subscription Skilient-Azure)

**In UAE North since 2026-11-26** (foundation deploy with `deployApps=false deployDatabase=false`, state Succeeded): `skilient-vnet`, `skilient-logs`, `skilient-appi`, `skilient-kv-tohnfutbiqx5`, `skilientsttohnfutbiqx5a`, and the private DNS zone with its link (global). Ahmed has Key Vault Secrets Officer on the vault.

**Database since 2026-11-27:** `skilient-pg` (`skilient-pg.postgres.database.azure.com`), PostgreSQL 17, Standard_B1ms, **zone 1**, Premium SSD 32 GB, public access off, Entra sign-in on; databases `skilient` plus Azure's own; `azure.extensions` set (PG_TRGM, UNACCENT, BTREE_GIN, PGCRYPTO, PG_STAT_STATEMENTS). Deployment `main` Succeeded. No containers yet.

Earlier the same day the same foundation was created in Central India and then deleted (Key Vault purged):

| Resource | Name |
| --- | --- |
| Virtual network (subnets `aca`, `postgres`) | `skilient-vnet` |
| Private DNS zone and its link | `skilient.private.postgres.database.azure.com`, `skilient-vnet-link` |
| Log Analytics, Application Insights (+ its Smart Detection action group) | `skilient-logs`, `skilient-appi` |
| Key Vault (RBAC), holding the three GitHub secrets | `skilient-kv-tohnfutbiqx5` |
| Storage account | `skilientsttohnfutbiqx5a` |

Kept: the budget `skilient-rg-budget` ($55 a month, alerts at about $40 and $55, from 2026-12-01; budgets have no region). The group's own metadata location stays `centralindia`; that does not matter.

Also in the group, not part of the floor: `skilient-foundry` (AI Foundry, created 2026-11-25 outside this plan). Deploys ignore it; do not delete it with the rest. If it is only for experiments, consider moving it out of the product's resource group.

## The database block (resolved 2026-11-27)

- **Error:** `SkuNotAvailable` on `Standard_B1ms`, twice, in Central India.
- **Cause:** the subscription is Sponsored (`quotaId` `Sponsored_2016-01-01`). `az vm list-skus` shows `NotAvailableForSubscription` for B1ms in Central India (region-wide and zones 1 to 3), South India and **UAE North**, and for D2ds_v5 in Central India. A block on the subscription, not the size, zone or storage.
- **Fixed on the way:** storage set to classic Premium SSD (`Premium_LRS`, P4); Premium SSD v2 refuses Burstable anyway. An optional `pgZone` parameter exists but is not needed.
- **Support request filed 2026-11-26** (Azure support, Service and subscription limits → Azure Database for PostgreSQL Flexible Server → Region access) for Central India, Burstable, 2 vCores, plus a Container Apps check. Ahmed closed it the same day and filed a new one for UAE North. **Microsoft enabled UAE North** (email, 2026-11-26 evening); afterwards `az vm list-skus` showed no restriction on B1ms there.
- **Still refused with no zone chosen** (2026-11-27 01:05 and 13:52 UTC, `SkuNotAvailable`); **succeeded with `pgZone=1`**. `deploy/main.bicep` now defaults `pgZone` to `1`: a server's zone cannot change, so every later deploy must keep it.
- Container Apps in UAE North: not tested yet (no images). If the full deploy hits a similar block, the same kind of support request applies.

## Next, in order

1. ~~Support request → UAE North~~ Done 2026-11-26.
2. ~~Delete the empty Central India foundation~~ Done 2026-11-26 (commands kept for the record). Nothing in it is used. Run from any folder; each line deletes one resource; the Key Vault is purged so its name can be reused in UAE North (the name comes from the group, so it is the same):
   ```bash
   RG=skilient-rg
   az network private-dns link vnet delete -g $RG -z skilient.private.postgres.database.azure.com -n skilient-vnet-link --yes
   az network private-dns zone delete -g $RG -n skilient.private.postgres.database.azure.com --yes
   az network vnet delete -g $RG -n skilient-vnet
   az monitor app-insights component delete -g $RG --app skilient-appi
   az monitor action-group delete -g $RG -n "Application Insights Smart Detection"
   az monitor log-analytics workspace delete -g $RG -n skilient-logs --force true --yes
   az storage account delete -g $RG -n skilientsttohnfutbiqx5a --yes
   az keyvault delete -g $RG -n skilient-kv-tohnfutbiqx5
   az keyvault purge -n skilient-kv-tohnfutbiqx5 --location centralindia
   az resource list -g $RG --query "[].name" -o tsv   # expect only skilient-foundry and its project
   ```
   On GitHub (SkilientApp → General), delete the private key and the client secret **generated on 2026-11-26** (check the dates; leave production's older ones). They were only ever in the purged vault.
3. ~~Now, before support answers~~ Done 2026-11-26: the foundation in UAE North without the database (`deployDatabase=false`), which the block cannot stop. No admin password needed:
   ```bash
   az deployment group create -g skilient-rg -n main -f deploy/main.bicep \
     -p deployApps=false -p deployDatabase=false -p budgetContactEmails='["<alert email>"]'
   ```
   **When support confirms UAE North:** the same deploy with the database (`deployDatabase` defaults to true) adds the server, its configurations and the `skilient` database:
   ```bash
   printf 'Postgres admin password: '; read -rs PG_PW; echo
   az deployment group what-if -g skilient-rg -n main -f deploy/main.bicep \
     -p deployApps=false -p pgAdminPassword="$PG_PW" -p budgetContactEmails='["<alert email>"]'
   az deployment group create -g skilient-rg -n main -f deploy/main.bicep \
     -p deployApps=false -p pgAdminPassword="$PG_PW" -p budgetContactEmails='["<alert email>"]'
   unset PG_PW
   ```
   The what-if must show `location: "uaenorth"` on every new resource.
3b. ~~The database~~ Done 2026-11-27 (zone 1; see above). Reply to Microsoft's email confirming the request is fulfilled.
4. ~~Reload the GitHub secrets~~ Done 2026-11-26 (private key PEM 1,675 characters, client secret 40, token key 43). On the App page, only the September key and production's client secret plus these new ones should remain; delete any other 2026-11-26 key or secret. Then `deploy/README.md` "Turning GitHub on", step 1, with a freshly generated private key and client secret (Key Vault cannot copy secrets between geographies). Then the rest of section 4 of the setup checklist: identity signing key(s), `identity-totp-key`, `identity-refresh-pepper`, service token and log hash keys, CV and Record signing keys and the CV export secret (export from Supabase Vault under two-person review), VAPID keys, Brevo, Turnstile, `github-webhook-secret` (W13).
5. **Images** (later workstream): Dockerfiles for `web` and `jobs` (only `packages/host/Dockerfile` exists), and a workflow that pushes `web`, `services` and `jobs` to GHCR tagged by commit.
6. **Database roles and migrations:** the PRD's implementation plan steps 2 and 3 (not in the Bicep).
7. **Full deploy with GitHub on:** `deploy/README.md` "Turning GitHub on", step 2 (`githubAppId=5098600`, `githubClientId=Iv23lisejML8tk7pljdJ`, `githubAppSlug=skilientapp`), only after the GitHub secrets exist in the new vault.
8. **At the cutover, not before:** SkilientApp's Callback URL → `https://www.skilient.com/api/github/callback`, Webhook URL → `https://www.skilient.com/api/github/webhook`, redeliver one delivery and check 200 (`deploy/README.md` step 3; setup checklist section 8). Then revoke the old private key and client secret on the App page.

## Loose ends on Ahmed's machine

- `~/Downloads/skilientapp.2026-09-27.private-key.pem` is the older App private key in plain text. Shred it once production's copy is confirmed stored: `shred -u ~/Downloads/skilientapp.2026-09-27.private-key.pem`.

## 2026-11-28: email and media (W9)

- Made by hand in `skilient-rg` (and in `deploy/modules/communication.bicep`, so a deploy adopts them): provider `Microsoft.Communication` registered; `skilient-email` with domain `skilient.com` and senders notify@ and security@; `skilient-comms` (`skilient-comms.uae.communication.azure.com`), data in the UAE. DNS on Vercel: verification TXT and both DKIM verified; SPF merged with Zoho's, Azure's SPF check failed (wants `-all`), so the domain is not linked yet (`linkEmailDomain=false`). See `docs/azure/setup-checklist.md` section 4.
- In the Bicep only (lands with the next deploy): media's 13 containers, CORS and shared-key access off on `skilientsttohnfutbiqx5a`; core-a's `AZURE_CLIENT_ID`, `MEDIA_BLOB_URL`, `NOTIFY_EMAIL_ENDPOINT`, `APP_URL`; roles Storage Blob Delegator and Contributor on `skilient-comms` for `skilient-core-a-id`. `az bicep build` clean.
