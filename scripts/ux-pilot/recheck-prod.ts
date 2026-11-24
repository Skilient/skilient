/** Part 4: quick local checks for production findings not already settled by the task runs. */
import { launch, context, page, ready, signIn, accounts } from "./lib/browser.ts";
import { sql, mainText } from "./lib/act.ts";
const say = (...x: unknown[]) => console.log(...x);
const A = accounts(); const acc = A.accounts;
const b = await launch();
const as = async (k: string, device: "phone" | "desktop" = "desktop") => { const p = await page(await context(b, { device, throttle: false })); await signIn(p, acc[k]); await ready(p, 300); return p; };
// P01 score page self-consistency
let p = await as("tester");
await p.goto("/me/score"); await ready(p, 500);
const sc = await mainText(p, 9000);
say("P01:", sc.split(" | ").filter((l) => /formula|rose|review|Updated|tiers reached|Verified skills/i.test(l)).slice(0, 8));
// P03 desktop progress column: Hide checklist
await p.goto("/feed"); await p.setViewportSize({ width: 1300, height: 900 }); await p.reload(); await ready(p, 500);
const hide = p.getByRole("button", { name: "Hide checklist" });
say("P03 hide visible:", await hide.isVisible().catch(() => false));
if (await hide.isVisible().catch(() => false)) { await hide.click(); await p.waitForTimeout(1200); say("P03 after hide:", (await p.locator('[role="status"]').allInnerTexts()).join(" / "), "| settings mentions:", /checklist|getting started/i.test(await (await p.goto("/settings"), ready(p, 300), p.locator("main").innerText()))); }
// P13 top-bar search accessible name
await p.goto("/feed"); await ready(p, 300);
say("P13:", await p.getByRole("button", { name: /Search or jump/ }).first().evaluate((e) => ({ label: e.getAttribute("aria-label"), text: (e as HTMLElement).innerText.replace(/\n/g, " ") })));
await p.context().close();
// P21 Pro (trial) account vs privacy centre wording
p = await as("helperB");
await p.goto("/settings/billing"); await ready(p, 300); say("P21 plan:", (await mainText(p, 2000)).split(" | ").filter((l) => /plan|trial|Pro/i.test(l)).slice(0, 3));
await p.goto("/settings/privacy"); await ready(p, 300); say("P21 privacy:", (await mainText(p, 3000)).split(" | ").filter((l) => /viewed|Pro/i.test(l)).slice(0, 3));
await p.context().close();
// P24 expired share links: expire Sana's link, compare Privacy centre and CV page
await sql`update public.cv_share_links set expires_at = now() - interval '1 day' where user_id = ${acc.testerSpark.id}`.catch((e) => say("P24 sql:", e.message));
p = await as("testerSpark");
await p.goto("/settings/privacy"); await ready(p, 300); say("P24 privacy:", (await mainText(p, 3000)).split(" | ").filter((l) => /share link/i.test(l)).slice(0, 2));
await p.goto("/me/cv"); await ready(p, 300); say("P24 cv:", (await mainText(p, 12000)).split(" | ").filter((l) => /expire|Arbisoft|active|link/i.test(l)).slice(0, 6));
await p.context().close();
// P29 share links for a Raw-tier student
p = await as("testerFresh");
await p.goto("/me/cv"); await ready(p, 300); say("P29 fresh cv:", (await mainText(p, 12000)).split(" | ").filter((l) => /share|Spark|link|tier/i.test(l)).slice(0, 6));
// P30 filter empty states
for (const f of ["events", "societies", "shipped", "announcements"]) { await p.goto("/feed?filter=" + f); await ready(p, 300); say(`P30 ${f}:`, (await mainText(p, 3000)).split("Shipped | ")[1]?.slice(0, 160)); }
await p.context().close();
// P31 venture tabs overflow on desktop
p = await as("tester");
await p.goto(`/ventures/${A.ids.testerVenture}`); await ready(p, 400);
say("P31 tabs overflow @1280:", await p.evaluate(() => { const n = Array.from(document.querySelectorAll("main nav, main [role=tablist]")).find((e) => (e as HTMLElement).innerText.includes("Contributions")) as HTMLElement | undefined; return n ? `${n.scrollWidth} > ${n.clientWidth}` : "no tab row"; }));
// P34 society page buttons and title
await p.goto("/societies/ux-pilot-developers-club"); await ready(p, 300);
say("P34:", await p.title(), await p.locator("main").getByRole("button").allInnerTexts());
// P12 yearbook / P17 me hub
say("P12 yearbook in rail:", /Yearbook/i.test(await p.locator("nav").first().innerText()));
await p.goto("/me"); await ready(p, 300); say("P17 me tiles:", (await mainText(p, 2000)).split(" | ").filter((l) => /^(Profile|Skills|My work|CV|Score|Credentials|Leaderboard|Friends|Feedback|Record|Paths|Tickets|Settings)$/.test(l)));
await b.close(); await sql.end();
