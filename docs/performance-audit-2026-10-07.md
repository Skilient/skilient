# Skilient performance audit

Source review dated 2026-10-07. This is a targeted review of rendering, authentication, feed, chat, images, PDF export, workers, and performance checks. No production timings, query plans, or production bundle measurements were collected. Priorities below reflect code structure and expected impact, not measured speedups. Application code was not changed.

## Recommended order

### 1. Stream the feed independently of secondary widgets — high priority

The feed first awaits identity and ecosphere settings, then waits for nine parallel operations before returning its UI. Those operations include feed content, progress, questions, composer options, and followed updates. Parallel execution helps, but the slowest secondary operation still blocks the returned page. [VERIFY: app/(app)/feed/page.tsx:47] [VERIFY: app/(app)/feed/page.tsx:57]

Recommendation: split progress, questions, composer extras, and followed updates into async components with individual Suspense fallbacks. Keep ecosphere visibility checks ahead of the feed where required. Start independent work earlier. Add a feed-specific loading skeleton; preserve the existing shared app loading boundary.

Measure: navigation-to-visible-feed time, server render spans, and LCP before and after with identical accounts/data.

### 2. Reduce database work in fresh feed ranking — high priority at scale

`build_feed` computes `feed_score` and sorts by that score before limiting the candidate table to a configurable default of 300. The score function reads post/profile data and aggregates commenters, among other checks. Thus the limit does not cap the number of posts scored. The selection loop also repeatedly sorts remaining candidates and periodically queries exploration posts using `ORDER BY random()`. [VERIFY: supabase/migrations/20260929040000_feed_ranking.sql:302] [VERIFY: supabase/migrations/20261005000000_ranking.sql:386]

Feed sessions already reuse ordered IDs when a valid cursor is supplied; preserve that optimization. Fresh sessions call `build_feed`. [VERIFY: supabase/migrations/20260929040000_feed_ranking.sql:413]

Recommendation: profile ranking with realistic university/global data. Precompute viewer-independent quality/engagement inputs, read viewer/configuration inputs once, and replace repeated lookups with set-based joins where possible. Consider a bounded candidate retrieval stage before personalized scoring, explicitly testing its effect on ranking quality and exploration fairness. Inspect query plans before choosing indexes; do not add speculative indexes.

Measure: fresh-session versus cursor-page latency, rows scored, buffer reads, and p95 RPC duration. Use a staging transaction for EXPLAIN ANALYZE on write-capable feed functions.

### 3. Shorten feed enrichment waterfalls — high priority, modest scope

`getPostCards` waits for card rows, then tiers, then surveys. After the card rows arrive, tier lookup and survey assignment have their required inputs and need not wait on each other. Ranked feed retrieval adds another preceding RPC. [VERIFY: lib/data/posts.ts:182] [VERIFY: lib/data/posts.ts:307]

Recommendation: run tier lookup and survey assignment concurrently after cards load. If round-trip time remains dominant, evaluate a single authorized RPC returning the complete card payload. Preserve survey assignment behavior and row visibility rules.

Measure: RPC count and critical-path duration for one feed page, including pinned cards.

### 4. Remove chat's redundant list loading — high priority, modest scope

The chat layout loads `getThreads()`. `getThread()` also awaits `getThreads()` before starting people/messages/receipt/settings queries. `getThreads` is an ordinary async function, unlike the request-cached current-user helper. [VERIFY: app/(app)/chat/layout.tsx:9] [VERIFY: lib/data/chat.ts:26] [VERIFY: lib/data/chat.ts:135]

Recommendation: request-memoize the thread list to deduplicate a full layout/page render. Longer term, fetch one thread's metadata directly instead of making conversation loading depend on the full inbox. Start independent detail queries together, and sign images as soon as message paths are available. Keep thread membership checks intact.

Measure: `my_threads` calls per full chat load and time to first conversation messages, including users with large inboxes.

### 5. Stabilize realtime subscriptions and coalesce badge refreshes — medium/high priority

The navigation badge effect depends on both user ID and pathname, so route changes remove and recreate its channel. Every incoming chat insert schedules a separate refresh timer; notification changes and window focus also trigger calls without an in-flight guard. [VERIFY: components/shell/nav-badges.tsx:35] [VERIFY: components/shell/nav-badges.tsx:49] [VERIFY: components/shell/nav-badges.tsx:64]

Recommendation: separate the user-scoped subscription from navigation refreshes. Coalesce event bursts into one refresh, deduplicate in-flight requests, and cancel timers on cleanup. Preserve account-change resets and RLS-authorized event delivery.

Measure: channel joins per navigation and `nav_badges` requests during a burst of messages.

### 6. Make public marketing pages eligible for static delivery — high potential, architectural scope

The root layout reads a request-specific CSP nonce through `headers()`, making pages under it dynamic. The proxy refreshes the session before returning for public paths. [VERIFY: app/layout.tsx:40] [VERIFY: proxy.ts:43]

