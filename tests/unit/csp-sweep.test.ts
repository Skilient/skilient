import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SWEEP, SWEEP_CHUNK, chunkTitle, sweepChunks, sweepPath, type SweepRole } from "../e2e/sweep-routes";

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
    expect(sweepPath({ route: "/openings/[category]", role: "student", params: { category: "=jobs" } }, fixtures)).toBe("/openings/jobs");
    expect(sweepPath({ route: "/u/[slug]/[[...page]]", role: "student", params: { slug: "uniSlug" } }, { uniSlug: "nutech" })).toBe("/u/nutech");
    expect(sweepPath({ route: "/post/[id]", role: "student" }, fixtures)).toMatch(/^\/post\/0{8}-/);
  });

  it("splits each role into chunks that together are exactly its routes, in order", () => {
    for (const role of ["visitor", "student", "faculty", "recruiter", "official", "staff"] as SweepRole[]) {
      const chunks = sweepChunks(role);
      expect(chunks.flat()).toEqual(SWEEP.filter((s) => s.role === role));
      for (const chunk of chunks) expect(chunk.length).toBeGreaterThan(0);
      for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(SWEEP_CHUNK);
      const titles = chunks.map((_, i) => chunkTitle(role, chunks, i));
      expect(new Set(titles).size).toBe(titles.length);
    }
  });
});
