/** S02 part b: T015 sheet + checklist, T018 hide checklist, T016 desktop Ctrl K + rail tooltips, T019-T025 feed. */
import { launch, context, page, ready, signIn, accounts } from "./lib/browser.ts";
import { timedClick, setTask, timedGoto } from "./lib/timed.ts";
import { shot } from "./lib/shot.ts";
import { inspect } from "./lib/inspect.ts";
import postgres from "postgres";
const say = (...x: unknown[]) => console.log(...x);
const A = accounts();
const ONLY = process.env.ONLY?.split(",");
const run = (id: string) => !ONLY || ONLY.includes(id);
const b = await launch();
const textOf = async (p: any, n = 900) => (await inspect(p, n)).split("CONTROLS")[0];
const dialogText = async (p: any) => (await p.locator('[role="dialog"]').last().innerText().catch(() => "none")).replace(/\n+/g, " | ").slice(0, 1500);

const c = await context(b, { device: "phone" });
const p = await page(c);
await signIn(p, A.accounts.tester); await ready(p, 1000);
const chip = () => p.getByRole("button", { name: /next step/i }).first();

if (run("T015")) {
  setTask("T015");
  await timedGoto(p, "/feed"); await ready(p, 800);
  say("T015 chip", await timedClick(p, chip(), "open progress chip"));
  await p.waitForTimeout(800);
  const gs = p.getByRole("button", { name: /Getting started/ }).or(p.getByRole("link", { name: /Getting started/ })).first();
  if (await gs.isVisible().catch(() => false)) { say("T015 checklist", await timedClick(p, gs, "open checklist")); await p.waitForTimeout(1000); }
  say("T015 sheet:", await dialogText(p));
  await shot(p, "T015");
  const todo = p.getByRole("link", { name: /3 to do/ }).or(p.getByRole("button", { name: /3 to do/ })).first();
  say("T015 3-to-do is link:", await todo.isVisible().catch(() => false));
  const take = p.getByRole("link", { name: /Take this step/ }).first();
  await p.keyboard.press("Escape");
  await chip().click(); await p.waitForTimeout(800);
  say("T015 take", await timedClick(p, p.getByRole("link", { name: /Take this step/ }).first(), "Take this step", { timeout: 30_000 }));
  await ready(p, 800);
  say("T015 after take:", await inspect(p, 2200));
  await shot(p, "T015");
}

if (run("T018")) {
  setTask("T018");
  await timedGoto(p, "/settings"); await ready(p, 500);
  say("T018 replay", await timedClick(p, p.getByRole("button", { name: /Replay tour/ }), "Replay tour", { timeout: 30_000 }));
  await ready(p, 1500);
  say("T018 after replay at", new URL(p.url()).pathname, await dialogText(p));
  const skipTour = p.getByRole("button", { name: "Skip tour" });
  if (await skipTour.isVisible().catch(() => false)) say("T018 skip tour", await timedClick(p, skipTour, "Skip tour"));
  await timedGoto(p, "/feed"); await ready(p, 800);
  await chip().click(); await p.waitForTimeout(800);
  const gs = p.getByRole("button", { name: /Getting started/ }).first();
  if (await gs.isVisible().catch(() => false)) { await gs.click(); await p.waitForTimeout(1000); }
  say("T018 checklist sheet:", await dialogText(p));
  const hide = p.getByRole("button", { name: /Hide checklist|Hide/ });
  say("T018 hide buttons:", await hide.allInnerTexts());
  const hideC = p.getByRole("button", { name: /Hide checklist/ }).first();
  if (await hideC.isVisible().catch(() => false)) {
    say("T018 hide", await timedClick(p, hideC, "Hide checklist"));
    await p.waitForTimeout(1500);
    say("T018 after hide:", await dialogText(p));
    await shot(p, "T018");
    await p.keyboard.press("Escape");
    await p.reload(); await ready(p, 500);
    await chip().click(); await p.waitForTimeout(800);
    say("T018 after reload:", await dialogText(p));
  }
  await p.goto("/settings"); await ready(p);
  say("T018 settings mentions checklist:", /checklist|getting started/i.test(await p.locator("body").innerText()));
}

