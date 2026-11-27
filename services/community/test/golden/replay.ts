/**
 * Replaying the community goldens (packages/testing/test/community.golden.test.ts) against the port. The rules,
 * as the earlier services' replays:
 *
 * 1. The same world (test/fixtures/community-world.ts): people's facts as people publishes them (profile.updated
 *    with the department's hash), community's own rows written as the recorder wrote them. Community's tables
 *    under the recorded names and columns; the stack's ops_audit_log rows for societies are community's
 *    audit_log, and a payment's report case (`has_case`) is its `disputed_at` (the dispute went to trust).
 * 2. Other services' rows the stack's functions wrote (notify's notifications, content's posts, trust's report
 *    cases) are dropped from every `changes`; their effects are community's events, asserted by the contract tests.
 * 3. Refusals through src/refusals.ts (SQLSTATE and wording, values filled; the host university's id is shown by
 *    its name, as web shows it). A signed-out caller's grant refusal on the stack equals the port's refusal for a
 *    caller with no user (compared by code). The staff role and two-factor checks are the handler's: replayed as
 *    the handler makes them.
 * 4. Names are people's: the port's documents carry placeholders filled here from the fixture (as the handler
 *    fills them from ProfileCards); check-in search filters by name as people's FilterByName does, and an address
 *    is resolved as identity's ResolveEmails does. Files are media's: the fixture's uploads are the files media
 *    would have recorded.
 * 5. Values made at random are compared as their type (`typed`, the recorder's own function), and ticket payloads
 *    and check-in codes are made with the port's own key.
 * 6. A list whose stack order has ties is compared as a set: event_manage's registrations are ordered by status,
 *    waitlist position and registered_at, and registrations made in one transaction share now().
 */
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ConnectError } from "@connectrpc/connect";
import { refusalReason } from "@skilient/platform";
import { normalise } from "@skilient/testing";
import { startPostgres, type TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { expect } from "vitest";
import * as F from "../../../../packages/testing/test/fixtures/community-world";
import { fill as fillDoc } from "../../src/domain/people";
import { REFUSALS, refusalText, type RefusalReason } from "../../src/refusals";
import type { ResolvedEmail } from "../../src/store/checkin";
import { applyCopyEvent } from "../../src/store/copies";
import type { Filler, StaffCheck } from "../../src/store/db";
import type { Files } from "../../src/store/societies";
import { tickets as ticketsWith, type Tickets } from "../../src/store/tickets";

export { F };
export type Tx = postgres.TransactionSql;
type Row = Record<string, unknown>;
export const MIGRATIONS = join(import.meta.dirname, "../../migrations");
const DIR = join(import.meta.dirname, "../../../../packages/testing/test/golden/community");

export const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
export const tickets: Tickets = ticketsWith(randomBytes(32));

// ---------------------------------------------------------------------------
// Rule 4: people, files, addresses
// ---------------------------------------------------------------------------
export const fill: Filler = async (doc) =>
  fillDoc(doc, {
    person: (id) =>
      F.NAME[id]
        ? { name: F.NAME[id]!, username: F.USERNAME[id]!, avatar_path: null, department: F.DEPARTMENT_OF[id] ?? F.DEPARTMENT, batch: F.BATCH_OF[id] ?? F.BATCH }
        : undefined,
    university: (id) => F.UNIVERSITIES.find((u) => u.id === id)?.name,
  });

/** Uploads media would have recorded (the recorder's storage.objects rows). */
export const uploads = new Set<string>();
export const files: Files = { exists: async (_bucket, path) => uploads.has(path) };

/** people's FilterByName over the fixture. */
export const byName = async (ids: string[], q: string, limit: number) =>
  ids
    .filter((id) => F.NAME[id] && (F.NAME[id]!.toLowerCase().includes(q.toLowerCase()) || F.USERNAME[id]!.startsWith(q.toLowerCase())))
    .sort((a, b) => F.NAME[a]!.localeCompare(F.NAME[b]!))
    .slice(0, limit);

/** identity's ResolveEmails over the fixture. */
export const resolveEmail = async (email: string): Promise<ResolvedEmail> => {
  const user = Object.entries(F.EMAIL).find(([, e]) => e === email)?.[0] ?? null;
  const domain = email.split("@")[1];
  return { user_id: user, university_ids: F.UNIVERSITIES.filter((u) => u.domain === domain).map((u) => u.id) };
};

/** people's ResolveUsernames over the fixture (case and spaces as people's normaliser takes them). */
export const resolve = (name: string) => Object.entries(F.USERNAME).find(([, u]) => u === name.trim().toLowerCase())?.[0] ?? null;

/** Trust reviewers (the fixture's Tariq) with two-factor; the handler's check. */
export const staffOf =
  (user: string, aal: "aal1" | "aal2" = "aal1"): StaffCheck =>
  async () =>
    user === F.TARIQ && aal === "aal2";

// ---------------------------------------------------------------------------
// Rule 1: the world
// ---------------------------------------------------------------------------
const pe = (user: string) => ({
  type: "profile.updated",
  producer: "svc_people",
  version: 1,
  subjects: [user],
  payload: {
    user_id: user,
    role: "student",
    university_id: F.UNI_OF[user],
    department_hash: sha(F.DEPARTMENT_OF[user] ?? F.DEPARTMENT),
    graduation_year: F.BATCH_OF[user] ?? F.BATCH,
    status: F.GRADUATES.includes(user) ? "graduate" : "active",
    onboarding_complete: true,
  },
});

export async function seed(tx: Tx): Promise<void> {
  uploads.clear();
  for (const u of F.USERS) expect(await applyCopyEvent(tx, pe(u))).toBe("applied");
  await tx`
    insert into community.societies (id, university_id, slug, name, name_key, category, about, status, created_by, verified_at, created_at, updated_at)
    values (${F.SOC}, ${F.UNI_A}, ${F.SOC_SLUG}, ${F.SOC_NAME}, ${F.SOC_KEY}, 'technology', ${F.SOC_ABOUT}, 'verified', ${F.PRIYA},
            now() - interval '10 days', now() - interval '12 days', now() - interval '10 days')`;
  await tx`
    insert into community.society_members (society_id, user_id, role, title, joined_at) values
      (${F.SOC}, ${F.PRIYA}, 'president', 'President', now() - interval '10 days'), (${F.SOC}, ${F.OSMAN}, 'officer', 'General Secretary', now() - interval '9 days'),
      (${F.SOC}, ${F.MEHR}, 'member', null, now() - interval '8 days')`;
  await tx`
    insert into community.society_terms (id, society_id, user_id, role, title, term_start, term_end, created_at) values
      (gen_random_uuid(), ${F.SOC}, ${F.PRIYA}, 'president', 'President', current_date - 10, current_date + 355, now() - interval '10 days'),
      (gen_random_uuid(), ${F.SOC}, ${F.OSMAN}, 'officer', 'General Secretary', current_date - 9, current_date + 100, now() - interval '9 days')`;
  await tx`
    insert into community.society_follows (society_id, user_id, created_at)
    select ${F.SOC}, u, now() - interval '8 days' from unnest(${[F.PRIYA, F.OSMAN, F.MEHR]}::uuid[]) u`;
  uploads.add(F.PROOF);
  await tx`
    insert into community.societies (id, university_id, slug, name, name_key, category, about, created_by, created_at, updated_at)
    values (${F.PENDING}, ${F.UNI_A}, ${F.PENDING_SLUG}, ${F.PENDING_NAME}, ${F.PENDING_KEY}, 'debating', ${F.PENDING_ABOUT}, ${F.NIDA},
            now() - interval '1 day', now() - interval '1 day')`;
  await tx`
    insert into community.society_requests (id, society_id, requester_id, proof_path, office_bearer, created_at, updated_at)
    values (gen_random_uuid(), ${F.PENDING}, ${F.NIDA}, ${F.PROOF}, true, now() - interval '1 day', now() - interval '1 day')`;
  uploads.add(F.LOGO);
  uploads.add(F.COVER);
}

/** A second verified society (Sami presides), for co-hosting. */
export async function cohostSociety(tx: Tx): Promise<void> {
  await tx`
    insert into community.societies (id, university_id, slug, name, name_key, category, about, status, created_by, verified_at, created_at)
    values (${F.COHOST}, ${F.UNI_A}, ${F.COHOST_SLUG}, ${F.COHOST_NAME}, 'wren coders', 'technology', 'We write code together every Friday evening.', 'verified', ${F.SAMI},
            now() - interval '5 days', now() - interval '6 days')`;
  await tx`insert into community.society_members (society_id, user_id, role, title) values (${F.COHOST}, ${F.SAMI}, 'president', 'President')`;
}

/** SOC's published event, as the recorder's seedEvent wrote it. */
export async function seedEvent(tx: Tx, o: { capacity?: number; price?: number | null; startsIn?: string; hours?: number; required?: boolean; extra?: string } = {}): Promise<void> {
  const starts = `now() + interval '${o.startsIn ?? "2 days"}'`;
  const ends = `${starts} + interval '${o.hours ?? 2} hours'`;
  await tx.unsafe(
    `insert into community.events (id, university_id, society_id, created_by, type, scope, title, description, starts_at, ends_at, location, status, published_at, created_at)
     values ($1, $2, $3, $4, 'workshop', 'university', $5, 'Bring nothing; we have irons.', ${starts}, ${ends}, 'Lab 2, Block C', 'published', now() - interval '1 day', now() - interval '2 days')`,
    [F.EVENT, F.UNI_A, F.SOC, F.PRIYA, F.EVENT_TITLE],
  );
  if (o.extra) await tx.unsafe(`update community.events set ${o.extra} where id = $1`, [F.EVENT]);
  await tx`insert into community.event_secrets (event_id, sealed) values (${F.EVENT}, ${tickets.seal(F.EVENT)})`;
  await tx.unsafe(`insert into community.event_sessions (id, event_id, position, starts_at, ends_at) values ($1, $2, 1, ${starts}, ${ends})`, [F.SESSION, F.EVENT]);
  await tx`insert into community.event_ticket_types (id, event_id, position, name, capacity, price_pkr) values (${F.TICKET}, ${F.EVENT}, 1, 'Seat', ${o.capacity ?? 2}, ${o.price ?? null})`;
  if (o.required !== false) await tx`insert into community.event_questions (event_id, position, label, kind, required) values (${F.EVENT}, 1, ${F.QUESTION}, 'short', true)`;
}

export async function endEvent(tx: Tx, hoursAgo = 1, hours = 2): Promise<void> {
  await tx`
    update community.events set starts_at = now() - make_interval(hours => ${hoursAgo + hours}), ends_at = now() - make_interval(hours => ${hoursAgo}), status = 'ended'
     where id = ${F.EVENT}`;
  await tx`
    update community.event_sessions set starts_at = now() - make_interval(hours => ${hoursAgo + hours}), ends_at = now() - make_interval(hours => ${hoursAgo}) where event_id = ${F.EVENT}`;
}

export async function paymentMethod(tx: Tx): Promise<void> {
  await tx`
    insert into community.society_payment_methods (id, society_id, action, kind, bank_name, account_title, account_number, status, proposed_by, confirmed_by, confirmed_at, effective_at)
    values (gen_random_uuid(), ${F.SOC}, 'add', 'bank', 'Wren Bank', 'Wren Robotics Society', 'PK00WREN0000001234567890', 'active', ${F.PRIYA}, ${F.OSMAN},
            now() - interval '1 day', now() - interval '1 day')`;
}

// ---------------------------------------------------------------------------
// Rule 1: community's tables under the recorded names
// ---------------------------------------------------------------------------
const SOC_OF = `(select s.name from community.societies s where s.id = x.society_id)`;
const EV_OF = `(select e.title from community.events e where e.id = x.event_id)`;
const OURS = `(select id from community.societies where university_id = any($2))`;
const OUR_EVENTS = `(select id from community.events where society_id in ${OURS})`;
const ROUND_OF = `(select r.title from community.induction_rounds r where r.id = x.round_id)`;
export const RENAMED: Record<string, string> = {
  "public.societies": `select x.name, x.slug, x.name_key, x.university_id, x.category, x.about, x.logo_path, x.cover_path, x.status, x.status_reason,
            x.membership_mode, x.paid_paused, x.created_by, x.verified_by, x.verified_at is not null as verified from community.societies x where $1::uuid[] is not null and x.university_id = any($2) order by 1`,
  "public.society_requests": `select ${SOC_OF} as society, x.requester_id, x.proof_path, x.proof_url, x.status, x.staff_note, x.claimed_by, x.decided_at is not null as decided
       from community.society_requests x where $1::uuid[] is not null and x.society_id in ${OURS} order by 1, 2`,
  "public.society_members": `select ${SOC_OF} as society, x.user_id, x.role, x.title, x.team_title from community.society_members x where $1::uuid[] is not null and x.society_id in ${OURS} order by 1, 2`,
  "public.society_terms": `select ${SOC_OF} as society, x.user_id, x.role, x.title, x.term_start::text, x.term_end::text, x.ended_at is not null as ended,
            x.confirmed_by, x.ended_notified_at is not null as notified from community.society_terms x where $1::uuid[] is not null and x.society_id in ${OURS} order by 1, 2, 5`,
  "public.society_invites": `select ${SOC_OF} as society, x.kind, x.invitee_id, x.invited_by, x.title, x.term_start::text, x.term_end::text, x.status
       from community.society_invites x where $1::uuid[] is not null and x.society_id in ${OURS} order by 1, 2, 3, 8`,
  "public.society_join_requests": `select ${SOC_OF} as society, x.user_id from community.society_join_requests x where $1::uuid[] is not null and x.society_id in ${OURS} order by 1, 2`,
  "public.society_follows": `select ${SOC_OF} as society, x.user_id from community.society_follows x where $1::uuid[] is not null and x.society_id in ${OURS} order by 1, 2`,
  "public.induction_rounds": `select ${SOC_OF} as society, x.title, x.description, x.status, x.created_by, x.published_at is not null as published,
            x.undecided_closed_at is not null as undecided_closed from community.induction_rounds x where $1::uuid[] is not null and x.society_id in ${OURS} order by 1, 2`,
  "public.induction_roles": `select ${ROUND_OF} as round, x.title, x.seats, x.filled, x.skill_ids, x.position from community.induction_roles x
      where $1::uuid[] is not null and x.round_id in (select id from community.induction_rounds where society_id in ${OURS}) order by 1, 6`,
  "public.induction_questions": `select ${ROUND_OF} as round, x.position, x.body from community.induction_questions x
      where $1::uuid[] is not null and x.round_id in (select id from community.induction_rounds where society_id in ${OURS}) order by 1, 2`,
  "public.induction_applications": `select ${ROUND_OF} as round, (select r.title from community.induction_roles r where r.id = x.role_id) as role, x.applicant_id, x.answers,
            x.status, x.note, x.decided_by from community.induction_applications x where $1::uuid[] is not null and x.round_id in (select id from community.induction_rounds where society_id in ${OURS}) order by 1, 3`,
  "public.events": `select x.title, ${SOC_OF} as society, x.university_id, x.created_by, x.type, x.scope, x.description, x.location, x.link, x.status,
            x.record_kinds, x.completed_min, x.volunteer_hours, x.team_min, x.team_max, x.approval_mode, x.eligibility, x.cover_path, x.refund_policy,
            x.refund_days, x.post_id is not null as has_post, x.published_at is not null as published, x.cancel_reason, x.cancelled_at is not null as cancelled
       from community.events x where $1::uuid[] is not null and x.society_id in ${OURS} order by 1`,
  "public.event_sessions": `select ${EV_OF} as event, x.position, x.title from community.event_sessions x where $1::uuid[] is not null and x.event_id in ${OUR_EVENTS} order by 1, 2`,
  "public.event_ticket_types": `select ${EV_OF} as event, x.position, x.name, x.capacity, x.price_pkr from community.event_ticket_types x where $1::uuid[] is not null and x.event_id in ${OUR_EVENTS} order by 1, 2`,
  "public.event_questions": `select ${EV_OF} as event, x.position, x.label, x.kind, x.options, x.required from community.event_questions x where $1::uuid[] is not null and x.event_id in ${OUR_EVENTS} order by 1, 2`,
  "public.event_cohosts": `select ${EV_OF} as event, ${SOC_OF} as society, x.status from community.event_cohosts x where $1::uuid[] is not null and x.event_id in ${OUR_EVENTS} order by 1, 2`,
  "public.event_teams": `select ${EV_OF} as event, x.name, x.captain_id from community.event_teams x where $1::uuid[] is not null and x.event_id in ${OUR_EVENTS} order by 1, 2`,
  "public.event_registrations": `select ${EV_OF} as event, x.user_id, x.status, x.waitlist_position, x.answers, (select t.name from community.event_teams t where t.id = x.team_id) as team,
            x.added_by, x.hold_expires_at is not null as held_until, x.cancelled_at is not null as cancelled, x.checked_in_at is not null as checked_in,
            x.reminded_at is not null as reminded, x.reminded_1h_at is not null as reminded_1h
       from community.event_registrations x where $1::uuid[] is not null and x.event_id in ${OUR_EVENTS} order by 1, 2`,
  "public.event_staff": `select ${EV_OF} as event, x.user_id, x.added_by from community.event_staff x where $1::uuid[] is not null and x.event_id in ${OUR_EVENTS} order by 1, 2`,
  "public.event_email_attendees": `select ${EV_OF} as event, x.email, x.added_by, x.claimed_by from community.event_email_attendees x where $1::uuid[] is not null and x.event_id in ${OUR_EVENTS} order by 1, 2`,
  "public.event_checkins": `select ${EV_OF} as event, (select s.position from community.event_sessions s where s.id = x.session_id) as session, x.user_id,
            (select a.email from community.event_email_attendees a where a.id = x.email_attendee_id) as email, x.method, x.checked_in_by, x.reason,
            x.removed_at is not null as removed, x.removed_by, x.removed_reason from community.event_checkins x where $1::uuid[] is not null and x.event_id in ${OUR_EVENTS} order by 1, 2, 3, 4`,
  "public.event_results": `select ${EV_OF} as event, x.user_id, (select t.name from community.event_teams t where t.id = x.team_id) as team, x.place, x.label, x.set_by
       from community.event_results x where $1::uuid[] is not null and x.event_id in ${OUR_EVENTS} order by 1, 4`,
  "public.volunteer_logs": `select ${EV_OF} as event, x.user_id, x.hours, x.logged_by from community.volunteer_logs x where $1::uuid[] is not null and x.event_id in ${OUR_EVENTS} order by 1, 2`,
  "public.event_issuances": `select ${EV_OF} as event, x.preview, x.status, x.auto, x.issued_by from community.event_issuances x where $1::uuid[] is not null and x.event_id in ${OUR_EVENTS} order by 1`,
  "public.event_feedback": `select ${EV_OF} as event, x.user_id, x.rating, x.comment from community.event_feedback x where $1::uuid[] is not null and x.event_id in ${OUR_EVENTS} order by 1, 2`,
  "public.event_messages": `select ${EV_OF} as event, x.sender_id, x.body from community.event_messages x where $1::uuid[] is not null and x.event_id in ${OUR_EVENTS} order by 1, 3`,
  "public.society_payment_methods": `select ${SOC_OF} as society, x.action, x.kind, x.bank_name, x.account_title, x.account_number, x.status, x.proposed_by, x.confirmed_by,
            x.replaces_id is not null as replaces from community.society_payment_methods x where $1::uuid[] is not null and x.society_id in ${OURS} order by 1, 6, 7`,
  "public.society_audit_log": `select ${SOC_OF} as society, x.actor_id, x.action from community.society_audit_log x where $1::uuid[] is not null and x.society_id in ${OURS} order by 1, 3, 2`,
  "public.event_payments": `select ${EV_OF} as event, x.user_id, x.amount_pkr, x.receipt_path, x.receipt_hash, x.receipt_phash, x.transaction_id, x.status, x.reject_reason,
            x.decided_by, x.issue_raised_at is not null as issue_raised, x.refund_status, x.refund_note, x.disputed_at is not null as has_case,
            x.receipt_deleted_at is not null as receipt_deleted from community.event_payments x where $1::uuid[] is not null and x.event_id in ${OUR_EVENTS} order by 1, 2`,
  "public.ops_audit_log": `select staff_id, action, target_type, reason, before, after from community.audit_log x where $1::uuid[] is not null and x.target_type = 'society'
      and x.target_id in (select id::text from community.societies where university_id = any($2)) order by 2, 1`,
};
export const FOREIGN = new Set(["public.notifications", "public.posts", "public.report_cases"]);

export async function snapshot(tx: Tx): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const [table, text] of Object.entries(RENAMED)) out[table] = (await tx.unsafe(text, [F.USERS, F.UNIS] as never[])).map((r) => JSON.stringify(r));
  return out;
}

