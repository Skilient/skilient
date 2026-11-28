import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Each file that touches the database starts its own Postgres; more at once than this exhausts memory
    // on a laptop with the testcontainers reaper off (decision 2026-11-25).
    maxWorkers: 3,
    projects: [
      { test: { name: "unit", include: ["test/unit/**/*.test.ts"] } },
      { test: { name: "refusal", include: ["test/refusal/**/*.test.ts"], testTimeout: 60_000, hookTimeout: 120_000 } },
      { test: { name: "budget", include: ["test/budget/**/*.test.ts"], testTimeout: 120_000, hookTimeout: 180_000 } },
      { test: { name: "contract", include: ["test/contract/**/*.test.ts"], testTimeout: 60_000, hookTimeout: 180_000 } },
      // Service-level journeys mirroring record.spec and cv.spec, the W8 done-when (stack-signed codes verify, new ones verify with the same key file), and the hand-offs other services left for W8.
      { test: { name: "journeys", include: ["test/journeys/**/*.test.ts"], testTimeout: 90_000, hookTimeout: 180_000 } },
      { test: { name: "golden", include: ["test/golden/**/*.test.ts"], testTimeout: 120_000, hookTimeout: 120_000 } },
    ],
  },
});
