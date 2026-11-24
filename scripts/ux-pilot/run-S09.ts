/** S09: Openings (T087-T088), societies (T089-T091), events and tickets (T094-T100). Officers are played through the product's functions. */
import { launch, context, page, ready, signIn, accounts } from "./lib/browser.ts";
import { timedClick, setTask, timedGoto } from "./lib/timed.ts";
import { shot } from "./lib/shot.ts";
import { sql, asUser, mainText, dialogText, toastText } from "./lib/act.ts";
import sharp from "sharp";
const say = (...x: unknown[]) => console.log(...x);
const A = accounts(); const ids = A.ids; const acc = A.accounts; const ev = ids.events;
const ONLY = process.env.ONLY?.split(","); const run = (id: string) => !ONLY || ONLY.includes(id);
const T = (t: any) => `${t.kind} pending=${t.pendingMs} result=${t.resultMs} "${String(t.shown).replace(/\n/g, " ").slice(0, 160)}"`;
const b = await launch();
const p = await page(await context(b, { device: "phone" }));
p.on("dialog", async (d) => { say("   native dialog:", d.message()); await d.accept(); });
await signIn(p, acc.tester); await ready(p, 800);
const btn = (name: RegExp | string) => p.getByRole("button", { name }).first();
const dlg = () => p.locator('[role="dialog"], [role="alertdialog"]').last();
const S = ids.societies;

if (run("T087")) {
  setTask("T087");
  await timedGoto(p, "/openings/this-week"); await ready(p, 600);
  say("T087 this week:", await mainText(p, 1200));
  await timedGoto(p, "/openings/events"); await ready(p, 600);
  say("T087 events card list:", await mainText(p, 1200));
  await shot(p, "T087");
}

if (run("T088")) {
  setTask("T088");
  await timedGoto(p, "/openings/ideas"); await ready(p, 600);
  say("T088 ideas:", await mainText(p, 900), "| controls:", await p.locator("main select, main input").evaluateAll((e) => e.map((x) => x.getAttribute("aria-label") ?? x.getAttribute("name"))));
  const sort = p.locator("main select").first(); if (await sort.isVisible().catch(() => false)) { say("T088 sort options:", await sort.locator("option").allInnerTexts()); await sort.selectOption({ index: 1 }); await p.waitForTimeout(1000); }
  await timedGoto(p, "/explore?tab=ideas"); await ready(p, 600);
  say("T088 explore ideas:", await mainText(p, 700), "| filters:", await p.locator("main select").evaluateAll((e) => e.map((x) => (x as HTMLSelectElement).options[0]?.text)));
  await timedGoto(p, "/ideas/" + ids.idea); await ready(p, 600);
  say("T088 idea:", await mainText(p, 900));
  const start = p.getByRole("link", { name: /Start a venture|Start/ }).or(btn(/Start a venture/)).first();
  say("T088 start:", T(await timedClick(p, start, "start venture on idea", { timeout: 30_000 })));
  await ready(p, 600);
  say("T088 form prefilled:", new URL(p.url()).pathname + new URL(p.url()).search, "title=", await p.locator('input[name="title"]').inputValue().catch(() => "?"));
  const create = btn(/Create project|Create/);
  if (await create.isVisible().catch(() => false)) { say("T088 create:", T(await timedClick(p, create, "create venture from idea", { timeout: 30_000 })), await toastText(p)); await ready(p, 600); say("T088 after:", new URL(p.url()).pathname, (await mainText(p, 600))); }
  await shot(p, "T088");
}

if (run("T089")) {
  setTask("T089");
  await timedGoto(p, "/societies/" + S.request.slug); await ready(p, 600);
  say("T089 debating:", await mainText(p, 700), "| buttons:", await p.locator("main").getByRole("button").allInnerTexts());
  await shot(p, "T089");
  const f = btn(/^Follow/); if (await f.isVisible().catch(() => false)) say("T089 follow:", T(await timedClick(p, f, "follow society")), await toastText(p));
  const req = btn(/Request to join|Ask to join|Request/); if (await req.isVisible().catch(() => false)) { say("T089 request:", T(await timedClick(p, req, "request to join")), await dialogText(p, 400), await toastText(p)); const c = dlg().getByRole("button", { name: /Send|Request/ }).last(); if (await c.isVisible().catch(() => false)) say("T089 send req:", T(await timedClick(p, c, "send join request"))); }
  await p.waitForTimeout(800); say("T089 debating after:", await p.locator("main").getByRole("button").allInnerTexts());
  await timedGoto(p, "/societies/" + S.open.slug); await ready(p, 600);
  say("T089 dev club buttons:", await p.locator("main").getByRole("button").allInnerTexts());
  const j = btn(/^Join/); if (await j.isVisible().catch(() => false)) { say("T089 join:", T(await timedClick(p, j, "join open society")), await toastText(p), await dialogText(p, 300)); }
  await p.waitForTimeout(800); say("T089 dev club after:", await p.locator("main").getByRole("button").allInnerTexts());
  await timedGoto(p, "/societies/" + S.inductions.slug); await ready(p, 600);
  say("T089 guild buttons:", await p.locator("main").getByRole("button").allInnerTexts(), (await mainText(p, 600)));
  // Officer accepts the Debating request.
  const [jr] = await sql`select id from public.society_join_requests where society_id = ${S.request.id} and user_id = ${acc.tester.id} and status::text = 'pending'`.catch(() => [] as any);
  say("T089 pending request id:", jr?.id);
}

