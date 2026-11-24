/** T013 setup: an officer checks in a not-yet-registered university email at a past event and issues entries (local only). */
import postgres from "postgres";
import { readFileSync } from "node:fs";
const DB = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
if (!/@(127\.0\.0\.1|localhost):/.test(DB)) throw new Error("refused: not local");
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")) throw new Error("refused: not local");
const sql = postgres(DB, { max: 1, onnotice: () => undefined });
const A = JSON.parse(readFileSync("docs/ux-pilot/accounts.local.json", "utf8"));
const officer = A.accounts.officer1.id;
const email = process.argv[2] ?? "uxp-claim@nutech.edu.pk";
const as = (uid, q) => sql.begin(async (tx) => { await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: uid, role: "authenticated", aal: "aal1" })}, true)`; await tx.unsafe("set local role authenticated"); return q(tx); });
const [soc] = await sql`select id from public.societies where name = 'UX Pilot Developers Club'`;
let [ev] = await sql`select id from public.events where title = 'Open-source evening (claim test)'`;
if (!ev) {
  const start = new Date(Date.now() + 3600_000);
  const p = { type: "workshop", title: "Open-source evening (claim test)", description: "First pull requests together.", location: "Lab 2", sessions: [{ starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 7200_000).toISOString() }], ticket_types: [{ name: "Participant", capacity: 30 }], eligibility: { scope: "university" }, approval_mode: "automatic", record_kinds: ["attended"] };
  const id = await as(officer, async (tx) => { const [r] = await tx`select public.save_society_event(${soc.id}, ${JSON.stringify(p)}::text::jsonb) as id`; await tx`select public.publish_event(${r.id})`; return r.id; });
  ev = { id };
}
await as(officer, (tx) => tx`select public.check_in_email(${ev.id}, null, ${email})`).catch((e) => console.log("check-in:", e.message));
await sql`update public.event_sessions set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour' where event_id = ${ev.id}`;
await sql`update public.events set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour', status = 'ended' where id = ${ev.id}`;
await as(officer, (tx) => tx`select public.issue_event_entries(${ev.id})`).catch((e) => console.log("issue:", e.message));
console.log(JSON.stringify(await sql`select status, count(*)::int from public.record_entries where source_id = ${ev.id} group by 1`), JSON.stringify(await sql`select count(*)::int as claims from public.record_claims where event_id = ${ev.id}`));
await sql.end();
