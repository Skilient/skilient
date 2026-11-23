/** S06 part b: notifications (T045), profile and privacy (T061-T062), credentials (T065), Pro (T066), feedback (T067), removal and appeal (T068). */
import { launch, context, page, ready, signIn, accounts } from "./lib/browser.ts";
import { timedClick, setTask, timedGoto } from "./lib/timed.ts";
import { shot } from "./lib/shot.ts";
import { sql, asUser, mainText, dialogText, toastText } from "./lib/act.ts";
import sharp from "sharp";
import { writeFileSync } from "node:fs";
const say = (...x: unknown[]) => console.log(...x);
const A = accounts(); const ids = A.ids; const acc = A.accounts;
const ONLY = process.env.ONLY?.split(","); const run = (id: string) => !ONLY || ONLY.includes(id);
const T = (t: any) => `${t.kind} pending=${t.pendingMs} result=${t.resultMs} "${String(t.shown).replace(/\n/g, " ").slice(0, 160)}"`;
const staff = acc.staff.id;
const b = await launch();
const ctx = await context(b, { device: "phone" });
await ctx.grantPermissions(["notifications"]);
const p = await page(ctx);
await signIn(p, acc.tester); await ready(p, 800);
const btn = (name: RegExp | string) => p.getByRole("button", { name }).first();

if (run("T045")) {
  setTask("T045");
  await timedGoto(p, "/settings/notifications"); await ready(p, 600);
  const groups = await p.locator("fieldset, [role=radiogroup]").count();
  say("T045 categories:", groups);
  let changes = 0;
  const fs = p.locator("fieldset, [role=radiogroup]");
  for (let i = 0; i < groups; i++) {
    const g = fs.nth(i); const name = (await g.innerText()).split("\n")[0];
    const want = /^(Friend requests|Applications|Venture invites)$/.test(name) ? "Instant email" : "Off";
    const opt = g.getByText(want, { exact: true }).first();
    if (await opt.isVisible().catch(() => false)) { await opt.click(); changes++; await p.waitForTimeout(150); }
  }
  say("T045 changes made:", changes, "| toast:", await toastText(p));
  const saveBtn = p.getByRole("button", { name: /^Save/ });
  say("T045 save buttons:", await saveBtn.count());
  if (await saveBtn.count()) say("T045 save:", T(await timedClick(p, saveBtn.first(), "save notification settings")), await toastText(p));
  const names = await fs.evaluateAll((e) => e.map((x) => (x as HTMLElement).innerText.split("\n")[0]));
  say("T045 category names:", names.join(" / "));
  const push = (await mainText(p, 20000)).split(" | ").filter((l) => /phone|push|device|browser/i.test(l));
  say("T045 push lines:", push.slice(0, 8));
  await shot(p, "T045");
  const turnOn = p.getByRole("button", { name: /Turn on|Enable|Allow/ }).first();
  if (await turnOn.isVisible().catch(() => false)) { say("T045 push on:", T(await timedClick(p, turnOn, "turn on push", { timeout: 30_000 })), await toastText(p)); await p.waitForTimeout(2000); say("T045 after push:", (await mainText(p, 20000)).split(" | ").filter((l) => /phone|push|device|event|browser|couldn/i.test(l)).slice(0, 10)); }
  await shot(p, "T045");
}

