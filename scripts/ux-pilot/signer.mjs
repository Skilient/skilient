#!/usr/bin/env node
/**
 * Local stand-in for the cv-sign Edge Function (which can't boot in this container): runs the function's own code
 * from Node, as tests/e2e/cv.spec.ts and scripts/load/seed.mjs do. Issues a first CV for the named users (or
 * `source` given by SIGN_SOURCE: first | on_demand | reissue), drains the CV queue and seals pending Record entries.
 * Local only. Usage: node scripts/ux-pilot/signer.mjs uxp_tester uxp_spark
 */
import postgres from "postgres";
const DB = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
if (!/@(127\.0\.0\.1|localhost):/.test(DB)) { console.error("signer: refused, not the local stack"); process.exit(2); }
const sql = postgres(DB, { max: 2, onnotice: () => undefined, prepare: false });
const { issueCv, rotateKey, drainQueue } = await import("../../supabase/functions/_shared/cv/issue.ts");
const { drainRecordQueue } = await import("../../supabase/functions/_shared/cv/record.ts");
const { dbFrom } = await import("../../supabase/functions/_shared/github/types.ts");
const deps = { db: dbFrom(sql), log: () => undefined };
const [active] = await sql`select key_id from public.signing_keys where retired_at is null`;
if (!active) await rotateKey(deps);
for (const username of process.argv.slice(2)) {
  const [u] = await sql`select user_id from public.profiles where username = ${username}`;
  if (!u) { console.log(JSON.stringify({ username, status: "no such user" })); continue; }
  const r = await issueCv(deps, u.user_id, process.env.SIGN_SOURCE ?? "first").catch((e) => ({ status: "error", error: e.message }));
  console.log(JSON.stringify({ username, ...r }));
}
console.log(JSON.stringify({ cv_queue: await drainQueue(deps).catch((e) => e.message) }));
let sealed = 0;
for (let i = 0; i < 20; i++) { const r = await drainRecordQueue(deps, 25); sealed += r.sealed; if (r.sealed + r.skipped + r.failed + r.dropped === 0) break; }
console.log(JSON.stringify({ record_sealed: sealed }));
await sql.end();