if (run("T090")) {
  setTask("T090");
  await timedGoto(p, "/openings/inductions"); await ready(p, 600);
  await timedGoto(p, `/societies/${S.inductions.slug}/inductions/${ids.inductionRound}`); await ready(p, 600);
  say("T090 round:", await mainText(p, 1200));
  await shot(p, "T090");
  const ap = btn(/^Apply/);
  say("T090 apply:", T(await timedClick(p, ap, "open induction apply")), await dialogText(p, 700));
  const d = dlg(); const tas = d.locator("textarea, input[type=text], input[type=url]");
  for (let i = 0; i < await tas.count(); i++) await tas.nth(i).fill(i === 0 ? "https://figma.com/file/my-portfolio" : "I redesigned our venture's onboarding.");
  const radio = d.getByRole("radio").first(); if (await radio.isVisible().catch(() => false)) await radio.click();
  say("T090 send:", T(await timedClick(p, d.getByRole("button", { name: /^(Send|Apply|Submit)/ }).last(), "send induction application", { timeout: 30_000 })), await toastText(p));
  await p.waitForTimeout(1000); say("T090 after:", await mainText(p, 600));
  const [app] = await sql`select id from public.induction_applications where round_id = ${ids.inductionRound} and user_id = ${acc.tester.id}`.catch(async () => await sql`select id from public.induction_applications where round_id = ${ids.inductionRound} order by created_at desc limit 1`);
  if (app) { const r = await asUser(acc.officer2.id, `select public.decide_induction_application($1, 'accept', $2)`, [app.id, "Loved your onboarding redesign. Welcome!"]).catch((e: any) => "decide: " + e.message); say("T090 officer decided:", r); }
  await p.reload(); await ready(p, 600); say("T090 after decision:", await mainText(p, 600));
  await timedGoto(p, "/notifications"); await ready(p, 500); say("T090 notification:", (await mainText(p, 600)).split(" | ").filter((l) => /Guild|induction|accepted/i.test(l)).slice(0, 3));
}

if (run("T091")) {
  setTask("T091");
  let [post] = await sql`select id from public.posts where body = '[UX test] society spam' limit 1`;
  if (!post) { const id = await asUser(acc.officer1.id, `select public.create_post($1::text::jsonb)`, [JSON.stringify({ type: "general", audience: "university", body: "[UX test] society spam", society_id: S.open.id })]); post = { id }; }
  await timedGoto(p, "/societies/" + S.open.slug); await ready(p, 600);
  const leave = btn(/^Leave/);
  say("T091 leave:", T(await timedClick(p, leave, "leave society")), await dialogText(p, 400));
  const c = dlg().getByRole("button", { name: /Leave/ }).last(); if (await c.isVisible().catch(() => false)) say("T091 confirm:", T(await timedClick(p, c, "confirm leave")));
  await p.waitForTimeout(800); say("T091 after leave:", await p.locator("main").getByRole("button").allInnerTexts(), await toastText(p));
  await timedGoto(p, "/post/" + post.id); await ready(p, 600);
  say("T091 post:", await mainText(p, 300));
  await btn("More for this post").click(); await p.waitForTimeout(600);
  await p.getByRole("button", { name: "Report" }).or(p.getByRole("menuitem", { name: "Report" })).first().click(); await p.waitForTimeout(700);
  say("T091 report sheet:", await dialogText(p, 600));
  await dlg().getByRole("radio").first().click().catch(() => undefined);
  say("T091 send:", T(await timedClick(p, dlg().getByRole("button", { name: /Send report/ }), "report society post")), await toastText(p));
  const repSoc = await p.goto("/societies/" + S.open.slug).then(() => ready(p, 500)).then(() => btn(/^Report/).isVisible().catch(() => false));
  say("T091 society page has Report:", repSoc);
}

