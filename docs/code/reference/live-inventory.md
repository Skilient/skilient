Commit: 7d26258
Covers: supabase/functions/, supabase/config.toml, .env.example, scripts/restore/reseed-vault.sql

# Production inventory

Checked 7 October 2026 (Asia/Karachi). Sanitized MCP observations are in [stage-2-catalog.json](stage-2-catalog.json); the capture contains names and catalog metadata only. [src: docs/code/reference/stage-2-catalog.json#checked_on]

## Edge Functions

| Name | Version | JWT verification | Last update (UTC) | Local entry point |
| --- | --- | --- | --- | --- |
| github-link | 64 | false | 2026-10-04T13:44:06.600Z | supabase/functions/github-link/index.ts |
| github-worker | 64 | false | 2026-10-04T13:44:06.600Z | supabase/functions/github-worker/index.ts |
| notify-worker | 49 | false | 2026-10-04T13:44:06.600Z | supabase/functions/notify-worker/index.ts |
| link-preview | 47 | false | 2026-10-04T13:44:06.600Z | supabase/functions/link-preview/index.ts |
| storage-cleanup | 38 | false | 2026-10-04T13:44:06.600Z | supabase/functions/storage-cleanup/index.ts |
| code-check | 34 | false | 2026-10-04T13:44:06.600Z | supabase/functions/code-check/index.ts |
| cv-sign | 30 | false | 2026-10-04T13:44:06.600Z | supabase/functions/cv-sign/index.ts |
| competition-freeze | 24 | false | 2026-10-04T13:44:06.600Z | supabase/functions/competition-freeze/index.ts |
| webhook-worker | 24 | false | 2026-10-04T13:44:06.600Z | supabase/functions/webhook-worker/index.ts |
| billing-worker | 22 | false | 2026-10-04T13:44:06.600Z | supabase/functions/billing-worker/index.ts |
| analytics-worker | 9 | false | 2026-10-04T13:44:06.600Z | supabase/functions/analytics-worker/index.ts |

No production-only or repository-only function names were found. All 11 deployed functions are ACTIVE; all report JWT verification disabled, matching the function configuration. Deployment versions and update times are inventory metadata, not proof that deployed source equals repository source. [src: docs/code/reference/stage-2-catalog.json#edge_functions] [src: supabase/config.toml#verify_jwt]

## Vault secret names

- `analytics_worker_secret`
- `billing_worker_secret`
- `competition_freeze_secret`
- `cv_export_secret`
- `cv_signing_key:cv-20260930-6ec51b99`
- `cv_worker_secret`
- `github_worker_secret`
- `link_preview_worker_secret`
- `notify_worker_secret`
- `project_url`
- `storage_cleanup_worker_secret`
- `webhook_worker_secret`

Two additional secret entries have no name. No secret values, descriptions, IDs, or decrypted-secret rows were read. [src: docs/code/reference/stage-2-catalog.json#vault_secret_names]

All 11 names required by the restore drill are present. The additional named entry is the CV signing key name. Names establish presence only; they do not establish validity or decryptability. [src: scripts/restore/verify.mjs#REQUIRED_SECRETS] [src: docs/code/reference/stage-2-catalog.json#cv_signing_key]

Vault worker-secret names are database configuration, distinct from Edge Function environment names. The restore script lists worker secrets and project_url; .env.example exposes CV_EXPORT_SECRET for the application. [src: scripts/restore/reseed-vault.sql#v_name] [src: .env.example#CV_EXPORT_SECRET]

## Function secrets and environment-name comparison

**Unverified:** the connected Supabase MCP does not expose an operation to list function secrets. No alternate production access was used. This is an outstanding Stage 2 check, not a finding that secrets are missing. [src: docs/code/reference/stage-2-catalog.json#function_secret_names]

The following names are read by Edge Function code but are absent from .env.example. Presence in production is unverified. Some are platform-provided or have defaults; absence from the template alone is not a runtime failure. [src: .env.example#Names only]

| Name | Read site |
| --- | --- |
| APP_URL | [src: supabase/functions/_shared/notify/worker.ts#APP_URL] |
| BILLING_PRODUCTION | [src: supabase/functions/billing-worker/index.ts#BILLING_PRODUCTION] |
| GITHUB_API_URL | [src: supabase/functions/_shared/github/types.ts#GITHUB_API_URL] |
| GITHUB_READ_TOKEN | [src: supabase/functions/competition-freeze/index.ts#GITHUB_READ_TOKEN] |
| GITHUB_WEB_URL | [src: supabase/functions/_shared/github/types.ts#GITHUB_WEB_URL] |
| POSTHOG_API_HOST | [src: supabase/functions/_shared/analytics/worker.ts#POSTHOG_API_HOST] |
| POSTHOG_HOST | [src: supabase/functions/_shared/analytics/worker.ts#POSTHOG_HOST] |
| POSTHOG_PROJECT_ID | [src: supabase/functions/_shared/analytics/worker.ts#POSTHOG_PROJECT_ID] |
| POSTHOG_PROJECT_KEY | [src: supabase/functions/_shared/analytics/worker.ts#POSTHOG_PROJECT_KEY] |
| RESEND_API_URL | [src: supabase/functions/_shared/notify/worker.ts#RESEND_API_URL] |
| SITE_URL | [src: supabase/functions/billing-worker/index.ts#SITE_URL] |
| SUPABASE_ANON_KEY | [src: supabase/functions/code-check/index.ts#SUPABASE_ANON_KEY] |
| SUPABASE_DB_URL | [src: supabase/functions/github-worker/index.ts#SUPABASE_DB_URL] |
| SUPABASE_URL | [src: supabase/functions/storage-cleanup/index.ts#SUPABASE_URL] |

## Advisor findings

These are the advisor's observations, not fixes or independent diagnoses. Full per-object details are recorded in the sanitized capture. [src: docs/code/reference/stage-2-catalog.json#advisors]

| Type | Finding | Level | Count | Remediation |
| --- | --- | --- | --- | --- |
| security | rls_enabled_no_policy | INFO | 96 | [Supabase guide](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) |
| security | auth_leaked_password_protection | WARN | 1 | [Supabase guide](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) |
| performance | unindexed_foreign_keys | INFO | 38 | [Supabase guide](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) |
| performance | no_primary_key | INFO | 3 | [Supabase guide](https://supabase.com/docs/guides/database/database-linter?lint=0004_no_primary_key) |
| performance | unused_index | INFO | 222 | [Supabase guide](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) |

No production changes were made. [src: docs/code/reference/stage-2-catalog.json#production_changed]
