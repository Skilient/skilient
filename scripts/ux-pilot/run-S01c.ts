/** S01 part c: T004 follow-up (link on another device, finish), T010 (resume, taken username, big photo, Back), T011 (GitHub step), T012 (welcome, reduced motion), T013 (claim). */
import { launch, context, page, ready, accounts } from "./lib/browser.ts";
import { timedClick, setTask } from "./lib/timed.ts";
import { shot } from "./lib/shot.ts";
import { inspect } from "./lib/inspect.ts";
import { latest, codeFrom } from "./lib/mail.ts";
import { writeFileSync } from "node:fs";
import sharp from "sharp";
const say = (...x: unknown[]) => console.log(...x);
const A = accounts();
const b = await launch();
const textOf = async (p: any, n = 900) => (await inspect(p, n)).split("CONTROLS")[0];

async function signUp(p: any, email: string, name: string) {
  await p.goto("/signup"); await ready(p);
  await p.locator('input[name="fullName"]').fill(name);
  await p.locator('input[type="email"]').fill(email);
  await p.locator('input[name="password"]').fill("Nutech-Student-2026!");
  await p.getByRole("checkbox").first().click();
  const sent = Date.now();
  await p.getByRole("button", { name: "Create account" }).click();
  await p.waitForURL(/signup\/verify/, { timeout: 60_000 });
  await ready(p);
  const mail = await latest(email, sent - 5000);
  return mail;
}

// ---------- T004 follow-up ----------
setTask("T004");
if (!process.env.SKIP_T004) {
  const email = A.accounts.testerNew2.email;
  const c = await context(b, { device: "phone", throttle: false });
  const p = await page(c);
  // Resend a code (F01.08a) after the timer.
  await p.goto("/signin"); await ready(p);
  await p.getByLabel("University email").fill(email);
  await p.getByLabel("Password", { exact: true }).fill("Nutech-Student-2026!");
  const sent = Date.now();
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p.waitForURL(/verify/); await ready(p);
  const mail = await latest(email, 0); say("T004 new code sent on sign-in:", mail.receivedAt > sent - 3000);
  // Link on another device: press the button this time.
  const link = /href="([^"]*token_hash[^"]*)"/.exec(mail.html)?.[1]?.replace(/&amp;/g, "&");
  const o = await context(b, { device: "desktop", throttle: false });
  const q = await page(o);
  await q.goto(link!); await ready(q);
  say("T004 other device page:", await textOf(q, 400));
  say("T004 other device confirm", await timedClick(q, q.getByRole("button", { name: /Confirm my email/ }), "other device confirm", { timeout: 30_000 }));
  await ready(q);
  say("T004 other device after:", await textOf(q, 600));
  await shot(q, "T004");
  await o.close();
  // Back on the phone: the code screen, then refresh.
  await p.reload(); await ready(p);
  say("T004 phone after link used elsewhere:", await textOf(p, 600));
  await shot(p, "T004");
  await p.goto("/feed"); await ready(p);
  say("T004 phone /feed ->", new URL(p.url()).pathname);
  await c.close();
}

