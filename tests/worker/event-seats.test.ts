import { execSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * PRD 5.31 done-when: a society event never oversells. 120 students call register_event through
 * PostgREST (the app's path) at the same moment for a ticket type with 50 seats: exactly 50 are
 * confirmed and 70 waitlisted at positions 1..70. Then 10 confirmed students cancel at once and the
 * waitlist moves up in order, under the same row lock. Needs the local stack; everything is removed after.
 */
const url = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
function localStack(): { api: string; anonKey: string; jwtSecret: string } {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_JWT_SECRET) {
    return { api: process.env.SUPABASE_URL, anonKey: process.env.SUPABASE_ANON_KEY, jwtSecret: process.env.SUPABASE_JWT_SECRET };
  }
  const env = Object.fromEntries(
    execSync("pnpm exec supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\n")
      .map((l) => /^([A-Z_]+)="?(.*?)"?$/.exec(l.trim()))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => [m[1], m[2]]),
  );
  return { api: env.API_URL, anonKey: env.ANON_KEY, jwtSecret: env.JWT_SECRET };
}
const { api, anonKey, jwtSecret } = localStack();
const admin = postgres(url, { max: 1, onnotice: () => undefined });

const N = 120;
const SEATS = 50;
const tag = randomUUID().slice(0, 8);
const students = Array.from({ length: N }, () => randomUUID());
const officer = randomUUID();
let societyId = "";
let eventId = "";
let ticketId = "";

function token(sub: string): string {
  const b = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const head = b({ alg: "HS256", typ: "JWT" });
  const body = b({ sub, role: "authenticated", aal: "aal1", exp: Math.floor(Date.now() / 1000) + 600 });
  const sig = createHmac("sha256", jwtSecret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

async function rpc(sub: string, fn: string, args: object): Promise<{ ok: boolean; body: unknown; message?: string }> {
  const client = createClient(api, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token(sub)}` } },
  });
  const { data, error } = await client.rpc(fn, args);
  return { ok: !error, body: data, message: error?.message };
}

beforeAll(async () => {
  const all = [officer, ...students];
  for (let i = 0; i < all.length; i += 50) {
    const batch = all.slice(i, i + 50);
    await admin`insert into auth.users ${admin(batch.map((id, j) => ({ id, email: `es-${i + j}-${tag}@nutech.edu.pk` })))}`;
  }
  await admin`update public.profiles set onboarding_complete = true, username = 'es_' || left(replace(user_id::text, '-', ''), 12)
              where user_id = any(${all})`;
  const [u] = await admin<{ university_id: string }[]>`select university_id from public.profiles where user_id = ${officer}`;
  const [s] = await admin<{ id: string }[]>`
    insert into public.societies (university_id, slug, name, name_key, category, about, status, created_by, verified_at)
    values (${u.university_id}, ${`load-${tag}`}, ${`Load Society ${tag}`}, ${`load ${tag}`}, 'technology',
            'A society that exists to test seat locks under load.', 'verified', ${officer}, now())
    returning id`;
  societyId = s.id;
  await admin`insert into public.society_members (society_id, user_id, role, title) values (${societyId}, ${officer}, 'president', 'President')`;
  const [e] = await admin<{ id: string }[]>`
    insert into public.events (university_id, society_id, created_by, type, scope, title, starts_at, ends_at, location, status, published_at)
    values (${u.university_id}, ${societyId}, ${officer}, 'workshop', 'university', 'Load workshop',
            now() + interval '2 days', now() + interval '2 days 2 hours', 'Hall A', 'published', now())
    returning id`;
  eventId = e.id;
  await admin`insert into private.event_secrets (event_id) values (${eventId})`;
  await admin`insert into public.event_sessions (event_id, position, starts_at, ends_at)
              values (${eventId}, 1, now() + interval '2 days', now() + interval '2 days 2 hours')`;
  const [t] = await admin<{ id: string }[]>`
    insert into public.event_ticket_types (event_id, position, name, capacity) values (${eventId}, 1, 'Seat', ${SEATS}) returning id`;
  ticketId = t.id;
}, 120_000);

afterAll(async () => {
  if (societyId) await admin`delete from public.societies where id = ${societyId}`;
  await admin`delete from auth.users where id = any(${[officer, ...students]})`;
  await admin.end();
});

describe("society event seats under 120 concurrent students", () => {
  it("confirms exactly 50 and waitlists the rest at 1..70", async () => {
    const results = await Promise.all(students.map((sub) => rpc(sub, "register_event", { p_event: eventId, p: { ticket_type_id: ticketId, answers: [] } })));
    expect(results.filter((r) => !r.ok).map((r) => r.message)).toEqual([]);
    const statuses = results.map((r) => (r.body as { status: string }).status);
    expect(statuses.filter((x) => x === "confirmed")).toHaveLength(SEATS);
    expect(statuses.filter((x) => x === "waitlisted")).toHaveLength(N - SEATS);

    const rows = await admin<{ status: string; waitlist_position: number | null }[]>`
      select status, waitlist_position from public.event_registrations where event_id = ${eventId}`;
    expect(rows).toHaveLength(N);
    expect(rows.filter((r) => r.status === "confirmed")).toHaveLength(SEATS);
    const positions = rows.filter((r) => r.status === "waitlisted").map((r) => r.waitlist_position!).sort((a, b) => a - b);
    expect(positions).toEqual(Array.from({ length: N - SEATS }, (_, i) => i + 1));
  }, 120_000);

  it("refuses a second registration by the same student, even in parallel", async () => {
    const twice = await Promise.all([0, 1, 2].map(() => rpc(students[0], "register_event", { p_event: eventId, p: { ticket_type_id: ticketId, answers: [] } })));
    expect(twice.every((r) => !r.ok)).toBe(true);
    const [n] = await admin<{ n: number }[]>`select count(*)::int as n from public.event_registrations where event_id = ${eventId} and user_id = ${students[0]}`;
    expect(n.n).toBe(1);
  });

  it("moves the waitlist up in order when 10 confirmed students cancel at once", async () => {
    const confirmed = await admin<{ user_id: string }[]>`
      select user_id from public.event_registrations where event_id = ${eventId} and status = 'confirmed' limit 10`;
    const firstTen = await admin<{ user_id: string }[]>`
      select user_id from public.event_registrations where event_id = ${eventId} and status = 'waitlisted' order by waitlist_position limit 10`;
    const cancels = await Promise.all(confirmed.map((c) => rpc(c.user_id, "cancel_registration", { p_event: eventId })));
    expect(cancels.filter((r) => !r.ok).map((r) => r.message)).toEqual([]);

    const [counts] = await admin<{ confirmed: number; waitlisted: number; cancelled: number }[]>`
      select count(*) filter (where status = 'confirmed')::int as confirmed,
             count(*) filter (where status = 'waitlisted')::int as waitlisted,
             count(*) filter (where status = 'cancelled')::int as cancelled
        from public.event_registrations where event_id = ${eventId}`;
    expect(counts).toEqual({ confirmed: SEATS, waitlisted: N - SEATS - 10, cancelled: 10 });
    const promoted = await admin<{ user_id: string }[]>`
      select user_id from public.event_registrations where event_id = ${eventId} and status = 'confirmed' and user_id = any(${firstTen.map((r) => r.user_id)})`;
    expect(promoted).toHaveLength(10);
  }, 120_000);
});
