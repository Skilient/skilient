/** S04: chat (T037-T040), Explore and profiles (T041-T043), notifications (T044), home screen (T046). */
import { launch, context, page, ready, signIn, accounts } from "./lib/browser.ts";
import { timedClick, setTask, timedGoto } from "./lib/timed.ts";
import { shot } from "./lib/shot.ts";
import { sql, asUser, mainText, dialogText, toastText } from "./lib/act.ts";
const say = (...x: unknown[]) => console.log(...x);
const A = accounts(); const ids = A.ids; const acc = A.accounts;
const ONLY = process.env.ONLY?.split(","); const run = (id: string) => !ONLY || ONLY.includes(id);
const T = (t: any) => `${t.kind} pending=${t.pendingMs} result=${t.resultMs} "${String(t.shown).replace(/\n/g, " ").slice(0, 160)}"`;
const b = await launch();
const ctx = await context(b, { device: "phone" });
const p = await page(ctx);
await signIn(p, acc.tester); await ready(p, 800);
const dm = ids.dmTesterA;
const box = () => p.locator("textarea").last();
const lastMsgs = async (n = 600) => (await mainText(p, 4000)).slice(-n);

if (run("T037")) {
  setTask("T037");
  await timedGoto(p, "/chat/" + dm); await ready(p, 800);
  await box().fill("Quick one: is the DB quiz on Thursday or Friday?");
  const t = await timedClick(p, p.getByRole("button", { name: /^Send/ }).last(), "send message", { settleMs: 1500 });
  say("T037 send:", T(t));
  await p.waitForTimeout(1500);
  const status = await p.evaluate(() => Array.from(document.querySelectorAll("main *")).map((e) => (e as HTMLElement).innerText).filter((t) => /^(· )?(Sent|Delivered|Seen|Sending…?)$/.test(t ?? "")).slice(-3));
  say("T037 status marks:", status, "| tail:", await lastMsgs(250));
  await shot(p, "T037");
  // photo
  const file = p.locator('input[type="file"]').last();
  say("T037 file inputs:", await p.locator('input[type="file"]').count());
  if (await p.locator('input[type="file"]').count()) {
    await file.setInputFiles("/tmp/claude-0/uxp/notes.jpg"); await p.waitForTimeout(1500);
    const t2 = await timedClick(p, p.getByRole("button", { name: /^Send/ }).last(), "send photo", { timeout: 60_000, settleMs: 2500 });
    say("T037 photo:", T(t2), "|", await toastText(p));
    await p.waitForTimeout(3000);
  }
  // Helper A answers.
  await asUser(acc.helperA.id, `select public.send_message($1, $2)`, [dm, "Thursday, 9am. Room 204."]);
  await p.waitForTimeout(4000);
  say("T037 helper reply arrived live:", (await lastMsgs(300)).includes("Room 204"));
  if (!(await lastMsgs(300)).includes("Room 204")) { await p.reload(); await ready(p, 600); }
  const msg = p.locator("main li, main [data-message], main article").filter({ hasText: "Room 204" }).last();
  await msg.getByRole("button", { name: "Reply" }).click().catch(async () => { await p.getByRole("button", { name: "Reply" }).last().click(); });
  await p.waitForTimeout(500);
  say("T037 reply context:", (await mainText(p, 4000)).slice(-250));
  await box().fill("Thanks! See you there.");
  say("T037 reply send:", T(await timedClick(p, p.getByRole("button", { name: /^Send/ }).last(), "send reply", { settleMs: 1500 })));
  await p.waitForTimeout(1200);
  await msg.getByRole("button", { name: "React" }).click().catch(async () => p.getByRole("button", { name: "React" }).last().click());
  await p.waitForTimeout(600);
  say("T037 react picker:", await dialogText(p, 300), "| menu:", (await p.locator('[role="menu"], [role="listbox"]').last().innerText().catch(() => "")).replace(/\n/g, " "));
  const emoji = p.locator('[role="menu"] button, [role="dialog"] button, [role="menuitem"]').first();
  if (await emoji.isVisible().catch(() => false)) say("T037 react:", T(await timedClick(p, emoji, "react")));
  await p.waitForTimeout(800);
  // delete own message
  const mine = p.locator("main li, main [data-message], main article").filter({ hasText: "Quick one: is the DB quiz" }).last();
  await mine.getByRole("button", { name: "Delete" }).click().catch(() => undefined);
  await p.waitForTimeout(600);
  say("T037 delete dialog:", await dialogText(p));
  const conf = p.locator('[role="dialog"], [role="alertdialog"]').getByRole("button", { name: /Delete/ }).last();
  if (await conf.isVisible().catch(() => false)) say("T037 delete:", T(await timedClick(p, conf, "delete message")));
  await p.waitForTimeout(1200);
  say("T037 after delete:", await lastMsgs(700));
  await shot(p, "T037");
}

