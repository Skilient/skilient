import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OUT_PATH, portalOf, render, routeOf } from "../../scripts/figma-inventory.mjs";

describe("Figma screen inventory", () => {
  it("is current: run `pnpm figma:inventory` after adding or changing a page", () => {
    expect(readFileSync(OUT_PATH, "utf8")).toBe(render());
  });

  it("drops route groups from paths", () => {
    expect(routeOf(`${process.cwd()}/app/(app)/teach/(portal)/ideas/[id]/page.tsx`)).toBe("/teach/ideas/[id]");
    expect(routeOf(`${process.cwd()}/app/(marketing)/page.tsx`)).toBe("/");
  });

  it("puts each route in its portal", () => {
    expect(portalOf("/")).toEqual({ portal: "marketing", role: "anonymous" });
    expect(portalOf("/verify/[code]").portal).toBe("marketing");
    expect(portalOf("/ops/users/[id]").portal).toBe("ops");
    expect(portalOf("/uni/students").portal).toBe("university");
    expect(portalOf("/feed")).toEqual({ portal: "student", role: "student" });
  });

  it("lists every tab of a tabbed page", () => {
    const { entries } = JSON.parse(render()) as { entries: { route: string; tabs: { values: string[] } | null }[] };
    const tabs = (r: string) => entries.find((e) => e.route === r)?.tabs?.values;
    expect(tabs("/opportunities/[tab]")).toHaveLength(7);
    expect(tabs("/friends")).toEqual(["friends", "received", "sent", "blocked"]);
    expect(tabs("/ideas/[id]")).toBeUndefined();
  });
});
