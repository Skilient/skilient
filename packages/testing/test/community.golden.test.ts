/**
 * Community golden recordings (W7). Records what the current stack (local Supabase) returns for the ported
 * society, induction, event, ticket, check-in, close-out and paid-ticket functions, so the W7 service can be held
 * to the same results. The sheet is docs/azure/community-function-bins.md; the world is
 * test/fixtures/community-world.ts.
 *
 *   GOLDEN_STACK_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres GOLDEN_RECORD=1 pnpm exec vitest run test/community.golden.test.ts
 *
 * Without GOLDEN_RECORD it compares the stack with the files. Without GOLDEN_STACK_DB_URL the file is skipped.
 * Every case runs in its own transaction that is rolled back; now() is fixed inside it. Values the stack makes at
 * random are recorded as their type, never their value (`typed`): ticket signatures, reference and team codes,
 * the rotating check-in token, dates. Every step that depends on an earlier one checks the earlier one worked
 * (`ok`), so no step is recorded without reaching the stack.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type postgres from "postgres";
import { describe, expect, it } from "vitest";
import { actAs, assertLocalStack, attempt, callCurrentStackSql, golden, type SqlOutcome, type StackActor } from "../src/golden";
import * as F from "./fixtures/community-world";
import { typed } from "./fixtures/community-world";

const DB = process.env["GOLDEN_STACK_DB_URL"];
if (DB !== undefined) assertLocalStack(DB);
const DIR = join(import.meta.dirname, "golden", "community");

const { PRIYA, OSMAN, MEHR, SAMI, NIDA, ULA } = F;
const USERNAME_OF = (u: string) => F.USERNAME[u]!;
const OWNER: StackActor = { role: "postgres" };
const ANON: StackActor = { role: "anon", claims: { role: "anon" } };
function as(user: string, aal: "aal1" | "aal2" = "aal1"): StackActor {
  return { role: "authenticated", claims: { sub: user, role: "authenticated", aal, email: F.EMAIL[user] } };
}

type Tx = postgres.TransactionSql;
type Row = Record<string, unknown>;

// ---------------------------------------------------------------------------
// The world
// ---------------------------------------------------------------------------
async function insertUser(tx: Tx, id: string): Promise<void> {
  await tx.unsafe(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                             raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, '', now() - interval '30 days',
             '{"provider":"email","providers":["email"]}'::jsonb, $3::text::jsonb, now() - interval '30 days', now())`,
    [id, F.EMAIL[id]!, JSON.stringify({ full_name: F.NAME[id] })],
  );
}

async function seed(tx: Tx): Promise<void> {
  for (const u of F.UNIVERSITIES)
    await tx.unsafe(`insert into public.universities (id, name, slug, live_at) values ($1, $2, $3, now() - interval '1 day')`, [u.id, u.name, u.slug]);
  for (const u of F.UNIVERSITIES)
    await tx.unsafe(`insert into public.university_domains (university_id, domain, kind, source) values ($1, $2, 'both', 'ops')`, [u.id, u.domain]);
  for (const id of F.USERS) await insertUser(tx, id);
  for (const id of F.USERS) {
    await tx.unsafe(
      `update public.profiles set username = $2, department = $3, graduation_year = $4, onboarding_complete = true where user_id = $1`,
      [id, F.USERNAME[id]!, F.DEPARTMENT_OF[id] ?? F.DEPARTMENT, F.BATCH_OF[id] ?? F.BATCH],
    );
    await tx.unsafe(`update public.onboarding_state set step = 6, completed_at = now() where user_id = $1`, [id]);
  }
  await tx.unsafe(`update public.profiles set status = 'graduate', graduated_at = now() - interval '1 day' where user_id = any($1)`, [F.GRADUATES]);
  await tx.unsafe(`insert into public.staff_roles (user_id, role) values ($1, 'trust_reviewer')`, [F.TARIQ]);
  // SOC: verified 10 days ago, Priya president (term to a year from then), Osman officer, Mehr member.
  await tx.unsafe(
    `insert into public.societies (id, university_id, slug, name, name_key, category, about, status, created_by, verified_at, created_at, updated_at)
     values ($1, $2, $3, $4, $5, 'technology', $6, 'verified', $7, now() - interval '10 days', now() - interval '12 days', now() - interval '10 days')`,
    [F.SOC, F.UNI_A, F.SOC_SLUG, F.SOC_NAME, F.SOC_KEY, F.SOC_ABOUT, F.PRIYA],
  );
  await tx.unsafe(
    `insert into public.society_members (society_id, user_id, role, title, joined_at) values
       ($1, $2, 'president', 'President', now() - interval '10 days'), ($1, $3, 'officer', 'General Secretary', now() - interval '9 days'),
       ($1, $4, 'member', null, now() - interval '8 days')`,
    [F.SOC, F.PRIYA, F.OSMAN, F.MEHR],
  );
  await tx.unsafe(
    `insert into public.society_terms (society_id, user_id, role, title, term_start, term_end, created_at) values
       ($1, $2, 'president', 'President', current_date - 10, current_date + 355, now() - interval '10 days'),
       ($1, $3, 'officer', 'General Secretary', current_date - 9, current_date + 100, now() - interval '9 days')`,
    [F.SOC, F.PRIYA, F.OSMAN],
  );
  await tx.unsafe(`insert into public.society_follows (society_id, user_id, created_at) select $1::uuid, u, now() - interval '8 days' from unnest($2::uuid[]) u`, [
    F.SOC,
    [F.PRIYA, F.OSMAN, F.MEHR],
  ]);
  // PENDING: Nida's request with a proof document, a day old.
  await tx.unsafe(`insert into storage.objects (bucket_id, name, owner) values ('society-documents', $1, $2)`, [F.PROOF, F.NIDA]);
  await tx.unsafe(
    `insert into public.societies (id, university_id, slug, name, name_key, category, about, created_by, created_at, updated_at)
     values ($1, $2, $3, $4, $5, 'debating', $6, $7, now() - interval '1 day', now() - interval '1 day')`,
    [F.PENDING, F.UNI_A, F.PENDING_SLUG, F.PENDING_NAME, F.PENDING_KEY, F.PENDING_ABOUT, F.NIDA],
  );
  await tx.unsafe(
    `insert into public.society_requests (society_id, requester_id, proof_path, office_bearer, created_at, updated_at)
     values ($1, $2, $3, true, now() - interval '1 day', now() - interval '1 day')`,
    [F.PENDING, F.NIDA, F.PROOF],
  );
  await tx.unsafe(`insert into storage.objects (bucket_id, name, owner) values ('society-media', $1, $2), ('society-media', $3, $2)`, [F.LOGO, F.PRIYA, F.COVER]);
}

/** A second verified society (Sami presides), for co-hosting. */
async function cohostSociety(tx: Tx): Promise<void> {
  await tx.unsafe(
    `insert into public.societies (id, university_id, slug, name, name_key, category, about, status, created_by, verified_at, created_at)
     values ($1, $2, $3, $4, 'wren coders', 'technology', 'We write code together every Friday evening.', 'verified', $5, now() - interval '5 days', now() - interval '6 days')`,
    [F.COHOST, F.UNI_A, F.COHOST_SLUG, F.COHOST_NAME, F.SAMI],
  );
  await tx.unsafe(`insert into public.society_members (society_id, user_id, role, title) values ($1, $2, 'president', 'President')`, [F.COHOST, F.SAMI]);
}

/** SOC's published event (the fixture's EVENT): `extra` sets columns as the owner. */
async function seedEvent(tx: Tx, options: { capacity?: number; price?: number | null; startsIn?: string; hours?: number; required?: boolean; extra?: string } = {}): Promise<void> {
  const starts = `now() + interval '${options.startsIn ?? "2 days"}'`;
  const ends = `${starts} + interval '${options.hours ?? 2} hours'`;
  await tx.unsafe(
    `insert into public.events (id, university_id, society_id, created_by, type, scope, title, description, starts_at, ends_at, location, status, published_at, created_at)
     values ($1, $2, $3, $4, 'workshop', 'university', $5, 'Bring nothing; we have irons.', ${starts}, ${ends}, 'Lab 2, Block C', 'published', now() - interval '1 day', now() - interval '2 days')`,
    [F.EVENT, F.UNI_A, F.SOC, F.PRIYA, F.EVENT_TITLE],
  );
  if (options.extra) await tx.unsafe(`update public.events set ${options.extra} where id = $1`, [F.EVENT]);
  await tx.unsafe(`insert into private.event_secrets (event_id) values ($1)`, [F.EVENT]);
  await tx.unsafe(`insert into public.event_sessions (id, event_id, position, starts_at, ends_at) values ($1, $2, 1, ${starts}, ${ends})`, [F.SESSION, F.EVENT]);
  await tx.unsafe(`insert into public.event_ticket_types (id, event_id, position, name, capacity, price_pkr) values ($1, $2, 1, 'Seat', $3, $4)`, [
    F.TICKET,
    F.EVENT,
    options.capacity ?? 2,
    options.price ?? null,
  ]);
  if (options.required !== false)
    await tx.unsafe(`insert into public.event_questions (event_id, position, label, kind, required) values ($1, 1, $2, 'short', true)`, [F.EVENT, F.QUESTION]);
}

/** Moves the event (and its session) to have ended `hoursAgo` hours ago, `hours` long. */
async function endEvent(tx: Tx, hoursAgo = 1, hours = 2): Promise<void> {
  await tx.unsafe(
    `update public.events set starts_at = now() - make_interval(hours => $2::int + $3::int), ends_at = now() - make_interval(hours => $2::int), status = 'ended' where id = $1`,
    [F.EVENT, hoursAgo, hours],
  );
  await tx.unsafe(`update public.event_sessions set starts_at = now() - make_interval(hours => $2::int + $3::int), ends_at = now() - make_interval(hours => $2::int) where event_id = $1`, [
    F.EVENT,
    hoursAgo,
    hours,
  ]);
}

/** An active payment method on SOC (proposed by Priya, confirmed by Osman). */
async function paymentMethod(tx: Tx): Promise<void> {
  await tx.unsafe(
    `insert into public.society_payment_methods (society_id, action, kind, bank_name, account_title, account_number, status, proposed_by, confirmed_by, confirmed_at, effective_at)
     values ($1, 'add', 'bank', 'Wren Bank', 'Wren Robotics Society', 'PK00WREN0000001234567890', 'active', $2, $3, now() - interval '1 day', now() - interval '1 day')`,
    [F.SOC, F.PRIYA, F.OSMAN],
  );
}

