/**
 * Messaging golden recordings (W4). Records what the current stack (local Supabase) returns for every ported
 * messaging function, so the W4 service can be held to the same results. The sheet is
 * docs/azure/messaging-function-bins.md.
 *
 *   GOLDEN_STACK_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres GOLDEN_RECORD=1 pnpm exec vitest run test/messaging.golden.test.ts
 *
 * Without GOLDEN_RECORD it compares the stack with the files. Without GOLDEN_STACK_DB_URL the file is
 * skipped. Every case runs in its own transaction that is rolled back. now() is fixed inside a transaction:
 * message times are set by moving created_at back as the owner, and the chat rate limit (30 a minute) is far
 * from any case.
 */
import { join } from "node:path";
import type postgres from "postgres";
import { describe, expect, it } from "vitest";
import { actAs, assertLocalStack, attempt, callCurrentStackSql, golden, type SqlOutcome, type StackActor } from "../src/golden";

const DB = process.env["GOLDEN_STACK_DB_URL"];
if (DB !== undefined) assertLocalStack(DB);
const DIR = join(import.meta.dirname, "golden", "messaging");

// ---------------------------------------------------------------------------
// Fixtures: fixed ids, `.test` domains, distinctive names, no secrets.
// ---------------------------------------------------------------------------
export const UNI_A = "8c000000-0000-4000-8000-00000000000a";
export const UNI_B = "8c000000-0000-4000-8000-00000000000b";
export const AMNA = "8d000000-0000-4000-8000-000000000001"; // A, friends with Bashir and Daud
export const BASHIR = "8d000000-0000-4000-8000-000000000002"; // A
export const CHAMAN = "8d000000-0000-4000-8000-000000000003"; // B, global visibility
export const DAUD = "8d000000-0000-4000-8000-000000000004"; // A, friends-only visibility
export const ERUM = "8d000000-0000-4000-8000-000000000005"; // B, a stranger to everyone
export const FAIZ = "8d000000-0000-4000-8000-000000000006"; // A, venture owner
export const USERS = [AMNA, BASHIR, CHAMAN, DAUD, ERUM, FAIZ];
export const UNIS = [UNI_A, UNI_B];
export const VENTURE = "8e000000-0000-4000-8000-000000000001"; // Faiz's venture; Amna and Bashir are members
export const EMAIL: Record<string, string> = {
  [AMNA]: "amna@msg-a.test",
  [BASHIR]: "bashir@msg-a.test",
  [CHAMAN]: "chaman@msg-b.test",
  [DAUD]: "daud@msg-a.test",
  [ERUM]: "erum@msg-b.test",
  [FAIZ]: "faiz@msg-a.test",
};
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

const OWNER: StackActor = { role: "postgres" };
export const ANON: StackActor = { role: "anon", claims: { role: "anon" } };
export function as(user: string, aal: "aal1" | "aal2" = "aal1"): StackActor {
  return { role: "authenticated", claims: { sub: user, role: "authenticated", aal, email: EMAIL[user] } };
}

type Tx = postgres.TransactionSql;
type Row = Record<string, unknown>;

