import { describe, expect, it } from "vitest";
import { checkTarget, loadEmail, loadUsername, officerEmail, pairOf, seeded } from "../../scripts/load/lib.mjs";
import { userEmail, partnerOf } from "../load/lib/users.js";
import { THRESHOLDS } from "../load/lib/thresholds.js";

describe("load seeder helpers", () => {
  it("names accounts the way the k6 journeys address them", () => {
    expect(loadEmail(7, "nutech.edu.pk")).toBe("load-00007@nutech.edu.pk");
    expect(loadUsername(4321)).toBe("load_04321");
    expect(officerEmail(3, "nutech.edu.pk")).toBe("load-officer-03@nutech.edu.pk");
    for (const n of [1, 2, 300, 4999, 5000]) expect(userEmail(n, "nutech.edu.pk")).toBe(loadEmail(n, "nutech.edu.pk"));
  });

  it("pairs every student with one partner, both ways, and never with themselves", () => {
    for (const users of [10, 61, 5000]) {
      for (let n = 1; n <= users; n++) {
        const p = pairOf(n, users);
        expect(p).not.toBe(n);
        expect(p).toBeGreaterThanOrEqual(1);
        expect(p).toBeLessThanOrEqual(users);
        expect(partnerOf(n, users)).toBe(p);
        if (users % 2 === 0) expect(pairOf(p, users)).toBe(n);
      }
    }
  });

  it("is deterministic", () => {
    const a = seeded(13);
    const b = seeded(13);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("refuses every target but the local stack and the confirmed scratch project", () => {
    expect(checkTarget("http://127.0.0.1:54321")).toBeNull();
    expect(checkTarget("https://abcd.supabase.co", "abcd", "prod1")).toBeNull();
    expect(checkTarget("https://abcd.supabase.co")).toMatch(/LOAD_CONFIRM_SCRATCH/);
    expect(checkTarget("https://abcd.supabase.co", "wxyz")).toMatch(/doesn't match/);
    expect(checkTarget("https://prod1.supabase.co", "prod1", "prod1")).toMatch(/production/);
    expect(checkTarget("https://example.com", "example")).toMatch(/isn't a Supabase/);
    expect(checkTarget("not a url")).toMatch(/isn't a URL/);
  });
});

describe("k6 thresholds", () => {
  it("map every PRD 10 load-testable target", () => {
    const keys = Object.keys(THRESHOLDS).join(" ");
    for (const metric of [
      "http_req_failed", "checks", "page_ttfb", "feed_first_page", "feed_next_page", "survey_saved", "chat_delivered",
      "search_results", "badge_update", "pdf_ready", "browser_web_vital_lcp", "browser_web_vital_inp", "browser_web_vital_cls",
      "openings_ready", "record_ready", "event_registered", "event_checked_in", "oversold",
    ]) {
      expect(keys).toContain(metric);
    }
    expect(THRESHOLDS.http_req_failed).toEqual(["rate<0.001"]);
    expect(THRESHOLDS.chat_delivered).toEqual(["p(95)<1000"]);
    expect(THRESHOLDS.search_results).toEqual(["p(95)<300"]);
    expect(THRESHOLDS.pdf_ready).toEqual(["p(95)<10000"]);
  });
});
