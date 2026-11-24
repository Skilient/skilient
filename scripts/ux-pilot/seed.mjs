#!/usr/bin/env node
/**
 * UX pilot seed (docs/ux-pilot/). Builds the accounts and content the UX test plan's tasks need on the LOCAL
 * stack, and writes their emails, passwords and ids to docs/ux-pilot/accounts.local.json (git-excluded).
 *
 * Writes go through the product's own functions as each user wherever one exists (create_post, create_venture,
 * apply_to_venture/decide_application, send_friend_request, request_society/decide_society, save_society_event,
 * register_event, check_in_scan, issue_event_entries, save_idea, save_swap_offer, …), impersonating the user in a
 * transaction like scripts/load/seed.mjs. Plain SQL only where no function exists: agreement acceptance and
 * profile fields for pre-onboarded accounts, the fake GitHub link and skills, staff roles, the faculty approval,
 * proof tasks in the bank, a Spark score, and moving events into the past.
 *
 * Idempotent: every account and object is found by a fixed email, username or title before it is made.
 * Refuses any NEXT_PUBLIC_SUPABASE_URL that isn't 127.0.0.1 or localhost.
 *
 * Run: source scripts/ux-pilot/env.local.sh && node scripts/ux-pilot/seed.mjs
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const host = (() => {
  try {
    return new URL(URL_).hostname;
  } catch {
    return "";
  }
})();
if (host !== "127.0.0.1" && host !== "localhost") {
  console.error(`ux-pilot seed: refused: NEXT_PUBLIC_SUPABASE_URL (${URL_ || "unset"}) isn't the local stack`);
  process.exit(2);
}
const SECRET = process.env.E2E_SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const DB_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
if (!new URL(DB_URL).hostname.match(/^(127\.0\.0\.1|localhost)$/)) {
  console.error("ux-pilot seed: refused: DATABASE_URL isn't local");
  process.exit(2);
}

export const PASSWORD = "UxPilot-Passw0rd!2026";
const OUT = "docs/ux-pilot/accounts.local.json";
const sql = postgres(DB_URL, { max: 4, onnotice: () => undefined, prepare: false });
const admin = createClient(URL_, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
const log = (step, fields = {}) => console.log(JSON.stringify({ job: "ux-pilot.seed", step, ...fields }));
const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
out.password = PASSWORD;
out.accounts ??= {};
out.ids ??= {};

async function asUser(uid, fn, aal = "aal1") {
  return sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: uid, role: "authenticated", aal })}, true)`;
    await tx.unsafe("set local role authenticated");
    return fn(tx);
  });
}
/** One function call as the user; returns the first column of the first row. */
async function call(uid, text, params = [], aal = "aal1") {
  for (let attempt = 1; ; attempt++) {
    try {
      return await asUser(uid, async (tx) => Object.values((await tx.unsafe(text, params))[0] ?? {})[0], aal);
    } catch (e) {
      // Per-user pacing limits ("wait a few seconds"): wait like a person would, then retry.
      if (e?.code !== "54000" || !/wait|seconds/i.test(e.message) || attempt >= 6) throw e;
      const secs = Number(/(\d+) seconds/.exec(e.message)?.[1] ?? 3);
      await new Promise((r) => setTimeout(r, (secs + 1) * 1000));
    }
  }
}

// --- TOTP (RFC 6238), as tests/e2e/support.ts --------------------------------------------
function base32Decode(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of input.replace(/=+$/, "").toUpperCase()) {
    const v = alphabet.indexOf(c);
    if (v !== -1) bits += v.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
export function totp(secret, now = Date.now()) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  return ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}