if (run("T061")) {
  setTask("T061");
  const photo = "/tmp/claude-0/uxp/face.jpg";
  await sharp({ create: { width: 800, height: 800, channels: 3, background: "#c96" } }).jpeg().toFile(photo);
  await timedGoto(p, "/settings/profile"); await ready(p, 600);
  await p.locator('textarea[name="bio"]').fill("Building small tools that make campus life easier.");
  await p.goto("/feed").catch(() => undefined); await ready(p, 300);
  await p.goto("/settings/profile"); await ready(p, 600);
  say("T061 bio after leaving unsaved:", JSON.stringify(await p.locator('textarea[name="bio"]').inputValue()));
  await p.locator('input[type="file"]').first().setInputFiles(photo); await p.waitForTimeout(2500);
  say("T061 crop:", await dialogText(p, 200));
  const crop = p.locator('[role="dialog"]').getByRole("button", { name: "Save" });
  if (await crop.isVisible().catch(() => false)) { say("T061 crop save:", T(await timedClick(p, crop, "save crop", { timeout: 40_000, settleMs: 2500 })), await toastText(p)); await p.waitForTimeout(2500); }
  say("T061 after photo:", await toastText(p), (await mainText(p, 600)).split(" | ").slice(0, 6).join(" | "));
  await p.locator('textarea[name="bio"]').fill("Building small tools that make campus life easier.");
  const looking = p.getByRole("checkbox");
  for (let i = 0; i < Math.min(2, await looking.count()); i++) await looking.nth(i).click();
  say("T061 visibility options:", (await mainText(p, 20000)).split("WHO CAN SEE MY FULL PROFILE | ")[1]?.slice(0, 500));
  await p.getByText("My university", { exact: true }).first().click().catch(() => undefined);
  say("T061 save:", T(await timedClick(p, p.locator("button", { hasText: "Save changes" }).first(), "save profile", { timeout: 30_000 })), await toastText(p));
  await p.waitForTimeout(1000);
  await shot(p, "T061");
  await timedGoto(p, "/profile/uxp_tester"); await ready(p, 600);
  say("T061 profile now:", await mainText(p, 500));
}

if (run("T062")) {
  setTask("T062");
  const t0 = Date.now();
  await timedGoto(p, "/settings/privacy"); await ready(p, 600);
  const sw = p.getByRole("switch").first();
  say("T062 switch name:", await sw.getAttribute("aria-label"), "| labelledby:", await sw.getAttribute("aria-labelledby"), "| checked", await sw.getAttribute("aria-checked"));
  say("T062 toggle:", T(await timedClick(p, sw, "leaderboard opt-out")), await toastText(p), "| now", await sw.getAttribute("aria-checked"));
  await p.waitForTimeout(800);
  say("T062 privacy:", (await mainText(p, 1600)));
  await shot(p, "T062");
  say("T062 ms", Date.now() - t0);
  await timedGoto(p, "/leaderboard"); await ready(p, 600);
  say("T062 leaderboard:", await mainText(p, 600));
}

