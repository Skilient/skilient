/**
 * Probe 5 (H03): every destructive or hiding control on the student and officer pages (catalogued by label), what
 * each does when used (confirm dialog, native confirm, undo toast, or nothing) on throwaway data, Esc on every
 * dialog and sheet we can open, and Back in steppers keeping input. Observations from the task runs are merged in
 * (marked source "task"). Raw results under "destructive".
 */
import { launch, context, page, ready, signIn, accounts } from "../lib/browser.ts";
import { sql, asUser, dialogText, toastText } from "../lib/act.ts";
import { routes, save } from "./lib.ts";
const A = accounts(); const acc = A.accounts; const ids = A.ids;
const WORDS = /\b(delete|remove|leave|unfriend|revoke|abandon|cancel|hide|block|decline|reject|disconnect|unfollow|withdraw|drop|dismiss|mute|turn off|sign out)\b/i;
const all = await routes();
const b = await launch();
const pageAs = async (who: string | null, device: "phone" | "desktop" = "phone") => { const p = await page(await context(b, { device, throttle: false })); if (who) await signIn(p, acc[who]); await ready(p, 200); return p; };

// 1. Catalogue.
const catalogue: Record<string, string[]> = {};
for (const who of ["tester", "officer1"]) {
  const p = await pageAs(who, "desktop");
  p.on("dialog", (d) => d.dismiss());
  for (const r of all.filter((x) => x.role === "student" && (x.who === who || (who === "tester" && x.who === "tester")))) {
    await p.goto(r.url, { waitUntil: "domcontentloaded" }).catch(() => undefined); await ready(p, 200);
    const labels = await p.evaluate((src) => { const re = new RegExp(src, "i"); return Array.from(document.querySelectorAll("main a[href], main button, main summary")).filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => ((e.getAttribute("aria-label") || (e as HTMLElement).innerText) ?? "").trim().replace(/\s+/g, " ")).filter((t) => t && re.test(t)); }, WORDS.source);
    if (labels.length) catalogue[r.route] = [...new Set([...(catalogue[r.route] ?? []), ...labels.map((l) => l.replace(/:.*$/, "").replace(/ (Ali|Bushra|Fatima|Danish|Sana|Chaudhry|Iqra|Hamza|Ayesha)\b.*$/, " <name>"))])];
  }
  await p.context().close();
}

// 2. Live use on throwaway data (tester-fresh, a throwaway post, comment, message, follow).
const live: any[] = [];
const f = await pageAs("testerFresh");
const native: string[] = []; f.on("dialog", async (d) => { native.push(d.message()); await d.dismiss(); });
const observe = async (label: string, route: string, click: () => Promise<void>) => {
  native.length = 0;
  await click().catch((e) => live.push({ label, route, error: e.message.split("\n")[0] }));
  await f.waitForTimeout(900);
  const dlg = await dialogText(f, 250); const toast = await toastText(f);
  const rec = { label, route, confirm: dlg !== "(no dialog)" ? `dialog: ${dlg}` : native.length ? `native confirm: ${native[0]}` : "none", undo: /undo/i.test(toast) ? toast : "", toast };
  if (dlg !== "(no dialog)") { await f.keyboard.press("Escape"); await f.waitForTimeout(300); (rec as any).escCloses = (await dialogText(f, 50)) === "(no dialog)"; }
  live.push(rec); console.log(JSON.stringify(rec));
};
const postBody = `[UX test] throwaway ${Date.now().toString(36)}`;
const postId = await asUser(acc.testerFresh.id, `select public.create_post($1::text::jsonb)`, [JSON.stringify({ type: "general", audience: "university", body: postBody })]).catch(() => null);
if (postId) {
  await asUser(acc.testerFresh.id, `select public.add_comment($1, null, 'throwaway comment')`, [postId]).catch(() => null);
  await f.goto(`/post/${postId}`); await ready(f, 300);
  await observe("Delete (comment)", "/post/[id]", async () => { await f.locator("main").getByRole("button", { name: /^Delete$/ }).last().click(); });
  await f.goto(`/post/${postId}`); await ready(f, 300);
  await observe("Delete (post)", "/post/[id]", async () => { await f.locator("main").getByRole("button", { name: /^Delete/ }).first().click(); });
}
await f.goto(`/societies/${ids.societies.request.slug}`); await ready(f, 300);
const fol = f.locator("main").getByRole("button", { name: /^Follow$/ }); if (await fol.isVisible().catch(() => false)) { await fol.click(); await f.waitForTimeout(800); }
await observe("Following → unfollow (society)", "/societies/[slug]", async () => { await f.locator("main").getByRole("button", { name: /^Following$/ }).click(); });
await f.goto("/friends"); await ready(f, 300);
await observe("Dismiss suggestion", "/friends", async () => { await f.locator("main").getByRole("button", { name: /^Dismiss/ }).first().click(); });
await f.goto("/me/paths"); await ready(f, 300);
const fp = f.getByTestId("follow-data"); if (await fp.isVisible().catch(() => false)) { await fp.click(); await f.waitForTimeout(800); }
await observe("Unfollow (path)", "/me/paths", async () => { await f.getByTestId("unfollow-data").click(); });
await f.goto("/settings/security"); await ready(f, 300);
await observe("Sign out of all devices", "/settings/security", async () => { await f.locator("main").getByRole("button", { name: /Sign out of all/ }).click(); });
await f.context().close();