// --- Accounts ----------------------------------------------------------------------------
const ACCOUNTS = [
  // key, email, full name, username, opts
  ["tester", "uxp-tester@nutech.edu.pk", "Ayesha Tester", "uxp_tester", { tour: false, year: 2028 }],
  ["testerFresh", "uxp-fresh@nutech.edu.pk", "Bilal Fresh", "uxp_fresh", { year: 2029 }],
  ["testerSpark", "uxp-spark@nutech.edu.pk", "Sana Spark", "uxp_spark", { year: 2028 }],
  ["helperA", "uxp-helper-a@nutech.edu.pk", "Ali Helper", "uxp_helper_a", { year: 2028 }],
  ["helperB", "uxp-helper-b@nutech.edu.pk", "Bushra Helper", "uxp_helper_b", { year: 2028 }],
  ["helperC", "uxp-helper-c@nutech.edu.pk", "Chaudhry Helper", "uxp_helper_c", { year: 2028 }],
  ["finalYear", "uxp-final@nutech.edu.pk", "Fatima Final", "uxp_final", { year: 2027 }],
  ["otherUni", "uxp-other@nu.edu.pk", "Omar Other", "uxp_other", { year: 2028 }],
  ["officer1", "uxp-officer-1@nutech.edu.pk", "Hamza President", "uxp_officer_1", { year: 2027 }],
  ["officer2", "uxp-officer-2@nutech.edu.pk", "Iqra Secretary", "uxp_officer_2", { year: 2028 }],
  ["applicant2", "uxp-helper-d@nutech.edu.pk", "Danish Helper", "uxp_helper_d", { year: 2028 }],
  ["staff", "uxp-staff@nutech.edu.pk", "Zara Staff", "uxp_staff", { year: 2027 }],
  ["faculty", "uxp-faculty@nutech.edu.pk", "Dr Kamran Faculty", null, { faculty: true }],
];
out.accounts.testerNew = { email: "uxp-new@nutech.edu.pk", note: "reserved, never created (S01 sign-up)" };
out.accounts.testerNew2 = { email: "uxp-new2@nutech.edu.pk", note: "reserved, never created (T004)" };
out.accounts.testerNew3 = { email: "uxp-new3@nutech.edu.pk", note: "reserved, never created (T010 mid-onboarding)" };

