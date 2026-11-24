/** Probe 3: Ctrl K with each page's title: is the page in the top 3 results, and does Enter open it? (H07) */
import { launch, context, page, ready, signIn, accounts } from "../lib/browser.ts";
import { sql } from "../lib/act.ts";
import { routes, save, load } from "./lib.ts";
const A = accounts();
const pages = (load("pages") ?? []).filter((r: any) => r.cfg === "1280-dark" && r.role === "student" && !r.notFound && r.title && !r.error);
const titles = [...new Map(pages.map((r: any) => [r.title.replace(/ · Skilient$/, ""), r])).values()] as any[];
const b = await launch();
const p = await page(await context(b, { device: "desktop", throttle: false }));
await signIn(p, A.accounts.tester); await ready(p, 300);
const out: any[] = [];
for (const r of titles) {
  const title = r.title.replace(/ · Skilient$/, "");
  await p.goto("/feed"); await ready(p, 200);
  await p.keyboard.press("Control+k"); await p.waitForTimeout(400);
  await p.keyboard.type(title); await p.waitForTimeout(900);
  const opts = (await p.getByRole("option").allInnerTexts().catch(() => [])).map((o) => o.replace(/\n/g, " · "));
  const top3 = opts.slice(0, 3);
  // A page result (not the generic "Search for …" fallback) whose name starts with the page's title.
  const inTop3 = top3.findIndex((o) => !/^Search for/.test(o) && o.toLowerCase().split(" · ")[0].startsWith(title.toLowerCase().slice(0, Math.max(4, Math.min(title.length, 12)))));
  let opened = "";
  if (inTop3 >= 0) { for (let i = 0; i < inTop3; i++) await p.keyboard.press("ArrowDown"); await p.keyboard.press("Enter"); await p.waitForTimeout(1500); opened = new URL(p.url()).pathname; }
  else await p.keyboard.press("Escape");
  const rec = { route: r.route, title, top3, inTop3: inTop3 >= 0, opened, openedRight: opened !== "" && (opened === r.finalPath || opened === new URL(r.url, "http://x").pathname) };
  out.push(rec); console.log(JSON.stringify(rec));
}
const found = out.filter((o) => o.inTop3).length;
save("ctrlk", { pages: out, inTop3: found, total: out.length, rate: found / out.length, openedRight: out.filter((o) => o.openedRight).length });
await b.close(); await sql.end();
