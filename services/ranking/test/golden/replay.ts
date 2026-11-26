/**
 * Replaying the ranking goldens (packages/testing/test/ranking.golden.test.ts) against the port. The rules, as
 * the earlier services' replays:
 *
 * 1. The same world: test/fixtures/ranking-reference.ts, built here in ranking's own schema from the events its
 *    owners publish (`applyCopyEvent`: profiles, friendships and blocks from people; ventures, completions,
 *    contributions, pull requests, join requests, skills, endorsements and credentials from work; posts and
 *    answers from content; the Record from credentials; societies from community). What the stack's fixture
 *    wrote by hand as ranking's own rows is written here by hand too: the previous run's scores, penalties, the
 *    exam period and last week's snapshot.
 * 2. Names are people's and titles their owners' (rule 4 of the earlier replays): the port returns ids and these
 *    helpers join the fixture's names, as web joins ProfileCards and the owners' batch reads. The score page's
 *    names other than skills are compared by the ids web will ask for.
 * 3. Refusals through src/refusals.ts (SQLSTATE and wording); a signed-out caller's grant refusal on the stack
 *    equals the port's refusal for a caller with no user (compared by code).
 * 4. An evidence list whose stack order has ties (pull requests merged at the same moment) is compared as a set.
 * 5. The board's place among equal totals is by user id (the port has no names); no recorded board has a tie.
 * 6. A double precision value (the percentile) is compared at 15 significant digits: the stack's session printed
 *    it so (extra_float_digits), the test container prints all 17; the stored value is the same. Likewise a
 *    numeric(8,2) kept its scale inside the stack's JSON ("414.00"); the port's JSON number has none.
 * 7. `claimed_by_me` on an unclaimed flag was SQL null on the stack (`claimed_by = me`); the port says false.
 * 8. A recorded step that never reached the stack (the recorder had no id to send: a client-side UNDEFINED_VALUE)
 *    is not replayed; exams_remove.json records the same steps with an id.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ConnectError } from "@connectrpc/connect";
import { refusalReason } from "@skilient/platform";
import { normalise } from "@skilient/testing";
import { startPostgres, type TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { expect } from "vitest";
import * as F from "../../../../packages/testing/test/fixtures/ranking-reference";
import { REFUSALS, refusalText, type RefusalReason } from "../../src/refusals";
import { applyCopyEvent } from "../../src/store/copies";
import { runAll as runAllWith } from "../../src/store/run";

export { F };
export type Tx = postgres.TransactionSql;
type Row = Record<string, unknown>;
export const MIGRATIONS = join(import.meta.dirname, "../../migrations");
const GOLDEN = join(import.meta.dirname, "../../../../packages/testing/test/golden/ranking");

export async function startWorld(): Promise<{ pg: TestDatabase; sql: postgres.Sql }> {
  const pg = await startPostgres();
  const sql = await pg.service("ranking", MIGRATIONS);
  return { pg, sql };
}

/** Runs one case in a transaction that is rolled back (now() is fixed inside it, as on the stack). */
export async function inCase<T>(sql: postgres.Sql, run: (tx: Tx) => Promise<T>): Promise<T> {
  let out: T | undefined;
  const ROLLBACK = Symbol("rollback");
  try {
    await sql.begin(async (tx) => {
      out = await run(tx);
      throw ROLLBACK;
    });
  } catch (e) {
    if (e !== ROLLBACK) throw e;
  }
  return out as T;
}

/** A whole nightly run inside the case's transaction (each step a savepoint, as each was a commit). */
export const runAll = (tx: Tx, asOf: string) => runAllWith({ begin: (fn) => tx.savepoint(fn) as never }, new Date(asOf));

// ---------------------------------------------------------------------------
// The world, as events
// ---------------------------------------------------------------------------
const ev = (tx: Tx, type: string, producer: string, subjects: string[], payload: Row, at?: string) =>
  applyCopyEvent(tx, { type, producer, version: 1, subjects, payload, ...(at ? { at } : {}) }).then((o) => {
    if (o !== "applied") throw new Error(`${type}: ${o}`);
  });
const people = (tx: Tx, type: string, s: string[], p: Row) => ev(tx, type, "svc_people", s, p);
const work = (tx: Tx, type: string, s: string[], p: Row, at?: string) => ev(tx, type, "svc_work", s, p, at);
export const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

