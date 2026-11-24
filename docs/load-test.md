# Load test

PRD 10 "Load test before launch": a k6 script replaying a busy-hour mix at **300 concurrent users for 30 minutes**,
with every target met and **no errors above 0.1%**. Phase 13; decisions.md "Phase 13 finish" (2026-11-04).

| Piece | Where |
| --- | --- |
| Journeys and thresholds | `tests/load/journeys.js`, `tests/load/lib/thresholds.js` |
| Load data | `scripts/load/seed.mjs` (helpers `scripts/load/lib.mjs`, unit test `tests/unit/load-test.test.ts`) |
| Database report | `scripts/load/db-report.sql` (`pg_stat_statements`) |
| Workflow | `.github/workflows/load-test.yml` (manual) |

## The mix (300 students, 5-minute ramp, 30 minutes steady)

The student-first scope (portals off): no recruiter or job-fair traffic. Event day replaces the job-fair queue as
the busy moment with a queue, because it is the one with a race for seats.

| Scenario | VUs | What one iteration does |
| --- | --- | --- |
| browse | 155 | `/feed`, two "load more" pages (`feed_page` + `post_cards`), views and up to two survey answers per page, `/openings`, an Openings category, `/me/record`, sometimes `/notifications` |
| social | 60 | the DM page, three messages to a friend timed until the friend's Realtime subscription has them, a comment on the friend's post timed until the friend's notification event and `nav_badges()` |
| search | 40 | `/explore`, then `search_people`, `search_ventures`, `search_chats` |
| events | 45 | an event page, `register_event` (one event in ten has 25 seats, so registrations race for the last seat and spill to the waitlist), the ticket page and `event_ticket`, then an officer's `check_in_scan`; one scan in ten is repeated and must not be green |
| vitals | 2 | a real browser on Lighthouse's mobile profile (150 ms RTT, 1.6 Mbps, 4x CPU) through Vercel: `/feed`, `/openings`, `/me/record` (and its transcript PDF, the same Chromium path as the CV) and an event, with one keyboard interaction each |

**Pages without Vercel (2026-11-05).** On Vercel Hobby the platform's DDoS mitigation challenges every
non-browser request from one address, and only Pro can bypass it, so the 298 API users never request a page
from Vercel. For each page they replay its database work straight against Supabase, as measured on the
local stack: the proxy's `getUser()` and `my_gate_state()`, then in parallel the layout's `getUser()`,
`my_restriction()`, `tour_state()`, `touch_activity()` and profile, and the page's own reads
(`page()` in `tests/load/lib/api.js`). That loads the database, Auth and PostgREST as 300 students would;
Vercel's rendering is measured by the two browsers only. Once the project is on Pro, a run through Vercel
with a System Bypass for the runner's address covers the rest.

Think times are 2–12 seconds between steps, so the mix is people reading, not a request flood.

## Targets (thresholds)

The run fails if any threshold misses. PRD 10 measures at p75 unless a row says p95.

