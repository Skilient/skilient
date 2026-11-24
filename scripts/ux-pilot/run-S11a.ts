/** S11 part a (officer-1, Developers Club): create an event (T110), tickets/co-host/duplicate (T111), payments (T112), approvals/staff/notice (T113), cancel (T114). */
import { launch, context, page, ready, signIn, accounts } from "./lib/browser.ts";
import { timedClick, setTask, timedGoto } from "./lib/timed.ts";
import { shot } from "./lib/shot.ts";
import { sql, asUser, mainText, dialogText, toastText } from "./lib/act.ts";
import sharp from "sharp";
const say = (...x: unknown[]) => console.log(...x);
const A = accounts(); const ids = A.ids; const acc = A.accounts; const ev = ids.events; const S = ids.societies;
const ONLY = process.env.ONLY?.split(","); const run = (id: string) => !ONLY || ONLY.includes(id);
const T = (t: any) => `${t.kind} pending=${t.pendingMs} result=${t.resultMs} "${String(t.shown).replace(/\n/g, " ").slice(0, 160)}"`;
const b = await launch();
const mk = async (device: "phone" | "desktop", who = "officer1", throttle?: boolean) => { const q = await page(await context(b, { device, throttle })); q.on("dialog", async (d) => { say("   native dialog:", d.message()); await d.accept(); }); await signIn(q, acc[who]); await ready(q, 500); return q; };
const M = (q: any) => q.locator("main");
const loc = (d: number, h: number) => { const x = new Date(Date.now() + d * 86400_000); return `${x.toISOString().slice(0, 10)}T${String(h).padStart(2, "0")}:00`; };
const TITLE = "[UX test] React in two evenings";
const evId = async (title: string) => (await sql`select id from public.events where title = ${title} order by created_at desc limit 1`)[0]?.id as string | undefined;

