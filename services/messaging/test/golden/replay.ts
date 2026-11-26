/**
 * Replaying the messaging goldens against the port (CLAUDE.md, "How to work" 4). Rules as content's
 * (services/content/test/golden/replay.ts): messaging's tables under the recorded names (rule 1); notify's
 * notifications dropped, their recipients asserted through message.sent where a case needs it (rule 2);
 * refusals through src/refusals.ts, a signed-out caller's grant refusal equal to any refusal the port gives a
 * caller with no user (rule 3); and other services' facts fed as their owners publish them (rule 4): profiles,
 * friendships and blocks from people's events, the venture and its members from work's (W5), names from
 * people's ProfileCards, the venture title from work's batch read, a post's visibility from content's
 * VisiblePosts, an image's upload from media (W9), each through a fake.
 */
import { join } from "node:path";
import { readFileSync } from "node:fs";
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
const DIR = join(import.meta.dirname, "../../../../packages/testing/test/golden/messaging");
export const MIGRATIONS = join(import.meta.dirname, "../../migrations");

export const UNI_A = "8c000000-0000-4000-8000-00000000000a";
export const UNI_B = "8c000000-0000-4000-8000-00000000000b";
export const AMNA = "8d000000-0000-4000-8000-000000000001";
export const BASHIR = "8d000000-0000-4000-8000-000000000002";
export const CHAMAN = "8d000000-0000-4000-8000-000000000003";
export const DAUD = "8d000000-0000-4000-8000-000000000004";
export const ERUM = "8d000000-0000-4000-8000-000000000005";
export const FAIZ = "8d000000-0000-4000-8000-000000000006";
export const USERS = [AMNA, BASHIR, CHAMAN, DAUD, ERUM, FAIZ];
export const VENTURE = "8e000000-0000-4000-8000-000000000001";
export const UNKNOWN = "8f000000-0000-4000-8000-0000000000ff";
export const NAME: Record<string, string> = {
  [AMNA]: "Amna Kestrel",
  [BASHIR]: "Bashir Kestrel",
  [CHAMAN]: "Chaman Wyvern",
  [DAUD]: "Daud Kestrel",
  [ERUM]: "Erum Wyvern",
  [FAIZ]: "Faiz Kestrel",
};
export const USERNAME: Record<string, string> = {
  [AMNA]: "mg_amna",
  [BASHIR]: "mg_bashir",
  [CHAMAN]: "mg_chaman",
  [DAUD]: "mg_daud",
  [ERUM]: "mg_erum",
  [FAIZ]: "mg_faiz",
};
const UNI: Record<string, string> = { [AMNA]: UNI_A, [BASHIR]: UNI_A, [CHAMAN]: UNI_B, [DAUD]: UNI_A, [ERUM]: UNI_B, [FAIZ]: UNI_A };
const VISIBILITY: Record<string, string> = { [CHAMAN]: "global", [DAUD]: "friends" };

/** The fakes for the ports (rule 4). */
export const people = {
  async cards(ids: readonly string[]) {
    return new Map(ids.filter((id) => NAME[id]).map((id) => [id, { username: USERNAME[id]!, fullName: NAME[id]!, avatarPath: "" }]));
  },
  async resolve(names: readonly string[]) {
    const byName = new Map(Object.entries(USERNAME).map(([id, u]) => [u, id]));
    return new Map(names.filter((n) => byName.has(n)).map((n) => [n, byName.get(n)!]));
  },
};
export const ventures = { titles: async (ids: readonly string[]) => new Map<string, string>(ids.filter((v) => v === VENTURE).map((v) => [v, "Kestrel Robotics"])) };

const pe = (type: string, producer: string, subjects: string[], payload: Row) => ({ type, producer, version: 1, subjects, payload });
export const befriend = (tx: Tx, a: string, b: string) => applyCopyEvent(tx, pe("friendship.changed", "svc_people", [a, b], { user_a: a, user_b: b, friends: true }));
export const block = (tx: Tx, a: string, b: string) => applyCopyEvent(tx, pe("block.changed", "svc_people", [a, b], { blocker_id: a, blocked_id: b, blocked: true }));
export const setReceipts = (tx: Tx, user: string, on: boolean) =>
  applyCopyEvent(tx, pe("profile.updated", "svc_people", [user], { user_id: user, university_id: UNI[user], visibility: VISIBILITY[user] ?? "university", status: "active", read_receipts: on }));
export const joinTeam = (tx: Tx, user: string) => applyCopyEvent(tx, pe("group.member_changed", "svc_work", [VENTURE, user], { kind: "venture", group_id: VENTURE, user_id: user, member: true }));

/** The recording's `seed`, as messaging receives it (rule 4). */
export async function seed(tx: Tx): Promise<void> {
  for (const u of USERS) expect(await setReceipts(tx, u, true)).toBe("applied");
  await befriend(tx, AMNA, BASHIR);
  await befriend(tx, AMNA, DAUD);
  expect(await applyCopyEvent(tx, pe("venture.updated", "svc_work", [VENTURE], { venture_id: VENTURE, owner_id: FAIZ }))).toBe("applied");
  for (const m of [AMNA, BASHIR]) expect(await joinTeam(tx, m)).toBe("applied");
}

