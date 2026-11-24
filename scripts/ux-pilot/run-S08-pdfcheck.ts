/** T086 second half: the tester checks the genuine and the one-character-forged PDF on the verify page. */
import { launch, context, page, ready } from "./lib/browser.ts";
import { timedClick, setTask } from "./lib/timed.ts";
import { shot } from "./lib/shot.ts";
import { sql, mainText } from "./lib/act.ts";
import { existsSync } from "node:fs";
setTask("T086");
const b = await launch(); const p = await page(await context(b, { device: "phone" }));
const [cv] = await sql`select code from public.cv_records r join public.profiles p using (user_id) where p.username = 'uxp_helper_b' order by r.issued_at desc limit 1`;
for (const f of ["/tmp/claude-0/uxp/cv-genuine.pdf", "/tmp/claude-0/uxp/cv-forged.pdf"]) {
  if (!existsSync(f)) { console.log("missing", f); continue; }
  await p.goto("/verify/" + cv.code); await ready(p, 500);
  await p.locator('input[type="file"]').first().setInputFiles(f);
  const btn = p.getByRole("button", { name: "Check this PDF" });
  if (await btn.isEnabled().catch(() => false)) await timedClick(p, btn, "check PDF " + f.split("/").pop());
  await p.waitForTimeout(2500);
  console.log(f.split("/").pop(), "->", (await mainText(p, 3000)).split(" | ").filter((l) => /PDF|match|fingerprint|genuine|changed|edited|isn't|not/i.test(l)).slice(0, 6));
  await shot(p, "T086");
}
await b.close(); await sql.end();