async function insertUser(tx: Tx, id: string): Promise<void> {
  await tx.unsafe(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                             raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, '', now() - interval '30 days',
             '{"provider":"email","providers":["email"]}'::jsonb, $3::text::jsonb, now() - interval '30 days', now())`,
    [id, EMAIL[id]!, JSON.stringify({ full_name: NAME[id] })],
  );
}

async function onboard(tx: Tx, id: string, visibility = "university"): Promise<void> {
  await tx.unsafe(
    `update public.profiles set username = $2, department = 'Computer Science', graduation_year = 2027, visibility = $3::public.profile_visibility,
            onboarding_complete = true where user_id = $1`,
    [id, USERNAME[id]!, visibility],
  );
  await tx.unsafe(`update public.onboarding_state set step = 6, completed_at = now() where user_id = $1`, [id]);
}

export const befriend = (tx: Tx, a: string, b: string) =>
  tx.unsafe(`insert into public.friendships (user_id_a, user_id_b) values (least($1::uuid, $2::uuid), greatest($1::uuid, $2::uuid))`, [a, b]);
export const block = (tx: Tx, a: string, b: string) => tx.unsafe(`insert into public.blocks (blocker_id, blocked_id) values ($1, $2)`, [a, b]);

/**
 * The shared world: two universities, six users, friendships (Amna-Bashir, Amna-Daud), and Faiz's venture
 * with Amna and Bashir as members (its team chat is made by the venture triggers). No DMs or messages.
 */
export async function seed(tx: Tx): Promise<void> {
  await tx.unsafe(
    `insert into public.universities (id, name, slug, live_at) values
       ($1, 'Messaging Golden University A', 'messaging-golden-a', now() - interval '1 day'),
       ($2, 'Messaging Golden University B', 'messaging-golden-b', now() - interval '1 day')`,
    UNIS,
  );
  await tx.unsafe(
    `insert into public.university_domains (university_id, domain, kind, source) values ($1, 'msg-a.test', 'both', 'ops'), ($2, 'msg-b.test', 'both', 'ops')`,
    UNIS,
  );
  for (const id of USERS) await insertUser(tx, id);
  for (const id of USERS) await onboard(tx, id, id === CHAMAN ? "global" : id === DAUD ? "friends" : "university");
  await befriend(tx, AMNA, BASHIR);
  await befriend(tx, AMNA, DAUD);
  await tx.unsafe(
    `insert into public.ventures (id, owner_id, university_id, title, type, status, visibility, team_size, description)
     values ($1, $2, $3, 'Kestrel Robotics', 'project', 'in_progress', 'university', 4, 'A robot that sorts recycling.')`,
    [VENTURE, FAIZ, UNI_A],
  );
  for (const m of [AMNA, BASHIR]) await tx.unsafe(`insert into public.venture_members (venture_id, user_id, team_role) values ($1, $2, 'developer') on conflict do nothing`, [VENTURE, m]);
}

// ---------------------------------------------------------------------------
// Calls and row snapshots
// ---------------------------------------------------------------------------
export async function call(tx: Tx, actor: StackActor, expr: string, params: unknown[] = []): Promise<SqlOutcome<unknown>> {
  const out = await attempt(tx, async (sp) => {
    await actAs(sp, actor);
    const rows = await sp.unsafe(`select ${expr} as v`, params as never[]);
    return (rows[0] as Row | undefined)?.["v"] ?? null;
  });
  await actAs(tx, OWNER);
  return out;
}

/** A set-returning function or a table read as `actor`: every row, in the order given. */
export async function rows(tx: Tx, actor: StackActor, text: string, params: unknown[] = []): Promise<SqlOutcome<unknown>> {
  const out = await attempt(tx, async (sp) => {
    await actAs(sp, actor);
    return [...(await sp.unsafe(text, params as never[]))];
  });
  await actAs(tx, OWNER);
  return out;
}

/**
 * Messaging's tables, and the foreign rows its writes reach (notify's notifications). Threads are named by
 * their kind and members (a DM by its two users, a group by its venture) so cases need no ids.
 */
const THREAD = `case when t.type = 'group' then 'group:' || t.venture_id::text else 'dm:' || t.dm_key end`;
export const SNAPSHOTS: Record<string, string> = {
  "public.chat_threads": `select ${THREAD} as thread, t.type, t.last_message_at is not null as has_last, t.closed_at is not null as closed
       from public.chat_threads t where t.venture_id = any($2) or exists (select 1 from public.chat_thread_members m where m.thread_id = t.id and m.user_id = any($1))
      order by 1`,
  "public.chat_thread_members": `select ${THREAD} as thread, m.user_id, m.muted_until is not null as muted,
            case when m.muted_until = 'infinity' then 'infinity' when m.muted_until is null then null else 'until' end as mute_kind
       from public.chat_thread_members m join public.chat_threads t on t.id = m.thread_id where m.user_id = any($1) order by 1, 2`,
  "public.chat_messages": `select ${THREAD} as thread, cm.sender_id, cm.body, cm.media_path, cm.reply_to_id is not null as reply,
            cm.edited_at is not null as edited, cm.deleted_at is not null as deleted, cm.link_url, cm.shared_post_id is not null as shares_post, cm.shared
       from public.chat_messages cm join public.chat_threads t on t.id = cm.thread_id where cm.sender_id = any($1) order by 1, 3, 2`,
  "public.message_reactions": `select r.user_id, r.emoji, m.body from public.message_reactions r join public.chat_messages m on m.id = r.message_id
      where r.user_id = any($1) order by 1, 3`,
  "public.chat_pins": `select m.body, p.pinned_by from public.chat_pins p join public.chat_messages m on m.id = p.message_id where p.pinned_by = any($1) order by 1`,
  "public.notifications": `select user_id, actor_id, type, entity_type from public.notifications where user_id = any($1) order by user_id, type, actor_id`,
};

export async function snapshot(tx: Tx): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const [table, text] of Object.entries(SNAPSHOTS)) {
    const params = text.includes("$2") ? [USERS, [VENTURE]] : [USERS];
    out[table] = (await tx.unsafe(text, params as never[])).map((r) => JSON.stringify(r));
  }
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

export async function step(tx: Tx, actor: StackActor, expr: string, params: unknown[] = []) {
  const before = await snapshot(tx);
  const result = await call(tx, actor, expr, params);
  return { result, changes: changes(before, await snapshot(tx)) };
}

export async function stepRows(tx: Tx, actor: StackActor, text: string, params: unknown[] = []) {
  const before = await snapshot(tx);
  const result = await rows(tx, actor, text, params);
  return { result, changes: changes(before, await snapshot(tx)) };
}

async function check(group: string, name: string, run: (tx: Tx) => Promise<unknown>): Promise<void> {
  const out = await callCurrentStackSql(DB!, async (tx) => {
    await seed(tx);
    return run(tx);
  });
  if (!out.ok) throw new Error(`${group}/${name}: setup failed: ${out.code} ${out.message}`);
  const r = golden(join(DIR, `${group}.json`), name, out.value);
  if (r.status === "differs") expect(r.actual).toEqual(r.expected);
}

/** A DM thread between two users, made as get_or_create_dm makes it (as the owner); returns its id. */
export async function dm(tx: Tx, a: string, b: string): Promise<string> {
  const key = a < b ? `${a}:${b}` : `${b}:${a}`;
  const [row] = await tx.unsafe(`insert into public.chat_threads (type, dm_key) values ('dm', $1) returning id::text`, [key]);
  const id = (row as unknown as { id: string }).id;
  await tx.unsafe(`insert into public.chat_thread_members (thread_id, user_id) values ($1, $2), ($1, $3)`, [id, a, b]);
  return id;
}

/** The venture's team chat. */
export const groupChat = async (tx: Tx) =>
  ((await tx.unsafe(`select id::text from public.chat_threads where venture_id = $1`, [VENTURE]))[0] as unknown as { id: string }).id;

/** A message written as the owner, `minutesAgo` back; returns its id. */
export async function message(tx: Tx, thread: string, sender: string, body: string, minutesAgo = 0): Promise<string> {
  const [row] = await tx.unsafe(
    `insert into public.chat_messages (thread_id, sender_id, body, created_at) values ($1, $2, $3, now() - make_interval(mins => $4)) returning id::text`,
    [thread, sender, body, minutesAgo],
  );
  return (row as unknown as { id: string }).id;
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------
describe.skipIf(!DB)("messaging goldens on the current stack", () => {
  describe("threads", () => {
    const G = "threads";

    it("get_or_create_dm: friends only (or an application or swap), one thread per pair, refusals", () =>
      check(G, "get_or_create_dm", async (tx) => {
        const out: Row = {};
        const open = "public.get_or_create_dm($1)";
        const first = await step(tx, as(AMNA), open, ["mg_bashir"]);
        out["friends_first_time"] = first;
        out["friends_again_same_thread"] = await step(tx, as(AMNA), open, ["mg_bashir"]);
        out["other_side_same_thread"] = await step(tx, as(BASHIR), open, ["  MG_AMNA "]);
        out["same_ids"] = {
          a: (first.result as { ok: true; value: string }).value === (await call(tx, as(BASHIR), open, ["mg_amna"]) as { ok: true; value: string }).value,
        };
        out["not_friends"] = await call(tx, as(AMNA), open, ["mg_erum"]);
        out["self"] = await call(tx, as(AMNA), open, ["mg_amna"]);
        out["unknown"] = await call(tx, as(AMNA), open, ["mg_nobody"]);
        await block(tx, DAUD, AMNA);
        out["blocked_friend"] = await call(tx, as(AMNA), open, ["mg_daud"]);
        out["blocked_friend_other_way"] = await call(tx, as(DAUD), open, ["mg_amna"]);
        out["signed_out"] = await call(tx, ANON, open, ["mg_amna"]);
        return out;
      }));
  });
});

// ---------------------------------------------------------------------------
// More helpers (added after the first recording; the seed and the helpers above are untouched)
// ---------------------------------------------------------------------------
const NAMES = (u: string) => USERNAME[u]!;

/** Moves a member's read marker `minutesAgo` back (messages sent after it count as unread). */
async function readAt(tx: Tx, thread: string, user: string, minutesAgo: number): Promise<void> {
  await tx.unsafe(`update public.chat_thread_members set last_read_at = now() - make_interval(mins => $3) where thread_id = $1 and user_id = $2`, [thread, user, minutesAgo]);
}

/** A university post by `author`, written as the owner; returns its id. */
async function makePost(tx: Tx, author: string, body: string, minutesAgo = 0): Promise<string> {
  const [row] = await tx.unsafe(
    `insert into public.posts (author_id, university_id, audience, type, body, created_at)
     values ($1, $2, 'university', 'general', $3, now() - make_interval(mins => $4)) returning id::text`,
    [author, UNI_A, body, minutesAgo],
  );
  return (row as unknown as { id: string }).id;
}

/** Marks a message deleted, as delete_message leaves it. */
async function removeMessage(tx: Tx, id: string): Promise<void> {
  await tx.unsafe(`update public.chat_messages set deleted_at = now(), body = '', media_path = null where id = $1`, [id]);
}

/** Read markers and notification read state, which the shared snapshots leave out. */
async function reads(tx: Tx, thread: string): Promise<unknown> {
  const m = await tx.unsafe(`select m.user_id, m.last_read_at = now() as read_now from public.chat_thread_members m where m.thread_id = $1 order by 1`, [thread]);
  const n = await tx.unsafe(`select user_id, type, read_at is not null as is_read from public.notifications where user_id = any($1) and entity_id = $2 order by 1, 2`, [USERS, thread]);
  return { members: [...m], notifications: [...n] };
}

const THREAD_LIST = `select title, type, username, unread, muted, last_message, last_sender_is_me from public.my_threads() order by title`;

describe.skipIf(!DB)("messaging goldens on the current stack (threads, more)", () => {
  const G = "threads";

  it("my_threads: the list, last-message kinds, unread, muted, blocked and empty threads", () =>
    check(G, "my_threads", async (tx) => {
      const out: Row = {};
      const ab = await dm(tx, AMNA, BASHIR);
      await message(tx, ab, BASHIR, "b1", 20);
      await message(tx, ab, AMNA, "a1", 15);
      await message(tx, ab, BASHIR, "b2", 10);
      await message(tx, ab, BASHIR, "b3", 5);
      await readAt(tx, ab, AMNA, 17);
      await readAt(tx, ab, BASHIR, 60);
      await dm(tx, AMNA, DAUD); // no message: not listed
      const ae = await dm(tx, AMNA, ERUM);
      await message(tx, ae, ERUM, "from erum", 8);
      await readAt(tx, ae, AMNA, 60);
      await block(tx, ERUM, AMNA); // a DM with someone who blocked me: not listed
      const bc = await dm(tx, BASHIR, CHAMAN);
      const gone = await message(tx, bc, CHAMAN, "will be deleted", 12);
      await removeMessage(tx, gone);
      await readAt(tx, bc, BASHIR, 60);
      const fe = await dm(tx, FAIZ, ERUM);
      await tx.unsafe(
        `insert into public.chat_messages (thread_id, sender_id, body, media_path, created_at)
         values ($1::uuid, $2, '', $1::text || '/' || gen_random_uuid()::text || '.webp', now() - interval '7 minutes')`,
        [fe, ERUM],
      );
      await readAt(tx, fe, FAIZ, 60);
      const df = await dm(tx, DAUD, FAIZ);
      const post = await makePost(tx, BASHIR, "A post to share");
      await tx.unsafe(
        `insert into public.chat_messages (thread_id, sender_id, body, shared_post_id, shared, created_at) values ($1, $2, '', $3, true, now() - interval '6 minutes')`,
        [df, FAIZ, post],
      );
      await readAt(tx, df, DAUD, 60);
      const g = await groupChat(tx);
      await message(tx, g, FAIZ, "g1", 3);
      await readAt(tx, g, AMNA, 60);
      await readAt(tx, g, BASHIR, 60);
      await tx.unsafe(`update public.chat_thread_members set muted_until = now() + interval '1 day' where thread_id = $1 and user_id = $2`, [g, AMNA]);
      for (const u of [AMNA, BASHIR, FAIZ, ERUM, DAUD]) {
        out[NAMES(u)] = { threads: await rows(tx, as(u), THREAD_LIST), unread_chat_count: await call(tx, as(u), "public.unread_chat_count()") };
      }
      out["signed_out"] = { threads: await rows(tx, ANON, THREAD_LIST), unread_chat_count: await call(tx, ANON, "public.unread_chat_count()") };
      return out;
    }));

  it("venture_chat: the team chat for its members, not for outsiders", () =>
    check(G, "venture_chat", async (tx) => {
      const out: Row = {};
      const g = await groupChat(tx);
      const expr = "public.venture_chat($1)";
      for (const u of [AMNA, BASHIR, FAIZ, ERUM]) {
        const r = (await call(tx, as(u), expr, [VENTURE])) as { ok: boolean; value?: string };
        out[NAMES(u)] = r.ok ? { ok: true, is_team_chat: r.value === g, null: r.value === null } : r;
      }
      out["unknown_venture"] = await call(tx, as(AMNA), expr, ["8e000000-0000-4000-8000-0000000000ff"]);
      out["signed_out"] = await call(tx, ANON, expr, [VENTURE]);
      return out;
    }));

  it("thread_people: a DM and the team chat, with and without a block", () =>
    check(G, "thread_people", async (tx) => {
      const out: Row = {};
      const ab = await dm(tx, AMNA, BASHIR);
      const g = await groupChat(tx);
      const q = "select name, username, blocked, is_me from public.thread_people($1) order by name";
      const view = async () => ({
        dm_as_amna: await rows(tx, as(AMNA), q, [ab]),
        dm_as_bashir: await rows(tx, as(BASHIR), q, [ab]),
        team_as_amna: await rows(tx, as(AMNA), q, [g]),
        team_as_bashir: await rows(tx, as(BASHIR), q, [g]),
        team_as_faiz: await rows(tx, as(FAIZ), q, [g]),
        team_as_outsider: await rows(tx, as(ERUM), q, [g]),
        dm_as_outsider: await rows(tx, as(ERUM), q, [ab]),
      });
      out["before_block"] = await view();
      await block(tx, AMNA, BASHIR);
      out["after_amna_blocks_bashir"] = await view();
      out["signed_out"] = await rows(tx, ANON, q, [g]);
      return out;
    }));

  it("mute_thread: hours, for ever, clear, not a member", () =>
    check(G, "mute", async (tx) => {
      const out: Row = {};
      const ab = await dm(tx, AMNA, BASHIR);
      const mute = "public.mute_thread($1, $2)";
      out["five_hours"] = await step(tx, as(AMNA), mute, [ab, 5]);
      out["for_ever_8760"] = await step(tx, as(AMNA), mute, [ab, 8760]);
      out["minus_one_clears"] = await step(tx, as(AMNA), mute, [ab, -1]);
      out["five_again"] = await step(tx, as(AMNA), mute, [ab, 5]);
      out["zero_clears"] = await step(tx, as(AMNA), mute, [ab, 0]);
      out["null_hours_clears"] = await step(tx, as(AMNA), mute, [ab, null]);
      out["not_a_member"] = await step(tx, as(ERUM), mute, [ab, 5]);
      out["signed_out"] = await call(tx, ANON, mute, [ab, 5]);
      return out;
    }));

  it("mark_thread_read: moves the marker and reads the thread's notification", () =>
    check(G, "mark_read", async (tx) => {
      const out: Row = {};
      const ab = await dm(tx, AMNA, BASHIR);
      await message(tx, ab, BASHIR, "ping", 5); // the trigger writes AMNA's chat_message notification
      await readAt(tx, ab, AMNA, 60);
      out["before"] = await reads(tx, ab);
      out["amna_reads"] = await step(tx, as(AMNA), "public.mark_thread_read($1)", [ab]);
      out["after"] = await reads(tx, ab);
      out["again"] = await step(tx, as(AMNA), "public.mark_thread_read($1)", [ab]);
      out["not_a_member"] = await step(tx, as(ERUM), "public.mark_thread_read($1)", [ab]);
      out["unknown_thread"] = await call(tx, as(AMNA), "public.mark_thread_read($1)", ["8f000000-0000-4000-8000-0000000000ff"]);
      out["signed_out"] = await call(tx, ANON, "public.mark_thread_read($1)", [ab]);
      return out;
    }));

  it("dm_receipt: only when both people have receipts on, in a DM they belong to", () =>
    check(G, "dm_receipt", async (tx) => {
      const out: Row = {};
      const ab = await dm(tx, AMNA, BASHIR);
      const g = await groupChat(tx);
      await readAt(tx, ab, BASHIR, 30);
      await readAt(tx, ab, AMNA, 45);
      const expr = `case when public.dm_receipt($1) is null then 'none'
                         when public.dm_receipt($1) = now() - interval '30 minutes' then 'bashir_last_read'
                         when public.dm_receipt($1) = now() - interval '45 minutes' then 'amna_last_read' else 'other' end`;
      const both = async () => ({
        amna: await call(tx, as(AMNA), expr, [ab]),
        bashir: await call(tx, as(BASHIR), expr, [ab]),
        outsider: await call(tx, as(ERUM), expr, [ab]),
        team_chat_as_amna: await call(tx, as(AMNA), expr, [g]),
      });
      out["both_on"] = await both();
      await tx.unsafe(`update public.profiles set chat_read_receipts = false where user_id = $1`, [BASHIR]);
      out["bashir_off"] = await both();
      await tx.unsafe(`update public.profiles set chat_read_receipts = true where user_id = $1`, [BASHIR]);
      await tx.unsafe(`update public.profiles set chat_read_receipts = false where user_id = $1`, [AMNA]);
      out["amna_off"] = await both();
      out["signed_out"] = await call(tx, ANON, expr, [ab]);
      return out;
    }));
});
/** An image-only message written as the owner; returns its id. */
async function imageMessage(tx: Tx, thread: string, sender: string, minutesAgo = 0): Promise<string> {
  const [row] = await tx.unsafe(
    `insert into public.chat_messages (thread_id, sender_id, body, media_path, media_width, media_height, created_at)
     values ($1::uuid, $2, '', $1::text || '/' || gen_random_uuid()::text || '.webp', 640, 480, now() - make_interval(mins => $3)) returning id::text`,
    [thread, sender, minutesAgo],
  );
  return (row as unknown as { id: string }).id;
}

const SEND = "public.send_message($1::uuid, $2::text, null::jsonb, $3::uuid)";
const idsOf = (r: unknown): string[] => ((r as { result: { ok: boolean; value: string[] } }).result.value ?? []) as string[];

describe.skipIf(!DB)("messaging goldens on the current stack (messages)", () => {
  const G = "messages";

  it("send_message: text, replies, limits, closed and blocked threads, an image", () =>
    check(G, "send", async (tx) => {
      const out: Row = {};
      const ab = await dm(tx, AMNA, BASHIR);
      const g = await groupChat(tx);
      out["text_to_a_friend"] = await step(tx, as(AMNA), SEND, [ab, "hello there", null]);
      const orig = await message(tx, ab, BASHIR, "the original", 5);
      out["reply"] = await step(tx, as(AMNA), SEND, [ab, "a reply", orig]);
      out["reply_to_own_message"] = await step(tx, as(AMNA), SEND, [ab, "a follow-up", orig]);
      const other = await message(tx, g, FAIZ, "in the team chat", 4);
      out["reply_on_another_thread"] = await step(tx, as(AMNA), SEND, [ab, "wrong thread", other]);
      const gone = await message(tx, ab, BASHIR, "to be deleted", 3);
      await removeMessage(tx, gone);
      out["reply_to_deleted"] = await step(tx, as(AMNA), SEND, [ab, "reply to nothing", gone]);
      out["empty_body"] = await step(tx, as(AMNA), SEND, [ab, "", null]);
      out["blank_body"] = await step(tx, as(AMNA), SEND, [ab, "   ", null]);
      out["null_body"] = await step(tx, as(AMNA), SEND, [ab, null, null]);
      out["exactly_10000_characters"] = await call(tx, as(AMNA), `public.send_message($1::uuid, $2::text, null::jsonb, null::uuid) is not null`, [ab, "x".repeat(10000)]);
      out["10001_characters"] = await step(tx, as(AMNA), SEND, [ab, "x".repeat(10001), null]);
      out["team_chat_member"] = await step(tx, as(AMNA), SEND, [g, "hello team", null]);
      out["team_chat_outsider"] = await step(tx, as(ERUM), SEND, [g, "let me in", null]);
      out["not_a_member"] = await step(tx, as(ERUM), SEND, [ab, "hello", null]);
      out["unknown_thread"] = await call(tx, as(AMNA), SEND, ["8f000000-0000-4000-8000-0000000000ff", "hello", null]);
      out["signed_out"] = await call(tx, ANON, SEND, [ab, "hello", null]);
      const media = `public.send_message($1::uuid, $2::text, $3::text::jsonb, null::uuid)`;
      const path = `${ab}/9f000000-0000-4000-8000-000000000001.webp`;
      out["image_not_uploaded"] = await step(tx, as(AMNA), media, [ab, "", JSON.stringify({ path, width: 640, height: 480 })]);
      await tx.unsafe(`insert into storage.objects (bucket_id, name, owner_id) values ('chat-media', $1, $2)`, [path, AMNA]);
      out["image_uploaded_by_sender"] = await step(tx, as(AMNA), media, [ab, "", JSON.stringify({ path, width: 640, height: 480 })]);
      const theirs = `${ab}/9f000000-0000-4000-8000-000000000002.webp`;
      await tx.unsafe(`insert into storage.objects (bucket_id, name, owner_id) values ('chat-media', $1, $2)`, [theirs, BASHIR]);
      out["image_uploaded_by_someone_else"] = await step(tx, as(AMNA), media, [ab, "", JSON.stringify({ path: theirs, width: 640, height: 480 })]);
      const wrongThread = `${g}/9f000000-0000-4000-8000-000000000003.webp`;
      await tx.unsafe(`insert into storage.objects (bucket_id, name, owner_id) values ('chat-media', $1, $2)`, [wrongThread, AMNA]);
      out["image_for_another_thread"] = await step(tx, as(AMNA), media, [ab, "", JSON.stringify({ path: wrongThread, width: 640, height: 480 })]);
      // A closed thread (the student closed a recruiter conversation) and a DM with someone who blocked me.
      const ad = await dm(tx, AMNA, DAUD);
      await tx.unsafe(`update public.chat_threads set closed_at = now() where id = $1`, [ad]);
      out["closed_thread"] = await step(tx, as(AMNA), SEND, [ad, "anyone there", null]);
      out["closed_thread_other_side"] = await step(tx, as(DAUD), SEND, [ad, "anyone there", null]);
      const ac = await dm(tx, AMNA, CHAMAN);
      await block(tx, CHAMAN, AMNA);
      out["blocked_dm"] = await step(tx, as(AMNA), SEND, [ac, "hello", null]);
      out["blocked_dm_by_the_blocker"] = await step(tx, as(CHAMAN), SEND, [ac, "hello", null]);
      return out;
    }));

  it("send_message: 30 a minute", () =>
    check(G, "send_rate_limit", async (tx) => {
      const ab = await dm(tx, AMNA, BASHIR);
      const results: string[] = [];
      for (let i = 1; i <= 31; i++) {
        const r = (await call(tx, as(AMNA), SEND, [ab, `fast ${i}`, null])) as { ok: boolean; code?: string; message?: string };
        results.push(r.ok ? "ok" : `${r.code}: ${r.message}`);
      }
      const [sent] = await tx.unsafe(`select count(*)::int as n from public.chat_messages where thread_id = $1 and sender_id = $2`, [ab, AMNA]);
      return {
        sent: (sent as unknown as { n: number }).n,
        ok_count: results.filter((r) => r === "ok").length,
        first_refusal_at: results.findIndex((r) => r !== "ok") + 1,
        refusal: results.find((r) => r !== "ok") ?? null,
        another_sender_not_limited: await call(tx, as(BASHIR), SEND, [ab, "still fine", null]),
      };
    }));

  it("edit_message: own text only, not deleted, not empty, 10,000 characters", () =>
    check(G, "edit", async (tx) => {
      const out: Row = {};
      const ab = await dm(tx, AMNA, BASHIR);
      const mine = await message(tx, ab, AMNA, "my text", 10);
      const theirs = await message(tx, ab, BASHIR, "their text", 9);
      const gone = await message(tx, ab, AMNA, "to be deleted", 8);
      await removeMessage(tx, gone);
      const pic = await imageMessage(tx, ab, AMNA, 7);
      const edit = "public.edit_message($1::uuid, $2::text)";
      out["own"] = await step(tx, as(AMNA), edit, [mine, "my edited text"]);
      out["own_with_a_link"] = await step(tx, as(AMNA), edit, [mine, "see https://example.com/page now"]);
      out["someone_elses"] = await step(tx, as(AMNA), edit, [theirs, "hijacked"]);
      out["deleted"] = await step(tx, as(AMNA), edit, [gone, "back from the dead"]);
      out["empty_text"] = await step(tx, as(AMNA), edit, [mine, ""]);
      out["blank_text"] = await step(tx, as(AMNA), edit, [mine, "   "]);
      out["null_text"] = await step(tx, as(AMNA), edit, [mine, null]);
      out["10001_characters"] = await step(tx, as(AMNA), edit, [mine, "x".repeat(10001)]);
      out["image_message_to_empty_text"] = await step(tx, as(AMNA), edit, [pic, ""]);
      out["image_message_gets_a_caption"] = await step(tx, as(AMNA), edit, [pic, "a caption"]);
      out["unknown_message"] = await call(tx, as(AMNA), edit, ["8f000000-0000-4000-8000-0000000000ff", "hello"]);
      out["signed_out"] = await call(tx, ANON, edit, [mine, "hello"]);
      await block(tx, BASHIR, AMNA);
      out["in_a_blocked_dm"] = await step(tx, as(AMNA), edit, [mine, "edit after the block"]);
      return out;
    }));

  it("delete_message: own only; returns the image path", () =>
    check(G, "delete", async (tx) => {
      const out: Row = {};
      const ab = await dm(tx, AMNA, BASHIR);
      const text = await message(tx, ab, AMNA, "bye", 10);
      const pic = await imageMessage(tx, ab, AMNA, 9);
      const theirs = await message(tx, ab, BASHIR, "not yours", 8);
      const del = "public.delete_message($1::uuid)";
      out["own_text_returns_no_path"] = await step(tx, as(AMNA), del, [text]);
      out["own_image_returns_path"] = await step(tx, as(AMNA), del, [pic]);
      out["twice"] = await step(tx, as(AMNA), del, [text]);
      out["someone_elses"] = await step(tx, as(AMNA), del, [theirs]);
      out["unknown_message"] = await call(tx, as(AMNA), del, ["8f000000-0000-4000-8000-0000000000ff"]);
      out["signed_out"] = await call(tx, ANON, del, [theirs]);
      return out;
    }));

  it("thread_messages: pages, cursor, limit, replies, deletes, pins, reactions", () =>
    check(G, "thread_messages", async (tx) => {
      const out: Row = {};
      const ab = await dm(tx, AMNA, BASHIR);
      const m1 = await message(tx, ab, AMNA, "one", 50);
      const m2 = await message(tx, ab, BASHIR, "two", 40);
      await tx.unsafe(`update public.chat_messages set reply_to_id = $1 where id = $2`, [m1, m2]);
      const m3 = await message(tx, ab, AMNA, "three", 30);
      await removeMessage(tx, m3);
      const m4 = await imageMessage(tx, ab, BASHIR, 20);
      const m5 = await message(tx, ab, AMNA, "five, with a link https://example.com/five", 10);
      await tx.unsafe(`update public.chat_messages set reply_to_id = $1 where id = $2`, [m4, m5]);
      const m6 = await message(tx, ab, BASHIR, "six", 5);
      await tx.unsafe(`update public.chat_messages set reply_to_id = $1 where id = $2`, [m3, m6]);
      const post = await makePost(tx, BASHIR, "A post to share");
      await tx.unsafe(`insert into public.chat_messages (thread_id, sender_id, body, shared_post_id, shared, created_at) values ($1, $2, '', $3, true, now() - interval '2 minutes')`, [ab, AMNA, post]);
      await tx.unsafe(`update public.chat_messages set reply_to_id = (select id from public.chat_messages where body = '' and shared) where id = $1`, [m6]);
      await tx.unsafe(`insert into public.chat_pins (message_id, thread_id, pinned_by) values ($1, $2, $3)`, [m2, ab, BASHIR]);
      await tx.unsafe(`insert into public.message_reactions (message_id, thread_id, user_id, emoji) values ($1, $2, $3, '👍'), ($1, $2, $4, '❤️'), ($5, $2, $3, '🎉')`, [m1, ab, AMNA, BASHIR, m5]);
      await tx.unsafe(`update public.chat_messages set edited_at = now() where id = $1`, [m1]);
      const q = `select body, deleted, reply_excerpt, pinned, reply_to_id is not null as is_reply, reactions, link, media_path is not null as has_image,
                        shared, shared_post_id is not null as has_post, edited_at is not null as edited, sender_id = $4::uuid as from_amna
                   from public.thread_messages($1::uuid, $2::timestamptz, $3::int)`;
      const page = (actor: StackActor, thread: string, before: string | null, limit: number | null) => rows(tx, actor, q, [thread, before, limit, AMNA]);
      out["default_page_as_amna"] = await page(as(AMNA), ab, null, null);
      out["default_page_as_bashir"] = await page(as(BASHIR), ab, null, null);
      out["limit_3"] = await page(as(AMNA), ab, null, 3);
      out["limit_0_is_1"] = await page(as(AMNA), ab, null, 0);
      out["limit_1000_is_100"] = await call(tx, as(AMNA), `(select count(*) from public.thread_messages($1::uuid, null, 1000))`, [ab]);
      const cursor = (await tx.unsafe(`select (now() - interval '25 minutes')::text as t`))[0] as unknown as { t: string };
      out["before_25_minutes_ago"] = await page(as(AMNA), ab, cursor.t, null);
      out["before_the_beginning"] = await page(as(AMNA), ab, (await tx.unsafe(`select (now() - interval '2 hours')::text as t`))[0]!["t"] as string, null);
      out["not_a_member"] = await page(as(ERUM), ab, null, null);
      out["signed_out"] = await rows(tx, ANON, q, [ab, null, null, AMNA]);
      await block(tx, BASHIR, AMNA);
      out["blocked_dm_as_amna"] = await page(as(AMNA), ab, null, null);
      out["blocked_dm_as_bashir"] = await page(as(BASHIR), ab, null, null);
      return out;
    }));
});

// ---------------------------------------------------------------------------
// extras.json: reactions, pins, search
// ---------------------------------------------------------------------------
describe.skipIf(!DB)("messaging goldens on the current stack (extras)", () => {
  const G = "extras";
  const summary = (actor: StackActor, tx: Tx, ids: string[]) =>
    rows(tx, actor, `select (select body from public.chat_messages where id = s.message_id) as body, reactions from public.reaction_summary($1::text::uuid[]) s order by 1`, [`{${ids.join(",")}}`]);

  it("toggle_reaction and reaction_summary: six emoji, one per person, switch, take back", () =>
    check(G, "reactions", async (tx) => {
      const out: Row = {};
      const ab = await dm(tx, AMNA, BASHIR);
      const g = await groupChat(tx);
      const msg = await message(tx, ab, BASHIR, "react to me", 10);
      const toggle = "public.toggle_reaction($1::uuid, $2::text)";
      out["add"] = await step(tx, as(AMNA), toggle, [msg, "👍"]);
      out["summary_as_amna"] = await summary(as(AMNA), tx, [msg]);
      out["summary_as_bashir"] = await summary(as(BASHIR), tx, [msg]);
      out["same_again_takes_it_back"] = await step(tx, as(AMNA), toggle, [msg, "👍"]);
      out["add_heart"] = await step(tx, as(AMNA), toggle, [msg, "❤️"]);
      out["switch_to_laugh"] = await step(tx, as(AMNA), toggle, [msg, "😂"]);
      out["other_person_adds"] = await step(tx, as(BASHIR), toggle, [msg, "😂"]);
      out["summary_after"] = await summary(as(AMNA), tx, [msg]);
      out["bad_emoji"] = await step(tx, as(AMNA), toggle, [msg, "👎"]);
      out["empty_emoji"] = await step(tx, as(AMNA), toggle, [msg, ""]);
      out["null_emoji"] = await step(tx, as(AMNA), toggle, [msg, null]);
      const gone = await message(tx, ab, BASHIR, "gone", 9);
      await removeMessage(tx, gone);
      out["deleted_message"] = await step(tx, as(AMNA), toggle, [gone, "👍"]);
      out["not_a_member"] = await step(tx, as(ERUM), toggle, [msg, "👍"]);
      out["unknown_message"] = await call(tx, as(AMNA), toggle, ["8f000000-0000-4000-8000-0000000000ff", "👍"]);
      out["signed_out"] = await call(tx, ANON, toggle, [msg, "👍"]);
      out["summary_not_a_member"] = await summary(as(ERUM), tx, [msg]);
      // A reaction from someone blocked with the reader is left out in a group chat.
      const gm = await message(tx, g, FAIZ, "team news", 8);
      await tx.unsafe(`insert into public.chat_thread_members (thread_id, user_id) values ($1, $2) on conflict do nothing`, [g, FAIZ]);
      out["group_amna_reacts"] = await step(tx, as(AMNA), toggle, [gm, "🎉"]);
      out["group_bashir_reacts"] = await step(tx, as(BASHIR), toggle, [gm, "🎉"]);
      out["group_summary_before_block"] = await summary(as(AMNA), tx, [gm]);
      await block(tx, AMNA, BASHIR);
      out["group_summary_after_amna_blocks_bashir"] = await summary(as(AMNA), tx, [gm]);
      out["group_summary_as_bashir"] = await summary(as(BASHIR), tx, [gm]);
      out["group_summary_as_faiz"] = await summary(as(FAIZ), tx, [gm]);
      out["react_in_the_blocked_dm"] = await step(tx, as(AMNA), toggle, [msg, "🙏"]);
      return out;
    }));

  it("pin_message and thread_pins: the venture owner, up to 3, team chat only", () =>
    check(G, "pins", async (tx) => {
      const out: Row = {};
      const g = await groupChat(tx);
      const p1 = await message(tx, g, AMNA, "pin one", 20);
      const p2 = await message(tx, g, BASHIR, "pin two", 19);
      const p3 = await message(tx, g, AMNA, "pin three", 18);
      const p4 = await message(tx, g, AMNA, "pin four", 17);
      const gone = await message(tx, g, AMNA, "pin gone", 16);
      await removeMessage(tx, gone);
      const pin = "public.pin_message($1::uuid, $2::boolean)";
      out["owner_not_in_the_chat_yet"] = await step(tx, as(FAIZ), pin, [p1, true]);
      await tx.unsafe(`insert into public.chat_thread_members (thread_id, user_id) values ($1, $2) on conflict do nothing`, [g, FAIZ]);
      out["non_owner_member"] = await step(tx, as(AMNA), pin, [p1, true]);
      out["pin_one"] = await step(tx, as(FAIZ), pin, [p1, true]);
      out["pin_one_again"] = await step(tx, as(FAIZ), pin, [p1, true]);
      out["pin_two"] = await step(tx, as(FAIZ), pin, [p2, true]);
      out["pin_three"] = await step(tx, as(FAIZ), pin, [p3, true]);
      out["fourth_is_refused"] = await step(tx, as(FAIZ), pin, [p4, true]);
      out["pins_as_amna"] = await rows(tx, as(AMNA), `select excerpt, (sender_id = $2::uuid) as by_amna from public.thread_pins($1::uuid)`, [g, AMNA]);
      out["pins_as_outsider"] = await rows(tx, as(ERUM), `select excerpt from public.thread_pins($1::uuid)`, [g]);
      out["unpin_one"] = await step(tx, as(FAIZ), pin, [p1, false]);
      out["unpin_again"] = await step(tx, as(FAIZ), pin, [p1, false]);
      out["pin_four_after_unpin"] = await step(tx, as(FAIZ), pin, [p4, true]);
      out["deleted_message"] = await step(tx, as(FAIZ), pin, [gone, true]);
      out["unknown_message"] = await call(tx, as(FAIZ), pin, ["8f000000-0000-4000-8000-0000000000ff", true]);
      out["outsider"] = await step(tx, as(ERUM), pin, [p1, true]);
      out["signed_out"] = await call(tx, ANON, pin, [p1, true]);
      const fe = await dm(tx, FAIZ, ERUM);
      const dmMsg = await message(tx, fe, ERUM, "in a dm", 5);
      out["in_a_dm"] = await step(tx, as(FAIZ), pin, [dmMsg, true]);
      out["pins_final_as_faiz"] = await rows(tx, as(FAIZ), `select excerpt from public.thread_pins($1::uuid)`, [g]);
      out["pins_not_a_member_of_dm"] = await rows(tx, as(AMNA), `select excerpt from public.thread_pins($1::uuid)`, [fe]);
      out["pins_signed_out"] = await rows(tx, ANON, `select excerpt from public.thread_pins($1::uuid)`, [g]);
      return out;
    }));

  it("search_chats: words, prefixes, short queries, a thread, blocks, other people's chats", () =>
    check(G, "search", async (tx) => {
      const out: Row = {};
      const ab = await dm(tx, AMNA, BASHIR);
      const g = await groupChat(tx);
      const fe = await dm(tx, FAIZ, ERUM);
      await message(tx, ab, AMNA, "hello world", 60);
      await message(tx, ab, BASHIR, "worldwide plans for friday", 50);
      await message(tx, ab, AMNA, "something unrelated", 40);
      await message(tx, g, FAIZ, "world cup team meeting", 30);
      await message(tx, g, BASHIR, "world of bashir", 25);
      const hidden = await message(tx, g, AMNA, "world deleted", 20);
      await removeMessage(tx, hidden);
      await message(tx, fe, ERUM, "world secret between faiz and erum", 10);
      await message(tx, ab, AMNA, "Planning, plans; PLANS!", 5);
      const q = `select thread_title, sender_name, excerpt from public.search_chats($1::text, $2::uuid)`;
      const search = (actor: StackActor, text: string | null, thread: string | null = null) => rows(tx, actor, q, [text, thread]);
      out["whole_word"] = await search(as(AMNA), "world");
      out["prefix"] = await search(as(AMNA), "wor");
      out["two_words"] = await search(as(AMNA), "world plans");
      out["case_and_punctuation"] = await search(as(AMNA), "  PLANS!! ");
      out["two_letters"] = await search(as(AMNA), "wo");
      out["one_letter"] = await search(as(AMNA), "w");
      out["empty"] = await search(as(AMNA), "");
      out["only_symbols"] = await search(as(AMNA), "!!! ???");
      out["null_query"] = await search(as(AMNA), null);
      out["no_match"] = await search(as(AMNA), "zebra");
      out["one_thread"] = await search(as(AMNA), "world", ab);
      out["one_thread_not_mine"] = await search(as(AMNA), "world", fe);
      out["the_other_pair_sees_their_own_chat"] = await search(as(ERUM), "world");
      out["bashir"] = await search(as(BASHIR), "world");
      await block(tx, AMNA, BASHIR);
      out["after_amna_blocks_bashir"] = await search(as(AMNA), "world");
      out["signed_out"] = await rows(tx, ANON, q, ["world", null]);
      return out;
    }));
});

// ---------------------------------------------------------------------------
// share.json (messaging's half of sharing; content recorded the post-visibility refusals in W3)
// ---------------------------------------------------------------------------
describe.skipIf(!DB)("messaging goldens on the current stack (share)", () => {
  const G = "share";
  const arr = (ids: string[]) => `{${ids.join(",")}}`;
  const SHARE = "public.share_post($1::uuid, $2::text::uuid[], $3::text)";
  const UNDO = "public.undo_share($1::text::uuid[])";
  const targets = (actor: StackActor, tx: Tx, q: string | null) =>
    rows(
      tx,
      actor,
      `select x->>'title' as title, x->>'type' as type, x->>'username' as username, (x->>'last_at') is not null as has_last_at
         from jsonb_array_elements(public.share_targets($1::text)) with ordinality t(x, i) order by i`,
      [q],
    );

  it("share_targets: your DMs and team chats, filtered, most recent first", () =>
    check(G, "share_targets", async (tx) => {
      const out: Row = {};
      const ab = await dm(tx, AMNA, BASHIR);
      const ad = await dm(tx, AMNA, DAUD);
      const ae = await dm(tx, AMNA, ERUM);
      const empty = await dm(tx, AMNA, CHAMAN);
      const g = await groupChat(tx);
      await tx.unsafe(`update public.chat_threads set last_message_at = now() - interval '10 minutes' where id = $1`, [ab]);
      await tx.unsafe(`update public.chat_threads set last_message_at = now() - interval '5 minutes' where id = $1`, [ad]);
      await tx.unsafe(`update public.chat_threads set last_message_at = now() - interval '1 minute' where id = $1`, [ae]);
      await tx.unsafe(`update public.chat_threads set last_message_at = now() - interval '20 minutes' where id = $1`, [g]);
      void empty;
      await block(tx, ERUM, AMNA);
      out["everything"] = await targets(as(AMNA), tx, null);
      out["blank_query"] = await targets(as(AMNA), tx, "   ");
      out["by_first_name"] = await targets(as(AMNA), tx, "ba");
      out["by_upper_case_name"] = await targets(as(AMNA), tx, "DAUD");
      out["by_venture_title"] = await targets(as(AMNA), tx, "robotics");
      out["no_match"] = await targets(as(AMNA), tx, "zzz");
      out["pattern_characters_are_literal"] = await targets(as(AMNA), tx, "%");
      out["bashir"] = await targets(as(BASHIR), tx, null);
      out["a_stranger"] = await targets(as(CHAMAN), tx, null);
      out["signed_out"] = await rows(tx, ANON, `select public.share_targets($1::text)`, [null]);
      return out;
    }));

  it("share_post and undo_share: into DMs and team chats with a note, 15 seconds to undo", () =>
    check(G, "share_post", async (tx) => {
      const out: Row = {};
      const ab = await dm(tx, AMNA, BASHIR);
      const ad = await dm(tx, AMNA, DAUD);
      const g = await groupChat(tx);
      const post = await makePost(tx, BASHIR, "A post worth sharing");
      const [far] = await tx.unsafe(
        `insert into public.posts (author_id, university_id, audience, type, body) values ($1, $2, 'university', 'general', 'Only university B can see this') returning id::text`,
        [CHAMAN, UNI_B],
      );
      const farPost = (far as unknown as { id: string }).id;

      const shared = await step(tx, as(AMNA), SHARE, [post, arr([ab, g]), "look at this"]);
      out["into_a_dm_and_the_team_chat_with_a_note"] = shared;
      const ids = idsOf(shared);
      out["share_message_lists"] = {
        threads: await rows(tx, as(BASHIR), `select body, shared, shared_post_id is not null as has_post from public.thread_messages($1::uuid) order by body`, [ab]),
        team_chat: await rows(tx, as(BASHIR), `select body, shared from public.thread_messages($1::uuid)`, [g]),
      };
      out["undo_by_someone_else"] = await step(tx, as(BASHIR), UNDO, [arr(ids)]);
      out["undo_within_15_seconds"] = await step(tx, as(AMNA), UNDO, [arr(ids)]);
      out["undo_again_is_too_late"] = await step(tx, as(AMNA), UNDO, [arr(ids)]);
      out["undo_nothing"] = await step(tx, as(AMNA), UNDO, ["{}"]);
      out["undo_null"] = await step(tx, as(AMNA), UNDO, [null]);

      const again = await step(tx, as(AMNA), SHARE, [post, arr([ad]), null]);
      out["without_a_note"] = again;
      const ids2 = idsOf(again);
      await tx.unsafe(`update public.chat_messages set created_at = now() - interval '20 seconds' where id = any($1::text::uuid[])`, [arr(ids2)]);
      out["undo_after_20_seconds"] = await step(tx, as(AMNA), UNDO, [arr(ids2)]);
      out["undo_signed_out"] = await call(tx, ANON, UNDO, [arr(ids2)]);

      out["the_same_thread_twice_sends_once"] = await step(tx, as(AMNA), SHARE, [post, arr([ab, ab]), "twice"]);
      out["a_post_she_cannot_see"] = await step(tx, as(AMNA), SHARE, [farPost, arr([ab]), null]);
      const df = await dm(tx, DAUD, FAIZ);
      out["a_dm_she_is_not_in"] = await step(tx, as(AMNA), SHARE, [post, arr([df]), null]);
      out["one_good_one_foreign_thread_sends_nothing"] = await step(tx, as(AMNA), SHARE, [post, arr([ad, df]), null]);
      out["an_unknown_thread"] = await step(tx, as(AMNA), SHARE, [post, arr(["8f000000-0000-4000-8000-0000000000ff"]), null]);
      out["a_note_of_exactly_1000_characters"] = await call(tx, as(AMNA), `cardinality(public.share_post($1::uuid, $2::text::uuid[], $3::text))`, [post, arr([ad]), "n".repeat(1000)]);
      out["signed_out"] = await call(tx, ANON, SHARE, [post, arr([ab]), null]);
      await block(tx, DAUD, AMNA);
      out["into_a_dm_with_someone_who_blocked_her"] = await step(tx, as(AMNA), SHARE, [post, arr([ad]), null]);
      return out;
    }));
});
// END-OF-CASES
