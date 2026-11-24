/** S08: the Record (T080-T083) and the CV (T084-T086). Run scripts/ux-pilot/signer.mjs first (CV and Record signing). */
import { launch, context, page, ready, signIn, accounts } from "./lib/browser.ts";
import { timedClick, setTask, timedGoto } from "./lib/timed.ts";
import { shot } from "./lib/shot.ts";
import { sql, asUser, mainText, dialogText, toastText } from "./lib/act.ts";
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";
const say = (...x: unknown[]) => console.log(...x);
const A = accounts(); const ids = A.ids; const acc = A.accounts;
const ONLY = process.env.ONLY?.split(","); const run = (id: string) => !ONLY || ONLY.includes(id);
const T = (t: any) => `${t.kind} pending=${t.pendingMs} result=${t.resultMs} "${String(t.shown).replace(/\n/g, " ").slice(0, 160)}"`;
const sign = (...u: string[]) => { try { return execFileSync("node", ["scripts/ux-pilot/signer.mjs", ...u], { encoding: "utf8", env: process.env, stdio: ["ignore", "pipe", "ignore"] }).trim().replace(/\n/g, " "); } catch (e: any) { return "signer failed: " + e.message; } };
const b = await launch();
const ctx = await context(b, { device: "phone" });
const p = await page(ctx);
await signIn(p, acc.tester); await ready(p, 800);
const btn = (name: RegExp | string) => p.getByRole("button", { name }).first();
p.on("dialog", async (d) => { say("   native dialog:", d.message()); await d.accept(); });

if (run("T080")) {
  setTask("T080");
  await timedGoto(p, "/me/record"); await ready(p, 600);
  say("T080 pin:", T(await timedClick(p, btn("Pin Fee Tracker to your profile"), "pin entry")), await toastText(p));
  await p.waitForTimeout(800);
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 60_000 }).catch(() => null), timedClick(p, btn("Certificate for Fee Tracker"), "download certificate", { timeout: 60_000 })]);
  say("T080 certificate:", dl ? `${dl.suggestedFilename()}` : "no download", "| toast:", await toastText(p), await dialogText(p, 300));
  if (dl) { await dl.saveAs("/tmp/claude-0/uxp/cert-entry.pdf"); say("T080 cert bytes:", readFileSync("/tmp/claude-0/uxp/cert-entry.pdf").length); }
  const [e] = await sql`select code from public.record_entries where user_id = ${acc.tester.id} and status = 'sealed' and title like '%Fee Tracker%' limit 1`.catch(async () => await sql`select code from public.record_entries where user_id = ${acc.tester.id} and status = 'sealed' limit 1`);
  const v = await page(await context(b, { device: "phone", throttle: false }));
  await v.goto("/verify/" + e.code); await ready(v, 600);
  say("T080 verify page (signed out):", await mainText(v, 1500));
  await shot(v, "T080");
  await timedGoto(p, "/profile/uxp_tester"); await ready(p, 600);
  say("T080 profile pins:", (await mainText(p, 3000)).split(" | ").filter((l) => /Fee Tracker|Highlight|Pinned|Record/i.test(l)).slice(0, 6));
}

if (run("T081")) {
  setTask("T081");
  await timedGoto(p, "/me/record"); await ready(p, 600);
  await p.getByPlaceholder("Scholarship application").fill("HEC scholarship committee");
  say("T081 expiry options:", (await mainText(p, 4000)).split("Expires after | ")[1]?.slice(0, 60));
  await p.getByText("7 days", { exact: true }).click();
  say("T081 make link:", T(await timedClick(p, btn("Make a share link"), "make record share link")), await toastText(p));
  await p.waitForTimeout(1000);
  const share = (await mainText(p, 5000)).split("Share your Record | ")[1]?.slice(0, 800);
  say("T081 share section:", share);
  const url = await p.evaluate(() => Array.from(document.querySelectorAll("input, code, a")).map((e) => (e as HTMLInputElement).value || (e as HTMLElement).innerText || (e as HTMLAnchorElement).href).find((t) => /\/record\/.*\?t=/.test(t ?? "")) ?? "");
  say("T081 link:", url.slice(0, 120));
  await shot(p, "T081");
  if (url) { const v = await page(await context(b, { device: "desktop", throttle: false })); await v.goto(url.replace(/^https?:\/\/[^/]+/, "")); await ready(v, 600); say("T081 committee view:", await mainText(v, 1200)); }
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 60_000 }).catch(() => null), timedClick(p, btn("Download transcript PDF"), "download transcript", { timeout: 60_000 })]);
  say("T081 transcript:", dl ? dl.suggestedFilename() : "no download", await toastText(p));
  const rev = p.getByRole("button", { name: /Revoke|Cancel link|Stop sharing/ }).first();
  if (await rev.isVisible().catch(() => false)) { say("T081 revoke:", T(await timedClick(p, rev, "revoke share link")), await dialogText(p, 400)); const c = p.locator('[role="dialog"], [role="alertdialog"]').getByRole("button", { name: /Revoke/ }).last(); if (await c.isVisible().catch(() => false)) say("T081 confirm:", T(await timedClick(p, c, "confirm revoke"))); await p.waitForTimeout(800); say("T081 after revoke:", (await mainText(p, 5000)).split("Share your Record | ")[1]?.slice(0, 500)); if (url) { const v2 = await page(await context(b, { device: "phone", throttle: false })); await v2.goto(url.replace(/^https?:\/\/[^/]+/, "")); await ready(v2, 500); say("T081 link after revoke:", await mainText(v2, 300)); } }
}

