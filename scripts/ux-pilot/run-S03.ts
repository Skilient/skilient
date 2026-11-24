/** S03: posting (T026-T030), sharing (T031-T032), friends and blocks (T033-T036). */
import { launch, context, page, ready, signIn, accounts } from "./lib/browser.ts";
import { timedClick, setTask, timedGoto } from "./lib/timed.ts";
import { shot } from "./lib/shot.ts";
import { sql, asUser, mainText, dialogText, toastText } from "./lib/act.ts";
import sharp from "sharp";
const say = (...x: unknown[]) => console.log(...x);
const A = accounts(); const ids = A.ids; const acc = A.accounts;
const ONLY = process.env.ONLY?.split(","); const run = (id: string) => !ONLY || ONLY.includes(id);
const b = await launch();
const p = await page(await context(b, { device: "phone" }));
await signIn(p, acc.tester); await ready(p, 800);
const T = (t: any) => `${t.kind} pending=${t.pendingMs} result=${t.resultMs} "${String(t.shown).replace(/\n/g, " ").slice(0, 160)}"`;
const small = "/tmp/claude-0/uxp/notes.jpg";
await sharp({ create: { width: 1200, height: 900, channels: 3, background: "#e8e2d0" } }).composite([{ input: Buffer.from('<svg width="1200" height="900"><text x="80" y="200" font-size="70">DB notes: joins</text><rect x="80" y="300" width="900" height="20"/></svg>') }]).jpeg().toFile(small);
const big = "/tmp/claude-0/uxp/big.png";

let myPost = "";
if (run("T026")) {
  setTask("T026");
  await timedGoto(p, "/feed"); await ready(p, 800);
  const box = p.locator("textarea").first();
  await box.fill("Free printing at the library till Friday. Bring your student card. Here are my DB notes on joins too.");
  say("T026 audience controls:", await p.locator("form button").filter({ hasText: /^(University|Global)$/ }).evaluateAll((els) => els.map((e) => `${(e as HTMLElement).innerText}:role=${e.getAttribute("role")} checked=${e.getAttribute("aria-pressed") ?? e.getAttribute("aria-checked") ?? e.getAttribute("data-state")}`)));
  await p.locator('input[type="file"]').first().setInputFiles(big);
  await p.waitForTimeout(6000);
  say("T026 big photo:", await toastText(p), "|", (await mainText(p, 500)));
  await shot(p, "T026");
  await p.locator('input[type="file"]').first().setInputFiles(small);
  await p.waitForTimeout(4000);
  say("T026 small photo:", await toastText(p));
  say("T026 images now:", await p.getByText(/Images \(\d\/4\)/).first().innerText());
  await p.locator("form button").filter({ hasText: /^University$/ }).first().click();
  const submit = p.locator('button[type="submit"]').filter({ hasText: /^Post$/ }).first();
  say("T026 submit disabled?", await submit.isDisabled(), "busy", await submit.getAttribute("aria-busy"));
  const t0 = Date.now();
  const t = await timedClick(p, submit, "post with photo", { timeout: 60_000, settleMs: 3000 });
  await p.getByText("Posted.").first().waitFor({ timeout: 60_000 }).catch(() => undefined);
  say("T026 post:", T(t), "| ms to 'Posted.':", Date.now() - t0);
  for (let i = 0; i < 20; i++) { const n = (await sql`select count(*)::int as n from public.posts where author_id = ${acc.tester.id} and body like 'Free printing%'`)[0].n; if (n) break; await p.waitForTimeout(1500); }
  await p.waitForTimeout(2000);
  say("T026 after:", await toastText(p), "|", await mainText(p, 700));
  await shot(p, "T026");
  const [r] = await sql`select id from public.posts where author_id = ${acc.tester.id} and body like 'Free printing%' order by created_at desc limit 1`;
  myPost = r?.id ?? "";
  const [m] = myPost ? await sql`select count(*)::int as n from public.post_media where post_id = ${myPost}` : [{ n: 0 }];
  say("T026 stored post", myPost, "media", m.n);
}

