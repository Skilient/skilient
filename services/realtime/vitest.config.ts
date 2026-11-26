import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    maxWorkers: 3,
    // The hub alone (a fake LISTEN, real sockets). Live delivery through messaging, on both transports and across
    // two replicas, is tested in services/messaging (test/contract, test/budget).
    projects: [{ test: { name: "unit", include: ["test/unit/**/*.test.ts"], testTimeout: 30_000 } }],
  },
});