// ---------------------------------------------------------------------------
// Calls and row snapshots
// ---------------------------------------------------------------------------
async function call(tx: Tx, actor: StackActor, expr: string, params: unknown[] = []): Promise<SqlOutcome<unknown>> {
  const out = await attempt(tx, async (sp) => {
    await actAs(sp, actor);
    const rows = await sp.unsafe(`select ${expr} as v`, params as never[]);
    return (rows[0] as Row | undefined)?.["v"] ?? null;
  });
  await actAs(tx, OWNER);
  return out;
}

const SOC_OF = `(select s.name from public.societies s where s.id = x.society_id)`;
const EV_OF = `(select e.title from public.events e where e.id = x.event_id)`;
const OURS = `(select id from public.societies where university_id = any($2))`;
const OUR_EVENTS = `(select id from public.events where society_id in ${OURS})`;
const ROUND_OF = `(select r.title from public.induction_rounds r where r.id = x.round_id)`;
/** Community's tables (and the foreign rows its writes reach: notify's notifications, content's posts, trust's audit log and cases). */
export const SNAPSHOTS: Record<string, string> = {
  "public.societies": `select x.name, x.slug, x.name_key, x.university_id, x.category, x.about, x.logo_path, x.cover_path, x.status::text, x.status_reason,
            x.membership_mode, x.paid_paused, x.created_by, x.verified_by, x.verified_at is not null as verified from public.societies x where x.university_id = any($2) order by 1`,
  "public.society_requests": `select ${SOC_OF} as society, x.requester_id, x.proof_path, x.proof_url, x.status, x.staff_note, x.claimed_by, x.decided_at is not null as decided
       from public.society_requests x where x.society_id in ${OURS} order by 1, 2`,
  "public.society_members": `select ${SOC_OF} as society, x.user_id, x.role::text, x.title, x.team_title from public.society_members x where x.society_id in ${OURS} order by 1, 2`,
  "public.society_terms": `select ${SOC_OF} as society, x.user_id, x.role::text, x.title, x.term_start, x.term_end, x.ended_at is not null as ended,
            x.confirmed_by, x.ended_notified_at is not null as notified from public.society_terms x where x.society_id in ${OURS} order by 1, 2, 5`,
  "public.society_invites": `select ${SOC_OF} as society, x.kind, x.invitee_id, x.invited_by, x.title, x.term_start, x.term_end, x.status
       from public.society_invites x where x.society_id in ${OURS} order by 1, 2, 3, 8`,
  "public.society_join_requests": `select ${SOC_OF} as society, x.user_id from public.society_join_requests x where x.society_id in ${OURS} order by 1, 2`,
  "public.society_follows": `select ${SOC_OF} as society, x.user_id from public.society_follows x where x.society_id in ${OURS} order by 1, 2`,
  "public.induction_rounds": `select ${SOC_OF} as society, x.title, x.description, x.status, x.created_by, x.published_at is not null as published,
            x.undecided_closed_at is not null as undecided_closed from public.induction_rounds x where x.society_id in ${OURS} order by 1, 2`,
  "public.induction_roles": `select ${ROUND_OF} as round, x.title, x.seats, x.filled, x.skill_ids, x.position from public.induction_roles x
      where x.round_id in (select id from public.induction_rounds where society_id in ${OURS}) order by 1, 6`,
  "public.induction_questions": `select ${ROUND_OF} as round, x.position, x.body from public.induction_questions x
      where x.round_id in (select id from public.induction_rounds where society_id in ${OURS}) order by 1, 2`,
  "public.induction_applications": `select ${ROUND_OF} as round, (select r.title from public.induction_roles r where r.id = x.role_id) as role, x.applicant_id, x.answers,
            x.status, x.note, x.decided_by from public.induction_applications x where x.round_id in (select id from public.induction_rounds where society_id in ${OURS}) order by 1, 3`,
  "public.events": `select x.title, ${SOC_OF} as society, x.university_id, x.created_by, x.type::text, x.scope::text, x.description, x.location, x.link, x.status,
            x.record_kinds, x.completed_min, x.volunteer_hours, x.team_min, x.team_max, x.approval_mode, x.eligibility, x.cover_path, x.refund_policy,
            x.refund_days, x.post_id is not null as has_post, x.published_at is not null as published, x.cancel_reason, x.cancelled_at is not null as cancelled
       from public.events x where x.society_id in ${OURS} order by 1`,
  "public.event_sessions": `select ${EV_OF} as event, x.position, x.title from public.event_sessions x where x.event_id in ${OUR_EVENTS} order by 1, 2`,
  "public.event_ticket_types": `select ${EV_OF} as event, x.position, x.name, x.capacity, x.price_pkr from public.event_ticket_types x where x.event_id in ${OUR_EVENTS} order by 1, 2`,
  "public.event_questions": `select ${EV_OF} as event, x.position, x.label, x.kind, x.options, x.required from public.event_questions x where x.event_id in ${OUR_EVENTS} order by 1, 2`,
  "public.event_cohosts": `select ${EV_OF} as event, ${SOC_OF} as society, x.status from public.event_cohosts x where x.event_id in ${OUR_EVENTS} order by 1, 2`,
  "public.event_teams": `select ${EV_OF} as event, x.name, x.captain_id from public.event_teams x where x.event_id in ${OUR_EVENTS} order by 1, 2`,
  "public.event_registrations": `select ${EV_OF} as event, x.user_id, x.status, x.waitlist_position, x.answers, (select t.name from public.event_teams t where t.id = x.team_id) as team,
            x.added_by, x.hold_expires_at is not null as held_until, x.cancelled_at is not null as cancelled, x.checked_in_at is not null as checked_in,
            x.reminded_at is not null as reminded, x.reminded_1h_at is not null as reminded_1h
       from public.event_registrations x where x.event_id in ${OUR_EVENTS} order by 1, 2`,
  "public.event_staff": `select ${EV_OF} as event, x.user_id, x.added_by from public.event_staff x where x.event_id in ${OUR_EVENTS} order by 1, 2`,
  "public.event_email_attendees": `select ${EV_OF} as event, x.email, x.added_by, x.claimed_by from public.event_email_attendees x where x.event_id in ${OUR_EVENTS} order by 1, 2`,
  "public.event_checkins": `select ${EV_OF} as event, (select s.position from public.event_sessions s where s.id = x.session_id) as session, x.user_id,
            (select a.email from public.event_email_attendees a where a.id = x.email_attendee_id) as email, x.method, x.checked_in_by, x.reason,
            x.removed_at is not null as removed, x.removed_by, x.removed_reason from public.event_checkins x where x.event_id in ${OUR_EVENTS} order by 1, 2, 3, 4`,
  "public.event_results": `select ${EV_OF} as event, x.user_id, (select t.name from public.event_teams t where t.id = x.team_id) as team, x.place, x.label, x.set_by
       from public.event_results x where x.event_id in ${OUR_EVENTS} order by 1, 4`,
  "public.volunteer_logs": `select ${EV_OF} as event, x.user_id, x.hours, x.logged_by from public.volunteer_logs x where x.event_id in ${OUR_EVENTS} order by 1, 2`,
  "public.event_issuances": `select ${EV_OF} as event, x.preview, x.status, x.auto, x.issued_by from public.event_issuances x where x.event_id in ${OUR_EVENTS} order by 1`,
  "public.event_feedback": `select ${EV_OF} as event, x.user_id, x.rating, x.comment from public.event_feedback x where x.event_id in ${OUR_EVENTS} order by 1, 2`,
  "public.event_messages": `select ${EV_OF} as event, x.sender_id, x.body from public.event_messages x where x.event_id in ${OUR_EVENTS} order by 1, 3`,
  "public.society_payment_methods": `select ${SOC_OF} as society, x.action, x.kind, x.bank_name, x.account_title, x.account_number, x.status, x.proposed_by, x.confirmed_by,
            x.replaces_id is not null as replaces from public.society_payment_methods x where x.society_id in ${OURS} order by 1, 6, 7`,
  "public.society_audit_log": `select ${SOC_OF} as society, x.actor_id, x.action from public.society_audit_log x where x.society_id in ${OURS} order by 1, 3, 2`,
  "public.event_payments": `select ${EV_OF} as event, x.user_id, x.amount_pkr, x.receipt_path, x.receipt_hash, x.receipt_phash, x.transaction_id, x.status, x.reject_reason,
            x.decided_by, x.issue_raised_at is not null as issue_raised, x.refund_status, x.refund_note, x.case_id is not null as has_case,
            x.receipt_deleted_at is not null as receipt_deleted from public.event_payments x where x.event_id in ${OUR_EVENTS} order by 1, 2`,
  "public.ops_audit_log": `select staff_id, action, target_type, reason, before, after from public.ops_audit_log x where x.target_type = 'society'
      and x.target_id in (select id::text from public.societies where university_id = any($2)) order by 2, 1`,
  "public.notifications": `select user_id, actor_id, type, entity_type from public.notifications where user_id = any($1) order by user_id, type, actor_id`,
  "public.posts": `select author_id, type::text, audience::text, body, (select s.name from public.societies s where s.id = x.society_id) as society
       from public.posts x where x.author_id = any($1) order by 4`,
  "public.report_cases": `select target_type::text, owner_id, status::text from public.report_cases x where x.owner_id = any($1) order by 1, 2`,
};

async function snapshot(tx: Tx): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const [table, text] of Object.entries(SNAPSHOTS)) {
    // Every query takes both parameters ($1 users, $2 universities), so Postgres knows both types.
    let typed2 = text.includes("$1") ? text : text.replace(" where ", " where $1::uuid[] is not null and ");
    if (!typed2.includes("$2")) typed2 = typed2.replace(" where ", " where $2::uuid[] is not null and ");
    out[table] = (await tx.unsafe(typed2, [F.USERS, F.UNIS] as never[])).map((r) => JSON.stringify(r));
  }
  return out;
}

function changes(before: Record<string, string[]>, after: Record<string, string[]>) {
  const out: Record<string, { added: unknown[]; removed: unknown[] }> = {};
  const minus = (a: string[], b: string[]) => {
    const left = [...b];
    return a.filter((x) => {
      const i = left.indexOf(x);
      if (i === -1) return true;
      left.splice(i, 1);
      return false;
    });
  };
  for (const table of Object.keys(after)) {
    const added = minus(after[table]!, before[table]!).map((x) => JSON.parse(x) as unknown);
    const removed = minus(before[table]!, after[table]!).map((x) => JSON.parse(x) as unknown);
    if (added.length || removed.length) out[table] = { added, removed };
  }
  return out;
}

