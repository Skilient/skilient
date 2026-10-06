#!/usr/bin/env node
/**
 * Figma layout compactor (docs/figma/README.md). Turns a captured layout tree
 * (docs/figma/reference/<portal>/<screen>__<tab>__<viewport>-light.json) into small chunks that
 * docs/figma/converter.js builds as editable Figma layers: wrappers without paint collapsed,
 * colours as Figma variable names, text as text-style names, Skilient UI primitives recognised
 * by their Tailwind classes (Button, Input, Select, Checkbox, Switch) and Phosphor icons by path.
 *
 *   node scripts/figma-compact.mjs auth/signin__default__desktop   # prints chunk files written
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REF = join(ROOT, "docs/figma/reference");
const OUT = join(REF, "compact");
const CHUNK_BYTES = 30_000;

/** CSS custom property → Figma Color variable (the collection's code syntax is var(--x)). */
const COLOR_GROUPS = [
  [/^--bg-/, "bg/"], [/^--text-/, "text/"], [/^--border-/, "border/"], [/^--interactive-/, "interactive/"],
  [/^--tier-/, "tier/"], [/^--series-/, "series/"],
];
export function colorVar(token) {
  if (!token || !token.startsWith("--")) return null;
  const t = token.replace(/^--color-/, "--");
  if (t === "--focus-ring") return "interactive/focus-ring";
  if (t === "--verified") return "proof/verified";
  if (t === "--verified-subtle") return "proof/verified-subtle";
  if (/^--(success|warning|error|info)$/.test(t)) return `status/${t.slice(2)}`;
  if (t === "--primary") return "interactive/primary";
  if (t === "--accent") return "interactive/accent";
  for (const [re, g] of COLOR_GROUPS) if (re.test(t)) return g + t.replace(re, "");
  return null;
}

/** Text styles from slice 1 (family, weight, size in px). */
const TEXT_STYLES = [
  ["Display/Desktop", "Spectral", 500, 67.5], ["Display/Phone", "Spectral", 500, 41.25], ["H1", "Spectral", 500, 40], ["H2", "Spectral", 500, 30],
  ["H3", "Barlow", 600, 22], ["H4", "Barlow", 600, 17], ["Body LG", "Barlow", 400, 18], ["Body LG Strong", "Barlow", 600, 18],
  ["Body", "Barlow", 400, 15], ["Body Medium", "Barlow", 500, 15], ["Body Strong", "Barlow", 600, 15],
  ["Body SM", "Barlow", 400, 13], ["Body SM Strong", "Barlow", 600, 13], ["Label", "Barlow", 600, 12],
  ["Caption", "Barlow", 500, 11], ["Caption Strong", "Barlow", 600, 11], ["Code", "JetBrains Mono", 400, 13], ["Code SM", "JetBrains Mono", 400, 11],
];
export function textStyle(font) {
  const fam = /spectral/i.test(font.family) ? "Spectral" : /jetbrains|mono/i.test(font.family) ? "JetBrains Mono" : "Barlow";
  let best = null;
  for (const [name, f, w, s] of TEXT_STYLES) {
    if (f !== fam || (fam !== "Spectral" && Math.abs(w - font.weight) > 50)) continue;
    const d = Math.abs(s - font.size);
    if (d <= 1.5 && (!best || d < best.d)) best = { name, d };
  }
  return best?.name ?? null;
}

/** Icons in the Figma library (slice 1): preferred when several Phosphor icons share a path start. */
const LIBRARY = new Set(JSON.parse(readFileSync(join(ROOT, "docs/figma/icons.json"), "utf8")));
export function iconName(map, d) {
  const names = d ? map[d.slice(0, 160)] ?? map[Object.keys(map).find((k) => k.startsWith(d) || d.startsWith(k)) ?? ""] : null;
  if (!names) return null;
  return names.find((n) => LIBRARY.has(n)) ?? names[0];
}

/** Path-start → Phosphor icon names, for every weight (cached). */
async function iconPrefixes() {
  const cache = join(REF, "icon-prefixes-v2.json");
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, "utf8"));
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const P = await import("@phosphor-icons/react/dist/ssr");
  const map = {};
  for (const [name, C] of Object.entries(P)) {
    if (!/^[A-Z]/.test(name) || name.endsWith("Icon") || typeof C !== "object") continue;
    for (const weight of ["regular", "bold", "fill", "light", "thin", "duotone"]) {
      try {
        const d = renderToStaticMarkup(createElement(C, { weight })).match(/<path[^>]*d="([^"]+)"/)?.[1];
        if (d) (map[d.slice(0, 160)] ??= []).push(name);
      } catch {}
    }
  }
  mkdirSync(REF, { recursive: true });
  writeFileSync(cache, JSON.stringify(map));
  return map;
}

