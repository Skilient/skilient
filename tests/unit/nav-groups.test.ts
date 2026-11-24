import { describe, expect, it } from "vitest";
import { activeLevel, ALL_NAV, levelGroups, PRIMARY_NAV } from "@/lib/nav";

describe("sidebar level groups (2026-11-15)", () => {
  it("groups every level of a place, or none of them", () => {
    for (const place of ALL_NAV) {
      const grouped = (place.levels ?? []).filter((l) => l.group).length;
      expect([0, place.levels?.length ?? 0], place.key).toContain(grouped);
    }
  });

  it("keeps each heading's levels together, in order", () => {
    const openings = PRIMARY_NAV.find((p) => p.key === "openings")!;
    expect(levelGroups(openings).map((g) => [g.heading, g.levels.map((l) => l.label)])).toEqual([
      ["Overview", ["All openings", "This week"]],
      ["Build", ["Venture roles", "Project ideas"]],
      ["Join", ["Inductions", "Events"]],
      ["Grow", ["Paths", "Skill swaps"]],
    ]);
    const me = PRIMARY_NAV.find((p) => p.key === "me")!;
    expect(levelGroups(me).map((g) => g.heading)).toEqual(["You", "Proof", "Career", "Account"]);
    for (const place of ALL_NAV) {
      const headings = levelGroups(place).map((g) => g.heading);
      expect(new Set(headings).size, `${place.key} repeats a heading`).toBe(headings.length);
    }
  });

  it("leaves small places as one plain list", () => {
    const home = PRIMARY_NAV.find((p) => p.key === "home")!;
    expect(levelGroups(home)).toEqual([{ heading: null, levels: home.levels }]);
  });

  it("still finds the level you are on", () => {
    const me = PRIMARY_NAV.find((p) => p.key === "me")!;
    expect(activeLevel(me, "/me/cv")?.label).toBe("CV");
    expect(activeLevel(me, "/me/tasks/abc")?.label).toBe("Paths");
    const openings = PRIMARY_NAV.find((p) => p.key === "openings")!;
    expect(activeLevel(openings, "/ideas/abc")?.label).toBe("Project ideas");
  });
});
