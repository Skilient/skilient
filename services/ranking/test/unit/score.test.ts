/**
 * The pure parts of the score (domain/): numeric rounding as Postgres gave it, complexity, the exam-day count,
 * academic years, the tier rules and the 14-day drop rule, and the next tier's requirements. The whole formula is
 * held by the reference run (test/golden/reference.golden.test.ts) and the golden replays.
 */
import { describe, expect, it } from "vitest";
import { addDays, daysBetween, isoDow, pktDate, pktWeek, round, round2 } from "../../src/domain/numbers";
import { academicYear, complexity, examDays, type Formula } from "../../src/domain/score";
import { nextTierRequirements, nextTierState, tierMet } from "../../src/domain/tiers";
import FORMULA from "./formula-v2.json";

const f = FORMULA as unknown as Formula;

describe("numbers", () => {
  it("rounds half away from zero without binary noise", () => {
    expect(round2(118.125)).toBe(118.13);
    expect(round2(((150 * 1.05) * 1.5) / 2)).toBe(118.13);
    expect(round2(150 * 1.075 * 1.3)).toBe(209.63);
    expect(round2(39.375)).toBe(39.38);
    expect(round2(-0.005)).toBe(-0.01);
    expect(round(0.2857142857142857 * 100, 1)).toBe(28.6);
  });

  it("reads PKT dates and ISO weeks", () => {
    const t = new Date("2026-12-08T20:00:00Z"); // 9 December, 01:00 PKT
    expect(pktDate(t)).toBe("2026-12-09");
    expect(pktWeek(t)).toBe("2026-12-07");
    expect(daysBetween("2026-12-01", "2026-12-09")).toBe(8);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(isoDow("2026-12-13")).toBe(7);
  });
});

describe("the formula's pieces", () => {
  it("complexity: V1 1.05 and V2 1.075 (docs/ranking-reference.md)", () => {
    expect(complexity(4, 16, 4, 1, f)).toBeCloseTo(1.05, 10);
    expect(complexity(2, 4, 8, 4, f)).toBeCloseTo(1.075, 10);
    expect(complexity(9, 99, 99, 99, f)).toBeCloseTo(1.3, 10);
  });

  it("exam days after the last activity, up to today, each day once", () => {
    const periods = [
      { starts_on: "2026-10-15", ends_on: "2026-11-13" },
      { starts_on: "2026-11-10", ends_on: "2026-11-20" },
    ];
    expect(examDays(periods.slice(0, 1), "2026-09-30", "2026-12-09")).toBe(30);
    expect(examDays(periods, "2026-09-30", "2026-12-09")).toBe(37);
    expect(examDays(periods, "2026-11-13", "2026-11-15")).toBe(2);
    expect(examDays([], "2026-09-30", "2026-12-09")).toBe(0);
  });

  it("academic years run September to August", () => {
    expect(academicYear("2026-06-30")).toBe(2025);
    expect(academicYear("2026-09-01")).toBe(2026);
  });
});

describe("tiers", () => {
  const facts = { peer_verified_entries: 4, active_ventures: 2, counting_endorsements: 3, completed_ventures: 1, max_level: 3, teacher_endorsement: false, hire: false };
  it("tier_met: each tier needs its own milestone and every one below it", () => {
    expect(tierMet(false, 999, 1, facts, f)).toBeNull();
    expect(tierMet(true, 99, 1, facts, f)).toBe("raw");
    expect(tierMet(true, 200, 1, facts, f)).toBe("spark");
    expect(tierMet(true, 300, 1, { ...facts, active_ventures: 1 }, f)).toBe("spark");
    expect(tierMet(true, 600, 1, facts, f)).toBe("shine");
    expect(tierMet(true, 1200, 0.95, facts, f)).toBe("radiant");
    expect(tierMet(true, 1200, 0.85, facts, f)).toBe("shine");
    expect(tierMet(true, 2500, 0.99, facts, f)).toBe("radiant");
    expect(tierMet(true, 2500, 0.99, { ...facts, teacher_endorsement: true }, f)).toBe("luminary");
  });

  it("rises at once, drops only after 14 days below, to the tier still met", () => {
    expect(nextTierState({ tier: "spark", below_since: null }, "flare", "2026-12-09", 14, daysBetween)).toEqual({ tier: "flare", below_since: null });
    expect(nextTierState({ tier: "flare", below_since: null }, "spark", "2026-12-09", 14, daysBetween)).toEqual({ tier: "flare", below_since: "2026-12-09" });
    expect(nextTierState({ tier: "flare", below_since: "2026-12-09" }, "spark", "2026-12-22", 14, daysBetween)).toEqual({ tier: "flare", below_since: "2026-12-09" });
    expect(nextTierState({ tier: "flare", below_since: "2026-12-09" }, "spark", "2026-12-23", 14, daysBetween)).toEqual({ tier: "spark", below_since: null });
    expect(nextTierState({ tier: "flare", below_since: "2026-12-09" }, null, "2026-12-10", 14, daysBetween)).toEqual({ tier: null, below_since: null });
  });

  it("next_tier_requirements: unscored, the top, and the milestones up to the next tier", () => {
    expect(nextTierRequirements(null, f)).toEqual({ current: null, next: "raw", needs: [{ key: "peer_verified_entries", have: 0, need: 1 }] });
    expect(nextTierRequirements({ ranked: true, tier: "luminary", total: 3000, percentile: 1, facts }, f)).toEqual({ current: "luminary", next: null, needs: [] });
    expect(nextTierRequirements({ ranked: true, tier: "shine", total: 514, percentile: 0.714285714285714, facts: { ...facts, active_ventures: 1, counting_endorsements: 2 } }, f)).toEqual({
      current: "shine",
      next: "radiant",
      needs: [
        { key: "points", have: 514, need: 1000 },
        { key: "active_ventures", have: 1, need: 2 },
        { key: "counting_endorsements", have: 2, need: 3 },
        { key: "top_share", have: 28.6, need: 10 },
      ],
    });
  });
});
