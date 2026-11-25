# W1 `identity`: status

Updated 2026-11-25, branch `azure`, nothing committed. One line per W1 item, with the evidence that ticks it.

The PRD has no W1 checkboxes of its own; its "phase is done when" boxes are phase-level and stay unticked (CLAUDE.md, "How to work" 6). The W1 done-when is the PRD's build-plan row: sign-up, sign-in, two-factor, password change, deletion and every signup gate pass the existing auth specs; imported hashes verify. Ahmed's decisions (2026-11-25) set how each is met: journey tests mirror the auth specs (Q5), and the goldens, refusal tests and checks must pass.

Status values: **ticked** (evidence exists), **partial** (part ticked, the rest named), **pending Ahmed** (a decision or sign-off).

| # | Item | Evidence | Date | Status |
| --- | --- | --- | --- | --- |
| 1 | Shared event log in schema `platform` | `packages/platform/migrations/0001_platform.sql`, `packages/platform/src/events.ts`; `packages/testing/test/platform-events.test.ts` (8: slow-commit race, replay-once, personal-data guard) | 2026-11-25 | ticked |
| 2 | Job queue and scheduler | `packages/platform/src/jobs.ts`; `platform-jobs.test.ts` (8); identity's schedules in `services/identity/src/jobs.ts` | 2026-11-25 | ticked |
| 3 | Idempotent handlers | `platform.applied_events`; replay-once test; identity's consumers (`gate-facts`, deletion confirmations) | 2026-11-25 | ticked |
| 4 | Client idempotency keys on writes | `packages/platform/src/write.ts`, `propagate` in `client.ts`; `platform-write.test.ts` (7), client test; secret-returning methods refuse repeats (Q2) | 2026-11-25 | ticked |
| 5 | Token-version revocation | `auth/user-token.ts`, `auth/revocation.ts`; `platform-revocation.test.ts` (3); identity bumps on sign-out elsewhere, "not me", password change and reset, role changes, MFA reset, sanctions and deletion; local sign-out ends one session (Q11) | 2026-11-25 | ticked |
| 6 | Platform purge and rate limits (Q8, Q12) | `packages/platform/src/{purge,rate-limit}.ts`, `migrations/0002_rate_limit.sql`, `host.mjs platform-purge`; `platform-purge.test.ts` (3) | 2026-11-25 | ticked |
| 7 | Identity schema: every table with default-deny RLS and a refusal test | `services/identity/migrations/0001`–`0006`; `test/refusal/*.test.ts` | 2026-11-25 | ticked |
| 8 | 17 access-rule policy refusal tests | golden group `policies` in `packages/testing/test/identity.golden.test.ts` (17, each asserting who is refused) | 2026-11-25 | ticked on the current stack; owners replay them in their workstreams |
| 9 | Identity goldens recorded on the current stack | `packages/testing/test/golden/identity/*.json`: 60 cases (43 identity, 17 policies) + `password.json` | 2026-11-25 | ticked |
| 10 | Identity goldens match the port (44 cases) | `services/identity/test/golden/*.test.ts`; all 44 match. Where a recorded case also wrote another service's tables (profiles, notifications, sanctions, GitHub tables), identity's half matches exactly and the event or read that carries the rest is asserted (rules in `replay.ts`) | 2026-11-25 | ticked |
| 11 | Identity contract, budgets, wiring | `packages/contracts/proto/skilient/identity/v1/identity.proto` (39 methods, all implemented: "implements every method" test), `perf/budgets.json`, host registry, `/.well-known/jwks.json` | 2026-11-25 | ticked |
| 12 | Sign-up and signup gates | `src/api/signup.ts`, gate copies fed by events (Q1); `test/contract/signup.test.ts`, journeys | 2026-11-25 | ticked |
| 13 | Sign-in, sessions, refresh rotation, sign-out | `src/api/sessions.ts`, `src/store/sessions.ts`; `test/contract/sessions.test.ts` | 2026-11-25 | ticked |
| 14 | Google sign-in and import of Google-only accounts | `src/store/google.ts`, `import-identities.ts`, `tools/cutover/src/identities-import.ts`; contract and import tests with a fake Google | 2026-11-25 | ticked |
| 15 | Two-factor (TOTP, backup codes, step-up) and TOTP-secret import | `src/api/security.ts`, `src/domain/totp.ts`; `test/contract/security.test.ts`, `test/unit/totp.test.ts` (RFC 6238 vectors), `test/import/totp-import.test.ts` | 2026-11-25 | ticked |
| 16 | Password change and reset | `src/api/security.ts`, `src/domain/breached.ts`; `password.json` replay; contract tests | 2026-11-25 | ticked |
| 17 | Staff roles, MFA reset, sanctions and GitHub commands | `src/api/staff.ts`, `src/store/{staff,sanctions,github}.ts`; staff contract tests; ban path golden and refusal tests | 2026-11-25 | ticked |
| 18 | Account deletion (request, cancel, hourly run, `user.deleted`, confirmations) | `src/store/deletion.ts`; `test/contract/deletion.contract.test.ts`, `deletion.json` replay, journeys | 2026-11-25 | ticked |
| 19 | Imported hashes verify | local fixtures: `test/import/auth-import.test.ts`; production algorithm bcrypt `$2a$` cost 10 confirmed by Ahmed and Huziafa (`docs/decisions.md`); Argon2id rehash at sign-in (`sessions.test.ts`) and in the image (`host.mjs selfcheck` in the smoke test) | 2026-11-25 | ticked |
| 20 | Existing auth specs pass (sign-up, sign-in, two-factor, password change, deletion, signup gates) | `services/identity/test/journeys/*.test.ts`: one journey per spec test on both transports (Q5); web-only parts are `it.todo` for W13 | 2026-11-25 | ticked under decision Q5; the Playwright specs themselves run in W13 |
| 21 | Typecheck, lint, unit and contract tests green | "Results" below | 2026-11-25 | see "Results" |
| 22 | CI run on `azure` | run 45595907252 on a6d8af8: success | 2026-11-25 | ticked |
| 23 | Duplicate sign-up wording | `src/api/signup.ts`: a confirmed address is refused with `already_registered` (web shows today's message), an unconfirmed one gets a fresh code; `test/contract/signup.test.ts`, journey "a duplicate email is told to sign in instead" | 2026-11-25 | ticked (Ahmed chose today's message) |

