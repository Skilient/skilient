/** S01 part a: T001 (sign up), T002 (wrong emails), T003 (Google), T004 (mistakes on purpose). Prints what the tester saw. */
import { launch, context, page, accounts, ready } from "./lib/browser.ts";
import { timedClick, setTask } from "./lib/timed.ts";
import { shot } from "./lib/shot.ts";
import { inspect } from "./lib/inspect.ts";
import { latest, codeFrom } from "./lib/mail.ts";

const A = accounts();
const b = await launch();
const say = (...x: unknown[]) => console.log(...x);

// ---------- T001 ----------
setTask("T001");
{
  const ctx = await context(b, { device: "phone" });
  const p = await page(ctx);
  const t0 = Date.now();
  await p.goto("/"); await ready(p);
  say("T001 landing load ms", Date.now() - t0);
  await shot(p, "T001");
  const email = A.accounts.testerNew.email;
  const hero = p.getByRole("textbox", { name: /university email/i }).first();
  await hero.fill(email);
  say("T001 join", await timedClick(p, p.getByRole("button", { name: "Join" }).first(), "landing Join"));
  await ready(p);
  say(await inspect(p, 900));
  await shot(p, "T001");
  // Fill the form.
  const name = p.locator('input[name="fullName"]');
  if (await name.isVisible().catch(() => false)) await name.fill("Nida Newcomer");
  const em = p.locator('input[type="email"]').first();
  say("T001 email prefilled:", await em.inputValue().catch(() => "?"));
  if (!(await em.inputValue())) await em.fill(email);
  await p.locator('input[name="password"]').fill("Nutech-Student-2026!");
  // Open the agreement.
  say("T001 agreement open", await timedClick(p, p.getByRole("button", { name: /User Agreement and Privacy Notice/ }), "open agreement"));
  const dlg = p.getByRole("dialog");
  await dlg.waitFor({ timeout: 15_000 }).catch(() => say("T001 no dialog appeared"));
  say("T001 sheet:", (await dlg.innerText().catch(() => "")).slice(0, 700));
  await shot(p, "T001");
  await p.keyboard.press("Escape");
  await p.getByRole("checkbox").first().click();
  await p.locator('input[name="fullName"]').fill("Nida Newcomer");
  await p.locator('input[name="password"]').fill("Nutech-Student-2026!");
  const sent = Date.now();
  say("T001 create", await timedClick(p, p.getByRole("button", { name: "Create account" }), "Create account", { timeout: 40_000 }));
  await p.waitForTimeout(1500);
  say(await inspect(p, 900));
  await shot(p, "T001");
  const mail = await latest(email, sent - 5000);
  say("T001 email arrived after ms", mail.receivedAt - sent, "subject:", mail.subject);
  const code = codeFrom(mail.subject + " " + mail.text);
  const boxes = p.locator('input[autocomplete="one-time-code"], input[inputmode="numeric"]');
  say("T001 code inputs:", await boxes.count());
  await boxes.first().click();
  await p.keyboard.type(code);
  const btn = p.getByRole("button", { name: /confirm|verify|continue/i }).first();
  if (await btn.isVisible().catch(() => false) && !p.url().includes("onboarding")) say("T001 confirm", await timedClick(p, btn, "confirm code", { timeout: 40_000 }));
  await p.waitForURL(/onboarding|agreement|feed/, { timeout: 60_000 }).catch(() => undefined);
  await p.waitForTimeout(1500);
  say(await inspect(p, 900));
  await shot(p, "T001");
  await ctx.storageState({ path: "/tmp/claude-0/uxp/tester-new.json" });
  await ctx.close();
}

// ---------- T002 ----------
setTask("T002");
{
  const ctx = await context(b, { device: "phone", throttle: false });
  const p = await page(ctx);
  for (const [label, email] of [["gmail", "nida.newcomer@gmail.com"], ["typo", "uxp-typo@nutech.edu.pkk"], ["typo2", "uxp-typo@nutec.edu.pk"], ["used", A.accounts.tester.email]]) {
    await p.goto("/signup"); await ready(p);
    await p.locator('input[name="fullName"]').fill("Nida Newcomer");
    await p.locator('input[type="email"]').fill(email);
    await p.locator('input[type="email"]').blur();
    await p.waitForTimeout(1200);
    say(`T002 ${label} after blur:`, (await inspect(p, 900)).split("CONTROLS")[0]);
    await p.locator('input[name="password"]').fill("Nutech-Student-2026!");
    await p.getByRole("checkbox").first().click();
    say(`T002 ${label} submit`, await timedClick(p, p.getByRole("button", { name: "Create account" }), `submit ${label}`, { timeout: 30_000 }));
    await p.waitForTimeout(1500);
    say(`T002 ${label} after submit:`, (await inspect(p, 1000)).split("CONTROLS")[0]);
    await shot(p, "T002");
  }
  // A shared domain (F01.04b): is there one?
  await ctx.close();
}

