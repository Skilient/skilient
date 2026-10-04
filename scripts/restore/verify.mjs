// Compares production with the restored scratch project: migrations, RLS, policies, functions, row counts, and
// whether Vault secrets decrypt and cron jobs exist. Usage: PROD_DB_URL=… SCRATCH_DB_URL=… node verify.mjs
// Writes restore-report.json and a Markdown summary (GITHUB_STEP_SUMMARY when set); exits 1 on any failure.
import { appendFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { compareCatalog, compareCounts } from "./lib.mjs";

const SCHEMAS = ["public", "private", "auth", "storage"];
// Supabase's own bookkeeping, recreated by the platform rather than restored.
const SKIP = new Set(["auth.schema_migrations", "storage.migrations"]);
// Secrets the system needs to run; reseed-vault.sql recreates them after a restore into another project.
export const REQUIRED_SECRETS = [
  "project_url", "cv_export_secret", "github_worker_secret", "notify_worker_secret", "link_preview_worker_secret",
  "storage_cleanup_worker_secret", "cv_worker_secret", "webhook_worker_secret", "competition_freeze_secret",
  "billing_worker_secret", "analytics_worker_secret",
];

async function snapshot(url) {
  const sql = postgres(url, { max: 1, prepare: false, ssl: url.includes("127.0.0.1") ? false : "require", onnotice: () => {} });
  try {
    const tables = await sql`
      select n.nspname || '.' || c.relname as name, c.relrowsecurity as rls
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where c.relkind in ('r', 'p') and n.nspname = any(${SCHEMAS}) and not c.relispartition
       order by 1`;
    const counts = {};
    for (const t of tables.filter((t) => !SKIP.has(t.name))) {
      const [schema, rel] = t.name.split(".");
      const [{ n }] = await sql`select count(*)::bigint as n from ${sql(schema)}.${sql(rel)}`;
      counts[t.name] = Number(n);
    }
    const migrations = (await sql`select version from supabase_migrations.schema_migrations order by version`).map((r) => r.version);
    const [{ policies }] = await sql`select count(*)::int as policies from pg_policies where schemaname in ('public', 'private', 'storage')`;
    const [{ functions }] = await sql`
      select count(*)::int as functions from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private')`;
    const [{ cron }] = await sql`select count(*)::int as cron from cron.job`;
    const [{ vault, readable }] = await sql`
      select count(*)::int as vault, count(*) filter (where decrypted_secret is not null)::int as readable from vault.decrypted_secrets`;
    const usable = (await sql`select name from vault.decrypted_secrets where name = any(${REQUIRED_SECRETS}) and decrypted_secret is not null`).map((r) => r.name);
    return {
      counts,
      migrations,
      policies,
      functions,
      cron,
      vault,
      readable,
      usable,
      tablesWithoutRls: tables.filter((t) => t.name.startsWith("public.") && !t.rls).map((t) => t.name),
    };
  } finally {
    await sql.end();
  }
}

const prodUrl = process.env.PROD_DB_URL;
const scratchUrl = process.env.SCRATCH_DB_URL;
if (!prodUrl || !scratchUrl) {
  console.error("PROD_DB_URL and SCRATCH_DB_URL are required");
  process.exit(2);
}

const [prod, restored] = await Promise.all([snapshot(prodUrl), snapshot(scratchUrl)]);
const counts = compareCounts(prod.counts, restored.counts);
const problems = compareCatalog(prod, restored);
if (restored.cron !== prod.cron) problems.push(`cron jobs: production ${prod.cron}, restore ${restored.cron}`);
const unusable = REQUIRED_SECRETS.filter((n) => !restored.usable.includes(n));
if (unusable.length) problems.push(`Vault secrets missing or unreadable in the restore: ${unusable.join(", ")} (scripts/restore/reseed-vault.sql)`);
const badTables = counts.filter((c) => !c.ok);
for (const c of badTables) problems.push(`rows in ${c.table}: production ${c.prod ?? "missing"}, restore ${c.restored ?? "missing"}`);

const total = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const summary = [
  "## Restore drill",
  "",
  `| | Production | Restore |`,
  `| --- | --- | --- |`,
  `| Migrations | ${prod.migrations.length} | ${restored.migrations.length} |`,
  `| Tables | ${Object.keys(prod.counts).length} | ${Object.keys(restored.counts).length} |`,
  `| Rows | ${total(prod.counts)} | ${total(restored.counts)} |`,
  `| Policies | ${prod.policies} | ${restored.policies} |`,
  `| Functions | ${prod.functions} | ${restored.functions} |`,
  `| Cron jobs | ${prod.cron} | ${restored.cron} |`,
  `| Vault secrets readable | ${prod.readable}/${prod.vault} | ${restored.readable}/${restored.vault} |`,
  "",
  problems.length ? `**${problems.length} problem(s):**\n\n${problems.map((p) => `- ${p}`).join("\n")}` : "**Everything matches.**",
  "",
].join("\n");

writeFileSync("restore-report.json", JSON.stringify({ at: new Date().toISOString(), problems, counts, prod: { ...prod, counts: undefined }, restored: { ...restored, counts: undefined } }, null, 2));
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
process.exit(problems.length ? 1 : 0);
