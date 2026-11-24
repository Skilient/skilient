/** S01 part b: T009 (onboarding wizard as the T001 account). Prints each step and fills it like a student. */
import { launch, context, page, ready } from "./lib/browser.ts";
import { timedClick, setTask } from "./lib/timed.ts";
import { shot } from "./lib/shot.ts";
import { inspect } from "./lib/inspect.ts";
const say = (...x: unknown[]) => console.log(...x);
const b = await launch();
setTask("T009");
const ctx = await b.newContext({ storageState: "/tmp/claude-0/uxp/tester-new.json" });
await ctx.close();
const c = await context(b, { device: "phone" });
await c.addCookies((await import("node:fs")).readFileSync ? JSON.parse((await import("node:fs")).readFileSync("/tmp/claude-0/uxp/tester-new.json", "utf8")).cookies : []);
const p = await page(c);
await p.goto("/onboarding"); await ready(p);
let clicks = 0;
for (let step = 1; step <= 8; step++) {
  const url = new URL(p.url()).pathname;
  say(`\n=== ${url}`);
  say(await inspect(p, 1500));
  await shot(p, "T009");
  if (url.includes("/onboarding/done") || url === "/feed") break;
  // Fill whatever the step asks for.
  const sel = p.locator("select");
  for (let i = 0; i < (await sel.count()); i++) {
    const s = sel.nth(i);
    if (!(await s.isVisible())) continue;
    const opts = await s.locator("option").allTextContents();
    const pick = opts.find((o) => /Computer Science/.test(o)) ?? opts.find((o) => /2028/.test(o)) ?? opts[1];
    if (pick && !(await s.inputValue())) { await s.selectOption({ label: pick }); clicks++; }
  }
  for (const [name, value] of [["programme", "BS Computer Science"], ["program", "BS Computer Science"], ["username", "nida_new"], ["headline", "Second-year CS student who likes building web apps."], ["bio", "Second-year CS student who likes building web apps."], ["intro", "Second-year CS student who likes building web apps."]]) {
    const f = p.locator(`input[name="${name}"], textarea[name="${name}"]`);
    const el = f.first();
    if ((await el.isVisible().catch(() => false)) && !(await el.inputValue({ timeout: 2000 }).catch(() => "x"))) { await el.fill(value, { timeout: 3000 }).catch(() => undefined); clicks++; }
  }
  if (url.includes("looking")) {
    const boxes = p.getByRole("checkbox");
    if (await boxes.count()) { await boxes.first().click(); clicks++; }
  }
  const next = p.getByRole("button", { name: /^(continue|next|skip for now|skip|finish|save and continue|done)/i }).last();
  const label = (await next.innerText().catch(() => "?")).trim();
  for (let w = 0; w < 50 && (await next.isDisabled().catch(() => false)); w++) await p.waitForTimeout(200);
  if (url.includes("profile")) say("username hint:", await p.locator('input[name="username"]').evaluate((e) => (e.closest("div")?.parentElement as HTMLElement)?.innerText).catch(() => ""));
  say(`-> pressing "${label}"`);
  say(await timedClick(p, next, `onboarding ${url} ${label}`, { timeout: 30_000 }));
  clicks++;
  await ready(p, 800);
}
say("clicks", clicks);
await c.storageState({ path: "/tmp/claude-0/uxp/tester-new.json" });
await b.close();
