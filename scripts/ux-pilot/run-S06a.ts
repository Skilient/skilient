/** S06 part a: sign in/out and recovery (T005-T008), devices (T063), delete account (T064). Throwaway accounts only. */
import { launch, context, page, ready, signIn, accounts, totp } from "./lib/browser.ts";
import { timedClick, setTask, timedGoto } from "./lib/timed.ts";
import { shot } from "./lib/shot.ts";
import { latest, codeFrom } from "./lib/mail.ts";
import { sql, mainText, dialogText, toastText } from "./lib/act.ts";
const say = (...x: unknown[]) => console.log(...x);
const A = accounts(); const acc = A.accounts;
const ONLY = process.env.ONLY?.split(","); const run = (id: string) => !ONLY || ONLY.includes(id);
const T = (t: any) => `${t.kind} pending=${t.pendingMs} result=${t.resultMs} "${String(t.shown).replace(/\n/g, " ").slice(0, 160)}"`;
const b = await launch();
const nida = { email: acc.testerNew.email, password: "Nutech-Student-2026!", fullName: "Nida Newcomer", username: "nida_new", id: "" };
let pw = nida.password;
const [{ n: changed }] = await sql`select count(*)::int as n from public.profiles where username = 'nida_new' and bio = 'pw2'`;
if (changed) pw = "Nutech-Student-2026!new";
const ctx = await context(b, { device: "phone" });
const p = await page(ctx);
const btn = (name: RegExp | string) => p.getByRole("button", { name }).first();
const signInForm = async (pass: string) => {
  await p.goto("/signin"); await ready(p, 300);
  await p.getByLabel("University email").fill(nida.email);
  await p.getByLabel("Password", { exact: true }).fill(pass);
  return timedClick(p, p.getByRole("button", { name: "Sign in", exact: true }), "sign in", { timeout: 40_000 });
};

if (run("T005")) {
  setTask("T005");
  say("T005 sign in:", T(await signInForm(pw))); await ready(p, 600);
  await p.getByRole("button", { name: "Account menu" }).click(); await p.waitForTimeout(600);
  say("T005 account menu:", (await p.locator('[role="menu"], [role="dialog"]').last().innerText().catch(() => "")).replace(/\n+/g, " | "));
  const out = p.getByRole("menuitem", { name: /Sign out/ }).or(p.getByRole("button", { name: /Sign out/ })).first();
  say("T005 sign out:", T(await timedClick(p, out, "sign out", { timeout: 30_000 })));
  await ready(p, 500);
  say("T005 after sign out:", new URL(p.url()).pathname, (await mainText(p, 200)));
  await timedGoto(p, "/signin"); await ready(p, 300);
  say("T005 code link:", T(await timedClick(p, p.getByRole("link", { name: /sign-in code/ }), "Email me a sign-in code")));
  await ready(p, 400);
  say("T005 code page:", await mainText(p, 400));
  await p.locator('input[type="email"]').fill(nida.email);
  const sent = Date.now();
  say("T005 send code:", T(await timedClick(p, p.getByRole("button", { name: /send|code|continue/i }).last(), "send sign-in code", { timeout: 30_000 })));
  await ready(p, 400);
  const mail = await latest(nida.email, sent - 2000);
  say("T005 email after ms", mail.receivedAt - sent, "subject:", mail.subject);
  await p.locator('input[autocomplete="one-time-code"], input[inputmode="numeric"]').first().fill(codeFrom(mail.subject + " " + mail.text));
  const go = p.getByRole("button", { name: /sign in|confirm|verify|continue/i }).last();
  if (await go.isVisible().catch(() => false)) say("T005 enter code:", T(await timedClick(p, go, "sign in with code", { timeout: 30_000 })));
  await ready(p, 800);
  say("T005 landed:", new URL(p.url()).pathname);
  await shot(p, "T005");
}

