// Fails when a contract changes in a breaking way against the base branch
// (docs/azure/prd.md: "A breaking change fails CI"). BASE_REF defaults to azure.
// Skipped when the base has no contracts yet.
import { execFileSync } from "node:child_process";

const base = process.env.BASE_REF ?? "azure";
const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
try {
  execFileSync("git", ["cat-file", "-e", `${base}:packages/contracts/proto`], { cwd: root });
} catch {
  console.log(`No contracts on ${base}: nothing to compare.`);
  process.exit(0);
}
execFileSync("buf", ["breaking", "--against", `${root}/.git#ref=${base},subdir=packages/contracts`], { stdio: "inherit" });