if (run("T082")) {
  setTask("T082");
  await timedGoto(p, "/me/record"); await ready(p, 600);
  say("T082 report:", T(await timedClick(p, btn("Report a mistake in SQL for beginners workshop"), "report a mistake")), await dialogText(p, 600));
  const d = p.locator('[role="dialog"]').last();
  await d.locator("textarea").first().fill("I attended both sessions, and the title should be 'SQL for beginners workshop (2 sessions)'.").catch(() => undefined);
  say("T082 send:", T(await timedClick(p, d.getByRole("button", { name: /^(Send|Report)/ }).last(), "send mistake report")), await toastText(p));
  await p.waitForTimeout(800);
  say("T082 entry after report:", (await mainText(p, 4000)).split(" | ").filter((l) => /SQL|mistake|review|officer/i.test(l)).slice(0, 6));
  // Officer helper corrects that entry and revokes the React one.
  const [sqlE] = await sql`select id from public.record_entries where user_id = ${acc.tester.id} and status = 'sealed' and title like '%SQL for beginners%' limit 1`;
  const [reE] = await sql`select id from public.record_entries where user_id = ${acc.tester.id} and status = 'sealed' and title like '%React basics%' limit 1`;
  if (sqlE) await asUser(acc.officer1.id, `select public.correct_record_entry($1, $2::text::jsonb, $3)`, [sqlE.id, JSON.stringify({ title: "SQL for beginners workshop (2 sessions)" }), "Corrected after Ayesha's report."]).catch((e: any) => say("correct:", e.message));
  if (reE) await asUser(acc.officer1.id, `select public.revoke_record_entry($1, 'issued_in_error', $2)`, [reE.id, "Issued to the wrong list: this workshop was for first-years only."]).catch((e: any) => say("revoke:", e.message));
  say("T082 signer:", sign());
  await p.reload(); await ready(p, 600);
  say("T082 record now:", await mainText(p, 2500));
  await shot(p, "T082");
  await timedGoto(p, "/appeals"); await ready(p, 600);
  say("T082 appeals:", await mainText(p, 800));
}

if (run("T083")) {
  setTask("T083");
  const f = await page(await context(b, { device: "phone", throttle: false }));
  await signIn(f, acc.testerFresh); await f.goto("/me/record"); await ready(f, 600);
  say("T083 empty record:", await mainText(f, 800), "| actions:", await f.locator("main a, main button").allInnerTexts());
  await shot(f, "T083");
}

if (run("T084")) {
  setTask("T084");
  await timedGoto(p, "/me/cv"); await ready(p, 600);
  const sec = (name: string) => p.locator("main li, main div").filter({ has: p.getByRole("button", { name: `Move ${name} up` }) }).last();
  const box = sec("Endorsements").getByRole("checkbox").first();
  say("T084 endorsements box:", await box.getAttribute("aria-checked"), await box.getAttribute("aria-label"));
  await box.click().catch((e) => say("box:", e.message.split("\n")[0]));
  const ach = await sec("Open-source work").getByRole("checkbox").first(); await ach.click().catch(() => undefined);
  say("T084 save settings:", T(await timedClick(p, btn("Save CV settings"), "save CV settings", { timeout: 30_000 })), await toastText(p));
  await p.waitForTimeout(1000);
  say("T084 activities:", (await mainText(p, 9000)).split("Leadership and activities | ").slice(-1)[0]?.slice(0, 500));
  const act = p.locator("#activities").getByRole("checkbox").first();
  if (await act.isVisible().catch(() => false)) { await act.click(); say("T084 save activities:", T(await timedClick(p, btn("Save activities"), "save activities")), await toastText(p)); }
  await p.waitForTimeout(800);
  say("T084 updates note:", (await mainText(p, 9000)).split(" | ").filter((l) => /refresh|1 December|Pro/i.test(l)).slice(0, 4));
  say("T084 signer (on_demand stand-in):", (process.env.SIGN_SOURCE = "on_demand", sign("uxp_tester")));
  delete process.env.SIGN_SOURCE;
  await p.reload(); await ready(p, 600);
  say("T084 CV now:", (await mainText(p, 3000)).split("Your verified CV | ")[2]?.slice(0, 1600));
  await shot(p, "T084");
}

