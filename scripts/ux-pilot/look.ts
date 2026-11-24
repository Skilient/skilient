/** Prints controls (and optional text) of several pages for one account: node look.ts <account> <url>... (TEXT=1 for text). */
import { launch, context, page, ready, signIn, accounts } from "./lib/browser.ts";
import { inspect } from "./lib/inspect.ts";
const [who, ...urls] = process.argv.slice(2);
const b = await launch();
const p = await page(await context(b, { device: (process.env.DEVICE as any) ?? "phone", throttle: false }));
if (who !== "visitor") await signIn(p, accounts().accounts[who]);
const NAV = /^(Home|Openings|8|waiting|Ventures|Chat|1|unread|Me|14|Search or jump to…|What happened since you were last here\.|Venture roles, inductions.*|Projects you build with others\.|Messages with friends and teammates\.|Your profile, Record.*|Your feed, your progress.*|\d+)$/;
for (const u of urls) {
  await p.goto(u); await ready(p, 600);
  const out = await inspect(p, Number(process.env.MAX ?? 1500));
  const [head, ctrls] = out.split("CONTROLS: ");
  console.log(`\n##### ${u}`);
  if (process.env.TEXT) console.log(head.split("\n").filter((l) => !NAV.test(l.trim())).join("\n"));
  else console.log(head.split("\n")[0]);
  console.log("CONTROLS:", (ctrls ?? "").split(" | ").filter((c) => !/->\/(feed|openings|ventures|chat|me|notifications)$|Skilient home|Search or jump|Account menu/.test(c)).join(" | "));
}
await b.close();
