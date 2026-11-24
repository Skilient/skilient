/** S05: join ventures (T047-T050), run a venture (T051-T057), contributions and endorsements (T058-T060). */
import { launch, context, page, ready, signIn, accounts } from "./lib/browser.ts";
import { timedClick, setTask, timedGoto } from "./lib/timed.ts";
import { shot } from "./lib/shot.ts";
import { sql, asUser, mainText, dialogText, toastText } from "./lib/act.ts";
const say = (...x: unknown[]) => console.log(...x);
const A = accounts(); const ids = A.ids; const acc = A.accounts;
const ONLY = process.env.ONLY?.split(","); const run = (id: string) => !ONLY || ONLY.includes(id);
const T = (t: any) => `${t.kind} pending=${t.pendingMs} result=${t.resultMs} "${String(t.shown).replace(/\n/g, " ").slice(0, 160)}"`;
const b = await launch();
const p = await page(await context(b, { device: "phone" }));
await signIn(p, acc.tester); await ready(p, 800);
const V = (id: string, tail = "") => `/ventures/${id}${tail}`;
const btn = (name: RegExp | string) => p.getByRole("button", { name }).first();
const dlg = () => p.locator('[role="dialog"], [role="alertdialog"]').last();
const vid = async (title: string) => (await sql`select id from public.ventures where title = ${title} order by created_at desc limit 1`)[0]?.id as string | undefined;

if (run("T047")) {
  setTask("T047");
  await timedGoto(p, "/openings"); await ready(p, 800);
  say("T047 openings:", await mainText(p, 700));
  const card = p.getByRole("link", { name: /Venture roles/i }).first();
  if (await card.isVisible().catch(() => false)) { say("T047 open card:", T(await timedClick(p, card, "Venture roles card"))); await ready(p, 600); say("T047 roles list:", await mainText(p, 900)); await shot(p, "T047"); }
  await timedGoto(p, V(ids.helperVenture)); await ready(p, 600);
  say("T047 apply:", T(await timedClick(p, btn("Apply to a role"), "Apply to a role")));
  await p.waitForTimeout(900);
  say("T047 apply sheet:", await dialogText(p, 1200));
  await shot(p, "T047");
  const d = dlg();
  await d.getByRole("radio", { name: /Backend developer/ }).click().catch(() => d.getByText("Backend developer").first().click().catch(() => undefined));
  const fields = d.locator("textarea");
  say("T047 textareas:", await fields.count(), await fields.evaluateAll((e) => e.map((x) => x.getAttribute("aria-label") ?? (x as HTMLTextAreaElement).placeholder ?? x.id)));
  await fields.nth(0).fill("I built the Fee Tracker API (Node + Postgres) and can take the backend: auth, item search and the found/claimed flow.");
  if ((await fields.count()) > 1) await fields.nth(1).fill("A fee tracker that 40 classmates used last semester.");
  const send = d.getByRole("button", { name: /^(Send application|Apply|Send)/ }).last();
  say("T047 send:", T(await timedClick(p, send, "send application", { timeout: 30_000 })), "|", await toastText(p));
  await p.waitForTimeout(1200);
  say("T047 after:", new URL(p.url()).pathname, await mainText(p, 500));
  await shot(p, "T047");
}

