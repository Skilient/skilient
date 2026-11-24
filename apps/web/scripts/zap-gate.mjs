// Reads a ZAP JSON report (zap-baseline.py -J), prints every alert and fails on any High (riskcode 3).
// Used by .github/workflows/zap.yml; accepted Medium and Low findings are listed in docs/security/zap.md.
import { appendFileSync, readFileSync } from "node:fs";

const file = process.argv[2] ?? "zap/report.json";
const report = JSON.parse(readFileSync(file, "utf8"));
const RISK = { 3: "High", 2: "Medium", 1: "Low", 0: "Informational" };
const rows = [];
for (const site of report.site ?? []) {
  for (const a of site.alerts ?? []) {
    rows.push({ id: a.pluginid, risk: Number(a.riskcode), name: a.name, count: a.instances?.length ?? 0, sample: a.instances?.[0]?.uri ?? "" });
  }
}
rows.sort((a, b) => b.risk - a.risk || a.id.localeCompare(b.id));
const lines = ["| Risk | Rule | Alert | Instances | Example |", "| --- | --- | --- | --- | --- |"];
for (const r of rows) lines.push(`| ${RISK[r.risk]} | ${r.id} | ${r.name} | ${r.count} | ${r.sample} |`);
const highs = rows.filter((r) => r.risk >= 3);
const summary = `## ZAP baseline\n\n${rows.length ? lines.join("\n") : "No alerts."}\n\n${highs.length ? `**${highs.length} High finding(s): failing.**` : "No High findings."}\n`;
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
process.exit(highs.length ? 1 : 0);
