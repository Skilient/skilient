# Media: function tracking sheet (W9)

Date: 2026-11-28. Branch: `azure`. Source: `apps/web/supabase/migrations/` (every migration that creates a storage bucket, a `storage.objects` policy or a cleanup trigger; `20260930000000_phase3_answers.sql` for the cleanup queue), each function at its latest definition on the local stack; the Edge Function logic in `supabase/functions/_shared/storage/cleanup.ts` and `storage-cleanup`.

Every storage rule and SQL function the `media` service inherits, in one of the five bins from "How each function is ported" in `docs/azure/prd.md`, with what replaces it. Read from the local stack's catalogue: `storage.buckets` (13 buckets), `pg_policies` on `storage.objects` (28 policies) and the functions they call, and every function that calls `private.queue_storage_cleanup`.

**Boundary.** Media owns one row per file (bucket, path, uploader, type, size, status), signed upload and download links, the checks other services make before attaching a file, and deleting files their owners let go. It does not decide who may attach a file to a post, a chat, a society or a payment: the owning service does that with the uploader media returns (CheckFiles). Image re-encoding stays in web at the floor (PRD "Platform services"); media checks type, size and path.

## Edge Function logic replaced

| Source | What it did | Replaced by |
| --- | --- | --- |
| `_shared/storage/cleanup.ts` `allowed(bucket, path)` | the buckets and path shapes a delete may name | `pathAllowed` (`src/domain/buckets.ts`), the same shapes per bucket |
| `_shared/storage/cleanup.ts` `runStorageCleanup` | drains pgmq `storage_cleanup` 50 at a time, one delete per bucket, five tries then dropped | `runCleanup` (`src/store/files.ts`), the `storage-cleanup` job |
| `_shared/storage/cleanup.ts` `storageRemover` | Storage REST `DELETE /object/{bucket}` | `Store.remove` (`src/storage/azure.ts` in Azure, `src/storage/memory.ts` in tests) |
| `storage-cleanup/index.ts` | the Edge Function wrapper | deleted: a job inside the warm service |

## Bin 1: reads called by the app

| Function or rule | Caller | Becomes |
| --- | --- | --- |
| `private.storage_usage()` | `/ops/evidence` (staff) | `StorageUsage` (staff role from identity, two-factor) |
| `*_read` / `*_select_own` policies (credentials, cv-exports, feedback, university-claims, event-receipts, society-documents, org-documents, chat-media, post-media, avatars, covers) | `createSignedUrl` in web's data modules | `DownloadLinks`: web gets its user's own private files and any public file; the owning service signs links for the readers it allows (reviewers, thread members, the buyer) |

## Bin 2: commands called by the app

| Function or rule | Caller | Becomes |
| --- | --- | --- |
| `*_insert` policies and the `*_upload_allowed` helpers (`credential_upload_allowed`, `cv_export_upload_allowed`, `feedback_upload_allowed`, `claim_upload_allowed`, `society_doc_upload_allowed`, `society_media_upload_allowed`, `receipt_upload_allowed`, `org_doc_upload_allowed`, `uni_media_writer`, `storage_thread_member`) | browser uploads with the Storage client | `CreateUpload`: the bucket's type and size, the uploader's folder (people's buckets) or the group folder, and each policy's per-folder or per-uploader cap; the membership checks (officer, thread member, buyer, organisation admin, university admin with two-factor, Student Pro for PDF export) move to the owning service when it attaches the file |
| `*_delete` policies (post-media, avatars and covers, chat-media, credentials, feedback, university-media) | the Storage client | none: files go only when their owner lets them go (events below) |
| render job PDFs | credentials' render job | `PutFile` (credentials only) |

## Bin 3: triggers and internal helpers

| Function | Event now | Bucket |
| --- | --- | --- |
| `private.queue_storage_cleanup(bucket, path)` | `release()` (`src/store/files.ts`) | any |
| `private.avatar_cleanup()` | people `profile.image_replaced {kind, old_path}` | avatars, covers |
| `private.post_media_cleanup()`, `private.post_removed_cleanup()` | content `post.removed {media_paths}` | post-media |
| `private.chat_media_cleanup()` | messaging `message.deleted {media_paths}` | chat-media |
| `private.credential_file_cleanup()` | work `credential.changed {deleted, file_removed; file_path}` | credentials |
| `private.society_files_cleanup()`, `private.event_cover_cleanup()`, the receipts' 90-day purge | community `community_file.released {bucket, path}` | society-documents, society-media, event-receipts |
| `cv_exports_daily` (the file half) | credentials `cv_export.released` | cv-exports |
| account deletion (`private.delete_account`'s files) | identity `user.deleted` | every bucket people own (their folder) |
| `private.uni_media_cleanup()` | market (W11) | university-media |
| feedback and university-claims files | trust (W10), market (W11) | feedback, university-claims |
| `private.credential_file_unused`, `private.feedback_file_unused` | not needed: nothing deletes through the client |
| `private.receipt_readable`, `private.society_doc_readable`, `private.org_doc_readable` | the owning services decide and call `DownloadLinks` (community W9 for receipts and proofs, market W11 for organisation documents) |

## Bin 4: scheduled jobs

| pg_cron job | Becomes |
| --- | --- |
| `wake-workers` (storage cleanup's waker) | `storage-cleanup` schedule (every minute) plus a run queued by each release |
| (new) | `media-expire-uploads` (02:17 UTC): upload links never used go after a day |

## Bin 5: wrappers and plumbing (deleted)

`private.wake_storage_cleanup_worker`, pgmq `storage_cleanup` (now `media.deletions`), the Storage API's `storage.objects` table (now `media.files`), `storage.foldername`, and the Edge Function's service-role key.

## Golden cases

`packages/testing/test/media.golden.test.ts` records into `test/golden/media/`: which upload paths each bucket's insert policy accepts for its owner and refuses for another user, which paths each read policy shows to the owner and to another student, the per-folder caps, and the cleanup queue messages the stack's triggers wrote when a photo was replaced, a post and a chat image were deleted and a credential was deleted. Replays: `services/media/test/golden/`.
