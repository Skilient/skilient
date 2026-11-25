# Skilient on Azure: backend PRD (microservices, single phase)

Nov 17, 2026 · @Ahmed

## Summary

The backend moves off Supabase onto 12 domain services and 2 platform services, written in TypeScript, running on Azure Container Apps over one Postgres server that is split into a schema per service. It is built as one phase and switched over in one cutover.

**What the floor buys.** At beta size (200 accounts, 30 online at peak) the list-price bill is about **$57 a month** ($57.49 in `floor_model.py`). That pays for the smallest Postgres server and four always-warm containers: the web app, and three service containers. Those three host all 14 services, with `realtime` in its own container.

**The trade-off behind that number.** Keeping all 14 services warm in their own containers costs about $113 a month at the same load. $57 does not cover it. So each service is built as its own package, schema, API contract and image, and the floor layout co-hosts them in three containers (`core-a`, `core-b`, `realtime`). Moving a service into its own container is a configuration change, not a code change. Each container beyond the three costs $6 a month more.

**Nothing lags.** No path a user waits on ever scales to zero. Only heavy background work does: PDF rendering, GitHub harvesting and nightly batches.

**As load grows.** At launch size (5,000 accounts, 100 online, 300 on busy days) the bill is about $210 to $256 a month if the feed design below halves database work per user. It is about $505 to $560 if database work per user stays where it measures today.

**The size of the job.** This is a rewrite, not a migration. Today's backend is 57,053 lines of SQL: 263 tables, about 1,500 functions (251 public), 155 triggers, 60 scheduled jobs, 10 queues and 11 Edge Functions. The web app makes 146 distinct function calls that all have to be re-pointed. That volume is the main risk in this document.

**For comparison.** Staying on Supabase Pro with Vercel Hobby was modelled at $75 a month at beta size and $303 at launch.

## Goals, non-goals and performance budgets

The goal is the same product on a backend that is faster, cheaper at the floor, and scales by adding containers instead of redesigning.

### Goals

1. **Parity.** Every behaviour built in phases 0 to 18 works the same, except the faculty portal, which is ported later.
2. **All compute and data on Azure.** Cloudflare Free, Brevo, GitHub's image registry, PostHog and Sentry stay as outside services.
3. **Speed.** Every request meets the budgets below, with no cold start on any path a user waits on.
4. **Cost.** About $57 a month at beta size, at list price ($57.49); $7.49 above the $50 ceiling, accepted with the `realtime` container (see Decided on 2026-11-22, record 12).
5. **Scale.** Any service can get more replicas, its own container or its own database without changing another service.
6. **Safe cutover.** No data lost, every issued CV and Record code still verifies, and rollback is rehearsed.

### Non-goals

- No new features and no screen changes. Components keep their props; only the data layer under them changes.
- No AI or LLM API in the product. Every rule in the repo's "Never" list still holds.
- No Kubernetes, no multi-region, no second cloud.
- No change to the recruiter and university portals' off-by-flag status.

### Performance budgets

The left column is PRD section 10, unchanged. The right column is new: the server-side share each path may spend, measured inside the region at p95.

| Path | PRD 10 target (real users, p75 unless noted) | Server budget in the new backend (p95) |
| --- | --- | --- |
| Server response from Pakistan | 600 ms | 250 ms for web and services together |
| Feed, first page | Visible in 1.5 s | 120 ms for the feed data |
| Feed, next page | 400 ms | 60 ms |
| Survey tick or cross | Saved in 500 ms | 40 ms |
| Chat message delivered | 1 s p95 | 150 ms from send to fan-out |
| Search results | 300 ms p95 | 80 ms |
| Notification badge update | 2 s | 500 ms |
| Event check-in scan | Not set | 60 ms |
| CV or Record PDF | 10 s p95 | 10 s, including starting the render job |

Three rules apply to every page:

- **Calls per page:** at most 3 service calls, made in parallel by the web app.
- **Database trips per read:** one.
- **Database work per online user:** 0.008 vCPU or less. Today it measures about 0.016.

A pull request that breaks a budget fails CI.

## Architecture overview

One public web app composes every page from typed calls to services that each own their data; anything a user is not waiting on travels as an event.

```
Browser
  │ HTTPS
Cloudflare Free (DNS, TLS, firewall)
  │
  ├── web ─────────── Container Apps (external ingress, 1–3 replicas)
  │     │ typed calls, HTTP/2, in-process when co-hosted
  │     ├── core-a   Container Apps (internal): identity, people, content, notify, trust, media
  │     └── core-b   Container Apps (internal): messaging, community, work, ranking, credentials, market, billing
  │
  ├── realtime ────── Container Apps (external ingress, 1–3 replicas): WebSocket, Postgres NOTIFY
  │
  jobs (on demand): render, harvest, batch, migrate
  │
  └── PostgreSQL Flexible Server (private, virtual network)
        one schema per service · platform.events · platform.jobs
        Blob Storage (files, PDFs) · Key Vault (signing keys, secrets)
```

Read it top to bottom: traffic enters through Cloudflare, only `web` and `realtime` face the internet, and every service reaches the same Postgres server but only its own schema.

### The parts

| Part | What it is | Public? |
| --- | --- | --- |
| `web` | The existing Next.js app. It verifies the session, calls services in parallel and renders. It holds no business rules. | Yes, behind Cloudflare |
| `realtime` | Holds one WebSocket per visible tab and pushes chat messages, badge counts and event headcounts. | Yes, behind Cloudflare |
| 12 domain services | Own the rules and the data for one area each: identity, people, content, messaging, work, ranking, community, credentials, notify, trust, market, billing. | No |
| `media` | Issues upload and download links, records files, deletes unused ones. | No |
| Jobs | Short-lived containers for heavy work: PDF render, GitHub harvest, nightly batches. They start on demand and stop. | No |
| Postgres | One Flexible Server. One schema per service, plus a shared event log and job queue. | No, private network |
| Blob Storage | Files, images and rendered PDFs. | Public containers through Cloudflare; private ones by short-lived link |
| Key Vault | Signing keys and secrets. | No |

### Six rules the design follows

1. **One owner per table.** Only the owning service reads or writes a table. The database enforces it with a login role per service.
2. **Calls for what the user waits on, events for the rest.** A page load is calls. A notification, a ranking update or an email is an event.
3. **Services keep no state in memory that matters.** State lives in Postgres, Blob Storage and Key Vault, so any replica can serve any request.
4. **One front door.** Only `web` and `realtime` accept traffic from outside. Webhooks from GitHub, Brevo and payment gateways arrive at `web`, are verified, and become jobs.
5. **Warm where people wait, zero where they don't.** User-facing containers keep one replica running. Jobs cost nothing while idle.
6. **Same code, hosted together or apart.** A service does not know whether its neighbour is in the same process or across the network.

