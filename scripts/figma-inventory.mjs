#!/usr/bin/env node
/**
 * Figma screen inventory (docs/figma/README.md). Walks every app/**\/page.tsx and writes
 * docs/figma/screens.json: one entry per route with its portal, who can open it, its in-page
 * tabs (?tab= and the dynamic segments that are really tabs), the components it composes
 * (its sections), and the states a frame set needs. The Figma build and the capture script
 * (tests/figma/figma.capture.ts) both read this file.
 *
 *   node scripts/figma-inventory.mjs --write   # after adding or changing a page
 *   node scripts/figma-inventory.mjs --check   # exits 1 if screens.json is stale
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const OUT_PATH = join(ROOT, "docs/figma/screens.json");

/** Dynamic segments that are tabs, not ids: the constant that lists their values. */
const SEGMENT_TABS = {
  "/opportunities/[tab]": ["lib/data/portal.ts", "OPPORTUNITY_TABS"],
  "/onboarding/[step]": ["lib/auth/gate.ts", "ONBOARDING_STEPS"],
  "/uni/dashboard/[area]": ["lib/uni/constants.ts", "DASHBOARD_AREAS"],
  "/ops/users/[id]/view/[page]": ["lib/data/ops-users.ts", "VIEW_PAGES"],
};

/** Routes whose screen needs a different account than their portal's default. */
const ROLE_OVERRIDES = {
  "/onboarding/done": "student", // only after the wizard is finished
  "/signin/mfa": "mfa_pending", // two-factor on, password step done
};

/** Tabs the page builds in a way the extractor can't read (a template-literal href). */
const EXTRA_TABS = {
  "/ops/feedback": { param: "tab", values: ["open", "closed"] },
};

/** Portal, and the role whose account opens it, by route prefix (first match wins). */
const PORTALS = [
  ["/ui", "dev", "anyone"],
  ["/ops", "ops", "super_admin"],
  ["/uni", "university", "university_owner"],
  ["/u/", "university", "student"],
  ["/teach", "teacher", "teacher"],
  ["/recruit", "recruiter", "recruiter"],
  ["/org", "recruiter", "recruiter"],
  ["/companies", "recruiter", "student"],
  ["/signin", "auth", "anonymous"],
  ["/signup", "auth", "anonymous"],
  ["/forgot-password", "auth", "anonymous"],
  ["/reset-password", "auth", "anonymous"],
  ["/auth", "auth", "anonymous"],
  ["/onboarding", "onboarding", "onboarding_student"],
  ["/agreement", "onboarding", "new_student"],
  ["/cv/", "public", "anonymous"],
];
const MARKETING = ["/", "/about", "/faculty", "/pricing", "/privacy", "/recruiters", "/request-university", "/terms", "/universities", "/verify"];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name === "page.tsx") out.push(p);
  }
  return out;
}

/** app/(app)/teach/(portal)/ideas/[id]/page.tsx → /teach/ideas/[id] */
export function routeOf(file) {
  const parts = relative(join(ROOT, "app"), dirname(file)).split(/[\\/]/).filter((s) => s && !/^\(.*\)$/.test(s));
  return `/${parts.join("/")}`;
}

/** The literal block after `const NAME ... =`, bracket-matched. */
function constBlock(src, name) {
  const at = src.search(new RegExp(`const ${name}\\b[^=]*=\\s*[\\[{]`));
  if (at < 0) return null;
  const eq = src.indexOf("=", at);
  const start = eq + src.slice(eq).search(/[[{]/);
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === "[" || src[i] === "{") depth++;
    else if (src[i] === "]" || src[i] === "}") if (--depth === 0) return src.slice(start, i + 1);
  }
  return null;
}

