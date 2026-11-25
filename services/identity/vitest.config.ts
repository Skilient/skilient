import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Each contract and golden file starts its own Postgres and hashes passwords (Argon2id, ~200 ms of CPU);
    // more files at once than this starves the 2 s call deadline (prd.md call rules) on a laptop.
    maxWorkers: 3,
    projects: [
      { test: { name: "unit", include: ["test/unit/**/*.test.ts"] } },
      { test: { name: "refusal", include: ["test/refusal/**/*.test.ts"], testTimeout: 60_000, hookTimeout: 120_000 } },
      { test: { name: "import", include: ["test/import/**/*.test.ts"], testTimeout: 60_000, hookTimeout: 120_000 } },
      { test: { name: "contract", include: ["test/contract/**/*.test.ts"], testTimeout: 60_000, hookTimeout: 180_000 } },
      // Service-level journeys mirroring the auth end-to-end specs (decision 2026-11-25, Q5).
      { test: { name: "journeys", include: ["test/journeys/**/*.test.ts"], testTimeout: 60_000, hookTimeout: 180_000 } },
      { test: { name: "golden", include: ["test/golden/**/*.test.ts"], testTimeout: 60_000, hookTimeout: 120_000 } },
    ],
  },
});
