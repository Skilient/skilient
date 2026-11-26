/**
 * Golden replays of messages.json, extras.json and share.json (packages/testing/test/messaging.golden.test.ts,
 * "messages", "extras" and "share"). An uploaded image is media's fact (W9) and a post's visibility content's:
 * both are passed as the recording's storage and post rows had them (rule 4).
 */
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, it } from "vitest";
import { deleteMessage, editMessage, pinMessage, reactionSummary, searchChats, sendMessage, threadMessages, threadPins, toggleReaction, type Media } from "../../src/store/messages";
import { sharePost, shareTargets, undoShare } from "../../src/store/share";
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
  joinTeam,
  makePost,
  message,
  NAME,
  readAt,
  removeMessage,
  replay,
  startWorld,
  step,
  UNKNOWN,
  USERNAME,
  ventures,
  type Tx,
} from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

const noop = () => {};
const send = (me: string | null, thread: string, body: string, reply: string | null, media: Media | null = null, imageOwned = true) => (sp: Tx) =>
  sendMessage(sp, me, thread, body, media, reply, null, { restricted: noop, postVisible: false, imageOwned });

describe("messages.json", () => {
  it("send", () =>
    replay(sql, "messages", "send", async (tx) => {
      const out: Record<string, unknown> = {};
      const ab = await dm(tx, AMNA, BASHIR);
      const g = await groupChat(tx);
      out["text_to_a_friend"] = await step(tx, send(AMNA, ab, "hello there", null));
      const orig = await message(tx, ab, BASHIR, "the original", 5);
      out["reply"] = await step(tx, send(AMNA, ab, "a reply", orig));
      out["reply_to_own_message"] = await step(tx, send(AMNA, ab, "a follow-up", orig));
      const other = await message(tx, g, FAIZ, "in the team chat", 4);
      out["reply_on_another_thread"] = await step(tx, send(AMNA, ab, "wrong thread", other));
      const gone = await message(tx, ab, BASHIR, "to be deleted", 3);
      await removeMessage(tx, gone);
      out["reply_to_deleted"] = await step(tx, send(AMNA, ab, "reply to nothing", gone));
      out["empty_body"] = await step(tx, send(AMNA, ab, "", null));
      out["blank_body"] = await step(tx, send(AMNA, ab, "   ", null));
      out["null_body"] = await step(tx, send(AMNA, ab, "", null));
      out["exactly_10000_characters"] = await call(tx, async (sp) => (await send(AMNA, ab, "x".repeat(10000), null)(sp)) !== null);
      out["10001_characters"] = await step(tx, send(AMNA, ab, "x".repeat(10001), null));
      out["team_chat_member"] = await step(tx, send(AMNA, g, "hello team", null));
      out["team_chat_outsider"] = await step(tx, send(ERUM, g, "let me in", null));
      out["not_a_member"] = await step(tx, send(ERUM, ab, "hello", null));
      out["unknown_thread"] = await call(tx, send(AMNA, UNKNOWN, "hello", null));
      out["signed_out"] = await call(tx, send(null, ab, "hello", null), "send_message");
      const path = `${ab}/9f000000-0000-4000-8000-000000000001.webp`;
      out["image_not_uploaded"] = await step(tx, send(AMNA, ab, "", null, { path, width: 640, height: 480 }, false));
      out["image_uploaded_by_sender"] = await step(tx, send(AMNA, ab, "", null, { path, width: 640, height: 480 }, true));
      out["image_uploaded_by_someone_else"] = await step(tx, send(AMNA, ab, "", null, { path: `${ab}/9f000000-0000-4000-8000-000000000002.webp`, width: 640, height: 480 }, false));
      out["image_for_another_thread"] = await step(tx, send(AMNA, ab, "", null, { path: `${g}/9f000000-0000-4000-8000-000000000003.webp`, width: 640, height: 480 }, true));
      const ad = await dm(tx, AMNA, DAUD);
      await tx`update messaging.threads set closed_at = now() where id = ${ad}`;
      out["closed_thread"] = await step(tx, send(AMNA, ad, "anyone there", null));
      out["closed_thread_other_side"] = await step(tx, send(DAUD, ad, "anyone there", null));
      const ac = await dm(tx, AMNA, CHAMAN);
      await block(tx, CHAMAN, AMNA);
      out["blocked_dm"] = await step(tx, send(AMNA, ac, "hello", null));
      out["blocked_dm_by_the_blocker"] = await step(tx, send(CHAMAN, ac, "hello", null));
      return out;
    }));

  it("send_rate_limit", () =>
    replay(sql, "messages", "send_rate_limit", async (tx) => {
      const ab = await dm(tx, AMNA, BASHIR);
      const results: string[] = [];
      for (let i = 1; i <= 31; i++) {
        const r = (await call(tx, send(AMNA, ab, `fast ${i}`, null))) as { ok: boolean; code?: string; message?: string };
        results.push(r.ok ? "ok" : `${r.code}: ${r.message}`);
      }
      const [sent] = await tx<{ n: number }[]>`select count(*)::int as n from messaging.messages where thread_id = ${ab} and sender_id = ${AMNA}`;
      return {
        sent: sent!.n,
        ok_count: results.filter((r) => r === "ok").length,
        first_refusal_at: results.findIndex((r) => r !== "ok") + 1,
        refusal: results.find((r) => r !== "ok") ?? null,
        another_sender_not_limited: await call(tx, send(BASHIR, ab, "still fine", null)),
      };
    }));

  it("edit", () =>
    replay(sql, "messages", "edit", async (tx) => {
      const out: Record<string, unknown> = {};
      const ab = await dm(tx, AMNA, BASHIR);
      const mine = await message(tx, ab, AMNA, "my text", 10);
      const theirs = await message(tx, ab, BASHIR, "their text", 9);
      const gone = await message(tx, ab, AMNA, "to be deleted", 8);
      await removeMessage(tx, gone);
      const pic = await imageMessage(tx, ab, AMNA, 7);
      const edit = (me: string | null, id: string, body: string) => (sp: Tx) => editMessage(sp, me, id, body);
      out["own"] = await step(tx, edit(AMNA, mine, "my edited text"));
      out["own_with_a_link"] = await step(tx, edit(AMNA, mine, "see https://example.com/page now"));
      out["someone_elses"] = await step(tx, edit(AMNA, theirs, "hijacked"));
      out["deleted"] = await step(tx, edit(AMNA, gone, "back from the dead"));
      out["empty_text"] = await step(tx, edit(AMNA, mine, ""));
      out["blank_text"] = await step(tx, edit(AMNA, mine, "   "));
      out["null_text"] = await step(tx, edit(AMNA, mine, ""));
      out["10001_characters"] = await step(tx, edit(AMNA, mine, "x".repeat(10001)));
      out["image_message_to_empty_text"] = await step(tx, edit(AMNA, pic, ""));
      out["image_message_gets_a_caption"] = await step(tx, edit(AMNA, pic, "a caption"));
      out["unknown_message"] = await call(tx, edit(AMNA, UNKNOWN, "hello"));
      out["signed_out"] = await call(tx, edit(null, mine, "hello"), "edit_message");
      await block(tx, BASHIR, AMNA);
      out["in_a_blocked_dm"] = await step(tx, edit(AMNA, mine, "edit after the block"));
      return out;
    }));

  it("delete", () =>
    replay(sql, "messages", "delete", async (tx) => {
      const out: Record<string, unknown> = {};
      const ab = await dm(tx, AMNA, BASHIR);
      const text = await message(tx, ab, AMNA, "bye", 10);
      const pic = await imageMessage(tx, ab, AMNA, 9);
      const theirs = await message(tx, ab, BASHIR, "not yours", 8);
      const del = (me: string | null, id: string) => (sp: Tx) => deleteMessage(sp, me, id);
      out["own_text_returns_no_path"] = await step(tx, del(AMNA, text));
      out["own_image_returns_path"] = await step(tx, del(AMNA, pic));
      out["twice"] = await step(tx, del(AMNA, text));
      out["someone_elses"] = await step(tx, del(AMNA, theirs));
      out["unknown_message"] = await call(tx, del(AMNA, UNKNOWN));
      out["signed_out"] = await call(tx, del(null, theirs), "delete_message");
      return out;
    }));

  it("thread_messages", () =>
    replay(sql, "messages", "thread_messages", async (tx) => {
      const out: Record<string, unknown> = {};
      const ab = await dm(tx, AMNA, BASHIR);
      const m1 = await message(tx, ab, AMNA, "one", 50);
      const m2 = await message(tx, ab, BASHIR, "two", 40);
      await tx`update messaging.messages set reply_to_id = ${m1} where id = ${m2}`;
      const m3 = await message(tx, ab, AMNA, "three", 30);
      await removeMessage(tx, m3);
      const m4 = await imageMessage(tx, ab, BASHIR, 20);
      const m5 = await message(tx, ab, AMNA, "five, with a link https://example.com/five", 10);
      await tx`update messaging.messages set reply_to_id = ${m4} where id = ${m5}`;
      const m6 = await message(tx, ab, BASHIR, "six", 5);
      await tx`update messaging.messages set reply_to_id = ${m3} where id = ${m6}`;
      const post = await makePost();
      await tx`insert into messaging.messages (id, thread_id, sender_id, body, shared_post_id, shared, created_at) values (gen_random_uuid(), ${ab}, ${AMNA}, '', ${post}, true, now() - interval '2 minutes')`;
      await tx`update messaging.messages set reply_to_id = (select id from messaging.messages where body = '' and shared) where id = ${m6}`;
      await tx`insert into messaging.pins (message_id, thread_id, pinned_by) values (${m2}, ${ab}, ${BASHIR})`;
      await tx`insert into messaging.reactions (message_id, thread_id, user_id, emoji) values (${m1}, ${ab}, ${AMNA}, '👍'), (${m1}, ${ab}, ${BASHIR}, '❤️'), (${m5}, ${ab}, ${AMNA}, '🎉')`;
      await tx`update messaging.messages set edited_at = now() where id = ${m1}`;
      const page = (me: string | null, thread: string, before: string | null, limit: number | null, fn?: string) =>
        call(
          tx,
          async (sp) =>
            (await threadMessages(sp, me, thread, before, limit)).map((m) => ({
              body: m.body,
              deleted: m.deleted,
              reply_excerpt: m.reply_excerpt,
              pinned: m.pinned,
              is_reply: m.reply_to_id !== null,
              reactions: m.reactions,
              // The preview card is content's (LinkPreviews); the recording had none cached.
              link: null,
              has_image: m.media_path !== null,
              shared: m.shared,
              has_post: m.shared_post_id !== null,
              edited: m.edited_at !== null,
              from_amna: m.sender_id === AMNA,
            })),
          fn,
        );
      out["default_page_as_amna"] = await page(AMNA, ab, null, null);
      out["default_page_as_bashir"] = await page(BASHIR, ab, null, null);
      out["limit_3"] = await page(AMNA, ab, null, 3);
      out["limit_0_is_1"] = await page(AMNA, ab, null, 0);
      out["limit_1000_is_100"] = await call(tx, async (sp) => String((await threadMessages(sp, AMNA, ab, null, 1000)).length));
      const [c1] = await tx<{ t: string }[]>`select (now() - interval '25 minutes')::text as t`;
      out["before_25_minutes_ago"] = await page(AMNA, ab, c1!.t, null);
      const [c2] = await tx<{ t: string }[]>`select (now() - interval '2 hours')::text as t`;
      out["before_the_beginning"] = await page(AMNA, ab, c2!.t, null);
      out["not_a_member"] = await page(ERUM, ab, null, null);
      out["signed_out"] = await page(null, ab, null, null, "thread_messages");
      await block(tx, BASHIR, AMNA);
      out["blocked_dm_as_amna"] = await page(AMNA, ab, null, null);
      out["blocked_dm_as_bashir"] = await page(BASHIR, ab, null, null);
      return out;
    }));
});

