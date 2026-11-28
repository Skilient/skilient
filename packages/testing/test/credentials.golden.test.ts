/**
 * Credentials golden recordings (W8). Records what the current stack (local Supabase) returns for the ported CV
 * and Record functions, so the W8 service can be held to the same results. The sheet is
 * docs/azure/credentials-function-bins.md; the world is test/fixtures/credentials-world.ts.
 *
 *   GOLDEN_STACK_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres GOLDEN_RECORD=1 pnpm exec vitest run test/credentials.golden.test.ts
 *
 * Without GOLDEN_RECORD it compares the stack with the files. Without GOLDEN_STACK_DB_URL the file is skipped.
 * Every case runs in its own transaction that is rolled back; now() is fixed inside it. The cv-sign Edge
 * Function's part (sign a prepared snapshot or entry, then commit) is done here with the web's own signing code
 * and a key this test makes and installs inside the transaction (private.cv_install_key), so no key outlives the
 * case. Values made at random or from the clock are recorded as their type (`typed`): codes, signatures, hashes,
 * key ids, dates. Every step that depends on an earlier one checks the earlier one worked (`ok`), so no step is
 * recorded without reaching the stack. One case (verify.json#stack_signed) keeps the signed values themselves:
 * the CV and the Record entry the stack signed, with the public key that checks them, for the W8 done-when.
 */
import { createHmac } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type postgres from "postgres";
import { describe, expect, it } from "vitest";
import { checkRecordEnvelope, recordEnvelopeOf, signRecordEnvelope, type RecordEnvelope } from "../../../apps/web/supabase/functions/_shared/cv/record.ts";
import {
  checkEnvelope,
  envelopeOf,
  generateSigningKey,
  isoSeconds,
  newCode,
  signEnvelope,
  type CvEnvelope,
} from "../../../apps/web/supabase/functions/_shared/cv/sign.ts";
import { actAs, assertLocalStack, attempt, callCurrentStackSql, golden, type SqlOutcome, type StackActor } from "../src/golden";
import * as F from "./fixtures/credentials-world";
import { typed } from "./fixtures/credentials-world";

const DB = process.env["GOLDEN_STACK_DB_URL"];
if (DB !== undefined) assertLocalStack(DB);
const DIR = join(import.meta.dirname, "golden", "credentials");

const { PRIYA, OSMAN, MEHR, SAMI, NIDA, TARIQ, ZARA } = F;
const OWNER: StackActor = { role: "postgres" };
const ANON: StackActor = { role: "anon", claims: { role: "anon" } };
function as(user: string, aal: "aal1" | "aal2" = "aal1"): StackActor {
  return { role: "authenticated", claims: { sub: user, role: "authenticated", aal, email: F.EMAIL[user] } };
}

type Tx = postgres.TransactionSql;
type Row = Record<string, unknown>;
/** verify/signed.json#stack_signed: what the stack signed, kept as values. */
export interface StackSigned {
  cv: Row;
  entry: Row;
  keys: { key_id: string; alg: string; public_key: string; active_from: string; retired_at: string | null }[];
  envelopes: { cv: CvEnvelope; entry: RecordEnvelope };
}

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

async function onboard(tx: Tx, id: string): Promise<void> {
  await tx.unsafe(
    `update public.profiles set username = $2, department = $3, graduation_year = $4, onboarding_complete = true where user_id = $1`,
    [id, F.USERNAME[id]!, F.DEPARTMENT, F.BATCH],
  );
  await tx.unsafe(`update public.onboarding_state set step = 6, completed_at = now() where user_id = $1`, [id]);
}

async function seed(tx: Tx): Promise<void> {
  for (const u of F.UNIVERSITIES)
    await tx.unsafe(`insert into public.universities (id, name, slug, live_at) values ($1, $2, $3, now() - interval '1 day')`, [u.id, u.name, u.slug]);
  for (const u of F.UNIVERSITIES)
    await tx.unsafe(`insert into public.university_domains (university_id, domain, kind, source) values ($1, $2, 'both', 'ops')`, [u.id, u.domain]);
  for (const id of F.USERS) await insertUser(tx, id);
  for (const id of F.USERS) await onboard(tx, id);
  await tx.unsafe(`insert into public.staff_roles (user_id, role) values ($1, 'trust_reviewer')`, [TARIQ]);
  await tx.unsafe(
    `insert into public.societies (id, university_id, slug, name, name_key, category, about, status, created_by, verified_at, created_at, updated_at)
     values ($1, $2, $3, $4, $5, 'technology', 'We look up at night and write down what we see.', 'verified', $6, now() - interval '40 days', now() - interval '41 days', now() - interval '40 days')`,
    [F.SOC, F.UNI_A, F.SOC_SLUG, F.SOC_NAME, F.SOC_KEY, PRIYA],
  );
  await tx.unsafe(
    `insert into public.societies (id, university_id, slug, name, name_key, category, about, created_by, created_at, updated_at)
     values ($1, $2, $3, $4, $5, 'debating', 'Weekly chess at the library and a ladder for every level.', $6, now() - interval '3 days', now() - interval '3 days')`,
    [F.PENDING, F.UNI_A, F.PENDING_SLUG, F.PENDING_NAME, F.PENDING_KEY, NIDA],
  );
  await tx.unsafe(
    `insert into public.society_members (society_id, user_id, role, title, joined_at) values
       ($1, $2, 'president', 'President', now() - interval '40 days'), ($1, $3, 'officer', 'General Secretary', now() - interval '39 days'),
       ($1, $4, 'member', null, now() - interval '38 days')`,
    [F.SOC, PRIYA, OSMAN, MEHR],
  );
  await tx.unsafe(`insert into public.society_members (society_id, user_id, role, title) values ($1, $2, 'president', 'President')`, [F.PENDING, NIDA]);
  await tx.unsafe(
    `insert into public.society_terms (id, society_id, user_id, role, title, term_start, term_end, created_at) values
       ($1, $3, $4, 'president', $6, current_date - 400, current_date - 35, now() - interval '400 days'),
       ($2, $3, $5, 'officer', $7, current_date - 300, current_date - 30, now() - interval '300 days')`,
    [F.TERM_PRIYA, F.TERM_OSMAN, F.SOC, PRIYA, OSMAN, F.TERM_TITLE_PRIYA, F.TERM_TITLE_OSMAN],
  );
  // Sami's work: one L2 skill, a completed venture (no membership row, so it is not a project on the CV), a tier.
  await tx.unsafe(
    `insert into public.user_skills (user_id, skill_id, level, repos, active_days) values ($1, $2, 2, $3, $4)`,
    [SAMI, F.SKILL_ID, F.SKILL_REPOS, F.SKILL_DAYS],
  );
  await tx.unsafe(
    `insert into public.ranking_scores (user_id, formula_version, components, proof, momentum, adjustments, total, ranked, tier, percentile, computed_at, published_at)
     values ($1, 2, '{}', 0, 0, 0, 120, true, $2, $3, now() - interval '1 day', now() - interval '1 day')`,
    [SAMI, F.TIER, F.PERCENTILE],
  );
}

/** Installs a key this test made (private half into the stack's Vault, inside the rolled-back transaction). */
async function installKey(tx: Tx): Promise<{ keyId: string; publicKey: string; privateKey: string }> {
  const k = await generateSigningKey();
  await tx.unsafe(`select private.cv_install_key($1, $2, $3)`, [k.keyId, k.publicKey, k.privateKey]);
  return k;
}

/** The cv-sign Edge Function's issueCv, over this transaction: prepare, sign, commit (five tries on a code clash). */
async function issueCv(tx: Tx, user: string, source: "first" | "monthly" | "on_demand" | "reissue"): Promise<Row> {
  const prepare = source === "reissue" ? "private.cv_reissue_prepare" : "private.cv_issue_prepare";
  const [prep] = (await tx.unsafe(`select snapshot, content_hash, latest_content_hash, issued_at, expires_at from ${prepare}($1)`, [user])) as unknown as {
    snapshot: Row;
    content_hash: string;
    latest_content_hash: string | null;
    issued_at: string;
    expires_at: string;
  }[];
  if (!prep) return { status: source === "reissue" ? "nothing_to_reissue" : "not_eligible" };
  if (source === "monthly" && prep.content_hash === prep.latest_content_hash) return { status: "unchanged", snapshot: prep.snapshot };
  const [key] = (await tx.unsafe(`select key_id, private_key from private.cv_active_key()`)) as unknown as { key_id: string; private_key: string }[];
  const envelope: CvEnvelope = { v: 1, code: newCode(), key_id: key!.key_id, issued_at: isoSeconds(prep.issued_at), expires_at: isoSeconds(prep.expires_at), snapshot: prep.snapshot };
  const { hash, signature } = await signEnvelope(envelope, key!.private_key);
  const out = await attempt(tx, async (sp) => {
    const [row] = (await sp.unsafe(
      `select private.cv_issue_commit($1, $2, $3, $4::timestamptz, $5::timestamptz, $6::jsonb, $7, $8, $9, $10) as id`,
      [user, envelope.code, key!.key_id, envelope.issued_at, envelope.expires_at, prep.snapshot as never, prep.content_hash, hash, signature, source],
    )) as unknown as { id: string | null }[];
    return row!.id;
  });
  if (!out.ok) return { status: "refused", code: out.code, message: out.message };
  return { status: out.value ? "issued" : source === "first" ? "exists" : "unchanged", snapshot: prep.snapshot, code: out.value ? envelope.code : null };
}