if (run("T110")) {
  setTask("T110");
  const p = await mk("desktop");
  const t0 = Date.now(); let clicks = 0;
  await timedGoto(p, `/societies/${S.open.slug}/events/new`); await ready(p, 600);
  await M(p).getByLabel("Type").selectOption({ label: "Workshop" }); await M(p).getByLabel("Title").fill(TITLE); await M(p).getByLabel("Description").fill("Two sessions: components, then state and data. Bring a laptop."); clicks += 3;
  const next = async (label: string) => { const t = await timedClick(p, M(p).getByRole("button", { name: "Continue" }), label); clicks++; await p.waitForTimeout(400); return t; };
  await next("event step basics");
  await M(p).getByLabel("Place", { exact: true }).fill("CS Lab 2");
  await M(p).getByLabel("Starts", { exact: true }).first().fill(loc(10, 16)); await M(p).getByLabel("Ends", { exact: true }).first().fill(loc(10, 18));
  await M(p).getByRole("button", { name: "Add a session" }).click();
  await M(p).getByLabel("Starts", { exact: true }).nth(1).fill(loc(11, 16)); await M(p).getByLabel("Ends", { exact: true }).nth(1).fill(loc(11, 18)); clicks += 6;
  await next("event step when");
  await M(p).getByLabel("Ticket type 1").fill("Participant"); await M(p).getByLabel("Seats").first().fill("40"); clicks += 2;
  await next("event step tickets");
  await M(p).getByLabel("Only some departments or batches").check({ force: true }); await p.waitForTimeout(500); clicks++;
  say("T110 who fields:", await M(p).locator("input, select").evaluateAll((e) => e.map((x) => `${(x as HTMLInputElement).type}:${(x as HTMLInputElement).labels?.[0]?.innerText?.replace(/\n/g, " ") ?? x.getAttribute("aria-label")}`).join(" ; ")));
  const dept = M(p).getByRole("textbox", { name: "Departments" });
  say("T110 departments placeholder:", await dept.getAttribute("placeholder"), "| hint:", (await mainText(p, 3000)).split(" | ").filter((l) => /comma|department/i.test(l)).slice(0, 3));
  await dept.fill("Computer Science"); clicks++;
  await next("event step who");
  await M(p).getByRole("button", { name: "Add a question" }).click(); clicks++;
  say("T110 form fields:", await M(p).locator("input, select, textarea").evaluateAll((e) => e.map((x) => `${(x as HTMLInputElement).type}:${(x as HTMLInputElement).labels?.[0]?.innerText?.replace(/\n/g, " ") ?? x.getAttribute("aria-label")}`).join(" ; ")));
  await M(p).getByRole("textbox", { name: "Question 1" }).fill("Which React version have you used?"); clicks++;
  await next("event step form");
  await M(p).getByRole("button", { name: /^Completed/ }).click().catch(() => M(p).getByRole("checkbox").nth(1).check({ force: true })); clicks++; await p.waitForTimeout(400);
  say("T110 record step:", (await mainText(p, 2500)).split("Record | ")[1]?.slice(0, 600));
  const min = M(p).locator("input[type=number]").first(); say("T110 record inputs:", await M(p).locator("input").evaluateAll((e) => e.map((x) => `${(x as HTMLInputElement).type}:${(x as HTMLInputElement).labels?.[0]?.innerText?.replace(/\n/g, " ")}`).join(" ; "))); if (await min.isVisible().catch(() => false)) { await min.fill("2"); clicks++; }
  await shot(p, "T110");
  await next("event step record");
  say("T110 review:", (await mainText(p, 2500)).split("Last step | ")[1]?.slice(0, 700));
  say("T110 save draft:", T(await timedClick(p, M(p).getByRole("button", { name: "Save draft" }), "save event draft", { timeout: 30_000 })), await toastText(p)); clicks++;
  await ready(p, 600); say("T110 after draft:", new URL(p.url()).pathname, (await mainText(p, 600)));
  const pub = M(p).getByRole("button", { name: /^Publish/ }).first();
  if (await pub.isVisible().catch(() => false)) { say("T110 publish:", T(await timedClick(p, pub, "publish event")), await dialogText(p, 300), await toastText(p)); clicks++; const c = p.locator('[role="dialog"], [role="alertdialog"]').getByRole("button", { name: /Publish/ }).last(); if (await c.isVisible().catch(() => false)) await c.click(); }
  await p.waitForTimeout(1000);
  const id = await evId(TITLE);
  const [e] = id ? await sql`select status::text, eligibility, completed_min, record_kinds from public.events where id = ${id}` : [{}];
  say("T110 stored:", JSON.stringify(e), "| ms", Date.now() - t0, "clicks", clicks);
  await shot(p, "T110");
  await p.context().close();
}

