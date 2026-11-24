-- Restore drill: Vault secrets are encrypted with the source project's key, so after restoring into another project
-- they don't decrypt. This recreates the ones the system needs to run, with fresh random values, and points
-- project_url at the restored project. Run with psql:
--   psql "$SCRATCH_DB_URL" -v ON_ERROR_STOP=1 -v project_url=https://<scratch-ref>.supabase.co \
--     -v vapid_public_key=<base64url> -v vapid_private_key=<base64url> -f reseed-vault.sql
-- The VAPID pair (web push, PRD 5.34) is an EC key Postgres can't make: `node scripts/restore/vapid-keys.mjs`
-- prints one. Devices subscribed on the source project don't get pushes from the scratch one.
-- Not recreated: GitHub tokens (students reconnect GitHub) and the CV signing key (rotate it: docs/archive/supabase-era/restore-drill.md).
-- Never run this against production: it would change every worker secret and point the workers elsewhere.
select set_config('restore.project_url', :'project_url', false);
select set_config('restore.vapid_public_key', :'vapid_public_key', false);
select set_config('restore.vapid_private_key', :'vapid_private_key', false);

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
  -- Web push (PRD 5.34): a fresh VAPID pair, and the project's own URL as the contact subject.
  if current_setting('restore.vapid_public_key') !~ '^[A-Za-z0-9_-]{87}$' or current_setting('restore.vapid_private_key') !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'vapid_public_key and vapid_private_key must come from scripts/restore/vapid-keys.mjs';
  end if;
  delete from vault.secrets where name in ('vapid_public_key', 'vapid_private_key', 'vapid_subject');
  perform vault.create_secret(current_setting('restore.vapid_public_key'), 'vapid_public_key', 'Recreated by the restore drill');
  perform vault.create_secret(current_setting('restore.vapid_private_key'), 'vapid_private_key', 'Recreated by the restore drill');
  perform vault.create_secret(v_url, 'vapid_subject', 'Recreated by the restore drill');
end;
$$;