if (run("T048")) {
  setTask("T048");
  const [th] = await sql`select id from public.application_threads where venture_id = ${ids.helperVenture} and candidate_id = ${acc.tester.id} and status = 'pending' order by created_at desc limit 1`;
  if (th) await asUser(acc.helperA.id, `select public.decide_application($1, true)`, [th.id]);
  await timedGoto(p, "/notifications"); await ready(p, 600);
  say("T048 notifications:", (await mainText(p, 500)));
  await timedGoto(p, V(ids.helperVenture)); await ready(p, 600);
  say("T048 venture as member:", await mainText(p, 500));
  const tabs = await p.locator("main nav a, main [role=tablist] a").evaluateAll((e) => e.map((x) => { const r = (x as HTMLElement).getBoundingClientRect(); return `${(x as HTMLElement).innerText}@${Math.round(r.left)}-${Math.round(r.right)}`; }));
  say("T048 tabs:", tabs.join(" "), "| viewport 390");
  await shot(p, "T048");
  const chatTab = p.getByRole("link", { name: "Chat", exact: true }).first();
  say("T048 chat:", T(await timedClick(p, chatTab, "venture chat tab")));
  await ready(p, 600);
  await p.locator("textarea").last().fill("Hi team! Ayesha here, I'll take the backend.");
  say("T048 send hello:", T(await timedClick(p, btn(/^Send/), "hello in team chat")));
  await p.waitForTimeout(1200);
  say("T048 chat after:", (await mainText(p, 4000)).slice(-250));
  await timedGoto(p, V(ids.fullVenture)); await ready(p, 600);
  say("T048 other venture buttons:", await p.locator("main").getByRole("button").allInnerTexts());
  const follow = btn(/^Follow/);
  if (await follow.isVisible().catch(() => false)) { say("T048 follow:", T(await timedClick(p, follow, "Follow venture")), await toastText(p)); await p.waitForTimeout(800); say("T048 after follow:", await p.locator("main").getByRole("button").allInnerTexts()); }
}

if (run("T049")) {
  setTask("T049");
  // Helper B: a venture inviting the tester, another declining the tester's application.
  const inv = (await vid("Study Buddy Finder")) ?? await asUser(acc.helperB.id, `select public.create_venture($1::text::jsonb)`, [JSON.stringify({ type: "project", title: "Study Buddy Finder", description: "Match students for study sessions.", roles: [{ title: "Frontend developer", skill_ids: ["react"], slots: 1 }] })]);
  const dec = (await vid("Canteen Queue")) ?? await asUser(acc.helperB.id, `select public.create_venture($1::text::jsonb)`, [JSON.stringify({ type: "project", title: "Canteen Queue", description: "Pre-order canteen food.", roles: [{ title: "Backend developer", skill_ids: ["nodejs"], slots: 1 }] })]);
  await asUser(acc.helperB.id, `select public.invite_to_venture($1, 'uxp_tester')`, [inv]).catch((e: any) => say("invite:", e.message));
  const [role] = await sql`select id from public.venture_roles where venture_id = ${dec}`;
  const pend = await sql`select id from public.application_threads where venture_id = ${dec} and candidate_id = ${acc.tester.id} order by created_at desc limit 1`;
  if (!pend.length) {
    const th = await asUser(acc.tester.id, `select public.apply_to_venture($1, $2, '{}'::text[], $3)`, [dec, "I can build the order API.", role.id]);
    await asUser(acc.helperB.id, `select public.decide_application($1, false)`, [th]);
  }
  await timedGoto(p, "/requests"); await ready(p, 600);
  say("T049 requests:", await mainText(p, 800));
  const invTab = p.getByRole("link", { name: /^Invites/ }).first();
  if (await invTab.isVisible().catch(() => false)) { await invTab.click(); await ready(p, 600); say("T049 invites tab:", await mainText(p, 600)); }
  await shot(p, "T049");
  const accept = btn(/^Accept/);
  if (await accept.isVisible().catch(() => false)) { say("T049 accept invite:", T(await timedClick(p, accept, "accept invite")), await toastText(p)); await p.waitForTimeout(800); say("T049 after accept:", new URL(p.url()).pathname, await mainText(p, 300)); }
  await p.goto("/requests?tab=sent"); await ready(p, 600);
  say("T049 sent:", await mainText(p, 700));
  await timedGoto(p, V(dec)); await ready(p, 600);
  say("T049 declined venture page:", await mainText(p, 500), "| buttons:", await p.locator("main").getByRole("button").allInnerTexts());
  const ap = btn("Apply to a role");
  if (await ap.isVisible().catch(() => false)) {
    await ap.click(); await p.waitForTimeout(800); say("T049 reapply sheet:", await dialogText(p, 600));
    const d = dlg(); await d.locator("textarea").first().fill("Trying again with a clearer plan.").catch(() => undefined);
    say("T049 reapply:", T(await timedClick(p, d.getByRole("button", { name: /^(Send application|Apply|Send)/ }).last(), "reapply after decline")), "|", await toastText(p), await dialogText(p, 300));
  }
  await shot(p, "T049");
}