export function profile(s: F.Student, extra: Row = {}): Row {
  return {
    user_id: s.id,
    role: "student",
    university_id: s.university,
    department_id: null,
    department_hash: sha(s.department),
    graduation_year: s.batch,
    visibility: "university",
    status: "active",
    read_receipts: true,
    leaderboard_opt_out: false,
    recruiter_visible: false,
    looking_for: [],
    availability: [],
    remote_ok: false,
    onboarding_complete: true,
    ...extra,
  };
}

const iso = (pktText: string) => new Date(F.pkt(pktText)).toISOString();
const verified = (x: F.Entry) => (x.source === "github" ? true : x.confirmer !== null);

/** The completion work freezes (record_venture_completion) from the fixture's entries. */
export function completionOf(v: F.Venture) {
  const members = v.members.map((m) => {
    const mine = F.ENTRIES.filter((x) => x.venture === v.id && x.author === m);
    return {
      user_id: m,
      github_days: new Set(mine.filter((x) => x.source === "github").map((x) => new Date(new Date(F.pkt(x.at)).getTime() + 5 * 3600_000).toISOString().slice(0, 10))).size,
      verified_entries: mine.filter((x) => x.source === "manual" && verified(x)).length,
      unconfirmed_entries: mine.filter((x) => !verified(x)).length,
    };
  });
  const weeks = Math.round(((new Date(F.pkt(v.completed!)).getTime() - new Date(F.pkt(v.created)).getTime()) / 604_800_000) * 100) / 100;
  return {
    completed_at: iso(v.completed!),
    team_size: v.members.length,
    weeks,
    skill_tags: v.skills.length,
    deliverables: v.deliverables,
    verified_members: members.filter((m) => F.ENTRIES.some((x) => x.venture === v.id && x.author === m.user_id && verified(x))).length,
    members,
  };
}

async function ventures(tx: Tx, list: F.Venture[]): Promise<void> {
  for (const v of list)
    await work(tx, "venture.updated", [v.id, v.owner], { venture_id: v.id, owner_id: v.owner, university_id: F.UNI_A, status: v.status === "completed" ? "in_progress" : v.status, visibility: "university" });
}

