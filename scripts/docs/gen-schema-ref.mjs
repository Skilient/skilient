// Generates catalog reference pages from the LOCAL Supabase Docker database.
// Usage: node scripts/docs/gen-schema-ref.mjs [--container supabase_db_skilient] [--snapshot /tmp/catalog.json]
// No remote connection option is accepted. Requires Docker and psql in the DB container.
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const output = resolve(root, "docs/code/reference/schema");
const args = process.argv.slice(2);
const options = new Map();
for (let i = 0; i < args.length; i += 2) {
  if (!["--container", "--snapshot"].includes(args[i]) || !args[i + 1] || options.has(args[i])) {
    throw new Error("Usage: gen-schema-ref.mjs [--container supabase_db_NAME] [--snapshot /tmp/catalog.json]");
  }
  options.set(args[i], args[i + 1]);
}
const container = options.get("--container") ?? "supabase_db_skilient";
if (!/^supabase_db_[a-zA-Z0-9_-]+$/.test(container)) throw new Error("Expected a local Supabase DB container name");
const fingerprint = readFileSync(resolve(root, "scripts/docs/schema-fingerprint.sql"), "utf8");
const cte = fingerprint.split("-- Query 1: per-object fingerprints.\n")[1].split("\nSELECT kind, schema, name, md5")[0];
const query = cte + "\nSELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY kind, schema, name), '[]'::jsonb) FROM objects o;";
const objects = JSON.parse(execFileSync("docker", ["exec", "-i", container, "psql", "-XAt", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
  { input: query, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
if (options.has("--snapshot")) {
  const snapshot = resolve(options.get("--snapshot"));
  writeFileSync(snapshot, JSON.stringify(objects, null, 2) + "\n");
  const hashes = execFileSync("docker", ["exec", "-i", container, "psql", "-XAt", "-F", "\t", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
    { input: fingerprint, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(snapshot + ".fingerprints.tsv", hashes);
}
const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const migrations = readdirSync(resolve(root, "supabase/migrations")).filter((f) => /^\d+_.+\.sql$/.test(f)).sort()
  .map((file) => ({ file, text: readFileSync(resolve(root, "supabase/migrations", file), "utf8") }));
// Only declarations are indexed; migration statements are never executed by this script.
const tables = new Map();
const functions = new Map();
function splitArgs(s) {
  const parts = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === quote && s[i + 1] === quote) i++;
      else if (c === quote) quote = null;
    } else if (c === "'" || c === '"') quote = c;
    else if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (c === "," && depth === 0) {
      parts.push(s.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(s.slice(start));
  return parts;
}
const normalizeArgs = (s) => splitArgs(s.replace(/--[^\n]*/g, "")).map((part) => part.replace(/\bdefault\b[\s\S]*/gi, "").trim()).join(", ")
  .replace(/\bpublic\./gi, "")
  .replace(/\btimestamptz\b/gi, "timestamp with time zone").replace(/\bint4\b|\bint\b/gi, "integer")
  .replace(/\bint8\b/gi, "bigint").replace(/\bbool\b/gi, "boolean").replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").trim().toLowerCase();
for (const migration of migrations) {
  const text = migration.text.replace(/--[^\n]*/g, "");
  for (const match of text.matchAll(/\bcreate\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?((?:[a-z_][\w]*\.)?[a-z_][\w]*)\s*\(/gi)) {
    const name = match[1].includes(".") ? match[1] : "public." + match[1];
    if (!tables.has(name)) tables.set(name, migration.file);
  }
  for (const match of text.matchAll(/\bcreate\s+(?:or\s+replace\s+)?function\s+((?:[a-z_][\w]*\.)?[a-z_][\w]*)\s*\(([\s\S]*?)\)\s*(?:returns|language)\b/gi)) {
    const name = match[1].includes(".") ? match[1] : "public." + match[1];
    const key = name + "(" + normalizeArgs(match[2]) + ")";
    functions.set(key, migration.file);
  }
  // These migrations generate public wrappers from the private signature at that point.
  for (const call of text.matchAll(/select\s+pg_temp\.expose\(array\[([\s\S]*?)\]/gi)) {
    for (const [, name] of call[1].matchAll(/'([a-z_][\w]*)'/g)) {
      const allKeys = [...functions.keys()].filter((key) => key.startsWith("private." + name + "("));
      const currentKeys = allKeys.filter((key) => functions.get(key) === migration.file);
      const privateKeys = currentKeys.length ? currentKeys : allKeys;
      if (privateKeys.length !== 1) throw new Error("Ambiguous generated wrapper: " + name + " in " + migration.file);
      functions.set(privateKeys[0].replace(/^private\./, "public."), migration.file);
    }
  }
  for (const [, oldName, , newName] of text.matchAll(/alter\s+function\s+((?:private|public)\.[\w]+)\(([^)]*)\)\s+rename\s+to\s+([\w]+)/gi)) {
    const keys = [...functions.keys()].filter((key) => key.startsWith(oldName + "("));
    if (keys.length !== 1) throw new Error("Ambiguous function rename: " + oldName);
    functions.set(keys[0].replace(oldName + "(", oldName.split(".")[0] + "." + newName + "("), migration.file);
  }
  if (text.includes("pg_temp.patch")) {
    for (const [, signature] of text.matchAll(/'((?:private|public)\.[\w]+\([^']*\))'/g)) {
      const name = signature.slice(0, signature.indexOf("("));
      const types = normalizeArgs(signature.slice(signature.indexOf("(") + 1, -1));
      const keys = [...functions.keys()].filter((key) => key.startsWith(name + "(") &&
        normalizeArgs(key.slice(name.length + 1, -1)).split(", ").map((arg) => arg.replace(/^[a-z_][\w]*\s+/, "")).join(", ") === types);
      if (keys.length !== 1) throw new Error("Ambiguous patched function: " + signature);
      functions.set(keys[0], migration.file);
    }
  }
}
const domain = (file, schema) => file ? file.replace(/^\d+_/, "").replace(/\.sql$/, "") : "platform-" + schema;
const pages = new Map();
const cell = (v) => String(v ?? "—").replaceAll("|", "\\|").replaceAll("\n", " ");
const code = (v) => "\n```sql\n" + v + "\n```\n";
const cite = (file, symbol) => file ? "[src: supabase/migrations/" + file + "#" + symbol + "]" : "[src: scripts/docs/schema-fingerprint.sql#pg_catalog]";
function add(page, text) {
  if (!pages.has(page)) pages.set(page, []);
  pages.get(page).push(text);
}
for (const o of objects) {
  const name = o.schema + "." + o.name;
  const d = o.definition;
  if (o.kind === "table") {
    const file = tables.get(name);
    let text = "## " + name + "\n\n" + cite(file, o.name) + "\n\nRLS: " + d.rls + "; FORCE RLS: " + d.force_rls + ".\n\n";
    text += "| Column | Type | NOT NULL | Default | Identity | Generated | Collation |\n| --- | --- | --- | --- | --- | --- | --- |\n";
    text += d.columns.map((c) => "| " + [c.name, c.type, c.not_null, c.default, c.identity, c.generated, c.collation].map(cell).join(" | ") + " |").join("\n");
    text += "\n\n### Keys and constraints\n" + (d.constraints.length ? d.constraints.map((c) => code(c.name + ": " + c.definition + "; -- validated: " + c.validated)).join("") : "\nNone.\n");
    text += "\n### Indexes\n" + (d.indexes.length ? d.indexes.map((i) => code(i.definition + "; -- valid: " + i.valid)).join("") : "\nNone.\n");
    const policies = objects.filter((p) => p.kind === "policy" && p.schema === o.schema && p.name.startsWith(o.name + "."));
    text += "\n### Policies\n" + (policies.length ? policies.map((p) => "\n#### " + p.name + "\n\n```json\n" + JSON.stringify(p.definition, null, 2) + "\n```\n").join("") : "\nNone.\n");
    const triggers = objects.filter((t) => t.kind === "trigger" && t.schema === o.schema && t.name.startsWith(o.name + "."));
    text += "\n### Triggers\n" + (triggers.length ? triggers.map((t) => code(t.definition.definition + "; -- enabled: " + t.definition.enabled)).join("") : "\nNone.\n");
    add(domain(file, o.schema), text);
  } else if (o.kind === "function") {
    const symbol = o.name.split("(")[0];
    const key = o.schema + "." + symbol + "(" + normalizeArgs(o.name.slice(symbol.length + 1, -1)) + ")";
    const file = functions.get(key);
    if (!file && ["public", "private"].includes(o.schema)) throw new Error("Unmatched function signature: " + key);
    add(domain(file, o.schema), "## " + name + "\n\n" + cite(file, symbol) + "\n\n" +
      "| Signature | Language | SECURITY DEFINER | search_path | EXECUTE (non-owner) | Last defining migration |\n| --- | --- | --- | --- | --- | --- |\n| " +
      [name, d.language, d.security_definer, (d.config ?? []).find((v) => v.startsWith("search_path=")) ?? "(session default)",
        d.execute_grants.join(", ") || "None", file ?? "(platform/extension)"].map(cell).join(" | ") + " |\n");
  } else if (["cron", "queue", "bucket"].includes(o.kind)) {
    add({ cron: "cron-jobs", queue: "queues", bucket: "buckets" }[o.kind],
      "## " + name + "\n\n[src: scripts/docs/schema-fingerprint.sql#" + ({ cron: "cron.job", queue: "pgmq.meta", bucket: "storage.buckets" }[o.kind]) + "]\n\n```json\n" + JSON.stringify(d, null, 2) + "\n```\n");
  } else if (["enum", "view", "materialized_view", "extension"].includes(o.kind)) {
    add("platform-" + o.schema, "## " + o.kind + ": " + name + "\n\n[src: scripts/docs/schema-fingerprint.sql#pg_catalog]\n\n```json\n" + JSON.stringify(d, null, 2) + "\n```\n");
  }
}
mkdirSync(output, { recursive: true });
for (const [page, sections] of [...pages].sort(([a], [b]) => a.localeCompare(b))) {
  const text = "Generated, do not edit.\nCommit: " + commit + "\nCovers: supabase/migrations/, local database catalogs\n\n# " + page + "\n\n" + sections.join("\n");
  // Refuse to publish credentials or hosted-project identifiers embedded in catalog definitions.
  if (/https?:\/\/[a-z0-9]{20}\.supabase\.co|\b(?:sb_secret_|sbp_)[A-Za-z0-9]+|eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\./.test(text)) {
    throw new Error("Sensitive-looking catalog literal in " + page + "; output refused");
  }
  writeFileSync(resolve(output, page + ".md"), text);
}
console.log("Generated " + pages.size + " schema pages from " + objects.length + " catalog objects.");
