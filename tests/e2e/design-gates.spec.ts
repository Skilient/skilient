import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { roleSession } from "./sweep-fixtures";
import { SWEEP, sweepPath, type SweepFixtures, type SweepRole } from "./sweep-routes";
import { hasBackend } from "./support";

/**
 * Design gates, the automated part (screen-spec §1, Gate B craft floor; phase 13, docs/design-gates.md).
 * Every page in app/ (tests/e2e/sweep-routes.ts) is opened as the role that uses it, at 1280 px on the
 * desktop project and 390 px on the phone project, in light and in dark, and must pass:
 *
 *   - axe WCAG 2.2 AA, colour contrast and target size included
 *   - no sideways scrolling at that width
 *   - themed browser surfaces: `color-scheme` matches the theme, scrollbars and caret are themed
 *   - a visible focus ring on the first Tab stop
 *   - no button whose label is clipped
 *   - copy: no em dashes and no emoji used as icons
 *
 * The judgement half (impeccable critique, the taste pre-flight, polish) was done by eye on the
 * screenshots this spec writes with DESIGN_GATES_SHOTS=1; findings and fixes are in docs/design-gates.md.
 */
const RULES = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const CHUNK = 12;
const SHOTS = process.env.DESIGN_GATES_SHOTS === "1";
// Visible text that isn't our copy: people's names and posts come from fixtures, the agreement from the database.
const COPY_EXEMPT = new Set(["/terms", "/privacy", "/ui"]);
// Emoji that render as pictures (©, ® and ™ are Extended_Pictographic but are text).
const EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/u;

async function gate(page: Page, path: string, theme: "light" | "dark", width: number): Promise<string[]> {
  const out: string[] = [];
  const where = `${path} (${width}px ${theme})`;
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.goto(path, { waitUntil: "load" });
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);

  const facts = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      themeClass: document.documentElement.className,
      scheme: root.colorScheme,
      scrollbar: root.scrollbarColor,
      caret: getComputedStyle(document.body).caretColor,
      text: document.body.innerText,
      // Buttons and button-like links whose label is wider than the button (clipped by nowrap + overflow-hidden).
      clipped: [...document.querySelectorAll<HTMLElement>("button, a[role=button], a.rounded-full")]
        // Text labels only: switches and checkboxes are buttons whose thumb overflows on purpose.
        .filter((el) => el.offsetParent !== null && !el.getAttribute("role")?.match(/switch|checkbox/) && (el.textContent ?? "").trim() !== "")
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .map((el) => (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 40)),
    };
  });
  if (!facts.themeClass.includes(theme)) out.push(`${where}: html isn't .${theme} (${facts.themeClass})`);
  if (facts.overflow > 1) out.push(`${where}: scrolls sideways by ${facts.overflow}px`);
  if (!facts.scheme.includes(theme)) out.push(`${where}: color-scheme is "${facts.scheme}"`);
  if (!facts.scrollbar || facts.scrollbar === "auto") out.push(`${where}: scrollbars aren't themed`);
  if (!facts.caret || facts.caret === "auto") out.push(`${where}: caret isn't themed`);
  for (const label of facts.clipped) out.push(`${where}: clipped button "${label}"`);
  if (!COPY_EXEMPT.has(path)) {
    if (facts.text.includes("—")) out.push(`${where}: em dash in copy`);
    const emoji = facts.text.match(EMOJI);
    if (emoji) out.push(`${where}: emoji in copy (${emoji[0]})`);
  }

  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    const cs = getComputedStyle(el);
    const outline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
    return { what: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}`, ring: outline || (cs.boxShadow !== "none" && cs.boxShadow !== "") };
  });
  if (focused && !focused.ring) out.push(`${where}: no focus ring on ${focused.what}`);
  await page.keyboard.press("Shift+Tab");

  const axe = await new AxeBuilder({ page }).withTags(RULES).analyze();
  for (const v of axe.violations) out.push(`${where}: axe ${v.id} on ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")}`);

  if (SHOTS) {
    const name = `${path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}-${width}-${theme}.png`;
    await page.screenshot({ path: `test-results/design-gates/${name}`, fullPage: true });
  }
  return out;
}

test.describe("Design gates", () => {
  test.skip(!hasBackend, "needs the local Supabase stack");

  const roles: SweepRole[] = ["visitor", "student", "faculty", "recruiter", "official", "staff"];
  for (const role of roles) {
    const entries = SWEEP.filter((s) => s.role === role);
    const portals = role === "recruiter" || role === "official";
    for (let i = 0; i < entries.length; i += CHUNK) {
      const chunk = entries.slice(i, i + CHUNK);
      test(`${role} ${i / CHUNK + 1}: ${chunk[0].route} …`, portals ? { tag: "@portals" } : {}, async ({ browser }, info) => {
        test.setTimeout(420_000);
        const width = info.project.name === "phone" ? 390 : 1280;
        const viewport = info.project.name === "phone" ? { width: 390, height: 844 } : { width: 1280, height: 800 };
        const { page, fixtures } = await roleSession(browser, role, { ...info.project.use, viewport });
        const failures: string[] = [];
        for (const entry of chunk) {
          const path = sweepPath(entry, fixtures as Partial<SweepFixtures>);
          for (const theme of ["light", "dark"] as const) failures.push(...(await gate(page, path, theme, width)));
        }
        expect(failures).toEqual([]);
      });
    }
  }
});
