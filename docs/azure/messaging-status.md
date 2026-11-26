# W4 `messaging` and `realtime`: status

Updated 2026-11-26, branch `azure`. One line per W4 item, with the evidence that ticks it. Format as `docs/azure/content-status.md`.

The W4 done-when is the PRD's build-plan row: "Chat p95 under 150 ms to fan-out; badges update within 500 ms; two replicas deliver every message once". The chat specs are met as in W2 and W3: service-level journeys mirroring every test in `chat.spec.ts` and `chat-extras.spec.ts`, plus the W4 to-dos other journeys left; web parts are `it.todo` for W13.

Status values: **ticked** (evidence exists), **partial** (part ticked, the rest named), **pending Ahmed** (a decision or sign-off).

| # | Item | Evidence | Date | Status |
| --- | --- | --- | --- | --- |
| 1 | Tracking sheet | `docs/azure/messaging-function-bins.md`: 58 owned (10 reads, 10 commands, 7 helpers, 31 wrappers or Supabase plumbing), 5 foreign triggers, 11 unclear (decided in docs/decisions.md 2026-11-26), 18 other-service readers; Golden column filled | 2026-11-26 | ticked |
| 2 | Goldens recorded on the current stack, local only, stable | `packages/testing/test/messaging.golden.test.ts` → `packages/testing/test/golden/messaging/*.json`: 17 cases in 4 files, compared twice | 2026-11-26 | ticked |
| 3 | Goldens match the port | `services/messaging/test/golden/*.golden.test.ts`: threads 7, messages 5, extras 3, share 2 = 17 of 17; content's W3 `share.json#visibility` replayed by messaging (`content-share.golden.test.ts`) | 2026-11-26 | ticked |
| 4 | Messaging schema: forced default-deny RLS, one policy, a refusal test per table | `services/messaging/migrations/0001_messaging.sql` (6 tables), `0002_copies.sql` (5 copies); `test/refusal/tables.test.ts` (14); realtime owns no table | 2026-11-26 | ticked |
| 5 | Contracts, budgets, callers, wiring | `messaging.proto` (22 methods), `realtime.proto` (Stats), content += `LinkPreviews`, `QueueLinkPreviews`, `CanListenFeed`; a budget line each; `src/authorize.ts`; host registry (both) | 2026-11-26 | ticked |
| 6 | Events | messaging publishes `message.sent`, `message.deleted`, `thread.read`, `badge.count_changed`, `user.deletion_confirmed`; handles 8 types through `messaging.copies`; registry: `conversation.allowed` (work, W5), `moderation.removed` renamed from `content.removed`; events lint passes | 2026-11-26 | ticked |
| 7 | Realtime service | `services/realtime/src/hub.ts` on `GET /realtime` (platform `deps.http.upgrade`, `deps.users`); topics user/thread/feed/event; 60 s permission cache; `hidden_from`; unit tests `test/unit/hub.test.ts` (3) | 2026-11-26 | ticked |
| 8 | Chat p95 under 150 ms to fan-out; badges within 500 ms; two replicas deliver every message once | `services/messaging/test/budget/realtime.budget.test.ts`: two hosts (A: identity, people, content, messaging, realtime; B: realtime only, its own role, messaging over HTTP/2), 6 sockets split across them, 60 messages: every socket got every message exactly once, in order; fan-out p95 68.5 ms, badge p95 68.0 ms | 2026-11-26 | ticked |
| 9 | Contract tests on both transports | `test/contract/messaging.test.ts` (6 × 2): wiring, callers, DM flow with events, share through content, live delivery with blocked members skipped and a badge under 500 ms, user.deleted | 2026-11-26 | ticked |
| 10 | Chat and chat-extras specs | `test/journeys/chat.journey.test.ts` (both chat.spec tests), `chat-extras.journey.test.ts` (typing is W13) | 2026-11-26 | ticked |
| 11 | Journey hand-off | the three W4 to-dos (new-posts pill over `feed:`, the share sheet's chat half, the live Friends badge) are real tests in `test/journeys/handoff.journey.test.ts`; content and people's `it.todo` lines removed; `docs/azure/journey-handoff.md` regenerated (no W4 section) | 2026-11-26 | ticked |
| 12 | Typecheck, lint, unit, refusal, golden, contract, journeys, budget | "Results" below | 2026-11-26 | see "Results" |

## Left for later workstreams

- W5 work: publish `venture.updated`, `group.member_changed` (ventures, with the owner), `conversation.allowed` (accepted applications, skill swaps); serve venture titles (messaging's `VenturePort`).
- W7 community: answer `event:` topics (a `CanListen` for events) and NOTIFY headcounts there.
- W9 notify and media: handle `message.sent` (chat notice and push, excerpts read back from messaging), `thread.read`, `message.deleted`; media's chat-image check (`imageOwned`) and signed links.
- W10 trust: publish `moderation.removed` for messages; forward `message.sent` to analytics; realtime `Stats` on /ops.
- W11 market: call `OpenContactThread`/`CloseThread`; serve organisation names for contact-DM titles.
- W13 web: one socket per visible tab (closed 60 s after hiding); subscribe to `user:`, the open thread's `thread:` and the feed tab's `feed:`; the typing ping.
- Deploy: the `realtime` container's external ingress routes to the HTTP/1.1 port (`/realtime`).

## Results (2026-11-26, local)

- `pnpm typecheck`, `pnpm lint` (including the migration check and the no-foreign-schema rule): pass.
- `pnpm test`: pass (exit 0). messaging unit 4, refusal 14, budget 1 (two replicas); realtime hub 3; content 48 + budget 4; people 37; lint 29 (events, journey hand-off); web 563; identity, platform, testing, host and samples pass.
- `pnpm test:contract`: pass. messaging 24 (contract 12, journeys 12, both transports) + 10 `it.todo`; content 32 + 24 todo; people 52 + 16 todo; identity 138 + 36 todo; sample 22; relay 6.
- Goldens: messaging 18 (17 cases + content's share.json), content 24, people 26, identity 43, all match.
- Contracts: `buf lint` and `buf format` clean; no breaking change (additions only).