## What is left for later workstreams

- Trust (W10) and market (W11) must publish the events identity's gate copies consume (`config.portals_changed`, `org.member_changed`); `packages/contracts/events.json` holds them and `tools/lint/test/events.test.ts` fails if either service lands without them. People's imports send `profile.gate_changed` (built, 2026-11-26).
- Trust must not audit identity's half of a sanction twice (W10). Existing sanctions: `importSanctionMarks` is built and tested (`test/import/sanctions-import.test.ts`); W14 runs it on the real export.
- Web (W13): map identity's refusal codes to today's wording; refresh the token after agreement acceptance and onboarding (gate flags can be up to 10 minutes old); call identity instead of Supabase Auth; run the Playwright auth specs.

## Results (2026-11-25, local)

- `pnpm typecheck` and `pnpm lint` (including the migration check): pass.
- `pnpm test`: pass. Web 563 of 563 (one ESLint-rule test timed out once while memory was exhausted, then passed); identity, platform, testing, host, lint, cutover and samples all pass.
- Identity, every project: 29 files, 253 passed, 3 skipped (need the local Supabase stack), 36 `it.todo` (web parts for W13).
- `pnpm test:contract`: identity contract and journeys 136 passed (21 journeys per transport, 36 todo); sample 22; relay 6.
- Goldens on the current stack: 60 of 60. Replays against the port: 43 of 43 tests, all 44 identity cases matching.
- Auth import with local fixtures (hashes, TOTP secrets, Google identities): 12 of 12.
- Contracts: `buf lint` and `buf format` clean; regenerating changes nothing (the `git diff` step of `contracts:check` needs a commit).
- Image builds; `pnpm services:smoke` passes, with Argon2id hash and verify inside the image in 250 ms.
- Test hygiene: with the testcontainers reaper disabled on this Fedora host, interrupted runs leave Postgres containers behind and exhaust memory; remove them with `docker ps -q --filter label=org.testcontainers=true | xargs -r docker rm -f` when no test is running.
