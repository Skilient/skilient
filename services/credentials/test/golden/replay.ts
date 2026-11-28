/**
 * Replaying the credentials goldens (packages/testing/test/credentials.golden.test.ts) against the port. The rules,
 * as the earlier services' replays:
 *
 * 1. The same world (test/fixtures/credentials-world.ts). Other services' facts come from the fixture as their
 *    batch reads would return them (people's ProfileCards, identity's EmailsOf and ResolveEmails, ranking's TiersOf,
 *    work's CvFacts, community's RecordFacts); a change the recorder made to another service's rows (onboarding,
 *    the leaderboard choice, a ban, a deletion, a grant, a signup) is that service's event or batch read here.
 *    Credentials' own tables are read under the recorded names and columns (names from the fixture).
 * 2. Other services' rows the stack's functions wrote (notify's notifications) are dropped from every `changes`;
 *    their effects are credentials' events, asserted by the contract tests.
 * 3. Refusals through src/refusals.ts (SQLSTATE and wording). A signed-out caller's grant refusal on the stack is
 *    the port's not_signed_in (compared by code). Staff role and two-factor checks are the handler's: replayed as
 *    the handler makes them.
 * 4. Closed events: what community publishes for the recorder's close-out is built here from the same rows
 *    (`closedEvent`), and fed with the facts community's RecordFacts returns.
 * 5. Values made at random or from the clock are compared as their type (`typed`, the recorder's own function);
 *    signing uses a key made by the replay.
 * 6. Matching held claims at signup is user.created's (with identity's EmailsOf), as the stack's trigger did.
 */
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ConnectError } from "@connectrpc/connect";
import { refusalReason, uuidv7 } from "@skilient/platform";
import { normalise } from "@skilient/testing";
import { startPostgres, type TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { expect } from "vitest";
import * as F from "../../../../packages/testing/test/fixtures/credentials-world";
import { fill as fillDoc } from "../../src/domain/people";
import { emailHash, fillSocieties } from "../../src/domain/record";
import type { Account, Profile, Tier } from "../../src/ports";
import { REFUSALS, refusalText, type RefusalReason } from "../../src/refusals";
import { installKey, type ActiveKey } from "../../src/signing/keys";
import { generateSigningKey } from "../../src/signing/sign";
import { applyCopyEvent, applyIssuingEvent } from "../../src/store/consumers";
import { emptyFacts, type IssuingFacts } from "../../src/store/issuing";
import { sealEntry } from "../../src/store/record";
import type { SnapshotInputs } from "../../src/store/snapshot";

export { F };
export type Tx = postgres.TransactionSql;
type Row = Record<string, unknown>;
export const MIGRATIONS = join(import.meta.dirname, "../../migrations");
const DIR = join(import.meta.dirname, "../../../../packages/testing/test/golden/credentials");
export const exportSecret = randomBytes(32).toString("hex");

// ---------------------------------------------------------------------------
// Rule 1: the other services' facts, mutable as the recorder changed them
// ---------------------------------------------------------------------------
export const world = {
  profiles: new Map<string, Profile>(),
  accounts: new Map<string, Account>(),
  tiers: new Map<string, Tier>(),
};
const profileOf = (u: string): Profile => ({
  name: F.NAME[u]!,
  username: F.USERNAME[u]!,
  universityId: F.UNI_OF[u]!,
  university: F.UNIVERSITIES.find((x) => x.id === F.UNI_OF[u])!.name,
  department: F.DEPARTMENT,
  year: F.BATCH,
  role: "student",
  onboardingComplete: true,
  leaderboardOptOut: false,
});
function resetWorld(): void {
  world.profiles = new Map(F.USERS.map((u) => [u, profileOf(u)]));
  world.accounts = new Map(F.USERS.map((u) => [u, { email: F.EMAIL[u]!, confirmed: true, banned: false }]));
  world.tiers = new Map([[F.SAMI, { tier: F.TIER, ranked: true, percentile: F.PERCENTILE }]]);
}
/** The recorder's signup of Zara (identity's account, people's profile). */
export function signUp(u: string): void {
  world.profiles.set(u, profileOf(u));
  world.accounts.set(u, { email: F.EMAIL[u]!, confirmed: true, banned: false });
}

export const inputsFor = (u: string): SnapshotInputs => ({ profile: world.profiles.get(u), account: world.accounts.get(u), tier: world.tiers.get(u), work: F.workFactsFor(u) });
export const eligibleNow = (u: string) => {
  const p = world.profiles.get(u);
  return Boolean(p && p.role === "student" && p.onboardingComplete && p.username && p.universityId && !world.accounts.get(u)?.banned);
};
export const myHash = (u: string) => {
  const a = world.accounts.get(u);
  return a?.confirmed ? emailHash(a.email) : null;
};

/** Names and societies as the handler fills them (people's ProfileCards, community's RecordFacts). */
export const SOCIETIES = new Map([
  [F.SOC, { name: F.SOC_NAME, slug: F.SOC_SLUG, logoPath: null as string | null, status: "verified" }],
  [F.PENDING, { name: F.PENDING_NAME, slug: F.PENDING_SLUG, logoPath: null as string | null, status: "pending" }],
]);
export function fill<T>(doc: T): T {
  const people = fillDoc(doc, {
    person: (id) => (F.NAME[id] ? { name: F.NAME[id]!, username: F.USERNAME[id]!, avatar_path: null, department: F.DEPARTMENT, batch: F.BATCH } : undefined),
    university: (id) => F.UNIVERSITIES.find((u) => u.id === id)?.name,
  });
  return fillSocieties(people, SOCIETIES);
}

/** community's RecordFacts and the other issuing facts, for the fixture's world. */
export function facts(): IssuingFacts & { emails: Map<string, string | null> } {
  const f = { ...emptyFacts(), emails: new Map<string, string | null>() };
  f.events = new Map([
    [F.EVENT, { title: F.EVENT_TITLE, societyId: F.SOC }],
    [F.EVENT_PENDING, { title: "Blitz night", societyId: F.PENDING }],
  ]);
  f.terms = new Map([
    [F.TERM_PRIYA, { title: F.TERM_TITLE_PRIYA, societyId: F.SOC }],
    [F.TERM_OSMAN, { title: F.TERM_TITLE_OSMAN, societyId: F.SOC }],
  ]);
  f.labels = new Map([[`${F.EVENT}:${F.SAMI}`, F.RESULT_LABEL]]);
  f.walkIns = new Map([[F.WALK_IN, F.EMAIL[F.ZARA]!]]);
  f.societies = new Map([...SOCIETIES].map(([k, s]) => [k, { name: s.name, status: s.status }]));
  f.accounts = new Map([[F.EMAIL[F.ZARA]!, world.accounts.has(F.ZARA) ? F.ZARA : null]]);
  f.ventures = new Map([[F.VENTURE, F.VENTURE_TITLE]]);
  f.names = new Map(F.ALL_USERS.map((u) => [u, F.NAME[u]!]));
  for (const [u, a] of world.accounts) f.emails.set(u, a.confirmed ? a.email : null);
  return f;
}

const ev = (type: string, producer: string, payload: Row, subjects: string[] = [], at?: string) => ({ type, producer, version: 1, payload, subjects, ...(at ? { at } : {}) });
export const issue = async (tx: Tx, type: string, producer: string, payload: Row, at?: string) =>
  expect(await applyIssuingEvent(tx, ev(type, producer, payload, [], at), facts())).toBe("applied");
export const copy = async (tx: Tx, type: string, producer: string, payload: Row, subjects: string[] = []) =>
  expect(await applyCopyEvent(tx, ev(type, producer, payload, subjects))).toBe("applied");

/** Rule 4: event.closed as community publishes it for the recorder's close-out (`seedEvent` plus Osman's issue). */
export async function closedEvent(tx: Tx, event = F.EVENT): Promise<Row> {
  const [t] = await tx<{ s1: Date; ends: string }[]>`
    select now() - interval '3 days' as s1, ((now() - interval '2 days') at time zone 'Asia/Karachi')::date::text as ends`;
  const at = (mins: number) => new Date(t!.s1.getTime() + mins * 60_000).toISOString();
  if (event === F.EVENT_PENDING)
    return {
      event_id: F.EVENT_PENDING,
      society_id: F.PENDING,
      university_id: F.UNI_A,
      society_verified: false,
      auto: false,
      issued_by: F.NIDA,
      ends_on: t!.ends,
      sessions: 1,
      hours: 24,
      team_event: false,
      record_kinds: ["attended"],
      attended: [{ user_id: F.SAMI, first_at: at(0), self_added: false }],
      completed: [],
      results: [],
      volunteer: [],
      walk_ins: [],
    };
  return {
    event_id: F.EVENT,
    society_id: F.SOC,
    university_id: F.UNI_A,
    society_verified: true,
    auto: false,
    issued_by: F.OSMAN,
    ends_on: t!.ends,
    sessions: 2,
    hours: 4,
    team_event: false,
    record_kinds: ["attended", "completed", "result"],
    attended: [
      { user_id: F.MEHR, first_at: at(10), self_added: true },
      { user_id: F.OSMAN, first_at: at(1), self_added: true },
      { user_id: F.SAMI, first_at: at(5), self_added: false },
    ],
    completed: [{ user_id: F.SAMI, sessions: 2, self_added: false }],
    results: [
      { user_id: F.SAMI, place: 1, entrants: 3, set_by_self: false, labelled: true },
      { user_id: F.MEHR, place: 2, entrants: 3, set_by_self: false, labelled: false },
    ],
    volunteer: [{ user_id: F.MEHR, minutes: 210, self_logged: false }],
    walk_ins: [{ attendee_id: F.WALK_IN, email_hash: emailHash(F.EMAIL[F.ZARA]!), first_at: at(20) }],
  };
}

// ---------------------------------------------------------------------------
// Seed: officers (community's group.member_changed), the signing key
// ---------------------------------------------------------------------------
export let key: ActiveKey;

export async function seed(tx: Tx): Promise<void> {
  resetWorld();
  const member = (society: string, user: string, role: string) =>
    copy(tx, "group.member_changed", "svc_community", { kind: "society", group_id: society, user_id: user, member: true, role }, [society, user]);
  await member(F.SOC, F.PRIYA, "president");
  await member(F.SOC, F.OSMAN, "officer");
  await member(F.PENDING, F.NIDA, "president");
  await tx`create temp table names (id uuid primary key, name text) on commit drop`;
  await tx`insert into names select * from unnest(${F.ALL_USERS}::uuid[], ${F.ALL_USERS.map((u) => F.NAME[u]!)}::text[])`;
}

/** A Student Pro grant (billing's entitlement.changed; the recorder inserted entitlement_grants). */
export const grant = (tx: Tx, user: string, k: string) => copy(tx, "entitlement.changed", "svc_billing", { subject_id: user, key: k, value: true });

/** The record-sign jobs for every pending entry, in the recorder's order; returns the payloads signed. */
export async function sealPending(tx: Tx): Promise<Row[]> {
  const pending = await tx<{ id: string }[]>`
    select e.id::text from credentials.record_entries e left join names n on n.id = e.user_id where e.status = 'pending'
     order by e.kind, e.title, e.user_id`;
  const out: Row[] = [];
  for (const { id } of pending) {
    await sealEntry(tx, id, key, async (u) => {
      const p = world.profiles.get(u);
      return p ? { name: p.name, university: p.university } : null;
    });
    const [r] = await tx<{ payload: Row }[]>`select payload from credentials.record_entries where id = ${id}`;
    out.push(r!.payload);
  }
  return out;
}

/** Entries made in one transaction share issued_at: moved apart as the recorder did (by holder, then kind). */
export async function apart(tx: Tx): Promise<void> {
  await tx`
    update credentials.record_entries e set issued_at = now() - make_interval(mins => r.n::int)
      from (select x.id, row_number() over (order by coalesce(n.name, ''), x.kind) as n
              from credentials.record_entries x left join names n on n.id = x.user_id where x.issuer_id = ${F.SOC}) r
     where r.id = e.id`;
}

export async function issueAndSeal(tx: Tx): Promise<void> {
  await issue(tx, "event.closed", "svc_community", await closedEvent(tx));
  await apart(tx);
  await sealPending(tx);
}

// ---------------------------------------------------------------------------
// Rule 1: credentials' tables under the recorded names
// ---------------------------------------------------------------------------
const NAME_OF = (col: string) => `(select n.name from names n where n.id = x.${col})`;
export const RENAMED: Record<string, string> = {
  "public.cv_settings": `select ${NAME_OF("user_id")} as who, x.sections, x.show_percentile, x.show_email, x.visibility, cardinality(x.record_entries) as entries
       from credentials.cv_settings x order by 1`,
  "public.cv_records": `select ${NAME_OF("user_id")} as who, x.version, x.source, x.template, x.snapshot is not null as has_snapshot, x.superseded_by is not null as superseded,
            x.revoked_reason, ${NAME_OF("revoked_by")} as revoked_by from credentials.cv_records x where x.user_id is not null order by 1, 2`,
  "public.cv_share_links": `select ${NAME_OF("user_id")} as who, x.token_hash, x.label, x.expires_at is not null as expires, x.revoked_reason, x.view_count, x.last_viewed_at is not null as viewed
       from credentials.cv_share_links x order by 1, 2`,
  "public.cv_views": `select ${NAME_OF("user_id")} as who, x.source, x.viewer_key, x.record_id is not null as has_record, x.link_id is not null as has_link
       from credentials.cv_views x order by 1, 3`,
  "public.cv_pdf_exports": `select ${NAME_OF("user_id")} as who, x.id, x.template, x.paper, x.pdf_hash, x.bytes, x.file_deleted_at is not null as file_deleted
       from credentials.cv_pdf_exports x where x.user_id is not null order by 1, 2`,
  "public.record_entries": `select coalesce(${NAME_OF("user_id")}, '(held)') as who, x.claim_email_hash, x.kind, x.issuer_type, x.issuer_name, x.source, x.source_id, x.title, x.evidence,
            x.occurred_on::text, x.status, ${NAME_OF("issued_by")} as issued_by, ${NAME_OF("confirmed_by")} as confirmed_by, x.supersedes is not null as corrects,
            x.superseded_by is not null as superseded, x.code is not null as signed, x.revoked_category, x.revoked_reason, ${NAME_OF("revoked_by")} as revoked_by,
            x.hidden, x.pinned_at is not null as pinned
       from credentials.record_entries x order by 1, 3, 8, 11, 14`,
  "public.record_claims": `select x.email_hash, x.event_id, ${NAME_OF("user_id")} as matched, x.claimed_at is not null as claimed, x.sent_at is not null as sent
       from credentials.record_claims x order by 1`,
  "public.record_share_links": `select ${NAME_OF("user_id")} as who, x.token_hash, x.label, x.revoked_at is not null as revoked, x.view_count, x.last_viewed_at is not null as viewed
       from credentials.record_share_links x order by 1, 2`,
  "public.record_corrections": `select ${NAME_OF("user_id")} as who, (select e.kind from credentials.record_entries e where e.id = x.entry_id) as kind, x.note, x.status,
            ${NAME_OF("decided_by")} as decided_by, x.decision_note from credentials.record_corrections x order by 1, 2`,
  "public.record_pdf_exports": `select ${NAME_OF("user_id")} as who, x.id, x.kind, x.entry_id is not null as has_entry, x.holder_name, cardinality(x.codes) as codes, x.pdf_hash, x.bytes
       from credentials.record_pdf_exports x where x.user_id is not null order by 1, 2`,
  "public.ops_audit_log": `select ${NAME_OF("actor_id")} as staff, x.action, x.target_type, x.reason, x.before, x.after from credentials.audit_log x where x.scope = 'staff' order by 2, 4`,
  "public.society_audit_log": `select ${NAME_OF("actor_id")} as actor, x.action, x.before, x.after from credentials.audit_log x where x.scope = 'society' order by 2, 1`,
};
export const FOREIGN = new Set(["public.notifications"]);

export async function snapshot(tx: Tx): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const [table, text] of Object.entries(RENAMED)) out[table] = (await tx.unsafe(text)).map((r) => JSON.stringify(r));
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