if (run("T050")) {
  setTask("T050");
  await timedGoto(p, V(ids.fullVenture)); await ready(p, 600);
  say("T050 full venture:", await mainText(p, 700), "| buttons:", await p.locator("main").getByRole("button").allInnerTexts());
  await shot(p, "T050");
  await timedGoto(p, "/ventures?status=recruiting"); await ready(p, 600);
  say("T050 FAST Notes Hub listed:", (await mainText(p, 3000)).includes("FAST Notes Hub"));
  await timedGoto(p, "/explore?tab=projects&q=FAST"); await ready(p, 600);
  say("T050 explore projects FAST:", await mainText(p, 500));
  await timedGoto(p, V(ids.otherUniVenture)); await ready(p, 600);
  say("T050 other-uni direct link:", await mainText(p, 400));
  await shot(p, "T050");
}

let mine = "";
if (run("T051")) {
  setTask("T051");
  const t0 = Date.now(); let clicks = 0;
  await timedGoto(p, "/ventures/new"); await ready(p, 600);
  await p.locator('textarea[name="description"]').fill("A campus app to swap second-hand textbooks between batches.");
  say("T051 empty title:", T(await timedClick(p, btn("Create project"), "create with empty title")), "|", (await mainText(p, 2500)).split(" | ").filter((l) => /title|required|enter|give/i.test(l)).join(" / "));
  clicks++;
  const inv = await p.evaluate(() => Array.from(document.querySelectorAll("[aria-invalid=true]")).map((e) => `${e.getAttribute("name")}:${e.getAttribute("aria-describedby")}`));
  say("T051 aria-invalid:", inv, "| focus:", await p.evaluate(() => document.activeElement?.getAttribute("name")));
  await shot(p, "T051");
  await p.locator('input[name="title"]').fill("[UX test] Ayesha"); clicks++;
  const skill = p.getByPlaceholder("Type a skill, e.g. React").first();
  await skill.fill("Rea"); await p.waitForTimeout(800);
  say("T051 skill suggestions:", await p.getByRole("button", { name: /^Add / }).allInnerTexts().then((x) => x.slice(0, 5)));
  await p.getByRole("button", { name: "Add React", exact: true }).first().click(); clicks++;
  for (const [title, sk] of [["Designer", "CSS"], ["Backend developer", "Node"]]) {
    await btn("Add a role").click(); await p.waitForTimeout(500); clicks++;
    const roleTitle = p.getByPlaceholder("e.g. Backend developer").last();
    await roleTitle.fill(title); clicks++;
    const rs = p.getByPlaceholder("Type a skill, e.g. React").last(); await rs.fill(sk); await p.waitForTimeout(700);
    await p.getByRole("button", { name: new RegExp("^Add " + sk) }).first().click().catch(() => undefined); clicks++;
  }
  await btn("Add a question").click(); await p.waitForTimeout(400); clicks++;
  await p.getByRole("button", { name: "Remove question 1" }).locator("xpath=preceding::input[1]").fill("Which textbooks do you still have?"); clicks++;
  await p.getByText("My university only").click(); clicks++;
  say("T051 form before submit:", (await mainText(p, 2500)).slice(0, 1200));
  const t = await timedClick(p, btn("Create project"), "create venture", { timeout: 40_000 }); clicks++;
  say("T051 create:", T(t), "| total ms", Date.now() - t0, "clicks", clicks);
  await ready(p, 800);
  mine = (await vid("[UX test] Ayesha")) ?? "";
  const [v] = mine ? await sql`select visibility::text, (select count(*)::int from public.venture_roles where venture_id = ${mine}) as roles, (select count(*)::int from public.venture_questions where venture_id = ${mine}) as qs from public.ventures where id = ${mine}` : [{}];
  say("T051 stored:", JSON.stringify(v), "| now at", new URL(p.url()).pathname, await mainText(p, 400));
  await shot(p, "T051");
  // Manage: change and leave.
  await timedGoto(p, V(mine, "/manage")); await ready(p, 600);
  const title = p.locator('input[name="title"]');
  await title.fill("[UX test] Ayesha textbooks");
  say("T051 manage save state after typing:", (await mainText(p, 4000)).split(" | ").filter((l) => /saved|unsaved|save/i.test(l)).slice(0, 5));
  await p.getByRole("link", { name: "About" }).first().click(); await ready(p, 600);
  say("T051 left without saving -> title now:", (await mainText(p, 300)).match(/\[UX test\][^|]*/)?.[0]);
}
mine = mine || (await sql`select v.id from public.ventures v where v.title like '[UX test] Ayesha%' and exists (select 1 from public.venture_roles r where r.venture_id = v.id) order by v.created_at desc limit 1`)[0]?.id || "";

