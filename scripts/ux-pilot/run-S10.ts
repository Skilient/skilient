/** S10: society officer (as officer-2, Iqra): request (T092-T093), set-up (T104-T106), inductions (T108-T109), handover (T107). */
import { launch, context, page, ready, signIn, accounts } from "./lib/browser.ts";
import { timedClick, setTask, timedGoto } from "./lib/timed.ts";
import { shot } from "./lib/shot.ts";
import { sql, asUser, mainText, dialogText, toastText } from "./lib/act.ts";
import sharp from "sharp";
const say = (...x: unknown[]) => console.log(...x);
const A = accounts(); const acc = A.accounts;
const ONLY = process.env.ONLY?.split(","); const run = (id: string) => !ONLY || ONLY.includes(id);
const T = (t: any) => `${t.kind} pending=${t.pendingMs} result=${t.resultMs} "${String(t.shown).replace(/\n/g, " ").slice(0, 160)}"`;
const NAME = "[UX test] Film Society";
const b = await launch();
const p = await page(await context(b, { device: "phone" }));
p.on("dialog", async (d) => { say("   native dialog:", d.message()); await d.accept(); });
await signIn(p, acc.officer2); await ready(p, 800);
const btn = (name: RegExp | string) => p.getByRole("button", { name }).first();
const staff = acc.staff.id;
const soc = async () => (await sql`select id, slug, status::text from public.societies where name = ${NAME}`)[0];
const proof = "/tmp/claude-0/uxp/cert.pdf";

if (run("T092")) {
  setTask("T092");
  await timedGoto(p, "/societies/new"); await ready(p, 600);
  const nameBox = p.locator("main").getByRole("textbox").first();
  await nameBox.fill("UX Pilot Debating Society"); await p.waitForTimeout(1500);
  say("T092 existing name:", (await mainText(p, 900)).split(" | ").filter((l) => /already|exists|taken|Debating/i.test(l)).slice(0, 4));
  await p.locator("main select").first().selectOption({ label: "Arts" });
  say("T092 continue existing:", T(await timedClick(p, btn("Continue"), "continue with existing name")), (await mainText(p, 600)).slice(0, 300));
  await nameBox.fill(NAME); await p.waitForTimeout(1200);
  let clicks = 3; const t0 = Date.now();
  for (let step = 0; step < 6; step++) {
    const head = (await mainText(p, 900));
    say(`T092 step ${step}:`, head.slice(0, 500));
    if (step === 1) await shot(p, "T092");
    const ta = p.locator("main textarea"); for (let i = 0; i < await ta.count(); i++) if (!(await ta.nth(i).inputValue())) await ta.nth(i).fill("We watch and discuss one film every Thursday, and run a short-film workshop each semester.");
    const fi = p.locator('main input[type="file"]'); if (await fi.count()) { await fi.first().setInputFiles(proof); await p.waitForTimeout(1500); clicks++; }
    const url = p.locator('main input[type="url"]'); if (await url.count() && !(await url.first().inputValue())) await url.first().fill("https://nutech.edu.pk/societies/film");
    const cb = p.locator("main").getByRole("checkbox"); for (let i = 0; i < await cb.count(); i++) if ((await cb.nth(i).getAttribute("aria-checked")) !== "true") await cb.nth(i).click();
    const next = p.getByRole("button", { name: /^(Continue|Send request|Submit|Send for review)/ }).last();
    if (!(await next.isVisible().catch(() => false))) break;
    const label = await next.innerText();
    const t = await timedClick(p, next, `request step ${step} ${label}`, { timeout: 40_000 }); clicks++;
    say(`T092 -> ${label}:`, T(t));
    await ready(p, 600);
    if (/Send|Submit/.test(label)) break;
  }
  say("T092 total ms", Date.now() - t0, "clicks", clicks);
  say("T092 after submit:", new URL(p.url()).pathname, await mainText(p, 800));
  await shot(p, "T092");
  await timedGoto(p, "/societies/new"); await ready(p, 500);
  say("T092 second request:", await mainText(p, 400));
}