async function step(tx: Tx, actor: StackActor, expr: string, params: unknown[] = []) {
  const before = await snapshot(tx);
  const result = await call(tx, actor, expr, params);
  return { result, changes: changes(before, await snapshot(tx)) };
}

/** A job (or any owner statement) with the rows it changed. */
async function job(tx: Tx, statement: string) {
  const before = await snapshot(tx);
  await tx.unsafe(statement);
  return { changes: changes(before, await snapshot(tx)) };
}

async function check(group: string, name: string, run: (tx: Tx) => Promise<unknown>): Promise<void> {
  const out = await callCurrentStackSql(DB!, async (tx) => {
    await seed(tx);
    return run(tx);
  });
  if (!out.ok) throw new Error(`${group}/${name}: setup failed: ${out.code} ${out.message}`);
  const r = golden(join(DIR, `${group}.json`), name, typed(out.value));
  if (r.status === "differs") {
    if (process.env["GOLDEN_DIFF_DIR"]) writeFileSync(join(process.env["GOLDEN_DIFF_DIR"], `${group}-${name}.json`), JSON.stringify({ actual: r.actual, expected: r.expected }, null, 1));
    expect(r.actual).toEqual(r.expected);
  }
}

/** The value of a step that must have worked: a later step sends it. */
function ok(o: SqlOutcome<unknown>): Row & string {
  if (!o.ok) throw new Error(`expected success: ${o.code} ${o.message}`);
  return o.value as Row & string;
}
const okStep = (s: { result: SqlOutcome<unknown> }) => ok(s.result);

const REQUEST = `public.request_society($1::text::jsonb)`;
const NEW_SOCIETY = (name: string, extra: Row = {}) => ({
  name,
  category: "arts",
  about: "  Painting and printmaking for every student on campus.  ",
  proof_url: "https://comm-a.test/notices/arts",
  office_bearer: true,
  ...extra,
});

// ---------------------------------------------------------------------------
// Cases: societies
// ---------------------------------------------------------------------------
describe.skipIf(!DB)("community goldens on the current stack: societies", () => {
  const G = "societies";

  it("society_name_check and request_society: name keys, proof, one open request, students only", () =>
    check(G, "request", async (tx) => {
      const out: Row = {};
      const nc = `public.society_name_check($1)`;
      out["check_taken"] = await call(tx, as(SAMI), nc, ["The Wren Robotics Club!"]);
      out["check_pending"] = await call(tx, as(SAMI), nc, ["wren  debating society"]);
      out["check_free"] = await call(tx, as(SAMI), nc, ["Wren Printmakers"]);
      out["check_other_university"] = await call(tx, as(ULA), nc, ["Wren Robotics"]);
      out["requested"] = await step(tx, as(SAMI), REQUEST, [JSON.stringify(NEW_SOCIETY("  Wren Printmakers  "))]);
      out["again"] = await call(tx, as(SAMI), REQUEST, [JSON.stringify(NEW_SOCIETY("Wren Sculptors"))]);
      out["duplicate_name"] = await call(tx, as(MEHR), REQUEST, [JSON.stringify(NEW_SOCIETY("The Wren Robotics Club"))]);
      out["not_bearer"] = await call(tx, as(MEHR), REQUEST, [JSON.stringify(NEW_SOCIETY("Wren Sculptors", { office_bearer: false }))]);
      out["no_proof"] = await call(tx, as(MEHR), REQUEST, [JSON.stringify(NEW_SOCIETY("Wren Sculptors", { proof_url: "" }))]);
      out["foreign_proof"] = await call(tx, as(MEHR), REQUEST, [JSON.stringify(NEW_SOCIETY("Wren Sculptors", { proof_url: "", proof_path: F.PROOF }))]);
      out["graduate"] = await call(tx, as(F.GUL), REQUEST, [JSON.stringify(NEW_SOCIETY("Wren Sculptors"))]);
      out["signed_out"] = await call(tx, ANON, REQUEST, [JSON.stringify(NEW_SOCIETY("Wren Sculptors"))]);
      out["mine"] = await call(tx, as(SAMI), `public.my_society_requests()`);
      return out;
    }));

  it("directory, society page and manage: what each viewer sees", () =>
    check(G, "pages", async (tx) => {
      const out: Row = {};
      await tx.unsafe(`insert into public.society_join_requests (society_id, user_id) values ($1, $2)`, [F.SOC, SAMI]);
      await tx.unsafe(
        `insert into public.induction_rounds (society_id, title, deadline, status, published_at) values ($1, 'Spring inductions', now() + interval '5 days', 'open', now()),
                ($1, 'Draft round', now() + interval '6 days', 'draft', null)`,
        [F.SOC],
      );
      await tx.unsafe(
        `insert into public.society_terms (society_id, user_id, role, title, term_start, term_end, ended_at) values ($1, $2, 'officer', 'Treasurer', current_date - 400, current_date - 35, now() - interval '35 days')`,
        [F.SOC, MEHR],
      );
      out["directory"] = await call(tx, as(SAMI), `public.societies_directory(null, null)`);
      out["directory_query"] = await call(tx, as(ULA), `public.societies_directory($1, $2)`, ["robot", "technology"]);
      out["directory_signed_out"] = await call(tx, ANON, `public.societies_directory(null, null)`);
      out["page_president"] = await call(tx, as(PRIYA), `public.society_page($1)`, [F.SOC_SLUG]);
      out["page_member"] = await call(tx, as(MEHR), `public.society_page($1)`, [F.SOC_SLUG]);
      out["page_other_university"] = await call(tx, as(ULA), `public.society_page($1)`, [F.SOC_SLUG]);
      out["page_pending_requester"] = await call(tx, as(NIDA), `public.society_page($1)`, [F.PENDING_SLUG]);
      out["page_pending_stranger"] = await call(tx, as(SAMI), `public.society_page($1)`, [F.PENDING_SLUG]);
      out["page_unknown"] = await call(tx, as(SAMI), `public.society_page($1)`, ["no-such-society"]);
      out["manage_officer"] = await call(tx, as(OSMAN), `public.society_manage($1)`, [F.SOC]);
      out["manage_member"] = await call(tx, as(MEHR), `public.society_manage($1)`, [F.SOC]);
      out["officer_societies"] = await call(tx, as(OSMAN), `public.my_officer_societies()`);
      return out;
    }));

  it("update_society, set_membership_mode, set_society_images, resubmit_society", () =>
    check(G, "edits", async (tx) => {
      const out: Row = {};
      out["update"] = await step(tx, as(OSMAN), `public.update_society($1, $2::text::jsonb)`, [F.SOC, JSON.stringify({ about: "  Robots, soldering and Friday build nights for everyone.  ", category: "" })]);
      out["update_member"] = await call(tx, as(MEHR), `public.update_society($1, $2::text::jsonb)`, [F.SOC, JSON.stringify({ about: "Ours now, ours forever and ever." })]);
      out["mode"] = await step(tx, as(OSMAN), `public.set_membership_mode($1, $2)`, [F.SOC, "open"]);
      out["mode_unknown"] = await call(tx, as(OSMAN), `public.set_membership_mode($1, $2)`, [F.SOC, "invite"]);
      out["images"] = await step(tx, as(PRIYA), `public.set_society_images($1, $2, null)`, [F.SOC, F.LOGO]);
      out["images_missing"] = await call(tx, as(PRIYA), `public.set_society_images($1, null, $2)`, [F.SOC, `${F.SOC}/97d00000-0000-4000-8000-0000000000ff.webp`]);
      out["images_stranger"] = await call(tx, as(SAMI), `public.set_society_images($1, $2, null)`, [F.SOC, F.LOGO]);
      out["resubmit_pending"] = await call(tx, as(NIDA), `public.resubmit_society($1, $2::text::jsonb)`, [F.PENDING, JSON.stringify({ about: "More about us than before, really." })]);
      await tx.unsafe(`update public.society_requests set status = 'more_info', staff_note = 'Add the notice' where society_id = $1`, [F.PENDING]);
      await tx.unsafe(`update public.societies set status = 'more_info', status_reason = 'Add the notice' where id = $1`, [F.PENDING]);
      out["resubmit"] = await step(tx, as(NIDA), `public.resubmit_society($1, $2::text::jsonb)`, [
        F.PENDING,
        JSON.stringify({ about: "  Weekly debates, a novice league and practice for national rounds.  ", proof_url: "https://comm-a.test/notices/debating" }),
      ]);
      await tx.unsafe(`update public.societies set status = 'suspended' where id = $1`, [F.SOC]);
      out["update_suspended"] = await call(tx, as(OSMAN), `public.update_society($1, $2::text::jsonb)`, [F.SOC, JSON.stringify({ about: "Still here, still building robots." })]);
      return out;
    }));
});