export function changes(before: Record<string, string[]>, after: Record<string, string[]>) {
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

// ---------------------------------------------------------------------------
// Rule 3: outcomes
// ---------------------------------------------------------------------------
export type Outcome = { ok: true; value: unknown } | { ok: false; code: string; message: string };

const uniName = (v: string | number) => (typeof v === "string" ? (F.UNIVERSITIES.find((u) => u.id === v)?.name ?? v) : v);

/** Pass `fn` only for a signed-out caller. */
export async function outcome(run: () => unknown, fn?: string): Promise<Outcome> {
  try {
    return { ok: true, value: (await run()) ?? null };
  } catch (error) {
    if (error instanceof ConnectError) {
      if (fn) return { ok: false, code: "42501", message: `permission denied for function ${fn}` };
      const reason = refusalReason(error) as RefusalReason | null;
      const r = reason ? REFUSALS[reason] : undefined;
      if (!r) throw error;
      const values = JSON.parse(error.metadata.get("x-refusal-values") ?? "[]") as (string | number)[];
      return { ok: false, code: r.sqlstate, message: refusalText(reason!, values.map(uniName)) };
    }
    const e = error as { code?: unknown; message?: unknown; name?: unknown };
    if (e.name === "PostgresError" && typeof e.code === "string") return { ok: false, code: e.code, message: String(e.message) };
    throw error;
  }
}

export const call = (tx: Tx, run: (sp: Tx) => unknown, fn?: string): Promise<Outcome> => outcome(() => tx.savepoint((sp) => Promise.resolve(run(sp))), fn);

export async function step(tx: Tx, run: (sp: Tx) => unknown, fn?: string) {
  const before = await snapshot(tx);
  const result = await call(tx, run, fn);
  return { result, changes: changes(before, await snapshot(tx)) };
}

export async function job(tx: Tx, run: (sp: Tx) => Promise<unknown>) {
  const before = await snapshot(tx);
  await tx.savepoint((sp) => run(sp));
  return { changes: changes(before, await snapshot(tx)) };
}

export function ok(o: Outcome): Row & string {
  if (!o.ok) throw new Error(`expected success: ${o.code} ${o.message}`);
  return o.value as Row & string;
}
export const okStep = (s: { result: Outcome }) => ok(s.result);

export async function startWorld(): Promise<{ pg: TestDatabase; sql: postgres.Sql }> {
  if (process.env["GOLDEN_RECORD"] === "1") throw new Error("golden replays never record; unset GOLDEN_RECORD");
  const pg = await startPostgres();
  const sql = await pg.service("community", MIGRATIONS);
  return { pg, sql };
}

/** Rule 2: drops foreign tables from every `changes` (and an empty `changes` stays empty). */
export function dropForeign(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(dropForeign);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Row).map(([k, v]) =>
        k === "changes" && v && typeof v === "object" ? [k, Object.fromEntries(Object.entries(v as Row).filter(([t]) => !FOREIGN.has(t)))] : [k, dropForeign(v)],
      ),
    );
  return value;
}

