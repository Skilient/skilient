/** Sanity check for probe 1: axe must report an image without alt and an empty button injected into a real page. */
import AxeBuilder from "@axe-core/playwright";
import { launch, context, page } from "../lib/browser.ts";
const b = await launch(); const p = await page(await context(b, { device: "desktop", throttle: false }));
await p.goto("/signin"); await p.evaluate(() => { const i = document.createElement("img"); i.src = "x.png"; document.querySelector("main")!.appendChild(i); const btn = document.createElement("button"); document.querySelector("main")!.appendChild(btn); });
const r = await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
console.log(r.violations.map((v) => `${v.id}:${v.impact}`));
await b.close();
