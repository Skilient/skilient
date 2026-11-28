-- media: one row per file with its bucket, path, uploader, type and size (storage.objects on the stack), and the
-- queue of files to delete (pgmq storage_cleanup, fed by the stack's cleanup triggers; now by other services'
-- events). Ported from the storage buckets and policies of every migration that made one, and
-- 20260930000000_phase3_answers.sql (storage cleanup). Forward-only. Every table: row-level security enabled and
-- forced, one policy for the owning role (docs/azure/prd.md, "Layout"). No foreign keys to other services' data.

-- status: pending (an upload link was made), stored (confirmed in the store), released (its owner let it go; the
-- delete is queued), deleted (gone from the store). Rows stay after deletion so a path is never reused.
create table media.files (
  bucket text not null check (bucket ~ '^[a-z][a-z-]{2,30}$'),
  path text not null check (char_length(path) <= 200 and path ~ '^[0-9a-f-]{36}/([0-9a-f-]{36}/)?[0-9a-f-]{36}\.(webp|pdf)$'),
  -- The first folder (the registration's two for receipts): what the per-folder caps count.
  folder text not null,
  owner_id uuid,
  mime text not null check (mime in ('image/webp', 'application/pdf')),
  max_bytes integer not null check (max_bytes > 0),
  bytes integer check (bytes is null or bytes >= 0),
  status text not null default 'pending' check (status in ('pending', 'stored', 'released', 'deleted')),
  created_at timestamptz not null default now(),
  upload_expires_at timestamptz,
  stored_at timestamptz,
  released_at timestamptz,
  deleted_at timestamptz,
  primary key (bucket, path)
);
create index files_owner_idx on media.files (owner_id) where status in ('pending', 'stored');
create index files_folder_idx on media.files (bucket, folder) where status in ('pending', 'stored');
create index files_pending_idx on media.files (upload_expires_at) where status = 'pending';

-- Files to delete from the store. A failed delete is retried a minute later; after 5 tries it is dropped and
-- logged (runStorageCleanup).
create table media.deletions (
  id bigint generated always as identity primary key,
  bucket text not null,
  path text not null,
  attempts smallint not null default 0,
  not_before timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index deletions_due_idx on media.deletions (not_before);

alter table media.files enable row level security;
alter table media.files force row level security;
create policy files_owner on media.files for all to svc_media using (true) with check (true);
grant select, insert, update on media.files to svc_media;

alter table media.deletions enable row level security;
alter table media.deletions force row level security;
create policy deletions_owner on media.deletions for all to svc_media using (true) with check (true);
grant select, insert, update, delete on media.deletions to svc_media;
