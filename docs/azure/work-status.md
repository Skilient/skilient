# W5 `work`: status

Updated 2026-11-26, branch `azure`. One line per W5 item, with the evidence that ticks it. Format as `docs/azure/messaging-status.md`.

The W5 done-when is the PRD's build-plan row: "GitHub connect, harvest job, skills, endorsements, credentials, code checks, paths, tasks and swaps specs pass". As in W2 to W4, the specs are met by service-level journeys mirroring each web spec on both transports; web parts are `it.todo` for W13.

Status values: **ticked** (evidence exists), **partial** (part ticked, the rest named), **pending Ahmed** (a decision or sign-off).

| # | Item | Evidence | Date | Status |
| --- | --- | --- | --- | --- |
| 1 | Tracking sheet | `docs/azure/work-function-bins.md`: every function of the work migrations at its latest definition, by bin, with callers; other migrations' work functions and the deferred faculty portal listed; Golden column filled (91 by a recorded case, the rest held by journeys and the contract test) | 2026-11-26 | ticked |
| 2 | Goldens recorded on the current stack, local only, stable | `packages/testing/test/work.golden.test.ts` → `test/golden/work/*.json`: 16 cases in 11 files (ventures, applications, teams, contributions, reads, endorsements, code_checks, growth, swaps, credentials, github), compared twice | 2026-11-26 | ticked |
| 3 | Goldens match the port | `services/work/test/golden/*.golden.test.ts`: 16 of 16 | 2026-11-26 | ticked |
| 4 | Schema: forced default-deny RLS, one policy, a refusal test per table | `migrations/0001` to `0009` (58 tables; skills, settings, issuers, prompts, paths and tasks seeded from the current stack); `test/refusal/tables.test.ts` (61) | 2026-11-26 | ticked |
| 5 | Contract, budgets, callers, wiring | `work.proto` (106 methods), a budget line each, `src/authorize.ts`, host registry; content reads `VentureCards`, messaging `VentureTitles` | 2026-11-26 | ticked |
| 6 | Events | `src/events.ts` (23 published types, 5 handled); new types in `packages/contracts/events.json` with their consumers; events lint passes (32) | 2026-11-26 | ticked |
| 7 | GitHub connect and the harvest job | `ConnectGithub` (code exchange, binding, sealed tokens), the `harvest` job's stages (`src/harvest/stages.ts`), webhooks through `RecordGithubWebhook`; contract test against a fake GitHub (`test/contract/fake-github.ts`): connect → discover → classify → harvest → extract → L2 → disconnect | 2026-11-26 | ticked |
| 8 | Contract tests on both transports | `test/contract/work.test.ts` (4 × 2) | 2026-11-26 | ticked |
| 9 | Specs | `test/journeys/ventures.journey.test.ts` (ventures.spec + the three W5 hand-off to-dos), `evidence.journey.test.ts` (levels, endorsements, credentials, code checks), `growth.journey.test.ts` (github.spec, paths and tasks, skill swap) | 2026-11-26 | ticked |
| 10 | Journey hand-off | the W5 to-dos in content's and messaging's journeys are real tests in `ventures.journey.test.ts`; `docs/azure/journey-handoff.md` regenerated (no W5 section) | 2026-11-26 | ticked |
| 11 | Typecheck, lint, unit, refusal, golden, contract, journeys | "Results" below | 2026-11-26 | see "Results" |

## Left for later workstreams

- W6 ranking: publish tiers for `work.ranking_tiers` (paths' seniors) and ring flags for the peer-review check; consume `skill.changed`, `venture.completed`, `endorsement.*`, `credential.changed`, `swap.flagged`.
- W8 credentials: issue Record entries from `task.completed`, `swap.closed` and `venture.completed`.
- W9 notify and media: the notices from `application.changed`, `venture.invite_changed`, `code_check.changed`, `credential.changed`, `task_review.changed`, `swap.changed`; media records credential and update files (replacing the path rule) and deletes them on `credential.changed`.
- W10 trust: sanctions for the peer-review check; analytics from work's events; the /ops audit view.
- W11 market: competition awards into `work.competition_awards`.
- W13 web: every page; the GitHub OAuth state and webhook signature check before `RecordGithubWebhook`.
- Deploy: the `harvest` job container runs work's job worker (kind `github`); Key Vault secrets `github-app-private-key`, `github-app-client-secret`, `work-github-token-key`; env `WORK_GITHUB_APP_ID`, `WORK_GITHUB_CLIENT_ID`.

## Results (2026-11-26, local)

- `pnpm typecheck`, `pnpm lint` (incl. the migration check and the no-foreign-schema rule): pass.
- `pnpm test` (every package, one at a time): pass. work unit 6, refusal 61; lint 32; web 563; the rest as before. Two first-run failures under load passed on rerun (web's eslint-rules test at its 20 s limit; messaging's budget test lost its container connection).
- `pnpm test:contract`: pass. work 34 (contract 8, journeys 26, both transports) + 22 `it.todo`; content 32 + 20 todo; messaging 24 + 8 todo; people 52 + 16 todo; identity 138 + 36 todo.
- Goldens: work 16, messaging 18, content 24, people 26, identity 43, all match.