describe("extras.json", () => {
  const summary = (tx: Tx, me: string | null, ids: string[]) =>
    call(tx, async (sp) => {
      const rows = await reactionSummary(sp, me, ids);
      const bodies = new Map((await sp<{ id: string; body: string }[]>`select id::text, body from messaging.messages where id = any(${ids}::uuid[])`).map((r) => [r.id, r.body]));
      return rows.map((r) => ({ body: bodies.get(r.message_id) ?? null, reactions: r.reactions })).sort((a, b) => String(a.body).localeCompare(String(b.body)));
    });
  const toggle = (me: string | null, id: string, emoji: string) => (sp: Tx) => toggleReaction(sp, me, id, emoji, noop);

  it("reactions", () =>
    replay(sql, "extras", "reactions", async (tx) => {
      const out: Record<string, unknown> = {};
      const ab = await dm(tx, AMNA, BASHIR);
      const g = await groupChat(tx);
      const msg = await message(tx, ab, BASHIR, "react to me", 10);
      out["add"] = await step(tx, toggle(AMNA, msg, "👍"));
      out["summary_as_amna"] = await summary(tx, AMNA, [msg]);
      out["summary_as_bashir"] = await summary(tx, BASHIR, [msg]);
      out["same_again_takes_it_back"] = await step(tx, toggle(AMNA, msg, "👍"));
      out["add_heart"] = await step(tx, toggle(AMNA, msg, "❤️"));
      out["switch_to_laugh"] = await step(tx, toggle(AMNA, msg, "😂"));
      out["other_person_adds"] = await step(tx, toggle(BASHIR, msg, "😂"));
      out["summary_after"] = await summary(tx, AMNA, [msg]);
      out["bad_emoji"] = await step(tx, toggle(AMNA, msg, "👎"));
      out["empty_emoji"] = await step(tx, toggle(AMNA, msg, ""));
      out["null_emoji"] = await step(tx, toggle(AMNA, msg, ""));
      const gone = await message(tx, ab, BASHIR, "gone", 9);
      await removeMessage(tx, gone);
      out["deleted_message"] = await step(tx, toggle(AMNA, gone, "👍"));
      out["not_a_member"] = await step(tx, toggle(ERUM, msg, "👍"));
      out["unknown_message"] = await call(tx, toggle(AMNA, UNKNOWN, "👍"));
      out["signed_out"] = await call(tx, toggle(null, msg, "👍"), "toggle_reaction");
      out["summary_not_a_member"] = await summary(tx, ERUM, [msg]);
      const gm = await message(tx, g, FAIZ, "team news", 8);
      await joinTeam(tx, FAIZ);
      out["group_amna_reacts"] = await step(tx, toggle(AMNA, gm, "🎉"));
      out["group_bashir_reacts"] = await step(tx, toggle(BASHIR, gm, "🎉"));
      out["group_summary_before_block"] = await summary(tx, AMNA, [gm]);
      await block(tx, AMNA, BASHIR);
      out["group_summary_after_amna_blocks_bashir"] = await summary(tx, AMNA, [gm]);
      out["group_summary_as_bashir"] = await summary(tx, BASHIR, [gm]);
      out["group_summary_as_faiz"] = await summary(tx, FAIZ, [gm]);
      out["react_in_the_blocked_dm"] = await step(tx, toggle(AMNA, msg, "🙏"));
      return out;
    }));

  it("pins", () =>
    replay(sql, "extras", "pins", async (tx) => {
      const out: Record<string, unknown> = {};
      const g = await groupChat(tx);
      const p1 = await message(tx, g, AMNA, "pin one", 20);
      const p2 = await message(tx, g, BASHIR, "pin two", 19);
      const p3 = await message(tx, g, AMNA, "pin three", 18);
      const p4 = await message(tx, g, AMNA, "pin four", 17);
      const gone = await message(tx, g, AMNA, "pin gone", 16);
      await removeMessage(tx, gone);
      const pin = (me: string | null, id: string, p: boolean) => (sp: Tx) => pinMessage(sp, me, id, p, noop);
      const pins = (me: string | null, thread: string, withSender: boolean, fn?: string) =>
        call(tx, async (sp) => (await threadPins(sp, me, thread)).map((p) => (withSender ? { excerpt: p.excerpt, by_amna: p.sender_id === AMNA } : { excerpt: p.excerpt })), fn);
      out["owner_not_in_the_chat_yet"] = await step(tx, pin(FAIZ, p1, true));
      await joinTeam(tx, FAIZ);
      out["non_owner_member"] = await step(tx, pin(AMNA, p1, true));
      out["pin_one"] = await step(tx, pin(FAIZ, p1, true));
      out["pin_one_again"] = await step(tx, pin(FAIZ, p1, true));
      out["pin_two"] = await step(tx, pin(FAIZ, p2, true));
      out["pin_three"] = await step(tx, pin(FAIZ, p3, true));
      out["fourth_is_refused"] = await step(tx, pin(FAIZ, p4, true));
      out["pins_as_amna"] = await pins(AMNA, g, true);
      out["pins_as_outsider"] = await pins(ERUM, g, false);
      out["unpin_one"] = await step(tx, pin(FAIZ, p1, false));
      out["unpin_again"] = await step(tx, pin(FAIZ, p1, false));
      out["pin_four_after_unpin"] = await step(tx, pin(FAIZ, p4, true));
      out["deleted_message"] = await step(tx, pin(FAIZ, gone, true));
      out["unknown_message"] = await call(tx, pin(FAIZ, UNKNOWN, true));
      out["outsider"] = await step(tx, pin(ERUM, p1, true));
      out["signed_out"] = await call(tx, pin(null, p1, true), "pin_message");
      const fe = await dm(tx, FAIZ, ERUM);
      const dmMsg = await message(tx, fe, ERUM, "in a dm", 5);
      out["in_a_dm"] = await step(tx, pin(FAIZ, dmMsg, true));
      out["pins_final_as_faiz"] = await pins(FAIZ, g, false);
      out["pins_not_a_member_of_dm"] = await pins(AMNA, fe, false);
      out["pins_signed_out"] = await pins(null, g, false, "thread_pins");
      return out;
    }));

  it("search", () =>
    replay(sql, "extras", "search", async (tx) => {
      const out: Record<string, unknown> = {};
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
      const search = (me: string | null, q: string, thread: string | null = null, fn?: string) =>
        call(
          tx,
          async (sp) => {
            const rows = await searchChats(sp, me, q, thread);
            const titles = await ventures.titles(rows.map((r) => r.venture_id).filter((x): x is string => x !== null));
            return rows.map((r) => ({
              thread_title: r.thread_type === "group" ? (titles.get(r.venture_id!) ?? null) : (NAME[r.other_id ?? ""] ?? null),
              sender_name: r.sender_id === me ? "You" : NAME[r.sender_id]!,
              excerpt: r.excerpt,
            }));
          },
          fn,
        );
      out["whole_word"] = await search(AMNA, "world");
      out["prefix"] = await search(AMNA, "wor");
      out["two_words"] = await search(AMNA, "world plans");
      out["case_and_punctuation"] = await search(AMNA, "  PLANS!! ");
      out["two_letters"] = await search(AMNA, "wo");
      out["one_letter"] = await search(AMNA, "w");
      out["empty"] = await search(AMNA, "");
      out["only_symbols"] = await search(AMNA, "!!! ???");
      out["null_query"] = await search(AMNA, "");
      out["no_match"] = await search(AMNA, "zebra");
      out["one_thread"] = await search(AMNA, "world", ab);
      out["one_thread_not_mine"] = await search(AMNA, "world", fe);
      out["the_other_pair_sees_their_own_chat"] = await search(ERUM, "world");
      out["bashir"] = await search(BASHIR, "world");
      await block(tx, AMNA, BASHIR);
      out["after_amna_blocks_bashir"] = await search(AMNA, "world");
      out["signed_out"] = await search(null, "world", null, "search_chats");
      return out;
    }));
});

