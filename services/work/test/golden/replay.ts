/**
 * Replaying the work goldens against the port (CLAUDE.md, "How to work" 4). Rules as content's and messaging's
 * (services/messaging/test/golden/replay.ts): work's tables under the recorded names (rule 1); notify's
 * notifications and messaging's chats dropped, their effects asserted through work's events where a case needs
 * them (rule 2); refusals through src/refusals.ts, a signed-out caller's grant refusal equal to any refusal the
 * port gives a caller with no user (rule 3); and other services' facts fed as their owners publish them
 * (rule 4): profiles, friendships and blocks from people's events, usernames from people's ResolveUsernames.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ConnectError } from "@connectrpc/connect";
import { refusalReason } from "@skilient/platform";
import { normalise } from "@skilient/testing";
import { startPostgres, type TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { expect } from "vitest";
import { REFUSALS, type RefusalReason } from "../../src/refusals";
import { applyCopyEvent } from "../../src/store/copies";

export type Tx = postgres.TransactionSql;
type Row = Record<string, unknown>;
export const MIGRATIONS = join(import.meta.dirname, "../../migrations");

export const UNI_A = "9a000000-0000-4000-8000-00000000000a";
export const UNI_B = "9a000000-0000-4000-8000-00000000000b";
export const OMAR = "9b000000-0000-4000-8000-000000000001";
export const MINA = "9b000000-0000-4000-8000-000000000002";
export const ASAD = "9b000000-0000-4000-8000-000000000003";
export const ULA = "9b000000-0000-4000-8000-000000000004";
export const GUL = "9b000000-0000-4000-8000-000000000005";
export const BINA = "9b000000-0000-4000-8000-000000000006";
export const USERS = [OMAR, MINA, ASAD, ULA, GUL, BINA];
export const VENTURE = "9c000000-0000-4000-8000-000000000001";
export const OPEN = "9c000000-0000-4000-8000-000000000002";
export const ROLE = "9d000000-0000-4000-8000-000000000001";
export const UNKNOWN_VENTURE = "9c000000-0000-4000-8000-0000000000ff";
export const USERNAME: Record<string, string> = {
  [OMAR]: "wk_omar",
  [MINA]: "wk_mina",
  [ASAD]: "wk_asad",
  [ULA]: "wk_ula",
  [GUL]: "wk_gul",
  [BINA]: "wk_bina",
};
export const NAME: Record<string, string> = {
  [OMAR]: "Omar Heron",
  [MINA]: "Mina Heron",
  [ASAD]: "Asad Heron",
  [ULA]: "Ula Plover",
  [GUL]: "Gul Heron",
  [BINA]: "Bina Heron",
};
/** people's university names (rule 4). */
export const UNIVERSITY_NAME: Record<string, string> = {
  "9a000000-0000-4000-8000-00000000000a": "Work Golden University A",
  "9a000000-0000-4000-8000-00000000000b": "Work Golden University B",
};
const UNI_OF: Record<string, string> = { [OMAR]: UNI_A, [MINA]: UNI_A, [ASAD]: UNI_A, [ULA]: UNI_B, [GUL]: UNI_A, [BINA]: UNI_A };
const VISIBILITY_OF: Record<string, string> = { [MINA]: "friends", [ULA]: "global" };

/** people's ResolveUsernames, as the recorded profiles answer it (rule 4). */
export function resolve(name: string): string | null {
  const n = name.trim().toLowerCase();
  return Object.entries(USERNAME).find(([, u]) => u === n)?.[0] ?? null;
}

const pe = (type: string, producer: string, subjects: string[], payload: Row) => ({ type, producer, version: 1, subjects, payload });
export const profile = (tx: Tx, user: string, status = "active") =>
  applyCopyEvent(
    tx,
    pe("profile.updated", "svc_people", [user], {
      user_id: user,
      role: "student",
      university_id: UNI_OF[user],
      visibility: VISIBILITY_OF[user] ?? "university",
      status,
      onboarding_complete: true,
    }),
  );
export const befriend = (tx: Tx, a: string, b: string) => applyCopyEvent(tx, pe("friendship.changed", "svc_people", [a, b], { user_a: a, user_b: b, friends: true }));
export const block = (tx: Tx, a: string, b: string) => applyCopyEvent(tx, pe("block.changed", "svc_people", [a, b], { blocker_id: a, blocked_id: b, blocked: true }));

/** The recording's `seed`, as work receives it (rule 4) and its own rows written as the owner. */
export async function seed(tx: Tx): Promise<void> {
  for (const u of USERS) expect(await profile(tx, u, u === GUL ? "graduate" : "active")).toBe("applied");
  await tx`
    insert into work.ventures (id, owner_id, university_id, title, type, status, visibility, team_size, description, skill_ids, created_at)
    values (${VENTURE}, ${OMAR}, ${UNI_A}, 'Heron Robotics', 'project', 'recruiting', 'university', 4, 'A robot that sorts recycling.', '{react,typescript}', now() - interval '20 days'),
           (${OPEN}, ${MINA}, ${UNI_A}, 'Plover Pay', 'startup', 'in_progress', 'public', 3, 'Payments for campus stalls.', '{python}', now() - interval '20 days')`;
  await tx`
    insert into work.venture_members (venture_id, user_id, team_role, joined_at)
    values (${VENTURE}, ${OMAR}, 'lead', now() - interval '20 days'), (${OPEN}, ${MINA}, 'lead', now() - interval '20 days'),
           (${VENTURE}, ${MINA}, 'developer', now() - interval '19 days')`;
  await tx`insert into work.venture_roles (id, venture_id, title, skill_ids, slots, created_at) values (${ROLE}, ${VENTURE}, 'Frontend', '{react}', 1, now() - interval '20 days')`;
  await tx`insert into work.venture_questions (venture_id, position, body) values (${VENTURE}, 1, 'What have you built before?')`;
}