/** The cv-sign record_drain: seals every pending entry (prepare, sign, commit). Returns the payloads it signed. */
async function sealPending(tx: Tx): Promise<Row[]> {
  const pending = (await tx.unsafe(
    `select e.id::text from public.record_entries e where e.status = 'pending' and (e.user_id = any($1) or e.issuer_id = any($2)) order by e.kind, e.title, e.user_id`,
    [F.ALL_USERS, [F.SOC, F.PENDING]],
  )) as unknown as { id: string }[];
  const [key] = (await tx.unsafe(`select key_id, private_key from private.cv_active_key()`)) as unknown as { key_id: string; private_key: string }[];
  const out: Row[] = [];
  for (const { id } of pending) {
    const [prep] = (await tx.unsafe(`select payload, issued_at from private.record_sign_prepare($1::uuid)`, [id])) as unknown as { payload: Row; issued_at: string }[];
    if (!prep) continue;
    const envelope = { v: 1 as const, type: "record_entry" as const, code: newCode(), key_id: key!.key_id, issued_at: isoSeconds(prep.issued_at), entry: prep.payload };
    const { hash, signature } = await signRecordEnvelope(envelope, key!.private_key);
    await tx.unsafe(`select private.record_sign_commit($1::uuid, $2, $3, $4::timestamptz, $5::jsonb, $6, $7)`, [
      id,
      envelope.code,
      key!.key_id,
      envelope.issued_at,
      prep.payload as never,
      hash,
      signature,
    ]);
    out.push(prep.payload);
  }
  return out;
}

/** SOC's ended event (two sessions, ended two days ago), with check-ins, a walk-in, results and volunteer hours. */
async function seedEvent(tx: Tx): Promise<void> {
  await tx.unsafe(
    `insert into public.events (id, university_id, society_id, created_by, type, scope, title, description, starts_at, ends_at, location, status, published_at, created_at,
                                record_kinds, volunteer_hours)
     values ($1, $2, $3, $4, 'workshop', 'university', $5, 'Bring a notebook.', now() - interval '3 days', now() - interval '2 days', 'Roof deck', 'ended',
             now() - interval '9 days', now() - interval '10 days', array['attended', 'completed', 'result'], true)`,
    [F.EVENT, F.UNI_A, F.SOC, PRIYA, F.EVENT_TITLE],
  );
  await tx.unsafe(`insert into private.event_secrets (event_id) values ($1)`, [F.EVENT]);
  await tx.unsafe(
    `insert into public.event_sessions (id, event_id, position, starts_at, ends_at) values
       ($1, $3, 1, now() - interval '3 days', now() - interval '3 days' + interval '2 hours'),
       ($2, $3, 2, now() - interval '2 days' - interval '2 hours', now() - interval '2 days')`,
    [F.SESSION_1, F.SESSION_2, F.EVENT],
  );
  const checkin = (session: string, user: string | null, method: string, by: string, attendee: string | null = null, minutes = 0) =>
    tx.unsafe(
      `insert into public.event_checkins (event_id, session_id, user_id, email_attendee_id, method, checked_in_by, checked_in_at)
       values ($1, $2, $3, $4, $5, $6, (select starts_at from public.event_sessions where id = $2) + make_interval(mins => $7::int))`,
      [F.EVENT, session, user, attendee, method, by, minutes],
    );
  await checkin(F.SESSION_1, SAMI, "scan", OSMAN, null, 5);
  await checkin(F.SESSION_2, SAMI, "scan", OSMAN, null, 3);
  await checkin(F.SESSION_1, MEHR, "manual", MEHR, null, 10);
  await checkin(F.SESSION_1, OSMAN, "search", PRIYA, null, 1);
  await tx.unsafe(`insert into public.event_email_attendees (id, event_id, email, added_by) values ($1, $2, $3, $4)`, [F.WALK_IN, F.EVENT, F.EMAIL[ZARA]!, OSMAN]);
  await checkin(F.SESSION_1, null, "email", OSMAN, F.WALK_IN, 20);
  await tx.unsafe(`insert into public.event_results (event_id, user_id, place, label, set_by) values ($1, $2, 1, $4, $5), ($1, $3, 2, null, $5)`, [
    F.EVENT,
    SAMI,
    MEHR,
    F.RESULT_LABEL,
    OSMAN,
  ]);
  await tx.unsafe(`insert into public.volunteer_logs (event_id, user_id, hours, logged_by) values ($1, $2, 3.5, $3)`, [F.EVENT, MEHR, OSMAN]);
  // PENDING's event (an unverified society issues nothing).
  await tx.unsafe(
    `insert into public.events (id, university_id, society_id, created_by, type, scope, title, starts_at, ends_at, status, record_kinds, location)
     values ($1, $2, $3, $4, 'social', 'university', 'Blitz night', now() - interval '3 days', now() - interval '2 days', 'ended', array['attended'], 'Library')`,
    [F.EVENT_PENDING, F.UNI_A, F.PENDING, NIDA],
  );
  await tx.unsafe(`insert into private.event_secrets (event_id) values ($1)`, [F.EVENT_PENDING]);
  await tx.unsafe(`insert into public.event_sessions (id, event_id, position, starts_at, ends_at) values ($1, $2, 1, now() - interval '3 days', now() - interval '2 days')`, [
    F.SESSION_PENDING,
    F.EVENT_PENDING,
  ]);
  await tx.unsafe(`insert into public.event_checkins (event_id, session_id, user_id, method, checked_in_by) values ($1, $2, $3, 'scan', $4)`, [
    F.EVENT_PENDING,
    F.SESSION_PENDING,
    SAMI,
    NIDA,
  ]);
}

/** Issues SOC's close-out as Osman (the stack's trigger on event_issuances makes the entries). */
const ISSUE = `insert into public.event_issuances (event_id, preview, issued_by) select $1::uuid, private.event_issue_preview($1::uuid), $2::uuid`;

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

/** A set-returning function: every row. */
async function rows(tx: Tx, actor: StackActor, expr: string, params: unknown[] = []): Promise<SqlOutcome<unknown>> {
  const out = await attempt(tx, async (sp) => {
    await actAs(sp, actor);
    return [...(await sp.unsafe(`select * from ${expr}`, params as never[]))];
  });
  await actAs(tx, OWNER);
  return out;
}