if (run("T038")) {
  setTask("T038");
  await timedGoto(p, "/chat/" + dm); await ready(p, 800);
  await ctx.setOffline(true);
  await p.waitForTimeout(1500);
  say("T038 offline banner:", (await p.locator("body").innerText()).split("\n").filter((l) => /offline|connection|internet/i.test(l)).slice(0, 3));
  await box().fill("Sent from airplane mode");
  const t = await timedClick(p, p.getByRole("button", { name: /^Send/ }).last(), "send offline", { settleMs: 3000, timeout: 15_000 });
  say("T038 send offline:", T(t), "| toast:", await toastText(p));
  await p.waitForTimeout(2000);
  say("T038 offline tail:", await lastMsgs(300));
  await shot(p, "T038");
  await ctx.setOffline(false);
  await p.waitForTimeout(8000);
  say("T038 back online tail:", await lastMsgs(300), "| toast:", await toastText(p));
  const [row] = await sql`select count(*)::int as n from public.chat_messages where thread_id = ${dm} and body = 'Sent from airplane mode'`;
  say("T038 stored:", row.n);
  await shot(p, "T038");
  const retry = p.getByRole("button", { name: /retry|try again|resend/i }).first();
  if (await retry.isVisible().catch(() => false)) { say("T038 retry:", T(await timedClick(p, retry, "retry send"))); const [r2] = await sql`select count(*)::int as n from public.chat_messages where thread_id = ${dm} and body = 'Sent from airplane mode'`; say("T038 stored after retry:", r2.n); }
}

if (run("T039")) {
  setTask("T039");
  await timedGoto(p, "/chat"); await ready(p, 600);
  await p.getByRole("searchbox").fill("December");
  await p.keyboard.press("Enter"); await p.waitForTimeout(2000);
  say("T039 search:", await mainText(p, 600));
  await shot(p, "T039");
  // Mute the venture chat.
  await p.goto("/chat"); await ready(p, 400);
  await p.getByRole("link", { name: /Fee Tracker/ }).first().click(); await ready(p, 600);
  say("T039 venture chat:", await mainText(p, 300));
  say("T039 mute:", T(await timedClick(p, p.getByRole("button", { name: "Mute" }), "Mute chat")));
  say("T039 header after mute:", await p.getByRole("button", { name: /Mute|Unmute|Muted/ }).allInnerTexts(), await toastText(p));
  await p.waitForTimeout(700);
  say("T039 mute options:", await dialogText(p), (await p.locator('[role="menu"]').innerText().catch(() => "")).replace(/\n/g, " | "));
  await shot(p, "T039");
  const opt = p.locator('[role="menu"] [role="menuitem"], [role="dialog"] button').filter({ hasText: /hour|day|week|until|forever|always/i }).first();
  if (await opt.isVisible().catch(() => false)) say("T039 mute choose:", T(await timedClick(p, opt, "choose mute length")), await toastText(p));
  await timedGoto(p, "/settings/chat"); await ready(p, 600);
  say("T039 chat settings:", await mainText(p, 600));
  const sw = p.getByRole("switch").first();
  say("T039 receipts:", await sw.getAttribute("aria-checked"));
  say("T039 toggle:", T(await timedClick(p, sw, "read receipts off")), "| now", await sw.getAttribute("aria-checked"), await toastText(p));
  await shot(p, "T039");
}