if (run("T065")) {
  setTask("T065");
  const pdf = (bytes: number) => { const head = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"; return Buffer.concat([Buffer.from(head), Buffer.alloc(Math.max(0, bytes - head.length), 32)]); };
  writeFileSync("/tmp/claude-0/uxp/big.pdf", pdf(6 * 1024 * 1024)); writeFileSync("/tmp/claude-0/uxp/cert.pdf", pdf(40_000));
  await timedGoto(p, "/me/credentials"); await ready(p, 600);
  await p.locator('input[type="file"]').first().setInputFiles("/tmp/claude-0/uxp/big.pdf"); await p.waitForTimeout(1500);
  say("T065 big file immediate:", (await mainText(p, 3000)).split(" | ").filter((l) => /MB|large|big|size|too/i.test(l)));
  await p.locator('input[name="title"]').fill("Big test"); await p.locator('input[name="issuer"]').fill("Udemy"); await p.locator('input[type="date"]').first().fill("2026-10-01");
  say("T065 send big:", T(await timedClick(p, btn("Send for review"), "send too-big file", { timeout: 60_000 })));
  say("T065 big file:", (await mainText(p, 3000)).split(" | ").filter((l) => /MB|large|big|size/i.test(l)), await toastText(p));
  await shot(p, "T065");
  await p.locator('input[type="file"]').first().setInputFiles("/tmp/claude-0/uxp/cert.pdf");
  const inputs = p.locator("main form input:not([type=file])");
  say("T065 inputs:", await inputs.evaluateAll((e) => e.map((x) => `${(x as HTMLInputElement).type}:${x.getAttribute("name")}`)));
  await p.locator('input[name="title"]').fill("SQL (Intermediate)");
  await p.locator('input[name="issuer"]').fill("HackerRank").catch(() => undefined);
  await p.locator('input[type="date"]').first().fill("2026-10-01").catch(() => undefined);
  say("T065 send:", T(await timedClick(p, btn("Send for review"), "send credential", { timeout: 60_000 })), await toastText(p));
  await p.waitForTimeout(1500);
  say("T065 after send:", (await mainText(p, 900)));
  await shot(p, "T065");
  // A second one to be rejected.
  await p.locator('input[type="file"]').first().setInputFiles("/tmp/claude-0/uxp/cert.pdf");
  await p.locator('input[name="title"]').fill("Blurry certificate"); await p.locator('input[name="issuer"]').fill("Coursera").catch(() => undefined);
  await p.locator('input[type="date"]').first().fill("2026-09-01").catch(() => undefined);
  await btn("Send for review").click(); await p.waitForTimeout(3000);
  // Staff review (as the staff account, with two-factor).
  const q = await sql`select id, title from public.credentials where user_id = ${acc.tester.id} and status = 'pending'`;
  for (const c of q) {
    await asUser(staff, `select public.claim_credential($1, true)`, [c.id], "aal2");
    await asUser(staff, `select public.review_credential($1, $2, $3)`, [c.id, c.title !== "Blurry certificate", c.title === "Blurry certificate" ? "The file is too blurry to read the name and date. Upload a clearer scan or the original PDF." : "Checked against the issuer's page."], "aal2").catch((e: any) => say("review:", e.message));
  }
  await p.reload(); await ready(p, 600);
  say("T065 after review:", (await mainText(p, 1200)));
  await shot(p, "T065");
  await timedGoto(p, "/profile/uxp_tester"); await ready(p, 600);
  say("T065 profile credentials:", (await mainText(p, 3000)).split("Credentials | ")[1]?.slice(0, 300));
}

if (run("T066")) {
  setTask("T066");
  await timedGoto(p, "/settings/billing"); await ready(p, 600);
  say("T066 billing:", await mainText(p, 2000));
  await shot(p, "T066");
}

if (run("T067")) {
  setTask("T067");
  const shotFile = "/tmp/claude-0/uxp/fb.png";
  await p.screenshot({ path: shotFile });
  await timedGoto(p, "/me/score"); await ready(p, 600);
  await p.getByRole("button", { name: "Account menu" }).click(); await p.waitForTimeout(800);
  say("T067 account menu items:", await p.locator('[role="menu"] a, [role="menu"] button, [role="dialog"] a').allInnerTexts());
  const fb = p.locator('[role="menu"] a, [role="dialog"] a').filter({ hasText: /Feedback/ }).first();
  if (await fb.isVisible().catch(() => false)) { await fb.click(); await p.waitForURL(/feedback/).catch(() => undefined); } else await p.goto("/feedback");
  await ready(p, 600);
  say("T067 feedback page:", new URL(p.url()).pathname + new URL(p.url()).search, await mainText(p, 800));
  await shot(p, "T067");
  await p.locator("textarea").first().fill("The score page says '1 of 6 tiers reached' but I'm on Spark. Confusing.");
  await p.locator('input[type="file"]').first().setInputFiles(shotFile).catch(() => undefined);
  const kinds = p.locator("label:has(input[name=kind])"); say("T067 kinds:", await kinds.allInnerTexts()); if (await kinds.count()) await kinds.nth(Math.min(1, (await kinds.count()) - 1)).click();
  say("T067 page field:", await p.locator('input[name="page"]').inputValue().catch(() => "(none)"));
  say("T067 send:", T(await timedClick(p, btn(/^Send/), "send feedback", { timeout: 60_000 })), await toastText(p));
  await p.waitForTimeout(1500);
  say("T067 after:", await mainText(p, 800));
  const [f] = await sql`select id, page, screenshot_path is not null as shot from public.feedback where user_id = ${acc.tester.id} order by created_at desc limit 1`.catch(async () => await sql`select id from public.feedback order by created_at desc limit 1`);
  say("T067 stored:", JSON.stringify(f));
  if (f?.id) { await asUser(staff, `select public.claim_feedback($1, true)`, [f.id], "aal2"); await asUser(staff, `select public.respond_feedback($1, 'planned', $2)`, [f.id, "Thanks! You're right: Raw counts as the first tier, so Spark is 2 of 6. We'll fix the wording."], "aal2").catch((e: any) => say("respond:", e.message)); }
  await p.goto("/feedback"); await ready(p, 600);
  say("T067 my feedback:", (await mainText(p, 2000)).split(" | ").filter((l) => /Planned|Thanks|My feedback|Received|reply/i.test(l)).slice(0, 8));
  await shot(p, "T067");
}

if (run("T068")) {
  setTask("T068");
  // Staff remove helper C's '[UX test] report me' post (reported in T023) and suspend C for 3 days.
  const [cse] = await sql`select c.id from public.report_cases c where c.target_id = ${ids.posts.reportMe}::text or c.target_id::text = ${ids.posts.reportMe} limit 1`.catch(() => [] as any);
  say("T068 case:", cse?.id);
  if (cse) { await asUser(staff, `select public.claim_case($1, true)`, [cse.id], "aal2").catch((e: any) => say("claim:", e.message)); await asUser(staff, `select public.resolve_case($1, 'remove', $2, 'low')`, [cse.id, "Spam: the post asks people to report it and has no content for students (rule 3, spam)."], "aal2").catch((e: any) => say("resolve:", e.message)); }
  const [sx] = await sql`select 1 from public.sanctions where user_id = ${acc.helperC.id} and lifted_at is null`.catch(() => [] as any);
  if (!sx) await asUser(staff, `select public.sanction_user($1, 'suspend', now() + interval '3 days', $2, $3)`, [acc.helperC.id, "Repeated test spam posts in the University Feed.", cse?.id ?? null], "aal2").catch((e: any) => say("sanction:", e.message));
  const c = await page(await context(b, { device: "phone" }));
  await c.goto("/signin"); await ready(c, 300);
  await c.getByLabel("University email").fill(acc.helperC.email); await c.getByLabel("Password", { exact: true }).fill(acc.helperC.password);
  const t = await timedClick(c, c.getByRole("button", { name: "Sign in", exact: true }), "sign in restricted", { timeout: 40_000 });
  await ready(c, 800);
  say("T068 sign in:", T(t), "| at", new URL(c.url()).pathname, await mainText(c, 800));
  await shot(c, "T068");
  const banner = (await c.locator("body").innerText()).split("\n").filter((l) => /restrict|suspend|appeal|removed/i.test(l));
  say("T068 banner lines:", banner.slice(0, 6));
  await c.goto("/notifications"); await ready(c, 600);
  say("T068 notifications:", (await mainText(c, 1200)));
  await c.goto("/appeals"); await ready(c, 600);
  say("T068 appeals page:", await mainText(c, 1200));
  await shot(c, "T068");
  const appeal = c.getByRole("button", { name: /Appeal/ }).first();
  if (await appeal.isVisible().catch(() => false)) {
    say("T068 appeal open:", T(await timedClick(c, appeal, "Appeal")));
    await c.waitForTimeout(800);
    say("T068 appeal form:", await dialogText(c, 700));
    const ta = c.locator('[role="dialog"] textarea, main textarea').first(); await ta.fill("It was a UX test post, not spam aimed at students. Please lift the suspension.");
    say("T068 appeal send:", T(await timedClick(c, c.getByRole("button", { name: /^(Send|Submit)/ }).last(), "send appeal", { timeout: 30_000 })), await toastText(c));
    await c.waitForTimeout(1200); say("T068 after appeal:", await mainText(c, 600));
  }
  // A different staff member decides (appeals are never decided by the original decider).
  await sql`insert into public.staff_roles (user_id, role, granted_by) values (${acc.officer1.id}, 'super_admin', ${staff}) on conflict do nothing`;
  const ap = await sql`select id from public.appeals where appellant_id = ${acc.helperC.id} and status = 'open'`.catch(async () => await sql`select id from public.appeals order by created_at desc limit 2`);
  for (const a of ap) { await asUser(acc.officer1.id, `select public.claim_appeal($1, true)`, [a.id], "aal2").catch((e: any) => say("claim appeal:", e.message)); await asUser(acc.officer1.id, `select public.decide_appeal($1, 'overturned', $2)`, [a.id, "Agreed: it was a test post. Suspension lifted; the post stays removed."], "aal2").catch((e: any) => say("decide:", e.message)); }
  await c.goto("/appeals"); await ready(c, 600);
  say("T068 appeals after decision:", await mainText(c, 900));
  await c.goto("/feed"); await ready(c, 600);
  say("T068 feed banner after:", (await c.locator("body").innerText()).split("\n").filter((l) => /restrict|suspend|appeal/i.test(l)).slice(0, 4));
  await shot(c, "T068");
}
await b.close(); await sql.end();
