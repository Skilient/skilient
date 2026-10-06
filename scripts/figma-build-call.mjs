#!/usr/bin/env node
/**
 * Prints the code for one use_figma call: docs/figma/converter.js with one compact chunk
 * (scripts/figma-compact.mjs) and where to put the frame. docs/figma/README.md has the workflow.
 *
 *   node scripts/figma-build-call.mjs <pageId> <chunk.json>=<frame name>@<x>[,<y>|,prev] ...
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function buildCall(jobs) {
  const src = readFileSync(join(ROOT, "docs/figma/converter.js"), "utf8")
    .split("\n")
    .filter((l) => !/^\s*\/\//.test(l))
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
  const list = jobs.map((j) => `{"o":${JSON.stringify(j.opts)},"d":${readFileSync(j.chunk, "utf8")}}`).join(",\n");
  return src.replace("__JOBS__", `[\n${list}\n]`);
}

/**
 * The same call without the converter body: it runs the copy stored in the Figma file
 * (shared plugin data `skilient/converter`, written from docs/figma/converter.js), so a call
 * carries only its data.
 */
export function buildStoredCall(jobs) {
  const list = jobs.map((j) => `{"o":${JSON.stringify(j.opts)},"d":${readFileSync(j.chunk, "utf8")}}`).join(",\n");
  return `const JOBS = [\n${list}\n];\nconst CONV = new Function("return " + figma.root.getSharedPluginData("skilient", "converter"))();\nreturn await CONV(JOBS);\n`;
}

/**
 * The data-only call compressed: each screen's jobs as deflate-raw + base64, run one at a time by
 * the runner stored in the file (shared plugin data `skilient/run`, written from
 * docs/figma/runner.js), which inflates them, runs the stored converter and applies the app-shell
 * post-fix. About 7x smaller than JSON. Each screen has its own try/catch, so a copy slip in one
 * blob only fails that screen; the result names it, and it can be re-sent alone.
 */
export function buildPackedCall(jobs) {
  const screens = [];
  for (const j of jobs) {
    const key = j.opts.row ?? j.opts.name;
    const last = screens[screens.length - 1];
    if (last && last.key === key) last.jobs.push(j);
    else screens.push({ key, jobs: [j] });
  }
  const lines = screens.map((s, i) => {
    const list = s.jobs.map((j) => `{"o":${JSON.stringify(j.opts)},"d":${readFileSync(j.chunk, "utf8")}}`).join(",");
    const data = deflateRawSync(`[${list}]`, { level: 9 }).toString("base64");
    return `try { out[${i}] = await R("${data}"); } catch (e) { out[${i}] = ${JSON.stringify(s.key)} + ": " + String(e).slice(0, 80); }`;
  });
  return `const R = new Function("return " + figma.root.getSharedPluginData("skilient", "run"))();\nconst out = {};\n${lines.join("\n")}\nreturn out;\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [page, ...specs] = process.argv.slice(2);
  const jobs = specs.map((s) => {
    const m = s.match(/^(.+?)=(.+)@(-?[\d.]+)(?:,(prev|-?[\d.]+))?$/);
    if (!m) throw new Error(`bad job: ${s}`);
    const opts = { page, name: m[2], x: Number(m[3]) };
    if (m[4] !== undefined) opts.y = m[4] === "prev" ? "prev" : Number(m[4]);
    return { chunk: m[1], opts };
  });
  process.stdout.write(buildCall(jobs));
}