// ---------- T003 ----------
setTask("T003");
{
  const ctx = await context(b, { device: "phone", throttle: false });
  const p = await page(ctx);
  await p.goto("/signup"); await ready(p);
  const [req] = await Promise.all([p.waitForEvent("request", (r) => /google|authorize|oauth/.test(r.url()), { timeout: 15_000 }).catch(() => null), p.getByRole("button", { name: "Continue with Google" }).click()]);
  await p.waitForTimeout(3000);
  say("T003 google request:", req?.url().slice(0, 200), "now at", p.url().slice(0, 200));
  say((await inspect(p, 600)).split("CONTROLS")[0]);
  await shot(p, "T003");
  await ctx.close();
}

// ---------- T004 ----------
setTask("T004");
{
  const ctx = await context(b, { device: "phone" });
  const p = await page(ctx);
  const email = A.accounts.testerNew2.email;
  await p.goto("/signup"); await ready(p);
  await p.locator('input[name="fullName"]').fill("Usman Second");
  await p.locator('input[type="email"]').fill(email);
  await p.locator('input[name="password"]').fill("Nutech-Student-2026!");
  say("T004 no agreement", await timedClick(p, p.getByRole("button", { name: "Create account" }), "submit without agreement"));
  await p.waitForTimeout(800);
  say((await inspect(p, 900)).split("CONTROLS")[0]);
  const inv = await p.evaluate(() => Array.from(document.querySelectorAll("[aria-invalid=true]")).map((e) => `${e.getAttribute("name")} desc=${e.getAttribute("aria-describedby")}`));
  say("T004 aria-invalid:", inv);
  await shot(p, "T004");
  await p.getByRole("checkbox").first().click();
  await p.locator('input[name="password"]').fill("password1");
  say("T004 weak password", await timedClick(p, p.getByRole("button", { name: "Create account" }), "submit password1", { timeout: 30_000 }));
  await p.waitForTimeout(1500);
  say((await inspect(p, 900)).split("CONTROLS")[0]);
  say("T004 aria-invalid:", await p.evaluate(() => Array.from(document.querySelectorAll("[aria-invalid=true]")).map((e) => `${e.getAttribute("name")} desc=${e.getAttribute("aria-describedby")}`)));
  const vis = await p.evaluate(() => { const el = document.querySelector("[role=alert], [aria-invalid=true]"); if (!el) return "none"; const r = el.getBoundingClientRect(); return `top=${Math.round(r.top)} bottom=${Math.round(r.bottom)} vh=${innerHeight}`; });
  say("T004 message position", vis);
  await shot(p, "T004");
  await p.locator('input[name="password"]').fill("Nutech-Student-2026!");
  const sent = Date.now();
  say("T004 create", await timedClick(p, p.getByRole("button", { name: "Create account" }), "Create account", { timeout: 40_000 }));
  await p.waitForTimeout(1500);
  const mail = await latest(email, sent - 5000);
  const code = codeFrom(mail.subject + " " + mail.text);
  const wrong = code === "111111" ? "222222" : "111111";
  const boxes = p.locator('input[autocomplete="one-time-code"], input[inputmode="numeric"]');
  for (let i = 1; i <= 2; i++) {
    await boxes.first().click();
    await p.keyboard.press("Control+A").catch(() => undefined);
    for (let k = 0; k < 6; k++) await p.keyboard.press("Backspace");
    await p.keyboard.type(wrong);
    const btn = p.getByRole("button", { name: /confirm|verify|continue/i }).first();
    if (await btn.isVisible().catch(() => false)) say(`T004 wrong code ${i}`, await timedClick(p, btn, `wrong code ${i}`, { timeout: 30_000 }));
    await p.waitForTimeout(2000);
    say((await inspect(p, 900)));
    await shot(p, "T004");
  }
  // The emailed link, opened on another device.
  const link = /href="([^"]*(?:token_hash|verify)[^"]*)"/.exec(mail.html)?.[1]?.replace(/&amp;/g, "&");
  say("T004 link:", link?.slice(0, 160));
  if (link) {
    const other = await context(b, { device: "desktop", throttle: false });
    const q = await page(other);
    await q.goto(link).catch((e) => say("goto failed", e.message)); await ready(q);
    await q.waitForTimeout(2500);
    say("T004 other device:", (await inspect(q, 900)));
    await shot(q, "T004");
    await other.close();
  }
  await ctx.close();
  // Come back later and sign in.
  const later = await context(b, { device: "phone", throttle: false });
  const r = await page(later);
  await r.goto("/signin"); await ready(r);
  await r.getByLabel("University email").fill(email);
  await r.getByLabel("Password", { exact: true }).fill("Nutech-Student-2026!");
  say("T004 sign in later", await timedClick(r, r.getByRole("button", { name: "Sign in", exact: true }), "sign in later", { timeout: 40_000 }));
  await r.waitForTimeout(2000);
  say((await inspect(r, 900)));
  await shot(r, "T004");
  await later.close();
}
await b.close();
