/**
 * Probe 6 (H05, H09): error probes on the main forms: empty, too long, wrong format, double-click submit, offline
 * submit, leaving mid-form, made-up ids, no permission and expired links. For each: does the message name the cause
 * and the fix, sit next to the field, carry aria-invalid + aria-describedby, rely on more than colour, keep the input,
 * and avoid duplicates? Task-run observations are merged in. Raw results under "errors".
 */
import { launch, context, page, ready, signIn, accounts } from "../lib/browser.ts";
import { sql, dialogText, toastText } from "../lib/act.ts";
import { save } from "./lib.ts";
const A = accounts(); const acc = A.accounts; const ids = A.ids;
const PH = "00000000-0000-4000-8000-000000000000";
const b = await launch();
const pageAs = async (who: string | null) => { const p = await page(await context(b, { device: "phone", throttle: false })); p.on("dialog", (d) => d.dismiss()); if (who) await signIn(p, acc[who]); await ready(p, 200); return p; };
const fieldState = (p: any) => p.evaluate(() => Array.from(document.querySelectorAll('[aria-invalid="true"]')).map((e) => { const ids = (e.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean); const msg = ids.map((i) => document.getElementById(i)?.innerText ?? "").join(" ").trim(); const r = e.getBoundingClientRect(); const m = ids.map((i) => document.getElementById(i)).find(Boolean)?.getBoundingClientRect(); return { field: e.getAttribute("name") ?? e.getAttribute("aria-label") ?? e.tagName, describedby: ids.length > 0, msg: msg.slice(0, 120), gapPx: m ? Math.round(Math.abs(m.top - r.bottom)) : null }; }));
const alerts = async (p: any) => (await p.locator('[role="alert"], [role="status"]').allInnerTexts().catch(() => [])).map((s: string) => s.replace(/\n/g, " ").trim()).filter(Boolean).slice(0, 4);
const out: any[] = [];
const rec = (r: any) => { out.push(r); console.log(JSON.stringify(r).slice(0, 400)); };

// Sign-up form (visitor).
let p = await pageAs(null);
await p.goto("/signup"); await ready(p, 300);
await p.getByRole("button", { name: "Create account" }).click(); await p.waitForTimeout(800);
rec({ form: "/signup", probe: "empty", fields: await fieldState(p), alerts: await alerts(p) });
await p.locator('input[name="fullName"]').fill("A".repeat(80)); await p.locator('input[type="email"]').fill("not-an-email"); await p.locator('input[name="password"]').fill("short");
await p.getByRole("button", { name: "Create account" }).click(); await p.waitForTimeout(800);
rec({ form: "/signup", probe: "too long name, bad email, short password", fields: await fieldState(p), alerts: await alerts(p), kept: { name: (await p.locator('input[name="fullName"]').inputValue()).length, email: await p.locator('input[type="email"]').inputValue() }, maxlength: await p.locator('input[name="fullName"]').getAttribute("maxlength") });
await p.context().close();