const r1 = (n) => Math.round(n * 10) / 10;
const textOf = (n) => [n.text ?? "", ...(n.children ?? []).map(textOf)].join(" ").replace(/\s+/g, " ").trim();
const paint = (v) => (v ? colorVar(v) ?? v : undefined);

/** Map one dump node (absolute box) to a compact node with a box relative to its parent. */
function convert(n, px, py, icons) {
  const [x, y, w, h] = n.box;
  if (w <= 1 && h <= 1) return null; // sr-only text and hidden inputs
  const b = [r1(x - px), r1(y - py), r1(w), r1(h)];
  const cls = n.cls ?? "";
  // Skilient primitives, recognised by their base classes (components/ui).
  if (/select-none items-center justify-center rounded-md/.test(cls)) {
    // Variant and size from what was painted (the class hint is cut short).
    const fill = n.fill ?? "", stroke = n.border?.color ?? "";
    const disabled = /bg-muted$/.test(fill);
    const variant = disabled || /interactive-primary$/.test(fill) ? "primary" : /interactive-accent$/.test(fill) ? "accent" : /error/.test(stroke) ? "danger" : stroke ? "secondary" : "ghost";
    const size = h < 34 ? "sm" : h < 42 ? "md" : "lg";
    const svgs = (n.children ?? []).filter((c) => c.tag === "svg");
    const lead = svgs.find((s) => s.box[0] < x + w / 2), trail = svgs.find((s) => s.box[0] >= x + w / 2);
    return { k: "button", b, v: variant, sz: size, l: textOf(n), li: lead && iconName(icons, lead.d), ti: trail && iconName(icons, trail.d), dis: disabled };
  }
  if (n.tag === "input" && /checkbox|radio/.test(cls)) return { k: "checkbox", b };
  // A native checkbox reports its value "on" and a square box no bigger than a line of text.
  if (n.tag === "input" && n.text === "on" && b[2] <= 24 && Math.abs(b[2] - b[3]) <= 2) return { k: "checkbox", b, on: true };
  if (/peer inline-flex size-5/.test(cls)) return { k: "checkbox", b, on: n.fill === "--interactive-primary" };
  if (/h-6 w-10 shrink-0 items-center rounded-full/.test(cls)) return { k: "switch", b, on: n.fill === "--interactive-primary" };
  if ((n.tag === "input" || n.tag === "textarea" || /justify-between gap-2 text-left/.test(cls)) && /bg-bg-subtle px-3/.test(cls)) {
    const kind = n.tag === "textarea" ? "textarea" : n.tag === "input" ? "input" : "select";
    const err = n.border && /error/.test(n.border.color);
    const val = textOf(n);
    return { k: kind, b, val, filled: Boolean(val) && !n.ph, err };
  }
  if (n.tag === "svg") return { k: "icon", b, i: iconName(icons, n.d), c: paint(n.color) };
  if (n.tag === "img") {
    const src = n.src ?? "";
    if (/\/brand\/|skilient-(logo|icon)/.test(src)) return { k: "logo", b, mark: w / h < 1.6 };
    return { k: "image", b, src: src.replace(/^https?:\/\/[^/]+/, "").slice(0, 120) };
  }
  const out = { k: "frame", b, tag: n.tag };
  if (n.testid) out.id = n.testid;
  if (n.fill) out.f = paint(n.fill);
  if (n.border) out.s = [paint(n.border.color), n.border.width];
  if (n.radius) out.r = Math.min(n.radius, 9999);
  if (n.shadow) out.sh = 1;
  let children = n.children ?? [];
  if (n.text !== undefined && n.font) {
    out.x = n.text;
    out.c = paint(n.color);
    out.st = textStyle(n.font);
    if (!out.st) out.fn = [n.font.family, n.font.size, n.font.weight, n.font.line];
    // One line in the browser: Figma should not wrap it (its metrics run slightly wider).
    if (h <= n.font.line * 1.5) out.sl = 1;
    // Icon before the text (an arrow link): the text starts after it.
    if (n.runs && typeof n.runs[0] === "number") {
      const lead = (n.children ?? []).find((c) => c.ei === n.runs[0]);
      if (lead && lead.text === undefined) {
        // Column (a tab: icon over label) offsets the text down; a row offsets it right.
        if (n.layout?.dir === "column") out.ty = r1(lead.box[1] + lead.box[3] - y + (n.layout.gap || 2));
        else out.tx = r1(lead.box[0] + lead.box[2] - x + (n.layout?.gap || 4));
      }
    }
    if (n.font.align) out.al = n.font.align;
    // Text sharing a flex row with other children sits where the row centres it.
    // Only justify-content centres text horizontally; align-items: center on a row is vertical.
    else if ((n.children ?? []).length && n.layout && /center/.test(n.layout.justify ?? "")) out.al = "center";
    // Only an unprefixed class counts (hover:underline is not drawn at rest).
    if (n.tag === "a" && /(^|\s)underline(\s|$)/.test(cls)) out.u = 1;
    if (/(^|\s)line-through(\s|$)/.test(cls)) out.lt = 1;
    if (n.font.upper) out.up = 1;
    // Mixed inline text (a sentence with a link or bold word): one text node with styled runs.
    const inline = (c) => c.text !== undefined && !c.fill && !c.border && !(c.children ?? []).length && /^(a|span|strong|b|em|i|code|small|mark|button)$/.test(c.tag);
    if (n.runs && children.length && children.every(inline)) {
      out.x = n.runs.map((r) => (typeof r === "string" ? r : children.find((c) => c.ei === r)?.text ?? "")).join("").replace(/\s+/g, " ").trim();
      out.rn = n.runs.filter((r) => typeof r === "number").map((r) => {
        const c = children.find((k) => k.ei === r);
        return c ? { t: c.text, st: textStyle(c.font), c: paint(c.color), u: c.tag === "a" ? 1 : 0 } : null;
      }).filter(Boolean);
      children = [];
    }
  }
  const kids = children.map((c) => convert(c, x, y, icons)).filter(Boolean);
  if (kids.length) out.ch = kids;
  const painted = out.f || out.s || out.sh || out.x !== undefined;
  if (!painted && !kids.length) return null; // empty wrapper
  if (!painted && kids.length === 1) {
    // Hoist the only child: its box becomes relative to this node's parent.
    const c = kids[0];
    c.b = [r1(c.b[0] + b[0]), r1(c.b[1] + b[1]), c.b[2], c.b[3]];
    return c;
  }
  return out;
}

