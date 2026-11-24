/** T099 check: the payment panel shows the society's JazzCash number to a student holding a seat. */
import { launch, context, page, ready, signIn, accounts } from "./lib/browser.ts";
const A = accounts(); const b = await launch(); const p = await page(await context(b, { device: "phone", throttle: false }));
await signIn(p, A.accounts.applicant2); await p.goto("/events/" + A.ids.events.paid); await ready(p, 500);
await p.getByRole("button", { name: /^Register/ }).first().click(); await p.waitForTimeout(800);
await p.locator('[role="dialog"]').last().getByRole("button", { name: /Hold my seat/ }).click().catch((e) => console.log("hold:", e.message.split("\n")[0])); await p.waitForTimeout(2000); await ready(p, 500);
const txt = await p.locator("body").innerText();
console.log("url", new URL(p.url()).pathname, "| has number:", txt.includes("0300") , "| payment part:", txt.split("Payment")[1]?.slice(0, 400).replace(/\n+/g, " | "));
await p.screenshot({ path: "/home/user/skilient/docs/ux-pilot/shots/T099-pay.png", fullPage: true });
await b.close();