if (run("T093")) {
  setTask("T093");
  const s = await soc();
  await asUser(staff, `select public.claim_society($1, true)`, [s.id], "aal2").catch(() => undefined);
  await asUser(staff, `select public.decide_society($1, 'more_info', $2)`, [s.id, "Please add the link to your society's page on the NUTECH website, or a letter from your faculty advisor."], "aal2").catch((e: any) => say("more_info:", e.message));
  // Reject officer-1's Chess Club request.
  const [chess] = await sql`select id from public.societies where name = 'UX Pilot Chess Club' and status = 'pending'`;
  if (chess) await asUser(staff, `select public.decide_society($1, 'reject', $2)`, [chess.id, "We couldn't find this society on NUTECH's list. Ask your advisor for a letter and request again."], "aal2").catch((e: any) => say("reject:", e.message));
  await timedGoto(p, "/notifications"); await ready(p, 500);
  say("T093 bell:", (await mainText(p, 900)).split(" | ").filter((l) => /society|Film|information/i.test(l)).slice(0, 3));
  await timedGoto(p, "/societies"); await ready(p, 500);
  say("T093 societies page:", (await mainText(p, 1000)).split(" | ").filter((l) => /Film|request|more|information/i.test(l)).slice(0, 6));
  await timedGoto(p, "/societies/" + s.slug); await ready(p, 600);
  say("T093 request page:", await mainText(p, 1200), "| buttons:", await p.locator("main").getByRole("button").allInnerTexts());
  await shot(p, "T093");
  const ta = p.locator("main textarea").first(); if (await ta.isVisible().catch(() => false)) await ta.fill("We watch and discuss one film every Thursday. Page: https://nutech.edu.pk/societies/film");
  const url = p.locator('main input[type="url"]').first(); if (await url.isVisible().catch(() => false)) await url.fill("https://nutech.edu.pk/societies/film-society");
  const re = btn(/Resubmit|Send again|Send/);
  if (await re.isVisible().catch(() => false)) say("T093 resubmit:", T(await timedClick(p, re, "resubmit society", { timeout: 30_000 })), await toastText(p));
  await p.waitForTimeout(1000); say("T093 after resubmit:", await mainText(p, 500));
  await asUser(staff, `select public.decide_society($1, 'approve', null)`, [s.id], "aal2").catch((e: any) => say("approve:", e.message));
  await p.reload(); await ready(p, 600);
  say("T093 approved page:", await mainText(p, 1000));
  await shot(p, "T093");
  const o1 = await page(await context(b, { device: "phone", throttle: false }));
  await signIn(o1, acc.officer1); await o1.goto("/societies/ux-pilot-chess-club"); await ready(o1, 500);
  say("T093 rejected (officer-1):", await mainText(o1, 700));
  await o1.context().close();
}

if (run("T104")) {
  setTask("T104");
  const s = await soc();
  await timedGoto(p, `/societies/${s.slug}/manage`); await ready(p, 600);
  const logo = "/tmp/claude-0/uxp/logo.png";
  await sharp({ create: { width: 600, height: 600, channels: 3, background: "#2a2a2a" } }).composite([{ input: Buffer.from('<svg width="600" height="600"><circle cx="300" cy="300" r="200" fill="#e85d2a"/></svg>') }]).png().toFile(logo);
  await p.locator('input[name="logo"]').setInputFiles(logo);
  say("T104 upload:", T(await timedClick(p, btn("Upload images"), "upload logo", { timeout: 40_000 })), await toastText(p));
  await p.locator("main select").nth(1).selectOption({ index: 1 }).catch(() => undefined);
  say("T104 membership options text:", (await mainText(p, 5000)).split("How members join | ")[1]?.slice(0, 300));
  const saveM = p.locator("main form").filter({ has: p.locator("select") }).nth(1).getByRole("button", { name: "Save" });
  if (await saveM.isVisible().catch(() => false)) say("T104 membership save:", T(await timedClick(p, saveM, "save membership")), await toastText(p));
  await p.getByPlaceholder("@username").first().fill("uxp_helper_a");
  await p.getByPlaceholder("General Secretary").fill("General Secretary");
  say("T104 term fields:", await p.locator('input[type="date"]').evaluateAll((e) => e.map((x) => `${x.getAttribute("name")}=${(x as HTMLInputElement).value}`)));
  await p.locator('input[name="termStart"]').fill("2026-09-01"); await p.locator('input[name="termEnd"]').fill("2027-06-30");
  say("T104 invite:", T(await timedClick(p, btn("Send invitation"), "invite co-officer")), await toastText(p));
  const [inv] = await sql`select id from public.society_invites where society_id = ${s.id} and invitee_id = ${acc.helperA.id} and status::text = 'pending' order by created_at desc limit 1`;
  if (inv) await asUser(acc.helperA.id, `select public.answer_society_invite($1, true)`, [inv.id]);
  // A join request from helper B.
  await asUser(acc.helperB.id, `select public.join_society($1)`, [s.id]).catch((e: any) => say("join:", e.message));
  await p.reload(); await ready(p, 600);
  say("T104 manage now:", (await mainText(p, 6000)).split("Officers and members | ")[1]?.slice(0, 500));
  const accept = p.getByRole("button", { name: /Accept/ }).first();
  if (await accept.isVisible().catch(() => false)) say("T104 accept join:", T(await timedClick(p, accept, "accept join request")), await toastText(p));
  await timedGoto(p, "/societies/" + s.slug); await ready(p, 600);
  say("T104 society page:", await mainText(p, 900));
  await shot(p, "T104");
}

