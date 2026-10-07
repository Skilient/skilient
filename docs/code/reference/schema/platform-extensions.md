Generated, do not edit.
Commit: 7d26258
Covers: supabase/migrations/, local database catalogs

# platform-extensions

## extension: extensions.pg_jsonschema

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "version": "0.3.3"
}
```

## extension: extensions.pg_net

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "version": "0.20.4"
}
```

## extension: extensions.pg_stat_statements

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "version": "1.11"
}
```

## extension: extensions.pg_trgm

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "version": "1.6"
}
```

## extension: extensions.pgcrypto

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "version": "1.3"
}
```

## extension: extensions.uuid-ossp

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "version": "1.1"
}
```

## extensions.armor(bytea)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.armor(bytea) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.armor(bytea, text[], text[])

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.armor(bytea, text[], text[]) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.crypt(text, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.crypt(text, text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.dearmor(text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.dearmor(text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.decrypt(bytea, bytea, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.decrypt(bytea, bytea, text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.decrypt_iv(bytea, bytea, bytea, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.decrypt_iv(bytea, bytea, bytea, text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.digest(bytea, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.digest(bytea, text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.digest(text, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.digest(text, text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.encrypt(bytea, bytea, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.encrypt(bytea, bytea, text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.encrypt_iv(bytea, bytea, bytea, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.encrypt_iv(bytea, bytea, bytea, text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.gen_random_bytes(integer)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.gen_random_bytes(integer) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.gen_random_uuid()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.gen_random_uuid() | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.gen_salt(text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.gen_salt(text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.gen_salt(text, integer)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.gen_salt(text, integer) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.gin_extract_query_trgm(text, internal, smallint, internal, internal, internal, internal)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.gin_extract_query_trgm(text, internal, smallint, internal, internal, internal, internal) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.gin_extract_value_trgm(text, internal)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.gin_extract_value_trgm(text, internal) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.gin_trgm_consistent(internal, smallint, text, integer, internal, internal, internal, internal)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.gin_trgm_consistent(internal, smallint, text, integer, internal, internal, internal, internal) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.gin_trgm_triconsistent(internal, smallint, text, integer, internal, internal, internal)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.gin_trgm_triconsistent(internal, smallint, text, integer, internal, internal, internal) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.grant_pg_cron_access()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.grant_pg_cron_access() | plpgsql | false | (session default) | PUBLIC, dashboard_user | (platform/extension) |

## extensions.grant_pg_graphql_access()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.grant_pg_graphql_access() | plpgsql | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.grant_pg_net_access()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.grant_pg_net_access() | plpgsql | false | (session default) | PUBLIC, dashboard_user | (platform/extension) |

## extensions.gtrgm_compress(internal)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.gtrgm_compress(internal) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.gtrgm_consistent(internal, text, smallint, oid, internal)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.gtrgm_consistent(internal, text, smallint, oid, internal) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.gtrgm_decompress(internal)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.gtrgm_decompress(internal) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.gtrgm_distance(internal, text, smallint, oid, internal)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.gtrgm_distance(internal, text, smallint, oid, internal) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.gtrgm_in(cstring)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.gtrgm_in(cstring) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.gtrgm_options(internal)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.gtrgm_options(internal) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.gtrgm_out(gtrgm)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.gtrgm_out(gtrgm) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.gtrgm_penalty(internal, internal, internal)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.gtrgm_penalty(internal, internal, internal) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.gtrgm_picksplit(internal, internal)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.gtrgm_picksplit(internal, internal) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.gtrgm_same(gtrgm, gtrgm, internal)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.gtrgm_same(gtrgm, gtrgm, internal) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.gtrgm_union(internal, internal)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.gtrgm_union(internal, internal) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.hmac(bytea, bytea, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.hmac(bytea, bytea, text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.hmac(text, text, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.hmac(text, text, text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.json_matches_schema(schema json, instance json)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.json_matches_schema(schema json, instance json) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.jsonb_matches_schema(schema json, instance jsonb)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.jsonb_matches_schema(schema json, instance jsonb) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.jsonschema_is_valid(schema json)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.jsonschema_is_valid(schema json) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.jsonschema_validation_errors(schema json, instance json)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.jsonschema_validation_errors(schema json, instance json) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) | c | false | (session default) | postgres | (platform/extension) |

## extensions.pgp_armor_headers(text, OUT key text, OUT value text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.pgp_armor_headers(text, OUT key text, OUT value text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.pgp_key_id(bytea)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.pgp_key_id(bytea) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.pgp_pub_decrypt(bytea, bytea)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.pgp_pub_decrypt(bytea, bytea) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.pgp_pub_decrypt(bytea, bytea, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.pgp_pub_decrypt(bytea, bytea, text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.pgp_pub_decrypt(bytea, bytea, text, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.pgp_pub_decrypt(bytea, bytea, text, text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.pgp_pub_decrypt_bytea(bytea, bytea)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.pgp_pub_decrypt_bytea(bytea, bytea) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.pgp_pub_decrypt_bytea(bytea, bytea, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.pgp_pub_encrypt(text, bytea)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.pgp_pub_encrypt(text, bytea) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.pgp_pub_encrypt(text, bytea, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.pgp_pub_encrypt(text, bytea, text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.pgp_pub_encrypt_bytea(bytea, bytea)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.pgp_pub_encrypt_bytea(bytea, bytea) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.pgp_pub_encrypt_bytea(bytea, bytea, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.pgp_sym_decrypt(bytea, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.pgp_sym_decrypt(bytea, text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.pgp_sym_decrypt(bytea, text, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.pgp_sym_decrypt(bytea, text, text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.pgp_sym_decrypt_bytea(bytea, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.pgp_sym_decrypt_bytea(bytea, text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.pgp_sym_decrypt_bytea(bytea, text, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.pgp_sym_decrypt_bytea(bytea, text, text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.pgp_sym_encrypt(text, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.pgp_sym_encrypt(text, text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.pgp_sym_encrypt(text, text, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.pgp_sym_encrypt(text, text, text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.pgp_sym_encrypt_bytea(bytea, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.pgp_sym_encrypt_bytea(bytea, text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.pgp_sym_encrypt_bytea(bytea, text, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.pgp_sym_encrypt_bytea(bytea, text, text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.pgrst_ddl_watch()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.pgrst_ddl_watch() | plpgsql | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.pgrst_drop_watch()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.pgrst_drop_watch() | plpgsql | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.set_graphql_placeholder()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.set_graphql_placeholder() | plpgsql | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.set_limit(real)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.set_limit(real) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.show_limit()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.show_limit() | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.show_trgm(text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.show_trgm(text) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.similarity(text, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.similarity(text, text) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.similarity_dist(text, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.similarity_dist(text, text) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.similarity_op(text, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.similarity_op(text, text) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.strict_word_similarity(text, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.strict_word_similarity(text, text) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.strict_word_similarity_commutator_op(text, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.strict_word_similarity_commutator_op(text, text) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.strict_word_similarity_dist_commutator_op(text, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.strict_word_similarity_dist_commutator_op(text, text) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.strict_word_similarity_dist_op(text, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.strict_word_similarity_dist_op(text, text) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.strict_word_similarity_op(text, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.strict_word_similarity_op(text, text) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.uuid_generate_v1()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.uuid_generate_v1() | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.uuid_generate_v1mc()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.uuid_generate_v1mc() | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.uuid_generate_v3(namespace uuid, name text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.uuid_generate_v3(namespace uuid, name text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.uuid_generate_v4()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.uuid_generate_v4() | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.uuid_generate_v5(namespace uuid, name text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.uuid_generate_v5(namespace uuid, name text) | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.uuid_nil()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.uuid_nil() | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.uuid_ns_dns()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.uuid_ns_dns() | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.uuid_ns_oid()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.uuid_ns_oid() | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.uuid_ns_url()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.uuid_ns_url() | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.uuid_ns_x500()

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.uuid_ns_x500() | c | false | (session default) | PUBLIC, dashboard_user, postgres | (platform/extension) |

## extensions.word_similarity(text, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.word_similarity(text, text) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.word_similarity_commutator_op(text, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.word_similarity_commutator_op(text, text) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.word_similarity_dist_commutator_op(text, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.word_similarity_dist_commutator_op(text, text) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.word_similarity_dist_op(text, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.word_similarity_dist_op(text, text) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## extensions.word_similarity_op(text, text)

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |
| --- | --- | --- | --- | --- | --- |
| extensions.word_similarity_op(text, text) | c | false | (session default) | PUBLIC, postgres | (platform/extension) |

## view: extensions.pg_stat_statements

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "options": null,
  "definition": " SELECT userid,\n    dbid,\n    toplevel,\n    queryid,\n    query,\n    plans,\n    total_plan_time,\n    min_plan_time,\n    max_plan_time,\n    mean_plan_time,\n    stddev_plan_time,\n    calls,\n    total_exec_time,\n    min_exec_time,\n    max_exec_time,\n    mean_exec_time,\n    stddev_exec_time,\n    rows,\n    shared_blks_hit,\n    shared_blks_read,\n    shared_blks_dirtied,\n    shared_blks_written,\n    local_blks_hit,\n    local_blks_read,\n    local_blks_dirtied,\n    local_blks_written,\n    temp_blks_read,\n    temp_blks_written,\n    shared_blk_read_time,\n    shared_blk_write_time,\n    local_blk_read_time,\n    local_blk_write_time,\n    temp_blk_read_time,\n    temp_blk_write_time,\n    wal_records,\n    wal_fpi,\n    wal_bytes,\n    jit_functions,\n    jit_generation_time,\n    jit_inlining_count,\n    jit_inlining_time,\n    jit_optimization_count,\n    jit_optimization_time,\n    jit_emission_count,\n    jit_emission_time,\n    jit_deform_count,\n    jit_deform_time,\n    stats_since,\n    minmax_stats_since\n   FROM pg_stat_statements(true) pg_stat_statements(userid, dbid, toplevel, queryid, query, plans, total_plan_time, min_plan_time, max_plan_time, mean_plan_time, stddev_plan_time, calls, total_exec_time, min_exec_time, max_exec_time, mean_exec_time, stddev_exec_time, rows, shared_blks_hit, shared_blks_read, shared_blks_dirtied, shared_blks_written, local_blks_hit, local_blks_read, local_blks_dirtied, local_blks_written, temp_blks_read, temp_blks_written, shared_blk_read_time, shared_blk_write_time, local_blk_read_time, local_blk_write_time, temp_blk_read_time, temp_blk_write_time, wal_records, wal_fpi, wal_bytes, jit_functions, jit_generation_time, jit_inlining_count, jit_inlining_time, jit_optimization_count, jit_optimization_time, jit_emission_count, jit_emission_time, jit_deform_count, jit_deform_time, stats_since, minmax_stats_since);"
}
```

## view: extensions.pg_stat_statements_info

[src: scripts/docs/schema-fingerprint.sql#pg_catalog]

```json
{
  "options": null,
  "definition": " SELECT dealloc,\n    stats_reset\n   FROM pg_stat_statements_info() pg_stat_statements_info(dealloc, stats_reset);"
}
```
