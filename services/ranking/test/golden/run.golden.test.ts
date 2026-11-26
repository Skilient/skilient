/**
 * The W6 done-when (docs/azure/prd.md, W6): the nightly run reproduces docs/ranking-reference.md exactly from
 * ranking's own schema: the reference students of pgTAP 32, R1 to R10 (formula v1's numbers, unchanged under v2)
 * and the Record students R11 to R13. The world is fed as its owners' events (replay.ts, rule 1); then the run
 * goes rings → students → tiers (→ snapshot on a Sunday), one step at a time, and the published scores are
 * checked component by component against the reference table, and in full against the stack's run (run.json).
 */
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ALL, expectGolden, F, flags, inCase, runAll, scores, seed, startWorld } from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

/** docs/ranking-reference.md, "Summary" and the v2 table: work, skills, endorsements, credentials, record, momentum, adjustments, total. */
const REFERENCE: Record<number, [number, number, number, number, number, number, number, number]> = {
  1: [204.75, 82.5, 12.75, 100, 0, 114, 0, 514],
  2: [187.5, 30, 15.75, 0, 0, 52, 0, 285.25],
  3: [118.13, 15, 0, 0, 0, 8.8, -50, 91.93],
  4: [39.38, 0, 0, 0, 0, 0, 0, 39.38],
  5: [209.63, 77, 9.75, 125, 0, 166.98, 0, 588.36],
  6: [361.25, 104.5, 6.75, 0, 0, 23.92, 0, 496.42],
  7: [0, 30, 0, 0, 0, 88, 0, 118],
  8: [0, 0, 7.5, 60, 0, 375, 0, 442.5],
  9: [0, 15, 0, 0, 0, 10, -300, 0],
  10: [0, 500, 375, 0, 0, 0, 0, 875],
  11: [0, 0, 0, 0, 85, 0, 0, 85],
  12: [0, 0, 0, 0, 100, 0, 0, 100],
  13: [0, 0, 0, 0, 6, 0, 0, 6],
};
const COMPONENTS = ["work", "skills", "endorsements", "credentials", "record", "momentum", "adjustments"] as const;

describe("the nightly run over the reference students", () => {
  it("reproduces docs/ranking-reference.md exactly, from ranking's own schema (the W6 done-when)", () =>
    inCase(sql, async (tx) => {
      await seed(tx);
      expect(await runAll(tx, F.AS_OF)).toBe("done");
      const rows = (await scores(tx)) as unknown as { user_id: string; total: string; ranked: boolean; components: Record<string, { points: number }> }[];
      for (const [i, expected] of Object.entries(REFERENCE)) {
        const row = rows.find((r) => r.user_id === F.R(Number(i)))!;
        const got = [...COMPONENTS.map((c) => row.components[c]!.points), Number(row.total)];
        expect([`R${i}`, ...got]).toEqual([`R${i}`, ...expected]);
      }
      // R4 is "not ranked yet"; R1 to R10's Record is 0 under v2.
      expect(rows.find((r) => r.user_id === F.R(4))!.ranked).toBe(false);
      // R7 without the floor, and without the exam period (the reference's two side numbers).
      const { computeRanking } = await import("../../src/domain/score");
      const { loadFacts } = await import("../../src/store/facts");
      const { formulaInForce } = await import("../../src/store/formula");
      const f = (await formulaInForce(tx)).value;
      const facts = (await loadFacts(tx, [F.R(7)], new Date(F.AS_OF))).get(F.R(7))!;
      expect((computeRanking(facts, f, new Date(F.AS_OF), 0)["momentum"] as { points: number }).points).toBe(84.6);
      expect((computeRanking({ ...facts, examPeriods: [] }, f, new Date(F.AS_OF), 0)["momentum"] as { points: number }).points).toBe(75.6);
      // R12 after day 30: still 100 (the cap); formula v1 scores no Record.
      const r12 = (await loadFacts(tx, [F.R(12)], new Date(F.pkt("2026-12-21 12:00")))).get(F.R(12))!;
      expect((computeRanking(r12, f, new Date(F.pkt("2026-12-21 12:00")), 0)["record"] as { points: number }).points).toBe(100);
      const [v1] = await tx<{ value: never }[]>`select value from ranking.formulas where version = 1`;
      const r11 = (await loadFacts(tx, [F.R(11)], new Date(F.AS_OF))).get(F.R(11))!;
      expect((computeRanking(r11, v1!.value, new Date(F.AS_OF), 0)["record"] as { points: number }).points).toBe(0);
    }));

  it("matches the stack's run in full (run.json#reference): scores, tiers, percentiles, completions, flags", () =>
    inCase(sql, async (tx) => {
      await seed(tx);
      const stage = await runAll(tx, F.AS_OF);
      const [run] = await tx`select stage, held, formula_version, run_on::text from ranking.ranking_runs order by id desc limit 1`;
      const completions = [
        ...(await tx`select c.venture_id, c.owner_id, c.team_size, c.weeks, c.skill_tags, c.deliverables, c.verified_members
                       from ranking.venture_completions c where c.venture_id = any(${F.VENTURES.map((v) => v.id)}::uuid[]) order by c.venture_id`),
      ];
      expectGolden("run", "reference", { stage, run, completions, scores: await scores(tx), flags: await flags(tx) });
    }));

  it("a second run on a Sunday takes the weekly snapshot and checks gains against the first (run.json#snapshots)", () =>
    inCase(sql, async (tx) => {
      await seed(tx);
      await runAll(tx, F.AS_OF);
      const stage = await runAll(tx, F.pkt("2026-12-13 12:00"));
      const snapshots = [
        ...(await tx`select n.user_id, n.week::text, n.formula_version, n.components, n.total, n.ranked, n.tier, n.percentile
                       from ranking.ranking_snapshots n where n.user_id = any(${ALL}::uuid[]) order by n.user_id`),
      ];
      const after = ((await scores(tx)) as Record<string, unknown>[]).map((x) => ({
        user_id: x["user_id"],
        total: x["total"],
        held: x["held"],
        held_total: x["held_total"],
        tier: x["tier"],
        tier_met: x["tier_met"],
        below_since: x["below_since"],
        percentile: x["percentile"],
      }));
      expectGolden("run", "snapshots", { stage, snapshots, after, flags: await flags(tx) });
    }));
});
