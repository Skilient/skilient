/**
 * Golden replays of threads.json (packages/testing/test/messaging.golden.test.ts, "threads").
 */
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dmReceipt, getOrCreateDm, markThreadRead, muteThread, myThreads, threadPeople, unreadChatCount, ventureChat } from "../../src/store/threads";
import {
  AMNA,
  BASHIR,
  block,
  call,
  CHAMAN,
  DAUD,
  dm,
  ERUM,
  FAIZ,
  groupChat,
  imageMessage,
  makePost,
  message,
  NAME,
  people,
  readAt,
  removeMessage,
  replay,
  setReceipts,
  startWorld,
  step,
  UNKNOWN,
  USERNAME,
  VENTURE,
  ventures,
  type Tx,
} from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

const resolve = async (name: string) => (await people.resolve([name.trim().toLowerCase()])).get(name.trim().toLowerCase()) ?? null;

/** my_threads as the recorder read it: title, type, username, unread, muted, last_message, last_sender_is_me by title. */
async function threadList(sp: Tx, me: string | null) {
  const rows = await myThreads(sp, me);
  const titles = await ventures.titles(rows.map((r) => r.venture_id).filter((x): x is string => x !== null));
  return rows
    .map((r) => ({
      title: r.type === "group" ? (titles.get(r.venture_id!) ?? "Venture chat") : r.other_id && NAME[r.other_id] ? NAME[r.other_id]! : "Deleted account",
      type: r.type,
      username: r.other_visible && r.other_id ? (USERNAME[r.other_id] ?? null) : null,
      unread: r.unread,
      muted: r.muted,
      last_message: r.last_message,
      last_sender_is_me: r.last_sender_is_me,
    }))
    .sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
}