if (run("T040")) {
  setTask("T040");
  await timedGoto(p, "/explore"); await ready(p, 600);
  await p.getByRole("searchbox").fill("Danish"); await p.keyboard.press("Enter"); await p.waitForTimeout(2000);
  say("T040 results:", await mainText(p, 500));
  await p.getByRole("link", { name: "Danish Helper" }).first().click(); await ready(p, 600); await mainText(p, 10);
  say("T040 stranger profile buttons:", await p.locator("main").getByRole("button").allInnerTexts());
  const m = p.getByRole("button", { name: /Message/ }).first();
  if (await m.isVisible().catch(() => false)) { say("T040 message:", T(await timedClick(p, m, "Message stranger"))); await p.waitForTimeout(800); say("T040 after:", await dialogText(p), await toastText(p), new URL(p.url()).pathname); }
  else say("T040 no Message button; page:", await mainText(p, 400));
  await shot(p, "T040");
  await asUser(acc.helperA.id, `select public.send_message($1, $2)`, [dm, "[UX test] buy cheap followers here"]).catch((e: any) => say("helper msg:", e.message));
  await timedGoto(p, "/chat/" + dm); await ready(p, 800);
  const msg = p.locator("main li, main [data-message], main article").filter({ hasText: "[UX test] buy cheap" }).last();
  await msg.getByRole("button", { name: "Report" }).click();
  await p.waitForTimeout(700);
  say("T040 report sheet:", await dialogText(p));
  await shot(p, "T040");
  const d = p.locator('[role="dialog"]').last();
  await d.getByRole("radio").first().click().catch(() => undefined);
  say("T040 send report:", T(await timedClick(p, d.getByRole("button", { name: /Send report|Report/ }).last(), "report message")), await toastText(p));
  const [rep] = await sql`select r.target_type::text, (select count(*)::int from public.report_messages rm where rm.report_id = r.id) as ctx from public.reports r where r.reporter_id = ${acc.tester.id} order by r.created_at desc limit 1`.catch(() => [{}] as any);
  say("T040 stored report:", JSON.stringify(rep));
  await timedGoto(p, "/chat"); await ready(p, 500);
  say("T040 chat list:", await mainText(p, 500));
}

if (run("T041")) {
  setTask("T041");
  await timedGoto(p, "/explore"); await ready(p, 600);
  let clicks = 0;
  await p.locator("select").filter({ has: p.locator("option", { hasText: "Any batch" }) }).selectOption({ label: "2028" }); clicks++;
  await p.waitForTimeout(1500);
  say("T041 batch only:", await mainText(p, 500));
  await p.locator("select").filter({ has: p.locator("option", { hasText: "Any skill" }) }).selectOption({ label: "React" }); clicks++;
  await p.waitForTimeout(1500);
  say("T041 batch+React:", await mainText(p, 600), "| url", new URL(p.url()).search);
  const uni = p.locator("select").filter({ has: p.locator("option", { hasText: "Any university" }) });
  say("T041 university options:", await uni.locator("option").count());
  await shot(p, "T041");
  await p.getByRole("searchbox").fill("a"); await p.keyboard.press("Enter"); await p.waitForTimeout(1500);
  say("T041 with 1 letter:", await mainText(p, 500));
  await p.getByRole("searchbox").fill("Iq"); await p.keyboard.press("Enter"); await p.waitForTimeout(1500); clicks++;
  say("T041 with 'Iq':", await mainText(p, 600));
  const hit = p.getByRole("link", { name: /Iqra Secretary/ }).first();
  if (await hit.isVisible().catch(() => false)) { await hit.click(); await ready(p, 600); await mainText(p, 10); clicks++; say("T041 profile:", await mainText(p, 900)); await shot(p, "T041"); }
  say("T041 clicks", clicks);
}

if (run("T042")) {
  setTask("T042");
  await timedGoto(p, "/explore"); await ready(p, 600);
  await p.locator("select").filter({ has: p.locator("option", { hasText: "Any batch" }) }).selectOption({ label: "2030" });
  await p.locator("select").filter({ has: p.locator("option", { hasText: "Any skill" }) }).selectOption({ label: "Rust" });
  await p.getByPlaceholder("Any department").fill("Physics").catch(() => undefined);
  await p.getByRole("searchbox").fill("Zzyzx Qwerty"); await p.keyboard.press("Enter"); await p.waitForTimeout(2000);
  say("T042 empty:", await mainText(p, 700));
  await shot(p, "T042");
  await timedGoto(p, "/profile/uxp_officer_2"); await ready(p, 600);
  say("T042 stranger profile:", await mainText(p, 900), "| buttons:", await p.locator("main").getByRole("button").allInnerTexts());
  await shot(p, "T042");
}