| PRD 10 target | k6 metric | Threshold |
| --- | --- | --- |
| Errors ≤ 0.1% | `http_req_failed`, `checks` | rate < 0.001, > 0.999 |
| TTFB from Pakistan ≤ 600 ms | `page_data` (each page's database work from the runner; the browsers' TTFB is `browser_web_vital_ttfb`) | p75 < 600 ms |
| Feed first page visible ≤ 1.5 s | `feed_first_page` (the `/feed` database work and its first cards) | p75 < 1.5 s |
| Next feed page ≤ 400 ms | `feed_next_page` (`feed_page` + `post_cards`) | p75 < 400 ms |
| Survey saved ≤ 500 ms | `survey_saved` (`answer_survey`) | p75 < 500 ms |
| Chat delivered ≤ 1 s p95 | `chat_delivered` (send until the recipient's Realtime event) | p95 < 1 s |
| Search ≤ 300 ms p95 | `search_results` | p95 < 300 ms |
| Badge update ≤ 2 s | `badge_update` (comment until the author's event and `nav_badges()`) | p75 < 2 s |
| CV PDF ≤ 10 s p95 | `pdf_ready` (Record transcript, from the browsers) | p95 < 10 s |
| LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 | `browser_web_vital_lcp/inp/cls` | p75 |
| *Derived:* Openings and My Record first view | `openings_ready`, `record_ready` | p75 < 1.5 s (the feed's budget) |
| *Derived:* register and check in | `event_registered`, `event_checked_in` | p75 < 500 ms (the survey's save budget) |
| *Correctness:* no oversold event, no double check-in | `oversold` (teardown reads every event's stats), `double_checkin` | count == 0 |

Measured elsewhere, not by this run:

- **`feed_page` ≤ 150 ms and other reads ≤ 50 ms in the database; anything over 100 ms p95 gets a ticket:**
  `scripts/load/db-report.sql` after the run (the workflow resets `pg_stat_statements` first and prints the report).
- **At most 3 database round trips per page:** a code rule, checked in review.
- **First GitHub skills ≤ 5 min for 90%:** the GitHub worker against GitHub's API (`/ops/metrics`, `pnpm test:worker`).
- **Real-user LCP and INP:** Vercel Speed Insights and the `web_vitals` alert (`docs/alerts.md`).

## Running it

Accounts and secrets (`docs/archive/supabase-era/setup-checklist.md` Phase 13, "Load test"): the scratch project's ref and database
password (shared with the restore drill), `LOAD_PASSWORD`, `LOAD_APP_URL` (a Vercel deployment whose environment
points at the scratch project, region `bom1`), and a Grafana Cloud k6 token and project id.

On the scratch project, before the first run:

1. **Raise the Auth rate limit** for sign-ins (Authentication → Rate Limits) to at least 1,000 per 5 minutes:
   every virtual user signs in once from the same few IPs. Scratch only; production keeps its limits.
2. **Turn captcha off** for Auth (the k6 users sign in with the password grant).
3. Check that `pg_stat_statements` is enabled (it is by default).

Then Actions → **Load test** → Run workflow, `confirm` = `load the scratch project`:

- `step: seed-and-run`, `profile: full`, `where: cloud` is the launch run. Seeding 5,000 students takes about
  10–15 minutes the first time and seconds after (it is idempotent).
- `profile: smoke` runs a few users for 2 minutes, to check the setup before the full run.
- `where: github` runs from GitHub's runner in the US: fine for checking that the journeys work, but every
  timing carries about 250 ms of round trip, so it doesn't count against PRD 10.

The seeder refuses every project but the local stack and the one named in `LOAD_CONFIRM_SCRATCH`, and never the
production ref. A restore drill needs an empty scratch project, so seed after a drill, not before.

Locally (the smoke run this phase used):

```bash
node --no-warnings scripts/load/seed.mjs   # SUPABASE_URL, SUPABASE_SECRET_KEY, DATABASE_URL, LOAD_PASSWORD, LOAD_USERS=60 …
k6 run -e LOAD_SCALE=0.01 -e LOAD_RAMP=10s -e LOAD_HOLD=1m -e SUPABASE_URL=… -e SUPABASE_PUBLISHABLE_KEY=… -e APP_URL=http://127.0.0.1:3100 -e LOAD_PASSWORD=… tests/load/journeys.js
```

## What the data looks like

5,000 students at one university (the busiest case: every feed, search and leaderboard read covers the whole
population), about 14 friends each, 30 days of posts (20,000) and comments, a DM thread per k6 chat pair,
300 ventures, 10 verified societies with two officers each, 120 event-day events (starting 90 minutes after the
seed, so check-in is open; a re-run moves them and clears the last run's registrations), and past events whose
attendees hold sealed Record entries: the first 1,000 students (the accounts k6 signs in as) hold about two each. The
Record step tops up anyone in that range without an entry, so a re-run or a larger `LOAD_USERS` never leaves the
k6 accounts with empty ledgers, and it seals with eight drainers at once.

## Results

| Date | Run | Result |
| --- | --- | --- |
| 2026-11-04 | Local smoke: 7 VUs plus 1 browser for 1 minute, local stack and a production build on one 4-core container | Every journey and check passes (0 failed requests). p75: page TTFB 81 ms, feed first page 650 ms, next page 33 ms, survey 6 ms, register 27 ms, check-in 15 ms; p95: chat delivered 471 ms, search 30 ms, PDF 1.4 s; badge p75 238 ms; LCP p75 739 ms, CLS 0; no oversell, no double check-in. **INP p75 700 ms missed** (3 samples). |
| 2026-11-05 | Smoke runs #5–#9 on the scratch project (Nano), 9 VUs from the self-hosted runner | Found and fixed: the proxy signed students out when the gate check failed under load (now a 503 that keeps the session); scheduled jobs used about 560 s of database time an hour (one `wake-workers` job, `feed-stage` only on changed posts); the first feed page cost 2.5–3.5 s in the database (two-step ranking, one exploration query). Vercel Hobby's DDoS mitigation blocks non-browser traffic from one address, so pages now replay their database work against Supabase. **Run #9: Nano runs out of memory at 9 users.** Swap about 550 MB on about 430 MB of RAM, memory commitment 1.87 GB ("severe"), 85% IOwait; every call 50–100 times slower than on the local stack (`my_gate_state` 236 ms mean, page work p75 7.7 s). Not a code limit: the next run needs a larger compute size. |
| | Full run (300 VUs, 30 minutes) | Not run yet: waits on the compute size. The build-plan box stays open until it passes. |

**The smoke INP miss.** The slowest interaction is opening the ⌘K menu (`components/ui/command-menu.tsx`). Measured
alone in Playwright at the same 4x CPU throttle it takes 104–272 ms between runs, so the 700 ms in the smoke run is
mostly the container itself: k6, Chromium, the Next server and the whole Supabase stack share four cores there.
Removing the overlay's backdrop blur made no measurable difference. The opening code does no work beyond filtering
about 20 items, so nothing was changed. The full run measures INP from a Grafana Cloud machine with nothing else on it.
If it misses there, the follow-up starts with this menu.

## Where the runs go from (2026-11-05)

Grafana Cloud's free plan allows 100 virtual users per test (and 500 VU-hours a month), so only the smoke run goes
from Grafana's Mumbai zone (`where: cloud`). **The full 300-user run goes from the self-hosted runner in Pakistan**
(`where: github`): no VU cap, and it is the literal reading of PRD 10's "TTFB from Pakistan" (about 30–60 ms to
Mumbai). That machine needs Chromium for the two browser users (`sudo dnf install -y chromium` on Fedora), about
10 Mbps, and to stay awake for the 40 minutes. The run summary, `k6-summary.json` and the database report are the
run's artifact.
