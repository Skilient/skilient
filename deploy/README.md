# Azure floor (Bicep)

The floor from `docs/azure/prd.md`: `web`, `core-a`, `core-b`, `realtime` (Container Apps), four jobs, one private PostgreSQL 17 server, Blob Storage, Key Vault, Log Analytics, the private DNS zone, and the $40 and $55 budget alerts.

**Status: not compiled.** The Bicep compiler could not be installed in the development sandbox, so these files have not been built or validated. First step on any machine with the Azure CLI: `az bicep install`, then `az bicep build --file deploy/main.bicep`. CI compiles them on every pull request that touches `deploy/`.

## Deploy (first time)

Run from a machine with Azure CLI 2.x and an account that can create resources in the subscription. Pick the subscription first with `az account set --subscription <name>`.

```bash
az group create --name skilient-rg --location centralindia

# Preview. The password prompt is hidden and the value stays out of shell history.
printf 'Postgres admin password: '; read -rs PG_PW; echo
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

### Before the images exist: the foundation only

No workflow pushes images to GHCR yet, and only the services image has a Dockerfile (`packages/host/Dockerfile`); `web` and `jobs` have none. Until they exist, deploy everything except the containers with `deployApps=false`: network, monitoring, the database, Key Vault, storage and the budget. This is enough to load secrets into Key Vault. The database runs (and costs) from here on.

```bash
# Once per subscription: the resource providers the floor uses.
for ns in Microsoft.Network Microsoft.OperationalInsights Microsoft.Insights Microsoft.DBforPostgreSQL \
          Microsoft.KeyVault Microsoft.Storage Microsoft.App Microsoft.ManagedIdentity Microsoft.Consumption; do
  az provider register --namespace "$ns" -o none
done

printf 'Postgres admin password: '; read -rs PG_PW; echo
az deployment group what-if -g skilient-rg -n main -f deploy/main.bicep \
  -p deployApps=false -p pgAdminPassword="$PG_PW" -p budgetContactEmails='["<alert email>"]'
az deployment group create -g skilient-rg -n main -f deploy/main.bicep \
  -p deployApps=false -p pgAdminPassword="$PG_PW" -p budgetContactEmails='["<alert email>"]'
unset PG_PW

# Check: prints the vault's name (skilient-kv-...).
az deployment group show -g skilient-rg -n main --query properties.outputs.keyVaultName.value -o tsv
```

Later, the full deploy (the commands above, without `deployApps=false`) adds the containers to the same group.

### GitHub App (optional parameters)

The App is **SkilientApp** (https://github.com/apps/skilientapp). Its ids are public, not secrets. Add these lines to both commands **only after** the three Key Vault secrets exist (`github-app-private-key`, `github-app-client-secret`, `work-github-token-key`; `docs/azure/setup-checklist.md` section 4): with the ids set, work reads the secrets at startup, and a missing one stops `core-b` from starting.

```bash
  -p githubAppId=5098600 \
  -p githubClientId=Iv23lisejML8tk7pljdJ \
  -p githubAppSlug=skilientapp
```

- `githubAppId` and `githubClientId` become `WORK_GITHUB_APP_ID` and `WORK_GITHUB_CLIENT_ID` on `core-b` (which hosts work) and the `harvest` job. Both must be set; with either empty, neither variable is added and GitHub stays off (Connect GitHub is refused, the harvest job does nothing).
- `githubAppSlug` becomes `GITHUB_APP_SLUG` on `web`, for the install link (W13). Empty leaves it out.
- If work moves to another container, move `workGithubEnv` in `modules/apps.bicep` with it.

### Turning GitHub on (runbook)

Run after the first deploy (it creates the vault, `skilient-kv-<suffix>`) and before the cutover. Do not generate the App's private key or client secret until the vault exists, so they never wait anywhere else. Never paste a secret into chat, a file in the repo, or a command line; the steps below read each one from a hidden prompt or a file and delete the file afterwards.

**Step 1. Put the three secrets in Key Vault.**

```bash
RG=skilient-rg
VAULT=$(az keyvault list -g "$RG" --query "[?starts_with(name,'skilient-kv-')].name | [0]" -o tsv)
[ -n "$VAULT" ] || { echo "No skilient-kv-* vault in $RG: run 'Deploy (first time)' first."; return 1 2>/dev/null || exit 1; }
VAULT_ID=$(az keyvault show -n "$VAULT" --query id -o tsv)

# The vault uses Azure RBAC: give yourself write access to secrets (once; takes a minute to apply).
az role assignment create --role "Key Vault Secrets Officer" \
  --assignee "$(az ad signed-in-user show --query id -o tsv)" --scope "$VAULT_ID"

