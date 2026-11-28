import { describe, expect, it } from "vitest";
import { eligible, joinNames, sectionsValid, summary, topPercent } from "../../src/domain/cv";
import * as R from "../../src/domain/record";

describe("the CV's rules", () => {
  it("sections: known, each once, at least one", () => {
    expect(sectionsValid(["summary", "skills"])).toBe(true);
    expect(sectionsValid([])).toBe(false);
    expect(sectionsValid(["summary", "summary"])).toBe(false);
    expect(sectionsValid(["hobbies"])).toBe(false);
  });

  it("eligibility: an onboarded student with a username and university, not banned", () => {
    const p = { role: "student", onboardingComplete: true, username: "a", universityId: "u", banned: false };
    expect(eligible(p)).toBe(true);
    expect(eligible({ ...p, banned: true })).toBe(false);
    expect(eligible({ ...p, onboardingComplete: false })).toBe(false);
    expect(eligible({ ...p, role: "faculty" })).toBe(false);
    expect(eligible(undefined)).toBe(false);
  });

  it("top N% only in the top half, shown, ranked; numeric rounding as the stack's", () => {
    expect(topPercent({ ranked: true, percentile: 0.9 }, true)).toBe(10);
    expect(topPercent({ ranked: true, percentile: 0.7 }, true)).toBe(30);
    expect(topPercent({ ranked: true, percentile: 0.999 }, true)).toBe(1);
    expect(topPercent({ ranked: true, percentile: 0.4 }, true)).toBeNull();
    expect(topPercent({ ranked: true, percentile: 0.9 }, false)).toBeNull();
    expect(topPercent({ ranked: false, percentile: 0.9 }, true)).toBeNull();
  });

  it("the summary template", () => {
    expect(joinNames(["A", "B", "C"])).toBe("A, B and C");
    const base = { department: "Computer Science", university: "U", year: 2027, topSkills: ["Android"], projects: 0, completed: 0, pullRequests: 0, tier: "spark", top: 10 };
    expect(summary(base)).toBe("Computer Science student at U, class of 2027, with verified work in Android. Spark tier on Skilient, top 10%.");
    expect(summary({ ...base, department: null, year: null, topSkills: [], projects: 3, completed: 1, pullRequests: 1, tier: null, top: null })).toBe(
      "Student at U, with verified work across 3 team projects, 1 of them completed. 1 merged pull request to other developers' repositories.",
    );
    expect(summary({ ...base, projects: 1, completed: 1 })).toContain("across 1 completed team project.");
  });
});

describe("the Record's wording", () => {
  it("ordinals, academic years, address hashes, times in Pakistan", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 111].map(R.ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "111th"]);
    expect(R.academicYear("2026-09-01")).toBe(2026);
    expect(R.academicYear("2027-08-31")).toBe(2026);
    expect(R.emailHash("  Zara@Cred-A.test ")).toBe(R.emailHash("zara@cred-a.test"));
    expect(R.pktTime("2026-11-28T19:30:00Z")).toBe("00:30");
    expect(R.pktDate("2026-11-28T19:30:00Z")).toBe("2026-11-29");
    expect(R.dayMonthYear("2026-11-05")).toBe("5 Nov 2026");
  });

  it("each kind's line", () => {
    expect(R.result("T", 2, 5, null, true, "2026-11-01").evidence).toEqual({ line: "2nd of 5 teams", place: 2, entrants: 5 });
    expect(R.result("T", 1, 5, "Best sketch", false, "2026-11-01").evidence["line"]).toBe("Best sketch of 5");
    expect(R.volunteer("T", 210, "2026-11-01").evidence).toEqual({ line: "3.5 h · T", minutes: 210 });
    expect(R.volunteer("T", 180, "2026-11-01").evidence["line"]).toBe("3 h · T");
    expect(R.officeBearer("President", "president", "2025-09-01", "2026-08-31").evidence["line"]).toBe("President · Sep 2025 – Aug 2026");
    expect(R.taught("android", "Android", "Nida", 2, 90, "2026-11-01")).toMatchObject({ title: "Taught Android to Nida", evidence: { line: "2 sessions · 1.5 h" } });
    expect(R.swapHoursLabel(60)).toBe("1 h");
    expect(R.swapHoursLabel(100)).toBe("1.7 h");
    expect(R.decimal(2.25, 1)).toBe("2.3");
  });

  it("corrections and the CV's labels", () => {
    const e = { kind: "result", evidence: { line: "1st of 3 teams", place: 1, entrants: 3 } };
    expect(R.correctedEvidence(e, { title: "T", place: 2 })).toEqual({ line: "2nd of 3 teams", place: 2, entrants: 3 });
    expect(R.correctedEvidence({ kind: "volunteer", evidence: { line: "x", minutes: 60 } }, { title: "T", hours: 2.25 })).toEqual({ line: "2.3 h · T", minutes: 135 });
    expect(R.activityLabel("result", "Hack", { place: 2 })).toBe("2nd place, Hack");
    expect(R.activityLabel("result", "Hack", { place: 7 })).toBe("Finalist, Hack");
    expect(R.activityLabel("result", "Hack", {})).toBe("Finalist, Hack");
    expect(R.activityWhen("office_bearer", "2026-08-31", { from: "2025-09-01", to: "2026-08-31" })).toBe("Sep 2025 – Aug 2026");
    expect(R.rankingEvidence({ line: "x", place: 1, entrants: 5, role: "officer" })).toEqual({ place: 1, entrants: 5, role: "officer" });
  });

  it("society placeholders", () => {
    const id = "98c00000-0000-4000-8000-000000000001";
    const doc = { a: `$society_slug:${id}`, b: [`$society_logo:${id}`] };
    expect(R.wantedSocieties(doc)).toEqual([id]);
    expect(R.fillSocieties(doc, new Map([[id, { slug: "s", logoPath: null }]]))).toEqual({ a: "s", b: [null] });
  });
});