describe("share.json", () => {
  const targets = (tx: Tx, me: string | null, q: string | null, fn?: string) =>
    call(
      tx,
      async (sp) => {
        const rows = await shareTargets(sp, me);
        const titles = await ventures.titles(rows.map((r) => r.venture_id).filter((x): x is string => x !== null));
        return rows
          .map((r) => ({
            title: r.type === "group" ? (titles.get(r.venture_id!) ?? null) : (NAME[r.other_id ?? ""] ?? null),
            type: r.type,
            username: r.type === "dm" && r.other_visible ? (USERNAME[r.other_id ?? ""] ?? null) : null,
            has_last_at: r.last_at !== null,
          }))
          .filter((t) => !q || q.trim() === "" || String(t.title ?? "").toLowerCase().includes(q.trim().toLowerCase()))
          .slice(0, 30);
      },
      fn,
    );

  it("share_targets", () =>
    replay(sql, "share", "share_targets", async (tx) => {
      const out: Record<string, unknown> = {};
      const ab = await dm(tx, AMNA, BASHIR);
      const ad = await dm(tx, AMNA, DAUD);
      const ae = await dm(tx, AMNA, ERUM);
      await dm(tx, AMNA, CHAMAN);
      const g = await groupChat(tx);
      for (const [t, mins] of [
        [ab, 10],
        [ad, 5],
        [ae, 1],
        [g, 20],
      ] as const)
        await tx`update messaging.threads set last_message_at = now() - make_interval(mins => ${mins}) where id = ${t}`;
      await block(tx, ERUM, AMNA);
      out["everything"] = await targets(tx, AMNA, null);
      out["blank_query"] = await targets(tx, AMNA, "   ");
      out["by_first_name"] = await targets(tx, AMNA, "ba");
      out["by_upper_case_name"] = await targets(tx, AMNA, "DAUD");
      out["by_venture_title"] = await targets(tx, AMNA, "robotics");
      out["no_match"] = await targets(tx, AMNA, "zzz");
      out["pattern_characters_are_literal"] = await targets(tx, AMNA, "%");
      out["bashir"] = await targets(tx, BASHIR, null);
      out["a_stranger"] = await targets(tx, CHAMAN, null);
      out["signed_out"] = await targets(tx, null, null, "share_targets");
      return out;
    }));

  it("share_post", () =>
    replay(sql, "share", "share_post", async (tx) => {
      const out: Record<string, unknown> = {};
      const ab = await dm(tx, AMNA, BASHIR);
      const ad = await dm(tx, AMNA, DAUD);
      const g = await groupChat(tx);
      const post = await makePost();
      const farPost = await makePost();
      // content's VisiblePosts: Amna sees Bashir's university post, not the post only university B sees.
      const share = (me: string | null, p: string | null, threads: string[] | null, note: string | null) => (sp: Tx) =>
        sharePost(sp, me, p, threads, note, p === post, noop);
      const undo = (me: string | null, ids: string[]) => (sp: Tx) => undoShare(sp, me, ids);
      const shared = await step(tx, share(AMNA, post, [ab, g], "look at this"));
      out["into_a_dm_and_the_team_chat_with_a_note"] = shared;
      const ids = (shared.result as { value: string[] }).value;
      const list = async (thread: string, withPost: boolean) =>
        call(tx, async (sp) => {
          const rows = (await sp<{ body: string; shared: boolean; has_post: boolean }[]>`
            select body, shared, shared_post_id is not null as has_post from messaging.messages where thread_id = ${thread} order by created_at desc`).map((r) =>
            withPost ? { body: r.body, shared: r.shared, has_post: r.has_post } : { body: r.body, shared: r.shared },
          );
          return withPost ? rows.sort((a, b) => a.body.localeCompare(b.body)) : rows;
        });
      out["share_message_lists"] = { threads: await list(ab, true), team_chat: await list(g, false) };
      out["undo_by_someone_else"] = await step(tx, undo(BASHIR, ids));
      out["undo_within_15_seconds"] = await step(tx, undo(AMNA, ids));
      out["undo_again_is_too_late"] = await step(tx, undo(AMNA, ids));
      out["undo_nothing"] = await step(tx, undo(AMNA, []));
      out["undo_null"] = await step(tx, undo(AMNA, []));
      const again = await step(tx, share(AMNA, post, [ad], null));
      out["without_a_note"] = again;
      const ids2 = (again.result as { value: string[] }).value;
      await tx`update messaging.messages set created_at = now() - interval '20 seconds' where id = any(${ids2}::uuid[])`;
      out["undo_after_20_seconds"] = await step(tx, undo(AMNA, ids2));
      out["undo_signed_out"] = await call(tx, undo(null, ids2), "undo_share");
      out["the_same_thread_twice_sends_once"] = await step(tx, share(AMNA, post, [ab, ab], "twice"));
      out["a_post_she_cannot_see"] = await step(tx, share(AMNA, farPost, [ab], null));
      const df = await dm(tx, DAUD, FAIZ);
      out["a_dm_she_is_not_in"] = await step(tx, share(AMNA, post, [df], null));
      out["one_good_one_foreign_thread_sends_nothing"] = await step(tx, share(AMNA, post, [ad, df], null));
      out["an_unknown_thread"] = await step(tx, share(AMNA, post, [UNKNOWN], null));
      out["a_note_of_exactly_1000_characters"] = await call(tx, async (sp) => (await share(AMNA, post, [ad], "n".repeat(1000))(sp)).length);
      out["signed_out"] = await call(tx, share(null, post, [ab], null), "share_post");
      await block(tx, DAUD, AMNA);
      out["into_a_dm_with_someone_who_blocked_her"] = await step(tx, share(AMNA, post, [ad], null));
      return out;
    }));
});

void readAt;