if (run("T085")) {
  setTask("T085");
  const s = await page(await context(b, { device: "phone" }));
  s.on("dialog", async (d) => { say("   native dialog:", d.message()); await d.accept(); });
  await signIn(s, acc.testerSpark); await ready(s, 400);
  await timedGoto(s, "/me/cv"); await ready(s, 600);
  say("T085 spark cv page:", (await mainText(s, 1500)).slice(0, 500));
  const label = s.getByPlaceholder("For Systems Ltd");
  if (await label.isVisible().catch(() => false)) {
    await label.fill("Arbisoft internship");
    await s.getByText("30 days", { exact: true }).click().catch(() => undefined);
    say("T085 make link:", T(await timedClick(s, s.getByRole("button", { name: "Make a share link" }).first(), "make CV share link")), await toastText(s), await dialogText(s, 400));
    await s.waitForTimeout(1000);
    say("T085 links:", (await mainText(s, 12000)).split(" | ").filter((l) => /link|expires|views|opened|Arbisoft/i.test(l)).slice(0, 10));
  } else say("T085 no share-link form:", (await mainText(s, 9000)).split(" | ").filter((l) => /share|Spark|link/i.test(l)).slice(0, 8));
  const pdf = s.getByRole("button", { name: /Export ATS PDF|PDF/ }).first();
  say("T085 pdf button:", await pdf.innerText().catch(() => "none"), "disabled:", await pdf.isDisabled().catch(() => "?"));
  say("T085 pdf hint:", (await mainText(s, 12000)).split(" | ").filter((l) => /PDF|Pro/i.test(l)).slice(0, 6));
  await shot(s, "T085");
  await timedGoto(s, "/settings/privacy"); await ready(s, 400);
  say("T085 privacy views:", (await mainText(s, 3000)).split(" | ").filter((l) => /view|share link/i.test(l)).slice(0, 5));
}

if (run("T086")) {
  setTask("T086");
  // Helper B starts the Pro trial in the app and exports a genuine PDF; a forged copy is the same CV printed with one character changed.
  const h = await page(await context(b, { device: "desktop", throttle: false }));
  await signIn(h, acc.helperB); await h.goto("/settings/billing"); await ready(h, 500);
  const trial = h.getByRole("button", { name: "Start my free trial" });
  if (await trial.isVisible().catch(() => false)) { await trial.click(); await h.waitForTimeout(2000); }
  await h.goto("/me/cv"); await ready(h, 600);
  const exp = h.getByRole("button", { name: "Export ATS PDF" });
  say("T086 helper export enabled:", !(await exp.isDisabled().catch(() => true)));
  let genuine = "";
  const [dl] = await Promise.all([h.waitForEvent("download", { timeout: 90_000 }).catch(() => null), exp.click().catch(() => undefined)]);
  if (dl) { genuine = "/tmp/claude-0/uxp/cv-genuine.pdf"; await dl.saveAs(genuine); }
  say("T086 genuine pdf:", genuine ? readFileSync(genuine).length + " bytes" : "none", await toastText(h));
  const [cv] = await sql`select code from public.cv_records where user_id = ${acc.helperB.id} order by issued_at desc limit 1`.catch(async () => await sql`select code from public.cv_records where user_id = ${acc.helperB.id} limit 1`);
  // Forged: the CV view with one character changed (Class of 2028 -> 2026), printed to PDF.
  await h.goto("/me/cv"); await ready(h, 500);
  await h.evaluate(() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (n.nodeValue?.includes("Class of 2028")) { n.nodeValue = n.nodeValue.replace("Class of 2028", "Class of 2026"); break; } });
  await h.pdf({ path: "/tmp/claude-0/uxp/cv-forged.pdf" }).catch((e) => say("forge:", e.message));
  // The tester checks both: the code in each PDF's footer at /verify.
  setTask("T086");
  await timedGoto(p, "/verify"); await ready(p, 500);
  await p.getByPlaceholder("ABCDE-12345").fill(String(cv?.code ?? ""));
  say("T086 check:", T(await timedClick(p, btn("Check"), "check CV code", { timeout: 30_000 })));
  await ready(p, 600);
  say("T086 verify result:", await mainText(p, 2500));
  await shot(p, "T086");
  say("T086 any upload/compare control:", await p.locator('input[type="file"]').count());
}
await b.close(); await sql.end();