const NAME_OF = (col: string) => `(select p.full_name from public.profiles p where p.user_id = x.${col})`;
/** Credentials' tables (and the foreign rows its writes reach: notify's notifications, community's society audit log rows for the Record). */
export const SNAPSHOTS: Record<string, string> = {
  "public.cv_settings": `select ${NAME_OF("user_id")} as who, x.sections, x.show_percentile, x.show_email, x.visibility::text, cardinality(x.record_entries) as entries
       from public.cv_settings x where x.user_id = any($1) order by 1`,
  "public.cv_records": `select ${NAME_OF("user_id")} as who, x.version, x.source, x.template, x.snapshot is not null as has_snapshot, x.superseded_by is not null as superseded,
            x.revoked_reason, ${NAME_OF("revoked_by")} as revoked_by from public.cv_records x where x.user_id = any($1) order by 1, 2`,
  "public.cv_share_links": `select ${NAME_OF("user_id")} as who, x.token_hash, x.label, x.expires_at is not null as expires, x.revoked_reason, x.view_count, x.last_viewed_at is not null as viewed
       from public.cv_share_links x where x.user_id = any($1) order by 1, 2`,
  "public.cv_views": `select ${NAME_OF("user_id")} as who, x.source, x.viewer_key, x.record_id is not null as has_record, x.link_id is not null as has_link
       from public.cv_views x where x.user_id = any($1) order by 1, 3`,
  "public.cv_pdf_exports": `select ${NAME_OF("user_id")} as who, x.id, x.template, x.paper, x.pdf_hash, x.bytes, x.file_deleted_at is not null as file_deleted
       from public.cv_pdf_exports x where x.user_id = any($1) order by 1, 2`,
  "public.record_entries": `select coalesce(${NAME_OF("user_id")}, '(held)') as who, x.claim_email_hash, x.kind, x.issuer_type, x.issuer_name, x.source, x.source_id, x.title, x.evidence,
            x.occurred_on, x.status, ${NAME_OF("issued_by")} as issued_by, ${NAME_OF("confirmed_by")} as confirmed_by, x.supersedes is not null as corrects,
            x.superseded_by is not null as superseded, x.code is not null as signed, x.revoked_category, x.revoked_reason, ${NAME_OF("revoked_by")} as revoked_by,
            x.hidden, x.pinned_at is not null as pinned
       from public.record_entries x where $2::uuid[] is not null and (x.user_id = any($1) or x.issuer_id = any($2) or x.issuer_type = 'skilient' and x.user_id is null)
      order by 1, 3, 8, 11, 14`,
  "public.record_claims": `select x.email_hash, x.event_id, ${NAME_OF("user_id")} as matched, x.claimed_at is not null as claimed, x.sent_at is not null as sent
       from public.record_claims x where $1::uuid[] is not null and x.event_id = any($2) order by 1`,
  "public.record_share_links": `select ${NAME_OF("user_id")} as who, x.token_hash, x.label, x.revoked_at is not null as revoked, x.view_count, x.last_viewed_at is not null as viewed
       from public.record_share_links x where x.user_id = any($1) order by 1, 2`,
  "public.record_corrections": `select ${NAME_OF("user_id")} as who, (select e.kind from public.record_entries e where e.id = x.entry_id) as kind, x.note, x.status,
            ${NAME_OF("decided_by")} as decided_by, x.decision_note from public.record_corrections x where x.user_id = any($1) order by 1, 2`,
  "public.record_pdf_exports": `select ${NAME_OF("user_id")} as who, x.id, x.kind, x.entry_id is not null as has_entry, x.holder_name, cardinality(x.codes) as codes, x.pdf_hash, x.bytes
       from public.record_pdf_exports x where x.user_id = any($1) order by 1, 2`,
  "public.ops_audit_log": `select ${NAME_OF("staff_id")} as staff, x.action, x.target_type, x.reason, x.before, x.after from public.ops_audit_log x
      where x.target_type in ('cv_record', 'record_entry') and x.staff_id = any($1) order by 2, 4`,
  "public.society_audit_log": `select ${NAME_OF("actor_id")} as actor, x.action, x.before, x.after from public.society_audit_log x
      where x.action like 'record.%' and $1::uuid[] is not null and x.society_id = any($2) order by 2, 1`,
  "public.notifications": `select ${NAME_OF("user_id")} as who, ${NAME_OF("actor_id")} as actor, x.type, x.entity_type from public.notifications x
      where x.user_id = any($1) and x.type in ('record_entry', 'record_revoked', 'record_confirm', 'record_mistake', 'record_mistake_declined', 'cv_refreshed', 'cv_revoked')
      order by 1, 3, 2`,
};