### How one page load travels

1. The browser asks Cloudflare, which forwards to `web`.
2. `web` checks the session token itself. This needs no database call and no service call.
3. `web` makes up to three calls in parallel: the page shell from `people`, and the page's own data from its service.
4. Each service runs one query and answers.
5. `web` streams the page. The browser opens its socket to `realtime` for live updates.

## Service catalogue

Fourteen services replace the SQL functions, triggers and Edge Functions; the table says what each owns and how much of today's SQL it takes over.

### Domain services

| Service | Owns | SQL it replaces (lines, approx.) | Main events it publishes |
| --- | --- | --- | --- |
| `identity` | Accounts, sign-in, sessions, two-factor, signup gates (university domain, live date, portals flag), agreement versions, staff roles, account deletion | 2,700 | `user.created`, `user.deleted`, `role.changed` |
| `people` | Profiles, universities and departments, friends, blocks, mutes, privacy settings, onboarding, tours and tips, page shell, people search, suggestions | 2,300 | `profile.updated`, `friendship.changed`, `block.changed` |
| `content` | Posts, comments, polls, link previews, micro-survey, views, the ranked feed, sharing | 3,000 | `post.created`, `post.removed`, `comment.created`, `survey.answered` |
| `messaging` | Chat threads, members, messages, reactions, pins, read receipts, chat search | 1,500 | `message.sent`, `thread.read` |
| `work` | Ventures, contributions, GitHub connection and evidence, skills and levels, endorsements, credentials, code checks, paths, proof tasks, skill swaps | 10,500 | `venture.completed`, `skill.changed`, `endorsement.given`, `task.completed` |
| `ranking` | Score formula, nightly runs, tiers, leaderboards, anti-gaming flags, adjustments, snapshots | 2,250 | `tier.changed`, `ranking.published` |
| `community` | Societies, inductions, events, tickets, check-in, payment proofs, the yearbook | 6,500 | `event.registered`, `ticket.checked_in`, `event.closed`, `society.verified` |
| `credentials` | The Record, CV snapshots and settings, signing, verification, share links, PDF exports | 3,650 | `record.sealed`, `record.revoked`, `cv.issued` |
| `notify` | In-app notifications, preferences, email through Brevo, web push, digests | 1,000 | `notification.created` |
| `trust` | Reports, cases, sanctions, appeals, the audit log, the staff inbox, platform config, feedback, alerts, analytics forwarding | 4,550 | `sanction.changed`, `case.resolved`, `config.changed` |
| `market` | Recruiter organisations, talent search, jobs and applications, the recruiter API, university portal, fairs, Openings, sales leads | 12,050 | `application.moved`, `hire.recorded` |
| `billing` | Entitlements, plans, usage counters, checkout, invoices, gateway webhooks | 4,250 | `entitlement.changed`, `payment.settled` |

### Platform services

| Service | Does | Notes |
| --- | --- | --- |
| `realtime` | Holds sockets, checks each subscription with the owning service, pushes what services publish | Has no data of its own |
| `media` | Signs upload and download links, records each file and its owner, deletes unused files | Image re-encoding runs in `web` at the floor, where there is 1 GiB of memory |

### What every service looks like

- **Language and runtime:** TypeScript, Node 22, one small image built on a distroless base.
- **API:** a Protobuf contract in `packages/contracts`, served with ConnectRPC. Clients are generated, never written by hand.
- **Data:** its own schema, its own login role, its own migrations folder.
- **Shape of a command:** validate input, check the caller may do this, run one transaction that also writes its events, check the row count, return a typed result, log one JSON line with the request id.
- **Health:** `/livez` and `/readyz`.
- **Scale rule:** one replica minimum once it has its own container; more replicas on concurrent requests; never zero.

### Jobs

| Job | Trigger | Size | Replaces |
| --- | --- | --- | --- |
| `render` | A PDF is requested and no cached copy exists | 1 vCPU, 2 GiB | Chromium inside Vercel functions |
| `harvest` | GitHub sync work is queued | 0.5 vCPU, 1 GiB | The `github-worker` Edge Function |
| `batch` | Schedule: nightly ranking, weekly paths, digests, clean-ups | 0.5 vCPU, 1 GiB | Heavy `pg_cron` jobs |

Light background work (notification fan-out, link previews, analytics forwarding, signing) runs inside the warm services and costs nothing extra.

## Data architecture

One Postgres server holds a separate schema for each service, and the database itself stops any service from touching another's tables.

### Layout

- **Server:** Azure Database for PostgreSQL Flexible Server, PostgreSQL 17, Central India, one database named `skilient`.
- **Schemas:** `identity`, `people`, `content`, `messaging`, `work`, `ranking`, `community`, `credentials`, `notify`, `trust`, `market`, `billing`, `media`, and `platform` for the shared event log and job queue.
- **Roles:** one login role per service, with rights on its own schema and on `platform` only. Row-level security stays on every table as default-deny, with one policy: the owning role.
- **Keys:** every id is a UUID. New rows use UUIDv7, so recent rows sit together in the index. Existing ids are kept.
- **No cross-schema foreign keys.** A reference to another service's row is a plain UUID column. The owning service's `user.deleted` and similar events drive clean-up.

A service that outgrows the shared server moves its schema to its own server. Nothing else changes, because nothing else ever queried it.

### Where the logic goes

| Today in Postgres | In the new backend |
| --- | --- |
| 251 public functions called by the app | Typed service methods |
| About 1,250 private functions | TypeScript modules inside the owning service |
| 155 triggers | Code in the same transaction, or an event handler |
| 172 row-level security policies | An `authorize(actor, action, resource)` module per service, with the refusal tests ported |
| 60 `pg_cron` jobs | A schedule table read by an in-process scheduler; heavy ones start the `batch` job |
| 10 `pgmq` queues | One `platform.jobs` table read with `FOR UPDATE SKIP LOCKED` |
| Vault secrets | Key Vault |
| `pg_jsonschema` config checks | Zod schemas in `trust` |

SQL stays for what SQL is best at: set-based reads and atomic writes. Decisions move to TypeScript.

### Reading another service's data

A service never joins across schemas. It has two options:

1. **Batch call.** Ask the owner once for many ids. Example: `content` asks `people` for 20 author cards in one call.
2. **Local copy.** Keep a small read-only copy, updated from events. Used where a call per request would break a budget.

| Local copy | Lives in | Fed by | Why |
| --- | --- | --- | --- |
| Author cards (name, avatar, tier, university) | `content`, `messaging`, `community` | `profile.updated`, `tier.changed` | Every post, message and attendee row shows one |
| Audience edges (friends, blocks, mutes) | `content` | `friendship.changed`, `block.changed` | The feed filters and scores on them |
| Ranking facts (completed work, skills, endorsements, Record entries) | `ranking` | Events from `work`, `credentials`, `trust` | Nightly scoring reads only its own schema |
| Entitlement set per subject | Every service that gates a paid action | `entitlement.changed` | A paid check costs no call |
| Restriction and role flags | In the session token | `sanction.changed`, `role.changed` | The gate check costs no call |

