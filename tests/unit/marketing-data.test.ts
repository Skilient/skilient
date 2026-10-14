import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const cacheSpy = vi.hoisted(() => vi.fn((...args: unknown[]) => args[0]));

vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({ rpc }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/log", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
// Pass-through: the loader is what the cache wraps, so checking it checks what gets cached.
vi.mock("next/cache", () => ({ unstable_cache: cacheSpy }));

import { getLandingStats, getPricingExtras, getPublicPlans, loadLandingStats, loadPricingExtras, loadPublicPlans } from "@/lib/data/marketing";

// The cache calls happen at import; take them before the runner clears mock history between tests.
const cachedWith = cacheSpy.mock.calls.map(([fn, key]) => ({ fn, key }));

describe("public marketing reads", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("caches the loader that throws on error, so a failed read is never stored", () => {
    expect(cachedWith).toEqual(
      expect.arrayContaining([
        { fn: loadPublicPlans, key: ["marketing-public-plans-v2"] },
        { fn: loadPricingExtras, key: ["marketing-pricing-extras-v2"] },
        { fn: loadLandingStats, key: ["marketing-landing-stats-v2"] },
      ]),
    );
  });

  it("the loaders throw when the database read fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42883", message: "function public_plans() does not exist" } });
    await expect(loadPublicPlans()).rejects.toThrow("public_plans: 42883");
    await expect(loadPricingExtras()).rejects.toThrow("public_pricing_extras: 42883");
    await expect(loadLandingStats()).rejects.toThrow("landing_stats: 42883");
  });

  it("the page reads fall back to empty values on failure, and return the data on success", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "08006", message: "connection failure" } });
    await expect(getPublicPlans()).resolves.toEqual([]);

    rpc.mockResolvedValueOnce({ data: [{ id: "student_pro_monthly", price_pkr: 399 }], error: null });
    await expect(getPublicPlans()).resolves.toEqual([{ id: "student_pro_monthly", price_pkr: 399 }]);

    rpc.mockResolvedValueOnce({ data: null, error: { code: "08006", message: "connection failure" } });
    await expect(getPricingExtras()).resolves.toEqual({ add_ons: null, hire_fees: null, trial_days: null });

    rpc.mockResolvedValueOnce({ data: null, error: { code: "08006", message: "connection failure" } });
    await expect(getLandingStats()).resolves.toMatchObject({ universities: [], verified_students: null });
  });
});