async function snapshot(tx: Tx): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const [table, text] of Object.entries(SNAPSHOTS)) {
    let q = text.includes("$1") ? text : text.replace(" where ", " where $1::uuid[] is not null and ");
    if (!q.includes("$2")) q = q.replace(" where ", " where $2::uuid[] is not null and ");
    out[table] = (await tx.unsafe(q, [F.ALL_USERS, [F.SOC, F.PENDING, F.EVENT, F.EVENT_PENDING]] as never[])).map((r) => JSON.stringify(r));
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

/** A step through a set-returning function. */
async function stepRows(tx: Tx, actor: StackActor, expr: string, params: unknown[] = []) {
  const before = await snapshot(tx);
  const result = await rows(tx, actor, expr, params);
  return { result, changes: changes(before, await snapshot(tx)) };
}

/** Owner work (a job, a trigger's statement, the signing worker) with the rows it changed. */
async function job<T>(tx: Tx, run: () => Promise<T>) {
  const before = await snapshot(tx);
  const value = await run();
  return { value: value ?? null, changes: changes(before, await snapshot(tx)) };
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

function ok(o: SqlOutcome<unknown>): Row & string {
  if (!o.ok) throw new Error(`expected success: ${o.code} ${o.message}`);
  return o.value as Row & string;
}
const idOf = async (tx: Tx, where: string, params: unknown[]) =>
  ((await tx.unsafe(`select id::text from public.record_entries where ${where} limit 1`, params as never[]))[0] as unknown as { id: string } | undefined)?.id ?? null;
const grant = (tx: Tx, user: string, key: string) =>
  tx.unsafe(
    `insert into public.entitlement_grants (subject_type, subject_id, key, value, source, ends_at, reason)
     values ('user', $1, $2, 'true', 'admin', now() + interval '1 day', 'credentials golden')`,
    [user, key],
  );
const mac = (secret: string, parts: (string | number)[]) => createHmac("sha256", secret).update(parts.join("|")).digest("hex");
const exportSecret = async (tx: Tx) =>
  ((await tx.unsafe(`select decrypted_secret as s from vault.decrypted_secrets where name = 'cv_export_secret'`))[0] as unknown as { s: string }).s;

/** Issues the close-out and seals what it made pending; Priya confirms Osman's own entry (it waits for a second officer). */
async function issueAndSeal(tx: Tx): Promise<void> {
  await seedEvent(tx);
  await tx.unsafe(ISSUE, [F.EVENT, OSMAN]);
  await apart(tx);
  await sealPending(tx);
}

/** Entries made in one transaction share issued_at: moved apart (by holder, then kind) so the lists' order is fixed. */
async function apart(tx: Tx): Promise<void> {
  await tx.unsafe(
    `update public.record_entries e set issued_at = now() - make_interval(mins => r.n::int)
       from (select x.id, row_number() over (order by coalesce((select p.full_name from public.profiles p where p.user_id = x.user_id), ''), x.kind) as n
               from public.record_entries x where x.issuer_id = $1) r
      where r.id = e.id`,
    [F.SOC],
  );
}

// ---------------------------------------------------------------------------
// Cases: issuing (event close-out, office-bearer terms, Skilient entries) and sealing
// ---------------------------------------------------------------------------
describe.skipIf(!DB)("credentials goldens on the current stack: issuing", () => {
  const G = "issuing";

  it("a close-out makes attended, completed, result, volunteer and held walk-in entries; an unverified society makes none; sealing signs them", () =>
    check(G, "event", async (tx) => {
      const out: Row = {};
      await installKey(tx);
      await seedEvent(tx);
      out["unverified"] = await job(tx, () => tx.unsafe(ISSUE, [F.EVENT_PENDING, NIDA]).then(() => null));
      out["issued"] = await job(tx, () => tx.unsafe(ISSUE, [F.EVENT, OSMAN]).then(() => null));
      out["again"] = await job(tx, () => tx.unsafe(`select private.issue_event_record($1, private.event_issue_preview($1), $2)`, [F.EVENT, OSMAN]).then((r) => r[0]));
      out["sealed"] = await job(tx, () => sealPending(tx));
      return out;
    }));

  it("a confirmed term makes the office-bearer entry; a self-confirmed term waits for a second officer", () =>
    check(G, "term", async (tx) => {
      const out: Row = {};
      await installKey(tx);
      out["confirmed"] = await job(tx, () =>
        tx.unsafe(`update public.society_terms set confirmed_by = $2, confirmed_at = now() where id = $1`, [F.TERM_OSMAN, PRIYA]).then(() => null),
      );
      out["self_confirmed"] = await job(tx, () =>
        tx.unsafe(`update public.society_terms set confirmed_by = $2, confirmed_at = now() where id = $1`, [F.TERM_PRIYA, PRIYA]).then(() => null),
      );
      out["pending_society"] = await job(tx, async () => {
        await tx.unsafe(
          `insert into public.society_terms (id, society_id, user_id, role, title, term_start, term_end) values (gen_random_uuid(), $1, $2, 'president', 'President', current_date - 60, current_date - 1)`,
          [F.PENDING, NIDA],
        );
        await tx.unsafe(`update public.society_terms set confirmed_by = $2, confirmed_at = now() where society_id = $1`, [F.PENDING, NIDA]);
        return null;
      });
      out["sealed"] = await job(tx, () => sealPending(tx));
      return out;
    }));

  it("Skilient entries: a completed venture, a proof task and a taught swap (the stack's callers' arguments)", () =>
    check(G, "skilient", async (tx) => {
      const out: Row = {};
      await installKey(tx);
      await tx.unsafe(
        `insert into public.ventures (id, type, owner_id, university_id, title, description, status, completed_at, created_at)
         values ($1, 'project', $2, $3, $4, $5, 'completed', now() - interval '1 day', now() - interval '60 days')`,
        [F.VENTURE, SAMI, F.UNI_A, F.VENTURE_TITLE, F.VENTURE_DESCRIPTION],
      );
      await tx.unsafe(
        `insert into public.venture_completions (venture_id, owner_id, completed_at, team_size, weeks, skill_tags, deliverables, verified_members)
         values ($1, $2, now() - interval '1 day', 2, 8, 0, 0, 1)`,
        [F.VENTURE, SAMI],
      );
      out["venture"] = await job(tx, () =>
        tx
          .unsafe(`insert into public.venture_completion_members (venture_id, user_id, github_days, verified_entries) values ($1, $2, 3, 0), ($1, $3, 0, 0)`, [
            F.VENTURE,
            SAMI,
            NIDA,
          ])
          .then(() => null),
      );
      out["task"] = await job(tx, () =>
        tx
          .unsafe(
            `select private.issue_record_entry($1, null, 'proof_task', 'skilient', null, 'Skilient', 'task', $2, $3,
                    jsonb_build_object('line', 'Android · verified by a peer review', 'skill', 'android', 'verified_by', 'peer'), (now() at time zone 'Asia/Karachi')::date, null) as id`,
            [SAMI, F.ATTEMPT, F.TASK_TITLE],
          )
          .then((r) => r[0]),
      );
      out["taught"] = await job(tx, () =>
        tx
          .unsafe(
            `select private.issue_record_entry($1, null, 'taught', 'skilient', null, 'Skilient', 'swap', $2, 'Taught Android to Nida',
                    jsonb_build_object('line', '2 sessions · 1.5 h', 'sessions', 2, 'minutes', 90, 'skill', 'android'), current_date - 3, null) as id`,
            [SAMI, F.SWAP],
          )
          .then((r) => r[0]),
      );
      out["sealed"] = await job(tx, () => sealPending(tx));
      return out;
    }));
});

// ---------------------------------------------------------------------------
// Cases: officers (the society's Record tab, confirm, correct, mistakes, revoke)
// ---------------------------------------------------------------------------
describe.skipIf(!DB)("credentials goldens on the current stack: officers", () => {
  const G = "officers";

  it("society_record_page and confirm_record_entry: a second officer confirms, never the person or the issuer", () =>
    check(G, "confirm", async (tx) => {
      const out: Row = {};
      await installKey(tx);
      await issueAndSeal(tx);
      const osman = await idOf(tx, `user_id = $1 and status = 'awaiting' and kind = 'attended'`, [OSMAN]);
      out["page"] = await call(tx, as(PRIYA), `public.society_record_page($1)`, [F.SOC]);
      out["page_member"] = await call(tx, as(MEHR), `public.society_record_page($1)`, [F.SOC]);
      out["self"] = await call(tx, as(OSMAN), `public.confirm_record_entry($1)`, [osman]);
      out["member"] = await call(tx, as(MEHR), `public.confirm_record_entry($1)`, [osman]);
      out["confirm"] = await step(tx, as(PRIYA), `public.confirm_record_entry($1)`, [osman]);
      out["again"] = await call(tx, as(PRIYA), `public.confirm_record_entry($1)`, [osman]);
      out["sealed"] = await job(tx, () => sealPending(tx));
      return out;
    }));

  it("correct_record_entry: only a sealed entry, one waiting correction, the new entry supersedes once signed", () =>
    check(G, "correct", async (tx) => {
      const out: Row = {};
      await installKey(tx);
      await issueAndSeal(tx);
      const sami = await idOf(tx, `user_id = $1 and kind = 'result'`, [SAMI]);
      const osman = await idOf(tx, `user_id = $1 and status = 'awaiting'`, [OSMAN]);
      out["not_sealed"] = await call(tx, as(PRIYA), `public.correct_record_entry($1, $2::text::jsonb, null)`, [osman, JSON.stringify({ title: "Night sky workshop II" })]);
      out["nothing"] = await call(tx, as(PRIYA), `public.correct_record_entry($1, '{}'::jsonb, null)`, [sami]);
      out["bad_place"] = await call(tx, as(PRIYA), `public.correct_record_entry($1, '{"place": 0}'::jsonb, null)`, [sami]);
      out["member"] = await call(tx, as(MEHR), `public.correct_record_entry($1, '{"place": 2}'::jsonb, null)`, [sami]);
      out["correct"] = await step(tx, as(PRIYA), `public.correct_record_entry($1, '{"place": 2}'::jsonb, ' Typo in the place ')`, [sami]);
      out["waiting"] = await call(tx, as(PRIYA), `public.correct_record_entry($1, '{"place": 3}'::jsonb, null)`, [sami]);
      out["sealed"] = await job(tx, () => sealPending(tx));
      const mehr = await idOf(tx, `user_id = $1 and kind = 'volunteer'`, [MEHR]);
      out["hours"] = await step(tx, as(OSMAN), `public.correct_record_entry($1, '{"hours": 2.25, "title": "Night sky workshop (setup)"}'::jsonb, null)`, [mehr]);
      return out;
    }));

  it("report_record_mistake and decline_record_mistake: students report a society entry; officers decline with a reason", () =>
    check(G, "mistakes", async (tx) => {
      const out: Row = {};
      await installKey(tx);
      await issueAndSeal(tx);
      const sami = await idOf(tx, `user_id = $1 and kind = 'attended'`, [SAMI]);
      out["short"] = await call(tx, as(SAMI), `public.report_record_mistake($1, 'wrong')`, [sami]);
      out["other"] = await call(tx, as(MEHR), `public.report_record_mistake($1, 'This is not my entry at all.')`, [sami]);
      out["report"] = await step(tx, as(SAMI), `public.report_record_mistake($1, ' I came to both sessions, not one. ')`, [sami]);
      out["again"] = await call(tx, as(SAMI), `public.report_record_mistake($1, 'I came to both sessions, not one.')`, [sami]);
      out["page"] = await call(tx, as(OSMAN), `public.society_record_page($1)`, [F.SOC]);
      const c = ((await tx.unsafe(`select id::text from public.record_corrections where user_id = $1`, [SAMI]))[0] as unknown as { id: string }).id;
      out["decline_short"] = await call(tx, as(OSMAN), `public.decline_record_mistake($1, 'no')`, [c]);
      out["decline_member"] = await call(tx, as(MEHR), `public.decline_record_mistake($1, 'The scanner shows one.')`, [c]);
      out["decline"] = await step(tx, as(OSMAN), `public.decline_record_mistake($1, ' The scanner shows one session. ')`, [c]);
      out["decline_again"] = await call(tx, as(OSMAN), `public.decline_record_mistake($1, 'The scanner shows one session.')`, [c]);
      const skilient = await (async () => {
        ok(
          await attempt(tx, (sp) =>
            sp.unsafe(
              `select private.issue_record_entry($1, null, 'proof_task', 'skilient', null, 'Skilient', 'task', $2, $3, '{"line": "Android · verified by GitHub"}'::jsonb, current_date, null)`,
              [SAMI, F.ATTEMPT, F.TASK_TITLE],
            ),
          ),
        );
        await sealPending(tx);
        return idOf(tx, `user_id = $1 and kind = 'proof_task'`, [SAMI]);
      })();
      out["skilient"] = await call(tx, as(SAMI), `public.report_record_mistake($1, 'The skill should be Kotlin instead.')`, [skilient]);
      return out;
    }));

  it("revoke_record_entry by an officer: a reason category and the student's reason; pinned and CV picks drop", () =>
    check(G, "revoke", async (tx) => {
      const out: Row = {};
      await installKey(tx);
      await issueAndSeal(tx);
      const sami = await idOf(tx, `user_id = $1 and kind = 'completed'`, [SAMI]);
      ok(await call(tx, as(SAMI), `public.set_record_display($1, true, false)`, [sami]));
      ok(await call(tx, as(SAMI), `public.save_cv_activities($1::uuid[])`, [[sami]]));
      out["no_category"] = await call(tx, as(OSMAN), `public.revoke_record_entry($1, null, 'Checked in twice by mistake')`, [sami]);
      out["no_reason"] = await call(tx, as(OSMAN), `public.revoke_record_entry($1, 'issued_in_error', ' ')`, [sami]);
      out["member"] = await call(tx, as(MEHR), `public.revoke_record_entry($1, 'issued_in_error', 'Checked in twice by mistake')`, [sami]);
      out["revoke"] = await step(tx, as(OSMAN), `public.revoke_record_entry($1, 'issued_in_error', ' Checked in twice by mistake ')`, [sami]);
      out["again"] = await call(tx, as(OSMAN), `public.revoke_record_entry($1, 'other', 'Again')`, [sami]);
      const held = await idOf(tx, `status = 'held'`, []);
      out["held"] = await call(tx, as(OSMAN), `public.revoke_record_entry($1, 'other', 'Not here')`, [held]);
      out["record"] = await call(tx, as(SAMI), `public.my_record()`);
      return out;
    }));
});

// ---------------------------------------------------------------------------
// Cases: the student's Record (page, pins, hide, highlights, PDFs) and claims
// ---------------------------------------------------------------------------
describe.skipIf(!DB)("credentials goldens on the current stack: the Record", () => {
  const G = "record";

  it("my_record, set_record_display (3 pins, sealed only, hidden never pinned) and record_highlights", () =>
    check(G, "student", async (tx) => {
      const out: Row = {};
      await installKey(tx);
      out["empty"] = await call(tx, as(NIDA), `public.my_record()`);
      out["signed_out"] = await call(tx, ANON, `public.my_record()`);
      await issueAndSeal(tx);
      // Sami's entries were made in one transaction: their issue times are moved apart so the lists' order is fixed.
      await tx.unsafe(
        `update public.record_entries e set issued_at = now() - make_interval(mins => r.n::int)
           from (select id, row_number() over (order by kind) as n from public.record_entries where user_id = $1) r where r.id = e.id`,
        [SAMI],
      );
      out["record"] = await call(tx, as(SAMI), `public.my_record()`);
      const ids = (await tx.unsafe(`select id::text, kind from public.record_entries where user_id = $1 order by kind`, [SAMI])) as unknown as { id: string; kind: string }[];
      const [attended, completed, result] = ids.map((r) => r.id);
      out["pin"] = await step(tx, as(SAMI), `public.set_record_display($1, true, false)`, [attended]);
      out["pin_hidden"] = await call(tx, as(SAMI), `public.set_record_display($1, true, true)`, [completed]);
      ok(await call(tx, as(SAMI), `public.set_record_display($1, true, false)`, [completed]));
      ok(await call(tx, as(SAMI), `public.set_record_display($1, true, false)`, [result]));
      const extra = await (async () => {
        ok(
          await attempt(tx, (sp) =>
            sp.unsafe(
              `select private.issue_record_entry($1, null, 'proof_task', 'skilient', null, 'Skilient', 'task', $2, $3, '{"line": "Android · verified by GitHub"}'::jsonb, current_date, null)`,
              [SAMI, F.ATTEMPT, F.TASK_TITLE],
            ),
          ),
        );
        const id = await idOf(tx, `user_id = $1 and kind = 'proof_task'`, [SAMI]);
        out["pin_pending"] = await call(tx, as(SAMI), `public.set_record_display($1, true, false)`, [id]);
        await sealPending(tx);
        return id;
      })();
      out["fourth_pin"] = await call(tx, as(SAMI), `public.set_record_display($1, true, false)`, [extra]);
      out["hide"] = await step(tx, as(SAMI), `public.set_record_display($1, false, true)`, [result]);
      out["other"] = await call(tx, as(MEHR), `public.set_record_display($1, false, true)`, [attended]);
      await tx.unsafe(`update public.record_entries set pinned_at = now() - make_interval(mins => (case kind when 'attended' then 2 else 1 end)) where user_id = $1 and pinned_at is not null`, [SAMI]);
      out["highlights"] = await call(tx, as(MEHR), `public.record_highlights($1)`, [SAMI]);
      out["highlights_signed_out"] = await call(tx, ANON, `public.record_highlights($1)`, [SAMI]);
      return out;
    }));

  it("record_pdf_export (MAC, own sealed codes) and verify_record_transcript", () =>
    check(G, "pdf", async (tx) => {
      const out: Row = {};
      await installKey(tx);
      await issueAndSeal(tx);
      const secret = await exportSecret(tx);
      const e = (await tx.unsafe(`select id::text, code from public.record_entries where user_id = $1 and status = 'sealed' order by kind`, [SAMI])) as unknown as { id: string; code: string }[];
      const codes = e.map((x) => x.code);
      const cert = (id: string, entry: string, c: string[], hash = F.PDF_HASH, bytes = 2048) => [id, "certificate", entry, c, hash, bytes, mac(secret, [id, "certificate", entry, c.join(","), hash, bytes])];
      const fn = `public.record_pdf_export($1, $2, $3, $4::text[], $5, $6, $7)`;
      out["bad_mac"] = await call(tx, as(SAMI), fn, [F.EXPORT_CERT, "certificate", e[0]!.id, [codes[0]], F.PDF_HASH, 2048, "0".repeat(64)]);
      out["not_mine"] = await call(tx, as(MEHR), fn, cert(F.EXPORT_CERT, e[0]!.id, [codes[0]!]));
      out["two_codes"] = await call(tx, as(SAMI), fn, cert(F.EXPORT_CERT, e[0]!.id, codes.slice(0, 2)));
      out["certificate"] = await step(tx, as(SAMI), fn, cert(F.EXPORT_CERT, e[0]!.id, [codes[0]!]));
      out["transcript"] = await step(tx, as(SAMI), `public.record_pdf_export($1, 'transcript', null, $2::text[], $3, $4, $5)`, [
        F.EXPORT_TRANSCRIPT,
        codes,
        F.PDF_HASH,
        4096,
        mac(secret, [F.EXPORT_TRANSCRIPT, "transcript", "", codes.join(","), F.PDF_HASH, 4096]),
      ]);
      ok(await call(tx, as(OSMAN), `public.revoke_record_entry($1, 'not_earned', 'Left after ten minutes')`, [e[0]!.id]));
      out["verify"] = await call(tx, ANON, `public.verify_record_transcript($1)`, [F.EXPORT_TRANSCRIPT]);
      out["verify_unknown"] = await call(tx, ANON, `public.verify_record_transcript($1)`, [F.EXPORT_CV]);
      return out;
    }));
});

describe.skipIf(!DB)("credentials goldens on the current stack: claims", () => {
  const G = "claims";

  it("a walk-in's held entry is matched at signup with the same verified address, then claimed onto the Record", () =>
    check(G, "claim", async (tx) => {
      const out: Row = {};
      await installKey(tx);
      await issueAndSeal(tx);
      out["waiting_other"] = await call(tx, as(SAMI), `public.record_waiting()`);
      out["signup"] = await job(tx, async () => {
        await insertUser(tx, ZARA);
        await onboard(tx, ZARA);
        return null;
      });
      out["waiting"] = await call(tx, as(ZARA), `public.record_waiting()`);
      out["claim"] = await step(tx, as(ZARA), `public.claim_record_entries()`);
      out["again"] = await call(tx, as(ZARA), `public.claim_record_entries()`);
      out["waiting_after"] = await call(tx, as(ZARA), `public.record_waiting()`);
      out["sealed"] = await job(tx, () => sealPending(tx));
      return out;
    }));

  it("record_claims_expire: unclaimed entries go after 180 days with their claims", () =>
    check(G, "expire", async (tx) => {
      const out: Row = {};
      await installKey(tx);
      await issueAndSeal(tx);
      out["early"] = await job(tx, () => tx.unsafe(`select private.record_claims_expire() as n`).then((r) => r[0]));
      await tx.unsafe(`update public.record_claims set expires_at = now() - interval '1 minute' where event_id = $1`, [F.EVENT]);
      out["expired"] = await job(tx, () => tx.unsafe(`select private.record_claims_expire() as n`).then((r) => r[0]));
      return out;
    }));
});

// ---------------------------------------------------------------------------
// Cases: CVs (settings, issue, re-issue, refresh, exports, activities, ban and deletion)
// ---------------------------------------------------------------------------
describe.skipIf(!DB)("credentials goldens on the current stack: CVs", () => {
  const G = "cv";
  const SETTINGS = `public.save_cv_settings($1::text[], $2, $3, $4::public.cv_visibility)`;

  it("save_cv_settings: eligible students only, at least one section, each once", () =>
    check(G, "settings", async (tx) => {
      const out: Row = {};
      out["save"] = await step(tx, as(SAMI), SETTINGS, [["summary", "skills", "education"], false, true, "private"]);
      out["empty"] = await call(tx, as(SAMI), SETTINGS, [[], null, false, "link"]);
      out["twice"] = await call(tx, as(SAMI), SETTINGS, [["summary", "summary"], null, false, "link"]);
      out["unknown"] = await call(tx, as(SAMI), SETTINGS, [["summary", "hobbies"], null, false, "link"]);
      out["update"] = await step(tx, as(SAMI), SETTINGS, [["projects", "summary", "activities"], null, null, "recruiters"]);
      await tx.unsafe(`update public.profiles set onboarding_complete = false where user_id = $1`, [NIDA]);
      out["not_eligible"] = await call(tx, as(NIDA), SETTINGS, [["summary"], null, false, "link"]);
      out["signed_out"] = await call(tx, ANON, SETTINGS, [["summary"], null, false, "link"]);
      return out;
    }));

  it("issuing: the snapshot, a first CV once, monthly only when changed, on demand for Pro, not for the ineligible", () =>
    check(G, "issue", async (tx) => {
      const out: Row = {};
      await installKey(tx);
      out["snapshot_nida"] = await call(tx, OWNER, `private.cv_snapshot($1)`, [NIDA]);
      out["first"] = await job(tx, () => issueCv(tx, SAMI, "first"));
      out["first_again"] = await job(tx, () => issueCv(tx, SAMI, "first"));
      out["monthly_unchanged"] = await job(tx, () => issueCv(tx, SAMI, "monthly"));
      ok(await call(tx, as(SAMI), SETTINGS, [["summary", "skills", "education"], true, true, "link"]));
      out["monthly_changed"] = await job(tx, () => issueCv(tx, SAMI, "monthly"));
      out["on_demand_free"] = await job(tx, () => issueCv(tx, SAMI, "on_demand"));
      await grant(tx, SAMI, "cv.refresh_on_demand");
      out["on_demand_pro"] = await job(tx, () => issueCv(tx, SAMI, "on_demand"));
      await tx.unsafe(`update public.profiles set onboarding_complete = false where user_id = $1`, [NIDA]);
      out["not_eligible"] = await job(tx, () => issueCv(tx, NIDA, "first"));
      await tx.unsafe(`update public.profiles set leaderboard_opt_out = true where user_id = $1`, [SAMI]);
      ok(await call(tx, as(SAMI), SETTINGS, [["summary", "skills", "education"], null, false, "link"]));
      out["snapshot_opted_out"] = await call(tx, OWNER, `private.cv_snapshot($1)`, [SAMI]);
      return out;
    }));

  it("revoke_cv and re-issue: only the newest version after the owner revoked it, same content, a new code", () =>
    check(G, "reissue", async (tx) => {
      const out: Row = {};
      await installKey(tx);
      const first = await issueCv(tx, SAMI, "first");
      expect(first["status"]).toBe("issued");
      out["reissue_live"] = await job(tx, () => issueCv(tx, SAMI, "reissue"));
      const rec = ((await tx.unsafe(`select id::text from public.cv_records where user_id = $1`, [SAMI]))[0] as unknown as { id: string }).id;
      out["revoke_other"] = await call(tx, as(MEHR), `public.revoke_cv($1)`, [rec]);
      out["revoke"] = await step(tx, as(SAMI), `public.revoke_cv($1)`, [rec]);
      out["revoke_again"] = await call(tx, as(SAMI), `public.revoke_cv($1)`, [rec]);
      out["reissue"] = await job(tx, () => issueCv(tx, SAMI, "reissue"));
      return out;
    }));

  it("cv_refresh_start queues every student with a CV who may have one", () =>
    check(G, "refresh", async (tx) => {
      const out: Row = {};
      await installKey(tx);
      expect((await issueCv(tx, SAMI, "first"))["status"]).toBe("issued");
      expect((await issueCv(tx, MEHR, "first"))["status"]).toBe("issued");
      await tx.unsafe(`update public.profiles set onboarding_complete = false where user_id = $1`, [MEHR]);
      out["queued"] = await call(tx, OWNER, `private.cv_refresh_start(true)`);
      return out;
    }));

  it("cv_export_rights, record_cv_export (MAC, file, own live version, template rights) and cv_exports_daily", () =>
    check(G, "exports", async (tx) => {
      const out: Row = {};
      await installKey(tx);
      expect((await issueCv(tx, SAMI, "first"))["status"]).toBe("issued");
      const rec = ((await tx.unsafe(`select id::text from public.cv_records where user_id = $1`, [SAMI]))[0] as unknown as { id: string }).id;
      const secret = await exportSecret(tx);
      const args = (template: string, bytes = 1500, m?: string) => [F.EXPORT_CV, rec, template, "a4", F.PDF_HASH, bytes, m ?? mac(secret, [F.EXPORT_CV, rec, template, "a4", F.PDF_HASH, bytes])];
      const fn = `public.record_cv_export($1, $2, $3, $4, $5, $6, $7)`;
      out["rights_free"] = await rows(tx, as(SAMI), `public.cv_export_rights()`);
      out["free"] = await call(tx, as(SAMI), fn, args("standard"));
      await grant(tx, SAMI, "cv.pdf_export");
      out["rights_pro"] = await rows(tx, as(SAMI), `public.cv_export_rights()`);
      out["template"] = await call(tx, as(SAMI), fn, args("classic"));
      out["bad_mac"] = await call(tx, as(SAMI), fn, args("standard", 1500, "0".repeat(64)));
      out["no_file"] = await call(tx, as(SAMI), fn, args("standard"));
      await tx.unsafe(`insert into storage.objects (bucket_id, name, owner, metadata) values ('cv-exports', $1, $2, '{"size": 1500}'::jsonb)`, [
        `${SAMI}/${F.EXPORT_CV}.pdf`,
        SAMI,
      ]);
      out["wrong_size"] = await call(tx, as(SAMI), fn, args("standard", 1499));
      out["export"] = await step(tx, as(SAMI), fn, args("standard"));
      out["not_mine"] = await call(tx, as(MEHR), fn, args("standard"));
      await tx.unsafe(`update public.cv_pdf_exports set created_at = now() - interval '31 days' where id = $1`, [F.EXPORT_CV]);
      out["daily"] = await job(tx, () => tx.unsafe(`select private.cv_exports_daily() as n`).then((r) => r[0]));
      return out;
    }));

  it("save_cv_activities: own sealed entries, at most 8, kept in the Record's order; the snapshot's activities", () =>
    check(G, "activities", async (tx) => {
      const out: Row = {};
      await installKey(tx);
      await issueAndSeal(tx);
      await tx.unsafe(`update public.record_entries set occurred_on = occurred_on - (case kind when 'attended' then 2 when 'completed' then 1 else 0 end) where user_id = $1`, [SAMI]);
      const ids = ((await tx.unsafe(`select id::text from public.record_entries where user_id = $1 order by kind`, [SAMI])) as unknown as { id: string }[]).map((r) => r.id);
      const mine = await idOf(tx, `user_id = $1`, [MEHR]);
      out["not_mine"] = await call(tx, as(SAMI), `public.save_cv_activities($1::uuid[])`, [[mine]]);
      await tx.unsafe(
        `insert into public.platform_config (key, version, value, reason)
         select key, version + 1, jsonb_set(value, '{cv_entries}', '2'), 'credentials golden' from public.platform_config where key = 'record.limits' order by version desc limit 1`,
      );
      out["too_many"] = await call(tx, as(SAMI), `public.save_cv_activities($1::uuid[])`, [ids]);
      out["save"] = await step(tx, as(SAMI), `public.save_cv_activities($1::uuid[])`, [[ids[2], ids[0]]]);
      out["snapshot"] = await call(tx, OWNER, `private.cv_snapshot($1) -> 'activities'`, [SAMI]);
      out["sections"] = await call(tx, OWNER, `private.cv_snapshot($1) -> 'sections'`, [SAMI]);
      return out;
    }));

  it("a ban revokes every version and link; deletion revokes and wipes the content, codes stay", () =>
    check(G, "ban", async (tx) => {
      const out: Row = {};
      await installKey(tx);
      expect((await issueCv(tx, SAMI, "first"))["status"]).toBe("issued");
      expect((await issueCv(tx, MEHR, "first"))["status"]).toBe("issued");
      await tx.unsafe(`update public.ranking_scores set tier = 'spark' where user_id = $1`, [SAMI]);
      ok(await call(tx, as(SAMI), `public.create_share_link($1, 'Recruiters', 30)`, [F.LINK_HASH]));
      out["ban"] = await job(tx, () => tx.unsafe(`update auth.users set banned_until = now() + interval '30 days' where id = $1`, [SAMI]).then(() => null));
      out["banned_issue"] = await job(tx, () => issueCv(tx, SAMI, "monthly"));
      const mehrCode = ((await tx.unsafe(`select code from public.cv_records where user_id = $1`, [MEHR]))[0] as unknown as { code: string }).code;
      out["delete"] = await job(tx, () => tx.unsafe(`delete from auth.users where id = $1`, [MEHR]).then(() => null));
      out["deleted_row"] = await call(tx, OWNER, `(select jsonb_build_object('user', user_id, 'snapshot', snapshot, 'revoked', revoked_reason, 'version', version) from public.cv_records where code = $1)`, [mehrCode]);
      out["deleted_verify"] = await rows(tx, ANON, `public.verify_cv($1)`, [mehrCode]);
      return out;
    }));
});

// ---------------------------------------------------------------------------
// Cases: share links (CV and Record)
// ---------------------------------------------------------------------------
describe.skipIf(!DB)("credentials goldens on the current stack: share links", () => {
  const G = "share";

  it("CV share links: Spark and above, up to 10, always the newest version, one view per viewer a day, revoke", () =>
    check(G, "cv", async (tx) => {
      const out: Row = {};
      await installKey(tx);
      const create = `public.create_share_link($1, $2, $3)`;
      out["no_tier"] = await call(tx, as(NIDA), create, [F.LINK_HASH, "Mine", 30]);
      out["bad_days"] = await call(tx, as(SAMI), create, [F.LINK_HASH, "Mine", 14]);
      out["bad_hash"] = await call(tx, as(SAMI), create, ["xyz", "Mine", 30]);
      out["create"] = await step(tx, as(SAMI), create, [F.LINK_HASH, "  Recruiters  ", 30]);
      out["create_forever"] = await step(tx, as(SAMI), create, [F.LINK_HASH_2, " ", null]);
      out["open_no_cv"] = await stepRows(tx, ANON, `public.open_shared_cv($1, $2)`, [F.LINK_HASH, F.VIEWER]);
      expect((await issueCv(tx, SAMI, "first"))["status"]).toBe("issued");
      out["open"] = await stepRows(tx, ANON, `public.open_shared_cv($1, $2)`, [F.LINK_HASH, F.VIEWER]);
      out["open_again"] = await stepRows(tx, ANON, `public.open_shared_cv($1, $2)`, [F.LINK_HASH, F.VIEWER]);
      out["open_other"] = await stepRows(tx, ANON, `public.open_shared_cv($1, $2)`, [F.LINK_HASH, F.VIEWER_2]);
      out["open_no_key"] = await stepRows(tx, ANON, `public.open_shared_cv($1, null)`, [F.LINK_HASH]);
      out["open_unknown"] = await rows(tx, ANON, `public.open_shared_cv($1, $2)`, ["9".repeat(64), F.VIEWER]);
      ok(await call(tx, as(SAMI), SETTINGS_PRIVATE, []));
      out["open_private"] = await rows(tx, ANON, `public.open_shared_cv($1, $2)`, [F.LINK_HASH, F.VIEWER]);
      const link = ((await tx.unsafe(`select id::text from public.cv_share_links where token_hash = $1`, [F.LINK_HASH]))[0] as unknown as { id: string }).id;
      out["revoke_other"] = await call(tx, as(MEHR), `public.revoke_share_link($1)`, [link]);
      out["revoke"] = await step(tx, as(SAMI), `public.revoke_share_link($1)`, [link]);
      out["revoke_again"] = await call(tx, as(SAMI), `public.revoke_share_link($1)`, [link]);
      out["open_revoked"] = await rows(tx, ANON, `public.open_shared_cv($1, $2)`, [F.LINK_HASH, F.VIEWER]);
      for (let i = 3; i <= 10; i++) ok(await call(tx, as(SAMI), create, [String(i % 10).repeat(63) + "f", null, 7]));
      out["eleventh"] = await call(tx, as(SAMI), create, ["e".repeat(64), null, 7]);
      return out;
    }));

  it("Record share links: an expiry always, up to 10, sealed and shown entries only, one view per viewer a day", () =>
    check(G, "record", async (tx) => {
      const out: Row = {};
      await installKey(tx);
      await issueAndSeal(tx);
      await tx.unsafe(`update public.record_entries set occurred_on = occurred_on - (case kind when 'attended' then 2 when 'completed' then 1 else 0 end) where user_id = $1`, [SAMI]);
      const create = `public.create_record_share_link($1, $2, $3)`;
      out["no_days"] = await call(tx, as(SAMI), create, [F.LINK_HASH, "Mine", null]);
      out["create"] = await step(tx, as(SAMI), create, [F.LINK_HASH, "  Scholarship  ", 90]);
      out["signed_out"] = await call(tx, ANON, create, [F.LINK_HASH_2, "Mine", 7]);
      const hide = await idOf(tx, `user_id = $1 and kind = 'result'`, [SAMI]);
      ok(await call(tx, as(SAMI), `public.set_record_display($1, false, true)`, [hide]));
      out["open"] = await step(tx, ANON, `public.open_record_share($1, $2)`, [F.LINK_HASH, F.VIEWER]);
      out["open_again"] = await step(tx, ANON, `public.open_record_share($1, $2)`, [F.LINK_HASH, F.VIEWER]);
      out["open_unknown"] = await call(tx, ANON, `public.open_record_share($1, $2)`, ["9".repeat(64), F.VIEWER]);
      const link = ((await tx.unsafe(`select id::text from public.record_share_links where token_hash = $1`, [F.LINK_HASH]))[0] as unknown as { id: string }).id;
      out["revoke_other"] = await call(tx, as(MEHR), `public.revoke_record_share_link($1)`, [link]);
      out["revoke"] = await step(tx, as(SAMI), `public.revoke_record_share_link($1)`, [link]);
      out["open_revoked"] = await call(tx, ANON, `public.open_record_share($1, $2)`, [F.LINK_HASH, F.VIEWER]);
      out["mine"] = await call(tx, as(SAMI), `public.my_record() -> 'links'`);
      return out;
    }));
});
const SETTINGS_PRIVATE = `public.save_cv_settings(array['summary'], null, false, 'private')`;

// ---------------------------------------------------------------------------
// Cases: staff
// ---------------------------------------------------------------------------
describe.skipIf(!DB)("credentials goldens on the current stack: staff", () => {
  const G = "staff";

  it("ops_cv_records and ops_revoke_cv: trust reviewers with two-factor, a reason, audited, one or all", () =>
    check(G, "cv", async (tx) => {
      const out: Row = {};
      await installKey(tx);
      expect((await issueCv(tx, SAMI, "first"))["status"]).toBe("issued");
      await grant(tx, SAMI, "cv.refresh_on_demand");
      expect((await issueCv(tx, SAMI, "on_demand"))["status"]).toBe("issued");
      await tx.unsafe(`update public.cv_records set issued_at = issued_at - interval '1 hour' where user_id = $1 and version = 1`, [SAMI]);
      out["search_student"] = await rows(tx, as(MEHR, "aal2"), `public.ops_cv_records($1)`, [F.USERNAME[SAMI]]);
      out["search_aal1"] = await rows(tx, as(TARIQ), `public.ops_cv_records($1)`, [F.USERNAME[SAMI]]);
      out["search_short"] = await rows(tx, as(TARIQ, "aal2"), `public.ops_cv_records($1)`, ["cr"]);
      out["search"] = await rows(tx, as(TARIQ, "aal2"), `public.ops_cv_records($1)`, [`@${F.USERNAME[SAMI]}`]);
      const [v1, v2] = ((await tx.unsafe(`select id::text, code from public.cv_records where user_id = $1 order by version`, [SAMI])) as unknown as { id: string; code: string }[]);
      out["search_code"] = await rows(tx, as(TARIQ, "aal2"), `public.ops_cv_records($1)`, [`${v1!.code.slice(0, 5).toLowerCase()}-${v1!.code.slice(5)}`]);
      out["revoke_no_reason"] = await call(tx, as(TARIQ, "aal2"), `public.ops_revoke_cv($1, false, 'no')`, [v1!.id]);
      out["revoke"] = await step(tx, as(TARIQ, "aal2"), `public.ops_revoke_cv($1, false, ' Fake university email ')`, [v1!.id]);
      out["revoke_again"] = await call(tx, as(TARIQ, "aal2"), `public.ops_revoke_cv($1, false, 'Fake university email')`, [v1!.id]);
      out["revoke_all"] = await step(tx, as(TARIQ, "aal2"), `public.ops_revoke_cv($1, true, 'Account taken over')`, [v2!.id]);
      out["revoke_student"] = await call(tx, as(MEHR, "aal2"), `public.ops_revoke_cv($1, true, 'Account taken over')`, [v2!.id]);
      return out;
    }));

  it("ops_record_entry and revoke_record_entry by staff: audited before and after", () =>
    check(G, "record", async (tx) => {
      const out: Row = {};
      await installKey(tx);
      await issueAndSeal(tx);
      const e = ((await tx.unsafe(`select id::text, code from public.record_entries where user_id = $1 and kind = 'attended'`, [SAMI]))[0] as unknown as { id: string; code: string });
      out["lookup_student"] = await call(tx, as(MEHR, "aal2"), `public.ops_record_entry($1)`, [e.code]);
      out["lookup_aal1"] = await call(tx, as(TARIQ), `public.ops_record_entry($1)`, [e.code]);
      out["lookup"] = await call(tx, as(TARIQ, "aal2"), `public.ops_record_entry($1)`, [` ${e.code.toLowerCase()} `]);
      out["lookup_unknown"] = await call(tx, as(TARIQ, "aal2"), `public.ops_record_entry($1)`, ["0000000000"]);
      out["revoke"] = await step(tx, as(TARIQ, "aal2"), `public.revoke_record_entry($1, 'misconduct', ' Ticket was shared ')`, [e.id]);
      out["revoke_aal1"] = await call(tx, as(TARIQ), `public.revoke_record_entry($1, 'misconduct', 'Ticket was shared')`, [e.id]);
      return out;
    }));
});

// ---------------------------------------------------------------------------
// Cases: verify (CVs, entries, the shared code namespace) and the signed values for the done-when
// ---------------------------------------------------------------------------
describe.skipIf(!DB)("credentials goldens on the current stack: verify", () => {
  const G = "verify";

  it("verify_cv: anyone; a superseded version names its successor's date; revoked shows code and dates only; a PDF hash", () =>
    check(G, "cv", async (tx) => {
      const out: Row = {};
      await installKey(tx);
      expect((await issueCv(tx, SAMI, "first"))["status"]).toBe("issued");
      await grant(tx, SAMI, "cv.refresh_on_demand");
      expect((await issueCv(tx, SAMI, "on_demand"))["status"]).toBe("issued");
      const [v1, v2] = (await tx.unsafe(`select id::text, code from public.cv_records where user_id = $1 order by version`, [SAMI])) as unknown as { id: string; code: string }[];
      await tx.unsafe(`insert into public.cv_pdf_exports (id, record_id, user_id, template, paper, pdf_hash, path, bytes) values ($1, $2, $3, 'standard', 'a4', $4, $5, 100)`, [
        F.EXPORT_CV,
        v2!.id,
        SAMI,
        F.PDF_HASH,
        `${SAMI}/${F.EXPORT_CV}.pdf`,
      ]);
      out["superseded"] = await rows(tx, ANON, `public.verify_cv($1)`, [v1!.code.toLowerCase()]);
      out["newest"] = await rows(tx, ANON, `public.verify_cv($1, $2)`, [v2!.code, F.PDF_HASH.toUpperCase()]);
      out["altered"] = await rows(tx, ANON, `public.verify_cv($1, $2)`, [v2!.code, "d".repeat(64)]);
      ok(await call(tx, as(SAMI), `public.revoke_cv($1)`, [v2!.id]));
      out["revoked"] = await rows(tx, ANON, `public.verify_cv($1, $2)`, [v2!.code, F.PDF_HASH]);
      out["unknown"] = await rows(tx, ANON, `public.verify_cv($1)`, ["0000000000"]);
      return out;
    }));

  it("verify_record_entry: sealed, superseded (names its successor), revoked (code, dates, category); held and pending are not found", () =>
    check(G, "entry", async (tx) => {
      const out: Row = {};
      await installKey(tx);
      await issueAndSeal(tx);
      const result = ((await tx.unsafe(`select id::text, code from public.record_entries where user_id = $1 and kind = 'result'`, [SAMI]))[0] as unknown as { id: string; code: string });
      const att = ((await tx.unsafe(`select id::text, code from public.record_entries where user_id = $1 and kind = 'attended'`, [SAMI]))[0] as unknown as { id: string; code: string });
      out["sealed"] = await call(tx, ANON, `public.verify_record_entry($1)`, [att.code.toLowerCase()]);
      ok(await call(tx, as(PRIYA), `public.correct_record_entry($1, '{"place": 2}'::jsonb, null)`, [result.id]));
      await sealPending(tx);
      out["superseded"] = await call(tx, ANON, `public.verify_record_entry($1)`, [result.code]);
      ok(await call(tx, as(OSMAN), `public.revoke_record_entry($1, 'not_earned', 'Left after ten minutes')`, [att.id]));
      out["revoked"] = await call(tx, ANON, `public.verify_record_entry($1)`, [att.code]);
      out["unknown"] = await call(tx, ANON, `public.verify_record_entry($1)`, ["0000000000"]);
      return out;
    }));

  it("one code namespace: a Record entry may not take a CV's code, nor a CV an entry's", () =>
    check(G, "namespace", async (tx) => {
      const out: Row = {};
      const k = await installKey(tx);
      expect((await issueCv(tx, SAMI, "first"))["status"]).toBe("issued");
      await issueAndSeal(tx);
      const cv = ((await tx.unsafe(`select code from public.cv_records where user_id = $1`, [SAMI]))[0] as unknown as { code: string }).code;
      const entry = ((await tx.unsafe(`select code from public.record_entries where status = 'sealed' limit 1`))[0] as unknown as { code: string }).code;
      const pending = await idOf(tx, `user_id = $1 and status = 'awaiting'`, [OSMAN]);
      await tx.unsafe(`update public.record_entries set status = 'pending' where id = $1`, [pending]);
      out["entry_takes_cv_code"] = await attempt(tx, (sp) =>
        sp.unsafe(`select private.record_sign_commit($1::uuid, $2, $3, now(), '{}'::jsonb, $4, $5)`, [pending, cv, k.keyId, "e".repeat(64), "A".repeat(86)]),
      ).then((o) => (o.ok ? { ok: true } : { ok: false, code: o.code }));
      out["cv_takes_entry_code"] = await attempt(tx, (sp) =>
        sp.unsafe(`select private.cv_issue_commit($1, $2, $3, date_trunc('second', now()), now() + interval '1 year', '{}'::jsonb, $4, $4, $5, 'on_demand')`, [
          SAMI,
          entry,
          k.keyId,
          "e".repeat(64),
          "A".repeat(86),
        ]),
      ).then((o) => (o.ok ? { ok: true } : { ok: false, code: o.code }));
      return out;
    }));

  it("the signed values themselves: a CV and a Record entry the stack signed, with the public key document that checks them", async () => {
    const out = await callCurrentStackSql(DB!, async (tx) => {
      await seed(tx);
      await installKey(tx);
      expect((await issueCv(tx, SAMI, "first"))["status"]).toBe("issued");
      await issueAndSeal(tx);
      const [cv] = (await tx.unsafe(
        `select code, key_id, to_char(issued_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as issued_at, to_char(expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as expires_at,
                snapshot, snapshot_hash, signature, content_hash from public.cv_records where user_id = $1`,
        [SAMI],
      )) as unknown as Row[];
      const [entry] = (await tx.unsafe(
        `select code, key_id, to_char(signed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as signed_at, payload, envelope_hash, signature
           from public.record_entries where user_id = $1 and kind = 'result'`,
        [SAMI],
      )) as unknown as Row[];
      // The public key file's rows as PostgREST serialises them (json of the row: timestamps in the database's time zone).
      const [keys] = (await tx.unsafe(
        `select json_agg(json_build_object('key_id', key_id, 'alg', algorithm, 'public_key', public_key, 'active_from', active_from, 'retired_at', retired_at) order by active_from)::text as keys
           from public.signing_keys`,
      )) as unknown as { keys: string }[];
      const envelopes = {
        cv: envelopeOf({ code: cv!["code"] as string, key_id: cv!["key_id"] as string, issued_at: cv!["issued_at"] as string, expires_at: cv!["expires_at"] as string, snapshot: cv!["snapshot"] as Row }),
        entry: recordEnvelopeOf({ code: entry!["code"] as string, key_id: entry!["key_id"] as string, signed_at: entry!["signed_at"] as string, payload: entry!["payload"] as Row }),
      };
      return { cv, entry, keys: JSON.parse(keys!.keys) as unknown, envelopes };
    });
    if (!out.ok) throw new Error(`verify/stack_signed: ${out.code} ${out.message}`);
    // Kept as values (never typed): what the stack signed is what the port must verify. Only public halves are kept.
    const file = join(DIR, "signed.json");
    // Signed values differ every run, so they are recorded once, on purpose (GOLDEN_RECORD_SIGNED=1), and from then
    // on the recording is checked with the web's own verifier instead of compared.
    if (process.env["GOLDEN_RECORD"] === "1" && process.env["GOLDEN_RECORD_SIGNED"] === "1") golden(file, "stack_signed", out.value, { uuids: false, times: false });
    const saved = (JSON.parse(readFileSync(file, "utf8")) as Record<string, StackSigned>)["stack_signed"]!;
    const key = (id: string) => saved.keys.find((k) => k.key_id === id)!.public_key;
    expect(await checkEnvelope(saved.envelopes.cv, saved.cv["snapshot_hash"] as string, saved.cv["signature"] as string, key(saved.cv["key_id"] as string))).toBe("valid");
    expect(
      await checkRecordEnvelope(saved.envelopes.entry, saved.entry["envelope_hash"] as string, saved.entry["signature"] as string, key(saved.entry["key_id"] as string)),
    ).toBe("valid");
  });
});
