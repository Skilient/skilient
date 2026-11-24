/**
 * Probe 2: core pages on the throttled phone (Fast 3G, 4x CPU): LCP and CLS from PerformanceObserver, plus the
 * click-to-response distribution from docs/ux-pilot/timings.jsonl (MOB, DOH, H01). Raw results under "performance".
 */
import { readFileSync } from "node:fs";
import { launch, context, page, signIn, accounts } from "../lib/browser.ts";
import { sql } from "../lib/act.ts";
import { save } from "./lib.ts";
const A = accounts(); const ids = A.ids;
const [soc] = await sql`select slug from public.societies where name = 'UX Pilot Developers Club'`;
const CORE: [string, string][] = [["feed", "/feed"], ["openings", "/openings"], ["venture", `/ventures/${ids.testerVenture}`], ["chat thread", `/chat/${ids.dmTesterA}`], ["me", "/me"], ["cv", "/me/cv"], ["score", "/me/score"], ["events", "/events"], ["event", `/events/${ids.events.workshop}`], ["society", `/societies/${soc.slug}`]];
const b = await launch();
const c = await context(b, { device: "phone", throttle: true });
await c.addInitScript(() => {
  (window as any).__lcp = 0; (window as any).__cls = 0;
  new PerformanceObserver((l) => { for (const e of l.getEntries()) (window as any).__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries() as any) if (!e.hadRecentInput) (window as any).__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
});
const p = await page(c);
await signIn(p, A.accounts.tester);
const out: any[] = [];
for (const [name, url] of CORE) {
  const runs: any[] = [];
  for (let i = 0; i < 2; i++) {
    const t0 = Date.now();
    await p.goto(url, { waitUntil: "load", timeout: 90_000 }).catch(() => undefined);
    await p.waitForTimeout(2500);
    const m = await p.evaluate(() => ({ lcp: Math.round((window as any).__lcp), cls: Number(((window as any).__cls as number).toFixed(3)), dcl: Math.round(performance.getEntriesByType("navigation")[0] ? (performance.getEntriesByType("navigation")[0] as any).domContentLoadedEventEnd : 0) }));
    runs.push({ ...m, load: Date.now() - t0 });
  }
  out.push({ name, url, cold: runs[0], warm: runs[1] });
  console.log(name, JSON.stringify(runs));
}
const T = readFileSync("docs/ux-pilot/timings.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
const clicks = T.filter((t) => t.kind !== "navigation" || t.pendingMs !== null);
const pct = (xs: number[], q: number) => xs.sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))];
const pend = clicks.map((t) => t.pendingMs).filter((x) => x !== null) as number[];
const resu = T.map((t) => t.resultMs).filter((x) => x !== null) as number[];
const respondedOrProgress400 = T.filter((t) => (t.pendingMs !== null && t.pendingMs <= 400) || (t.resultMs !== null && t.resultMs <= 400)).length / T.length;
const summary = { actions: T.length, pending_within_100: pend.filter((x) => x <= 100).length / pend.length, pending_p50: pct([...pend], 0.5), pending_p90: pct([...pend], 0.9), result_within_1s: resu.filter((x) => x <= 1000).length / resu.length, result_p50: pct([...resu], 0.5), result_p90: pct([...resu], 0.9), no_pending_sign: T.filter((t) => t.pendingMs === null && t.kind !== "navigation").length, respond_or_progress_400: respondedOrProgress400, slowest: [...T].sort((a, b) => (b.resultMs ?? 0) - (a.resultMs ?? 0)).slice(0, 8).map((t) => `${t.task} ${t.label} ${t.resultMs}ms`) };
console.log(JSON.stringify(summary));
save("performance", { pages: out, timings: summary });
await b.close(); await sql.end();
