// Documentation coverage for docs/code.
// Usage: node scripts/docs/coverage.mjs [--headers]
// Default: lists tracked source files outside the exclusions that no row of docs/code/PLAN.md
//   names. A row names a file by an exact path, or a folder with a trailing slash, in backticks.
// --headers: lists .ts/.tsx files under lib/, app/, components/, supabase/functions/ and the
//   repo root that have no "Docs: docs/code/" line in their first 40 lines.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const EXCLUDED = [
  ".claude/", ".impeccable/", ".zap/", "types/database.ts", "public/", "brand/", "design/",
  "docs/reference/", "docs/signing-keys/", "pnpm-lock.yaml",
];
const SOURCE = /\.(ts|tsx|mts|cts|js|mjs|cjs|sql)$/;
const isTest = (f) => /(^|\/)(tests?|__tests__)\//.test(f) || /\.(test|spec)\.[cm]?[tj]sx?$/.test(f);

const files = execFileSync("git", ["ls-files"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
  .split("\n")
  .filter((f) => f && existsSync(f))
  .filter((f) => !EXCLUDED.some((e) => f === e || (e.endsWith("/") && f.startsWith(e))));

let missing;
let label;
if (process.argv.includes("--headers")) {
  const roots = ["lib/", "app/", "components/", "supabase/functions/"];
  const inScope = (f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(".d.ts") && !isTest(f) && (roots.some((r) => f.startsWith(r)) || !f.includes("/"));
  missing = files.filter(inScope).filter((f) => !/Docs:\s*docs\/code\//.test(readFileSync(f, "utf8").split("\n").slice(0, 40).join("\n")));
  label = "without a Docs: docs/code/ header";
} else {
  const plan = existsSync("docs/code/PLAN.md") ? readFileSync("docs/code/PLAN.md", "utf8") : "";
  const named = new Set();
  for (const row of plan.split("\n").filter((l) => l.trimStart().startsWith("|"))) {
    for (const m of row.matchAll(/`([^`]+)`/g)) named.add(m[1]);
  }
  const covered = (f) => [...named].some((n) => f === n || (n.endsWith("/") && f.startsWith(n)));
  missing = files.filter((f) => SOURCE.test(f) && !isTest(f) && !covered(f));
  label = "with no row in docs/code/PLAN.md";
}

for (const f of missing) console.log(f);
console.log(`${missing.length} file(s) ${label}`);
process.exit(missing.length ? 1 : 0);
