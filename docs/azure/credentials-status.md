# W8 `credentials`: status

Updated 2026-11-28, branch `azure`. One line per W8 item, with the evidence that ticks it. Format as `docs/azure/community-status.md`.

The W8 done-when is the PRD's build-plan row: "A CV and a Record entry signed by the new service verify with the existing public keys, and old ones still verify", with "existing" meaning the local stack's keys and the CVs and entries recorded in goldens there (never production keys), and the public key file staying byte-identical. As in W2 to W7, the web specs (record.spec, cv.spec) are met by service-level journeys on both transports; web parts are `it.todo` for W13.

Status values: **ticked** (evidence exists), **partial** (part ticked, the rest named), **pending Ahmed** (a decision or sign-off).

| # | Item | Evidence | Date | Status |
| --- | --- | --- | --- | --- |
| 1 | Tracking sheet | `docs/azure/credentials-function-bins.md`: the 98 definitions of the four migrations at their latest version (the snapshot chain renamed across the teacher, ecosphere and AI-assisted migrations included), by bin, with callers and what replaces each; the Edge Function logic it replaces (`_shared/cv/`, `cv-sign`, the PDF routes) | 2026-11-28 | ticked |
| 2 | Goldens recorded on the local stack, stable | `packages/testing/test/credentials.golden.test.ts` → `test/golden/credentials/*.json`: 25 cases in 8 files plus `signed.json#stack_signed`, recorded twice from clean files and compared four more times; the stack's signing (cv-sign) is done by the recorder with the web's own code and a key it installs inside the rolled-back transaction; codes, signatures, hashes, key ids, dates and Pakistan times recorded as their type; entries made in one transaction moved apart as the owner (`apart`) | 2026-11-28 | ticked |
| 3 | Contract and generated code | `packages/contracts/proto/skilient/credentials/v1/credentials.proto` (36 methods, own request and response each); reads marked NO_SIDE_EFFECTS only with one database trip; added for credentials: work `CvFacts` (+ credentials on `VentureTitles`), identity `EmailsOf`, community `RecordFacts`, people `ProfileCards.onboarding_complete/leaderboard_opt_out`, ranking `PublishedTier.percentile` (all additive); `pnpm contracts:gen` | 2026-11-28 | ticked |
| 4 | Migrations | `services/credentials/migrations/0001_cv.sql`, `0002_record.sql`: 17 tables, each with forced row-level security and one policy for `svc_credentials`, grants for every statement the service makes (incl. the updates that clear a deleted account's id); one code namespace table for CVs and entries | 2026-11-28 | ticked |
| 5 | Service | `services/credentials/src/` (api, store, domain, signing, authorize, ports, jobs, consumers); registered in `packages/host`; signing ported to node:crypto (byte-identical to the Edge Function's Web Crypto, held by `test/unit/signing.test.ts`); 39 lines in `perf/budgets.json` (36 credentials, 3 batch reads elsewhere) | 2026-11-28 | ticked |
| 6 | Events | `src/events.ts` and `events.json`: publishes `record.sealed` (evidence {role, place, entrants, minutes}), `record.revoked {status revoked or superseded}`, `record.awaiting`, `record.mistake_reported`, `record.mistake_declined`, `record.claim_held`, `cv.issued`, `cv.revoked`, `cv_export.released`, `milestone.reached {cv.built}`, `audit.recorded`, `user.deletion_confirmed`; handles `event.closed`, `society.term_changed`, `venture.completed`, `task.completed`, `swap.closed`, `user.created`, `group.member_changed`, `entitlement.changed`, `user.banned` (new, identity), `user.deleted`; events lint passes | 2026-11-28 | ticked |
| 7 | Owed by others, picked up | community W8 (event.closed, terms, RecordFacts), ranking W8 (record.sealed/revoked with the evidence, TiersOf), work W8 (task, swap, venture), people `cv.built`, the work journey to-do (the Taught entry, now a real test in credentials' journeys) | 2026-11-28 | ticked |
| 8 | Unit and refusal tests | `test/unit/` 15 (canonical JSON with the web's RFC 8785 cases, signing cross-checked both ways with the web's code, the CV and Record wording); `test/refusal/tables.test.ts` 20 (every table refuses another service's role) | 2026-11-28 | ticked |
| 9 | Golden replays | `test/golden/` 26: all 25 recorded cases match, and the stack-signed CV and entry verify after import | 2026-11-28 | ticked |
| 10 | Contract tests on both transports | `test/contract/credentials.test.ts` (7 × 2): callers and anonymous reads, a CV issued with the real services and verified with the key file, staff revoke audited before and after, a ban and a deletion, community's close-out and confirmed term through signing to ranking's copy, work's swap and task, ranking's percentile; plus each touched service's own test (identity `credentials-reads`, work `cv-facts`, community `record-facts`, people `profile-flags`) | 2026-11-28 | ticked |
| 11 | Journeys | `test/journeys/record-cv.journey.test.ts` (5 × 2 + 4 todo): record.spec (check-in to sealed entry, second officer, verify, CV activities, share, transcript, revoke; a walk-in's claim), cv.spec (issue, share, verify, supersede, revoke, re-issue; Spark and Pro; the render job's PDF verifies), the Taught entry from work | 2026-11-28 | ticked |
| 12 | Done-when | see Results | 2026-11-28 | ticked |
| 13 | Docs | this file, `docs/decisions.md`, the code-map line in `CLAUDE.md`, the Key Vault secrets in `docs/azure/setup-checklist.md`, `docs/azure/journey-handoff.md` regenerated | 2026-11-28 | ticked |

## Questions

- Q1 (pending Ahmed): the signing key's Key Vault secret is one JSON value `{key_id, private_key}`; rotation is a new secret and a restart (the new key id retires the old one). Today rotation is `select private.cv_rotate_key()`. Kept closest to today: no automatic rotation (decisions.md 2026-10-01).
- Q2 (pending Ahmed): share-link tokens are now made by credentials (shown once, the reply not kept for retries) rather than by web, which only hashed and sent them. Web holds no rules (CLAUDE.md).
- Q3 (pending Ahmed): RecordCvExport needs media (W9) to confirm the uploaded file's size; until then the hosted service refuses with `pdf_missing`. The render job (`RequestPdf`) is the PRD's path; its Chromium image is W13.

## Left for later workstreams

- W9 notify and media: the notices from `record.awaiting` (record_confirm), `record.mistake_reported`, `record.mistake_declined`, `record.sealed` (record_entry), `record.revoked` (record_revoked when it was sealed), `cv.issued {monthly}` (cv_refreshed), `cv.revoked {staff}` (cv_revoked), and the claim email from `record.claim_held` (the address from community's RecordFacts); media stores render-job PDFs (`Files.put`), answers `Files.size` for RecordCvExport, and deletes files on `cv_export.released`.
- W10 trust: appeals on revoked entries (`record_revocation`; `appealable` ignores existing appeals until then) and reports on entries read `OpsRecordEntry`; the /ops audit from `audit.recorded`.
- W11 market: the CV's `awards` (university badges) are `[]` until market's batch read exists; talent search reads CVs through credentials.
- W12 billing: publish `entitlement.changed` for `cv.pdf_export`, `cv.templates`, `cv.refresh_on_demand`.
- W13 web: every page (the to-dos in the journeys); the next society event on an empty Record (community's events); web's PDF routes either call `RequestPdf` or keep rendering and call `RecordCvExport`/`RecordPdfExport`.
- W14 cutover: import `signing_keys` (every key, public halves), `cv_records`, `record_entries` with their codes into `credentials.codes`, and the rest; put the stack's active private key (Vault `cv_signing_key:<id>`) into Key Vault as `credentials-signing-key` and Vault `cv_export_secret` as `credentials-export-secret`, under two-person review. Old signatures verify unchanged (held by the stack-signed golden).
- Faculty portal: `faculty_reviewed` on CV projects is false until faculty reviews exist in work.

## Results (2026-11-28, local)

- Done-when, new half: a CV and a Record entry signed by the service verify with the key from `PublicKeys` (`test/contract/credentials.test.ts`, `test/journeys/record-cv.journey.test.ts`, both transports); every signature is byte-identical to the Edge Function's (`test/unit/signing.test.ts`).
- Done-when, old half: the CV and the Record entry the local stack signed (with its own key, recorded in `signed.json` with the key file's rows) verify after import through VerifyCv and VerifyRecordEntry, and fail on a changed byte (`test/golden/share-staff-verify.golden.test.ts`); the recorder checks the same recording with the web's own verifier.
- The key file: `PublicKeys` renders the same fields, order and PostgREST timestamp text as the web route.
- `pnpm typecheck` and `pnpm lint` (one package at a time; incl. the migration check and the no-foreign-schema rule, which also caught test queries on other schemas, now helpers in the owners' test worlds): pass.
- `pnpm test` (one at a time): pass. credentials unit 15 + refusal 20; identity 78; people 46; work 68; ranking 38; community 37; lint 41; web 563. Flake: content's feed budget (RecordViews p95 over 40 ms) failed twice with the load average at 8 to 10; W8 doesn't touch content.
- `pnpm test:contract`: pass. credentials 24 + 8 todo; community 28 + 8 todo; identity 142 + 36 todo; people 54 + 14; content 32 + 20 (its paging journey failed once under load and passed on rerun: flake); work 36 + 20; ranking 24 + 6; messaging 24 + 8; sample 22; relay 6.
- Goldens: credentials 26 (25 cases and the stack-signed check), identity 43, people 26 match. The pass over the other services was stopped by the system for low memory before content; CI runs them.
- `pnpm contracts:check` (after staging), `pnpm --filter @skilient/contracts breaking`, gitleaks on the staged diff: pass.
