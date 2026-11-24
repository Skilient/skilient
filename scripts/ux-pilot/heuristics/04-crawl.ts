/** Probe 4: breadth-first crawl from /feed as the tester, visible links only: clicks to each page, orphans, and whether the current place is marked in the nav (NAV). Phone and desktop. */
import { launch, context, page, ready, signIn, accounts } from "../lib/browser.ts";
import { sql } from "../lib/act.ts";
import { routes, save } from "./lib.ts";
const A = accounts();
const pattern = (path: string) => path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "[id]").replace(/\/profile\/[^/]+/, "/profile/[username]").replace(/\/societies\/(?!new)[^/]+/, "/societies/[slug]").replace(/\/openings\/(venture-roles|inductions|events|ideas|paths|swaps|this-week)/, "/openings/[category]").replace(/\/verify\/[A-Z0-9-]{8,}/, "/verify/[code]").replace(/\/u\/[^/]+/, "/u/[slug]").replace(/\/onboarding\/(?!done)[a-z-]+/, "/onboarding/[step]");
const all = await routes();
const studentRoutes = [...new Set(all.filter((r) => r.role === "student").map((r) => r.route.replace(/\/\[\[\.\.\.page\]\]/, "")))];
const b = await launch();
const out: any = {};
for (const device of ["phone", "desktop"] as const) {
  const p = await page(await context(b, { device, throttle: false }));
  p.on("dialog", (d) => d.dismiss());
  await signIn(p, A.accounts.tester); await ready(p, 300);
  const depth = new Map<string, number>(); const unmarked = new Set<string>();
  const queue: [string, number][] = [["/feed", 0]]; const seen = new Set<string>(["/feed"]);
  let visited = 0;
  while (queue.length && visited < 160) {
    const [url, d] = queue.shift()!;
    try { await p.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 }); await ready(p, 150); } catch { continue; }
    visited++;
    const path = new URL(p.url()).pathname; const pat = pattern(path);
    if (!depth.has(pat) || depth.get(pat)! > d) depth.set(pat, d);
    const marked = await p.evaluate(() => !!document.querySelector('nav [aria-current="page"], nav [aria-current="true"], nav [aria-current="location"]'));
    if (!marked) unmarked.add(pat);
    if (d >= 4) continue;
    const links = await p.evaluate(() => Array.from(document.querySelectorAll("a[href]")).filter((a) => { const r = (a as HTMLElement).getBoundingClientRect(); const s = getComputedStyle(a); return r.width > 0 && r.height > 0 && s.visibility !== "hidden"; }).map((a) => (a as HTMLAnchorElement).href).filter((h) => h.startsWith(location.origin)));
    for (const h of links) { const u = new URL(h); if (/\/api\/|sign-?out|\.pdf$/.test(u.pathname)) continue; const key = pattern(u.pathname); if (seen.has(key)) continue; seen.add(key); queue.push([u.pathname + u.search, d + 1]); }
  }
  const reached = [...depth.entries()].sort((a, b) => a[1] - b[1]);
  const orphans = studentRoutes.filter((r) => !depth.has(r) && !/\[(session|id)\]|onboarding|agreement|billing|check-in|fairs|competitions|jobs|contact-requests|code-checks|moderation|attend/.test(r) || (!depth.has(r) && /^\/(appeals|requests|me\/tickets|swaps|me\/paths|me\/record|feedback|settings\/\w+)$/.test(r)));
  const notWithin3 = reached.filter(([, d]) => d > 3).map(([k, d]) => `${k}:${d}`);
  out[device] = { visited, reached: Object.fromEntries(reached), notWithin3, orphans, unmarked: [...unmarked] };
  console.log(device, "visited", visited, "patterns", reached.length, "orphans", orphans.length, "unmarked", unmarked.size);
  await p.context().close();
}
save("crawl", out);
await b.close(); await sql.end();
