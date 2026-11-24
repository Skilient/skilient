/** T107 second half: after the handover, the new President confirms the ended terms; the old President checks the Record. */
import { launch, context, page, ready, signIn, accounts } from "./lib/browser.ts";
import { timedClick, setTask } from "./lib/timed.ts";
import { sql, mainText, dialogText, toastText } from "./lib/act.ts";
import { shot } from "./lib/shot.ts";
import { execFileSync } from "node:child_process";
setTask("T107");
const A = accounts(); const b = await launch();
const [s] = await sql`select slug from public.societies where name = '[UX test] Film Society'`;
const h = await page(await context(b, { device: "phone" }));
h.on("dialog", async (d) => { console.log("native dialog:", d.message()); await d.accept(); });
await signIn(h, A.accounts.helperA); await h.goto(`/societies/${s.slug}/manage`); await ready(h, 600);
console.log("terms:", (await mainText(h, 8000)).split("Terms | ")[1]?.slice(0, 600));
const c = h.getByRole("button", { name: /^Confirm/ });
console.log("confirm buttons:", await c.allInnerTexts());
for (let i = 0; i < 3 && await c.first().isVisible().catch(() => false); i++) { const t = await timedClick(h, c.first(), "confirm term"); console.log("confirm:", t.kind, t.resultMs, await dialogText(h, 300), await toastText(h)); await h.waitForTimeout(1000); }
console.log("terms after:", (await mainText(h, 8000)).split("Terms | ")[1]?.slice(0, 500));
await shot(h, "T107");
console.log(execFileSync("node", ["scripts/ux-pilot/signer.mjs"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n").pop());
const o = await page(await context(b, { device: "phone", throttle: false }));
await signIn(o, A.accounts.officer2); await o.goto("/me/record"); await ready(o, 500);
console.log("officer-2 record:", (await mainText(o, 1500)).split(" | ").filter((l) => /Office|President|Film|term/i.test(l)).slice(0, 6));
await o.goto("/notifications"); await ready(o, 500);
console.log("officer-2 bell:", (await mainText(o, 1500)).split(" | ").filter((l) => /term|President|Film|handover/i.test(l)).slice(0, 4));
await b.close(); await sql.end();