if (run("T027")) {
  setTask("T027");
  await timedGoto(p, "/feed"); await ready(p, 600);
  await p.getByRole("radio", { name: "Poll", exact: true }).first().click(); await p.waitForTimeout(800);
  say("T027 poll form:", await mainText(p, 600));
  const ctrls = await p.locator("form").first().evaluate((f) => Array.from(f.querySelectorAll("input,select,button,textarea")).map((e) => `${e.tagName}:${(e as HTMLElement).getAttribute("aria-label") ?? (e as HTMLInputElement).placeholder ?? (e as HTMLElement).innerText}`).join(" | "));
  say("T027 controls:", ctrls.slice(0, 900));
  await shot(p, "T027");
  await p.locator("form textarea").first().fill("Which time suits the batch for the OS revision session?");
  await p.getByLabel("Option 1", { exact: true }).fill("After 2pm lab");
  await p.getByLabel("Option 2", { exact: true }).fill("Saturday morning");
  await p.getByRole("button", { name: "Add an option" }).click(); await p.waitForTimeout(300);
  say("T027 after add:", await p.locator("form input").evaluateAll((e) => e.map((x) => x.getAttribute("aria-label")).join(",")), "remove buttons:", await p.getByRole("button", { name: /remove/i }).count());
  await p.getByLabel("Option 3", { exact: true }).fill("Sunday evening");
  const days = p.locator("form select").first();
  if (await days.isVisible().catch(() => false)) { say("T027 days options:", await days.locator("option").allInnerTexts()); await days.selectOption({ label: "2 days" }).catch(() => undefined); }
  const t0 = Date.now();
  const t = await timedClick(p, p.locator('button[type="submit"]').first(), "post poll", { timeout: 40_000 });
  await p.getByText("Posted.").first().waitFor({ timeout: 40_000 }).catch(() => undefined); say("T027 ms to Posted.:", Date.now() - t0);
  say("T027 post:", T(t)); await p.waitForTimeout(1500);
  say("T027 after:", await toastText(p), "|", (await mainText(p, 400)));
  const [poll] = await sql`select pp.closes_at - p.created_at as dur, (select count(*) from public.poll_options o where o.post_id = p.id)::int as opts from public.posts p join public.post_polls pp on pp.post_id = p.id where p.author_id = ${acc.tester.id} order by p.created_at desc limit 1`;
  say("T027 stored:", JSON.stringify(poll));
  await shot(p, "T027");
}

if (run("T028")) {
  setTask("T028");
  await timedGoto(p, "/feed"); await ready(p, 600);
  await p.getByRole("radio", { name: "Post", exact: true }).first().click().catch(() => undefined);
  await p.locator("textarea").first().fill("Half-written thought about the hackathon teams");
  await timedGoto(p, "/me"); await ready(p, 400);
  await timedGoto(p, "/feed"); await ready(p, 600);
  say("T028 draft kept:", JSON.stringify(await p.locator("textarea").first().inputValue()));
  await p.locator("textarea").first().fill("Anyone up for a study group for OS? Saturday 11am, library.");
  const t1 = await timedClick(p, p.locator('button[type="submit"]').first(), "post 1", { timeout: 40_000 });
  await p.getByText("Posted.").first().waitFor({ timeout: 40_000 }).catch(() => undefined);
  say("T028 post1:", T(t1));
  await p.locator("textarea").first().fill("Also: bring past papers if you have them.");
  const t2 = await timedClick(p, p.locator('button[type="submit"]').first(), "post 2 quickly", { timeout: 40_000, settleMs: 2500 });
  say("T028 post2:", T(t2), "| toast:", await toastText(p));
  await shot(p, "T028");
  await p.locator("textarea").first().fill("");
  const postBtn = p.locator('button[type="submit"]').first();
  say("T028 empty: post disabled?", await postBtn.isDisabled());
  if (!(await postBtn.isDisabled())) { const t3 = await timedClick(p, postBtn, "post empty"); say("T028 empty:", T(t3), await toastText(p)); }
  await shot(p, "T028");
}

