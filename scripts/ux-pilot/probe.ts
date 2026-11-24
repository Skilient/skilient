/** Ad-hoc look at one page: node scripts/ux-pilot/probe.ts <account> <phone|desktop> <url> [click-text ...]. Prints what a person sees. */
import { launch, context, page, ready, signIn, accounts } from "./lib/browser.ts";
import { inspect } from "./lib/inspect.ts";
import { shot } from "./lib/shot.ts";
const [who, device, url, ...clicks] = process.argv.slice(2);
const b = await launch();
const c = await context(b, { device: device as any, throttle: false });
const p = await page(c);
if (who !== "visitor") await signIn(p, accounts().accounts[who]);
await p.goto(url); await ready(p, 800);
for (const t of clicks) {
  if (t.startsWith("shot:")) { console.log("shot", await shot(p, t.slice(5))); continue; }
  if (t.startsWith("key:")) { await p.keyboard.press(t.slice(4)); await p.waitForTimeout(800); continue; }
  if (t.startsWith("type:")) { await p.keyboard.type(t.slice(5)); await p.waitForTimeout(1200); continue; }
  const el = p.getByRole("button", { name: t }).or(p.getByRole("link", { name: t })).or(p.getByRole("tab", { name: t })).or(p.getByRole("menuitem", { name: t })).first();
  await el.click({ timeout: 8000 }).catch((e) => console.log("click failed", t, e.message.split("\n")[0]));
  await p.waitForTimeout(1200); await ready(p, 300);
}
console.log(await inspect(p, Number(process.env.MAX ?? 2500)));
await b.close();