/** Values of a tabs constant: `key:`/`id:` fields, or a plain string array. */
function constValues(block) {
  const keyed = [...block.matchAll(/\b(?:key|id|value):\s*"([^"]+)"/g)].map((m) => m[1]);
  return keyed.length ? keyed : [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

function uniq(xs) {
  return [...new Set(xs)];
}

export function tabsOf(route, src) {
  const seg = SEGMENT_TABS[route];
  if (seg) {
    const block = constBlock(readFileSync(join(ROOT, seg[0]), "utf8"), seg[1]);
    return { kind: "segment", values: block ? constValues(block) : [] };
  }
  if (EXTRA_TABS[route]) return { kind: "query", ...EXTRA_TABS[route] };
  const block = constBlock(src, "TABS");
  const fromConst = block ? constValues(block) : [];
  // Only links back to this page count; `/explore?tab=ideas` on another page is a link, not a tab.
  const self = route.replace(/\/\[.*$/, "");
  const links = [...src.matchAll(/["`]([^"`?]*)\?(?:[^"`]*&)?(tab|status)=([a-z_$]+)/g)].filter(
    (m) => m[1] === self || m[1].startsWith(`${self}/`),
  );
  const param = links[0]?.[2] ?? "tab";
  const fromLinks = links.map((m) => m[3]).filter((v) => !v.startsWith("$"));
  const fromChecks = [...src.matchAll(/\btab === "([a-z_]+)"/g)].map((m) => m[1]);
  const values = uniq([...fromConst, ...fromLinks, ...fromChecks]);
  return values.length ? { kind: "query", param, values } : null;
}

/** Components the page renders from components/ (its sections), in import order. */
export function sectionsOf(src) {
  const names = [];
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*"@\/components\/(?!ui\b)[^"]+"/g)) {
    for (const n of m[1].split(",")) {
      const name = n.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop();
      if (/^[A-Z]/.test(name) && new RegExp(`<${name}[\\s/>]`).test(src)) names.push(name);
    }
  }
  for (const m of src.matchAll(/import\s+([A-Z]\w*)\s+from\s*"@\/components\/[^"]+"/g)) {
    if (new RegExp(`<${m[1]}[\\s/>]`).test(src)) names.push(m[1]);
  }
  return uniq(names);
}

export function portalOf(route) {
  if (MARKETING.some((m) => route === m || (m !== "/" && route.startsWith(`${m}/`)))) return { portal: "marketing", role: "anonymous" };
  const hit = PORTALS.find(([p]) => route === p.replace(/\/$/, "") || route.startsWith(p.endsWith("/") ? p : `${p}/`) || route === p);
  return hit ? { portal: hit[1], role: hit[2] } : { portal: "student", role: "student" };
}

export function buildInventory() {
  const files = walk(join(ROOT, "app")).sort();
  const screens = files.map((file) => {
    const route = routeOf(file);
    const src = readFileSync(file, "utf8");
    const dir = dirname(file);
    const has = (n) => {
      try {
        return statSync(join(dir, n)).isFile();
      } catch {
        return false;
      }
    };
    const states = ["default"];
    if (/\bEmptyState\b|empty/i.test(src)) states.push("empty");
    if (has("loading.tsx")) states.push("loading");
    if (has("error.tsx") || /\bErrorState\b/.test(src)) states.push("error");
    // A page whose default export only calls redirect() is not a screen.
    const redirectOnly = /export default (?:async )?function \w*\([^)]*\)\s*\{\s*redirect\(/.test(src.replace(/\/\/[^\n]*\n|\/\*[\s\S]*?\*\//g, ""));
    const { portal, role } = portalOf(route);
    return {
      route,
      file: relative(ROOT, file),
      portal,
      role: ROLE_OVERRIDES[route] ?? role,
      ...(redirectOnly ? { redirectOnly: true } : {}),
      tabs: tabsOf(route, src),
      sections: sectionsOf(src),
      states,
      variants: ["desktop-light", "desktop-dark", "phone-light", "phone-dark"],
    };
  });
  const frames = screens.filter((s) => !s.redirectOnly).reduce((n, s) => n + (s.tabs?.values.length || 1) * s.states.length * s.variants.length, 0);
  return { generatedBy: "scripts/figma-inventory.mjs", screens: screens.length, frames, entries: screens };
}

export function render() {
  return `${JSON.stringify(buildInventory(), null, 2)}\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const next = render();
  if (process.argv.includes("--write")) {
    writeFileSync(OUT_PATH, next);
    const inv = JSON.parse(next);
    console.log(`wrote ${relative(ROOT, OUT_PATH)}: ${inv.screens} screens, ${inv.frames} frames`);
  } else {
    let cur = "";
    try {
      cur = readFileSync(OUT_PATH, "utf8");
    } catch {}
    if (cur !== next) {
      console.error("docs/figma/screens.json is stale: run `pnpm figma:inventory`");
      process.exit(1);
    }
    console.log("docs/figma/screens.json is current");
  }
}
