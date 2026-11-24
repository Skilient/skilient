/** S07: skills (T069-T071), paths and proof tasks (T072-T075), skill swap (T076-T077), score and leaderboard (T078-T079). */
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
const btn = (name: RegExp | string) => p.getByRole("button", { name }).first();
const drawer = () => p.locator('[data-testid="skill-drawer"], [role="dialog"]').last();

if (run("T069")) {
  setTask("T069");
  await timedGoto(p, "/me/skills"); await ready(p, 600);
  say("T069 skills:", await mainText(p, 1200));
  await shot(p, "T069");
  const sqlChip = p.getByRole("button", { name: /^SQL/ }).first();
  say("T069 open SQL:", T(await timedClick(p, sqlChip, "open SQL details")));
  await p.waitForTimeout(1200);
  say("T069 drawer:", await dialogText(p, 2000));
  await shot(p, "T069");
}

if (run("T070")) {
  setTask("T070");
  await timedGoto(p, "/me/skills"); await ready(p, 600);
  const add = p.getByRole("button", { name: /Add a skill|Add skill|Claim/ }).or(p.getByRole("link", { name: /Add a skill|Add skill|Claim/ })).first();
  say("T070 add-skill control:", await add.isVisible().catch(() => false));
  await timedGoto(p, "/settings/github"); await ready(p, 600);
  say("T070 github settings:", await mainText(p, 1500), "| buttons:", await p.locator("main").getByRole("button").allInnerTexts());
  await shot(p, "T070");
  const excl = p.getByRole("checkbox").or(p.getByRole("switch")).first();
  say("T070 switch state:", await excl.getAttribute("aria-checked"));
  if (await excl.isVisible().catch(() => false)) { say("T070 exclude:", T(await timedClick(p, excl, "exclude repository")), await toastText(p), await dialogText(p, 400)); }
  const sk = async () => (await sql`select string_agg(skill_id || ' L' || level, ', ' order by skill_id) as s from public.user_skills where user_id = ${acc.tester.id}`)[0].s;
  say("T070 switch now:", await excl.getAttribute("aria-checked"), "| skills after excluding:", await sk());
  await timedGoto(p, "/me/skills"); await ready(p, 600); say("T070 /me/skills:", await mainText(p, 500));
  await timedGoto(p, "/settings/github"); await ready(p, 600);
  const back = p.getByRole("checkbox").or(p.getByRole("switch")).first();
  if ((await back.getAttribute("aria-checked")) !== "true") say("T070 include again:", T(await timedClick(p, back, "include repository again")));
  await p.waitForTimeout(1500);
  say("T070 skills after including again:", await sk());
}

if (run("T071")) {
  setTask("T071");
  const f = await page(await context(b, { device: "phone", throttle: false }));
  await signIn(f, acc.testerFresh); await f.goto("/settings/github"); await ready(f, 500);
  const reqs: string[] = []; f.on("request", (r) => { if (r.isNavigationRequest()) reqs.push(r.url()); });
  await f.getByRole("button", { name: "Connect GitHub" }).first().click().catch(() => undefined);
  await f.waitForTimeout(4000);
  say("T071 navigations:", reqs.map((u) => u.slice(0, 140)), "| at", f.url().slice(0, 140));
  // Cancel on GitHub: GitHub returns to the callback without an installation.
  await f.goto("/api/github/callback?state=bogus&setup_action=request").catch(() => undefined); await ready(f, 500);
  say("T071 callback without install:", new URL(f.url()).pathname + new URL(f.url()).search, (await f.locator("body").innerText()).slice(0, 300).replace(/\n+/g, " | "));
}

let attemptId = "";
if (run("T072")) {
  setTask("T072");
  await timedGoto(p, "/me/paths"); await ready(p, 600);
  const be = p.getByRole("button", { name: /^Backend/ }).or(p.getByRole("link", { name: /^Backend/ })).first();
  say("T072 open backend:", T(await timedClick(p, be, "open Backend path")));
  await ready(p, 600);
  say("T072 ladder:", (await mainText(p, 4000)).split("Product")[1]?.slice(0, 900));
  await shot(p, "T072");
  const next = p.locator('[data-testid="path-square"][data-state="next"]').first();
  say("T072 next square:", await next.getAttribute("data-skill").catch(() => "?"));
  say("T072 open square:", T(await timedClick(p, next, "open next square")));
  await p.waitForTimeout(1200);
  say("T072 drawer:", (await drawer().innerText().catch(() => "")).replace(/\n+/g, " | ").slice(0, 1500));
  await shot(p, "T072");
  await p.keyboard.press("Escape");
  for (const role of ["backend", "data", "frontend"]) {
    const f = p.getByTestId(`follow-${role}`);
    if (await f.isVisible().catch(() => false)) { say(`T072 follow ${role}:`, T(await timedClick(p, f, `follow ${role}`)), await toastText(p), await dialogText(p, 300)); await p.waitForTimeout(800); }
    else say(`T072 follow ${role}: button not visible; unfollow visible:`, await p.getByTestId(`unfollow-${role}`).isVisible().catch(() => false));
  }
  say("T072 after three:", (await mainText(p, 3000)).split(" | ").filter((l) => /follow|2 paths|up to/i.test(l)).slice(0, 8));
}