/** Pass `fn` only for a signed-out caller (the stack's grant refusal). */
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
      return { ok: false, code: r.sqlstate, message: refusalText(reason!, values) };
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

export async function job<T>(tx: Tx, run: (sp: Tx) => Promise<T>) {
  const before = await snapshot(tx);
  const value = await tx.savepoint((sp) => run(sp));
  return { value: value ?? null, changes: changes(before, await snapshot(tx)) };
}

export function ok(o: Outcome): Row & string {
  if (!o.ok) throw new Error(`expected success: ${o.code} ${o.message}`);
  return o.value as Row & string;
}

export async function startWorld(): Promise<{ pg: TestDatabase; sql: postgres.Sql }> {
  if (process.env["GOLDEN_RECORD"] === "1") throw new Error("golden replays never record; unset GOLDEN_RECORD");
  const pg = await startPostgres();
  const sql = await pg.service("credentials", MIGRATIONS);
  key = await installKey(sql, (({ keyId, privateKey }) => ({ keyId, privateKey }))(generateSigningKey()));
  return { pg, sql };
}

/** Rule 2: drops foreign tables from every `changes`. */
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
  const actual = renumber(dropForeign(normalise(F.typed(JSON.parse(JSON.stringify(value))))));
  const expected = renumber(dropForeign(recorded[name]));
  if (process.env["GOLDEN_DIFF_DIR"] && JSON.stringify(actual) !== JSON.stringify(expected))
    writeFileSync(join(process.env["GOLDEN_DIFF_DIR"], `${group}-${name}.json`), JSON.stringify({ actual, expected }, null, 1));
  expect(actual).toEqual(expected);
}

export const newId = () => uuidv7();
