/**
 * Every PRD 10 performance target the load test can measure, as k6 thresholds (docs/load-test.md has the
 * full mapping, including the targets measured elsewhere). PRD 10 measures at p75 unless a row says p95;
 * the run fails on any miss. Rows marked "derived" apply the nearest PRD budget to a journey PRD 10 has
 * no row for: a screen's first view gets the feed's 1.5 s, a write gets the survey's 500 ms save.
 */
export const THRESHOLDS = {
  // "Launch requires all targets met with no errors above 0.1%."
  http_req_failed: ["rate<0.001"],
  checks: ["rate>0.999"],
  // Server response (TTFB) from Pakistan ≤ 600 ms, every signed-in page in the mix.
  page_ttfb: ["p(75)<600"],
  // Feed first page visible ≤ 1.5 s (the server-rendered /feed, fully downloaded; LCP below covers paint).
  feed_first_page: ["p(75)<1500"],
  // Next feed page ≤ 400 ms (feed_page + post_cards, what the load-more action runs).
  feed_next_page: ["p(75)<400"],
  // Survey tick/cross saved ≤ 500 ms (shown instantly in the UI; this is the save).
  survey_saved: ["p(75)<500"],
  // Chat message delivered ≤ 1 s p95: send_message until the recipient's Realtime subscription has it.
  chat_delivered: ["p(95)<1000"],
  // Search results ≤ 300 ms p95.
  search_results: ["p(95)<300"],
  // Notification badge update ≤ 2 s: a comment on your post until your Realtime event and nav_badges().
  badge_update: ["p(75)<2000"],
  // CV PDF ≤ 10 s p95: the Record transcript, printed by the same Chromium path as the CV.
  pdf_ready: ["p(95)<10000"],
  // Core Web Vitals on a throttled phone profile (k6 browser, the "vitals" scenario).
  browser_web_vital_lcp: ["p(75)<2500"],
  browser_web_vital_inp: ["p(75)<200"],
  browser_web_vital_cls: ["p(75)<0.1"],
  // Derived: Openings and My Record first view, the feed's 1.5 s.
  openings_ready: ["p(75)<1500"],
  record_ready: ["p(75)<1500"],
  // Derived: registering and checking in are writes, the survey's 500 ms save.
  event_registered: ["p(75)<500"],
  event_checked_in: ["p(75)<500"],
  // Correctness under load: no event confirms more seats than it has, and no ticket checks in twice.
  oversold: ["count==0"],
  double_checkin: ["count==0"],
};
