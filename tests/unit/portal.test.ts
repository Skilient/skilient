import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pktDate } from "@/lib/format/time";
import { activeLevel, badgeLabel, currentPlace, isActive, PRIMARY_NAV, SECONDARY_NAV } from "@/lib/nav";
import { TIP_IDS, TIPS } from "@/lib/tips";
import { TOURS } from "@/lib/tours";
import { studentTour } from "@/lib/tours/student";

const migration = readFileSync("supabase/migrations/20261010000000_student_portal.sql", "utf8");

describe("navigation", () => {
  it("has the five places of the phone dock in order, each with a tooltip line (phase 14: Openings)", () => {
    expect(PRIMARY_NAV.map((i) => i.label)).toEqual(["Home", "Openings", "Ventures", "Chat", "Me"]);
    for (const item of [...PRIMARY_NAV, ...SECONDARY_NAV]) {
      expect(item.description.length, item.key).toBeGreaterThan(10);
      expect(item.description, item.key).not.toMatch(/—/);
    }
  });
  it("marks the right item active, and Feedback separately from Me", () => {
    const at = (path: string) => [...PRIMARY_NAV, ...SECONDARY_NAV].filter((i) => isActive(i, path)).map((i) => i.key);
    expect(at("/feed")).toEqual(["home"]);
    expect(at("/openings/competitions")).toEqual(["openings"]);
    expect(at("/yearbook/amna")).toEqual(["yearbook"]);
    expect(at("/leaderboard")).toEqual(["leaderboard"]);
    expect(at("/me/score")).toEqual(["me"]);
    expect(at("/feedback")).toEqual(["feedback"]);
    expect(at("/ventures/abc/team")).toEqual(["ventures"]);
  });
  it("finds the level inside a place: the longest prefix wins", () => {
    const me = PRIMARY_NAV.find((i) => i.key === "me")!;
    expect(activeLevel(me, "/me")?.label).toBe("Overview");
    expect(activeLevel(me, "/me/cv")?.label).toBe("CV");
    expect(activeLevel(me, "/profile/aisha")?.label).toBe("Overview");
    const ventures = PRIMARY_NAV.find((i) => i.key === "ventures")!;
    expect(activeLevel(ventures, "/ventures/abc/team")?.label).toBe("All ventures");
    expect(currentPlace("/feedback")?.key).toBe("feedback");
  });
  it("caps badges at 99+", () => {
    expect(badgeLabel(7)).toBe("7");
    expect(badgeLabel(140)).toBe("99+");
  });
});

describe("the student tour", () => {
  it("points only at anchors the app renders, and its pages are real places", () => {
    // Nav items carry `nav-<key>`; the rest are placed by hand on the pages the tour visits.
    const anchors = new Set([
      ...[...PRIMARY_NAV, ...SECONDARY_NAV].map((i) => `nav-${i.key}`),
      "feed-tabs",
      "composer",
      "progress",
      "openings-this-week",
      "openings-card",
      "sidebar-levels",
      "account-menu",
    ]);
    for (const step of studentTour.steps) expect(anchors.has(step.anchor), step.anchor).toBe(true);
    for (const step of studentTour.steps) if (step.path) expect(["/feed", "/openings", "/me"], step.title).toContain(step.path);
    // Every hand-placed anchor is in the source, so a renamed one fails here and not in front of a student.
    const source = ["app/(app)/feed/page.tsx", "app/(app)/openings/page.tsx", "components/posts/composer.tsx", "components/home/progress-card.tsx", "components/home/progress-chip.tsx", "components/shell/sidebar.tsx", "components/shell/top-bar.tsx"]
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    for (const id of ["feed-tabs", "composer", "progress", "openings-this-week", "openings-card", "sidebar-levels", "account-menu"]) expect(source, id).toContain(`"${id}"`);
  });
  it("starts on Home, ends on Home with one thing to do, and fits the saved step's range", () => {
    expect(studentTour.steps[0]).toMatchObject({ anchor: "nav-home", path: studentTour.startPath });
    const last = studentTour.steps.at(-1)!;
    expect(last.path).toBe("/feed");
    expect(last.cta).toEqual({ label: "Write your first post", focus: "composer" });
    expect(studentTour.steps.filter((s) => s.cta)).toHaveLength(1);
    // tour_progress.step is checked between 0 and 50.
    expect(studentTour.steps.length).toBeLessThanOrEqual(50);
    // The copy rule everywhere in the product: no em dashes.
    for (const step of studentTour.steps) expect(`${step.title} ${step.body}`).not.toMatch(/\u2014/);
  });
  it("uses the tour ids the database accepts", () => {
    for (const id of Object.keys(TOURS)) expect(migration, id).toContain(`'${id}'`);
  });
});

describe("first-visit tips", () => {
  it("match the database's list and have two lines plus a longer one", () => {
    for (const id of TIP_IDS) {
      expect(migration, id).toContain(`'${id}'`);
      expect(TIPS[id].body.length).toBeGreaterThan(20);
      expect(TIPS[id].more.length).toBeGreaterThan(TIPS[id].body.length / 2);
    }
    expect(Object.keys(TIPS).sort()).toEqual([...TIP_IDS].sort());
  });
});

describe("pktDate", () => {
  it("is the date in Pakistan time, not UTC", () => {
    expect(pktDate(new Date("2026-10-02T20:30:00Z"))).toBe("2026-10-03");
    expect(pktDate(new Date("2026-10-02T18:30:00Z"))).toBe("2026-10-02");
  });
});