describe.skipIf(!DB)("community goldens on the current stack: membership", () => {
  const G = "membership";

  it("follow, join (request, open, inductions), decide, leave", () =>
    check(G, "join", async (tx) => {
      const out: Row = {};
      out["follow"] = await step(tx, as(SAMI), `public.follow_society($1, true)`, [F.SOC]);
      out["unfollow"] = await step(tx, as(SAMI), `public.follow_society($1, false)`, [F.SOC]);
      out["follow_pending"] = await call(tx, as(SAMI), `public.follow_society($1, true)`, [F.PENDING]);
      out["join_request"] = await step(tx, as(SAMI), `public.join_society($1)`, [F.SOC]);
      out["join_again"] = await call(tx, as(SAMI), `public.join_society($1)`, [F.SOC]);
      out["join_member"] = await call(tx, as(MEHR), `public.join_society($1)`, [F.SOC]);
      out["join_other_university"] = await call(tx, as(ULA), `public.join_society($1)`, [F.SOC]);
      out["decide_member"] = await call(tx, as(MEHR), `public.decide_join_request($1, $2, true)`, [F.SOC, SAMI]);
      out["accept"] = await step(tx, as(OSMAN), `public.decide_join_request($1, $2, true)`, [F.SOC, SAMI]);
      out["accept_gone"] = await call(tx, as(OSMAN), `public.decide_join_request($1, $2, true)`, [F.SOC, SAMI]);
      await tx.unsafe(`update public.societies set membership_mode = 'open' where id = $1`, [F.SOC]);
      out["join_open"] = await step(tx, as(NIDA), `public.join_society($1)`, [F.SOC]);
      await tx.unsafe(`update public.societies set membership_mode = 'inductions' where id = $1`, [F.SOC]);
      out["join_inductions"] = await call(tx, as(F.GUL), `public.join_society($1)`, [F.SOC]);
      out["leave"] = await step(tx, as(SAMI), `public.leave_society($1)`, [F.SOC]);
      out["leave_again"] = await call(tx, as(SAMI), `public.leave_society($1)`, [F.SOC]);
      out["leave_president"] = await call(tx, as(PRIYA), `public.leave_society($1)`, [F.SOC]);
      out["leave_officer"] = await step(tx, as(OSMAN), `public.leave_society($1)`, [F.SOC]);
      return out;
    }));

  it("officers: invite, answer, handover, remove, confirm terms", () =>
    check(G, "officers", async (tx) => {
      const out: Row = {};
      const invite = `public.invite_officer($1, $2, $3, $4::date, $5::date)`;
      const dates = await tx.unsafe(`select current_date::text as a, (current_date + 180)::text as b, (current_date + 900)::text as c`);
      const d = dates[0] as unknown as { a: string; b: string; c: string };
      out["invite_officer_not_president"] = await call(tx, as(OSMAN), invite, [F.SOC, USERNAME_OF(MEHR), "Treasurer", d.a, d.b]);
      out["invite_unknown"] = await call(tx, as(PRIYA), invite, [F.SOC, "cm_nobody", "Treasurer", d.a, d.b]);
      out["invite_other_university"] = await call(tx, as(PRIYA), invite, [F.SOC, USERNAME_OF(ULA), "Treasurer", d.a, d.b]);
      out["invite_officer_again"] = await call(tx, as(PRIYA), invite, [F.SOC, USERNAME_OF(OSMAN), "Treasurer", d.a, d.b]);
      out["invite_long_term"] = await call(tx, as(PRIYA), invite, [F.SOC, USERNAME_OF(MEHR), "Treasurer", d.a, d.c]);
      const inv = okStep((out["invite"] = await step(tx, as(PRIYA), invite, [F.SOC, " CM_MEHR ", " Treasurer ", d.a, d.b])));
      out["my_invites"] = await call(tx, as(MEHR), `public.my_society_invites()`);
      out["answer_stranger"] = await call(tx, as(SAMI), `public.answer_society_invite($1, true)`, [inv]);
      out["accept"] = await step(tx, as(MEHR), `public.answer_society_invite($1, true)`, [inv]);
      out["handover_not_member"] = await call(tx, as(PRIYA), `public.offer_handover($1, $2)`, [F.SOC, USERNAME_OF(SAMI)]);
      const h1 = okStep((out["handover_first"] = await step(tx, as(PRIYA), `public.offer_handover($1, $2)`, [F.SOC, USERNAME_OF(MEHR)])));
      const h2 = okStep((out["handover_replaced"] = await step(tx, as(PRIYA), `public.offer_handover($1, $2)`, [F.SOC, USERNAME_OF(OSMAN)])));
      out["answer_withdrawn"] = await call(tx, as(MEHR), `public.answer_society_invite($1, true)`, [h1]);
      out["handover"] = await step(tx, as(OSMAN), `public.answer_society_invite($1, true)`, [h2]);
      out["remove_not_president"] = await call(tx, as(PRIYA), `public.remove_officer($1, $2)`, [F.SOC, MEHR]);
      out["remove_president"] = await call(tx, as(OSMAN), `public.remove_officer($1, $2)`, [F.SOC, OSMAN]);
      out["remove"] = await step(tx, as(OSMAN), `public.remove_officer($1, $2)`, [F.SOC, MEHR]);
      out["remove_again"] = await call(tx, as(OSMAN), `public.remove_officer($1, $2)`, [F.SOC, MEHR]);
      const terms = await tx.unsafe(
        `select (select id::text from public.society_terms where society_id = $1 and user_id = $2 and role = 'president' and ended_at is not null) as old_president,
                (select id::text from public.society_terms where society_id = $1 and user_id = $3 and role = 'officer' and ended_at is not null) as mehr,
                (select id::text from public.society_terms where society_id = $1 and user_id = $4 and role = 'president' and ended_at is null) as new_president`,
        [F.SOC, PRIYA, MEHR, OSMAN],
      );
      const t = terms[0] as unknown as { old_president: string; mehr: string; new_president: string };
      out["confirm_own"] = await call(tx, as(OSMAN), `public.confirm_term($1)`, [t.new_president]);
      out["confirm_not_ended"] = await call(tx, as(PRIYA), `public.confirm_term($1)`, [t.new_president]);
      out["confirm_by_member"] = await call(tx, as(PRIYA), `public.confirm_term($1)`, [t.mehr]);
      out["confirm_officer"] = await step(tx, as(OSMAN), `public.confirm_term($1)`, [t.mehr]);
      out["confirm_again"] = await step(tx, as(OSMAN), `public.confirm_term($1)`, [t.mehr]);
      out["confirm_old_president"] = await step(tx, as(OSMAN), `public.confirm_term($1)`, [t.old_president]);
      // society_manage after this lists three terms ending today; it orders by term_end alone, so their order is
      // arbitrary on the stack and the step is not recorded (kept only stable recordings).
      return out;
    }));
});

describe.skipIf(!DB)("community goldens on the current stack: inductions", () => {
  const G = "inductions";
  const ROUND = (deadline: string, extra: Row = {}) => ({
    title: " Fall inductions ",
    description: " Join the build team. ",
    deadline,
    roles: [{ title: " Hardware lead ", seats: 1, skill_ids: ["react"] }, { title: "Designer", seats: 2 }],
    questions: [" What have you built so far? "],
    ...extra,
  });

  it("save, publish, page, apply, decide; the tick closes and declines", () =>
    check(G, "rounds", async (tx) => {
      const out: Row = {};
      const t = (await tx.unsafe(`select (now() + interval '7 days')::text as week, (now() + interval '40 days')::text as late, (now() - interval '1 hour')::text as past`))[0] as unknown as Row;
      const save = `public.save_induction_round($1, $2::text::jsonb)`;
      out["save_member"] = await call(tx, as(MEHR), save, [F.SOC, JSON.stringify(ROUND(t["week"] as string))]);
      out["save_late"] = await call(tx, as(OSMAN), save, [F.SOC, JSON.stringify(ROUND(t["late"] as string))]);
      out["save_no_roles"] = await call(tx, as(OSMAN), save, [F.SOC, JSON.stringify(ROUND(t["week"] as string, { roles: [] }))]);
      out["save_too_many_questions"] = await call(tx, as(OSMAN), save, [F.SOC, JSON.stringify(ROUND(t["week"] as string, { questions: ["One?", "Two?", "Three?", "Four?"] }))]);
      out["save_pending_society"] = await call(tx, as(NIDA), save, [F.PENDING, JSON.stringify(ROUND(t["week"] as string))]);
      const id = okStep((out["saved"] = await step(tx, as(OSMAN), save, [F.SOC, JSON.stringify(ROUND(t["week"] as string))])));
      out["resaved"] = await step(tx, as(OSMAN), save, [F.SOC, JSON.stringify(ROUND(t["week"] as string, { id, title: "Fall inductions", roles: [{ title: "Hardware lead", seats: 1 }] }))]);
      out["page_draft_officer"] = await call(tx, as(PRIYA), `public.induction_round_page($1)`, [id]);
      out["page_draft_student"] = await call(tx, as(SAMI), `public.induction_round_page($1)`, [id]);
      out["apply_draft"] = await call(tx, as(SAMI), `public.apply_induction($1, $2::text::jsonb)`, [id, JSON.stringify({ role_id: F.SOC, answers: ["x"] })]);
      out["publish_member"] = await call(tx, as(MEHR), `public.publish_induction_round($1)`, [id]);
      out["publish"] = await step(tx, as(OSMAN), `public.publish_induction_round($1)`, [id]);
      out["publish_again"] = await call(tx, as(OSMAN), `public.publish_induction_round($1)`, [id]);
      out["resave_open"] = await call(tx, as(OSMAN), save, [F.SOC, JSON.stringify(ROUND(t["week"] as string, { id }))]);
      const role = ((await tx.unsafe(`select id::text from public.induction_roles where round_id = $1 and position = 1`, [id]))[0] as unknown as { id: string }).id;
      const apply = `public.apply_induction($1, $2::text::jsonb)`;
      out["apply_no_role"] = await call(tx, as(SAMI), apply, [id, JSON.stringify({ role_id: F.SOC, answers: ["A line follower."] })]);
      out["apply_no_answer"] = await call(tx, as(SAMI), apply, [id, JSON.stringify({ role_id: role, answers: [" "] })]);
      out["apply_other_university"] = await call(tx, as(ULA), apply, [id, JSON.stringify({ role_id: role, answers: ["A drone."] })]);
      const a1 = okStep((out["apply"] = await step(tx, as(SAMI), apply, [id, JSON.stringify({ role_id: role, answers: ["A line-following robot."] })])));
      out["apply_again"] = await call(tx, as(SAMI), apply, [id, JSON.stringify({ role_id: role, answers: ["Another robot."] })]);
      const a2 = ok(await call(tx, as(NIDA), apply, [id, JSON.stringify({ role_id: role, answers: ["A solar lamp."] })]));
      const a3 = ok(await call(tx, as(F.GUL), apply, [id, JSON.stringify({ role_id: role, answers: ["A weather station."] })]));
      out["page_officer"] = await call(tx, as(OSMAN), `public.induction_round_page($1)`, [id]);
      out["page_applicant"] = await call(tx, as(SAMI), `public.induction_round_page($1)`, [id]);
      const decide = `public.decide_induction_application($1, $2, $3)`;
      out["decide_member"] = await call(tx, as(MEHR), decide, [a1, "accept", null]);
      out["decide_unknown_action"] = await call(tx, as(OSMAN), decide, [a1, "maybe", null]);
      out["shortlist"] = await step(tx, as(OSMAN), decide, [a1, "shortlist", null]);
      out["accept"] = await step(tx, as(OSMAN), decide, [a1, "accept", " Welcome aboard "]);
      out["accept_again"] = await call(tx, as(OSMAN), decide, [a1, "accept", null]);
      out["accept_full"] = await call(tx, as(OSMAN), decide, [a2, "accept", null]);
      out["decline"] = await step(tx, as(OSMAN), decide, [a2, "decline", "  "]);
      void a3;
      await tx.unsafe(`update public.induction_rounds set deadline = now() - interval '15 days' where id = $1`, [id]);
      out["tick"] = await job(tx, `select private.society_tick()`);
      out["tick_again"] = await job(tx, `select private.society_tick()`);
      return out;
    }));
});