export async function seed(tx: Tx, options: { extras?: boolean } = {}): Promise<void> {
  for (const s of F.STUDENTS) await people(tx, "profile.updated", [s.id], profile(s));
  for (const [a, b] of F.FRIENDSHIPS) await people(tx, "friendship.changed", [a, b], { user_a: a, user_b: b, friends: true });
  await ventures(tx, F.VENTURES);
  for (const x of F.ENTRIES)
    await work(tx, "contribution.logged", [F.fid(x.tag), x.author], {
      contribution_id: F.fid(x.tag),
      venture_id: x.venture,
      user_id: x.author,
      source: x.source,
      before_venture: false,
      corrects_id: null,
      created_at: iso(x.at),
    });
  for (const x of F.ENTRIES.filter((y) => y.confirmer))
    await work(tx, "contribution.confirmed", [F.fid(x.tag), x.confirmer!], { contribution_id: F.fid(x.tag), confirmer_id: x.confirmer, confirmed_at: iso(x.confirmedAt!) });
  for (const v of F.VENTURES.filter((y) => y.completed))
    await work(tx, "venture.completed", [v.id, ...v.members], { venture_id: v.id, owner_id: v.owner, university_id: F.UNI_A, visibility: "university", member_ids: v.members, completion: completionOf(v) });
  for (const p of F.PULL_REQUESTS)
    await work(tx, "pull_request.recorded", [p.user], { user_id: p.user, repo_id: p.repoId, number: p.number, repo: p.repo, merged_at: iso(p.mergedAt), counted: p.counted });
  for (const p of F.POSTS) {
    await ev(tx, "post.created", "svc_content", [F.fid(p.tag), p.author], { post_id: F.fid(p.tag), author_id: p.author, type: "general", audience: "university", created_at: iso(p.at) });
    for (let i = 1; i <= p.answers; i++)
      await ev(tx, "survey.answered", "svc_content", [F.fid(p.tag), F.Q(i)], { post_id: F.fid(p.tag), user_id: F.Q(i), dimension: "informative", answer: F.answerOf(p, i), weight: 1 }, F.answeredAt(p));
  }
  for (const a of F.APPLICATIONS)
    await work(tx, "application.changed", [a.id, a.candidate, a.owner], {
      application_id: a.id,
      venture_id: a.venture,
      candidate_id: a.candidate,
      owner_id: a.owner,
      status: a.status,
      previous_status: "pending",
      created_at: new Date(a.created).toISOString(),
      decided_at: new Date(a.decided).toISOString(),
    });
  for (const c of F.CREDENTIALS)
    await work(tx, "credential.changed", [c.id, c.user], {
      credential_id: c.id,
      user_id: c.user,
      status: c.status,
      file_path: null,
      expires_on: c.expires,
      recognised: c.issuer !== null,
      created_at: new Date(F.CREDENTIAL_CREATED).toISOString(),
    });
  await endorse(tx, F.ENDORSEMENTS);
  for (const p of F.PENALTIES)
    await tx`insert into ranking.ranking_adjustments (id, user_id, kind, severity, reason, created_at) values (${p.id}, ${p.user}, 'penalty', ${p.severity}, ${p.reason}, ${F.pkt(p.at)})`;
  for (const x of F.EXAM_PERIODS)
    await tx`insert into ranking.exam_periods (id, university_id, starts_on, ends_on, reason) values (${x.id}, ${x.university}, ${x.starts}, ${x.ends}, ${x.reason})`;
  for (const p of F.PREVIOUS)
    await tx`
      insert into ranking.ranking_scores (user_id, formula_version, components, proof, momentum, adjustments, total, ranked, tier, momentum_peak, computed_at, published_at)
      values (${p.user}, 1, '{}'::jsonb, 0, 0, 0, 0, ${p.ranked}, ${p.tier}, ${p.peak}, now(), now())`;
  for (const [u, s, l] of F.SKILLS) await work(tx, "skill.changed", [u], { user_id: u, skill_id: s, skill_label: F.LABEL[s], level: l, category: F.CATEGORY[s] });
  for (const s of F.SOCIETIES)
    await ev(tx, "society.status_changed", "svc_community", [s.id], { society_id: s.id, university_id: F.UNI_A, status: "verified", verified_at: iso(s.verified) });
  for (const r of F.RECORD) {
    const signed = new Date(F.signedAt(r)).toISOString();
    const { line: _line, ...evidence } = r.evidence as Row;
    await ev(tx, "record.sealed", "svc_credentials", [r.id, r.user], {
      entry_id: r.id,
      user_id: r.user,
      kind: r.kind,
      issuer_type: r.society ? "society" : "skilient",
      issuer_id: r.society ? F.SOC(r.society) : null,
      occurred_on: r.on,
      signed_at: signed,
      evidence,
    });
    if (r.status !== "sealed") await ev(tx, "record.revoked", "svc_credentials", [r.id, r.user], { entry_id: r.id, status: r.status });
  }
  if (options.extras) {
    const by = (id: string) => F.STUDENTS.find((s) => s.id === id)!;
    await people(tx, "profile.updated", [F.OPTED_OUT], profile(by(F.OPTED_OUT), { leaderboard_opt_out: true }));
    await people(tx, "profile.updated", [F.GRADUATE], profile(by(F.GRADUATE), { status: "graduate", graduated_at: new Date(Date.now() - 395 * 86_400_000).toISOString() }));
    await people(tx, "profile.updated", [F.DELETING], profile(by(F.DELETING), { status: "deleting" }));
    await people(tx, "block.changed", F.BLOCK, { blocker_id: F.BLOCK[0], blocked_id: F.BLOCK[1], blocked: true });
    for (const s of F.SNAPSHOT_ROWS)
      await tx`insert into ranking.ranking_snapshots (user_id, week, formula_version, components, total, ranked, tier) values (${s.user}, ${F.LAST_WEEK}, 2, '{}'::jsonb, ${s.total}, ${s.ranked}, ${s.tier})`;
  }
}

async function endorse(tx: Tx, list: F.Endorsement[]): Promise<void> {
  for (const x of list) {
    await work(tx, "endorsement.given", [x.endorsee, x.endorser], {
      endorsement_ids: [x.id],
      endorser_id: x.endorser,
      endorsee_id: x.endorsee,
      venture_id: x.venture,
      skill_ids: [x.skill],
      created_at: iso(x.at),
    });
    if (x.hidden) await work(tx, "endorsement.hidden", [x.endorsee], { endorsement_id: x.id, endorsee_id: x.endorsee, hidden: true });
  }
}

export async function seedRing(tx: Tx): Promise<void> {
  await ventures(tx, [F.RING_VENTURE]);
  await endorse(tx, F.RING_ENDORSEMENTS);
}

// ---------------------------------------------------------------------------
// Reads in the recorded shapes
// ---------------------------------------------------------------------------
export const ALL = F.STUDENTS.map((s) => s.id);
const student = (id: string) => F.STUDENTS.find((s) => s.id === id);
export const nameOf = (id: string | null) => (id && student(id) ? F.nameOf(student(id)!) : null);
export const usernameOf = (id: string) => F.usernameOf(student(id)!);
export const universityName = (id: string | null) => F.UNIVERSITIES.find((u) => u.id === id)?.name ?? null;
export const ventureTitle = (id: string) => [...F.VENTURES, F.RING_VENTURE].find((v) => v.id === id)?.title ?? null;