if (!myPost) myPost = (await sql`select id from public.posts where author_id = ${acc.tester.id} and body like 'Free printing%' order by created_at desc limit 1`)[0]?.id ?? "";
if (run("T029") && myPost) {
  setTask("T029");
  await timedGoto(p, "/post/" + myPost); await ready(p, 600);
  say("T029 own post controls:", (await p.locator("main article, main").first().getByRole("button").allInnerTexts()).slice(0, 12));
  const edit = p.getByRole("menuitem", { name: /Edit/ }).or(p.getByRole("button", { name: /^Edit/ })).first();
  if (await edit.isVisible().catch(() => false)) {
    await edit.click(); await p.waitForTimeout(800);
    say("T029 edit UI:", await dialogText(p), "|", (await mainText(p, 300)));
    const ta = p.locator("textarea").last();
    await ta.fill((await ta.inputValue()).replace("Free printing", "Free printing (B/W only)"));
    const save = p.getByRole("button", { name: /^Save/ }).last();
    say("T029 save:", T(await timedClick(p, save, "save edit")));
    await p.waitForTimeout(1000);
    say("T029 after edit:", (await mainText(p, 300)));
  } else say("T029 no Edit item");
  const del = p.getByRole("button", { name: /^Delete/ }).first();
  await del.click(); await p.waitForTimeout(800);
  say("T029 delete confirm:", await dialogText(p));
  await shot(p, "T029");
  const yes = p.locator('[role="dialog"], [role="alertdialog"]').getByRole("button", { name: /Delete/ }).last();
  if (await yes.isVisible().catch(() => false)) say("T029 delete:", T(await timedClick(p, yes, "confirm delete", { timeout: 30_000 })));
  await p.waitForTimeout(1200);
  say("T029 after delete:", new URL(p.url()).pathname, await toastText(p));
}

if (run("T030")) {
  setTask("T030");
  // Tester's post that helpers comment on: the OS study group post from T028.
  const [post] = await sql`select id from public.posts where author_id = ${acc.tester.id} and type = 'general' and body not like 'Free printing%' order by created_at desc limit 1`;
  const pid = post?.id;
  if (pid) {
    const has = await sql`select 1 from public.post_comments where post_id = ${pid}`;
    if (!has.length) {
      await asUser(acc.helperA.id, `select public.add_comment($1, null, $2)`, [pid, "I'm in. I have the 2024 and 2025 papers."]);
      await asUser(acc.helperB.id, `select public.add_comment($1, null, $2)`, [pid, "Can we do 12 instead?"]);
      for (const k of ["helperA", "helperB", "helperC", "finalYear"]) await asUser(acc[k].id, `select public.answer_survey($1, true, 4000)`, [pid]).catch((e: any) => say("answer", k, e.message));
    }
    await timedGoto(p, "/post/" + pid); await ready(p, 700);
    say("T030 own post:", await mainText(p, 900));
    const ins = p.getByRole("button", { name: "Insights" }).first();
    if (await ins.isVisible().catch(() => false)) { say("T030 insights:", T(await timedClick(p, ins, "Insights"))); await p.waitForTimeout(1000); say("T030 insights sheet:", await dialogText(p, 1200)); await shot(p, "T030"); await p.keyboard.press("Escape"); }
    const pin = p.getByRole("button", { name: /^Pin/ }).first();
    say("T030 pin buttons:", await p.getByRole("button", { name: /Pin/ }).allInnerTexts());
    if (await pin.isVisible().catch(() => false)) { say("T030 pin:", T(await timedClick(p, pin, "pin comment"))); await p.waitForTimeout(1000); say("T030 after pin:", await mainText(p, 700)); await shot(p, "T030"); }
  } else say("T030 no post from T028");
}