if (run("T073")) {
  setTask("T073");
  await timedGoto(p, "/me/paths?role=backend"); await ready(p, 600);
  await p.locator('[data-testid="path-square"][data-state="next"]').first().click(); await p.waitForTimeout(1200);
  const start = drawer().getByTestId("start-task").first();
  say("T073 tasks in drawer:", await drawer().getByTestId("drawer-task").allInnerTexts().then((x) => x.map((t) => t.replace(/\n+/g, " / ").slice(0, 120))));
  say("T073 start:", T(await timedClick(p, start, "start task", { timeout: 30_000 })));
  await p.waitForURL(/\/me\/tasks\//, { timeout: 30_000 }).catch(() => undefined); await ready(p, 600);
  attemptId = p.url().split("/").pop() ?? "";
  say("T073 task page:", await mainText(p, 1500));
  await shot(p, "T073");
  await p.getByTestId("task-repo").selectOption({ index: 1 }).catch((e) => say("repo:", e.message));
  say("T073 submit:", T(await timedClick(p, p.getByTestId("task-submit"), "submit task", { timeout: 30_000 })), await dialogText(p, 300));
  await p.waitForTimeout(1500);
  say("T073 status:", await p.getByTestId("task-status").innerText().catch(() => "?"), "|", (await mainText(p, 900)));
  await shot(p, "T073");
}
attemptId = attemptId || (await sql`select id from public.task_attempts where user_id = ${acc.tester.id} order by started_at desc limit 1`.catch(() => sql`select id from public.task_attempts where user_id = ${acc.tester.id} limit 1`))[0]?.id || "";

if (run("T074") && attemptId) {
  setTask("T074");
  // GitHub check can't run locally: move the wait past its limit, run the tick, and let a peer (Omar, not a friend) review.
  await sql`update public.task_attempts set submitted_at = now() - interval '3 days' where id = ${attemptId} and status = 'verifying'`;
  await sql`select private.proof_tasks_tick()`;
  const [rev] = await sql`select r.id, r.reviewer_id from public.task_reviews r where r.attempt_id = ${attemptId} and r.status = 'offered' and r.reviewer_id = ${acc.otherUni.id}`;
  const offered = await sql`select reviewer_id from public.task_reviews where attempt_id = ${attemptId}`;
  say("T074 offered to:", offered.map((r: any) => Object.entries(acc).find(([, v]: any) => v.id === r.reviewer_id)?.[0]));
  if (rev) {
    await asUser(acc.otherUni.id, `select public.accept_task_review($1)`, [rev.id]);
    await asUser(acc.otherUni.id, `select public.review_task($1, false, $2, $3::text::jsonb)`, [rev.id, "The endpoint works, but there's no test and the README doesn't say how to run it. Add one test and a 'How to run' section.", JSON.stringify([true, false, false])]).catch((e: any) => say("review:", e.message));
  }
  await timedGoto(p, "/me/tasks/" + attemptId); await ready(p, 600);
  say("T074 needs changes:", await mainText(p, 1500));
  await shot(p, "T074");
  const re = p.getByTestId("task-submit").or(p.getByRole("button", { name: /Resubmit|Submit again/ })).first();
  if (await re.isVisible().catch(() => false)) { say("T074 resubmit:", T(await timedClick(p, re, "resubmit task"))); await p.waitForTimeout(1200); say("T074 after:", await p.getByTestId("task-status").innerText().catch(() => "?"), (await mainText(p, 600))); }
  const cc = p.getByRole("button", { name: /code check/i }).first();
  say("T074 code-check option:", await cc.innerText().catch(() => "none"));
}

if (run("T075")) {
  setTask("T075");
  // Omar (other university) starts a JavaScript task and submits it; the tester (JavaScript L2, not a friend) gets the review.
  let [att] = await sql`select a.id from public.task_attempts a join public.proof_tasks t on t.id = a.task_id where a.user_id = ${acc.otherUni.id} and t.skill_id = 'javascript' limit 1`;
  if (!att) {
    const [task] = await sql`select id from public.proof_tasks where skill_id = 'javascript' and active limit 1`;
    const aid = await asUser(acc.otherUni.id, `select public.start_task($1)`, [task.id]);
    await asUser(acc.otherUni.id, `select public.link_task_repo($1, 8801004)`, [aid]);
    await asUser(acc.otherUni.id, `select public.submit_task($1)`, [aid]);
    att = { id: aid };
  }
  await sql`update public.task_attempts set submitted_at = now() - interval '3 days' where id = ${att.id} and status = 'verifying'`;
  await sql`select private.proof_tasks_tick()`;
  const revs = await sql`select reviewer_id, status from public.task_reviews where attempt_id = ${att.id}`;
  say("T075 offered:", revs.map((r: any) => `${Object.entries(acc).find(([, v]: any) => v.id === r.reviewer_id)?.[0]}:${r.status}`));
  await timedGoto(p, "/me/paths"); await ready(p, 600);
  say("T075 reviews section:", (await mainText(p, 5000)).split("Reviews asked of you | ")[1]?.slice(0, 400));
  const link = p.getByRole("link", { name: /Omar's JavaScript task/ }).first();
  if (await link.isVisible().catch(() => false)) {
    await p.goto((await link.getAttribute("href"))!); await ready(p, 600);
    say("T075 review page:", await mainText(p, 1800));
    await shot(p, "T075");
    const acceptBtn = p.getByRole("button", { name: /^Accept|I'll review|Take it/ }).first();
    if (await acceptBtn.isVisible().catch(() => false)) { say("T075 accept:", T(await timedClick(p, acceptBtn, "accept review"))); await p.waitForTimeout(1000); say("T075 after accept:", await mainText(p, 1500)); }
    say("T075 decline option:", await p.getByRole("button", { name: /Decline|Can't/ }).allInnerTexts());
    const boxes = p.getByRole("checkbox"); for (let i = 0; i < await boxes.count(); i++) await boxes.nth(i).click().catch(() => undefined);
    const note = p.locator("main textarea").first(); if (await note.isVisible().catch(() => false)) await note.fill("Reads cleanly and the tests cover the reload case. Confirmed.");
    const conf = p.getByRole("button", { name: /^Confirm/ }).first();
    if (await conf.isVisible().catch(() => false)) { say("T075 confirm:", T(await timedClick(p, conf, "confirm task", { timeout: 30_000 })), await dialogText(p, 300), await toastText(p)); await p.waitForTimeout(1200); say("T075 after:", await mainText(p, 600)); }
    await shot(p, "T075");
  } else say("T075 no review link on Paths; page:", (await mainText(p, 5000)).slice(-600));
}

if (run("T076")) {
  setTask("T076");
  await timedGoto(p, "/swaps"); await ready(p, 600);
  await p.locator("main select").first().selectOption({ label: "SQL" });
  say("T076 add want:", T(await timedClick(p, btn("Add"), "add SQL to wants")));
  await p.waitForTimeout(1500); await ready(p, 300);
  say("T076 teachers:", await mainText(p, 1500));
  await shot(p, "T076");
  const ask = p.getByRole("button", { name: /Ask|Request|Learn from/ }).first();
  say("T076 ask:", T(await timedClick(p, ask, "open swap request")));
  await p.waitForTimeout(900);
  say("T076 form:", await dialogText(p, 1200));
  const d = p.locator('[role="dialog"]').last();
  const tas = d.locator("textarea, input[type=text]");
  say("T076 fields:", await tas.evaluateAll((e) => e.map((x) => x.getAttribute("name") ?? x.getAttribute("aria-label"))));
  for (let i = 0; i < await tas.count(); i++) {
    const n = (await tas.nth(i).getAttribute("name")) ?? "";
    await tas.nth(i).fill(/time/i.test(n) ? "Tue 2-4pm or Thu after 3pm, library" : /offer/i.test(n) ? "I can help with React in return." : "I want to get comfortable with joins and indexes before my DB exam.");
  }
  say("T076 send:", T(await timedClick(p, d.getByRole("button", { name: /^(Send|Request)/ }).last(), "send swap request", { timeout: 30_000 })), await toastText(p), await dialogText(p, 300));
  await p.waitForTimeout(1000);
  say("T076 after:", await mainText(p, 600));
  // Empty state: a skill nobody teaches.
  await p.goto("/swaps"); await ready(p, 400);
  await p.locator("main select").first().selectOption({ label: "Rust" }); await btn("Add").click().catch(() => undefined); await p.waitForTimeout(1500);
  say("T076 nobody:", (await mainText(p, 800)).split("Rust")[1]?.slice(0, 300));
}

if (run("T077")) {
  setTask("T077");
  const [sw] = await sql`select id, status::text, note, preferred_times from public.swaps where learner_id = ${acc.tester.id} and teacher_id = ${acc.helperA.id} order by requested_at desc limit 1`;
  say("T077 swap:", JSON.stringify(sw));
  if (sw?.status === "requested" || sw?.status === "pending") await asUser(acc.helperA.id, `select public.respond_swap($1, true)`, [sw.id]).catch((e: any) => say("respond:", e.message));
  const sessQ = await sql`select id from public.swap_sessions where swap_id = ${sw.id}`;
  if (!sessQ.length) await asUser(acc.helperA.id, `select public.propose_swap_session($1, now() + interval '2 days', 30, 'Library, 2nd floor')`, [sw.id]).catch((e: any) => say("propose:", e.message));
  await timedGoto(p, "/swaps/" + sw.id); await ready(p, 600);
  say("T077 swap page:", await mainText(p, 1500));
  await shot(p, "T077");
  const acc1 = p.getByRole("button", { name: /^Accept/ }).first();
  if (await acc1.isVisible().catch(() => false)) { say("T077 accept time:", T(await timedClick(p, acc1, "accept session time"))); await p.waitForTimeout(800); }
  // The session happens: move it into the past (stand-in for waiting two days).
  await sql`update public.swap_sessions set starts_at = now() - interval '1 hour' where swap_id = ${sw.id}`;
  await p.reload(); await ready(p, 600);
  say("T077 after session:", await mainText(p, 1500));
  const yes = p.getByRole("button", { name: /It happened|Yes/ }).first();
  if (await yes.isVisible().catch(() => false)) { say("T077 happened:", T(await timedClick(p, yes, "session happened"))); await p.waitForTimeout(800); say("T077 confirm form:", await dialogText(p, 900), (await mainText(p, 800)).slice(-400)); }
  const minutes = p.locator('input[type="number"]').first(); if (await minutes.isVisible().catch(() => false)) await minutes.fill("15");
  const note = p.locator("textarea").last(); if (await note.isVisible().catch(() => false)) await note.fill("Ali explained joins with our society schema. Very clear.");
  const conf = p.getByRole("button", { name: /^(Confirm|Send|Save)/ }).last();
  if (await conf.isVisible().catch(() => false)) say("T077 confirm:", T(await timedClick(p, conf, "confirm session", { timeout: 30_000 })), await toastText(p));
  await p.waitForTimeout(1000);
  const end = p.getByRole("button", { name: /End|Close/ }).first();
  if (await end.isVisible().catch(() => false)) { say("T077 end:", T(await timedClick(p, end, "end swap")), await dialogText(p, 400)); const c = p.locator('[role="dialog"], [role="alertdialog"]').getByRole("button", { name: /End|Close/ }).last(); if (await c.isVisible().catch(() => false)) say("T077 end confirm:", T(await timedClick(p, c, "confirm end swap"))); }
  await p.waitForTimeout(1200);
  say("T077 final:", await mainText(p, 900));
  const taught = await sql`select kind::text, status::text from public.record_entries where user_id = ${acc.helperA.id} order by created_at desc limit 3`.catch((e) => [{ err: e.message }]);
  say("T077 teacher record:", JSON.stringify(taught));
  const a = await page(await context(b, { device: "phone", throttle: false }));
  await signIn(a, acc.helperA); await a.goto("/me/record"); await ready(a, 600);
  say("T077 teacher /me/record:", await mainText(a, 700));
}

if (run("T078")) {
  setTask("T078");
  await timedGoto(p, "/me/score"); await ready(p, 600);
  say("T078 score:", await mainText(p, 4000));
  await shot(p, "T078");
  say("T078 links in requirements:", await p.locator("main a").allInnerTexts().then((x) => x.filter(Boolean).slice(0, 20)));
}

if (run("T079")) {
  setTask("T079");
  await timedGoto(p, "/leaderboard"); await ready(p, 600);
  say("T079 board:", await mainText(p, 1500));
  for (const tab of ["Department", "Batch", "Global"]) {
    const t = p.getByRole("link", { name: tab, exact: true }).or(p.getByRole("tab", { name: tab })).or(p.getByRole("radio", { name: tab })).first();
    if (await t.isVisible().catch(() => false)) { await t.click(); await p.waitForTimeout(800); const apply = btn("Apply"); if (await apply.isVisible().catch(() => false)) await apply.click(); await ready(p, 600); say(`T079 ${tab}:`, await mainText(p, 700)); }
  }
  await shot(p, "T079");
}
await b.close(); await sql.end();