if (run("T052") && mine) {
  setTask("T052");
  await timedGoto(p, "/feed"); await ready(p, 600);
  await p.getByRole("radio", { name: "Venture invite" }).click(); await p.waitForTimeout(700);
  say("T052 invite composer:", (await mainText(p, 800)).slice(0, 600));
  const sel = p.locator("form select").first();
  if (await sel.isVisible().catch(() => false)) { say("T052 venture options:", await sel.locator("option").allInnerTexts()); await sel.selectOption({ index: 1 }).catch(() => undefined); }
  await p.locator("form textarea").first().fill("Looking for a designer and a backend dev for a textbook swap app. Apply on the venture page!");
  say("T052 post:", T(await timedClick(p, p.locator('button[type="submit"]').first(), "post venture invite", { timeout: 40_000 })), await toastText(p));
  await p.getByText("Posted.").first().waitFor({ timeout: 30_000 }).catch(() => undefined);
  say("T052 feed top:", (await mainText(p, 1500)).split("Shipped | ")[1]?.slice(0, 400));
  await shot(p, "T052");
}

if (run("T053") && mine) {
  setTask("T053");
  const roles = await sql`select id, title from public.venture_roles where venture_id = ${mine} order by title`;
  const existing = await sql`select candidate_id from public.application_threads where venture_id = ${mine}`;
  if (!existing.length) {
    await asUser(acc.helperB.id, `select public.apply_to_venture($1, $2, $3::text[], $4)`, [mine, "I design in Figma and did the Timetable Planner UI.", "{Two chemistry books}", roles.find((r: any) => r.title === "Designer")?.id ?? null]);
    await asUser(acc.applicant2.id, `select public.apply_to_venture($1, $2, $3::text[], $4)`, [mine, "hi", "{none}", roles.find((r: any) => r.title !== "Designer")?.id ?? null]);
  }
  await timedGoto(p, "/requests"); await ready(p, 600);
  say("T053 requests:", await mainText(p, 1200));
  await shot(p, "T053");
  const row = (who: string) => p.locator("main li, main article, main section > div").filter({ hasText: `${who} applied to [UX test]` }).last();
  say("T053 accept:", T(await timedClick(p, row("Bushra Helper").getByRole("button", { name: "Accept" }), "accept applicant")), await toastText(p), await dialogText(p, 300));
  const c1 = dlg().getByRole("button", { name: /Accept/ }).last(); if (await c1.isVisible().catch(() => false)) say("T053 confirm accept:", T(await timedClick(p, c1, "confirm accept")));
  await p.waitForTimeout(1200);
  say("T053 after accept:", new URL(p.url()).pathname, await mainText(p, 700));
  say("T053 decline:", T(await timedClick(p, row("Danish Helper").getByRole("button", { name: "Decline" }), "decline applicant")), await dialogText(p, 500));
  const c2 = dlg().getByRole("button", { name: /Decline/ }).last(); if (await c2.isVisible().catch(() => false)) { const reason = dlg().locator("textarea"); if (await reason.isVisible().catch(() => false)) await reason.fill("We need someone with backend experience this time."); say("T053 confirm decline:", T(await timedClick(p, c2, "confirm decline"))); }
  await p.waitForTimeout(1200);
  say("T053 after decline:", await mainText(p, 700), await toastText(p));
  await shot(p, "T053");
  await timedGoto(p, V(mine, "/chat")); await ready(p, 600);
  say("T053 team chat after accept:", (await mainText(p, 3000)).slice(-300));
  await timedGoto(p, V(mine, "/manage")); await ready(p, 600);
  await p.getByPlaceholder("@username").fill("kashif_claims");
  say("T053 invite:", T(await timedClick(p, btn("Send invite"), "invite by username")), await toastText(p));
  const [thr] = await sql`select status::text from public.application_threads where venture_id = ${mine} and candidate_id = ${acc.helperB.id}`;
  say("T053 stored B status:", thr?.status);
}