if (run("T111")) {
  setTask("T111");
  const p = await mk("desktop");
  const id = await evId(TITLE);
  await timedGoto(p, `/events/${id}/manage`); await ready(p, 600);
  say("T111 edit:", T(await timedClick(p, M(p).getByRole("link", { name: "Edit" }).or(M(p).getByRole("button", { name: "Edit" })).first(), "edit event")));
  await ready(p, 600);
  for (let i = 0; i < 2; i++) await M(p).getByRole("button", { name: "Continue" }).click().then(() => p.waitForTimeout(400));
  say("T111 tickets step:", (await mainText(p, 2500)).split("Tickets | ").slice(-1)[0]?.slice(0, 400));
  await M(p).getByLabel("Ticket type 1").fill("Participant");
  const paidSw = M(p).getByRole("switch", { name: "Paid" }).or(M(p).getByRole("checkbox", { name: "Paid" })).first();
  say("T111 paid control:", await paidSw.evaluate((e) => `${e.tagName} role=${e.getAttribute("role")} checked=${e.getAttribute("aria-checked")}`).catch(() => "not found"));
  await paidSw.click().catch((e) => say("paid:", e.message.split("\n")[0])); await p.waitForTimeout(400);
  await M(p).getByLabel("Price (PKR)").first().fill("200").catch((e) => say("price:", e.message.split("\n")[0]));
  await M(p).getByRole("button", { name: "Add a ticket type" }).click(); await p.waitForTimeout(300);
  await M(p).getByRole("textbox", { name: "Ticket type 2" }).fill("Audience"); await M(p).getByLabel("Seats").nth(1).fill("30");
  say("T111 refund text:", (await mainText(p, 3000)).split(" | ").filter((l) => /refund|money|Skilient doesn|handle/i.test(l)).slice(0, 6));
  say("T111 refund controls:", await M(p).locator("input, select").evaluateAll((e) => e.map((x) => `${(x as HTMLInputElement).type}:${(x as HTMLInputElement).labels?.[0]?.innerText?.replace(/\n/g, " ") ?? ""}`).filter((s) => /refund|day/i.test(s)).join(" ; ")));
  const until = M(p).getByLabel(/Refunds until|until/i).first(); if (await until.isVisible().catch(() => false)) await until.check({ force: true }).catch(() => undefined);
  const days = M(p).getByLabel(/days/i).first(); if (await days.isVisible().catch(() => false)) await days.fill("2").catch(() => undefined);
  await shot(p, "T111");
  for (let i = 0; i < 3; i++) { await M(p).getByRole("button", { name: "Continue" }).click(); await p.waitForTimeout(400); }
  await M(p).getByLabel(/Co-hosting societies/).fill("UX Pilot Debating"); await p.waitForTimeout(800);
  say("T111 cohost suggestions:", await p.getByRole("option").allInnerTexts().catch(() => []), await M(p).getByRole("button", { name: /Debating/ }).allInnerTexts());
  await M(p).getByRole("button", { name: /Debating/ }).first().click().catch(() => undefined);
  await M(p).getByRole("button", { name: "Continue" }).click(); await p.waitForTimeout(400);
  say("T111 review:", (await mainText(p, 2500)).split("Last step | ")[1]?.slice(0, 600));
  const save = M(p).getByRole("button", { name: /^Save/ }).last();
  say("T111 save:", T(await timedClick(p, save, "save event edits", { timeout: 30_000 })), await toastText(p), await dialogText(p, 300));
  await ready(p, 600); say("T111 after save:", (await mainText(p, 800)));
  const tix = id ? await sql`select name, capacity, price_pkr from public.event_ticket_types where event_id = ${id} order by position` : [];
  const [rp] = id ? await sql`select refund_policy, refund_days from public.events where id = ${id}` : [{}];
  say("T111 stored tickets:", JSON.stringify(tix), JSON.stringify(rp), JSON.stringify(await sql`select count(*)::int from public.event_cohosts where event_id = ${id ?? null}`.catch(() => [])));
  // Duplicate a past event.
  await timedGoto(p, `/events/${ev.closeout}/manage`); await ready(p, 600);
  say("T111 duplicate:", T(await timedClick(p, M(p).getByRole("link", { name: "Duplicate" }).or(M(p).getByRole("button", { name: "Duplicate" })).first(), "duplicate past event")));
  await ready(p, 600);
  say("T111 duplicate form:", new URL(p.url()).pathname + new URL(p.url()).search, "title=", await M(p).getByLabel("Title").inputValue().catch(() => "?"));
  for (let i = 0; i < 6; i++) { const c = M(p).getByRole("button", { name: "Continue" }); if (!(await c.isVisible().catch(() => false))) break; await c.click(); await p.waitForTimeout(400); }
  say("T111 duplicate review:", (await mainText(p, 2500)).split("Last step | ")[1]?.slice(0, 500));
  await shot(p, "T111");
  await p.context().close();
}