p = await pageAs("tester");
// Composer: too long, empty, double click, offline.
await p.goto("/feed"); await ready(p, 300);
const box = p.locator("form textarea").first(); const submit = p.locator('button[type="submit"]').first();
await box.fill("x".repeat(2050)); await p.waitForTimeout(300);
rec({ form: "composer", probe: "too long (2050)", value: (await box.inputValue()).length, counter: await p.getByText(/\/2,000/).first().innerText().catch(() => ""), submitDisabled: await submit.isDisabled(), fields: await fieldState(p) });
await box.fill(""); rec({ form: "composer", probe: "empty", submitDisabled: await submit.isDisabled(), hint: await alerts(p) });
const body = `[UX test] double click ${Date.now().toString(36)}`;
await box.fill(body);
await submit.dblclick(); await p.waitForTimeout(4000);
const [{ n: dup }] = await sql`select count(*)::int as n from public.posts where body = ${body}`;
rec({ form: "composer", probe: "double-click submit", created: dup, toast: await alerts(p) });
await p.context().setOffline(true);
await box.fill("[UX test] offline post"); await submit.click(); await p.waitForTimeout(2500);
rec({ form: "composer", probe: "offline submit", alerts: await alerts(p), kept: await box.inputValue({ timeout: 3000 }).catch(() => "(composer gone)"), url: p.url(), text: (await p.locator("body").innerText().catch(() => "")).replace(/\n+/g, " | ").slice(0, 200) });
await p.context().setOffline(false);
// Venture form: too long title, leave mid-form.
await p.goto("/ventures/new"); await ready(p, 300);
await p.locator('input[name="title"]').fill("T".repeat(140));
rec({ form: "/ventures/new", probe: "too long title", kept: (await p.locator('input[name="title"]').inputValue()).length, maxlength: await p.locator('input[name="title"]').getAttribute("maxlength") });
let beforeunload = false; p.removeAllListeners("dialog"); p.on("dialog", async (d) => { if (d.type() === "beforeunload") beforeunload = true; await d.accept(); });
await p.locator('textarea[name="description"]').fill("Half typed.");
await p.getByRole("link", { name: /^Ventures$/ }).first().click().catch(() => undefined); await p.waitForTimeout(1500);
rec({ form: "/ventures/new", probe: "leave mid-form (in-app link)", warned: beforeunload, now: new URL(p.url()).pathname });
await p.goto("/ventures/new"); await ready(p, 300); await p.locator('textarea[name="description"]').fill("Half typed again.");
beforeunload = false; await p.goto("/feed").catch(() => undefined); await p.waitForTimeout(800);
rec({ form: "/ventures/new", probe: "leave mid-form (address bar)", warned: beforeunload });
// Feedback empty.
await p.goto("/feedback"); await ready(p, 300);
await p.locator("main").getByRole("button", { name: /^Send/ }).first().click(); await p.waitForTimeout(800);
rec({ form: "/feedback", probe: "empty", fields: await fieldState(p), alerts: await alerts(p) });
// Made-up ids and no permission.
for (const u of [`/post/${PH}`, `/ventures/${PH}`, `/events/${PH}`, "/profile/nobody_here", "/societies/no-such-society", `/swaps/${PH}`, `/me/tasks/${PH}`, `/chat/${PH}`]) {
  const r = await p.goto(u).catch(() => null); await ready(p, 200);
  rec({ form: "made-up id", url: u, status: r?.status(), text: (await p.locator("main").innerText().catch(() => "")).replace(/\n+/g, " | ").slice(0, 140) });
}
for (const u of [`/societies/${ids.societies.open.slug}/manage`, `/events/${ids.events.workshop}/manage`, "/ops", "/teach", `/societies/${ids.societies.open.slug}/events/new`]) {
  const r = await p.goto(u).catch(() => null); await ready(p, 200);
  rec({ form: "no permission", url: u, status: r?.status(), text: (await p.locator("main").innerText().catch(() => "")).replace(/\n+/g, " | ").slice(0, 140) });
}
await p.context().close();
// Expired or bad links (visitor).
p = await pageAs(null);
for (const u of ["/record/uxp_tester?t=not-a-real-token", "/cv/uxp_tester?t=not-a-real-token", "/verify/ZZZZZ99999", "/auth/confirm?token_hash=pkce_bad&type=recovery"]) {
  const r = await p.goto(u).catch(() => null); await ready(p, 300);
  rec({ form: "expired/bad link", url: u, status: r?.status(), now: new URL(p.url()).pathname, text: (await p.locator("main, body").first().innerText().catch(() => "")).replace(/\n+/g, " | ").slice(0, 160) });
}
await p.context().close();

const fromTasks = [
  { form: "/signup", probe: "personal email", note: "'Use your university email.' under the field (T002)" },
  { form: "/signup", probe: "domain typo", note: "Suggests requesting a university, not the fix (R02); link lost after submit (R03)" },
  { form: "/signup/verify", probe: "wrong code twice", note: "Same message twice (R05)" },
  { form: "contribution", probe: "bad link", note: "'Use a full link starting with https://.' aria-invalid + describedby, input kept (T058)" },
  { form: "credential", probe: "too-big file", note: "Rejected only after Send ('PDFs can be up to 5 MB.') (R75)" },
  { form: "society request", probe: "existing name", note: "Named under the field; Continue blocked (T092)" },
  { form: "event register", probe: "required answer", note: "'Answer \"Have you used Git before?\".' (T094)" },
  { form: "chat", probe: "offline send", note: "Looks sent; generic toast (R50)" },
  { form: "/settings/profile", probe: "leave unsaved", note: "No warning (R72)" },
  { form: "venture manage", probe: "leave unsaved", note: "No warning (R61)" },
  { form: "reset link", probe: "used twice", note: "'That reset link has expired or was already used. Ask for a new one.' (T006)" },
  { form: "Record share", probe: "revoked", note: "'This link isn't valid… Ask the student for a new link' (T081)" },
];
save("errors", { probes: out, fromTasks });
await b.close(); await sql.end();