let ticketEvent = ev.workshop;
if (run("T094")) {
  setTask("T094");
  await timedGoto(p, "/events?type=workshop"); await ready(p, 600);
  await p.getByRole("link", { name: /Intro to Git workshop/ }).first().click(); await ready(p, 600);
  say("T094 event:", await mainText(p, 900));
  say("T094 register:", T(await timedClick(p, btn(/^Register/), "open register")), await dialogText(p, 800));
  await shot(p, "T094");
  const d = dlg(); const tas = d.locator("textarea, input[type=text]");
  say("T094 fields:", await tas.evaluateAll((e) => e.map((x) => x.getAttribute("aria-label") ?? (x as HTMLInputElement).labels?.[0]?.innerText ?? x.getAttribute("name"))));
  const sub = d.getByRole("button", { name: /^(Register|Confirm|Get ticket)/ }).last();
  say("T094 submit empty:", T(await timedClick(p, sub, "register without answers")), await dialogText(p, 500));
  for (let i = 0; i < await tas.count(); i++) await tas.nth(i).fill(i === 0 ? "A little, for coursework" : "Windows");
  say("T094 submit:", T(await timedClick(p, sub, "register", { timeout: 30_000 })), await toastText(p));
  await ready(p, 800); say("T094 after:", new URL(p.url()).pathname, await mainText(p, 900));
  const tk = p.getByRole("link", { name: /ticket/i }).first(); if (await tk.isVisible().catch(() => false)) { await tk.click(); await ready(p, 700); }
  else await p.goto(`/events/${ticketEvent}/ticket`), await ready(p, 700);
  say("T094 ticket:", await mainText(p, 900));
  await shot(p, "T094");
  await timedGoto(p, "/me/tickets"); await ready(p, 500); say("T094 my tickets:", await mainText(p, 500));
}

if (run("T095")) {
  setTask("T095");
  await timedGoto(p, "/events/" + ev.hackathon); await ready(p, 600);
  say("T095 hack:", (await mainText(p, 900)));
  say("T095 register:", T(await timedClick(p, btn(/^Register/), "open hackathon register")), await dialogText(p, 900));
  await shot(p, "T095");
  const d = dlg();
  const create = d.getByText(/Create a team|Start a team/).first(); if (await create.isVisible().catch(() => false)) await create.click();
  const name = d.locator("input[type=text]").first(); if (await name.isVisible().catch(() => false)) await name.fill("Null Pointers");
  say("T095 create team:", T(await timedClick(p, d.getByRole("button", { name: /^(Register|Create|Confirm)/ }).last(), "register with new team", { timeout: 30_000 })), await toastText(p), await dialogText(p, 300));
  await ready(p, 800);
  const page_ = await mainText(p, 2000); say("T095 after:", page_.slice(0, 900));
  const code = /\b([A-Z0-9]{5,8})\b/.exec(page_.split("code")[1] ?? "")?.[1];
  const [team] = await sql`select t.id, t.code from public.event_teams t where t.event_id = ${ev.hackathon} order by t.created_at desc limit 1`.catch((e) => [{ err: e.message }] as any);
  say("T095 team:", JSON.stringify(team), "| code on page:", code);
  for (const who of ["helperA", "helperB"]) {
    const h = await page(await context(b, { device: "phone", throttle: false }));
    await signIn(h, acc[who]); await h.goto("/events/" + ev.hackathon); await ready(h, 500);
    await h.getByRole("button", { name: /^Register/ }).first().click(); await h.waitForTimeout(800);
    const hd = h.locator('[role="dialog"]').last();
    await hd.getByText(/Join a team|Have a code/).first().click().catch(() => undefined);
    await hd.locator("input[type=text]").first().fill(String(team?.code ?? code ?? ""));
    await hd.getByRole("button", { name: /^(Register|Join|Confirm)/ }).last().click(); await h.waitForTimeout(1800);
    say(`T095 ${who} joined:`, (await hd.innerText().catch(() => "")).replace(/\n+/g, " | ").slice(0, 200), "|", (await mainText(h, 300)));
  }
  await p.reload(); await ready(p, 600); say("T095 team now:", (await mainText(p, 2000)).split(" | ").filter((l) => /team|member|Null|Ali|Bushra/i.test(l)).slice(0, 8));
}