A nightly reconcile job compares each copy with its owner and repairs drift.

### Events

- **Log:** one append-only table, `platform.events`: sequence number, type, version, subject ids, JSON payload, producer, time, and the writing transaction's id.
- **Writing:** the service inserts its events in the same transaction as the change. Either both happen or neither does.
- **Reading:** each consumer keeps a cursor in `platform.cursors` and reads only events whose transaction is older than every transaction still open. That closes the gap where a slow commit would be skipped.
- **Speed:** the writer also sends a Postgres `NOTIFY`, so warm consumers react in milliseconds instead of polling.
- **Delivery:** at least once. Every handler is idempotent and records the event ids it has applied.
- **Later:** when a service moves to its own server, its events go out through Azure Service Bus instead. Handlers do not change.

### Connections

The floor server allows 35 user connections and has no built-in pooler on its tier.

| Holder | Connections |
| --- | --- |
| Service container, per replica | 10 |
| Event and realtime listeners | 2 |
| Jobs | 4 |
| Migrations and admin | 3 |
| Headroom at one replica | 16 |

From the General Purpose tier upward, built-in PgBouncer is switched on in transaction mode and services connect through it.

### Migrations and backups

- **Migrations:** plain SQL, forward-only, one folder per service, run by a deploy job under that service's owner role. Every change ships in two steps: add first, remove in a later release.
- **Extensions kept:** `pg_trgm`, `unaccent`, `btree_gin`, `pgcrypto`, `pg_stat_statements`.
- **Extensions dropped:** `pgmq`, `pg_net`, `pg_jsonschema`, `supabase_vault`, `pgtap`. None exist on Azure Postgres.
- **Backups:** Azure's built-in backups with 7 days of point-in-time restore, included in the price. A weekly `pg_dump` also goes to Blob Storage so one copy sits outside the server.

## Communication

Services talk in three ways: typed calls when someone is waiting, events when no one is, and one socket per tab for live updates.

### Typed calls

- **Contract first.** Each service's API is a Protobuf file in `packages/contracts`. ConnectRPC generates the server stubs and the clients. A breaking change fails CI.
- **Two transports, one client.** When caller and callee share a process, the call is a function call through ConnectRPC's in-memory transport. When they do not, it is HTTP/2 inside the Container Apps environment. The contract tests run against both on every pull request.
- **Who the user is.** `web` attaches the user's short-lived access token to each call. Each service verifies the signature locally against cached public keys. No service calls `identity` to check a token.
- **Who the caller is.** Service-to-service calls also carry a signed service token naming the caller. A service lists which callers may use which methods.

| Rule | Value |
| --- | --- |
| Deadline on every call | 2 s default; the page as a whole gets 800 ms |
| Retries | One, with jitter, on idempotent reads only |
| Writes | Carry a client-made idempotency key; a repeat returns the first result |
| Call depth | `web` to a service to at most one more service |
| Fan-out | Done in parallel in `web`, never in a chain |
| Failing dependency | Circuit opens after 5 failures in 10 s; the page renders without that part |
| Payload | Binary Protobuf between services; JSON only at the browser edge |

### Events

Events use the log described under Data architecture. The main flows:

| Event | From | Handled by | Effect |
| --- | --- | --- | --- |
| `user.created` | `identity` | `people`, `notify`, `trust` | Profile and onboarding rows, welcome, analytics |
| `user.deleted` | `identity` | Every service | Each deletes or anonymises its rows and confirms |
| `friendship.changed`, `block.changed` | `people` | `content`, `messaging`, `notify` | Audience edges, chat locks, a notification |
| `post.created` | `content` | `notify`, `trust` | Mentions and follows notified, analytics |
| `message.sent` | `messaging` | `realtime`, `notify` | Live delivery, push if the reader is away |
| `venture.completed`, `skill.changed`, `endorsement.given` | `work` | `ranking`, `credentials`, `notify` | Ranking facts, a Record entry, a notification |
| `event.closed` | `community` | `credentials` | Record entries for attendees and officers |
| `record.sealed` | `credentials` | `ranking`, `notify` | Score input, a notification |
| `tier.changed` | `ranking` | `people`, `content`, `notify` | Badges on cards, a tier-up notice |
| `case.resolved`, `sanction.changed` | `trust` | `identity`, `content`, `ranking`, `notify` | Token flags, content removal, penalties, notices |
| `entitlement.changed` | `billing` | Services that gate paid actions | Local entitlement set refreshed |

### Realtime

- **One socket per visible tab**, opened to `realtime`. It closes 60 seconds after the tab is hidden.
- **Topics:** `user:{id}` for badges and notifications, `thread:{id}` for chat, `event:{id}` for headcount.
- **Subscribing:** `realtime` asks the owning service whether this user may listen, and caches the answer for 60 seconds.
- **Publishing:** the service sends a Postgres `NOTIFY` carrying the topic and the message itself, inside the transaction that made the change. Every `realtime` replica listens and forwards. No second query is needed.
- **Scale:** this works unchanged with several replicas. Azure Web PubSub replaces the listener only if sockets pass about 5,000.

### Traffic in and out

- **Webhooks in** (GitHub, Brevo, payment gateways) reach `web`, have their signature checked, are stored once, and become a job.
- **Calls out** (Brevo, GitHub, push services, PostHog, link previews) leave only from services and jobs, through the existing SSRF guard.

## Performance design

Speed comes from doing less per request: no database call to check the session, one call for the page shell, a feed that is mostly computed before anyone asks, and nothing a user waits on starting cold.

### Hot paths

"Today" figures are from the repo's local smoke run and load test notes. They were measured on a shared four-core machine, so treat them as rough.

| Path | Today | New design | Budget (p95) |
| --- | --- | --- | --- |
| Session and gate check, every request | Two database calls (`getUser`, `my_gate_state`) | The access token carries user id, role, agreement version, onboarding state, two-factor level, restriction and portal flags. `web` verifies it in memory. | 1 ms, no call |
| Page shell (badges, restriction, tour, profile) | Five calls | One `people.Shell` call, cached per user for 30 s and cleared by events | 25 ms |
| Feed, first page | 13 calls, then cards and survey; about 0.4 to 0.65 s in the database | Candidate pool rebuilt every 60 s per audience and held in memory. Per-viewer scoring in TypeScript over at most 300 candidates. Cards read from one pre-joined table in one query. First page cached per viewer for 30 s. | 120 ms |
| Feed, next page | 4 to 6 calls | The ranked list for the session is already held; one query hydrates the next 10 cards | 60 ms |
| Views and survey answers | One call per action | The browser batches them into one request every 5 s; one multi-row insert | 40 ms |
| Chat send | Insert, then readers re-query; p95 about 470 ms | Insert and `NOTIFY` in one transaction; the notification carries the message | 150 ms to fan-out |
| Search | p95 about 30 ms | Same indexes (`pg_trgm`, full-text), one query | 80 ms |
| Event check-in | About 15 ms | Ticket signature checked in memory, one upsert, headcount by `NOTIFY` | 60 ms |
| CV and Record PDF | Rendered on request | Rendered once per signed version, stored in Blob, served from there afterwards | 10 s first time, 200 ms after |

