#!/usr/bin/env node
/**
 * Synthetic load data for the k6 busy-hour run (phase 13, docs/load-test.md). Builds a university at
 * launch capacity on the SCRATCH project (or the local stack): students, friendships, posts, comments,
 * DM threads, ventures, verified societies with officers, upcoming events to register for, and past
 * events whose attendees hold sealed Record entries. Writes the fixtures k6 reads (LOAD_FIXTURES).
 *
 * Writes go through the product's own functions wherever a person would make the row (save_society_event,
 * publish_event, register_event, check_in_person, issue_event_entries, get_or_create_dm, create_venture),
 * impersonating the user inside a transaction, so the data obeys the same rules a real account's would.
 * Bulk content a person would have typed over months (posts, comments, friendships) is inserted directly,
 * with the triggers still firing. Re-running is safe: accounts and societies are found by their load- names.
 *
 * Never against production: the target must be 127.0.0.1/localhost, or its project ref must equal
 * LOAD_CONFIRM_SCRATCH, and must not equal PRODUCTION_PROJECT_REF when that is set.
 *
 * Env: SUPABASE_URL, SUPABASE_SECRET_KEY (service role, the seeder is a job), DATABASE_URL (direct
 * connection as postgres), LOAD_PASSWORD, and optionally LOAD_USERS (5000), LOAD_DOMAIN (nutech.edu.pk),
 * LOAD_SOCIETIES (10), LOAD_EVENTS (120), LOAD_POSTS (20000), LOAD_FIXTURES (tests/load/fixtures.json).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { checkTarget, loadEmail, loadUsername, officerEmail, pairOf, pick, seeded } from "./lib.mjs";

const env = (name, fallback) => {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") throw new Error(`${name} is required`);
  return v;
};
const SUPABASE_URL = env("SUPABASE_URL");
const SECRET_KEY = env("SUPABASE_SECRET_KEY");
const DATABASE_URL = env("DATABASE_URL");
const PASSWORD = env("LOAD_PASSWORD");
const USERS = Number(env("LOAD_USERS", "5000"));
const DOMAIN = env("LOAD_DOMAIN", "nutech.edu.pk");
const SOCIETIES = Number(env("LOAD_SOCIETIES", "10"));
const EVENTS = Number(env("LOAD_EVENTS", "120"));
const POSTS = Number(env("LOAD_POSTS", "20000"));
const FIXTURES = env("LOAD_FIXTURES", "tests/load/fixtures.json");

const refusal = checkTarget(SUPABASE_URL, process.env.LOAD_CONFIRM_SCRATCH, process.env.PRODUCTION_PROJECT_REF);
if (refusal) {
  console.error(`seed: refused: ${refusal}`);
  process.exit(2);
}

const sql = postgres(DATABASE_URL, { max: 8, onnotice: () => undefined, prepare: false });
const admin = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const rand = seeded(13);
const log = (step, fields = {}) => console.log(JSON.stringify({ job: "load.seed", step, ...fields }));

/** Runs `fn` as the signed-in user, inside one transaction, the way PostgREST would. */
async function asUser(uid, fn) {
  return sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: uid, role: "authenticated", aal: "aal1" })}, true)`;
    await tx.unsafe("set local role authenticated");
    return fn(tx);
  });
}

/** Runs `fn` over items with at most `n` in flight. */
async function pool(items, n, fn) {
  let next = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}

async function ensureAccount(email, fullName) {
  const [found] = await sql`select id from auth.users where email = ${email}`;
  if (found) return found.id;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`);
  return data.user.id;
}

