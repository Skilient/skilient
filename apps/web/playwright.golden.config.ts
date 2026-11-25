import { defineConfig, devices } from "@playwright/test";

/**
 * Golden recordings that need the real app (W1 identity: password change).
 * Runs against an app already started on the local Supabase stack, never a
 * hosted one; see tests/golden/password.golden.spec.ts for how to start it.
 * E2E_BASE_URL is required and checked by globalSetup; there is no default.
 */
export default defineConfig({
  testDir: "tests/golden",
  globalSetup: "./tests/golden/global-setup.ts",
  workers: 1,
  reporter: "list",
  expect: { timeout: 15_000 },
  timeout: 120_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.E2E_BASE_URL,
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
});
