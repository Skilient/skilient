// Checks every services/<name>/migrations/*.sql (CLAUDE.md, "Never"):
//   - named NNNN_what.sql;
//   - names no other service's schema;
//   - every table it creates gets row-level security, enabled and forced (default deny).
// Usage: node tools/lint/src/check-migrations.mjs [root]. Exits 1 on any problem.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { foreignPattern, schemaOf, serviceNames } from "./schemas.mjs";

const FILE = /^\d{4}_[a-z0-9_]+\.sql$/;

function stripComments(sql) {
  return sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

export function checkService(service, files, services) {
  const problems = [];
  const own = schemaOf(service);
  const pattern = foreignPattern(services.filter((s) => s !== service).map(schemaOf));
  const all = [];
  for (const [name, text] of files) {
    if (!FILE.test(name)) problems.push(`${service}/migrations/${name}: name it NNNN_what.sql`);
    const sql = stripComments(text);
    all.push(sql);
    for (const line of sql.split("\n")) {
      const m = pattern?.exec(line);
      if (m) problems.push(`${service}/migrations/${name}: names another service's schema '${m[1]}'`);
    }
  }
  const joined = all.join("\n").toLowerCase().replace(/\s+/g, " ");
  for (const m of joined.matchAll(/create table (?:if not exists )?("?[a-z_]+"?)\.("?[a-z_0-9]+"?)/g)) {
    const [schema, table] = [m[1].replace(/"/g, ""), m[2].replace(/"/g, "")];
    if (schema !== own) {
      problems.push(`${service}: creates ${schema}.${table} outside its own schema '${own}'`);
      continue;
    }
    for (const what of ["enable", "force"]) {
      if (!joined.includes(`alter table ${own}.${table} ${what} row level security`))
        problems.push(`${service}: table ${own}.${table} needs "alter table ${own}.${table} ${what} row level security"`);
    }
  }
  for (const m of joined.matchAll(/create table (?!if not exists )("?[a-z_0-9]+"?)\s*\(/g)) {
    problems.push(`${service}: create table ${m[1]} must name its schema (${own}.${m[1]})`);
  }
  return problems;
}

export function checkAll(root) {
  const services = serviceNames(root);
  const problems = [];
  for (const service of services) {
    const dir = join(root, "services", service, "migrations");
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => [f, readFileSync(join(dir, f), "utf8")]);
    problems.push(...checkService(service, files, services));
  }
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const root = resolve(process.argv[2] ?? join(import.meta.dirname, "../../.."));
  const problems = checkAll(root);
  for (const p of problems) console.error(p);
  if (problems.length) process.exit(1);
  console.log("migrations: ok");
}
