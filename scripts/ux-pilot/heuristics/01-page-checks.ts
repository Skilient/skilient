/**
 * Probe 1: page checks at 390 dark, 390 light and 1280 dark on every visitor, student and faculty page.
 * axe WCAG 2.2 AA; sideways scroll; reflow at 320 px and the WCAG text-spacing override (390 dark pass only);
 * icon-only controls without a name or tooltip (H06); primary-styled actions (H08); target sizes, thumb reach of the
 * primary action, destructive controls within 8 px of a primary one (FIT, ACC); selects over 15 options and nav
 * item counts (HCK); fields per form (MIL); pointer cursor on non-focusable elements (AFF); every visible string
 * to strings.json. Raw results to probes.json under "pages".
 */
import AxeBuilder from "@axe-core/playwright";
import { writeFileSync, readFileSync } from "node:fs";
import { launch, context, page, ready, signIn, accounts, type Ctx } from "../lib/browser.ts";
import { sql } from "../lib/act.ts";
import { routes, save } from "./lib.ts";

const A = accounts();
const CONFIGS: (Ctx & { key: string })[] = [
  { key: "390-dark", device: "phone", colorScheme: "dark", throttle: false },
  { key: "390-light", device: "phone", colorScheme: "light", throttle: false },
  { key: "1280-dark", device: "desktop", colorScheme: "dark", throttle: false },
];
const ONLY = process.env.ONLY_CONFIG;
const all = await routes();
const b = await launch();
const results: any[] = [];
const strings: Record<string, string[]> = {};

