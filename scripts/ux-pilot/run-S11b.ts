/** S11 part b: door check-in (T115), self check-in check (T116), close-out (T117), correction, CSV and feedback (T118). Run prep-door.mjs first. */
import { launch, context, page, ready, signIn, accounts } from "./lib/browser.ts";
import { timedClick, setTask, timedGoto } from "./lib/timed.ts";
import { shot } from "./lib/shot.ts";
import { sql, asUser, mainText, dialogText, toastText } from "./lib/act.ts";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const say = (...x: unknown[]) => console.log(...x);
const A = accounts(); const acc = A.accounts;
const D = JSON.parse(readFileSync("/tmp/claude-0/uxp/door.json", "utf8"));
const ONLY = process.env.ONLY?.split(","); const run = (id: string) => !ONLY || ONLY.includes(id);
const T = (t: any) => `${t.kind} pending=${t.pendingMs} result=${t.resultMs} "${String(t.shown).replace(/\n/g, " ").slice(0, 160)}"`;
const b = await launch();
const ctx = await context(b, { device: "phone" });
const p = await page(ctx);
p.on("dialog", async (d) => { say("   native dialog:", d.message()); await d.accept(); });
await signIn(p, acc.officer1); await ready(p, 500);
const M = p.locator("main");

if (run("T115")) {
  setTask("T115");
  await timedGoto(p, `/events/${D.door}/check-in`); await ready(p, 600);
  const cam = M.getByRole("button", { name: /camera|Scan with/i }).first();
  say("T115 camera button:", await cam.innerText().catch(() => "none (BarcodeDetector unavailable)"));
  const code = M.getByRole("textbox").first(), go = M.getByRole("button", { name: "Check in" });
  const res: string[] = [];
  for (const [k, label] of [["tester", "scan 1"], ["helperA", "scan 2"], ["helperB", "scan 3"], ["helperA", "scan 2 again"]] as const) {
    await code.fill(D.codes[k]);
    const t = await timedClick(p, go, `door ${label}`);
    await p.waitForTimeout(600);
    const result = await M.locator('[role="status"], [role="alert"], [data-result]').allInnerTexts().catch(() => []);
    res.push(`${label}: ${T(t)} | ${result.join(" / ").replace(/\n/g, " ").slice(0, 200)}`);
    if (label === "scan 2 again") await shot(p, "T115");
  }
  for (const r of res) say("T115", r);
  const colors = await M.locator('[data-result], [role="status"]').evaluateAll((e) => e.map((x) => getComputedStyle(x).backgroundColor + "/" + getComputedStyle(x).color).slice(0, 3));
  say("T115 result colours:", colors);
  await M.getByRole("textbox").nth(1).fill("Fatima");
  say("T115 search:", T(await timedClick(p, M.getByRole("button", { name: "Search" }), "find by name")));
  await p.waitForTimeout(800);
  say("T115 search results:", (await mainText(p, 4000)).split("Find by name | ")[1]?.slice(0, 300));
  const ci = M.getByRole("button", { name: /Check in Fatima|^Check in$/ }).last();
  if (await ci.isVisible().catch(() => false)) say("T115 check in Fatima:", T(await timedClick(p, ci, "check in by name")));
  await M.locator("input[type=email]").fill("uxp-walkin@nutech.edu.pk");
  say("T115 walk-in:", T(await timedClick(p, M.getByRole("button", { name: "Add" }), "add walk-in by email")), await toastText(p));
  await p.waitForTimeout(800);
  say("T115 count:", (await mainText(p, 2000)).split(" | ").filter((l) => /checked in of/i.test(l)));
  await shot(p, "T115");
}

if (run("T116")) {
  setTask("T116");
  await timedGoto(p, `/events/${D.door}/manage`); await ready(p, 600);
  const txt = await mainText(p, 6000);
  say("T116 self check-in on manage:", /self|rotating|room code/i.test(txt), "| on console:", /self|rotating|room code/i.test(await (await timedGoto(p, `/events/${D.door}/check-in`), ready(p, 500), mainText(p, 6000))));
}

