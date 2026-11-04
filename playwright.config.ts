import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

// Phase 14: the recruiter and university portals are off by flag. Their specs carry the @portals tag
// and run in their own pass (`pnpm test:e2e:portals`, E2E_PORTALS=1), which switches the flag on in
// globalSetup and off again in globalTeardown; the main pass leaves them out.
const portalsPass = process.env.E2E_PORTALS === "1";

/**
 * Which tests each browser project collects (decisions 2026-11-04, "CI speed"). A test that only means
 * something on one screen size carries @desktop-only or @phone-only, and the other project never collects
 * it. These used to be `test.skip(info.project.name !== …)` at run time: Playwright still counted them when
 * it split the suite into shards, so one shard got ~70 phone tests that skipped in a minute while another ran
 * the real work for 23. tests/unit/e2e-projects.test.ts refuses the runtime pattern.
 *
 * A project-level grep replaces the top-level one, so the @portals pass split is repeated per project.
 */
function only(project: "desktop" | "phone") {
  const other = project === "desktop" ? /@phone-only/ : /@desktop-only/;
  return portalsPass ? { grep: /@portals/, grepInvert: [other] } : { grepInvert: [/@portals/, other] };
}

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/portals-setup.ts",
  globalTeardown: "./tests/e2e/portals-teardown.ts",
  // Each pass keeps its own traces and report: Playwright empties outputDir when a run starts, so the
  // @portals pass used to delete the main pass's failure traces before the artifact upload.
  outputDir: portalsPass ? "test-results/portals" : "test-results/main",
  fullyParallel: true,
  // Playwright's default is half the CPUs: 1 on GitHub's 2-vCPU runners for private repositories. CI sets
  // E2E_WORKERS from measurement (ci.yml); anything else keeps the default.
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : undefined,
  forbidOnly: !!process.env.CI,
  // headless_shell has crashed with a SIGILL/CFI violation on marketing-pages.spec.ts:132 on GitHub's
  // runners three times (CI #179, this PR twice); switching to the full Chromium binary traded that
  // for ENOSPC instead (its heavier traces/video pushed the runner's disk over the edge). A single
  // CI-only retry is Playwright's own recommended mitigation for a browser-crash flake: it relaunches
  // a fresh browser process rather than changing which binary every test uses. CI reports any test that
  // needed it as flaky (`--fail-on-flaky-tests` is left off; the run's summary lists them).
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: portalsPass ? "playwright-report/portals" : "playwright-report/main" }]]
    : "list",
  // Several specs assert on state that lands after router.refresh() re-renders from the server
  // (ConfirmAction, endorsement hide/show); under CI's concurrent shards that round trip can run
  // past Playwright's 5s default, failing a different assertion each time rather than the same one.
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    // Lets a machine with a preinstalled Chromium skip `playwright install`.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, ...only("desktop") },
    { name: "phone", use: { ...devices["Pixel 7"] }, ...only("phone") },
  ],
  // Against a production build with the dev-only gallery switched on. A second server runs the same
  // build with a PostHog project key for tests/e2e/analytics.spec.ts; PostHog itself is faked there.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: `pnpm start --port ${PORT}`,
          url: `${baseURL}/ui`,
          reuseExistingServer: false,
          timeout: 120_000,
          env: { ENABLE_UI_GALLERY: "1" },
        },
        {
          command: `pnpm start --port ${PORT + 1}`,
          url: `http://127.0.0.1:${PORT + 1}/`,
          reuseExistingServer: false,
          timeout: 120_000,
          env: { NEXT_PUBLIC_POSTHOG_KEY: "phc_e2e" },
        },
      ],
});
