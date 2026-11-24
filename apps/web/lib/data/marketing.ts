import "server-only";

import { unstable_cache } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { homeFor, type GateState } from "@/lib/auth/gate";
import { logger } from "@/lib/log";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

/**
 * Reads for the marketing pages (PRD 5.1). Public data is cached for an hour (decisions
 * 2026-10-02: pages render per request for the nonce CSP, their data doesn't); the viewer is
 * read per request with getUser() so signed-in visitors see "Open Skilient".
 */

export interface Viewer {
  /** Where "Open Skilient" goes: the same home the gate would send them to. */
  home: string;
  role: string | null;
}

export const getViewer = cache(async (): Promise<Viewer | null> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    const { data: state } = await supabase.rpc("my_gate_state");
    const gate = (state as GateState | null) ?? null;
    return { home: gate ? homeFor(gate) : "/feed", role: gate?.role ?? null };
  } catch (err) {
    // Next's own signals (dynamic rendering, redirects) pass through untouched.
    unstable_rethrow(err);
    // The public pages never fail because auth is unreachable: the visitor just sees "Join".
    logger.error("marketing.viewer", { action: "getViewer", outcome: "error", error_code: err instanceof Error ? err.message.slice(0, 80) : "unknown" });
    return null;
  }
});

export interface LandingStats {
  /** Live universities with enough verified students, most students first. */
  universities: string[];
  /** Each total is null below marketing.stats_min (200), so it can't be shown. */
  verified_students: number | null;
  ventures: number | null;
  shipped_ventures: number | null;
}

const EMPTY_STATS: LandingStats = { universities: [], verified_students: null, ventures: null, shipped_ventures: null };

/**
 * The public reads are cached for an hour, and a failed read is never cached: an empty answer stored
 * for an hour would hide prices and numbers from every visitor. The loaders throw on error (unstable_cache
 * stores nothing when its function throws), and the exported wrappers fall back to the empty value.
 * The cache keys are versioned so entries written before this rule (possibly empty) are never read.
 */
export async function loadLandingStats(): Promise<LandingStats> {
  const { data, error } = await createPublicClient().rpc("landing_stats");
  if (error) throw new Error(`landing_stats: ${error.code ?? "unknown"}`);
  return { ...EMPTY_STATS, ...(data as Partial<LandingStats>) };
}
const cachedLandingStats = unstable_cache(loadLandingStats, ["marketing-landing-stats-v2"], { revalidate: 3600 });
export async function getLandingStats(): Promise<LandingStats> {
  try {
    return await cachedLandingStats();
  } catch (err) {
    unstable_rethrow(err);
    logger.error("marketing.landing_stats", { action: "landing_stats", outcome: "error", error_code: errorCode(err) });
    return EMPTY_STATS;
  }
}

export interface PublicPlan {
  id: string;
  audience: "user" | "org" | "university";
  tier: string;
  label: string;
  interval: "month" | "year";
  price_pkr: number | null;
  self_serve: boolean;
  position: number;
  grants: Record<string, unknown>;
}

export async function loadPublicPlans(): Promise<PublicPlan[]> {
  const { data, error } = await createPublicClient().rpc("public_plans");
  if (error) throw new Error(`public_plans: ${error.code ?? "unknown"}`);
  return (data as PublicPlan[] | null) ?? [];
}
const cachedPublicPlans = unstable_cache(loadPublicPlans, ["marketing-public-plans-v2"], { revalidate: 3600 });
export async function getPublicPlans(): Promise<PublicPlan[]> {
  try {
    return await cachedPublicPlans();
  } catch (err) {
    unstable_rethrow(err);
    logger.error("marketing.public_plans", { action: "public_plans", outcome: "error", error_code: errorCode(err) });
    return [];
  }
}

export interface PricingExtras {
  add_ons: { sponsored_post?: { pkr: number; days: number }; contact_credits?: { pkr: number } } | null;
  hire_fees: { intern?: number; full_time?: number } | null;
  trial_days: number | null;
}

/** Add-ons, hiring fees and the trial length for /pricing, from platform_config (what billing charges). */
const EMPTY_EXTRAS: PricingExtras = { add_ons: null, hire_fees: null, trial_days: null };
export async function loadPricingExtras(): Promise<PricingExtras> {
  const { data, error } = await createPublicClient().rpc("public_pricing_extras");
  if (error) throw new Error(`public_pricing_extras: ${error.code ?? "unknown"}`);
  return { ...EMPTY_EXTRAS, ...(data as Partial<PricingExtras> | null) };
}
const cachedPricingExtras = unstable_cache(loadPricingExtras, ["marketing-pricing-extras-v2"], { revalidate: 3600 });
export async function getPricingExtras(): Promise<PricingExtras> {
  try {
    return await cachedPricingExtras();
  } catch (err) {
    unstable_rethrow(err);
    logger.error("marketing.pricing_extras", { action: "public_pricing_extras", outcome: "error", error_code: errorCode(err) });
    return EMPTY_EXTRAS;
  }
}

/** The error's code or first words only: never the message from the database, which can carry data. */
function errorCode(err: unknown): string {
  return err instanceof Error ? err.message.slice(0, 60) : "unknown";
}