if (run("T117")) {
  setTask("T117");
  await timedGoto(p, `/events/${D.comp}/manage?tab=closeout`); await ready(p, 700);
  say("T117 close-out:", (await mainText(p, 6000)).split("Close-out | Feedback | ")[1]?.slice(0, 1500));
  await shot(p, "T117");
  say("T117 inputs:", await M.locator("input, select, textarea, button").evaluateAll((e) => e.map((x) => `${x.tagName}[${(x as HTMLInputElement).type ?? ""}]:${(x as HTMLInputElement).labels?.[0]?.innerText?.replace(/\n/g, " ") ?? x.getAttribute("aria-label") ?? (x as HTMLElement).innerText}`).filter((s) => !/Home|Openings|Ventures|Chat|Me$/.test(s)).slice(0, 40).join(" ; ")));
}
if (run("T117b")) {
  setTask("T117");
  await timedGoto(p, `/events/${D.comp}/manage?tab=closeout`); await ready(p, 700);
  const form = (btnName: string) => M.locator("form").filter({ has: p.getByRole("button", { name: btnName, exact: true }) }).first();
  const f1 = form("Save");
  await f1.getByLabel("Attendee").selectOption({ label: "Danish Helper" });
  await f1.getByLabel("Was there").check({ force: true }); await f1.getByLabel("Reason").fill("Signed the paper sheet at the door.");
  say("T117 fix attendance:", T(await timedClick(p, f1.getByRole("button", { name: "Save", exact: true }), "fix attendance")), await toastText(p));
  for (const [who, place] of [["Ayesha Tester", 1], ["Bushra Helper", 2], ["Fatima Final", 3]] as const) {
    const f2 = form("Save result");
    await f2.getByLabel("Team or person").selectOption({ label: who }); await f2.getByLabel("Place").fill(String(place));
    say(`T117 result ${place}:`, T(await timedClick(p, f2.getByRole("button", { name: "Save result" }), `save place ${place}`)), await toastText(p));
    await p.waitForTimeout(500);
  }
  const f3 = form("Save hours");
  await f3.getByLabel("Volunteer").selectOption({ label: "Ali Helper" }).catch((e) => say("vol:", e.message.split("\n")[0])); await f3.getByLabel("Hours").fill("3");
  say("T117 hours:", T(await timedClick(p, f3.getByRole("button", { name: "Save hours" }), "save volunteer hours")), await toastText(p));
  await p.waitForTimeout(800);
  say("T117 preview:", (await mainText(p, 6000)).split("Close-out | Feedback | ")[1]?.slice(0, 900));
  await shot(p, "T117");
  say("T117 issue:", T(await timedClick(p, M.getByRole("button", { name: "Issue now" }), "issue entries", { timeout: 40_000 })), await dialogText(p, 500), await toastText(p));
  const c = p.locator('[role="dialog"], [role="alertdialog"]').getByRole("button", { name: /Issue/ }).last(); if (await c.isVisible().catch(() => false)) say("T117 confirm:", T(await timedClick(p, c, "confirm issue", { timeout: 40_000 })));
  await p.waitForTimeout(1500);
  say("T117 after:", (await mainText(p, 6000)).split("Close-out | Feedback | ")[1]?.slice(0, 700));
  say("T117 signer:", execFileSync("node", ["scripts/ux-pilot/signer.mjs"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n").pop());
  const issued = await sql`select p.username, e.kind::text, e.status::text, e.title from public.record_entries e join public.profiles p using (user_id) where e.source_id = ${D.comp} order by 1`;
  say("T117 entries:", issued.map((r: any) => `${r.username}:${r.kind}:${r.status}`).join(", "));
}

if (run("T118")) {
  setTask("T118");
  const [e] = await sql`select id from public.record_entries where source_id = ${D.comp} and user_id = ${acc.helperB.id} and kind::text = 'result' and status in ('sealed','pending') limit 1`;
  if (e) await asUser(acc.helperB.id, `select public.report_record_mistake($1, $2)`, [e.id, "I came 2nd in the final round but the award should say 'Best UI' too."]).catch((x: any) => say("report:", x.message));
  const [soc] = await sql`select slug from public.societies where name = 'UX Pilot Developers Club'`;
  await timedGoto(p, `/societies/${soc.slug}/manage#record`); await ready(p, 700);
  say("T118 record section:", (await mainText(p, 9000)).split(" | ").filter((l) => /mistake|report|Bushra|Correct|Speed coding/i.test(l)).slice(0, 10));
  const cform = M.locator("form").filter({ has: p.getByRole("button", { name: "Correct it" }) }).first();
  say("T118 correction form:", await cform.locator("input, textarea, select").evaluateAll((e) => e.map((x) => `${x.tagName}[${(x as HTMLInputElement).type ?? ""}]:${(x as HTMLInputElement).labels?.[0]?.innerText?.replace(/\n/g, " ") ?? x.getAttribute("aria-label")}=${(x as HTMLInputElement).value}`).join(" ; ")));
  const fields = cform.locator("input[type=text], input:not([type]), textarea");
  const n = await fields.count();
  for (let i = 0; i < n; i++) { const lab = await fields.nth(i).evaluate((x) => (x as HTMLInputElement).labels?.[0]?.innerText ?? ""); if (/award|title|line/i.test(lab)) await fields.nth(i).fill("Best UI"); if (/note/i.test(lab)) await fields.nth(i).fill("Added the Best UI award after Bushra's report."); }
  say("T118 correct it:", T(await timedClick(p, cform.getByRole("button", { name: "Correct it" }), "issue correction")), await toastText(p));
  await p.waitForTimeout(1000);
  say("T118 after correction:", (await mainText(p, 9000)).split(" | ").filter((l) => /Bushra Helper\tResult|superseded|Superseded|Best UI|mistake/i.test(l)).slice(0, 6));
  await shot(p, "T118");
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 30_000 }).catch(() => null), (async () => { await p.goto(`/events/${D.comp}/manage`); await ready(p, 500); await M.getByRole("link", { name: "Export CSV" }).click(); })()]);
  if (dl) { await dl.saveAs("/tmp/claude-0/uxp/attendees.csv"); const csv = readFileSync("/tmp/claude-0/uxp/attendees.csv", "utf8"); say("T118 CSV:", dl.suggestedFilename(), "| first lines:", csv.split("\n").slice(0, 3).join(" // "), "| BOM:", csv.charCodeAt(0) === 0xfeff); } else say("T118 no download");
  await timedGoto(p, `/events/${D.comp}/manage?tab=feedback`); await ready(p, 600);
  say("T118 feedback:", (await mainText(p, 5000)).split("Close-out | Feedback | ")[1]?.slice(0, 400));
}
await b.close(); await sql.end();
