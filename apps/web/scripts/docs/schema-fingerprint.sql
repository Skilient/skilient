-- Catalog-only schema fingerprint. Run with psql -X -v ON_ERROR_STOP=1.
-- Stable names replace OIDs; owners, cron IDs/host/database/user, queue creation times,
-- bucket timestamps and materialized-view contents are deliberately excluded.
-- Function fingerprints cover definitions/configuration, not owner-dependent ACLs.
-- ACLs are read for the generated reference but excluded from hashes to normalize owners.
-- Built-in pg_* and information_schema are system schemas; all others are included.
-- Query 1: per-object fingerprints.
WITH namespaces AS (
  SELECT oid, nspname FROM pg_catalog.pg_namespace
  WHERE nspname !~ '^pg_' AND nspname <> 'information_schema'
), objects AS (
  SELECT 'table'::text AS kind, n.nspname::text AS schema, c.relname::text AS name,
    jsonb_build_object(
      'kind', c.relkind, 'rls', c.relrowsecurity, 'force_rls', c.relforcerowsecurity,
      'partition', pg_catalog.pg_get_partkeydef(c.oid),
      'columns', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'name', a.attname, 'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
        'not_null', a.attnotnull, 'default', pg_catalog.pg_get_expr(d.adbin, d.adrelid),
        'identity', a.attidentity, 'generated', a.attgenerated,
        'collation', CASE WHEN a.attcollation <> 0 THEN a.attcollation::regcollation::text END
      ) ORDER BY a.attnum) FROM pg_catalog.pg_attribute a
      LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped), '[]'::jsonb),
      'constraints', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'name', k.conname, 'definition', pg_catalog.pg_get_constraintdef(k.oid, true),
        'validated', k.convalidated) ORDER BY k.conname)
        FROM pg_catalog.pg_constraint k WHERE k.conrelid = c.oid), '[]'::jsonb),
      'indexes', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'name', ic.relname, 'definition', pg_catalog.pg_get_indexdef(i.indexrelid),
        'valid', i.indisvalid) ORDER BY ic.relname)
        FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class ic ON ic.oid = i.indexrelid
        WHERE i.indrelid = c.oid), '[]'::jsonb)
    ) AS definition
  FROM pg_catalog.pg_class c JOIN namespaces n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p', 'f')
  UNION ALL
  SELECT 'function', n.nspname, p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')',
    jsonb_build_object('definition', pg_catalog.pg_get_functiondef(p.oid),
      'language', l.lanname, 'security_definer', p.prosecdef, 'config', p.proconfig,
      'execute_grants', coalesce((SELECT jsonb_agg(DISTINCT CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE r.rolname END
        ORDER BY CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE r.rolname END)
        FROM pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
        LEFT JOIN pg_catalog.pg_roles r ON r.oid = a.grantee
        WHERE a.privilege_type = 'EXECUTE' AND a.grantee <> p.proowner), '[]'::jsonb))
  FROM pg_catalog.pg_proc p JOIN namespaces n ON n.oid = p.pronamespace
  JOIN pg_catalog.pg_language l ON l.oid = p.prolang WHERE p.prokind IN ('f', 'p')
  UNION ALL
  SELECT 'policy', n.nspname, c.relname || '.' || p.polname,
    jsonb_build_object('command', p.polcmd, 'permissive', p.polpermissive,
      'roles', (SELECT jsonb_agg(CASE WHEN role_oid = 0 THEN 'PUBLIC' ELSE r.rolname END
        ORDER BY CASE WHEN role_oid = 0 THEN 'PUBLIC' ELSE r.rolname END)
        FROM unnest(p.polroles) role_oid LEFT JOIN pg_catalog.pg_roles r ON r.oid = role_oid),
      'using', pg_catalog.pg_get_expr(p.polqual, p.polrelid),
      'with_check', pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid))
  FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid = p.polrelid
  JOIN namespaces n ON n.oid = c.relnamespace
  UNION ALL
  SELECT 'trigger', n.nspname, c.relname || '.' || t.tgname,
    jsonb_build_object('definition', pg_catalog.pg_get_triggerdef(t.oid, true), 'enabled', t.tgenabled)
  FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
  JOIN namespaces n ON n.oid = c.relnamespace WHERE NOT t.tgisinternal
  UNION ALL
  SELECT CASE c.relkind WHEN 'm' THEN 'materialized_view' ELSE 'view' END, n.nspname, c.relname,
    jsonb_build_object('definition', pg_catalog.pg_get_viewdef(c.oid, true), 'options', c.reloptions)
  FROM pg_catalog.pg_class c JOIN namespaces n ON n.oid = c.relnamespace WHERE c.relkind IN ('v', 'm')
  UNION ALL
  SELECT 'enum', n.nspname, t.typname, jsonb_build_object('labels', jsonb_agg(e.enumlabel ORDER BY e.enumsortorder))
  FROM pg_catalog.pg_type t JOIN namespaces n ON n.oid = t.typnamespace
  JOIN pg_catalog.pg_enum e ON e.enumtypid = t.oid GROUP BY n.nspname, t.typname
  UNION ALL
  SELECT 'extension', n.nspname, e.extname, jsonb_build_object('version', e.extversion)
  FROM pg_catalog.pg_extension e JOIN namespaces n ON n.oid = e.extnamespace
  UNION ALL
  SELECT 'cron', 'cron', jobname,
    jsonb_build_object('schedule', schedule, 'command', command, 'active', active)
  FROM cron.job
  UNION ALL
  SELECT 'queue', 'pgmq', queue_name,
    jsonb_build_object('is_partitioned', is_partitioned, 'is_unlogged', is_unlogged)
  FROM pgmq.meta
  UNION ALL
  SELECT 'bucket', 'storage', id,
    jsonb_build_object('name', name, 'public', public, 'file_size_limit', file_size_limit,
      'allowed_mime_types', (SELECT jsonb_agg(m ORDER BY m) FROM unnest(allowed_mime_types) m))
  FROM storage.buckets
)
SELECT kind, schema, name, md5((CASE WHEN kind = 'function' THEN definition - 'execute_grants' ELSE definition END)::text) AS md5 FROM objects ORDER BY kind, schema, name;

