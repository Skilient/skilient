import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SWEEP, sweepPath } from "../e2e/sweep-routes";

function pages(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...pages(full));
    else if (name === "page.tsx") out.push(full);
  }
  return out;
}

const routes = pages("app").map((file) =>
  (file.replace(/^app/, "").replace(/\/page\.tsx$/, "").replace(/\/\([^)]+\)/g, "") || "/").replace(/\\/g, "/"),
);

describe("CSP sweep coverage", () => {
  it("visits every page in app/", () => {
    const swept = new Set(SWEEP.map((s) => s.route));
    expect(routes.filter((route) => !swept.has(route)).sort()).toEqual([]);
  });

  it("lists no page that doesn't exist", () => {
    const real = new Set(routes);
    expect([...new Set(SWEEP.map((s) => s.route))].filter((route) => !real.has(route))).toEqual([]);
  });

  it("fills segments from fixtures, literals or a made-up id", () => {
    const fixtures = { username: "amna", venture: "v1" };
    expect(sweepPath({ route: "/profile/[username]/skills", role: "student", params: { username: "username" } }, fixtures)).toBe("/profile/amna/skills");
    expect(sweepPath({ route: "/opportunities/[tab]", role: "student", params: { tab: "=jobs" } }, fixtures)).toBe("/opportunities/jobs");
    expect(sweepPath({ route: "/u/[slug]/[[...page]]", role: "student", params: { slug: "uniSlug" } }, { uniSlug: "nutech" })).toBe("/u/nutech");
    expect(sweepPath({ route: "/post/[id]", role: "student" }, fixtures)).toMatch(/^\/post\/0{8}-/);
  });
});
