import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Every token pair the app draws text or controls with passes WCAG 2.2 in both themes (phase 14;
 * the brief: "check token pairs at build time"). Reads app/styles/tokens.css and resolves var()
 * references the way the browser does for a whole-page theme: raw palette, then derived tokens.
 */
const css = readFileSync("app/styles/tokens.css", "utf8");

/** The declarations of the first rule whose selector list is exactly `selector`. */
function block(selector: string): Record<string, string> {
  const start = css.indexOf(`\n${selector} {`);
  if (start === -1) throw new Error(`no block ${JSON.stringify(selector)}`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("\n}", open);
  const body = css.slice(open + 1, close).replace(/\/\*[\s\S]*?\*\//g, "");
  return Object.fromEntries([...body.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const rawLight = block(":root,\n.light");
const rawDark = block(".dark");
const derived = block(":root,\n.light,\n.dark");
const classicLight = block(".classic,\n.light .classic");
const classicDark = { ...classicLight, ...block(".dark .classic,\n.classic.dark") };

function theme(...layers: Record<string, string>[]): (name: string) => string {
  const all = Object.assign({}, ...layers) as Record<string, string>;
  const resolve = (name: string, depth = 0): string => {
    const value = all[name];
    if (value === undefined) throw new Error(`undefined token ${name}`);
    if (depth > 10) throw new Error(`cycle at ${name}`);
    const ref = /^var\((--[a-z0-9-]+)\)$/.exec(value);
    return ref ? resolve(ref[1], depth + 1) : value;
  };
  return (name) => resolve(name);
}

function luminance(hex: string): number {
  const n = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(n)) throw new Error(`not a hex colour: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const THEMES = [
  ["light", theme(rawLight, derived)],
  ["dark", theme(rawLight, rawDark, derived)],
] as const;

/** Body text on every ground it sits on: the surface and the tinted rows. */
const BODY_TEXT = ["--text-primary", "--text-secondary", "--text-muted", "--text-error", "--verified", "--signal-ink", "--success", "--warning"];
const GROUNDS = ["--bg-page", "--bg-surface", "--bg-elevated", "--surface-hi", "--surface-lo", "--bg-subtle"];
const TIERS = ["raw", "spark", "flare", "shine", "radiant", "luminary"];

describe("token contrast (WCAG 2.2, both themes)", () => {
  it("has the same raw palette keys in light and dark", () => {
    expect(Object.keys(rawDark).sort()).toEqual(Object.keys(rawLight).sort());
  });

  it.each(THEMES)("keeps body text at 4.5:1 or more on every ground (%s)", (_, t) => {
    for (const fg of BODY_TEXT) {
      for (const bg of GROUNDS) {
        expect(contrast(t(fg), t(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it.each(THEMES)("keeps text on filled controls at 4.5:1 (%s)", (_, t) => {
    expect(contrast(t("--text-on-primary"), t("--interactive-primary")), "ink on signal").toBeGreaterThanOrEqual(4.5);
    expect(contrast(t("--text-on-primary"), t("--interactive-primary-hover")), "ink on signal hover").toBeGreaterThanOrEqual(4.5);
    expect(contrast(t("--text-on-accent"), t("--interactive-accent")), "on-ink on ink").toBeGreaterThanOrEqual(4.5);
    expect(contrast(t("--text-on-verified"), t("--verified")), "on-ink on the seal").toBeGreaterThanOrEqual(4.5);
    expect(contrast(t("--text-primary"), t("--interactive-primary-subtle")), "ink on the signal wash").toBeGreaterThanOrEqual(4.5);
    expect(contrast(t("--ink-accent"), t("--ink")), "orange on the ink card").toBeGreaterThanOrEqual(4.5);
  });

  it.each(THEMES)("keeps tier text at 4.5:1 on the surface (%s)", (_, t) => {
    for (const tier of TIERS) {
      expect(contrast(t(`--tier-${tier}-text`), t("--bg-surface")), tier).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(THEMES)("keeps the focus ring, the error ring and icons at 3:1 (%s)", (_, t) => {
    expect(contrast(t("--focus-ring"), t("--bg-surface")), "focus ring").toBeGreaterThanOrEqual(3);
    expect(contrast(t("--error"), t("--bg-surface")), "error ring").toBeGreaterThanOrEqual(3);
    expect(contrast(t("--info"), t("--bg-surface")), "info icon").toBeGreaterThanOrEqual(3);
  });

  it.each(THEMES)("keeps focus and error apart (%s)", (_, t) => {
    expect(t("--focus-ring")).not.toBe(t("--error"));
    expect(t("--error")).not.toBe(t("--interactive-primary"));
  });

  it.each(THEMES)("keeps tier finishes legible under ink text (%s)", () => {
    // The tier badge prints ink (#1b1b19) on its finish in both themes.
    for (const finish of ["#c6a16a", "#eaab93", "#e1592b", "#d6a21e", "#e9a35f", "#b48ad8"]) {
      expect(contrast("#1b1b19", finish), finish).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("classic scope (/ops keeps PRD 9)", () => {
  it.each([
    ["light", theme(classicLight)],
    ["dark", theme(classicDark)],
  ] as const)("keeps body-safe text at 4.5:1 (%s)", (_, t) => {
    for (const fg of ["--text-primary", "--text-secondary", "--text-muted", "--text-error", "--verified"]) {
      for (const bg of ["--bg-page", "--bg-surface", "--bg-elevated"]) {
        expect(contrast(t(fg), t(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(t("--text-on-primary"), t("--interactive-primary"))).toBeGreaterThanOrEqual(4.5);
    for (const tier of TIERS) expect(contrast(t(`--tier-${tier}-text`), t("--bg-surface")), tier).toBeGreaterThanOrEqual(4.5);
  });
});