describe.skipIf(!DB)("community goldens on the current stack: staff", () => {
  const G = "staff";

  it("ops_societies, ops_society_case, claim_society, decide_society (audited before and after)", () =>
    check(G, "review", async (tx) => {
      const out: Row = {};
      const staff = as(F.TARIQ, "aal2");
      out["queue_aal1"] = await call(tx, as(F.TARIQ), `public.ops_societies('open')`);
      out["queue_student"] = await call(tx, as(SAMI, "aal2"), `public.ops_societies('open')`);
      out["queue"] = await call(tx, staff, `public.ops_societies('open')`);
      out["queue_decided"] = await call(tx, staff, `public.ops_societies('decided')`);
      out["case"] = await call(tx, staff, `public.ops_society_case($1)`, [F.PENDING]);
      out["case_unknown"] = await call(tx, staff, `public.ops_society_case($1)`, [F.SOC]);
      out["claim"] = await step(tx, staff, `public.claim_society($1, true)`, [F.PENDING]);
      out["claim_again"] = await step(tx, staff, `public.claim_society($1, true)`, [F.PENDING]);
      out["release"] = await step(tx, staff, `public.claim_society($1, false)`, [F.PENDING]);
      out["more_info_no_reason"] = await call(tx, staff, `public.decide_society($1, 'more_info', ' ')`, [F.PENDING]);
      out["more_info"] = await step(tx, staff, `public.decide_society($1, 'more_info', 'Add the notice from the students office')`, [F.PENDING]);
      out["approve_more_info"] = await call(tx, staff, `public.decide_society($1, 'approve', null)`, [F.PENDING]);
      await tx.unsafe(`update public.societies set status = 'pending' where id = $1`, [F.PENDING]);
      await tx.unsafe(`update public.society_requests set status = 'pending' where society_id = $1`, [F.PENDING]);
      out["approve"] = await step(tx, staff, `public.decide_society($1, 'approve', null)`, [F.PENDING]);
      out["page_after_approve"] = await call(tx, as(NIDA), `public.society_page($1)`, [F.PENDING_SLUG]);
      out["unknown_action"] = await call(tx, staff, `public.decide_society($1, 'promote', 'Because it is good')`, [F.SOC]);
      out["suspend"] = await step(tx, staff, `public.decide_society($1, 'suspend', 'Fees collected without receipts')`, [F.SOC]);
      out["pause_paid_suspended"] = await call(tx, staff, `public.decide_society($1, 'pause_paid', 'Hold on')`, [F.SOC]);
      out["reinstate"] = await step(tx, staff, `public.decide_society($1, 'reinstate', null)`, [F.SOC]);
      out["pause_paid"] = await step(tx, staff, `public.decide_society($1, 'pause_paid', 'Receipts look copied')`, [F.SOC]);
      out["resume_paid"] = await step(tx, staff, `public.decide_society($1, 'resume_paid', null)`, [F.SOC]);
      out["reject_verified"] = await call(tx, staff, `public.decide_society($1, 'reject', 'Not a society')`, [F.SOC]);
      return out;
    }));

  it("reject: the name is free again", () =>
    check(G, "reject", async (tx) => {
      const out: Row = {};
      const staff = as(F.TARIQ, "aal2");
      out["reject"] = await step(tx, staff, `public.decide_society($1, 'reject', 'We could not confirm it')`, [F.PENDING]);
      out["name_free"] = await call(tx, as(SAMI), `public.society_name_check($1)`, [F.PENDING_NAME]);
      out["mine"] = await call(tx, as(NIDA), `public.my_society_requests()`);
      out["request_again"] = await step(tx, as(NIDA), REQUEST, [JSON.stringify(NEW_SOCIETY(F.PENDING_NAME))]);
      return out;
    }));
});

// ---------------------------------------------------------------------------
// Cases: events
// ---------------------------------------------------------------------------
const SAVE = `public.save_society_event($1, $2::text::jsonb)`;
async function times(tx: Tx): Promise<Record<string, string>> {
  const r = await tx.unsafe(
    `select (now() + interval '3 days')::text as s1, (now() + interval '3 days 2 hours')::text as e1, (now() + interval '4 days')::text as s2,
            (now() + interval '4 days 3 hours')::text as e2, (now() + interval '1 day')::text as opens, (now() + interval '2 days')::text as closes`,
  );
  return r[0] as Record<string, string>;
}
const NEW_EVENT = (t: Record<string, string>, extra: Row = {}) => ({
  type: "workshop",
  title: "  Robot arena  ",
  description: " Build a sumo robot in a weekend. ",
  location: " Hall A ",
  sessions: [
    { title: "Build day", starts_at: t["s2"], ends_at: t["e2"] },
    { starts_at: t["s1"], ends_at: t["e1"] },
  ],
  ticket_types: [{ name: " Builder ", capacity: 20 }, { name: "Spectator", capacity: 50 }],
  eligibility: { scope: "groups", departments: ["Computer Science"], batches: [2027] },
  team: { min: 2, max: 3 },
  approval_mode: "automatic",
  questions: [{ label: " Team experience? ", kind: "single", options: ["None", " Some ", ""], required: true }],
  record_kinds: ["attended", "completed", "result"],
  completed_min: 2,
  volunteer_hours: true,
  refund_policy: "none",
  ...extra,
});

describe.skipIf(!DB)("community goldens on the current stack: events", () => {
  const G = "events";

  it("save_society_event: create, refusals, edit; publish; edit payload; cancel", () =>
    check(G, "save_publish", async (tx) => {
      const out: Row = {};
      const t = await times(tx);
      await cohostSociety(tx);
      out["save_member"] = await call(tx, as(MEHR), SAVE, [F.SOC, JSON.stringify(NEW_EVENT(t))]);
      out["save_no_sessions"] = await call(tx, as(OSMAN), SAVE, [F.SOC, JSON.stringify(NEW_EVENT(t, { sessions: [] }))]);
      out["save_no_tickets"] = await call(tx, as(OSMAN), SAVE, [F.SOC, JSON.stringify(NEW_EVENT(t, { ticket_types: [] }))]);
      out["save_cheap"] = await call(tx, as(OSMAN), SAVE, [F.SOC, JSON.stringify(NEW_EVENT(t, { ticket_types: [{ name: "Seat", capacity: 5, price_pkr: 50 }] }))]);
      out["save_bad_scope"] = await call(tx, as(OSMAN), SAVE, [F.SOC, JSON.stringify(NEW_EVENT(t, { eligibility: { scope: "city" } }))]);
      out["save_bad_cover"] = await call(tx, as(OSMAN), SAVE, [F.SOC, JSON.stringify(NEW_EVENT(t, { cover_path: `${F.PENDING}/97d00000-0000-4000-8000-000000000003.webp` }))]);
      out["save_pending_society"] = await call(tx, as(NIDA), SAVE, [F.PENDING, JSON.stringify(NEW_EVENT(t))]);
      const id = okStep(
        (out["created"] = await step(tx, as(OSMAN), SAVE, [F.SOC, JSON.stringify(NEW_EVENT(t, { cover_path: F.COVER, cohosts: [F.COHOST_SLUG, F.PENDING_SLUG, F.SOC_SLUG] }))])),
      );
      out["edit_payload"] = await call(tx, as(PRIYA), `public.event_edit_payload($1)`, [id]);
      out["edit_payload_student"] = await call(tx, as(MEHR), `public.event_edit_payload($1)`, [id]);
      out["page_draft_student"] = await call(tx, as(MEHR), `public.event_page($1)`, [id]);
      out["cohost_stranger"] = await call(tx, as(MEHR), `public.answer_cohost($1, $2, true)`, [id, F.COHOST]);
      out["cohost_accept"] = await step(tx, as(SAMI), `public.answer_cohost($1, $2, true)`, [id, F.COHOST]);
      out["cohost_again"] = await call(tx, as(SAMI), `public.answer_cohost($1, $2, false)`, [id, F.COHOST]);
      out["publish_cohost"] = await call(tx, as(SAMI), `public.publish_event($1)`, [id]);
      out["publish"] = await step(tx, as(OSMAN), `public.publish_event($1)`, [id]);
      out["publish_again"] = await call(tx, as(OSMAN), `public.publish_event($1)`, [id]);
      out["edited"] = await step(tx, as(OSMAN), SAVE, [
        F.SOC,
        JSON.stringify(NEW_EVENT(t, { id, title: "Robot arena", location: "Hall B", ticket_types: [{ name: "Builder", capacity: 25 }], questions: [] })),
      ]);
      out["list_officer"] = await call(tx, as(PRIYA), `public.society_event_list($1)`, [F.SOC]);
      out["list_cohost"] = await call(tx, as(SAMI), `public.society_event_list($1)`, [F.COHOST]);
      out["cancel_member"] = await call(tx, as(MEHR), `public.cancel_society_event($1, 'x')`, [id]);
      out["cancel"] = await step(tx, as(OSMAN), `public.cancel_society_event($1, $2)`, [id, " The hall flooded. "]);
      out["cancel_again"] = await call(tx, as(OSMAN), `public.cancel_society_event($1, 'again')`, [id]);
      out["edit_cancelled"] = await call(tx, as(OSMAN), SAVE, [F.SOC, JSON.stringify(NEW_EVENT(t, { id }))]);
      return out;
    }));

  it("publish refusals: paid without details, paused, started", () =>
    check(G, "publish_refusals", async (tx) => {
      const out: Row = {};
      const t = await times(tx);
      const paid = ok(await call(tx, as(OSMAN), SAVE, [F.SOC, JSON.stringify(NEW_EVENT(t, { ticket_types: [{ name: "Seat", capacity: 5, price_pkr: 500 }] }))]));
      out["paid_no_details"] = await call(tx, as(OSMAN), `public.publish_event($1)`, [paid]);
      await paymentMethod(tx);
      await tx.unsafe(`update public.societies set paid_paused = true where id = $1`, [F.SOC]);
      out["paid_paused"] = await call(tx, as(OSMAN), `public.publish_event($1)`, [paid]);
      await tx.unsafe(`update public.events set starts_at = now() - interval '1 minute' where id = $1`, [paid]);
      out["started"] = await call(tx, as(OSMAN), `public.publish_event($1)`, [paid]);
      return out;
    }));

  it("society_events and event_page: lists and what each viewer sees", () =>
    check(G, "pages", async (tx) => {
      const out: Row = {};
      await seedEvent(tx, { extra: `eligibility = '{"scope": "groups", "departments": ["Computer Science"], "batches": [2027]}'` });
      await tx.unsafe(`insert into public.friendships (user_id_a, user_id_b) values (least($1::uuid, $2::uuid), greatest($1::uuid, $2::uuid))`, [SAMI, NIDA]);
      await tx.unsafe(`insert into public.event_registrations (event_id, user_id, ticket_type_id, status) values ($1, $2, $3, 'confirmed')`, [F.EVENT, NIDA, F.TICKET]);
      out["upcoming"] = await call(tx, as(SAMI), `public.society_events('upcoming', null)`);
      out["upcoming_type"] = await call(tx, as(SAMI), `public.society_events('upcoming', 'talk')`);
      out["mine"] = await call(tx, as(NIDA), `public.society_events('mine', null)`);
      out["past"] = await call(tx, as(SAMI), `public.society_events('past', null)`);
      out["unknown_list"] = await call(tx, as(SAMI), `public.society_events('soon', null)`);
      out["other_university"] = await call(tx, as(ULA), `public.society_events('upcoming', null)`);
      out["page_eligible"] = await call(tx, as(SAMI), `public.event_page($1)`, [F.EVENT]);
      out["page_wrong_group"] = await call(tx, as(MEHR), `public.event_page($1)`, [F.EVENT]);
      out["page_registered"] = await call(tx, as(NIDA), `public.event_page($1)`, [F.EVENT]);
      out["page_officer"] = await call(tx, as(OSMAN), `public.event_page($1)`, [F.EVENT]);
      out["page_other_university"] = await call(tx, as(ULA), `public.event_page($1)`, [F.EVENT]);
      out["page_graduate"] = await call(tx, as(F.GUL), `public.event_page($1)`, [F.EVENT]);
      await tx.unsafe(`update public.events set eligibility = '{"scope": "all"}', scope = 'global' where id = $1`, [F.EVENT]);
      out["page_other_university_all"] = await call(tx, as(ULA), `public.event_page($1)`, [F.EVENT]);
      out["other_university_all"] = await call(tx, as(ULA), `public.society_events('upcoming', null)`);
      return out;
    }));
});