### Techniques used everywhere

**No waiting for containers**

- Every user-facing container keeps one replica running at all times.
- Jobs may start cold. Nothing a user waits on depends on a job, except the first render of a PDF.

**Fewer, cheaper database trips**

- One round trip per read. Related rows come back as one JSON document.
- Prepared statements and pipelining through `postgres.js`.
- Fixed, small connection pools. A request never waits to open a connection.
- Every foreign key and filter column indexed. Any query over 50 ms p95 in `pg_stat_statements` gets a ticket.

**Caching without a cache server**

- Small in-process caches for the page shell, author cards, entitlements and config.
- Each cache entry is cleared by the event that changes it, so nothing stale is served past 30 s even if an event is missed.
- At several replicas, each replica hears the same events, so the caches stay consistent. Redis is not needed at any size in this document.

**Network**

- Everything in one region, Central India.
- HTTP/2 with kept-alive connections between containers; binary Protobuf payloads.
- Co-hosted services call each other as functions, with no network hop at all.

**Edge and files**

- Cloudflare caches static assets for a year and public pages (marketing, `/verify`) for 60 s.
- Images are resized to three widths at upload and served from Blob Storage through Cloudflare with immutable cache headers.
- Private files use links that expire in minutes.

**Web app**

- Server components stream. The shell paints while page data is still arriving.
- Service calls for one page run in parallel.
- Links prefetch on hover and on touch start.

**Runtime**

- Password hashing and image work run off the main thread.
- Timers are kept to a minimum so an idle container stays under Azure's idle-billing threshold.

### How it is proven

1. **Budget file.** `perf/budgets.json` lists every endpoint's p95 budget. An integration test times each endpoint against a seeded database and fails on a breach.
2. **Load test.** The existing k6 journeys run against the new backend at 30, 100 and 300 simulated users. The PRD 10 thresholds must pass at each.
3. **Database work per user.** The same run records Postgres CPU. The target is 0.008 vCPU per online user or less.
4. **Real users.** Web Vitals keep flowing to the existing alerts.

## Azure resources and deployment layout

The floor uses five kinds of Azure resource in one resource group in Central India; growth adds containers and a bigger database, never a new kind of resource before 20,000 accounts.

### Resources at the floor

| Resource | Size | Used for |
| --- | --- | --- |
| Container Apps environment | Consumption plan, inside a virtual network | Runs `web`, the three service containers and the jobs |
| Container app `web` | 0.5 vCPU, 1 GiB, 1 to 3 replicas | Next.js; public |
| Container apps `core-a`, `core-b` and `realtime` | 0.25 vCPU, 0.5 GiB each, 1 to 3 replicas | `core-a: identity, people, content, notify, trust, media. core-b: messaging, community, work, ranking, credentials, market, billing. realtime (public): WebSocket fan-out over Postgres NOTIFY.` |
| Container Apps jobs `render`, `harvest`, `batch`, `migrate` | Start on demand | Heavy and scheduled work, database migrations |
| PostgreSQL Flexible Server | Burstable B1ms (1 vCPU, 2 GiB), 32 GB, private access through the virtual network | All data |
| Storage account | Standard, locally redundant, hot | Files, images, PDFs, weekly database dump |
| Key Vault | Standard | Signing keys, gateway and API secrets |
| Log Analytics workspace with Application Insights | Pay as you go, first 5 GB a month free | Logs and traces |

Outside Azure, and free at this size: Cloudflare Free (DNS, CDN, TLS, firewall rules), GitHub's container registry for images, Brevo for email, PostHog, Sentry.

### What was left out, and what replaces it

| Left out | Replaced by |
| --- | --- |
| Front Door | Cloudflare Free |
| Service Bus | The event log and job table in Postgres |
| Functions | Background consumers inside warm services, and Container Apps jobs |
| Web PubSub | The `realtime` service with Postgres `NOTIFY` |
| Entra External ID | The `identity` service |
| Communication Services Email | Brevo |
| Container Registry | GitHub's registry |
| Private endpoints | Virtual network integration, which keeps Postgres off the public internet without them |
| Redis | In-process caches cleared by events |

### Network

- The Container Apps environment and the Postgres server share one virtual network. Postgres has no public address.
- Only `web` and `realtime` have external ingress, and both accept traffic from Cloudflare's address ranges only.
- `realtime` has its own container, so it carries the external ingress and `core-a` and `core-b` stay internal. This closed the open question; see Decided on 2026-11-22, record 12.
- Blob Storage and Key Vault are reached over their public endpoints with managed identity and firewall rules. Private endpoints for them are not used.
- Containers sign in to Postgres, Blob Storage and Key Vault with managed identities. No passwords are stored.

### Growing: what splits out, and when

Each step is a change to the deployment files. No service code changes.

| Signal | Action | Adds per month |
| --- | --- | --- |
| A core container's CPU over 60% at peak, or a crash should not take its group down | `Third container: market and` `billing` move to it | $6 |
| Feed p95 over budget, or the first container busy again | `content` gets its own container | $6 |
| More than 500 sockets open | `messaging` gets its own container (`realtime` already has one) | $6 |
| Sign-in latency over budget | `identity` and `people` get their own container | $6 |
| Around 20,000 accounts | Every service in its own container, two replicas on the busiest | See Cost and capacity |
| A service's tables dominate database load | That schema moves to its own Postgres server; its events move to Service Bus | A second server |

### Scaling rules

| Container | Scales on | Range at the floor |
| --- | --- | --- |
| `web` | 20 concurrent requests per replica | 1 to 3 |
| `core`-a, core-b and later containers | 50 concurrent requests per replica | 1 to 3 |
| `render`, `harvest` | Rows waiting in `platform.jobs` for that job type | 0 to 2 |
| `batch` | Schedule | 0 to 1 |

The database is the one part that does not scale on its own. Changing its size restarts it, so size changes happen at 4 am before a known busy day and are reversed after.

## Security

Access control moves from database policies into service code, which is the largest security change in this rewrite; everything else keeps today's rules on new plumbing.

### Sign-in and sessions (`identity`)