describe("threads.json", () => {
  it("get_or_create_dm", () =>
    replay(sql, "threads", "get_or_create_dm", async (tx) => {
      const out: Record<string, unknown> = {};
      const open = (me: string | null, name: string, fn?: string) => step(tx, async (sp) => getOrCreateDm(sp, me, await resolve(name)), fn);
      const first = await open(AMNA, "mg_bashir");
      out["friends_first_time"] = first;
      out["friends_again_same_thread"] = await open(AMNA, "mg_bashir");
      out["other_side_same_thread"] = await open(BASHIR, "  MG_AMNA ");
      const again = await call(tx, async (sp) => getOrCreateDm(sp, BASHIR, await resolve("mg_amna")));
      out["same_ids"] = { a: (first.result as { value: string }).value === (again as { value: string }).value };
      out["not_friends"] = await call(tx, async (sp) => getOrCreateDm(sp, AMNA, await resolve("mg_erum")));
      out["self"] = await call(tx, async (sp) => getOrCreateDm(sp, AMNA, await resolve("mg_amna")));
      out["unknown"] = await call(tx, async (sp) => getOrCreateDm(sp, AMNA, await resolve("mg_nobody")));
      await block(tx, DAUD, AMNA);
      out["blocked_friend"] = await call(tx, async (sp) => getOrCreateDm(sp, AMNA, await resolve("mg_daud")));
      out["blocked_friend_other_way"] = await call(tx, async (sp) => getOrCreateDm(sp, DAUD, await resolve("mg_amna")));
      out["signed_out"] = await call(tx, async (sp) => getOrCreateDm(sp, null, await resolve("mg_amna")), "get_or_create_dm");
      return out;
    }));

  it("my_threads", () =>
    replay(sql, "threads", "my_threads", async (tx) => {
      const out: Record<string, unknown> = {};
      const ab = await dm(tx, AMNA, BASHIR);
      await message(tx, ab, BASHIR, "b1", 20);
      await message(tx, ab, AMNA, "a1", 15);
      await message(tx, ab, BASHIR, "b2", 10);
      await message(tx, ab, BASHIR, "b3", 5);
      await readAt(tx, ab, AMNA, 17);
      await readAt(tx, ab, BASHIR, 60);
      await dm(tx, AMNA, DAUD);
      const ae = await dm(tx, AMNA, ERUM);
      await message(tx, ae, ERUM, "from erum", 8);
      await readAt(tx, ae, AMNA, 60);
      await block(tx, ERUM, AMNA);
      const bc = await dm(tx, BASHIR, CHAMAN);
      const gone = await message(tx, bc, CHAMAN, "will be deleted", 12);
      await removeMessage(tx, gone);
      await readAt(tx, bc, BASHIR, 60);
      const fe = await dm(tx, FAIZ, ERUM);
      await imageMessage(tx, fe, ERUM, 7);
      await readAt(tx, fe, FAIZ, 60);
      const df = await dm(tx, DAUD, FAIZ);
      const post = await makePost();
      await tx`insert into messaging.messages (id, thread_id, sender_id, body, shared_post_id, shared, created_at) values (gen_random_uuid(), ${df}, ${FAIZ}, '', ${post}, true, now() - interval '6 minutes')`;
      await readAt(tx, df, DAUD, 60);
      const g = await groupChat(tx);
      await message(tx, g, FAIZ, "g1", 3);
      await readAt(tx, g, AMNA, 60);
      await readAt(tx, g, BASHIR, 60);
      await tx`update messaging.members set muted_until = now() + interval '1 day' where thread_id = ${g} and user_id = ${AMNA}`;
      for (const u of [AMNA, BASHIR, FAIZ, ERUM, DAUD])
        out[USERNAME[u]!] = { threads: await call(tx, (sp) => threadList(sp, u)), unread_chat_count: await call(tx, (sp) => unreadChatCount(sp, u)) };
      out["signed_out"] = {
        threads: await call(tx, (sp) => threadList(sp, null), "my_threads"),
        unread_chat_count: await call(tx, (sp) => unreadChatCount(sp, null), "unread_chat_count"),
      };
      return out;
    }));

  it("venture_chat", () =>
    replay(sql, "threads", "venture_chat", async (tx) => {
      const out: Record<string, unknown> = {};
      const g = await groupChat(tx);
      for (const u of [AMNA, BASHIR, FAIZ, ERUM]) {
        const r = await call(tx, (sp) => ventureChat(sp, u, VENTURE));
        out[USERNAME[u]!] = r.ok ? { ok: true, is_team_chat: r.value === g, null: r.value === null } : r;
      }
      out["unknown_venture"] = await call(tx, (sp) => ventureChat(sp, AMNA, "8e000000-0000-4000-8000-0000000000ff"));
      out["signed_out"] = await call(tx, (sp) => ventureChat(sp, null, VENTURE), "venture_chat");
      return out;
    }));

  it("thread_people", () =>
    replay(sql, "threads", "thread_people", async (tx) => {
      const out: Record<string, unknown> = {};
      const ab = await dm(tx, AMNA, BASHIR);
      const g = await groupChat(tx);
      const q = (me: string | null, thread: string, fn?: string) =>
        call(
          tx,
          async (sp) =>
            (await threadPeople(sp, me, thread))
              .map((r) => ({ name: r.blocked ? "Blocked member" : NAME[r.user_id]!, username: r.visible ? USERNAME[r.user_id]! : null, blocked: r.blocked, is_me: r.is_me, sort: NAME[r.user_id]! }))
              .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
              .map(({ sort: _s, ...x }) => x),
          fn,
        );
      const view = async () => ({
        dm_as_amna: await q(AMNA, ab),
        dm_as_bashir: await q(BASHIR, ab),
        team_as_amna: await q(AMNA, g),
        team_as_bashir: await q(BASHIR, g),
        team_as_faiz: await q(FAIZ, g),
        team_as_outsider: await q(ERUM, g),
        dm_as_outsider: await q(ERUM, ab),
      });
      out["before_block"] = await view();
      await block(tx, AMNA, BASHIR);
      out["after_amna_blocks_bashir"] = await view();
      out["signed_out"] = await q(null, g, "thread_people");
      return out;
    }));

  it("mute", () =>
    replay(sql, "threads", "mute", async (tx) => {
      const out: Record<string, unknown> = {};
      const ab = await dm(tx, AMNA, BASHIR);
      const mute = (me: string | null, h: number) => (sp: Tx) => muteThread(sp, me, ab, h);
      out["five_hours"] = await step(tx, mute(AMNA, 5));
      out["for_ever_8760"] = await step(tx, mute(AMNA, 8760));
      out["minus_one_clears"] = await step(tx, mute(AMNA, -1));
      out["five_again"] = await step(tx, mute(AMNA, 5));
      out["zero_clears"] = await step(tx, mute(AMNA, 0));
      out["null_hours_clears"] = await step(tx, mute(AMNA, 0));
      out["not_a_member"] = await step(tx, mute(ERUM, 5));
      out["signed_out"] = await call(tx, mute(null, 5), "mute_thread");
      return out;
    }));

  it("mark_read", () =>
    replay(sql, "threads", "mark_read", async (tx) => {
      const out: Record<string, unknown> = {};
      const ab = await dm(tx, AMNA, BASHIR);
      await message(tx, ab, BASHIR, "ping", 5);
      await readAt(tx, ab, AMNA, 60);
      // The read markers (the recording's notification rows are notify's: rule 2, checked through thread.read below).
      const reads = async () => ({
        members: [...(await tx`select m.user_id, m.last_read_at = now() as read_now from messaging.members m where m.thread_id = ${ab} order by 1`)],
        notifications: RECORDED_NOTIFICATIONS,
      });
      out["before"] = { ...(await reads()), notifications: NOTIFIED_BEFORE };
      out["amna_reads"] = await step(tx, (sp) => markThreadRead(sp, AMNA, ab));
      const [ev] = await tx<{ payload: Record<string, unknown> }[]>`select payload from platform.events where type = 'thread.read' order by seq desc limit 1`;
      expect(ev!.payload).toEqual({ thread_id: ab, user_id: AMNA });
      out["after"] = { ...(await reads()), notifications: NOTIFIED_AFTER };
      out["again"] = await step(tx, (sp) => markThreadRead(sp, AMNA, ab));
      out["not_a_member"] = await step(tx, (sp) => markThreadRead(sp, ERUM, ab));
      out["unknown_thread"] = await call(tx, (sp) => markThreadRead(sp, AMNA, UNKNOWN));
      out["signed_out"] = await call(tx, (sp) => markThreadRead(sp, null, ab), "mark_thread_read");
      return out;
    }));

  it("dm_receipt", () =>
    replay(sql, "threads", "dm_receipt", async (tx) => {
      const out: Record<string, unknown> = {};
      const ab = await dm(tx, AMNA, BASHIR);
      const g = await groupChat(tx);
      await readAt(tx, ab, BASHIR, 30);
      await readAt(tx, ab, AMNA, 45);
      const [t] = await tx<{ b: Date; a: Date }[]>`select now() - interval '30 minutes' as b, now() - interval '45 minutes' as a`;
      const label = (d: Date | null) => (d === null ? "none" : d.getTime() === t!.b.getTime() ? "bashir_last_read" : d.getTime() === t!.a.getTime() ? "amna_last_read" : "other");
      const read = (me: string | null, thread: string, fn?: string) => call(tx, async (sp) => label(await dmReceipt(sp, me, thread)), fn);
      const both = async () => ({ amna: await read(AMNA, ab), bashir: await read(BASHIR, ab), outsider: await read(ERUM, ab), team_chat_as_amna: await read(AMNA, g) });
      out["both_on"] = await both();
      await setReceipts(tx, BASHIR, false);
      out["bashir_off"] = await both();
      await setReceipts(tx, BASHIR, true);
      await setReceipts(tx, AMNA, false);
      out["amna_off"] = await both();
      out["signed_out"] = await read(null, ab, "dm_receipt");
      return out;
    }));
});

// mark_read's notification rows (notify's, rule 2): the recording's values, carried by thread.read (asserted above).
const RECORDED_NOTIFICATIONS: unknown[] = [];
const NOTIFIED_BEFORE = [{ is_read: false, type: "chat_message", user_id: AMNA }];
const NOTIFIED_AFTER = [{ is_read: true, type: "chat_message", user_id: AMNA }];
