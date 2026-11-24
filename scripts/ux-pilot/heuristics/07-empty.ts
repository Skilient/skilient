/** Probe 7 (EMP): every list page as tester-fresh: the empty state's title, explanation and single action, and whether that action leads to another empty page. Raw results under "empty". */
import { launch, context, page, ready, signIn, accounts } from "../lib/browser.ts";
import { sql } from "../lib/act.ts";
import { save } from "./lib.ts";
const A = accounts();
const LISTS = ["/friends", "/friends?tab=received", "/friends?tab=sent", "/friends?tab=blocked", "/chat", "/notifications", "/requests", "/requests?tab=sent", "/requests?tab=invites", "/me/record", "/me/credentials", "/me/work", "/me/skills", "/me/tickets", "/me/paths", "/swaps", "/swaps?tab=mine", "/appeals", "/feedback", "/events?when=mine", "/events?when=past", "/ventures?mine=1", "/leaderboard", "/openings/this-week", "/openings/venture-roles", "/openings/inductions", "/openings/events", "/openings/ideas", "/openings/paths", "/openings/swaps", "/profile/uxp_fresh/activity", "/profile/uxp_fresh/ventures", "/feed?filter=societies", "/explore?q=zzzz"];
const EMPTY = /^(No |Nothing|None |You haven't|You're all caught up|Your first|A quiet|No results|Pick a path|Add a skill)/;
const b = await launch();
const p = await page(await context(b, { device: "phone", throttle: false }));
await signIn(p, A.accounts.testerFresh); await ready(p, 300);
const grab = () => p.evaluate((src) => {
  const re = new RegExp(src);
  const main = document.querySelector("main") ?? document.body;
  const heads = Array.from(main.querySelectorAll("h1, h2, h3, p, strong")).filter((e) => re.test((e as HTMLElement).innerText.trim()) && (e as HTMLElement).offsetParent !== null);
  return heads.slice(0, 4).map((h) => {
    let box = h.parentElement!; for (let i = 0; i < 3 && box.parentElement && box.innerText.length < 300 && !box.querySelector("a, button"); i++) box = box.parentElement;
    const actions = Array.from(box.querySelectorAll("a[href], button")).map((a) => ({ label: (a as HTMLElement).innerText.trim() || a.getAttribute("aria-label") || "", href: (a as HTMLAnchorElement).getAttribute?.("href") ?? null })).filter((a) => a.label);
    const lines = box.innerText.split("\n").map((s) => s.trim()).filter(Boolean);
    return { title: (h as HTMLElement).innerText.trim(), explanation: lines.filter((l) => l !== (h as HTMLElement).innerText.trim() && !actions.some((a) => a.label === l)).slice(0, 2).join(" "), actions: actions.slice(0, 3) };
  });
}, EMPTY.source);
const out: any[] = [];
for (const u of LISTS) {
  await p.goto(u).catch(() => undefined); await ready(p, 300);
  const states = await grab();
  const r: any = { url: u, h1: await p.locator("h1").first().innerText().catch(() => ""), states };
  const act = states.flatMap((s: any) => s.actions).find((a: any) => a.href && a.href.startsWith("/"));
  if (act) { await p.goto(act.href).catch(() => undefined); await ready(p, 300); const next = await grab(); r.follow = { href: act.href, leadsToEmpty: next.length > 0, nextTitle: next[0]?.title ?? "" }; }
  r.allThree = states.length > 0 && states.every((s: any) => s.title && s.explanation && s.actions.length >= 1);
  out.push(r); console.log(JSON.stringify(r).slice(0, 300));
}
const withEmpty = out.filter((r) => r.states.length);
save("empty", { pages: out, emptyStates: withEmpty.length, withAllThree: withEmpty.filter((r) => r.allThree).length, leadingToEmpty: out.filter((r) => r.follow?.leadsToEmpty).map((r) => `${r.url} -> ${r.follow.href}`) });
await b.close(); await sql.end();
