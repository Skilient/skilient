import { test as base } from "@playwright/test";

export * from "@playwright/test";

/**
 * Every spec imports `test` from here (tests/unit/e2e-projects.test.ts checks). It adds one automatic
 * fixture: contexts a test opened with `browser.newContext()` are closed when the test ends.
 *
 * Playwright closes the contexts it creates for `page`/`context`, but not ones a test makes itself, and the
 * worker's browser lives for the whole shard. Those pages kept running (realtime sockets, PostHog, timers),
 * and Playwright starts a trace chunk on every live context at the start of each later test, so a long
 * shard traced more and more stale pages as it went (decisions 2026-11-04, "CI speed").
 */
export const test = base.extend<{ closeStrayContexts: void }>({
  closeStrayContexts: [
    async ({ browser }, use) => {
      const before = new Set(browser.contexts());
      await use();
      await Promise.all(browser.contexts().filter((c) => !before.has(c)).map((c) => c.close().catch(() => undefined)));
    },
    { auto: true },
  ],
});