if (run("T031")) {
  setTask("T031");
  await timedGoto(p, "/post/" + ids.posts.text); await ready(p, 700);
  say("T031 share:", T(await timedClick(p, p.getByRole("button", { name: "Share" }).first(), "open share")));
  await p.waitForTimeout(900);
  say("T031 share sheet:", await dialogText(p, 1200));
  await shot(p, "T031");
  const d = p.locator('[role="dialog"]').last();
  await d.getByText("Ali Helper").first().click().catch(() => undefined);
  const note = d.locator("textarea, input[type=text]").last();
  if (await note.isVisible().catch(() => false)) await note.fill("Useful for exam week!");
  const send = d.getByRole("button", { name: /^Send/ }).last();
  say("T031 send:", T(await timedClick(p, send, "send share to friend")), "| toast:", await toastText(p));
  await p.waitForTimeout(1000);
  await timedGoto(p, "/post/" + ids.posts.text2); await ready(p, 700);
  await p.getByRole("button", { name: "Share" }).first().click(); await p.waitForTimeout(900);
  const d2 = p.locator('[role="dialog"]').last();
  await d2.getByText("Fee Tracker").first().click().catch(() => undefined);
  const t = await timedClick(p, d2.getByRole("button", { name: /^Send/ }).last(), "send share to venture chat");
  say("T031 venture send:", T(t));
  const undoAt = Date.now();
  const undo = p.getByRole("button", { name: "Undo" }).first();
  const undoVisible = await undo.isVisible().catch(() => false);
  say("T031 undo visible:", undoVisible, "toast:", await toastText(p));
  if (undoVisible) { await undo.click(); say("T031 undo clicked after ms", Date.now() - undoAt); await p.waitForTimeout(1000); say("T031 after undo toast:", await toastText(p)); }
  await shot(p, "T031");
  const rows = await sql`select m.thread_id, count(*)::int from public.chat_messages m where m.sender_id = ${acc.tester.id} and m.shared_post_id is not null group by 1`;
  say("T031 stored shares:", JSON.stringify(rows));
  // A tester with no chats: the share sheet.
  const f = await page(await context(b, { device: "phone", throttle: false }));
  await signIn(f, acc.testerFresh); await f.goto("/post/" + ids.posts.text); await ready(f, 500);
  await f.getByRole("button", { name: "Share" }).first().click(); await f.waitForTimeout(900);
  say("T031 fresh share sheet:", await dialogText(f));
}

if (run("T032")) {
  setTask("T032");
  // Helper A shares a normal post and another university's university-only post into the DM.
  let hidden = (await sql`select id from public.posts where body = 'FAST-only: lab timings changed for next week.'`)[0]?.id;
  if (!hidden) hidden = await asUser(acc.otherUni.id, `select public.create_post($1::text::jsonb)`, [JSON.stringify({ type: "general", audience: "university", body: "FAST-only: lab timings changed for next week." })]);
  const already = await sql`select 1 from public.chat_messages where thread_id = ${ids.dmTesterA} and shared_post_id = ${ids.posts.poll}`;
  if (!already.length) {
    await asUser(acc.helperA.id, `select public.share_post($1, $2::uuid[], $3)`, [ids.posts.poll, `{${ids.dmTesterA}}`, "Vote on this"]);
    await asUser(acc.helperA.id, `select public.share_post($1, $2::uuid[], $3)`, [hidden, `{${ids.dmTesterA}}`, "Did you see this?"]).catch((e: any) => say("T032 share hidden refused:", e.message));
  }
  await timedGoto(p, "/chat/" + ids.dmTesterA); await ready(p, 900);
  say("T032 chat:", await mainText(p, 1200));
  await shot(p, "T032");
  // Share many posts quickly to five chats in a row.
  const posts = [ids.posts.text, ids.posts.text2, ids.posts.invite, ids.posts.poll, ids.posts.helperC3];
  for (let i = 0; i < posts.length; i++) {
    await p.goto("/post/" + posts[i]); await ready(p, 300);
    await p.getByRole("button", { name: "Share" }).first().click(); await p.waitForTimeout(600);
    const d = p.locator('[role="dialog"]').last();
    const targets = d.getByRole("checkbox");
    const n = await targets.count();
    for (let k = 0; k < Math.min(n, 5); k++) await targets.nth(k).click().catch(() => undefined);
    if (!n) for (const name of ["Ali Helper", "Fee Tracker", "Timetable Planner", "Hostel Mess Menu"]) await d.getByText(name).first().click().catch(() => undefined);
    const t = await timedClick(p, d.getByRole("button", { name: /^Send/ }).last(), `rapid share ${i + 1}`);
    say(`T032 rapid ${i + 1}:`, T(t), "| toast:", await toastText(p), "| dialog:", await dialogText(p, 200));
  }
  await shot(p, "T032");
}