// 3. Esc on dialogs and sheets (tester), with focus return.
const esc: any[] = [];
const t = await pageAs("tester");
t.on("dialog", (d) => d.dismiss());
const tryEsc = async (name: string, url: string, open: () => Promise<void>) => {
  await t.goto(url); await ready(t, 300);
  try { await open(); } catch (e: any) { esc.push({ name, error: e.message.split("\n")[0] }); return; }
  await t.waitForTimeout(700);
  const opened = (await dialogText(t, 40)) !== "(no dialog)" || await t.locator('[role="menu"], [role="listbox"]').first().isVisible().catch(() => false);
  await t.keyboard.press("Escape"); await t.waitForTimeout(500);
  const closed = (await dialogText(t, 40)) === "(no dialog)" && !(await t.locator('[role="menu"]').first().isVisible().catch(() => false));
  const focus = await t.evaluate(() => (document.activeElement?.getAttribute("aria-label") || (document.activeElement as HTMLElement)?.innerText || document.activeElement?.tagName || "").slice(0, 40));
  esc.push({ name, opened, closed, focusAfter: focus }); console.log("esc", name, opened, closed, focus);
};
await tryEsc("progress sheet", "/feed", async () => t.getByRole("button", { name: /next step/i }).first().click());
await tryEsc("share sheet", `/post/${ids.posts.text}`, async () => t.locator("main").getByRole("button", { name: "Share" }).first().click());
await tryEsc("post ⋯ menu", "/feed", async () => t.locator("main").getByRole("button", { name: "More for this post" }).first().click());
await tryEsc("report sheet", `/profile/uxp_helper_d`, async () => t.locator("main").getByRole("button", { name: "Report" }).first().click());
await tryEsc("block dialog", `/profile/uxp_helper_d`, async () => t.locator("main").getByRole("button", { name: "Block" }).first().click());
await tryEsc("apply sheet", `/ventures/${ids.otherUniVenture}`, async () => t.locator("main").getByRole("button", { name: /Apply/ }).first().click());
await tryEsc("register sheet", `/events/${ids.events.hackathon}`, async () => t.locator("main").getByRole("button", { name: /^Register/ }).first().click());
await tryEsc("account menu", "/feed", async () => t.getByRole("button", { name: "Account menu" }).click());
await tryEsc("Ctrl K", "/feed", async () => t.keyboard.press("Control+k"));
await tryEsc("skill drawer", "/me/skills", async () => t.locator("main").getByRole("button", { name: /^SQL/ }).first().click());
await tryEsc("log contribution", `/ventures/${ids.helperVenture}/contributions`, async () => t.locator("main").getByRole("button", { name: "Log contribution" }).click());
await t.context().close();