- **Passwords:** existing bcrypt hashes are imported and still verify. Each is re-hashed with Argon2id at the user's next sign-in. The breached-password check and Turnstile stay.
- **Two-factor:** existing authenticator secrets are imported so nobody re-enrols. Staff, recruiter and university areas still require it.
- **Session:** a rotating refresh token, stored hashed, in a `__Secure-` HTTP-only cookie. Reuse of an old token ends the session.
- **Access token:** a signed token valid for 10 minutes, carrying the gate flags. Keys live in Key Vault and rotate by key id.
- **Revocation:** a sanction, a role change, "not me", or signing out on other devices or everywhere bumps the user's token version; every service refuses older tokens within a second, through the event log. A local sign-out ends only that device's session. `web` learns of it when its next refresh is refused (decisions 2026-11-25, Q3 and Q11).
- **Signup gates:** university email domain, the university's live date and the portals flag are checked exactly as today.
- **At cutover:** sessions are not imported. Everyone signs in once.

### Who may do what

- Each service has an `authorize(actor, action, resource)` module. Every command and query calls it before touching data.
- The 62 pgTAP files of refusal tests are ported one for one. A table of allowed and refused cases runs against every method.
- Staff methods check role and two-factor level, and write the audit log before and after. A contract test fails if a staff method does not.
- Row-level security stays on as default-deny, so a leaked connection string for one service exposes one schema, not the database.
- Client-supplied user ids, prices and entitlements are never trusted. The token and the owning service are the only sources.

### Secrets and keys

- All secrets live in Key Vault and reach containers by managed identity. None are in images, the repo or CI logs.
- The Ed25519 keys that sign CVs and Record entries move from Supabase Vault to Key Vault as secrets. Key Vault's own key type does not offer Ed25519, so `credentials` signs in memory.
- The public key file at `/.well-known/skilient-cv-keys.json` does not change. Every CV and Record code issued before cutover still verifies.

### Network and edge

- Postgres is reachable only from inside the virtual network.
- `web` and `realtime` accept Cloudflare's addresses only.
- The content security policy, cookie rules, form rules, the CSP report endpoint and `security.txt` carry over unchanged.
- Rate limits are token buckets in Postgres for sign-in and signup, and in memory for everything else.

### Data protection

- TLS on every hop outside a process. Azure encrypts data at rest.
- Account deletion is a `user.deleted` event that every service must confirm. `identity` reports any service that has not confirmed after 24 hours.
- Logs carry a hashed user id and a request id, never names, emails or content.
- Private files are served by links that expire in minutes.

### Supply chain and review

- Pinned distroless base images, dependency updates by bot, an image scan and secret scan on every pull request.
- The OWASP ZAP run, the CSP sweep and the ASVS level 1 checklist are re-run against the new backend before cutover.
- `identity` and each `authorize` module get a line-by-line review by someone who did not write them.

## Observability and operations

One request id follows a click from the browser through every service to the database, and every alert that exists today has a counterpart.

### What is recorded

| Signal | How | Where it goes |
| --- | --- | --- |
| Logs | One JSON line per request and per job: request id, service, method, duration, result, hashed user id | Log Analytics (about 0.7 GB a month at the floor; 5 GB is free) |
| Traces | OpenTelemetry, W3C trace headers on every call; 10% sampled, plus every request over 500 ms | Application Insights, same free allowance |
| Errors | Sentry, with the existing scrubber | Sentry |
| Product analytics | Events from the log, forwarded by `trust` | PostHog EU, as today |
| Web Vitals | The existing `/api/vitals` route, now stored by `trust` | Postgres |
| Database | `pg_stat_statements`, CPU credits left, connections | Azure Monitor |

Axiom is dropped. Its feed was a Vercel log drain, which goes away with Vercel.

### Alerts

- The existing watchdog (`alert_conditions`, cooldowns, resolved notices, email to the recipients list) is ported into `trust` with the same conditions.
- Five Azure Monitor rules are added: database CPU credits under 50, connections over 28, container restarts, error rate over 2%, and any endpoint over its p95 budget for 15 minutes.
- Two Azure budget alerts, at $40 and $55 a month.

### Deploys

1. A pull request builds only the images whose service changed and runs that service's tests, the contract tests and the budget test.
2. On merge, images go to GitHub's registry, tagged with the commit.
3. The `migrate` job runs any new migrations. They only add; nothing a running version needs is removed.
4. Each changed container gets a new revision that receives 10% of traffic.
5. If its health checks and error rate hold for five minutes, it takes 100%. If not, traffic returns to the previous revision automatically.

Rollback is step 5 run by hand: point traffic at the previous revision. It takes seconds and needs no rebuild.

### Runbooks to write

| Runbook | Covers |
| --- | --- |
| Split a service out | Change the deployment file, deploy, confirm calls arrive over the network, remove it from the shared container |
| Busy-day database | Resize at 4 am the day before, confirm, resize back the night after |
| Restore drill | Restore to a scratch server from Azure backup and from the weekly dump; run the existing verify script, adapted |
| Signing key rotation | New key in Key Vault, publish the public key, switch, keep the old public key listed |
| Emergency ban | Works even if the staff area is down: one `identity` admin command |
| Stuck events | Find the consumer whose cursor stopped, read its error, replay |
| Brevo or GitHub outage | Jobs back off and retry; what users see meanwhile |

### Day-to-day cost of running it

Fourteen services are more moving parts than one database. Three things keep that manageable for a small team:

- One template. Every service has the same layout, commands, health checks and log format.
- One dashboard. A single workbook shows every service's rate, errors and p95 side by side.
- One on-call path. Every alert names the service, the runbook and the last deploy.

## Cost and capacity

At beta size the bill is about $57 a month and holds 30 people online comfortably, about 75 for a few hours. All figures are US dollars a month at list price in Central India, from `floor_model.py`.

### The floor bill

| Line | Per month |
| --- | --- |
| Postgres B1ms compute | $17.89 |
| Postgres storage, 32 GB, backups included | $4.19 |
| Container Apps: `web` and the three service containers always on, plus jobs | $34.05 |
| Private DNS zone and five alert rules | $1.00 |
| Blob Storage (2 GB) and Key Vault | $0.36 |
| Logs (0.7 GB), bandwidth, Cloudflare, image registry, Brevo | $0.00 |
| **Total** | **$57.49** |

### The bare-minimum usage behind it

| Assumption | Value |
| --- | --- |
| Accounts | 200 |
| Daily actives | 60 (30% of accounts) |
| Requests per daily active per day | 40, so 2,400 a day |
| Time on site per daily active per day | 25 minutes |
| Online at once | 10 on a normal evening, 30 at peak |
| Emails | About 500 a month, inside Brevo's free plan |
| Files | 10 MB per account |
| A socket is open somewhere | 49% of the month |