if (run("T033")) {
  setTask("T033");
  await timedGoto(p, "/friends"); await ready(p, 600);
  const input = p.getByPlaceholder("@username");
  await input.fill("uxp_helpr_x");
  say("T033 mistype:", T(await timedClick(p, p.getByRole("button", { name: "Send request" }), "send to mistyped")), "|", await toastText(p));
  await shot(p, "T033");
  await input.fill("uxp_helper_d");
  say("T033 by username:", T(await timedClick(p, p.getByRole("button", { name: "Send request" }), "send by username")), "|", await toastText(p));
  await p.waitForTimeout(3500);
  const add = p.getByRole("button", { name: "Add friend: Kashif Claimer" });
  if (await add.isVisible().catch(() => false)) say("T033 suggestion:", T(await timedClick(p, add, "add from suggestions")), "|", await toastText(p));
  const dis = p.getByRole("button", { name: "Dismiss Zara Staff" });
  if (await dis.isVisible().catch(() => false)) say("T033 dismiss:", T(await timedClick(p, dis, "dismiss suggestion")), "|", await toastText(p));
  await p.waitForTimeout(800);
  say("T033 friends page:", await mainText(p, 900));
  await shot(p, "T033");
  await p.getByRole("link", { name: /^Sent/ }).click(); await ready(p, 500);
  say("T033 sent tab:", await mainText(p, 500));
}

if (run("T034")) {
  setTask("T034");
  await timedGoto(p, "/friends?tab=received"); await ready(p, 600);
  say("T034 received:", await mainText(p, 600));
  const acc1 = p.getByRole("button", { name: /^Accept/ }).first();
  say("T034 accept:", T(await timedClick(p, acc1, "accept request")), "|", await toastText(p));
  await timedGoto(p, "/friends?tab=sent"); await ready(p, 600);
  say("T034 sent:", await mainText(p, 600));
  const cancel = p.getByRole("button", { name: /Cancel.*Fatima|^Cancel/ }).first();
  if (await cancel.isVisible().catch(() => false)) { say("T034 cancel:", T(await timedClick(p, cancel, "cancel sent request"))); await p.waitForTimeout(600); say("T034 cancel dialog/toast:", await dialogText(p), await toastText(p)); }
  await shot(p, "T034");
  await timedGoto(p, "/friends"); await ready(p, 500);
  await p.getByPlaceholder("@username").fill("uxp_helper_b");
  say("T034 add existing friend:", T(await timedClick(p, p.getByRole("button", { name: "Send request" }), "add existing friend")), "|", await toastText(p), "|", (await mainText(p, 300)));
}

