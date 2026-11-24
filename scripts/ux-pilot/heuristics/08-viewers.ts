/**
 * Probe 8: viewer matrix (PRV) and safety reach (SAF). The tester's profile, CV and Record as self, friend (Ali),
 * same-university stranger (Danish), other-university student (Omar) and signed out, under each profile visibility;
 * does each view match the setting and say why parts are hidden? Taps to Report, Block and Mute from each content
 * type; a block checked in every surface from both sides. Raw results under "viewers".
 */
import { launch, context, page, ready, signIn, accounts } from "../lib/browser.ts";
import { sql, asUser, mainText } from "../lib/act.ts";
import { save } from "./lib.ts";
const A = accounts(); const acc = A.accounts; const ids = A.ids;
const b = await launch();
const viewers: [string, string | null][] = [["self", "tester"], ["friend", "helperA"], ["same-uni stranger", "applicant2"], ["other-uni", "otherUni"], ["signed out", null]];
const pages: Record<string, any> = {};
for (const [k, who] of viewers) { const p = await page(await context(b, { device: "desktop", throttle: false })); if (who) await signIn(p, acc[who]); pages[k] = p; }
const [orig] = await sql`select visibility::text as v from public.profiles where user_id = ${acc.tester.id}`;
const settings = await sql`select unnest(enum_range(null::profile_visibility))::text as v`.catch(async () => [{ v: "university" }, { v: "public" }, { v: "friends" }]);
const matrix: any[] = [];
for (const { v } of settings) {
  // The setting is changed on the local DB (the same column Settings > Profile writes).
  await sql.unsafe(`update public.profiles set visibility = $1 where user_id = $2`, [v, acc.tester.id]);
  for (const [k] of viewers) {
    const p = pages[k];
    for (const url of ["/profile/uxp_tester", "/cv/uxp_tester", "/record/uxp_tester"]) {
      const r = await p.goto(url).catch(() => null); await ready(p, 200);
      const t = await mainText(p, 3000);
      matrix.push({ setting: v, viewer: k, url, status: r?.status(), path: new URL(p.url()).pathname, notFound: /couldn't find|isn't valid|isn't available/i.test(t), showsSkills: /Top skills|L2|L3/.test(t), showsBio: /Building small tools/.test(t), showsEndorsements: /Endorsements/.test(t), whyHidden: (t.split(" | ").find((l) => /only|visible to|hidden|private|friends see|can't see/i.test(l)) ?? "").slice(0, 120) });
    }
  }
}
await sql.unsafe(`update public.profiles set visibility = $1 where user_id = $2`, [orig.v, acc.tester.id]);
// Safety reach: taps from each content type to Report, Block, Mute (as the tester).
const t = pages.self;
const reach: any[] = [];
const count = async (label: string, url: string, steps: string[][]) => { await t.goto(url); await ready(t, 300); const res: Record<string, number | null> = {}; for (const [action, ...path] of steps) { let taps = 0; let ok = false; await t.goto(url); await ready(t, 200); for (const s of path) { const el = t.locator("main").getByRole("button", { name: new RegExp(`^${s}`) }).or(t.locator("main").getByRole("menuitem", { name: new RegExp(`^${s}`) })).first(); if (!(await el.isVisible().catch(() => false))) break; await el.click().catch(() => undefined); taps++; await t.waitForTimeout(400); if (s.startsWith(action)) { ok = true; break; } } res[action] = ok ? taps : null; } reach.push({ content: label, url, ...res }); };
await count("post", `/post/${ids.posts.helperC3}`, [["Report", "More for this post", "Report"], ["Mute", "More for this post", "Mute"]]);
await count("comment", `/post/${ids.posts.text}`, [["Report", "Report"]]);
await count("message", `/chat/${ids.dmTesterA}`, [["Report", "Report"]]);
await count("profile", "/profile/uxp_helper_d", [["Report", "Report"], ["Block", "Block"]]);
await count("venture", `/ventures/${ids.helperVenture}`, [["Report", "Report"]]);
await count("society", `/societies/${ids.societies.open.slug}`, [["Report", "Report"]]);
await count("event", `/events/${ids.events.workshop}`, [["Report", "Report"]]);
// Block both sides: tester blocks Danish (applicant2), then check surfaces.
await asUser(acc.tester.id, `select public.block_user('uxp_helper_d')`).catch(() => undefined);
const d = pages["same-uni stranger"];
const surfaces: any[] = [];
const check = async (side: string, p: any, url: string, needle: string) => { await p.goto(url).catch(() => undefined); await ready(p, 300); const txt = await p.locator("body").innerText(); surfaces.push({ side, url, sees: txt.includes(needle) }); };
for (const [url, needle] of [["/profile/uxp_helper_d", "Danish Helper"], ["/explore?q=Danish", "Danish Helper"], ["/friends", "Danish Helper"], ["/feed", "Danish Helper"], [`/societies/${ids.societies.open.slug}/manage`, "Danish Helper"], ["/leaderboard", "Danish Helper"]] as const) await check("tester (blocker)", t, url, needle);
for (const [url, needle] of [["/profile/uxp_tester", "Ayesha Tester"], ["/explore?q=Ayesha", "Ayesha Tester"], ["/feed", "Ayesha Tester"], [`/ventures/${ids.testerVenture}`, "Ayesha Tester"], ["/leaderboard", "Ayesha Tester"], [`/post/${ids.posts.text}`, "@uxp_helper_b yes"]] as const) await check("Danish (blocked)", d, url, needle);
await asUser(acc.tester.id, `delete from public.blocks where blocker_id = auth.uid()`).catch(async () => sql`delete from public.blocks where blocker_id = ${acc.tester.id}`);
// Privacy controls reach: from Home to the Privacy centre.
await t.goto("/feed"); await ready(t, 200);
const privReach = await (async () => { await t.getByRole("button", { name: "Account menu" }).click(); await t.waitForTimeout(400); const direct = await t.getByRole("link", { name: /Privacy/ }).first().isVisible().catch(() => false); return direct ? 2 : 3; })();
save("viewers", { matrix, reach, surfaces, privacyControlsClicksFromHome: privReach });
console.log(JSON.stringify({ matrix: matrix.length, reach, surfaces }).slice(0, 2500));
await b.close(); await sql.end();
