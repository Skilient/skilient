-- Prints SQL that re-creates our objects on Supabase-managed schemas, which `supabase db dump` leaves out: access
-- policies on storage and realtime tables (Storage buckets, private Realtime channels) and triggers on auth, storage
-- and realtime tables whose function is ours (public or private). Supabase's own policies and triggers there are made
-- by the platform. Run with psql -At against production; the restore drill applies the output on scratch.
select format('drop policy if exists %I on %I.%I; create policy %I on %I.%I as %s for %s to %s%s%s;',
       policyname, schemaname, tablename, policyname, schemaname, tablename, permissive, cmd,
       (select string_agg(case when r = 'public' then 'public' else quote_ident(r) end, ', ') from unnest(roles) r),
       coalesce(' using (' || qual || ')', ''),
       coalesce(' with check (' || with_check || ')', ''))
  from pg_policies
 where schemaname in ('storage', 'realtime')
union all
select format('drop trigger if exists %I on %I.%I; %s;', t.tgname, n.nspname, c.relname, pg_get_triggerdef(t.oid))
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  join pg_namespace pn on pn.oid = p.pronamespace
 where not t.tgisinternal
   and n.nspname in ('auth', 'storage', 'realtime')
   and pn.nspname in ('public', 'private');