const VT = `(select v.title from work.ventures v where v.id = x.venture_id)`;
const owned = `(select id from work.ventures where owner_id = any($1))`;
/** Rule 1: work's tables under the recorded names and columns. */
export const RENAMED: Record<string, string> = {
  "public.ventures": `select x.title, x.type, x.owner_id, x.university_id, x.status, x.visibility, x.stage, x.pitch_url, x.affiliation, x.skill_ids,
            x.team_size, x.completed_at is not null as completed, x.abandoned_at is not null as abandoned
       from work.ventures x where x.owner_id = any($1) order by 1`,
  "public.venture_members": `select ${VT} as venture, x.user_id, x.team_role from work.venture_members x where x.user_id = any($1) order by 1, 2`,
  "public.venture_roles": `select ${VT} as venture, x.title, x.skill_ids, x.slots, x.filled from work.venture_roles x where x.venture_id in ${owned} order by 1, 2`,
  "public.venture_questions": `select ${VT} as venture, x.position, x.body from work.venture_questions x where x.venture_id in ${owned} order by 1, 2`,
  "public.application_threads": `select ${VT} as venture, x.candidate_id, x.owner_id, x.status, x.message, x.answers, x.decided_at is not null as decided,
            (select r.title from work.venture_roles r where r.id = x.role_id) as role
       from work.applications x where x.candidate_id = any($1) order by 1, 2, 4`,
  "public.application_messages": `select x.sender_id, x.body from work.application_messages x where x.sender_id = any($1) order by 1, 2`,
  "public.venture_invites": `select ${VT} as venture, x.invitee_id, x.inviter_id, x.status, x.responded_at is not null as responded from work.venture_invites x where x.invitee_id = any($1) order by 1, 2, 4`,
  "public.venture_follows": `select ${VT} as venture, x.user_id from work.venture_follows x where x.user_id = any($1) order by 1, 2`,
  "public.venture_updates": `select ${VT} as venture, x.author_id, x.body from work.venture_updates x where x.author_id = any($1) order by 1, 3`,
  "public.venture_deliverables": `select ${VT} as venture, x.label, x.url, x.added_by from work.venture_deliverables x where x.venture_id in ${owned} order by 1, 2`,
  "public.contributions": `select ${VT} as venture, x.user_id, x.kind, x.description, x.evidence_url, x.hours, x.source, x.corrects_id is not null as correction, x.skill_ids
       from work.contributions x where x.user_id = any($1) order by 1, 2, 4`,
  "public.contribution_confirmations": `select c.description, x.confirmer_id, x.confirmer_role from work.contribution_confirmations x join work.contributions c on c.id = x.contribution_id
      where x.confirmer_id = any($1) order by 1, 2`,
  "public.venture_completions": `select ${VT} as venture, x.owner_id, x.team_size, x.weeks, x.skill_tags, x.deliverables, x.verified_members, x.backfilled
       from work.venture_completions x where x.owner_id = any($1) order by 1`,
  "public.venture_completion_members": `select ${VT} as venture, x.user_id, x.github_days, x.verified_entries, x.unconfirmed_entries
       from work.venture_completion_members x where x.user_id = any($1) order by 1, 2`,
};
export const FOREIGN = new Set(["public.notifications"]);

export async function snapshot(tx: Tx): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const [table, text] of Object.entries(RENAMED)) out[table] = (await tx.unsafe(text, [USERS] as never[])).map((r) => JSON.stringify(r));
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

export type Outcome = { ok: true; value: unknown } | { ok: false; code: string; message: string };

/** Rule 3. Pass `fn` only for a signed-out caller. */
export async function outcome(run: () => unknown, fn?: string): Promise<Outcome> {
  try {
    return { ok: true, value: (await run()) ?? null };
  } catch (error) {
    if (error instanceof ConnectError) {
      if (fn) return { ok: false, code: "42501", message: `permission denied for function ${fn}` };
      const reason = refusalReason(error) as RefusalReason | null;
      const r = reason ? REFUSALS[reason] : undefined;
      if (!r) throw error;
      return { ok: false, code: r.sqlstate, message: r.text };
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

export async function startWorld(): Promise<{ pg: TestDatabase; sql: postgres.Sql }> {
  if (process.env["GOLDEN_RECORD"] === "1") throw new Error("golden replays never record; unset GOLDEN_RECORD");
  const pg = await startPostgres();
  const sql = await pg.service("work", MIGRATIONS);
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
    if (v && typeof v === "object")
      return Object.fromEntries(Object.entries(v as Row).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value);
}

const DIR = join(import.meta.dirname, "../../../../packages/testing/test/golden/work");

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
  expect(renumber(dropForeign(normalise(value)))).toEqual(renumber(dropForeign(recorded[name])));
}

/** Inserts a manual contribution as the owner, `hoursAgo` back (the recording's `entry`). */
export async function entry(tx: Tx, venture: string, user: string, description: string, hoursAgo = 1): Promise<string> {
  const [r] = await tx<{ id: string }[]>`
    insert into work.contributions (id, venture_id, user_id, kind, description, created_at)
    values (gen_random_uuid(), ${venture}, ${user}, 'code', ${description}, now() - make_interval(hours => ${hoursAgo})) returning id::text`;
  return r!.id;
}