if (run("T006")) {
  setTask("T006");
  await p.context().clearCookies();
  say("T006 wrong pw:", T(await signInForm(pw + "x"))); await p.waitForTimeout(800);
  say("T006 message:", await mainText(p, 300));
  await shot(p, "T006");
  const t0 = Date.now();
  await p.getByRole("link", { name: /Forgot password/ }).click(); await p.waitForURL(/forgot-password/); await ready(p, 400);
  say("T006 forgot page:", await mainText(p, 300), "| email prefilled:", await p.locator('input[type="email"]').inputValue());
  await p.locator('input[type="email"]').fill(nida.email);
  const sent = Date.now();
  say("T006 send reset:", T(await timedClick(p, p.getByRole("button", { name: /send|reset|email/i }).last(), "send reset link", { timeout: 30_000 })));
  await p.waitForTimeout(800); say("T006 after send:", await mainText(p, 300));
  const mail = await latest(nida.email, sent - 2000);
  say("T006 reset email:", mail.subject, "| from-line text:", mail.text.slice(0, 300).replace(/\n+/g, " / "));
  const link = /href="([^"]*token_hash[^"]*)"/.exec(mail.html)?.[1]?.replace(/&amp;/g, "&") ?? /(http\S*token_hash\S*)/.exec(mail.text)?.[1];
  say("T006 link:", link?.slice(0, 120));
  await p.goto(link!); await ready(p, 600);
  say("T006 link page:", new URL(p.url()).pathname, await mainText(p, 300));
  const cont = p.getByRole("button", { name: /continue|reset|set/i }).first();
  if (await cont.isVisible().catch(() => false) && !(await p.locator('input[type="password"]').count())) { await cont.click(); await ready(p, 600); say("T006 after continue:", new URL(p.url()).pathname, await mainText(p, 300)); }
  const npw = "Nutech-Student-2026!new";
  const pws = p.locator('input[type="password"]');
  for (let i = 0; i < (await pws.count()); i++) await pws.nth(i).fill(npw);
  say("T006 set new:", T(await timedClick(p, p.getByRole("button", { name: /save|set|change|update|reset/i }).last(), "set new password", { timeout: 30_000 })));
  await ready(p, 600);
  say("T006 after set:", new URL(p.url()).pathname, await mainText(p, 200), "| total ms", Date.now() - t0);
  await sql`update public.profiles set bio = 'pw2' where username = 'nida_new'`; pw = npw;
  const q = await page(await context(b, { device: "phone", throttle: false }));
  await q.goto(link!); await ready(q, 500);
  const c2 = q.getByRole("button", { name: /continue|reset|set/i }).first();
  if (await c2.isVisible().catch(() => false)) { await c2.click(); await ready(q, 600); }
  say("T006 second open:", new URL(q.url()).pathname, await mainText(q, 300));
  await shot(q, "T006");
}

