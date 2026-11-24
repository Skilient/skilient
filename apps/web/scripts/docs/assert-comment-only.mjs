// Fails unless every file changed against <base-ref> is a .ts/.tsx/.mts file whose tokens
// (comments and whitespace dropped) are identical to the base version. Used by stage 10.
// Usage: node scripts/docs/assert-comment-only.mjs <base-ref>
// Compares the working tree with the base, so committed and uncommitted edits both count.
// Tokens come from the TypeScript parser's leaf nodes (the scanner underneath), not a bare
// scanner loop, so JSX text and template literals are classified correctly.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import ts from "typescript";

const base = process.argv[2];
if (!base) {
  console.error("usage: assert-comment-only.mjs <base-ref>");
  process.exit(2);
}
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

function tokens(path, text) {
  const kind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
  const out = [];
  const walk = (node) => {
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) return;
    const children = node.getChildren(sf);
    if (!children.length) {
      if (node.kind === ts.SyntaxKind.EndOfFileToken) return;
      if (node.kind === ts.SyntaxKind.JsxText && node.containsOnlyTriviaWhiteSpaces) return;
      out.push(`${node.kind}:${node.getText(sf)}`);
      return;
    }
    children.forEach(walk);
  };
  walk(sf);
  return out;
}

const changed = git("diff", "--name-status", "--no-renames", base)
  .split("\n")
  .filter(Boolean)
  .map((l) => l.split("\t"));
let bad = 0;
const fail = (path, why) => {
  console.error(`FAIL ${path}: ${why}`);
  bad++;
};

for (const [status, path] of changed) {
  if (!/\.(ts|tsx|mts)$/.test(path)) {
    fail(path, "not a .ts, .tsx or .mts file");
    continue;
  }
  if (status !== "M") {
    fail(path, status === "A" ? "file added (no base version to compare)" : "file deleted");
    continue;
  }
  const before = tokens(path, git("show", `${base}:${path}`));
  const after = tokens(path, readFileSync(path, "utf8"));
  const i = before.findIndex((t, k) => t !== after[k]);
  if (i !== -1 || before.length !== after.length) {
    const at = i === -1 ? Math.min(before.length, after.length) : i;
    fail(path, `tokens differ at #${at}: base ${JSON.stringify(before[at])} vs now ${JSON.stringify(after[at])}`);
  }
}

console.log(`${changed.length} changed file(s) checked against ${base}, ${bad} failure(s)`);
process.exit(bad ? 1 : 0);