async function main() {
  const started = Date.now();
  const [uni] = await sql`select d.university_id from public.university_domains d where d.domain = ${DOMAIN} limit 1`;
  if (!uni) throw new Error(`no university has the domain ${DOMAIN}`);
  const universityId = uni.university_id;
  await sql`update public.universities set live_at = coalesce(live_at, now()) where id = ${universityId}`;
  const [agreement] = await sql`select version from public.agreement_versions where published_at is not null order by version desc limit 1`;

  // 1. Students and officers (Auth admin API, so the signup hook and handle_new_user run as for anyone).
  const students = new Array(USERS);
  await pool(Array.from({ length: USERS }, (_, i) => i + 1), 10, async (n) => {
    students[n - 1] = await ensureAccount(loadEmail(n, DOMAIN), `Load Student ${n}`);
  });
  const officers = [];
  for (let s = 1; s <= SOCIETIES * 2; s++) officers.push(await ensureAccount(officerEmail(s, DOMAIN), `Load Officer ${s}`));
  log("accounts", { students: USERS, officers: officers.length });

  // 2. Every account past the agreement, onboarding and the tour, with a username k6 can address.
  const everyone = [
    ...students.map((id, i) => ({ id, username: loadUsername(i + 1) })),
    ...officers.map((id, i) => ({ id, username: `load_officer_${String(i + 1).padStart(2, "0")}` })),
  ];
  for (let i = 0; i < everyone.length; i += 500) {
    const chunk = everyone.slice(i, i + 500);
    const rows = chunk.map((p, j) => ({ ...p, department: pick(["Computer Science", "Software Engineering", "Electrical Engineering", "Business"], i + j), year: 2026 + ((i + j) % 4) }));
    await sql`
      update public.profiles p set username = v.username, department = v.department, graduation_year = v.year::int, onboarding_complete = true
        from (values ${sql(rows.map((r) => [r.id, r.username, r.department, r.year]))}) as v(id, username, department, year)
       where p.user_id = v.id::uuid and (p.username is distinct from v.username or not p.onboarding_complete)`;
    await sql`insert into public.agreement_acceptances ${sql(chunk.map((p) => ({ user_id: p.id, version: agreement.version })))} on conflict do nothing`;
    await sql`insert into public.tour_progress ${sql(chunk.map((p) => ({ user_id: p.id, tour_id: "student", step: 0, skipped_at: new Date() })))} on conflict do nothing`;
  }
  log("profiles");

  // 3. Friendships: each student's k6 chat partner, plus about 14 random classmates.
  const pairs = new Set();
  const addPair = (a, b) => {
    if (a === b) return;
    pairs.add(a < b ? `${a}|${b}` : `${b}|${a}`);
  };
  for (let n = 1; n <= USERS; n++) {
    addPair(students[n - 1], students[pairOf(n, USERS) - 1]);
    for (let k = 0; k < 7; k++) addPair(students[n - 1], students[Math.floor(rand() * USERS)]);
  }
  const friendRows = [...pairs].map((p) => p.split("|"));
  for (let i = 0; i < friendRows.length; i += 2000) {
    await sql`insert into public.friendships (user_id_a, user_id_b) values ${sql(friendRows.slice(i, i + 2000))} on conflict do nothing`;
  }
  log("friendships", { pairs: friendRows.length });

  // 4. DM threads for the k6 chat pairs (the product's own function, as the first of each pair).
  const chatPairs = [];
  for (let n = 1; n <= USERS; n++) if (n < pairOf(n, USERS)) chatPairs.push(n);
  await pool(chatPairs, 8, async (n) => {
    await asUser(students[n - 1], (tx) => tx`select public.get_or_create_dm(${loadUsername(pairOf(n, USERS))})`);
  });
  log("dm_threads", { threads: chatPairs.length });

  // 5. Thirty days of posts and comments (direct inserts; feed, survey and analytics triggers fire).
  const [{ have }] = await sql`select count(*)::int as have from public.posts p join public.profiles pr on pr.user_id = p.author_id where pr.username like 'load\\_%'`;
  const bodies = [
    "Shipped the timetable planner's export today. Feedback welcome.",
    "Looking for a designer for our FYP. Figma and some React would be ideal.",
    "Notes from the data structures workshop are up on the venture page.",
    "Anyone else preparing for the ICPC regional? Practice set on Saturday.",
    "First pull request merged into an open-source project. Small, but it counts.",
    "Our society's induction round opens next week. Five roles this term.",
  ];
  const postRows = [];
  for (let i = have; i < POSTS; i++) {
    postRows.push({
      author_id: students[Math.floor(rand() * USERS)],
      university_id: universityId,
      audience: "university",
      type: "general",
      body: `${pick(bodies, i)} (#${i})`,
      created_at: new Date(Date.now() - Math.floor(rand() * 30 * 86400_000)),
    });
  }
  // Every student has at least two posts, so the badge journey can comment on its partner's post.
  for (let n = 1; n <= USERS && have === 0; n++) {
    for (let k = 0; k < 2; k++) postRows.push({ author_id: students[n - 1], university_id: universityId, audience: "university", type: "general", body: `${pick(bodies, n + k)} (own ${n}.${k})`, created_at: new Date(Date.now() - Math.floor(rand() * 7 * 86400_000)) });
  }
  for (let i = 0; i < postRows.length; i += 1000) await sql`insert into public.posts ${sql(postRows.slice(i, i + 1000))}`;
  const postIds = (await sql`select p.id from public.posts p join public.profiles pr on pr.user_id = p.author_id where pr.username like 'load\\_%' order by p.created_at desc limit 5000`).map((r) => r.id);
  if (have === 0) {
    const comments = [];
    for (let i = 0; i < postIds.length * 3; i++) {
      comments.push({ post_id: postIds[Math.floor(rand() * postIds.length)], author_id: students[Math.floor(rand() * USERS)], body: pick(["Nice work.", "Which stack did you use?", "Count me in.", "Sharing with my group."], i) });
    }
    for (let i = 0; i < comments.length; i += 2000) await sql`insert into public.post_comments ${sql(comments.slice(i, i + 2000))}`;
  }
  log("posts", { posts: postRows.length, comments: have === 0 ? postIds.length * 3 : 0 });

  // 6. Ventures for search (the product's create_venture, as their owners).
  const [{ ventures }] = await sql`select count(*)::int as ventures from public.ventures v join public.profiles p on p.user_id = v.owner_id where p.username like 'load\\_%'`;
  const ventureTitles = ["Timetable planner", "Campus marketplace", "Lab inventory", "Bus tracker", "Library seat finder", "Study group matcher", "Hostel mess menu", "Exam countdown"];
  await pool(Array.from({ length: Math.max(0, 300 - ventures) }, (_, i) => i), 8, async (i) => {
    await asUser(students[(i * 17) % USERS], (tx) => tx`select public.create_venture(${sql.json({ type: "project", title: `${pick(ventureTitles, i)} ${i}`, description: "A load-test venture." })})`);
  });
  log("ventures", { created: Math.max(0, 300 - ventures) });

  // 7. Verified societies with two officers each.
  const societies = [];
  for (let s = 1; s <= SOCIETIES; s++) {
    const slug = `load-society-${s}`;
    const president = officers[(s - 1) * 2];
    const officer = officers[(s - 1) * 2 + 1];
    const [row] = await sql`
      insert into public.societies (university_id, slug, name, name_key, category, about, status, created_by, verified_at)
      values (${universityId}, ${slug}, ${`Load Society ${s}`}, ${`load society ${s}`}, 'technology', 'A society for the load test.', 'verified', ${president}, now() - interval '60 days')
      on conflict (slug) do update set status = 'verified'
      returning id`;
    await sql`insert into public.society_members (society_id, user_id, role, title) values (${row.id}, ${president}, 'president', 'President'), (${row.id}, ${officer}, 'officer', 'General Secretary') on conflict do nothing`;
    societies.push({ id: row.id, slug, president, officer, presidentEmail: officerEmail((s - 1) * 2 + 1, DOMAIN), officerEmail: officerEmail((s - 1) * 2 + 2, DOMAIN) });
  }
  log("societies", { societies: societies.length });

  // 8. Event-day events to register for and check in to (check-in opens 2 hours before the first session,
  // so they all start 90 minutes from now; a re-run moves them and clears the last run's registrations).
  // One in ten has 25 seats, so registrations race for the last seat.
  const events = [];
  const existing = await sql`select e.id, e.society_id, t.id as ticket, t.capacity from public.events e join public.event_ticket_types t on t.event_id = e.id
                              where e.society_id in ${sql(societies.map((s) => s.id))} and e.title like 'Load event %' and e.status = 'published'`;
  for (const e of existing) events.push({ id: e.id, ticket: e.ticket, capacity: e.capacity, society: societies.findIndex((s) => s.id === e.society_id) });
  for (let i = events.length; i < EVENTS; i++) {
    const s = societies[i % societies.length];
    const capacity = i % 10 === 0 ? 25 : 5000;
    const start = new Date(Date.now() + 90 * 60_000);
    const id = await asUser(s.officer, async (tx) => {
      const [{ id }] = await tx`select public.save_society_event(${s.id}, ${sql.json({
        type: pick(["talk", "workshop", "hackathon", "competition"], i), title: `Load event ${i + 1}`, description: "An event for the load test.", location: "Main auditorium",
        sessions: [{ starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 3 * 3600_000).toISOString() }],
        ticket_types: [{ name: "Participant", capacity }], eligibility: { scope: "university" }, approval_mode: "automatic", record_kinds: ["attended"],
      })}) as id`;
      await tx`select public.publish_event(${id})`;
      return id;
    });
    const [t] = await sql`select id from public.event_ticket_types where event_id = ${id}`;
    events.push({ id, ticket: t.id, capacity, society: i % societies.length });
  }
  const eventIds = events.map((e) => e.id);
  await sql`delete from public.event_checkins where event_id in ${sql(eventIds)}`;
  await sql`delete from public.event_registrations where event_id in ${sql(eventIds)}`;
  await sql`update public.event_sessions set starts_at = now() + interval '90 minutes', ends_at = now() + interval '270 minutes' where event_id in ${sql(eventIds)}`;
  await sql`update public.events set starts_at = now() + interval '90 minutes', ends_at = now() + interval '270 minutes' where id in ${sql(eventIds)}`;
  log("events", { events: events.length });

  // 9. The Record: two past events per society; a slice of students attended and holds sealed entries.
  const [{ sealed }] = await sql`select count(*)::int as sealed from public.record_entries r join public.profiles p on p.user_id = r.user_id where p.username like 'load\\_%' and r.status = 'sealed'`;
  if (sealed === 0) {
    for (const [si, s] of societies.entries()) {
      for (let k = 0; k < 2; k++) {
        const start = new Date(Date.now() + 3600_000);
        const eventId = await asUser(s.officer, async (tx) => {
          const [{ id }] = await tx`select public.save_society_event(${s.id}, ${sql.json({
            type: "workshop", title: `Load past event ${si + 1}.${k + 1}`, description: "Attended by load students.", location: "Lab 3",
            sessions: [{ starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 2 * 3600_000).toISOString() }],
            ticket_types: [{ name: "Participant", capacity: 20000 }], eligibility: { scope: "university" }, approval_mode: "automatic", record_kinds: ["attended"],
          })}) as id`;
          await tx`select public.publish_event(${id})`;
          return id;
        });
        const [ticket] = await sql`select id from public.event_ticket_types where event_id = ${eventId}`;
        // About 40% of students per event, so most hold one to four entries.
        const attendees = students.filter((_, n) => (n + si * 7 + k * 3) % 5 < 2);
        await pool(attendees, 8, async (uid) => {
          await asUser(uid, (tx) => tx`select public.register_event(${eventId}, ${sql.json({ ticket_type_id: ticket.id })})`);
        });
        for (let i = 0; i < attendees.length; i += 200) {
          await asUser(s.officer, async (tx) => {
            for (const uid of attendees.slice(i, i + 200)) await tx`select public.check_in_person(${eventId}, null, ${uid})`;
          });
        }
        await sql`update public.event_sessions set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour' where event_id = ${eventId}`;
        await sql`update public.events set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour', status = 'ended' where id = ${eventId}`;
        await asUser(s.president, (tx) => tx`select public.issue_event_entries(${eventId})`);
      }
    }
    // Seal them with the cv-sign worker's own code (needs an active signing key; the drill and E2E rotate one the same way).
    const { rotateKey } = await import("../../supabase/functions/_shared/cv/issue.ts");
    const { drainRecordQueue } = await import("../../supabase/functions/_shared/cv/record.ts");
    const { dbFrom } = await import("../../supabase/functions/_shared/github/types.ts");
    const quiet = () => undefined;
    const [active] = await sql`select key_id from public.signing_keys where retired_at is null`;
    if (!active) await rotateKey({ db: dbFrom(sql), log: quiet });
    for (let round = 0; round < 5000; round++) {
      const r = await drainRecordQueue({ db: dbFrom(sql), log: quiet }, 200);
      if (r.sealed + r.skipped + r.failed + r.dropped === 0) break;
    }
  }
  const [{ entries }] = await sql`select count(*)::int as entries from public.record_entries r join public.profiles p on p.user_id = r.user_id where p.username like 'load\\_%' and r.status = 'sealed'`;
  log("record", { sealed_entries: entries });

  // 10. Statistics for the planner, then the fixtures k6 reads.
  await sql`analyze`;
  mkdirSync(dirname(FIXTURES), { recursive: true });
  writeFileSync(FIXTURES, JSON.stringify({ domain: DOMAIN, users: USERS, societies: societies.map((s) => ({ slug: s.slug, officerEmail: s.officerEmail })), events }, null, 2));
  log("done", { seconds: Math.round((Date.now() - started) / 1000), fixtures: FIXTURES });
}

main()
  .catch((e) => {
    console.error(JSON.stringify({ job: "load.seed", outcome: "error", error: String(e?.message ?? e) }));
    process.exitCode = 1;
  })
  .finally(() => sql.end());