if (run("T043")) {
  setTask("T043");
  await timedGoto(p, "/me"); await ready(p, 600);
  say("T043 /me:", await mainText(p, 700));
  const how = p.getByRole("link", { name: /how others see|preview|view as/i }).or(p.getByRole("button", { name: /how others see|preview|view as/i })).first();
  if (await how.isVisible().catch(() => false)) { say("T043 how others:", T(await timedClick(p, how, "How others see you"))); await ready(p, 600); }
  else { await timedGoto(p, "/profile/uxp_tester"); await ready(p, 600); }
  say("T043 own profile:", new URL(p.url()).pathname + new URL(p.url()).search, await mainText(p, 1200), "| buttons:", await p.locator("main").getByRole("button").allInnerTexts());
  await shot(p, "T043");
  // Block helper C, then search.
  await p.goto("/profile/uxp_helper_c"); await ready(p, 500);
  await p.getByRole("button", { name: "Block" }).click(); await p.waitForTimeout(500);
  await p.locator('[role="dialog"], [role="alertdialog"]').getByRole("button", { name: "Block" }).last().click(); await p.waitForTimeout(1500);
  await timedGoto(p, "/explore"); await ready(p, 500);
  await p.getByRole("searchbox").fill("Chaudhry"); await p.keyboard.press("Enter"); await p.waitForTimeout(2000);
  say("T043 search blocked:", await mainText(p, 500));
  await p.keyboard.press("Control+k").catch(() => undefined);
}

if (run("T044")) {
  setTask("T044");
  const before = Date.now();
  await asUser(acc.helperA.id, `select public.send_message($1, $2)`, [dm, "Did you finish the ERD?"]);
  await asUser(acc.officer2.id, `select public.send_friend_request('uxp_tester')`).catch((e: any) => say("req:", e.message));
  // A venture decision: the tester applied to the full venture earlier? Apply to helper venture and helper A declines.
  const thread = await asUser(acc.tester.id, `select public.apply_to_venture($1, $2, $3::text[], null)`, [ids.helperVenture, "I can do the backend.", "{I built a fee tracker API}"]).catch((e: any) => (say("apply:", e.message), null));
  if (thread) await asUser(acc.helperA.id, `select public.decide_application($1, false)`, [thread]).catch((e: any) => say("decide:", e.message));
  say("T044 setup ms", Date.now() - before);
  await timedGoto(p, "/feed"); await ready(p, 800);
  const bell = p.getByRole("link", { name: /Notifications/ }).first();
  say("T044 bell:", await bell.getAttribute("aria-label"));
  say("T044 open:", T(await timedClick(p, bell, "open notifications")));
  await ready(p, 600);
  say("T044 list:", await mainText(p, 1800));
  await shot(p, "T044");
  const decision = p.getByRole("link", { name: /declined|application|Campus Lost/i }).first();
  if (await decision.isVisible().catch(() => false)) { say("T044 open decision:", T(await timedClick(p, decision, "open decision"))); await ready(p, 600); say("T044 decision page:", new URL(p.url()).pathname, await mainText(p, 700)); await p.goBack(); await ready(p, 600); }
  say("T044 mark all:", T(await timedClick(p, p.getByRole("button", { name: "Mark all read" }), "Mark all read")));
  await p.waitForTimeout(1000);
  say("T044 after:", (await mainText(p, 300)), "| bell:", await p.getByRole("link", { name: /Notifications/ }).first().getAttribute("aria-label"), "| chat tab:", await p.getByRole("link", { name: /^Chat/ }).last().getAttribute("aria-label").catch(() => ""), await p.getByRole("link", { name: /^Chat/ }).last().innerText().catch(() => ""));
  await shot(p, "T044");
  const f = await page(await context(b, { device: "phone", throttle: false }));
  await signIn(f, acc.testerFresh); await f.goto("/notifications"); await ready(f, 500);
  say("T044 fresh:", await mainText(f, 400));
}

if (run("T046")) {
  setTask("T046");
  await timedGoto(p, "/feed"); await ready(p, 800);
  const man = await p.evaluate(async () => { const l = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null; if (!l) return null; const m = await (await fetch(l.href)).json(); return { name: m.name, short: m.short_name, display: m.display, start: m.start_url, icons: (m.icons ?? []).map((i: any) => i.sizes).join(",") }; });
  say("T046 manifest:", JSON.stringify(man));
  const sw = await p.evaluate(async () => (await navigator.serviceWorker?.getRegistrations?.())?.length ?? 0);
  say("T046 service workers:", sw);
  say("T046 install offer on page:", (await p.locator("body").innerText()).split("\n").filter((l) => /home screen|install|add to/i.test(l)).slice(0, 3));
  await timedGoto(p, "/settings"); await ready(p, 400);
  say("T046 settings install mention:", /home screen|install/i.test(await p.locator("body").innerText()));
}
await b.close(); await sql.end();