How Container Apps charges: an always-on replica that is doing nothing bills at a low idle rate, and at the full rate while it handles a request or holds an open socket. The first 180,000 vCPU-seconds and 360,000 GiB-seconds of active use each month are free.

### What the floor holds

| Part | Limit | People online it holds |
| --- | --- | --- |
| `web`, 0.5 vCPU | 60% CPU per replica; up to 3 replicas | 26 per replica, 78 at three |
| `core`-a, core-b and `realtime`, 0.25 vCPU each | 60% CPU per replica | About 175 per replica for `core`-a and core-b; `realtime` not yet measured |
| Postgres B1ms, at the design target | 20% of a core all day; a full core in bursts | 25 all day, about 94 in bursts |
| Postgres B1ms, at today's measured rate | Same | 12 all day, about 47 in bursts; a full burst allowance lasts about 17 hours at 30 online |
| Database connections | 35 | Not a limit below three replicas |

`web` is the first part to fill. It adds a second replica by itself at about 26 online, which costs about $0.05 for each hour it runs.

### As load grows

"At target" assumes the feed design halves database work per online user to 0.008 vCPU. "At today's rate" assumes it stays at 0.016. Busy days mean 4 days a month on a larger database.

| Step | Accounts | Online, normal / busy day | Layout | Database, normal / busy day | At target | At today's rate |
| --- | --- | --- | --- | --- | --- | --- |
| Beta floor | 200 | 10 / 30 | `web` + 3 service containers | B1ms | $57 | $57 |
| Launch, normal days only | 5,000 | 100 / 100 | `web` (2 at peak) + 5 service containers | B2ms | $210 | $505 |
| Launch with busy days | 5,000 | 100 / 300 | Same; `web` up to 6 on busy days | B2ms / D4ds\_v5 | $256 | $560 |
| 3x launch | 20,000 | 333 / 1,000 | Every service in its own container | D4ds\_v5 / D16ds\_v5 | $912 | $1,423 |
| 10x launch | 60,000 | 667 / 2,000 | Same, two replicas on the busiest | D8ds\_v5 / D32ds\_v5 | $1,627 | $2,456 |

For reference, all 14 services each kept warm in their own container at beta size is about $113.

Against staying put: the earlier model put Supabase Pro with Vercel at $75 for beta, $303 for launch with busy days, $1,231 at 3x and $2,433 at 10x. This design is cheaper at beta, and cheaper from launch onward only if the feed target is met.

### What could move these numbers

| Item | Effect | Status |
| --- | --- | --- |
| A new Azure account gets B1ms and 32 GB free for 12 months | Would drop the floor to about $23 in year one; not taken, per decision 5 | Listed by Microsoft; needs a new account |
| An open socket may not count as "active" for billing | Floor drops by about $3 | Unknown until the first bill; the model assumes the costly case |
| B2s and B2ms prices | Launch rows move by up to about $20 | Estimated from the B1ms price; not looked up |
| Virtual network integration | Assumed free apart from the DNS zone | Confirm on the first bill |
| `web` CPU per request | Assumed 40 ms; halving it halves `web` replicas at every step | Measured in the load test |
| Supabase during the overlap | $25 to $75 for the month both run | One-time |

Not included: staff time, a paid Azure support plan, and taxes.

## Build plan

Everything is built in one phase on one long-lived branch, in a fixed order of workstreams, and nothing reaches production until the whole phase passes its checks. Today's stack keeps serving users throughout.

### Repository layout

The existing repo becomes a pnpm workspace. The Next.js app moves, unchanged, into `apps/web`.

```
apps/web/                  the existing Next.js app
services/<name>/           one folder per service
  src/api/                 handlers for the contract's methods
  src/domain/              rules, pure TypeScript, no I/O
  src/store/               queries (typed SQL)
  src/authorize.ts         who may do what
  src/events.ts            what it publishes and handles
  migrations/              plain SQL, forward-only
  test/                    unit, refusal, contract, budget
jobs/render  jobs/harvest  jobs/batch  jobs/migrate
packages/contracts/        Protobuf files and generated clients
packages/platform/         server bootstrap, transports, event log, job queue,
                           scheduler, logging, tracing, caches, token checks
packages/host/             runs one or many services in a process
packages/testing/          Postgres test containers, fixtures, golden-test runner
deploy/                    Bicep for Azure, one file per layout step
tools/cutover/             table map, copy, verify, auth import
perf/                      budgets.json, k6 journeys
```

### Stack

| Concern | Choice |
| --- | --- |
| Runtime | Node 22, TypeScript strict |
| RPC | ConnectRPC over HTTP/2; in-memory transport when co-hosted |
| HTTP server | Express 5 |
| Database access | `postgres.js` with Kysely for typed queries |
| Validation | Protobuf types at the edge of each service, Zod inside |
| Tests | Vitest; Postgres in a test container; Playwright for the existing end-to-end specs; k6 for load |
| Images | Multi-stage build, distroless Node base |
| Infrastructure | Bicep, deployed by GitHub Actions |

### Workstreams, in order

W0 comes first. W1 and W2 follow, because every other service needs users and profiles. W3 to W12 can then run in any order. W13 re-points the web app service by service as each one lands. W14 to W16 close the phase.

| # | Workstream | SQL to port (lines, approx.) | Done when |
| --- | --- | --- | --- |
| W0 | Foundation: workspace, `platform`, `host`, `contracts` toolchain, test harness, CI, Bicep for the floor, a sample service deployed | 0 | The sample service runs co-hosted and standalone from the same image, CI runs its contract tests on both transports, and an HTTP/2 call between two containers succeeds |
| W1 | `identity` | 2,700 | Sign-up, sign-in, two-factor, password change, deletion and every signup gate pass the existing auth specs; imported hashes verify |
| W2 | `people` | 2,300 | Shell call meets its budget; friends, blocks, privacy and onboarding specs pass |
| W3 | `content` | 3,000 | Feed budgets met at 300 simulated users; posts, comments, polls, survey and share specs pass |
| W4 | `messaging` and `realtime` | 1,500 | Chat p95 under 150 ms to fan-out; badges update within 500 ms; two replicas deliver every message once |
| W5 | `work` | 10,500 | GitHub connect, harvest job, skills, endorsements, credentials, code checks, paths, tasks and swaps specs pass |
| W6 | `ranking` | 2,250 | Nightly run reproduces `docs/ranking-reference.md` exactly from its own schema |
| W7 | `community` | 6,500 | Seat-lock concurrency test passes; societies, events, tickets, check-in and yearbook specs pass |
| W8 | `credentials` | 3,650 | A CV and a Record entry signed by the new service verify with the existing public keys, and old ones still verify |
| W9 | `notify` and `media` | 1,300 | Email, push and digest tests pass with the fake Brevo and push services; unused files are deleted |
| W10 | `trust` | 4,550 | Every staff method audits before and after; reports, sanctions, appeals, config and inbox specs pass |
| W11 | `market` | 12,050 | Portal specs pass with the flag on; with it off, every portal route still returns 404 |
| W12 | `billing` | 4,250 | Entitlement checks, the simulated gateway, invoices and the webhook concurrency tests pass; no checkout route is surfaced in the UI |
| W13 | `web` re-point | 146 calls, 52 table reads | No Supabase import remains in `apps/web`; all end-to-end specs pass against the new backend except faculty portal specs |
| W14 | Cutover tooling | 263 tables mapped | Two full rehearsals complete and verify clean |
| W15 | Performance |  | Budget file green; k6 thresholds pass at 30, 100 and 300 users; database work per user recorded |
| W16 | Security |  | ZAP, CSP sweep and ASVS level 1 re-run clean; `identity` and every `authorize` module reviewed |

