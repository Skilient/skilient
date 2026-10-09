// Checks the [src: path#symbol] citations in Markdown docs (docs/code/CONVENTIONS.md).
// Usage: node scripts/docs/check-citations.mjs [paths...]   (default: every .md under docs/code)
// Fails when a citation can't be parsed, a cited file is missing or the symbol does not occur
// in it; warns when the :L<line> hint is more than 20 lines from the nearest line holding the symbol.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const HINT_TOLERANCE = 20;
// Citations inside code fences or inline code are examples, not claims.
// A path may hold Next.js route segments such as [id] and [[...page]]; a symbol can't hold "]".
const CITATION = /\[src:\s*((?:[^[\]#\s]|\[\[[^[\]#\s/]*\]\]|\[[^[\]#\s/]*\])+)#([^\]]+?)(?::L(\d+))?\s*\]/g;

function markdownFiles(path) {
  const full = resolve(ROOT, path);
  if (!existsSync(full)) return [];
  if (statSync(full).isFile()) return full.endsWith(".md") ? [full] : [];
  return readdirSync(full, { withFileTypes: true }).flatMap((e) => markdownFiles(join(path, e.name)));
}

function stripCode(text) {
  // Blank out fenced blocks and inline spans but keep line breaks so line numbers stay right.
  const blank = (s) => s.replace(/[^\n]/g, " ");
  return text.replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gm, blank).replace(/`[^`\n]*`/g, blank);
}

const fileCache = new Map();
function sourceLines(path) {
  if (!fileCache.has(path)) {
    const full = resolve(ROOT, path);
    const ok = existsSync(full) && statSync(full).isFile();
    fileCache.set(path, ok ? readFileSync(full, "utf8").split("\n") : null);
  }
  return fileCache.get(path);
}

const targets = process.argv.slice(2);
const docs = (targets.length ? targets : ["docs/code"]).flatMap(markdownFiles);
let failures = 0;
let warnings = 0;
const counts = [];

for (const doc of docs) {
  const rel = relative(ROOT, doc);
  const text = stripCode(readFileSync(doc, "utf8"));
  let n = 0;
  const parsed = new Set([...text.matchAll(CITATION)].map((m) => m.index));
  for (let at = text.indexOf("[src:"); at !== -1; at = text.indexOf("[src:", at + 1)) {
    if (parsed.has(at)) continue;
    console.error(`FAIL ${rel}:${text.slice(0, at).split("\n").length}: citation not parsed: ${text.slice(at, at + 80).split("\n")[0]}`);
    failures++;
  }
  for (const m of text.matchAll(CITATION)) {
    n++;
    const [, path, rawSymbol, hint] = m;
    const symbol = rawSymbol.trim();
    const docLine = text.slice(0, m.index).split("\n").length;
    const where = `${rel}:${docLine}`;
    const lines = sourceLines(path);
    if (!lines) {
      console.error(`FAIL ${where}: file not found: ${path}`);
      failures++;
      continue;
    }
    const hits = [];
    lines.forEach((l, i) => l.includes(symbol) && hits.push(i + 1));
    if (!hits.length) {
      console.error(`FAIL ${where}: symbol "${symbol}" not in ${path}`);
      failures++;
      continue;
    }
    if (hint) {
      const off = Math.min(...hits.map((h) => Math.abs(h - Number(hint))));
      if (off > HINT_TOLERANCE) {
        console.warn(`WARN ${where}: ${path}#${symbol} is ${off} lines from L${hint} (nearest L${hits.sort((a, b) => Math.abs(a - hint) - Math.abs(b - hint))[0]})`);
        warnings++;
      }
    }
  }
  counts.push([rel, n]);
}

for (const [rel, n] of counts) console.log(`${String(n).padStart(5)}  ${rel}`);
console.log(`${docs.length} doc(s), ${counts.reduce((a, [, n]) => a + n, 0)} citation(s), ${failures} failure(s), ${warnings} warning(s)`);
process.exit(failures ? 1 : 0);