-- Query 2: per-kind fingerprints (includes empty categories).
WITH namespaces AS (
  SELECT oid, nspname FROM pg_catalog.pg_namespace
  WHERE nspname !~ '^pg_' AND nspname <> 'information_schema'
), objects AS (
  SELECT 'table'::text AS kind, n.nspname::text AS schema, c.relname::text AS name,
    jsonb_build_object(
      'kind', c.relkind, 'rls', c.relrowsecurity, 'force_rls', c.relforcerowsecurity,
      'partition', pg_catalog.pg_get_partkeydef(c.oid),
      'columns', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'name', a.attname, 'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
        'not_null', a.attnotnull, 'default', pg_catalog.pg_get_expr(d.adbin, d.adrelid),
        'identity', a.attidentity, 'generated', a.attgenerated,
        'collation', CASE WHEN a.attcollation <> 0 THEN a.attcollation::regcollation::text END
      ) ORDER BY a.attnum) FROM pg_catalog.pg_attribute a
      LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped), '[]'::jsonb),
      'constraints', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'name', k.conname, 'definition', pg_catalog.pg_get_constraintdef(k.oid, true),
        'validated', k.convalidated) ORDER BY k.conname)
        FROM pg_catalog.pg_constraint k WHERE k.conrelid = c.oid), '[]'::jsonb),
      'indexes', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'name', ic.relname, 'definition', pg_catalog.pg_get_indexdef(i.indexrelid),
        'valid', i.indisvalid) ORDER BY ic.relname)
        FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class ic ON ic.oid = i.indexrelid
        WHERE i.indrelid = c.oid), '[]'::jsonb)
    ) AS definition
  FROM pg_catalog.pg_class c JOIN namespaces n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p', 'f')
  UNION ALL
  SELECT 'function', n.nspname, p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')',
    jsonb_build_object('definition', pg_catalog.pg_get_functiondef(p.oid),
      'language', l.lanname, 'security_definer', p.prosecdef, 'config', p.proconfig,
      'execute_grants', coalesce((SELECT jsonb_agg(DISTINCT CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE r.rolname END
        ORDER BY CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE r.rolname END)
        FROM pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
        LEFT JOIN pg_catalog.pg_roles r ON r.oid = a.grantee
        WHERE a.privilege_type = 'EXECUTE' AND a.grantee <> p.proowner), '[]'::jsonb))
  FROM pg_catalog.pg_proc p JOIN namespaces n ON n.oid = p.pronamespace
  JOIN pg_catalog.pg_language l ON l.oid = p.prolang WHERE p.prokind IN ('f', 'p')
  UNION ALL
  SELECT 'policy', n.nspname, c.relname || '.' || p.polname,
    jsonb_build_object('command', p.polcmd, 'permissive', p.polpermissive,
      'roles', (SELECT jsonb_agg(CASE WHEN role_oid = 0 THEN 'PUBLIC' ELSE r.rolname END
        ORDER BY CASE WHEN role_oid = 0 THEN 'PUBLIC' ELSE r.rolname END)
        FROM unnest(p.polroles) role_oid LEFT JOIN pg_catalog.pg_roles r ON r.oid = role_oid),
      'using', pg_catalog.pg_get_expr(p.polqual, p.polrelid),
      'with_check', pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid))
  FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid = p.polrelid
  JOIN namespaces n ON n.oid = c.relnamespace
  UNION ALL
  SELECT 'trigger', n.nspname, c.relname || '.' || t.tgname,
    jsonb_build_object('definition', pg_catalog.pg_get_triggerdef(t.oid, true), 'enabled', t.tgenabled)
  FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
  JOIN namespaces n ON n.oid = c.relnamespace WHERE NOT t.tgisinternal
  UNION ALL
  SELECT CASE c.relkind WHEN 'm' THEN 'materialized_view' ELSE 'view' END, n.nspname, c.relname,
    jsonb_build_object('definition', pg_catalog.pg_get_viewdef(c.oid, true), 'options', c.reloptions)
  FROM pg_catalog.pg_class c JOIN namespaces n ON n.oid = c.relnamespace WHERE c.relkind IN ('v', 'm')
  UNION ALL
  SELECT 'enum', n.nspname, t.typname, jsonb_build_object('labels', jsonb_agg(e.enumlabel ORDER BY e.enumsortorder))
  FROM pg_catalog.pg_type t JOIN namespaces n ON n.oid = t.typnamespace
  JOIN pg_catalog.pg_enum e ON e.enumtypid = t.oid GROUP BY n.nspname, t.typname
  UNION ALL
  SELECT 'extension', n.nspname, e.extname, jsonb_build_object('version', e.extversion)
  FROM pg_catalog.pg_extension e JOIN namespaces n ON n.oid = e.extnamespace
  UNION ALL
  SELECT 'cron', 'cron', jobname,
    jsonb_build_object('schedule', schedule, 'command', command, 'active', active)
  FROM cron.job
  UNION ALL
  SELECT 'queue', 'pgmq', queue_name,
    jsonb_build_object('is_partitioned', is_partitioned, 'is_unlogged', is_unlogged)
  FROM pgmq.meta
  UNION ALL
  SELECT 'bucket', 'storage', id,
    jsonb_build_object('name', name, 'public', public, 'file_size_limit', file_size_limit,
      'allowed_mime_types', (SELECT jsonb_agg(m ORDER BY m) FROM unnest(allowed_mime_types) m))
  FROM storage.buckets
), kinds(kind) AS (
  VALUES ('table'), ('function'), ('policy'), ('trigger'), ('view'),
    ('materialized_view'), ('enum'), ('extension'), ('cron'), ('queue'), ('bucket')
)
SELECT k.kind, md5(coalesce(string_agg(jsonb_build_array(o.schema, o.name, md5((CASE WHEN o.kind = 'function' THEN o.definition - 'execute_grants' ELSE o.definition END)::text))::text,
  E'\n' ORDER BY o.schema, o.name), '')) AS md5
FROM kinds k LEFT JOIN objects o ON o.kind = k.kind GROUP BY k.kind ORDER BY k.kind;
