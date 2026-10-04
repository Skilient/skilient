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