// 4. Back in steppers keeps input.
const steppers: any[] = [];
const o = await pageAs("officer2");
await o.goto("/societies/new"); await ready(o, 300);
const hasForm = await o.locator("main").getByRole("textbox").first().isVisible().catch(() => false);
if (hasForm) {
  await o.locator("main").getByRole("textbox").first().fill("[UX test] Back check"); await o.locator("main select").first().selectOption({ index: 2 });
  await o.getByRole("button", { name: "Continue" }).click(); await o.waitForTimeout(500);
  await o.locator("main textarea").first().fill("About text typed on step 2.");
  await o.getByRole("button", { name: "Back" }).click(); await o.waitForTimeout(500);
  const name = await o.locator("main").getByRole("textbox").first().inputValue();
  await o.getByRole("button", { name: "Continue" }).click(); await o.waitForTimeout(500);
  steppers.push({ stepper: "/societies/new", step1Kept: name === "[UX test] Back check", step2Kept: (await o.locator("main textarea").first().inputValue()) === "About text typed on step 2." });
} else steppers.push({ stepper: "/societies/new", note: "officer-2 has a request open; stepper not shown" });
await o.context().close();
const ev = await pageAs("officer1", "desktop");
await ev.goto(`/societies/${ids.societies.open.slug}/events/new`); await ready(ev, 300);
await ev.locator("main").getByLabel("Title").fill("[UX test] Back check event"); await ev.locator("main").getByLabel("Description").fill("Desc.");
await ev.locator("main").getByRole("button", { name: "Continue" }).click(); await ev.waitForTimeout(400);
await ev.locator("main").getByLabel("Place", { exact: true }).fill("Room 9");
await ev.locator("main").getByRole("button", { name: "Back" }).click(); await ev.waitForTimeout(400);
const evTitle = await ev.locator("main").getByLabel("Title").inputValue();
await ev.locator("main").getByRole("button", { name: "Continue" }).click(); await ev.waitForTimeout(400);
steppers.push({ stepper: "/societies/[slug]/events/new", step1Kept: evTitle === "[UX test] Back check event", step2Kept: (await ev.locator("main").getByLabel("Place", { exact: true }).inputValue()) === "Room 9" });
await ev.goBack(); await ready(ev, 300);
steppers.push({ stepper: "/societies/[slug]/events/new (browser Back)", leftPage: new URL(ev.url()).pathname });
await ev.context().close();
steppers.push({ stepper: "/onboarding (Back link)", step1Kept: true, step2Kept: false, source: "task T010" });

// 5. Observations from the task runs.
const fromTasks = [
  ["Unfriend", "/friends", "dialog"], ["Block / Unblock", "/profile, /friends", "dialog"], ["Delete post", "/post/[id]", "dialog"], ["Delete chat message", "/chat/[id]", "none"],
  ["Not for me", "post ⋯", "undo toast"], ["Mute person", "post ⋯", "undo toast"], ["Mute chat", "/chat/[id]", "none (Unmute)"], ["Hide endorsement", "/profile", "none (Show)"],
  ["Revoke Record share link", "/me/record", "none"], ["Abandon venture", "manage", "dialog"], ["Make owner", "team", "dialog"], ["Mark complete", "manage", "dialog"],
  ["Accept / Decline application", "/requests", "none"], ["Confirm contribution", "contributions", "none"], ["Exclude repository", "/settings/github", "none (switch back)"],
  ["Leave society", "/societies/[slug]", "native confirm"], ["Cancel registration", "ticket", "native confirm"], ["End swap", "/swaps/[id]", "native confirm"],
  ["Cancel the event", "manage messages", "none"], ["Offer the handover", "society manage", "none"], ["Issue now", "close-out", "none"], ["Decline induction applicant", "round", "none"],
  ["Start account deletion", "/settings/account/delete", "type username + 14-day cancel"], ["Turn off two-factor", "/settings/security", "dialog"], ["Sign out of all devices", "/settings/security", "dialog"],
].map(([label, where, how]) => ({ label, where, how, source: "task" }));
const withWayBack = [...live.map((l) => l.confirm !== "none" || l.undo), ...fromTasks.map((x) => x.how !== "none")];
save("destructive", { catalogue, live, fromTasks, esc, steppers, controlsJudged: withWayBack.length, withConfirmUndoOrWayBack: withWayBack.filter(Boolean).length });
await b.close(); await sql.end();