const THREAD = `case when t.type = 'group' then 'group:' || t.venture_id::text else 'dm:' || t.dm_key end`;
/** Rule 1: messaging's tables under the recorded names and columns. */
export const RENAMED: Record<string, (tx: Tx) => PromiseLike<readonly unknown[]>> = {
  "public.chat_threads": (tx) =>
    tx.unsafe(
      `select ${THREAD} as thread, t.type, t.last_message_at is not null as has_last, t.closed_at is not null as closed
         from messaging.threads t where t.venture_id = $2 or exists (select 1 from messaging.members m where m.thread_id = t.id and m.user_id = any($1)) order by 1`,
      [USERS, VENTURE] as never[],
    ),
  "public.chat_thread_members": (tx) =>
    tx.unsafe(
      `select ${THREAD} as thread, m.user_id, m.muted_until is not null as muted,
              case when m.muted_until = 'infinity' then 'infinity' when m.muted_until is null then null else 'until' end as mute_kind
         from messaging.members m join messaging.threads t on t.id = m.thread_id where m.user_id = any($1) order by 1, 2`,
      [USERS] as never[],
    ),
  "public.chat_messages": (tx) =>
    tx.unsafe(
      `select ${THREAD} as thread, cm.sender_id, cm.body, cm.media_path, cm.reply_to_id is not null as reply,
              cm.edited_at is not null as edited, cm.deleted_at is not null as deleted, cm.link_url, cm.shared_post_id is not null as shares_post, cm.shared
         from messaging.messages cm join messaging.threads t on t.id = cm.thread_id where cm.sender_id = any($1) order by 1, 3, 2`,
      [USERS] as never[],
    ),
  "public.message_reactions": (tx) =>
    tx.unsafe(`select r.user_id, r.emoji, m.body from messaging.reactions r join messaging.messages m on m.id = r.message_id where r.user_id = any($1) order by 1, 3`, [
      USERS,
    ] as never[]),
  "public.chat_pins": (tx) =>
    tx.unsafe(`select m.body, p.pinned_by from messaging.pins p join messaging.messages m on m.id = p.message_id where p.pinned_by = any($1) order by 1`, [USERS] as never[]),
};
export const FOREIGN = new Set(["public.notifications"]);

export async function snapshot(tx: Tx): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const [table, read] of Object.entries(RENAMED)) out[table] = (await read(tx)).map((r) => JSON.stringify(r));
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
  const sql = await pg.service("messaging", MIGRATIONS);
  return { pg, sql };
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

/** Runs one case in a rolled-back transaction on a fresh seed and compares it with the recording. */
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

// ---------------------------------------------------------------------------
// Fixture writers on messaging's own tables (the recorder's helpers, same names)
// ---------------------------------------------------------------------------
export async function dm(tx: Tx, a: string, b: string): Promise<string> {
  const key = a < b ? `${a}:${b}` : `${b}:${a}`;
  const [row] = await tx<{ id: string }[]>`insert into messaging.threads (id, type, dm_key) values (gen_random_uuid(), 'dm', ${key}) returning id::text`;
  await tx`insert into messaging.members (thread_id, user_id) values (${row!.id}, ${a}), (${row!.id}, ${b})`;
  return row!.id;
}

export const groupChat = async (tx: Tx) => (await tx<{ id: string }[]>`select id::text from messaging.threads where venture_id = ${VENTURE}`)[0]!.id;

export async function message(tx: Tx, thread: string, sender: string, body: string, minutesAgo = 0): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into messaging.messages (id, thread_id, sender_id, body, created_at, link_url)
    values (gen_random_uuid(), ${thread}, ${sender}, ${body}, now() - make_interval(mins => ${minutesAgo}),
            left(rtrim(substring(${body} from '(https?://[^\\s<>"'']+)'), '.,;:!?)]'), 2000))
    returning id::text`;
  return row!.id;
}

export async function imageMessage(tx: Tx, thread: string, sender: string, minutesAgo = 0): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into messaging.messages (id, thread_id, sender_id, body, media_path, media_width, media_height, created_at)
    values (gen_random_uuid(), ${thread}, ${sender}, '', ${thread} || '/' || gen_random_uuid()::text || '.webp', 640, 480, now() - make_interval(mins => ${minutesAgo}))
    returning id::text`;
  return row!.id;
}

export const readAt = (tx: Tx, thread: string, user: string, minutesAgo: number) =>
  tx`update messaging.members set last_read_at = now() - make_interval(mins => ${minutesAgo}) where thread_id = ${thread} and user_id = ${user}`;

export const removeMessage = (tx: Tx, id: string) => tx`update messaging.messages set deleted_at = now(), body = '', media_path = null where id = ${id}`;

/** A post id (content's row; messaging only holds the reference). */
export const makePost = async () => crypto.randomUUID();
