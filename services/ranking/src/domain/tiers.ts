import { round } from "./numbers";
import type { Formula } from "./score";

/** PRD 5.17's tiers, lowest first (the enum order `ranking_tier`). */
export const TIERS = ["raw", "spark", "flare", "shine", "radiant", "luminary"] as const;
export type Tier = (typeof TIERS)[number];
export const tierIndex = (t: string | null | undefined) => (t ? TIERS.indexOf(t as Tier) : -1);

export type TierFacts = Partial<{
  peer_verified_entries: number;
  active_ventures: number;
  counting_endorsements: number;
  completed_ventures: number;
  max_level: number;
  teacher_endorsement: boolean;
  hire: boolean;
}>;

/** `tier_met(ranked, total, percentile, facts, f)`: the highest tier met, each needing every milestone below it. */
export function tierMet(ranked: boolean, total: number, percentile: number | null, x: TierFacts, f: Formula): Tier | null {
  const t = f.tiers;
  const pct = percentile ?? 0;
  if (!ranked) return null;
  if (total < t["spark"]! || (x.peer_verified_entries ?? 0) < 1) return "raw";
  if (total < t["flare"]! || (x.active_ventures ?? 0) < t["flare_ventures"]! || (x.counting_endorsements ?? 0) < t["flare_endorsements"]!) return "spark";
  if (total < t["shine"]! || (x.completed_ventures ?? 0) < t["shine_completed"]! || (x.max_level ?? 0) < t["shine_level"]!) return "flare";
  if (total < t["radiant"]! || pct < 1 - t["radiant_top"]!) return "shine";
  if (total < t["luminary"]! || pct < 1 - t["luminary_top"]! || !(x.teacher_endorsement || x.hire)) return "radiant";
  return "luminary";
}

/**
 * The 14-day drop rule (assign_percentiles_and_tiers): rising is immediate; a tier drops only after 14 straight
 * days failing it, to the highest tier still met.
 */
export function nextTierState(
  prev: { tier: Tier | null; below_since: string | null },
  met: Tier | null,
  on: string,
  dropDays: number,
  daysSince: (from: string, to: string) => number,
): { tier: Tier | null; below_since: string | null } {
  if (met === null) return { tier: null, below_since: null };
  if (prev.tier === null || tierIndex(met) >= tierIndex(prev.tier)) return { tier: met, below_since: null };
  if (prev.below_since !== null && daysSince(prev.below_since, on) >= dropDays) return { tier: met, below_since: null };
  return { tier: prev.tier, below_since: prev.below_since ?? on };
}

export interface Need {
  key: string;
  have: number;
  need: number;
}
export interface NextTier {
  current: Tier | null;
  next: Tier | null;
  needs: Need[];
}

/**
 * `next_tier_requirements(user)`: what the next tier needs that the student doesn't have yet, from the published
 * score (null when there is none) and the formula in force.
 */
export function nextTierRequirements(s: { ranked: boolean; tier: string | null; total: number; percentile: number | null; facts: TierFacts } | null, f: Formula): NextTier {
  const t = f.tiers;
  const x = s?.facts ?? {};
  const pct = s?.percentile ?? 0;
  if (!s || !s.ranked) return { current: null, next: "raw", needs: [{ key: "peer_verified_entries", have: x.peer_verified_entries ?? 0, need: 1 }] };
  const i = TIERS.indexOf((s.tier ?? "raw") as Tier);
  if (i === TIERS.length - 1) return { current: s.tier as Tier, next: null, needs: [] };
  const next = TIERS[i + 1]!;
  const nextPos = i + 2; // array_position, 1-based
  const needs: Need[] = [];
  if (s.total < t[next]!) needs.push({ key: "points", have: s.total, need: t[next]! });
  if ((x.peer_verified_entries ?? 0) < 1) needs.push({ key: "peer_verified_entries", have: x.peer_verified_entries ?? 0, need: 1 });
  if (nextPos >= 3) {
    if ((x.active_ventures ?? 0) < t["flare_ventures"]!) needs.push({ key: "active_ventures", have: x.active_ventures ?? 0, need: t["flare_ventures"]! });
    if ((x.counting_endorsements ?? 0) < t["flare_endorsements"]!) needs.push({ key: "counting_endorsements", have: x.counting_endorsements ?? 0, need: t["flare_endorsements"]! });
  }
  if (nextPos >= 4) {
    if ((x.completed_ventures ?? 0) < t["shine_completed"]!) needs.push({ key: "completed_ventures", have: x.completed_ventures ?? 0, need: t["shine_completed"]! });
    if ((x.max_level ?? 0) < t["shine_level"]!) needs.push({ key: "max_level", have: x.max_level ?? 0, need: t["shine_level"]! });
  }
  const share = (top: number) => ({ key: "top_share", have: round((1 - pct) * 100, 1), need: round(top * 100, 10) });
  if (next === "radiant" && pct < 1 - t["radiant_top"]!) needs.push(share(t["radiant_top"]!));
  if (next === "luminary") {
    if (pct < 1 - t["luminary_top"]!) needs.push(share(t["luminary_top"]!));
    if (!(x.teacher_endorsement || x.hire)) needs.push({ key: "teacher_or_hire", have: 0, need: 1 });
  }
  return { current: s.tier as Tier, next, needs };
}