const REGISTER = `public.register_event($1, $2::text::jsonb)`;
const answer = (a: string, extra: Row = {}) => JSON.stringify({ ticket_type_id: F.TICKET, answers: [a], ...extra });

describe.skipIf(!DB)("community goldens on the current stack: registrations", () => {
  const G = "registrations";

  it("register: confirmed, the waitlist, refusals; cancel promotes in order", () =>
    check(G, "seats", async (tx) => {
      const out: Row = {};
      await seedEvent(tx, { capacity: 2 });
      out["no_answer"] = await call(tx, as(SAMI), REGISTER, [F.EVENT, answer(" ")]);
      out["long_answer"] = await call(tx, as(SAMI), REGISTER, [F.EVENT, answer("x".repeat(2001))]);
      out["no_ticket"] = await call(tx, as(SAMI), REGISTER, [F.EVENT, JSON.stringify({ ticket_type_id: F.SOC, answers: ["Yes"] })]);
      out["first"] = await step(tx, as(SAMI), REGISTER, [F.EVENT, answer("Once, in school.")]);
      out["again"] = await call(tx, as(SAMI), REGISTER, [F.EVENT, answer("Twice.")]);
      out["second"] = await step(tx, as(NIDA), REGISTER, [F.EVENT, answer("No.")]);
      out["waitlisted_1"] = await step(tx, as(MEHR), REGISTER, [F.EVENT, answer("Yes.")]);
      out["waitlisted_2"] = await step(tx, as(OSMAN), REGISTER, [F.EVENT, answer("Yes.")]);
      out["graduate"] = await call(tx, as(F.GUL), REGISTER, [F.EVENT, answer("Yes.")]);
      out["other_university"] = await call(tx, as(ULA), REGISTER, [F.EVENT, answer("Yes.")]);
      out["page_waitlisted"] = await call(tx, as(MEHR), `public.event_page($1)`, [F.EVENT]);
      out["cancel"] = await step(tx, as(SAMI), `public.cancel_registration($1)`, [F.EVENT]);
      out["cancel_again"] = await call(tx, as(SAMI), `public.cancel_registration($1)`, [F.EVENT]);
      out["again_after_cancel"] = await step(tx, as(SAMI), REGISTER, [F.EVENT, answer("Back again.")]);
      out["tickets"] = await call(tx, as(MEHR), `public.my_tickets()`);
      out["tickets_cancelled"] = await call(tx, as(SAMI), `public.my_tickets()`);
      out["unknown_event"] = await call(tx, as(SAMI), REGISTER, [F.SOC, answer("x")]);
      out["signed_out"] = await call(tx, ANON, REGISTER, [F.EVENT, answer("x")]);
      return out;
    }));

  it("manual approval, teams, the window, cancelled and ended events", () =>
    check(G, "rules", async (tx) => {
      const out: Row = {};
      await seedEvent(tx, { capacity: 1, required: false, extra: `approval_mode = 'manual', team_min = 2, team_max = 2` });
      out["no_team"] = await call(tx, as(SAMI), REGISTER, [F.EVENT, JSON.stringify({ ticket_type_id: F.TICKET, answers: [] })]);
      out["bad_code"] = await call(tx, as(SAMI), REGISTER, [F.EVENT, JSON.stringify({ ticket_type_id: F.TICKET, answers: [], team: { code: "ZZZZZZ" } })]);
      out["captain"] = await step(tx, as(SAMI), REGISTER, [F.EVENT, JSON.stringify({ ticket_type_id: F.TICKET, answers: [], team: { create: " Wren Bots " } })]);
      const code = ((await tx.unsafe(`select code from public.event_teams where event_id = $1`, [F.EVENT]))[0] as unknown as { code: string }).code;
      out["joined"] = await step(tx, as(NIDA), REGISTER, [F.EVENT, JSON.stringify({ ticket_type_id: F.TICKET, answers: [], team: { code: code.toLowerCase() } })]);
      out["team_full"] = await call(tx, as(MEHR), REGISTER, [F.EVENT, JSON.stringify({ ticket_type_id: F.TICKET, answers: [], team: { code } })]);
      out["page_captain"] = await call(tx, as(SAMI), `public.event_page($1)`, [F.EVENT]);
      const decide = `public.decide_registration($1, $2, $3)`;
      out["decide_member"] = await call(tx, as(MEHR), decide, [F.EVENT, SAMI, true]);
      out["approve"] = await step(tx, as(OSMAN), decide, [F.EVENT, SAMI, true]);
      out["approve_full"] = await step(tx, as(OSMAN), decide, [F.EVENT, NIDA, true]);
      out["approve_again"] = await call(tx, as(OSMAN), decide, [F.EVENT, NIDA, true]);
      out["decline"] = await step(tx, as(OSMAN), decide, [F.EVENT, NIDA, false]);
      await tx.unsafe(`update public.events set registration_opens_at = now() + interval '1 day' where id = $1`, [F.EVENT]);
      out["not_open"] = await call(tx, as(MEHR), REGISTER, [F.EVENT, JSON.stringify({ ticket_type_id: F.TICKET, answers: [], team: { create: "Late" } })]);
      await tx.unsafe(`update public.events set registration_opens_at = null, registration_closes_at = now() - interval '1 minute' where id = $1`, [F.EVENT]);
      out["closed"] = await call(tx, as(MEHR), REGISTER, [F.EVENT, JSON.stringify({ ticket_type_id: F.TICKET, answers: [], team: { create: "Late" } })]);
      await tx.unsafe(`update public.events set status = 'cancelled' where id = $1`, [F.EVENT]);
      out["cancelled"] = await call(tx, as(MEHR), REGISTER, [F.EVENT, JSON.stringify({ ticket_type_id: F.TICKET, answers: [] })]);
      await tx.unsafe(`update public.events set status = 'draft' where id = $1`, [F.EVENT]);
      out["draft"] = await call(tx, as(MEHR), REGISTER, [F.EVENT, JSON.stringify({ ticket_type_id: F.TICKET, answers: [] })]);
      await endEvent(tx);
      out["ended"] = await call(tx, as(MEHR), REGISTER, [F.EVENT, JSON.stringify({ ticket_type_id: F.TICKET, answers: [] })]);
      return out;
    }));
});