if (run("T054") && mine) {
  setTask("T054");
  await timedGoto(p, V(mine, "/manage")); await ready(p, 600);
  say("T054 status section:", (await mainText(p, 3000)).split("Status | ")[1]?.slice(0, 400));
  const start = btn(/Start building|Mark in progress|In progress/);
  say("T054 start:", T(await timedClick(p, start, "Start building")), await dialogText(p, 500));
  const c = dlg().getByRole("button", { name: /Start|Confirm|Yes/ }).last(); if (await c.isVisible().catch(() => false)) say("T054 confirm start:", T(await timedClick(p, c, "confirm start")));
  await p.waitForTimeout(1200);
  await timedGoto(p, V(mine, "/updates")); await ready(p, 600);
  say("T054 updates page:", await mainText(p, 500));
  await p.locator("textarea").first().fill("Week 1: wireframes done, API skeleton up.");
  say("T054 post update:", T(await timedClick(p, btn(/^(Post update|Post)$/), "post update")), await toastText(p));
  await timedGoto(p, V(mine, "/manage")); await ready(p, 600);
  const repo = p.locator("select").filter({ has: p.locator("option", { hasText: "No repository" }) });
  await repo.selectOption({ label: "ayesha-uxp/fee-tracker" }).catch((e) => say("repo:", e.message));
  const saveRepo = repo.locator("xpath=following::button[1]");
  say("T054 link repo:", T(await timedClick(p, saveRepo, "link repo")), await toastText(p));
  await timedGoto(p, V(mine, "/deliverables")); await ready(p, 600);
  say("T054 deliverables page:", await mainText(p, 500), "| inputs:", await p.locator("main input").evaluateAll((e) => e.map((x) => (x as HTMLInputElement).placeholder || x.getAttribute("name"))));
  const ins = p.locator("main input");
  await ins.nth(0).fill("Figma wireframes"); await ins.nth(1).fill("https://figma.com/file/abc123");
  say("T054 add deliverable:", T(await timedClick(p, btn(/^Add/), "add deliverable")), await toastText(p));
  await p.waitForTimeout(800);
  say("T054 deliverables after:", await mainText(p, 500));
  await shot(p, "T054");
}

if (run("T055") && mine) {
  setTask("T055");
  await timedGoto(p, V(mine, "/team")); await ready(p, 600);
  say("T055 team:", await mainText(p, 900), "| buttons:", await p.locator("main").getByRole("button").allInnerTexts());
  await shot(p, "T055");
  const roleSel = p.locator("main select").first();
  if (await roleSel.isVisible().catch(() => false)) { say("T055 role options:", await roleSel.locator("option").allInnerTexts()); }
  const tr = btn(/Make owner|Transfer/);
  if (await tr.isVisible().catch(() => false)) {
    say("T055 transfer:", T(await timedClick(p, tr, "transfer ownership")), "| dialog:", await dialogText(p, 600));
    await shot(p, "T055");
    const c = dlg().getByRole("button", { name: /Make|Transfer|Confirm/ }).last(); if (await c.isVisible().catch(() => false)) say("T055 confirm:", T(await timedClick(p, c, "confirm transfer")));
    await p.waitForTimeout(1200); say("T055 after:", await mainText(p, 500));
  } else {
    await timedGoto(p, V(mine, "/manage")); await ready(p, 600);
    say("T055 manage has transfer:", (await mainText(p, 5000)).split(" | ").filter((l) => /owner|transfer/i.test(l)));
  }
}