export function renumber(value: unknown): unknown {
  const ids = new Map<string, string>();
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return v.replace(/<uuid:\d+>/g, (m) => (ids.has(m) ? ids.get(m)! : (ids.set(m, `<uuid:${ids.size + 1}>`), ids.get(m)!)));
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Row).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value);
}

/** Rule 6: a manage page's registrations (ties on registered_at) sorted by name, then status. */
function asSets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(asSets);
  if (value && typeof value === "object") {
    const o = value as Row;
    if (Array.isArray(o["registrations"]) && "stats" in o)
      return { ...o, registrations: [...(o["registrations"] as Row[])].sort((a, b) => `${String(a["status"])}|${String(a["name"])}`.localeCompare(`${String(b["status"])}|${String(b["name"])}`)) };
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, asSets(v)]));
  }
  return value;
}

/** Runs one case in a rolled-back transaction on the seeded world and compares it with the recording. */
export async function replay(sql: postgres.Sql, group: string, name: string, run: (tx: Tx) => Promise<unknown>): Promise<void> {
  let value: unknown;
  await sql
    .begin(async (tx) => {
      await seed(tx);
      value = await run(tx);
      throw new Error("rollback");
    })
    .catch((e: unknown) => {
      if (!(e instanceof Error) || e.message !== "rollback") throw e;
    });
  const recorded = JSON.parse(readFileSync(join(DIR, `${group}.json`), "utf8")) as Row;
  if (!(name in recorded)) throw new Error(`no golden case ${group}/${name}`);
  const actual = renumber(dropForeign(asSets(normalise(F.typed(value)))));
  const expected = renumber(dropForeign(asSets(recorded[name])));
  if (process.env["GOLDEN_DIFF_DIR"] && JSON.stringify(actual) !== JSON.stringify(expected))
    writeFileSync(join(process.env["GOLDEN_DIFF_DIR"], `${group}-${name}.json`), JSON.stringify({ actual, expected }));
  expect(actual).toEqual(expected);
}