if (run("T112")) {
  setTask("T112");
  // Five register for the paid workshop; two pay, one of them uploads the same receipt as the other.
  const [tt] = await sql`select id from public.event_ticket_types where event_id = ${ev.paid}`;
  if (!process.env.NO_SETUP) for (const k of ["helperA", "helperB", "finalYear", "applicant2", "officer2"]) await asUser(acc[k].id, `select public.register_event($1, $2::text::jsonb)`, [ev.paid, JSON.stringify({ ticket_type_id: tt.id })]).catch((e: any) => say("reg", k, e.message.slice(0, 60)));
  const rcpt = "/tmp/claude-0/uxp/receipt-shared.png";
  await sharp({ create: { width: 900, height: 1400, channels: 3, background: "#f4f4f4" } }).composite([{ input: Buffer.from('<svg width="900" height="1400"><text x="80" y="200" font-size="54">JazzCash · PKR 100 sent</text><text x="80" y="300" font-size="40">To: UX Pilot Developers Club</text><text x="80" y="380" font-size="40">TID 77712345 · Ref SKL</text></svg>') }]).png().toFile(rcpt);
  for (const k of process.env.NO_SETUP ? [] : ["helperB", "finalYear"]) {
    const h = await mk("phone", k, false);
    await h.goto(`/events/${ev.paid}/ticket`); await ready(h, 500);
    const fi = h.locator('input[type="file"]').first();
    if (await fi.count()) { await fi.setInputFiles(rcpt); await h.getByLabel(/Transaction ID/).fill("77712345").catch(() => undefined); await h.getByRole("button", { name: /Upload receipt/ }).click(); await h.waitForTimeout(2000); }
    say(`T112 ${k} after upload:`, (await mainText(h, 3000)).split("Payment | ")[1]?.slice(0, 200));
    await h.context().close();
  }
  const p = await mk("phone");
  await timedGoto(p, `/events/${ev.paid}/manage?tab=payments`); await ready(p, 700);
  say("T112 payments tab:", await mainText(p, 2000));
  await shot(p, "T112");
  const appr = M(p).getByRole("button", { name: /^Approve/ });
  say("T112 approve buttons:", await appr.count(), "| reject:", await M(p).getByRole("button", { name: /^Reject/ }).count());
  if (await appr.count()) { say("T112 approve first:", T(await timedClick(p, appr.first(), "approve payment")), await toastText(p)); await p.waitForTimeout(1000); }
  const rej = M(p).getByRole("button", { name: /^Reject/ }).first();
  if (await rej.isVisible().catch(() => false)) { await M(p).getByLabel("Reason to reject").first().fill("This receipt has the same transaction ID as another student's. Upload your own JazzCash confirmation."); say("T112 reject:", T(await timedClick(p, rej, "reject duplicate receipt")), await toastText(p)); }
  await p.waitForTimeout(1200); say("T112 after:", await mainText(p, 1500));
  await shot(p, "T112");
  await p.context().close();
}

