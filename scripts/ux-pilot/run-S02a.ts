/** S02 part a: T014 tour, T015 next step, T017 first-visit tips (tester-fresh too), T018 replay tour and the checklist. */
import { launch, context, page, ready, signIn, accounts } from "./lib/browser.ts";
import { timedClick, setTask, timedGoto } from "./lib/timed.ts";
import { shot } from "./lib/shot.ts";
import { inspect } from "./lib/inspect.ts";
const say = (...x: unknown[]) => console.log(...x);
const A = accounts();
const b = await launch();
const textOf = async (p: any, n = 900) => (await inspect(p, n)).split("CONTROLS")[0];

const c = await context(b, { device: "phone" });
const p = await page(c);
await signIn(p, A.accounts.tester);
await ready(p, 1500);

// ---------- T014 ----------
setTask("T014");
say("T014 landed at", new URL(p.url()).pathname);
let clicks = 0;
for (let i = 0; i < 25; i++) {
  await p.waitForTimeout(1200);
  const card = p.locator('[data-tour-card], [role="dialog"]').last();
  const visible = await card.isVisible().catch(() => false);
  if (!visible) { say(`T014 step ${i}: no coach card visible at ${new URL(p.url()).pathname}`); break; }
  const text = (await card.innerText()).replace(/\n+/g, " | ").slice(0, 400);
  const anchor = await p.evaluate(() => { const el = document.querySelector("[data-tour-active], [data-tour-target]"); return el ? `${el.tagName}:${el.getAttribute("data-tour") ?? ""}` : ""; });
  say(`T014 step ${i} @${new URL(p.url()).pathname} anchor=${anchor}: ${text}`);
  if (i < 3 || i % 5 === 0) await shot(p, "T014");
  const next = card.getByRole("button", { name: /^(Next|Done|Finish|Got it|Start|Continue)/i }).last();
  if (!(await next.isVisible().catch(() => false))) {
    const any = card.getByRole("button").last();
    const label = await any.innerText().catch(() => "?");
    say("   only button:", label);
    if (/skip|close/i.test(label)) break;
    await any.click(); clicks++; continue;
  }
  await timedClick(p, next, `tour next ${i}`, { timeout: 20_000 }); clicks++;
}
say("T014 tour clicks", clicks, "now at", new URL(p.url()).pathname);
await shot(p, "T014");

// ---------- T015 ----------
setTask("T015");
await timedGoto(p, "/feed"); await ready(p, 1000);
say("T015 feed:", (await textOf(p, 1600)));
const chip = p.getByRole("button", { name: /progress/i }).first();
if (await chip.isVisible().catch(() => false)) { say("T015 chip", await timedClick(p, chip, "open progress chip")); await p.waitForTimeout(1200); }
say("T015 progress sheet:", (await p.locator('[role="dialog"]').last().innerText().catch(() => "none")).slice(0, 1500));
await shot(p, "T015");
const take = p.getByRole("link", { name: /Take this step/i }).or(p.getByRole("button", { name: /Take this step/i })).first();
if (await take.isVisible().catch(() => false)) {
  say("T015 take", await timedClick(p, take, "Take this step", { timeout: 30_000 }));
  await ready(p, 800);
  say("T015 after take:", await textOf(p, 1200));
  await shot(p, "T015");
}

// ---------- T017 ----------
setTask("T017");
for (const url of ["/swaps", "/me/paths", "/me/credentials"]) {
  await timedGoto(p, url); await ready(p, 1000);
  const tip = p.locator("[data-tip-card]").first();
  say(`T017 ${url} tip:`, (await tip.innerText().catch(() => "none")).replace(/\n/g, " | ").slice(0, 400));
  say(`T017 ${url}:`, (await textOf(p, 900)));
  await shot(p, "T017");
}
// close a tip
const close = p.locator("[data-tip-card]").getByRole("button").last();
if (await close.isVisible().catch(() => false)) { say("T017 close tip", await timedClick(p, close, "dismiss tip")); }

// ---------- T018 ----------
setTask("T018");
await timedGoto(p, "/settings"); await ready(p, 800);
say("T018 settings:", await inspect(p, 1500));
await shot(p, "T018");
const replay = p.getByRole("link", { name: /Replay tour|Replay the tour|tour/i }).or(p.getByRole("button", { name: /Replay tour|tour/i })).first();
if (await replay.isVisible().catch(() => false)) {
  say("T018 replay", await timedClick(p, replay, "Replay tour", { timeout: 30_000 }));
  await ready(p, 1500);
  say("T018 after replay:", (await p.locator('[data-tour-card], [role="dialog"]').last().innerText().catch(() => "no card")).slice(0, 300));
  await shot(p, "T018");
  const skip = p.getByRole("button", { name: /skip|close|end/i }).first();
  if (await skip.isVisible().catch(() => false)) await skip.click();
}
await timedGoto(p, "/feed"); await ready(p, 1000);
const chip2 = p.getByRole("button", { name: /progress/i }).first();
if (await chip2.isVisible().catch(() => false)) { await chip2.click(); await p.waitForTimeout(1200); }
const hide = p.getByRole("button", { name: /Hide checklist/i }).first();
say("T018 hide visible:", await hide.isVisible().catch(() => false));
if (await hide.isVisible().catch(() => false)) {
  say("T018 hide", await timedClick(p, hide, "Hide checklist"));
  await p.waitForTimeout(1500);
  say("T018 after hide:", (await textOf(p, 1200)));
  await shot(p, "T018");
}
await p.goto("/settings"); await ready(p);
say("T018 settings has show checklist:", /checklist|getting started/i.test(await p.locator("main").innerText()));

// T017 empty-ish pages with tester-fresh
const f = await context(b, { device: "phone", throttle: false });
const fp = await page(f);
await signIn(fp, A.accounts.testerFresh);
await ready(fp);
for (const url of ["/swaps", "/me/paths", "/me/credentials"]) {
  await fp.goto(url); await ready(fp, 800);
  say(`T017 fresh ${url}:`, (await textOf(fp, 700)));
}
await b.close();
