import { describe, expect, it } from "vitest";
import { categoryFromSlug, categoryHref, OPENING_CATEGORIES, parseOpeningFilters, visibleCategories } from "@/lib/openings/constants";
import { OPPORTUNITY_REDIRECTS } from "@/lib/openings/redirects";

describe("Openings (PRD 5.34)", () => {
  it("round-trips every category through its URL slug", () => {
    for (const c of OPENING_CATEGORIES) expect(categoryFromSlug(categoryHref(c).slice("/openings/".length))).toBe(c);
    expect(categoryFromSlug("venture_roles")).toBeNull();
    expect(categoryFromSlug("bogus")).toBeNull();
  });

  it("shows portal cards only while their portal is on", () => {
    const off = visibleCategories({ recruiter: false, university: false });
    expect(off).toEqual(["venture_roles", "inductions", "events", "ideas", "paths", "swaps", "this_week"]);
    expect(visibleCategories({ recruiter: true, university: false })).toEqual([...off, "jobs", "contact_requests", "applications", "competitions"]);
    expect(visibleCategories({ recruiter: false, university: true })).toEqual([...off, "competitions"]);
    expect(visibleCategories({ recruiter: true, university: true })).toContain("job_fairs");
  });

  it("reads filters from the URL, never anything about payment", () => {
    expect(parseOpeningFilters({})).toEqual({ sort: "newest", matched: false, q: "" });
    expect(parseOpeningFilters({ sort: "deadline", match: "1", q: "  react " })).toEqual({ sort: "deadline", matched: true, q: "react" });
    expect(parseOpeningFilters({ sort: "sponsored" }).sort).toBe("newest");
  });

  it("sends old /opportunities paths to their new homes", () => {
    const find = (source: string) => OPPORTUNITY_REDIRECTS.find((r) => r.source === source)?.destination;
    expect(find("/opportunities")).toBe("/openings");
    expect(find("/opportunities/for_you")).toBe("/openings");
    expect(find("/opportunities/contact_requests")).toBe("/openings/contact-requests");
    expect(find("/opportunities/:path*")).toBe("/openings/:path*");
    // The catch-all comes last so the specific ones win.
    expect(OPPORTUNITY_REDIRECTS.at(-1)?.source).toBe("/opportunities/:path*");
  });
});
