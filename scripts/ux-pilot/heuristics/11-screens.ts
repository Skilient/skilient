/**
 * Part 6, screen review input: screenshots of the 25 core student and officer pages at 390 dark, 1280 dark and
 * 390 light (docs/ux-pilot/heuristics/screens/core/), every other page at 390 dark (screens/rest/), and contact
 * sheets (2x3) built with sharp for the reviewer to look at by eye.
 */
import sharp from "sharp";
import { mkdirSync, readdirSync } from "node:fs";
import { launch, context, page, ready, signIn, accounts, type Ctx } from "../lib/browser.ts";
import { sql } from "../lib/act.ts";
import { routes } from "./lib.ts";
const A = accounts(); const ids = A.ids;
const DIR = "docs/ux-pilot/heuristics/screens";
mkdirSync(`${DIR}/core`, { recursive: true }); mkdirSync(`${DIR}/rest`, { recursive: true }); mkdirSync(`${DIR}/sheets`, { recursive: true });
const [door] = await sql`select id from public.events where title = '[UX test] Door check-in night'`;
const dev = ids.societies.open.slug;
const CORE: [string, string, string][] = [
  ["feed", "/feed", "tester"], ["openings", "/openings", "tester"], ["openings-events", "/openings/events", "tester"], ["ventures", "/ventures", "tester"], ["venture", `/ventures/${ids.helperVenture}`, "tester"],
  ["venture-manage", `/ventures/${ids.testerVenture}/manage`, "tester"], ["chat", "/chat", "tester"], ["chat-thread", `/chat/${ids.dmTesterA}`, "tester"], ["me", "/me", "tester"], ["score", "/me/score", "tester"],
  ["skills", "/me/skills", "tester"], ["cv", "/me/cv", "tester"], ["record", "/me/record", "tester"], ["paths", "/me/paths?role=backend", "tester"], ["events", "/events", "tester"],
  ["event", `/events/${ids.events.hackathon}`, "tester"], ["ticket", `/events/${ids.events.workshop}/ticket`, "tester"], ["society", `/societies/${dev}`, "tester"], ["profile", "/profile/uxp_helper_a", "tester"], ["notifications", "/notifications", "tester"],
  ["privacy", "/settings/privacy", "tester"], ["swaps", "/swaps", "tester"], ["society-manage", `/societies/${dev}/manage`, "officer1"], ["event-manage", `/events/${door.id}/manage`, "officer1"], ["check-in", `/events/${door.id}/check-in`, "officer1"],
];
const CFG: (Ctx & { key: string })[] = [{ key: "390-dark", device: "phone", colorScheme: "dark", throttle: false }, { key: "1280-dark", device: "desktop", colorScheme: "dark", throttle: false }, { key: "390-light", device: "phone", colorScheme: "light", throttle: false }];
const b = await launch();
for (const cfg of CFG) {
  const pages = new Map<string, any>();
  const pg = async (who: string | null) => { const k = who ?? "visitor"; if (!pages.has(k)) { const p = await page(await context(b, cfg)); p.on("dialog", (d) => d.dismiss()); if (who) await signIn(p, A.accounts[who]); pages.set(k, p); } return pages.get(k); };
  for (const [name, url, who] of CORE) { const p = await pg(who); await p.goto(url).catch(() => undefined); await ready(p, 500); await p.screenshot({ path: `${DIR}/core/${name}-${cfg.key}.png`, animations: "disabled" }); }
  if (cfg.key === "390-dark") {
    const coreRoutes = new Set(CORE.map(([, u]) => u.split("?")[0]));
    for (const r of await routes()) {
      if (coreRoutes.has(r.url)) continue;
      const p = await pg(r.who); await p.goto(r.url).catch(() => undefined); await ready(p, 300);
      await p.screenshot({ path: `${DIR}/rest/${r.route.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root"}.png`, animations: "disabled" });
    }
  }
  for (const p of pages.values()) await p.context().close();
}
// Contact sheets: core 1280 + light pairs, and the rest at 390 dark, 2 rows x 3 columns each.
const sheet = async (files: string[], out: string, w: number, h: number) => {
  const tiles = await Promise.all(files.map(async (f, i) => ({ input: await sharp(f).resize(w, h, { fit: "contain", background: "#777" }).png().toBuffer(), left: (i % 3) * (w + 8), top: Math.floor(i / 3) * (h + 28) + 24 })));
  const labels = files.map((f, i) => ({ input: Buffer.from(`<svg width="${w}" height="22"><text x="4" y="16" font-size="14" fill="#fff">${f.split("/").pop()!.replace(".png", "")}</text></svg>`), left: (i % 3) * (w + 8), top: Math.floor(i / 3) * (h + 28) }));
  await sharp({ create: { width: 3 * w + 16, height: 2 * (h + 28), channels: 3, background: "#222" } }).composite([...tiles, ...labels]).png().toFile(out);
};
const core = readdirSync(`${DIR}/core`).sort();
const wide = core.filter((f) => f.includes("1280-dark")).map((f) => `${DIR}/core/${f}`), light = core.filter((f) => f.includes("390-light")).map((f) => `${DIR}/core/${f}`);
for (let i = 0; i < wide.length; i += 6) await sheet(wide.slice(i, i + 6), `${DIR}/sheets/core-1280-dark-${i / 6 + 1}.png`, 560, 350);
for (let i = 0; i < light.length; i += 6) await sheet(light.slice(i, i + 6), `${DIR}/sheets/core-390-light-${i / 6 + 1}.png`, 300, 650);
const rest = readdirSync(`${DIR}/rest`).sort().map((f) => `${DIR}/rest/${f}`);
for (let i = 0; i < rest.length; i += 6) await sheet(rest.slice(i, i + 6), `${DIR}/sheets/rest-390-dark-${String(i / 6 + 1).padStart(2, "0")}.png`, 300, 650);
console.log("core", core.length, "rest", rest.length, "sheets", readdirSync(`${DIR}/sheets`).length);
await b.close(); await sql.end();
