# W9 `media`: status

Updated 2026-11-28, branch `azure`. One line per W9 item, with the evidence that ticks it. Format as `docs/azure/credentials-status.md`.

The W9 done-when is the PRD's build-plan row: "Email, push and digest tests pass with the fake Brevo and push services; unused files are deleted". The file half is this file; the email and push half is `docs/azure/notify-status.md`. Storage in tests is an in-memory store behind media's `Store` port (decisions.md, W9).

Status values: **ticked** (evidence exists), **partial** (part ticked, the rest named), **pending Ahmed** (a decision or sign-off).

| # | Item | Evidence | Date | Status |
| --- | --- | --- | --- | --- |
| 1 | Tracking sheet | `docs/azure/media-function-bins.md`: the 13 buckets, the 28 storage.objects policies and their helper functions, and every cleanup trigger, by bin, with what replaces each; the storage-cleanup Edge Function's logic | 2026-11-28 | ticked |
| 2 | Goldens recorded on the local stack, stable | `packages/testing/test/media.golden.test.ts` → `test/golden/media/{uploads,reads,cleanup}.json`: 4 cases (each people-owned bucket's own-folder and others'-folder uploads, a wrong type, the per-folder caps; owner and other-student reads of six buckets; the cleanup queue after a replaced photo, a deleted post and a deleted credential), recorded and compared three more times | 2026-11-28 | ticked |
| 3 | Contract and generated code | `packages/contracts/proto/skilient/media/v1/media.proto` (5 methods: CreateUpload, PutFile, CheckFiles, DownloadLinks, StorageUsage); identity `StaffRolesOf` lists media; `pnpm contracts:gen` | 2026-11-28 | ticked |
| 4 | Migrations | `services/media/migrations/0001_media.sql`: `files` (one row per file: bucket, path, folder, uploader, type, size, status) and `deletions` (the cleanup queue), forced row-level security and one policy for `svc_media`, a grant for every statement | 2026-11-28 | ticked |
| 5 | Service | `services/media/src/`: bucket rules (`domain/buckets.ts`), files and cleanup (`store/files.ts`), the store port with the Azure adapter (managed identity, user-delegation SAS) and the in-memory store, consumer, jobs, authorize; in `packages/host`; 5 lines in `perf/budgets.json` | 2026-11-28 | ticked |
| 6 | Events | publishes `user.deletion_confirmed`; handles `profile.image_replaced`, `post.removed`, `message.deleted`, `credential.changed`, `community_file.released`, `cv_export.released`, `user.deleted`; events lint passes | 2026-11-28 | ticked |
| 7 | The ports others call, now media | content's `MediaPort` and work's (post-media, CheckFiles), work's credential `FileLookup` (owner, type, size), messaging's chat-image check (stored and uploaded by the sender), community's `Files` (stored), credentials' `Files` (CV PDF size, render-job `PutFile`); each switched by `MEDIA_CHECKS` (off only in the older worlds that don't host media) | 2026-11-28 | ticked |
| 8 | Unit and refusal tests | `test/unit/media.test.ts` 3 (path shapes, signed links open their own file until they expire, the SAS string-to-sign); `test/refusal/tables.test.ts` 5 | 2026-11-28 | ticked |
| 9 | Golden replays | `test/golden/media.golden.test.ts` 4: all match | 2026-11-28 | ticked |
| 10 | Journeys | `test/journeys/files.journey.test.ts` (4 × 2); the hand-off to-dos as real tests: `content/test/journeys/images.journey.test.ts` (post and venture-update images), `messaging/.../images.journey.test.ts` (chat images, signed links), `people/.../photos.journey.test.ts` (replaced photos deleted), `work/.../credential-files.journey.test.ts` (private PDFs), `community/.../receipts.journey.test.ts` (receipts private, deleted after 90 days); the re-encoding halves are W13 to-dos | 2026-11-28 | ticked |
| 11 | Done-when | see Results | 2026-11-28 | ticked |
| 12 | Docs | this file, `docs/decisions.md`, `CLAUDE.md`, `MEDIA_BLOB_URL` and the storage role assignments in `docs/azure/setup-checklist.md`, the file sync in `docs/azure/prd.md` | 2026-11-28 | ticked |

## Questions

- Q1 (recommendation taken): the stack's upload policies also checked group membership (a thread member, a society officer, the receipt's buyer, an organisation or university admin) and Student Pro for PDF exports. Those are other services' data; media records the uploader and the owning service checks it, and the group, when it attaches the file. A file uploaded into a group folder by someone who can't attach it is never used and goes with the expired-uploads sweep. Recommendation: keep it so.
- Q2 (recommendation taken): media has no extra upload rate limit beyond the policies' per-folder caps (the stack had none either; Supabase Storage's own limits applied).

## Left for later workstreams

- W10 trust: feedback files' release; staff reads of feedback files through trust.
- W11 market: university media and claims, organisation documents (release events, and links for staff and admins).
- W13 web: re-encoding before upload (sharp, as today), uploads through `CreateUpload` and reads through each owner's links; messaging, community and work expose the signed links to their readers (members, officers, reviewers); deploy's storage account, containers, anonymous read on the five public buckets, the managed identity's two roles, and `MEDIA_BLOB_URL`.
- W14 cutover: copy every Storage object into its container and one `media.files` row each (the final file sync in the PRD's runbook).

## Results

- Done-when, files: unused files are deleted. `test/journeys/files.journey.test.ts` passes on both transports: a deleted post's image, a replaced profile photo and a deleted credential's PDF are gone from the store after media's consumer and cleanup run; the hand-off journeys show the same for covers and for receipts 90 days after the event. A never-uploaded image is refused by content, work, messaging and community; another student's file can't be attached; a private file opens only for its owner or through the owning service, and a chat image only through messaging.
- Goldens: 4 recorded cases, stable over three further comparisons; 4 replays match.