if (run("T019")) {
  setTask("T019");
  await timedGoto(p, "/feed"); await ready(p, 800);
  let answered = 0; const seen: string[] = [];
  for (let round = 0; round < 15; round++) {
    const yes = p.getByRole("button", { name: "Yes", exact: true }).first();
    if (!(await yes.isVisible().catch(() => false))) {
      await p.mouse.wheel(0, 900); await p.waitForTimeout(900);
      if (await p.getByText("You're all caught up.").isVisible().catch(() => false) && !(await yes.isVisible().catch(() => false))) break;
      continue;
    }
    await yes.scrollIntoViewIfNeeded();
    const card = yes.locator("xpath=ancestor::article[1]");
    const q = (await card.innerText().catch(() => "")).split("\n").filter((l) => /\?$/.test(l)).pop() ?? "";
    const body = (await card.innerText().catch(() => "")).split("\n").slice(3, 5).join(" ").slice(0, 80);
    await p.waitForTimeout(2500); // read the post, as a person would
    const pick = answered % 3 === 2 ? p.getByRole("button", { name: "No", exact: true }).first() : yes;
    const t = await timedClick(p, pick, `survey answer ${answered + 1}`);
    await p.waitForTimeout(800);
    const after = (await card.innerText().catch(() => "")).split("\n").slice(-6).join(" | ");
    seen.push(`[${body}] Q="${q}" -> ${t.kind} ${t.resultMs}ms; after: ${after}`);
    if (answered < 2) await shot(p, "T019");
    answered++;
  }
  say("T019 answered", answered); for (const s of seen) say("  ", s);
  await p.mouse.wheel(0, 20000); await p.waitForTimeout(1500);
  say("T019 end:", (await p.locator("main").innerText()).split("\n").slice(-6).join(" | "));
  await shot(p, "T019");
}

