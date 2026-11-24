import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MethodOptions_IdempotencyLevel } from "@bufbuild/protobuf/wkt";
import { describe, expect, it } from "vitest";
import { allServices } from "../gen/index";

const budgets = JSON.parse(readFileSync(join(import.meta.dirname, "../../../perf/budgets.json"), "utf8")) as Record<
  string,
  unknown
>;

const methods = allServices.flatMap((s) => s.methods.map((m) => `${s.typeName}/${m.name}`));
const reads = new Set(
  allServices.flatMap((s) =>
    s.methods
      .filter((m) => m.idempotency === MethodOptions_IdempotencyLevel.NO_SIDE_EFFECTS)
      .map((m) => `${s.typeName}/${m.name}`),
  ),
);

describe("perf/budgets.json", () => {
  it("has a budget for every contract method", () => {
    expect(methods.filter((m) => !(m in budgets))).toEqual([]);
  });

  it("has no budget for a method that no longer exists", () => {
    const stale = Object.keys(budgets).filter((k) => !k.startsWith("$") && !methods.includes(k));
    expect(stale).toEqual([]);
  });

  it("gives every budget a positive p95, and every read at most one database trip", () => {
    for (const [key, value] of Object.entries(budgets)) {
      if (key.startsWith("$")) continue;
      expect(value, key).toMatchObject({ p95Ms: expect.any(Number), dbTrips: expect.any(Number) });
      const v = value as { p95Ms: number; dbTrips: number };
      expect(v.p95Ms, key).toBeGreaterThan(0);
      expect(v.dbTrips, key).toBeGreaterThanOrEqual(0);
      if (reads.has(key)) expect(v.dbTrips, key).toBeLessThanOrEqual(1);
    }
  });
});