### How each function is ported

Every one of the roughly 1,500 SQL functions is first put in one of five bins, in a tracking sheet kept in the repo.

| Bin | Becomes |
| --- | --- |
| Read called by the app | A query method |
| Command called by the app | A handler: validate, authorise, one transaction with its events, row-count check |
| Trigger or internal helper | Code in the same transaction, or an event handler in another service |
| Scheduled job | A schedule row and a handler, or a `batch` job |
| Wrapper or plumbing that only existed for Supabase | Deleted |

**Golden tests keep the port honest.** Before a service is written, each of its public functions is called on the current local stack with recorded inputs, and the outputs are saved. The new service must return the same results for the same inputs. A service is not done until its golden tests match.

### Rules for the new code

These replace the Supabase-specific lines in the repo's "Never" list. The rest of that list stands.

- No table without an owning service, default-deny row-level security, and a refusal test.
- No query that names another service's schema. A lint rule and the database roles both enforce it.
- No business rule in `apps/web`.
- No user id, price or entitlement taken from the client.
- No service-to-service call inside a loop. Use the batch method.
- No call chain deeper than two.
- No schema change outside the owning service's `migrations/` folder.
- No new endpoint without a line in `perf/budgets.json`.

### The phase is done when

- [ ] All end-to-end specs pass against the new backend except faculty portal specs, in both themes, including the portal pass
- [ ] Golden tests match for all 251 public functions
- [ ] Every ported refusal test passes
- [ ] Budget file is green and k6 passes at 30, 100 and 300 users
- [ ] Ranking reference and seat-lock concurrency tests pass
- [ ] Old CV and Record codes verify; new ones verify with the same public key file
- [ ] Security checks are clean
- [ ] Two cutover rehearsals verified clean, and a rollback rehearsal completed
- [ ] Restore drill passed on Azure
- [ ] Budget alerts set at $40 and $55
- [ ] `docs/decisions.md`, `CLAUDE.md` code maps and the setup checklist updated

## Implementation plan

Production moves in one announced maintenance window: freeze writes, copy, verify, switch Cloudflare to Azure. Supabase and Vercel stay intact and read-only for 14 days as the way back.

### 1. Provision

1. Create the resource group, virtual network, Container Apps environment, Postgres server, storage account, Key Vault and Log Analytics workspace from `deploy/`.
2. Create one managed identity per container and grant it its database role, its Blob containers and its Key Vault secrets.
3. Create the Blob containers that mirror today's buckets, with the same public or private setting.
4. Add the custom domains and certificates to `web` and `realtime`. Keep Cloudflare pointing at Vercel.
5. Set the budget alerts.

### 2. What moves, and how

| From Supabase | To | Method |
| --- | --- | --- |
| 263 tables in `public` and `private` | Service schemas | `tools/cutover/table-map.yaml` names the target schema, table and any column changes for each. A data-only dump is loaded into a staging schema, then moved by generated SQL. Ids are kept. |
| `auth.users`, identities, two-factor factors | `identity` | Import script. bcrypt hashes are kept as they are. |
| Sessions and refresh tokens | Nowhere | Dropped. Everyone signs in once. |
| Storage buckets | Blob containers | Copy script, adapted from `scripts/restore/copy-storage.mjs`; paths are kept so stored URLs map one to one. |
| Vault secrets: CV signing keys, export secret, push keys | Key Vault | Read once under two-person review, written to Key Vault, never to disk |
| `pgmq` queues | `platform.jobs` | Drained before the freeze, so they are empty. Anything left is re-queued. |
| `pg_cron` jobs | Schedule rows | Created by migrations; last-run times are carried over |
| Triggers, functions, policies | Nothing | They are not copied. The services replace them. |

### 3. Verification

The same script runs in every rehearsal and at cutover. Any failure stops the cutover.

- Row count per table, source against target.
- A checksum over the key columns of every table.
- Every stored file present, with matching size and hash.
- A sample of 200 issued CV and Record codes verifies on the new stack with the existing public keys.
- A sample of 50 accounts signs in with a test password hash and passes two-factor.
- The golden tests re-run against the copied data.
- The end-to-end smoke subset passes against the new stack before it is public.

### 4. Rehearsals

- **Two full rehearsals** on a fresh copy of production, each timed from freeze to verified.
- **One rollback rehearsal**, including the reverse copy described below.
- **One load test** on the real floor layout, and one with every service split out, to prove both layouts under load.

### 5. Cutover runbook

| Step | Action | Who can stop it |
| --- | --- | --- |
| 7 days before | Announce the window in the app and by email. Confirm webhook and callback URLs to change. |  |
| 1 day before | Final rehearsal on that day's data. Go or no-go. | Ahmed |
| T+0 | Maintenance page on. Supabase set read-only: write privileges revoked from the app roles. Queues drained. |  |
| T+5 min | Final dump, load and transform. Final file sync. |  |
| T+25 min | Verification script. | Any failure: abort, undo the freeze, try another day |
| T+35 min | Smoke tests against Azure by direct address. | Any failure: abort |
| T+45 min | Cloudflare origin switched to Azure. GitHub App webhook and callback, Brevo webhook and Turnstile hostnames updated. |  |
| T+50 min | Maintenance page off. Watch errors, latency and sign-ins for two hours. | Rollback criteria below |

The times are estimates for a beta-sized database. The rehearsals replace them with measured ones.

### 6. Rollback

- **Before the maintenance page comes off:** undo the freeze and leave Cloudflare on Vercel. Nothing was lost because nothing was written.
- **In the first 24 hours after:** roll back if sign-in fails for more than 5% of attempts, if any data is found wrong, or if error rate stays above 2% for 30 minutes. A reverse-copy script moves rows written on Azure back into Supabase, then Cloudflare returns to Vercel.
- **After 24 hours:** fix forward. The reverse copy is not trusted past a day of new writes.
- **Day 14:** take a final Supabase backup, store it in Blob Storage, and close the Supabase and Vercel projects.

### 7. After cutover