describe.skipIf(!DB)("community goldens on the current stack: check-in", () => {
  const G = "checkin";

  it("ticket, scan once, search, walk-ins, email, headcount, staff, messages, manage", () =>
    check(G, "door", async (tx) => {
      const out: Row = {};
      await seedEvent(tx, { capacity: 3, startsIn: "1 hour" });
      ok(await call(tx, as(SAMI), REGISTER, [F.EVENT, answer("Once, in school.")]));
      ok(await call(tx, as(NIDA), REGISTER, [F.EVENT, answer("No.")]));
      await tx.unsafe(`update public.event_registrations set status = 'pending' where event_id = $1 and user_id = $2`, [F.EVENT, NIDA]);
      const ticket = ok((out["ticket"] = await call(tx, as(SAMI), `public.event_ticket($1)`, [F.EVENT])));
      out["ticket_pending"] = await call(tx, as(NIDA), `public.event_ticket($1)`, [F.EVENT]);
      out["ticket_none"] = await call(tx, as(MEHR), `public.event_ticket($1)`, [F.EVENT]);
      const payload = ticket["payload"] as string;
      const scan = `public.check_in_scan($1, null, $2)`;
      out["scan_member"] = await call(tx, as(MEHR), scan, [F.EVENT, payload]);
      out["scan"] = await step(tx, as(OSMAN), scan, [F.EVENT, payload]);
      out["scan_again"] = await step(tx, as(PRIYA), scan, [F.EVENT, payload]);
      out["scan_forged"] = await call(tx, as(OSMAN), scan, [F.EVENT, `${payload.slice(0, -4)}0000`]);
      out["scan_garbage"] = await call(tx, as(OSMAN), scan, [F.EVENT, "hello"]);
      const nidaReg = ((await tx.unsafe(`select id::text from public.event_registrations where event_id = $1 and user_id = $2`, [F.EVENT, NIDA]))[0] as unknown as { id: string }).id;
      const pendingPayload = ((await tx.unsafe(`select private.ticket_payload($1::uuid) as p`, [nidaReg]))[0] as unknown as { p: string }).p;
      out["scan_pending"] = await call(tx, as(OSMAN), scan, [F.EVENT, pendingPayload]);
      out["search_short"] = await call(tx, as(OSMAN), `public.check_in_search($1, $2)`, [F.EVENT, "w"]);
      out["search"] = await call(tx, as(OSMAN), `public.check_in_search($1, $2)`, [F.EVENT, "wren"]);
      out["search_username"] = await call(tx, as(OSMAN), `public.check_in_search($1, $2)`, [F.EVENT, "cm_ni"]);
      out["person_registered"] = await step(tx, as(OSMAN), `public.check_in_person($1, null, $2)`, [F.EVENT, SAMI]);
      out["person_walk_in"] = await step(tx, as(OSMAN), `public.check_in_person($1, $2, $3)`, [F.EVENT, F.SESSION, MEHR]);
      out["person_graduate"] = await call(tx, as(OSMAN), `public.check_in_person($1, null, $2)`, [F.EVENT, F.GUL]);
      out["email_invalid"] = await call(tx, as(OSMAN), `public.check_in_email($1, null, $2)`, [F.EVENT, "not-an-email"]);
      out["email_other_domain"] = await call(tx, as(OSMAN), `public.check_in_email($1, null, $2)`, [F.EVENT, "walkin@comm-b.test"]);
      out["email_stranger"] = await step(tx, as(OSMAN), `public.check_in_email($1, null, $2)`, [F.EVENT, " Walkin@Comm-A.test "]);
      out["email_stranger_again"] = await step(tx, as(OSMAN), `public.check_in_email($1, null, $2)`, [F.EVENT, "walkin@comm-a.test"]);
      out["email_account"] = await step(tx, as(OSMAN), `public.check_in_email($1, null, $2)`, [F.EVENT, F.EMAIL[NIDA]]);
      out["headcount"] = await call(tx, as(OSMAN), `public.event_headcount($1, null)`, [F.EVENT]);
      out["headcount_student"] = await call(tx, as(SAMI), `public.event_headcount($1, null)`, [F.EVENT]);
      out["staff_add"] = await step(tx, as(OSMAN), `public.add_event_staff($1, $2)`, [F.EVENT, " CM_ULA "]);
      out["staff_unknown"] = await call(tx, as(OSMAN), `public.add_event_staff($1, $2)`, [F.EVENT, "cm_nobody"]);
      out["staff_scan"] = await call(tx, as(ULA), scan, [F.EVENT, payload]);
      out["staff_remove"] = await step(tx, as(OSMAN), `public.remove_event_staff($1, $2)`, [F.EVENT, ULA]);
      out["message_short"] = await call(tx, as(OSMAN), `public.message_registrants($1, $2)`, [F.EVENT, "hi"]);
      out["message"] = await step(tx, as(OSMAN), `public.message_registrants($1, $2)`, [F.EVENT, "  Doors open at 5. Bring your ticket.  "]);
      out["manage"] = await call(tx, as(PRIYA), `public.event_manage($1)`, [F.EVENT]);
      out["manage_student"] = await call(tx, as(SAMI), `public.event_manage($1)`, [F.EVENT]);
      out["cancel_checked_in"] = await call(tx, as(SAMI), `public.cancel_registration($1)`, [F.EVENT]);
      out["code"] = await call(tx, as(OSMAN), `public.society_event_code($1)`, [F.EVENT]);
      const token = ((await tx.unsafe(`select private.event_code($1, floor(extract(epoch from now()) / 30)::bigint) as t`, [F.EVENT]))[0] as unknown as { t: string }).t;
      out["self_bad"] = await call(tx, as(SAMI), `public.self_check_in($1, $2)`, [F.EVENT, "000000000000000000000000"]);
      out["self"] = await step(tx, as(SAMI), `public.self_check_in($1, $2)`, [F.EVENT, token]);
      out["self_unregistered"] = await call(tx, as(ULA), `public.self_check_in($1, $2)`, [F.EVENT, token]);
      return out;
    }));
});

describe.skipIf(!DB)("community goldens on the current stack: close-out", () => {
  const G = "closeout";

  it("close-out page, fixes, results, hours, issue; feedback; CSV rows", () =>
    check(G, "closeout", async (tx) => {
      const out: Row = {};
      await seedEvent(tx, { capacity: 5, required: false, extra: `record_kinds = '{attended,completed,result}', volunteer_hours = true` });
      for (const u of [SAMI, NIDA, MEHR]) ok(await call(tx, as(u), REGISTER, [F.EVENT, JSON.stringify({ ticket_type_id: F.TICKET, answers: [] })]));
      out["fix_too_early"] = await call(tx, as(OSMAN), `public.fix_attendance($1, null, $2, true, 'Came late')`, [F.EVENT, SAMI]);
      out["issue_too_early"] = await call(tx, as(OSMAN), `public.issue_event_entries($1)`, [F.EVENT]);
      ok(await call(tx, as(OSMAN), `public.check_in_person($1, null, $2)`, [F.EVENT, SAMI]));
      ok(await call(tx, as(OSMAN), `public.check_in_person($1, null, $2)`, [F.EVENT, NIDA]));
      ok(await call(tx, as(OSMAN), `public.check_in_email($1, null, $2)`, [F.EVENT, "walkin@comm-a.test"]));
      await endEvent(tx);
      out["feedback_open_page"] = await call(tx, as(SAMI), `public.event_page($1)`, [F.EVENT]);
      out["fix_no_reason"] = await call(tx, as(OSMAN), `public.fix_attendance($1, null, $2, true, ' ')`, [F.EVENT, MEHR]);
      out["fix_add"] = await step(tx, as(OSMAN), `public.fix_attendance($1, null, $2, true, 'Signed the paper list')`, [F.EVENT, MEHR]);
      // The two fixes would share now(); the add is moved back a minute so the page's order (newest first) is fixed.
      await tx.unsafe(`update public.event_checkins set checked_in_at = now() - interval '1 minute' where event_id = $1 and user_id = $2`, [F.EVENT, MEHR]);
      out["fix_remove"] = await step(tx, as(OSMAN), `public.fix_attendance($1, null, $2, false, 'Left after ten minutes')`, [F.EVENT, NIDA]);
      out["fix_remove_again"] = await call(tx, as(OSMAN), `public.fix_attendance($1, null, $2, false, 'Left after ten minutes')`, [F.EVENT, NIDA]);
      out["fix_unregistered"] = await call(tx, as(OSMAN), `public.fix_attendance($1, null, $2, true, 'Was there')`, [F.EVENT, ULA]);
      out["result"] = await step(tx, as(OSMAN), `public.set_event_result($1, $2, null, 1, ' Winner ')`, [F.EVENT, SAMI]);
      out["result_again"] = await step(tx, as(OSMAN), `public.set_event_result($1, $2, null, 2, null)`, [F.EVENT, SAMI]);
      out["result_unregistered"] = await call(tx, as(OSMAN), `public.set_event_result($1, $2, null, 1, null)`, [F.EVENT, ULA]);
      out["result_cleared"] = await step(tx, as(OSMAN), `public.set_event_result($1, $2, null, null, null)`, [F.EVENT, MEHR]);
      out["hours_over"] = await call(tx, as(OSMAN), `public.log_volunteer_hours($1, $2, 5)`, [F.EVENT, MEHR]);
      out["hours"] = await step(tx, as(OSMAN), `public.log_volunteer_hours($1, $2, 1.5)`, [F.EVENT, MEHR]);
      out["page"] = await call(tx, as(PRIYA), `public.closeout_page($1)`, [F.EVENT]);
      out["page_student"] = await call(tx, as(SAMI), `public.closeout_page($1)`, [F.EVENT]);
      out["rows"] = await call(tx, as(PRIYA), `public.event_attendees_rows($1)`, [F.EVENT]);
      out["issue"] = await step(tx, as(OSMAN), `public.issue_event_entries($1)`, [F.EVENT]);
      out["issue_again"] = await call(tx, as(OSMAN), `public.issue_event_entries($1)`, [F.EVENT]);
      out["feedback"] = await step(tx, as(SAMI), `public.submit_event_feedback($1, 4, $2)`, [F.EVENT, "  Great irons.  "]);
      out["feedback_again"] = await call(tx, as(SAMI), `public.submit_event_feedback($1, 5, null)`, [F.EVENT]);
      out["feedback_stranger"] = await call(tx, as(ULA), `public.submit_event_feedback($1, 5, null)`, [F.EVENT]);
      out["manage"] = await call(tx, as(PRIYA), `public.event_manage($1)`, [F.EVENT]);
      return out;
    }));

  it("event-tick (live, ended, reminders) and event-closeout (issued at 72 hours)", () =>
    check(G, "jobs", async (tx) => {
      const out: Row = {};
      await seedEvent(tx, { capacity: 5, startsIn: "30 minutes", required: false });
      for (const u of [SAMI, NIDA]) ok(await call(tx, as(u), REGISTER, [F.EVENT, JSON.stringify({ ticket_type_id: F.TICKET, answers: [] })]));
      out["remind_1h"] = await job(tx, `select private.event_tick()`);
      out["remind_again"] = await job(tx, `select private.event_tick()`);
      await tx.unsafe(`update public.events set starts_at = now() - interval '5 minutes' where id = $1`, [F.EVENT]);
      out["live"] = await job(tx, `select private.event_tick()`);
      ok(await call(tx, as(OSMAN), `public.check_in_person($1, null, $2)`, [F.EVENT, SAMI]));
      await endEvent(tx, 80);
      await tx.unsafe(`update public.events set status = 'live' where id = $1`, [F.EVENT]);
      out["ended"] = await job(tx, `select private.event_tick()`);
      out["closeout"] = await job(tx, `select private.event_closeout_tick()`);
      out["closeout_again"] = await job(tx, `select private.event_closeout_tick()`);
      return out;
    }));
});

