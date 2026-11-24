// Copies every Storage file from production to the restored scratch project. A database dump carries the
// storage.objects rows (names, owners, metadata) but not the files themselves.
// Usage: PROD_DB_URL=… PROD_URL=https://<ref>.supabase.co PROD_KEY=<secret key> SCRATCH_URL=… SCRATCH_KEY=… node copy-storage.mjs
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const { PROD_DB_URL, PROD_URL, PROD_KEY, SCRATCH_URL, SCRATCH_KEY } = process.env;
if (!PROD_DB_URL || !PROD_URL || !PROD_KEY || !SCRATCH_URL || !SCRATCH_KEY) {
  console.error("PROD_DB_URL, PROD_URL, PROD_KEY, SCRATCH_URL and SCRATCH_KEY are required");
  process.exit(2);
}
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const from = createClient(PROD_URL, PROD_KEY, options);
const to = createClient(SCRATCH_URL, SCRATCH_KEY, options);

const sql = postgres(PROD_DB_URL, { max: 1, prepare: false, ssl: PROD_DB_URL.includes("127.0.0.1") ? false : "require" });
const objects = await sql`select bucket_id, name, metadata ->> 'mimetype' as type from storage.objects order by bucket_id, name`;
await sql.end();

let copied = 0;
const failed = [];
for (const o of objects) {
  const { data, error } = await from.storage.from(o.bucket_id).download(o.name);
  if (error || !data) {
    failed.push(`${o.bucket_id}/${o.name}: download ${error?.message ?? "empty"}`);
    continue;
  }
  const { error: up } = await to.storage
    .from(o.bucket_id)
    .upload(o.name, data, { upsert: true, contentType: o.type ?? data.type ?? "application/octet-stream" });
  if (up) failed.push(`${o.bucket_id}/${o.name}: upload ${up.message}`);
  else copied += 1;
}
const line = `Storage: ${copied} of ${objects.length} files copied${failed.length ? `, ${failed.length} failed` : ""}.`;
console.log(line);
for (const f of failed.slice(0, 50)) console.log(`  ${f}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n${line}\n`);
}
process.exit(failed.length ? 1 : 0);