export async function compact(screen) {
  const icons = await iconPrefixes();
  const tree = JSON.parse(readFileSync(join(REF, `${screen}-light.json`), "utf8"));
  const root = tree.root;
  const top = convert(root, 0, 0, icons);
  // Sections: the outermost node with more than one child.
  let sec = top;
  while (sec.ch && sec.ch.length === 1 && sec.ch[0].ch) sec = { ...sec.ch[0], b: [sec.b[0] + sec.ch[0].b[0], sec.b[1] + sec.ch[0].b[1], sec.ch[0].b[2], sec.ch[0].b[3]] };
  const sections = (sec.ch ?? [sec]).map((c) => ({ ...c, b: [r1(c.b[0] + sec.b[0]), r1(c.b[1] + sec.b[1]), c.b[2], c.b[3]] }));
  const chunks = [];
  let cur = [];
  for (const s of sections) {
    const size = JSON.stringify(s).length;
    if (cur.length && JSON.stringify(cur).length + size > CHUNK_BYTES) { chunks.push(cur); cur = []; }
    cur.push(s);
  }
  if (cur.length) chunks.push(cur);
  const [w, h] = [root.box[2], root.box[3]];
  const base = screen.replace(/\//g, "~");
  mkdirSync(OUT, { recursive: true });
  const files = chunks.map((c, i) => {
    const f = join(OUT, `${base}.${i}.json`);
    writeFileSync(f, JSON.stringify({ screen, w, h, part: i, parts: chunks.length, bg: "bg/page", sections: c }));
    return { file: f, bytes: JSON.stringify(c).length, sections: c.length };
  });
  return files;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const s of process.argv.slice(2)) for (const f of await compact(s)) console.log(f.file.replace(ROOT + "/", ""), f.bytes, "bytes,", f.sections, "sections");
}