Recommendation: evaluate a separate public rendering/security path so marketing content can be statically rendered and cached. This requires a static-compatible CSP strategy and review of theme/analytics inline scripts and any personalized public navigation. Merely adding a cache header or moving one `headers()` call is insufficient; never reuse per-request nonce HTML as shared cached content.

Next.js documents that nonce-based CSP requires dynamic rendering: https://nextjs.org/docs/app/guides/content-security-policy

Measure: public-page TTFB, cache-hit ratio, and origin invocations.

### 7. Audit repeated authentication round trips — high reach, security-sensitive

Protected requests call `getUser()` and `my_gate_state` in the proxy; rendering's cached `getCurrentUser()` calls `getUser()` again and then reads the profile. Its React cache deduplicates rendering calls, not the separate proxy phase. [VERIFY: proxy.ts:47] [VERIFY: lib/auth/current-user.ts:13]

Recommendation: trace these calls first, then consolidate repeated checks within each execution boundary and reduce duplicated gate/profile reads where feasible. Any move toward verified claims must preserve immediate suspension/deletion handling, MFA, revocation expectations, and authorization in server actions/RPCs. Do not replace checks with unverified session-cookie data or globally cache user state.

Measure: authentication/gate contribution to protected-page TTFB.

### 8. Serve appropriately sized feed images and bound long-feed rendering — medium priority

Post images use native lazy-loaded `img` elements, public storage URLs, and no responsive source variants. Upload processing already creates WebP images with a 2,000-pixel maximum side and long-lived cache headers. The feed appends pages and renders every accumulated post. [VERIFY: components/posts/post-card.tsx:187] [VERIFY: lib/storage.ts:6] [VERIFY: lib/images/reencode.ts:54] [VERIFY: lib/images/content-images.ts:51] [VERIFY: components/posts/feed-list.tsx:55] [VERIFY: components/posts/feed-list.tsx:85]

Recommendation: provide responsive image widths using an approved image transformation service or generated variants, with accurate sizes/srcset. Keep lazy loading below the fold; prioritize an image only when measurements identify it as LCP. For long browsing sessions, evaluate content-visibility first, then windowing if profiling shows growing DOM/render cost. Preserve scroll position and keyboard/screen-reader access.

Measure: image transfer bytes on mobile, decoded image memory, and interaction latency after many loaded pages.

### 9. Lazy-load optional interface code — medium priority

The shared shell statically imports TourHost, which statically imports Floating UI and tour definitions. Profile image upload statically imports the cropper. [VERIFY: components/shell/app-shell.tsx:11] [VERIFY: components/tour/tour-host.tsx:6] [VERIFY: components/profile/image-upload.tsx:6]

Recommendation: put tour implementation behind a small eligibility/replay wrapper and load the cropper when editing begins. Suspense around a statically imported component does not itself split its code. Use production bundle analysis to quantify savings before expanding this work.

### 10. Reuse generated PDFs and improve independent worker throughput — medium priority

Each CV export renders a PDF, launches Chromium, and closes it afterward; the route then stores a new export. Link-preview queue entries are processed sequentially. [VERIFY: lib/cv/pdf.ts:44] [VERIFY: app/api/cv/pdf/route.ts:95] [VERIFY: supabase/functions/_shared/links/worker.ts:24]

Recommendation: reuse PDF bytes keyed by immutable CV version, template, paper, and renderer version; still recheck ownership, entitlement, revocation, and required export accounting before issuing access. For link previews, evaluate a small bounded worker pool with per-host limits, queue-lease handling, URL deduplication, and existing SSRF protections. Avoid blindly parallelizing billing or capped notification work.

Measure: repeated-export latency and Chromium starts; queue oldest-message age, jobs/second, and duplicate processing.

## Measurement and regression protection

The project already reports sampled LCP/INP/CLS and has performance alert documentation. PostHog is dynamically imported during idle time. These are useful foundations to retain. [VERIFY: components/analytics/web-vitals.tsx:11] [VERIFY: lib/monitoring/vitals.ts:9] [VERIFY: components/analytics/analytics-loader.tsx:29] [VERIFY: docs/alerts.md:37]

The current size check totals all client JS chunks, while the Lighthouse/size CI job is report-only. That aggregate is not an individual route's initial download cost. [VERIFY: .size-limit.json:1] [VERIFY: .github/workflows/ci.yml:172]

Recommended validation sequence:

1. Establish a production-build baseline for marketing, feed, chat, profile, and one heavy portal screen on mobile throttling. Record cold and warm visits separately.
2. Add timing spans around proxy auth/gate, key RPCs, page loaders, and PDF stages. Compare p50/p95 latency and round-trip counts.
3. Use existing real-user metrics, split by route and device where supported; collect enough samples before judging a change.
4. Inspect database query statistics and staging plans for the actual slow queries. Supabase observability tools support this: https://supabase.com/docs/guides/observability
5. Establish route-level initial-JS and performance budgets, then make stable regression checks blocking in CI.

Start with feed enrichment concurrency, chat deduplication, and realtime subscription cleanup. Follow with streamed feed sections and measured ranking improvements. Treat public-page CSP/static delivery as a separate architectural change.