if (run("T020")) {
  setTask("T020");
  // A post the tester hasn't answered yet (T019 answered all): helper A writes one through create_post.
  const prep = postgres(process.env.DATABASE_URL!, { max: 1 });
  const body = `Quick question: is the cafeteria open on Sunday? (${Date.now().toString(36)})`;
  const [row] = await prep.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: A.accounts.helperA.id, role: "authenticated", aal: "aal1" })}, true)`;
    await tx.unsafe("set local role authenticated");
    return tx`select public.create_post(${JSON.stringify({ type: "general", audience: "university", body })}::text::jsonb) as id`;
  });
  await prep.end();
  const freshPost = row.id as string;
  await timedGoto(p, "/post/" + freshPost); await ready(p, 800);
  const yes = p.getByRole("button", { name: "Yes", exact: true }).first();
  await p.waitForTimeout(2500);
  say("T020 answer", await timedClick(p, yes, "answer yes"));
  await p.waitForTimeout(800);
  say("T020 strip after answer:", await inspect(p, 1200));
  await shot(p, "T020");
  const change = p.getByRole("button", { name: /change|undo|No/i }).first();
  say("T020 change control:", await change.innerText().catch(() => "none"));
  if (await change.isVisible().catch(() => false)) { say("T020 change", await timedClick(p, change, "change answer")); await p.waitForTimeout(800); say("T020 after change:", (await textOf(p, 900)).slice(-500)); }
  // 15 minutes later: move this answer back in time on the local DB (a stand-in for waiting).
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const cols = await sql`select column_name from information_schema.columns where table_schema='public' and table_name='micro_survey_responses'`;
  say("T020 response cols:", cols.map((r) => r.column_name).join(","));
  const tcol = cols.find((r) => /answered_at|created_at/.test(r.column_name))?.column_name ?? "created_at";
  await sql.unsafe(`update public.micro_survey_responses set ${tcol} = ${tcol} - interval '15 minutes' where post_id = $1 and user_id = $2`, [freshPost, A.accounts.tester.id]);
  await sql.end();
  await p.reload(); await ready(p, 800);
  say("T020 after 15 min:", (await inspect(p, 1500)));
  const change2 = p.getByRole("button", { name: /change|No/i }).first();
  if (await change2.isVisible().catch(() => false)) { say("T020 change later", await timedClick(p, change2, "change answer after 15 min")); await p.waitForTimeout(1000); say("T020 after late change:", (await textOf(p, 1200)).slice(-600)); }
  await shot(p, "T020");
}

if (run("T021")) {
  setTask("T021");
  await timedGoto(p, "/feed"); await ready(p, 800);
  for (const f of ["Events", "Shipped"]) {
    say(`T021 ${f}`, await timedClick(p, p.getByRole("link", { name: f, exact: true }), `filter ${f}`, { timeout: 30_000 }));
    await ready(p, 600);
    const state = await p.getByRole("link", { name: f, exact: true }).evaluate((e) => `aria-current=${e.getAttribute("aria-current")} aria-selected=${e.getAttribute("aria-selected")} data-state=${e.getAttribute("data-state")}`);
    say(`T021 ${f} state:`, state, "| text:", (await p.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 700));
    await shot(p, "T021");
  }
  say("T021 global", await timedClick(p, p.getByRole("link", { name: "Global Feed" }), "Global Feed", { timeout: 30_000 }));
  await ready(p, 600);
  say("T021 global text:", (await p.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 900));
  await shot(p, "T021");
}

if (run("T022")) {
  setTask("T022");
  await timedGoto(p, "/post/" + A.ids.posts.poll); await ready(p, 800);
  say("T022 poll before vote:", (await p.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 600));
  const opt = p.getByRole("button", { name: /Friday/ }).or(p.getByRole("radio", { name: /Friday/ })).first();
  say("T022 vote", await timedClick(p, opt, "vote Friday"));
  await p.waitForTimeout(1000);
  say("T022 poll after vote:", (await p.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 600));
  await shot(p, "T022");
  await timedGoto(p, "/post/" + A.ids.posts.text + "#comments"); await ready(p, 800);
  say("T022 comments:", (await inspect(p, 1500)));
  const reply = p.getByRole("button", { name: /^Reply/ }).first();
  if (await reply.isVisible().catch(() => false)) { await reply.click(); await p.waitForTimeout(600); }
  const box = p.locator("textarea").last();
  await box.click();
  await p.keyboard.type("@uxp_hel");
  await p.waitForTimeout(1500);
  say("T022 mention suggestions:", await p.locator('[role="listbox"], [role="option"]').allInnerTexts().catch(() => []));
  await shot(p, "T022");
  await p.keyboard.type("per_b yes, the reading room too.");
  const send = p.getByRole("button", { name: /^(Reply|Post|Send|Comment)$/ }).last();
  say("T022 send", await timedClick(p, send, "post reply"));
  await p.waitForTimeout(1200);
  say("T022 after reply:", (await p.locator("main").innerText()).replace(/\n+/g, " | ").slice(-700));
  await shot(p, "T022");
}

if (run("T023")) {
  setTask("T023");
  await timedGoto(p, "/feed"); await ready(p, 800);
  const card = (txt: string) => p.locator("article").filter({ hasText: txt }).first();
  const more = (txt: string) => card(txt).getByRole("button", { name: "More for this post" });
  await more("Selling my old calculator").click(); await p.waitForTimeout(700);
  say("T023 menu:", (await p.locator('[role="menu"], [role="dialog"]').last().innerText().catch(() => "none")).replace(/\n+/g, " | "));
  await shot(p, "T023");
  const nfm = p.getByRole("menuitem", { name: /Not for me/ }).or(p.getByRole("button", { name: /Not for me/ })).first();
  say("T023 not for me", await timedClick(p, nfm, "Not for me"));
  await p.waitForTimeout(1000);
  say("T023 after not-for-me:", (await p.locator("main").innerText()).replace(/\n+/g, " | ").slice(0, 500));
  await more("past papers").click(); await p.waitForTimeout(700);
  const mute = p.getByRole("menuitem", { name: /Mute/ }).or(p.getByRole("button", { name: /Mute/ })).first();
  say("T023 mute", await timedClick(p, mute, "Mute"));
  await p.waitForTimeout(800);
  say("T023 after mute (dialog?):", await dialogText(p));
  const confirmMute = p.locator('[role="dialog"]').getByRole("button", { name: /Mute/ });
  if (await confirmMute.isVisible().catch(() => false)) { say("T023 confirm mute", await timedClick(p, confirmMute, "confirm Mute")); }
  await p.waitForTimeout(1000);
  await shot(p, "T023");
  await p.reload(); await ready(p, 600);
  const stillReportMe = await card("[UX test] report me").isVisible().catch(() => false);
  say("T023 report-me still visible after muting its author:", stillReportMe);
  // Report: open the post directly if muted away.
  await timedGoto(p, "/post/" + A.ids.posts.reportMe); await ready(p, 600);
  await p.getByRole("button", { name: "More for this post" }).first().click(); await p.waitForTimeout(700);
  const rep = p.getByRole("menuitem", { name: /Report/ }).or(p.getByRole("button", { name: /Report/ })).first();
  say("T023 report", await timedClick(p, rep, "Report"));
  await p.waitForTimeout(1000);
  say("T023 report sheet:", await dialogText(p));
  await shot(p, "T023");
  const reason = p.locator('[role="dialog"]').getByRole("radio").first();
  if (await reason.isVisible().catch(() => false)) await reason.check({ force: true }).catch(() => reason.click());
  const submit = p.locator('[role="dialog"]').getByRole("button", { name: /Report|Send|Submit/ }).last();
  say("T023 submit report", await timedClick(p, submit, "submit report"));
  await p.waitForTimeout(1200);
  say("T023 after report:", await dialogText(p), "|", (await p.locator("main").innerText()).slice(0, 200));
  await shot(p, "T023");
}

if (run("T025")) {
  setTask("T025");
  for (const scheme of ["light", "dark"] as const) {
    for (const scale of [1, 2]) {
      const cc = await context(b, { device: "phone", colorScheme: scheme, textScale: scale, throttle: false });
      const pp = await page(cc);
      await signIn(pp, A.accounts.tester); await ready(pp);
      for (const url of ["/feed", `/ventures/${A.ids.helperVenture}`, "/me/cv"]) {
        await pp.goto(url); await ready(pp, 600);
        const m = await pp.evaluate(() => {
          const over = Array.from(document.querySelectorAll("body *")).filter((e) => { const el = e as HTMLElement; return el.children.length === 0 && el.innerText && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== "visible"; }).length;
          return { sideways: document.documentElement.scrollWidth > innerWidth, clipped: over, rootFont: getComputedStyle(document.documentElement).fontSize, bodyFont: getComputedStyle(document.body).fontSize, p: getComputedStyle(document.querySelector("main p") ?? document.body).fontSize };
        });
        say(`T025 ${scheme} x${scale} ${url}`, JSON.stringify(m));
        if (url === "/feed" || scale === 2) await shot(pp, "T025");
      }
      await cc.close();
    }
  }
}

// ---------- Desktop: T016 and T024 ----------
const d = await context(b, { device: "desktop", throttle: false });
const dp = await page(d);
await signIn(dp, A.accounts.tester); await ready(dp, 800);
if (run("T016")) {
  setTask("T016");
  for (const q of ["skill swap", "swap", "privacy", "privacy settings"]) {
    await dp.goto("/feed"); await ready(dp, 300);
    await dp.keyboard.press("Control+k"); await dp.waitForTimeout(600);
    await dp.keyboard.type(q); await dp.waitForTimeout(1200);
    const opts = await dp.getByRole("option").allInnerTexts().catch(() => []);
    say(`T016 ctrlK "${q}":`, opts.slice(0, 6).map((o) => o.replace(/\n/g, " ")));
    const t = await timedClick(dp, dp.locator("body"), `ctrlK enter ${q}`, { action: async () => dp.keyboard.press("Enter") });
    say(`T016 enter "${q}" ->`, t.shown, t.resultMs);
  }
  await dp.goto("/feed"); await ready(dp, 300);
  const rail = dp.locator("nav a, nav button").filter({ has: dp.locator("svg") });
  const n = await rail.count(); const tips: string[] = [];
  for (let i = 0; i < n; i++) {
    const el = rail.nth(i);
    if (!(await el.isVisible())) continue;
    const box = await el.boundingBox(); if (!box || box.x > 120) continue;
    await el.hover(); await dp.waitForTimeout(500);
    const tip = await dp.locator('[role="tooltip"]').first().innerText().catch(() => "");
    const name = await el.getAttribute("aria-label") ?? (await el.innerText());
    tips.push(`${name.trim().replace(/\n/g, " ")} => ${tip.replace(/\n/g, " ")}`);
  }
  say("T016 rail items", tips.length); for (const t of tips) say("  ", t);
  await shot(dp, "T016");
}
if (run("T024")) {
  setTask("T024");
  await dp.goto("/feed"); await ready(dp, 500);
  const log: string[] = [];
  let reachedYes = false, reachedMore = false, reachedComments = false;
  for (let i = 0; i < 60; i++) {
    await dp.keyboard.press("Tab");
    const f = await dp.evaluate(() => { const e = document.activeElement as HTMLElement; const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return { tag: e.tagName, name: (e.getAttribute("aria-label") || e.innerText || "").trim().slice(0, 40), ring: s.outlineStyle !== "none" && s.outlineWidth !== "0px" || s.boxShadow !== "none", inView: r.top >= 0 && r.bottom <= innerHeight }; });
    log.push(`${f.tag}:${f.name}${f.ring ? "" : "(no ring)"}${f.inView ? "" : "(off-screen)"}`);
    if (f.name === "Yes" && !reachedYes) { reachedYes = true; const t = await timedClick(dp, dp.locator("body"), "keyboard Enter on Yes", { action: async () => dp.keyboard.press("Enter") }); log.push(`ENTER yes -> ${t.kind}`); }
    if (/comment/i.test(f.name) && !reachedComments && reachedYes) { reachedComments = true; log.push(`(comments link reached: ${f.name})`); }
    if (f.name === "More for this post" && !reachedMore) {
      reachedMore = true;
      await dp.keyboard.press("Enter"); await dp.waitForTimeout(600);
      const first = await dp.evaluate(() => (document.activeElement as HTMLElement)?.innerText?.trim().slice(0, 30));
      await dp.keyboard.press("ArrowDown"); await dp.waitForTimeout(200);
      const afterDown = await dp.evaluate(() => (document.activeElement as HTMLElement)?.innerText?.trim().slice(0, 30));
      await dp.keyboard.press("Escape"); await dp.waitForTimeout(300);
      const back = await dp.evaluate(() => (document.activeElement as HTMLElement)?.getAttribute("aria-label"));
      log.push(`MENU first=${first} afterArrowDown=${afterDown} escFocus=${back}`);
    }
    if (reachedYes && reachedMore && reachedComments) break;
  }
  say("T024 tab path:", log.join(" > "));
  const yesDesc = await dp.getByRole("button", { name: "Yes", exact: true }).first().evaluate((e) => ({ title: e.getAttribute("title"), describedby: e.getAttribute("aria-describedby"), label: e.getAttribute("aria-label"), text: (e as HTMLElement).innerText })).catch(() => null);
  say("T024 yes button:", JSON.stringify(yesDesc));
}
await b.close();
