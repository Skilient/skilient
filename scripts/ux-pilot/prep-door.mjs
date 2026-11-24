/** S11 setup: a "door" event starting in an hour with five registered attendees, and a past competition ready for close-out (local only). */
import postgres from "postgres";
import { readFileSync } from "node:fs";
const DB = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
if (!/@(127\.0\.0\.1|localhost):/.test(DB)) throw new Error("refused: not local");
const sql = postgres(DB, { max: 1, onnotice: () => undefined });
const A = JSON.parse(readFileSync("docs/ux-pilot/accounts.local.json", "utf8")); const acc = A.accounts; const S = A.ids.societies;
const as = (uid, text, params = []) => sql.begin(async (tx) => { await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: uid, role: "authenticated", aal: "aal1" })}, true)`; await tx.unsafe("set local role authenticated"); return Object.values((await tx.unsafe(text, params))[0] ?? {})[0]; });
async function event(title, p) {
  let [e] = await sql`select id from public.events where title = ${title}`;
  if (e) return e.id;
  const id = await as(acc.officer1.id, `select public.save_society_event($1, $2::text::jsonb)`, [S.open.id, JSON.stringify({ description: "", location: "Hall C", eligibility: { scope: "university" }, approval_mode: "automatic", ...p, title })]);
  await as(acc.officer1.id, `select public.publish_event($1)`, [id]);
  return id;
}
const now = Date.now();
const door = await event("[UX test] Door check-in night", { type: "talk", sessions: [{ starts_at: new Date(now + 3600_000).toISOString(), ends_at: new Date(now + 3 * 3600_000).toISOString() }], ticket_types: [{ name: "Seat", capacity: 50 }], record_kinds: ["attended"] });
const comp = await event("[UX test] Speed coding contest", { type: "competition", sessions: [{ starts_at: new Date(now + 3600_000).toISOString(), ends_at: new Date(now + 2 * 3600_000).toISOString() }], ticket_types: [{ name: "Contestant", capacity: 50 }], record_kinds: ["attended", "result"], volunteer_hours: true });
for (const [ev, who] of [[door, ["tester", "helperA", "helperB", "finalYear", "applicant2", "testerSpark"]], [comp, ["tester", "helperA", "helperB", "finalYear", "applicant2", "officer1"]]]) {
  const [t] = await sql`select id from public.event_ticket_types where event_id = ${ev}`;
  for (const k of who) await as(acc[k].id, `select public.register_event($1, $2::text::jsonb)`, [ev, JSON.stringify({ ticket_type_id: t.id })]).catch(() => undefined);
}
// The contest: everyone but applicant2 was checked in at the door, then it ended.
for (const k of ["tester", "helperA", "helperB", "finalYear", "officer1"]) {
  const tk = await as(acc[k].id, `select public.event_ticket($1)`, [comp]);
  await as(acc.officer1.id, `select public.check_in_scan($1, null, $2)`, [comp, tk.payload]).catch(() => undefined);
}
await sql`update public.event_sessions set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour' where event_id = ${comp}`;
await sql`update public.events set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour', status = 'ended' where id = ${comp}`;
const codes = {};
for (const k of ["tester", "helperA", "helperB", "finalYear", "applicant2", "testerSpark"]) codes[k] = (await as(acc[k].id, `select public.event_ticket($1)`, [door]))?.code;
console.log(JSON.stringify({ door, comp, codes }));
await sql.end();