export const scores = (tx: Tx, users: string[] = ALL) =>
  tx`select s.user_id, s.formula_version, s.components, s.proof, s.momentum, s.adjustments, s.total, s.ranked, s.tier, s.tier_met, s.percentile,
            s.below_since::text, s.momentum_peak, s.held, s.held_total
       from ranking.ranking_scores s where s.user_id = any(${users}::uuid[]) order by s.user_id`.then((r) => [...r]);
export const flags = (tx: Tx) =>
  tx`select f.kind, f.user_id, f.members, f.endorsement_ids, f.detail, f.status, f.claimed_by, f.reviewed_by, f.reason, f.applied_at is not null as applied
       from ranking.anti_gaming_flags f where f.members && ${ALL}::uuid[] order by f.kind, f.created_at`.then((r) => [...r]);
export const audit = (tx: Tx, staff: string) =>
  tx`select l.staff_id, l.action, l.target_type, l.reason, l.before, l.after from ranking.audit_log l where l.staff_id = ${staff} order by l.created_at, l.action`.then((r) => [...r]);

/** An outcome in the recorded shape: a value, or a refusal as its SQLSTATE and today's wording (rule 3). */
export type Outcome = { ok: true; value: unknown } | { ok: false; code: string; message: string };
export async function outcome(run: () => unknown): Promise<Outcome> {
  try {
    return { ok: true, value: (await run()) ?? null };
  } catch (error) {
    if (error instanceof ConnectError) {
      const reason = refusalReason(error) as RefusalReason | null;
      if (!reason || !REFUSALS[reason]) throw error;
      const values = JSON.parse(error.metadata.get("x-refusal-values") ?? "[]") as (string | number)[];
      return { ok: false, code: REFUSALS[reason].sqlstate, message: refusalText(reason, values) };
    }
    throw error;
  }
}
/** A step in a savepoint, so a refusal leaves the case's transaction usable. */
export const call = (tx: Tx, run: (sp: Tx) => unknown) => outcome(() => tx.savepoint((sp) => Promise.resolve(run(sp))));

// ---------------------------------------------------------------------------
// Comparing
// ---------------------------------------------------------------------------
const cases = new Map<string, Record<string, unknown>>();
function recorded(file: string): Record<string, unknown> {
  if (!cases.has(file)) cases.set(file, JSON.parse(readFileSync(join(GOLDEN, `${file}.json`), "utf8")) as Record<string, unknown>);
  return cases.get(file)!;
}

/** Rule 4: lists whose stack order has ties are compared as sets (each `prs.items`). */
function untie(v: unknown): unknown {
  if (typeof v === "number" && !Number.isInteger(v)) return Number(v.toPrecision(15));
  if (Array.isArray(v)) return v.map(untie);
  if (v && typeof v === "object") {
    const o = Object.fromEntries(Object.entries(v as Row).map(([k, x]) => [k, untie(x)])) as Row;
    if (Array.isArray(o["items"]) && typeof o["count"] === "number") o["items"] = [...(o["items"] as unknown[])].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    return o;
  }
  return v;
}

/** A grant refusal on the stack (a signed-out caller) equals any refusal the port gives a caller with no user (rule 3). */
function grantRefusals(expected: unknown, actual: unknown): unknown {
  if (Array.isArray(expected) && Array.isArray(actual)) return actual.map((a, i) => grantRefusals(expected[i], a));
  if (expected && typeof expected === "object" && actual && typeof actual === "object") {
    const e = expected as Row;
    const a = actual as Row;
    if (e["ok"] === false && typeof e["message"] === "string" && (e["message"] as string).startsWith("permission denied for function") && a["ok"] === false && a["code"] === e["code"])
      return e;
    return Object.fromEntries(Object.entries(a).map(([k, x]) => [k, grantRefusals(e[k], x)]));
  }
  return actual;
}

export function expectGolden(file: string, name: string, actual: unknown, options: { skip?: string[] } = {}): void {
  let expected = recorded(file)[name];
  if (expected === undefined) throw new Error(`no golden case ${file}#${name}`);
  if (options.skip) expected = Object.fromEntries(Object.entries(expected as Row).filter(([k]) => !options.skip!.includes(k)));
  const a = untie(grantRefusals(expected, normalise(actual)));
  expect(a).toEqual(untie(expected));
}