const MEASURE = () => {
  const vis = (el: Element) => { const r = (el as HTMLElement).getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0"; };
  const ctrls = Array.from(document.querySelectorAll('a[href], button, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], input:not([type="hidden"]), select, textarea, summary')).filter(vis) as HTMLElement[];
  const nameOf = (e: HTMLElement) => (e.getAttribute("aria-label") || (e.getAttribute("aria-labelledby") ? e.getAttribute("aria-labelledby")!.split(" ").map((id) => document.getElementById(id)?.innerText ?? "").join(" ") : "") || e.innerText || (e as HTMLInputElement).labels?.[0]?.innerText || e.getAttribute("title") || (e as HTMLInputElement).placeholder || "").trim();
  const iconOnly = ctrls.filter((e) => ["A", "BUTTON"].includes(e.tagName) || e.getAttribute("role") === "button").filter((e) => !e.innerText.trim() && e.querySelector("svg, img"));
  const unnamedIcons = iconOnly.filter((e) => !nameOf(e)).map((e) => e.outerHTML.slice(0, 120));
  const noTooltip = iconOnly.filter((e) => nameOf(e) && !e.getAttribute("aria-describedby") && !e.getAttribute("title")).map((e) => nameOf(e)).slice(0, 15);
  const unnamedCtrls = ctrls.filter((e) => !nameOf(e) && !(e as HTMLInputElement).type?.match(/file|hidden/)).map((e) => `${e.tagName}${e.getAttribute("role") ? "[" + e.getAttribute("role") + "]" : ""}${(e as HTMLInputElement).type ? ":" + (e as HTMLInputElement).type : ""}`);
  // Primary-styled: solid orange background (the accent).
  const isPrimary = (e: HTMLElement) => { const m = getComputedStyle(e).backgroundColor.match(/\d+/g); if (!m) return false; const [r, g, bl] = m.map(Number); return r > 180 && g > 60 && g < 150 && bl < 110 && r - bl > 120; };
  const main = document.querySelector("main") ?? document.body;
  const primaries = (Array.from(main.querySelectorAll("a[href], button")) as HTMLElement[]).filter(vis).filter(isPrimary);
  const destructive = (Array.from(main.querySelectorAll("a[href], button")) as HTMLElement[]).filter(vis).filter((e) => /\b(delete|remove|leave|unfriend|revoke|abandon|cancel|hide|block|decline|reject|disconnect|sign out)\b/i.test(nameOf(e)));
  const near = destructive.flatMap((d) => primaries.map((pr) => { const a = d.getBoundingClientRect(), c = pr.getBoundingClientRect(); const dx = Math.max(0, Math.max(a.left, c.left) - Math.min(a.right, c.right)); const dy = Math.max(0, Math.max(a.top, c.top) - Math.min(a.bottom, c.bottom)); return { d: nameOf(d), p: nameOf(pr), gap: Math.round(Math.hypot(dx, dy)) }; })).filter((x) => x.gap <= 8 && x.d !== x.p);
  const small = ctrls.filter((e) => { const r = e.getBoundingClientRect(); return (r.width < 24 || r.height < 24) && !["INPUT"].includes(e.tagName) && !(e.tagName === "A" && getComputedStyle(e).display === "inline"); }).map((e) => `${nameOf(e).slice(0, 30) || e.tagName}:${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
  const firstPrimary = primaries[0]?.getBoundingClientRect();
  const selects = (Array.from(document.querySelectorAll("select")) as HTMLSelectElement[]).filter((s) => s.options.length > 15).map((s) => ({ name: nameOf(s).slice(0, 40), options: s.options.length, native: true }));
  const combos = Array.from(document.querySelectorAll('[role="combobox"], [role="listbox"]')).length;
  const navItems = Array.from(document.querySelectorAll("nav")).map((n) => n.querySelectorAll("a[href]").length);
  const forms = (Array.from(main.querySelectorAll("form")) as HTMLElement[]).filter(vis).map((f) => ({ fields: Array.from(f.querySelectorAll("input:not([type=hidden]), select, textarea")).filter(vis).length, fieldsets: f.querySelectorAll("fieldset, h2, h3, legend").length }));
  const pointer = (Array.from(main.querySelectorAll("*")) as HTMLElement[]).filter((e) => vis(e) && getComputedStyle(e).cursor === "pointer" && !e.closest('a, button, label, summary, input, select, textarea, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="link"], [role="option"], [role="menuitem"], [tabindex]')).map((e) => e.tagName + "." + (e.className?.toString?.() ?? "").split(" ")[0]).slice(0, 10);
  const texts: string[] = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n: Node | null; while ((n = w.nextNode())) { const t = n.nodeValue?.trim(); const pe = n.parentElement; if (t && t.length > 1 && pe && vis(pe) && !pe.closest("script, style, select, option")) texts.push(t.replace(/\s+/g, " ")); }
  for (const e of ctrls) { const l = e.getAttribute("aria-label"); if (l) texts.push(l); }
  return {
    title: document.title, h1: document.querySelector("h1")?.textContent?.trim() ?? "", notFound: /couldn't find that page/i.test(document.body.innerText),
    sideways: document.documentElement.scrollWidth > innerWidth + 1, scrollWidth: document.documentElement.scrollWidth,
    unnamedIcons, noTooltip, unnamedCtrls: unnamedCtrls.slice(0, 20), primaries: primaries.length, primaryNames: primaries.map(nameOf).slice(0, 5),
    primaryTop: firstPrimary ? Math.round(firstPrimary.top) : null, primaryBelowFold: firstPrimary ? firstPrimary.top > innerHeight : null,
    destructiveNearPrimary: near, smallTargets: small.slice(0, 20), smallCount: small.length, longSelects: selects, combos, navItems,
    forms, pointerNonFocusable: pointer, ariaCurrent: !!document.querySelector('nav [aria-current="page"], nav [aria-current="true"]'),
    mainVisibleOnLoad: (document.querySelector("h1")?.getBoundingClientRect().top ?? 9999) < innerHeight, texts: [...new Set(texts)],
  };
};

for (const cfg of CONFIGS) {
  if (ONLY && cfg.key !== ONLY) continue;
  const pages = new Map<string, any>();
  const pageFor = async (who: string | null) => {
    const k = who ?? "visitor";
    if (!pages.has(k)) { const c = await context(b, cfg); const p = await page(c); p.on("dialog", (d) => d.dismiss()); if (who) await signIn(p, A.accounts[who]); pages.set(k, p); }
    return pages.get(k);
  };
  for (const r of all) {
    const p = await pageFor(r.who);
    const rec: any = { route: r.route, url: r.url, role: r.role, cfg: cfg.key };
    try {
      await p.setViewportSize(cfg.device === "phone" ? { width: 390, height: 844 } : { width: 1280, height: 800 });
      const resp = await p.goto(r.url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await ready(p, 400);
      rec.status = resp?.status(); rec.finalPath = new URL(p.url()).pathname;
      const axe = await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      rec.axe = axe.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, target: v.nodes[0]?.target?.join(" ") }));
      const m = await p.evaluate(MEASURE);
      strings[r.route] = [...new Set([...(strings[r.route] ?? []), ...m.texts])];
      delete (m as any).texts;
      Object.assign(rec, m);
      if (cfg.key === "390-dark") {
        await p.setViewportSize({ width: 320, height: 640 }); await p.waitForTimeout(300);
        rec.reflow320 = await p.evaluate(() => ({ sideways: document.documentElement.scrollWidth > 321, scrollWidth: document.documentElement.scrollWidth }));
        await p.setViewportSize({ width: 390, height: 844 });
        await p.addStyleTag({ content: "*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important} p{margin-bottom:2em!important}" });
        await p.waitForTimeout(300);
        rec.textSpacing = await p.evaluate(() => {
          const clipped = (Array.from(document.querySelectorAll("main *")) as HTMLElement[]).filter((e) => { const s = getComputedStyle(e); return e.children.length === 0 && e.innerText?.trim() && (s.overflow === "hidden" || s.overflowX === "hidden" || s.overflowY === "hidden" || s.textOverflow === "ellipsis") && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 2); });
          return { clipped: clipped.length, examples: clipped.slice(0, 5).map((e) => e.innerText.slice(0, 40)), sideways: document.documentElement.scrollWidth > innerWidth + 1 };
        });
      }
    } catch (e: any) { rec.error = e.message.split("\n")[0]; }
    results.push(rec);
    process.stdout.write(`${cfg.key} ${r.route} ${rec.error ?? rec.axe?.length ?? ""}\n`);
  }
  for (const p of pages.values()) await p.context().close();
}
save("pages", results);
const prev = (() => { try { return JSON.parse(readFileSync("docs/ux-pilot/heuristics/strings.json", "utf8")); } catch { return {}; } })();
writeFileSync("docs/ux-pilot/heuristics/strings.json", JSON.stringify({ ...prev, ...strings }, null, 1));
await b.close(); await sql.end();