if (run("T058")) {
  setTask("T058");
  const fee = ids.testerVenture;
  await timedGoto(p, V(fee, "/contributions")); await ready(p, 600);
  say("T058 log:", T(await timedClick(p, btn("Log contribution"), "Log contribution")));
  await p.waitForTimeout(800);
  say("T058 log form:", await dialogText(p, 900));
  await shot(p, "T058");
  const d = dlg();
  await d.locator("textarea").first().fill("Built the instalment reminder screen.");
  const url = d.locator('input[type="url"], input[name*="evidence"], input[placeholder*="http"]').first();
  await url.fill("not a link");
  const sub = d.getByRole("button", { name: /^(Log|Save|Add)/ }).last();
  say("T058 bad link:", T(await timedClick(p, sub, "log with bad link")), "|", await dialogText(p, 900));
  say("T058 aria-invalid:", await p.evaluate(() => Array.from(document.querySelectorAll("[aria-invalid=true]")).map((e) => `${e.getAttribute("name")}:${e.getAttribute("aria-describedby")}`)));
  await shot(p, "T058");
  await url.fill("https://github.com/ayesha-uxp/fee-tracker/pull/7");
  say("T058 log:", T(await timedClick(p, sub, "log contribution", { timeout: 30_000 })), await toastText(p));
  await p.waitForTimeout(1200);
  say("T058 list:", await mainText(p, 900));
  const conf = p.getByRole("button", { name: /Confirm Ali Helper/ }).first();
  if (await conf.isVisible().catch(() => false)) { say("T058 confirm:", T(await timedClick(p, conf, "confirm teammate")), await dialogText(p, 500)); const c = dlg().getByRole("button", { name: /Confirm/ }).last(); if (await c.isVisible().catch(() => false)) say("T058 confirm2:", T(await timedClick(p, c, "confirm teammate dialog"))); }
  await p.waitForTimeout(1000);
  say("T058 after confirm:", await mainText(p, 900));
  await shot(p, "T058");
}

if (run("T059")) {
  setTask("T059");
  await timedGoto(p, V(ids.testerVenture, "/contributions")); await ready(p, 600);
  const mineRow = p.locator("main li, main article, main [data-entry]").filter({ hasText: "instalment reminder" }).first();
  say("T059 own entry buttons:", await mineRow.getByRole("button").allInnerTexts().catch(() => []), "| all:", await p.locator("main").getByRole("button").allInnerTexts());
  const fix = p.getByRole("button", { name: /Correct|Fix|Edit|Withdraw|Delete/ }).first();
  if (await fix.isVisible().catch(() => false)) { say("T059 fix:", T(await timedClick(p, fix, "fix entry")), await dialogText(p, 900)); await shot(p, "T059"); const d = dlg(); const ta = d.locator("textarea").first(); if (await ta.isVisible().catch(() => false)) { await ta.fill("Built the instalment reminder screen and its tests."); say("T059 save:", T(await timedClick(p, d.getByRole("button", { name: /^(Log|Save|Correct|Submit)/ }).last(), "save correction")), await toastText(p)); } }
  await p.waitForTimeout(1000);
  say("T059 after:", await mainText(p, 900));
}

if (run("T056")) {
  setTask("T056");
  const fee = ids.testerVenture;
  await timedGoto(p, V(fee, "/manage")); await ready(p, 600);
  say("T056 complete:", T(await timedClick(p, btn("Mark complete"), "Mark complete")), "|", await dialogText(p, 700));
  const c = dlg().getByRole("button", { name: /Mark complete/ }).last();
  if (await c.isVisible().catch(() => false)) { say("T056 confirm:", T(await timedClick(p, c, "confirm complete")), await toastText(p), await dialogText(p, 400)); }
  await p.waitForTimeout(1000);
  say("T056 blocked msg:", (await mainText(p, 3000)).split("Status | ")[1]?.slice(0, 500));
  await shot(p, "T056");
  // Do what's missing: helper A confirms the tester's entry; add a deliverable.
  const mineE = await sql`select id from public.contributions where venture_id = ${fee} and user_id = ${acc.tester.id} order by created_at desc`;
  for (const e of mineE) await asUser(acc.helperA.id, `select public.confirm_contribution($1)`, [e.id]).then(() => say("confirmed", e.id)).catch((x: any) => say("confirm:", x.message));
  await timedGoto(p, V(fee, "/deliverables")); await ready(p, 600);
  const ins = p.locator("main input"); await ins.nth(0).fill("Live app"); await ins.nth(1).fill("https://fees.example.com");
  say("T056 deliverable:", T(await timedClick(p, btn(/^Add/), "add deliverable")));
  await timedGoto(p, V(fee, "/manage")); await ready(p, 600);
  say("T056 checklist now:", (await mainText(p, 3000)).split("Status | ")[1]?.slice(0, 400));
  await btn("Mark complete").click(); await p.waitForTimeout(700);
  const c2 = dlg().getByRole("button", { name: /Mark complete/ }).last();
  if (await c2.isVisible().catch(() => false)) say("T056 confirm 2:", T(await timedClick(p, c2, "confirm complete", { timeout: 30_000 })));
  await p.waitForTimeout(1500);
  say("T056 after complete:", new URL(p.url()).pathname, await mainText(p, 600), await toastText(p));
  await shot(p, "T056");
  await timedGoto(p, "/profile/uxp_tester/ventures"); await ready(p, 600);
  say("T056 profile ventures:", await mainText(p, 600));
  await timedGoto(p, "/feed?filter=shipped"); await ready(p, 600);
  say("T056 shipped feed:", (await mainText(p, 1500)).split("Shipped | ").slice(1).join(" | ").slice(0, 400));
}