// ---------- T010 ----------
setTask("T010");
{
  const email = A.accounts.testerNew3.email;
  const c = await context(b, { device: "phone" });
  const p = await page(c);
  const mail = await signUp(p, email, "Rabia Third");
  await p.locator('input[autocomplete="one-time-code"], input[inputmode="numeric"]').first().click();
  await p.keyboard.type(codeFrom(mail.subject));
  await p.getByRole("button", { name: "Confirm email" }).click().catch(() => undefined);
  await p.waitForURL(/onboarding/, { timeout: 60_000 }); await ready(p);
  // Step 1.
  await p.locator("select").nth(0).selectOption({ label: "Software Engineering" });
  await p.locator('input[name="programme"]').fill("BS Software Engineering");
  await p.locator("select").nth(1).selectOption({ label: "Class of 2029" });
  await p.getByRole("button", { name: "Continue" }).click();
  await p.waitForURL(/onboarding\/profile/); await ready(p);
  // Step 2: taken username.
  await p.locator('input[name="username"]').fill("uxp_helper_a");
  await p.waitForTimeout(2500);
  say("T010 taken username:", await textOf(p, 700));
  await shot(p, "T010");
  // Big photo: 6000x6000 noisy PNG (~large).
  const big = "/tmp/claude-0/uxp/big.png";
  const raw = Buffer.alloc(4000 * 4000 * 3); for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) & 255;
  await sharp(raw, { raw: { width: 4000, height: 4000, channels: 3 } }).png({ compressionLevel: 0 }).toFile(big);
  say("T010 big photo bytes:", (await import("node:fs")).statSync(big).size);
  await p.locator('input[type="file"]').setInputFiles(big);
  await p.waitForTimeout(8000);
  say("T010 after big photo:", await textOf(p, 700));
  await shot(p, "T010");
  await p.locator('input[name="username"]').fill("rabia_third");
  await p.locator("textarea").first().fill("Building a hostel room-swap app.");
  // Back without saving: does step 2 keep what was typed?
  await p.getByRole("link", { name: "Back" }).click();
  await p.waitForURL(/onboarding\/university/); await ready(p);
  say("T010 step1 after Back: dept=", await p.locator("select").nth(0).inputValue(), "programme=", await p.locator('input[name="programme"]').inputValue());
  await p.getByRole("button", { name: "Continue" }).click();
  await p.waitForURL(/onboarding\/profile/); await ready(p);
  say("T010 step2 after Back+Continue: username=", await p.locator('input[name="username"]').inputValue(), "intro=", await p.locator("textarea").first().inputValue());
  await p.locator('input[name="username"]').fill("rabia_third");
  await p.waitForTimeout(2000);
  await p.getByRole("button", { name: "Continue" }).click();
  await p.waitForURL(/onboarding\/github/); await ready(p);
  // Close the browser mid-way.
  const state = await c.storageState();
  await c.close();
  const c2 = await context(b, { device: "phone" });
  await c2.addCookies(state.cookies);
  const p2 = await page(c2);
  await p2.goto("/"); await ready(p2);
  say("T010 reopen / ->", new URL(p2.url()).pathname, (await textOf(p2, 300)).slice(0, 300));
  await p2.goto("/feed"); await ready(p2);
  say("T010 reopen /feed ->", new URL(p2.url()).pathname);
  await shot(p2, "T010");
  // Finish the rest.
  for (let i = 0; i < 5 && !p2.url().includes("/done"); i++) {
    const btn = p2.getByRole("button", { name: /^(Skip for now|Continue|Finish)$/ }).last();
    await btn.click(); await p2.waitForTimeout(1500); await ready(p2);
  }
  say("T010 end at", new URL(p2.url()).pathname);
  // T011: what the Connect GitHub button does (from Settings later); here the onboarding step's link target.
  await c2.close();
}

// ---------- T011 ----------
setTask("T011");
{
  const c = await context(b, { device: "phone", throttle: false });
  const p = await page(c);
  await p.goto("/signin"); await ready(p);
  await p.getByLabel("University email").fill(A.accounts.testerNew3.email);
  await p.getByLabel("Password", { exact: true }).fill("Nutech-Student-2026!");
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p.waitForURL((u) => u.pathname !== "/signin"); await ready(p);
  await p.goto("/onboarding/github"); await ready(p);
  say("T011 github step at:", new URL(p.url()).pathname);
  const reqs: string[] = [];
  p.on("request", (r) => { if (r.isNavigationRequest()) reqs.push(r.url()); });
  await p.goto("/settings/github"); await ready(p);
  say("T011 settings/github:", await textOf(p, 900));
  await shot(p, "T011");
  const btn = p.getByRole("button", { name: /Connect GitHub/ }).or(p.getByRole("link", { name: /Connect GitHub/ })).first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click().catch(() => undefined);
    await p.waitForTimeout(4000);
  }
  say("T011 navigations:", reqs.map((u) => u.slice(0, 160)));
  await c.close();
}

