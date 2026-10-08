# Documentation conventions

The contract for every stage of the `docs/code/` work. Read it before writing or editing any doc here.

## Scope

- The docs describe the code as built, not as planned or specified. English only. No length targets: a doc is as long as the code needs.
- Each doc opens with two lines: `Commit: <short sha>` (the commit the doc was verified against) and `Covers: <paths>` (the files and folders it describes).
- Method comes from `.claude/skills/codebase-analysis` (`WORKFLOW.md`, `Gotchas.md`), used as guidance only. Stage 9 removes that folder.

## Citations

- Every factual claim about the code carries `[src: <path>#<symbol>]`, optionally `[src: <path>#<symbol>:L<line>]`.
- `<path>` is relative to the repo root and may contain Next route segments such as `[id]` and `[[...page]]`. `<symbol>` is a function, constant, type, class, component, config key or exact string that occurs in that file, on one line, and never contains `]`. For SQL the symbol is the object name (function, table, policy, trigger, view, cron job name).
- The symbol is what gets checked. The line is a hint; `check-citations` warns when it is more than 20 lines off.
- One citation per bracket. Put several brackets after a sentence when it rests on several places.
- Run `pnpm docs:check <file>` after writing. Fix or delete every failure.

## Verification

1. Read the code before writing. Open the files; do not describe from names, comments or other docs.
2. Write the draft with citations as you go.
3. Check every citation after writing: the script for existence, your own reading for meaning (a symbol that exists can still not say what the sentence says).
4. On a mismatch, fix the sentence or delete it.
5. A claim with no citation is deleted. Words like "probably", "likely", "should" and "presumably" are not allowed; if you cannot confirm it from code, leave it out or list it under an "Unconfirmed" heading in `reference/verification-log.md`.

## What does not apply from the skill

- Length quotas, bilingual output, Phase 0 (`/init`), mandatory ASCII diagrams.
- Use a Mermaid diagram where a flow branches or changes hands (a request, a job, a state machine). Do not add diagrams elsewhere.

## Evidence

- Evidence is code only: source, migrations, configuration, scripts, workflows.
- The `.ua/` graph, `CLAUDE.md`, the PRD (`docs/prd/`) and `docs/decisions.md` are leads to follow, never evidence to cite.
- Tests may be cited as evidence of behaviour. They are never edited and never documented one by one.

## Mismatches with the spec

When the code and `docs/prd/` or `docs/decisions.md` disagree, document the code and add a row to `docs/code/reference/prd-mismatches.md` (what the spec says, what the code does, both with locations). Fix neither side.

## Exclusions

Never documented, never edited, never cited as the subject of a doc:
`.claude/`, `.impeccable/`, `.zap/`, `types/database.ts`, `public/`, `brand/`, `design/`, `docs/reference/`, `docs/signing-keys/`, `pnpm-lock.yaml`.

## Secrets

No keys, tokens, passwords, project refs, connection strings or personal data in any doc. Name environment variables, never their values. Use `<project-ref>`-style placeholders if a shape must be shown.

## Comment rules (stage 10)

- Every `.ts`/`.tsx` file outside the exclusions and tests has a file-level comment that contains a line `Docs: docs/code/<doc>.md`.
- A new header goes at the very top, above any `"use client"` or `"use server"` directive and the imports, as 2 to 6 `//` lines: what the file is for, what it must always or never do, the PRD section if the doc cites one, then the `Docs:` line.
- A file that already has a file-level description keeps its wording and position. Add only what is missing, and the `Docs:` line.
- JSDoc only in `lib/`, route handlers and Edge Functions: each exported function, constant or type without one gets a prose `/** */` in the style of `lib/actions/billing.ts`: what it does, who may call it, what it returns on refusal or failure. No `@param` lists that repeat the types.
- Comments say why, and what must hold. They never restate the code. If nothing true and non-obvious can be said, write the one-line purpose and stop.
- Never put a comment between a directive comment (`@ts-expect-error`, `eslint-disable-next-line`, `deno-lint-ignore`) and its line. Never edit an existing directive. Never reflow code.
- Never touch tests, `.sql` files, `types/database.ts` or generated files.
- `node scripts/docs/assert-comment-only.mjs <base-ref>` must pass: the token stream (comments and whitespace dropped) is identical to the base.

## Layout

```
docs/code/README.md, CONVENTIONS.md, PLAN.md
docs/code/architecture/{overview,request-lifecycle,background-jobs,environments-and-deploy}.md
docs/code/subsystems/{ranking,billing,cv-signing,auth-and-rls,github-skills}.md plus the rest from PLAN.md
docs/code/reference/schema/ (generated)
docs/code/reference/api/{openapi.v1.yaml,routes.md,server-actions.md,edge-functions.md}
docs/code/reference/{rpc,env,live-inventory,drift,prd-mismatches,verification-log}.md
docs/code/howto/{debug,add-a-feature,change-the-schema}.md
```

`PLAN.md` has one row per source file or folder with the doc that covers it; `node scripts/docs/coverage.mjs` lists tracked source files with no row, and with `--headers` lists files with no `Docs:` line.

## Scripts

- `pnpm docs:check [paths...]`: citation check (default `docs/code/**`). It fails on a `[src:` it can't parse, a missing file or a missing symbol.
- `node scripts/docs/assert-comment-only.mjs <base-ref>`: comment-only diff check.
- `node scripts/docs/coverage.mjs [--headers]`: coverage against `PLAN.md`, or header coverage.