if (run("T057")) {
  setTask("T057");
  const scratch = (await sql`select v.id from public.ventures v where v.title like '[UX test] Ayesha%' and not exists (select 1 from public.venture_roles r where r.venture_id = v.id) limit 1`)[0]?.id ?? (await vid("[UX test] scratch")) ?? await asUser(acc.tester.id, `select public.create_venture($1::text::jsonb)`, [JSON.stringify({ type: "project", title: "[UX test] scratch", description: "Throwaway." })]);
  await timedGoto(p, V(scratch, "/manage")); await ready(p, 600);
  say("T057 abandon:", T(await timedClick(p, btn("Abandon venture"), "Abandon venture")), "|", await dialogText(p, 700));
  await shot(p, "T057");
  const c = dlg().getByRole("button", { name: /Abandon/ }).last();
  if (await c.isVisible().catch(() => false)) say("T057 confirm:", T(await timedClick(p, c, "confirm abandon")));
  await p.waitForTimeout(1200);
  say("T057 after:", await mainText(p, 600), "| buttons:", await p.locator("main").getByRole("button").allInnerTexts());
}

if (run("T060")) {
  setTask("T060");
  const done = ids.testerVenture; // completed in T056 with helper A
  await timedGoto(p, V(done, "/team")); await ready(p, 600);
  say("T060 team:", await mainText(p, 600));
  const e = btn("Endorse teammates");
  if (await e.isVisible().catch(() => false)) {
    say("T060 endorse open:", T(await timedClick(p, e, "Endorse teammates")));
    await p.waitForTimeout(900);
    say("T060 sheet:", await dialogText(p, 1200));
    await shot(p, "T060");
    const d = dlg();
    const boxes = d.getByRole("checkbox"); say("T060 skill boxes:", await boxes.count());
    for (let i = 0; i < Math.min(await boxes.count(), 6); i++) await boxes.nth(i).click().catch(() => undefined);
    say("T060 after 6 ticks:", await dialogText(p, 600));
    const go = d.getByRole("button", { name: /^Endorse/ }).last();
    say("T060 endorse:", T(await timedClick(p, go, "endorse teammate")), await dialogText(p, 300));
    await shot(p, "T060");
    await p.keyboard.press("Escape");
  }
  await asUser(acc.helperA.id, `select public.endorse($1, $2, $3::text::jsonb, $4)`, [acc.tester.id, done, JSON.stringify([{ skill: "sql" }]), "Solid schema work."]).catch((x: any) => say("A endorse:", x.message));
  await timedGoto(p, "/profile/uxp_tester#endorsements"); await ready(p, 600);
  say("T060 endorsements:", (await mainText(p, 3000)).split("Endorsements | ")[1]?.slice(0, 500));
  const hide = btn("Hide");
  say("T060 hide:", T(await timedClick(p, hide, "hide endorsement")), await dialogText(p, 300), await toastText(p));
  await p.waitForTimeout(800);
  say("T060 after hide:", (await mainText(p, 3000)).split("Endorsements | ")[1]?.slice(0, 400));
  await timedGoto(p, V(done, "/reviews")); await ready(p, 600);
  say("T060 reviews:", await mainText(p, 700));
  await shot(p, "T060");
}
await b.close(); await sql.end();
