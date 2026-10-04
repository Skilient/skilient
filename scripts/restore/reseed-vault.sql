-- Restore drill: Vault secrets are encrypted with the source project's key, so after restoring into another project
-- they don't decrypt. This recreates the ones the system needs to run, with fresh random values, and points
-- project_url at the restored project. Run with psql:
--   psql "$SCRATCH_DB_URL" -v ON_ERROR_STOP=1 -v project_url=https://<scratch-ref>.supabase.co -f reseed-vault.sql
-- Not recreated: GitHub tokens (students reconnect GitHub) and the CV signing key (rotate it: docs/restore-drill.md).
-- Never run this against production: it would change every worker secret and point the workers elsewhere.
select set_config('restore.project_url', :'project_url', false);

do $$
declare
  v_name text;
  v_url text := current_setting('restore.project_url');
begin
  if v_url !~ '^https://[a-z0-9]+\.supabase\.co$' then
    raise exception 'project_url must look like https://<ref>.supabase.co, got %', v_url;
  end if;
  foreach v_name in array array[
    'cv_export_secret', 'github_worker_secret', 'notify_worker_secret', 'link_preview_worker_secret',
    'storage_cleanup_worker_secret', 'cv_worker_secret', 'webhook_worker_secret', 'competition_freeze_secret',
    'billing_worker_secret', 'analytics_worker_secret'
  ] loop
    delete from vault.secrets where name = v_name;
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), v_name, 'Recreated by the restore drill');
  end loop;
  delete from vault.secrets where name = 'project_url';
  perform vault.create_secret(v_url, 'project_url', 'Recreated by the restore drill');
end;
$$;