if (run("T096")) {
  setTask("T096");
  await asUser(acc.officer1.id, `select public.cancel_society_event($1, $2)`, [ev.closed, "The speaker can't travel this week."]).catch((e: any) => say("cancel:", e.message));
  for (const [k, label] of [["full", "full"], ["otherBatch", "other batch"], ["notOpen", "not open"], ["closed", "cancelled"]] as const) {
    await timedGoto(p, "/events/" + ev[k]); await ready(p, 600);
    say(`T096 ${label}:`, (await mainText(p, 1000)).slice(0, 600), "| buttons:", await p.locator("main").getByRole("button").allInnerTexts());
    if (k === "full") { const w = btn(/waitlist/i); if (await w.isVisible().catch(() => false)) { say("T096 waitlist:", T(await timedClick(p, w, "join waitlist")), await dialogText(p, 400)); const c = dlg().getByRole("button", { name: /waitlist|Join|Register/i }).last(); if (await c.isVisible().catch(() => false)) say("T096 waitlist confirm:", T(await timedClick(p, c, "confirm waitlist"))); await p.waitForTimeout(800); say("T096 after waitlist:", (await mainText(p, 1000)).split(" | ").filter((l) => /waitlist|position|#/i.test(l))); } }
    if (k !== "full") await shot(p, "T096");
  }
}

if (run("T097")) {
  setTask("T097");
  // The event day: move the workshop to start in an hour (check-in opens 2 h before), the officer scans the ticket.
  await sql`update public.event_sessions set starts_at = now() + interval '1 hour', ends_at = now() + interval '3 hours' where event_id = ${ticketEvent}`;
  await sql`update public.events set starts_at = now() + interval '1 hour', ends_at = now() + interval '3 hours' where id = ${ticketEvent}`;
  await timedGoto(p, `/events/${ticketEvent}/ticket`); await ready(p, 600);
  say("T097 ticket on the day:", await mainText(p, 800));
  await shot(p, "T097");
  const t = await asUser(acc.tester.id, `select public.event_ticket($1)`, [ticketEvent]) as any;
  const r = await asUser(acc.officer1.id, `select public.check_in_scan($1, null, $2)`, [ticketEvent, t.payload]) as any;
  say("T097 officer scan:", JSON.stringify(r).slice(0, 200));
  await p.reload(); await ready(p, 600); say("T097 ticket after check-in:", await mainText(p, 500));
  await sql`update public.event_sessions set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour' where event_id = ${ticketEvent}`;
  await sql`update public.events set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour', status = 'ended' where id = ${ticketEvent}`;
  await timedGoto(p, "/events/" + ticketEvent); await ready(p, 600);
  say("T097 after event:", await mainText(p, 900));
  const rating = p.getByRole("radio").nth(3); if (await rating.isVisible().catch(() => false)) await rating.click({ force: true });
  const fb = p.locator("main textarea").first(); if (await fb.isVisible().catch(() => false)) await fb.fill("Good pace, more practice time please.");
  const send = btn(/Send feedback|Send/); if (await send.isVisible().catch(() => false)) say("T097 feedback:", T(await timedClick(p, send, "send event feedback")), await toastText(p));
  await p.waitForTimeout(800); say("T097 after feedback:", (await mainText(p, 900)).slice(-300));
  await shot(p, "T097");
  await timedGoto(p, "/notifications"); await ready(p, 500); say("T097 reminders in bell:", (await mainText(p, 900)).split(" | ").filter((l) => /remind|tomorrow|starts|Intro to Git/i.test(l)).slice(0, 4));
}

if (run("T098")) {
  setTask("T098");
  await timedGoto(p, "/events/" + ev.hackathon); await ready(p, 600);
  const c = btn(/Cancel (my )?registration|Can't go|Cancel/);
  say("T098 cancel:", T(await timedClick(p, c, "cancel registration")), await dialogText(p, 500));
  const k = dlg().getByRole("button", { name: /Cancel registration|Yes|Confirm/ }).last(); if (await k.isVisible().catch(() => false)) say("T098 confirm:", T(await timedClick(p, k, "confirm cancel")));
  await p.waitForTimeout(1000); say("T098 after:", await mainText(p, 600), await toastText(p));
  await shot(p, "T098");
}

let payEvent = ev.paid;
if (run("T099")) {
  setTask("T099");
  await timedGoto(p, "/events/" + payEvent); await ready(p, 600);
  say("T099 paid event:", await mainText(p, 700));
  say("T099 register:", T(await timedClick(p, btn(/^(Register|Buy|Get ticket)/), "open paid register")), await dialogText(p, 700));
  await dlg().getByRole("button", { name: /^(Register|Buy|Reserve|Confirm)/ }).last().click().catch(() => undefined); await p.waitForTimeout(1500); await ready(p, 600);
  await p.goto(`/events/${payEvent}/ticket`); await ready(p, 700);
  say("T099 payment panel:", await mainText(p, 1500));
  await shot(p, "T099");
  const rcpt = "/tmp/claude-0/uxp/receipt-wrong.png";
  await sharp({ create: { width: 900, height: 1400, channels: 3, background: "#fafafa" } }).composite([{ input: Buffer.from('<svg width="900" height="1400"><text x="80" y="200" font-size="60">Screenshot of my lunch</text></svg>') }]).png().toFile(rcpt);
  const fi = p.locator('input[type="file"]').first();
  await fi.setInputFiles(rcpt);
  const tx = p.locator('input[name*="transaction"], input[placeholder*="ransaction"]').first(); if (await tx.isVisible().catch(() => false)) await tx.fill("JC123456789");
  say("T099 upload:", T(await timedClick(p, btn(/Upload|Send|Submit/), "upload receipt", { timeout: 60_000 })), await toastText(p));
  await p.waitForTimeout(1500); say("T099 after upload:", await mainText(p, 900));
}

if (run("T100")) {
  setTask("T100");
  const [pay] = await sql`select ep.id from public.event_payments ep join public.event_registrations r on r.id = ep.registration_id where r.event_id = ${payEvent} and r.user_id = ${acc.tester.id} order by ep.created_at desc limit 1`.catch((e) => (say("pay q:", e.message), [] as any));
  if (pay) say("T100 officer reject:", await asUser(acc.officer2.id, `select public.review_payment($1, false, $2)`, [pay.id, "This image isn't a JazzCash receipt. Upload the confirmation screen showing PKR 100 to UX Pilot Developers Club."]).catch((e: any) => "err " + e.message));
  await timedGoto(p, `/events/${payEvent}/ticket`); await ready(p, 700);
  say("T100 rejected view:", await mainText(p, 1200));
  await shot(p, "T100");
  const good = "/tmp/claude-0/uxp/receipt-good.png";
  await sharp({ create: { width: 900, height: 1400, channels: 3, background: "#f4f4f4" } }).composite([{ input: Buffer.from('<svg width="900" height="1400"><text x="80" y="200" font-size="54">JazzCash · PKR 100 sent</text><text x="80" y="300" font-size="40">To: UX Pilot Developers Club 03001234567</text><text x="80" y="380" font-size="40">TID 88812345</text></svg>') }]).png().toFile(good);
  await p.locator('input[type="file"]').first().setInputFiles(good);
  const tx = p.locator('input[name*="transaction"], input[placeholder*="ransaction"]').first(); if (await tx.isVisible().catch(() => false)) await tx.fill("88812345");
  say("T100 reupload:", T(await timedClick(p, btn(/Upload|Send|Submit/), "upload second receipt", { timeout: 60_000 })), await toastText(p));
  const [pay2] = await sql`select ep.id, ep.status::text from public.event_payments ep join public.event_registrations r on r.id = ep.registration_id where r.event_id = ${payEvent} and r.user_id = ${acc.tester.id} order by ep.created_at desc limit 1`.catch(() => [] as any);
  if (pay2) say("T100 officer approve:", await asUser(acc.officer2.id, `select public.review_payment($1, true, null)`, [pay2.id]).catch((e: any) => "err " + e.message));
  await p.reload(); await ready(p, 700); say("T100 approved view:", await mainText(p, 900));
  const cancel = btn(/Cancel|Can't go|refund/i);
  say("T100 cancel:", T(await timedClick(p, cancel, "cancel paid registration")), await dialogText(p, 600));
  const k = dlg().getByRole("button", { name: /Cancel|Confirm|Yes/ }).last(); if (await k.isVisible().catch(() => false)) say("T100 confirm:", T(await timedClick(p, k, "confirm cancel paid")));
  await p.waitForTimeout(1000); say("T100 after cancel:", await mainText(p, 900));
  const [pay3] = await sql`select ep.id, ep.status::text from public.event_payments ep join public.event_registrations r on r.id = ep.registration_id where r.event_id = ${payEvent} and r.user_id = ${acc.tester.id} order by ep.created_at desc limit 1`.catch(() => [] as any);
  say("T100 payment state:", JSON.stringify(pay3));
  if (pay3) say("T100 officer refund sent:", await asUser(acc.officer2.id, `select public.mark_refund_sent($1, $2)`, [pay3.id, "Sent back to 03001234567 by JazzCash."]).catch((e: any) => "err " + e.message));
  await p.reload(); await ready(p, 700); say("T100 refund view:", await mainText(p, 900));
  await shot(p, "T100");
}
await b.close(); await sql.end();
