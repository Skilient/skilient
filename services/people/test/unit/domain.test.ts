/** people's pure rules (src/domain): the parts the goldens reach only through the database, and the branches they don't. */
import { describe, expect, it } from "vitest";
import { finalYearOf, graduatedYear, karachiDate } from "../../src/domain/graduation";
import { nextStep, readyToComplete } from "../../src/domain/onboarding";
import { canViewProfile, departmentKey, normaliseUsername, validUsername } from "../../src/domain/profile";
import { containsPattern, prefixQuery } from "../../src/domain/search";
import { gettingStarted, navBadges, nextBestAction, todoCounts, type ShellInputs } from "../../src/domain/shell";

const base: ShellInputs = { friendRequests: 0, counts: {}, milestones: new Set(), facts: {}, profileFinished: false };

describe("profile rules", () => {
  it("usernames: trimmed of spaces, lower-cased, 3-30 of a-z 0-9 _, not reserved", () => {
    expect(normaliseUsername("  PG_Ali ")).toBe("pg_ali");
    expect(normaliseUsername(null)).toBeNull();
    expect([validUsername("pg_ali"), validUsername("ab"), validUsername("admin"), validUsername("has-dash"), validUsername(null)]).toEqual([true, false, false, false, false]);
  });

  it("visibility: self, then blocks, then global, same university or friends", () => {
    const t = { userId: "t", visibility: "university" as const, universityId: "u1" };
    const rel = { viewerUniversityId: "u1", friends: false, blocked: false };
    expect(canViewProfile("t", t, { ...rel, blocked: true })).toBe(true);
    expect(canViewProfile("v", t, rel)).toBe(true);
    expect(canViewProfile("v", t, { ...rel, blocked: true })).toBe(false);
    expect(canViewProfile("v", t, { ...rel, viewerUniversityId: "u2" })).toBe(false);
    expect(canViewProfile("v", { ...t, visibility: "friends" }, { ...rel, friends: true })).toBe(true);
    expect(canViewProfile("v", { ...t, visibility: "global" }, { ...rel, viewerUniversityId: null })).toBe(true);
    expect(canViewProfile(null, { ...t, visibility: "global" }, rel)).toBe(true);
    expect(canViewProfile(null, t, rel)).toBe(false);
    expect(departmentKey("  CS ")).toBe("cs");
  });
});

describe("search helpers", () => {
  it("prefix query: up to 8 words of 2+ letters, quoted, as prefixes", () => {
    expect(prefixQuery("ali zyx")).toBe("'ali':* & 'zyx':*");
    expect(prefixQuery("a")).toBeNull();
    expect(prefixQuery("o'brien")).toBe("'brien':*");
    expect(prefixQuery("a1 b2 c3 d4 e5 f6 g7 h8 i9")?.split(" & ")).toHaveLength(8);
  });
  it("contains pattern escapes \\ % _", () => {
    expect(containsPattern(" %_\\ ")).toBe("%\\%\\_\\\\%");
  });
});

describe("onboarding and graduation", () => {
  it("the saved step only moves forward and stops at 6", () => {
    expect([nextStep(1, 1), nextStep(4, 1), nextStep(6, 5), nextStep(2, 9)]).toEqual([2, 4, 6, 6]);
    expect(readyToComplete({ username: "a", universityId: "u", department: "d", graduationYear: 2027 })).toBe(true);
    expect(readyToComplete({ username: null, universityId: "u", department: "d", graduationYear: 2027 })).toBe(false);
  });
  it("graduates on 1 September, Asia/Karachi", () => {
    expect(graduatedYear({ year: 2027, month: 8, day: 31 })).toBe(2026);
    expect(graduatedYear({ year: 2027, month: 9, day: 1 })).toBe(2027);
    expect(karachiDate(new Date("2027-08-31T19:30:00Z"))).toEqual({ year: 2027, month: 9, day: 1 });
    expect(finalYearOf(2028, new Date())).toBe(2028);
    expect(finalYearOf(null, new Date("2027-09-02T00:00:00Z"))).toBe(2028);
  });
});

describe("shell rules", () => {
  it("badges and to-dos add people's requests to the copied counts; openings stop at 99", () => {
    const i = { ...base, friendRequests: 2, counts: { "ventures.applications": 1, "ventures.invites": 2, "todo.confirm": 3, "todo.endorse": 4, openings: 150 } };
    expect(navBadges(i)).toEqual({ chat: 0, notifications: 0, friends: 2, ventures: 3, openings: 99 });
    expect(todoCounts(i)).toEqual({ total: 12, requests: 2, applications: 1, invites: 2, confirm: 3, endorse: 4 });
  });
  it("the checklist uses copied milestones and the formula's points", () => {
    const g = gettingStarted({ ...base, profileFinished: true, milestones: new Set(["cv.built"] as const), facts: { "tier.points": { l2: 15, venture: 150, endorsement: 15 } } });
    expect([g.done, g.items.find((x) => x.key === "venture")?.points]).toEqual([2, 150]);
  });
  it("the next step: the path first, then ranking's first need, then the to-dos", () => {
    expect(nextBestAction({ ...base, facts: { "paths.next": { role: "frontend", path_label: "Frontend", skill_id: "react", skill_label: "React" } } }).title).toBe("Next on your Frontend path: React");
    expect(nextBestAction(base).key).toBe("join_venture");
    expect(nextBestAction({ ...base, milestones: new Set(["venture.member"] as const) }).key).toBe("log_contribution");
    expect(nextBestAction({ ...base, facts: { "tier.next": { next: "flare", needs: [{ key: "points", need: 100, have: 40.5 }] } } }).title).toBe("Earn 60 more points to reach Flare");
    expect(nextBestAction({ ...base, facts: { "tier.next": { next: null, needs: [] } } }).key).toBe("top");
    expect(nextBestAction({ ...base, facts: { "tier.next": { next: "spark", needs: [] } } }).key).toBe("waiting");
    expect(nextBestAction({ ...base, friendRequests: 1, facts: { "tier.next": { next: "spark", needs: [{ key: "other", need: 1, have: 0 }] } } }).title).toBe("You have 1 thing waiting");
  });
});
