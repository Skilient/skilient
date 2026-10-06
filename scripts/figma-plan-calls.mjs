#!/usr/bin/env node
/**
 * Plans the use_figma calls for a set of portals (docs/figma/README.md): compacts every captured
 * screen at both widths (scripts/figma-compact.mjs) and packs the chunks into calls under the
 * use_figma code limit. Writes docs/figma/reference/calls/NNN.js (gitignored) and an index.
 *
 *   node scripts/figma-plan-calls.mjs auth onboarding marketing public
 *   node scripts/figma-plan-calls.mjs --stored student   # data-only calls for the stored converter
 *   FIGMA_ROUTES='^/(feed|chat)' ...                      # only routes matching this pattern
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compact } from "./figma-compact.mjs";
import { buildCall, buildStoredCall } from "./figma-build-call.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REF = join(ROOT, "docs/figma/reference");
const LIMIT = 48_000;
/** Screen page per portal (docs/figma/state.json `pages`). */
const PAGES = { marketing: "2:227", public: "2:227", auth: "2:228", onboarding: "2:228", student: "2:229", teacher: "2:230", recruiter: "2:231", university: "2:232", ops: "2:233" };
const X = { desktop: 0, phone: 1540 };

const STORED = process.argv.includes("--stored");
const ROUTES = process.env.FIGMA_ROUTES ? new RegExp(process.env.FIGMA_ROUTES) : null;
const make = STORED ? buildStoredCall : buildCall;
const portals = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const out = join(REF, "calls");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const index = [];
let n = 0;
for (const portal of portals) {
  const manifest = JSON.parse(readFileSync(join(REF, `manifest-${portal}.json`), "utf8"));
  const page = PAGES[portal];
  let batch = [];
  const flush = () => {
    if (!batch.length) return;
    const file = join(out, `${String(++n).padStart(3, "0")}.js`);
    writeFileSync(file, make(batch));
    index.push({ file: file.replace(ROOT + "/", ""), jobs: batch.map((j) => j.opts.name + (j.part ? ` (part ${j.part + 1})` : "")) });
    batch = [];
  };
  for (const e of manifest.filter((m) => m.files && (!ROUTES || ROUTES.test(m.route)))) {
    // A dynamic segment that is a tab reads as the real path (/onboarding/university).
    const segTab = e.tab !== "default" && /\[[^\]]+\]$/.test(e.route) && e.url.endsWith(`/${e.tab}`);
    const title = segTab ? e.route.replace(/\[[^\]]+\]$/, e.tab) : e.route + (e.tab !== "default" ? ` › ${e.tab}` : "");
    for (const vp of ["desktop", "phone"]) {
      const key = e.files[`${vp}-light`];
      if (!key) continue;
      const chunks = await compact(key.replace(/-light$/, ""));
      chunks.forEach((c, i) => {
        const opts = { page, name: `${title} · ${vp} · light`, x: X[vp] };
        if (vp === "phone") opts.row = `${title} · desktop · light`;
        const job = { chunk: c.file, opts, part: i };
        if (batch.length && make([...batch, job]).length > LIMIT) flush();
        batch.push(job);
      });
    }
  }
  flush();
}
writeFileSync(join(out, "index.json"), JSON.stringify(index, null, 2));
console.log(`${n} calls`);
for (const c of index) console.log(c.file.split("/").pop(), String(readFileSync(join(ROOT, c.file)).length).padStart(6), c.jobs.join(" | "));
