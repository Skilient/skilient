Commit: 7d26258
Covers: supabase/migrations/, supabase/functions/, scripts/docs/schema-fingerprint.sql, production catalogs

# Schema and production drift

Checked 7 October 2026 (Asia/Karachi). Newest production migration: **20261104000000_analytics**. Production has 58 migration versions and the repository has 59. [src: docs/code/reference/stage-2-catalog.json#migrations] [src: supabase/migrations/20261105000000_alerts.sql#alert_limit]

Stage 2 remains incomplete only for the production function-secret name inventory: the connected MCP exposes no list-secrets operation. That check is unverified, not "none found". The remaining catalog and inventory checks below were completed. [src: docs/code/reference/stage-2-catalog.json#function_secret_names]

## Method and reproducibility

The local stack was started and reset from all repository migrations and the seed. Temporary local ports 55320–55329 and inspector port 8183 avoided another project's port bindings; the tracked config was restored after the run. The generator queries only the local Docker database with psql. [src: scripts/docs/gen-schema-ref.mjs#container]

Run `pnpm db:start && pnpm db:reset`, then `node scripts/docs/gen-schema-ref.mjs --snapshot /tmp/skilient-catalog.json`. The optional snapshot writes local full definitions and the results of both fingerprint queries alongside it. Generated schema pages are overwritten. [src: package.json#db:reset] [src: scripts/docs/gen-schema-ref.mjs#--snapshot]

Both fingerprint queries were run locally with psql and on production through MCP. Per-kind hashes determined which kinds needed per-object comparison. Full definitions were then retrieved for every differing object that exists on each side. The final production per-kind and per-object hashes came from one SQL statement snapshot; Realtime created a daily partition during the earlier capture, so the final capture supersedes the earlier counts. Definitions for all 39 differences are in [drift-details.json](drift-details.json). [src: docs/code/reference/stage-2-catalog.json#per_kind] [src: docs/code/reference/drift-details.json#objects]

OIDs and owners are not serialized. Cron IDs, host/database/user, queue creation times and bucket timestamps are excluded. Function hashes omit owner-dependent EXECUTE ACLs; generated pages retain the local non-owner grantees. System pg_* schemas and information_schema are excluded. Internal constraint triggers are represented by table constraints rather than unstable generated trigger names. These normalizations do not suppress differing function bodies, security-definer flags or search_path settings. [src: scripts/docs/schema-fingerprint.sql#Function fingerprints] [src: scripts/docs/schema-fingerprint.sql#tgisinternal]

## Per-kind comparison

| Kind | Local objects | Production objects | Result | Local MD5 | Production MD5 |
| --- | --- | --- | --- | --- | --- |
| bucket | 10 | 10 | none found | 8da6679c519475687982c5ef6a5efb9d | 8da6679c519475687982c5ef6a5efb9d |
| cron | 47 | 45 | differs | 8127fd0db65b78f9190a5a68860cb46a | 024171044a8ab05c0097e323083f361b |
| enum | 80 | 80 | none found | 24eb72fa64a2548921e78e8ff480ae99 | 24eb72fa64a2548921e78e8ff480ae99 |
| extension | 8 | 8 | none found | 567059a9a98e06e1b181a286eef3c13d | 567059a9a98e06e1b181a286eef3c13d |
| function | 1709 | 1701 | differs | cfd35b955dab7ecec77b7dba542ff6e6 | f8cf70075e5578af86fa1ed9dd5c7914 |
| materialized_view | 3 | 3 | none found | a9c11074882a2968e26d368b6cbeff95 | a9c11074882a2968e26d368b6cbeff95 |
| policy | 137 | 137 | none found | 825e18b441afb1dd0c9ee9c73e541d9b | 825e18b441afb1dd0c9ee9c73e541d9b |
| queue | 8 | 8 | none found | 4096c74995895abd774dd52978b8f732 | 4096c74995895abd774dd52978b8f732 |
| table | 281 | 272 | differs | 9d5d68148045fb176b284159a79dbb1b | 297ee8b32c67d92e68b97d6aa4ef6af0 |
| trigger | 157 | 157 | none found | 42a654e668cd8142aabe493fe3cc4428 | 42a654e668cd8142aabe493fe3cc4428 |
| view | 4 | 4 | none found | c76a451a93f162ca8ada3bf5325aff36 | c76a451a93f162ca8ada3bf5325aff36 |

Hash results and counts are captured in the inventory evidence. [src: docs/code/reference/stage-2-catalog.json#local_per_kind]

## Migration history

The only repository version absent from production is **20261105000000_alerts.sql**. No production-only migration versions or name mismatches were found among the 58 shared versions. Version/name comparison does not prove that previously applied migration file contents are identical. No migrations were applied to production. [src: docs/code/reference/stage-2-catalog.json#migrations] [src: supabase/migrations/20261105000000_alerts.sql#job-watchdog]

## Tables: 16 differences

Local-only application tables: private.alert_state, private.service_signals and private.web_vitals, all created by the unapplied alerts migration. [src: supabase/migrations/20261105000000_alerts.sql#alert_state] [src: supabase/migrations/20261105000000_alerts.sql#service_signals] [src: supabase/migrations/20261105000000_alerts.sql#web_vitals] [src: docs/code/reference/drift-details.json#private]

Local-only platform tables: _realtime.extensions, _realtime.feature_flags, _realtime.schema_migrations, _realtime.tenants, storage.iceberg_namespaces, storage.iceberg_tables, supabase_functions.hooks, supabase_functions.migrations and supabase_migrations.seed_files. Production-only platform tables: realtime.messages_2026_10_03, realtime.messages_2026_10_04 and realtime.messages_2026_10_05. These names and their definitions are recorded without querying their rows. [src: docs/code/reference/drift-details.json#_realtime] [src: docs/code/reference/drift-details.json#iceberg_namespaces] [src: docs/code/reference/drift-details.json#supabase_functions] [src: docs/code/reference/drift-details.json#messages_2026_10_03]

The shared auth.users table has four production-only indexes: idx_users_created_at_desc, idx_users_email, idx_users_last_sign_in_at_desc and idx_users_name. No column, constraint or RLS-flag difference was found for that table. [src: docs/code/reference/drift-details.json#idx_users_created_at_desc] [src: docs/code/reference/drift-details.json#idx_users_name]

## Functions: 21 differences

Nine local-only application functions come from the unapplied alerts migration: private.alert_conditions, private.alert_limit, private.job_watchdog, private.purge_monitoring, private.queue_alert_email, private.record_service_signal, private.record_web_vitals and their two public.record_* wrappers. [src: supabase/migrations/20261105000000_alerts.sql#alert_conditions] [src: supabase/migrations/20261105000000_alerts.sql#record_web_vitals] [src: docs/code/reference/drift-details.json#alert_conditions]

One platform function exists only locally: supabase_functions.http_request. Two exist only in production: realtime.list_changes_sync and realtime.settled_changes. [src: docs/code/reference/drift-details.json#http_request] [src: docs/code/reference/drift-details.json#list_changes_sync] [src: docs/code/reference/drift-details.json#settled_changes]

Nine shared platform functions have differing definitions or configuration:

| Function | Difference |
| --- | --- |
| extensions.grant_pg_cron_access | Production has empty search_path; local omits it. Local REVOKE includes CASCADE. |
| extensions.grant_pg_graphql_access | Production has empty search_path and a pg_catalog-qualified event-trigger catalog call. |
| extensions.grant_pg_net_access | Production has empty search_path, creates the helper role conditionally, and limits legacy function ALTER/GRANT logic by extension version. Local applies that logic unconditionally. |
| extensions.pgrst_ddl_watch | Production has empty search_path; local omits it. |
| extensions.pgrst_drop_watch | Production has empty search_path; local omits it. |
| extensions.set_graphql_placeholder | Production sets empty search_path on both the event-trigger function and the generated placeholder; local omits it. |
| net.http_get | Local is SECURITY DEFINER with search_path=net; production is SECURITY INVOKER with no function search_path. |
| net.http_post | Local is SECURITY DEFINER with search_path=net; production is SECURITY INVOKER with no function search_path. |
| pgbouncer.get_auth | Function-body formatting/case differs; the catalog records identical signature, language, security-definer flag and configuration. |

Each row is supported by the side-by-side full definitions, not by an inference about which deployment is preferable. [src: docs/code/reference/drift-details.json#grant_pg_cron_access] [src: docs/code/reference/drift-details.json#grant_pg_graphql_access] [src: docs/code/reference/drift-details.json#grant_pg_net_access] [src: docs/code/reference/drift-details.json#pgrst_ddl_watch] [src: docs/code/reference/drift-details.json#pgrst_drop_watch] [src: docs/code/reference/drift-details.json#set_graphql_placeholder] [src: docs/code/reference/drift-details.json#http_get] [src: docs/code/reference/drift-details.json#http_post] [src: docs/code/reference/drift-details.json#get_auth]

The initial expanded fingerprint also found owner-dependent EXECUTE ACL differences on extension functions. Their bodies matched; those ACLs are excluded from the final hashes because owners differ between local and hosted installations. This exclusion is part of the fingerprint contract, not a privilege-equivalence assertion. [src: scripts/docs/schema-fingerprint.sql#owner-dependent ACLs]

## Cron: 2 differences

Local-only jobs: job-watchdog (`*/10 * * * *`, `select private.job_watchdog()`) and purge-monitoring (`43 3 * * *`, `select private.purge_monitoring()`). No shared cron definitions differ after normalization. [src: docs/code/reference/drift-details.json#job-watchdog] [src: docs/code/reference/drift-details.json#purge-monitoring]

## Policies, triggers, views, materialized views, enums, extensions, queues and buckets

None found in each of these eight categories: their per-kind hashes match. This statement concerns catalog definitions and permitted metadata, not application rows or stored files. [src: docs/code/reference/stage-2-catalog.json#per_kind]

## Edge Functions, secrets and advisors

No Edge Function name or JWT-verification configuration differences found. Deployment versions and update times are recorded in [live-inventory.md](live-inventory.md); deployed source equivalence was not checked. [src: docs/code/reference/stage-2-catalog.json#edge_functions] [src: supabase/config.toml#verify_jwt]

No required restore-drill Vault secret names are missing. The capture has one additional named signing-key entry and two unnamed entries. Function-secret names remain unverified because the MCP has no listing operation. [src: docs/code/reference/stage-2-catalog.json#vault_secret_names] [src: scripts/restore/verify.mjs#REQUIRED_SECRETS] [src: docs/code/reference/stage-2-catalog.json#function_secret_names]

Fourteen names read by Edge Function code are absent from .env.example; their read sites are listed in the inventory. The advisors reported 96 RLS-without-policy notices, 1 leaked-password-protection warning, 38 unindexed-foreign-key notices, 3 no-primary-key notices and 222 unused-index notices. These findings were recorded without changing production. [src: docs/code/reference/live-inventory.md#APP_URL] [src: docs/code/reference/stage-2-catalog.json#advisors]

## Production safety

No production migrations, deployments, setting changes or row writes were performed. Production SQL read catalogs and the explicitly requested metadata: cron.job, pgmq.meta, storage.buckets, supabase_migrations.schema_migrations and Vault names only. No application-table rows or vault.decrypted_secrets rows were read. [src: docs/code/reference/stage-2-catalog.json#production_changed]