- Watch the first bill line by line against the cost table, especially the idle and active split.
- Hold the two-container layout for two weeks, then decide on a third container from measured CPU.
- Remove the Supabase client libraries, the `supabase/` folder and the Supabase rules from `CLAUDE.md`.

## Risks and decisions

The biggest risk is the size of the rewrite, and the decisions below are settled before building starts.

### Risks

| Risk | Why it matters | What limits it |
| --- | --- | --- |
| The rewrite is large | 57,053 lines of SQL took 18 phases to build. Porting it in one phase means a long stretch with nothing shippable. | Golden tests per function, the fixed workstream order |
| Access control moves out of the database | Today a missed check is caught by a policy. Tomorrow a missed check is a leak. | Ported refusal tests, default-deny database roles, independent review of every `authorize` module |
| A home-built sign-in service | Authentication is where mistakes cost most | Established libraries only, the ASVS checklist, review, and the alternative in decision 1 |
| The floor has no spare room | Each container hosts six or eight services, so one crash takes that group down for the seconds it takes to restart. The $57 bill is $7.49 over the ceiling. | Health checks and fast restart; more containers cost $6 each |
| Small containers get throttled | 0.25 and 0.5 vCPU limits can add tens of milliseconds to a CPU-heavy request | Measured in the load test; `web` at 1 vCPU costs about $12 more |
| The smallest database runs on burst credit | Sustained load above 20% of a core drains it; a drained server is slow | Credit alert; resize ahead of busy days; one source lists B1ms as planned for retirement, so the next size up may become the floor |
| Events arrive at least once, and copies lag | A badge or a score can be briefly out of date | Idempotent handlers, the nightly reconcile, 30 s cache limits |
| Fourteen services for a small team | More to deploy, watch and debug than one database | One template, one dashboard, one deploy pipeline |
| Some prices were not re-checked | I could not open Azure's price API in this session | Listed under "What could move these numbers"; confirm before committing |
| Two-factor secrets and signing keys must leave Supabase intact | If either cannot be exported, users re-enrol or keys rotate | Test the export in the first rehearsal |

### Decisions for Ahmed

| # | Decision | Recommended default | The alternative |
| --- | --- | --- | --- |
| 1 | How to build `identity` | Our own TypeScript service, so it can be co-hosted at the floor | Run Supabase's open-source auth server as the identity container. Less new security code and no user migration risk, for about $6 a month more. |
| 2 | Floor layout | `web` plus one service container, $45 | Two service containers, $51. Real network calls between services in production from day one. |
| 3 | Row-level security | Default-deny with one policy per owning service | Also keep per-user policies as a second check. Safer, and slower on every query. |
| 4 | Sockets | One per visible tab on every page, which meets the 2 s badge target | Only on chat and check-in screens. Saves about $3; badges update on navigation. |
| 5 | Azure account | Open a new account for the 12-month free database, about $22 a month saved in year one | Use an existing account |
| 6 | Database network | Private, through the virtual network | Public address with firewall rules. Simpler admin access, weaker protection. This cannot be changed after the server is created. |
| 7 | Where `web` runs | Container Apps, so everything is on Azure | Stay on Vercel Hobby. Saves about $14, but its terms exclude commercial use. |
| 8 | Portals and billing | Port `market` and `billing` in this phase, as you asked for one phase | Port them later, while their flag is off. That removes about 16,300 lines, 28% of the SQL, from this phase. |

Decision 8 was settled on 2026-11-22: market and billing port in this phase. The record below lists every answer.

### Decided on 2026-11-22

| # | Decision | Effect on this PRD |
| --- | --- | --- |
| 1 | Identity as our own TypeScript service | As recommended. |
| 2 | Two service containers, $51 | Floor was `web` plus two service containers, $51.34 a month. Superseded by record 12. |
| 3 | Default-deny policies, one per owning service | As recommended. |
| 4 | One socket per visible tab | As recommended. |
| 5 | Existing Azure account, $5k startup credits | The new-account saving in the table above, about $22 a month in year one, is lost. |
| 6 | Database on a private network | As recommended. |
| 7 | `web` on Container Apps | As recommended. |
| 8 | Port `market` and `billing` in this phase; billing ships dormant, with no checkout surfaced | Keeps the 16,300 lines and 28% of the SQL in this phase. No service stays on Supabase after cutover. |
| 9 | Every beta student gets a paid plan free until payment gateways exist | Azure services read entitlements from billing; checkout stays dormant. |
| 10 | Beta sign-ups offered free student pro as a marketing offer | Same as 9. |
| 11 | Marketing pages for universities and recruiters stay live; their portals are ported in this phase, behind their flags. The faculty portal waits | `market` ports too, so sales leads move to Azure. The teacher portal's SQL, about 2,980 lines, moves out of this phase; its tables still copy at cutover. |
| 12 | `realtime` gets its own container | Floor is `web` plus three service containers, $57.49 a month, $7.49 above the $50 ceiling. `realtime` carries its own external ingress, so `core-b` stays internal. The Network open question is closed. |

## Sources

Prices and limits are from search results and from the Azure price API run earlier in this project. I could not re-open the price API today, so nothing here was re-fetched; confirm in the Azure pricing calculator before committing.

- [Billing in Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/billing): idle and active rates, the conditions for idle billing, the monthly free grant
- [Azure Container Apps pricing](https://azure.microsoft.com/en-us/pricing/details/container-apps/): active thresholds of 0.01 cores and 1,000 bytes a second
- [Understanding idle usage in Azure Container Apps](https://techcommunity.microsoft.com/blog/appsonazureblog/-/4419197): idle vCPU price, memory price unchanged when idle
- [B1ms prices by region](https://sparecores.com/database/azure/Standard_B1ms): $0.0245 an hour in Central India; lists B1ms as planned for retirement
- [Limits in Azure Database for PostgreSQL](https://docs.azure.cn/en-us/postgresql/flexible-server/concepts-limits): B1ms allows 50 connections, 35 for users; no built-in PgBouncer on Burstable
- [PgBouncer in Azure Database for PostgreSQL](https://docs.azure.cn/en-us/postgresql/flexible-server/concepts-pgbouncer): available on General Purpose and Memory Optimized
- [Azure free account for PostgreSQL Flexible Server](https://learn.microsoft.com/en-ie/azure/postgresql/flexible-server/how-to-deploy-on-azure-free-account): 750 hours of B1ms and 32 GB for 12 months
- [GitHub Container Registry billing note](https://github-docs.devex.oit.umn.edu/container-registry/): image storage and bandwidth currently free
- Repo: `supabase/migrations/` (80 files), `docs/prd/10-non-functional-requirements.md`, `docs/load-test.md`, `tests/load/`, `CLAUDE.md`
- Models: `floor_model.py` (this document), `lean_model.py` and `cost_model.py` (the earlier comparisons)
