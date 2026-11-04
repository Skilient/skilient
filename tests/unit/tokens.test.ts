import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tokens = readFileSync("app/styles/tokens.css", "utf8");
const globals = readFileSync("app/globals.css", "utf8");

function block(selectorStart: string): Record<string, string> {
  const start = tokens.indexOf(selectorStart);
  const open = tokens.indexOf("{", start);
  const close = tokens.indexOf("\n}", open);
  const body = tokens.slice(open + 1, close);
  return Object.fromEntries([...body.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

// The raw palette (block 1); derived tokens and contrast live in tokens-contrast.test.ts.
const light = block(":root,\n.light {");
const dark = block("\n.dark {");

describe("design tokens", () => {
  it("defines every themed variable in both light and dark", () => {
    const lightKeys = Object.keys(light).sort();
    const darkKeys = Object.keys(dark).sort();
    expect(darkKeys).toEqual(lightKeys);
  });

  it("maps only variables that exist in tokens.css into @theme", () => {
    const referenced = [...globals.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]);
    const defined = new Set([...(tokens + globals).matchAll(/(--[a-z0-9-]+):/g)].map((m) => m[1]));
    const fromNextFont = new Set(["--font-space-grotesk", "--font-spectral", "--font-barlow", "--font-jetbrains-mono"]);
    const missing = referenced.filter((v) => !defined.has(v) && !fromNextFont.has(v));
    expect(missing).toEqual([]);
  });

  it("keeps a PRD 9 classic scope for /ops with every semantic name the app uses", () => {
    const classic = block(".classic,\n.light .classic");
    for (const name of ["--bg-page", "--bg-surface", "--text-primary", "--text-secondary", "--interactive-primary", "--focus-ring", "--verified", "--elevation-2", "--r-lg"]) {
      expect(classic[name], name).toBeDefined();
    }
  });
});