// ---------- T012 ----------
setTask("T012");
{
  const c = await context(b, { device: "phone", reducedMotion: "reduce" });
  const p = await page(c);
  await p.goto("/signin"); await ready(p);
  await p.getByLabel("University email").fill(A.accounts.testerNew.email);
  await p.getByLabel("Password", { exact: true }).fill("Nutech-Student-2026!");
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p.waitForURL((u) => u.pathname !== "/signin"); await ready(p);
  await p.goto("/onboarding/done"); await ready(p, 0);
  const anim = await p.evaluate(() => document.getAnimations().map((a) => `${(a as any).animationName ?? a.constructor.name}:${(a.effect as any)?.getTiming?.().duration}`).slice(0, 20));
  say("T012 running animations (reduce):", anim.length, anim.slice(0, 8));
  await shot(p, "T012");
  await p.waitForTimeout(4000);
  say("T012 welcome:", await textOf(p, 800));
  await shot(p, "T012");
  say("T012 skip", await timedClick(p, p.getByRole("link", { name: "Skip to Home" }), "Skip to Home", { timeout: 40_000 }));
  await ready(p);
  say("T012 home:", await textOf(p, 900));
  await shot(p, "T012");
  await c.close();
  const c2 = await context(b, { device: "phone", throttle: false });
  const p2 = await page(c2);
  await p2.goto("/signin"); await ready(p2);
  await p2.getByLabel("University email").fill(A.accounts.testerNew.email);
  await p2.getByLabel("Password", { exact: true }).fill("Nutech-Student-2026!");
  await p2.getByRole("button", { name: "Sign in", exact: true }).click();
  await p2.waitForURL((u) => u.pathname !== "/signin"); await ready(p2);
  await p2.goto("/onboarding/done"); await p2.waitForTimeout(300);
  const anim2 = await p2.evaluate(() => document.getAnimations().length);
  say("T012 running animations (no preference):", anim2);
  await c2.close();
}

// ---------- T013 ----------
setTask("T013");
{
  const email = "uxp-claim@nutech.edu.pk";
  const c = await context(b, { device: "phone", throttle: false });
  const p = await page(c);
  const mail = await signUp(p, email, "Kashif Claimer");
  await p.locator('input[autocomplete="one-time-code"], input[inputmode="numeric"]').first().click();
  await p.keyboard.type(codeFrom(mail.subject));
  await p.getByRole("button", { name: "Confirm email" }).click().catch(() => undefined);
  await p.waitForURL(/onboarding/, { timeout: 60_000 }); await ready(p);
  await p.locator("select").nth(0).selectOption({ label: "Computer Science" });
  await p.locator('input[name="programme"]').fill("BS CS");
  await p.locator("select").nth(1).selectOption({ label: "Class of 2028" });
  await p.getByRole("button", { name: "Continue" }).click(); await p.waitForURL(/profile/); await ready(p);
  await p.locator('input[name="username"]').fill("kashif_claims"); await p.waitForTimeout(2000);
  await p.getByRole("button", { name: "Continue" }).click(); await p.waitForURL(/github/); await ready(p);
  for (let i = 0; i < 5 && !p.url().includes("/done"); i++) {
    await p.getByRole("button", { name: /^(Skip for now|Continue|Finish)$/ }).last().click(); await p.waitForTimeout(1500); await ready(p);
  }
  await p.waitForTimeout(3000);
  say("T013 welcome:", await textOf(p, 1200));
  await shot(p, "T013");
  const claim = p.getByRole("button", { name: /claim/i }).first();
  if (await claim.isVisible().catch(() => false)) {
    say("T013 claim", await timedClick(p, claim, "claim entries", { timeout: 30_000 }));
    await p.waitForTimeout(1500);
    say("T013 after claim:", await textOf(p, 800));
    await shot(p, "T013");
  }
  await p.goto("/me/record"); await ready(p);
  say("T013 record:", await textOf(p, 1200));
  await shot(p, "T013");
  await c.close();
}
await b.close();