if (run("T007")) {
  setTask("T007");
  await p.context().clearCookies(); await signInForm(pw); await ready(p, 500);
  await timedGoto(p, "/settings/security"); await ready(p, 500);
  say("T007 setup:", T(await timedClick(p, btn("Set up two-factor"), "Set up two-factor")));
  await p.waitForTimeout(1000);
  say("T007 setup screen:", await dialogText(p, 900), "|", (await mainText(p, 900)).split("Two-factor sign-in | ")[1]?.slice(0, 700));
  await shot(p, "T007");
  const secret = (await p.locator("code").first().textContent())?.trim() ?? "";
  await p.getByLabel("Code from the app").fill(totp(secret));
  say("T007 confirm:", T(await timedClick(p, btn("Confirm"), "confirm two-factor")));
  await p.waitForTimeout(1000);
  say("T007 backup codes:", (await mainText(p, 1200)).split("Two-factor sign-in | ")[1]?.slice(0, 600));
  await p.getByRole("checkbox", { name: "I've saved these codes" }).check().catch(() => undefined);
  await btn("Done").click().catch(() => undefined);
  await p.context().clearCookies();
  await signInForm(pw); await ready(p, 600);
  say("T007 after password:", new URL(p.url()).pathname, await mainText(p, 400));
  await shot(p, "T007");
  const lost = await p.getByRole("link", { name: /lost|backup|can't|recover/i }).allInnerTexts().catch(() => []);
  say("T007 lost-phone links:", lost, (await mainText(p, 800)).split(" | ").filter((l) => /lost|backup|phone|recover/i.test(l)));
  await p.locator("input").first().fill(totp(secret, Date.now() + 30_000));
  const v = p.getByRole("button", { name: /verify|continue|sign in/i }).last();
  if (await v.isVisible().catch(() => false)) say("T007 verify:", T(await timedClick(p, v, "enter authenticator code", { timeout: 30_000 })));
  await ready(p, 600);
  say("T007 landed:", new URL(p.url()).pathname);
  // Turn it off again so later tasks can sign in without it.
  await p.goto("/settings/security"); await ready(p, 500);
  say("T007 security now:", (await mainText(p, 1500)).split("Two-factor sign-in | ")[1]?.slice(0, 500));
  const off = p.getByRole("button", { name: /Turn off|Remove|Disable/ }).first();
  if (await off.isVisible().catch(() => false)) { await off.click(); await p.waitForTimeout(600); say("T007 turn off dialog:", await dialogText(p, 400)); const c = p.locator('[role="dialog"], [role="alertdialog"]').getByRole("button", { name: /Turn off|Remove|Disable/ }).last(); if (await c.isVisible().catch(() => false)) await c.click(); }
}

if (run("T008")) {
  setTask("T008");
  // The team publishes a new agreement version (no ops screen for this; plain SQL on the local DB).
  const [{ v }] = await sql`select max(version)::int as v from public.agreement_versions where published_at is not null`;
  const [cur] = await sql`select title, body_md from public.agreement_versions where version = ${v}`;
  if (!(await sql`select 1 from public.agreement_versions where summary_md like 'UX pilot%'`).length) {
    await sql`insert into public.agreement_versions (version, title, body_md, summary_md, published_at)
              values (${v + 1}, ${cur.title}, ${cur.body_md + "\n\n## Event check-in\nSocieties may check you in by email at their events."}, ${"UX pilot: societies can now check you in at events with your university email, and those entries wait for you on your Record."}, now())`;
  }
  await p.context().clearCookies(); const t = await signInForm(pw); say("T008 sign in:", T(t)); await ready(p, 600);
  say("T008 landed:", new URL(p.url()).pathname, await mainText(p, 900));
  await shot(p, "T008");
  const cb = p.getByRole("checkbox").first(); if (await cb.isVisible().catch(() => false)) await cb.click();
  const accept = p.getByRole("button", { name: /accept|agree|continue/i }).last();
  say("T008 accept:", T(await timedClick(p, accept, "accept new agreement", { timeout: 30_000 })));
  await ready(p, 500); say("T008 after:", new URL(p.url()).pathname);
  const other = await p.getByRole("link", { name: /decline|delete|don't agree|leave/i }).allInnerTexts().catch(() => []);
  say("T008 other choices:", other);
}

if (run("T063")) {
  setTask("T063");
  // A second device signs in first.
  const other = await page(await context(b, { device: "desktop", throttle: false }));
  await other.goto("/signin"); await ready(other, 300);
  await other.getByLabel("University email").fill(nida.email); await other.getByLabel("Password", { exact: true }).fill(pw);
  await other.getByRole("button", { name: "Sign in", exact: true }).click(); await other.waitForURL((u) => u.pathname !== "/signin"); await ready(other, 300);
  await timedGoto(p, "/settings/security"); await ready(p, 600);
  say("T063 devices:", (await mainText(p, 2000)).split("Signed-in devices | ")[1]?.slice(0, 700));
  await shot(p, "T063");
  const all = btn(/Sign out of all|Sign out other|everywhere/);
  say("T063 sign out others:", T(await timedClick(p, all, "sign out everywhere")), await dialogText(p, 400));
  const c = p.locator('[role="dialog"], [role="alertdialog"]').getByRole("button", { name: /Sign out/ }).last();
  if (await c.isVisible().catch(() => false)) say("T063 confirm:", T(await timedClick(p, c, "confirm sign out everywhere", { timeout: 30_000 })));
  await ready(p, 600);
  say("T063 this phone after:", new URL(p.url()).pathname, await toastText(p));
  await other.reload(); await ready(other, 500); say("T063 other device after reload:", new URL(other.url()).pathname);
  // Two tabs, sign out in one.
  await signInForm(pw); await ready(p, 500);
  const tab2 = await p.context().newPage(); await tab2.goto("/feed"); await ready(tab2, 500);
  await p.getByRole("button", { name: "Account menu" }).click(); await p.waitForTimeout(500);
  await p.getByRole("menuitem", { name: /Sign out/ }).or(p.getByRole("button", { name: /Sign out/ })).first().click();
  await p.waitForTimeout(3000);
  say("T063 other tab without reload:", new URL(tab2.url()).pathname, (await tab2.locator("body").innerText()).slice(0, 150).replace(/\n/g, " | "));
}

if (run("T064")) {
  setTask("T064");
  const k = await page(await context(b, { device: "phone" }));
  await k.goto("/signin"); await ready(k, 300);
  await k.getByLabel("University email").fill("uxp-claim@nutech.edu.pk"); await k.getByLabel("Password", { exact: true }).fill("Nutech-Student-2026!");
  await k.getByRole("button", { name: "Sign in", exact: true }).click(); await k.waitForURL((u) => u.pathname !== "/signin"); await ready(k, 500);
  if (k.url().includes("/agreement")) { const cb = k.getByRole("checkbox").first(); if (await cb.isVisible().catch(() => false)) await cb.click(); await k.getByRole("button", { name: /accept|agree|continue/i }).last().click(); await k.waitForURL((u) => !u.pathname.startsWith("/agreement")); }
  await k.waitForTimeout(1500);
  const skipTour = k.getByRole("button", { name: "Skip tour" });
  if (await skipTour.isVisible().catch(() => false)) { await skipTour.click(); await k.waitForTimeout(1000); }
  await timedGoto(k, "/settings/account/delete"); await ready(k, 600);
  say("T064 controls:", await k.locator("main").getByRole("button").allInnerTexts(), await k.locator("main input:not([type=file])").evaluateAll((e) => e.map((x) => `${(x as HTMLInputElement).type}:${x.getAttribute("aria-label") ?? (x as HTMLInputElement).placeholder}`)));
  say("T064 delete page:", await mainText(k, 1500));
  await shot(k, "T064");
  const kb = k.getByRole("button", { name: /Delete|Start/ }).last();
  const confirmField = k.locator("main input:not([type=file])").first();
  await confirmField.fill("kashif_claims");
  say("T064 start delete:", T(await timedClick(k, kb, "start deletion", { timeout: 30_000 })), await dialogText(k, 500));
  const c = k.locator('[role="dialog"], [role="alertdialog"]').getByRole("button", { name: /Delete/ }).last();
  if (await c.isVisible().catch(() => false)) say("T064 confirm:", T(await timedClick(k, c, "confirm deletion", { timeout: 30_000 })));
  await ready(k, 600);
  say("T064 after start:", new URL(k.url()).pathname, await mainText(k, 800));
  await shot(k, "T064");
  await k.goto("/feed"); await ready(k, 400); say("T064 /feed while deleting ->", new URL(k.url()).pathname);
  const cancel = k.getByRole("button", { name: /Cancel|Keep/ }).first();
  say("T064 cancel:", T(await timedClick(k, cancel, "cancel deletion", { timeout: 30_000 })), await toastText(k));
  await ready(k, 600);
  say("T064 after cancel:", new URL(k.url()).pathname, await mainText(k, 300));
  await k.goto("/privacy"); await ready(k, 400);
  const priv = await mainText(k, 20000);
  say("T064 privacy notice length words:", priv.split(/\s+/).length, "| headings:", (await k.locator("main h2").allInnerTexts()).slice(0, 12));
}
await b.close(); await sql.end();