const MANUAL = "[UX test] Manual approval meetup";
if (run("T113")) {
  setTask("T113");
  let id = await evId(MANUAL);
  if (!id) {
    id = await asUser(acc.officer1.id, `select public.save_society_event($1, $2::text::jsonb)`, [S.open.id, JSON.stringify({ type: "social", title: MANUAL, description: "Meet the club.", location: "Cafeteria", sessions: [{ starts_at: new Date(Date.now() + 6 * 86400_000).toISOString(), ends_at: new Date(Date.now() + 6 * 86400_000 + 7200_000).toISOString() }], ticket_types: [{ name: "Seat", capacity: 10 }], eligibility: { scope: "university" }, approval_mode: "manual", record_kinds: ["attended"] })]);
    await asUser(acc.officer1.id, `select public.publish_event($1)`, [id]);
    const [tt] = await sql`select id from public.event_ticket_types where event_id = ${id}`;
    for (const k of ["helperA", "helperB", "tester"]) await asUser(acc[k].id, `select public.register_event($1, $2::text::jsonb)`, [id, JSON.stringify({ ticket_type_id: tt.id })]).catch((e: any) => say("reg", e.message));
  }
  const p = await mk("phone");
  await timedGoto(p, `/events/${id}/manage`); await ready(p, 700);
  say("T113 registrations:", await mainText(p, 1500));
  const ap = M(p).getByRole("button", { name: /^Approve/ }).first();
  if (await ap.isVisible().catch(() => false)) { say("T113 approve:", T(await timedClick(p, ap, "approve registration")), await toastText(p)); await p.waitForTimeout(800); }
  await M(p).getByRole("link", { name: "Staff" }).or(M(p).getByRole("tab", { name: "Staff" })).first().click(); await ready(p, 500);
  say("T113 staff tab:", (await mainText(p, 2000)).split("Feedback | ").slice(-1)[0]?.slice(0, 400));
  const u = M(p).getByPlaceholder(/username/i).first(); if (await u.isVisible().catch(() => false)) { await u.fill("uxp_helper_d"); say("T113 add staff:", T(await timedClick(p, M(p).getByRole("button", { name: /Add/ }).first(), "add check-in staff")), await toastText(p)); }
  await M(p).getByRole("link", { name: "Messages" }).or(M(p).getByRole("tab", { name: "Messages" })).first().click(); await ready(p, 500);
  say("T113 messages tab:", (await mainText(p, 2000)).split("Feedback | ").slice(-1)[0]?.slice(0, 500));
  const ta = M(p).locator("textarea").first(); if (await ta.isVisible().catch(() => false)) { await ta.fill("Venue change: we've moved to CS Lab 1, same time."); say("T113 send notice:", T(await timedClick(p, M(p).getByRole("button", { name: /Send/ }).first(), "send change notice")), await toastText(p), await dialogText(p, 300)); }
  await shot(p, "T113");
  // Lower capacity below registrations.
  await timedGoto(p, `/events/${id}/manage`); await ready(p, 500);
  await M(p).getByRole("link", { name: "Edit" }).first().click(); await ready(p, 500);
  for (let i = 0; i < 2; i++) { await M(p).getByRole("button", { name: "Continue" }).click(); await p.waitForTimeout(400); }
  await M(p).getByLabel("Seats").first().fill("1");
  for (let i = 0; i < 4; i++) { const c = M(p).getByRole("button", { name: "Continue" }); if (!(await c.isVisible().catch(() => false))) break; await c.click(); await p.waitForTimeout(400); }
  say("T113 save lower cap:", T(await timedClick(p, M(p).getByRole("button", { name: /^Save/ }).last(), "save lower capacity", { timeout: 30_000 })), await toastText(p), (await mainText(p, 2000)).split(" | ").filter((l) => /seat|capacity|registered|below|given/i.test(l)).slice(0, 4));
  const tester = await mk("phone", "tester", false);
  await tester.goto("/notifications"); await ready(tester, 500);
  say("T113 attendee bell:", (await mainText(tester, 2000)).split(" | ").filter((l) => /venue|moved|Manual|Lab 1/i.test(l)).slice(0, 3));
  await tester.context().close(); await p.context().close();
}

if (run("T114")) {
  setTask("T114");
  const p = await mk("phone");
  await timedGoto(p, `/events/${ev.paid}/manage`); await ready(p, 700);
  const cancel = M(p).getByRole("button", { name: /Cancel (the )?event/ }).first();
  if (!(await cancel.isVisible().catch(() => false))) { await M(p).getByRole("link", { name: "Edit" }).first().click(); await ready(p, 500); }
  const c2 = p.getByRole("button", { name: /Cancel (the |this )?event/ }).first();
  say("T114 cancel:", T(await timedClick(p, c2, "cancel event")), await dialogText(p, 800));
  await shot(p, "T114");
  const r = p.locator('[role="dialog"] textarea, [role="dialog"] input[type=text]').first(); if (await r.isVisible().catch(() => false)) await r.fill("The trainer is ill; refunds go back by JazzCash this week.");
  const c = p.locator('[role="dialog"], [role="alertdialog"]').getByRole("button", { name: /Cancel event|Cancel the event|Yes/ }).last(); if (await c.isVisible().catch(() => false)) say("T114 confirm:", T(await timedClick(p, c, "confirm cancel event", { timeout: 30_000 })));
  await p.waitForTimeout(1200); say("T114 after:", await mainText(p, 1200));
  await p.context().close();
}
await b.close(); await sql.end();
