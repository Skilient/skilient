-- Shared Postgres extensions (decision 2026-11-25, advisor, W2 Q6). An extension lives in one schema per
-- database, so the ones services use live in `extensions`, reachable by every service role through `svc`
-- (docs/azure/prd.md, "Extensions kept"). Services call them qualified, e.g. `extensions.similarity(a, b)`.
-- On Azure the server must allow-list them (deploy/modules/data.bicep, `azure.extensions`). Forward-only.
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists btree_gin with schema extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to svc;