if (run("T105")) {
  setTask("T105");
  const s = await soc();
  await timedGoto(p, "/feed"); await ready(p, 600);
  say("T105 composer:", (await mainText(p, 1200)).split(" | ").slice(0, 25).join(" | "));
  const asSel = p.locator("form select").first();
  if (await asSel.isVisible().catch(() => false)) { say("T105 post-as options:", await asSel.locator("option").allInnerTexts()); await asSel.selectOption({ label: NAME }).catch((e) => say("sel:", e.message)); }
  await p.locator("form textarea").first().fill("Film night this Thursday: Spirited Away, Room 12, 6pm. Everyone welcome.");
  say("T105 post:", T(await timedClick(p, p.locator('button[type="submit"]').first(), "post as society", { timeout: 40_000 })), await toastText(p));
  await p.getByText("Posted.").first().waitFor({ timeout: 30_000 }).catch(() => undefined);
  const [post] = await sql`select society_id is not null as as_society from public.posts where body like 'Film night this Thursday%' order by created_at desc limit 1`;
  say("T105 stored as society:", post?.as_society, "| feed top:", (await mainText(p, 2500)).split("Shipped | ")[1]?.slice(0, 200));
  await shot(p, "T105");
}

if (run("T106")) {
  setTask("T106");
  const s = await soc();
  await timedGoto(p, `/societies/${s.slug}/manage/payments`); await ready(p, 600);
  say("T106 payments page:", await mainText(p, 1200));
  const kind = p.locator("main select").first(); if (await kind.isVisible().catch(() => false)) await kind.selectOption({ label: "JazzCash" }).catch(() => kind.selectOption({ index: 1 }));
  await p.getByLabel("Account title").fill("Film Society NUTECH");
  await p.getByLabel(/Account number/).fill("03111234567");
  say("T106 propose:", T(await timedClick(p, btn("Propose this account"), "propose payment account")), await toastText(p));
  await p.waitForTimeout(800); say("T106 while waiting:", await mainText(p, 900));
  await shot(p, "T106");
  const co = await page(await context(b, { device: "phone", throttle: false }));
  await signIn(co, acc.helperA); await co.goto(`/societies/${s.slug}/manage/payments`); await ready(co, 600);
  say("T106 co-officer sees:", await mainText(co, 900));
  const conf = co.getByTestId("confirm-method").or(co.getByRole("button", { name: /Confirm/ })).first();
  if (await conf.isVisible().catch(() => false)) { await conf.click(); await co.waitForTimeout(1500); say("T106 co-officer after confirm:", await mainText(co, 600)); }
  await co.context().close();
  await p.reload(); await ready(p, 600); say("T106 live:", await mainText(p, 800));
}

if (run("T108")) {
  setTask("T108");
  const s = await soc();
  await timedGoto(p, `/societies/${s.slug}/inductions/new`); await ready(p, 600);
  say("T108 form:", await mainText(p, 1500));
  await shot(p, "T108");
  await p.getByLabel("Round title").fill("Spring crew: designers and a writer");
  await p.getByLabel(/What applicants should know/).fill("Join the team that makes our posters, trailers and reviews.");
  await p.getByRole("textbox", { name: "Role 1", exact: true }).fill("Designer"); await p.getByLabel("Seats").first().fill("2");
  await p.getByRole("button", { name: "Add a role" }).click(); await p.waitForTimeout(300);
  await p.getByRole("textbox", { name: "Role 2", exact: true }).fill("Writer"); await p.getByLabel("Seats").nth(1).fill("1");
  await p.locator("main input[id$=\"-q-0\"]").fill("Show us one thing you made (link).");
  const dl = p.getByLabel("Applications close");
  const iso = (d: Date) => new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 16);
  await dl.fill(iso(new Date(Date.now() + 60 * 86400_000)));
  const pub = p.locator('main button[type="submit"]').last();
  say("T108 submit label:", await pub.innerText());
  say("T108 two months:", T(await timedClick(p, pub, "save round 2 months")), "|", (await mainText(p, 3000)).split(" | ").filter((l) => /days|deadline|close|30|within/i.test(l)).slice(0, 4));
  await dl.fill(iso(new Date(Date.now() + 7 * 86400_000)));
  say("T108 publish:", T(await timedClick(p, pub, "publish round", { timeout: 30_000 })), await toastText(p));
  await ready(p, 600); say("T108 after:", new URL(p.url()).pathname, await mainText(p, 900));
  const pubBtn = p.getByRole("button", { name: /^Publish/ }).first();
  if (await pubBtn.isVisible().catch(() => false)) { say("T108 publish draft:", T(await timedClick(p, pubBtn, "publish round")), await dialogText(p, 400), await toastText(p)); const c = p.locator('[role="dialog"], [role="alertdialog"]').getByRole("button", { name: /Publish/ }).last(); if (await c.isVisible().catch(() => false)) say("T108 confirm:", T(await timedClick(p, c, "confirm publish"))); await p.waitForTimeout(800); say("T108 published:", await mainText(p, 600)); }
  await shot(p, "T108");
}