const ids = {};
async function ensureAccount([key, email, fullName, username, opts]) {
  let [row] = await sql`select id from auth.users where email = ${email}`;
  if (!row) {
    const meta = { full_name: fullName, ...(opts.faculty ? { role: "faculty" } : {}) };
    const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: meta });
    if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`);
    row = { id: data.user.id };
  }
  const id = row.id;
  // No function accepts the agreement for someone else; the e2e fixtures insert it the same way.
  await sql`insert into public.agreement_acceptances (user_id, version)
            select ${id}, max(version) from public.agreement_versions where published_at is not null on conflict do nothing`;
  if (!opts.faculty) {
    await sql`update public.profiles set username = ${username}, department = 'Computer Science', graduation_year = ${opts.year},
                     onboarding_complete = true where user_id = ${id} and (username is distinct from ${username} or not onboarding_complete)`;
    if (opts.tour !== false) {
      await sql`insert into public.tour_progress (user_id, tour_id, step, skipped_at) values (${id}, 'student', 0, now()) on conflict do nothing`;
    }
  }
  ids[key] = id;
  out.accounts[key] = { email, password: PASSWORD, fullName, username, id };
}

async function main() {
  for (const a of ACCOUNTS) await ensureAccount(a);
  const [{ uni }] = await sql`select university_id as uni from public.profiles where user_id = ${ids.tester}`;
  log("accounts", { n: ACCOUNTS.length });

  // --- Staff: super admin with two-factor (plain SQL: granting the first staff role has no function) ----
  for (const role of ["super_admin", "moderator", "trust_reviewer", "accounts"]) {
    await sql`insert into public.staff_roles (user_id, role, granted_by) values (${ids.staff}, ${role}, ${ids.staff}) on conflict do nothing`;
  }
  if (!out.accounts.staff.totpSecret) {
    const api = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
    const { error: se } = await api.auth.signInWithPassword({ email: out.accounts.staff.email, password: PASSWORD });
    if (se) throw new Error(`staff sign-in: ${se.message}`);
    // A half-finished earlier run may have left an unverified factor (local stack only).
    await sql`delete from auth.mfa_factors where user_id = ${ids.staff}`;
    const { data: enrolled, error: ee } = await api.auth.mfa.enroll({ factorType: "totp", friendlyName: "ux-pilot" });
    if (ee) throw new Error(`mfa enroll: ${ee.message}`);
    const { error: ve } = await api.auth.mfa.challengeAndVerify({ factorId: enrolled.id, code: totp(enrolled.totp.secret) });
    if (ve) throw new Error(`mfa verify: ${ve.message}`);
    out.accounts.staff.totpSecret = enrolled.totp.secret;
  }
  log("staff");

  // --- Faculty (approval is a staff decision with no student-side function; as the e2e sweep does) ------
  await sql`insert into public.teacher_profiles (user_id, university_id, department, title, status, approved_at, approval_source)
            values (${ids.faculty}, ${uni}, 'Computer Science', 'Lecturer', 'approved', now(), 'staff') on conflict (user_id) do update set status = 'approved'`;
  const [idea] = await sql`select id from public.project_ideas where title = 'Campus bus tracker (UX pilot)'`;
  if (!idea) {
    out.ids.idea = await call(ids.faculty, `select public.save_idea(null, $1::text::jsonb)`, [
      JSON.stringify({ title: "Campus bus tracker (UX pilot)", brief: "Show where each university bus is, live, on a phone.", skills: ["react", "nodejs"], difficulty: "intermediate", team_size: 3, duration_weeks: 6, audience: "university", deliverables: "A working web app and a short demo." }),
    ]).catch((e) => (log("idea_failed", { error: e.message }), null));
  } else out.ids.idea = idea.id;
  log("faculty", { idea: out.ids.idea });

  // --- Fake GitHub and skills for the tester and helper A (no function writes skills except the worker) --
  const gh = [
    [ids.tester, 8_801_001, "ayesha-uxp", "ayesha-uxp/fee-tracker", [["react", 2], ["sql", 2], ["javascript", 2], ["typescript", 1], ["css", 1], ["html", 1]]],
    [ids.helperA, 8_801_002, "ali-uxp", "ali-uxp/api", [["sql", 2], ["nodejs", 2], ["python", 1]]],
    [ids.officer2, 8_801_003, "iqra-uxp", "iqra-uxp/site", [["react", 2], ["typescript", 2]]],
    [ids.otherUni, 8_801_004, "omar-uxp", "omar-uxp/notes-api", [["javascript", 2], ["nodejs", 2], ["sql", 2]]],
  ];
  for (const [uid, ghId, login, repo, skills] of gh) {
    await sql`insert into public.github_accounts (user_id, github_id, login) values (${uid}, ${ghId}, ${login}) on conflict do nothing`;
    await sql`insert into public.github_installations (installation_id, account_id, account_login, account_type) values (${ghId}, ${ghId}, ${login}, 'User') on conflict do nothing`;
    await sql`insert into public.github_repos (repo_id, full_name, owner_id, private, default_branch) values (${ghId}, ${repo}, ${ghId}, false, 'main') on conflict do nothing`;
    await sql`insert into public.github_user_repos (user_id, repo_id, installation_id, kind) values (${uid}, ${ghId}, ${ghId}, 'owned') on conflict do nothing`;
    // Commit evidence through the worker's own private.record_commit, then the product's recompute: levels come from
    // evidence (L2 = 3 active days and 150+ lines for a language, 3 package hits for a framework), so later recomputes keep them.
    for (const [skill, level] of skills) {
      const days = level >= 2 ? [12, 25, 40] : [18];
      for (const d of days) {
        const sha = createHmac("sha1", "uxp").update(`${uid}-${skill}-${d}`).digest("hex");
        await sql`select private.record_commit(${uid}, ${ghId}, jsonb_build_object(
                    'sha', ${sha}::text, 'committed_at', now() - make_interval(days => ${d}), 'authored_at', now() - make_interval(days => ${d}),
                    'seen_via', 'harvest', 'meaningful_lines', 80,
                    'detections', jsonb_build_array(jsonb_build_object('skill', ${skill}::text, 'kind', 'import', 'path', ${`src/${skill}/index.ts`}::text, 'lines', 80)),
                    'blobs', '[]'::jsonb))`;
      }
    }
    await sql`select private.recompute_user_skills(${uid})`;
    await sql`update public.user_skills set l2_at = coalesce(l2_at, now() - interval '40 days') where user_id = ${uid} and level >= 2`;
  }
  log("github");

  // --- Friends: A is the tester's friend; B sent the tester a request; tester -> final-year unanswered ---
  const friendsWith = async (a, b) => (await sql`select 1 from public.friendships where (user_id_a, user_id_b) in ((${a}::uuid, ${b}::uuid), (${b}::uuid, ${a}::uuid))`).length > 0;
  const pending = async (from, to) => (await sql`select id from public.friend_requests where sender_id = ${from} and receiver_id = ${to} and status = 'pending'`)[0]?.id;
  for (const [x, y] of [[ids.tester, ids.helperA], [ids.officer1, ids.officer2], [ids.tester, ids.testerSpark]]) {
    if (!(await friendsWith(x, y))) {
      if (!(await pending(x, y))) await call(x, `select public.send_friend_request($1)`, [out.accounts[Object.keys(ids).find((k) => ids[k] === y)].username]);
      await call(y, `select public.respond_friend_request($1, true)`, [await pending(x, y)]);
    }
  }
  if (!(await pending(ids.helperB, ids.tester)) && !(await friendsWith(ids.helperB, ids.tester))) await call(ids.helperB, `select public.send_friend_request('uxp_tester')`);
  if (!(await pending(ids.tester, ids.finalYear)) && !(await friendsWith(ids.tester, ids.finalYear))) await call(ids.tester, `select public.send_friend_request('uxp_final')`);
  log("friends");

  // --- DM between the tester and helper A -------------------------------------------------
  const dm = await call(ids.tester, `select public.get_or_create_dm('uxp_helper_a')`);
  out.ids.dmTesterA = dm;
  const [{ n: msgs }] = await sql`select count(*)::int as n from public.chat_messages where thread_id = ${dm}`;
  if (msgs === 0) {
    await call(ids.helperA, `select public.send_message($1, $2)`, [dm, "Hey! Are we still meeting on 12 December for the DB assignment?"]);
    await call(ids.tester, `select public.send_message($1, $2)`, [dm, "Yes, 12 December after the 2pm lab works for me."]);
    await call(ids.helperA, `select public.send_message($1, $2)`, [dm, "Great, see you then."]);
  }

  // --- Ventures ---------------------------------------------------------------------------
  const venture = async (owner, title, p) => {
    const [v] = await sql`select id from public.ventures where title = ${title}`;
    if (v) return v.id;
    return call(owner, `select public.create_venture($1::text::jsonb)`, [JSON.stringify({ type: "project", title, ...p })]);
  };
  const member = async (vid, owner, who, msg, role = null) => {
    const [m] = await sql`select 1 from public.venture_members where venture_id = ${vid} and user_id = ${who}`;
    if (m) return;
    const thread = await call(who, `select public.apply_to_venture($1, $2, $3::text[], $4)`, [vid, msg, `{}`, role]);
    await call(owner, `select public.decide_application($1, true)`, [thread]);
  };
  out.ids.helperVenture = await venture(ids.helperA, "Campus Lost & Found", {
    description: "A web app to report and find lost items on campus. We have the backend half done and need a designer and a backend developer.",
    visibility: "university", skill_ids: ["react", "nodejs", "sql"], team_size: 4,
    roles: [{ title: "Designer", skill_ids: ["css"], slots: 1 }, { title: "Backend developer", skill_ids: ["nodejs", "sql"], slots: 1 }],
    questions: ["Share one thing you built that you're proud of."],
  });
  out.ids.fullVenture = await venture(ids.helperB, "Exam Countdown", { description: "A countdown and planner for the exam weeks.", team_size: 2, roles: [{ title: "Frontend developer", skill_ids: ["react"], slots: 1 }] });
  const [fullRole] = await sql`select id from public.venture_roles where venture_id = ${out.ids.fullVenture} limit 1`;
  await member(out.ids.fullVenture, ids.helperB, ids.finalYear, "I can build the UI.", fullRole?.id ?? null);
  out.ids.otherUniVenture = await venture(ids.otherUni, "FAST Notes Hub", { description: "Notes sharing for FAST students only.", visibility: "university", roles: [{ title: "Developer", skill_ids: ["react"], slots: 2 }] });
  // The tester's own venture, in progress, with helper A as member and A's contribution to confirm.
  out.ids.testerVenture = await venture(ids.tester, "Fee Tracker", { description: "Track semester fees and instalments.", skill_ids: ["react", "sql"], team_size: 4 });
  await member(out.ids.testerVenture, ids.tester, ids.helperA, "I'd like to build the API.");
  const [tv] = await sql`select status from public.ventures where id = ${out.ids.testerVenture}`;
  if (tv.status === "recruiting") await call(ids.tester, `select public.transition_venture($1, 'in_progress')`, [out.ids.testerVenture]);
  const [aEntry] = await sql`select id from public.contributions where venture_id = ${out.ids.testerVenture} and user_id = ${ids.helperA}`;
  if (!aEntry) await call(ids.helperA, `select public.log_contribution($1, 'code', $2, $3, 6, '{sql}')`, [out.ids.testerVenture, "Wrote the fees table and its migrations.", "https://github.com/ali-uxp/api/pull/3"]);
  // Completed venture (tester + helper B) for endorsements.
  out.ids.completedVenture = await venture(ids.tester, "Timetable Planner", { description: "A timetable planner that exports to calendar.", skill_ids: ["react"], team_size: 3 });
  const [cv] = await sql`select status from public.ventures where id = ${out.ids.completedVenture}`;
  if (cv.status !== "completed") {
    await member(out.ids.completedVenture, ids.tester, ids.helperB, "I'll do the calendar export.");
    if (cv.status === "recruiting") await call(ids.tester, `select public.transition_venture($1, 'in_progress')`, [out.ids.completedVenture]);
    const t1 = await call(ids.tester, `select public.log_contribution($1, 'code', $2, $3, 8, '{react}')`, [out.ids.completedVenture, "Built the weekly grid view.", "https://github.com/ayesha-uxp/fee-tracker/pull/1"]);
    const t2 = await call(ids.helperB, `select public.log_contribution($1, 'code', $2, $3, 5, '{react}')`, [out.ids.completedVenture, "Built the .ics export.", "https://github.com/ayesha-uxp/fee-tracker/pull/2"]);
    await call(ids.helperB, `select public.confirm_contribution($1)`, [t1]);
    await call(ids.tester, `select public.confirm_contribution($1)`, [t2]);
    await call(ids.tester, `select public.add_venture_deliverable($1, 'Live app', 'https://timetable.example.com')`, [out.ids.completedVenture]);
    await call(ids.tester, `select public.transition_venture($1, 'completed')`, [out.ids.completedVenture]);
    await call(ids.helperB, `select public.endorse($1, $2, $3::text::jsonb, $4)`, [ids.tester, out.ids.completedVenture, JSON.stringify([{ skill: "react" }]), "Clean components."]).catch((e) => log("endorse_failed", { error: e.message }));
  }
  out.ids.abandonedVenture = await venture(ids.tester, "Hostel Mess Menu", { description: "Daily menu for the hostel mess." });
  const [av] = await sql`select status from public.ventures where id = ${out.ids.abandonedVenture}`;
  if (av.status === "recruiting") await call(ids.tester, `select public.transition_venture($1, 'abandoned')`, [out.ids.abandonedVenture]);
  log("ventures");

  // --- Posts --------------------------------------------------------------------------------
  const post = async (author, body, p = {}, aal = "aal1") => {
    const [x] = await sql`select id from public.posts where body = ${body}`;
    if (x) return x.id;
    return call(author, `select public.create_post($1::text::jsonb)`, [JSON.stringify({ type: "general", audience: "university", body, ...p })], aal);
  };
  out.ids.posts = {};
  out.ids.posts.text = await post(ids.helperA, "Library is open till midnight during exam weeks starting Monday. Bring your card.");
  out.ids.posts.text2 = await post(ids.finalYear, "Tip for juniors: start your FYP proposal in 6th semester. The supervisors fill up fast.");
  out.ids.posts.poll = await post(ids.helperB, "Which day suits the batch for the DB revision session?", { type: "poll", poll: { options: ["Thursday", "Friday", "Saturday"], days: 3 } });
  out.ids.posts.invite = await post(ids.helperA, "We're looking for a designer and a backend developer for Campus Lost & Found. Apply on the venture page.", { type: "invite", venture_id: out.ids.helperVenture });
  out.ids.posts.global = await post(ids.otherUni, "Open-source sprint this weekend, anyone from any university is welcome.", { audience: "global" });
  out.ids.posts.reportMe = await post(ids.helperC, "[UX test] report me");
  out.ids.posts.helperC2 = await post(ids.helperC, "Selling my old calculator, Casio fx-991ES, barely used.");
  out.ids.posts.helperC3 = await post(ids.helperC, "Does anyone have last year's OS past papers?");
  out.ids.posts.announcement = await post(ids.staff, "Skilient beta: thanks for testing! Tell us what confused you from the Feedback link.", { type: "announcement", audience: "university" }, "aal2").catch((e) => (log("announcement_failed", { error: e.message }), null));
  // Comments on two posts.
  for (const [pid, author, body] of [
    [out.ids.posts.text, ids.helperB, "Is the reading room open too?"],
    [out.ids.posts.text, ids.helperC, "Thanks for sharing."],
    [out.ids.posts.text2, ids.helperA, "Agree, and pick a supervisor whose area you like."],
  ]) {
    const [c] = await sql`select 1 from public.post_comments where post_id = ${pid} and body = ${body}`;
    if (!c) await call(author, `select public.add_comment($1, null, $2)`, [pid, body]);
  }
  log("posts", { posts: Object.keys(out.ids.posts).length });

  // --- Societies: request through the product, approve as staff -----------------------------
  const society = async (requester, name, about, mode) => {
    let [s] = await sql`select id, slug, status from public.societies where name = ${name}`;
    if (!s) {
      await call(requester, `select public.request_society($1::text::jsonb)`, [JSON.stringify({ name, about, category: "technology", office_bearer: true, proof_url: "https://nutech.edu.pk/societies" })]);
      [s] = await sql`select id, slug, status from public.societies where name = ${name}`;
    }
    if (s.status === "pending") await call(ids.staff, `select public.decide_society($1, 'approve', null)`, [s.id], "aal2");
    // Old enough that its Record entries count (the e2e Record spec does the same).
    await sql`update public.societies set verified_at = least(verified_at, now() - interval '60 days') where id = ${s.id} and status = 'verified'`;
    await call(requester, `select public.set_membership_mode($1, $2)`, [s.id, mode]);
    return s;
  };
  const s1 = await society(ids.officer1, "UX Pilot Developers Club", "We build things together every Friday.", "open");
  const s2 = await society(ids.officer1, "UX Pilot Debating Society", "Weekly debates and an annual championship.", "request");
  const s3 = await society(ids.officer2, "UX Pilot Design Guild", "Designers helping each other get better.", "inductions");
  out.ids.societies = { open: s1, request: s2, inductions: s3 };
  // officer-2 joins s1 as an officer (invite and answer).
  const [o2] = await sql`select 1 from public.society_members where society_id = ${s1.id} and user_id = ${ids.officer2} and role in ('officer','president')`;
  if (!o2) {
    await call(ids.officer1, `select public.invite_officer($1, 'uxp_officer_2', 'General Secretary', current_date, current_date + 300)`, [s1.id]);
    const [inv] = await sql`select id from public.society_invites where society_id = ${s1.id} and invitee_id = ${ids.officer2} order by created_at desc limit 1`;
    await call(ids.officer2, `select public.answer_society_invite($1, true)`, [inv.id]);
  }
  // JazzCash details proposed by the president, confirmed by the second officer.
  const [method] = await sql`select id, status from public.society_payment_methods where society_id = ${s1.id} and kind = 'jazzcash' order by proposed_at desc limit 1`;
  if (!method) {
    const mid = await call(ids.officer1, `select public.propose_payment_method($1, $2::text::jsonb)`, [s1.id, JSON.stringify({ action: "add", kind: "jazzcash", account_title: "UX Pilot Developers Club", account_number: "03001234567" })]);
    await call(ids.officer2, `select public.confirm_payment_method($1, true)`, [mid]);
  }
  // Induction round on the Design Guild, recruiting designers.
  const [round] = await sql`select id, status from public.induction_rounds where society_id = ${s3.id} order by created_at desc limit 1`;
  if (!round) {
    const rid = await call(ids.officer2, `select public.save_induction_round($1, $2::text::jsonb)`, [s3.id, JSON.stringify({ title: "Spring inductions", description: "We're taking two designers this term.", deadline: new Date(Date.now() + 14 * 86400_000).toISOString(), roles: [{ title: "Designer", seats: 2, skill_ids: ["css"] }], questions: ["Link one design you made."] })]);
    await call(ids.officer2, `select public.publish_induction_round($1)`, [rid]);
    out.ids.inductionRound = rid;
  } else out.ids.inductionRound = round.id;
  // A pending society request from officer-1.
  const [pend] = await sql`select id from public.societies where name = 'UX Pilot Chess Club'`;
  if (!pend) await call(ids.officer1, `select public.request_society($1::text::jsonb)`, [JSON.stringify({ name: "UX Pilot Chess Club", about: "Chess every evening.", category: "other", office_bearer: true, proof_url: "https://nutech.edu.pk/chess" })]).catch((e) => log("pending_society_failed", { error: e.message }));
  log("societies");

  // --- Events (society s1) ------------------------------------------------------------------
  const day = 86400_000;
  const at = (d, h = 0) => new Date(Date.now() + d * day + h * 3600_000).toISOString();
  const event = async (key, officer, p, publish = true) => {
    const [e] = await sql`select id from public.events where title = ${p.title}`;
    if (e) return (out.ids.events[key] = e.id);
    const id = await call(officer, `select public.save_society_event($1, $2::text::jsonb)`, [s1.id, JSON.stringify({ description: "", location: "Hall B", eligibility: { scope: "university" }, approval_mode: "automatic", record_kinds: ["attended"], ...p })]);
    if (publish) await call(officer, `select public.publish_event($1)`, [id]);
    return (out.ids.events[key] = id);
  };
  out.ids.events = {};
  const sess = (d, hours = 2) => [{ starts_at: at(d), ends_at: at(d, hours) }];
  await event("workshop", ids.officer1, { type: "workshop", title: "Intro to Git workshop", description: "Bring a laptop. We start from zero.", sessions: sess(5), ticket_types: [{ name: "Participant", capacity: 40 }], questions: [{ label: "Have you used Git before?", kind: "short", required: true }, { label: "Which laptop OS do you use?", kind: "short", required: false }] });
  await event("hackathon", ids.officer1, { type: "hackathon", title: "UX Pilot Hack Day", description: "24 hours, teams of 2 to 4.", sessions: sess(10, 24), ticket_types: [{ name: "Hacker", capacity: 60 }], team: { min: 2, max: 4 }, record_kinds: ["attended", "completed"], completed_min: 1 });
  await event("full", ids.officer1, { type: "talk", title: "Alumni talk: first jobs", description: "Two alumni on their first year at work.", sessions: sess(4), ticket_types: [{ name: "Seat", capacity: 1 }] });
  await event("otherBatch", ids.officer1, { type: "workshop", title: "Final-year CV clinic", description: "For the 2027 batch only.", sessions: sess(6), ticket_types: [{ name: "Seat", capacity: 20 }], eligibility: { scope: "groups", batches: [2027] } });
  await event("notOpen", ids.officer1, { type: "competition", title: "Coding contest (opens later)", description: "Registration opens next week.", sessions: sess(20), ticket_types: [{ name: "Contestant", capacity: 50 }], registration_opens_at: at(7) });
  await event("closed", ids.officer1, { type: "talk", title: "Security talk (registration closed)", description: "Registration has closed.", sessions: sess(3), ticket_types: [{ name: "Seat", capacity: 50 }], registration_closes_at: at(1) });
  await sql`update public.events set registration_closes_at = now() - interval '1 hour' where id = ${out.ids.events.closed}`;
  await event("paid", ids.officer1, { type: "workshop", title: "Figma masterclass (PKR 100)", description: "Paid workshop, refunds until 2 days before.", sessions: sess(8), ticket_types: [{ name: "Participant", capacity: 30, price_pkr: 100 }], refund_policy: "until", refund_days: 2 });
  // Fill the full event (helper C takes the one seat).
  const [fullReg] = await sql`select 1 from public.event_registrations where event_id = ${out.ids.events.full}`;
  if (!fullReg) {
    const [t] = await sql`select id from public.event_ticket_types where event_id = ${out.ids.events.full}`;
    await call(ids.helperC, `select public.register_event($1, $2::text::jsonb)`, [out.ids.events.full, JSON.stringify({ ticket_type_id: t.id })]);
  }
  // Past events: one issued and sealed (Record entries), one ready for close-out.
  const pastEvent = async (key, title, issue) => {
    let id = out.ids.events[key] ?? (await sql`select id from public.events where title = ${title}`)[0]?.id;
    if (id) return (out.ids.events[key] = id);
    id = await event(key, ids.officer1, { type: "workshop", title, description: "A past workshop.", sessions: [{ starts_at: at(0, 1), ends_at: at(0, 3) }], ticket_types: [{ name: "Participant", capacity: 30 }] });
    const [t] = await sql`select id from public.event_ticket_types where event_id = ${id}`;
    for (const who of [ids.tester, ids.helperA, ids.helperB]) {
      await call(who, `select public.register_event($1, $2::text::jsonb)`, [id, JSON.stringify({ ticket_type_id: t.id })]);
      const ticket = await call(who, `select public.event_ticket($1)`, [id]);
      await call(ids.officer1, `select public.check_in_scan($1, null, $2)`, [id, ticket.payload]);
    }
    await sql`update public.event_sessions set starts_at = now() - interval '2 days 3 hours', ends_at = now() - interval '2 days 1 hour' where event_id = ${id}`;
    await sql`update public.events set starts_at = now() - interval '2 days 3 hours', ends_at = now() - interval '2 days 1 hour', status = 'ended' where id = ${id}`;
    if (issue) await call(ids.officer1, `select public.issue_event_entries($1)`, [id]);
    return id;
  };
  await pastEvent("past1", "React basics workshop", true);
  await pastEvent("past2", "SQL for beginners workshop", true);
  await pastEvent("closeout", "Debugging clinic (ready for close-out)", false);
  // Seal pending Record entries with the cv-sign worker's own code.
  const [{ pendingN }] = await sql`select count(*)::int as "pendingN" from public.record_entries where status = 'pending'`;
  if (pendingN > 0) {
    const { rotateKey } = await import("../../supabase/functions/_shared/cv/issue.ts");
    const { drainRecordQueue } = await import("../../supabase/functions/_shared/cv/record.ts");
    const { dbFrom } = await import("../../supabase/functions/_shared/github/types.ts");
    const quiet = () => undefined;
    const [active] = await sql`select key_id from public.signing_keys where retired_at is null`;
    if (!active) await rotateKey({ db: dbFrom(sql), log: quiet });
    for (let i = 0; i < 20; i++) {
      const r = await drainRecordQueue({ db: dbFrom(sql), log: quiet }, 25);
      if (r.sealed + r.skipped + r.failed + r.dropped === 0) break;
    }
  }
  const entries = await sql`select status, count(*)::int as n from public.record_entries where user_id = ${ids.tester} group by 1`;
  log("events", { events: Object.keys(out.ids.events).length, testerEntries: entries });

  // --- Paths, proof tasks, swaps ------------------------------------------------------------
  for (const [skill, title] of [["nodejs", "Build a REST endpoint with Node"], ["nodejs", "Add input validation to a Node API"], ["javascript", "Write a debounce helper with tests"], ["express", "Add an Express error handler"]]) {
    await sql`insert into public.proof_tasks (skill_id, title, difficulty, brief, checklist)
              select ${skill}, ${title}, 'starter', ${`${title} in one of your own repositories.`}, '["It runs from a clean checkout", "It has at least one test", "The README says how to run it"]'::jsonb
              where not exists (select 1 from public.proof_tasks where title = ${title})`;
  }
  await sql`select private.compute_paths()`;
  await call(ids.helperA, `select public.save_swap_offer('sql', 'Joins, indexes and query plans. Happy to help juniors.', true)`);
  log("growth");

  // A normal day: content written over the past days, not all in the last minutes (new posts sit in the 2-hour
  // "seed" stage and reach only a sample of students). As scripts/load/seed.mjs, the dates are set directly.
  await sql`update public.posts p set created_at = p.created_at - interval '1 day' * (1 + (abs(hashtext(p.id::text)) % 4))
             from public.profiles pr where pr.user_id = p.author_id and pr.username like 'uxp\\_%' and p.created_at > now() - interval '3 hours'`;
  await sql`select private.feed_stage_job()`;

  // --- Scores: the nightly run, then a Spark tier for tester-spark (no function grants a tier) ----
  await sql`select private.ranking_run_all()`.catch((e) => log("ranking_failed", { error: e.message }));
  await sql`insert into public.ranking_scores (user_id, formula_version, components, proof, momentum, adjustments, total, ranked, tier, computed_at, published_at)
            values (${ids.testerSpark}, 2, '{}', 120, 0, 0, 120, true, 'spark', now(), now())
            on conflict (user_id) do update set tier = 'spark', total = greatest(ranking_scores.total, 120), published_at = now()`;
  log("ranking");

  mkdirSync("docs/ux-pilot", { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2));
  log("done", { out: OUT });
}

main()
  .catch((e) => {
    console.error(JSON.stringify({ job: "ux-pilot.seed", outcome: "error", error: String(e?.message ?? e), code: e?.code, detail: e?.detail, where: e?.where?.slice?.(0, 300) }));
    process.exitCode = 1;
  })
  .finally(() => sql.end());
