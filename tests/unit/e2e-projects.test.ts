import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards for how E2E specs are collected (decisions 2026-11-04, "CI speed"; playwright.config.ts):
 * a test that belongs to one screen size is tagged @desktop-only or @phone-only so the other project
 * never collects it, instead of skipping at run time (which Playwright still counted when it split
 * shards). Every spec takes `test` from tests/e2e/fixtures.ts, which closes stray browser contexts.
 */
const dir = "tests/e2e";
const specs = readdirSync(dir).filter((f) => f.endsWith(".spec.ts")).map((f) => ({ file: f, source: readFileSync(join(dir, f), "utf8") }));

describe("E2E collection", () => {
  it("never skips by project name at run time", () => {
    const offenders = specs.filter((s) => /test\.(skip|fixme)\([^)]*project\.name/.test(s.source)).map((s) => s.file);
    expect(offenders, "tag the test or describe with @desktop-only / @phone-only instead").toEqual([]);
  });

  it("takes test from ./fixtures", () => {
    const offenders = specs.filter((s) => /import\s*\{[^}]*\btest\b[^}]*\}\s*from\s*"@playwright\/test"/.test(s.source)).map((s) => s.file);
    expect(offenders).toEqual([]);
  });

  it("uses only the project tags the config knows", () => {
    const tags = new Set(specs.flatMap((s) => [...s.source.matchAll(/"@(desktop|phone)[\w-]*"/g)].map((m) => m[0])));
    expect([...tags].sort()).toEqual(['"@desktop-only"', '"@phone-only"']);
  });
});