if (run("T109")) {
  setTask("T109");
  const s = await soc();
  const [round] = await sql`select id from public.induction_rounds where society_id = ${s.id} order by created_at desc limit 1`;
  if (round) {
    const roles = await sql`select id, title from public.induction_roles where round_id = ${round.id} order by position`;
    say("T109 roles:", roles.map((r: any) => r.title));
    if (round) { const st = (await sql`select status::text from public.induction_rounds where id = ${round.id}`)[0].status; if (st !== "open" && st !== "published") await asUser(acc.officer2.id, `select public.publish_induction_round($1)`, [round.id]).catch((e: any) => say("publish:", e.message)); }
    for (const [k, txt] of [["helperB", "I made the Timetable Planner posters."], ["applicant2", "I write film reviews on my blog."], ["finalYear", "I can edit trailers in Premiere."]] as const) {
      await asUser(acc[k].id, `select public.apply_induction($1, $2::text::jsonb)`, [round.id, JSON.stringify({ role_id: roles[0]?.id, answers: [txt] })]).catch((e: any) => say("apply", k, e.message));
    }
    await timedGoto(p, `/societies/${s.slug}/inductions/${round.id}`); await ready(p, 600);
    say("T109 applicants:", await mainText(p, 2000), "| buttons:", await p.locator("main").getByRole("button").allInnerTexts());
    await shot(p, "T109");
    const sl = p.getByRole("button", { name: /Shortlist/ });
    for (let i = 0; i < Math.min(2, await sl.count()); i++) { say("T109 shortlist:", T(await timedClick(p, sl.first(), "shortlist applicant")), await toastText(p)); await p.waitForTimeout(800); }
    const ac = p.getByRole("button", { name: /^Accept/ }).first(); if (await ac.isVisible().catch(() => false)) { say("T109 accept:", T(await timedClick(p, ac, "accept applicant")), await dialogText(p, 400)); }
    await p.waitForTimeout(800);
    const de = p.getByRole("button", { name: /^Decline/ }).first();
    if (await de.isVisible().catch(() => false)) { say("T109 decline:", T(await timedClick(p, de, "decline applicant")), await dialogText(p, 500)); const note = p.locator('[role="dialog"] textarea').first(); if (await note.isVisible().catch(() => false)) { await note.fill("Thank you for applying. We had more designers than seats this term; please try again in autumn."); await p.locator('[role="dialog"]').getByRole("button", { name: /Decline|Send/ }).last().click(); } }
    await p.waitForTimeout(1200); say("T109 after:", await mainText(p, 1500));
    await shot(p, "T109");
  } else say("T109 no round");
}

if (run("T107")) {
  setTask("T107");
  const s = await soc();
  await sql`update public.society_terms set term_end = current_date - 1 where society_id = ${s.id}`.catch((e) => say("term:", e.message));
  await timedGoto(p, `/societies/${s.slug}/manage`); await ready(p, 600);
  say("T107 manage:", (await mainText(p, 6000)).split(" | ").filter((l) => /term|confirm|ended|Hand/i.test(l)).slice(0, 10));
  const conf = p.getByRole("button", { name: /Confirm term|Confirm/ }).first();
  if (await conf.isVisible().catch(() => false)) { say("T107 confirm term:", T(await timedClick(p, conf, "confirm term")), await dialogText(p, 500), await toastText(p)); }
  await p.getByPlaceholder("@username").last().fill("uxp_helper_a");
  say("T107 handover:", T(await timedClick(p, btn("Offer the handover"), "offer handover")), await dialogText(p, 500), await toastText(p));
  const c = p.locator('[role="dialog"], [role="alertdialog"]').getByRole("button", { name: /Offer|Hand/ }).last(); if (await c.isVisible().catch(() => false)) say("T107 confirm handover:", T(await timedClick(p, c, "confirm handover")));
  const [h] = await sql`select id from public.society_invites where society_id = ${s.id} and kind::text = 'handover' and status::text = 'pending' order by created_at desc limit 1`;
  if (h) await asUser(acc.helperA.id, `select public.answer_society_invite($1, true)`, [h.id]).catch((e: any) => say("accept handover:", e.message));
  await p.reload(); await ready(p, 600);
  say("T107 after:", new URL(p.url()).pathname, (await mainText(p, 3000)).slice(0, 600));
  await timedGoto(p, "/me/record"); await ready(p, 500);
  say("T107 my record:", (await mainText(p, 2000)).split(" | ").filter((l) => /Office|President|term|Film/i.test(l)).slice(0, 5));
  await shot(p, "T107");
}
await b.close(); await sql.end();