# 1. The App's private key: on the App's page, General → Private keys → Generate a private key (a .pem downloads).
az keyvault secret set --vault-name "$VAULT" --name github-app-private-key \
  --file ~/Downloads/skilientapp.*.private-key.pem -o none
shred -u ~/Downloads/skilientapp.*.private-key.pem

# 2. The App's client secret: General → Client secrets → Generate a new client secret. Paste at the hidden prompt.
umask 077; printf 'Client secret: '; read -rs CS; echo; printf '%s' "$CS" > "$HOME/.cs.tmp"; unset CS
az keyvault secret set --vault-name "$VAULT" --name github-app-client-secret --file "$HOME/.cs.tmp" -o none
shred -u "$HOME/.cs.tmp"

# 3. The key that seals students' GitHub tokens: 32 random bytes, base64url. Generate once; never rotate casually
#    (a new key makes every stored token unreadable and students must reconnect).
umask 077; openssl rand 32 | base64 | tr '+/' '-_' | tr -d '=\n' > "$HOME/.tk.tmp"
az keyvault secret set --vault-name "$VAULT" --name work-github-token-key --file "$HOME/.tk.tmp" -o none
shred -u "$HOME/.tk.tmp"

# Check: names only, never values.
az keyvault secret list --vault-name "$VAULT" --query "[?starts_with(name,'github-') || name=='work-github-token-key'].name" -o tsv
```

The check must print all three names. Optionally, set `github-webhook-secret` the same way as the client secret (the App's webhook secret, which web will check in W13).

**Step 2. Redeploy with the GitHub ids.** The same command as "Deploy (first time)", plus the three lines:

```bash
printf 'Postgres admin password: '; read -rs PG_PW; echo
az deployment group create -g skilient-rg -f deploy/main.bicep \
  -p pgAdminPassword="$PG_PW" \
  -p webImage=ghcr.io/skilient/web:<commit> \
  -p serviceImage=ghcr.io/skilient/services:<commit> \
  -p jobImage=ghcr.io/skilient/jobs:<commit> \
  -p ghcrUsername=Ahmed-Mursileen \
  -p ghcrToken="$CR_PAT" \
  -p budgetContactEmails='["<alert email>"]' \
  -p githubAppId=5098600 \
  -p githubClientId=Iv23lisejML8tk7pljdJ \
  -p githubAppSlug=skilientapp
unset PG_PW

# Check: core-b is running with the two variables, and started cleanly.
az containerapp show -g skilient-rg -n skilient-core-b \
  --query "properties.template.containers[0].env[?starts_with(name,'WORK_GITHUB')].name" -o tsv
az containerapp logs show -g skilient-rg -n skilient-core-b --tail 50 | grep -i -E "error|github" | head
```

Run `what-if` with the same parameters first, as for the first deploy.

**Step 3. At the cutover (not before): point the App at Azure.** On https://github.com/settings/apps/skilientapp (or the organisation's Developer settings), General:

- **Callback URL:** change to `https://www.skilient.com/api/github/callback`.
- **Webhook URL:** change to `https://www.skilient.com/api/github/webhook`.
- **Webhook secret:** unchanged, unless you rotate it; if you do, update `github-webhook-secret` in Key Vault at the same moment.
- Save, then on Advanced → Recent deliveries press **Redeliver** on one delivery and check it returns 200.

Until the cutover, production keeps the Vercel URLs. This is also in `docs/azure/setup-checklist.md` section 8 and the PRD's cutover runbook (T+45 minutes).

## Why deploys run from a laptop for now

The PRD says Bicep is deployed by GitHub Actions. That needs the Postgres admin password from somewhere, and the options are a GitHub secret or a Key Vault secret that must exist before the first deploy. A GitHub secret breaks the rule that secrets live only in Key Vault. So the first deploy takes the password at the prompt. Once Key Vault exists, the password can be stored there and the deploy can move to Actions. That choice is open; see the decision log.

## Known gaps

- Not compiled or what-if tested. Expect small syntax or property fixes on the first build.
- Container images on GitHub Container Registry are private. Each app and job pulls them with `ghcrToken` (a secure parameter) and `ghcrUsername`. The token sits in the apps' secret store, not Key Vault; see docs/decisions.md (2026-11-24).
- `service` containers and jobs use the same images as the services they host, per the W0 design. `SERVICES`, `JOB` and the `*_URL` variables are assumed names; the application code must read them.
- Cloudflare address ranges are empty, so `web` and `realtime` accept traffic from anywhere until cutover. Pass `cloudflareIpRanges` at cutover.
- Blob containers, the database roles and the five alert rules are not in the templates. The PRD steps 2 and 3 and section "Alerts" cover them.
- The PostgreSQL server uses classic Premium SSD (`Premium_LRS`, P4, 32 GB), set explicitly: Premium SSD v2 refuses Burstable sizes.