describe.skipIf(!DB)("community goldens on the current stack: paid tickets", () => {
  const G = "payments";

  it("payment details: propose, a second officer confirms, replace, remove", () =>
    check(G, "details", async (tx) => {
      const out: Row = {};
      const propose = `public.propose_payment_method($1, $2::text::jsonb)`;
      const bank = { action: "add", kind: "bank", bank_name: " Wren Bank ", account_title: " Wren Robotics Society ", account_number: " pk00wren0000001234567890 " };
      out["propose_member"] = await call(tx, as(MEHR), propose, [F.SOC, JSON.stringify(bank)]);
      out["propose_unknown"] = await call(tx, as(PRIYA), propose, [F.SOC, JSON.stringify({ ...bank, action: "swap" })]);
      out["propose_pending"] = await call(tx, as(NIDA), propose, [F.PENDING, JSON.stringify(bank)]);
      const m1 = okStep((out["propose"] = await step(tx, as(PRIYA), propose, [F.SOC, JSON.stringify(bank)])));
      out["page"] = await call(tx, as(OSMAN), `public.payment_details_page($1)`, [F.SOC]);
      out["confirm_own"] = await call(tx, as(PRIYA), `public.confirm_payment_method($1, true)`, [m1]);
      out["confirm"] = await step(tx, as(OSMAN), `public.confirm_payment_method($1, true)`, [m1]);
      out["confirm_again"] = await call(tx, as(OSMAN), `public.confirm_payment_method($1, true)`, [m1]);
      const m2 = okStep(
        (out["propose_replace"] = await step(tx, as(OSMAN), propose, [F.SOC, JSON.stringify({ action: "replace", replaces_id: m1, kind: "jazzcash", account_title: "Wren Robotics", account_number: "03001234567" })])),
      );
      out["reject"] = await step(tx, as(PRIYA), `public.confirm_payment_method($1, false)`, [m2]);
      const m3 = okStep((out["propose_remove"] = await step(tx, as(OSMAN), propose, [F.SOC, JSON.stringify({ action: "remove", replaces_id: m1 })])));
      out["remove"] = await step(tx, as(PRIYA), `public.confirm_payment_method($1, true)`, [m3]);
      // payment_details_page now lists three history rows made at the same now(), ordered by created_at alone:
      // arbitrary on the stack, so not recorded.
      return out;
    }));

  it("a paid seat: hold, receipt, review, refunds; holds expire; disputes become cases", () =>
    check(G, "tickets", async (tx) => {
      const out: Row = {};
      await paymentMethod(tx);
      await seedEvent(tx, { capacity: 2, price: 1500, required: false, startsIn: "5 days", extra: `refund_policy = 'until', refund_days = 3` });
      const reg = (u: string) => call(tx, as(u), REGISTER, [F.EVENT, JSON.stringify({ ticket_type_id: F.TICKET, answers: [] })]);
      out["held"] = await step(tx, as(SAMI), REGISTER, [F.EVENT, JSON.stringify({ ticket_type_id: F.TICKET, answers: [] })]);
      out["payment"] = await call(tx, as(SAMI), `public.ticket_payment($1)`, [F.EVENT]);
      out["payment_none"] = await call(tx, as(NIDA), `public.ticket_payment($1)`, [F.EVENT]);
      out["ticket_held"] = await call(tx, as(SAMI), `public.event_ticket($1)`, [F.EVENT]);
      const ids = async (u: string) =>
        (await tx.unsafe(`select r.id::text as reg from public.event_registrations r where r.event_id = $1 and r.user_id = $2`, [F.EVENT, u]))[0] as unknown as { reg: string };
      const sami = await ids(SAMI);
      const path = (r: string, n: string) => `${F.EVENT}/${r}/97f00000-0000-4000-8000-0000000000${n}.webp`;
      const HASH = "a".repeat(64);
      const submit = `public.submit_receipt($1, $2, $3, $4, $5)`;
      out["receipt_missing"] = await call(tx, as(SAMI), submit, [sami.reg, path(sami.reg, "01"), HASH, "0f0f0f0f0f0f0f0f", "TXN-1001"]);
      await tx.unsafe(`insert into storage.objects (bucket_id, name, owner) values ('event-receipts', $1, $2)`, [path(sami.reg, "01"), SAMI]);
      out["receipt_stranger"] = await call(tx, as(NIDA), submit, [sami.reg, path(sami.reg, "01"), HASH, "0f0f0f0f0f0f0f0f", "TXN-1001"]);
      out["receipt"] = await step(tx, as(SAMI), submit, [sami.reg, path(sami.reg, "01"), HASH, "0f0f0f0f0f0f0f0f", " TXN-1001 "]);
      out["receipt_again"] = await call(tx, as(SAMI), submit, [sami.reg, path(sami.reg, "01"), HASH, "0f0f0f0f0f0f0f0f", "TXN-1001"]);
      // Uploads in one transaction share now(); Sami's is moved back an hour so the review list's order is fixed.
      await tx.unsafe(`update public.event_payments set uploaded_at = now() - interval '1 hour' where event_id = $1 and user_id = $2`, [F.EVENT, SAMI]);
      ok(await reg(NIDA));
      const nida = await ids(NIDA);
      await tx.unsafe(`insert into storage.objects (bucket_id, name, owner) values ('event-receipts', $1, $2)`, [path(nida.reg, "02"), NIDA]);
      ok(await call(tx, as(NIDA), submit, [nida.reg, path(nida.reg, "02"), "b".repeat(64), "0f0f0f0f0f0f0f0e", "txn-1001"]));
      out["waitlisted"] = await step(tx, as(MEHR), REGISTER, [F.EVENT, JSON.stringify({ ticket_type_id: F.TICKET, answers: [] })]);
      out["review_list"] = await call(tx, as(OSMAN), `public.payments_review($1)`, [F.EVENT]);
      out["review_list_student"] = await call(tx, as(SAMI), `public.payments_review($1)`, [F.EVENT]);
      const pay = async (u: string) => ((await tx.unsafe(`select id::text from public.event_payments where event_id = $1 and user_id = $2`, [F.EVENT, u]))[0] as unknown as { id: string }).id;
      const pSami = await pay(SAMI);
      const pNida = await pay(NIDA);
      out["reject_no_reason"] = await call(tx, as(OSMAN), `public.review_payment($1, false, ' ')`, [pNida]);
      out["reject"] = await step(tx, as(OSMAN), `public.review_payment($1, false, $2)`, [pNida, "Amount doesn't match"]);
      out["approve"] = await step(tx, as(OSMAN), `public.review_payment($1, true, null)`, [pSami]);
      out["approve_again"] = await call(tx, as(OSMAN), `public.review_payment($1, true, null)`, [pSami]);
      out["ticket_paid"] = await call(tx, as(SAMI), `public.event_ticket($1)`, [F.EVENT]);
      out["issue_not_review"] = await call(tx, as(SAMI), `public.raise_payment_issue($1)`, [sami.reg]);
      out["cancel_refund"] = await step(tx, as(SAMI), `public.cancel_registration($1)`, [F.EVENT]);
      out["refund_sent"] = await step(tx, as(OSMAN), `public.mark_refund_sent($1, $2)`, [pSami, " Sent by bank transfer "]);
      out["refund_sent_again"] = await call(tx, as(OSMAN), `public.mark_refund_sent($1, null)`, [pSami]);
      out["refund_stranger"] = await call(tx, as(NIDA), `public.confirm_refund($1, true)`, [pSami]);
      out["refund_disputed"] = await step(tx, as(SAMI), `public.confirm_refund($1, false)`, [pSami]);
      await tx.unsafe(`update public.event_payments set refund_answered_at = now() - interval '73 hours' where id = $1`, [pSami]);
      out["dispute_case"] = await job(tx, `select private.event_closeout_payments()`);
      await tx.unsafe(`update public.event_registrations set hold_expires_at = now() - interval '1 minute' where event_id = $1 and user_id = $2`, [F.EVENT, NIDA]);
      out["hold_expired"] = await job(tx, `select private.event_tick()`);
      out["review_after"] = await call(tx, as(PRIYA), `public.payments_review($1)`, [F.EVENT]);
      return out;
    }));

  it("an issue raised and unanswered becomes a case; a cancelled paid event owes refunds", () =>
    check(G, "issues", async (tx) => {
      const out: Row = {};
      await paymentMethod(tx);
      await seedEvent(tx, { capacity: 3, price: 800, required: false, startsIn: "5 days" });
      ok(await call(tx, as(SAMI), REGISTER, [F.EVENT, JSON.stringify({ ticket_type_id: F.TICKET, answers: [] })]));
      ok(await call(tx, as(NIDA), REGISTER, [F.EVENT, JSON.stringify({ ticket_type_id: F.TICKET, answers: [] })]));
      const regOf = async (u: string) => ((await tx.unsafe(`select id::text from public.event_registrations where event_id = $1 and user_id = $2`, [F.EVENT, u]))[0] as unknown as { id: string }).id;
      const sami = await regOf(SAMI);
      const nida = await regOf(NIDA);
      const path = `${F.EVENT}/${sami}/97f00000-0000-4000-8000-000000000011.webp`;
      await tx.unsafe(`insert into storage.objects (bucket_id, name, owner) values ('event-receipts', $1, $2)`, [path, SAMI]);
      ok(await call(tx, as(SAMI), `public.submit_receipt($1, $2, $3, '', null)`, [sami, path, "c".repeat(64)]));
      out["issue"] = await step(tx, as(SAMI), `public.raise_payment_issue($1)`, [sami]);
      out["issue_stranger"] = await call(tx, as(NIDA), `public.raise_payment_issue($1)`, [sami]);
      await tx.unsafe(`update public.event_payments set issue_raised_at = now() - interval '73 hours' where registration_id = $1`, [sami]);
      out["issue_case"] = await job(tx, `select private.event_closeout_payments()`);
      const pNida = ((await tx.unsafe(`select id::text from public.event_payments where registration_id = $1`, [nida]))[0] as unknown as { id: string }).id;
      await tx.unsafe(`update public.event_payments set status = 'approved' where id = $1`, [pNida]);
      await tx.unsafe(`update public.event_registrations set status = 'confirmed', hold_expires_at = null where id = $1`, [nida]);
      out["cancel_event"] = await step(tx, as(PRIYA), `public.cancel_society_event($1, 'Speaker unwell')`, [F.EVENT]);
      out["refund_received"] = await step(tx, as(NIDA), `public.confirm_refund($1, true)`, [pNida]);
      return out;
    }));
});
