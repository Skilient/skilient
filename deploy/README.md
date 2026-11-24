# Azure floor (Bicep)

The floor from `docs/azure/prd.md`: `web`, `core-a`, `core-b`, `realtime` (Container Apps), four jobs, one private PostgreSQL 17 server, Blob Storage, Key Vault, Log Analytics, the private DNS zone, and the $40 and $55 budget alerts.

**Status: not compiled.** The Bicep compiler could not be installed in the development sandbox, so these files have not been built or validated. First step on any machine with the Azure CLI: `az bicep install`, then `az bicep build --file deploy/main.bicep`. CI compiles them on every pull request that touches `deploy/`.

## Deploy (first time)

Run from a machine with Azure CLI 2.x and an account that can create resources in the subscription. Pick the subscription first with `az account set --subscription <name>`.

```bash
az group create --name skilient-rg --location centralindia

# Preview. The password prompt is hidden and the value stays out of shell history.
read -r -s -p "Postgres admin password: " PG_PW; echo
az deployment group what-if -g skilient-rg -f deploy/main.bicep \
  -p pgAdminPassword="$PG_PW" \
  -p webImage=ghcr.io/skilient/web:<commit> \
  -p serviceImage=ghcr.io/skilient/services:<commit> \
  -p jobImage=ghcr.io/skilient/jobs:<commit> \
  -p ghcrUsername=Ahmed-Mursileen \
  -p ghcrToken="$CR_PAT" \
  -p budgetContactEmails='["<alert email>"]'

# Deploy after the what-if reads right.
az deployment group create -g skilient-rg -f deploy/main.bicep \
  -p pgAdminPassword="$PG_PW" \
  -p webImage=ghcr.io/skilient/web:<commit> \
  -p serviceImage=ghcr.io/skilient/services:<commit> \
  -p jobImage=ghcr.io/skilient/jobs:<commit> \
  -p ghcrUsername=Ahmed-Mursileen \
  -p ghcrToken="$CR_PAT" \
  -p budgetContactEmails='["<alert email>"]'
unset PG_PW
```

`<commit>` is the commit the images were built from. The three image names are placeholders until the images exist.

## Why deploys run from a laptop for now

The PRD says Bicep is deployed by GitHub Actions. That needs the Postgres admin password from somewhere, and the options are a GitHub secret or a Key Vault secret that must exist before the first deploy. A GitHub secret breaks the rule that secrets live only in Key Vault. So the first deploy takes the password at the prompt. Once Key Vault exists, the password can be stored there and the deploy can move to Actions. That choice is open; see the decision log.

## Known gaps

- Not compiled or what-if tested. Expect small syntax or property fixes on the first build.
- Container images on GitHub Container Registry are private. Each app and job pulls them with `ghcrToken` (a secure parameter) and `ghcrUsername`. The token sits in the apps' secret store, not Key Vault; see docs/decisions.md (2026-11-24).
- `service` containers and jobs use the same images as the services they host, per the W0 design. `SERVICES`, `JOB` and the `*_URL` variables are assumed names; the application code must read them.
- Cloudflare address ranges are empty, so `web` and `realtime` accept traffic from anywhere until cutover. Pass `cloudflareIpRanges` at cutover.
- Blob containers, the database roles and the five alert rules are not in the templates. The PRD steps 2 and 3 and section "Alerts" cover them.
- The PostgreSQL server's storage tier is not set; it follows the 32 GB size. Confirm Premium SSD on the first what-if.