if (run("T035")) {
  setTask("T035");
  await timedGoto(p, "/friends"); await ready(p, 600);
  say("T035 friend row controls:", await p.locator("main").getByRole("button").allInnerTexts().then((x) => x.slice(0, 30)));
  const msg = p.getByRole("link", { name: /Message/ }).or(p.getByRole("button", { name: /Message/ })).first();
  if (await msg.isVisible().catch(() => false)) say("T035 message from friends:", T(await timedClick(p, msg, "Message from Friends")));
  else {
    say("T035 no Message on Friends; open profile");
    await p.getByRole("link", { name: "Sana Spark" }).first().click(); await ready(p, 600);
    say("T035 profile controls:", await p.locator("main").getByRole("button").allInnerTexts(), await p.locator("main").getByRole("link").allInnerTexts().then((x) => x.slice(0, 8)));
    const m2 = p.getByRole("link", { name: /Message/ }).or(p.getByRole("button", { name: /Message/ })).first();
    if (await m2.isVisible().catch(() => false)) say("T035 message from profile:", T(await timedClick(p, m2, "Message from profile", { timeout: 30_000 })));
  }
  await ready(p, 600);
  const box = p.locator("textarea").last();
  if (await box.isVisible().catch(() => false)) { await box.fill("Hey Sana, are you coming to the OS study group?"); await p.keyboard.press("Enter"); await p.waitForTimeout(1500); say("T035 chat after send:", await mainText(p, 300)); }
  await timedGoto(p, "/friends"); await ready(p, 600);
  const unf = p.getByRole("button", { name: "Unfriend Sana Spark" });
  say("T035 unfriend:", T(await timedClick(p, unf, "Unfriend")));
  await p.waitForTimeout(700);
  say("T035 unfriend confirm:", await dialogText(p), "| toast:", await toastText(p));
  await shot(p, "T035");
  const conf = p.locator('[role="dialog"], [role="alertdialog"]').getByRole("button", { name: /Unfriend|Remove/ }).last();
  if (await conf.isVisible().catch(() => false)) { say("T035 confirm:", T(await timedClick(p, conf, "confirm unfriend"))); }
  await p.waitForTimeout(800);
  say("T035 after:", await toastText(p), "|", await mainText(p, 300));
}

if (run("T036")) {
  setTask("T036");
  await timedGoto(p, "/profile/uxp_helper_c"); await ready(p, 600);
  say("T036 block:", T(await timedClick(p, p.getByRole("button", { name: "Block" }), "Block")));
  await p.waitForTimeout(700);
  say("T036 block dialog:", await dialogText(p));
  await shot(p, "T036");
  const conf = p.locator('[role="dialog"], [role="alertdialog"]').getByRole("button", { name: /Block/ }).last();
  say("T036 confirm:", T(await timedClick(p, conf, "confirm block")));
  await p.waitForTimeout(1200);
  say("T036 after block:", new URL(p.url()).pathname, await toastText(p), "|", await mainText(p, 400));
  // The blocked person's side.
  const c = await page(await context(b, { device: "phone", throttle: false }));
  await signIn(c, acc.helperC); await c.goto("/profile/uxp_tester"); await ready(c, 500);
  say("T036 helper C sees tester profile:", new URL(c.url()).pathname, await mainText(c, 300));
  await timedGoto(p, "/friends?tab=blocked"); await ready(p, 600);
  say("T036 blocked tab:", await mainText(p, 400));
  const unb = p.getByRole("button", { name: /Unblock/ }).first();
  say("T036 unblock:", T(await timedClick(p, unb, "Unblock")));
  await p.waitForTimeout(700);
  say("T036 unblock confirm:", await dialogText(p), await toastText(p));
  const conf2 = p.locator('[role="dialog"], [role="alertdialog"]').getByRole("button", { name: /Unblock/ }).last();
  if (await conf2.isVisible().catch(() => false)) say("T036 confirm unblock:", T(await timedClick(p, conf2, "confirm unblock")));
  await p.waitForTimeout(800);
  say("T036 after unblock:", await toastText(p), "|", await mainText(p, 300));
  await shot(p, "T036");
}
await b.close(); await sql.end();
