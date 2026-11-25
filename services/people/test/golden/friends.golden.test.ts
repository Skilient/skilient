/**
 * Golden replays of friends.json: requests, friendship state, unfriend, blocks and mutes, against people's
 * store with the recorded inputs (packages/testing/test/people.golden.test.ts, "friends, blocks and mutes").
 * Direct table writes the recording attempted (a blocked user inserting a friendship, deleting a block,
 * inserting a request or a mute) have no contract method; the replay asserts the store refuses or has no path,
 * and maps them to the recorded Postgres refusals.
 */
import { afterAll, beforeAll, describe, it } from "vitest";
import type postgres from "postgres";
import type { TestDatabase } from "@skilient/testing/postgres";
import {
  blockUser,
  cancelFriendRequest,
  friendshipState,
  muteUser,
  myBlocks,
  myFriendRequests,
  myFriends,
  myMutes,
  pendingFriendRequestCount,
  respondFriendRequest,
  sendFriendRequest,
  unblockUser,
  unfriend,
} from "../../src/store/friends";
import { ALI, BINA, CHAND, DUA, EMAN, replay, startWorld, step, call, STAFF, type Tx, type Outcome } from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

const befriend = (tx: Tx, a: string, b: string) => tx`insert into people.friendships (user_id_a, user_id_b) values (least(${a}::uuid, ${b}::uuid), greatest(${a}::uuid, ${b}::uuid))`;
const request = (tx: Tx, from: string, to: string) => tx`insert into people.friend_requests (id, sender_id, receiver_id) values (gen_random_uuid(), ${from}, ${to})`;
const idOf = async (tx: Tx, from: string, to?: string) =>
  (await tx<{ id: string }[]>`select id::text from people.friend_requests where sender_id = ${from} and (${to ?? null}::uuid is null or receiver_id = ${to ?? null}::uuid)`)[0]!.id;
const pick = <T extends Record<string, unknown>>(rows: T[], keys: string[]) => rows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k]])));
const LIST = ["direction", "user_id", "username", "full_name", "avatar_path", "department", "graduation_year"];
const FRIEND = ["user_id", "username", "full_name", "avatar_path", "department", "graduation_year"];
/** A refusal the Supabase grants and policies gave to a direct table write; the contract has no such write. */
const noPath = (code: string, message: string): Outcome => ({ ok: false, code, message });

describe("friends.json", () => {
  it("requests", () =>
    replay(sql, "friends", "requests", async (tx) => {
      const out: Record<string, unknown> = {};
      out["send"] = await step(tx, (sp) => sendFriendRequest(sp, ALI, "pg_bina"));
      out["send_again_rate_limited"] = await step(tx, (sp) => sendFriendRequest(sp, ALI, "pg_chand"));
      out["duplicate_from_other_side_accepts"] = await step(tx, (sp) => sendFriendRequest(sp, BINA, " PG_ALI "));
      out["already_friends"] = await call(tx, (sp) => sendFriendRequest(sp, BINA, "pg_ali"));
      out["self"] = await call(tx, (sp) => sendFriendRequest(sp, CHAND, "pg_chand"));
      out["unknown"] = await call(tx, (sp) => sendFriendRequest(sp, CHAND, "pg_nobody"));
      out["chand_to_dua"] = await step(tx, (sp) => sendFriendRequest(sp, CHAND, "pg_dua"));
      out["eman_to_dua"] = await step(tx, (sp) => sendFriendRequest(sp, EMAN, "pg_dua"));
      out["staff_to_dua"] = await step(tx, (sp) => sendFriendRequest(sp, STAFF, "pg_dua"));
      out["dua_requests"] = await call(tx, async (sp) => pick(await myFriendRequests(sp, DUA), LIST));
      out["chand_requests"] = await call(tx, async (sp) => pick(await myFriendRequests(sp, CHAND), LIST));
      out["dua_pending_count"] = await call(tx, (sp) => pendingFriendRequestCount(sp, DUA));
      const fromChand = await idOf(tx, CHAND, DUA);
      const fromEman = await idOf(tx, EMAN, DUA);
      const fromStaff = await idOf(tx, STAFF, DUA);
      out["respond_by_sender"] = await call(tx, (sp) => respondFriendRequest(sp, CHAND, fromChand, true));
      out["accept"] = await step(tx, (sp) => respondFriendRequest(sp, DUA, fromChand, true));
      out["accept_again"] = await call(tx, (sp) => respondFriendRequest(sp, DUA, fromChand, true));
      out["decline"] = await step(tx, (sp) => respondFriendRequest(sp, DUA, fromEman, false));
      out["cancel_by_receiver"] = await call(tx, (sp) => cancelFriendRequest(sp, DUA, fromStaff));
      out["cancel"] = await step(tx, (sp) => cancelFriendRequest(sp, STAFF, fromStaff));
      out["cancel_again"] = await call(tx, (sp) => cancelFriendRequest(sp, STAFF, fromStaff));
      out["resend_after_decline"] = await step(tx, (sp) => sendFriendRequest(sp, EMAN, "pg_dua"));
      out["signed_out_send"] = await call(tx, (sp) => sendFriendRequest(sp, null, "pg_dua"), "send_friend_request");
      out["signed_out_respond"] = await call(tx, (sp) => respondFriendRequest(sp, null, fromEman, true), "respond_friend_request");
      out["signed_out_cancel"] = await call(tx, (sp) => cancelFriendRequest(sp, null, fromEman), "cancel_friend_request");
      out["signed_out_count"] = await call(tx, (sp) => pendingFriendRequestCount(sp, null), "pending_friend_request_count");
      out["ali_friends"] = await call(tx, async (sp) => pick(await myFriends(sp, ALI), FRIEND));
      out["dua_friends"] = await call(tx, async (sp) => pick(await myFriends(sp, DUA), FRIEND));
      return out;
    }));

  it("state_and_unfriend", () =>
    replay(sql, "friends", "state_and_unfriend", async (tx) => {
      await befriend(tx, ALI, BINA);
      await request(tx, ALI, CHAND);
      await request(tx, EMAN, ALI);
      await tx`insert into people.blocks (blocker_id, blocked_id) values (${ALI}, ${STAFF}), (${DUA}, ${ALI})`;
      const state = (me: string | null, u: string) => call(tx, async (sp) => (await friendshipState(sp, me, u)).map((r) => ({ state: r.state, has_request: r.request_id != null })));
      const out: Record<string, unknown> = {
        self: await state(ALI, "pg_ali"),
        friends: await state(ALI, "pg_bina"),
        sent: await state(ALI, "pg_chand"),
        received: await state(ALI, "PG_EMAN"),
        blocked_by_me: await state(ALI, "pg_staff"),
        blocked_me: await state(ALI, "pg_dua"),
        none: await state(BINA, "pg_eman"),
        unknown: await state(ALI, "pg_nobody"),
            signed_out: await call(tx, (sp) => friendshipState(sp, null, "pg_ali"), "friendship_state"),
      };
      out["unfriend"] = await step(tx, (sp) => unfriend(sp, BINA, "pg_ali"));
      out["unfriend_again"] = await call(tx, (sp) => unfriend(sp, BINA, "pg_ali"));
      out["unfriend_self"] = await call(tx, (sp) => unfriend(sp, BINA, "pg_bina"));
      out["unfriend_unknown"] = await call(tx, (sp) => unfriend(sp, BINA, "pg_nobody"));
      out["unfriend_pending_request_only"] = await call(tx, (sp) => unfriend(sp, ALI, "pg_chand"));
      out["unfriend_signed_out"] = await call(tx, (sp) => unfriend(sp, null, "pg_ali"), "unfriend");
      return out;
    }));

  it("blocks", () =>
    replay(sql, "friends", "blocks", async (tx) => {
      await befriend(tx, ALI, BINA);
      await request(tx, BINA, DUA);
      await tx`insert into people.user_mutes (user_id, muted_id) values (${ALI}, ${BINA})`;
      const blocksSeenBy = (me: string) => call(tx, (sp) => sp`select blocker_id, blocked_id from people.blocks where blocker_id = ${me} order by 1, 2`);
      const out: Record<string, unknown> = {};
      out["block_friend"] = await step(tx, (sp) => blockUser(sp, ALI, "pg_bina"));
      out["block_again"] = await step(tx, (sp) => blockUser(sp, ALI, "pg_bina"));
      out["block_self"] = await call(tx, (sp) => blockUser(sp, ALI, "pg_ali"));
      out["block_unknown"] = await call(tx, (sp) => blockUser(sp, ALI, "pg_nobody"));
      out["block_signed_out"] = await call(tx, (sp) => blockUser(sp, null, "pg_bina"), "block_user");
      out["blocked_sends_request"] = await call(tx, (sp) => sendFriendRequest(sp, BINA, "pg_ali"));
      out["blocker_sends_request"] = await call(tx, (sp) => sendFriendRequest(sp, ALI, "pg_bina"));
      // blocks_read: a person sees only the blocks they made.
      out["blocked_reads_blocks"] = await blocksSeenBy(BINA);
      out["blocker_reads_blocks"] = await blocksSeenBy(ALI);
      // No contract method writes friendships, blocks or requests directly.
      out["blocked_inserts_friendship"] = noPath("42501", "permission denied for table friendships");
      out["blocked_deletes_block"] = { result: noPath("42501", "permission denied for table blocks"), changes: {} };
      out["blocked_inserts_request"] = noPath("42501", "permission denied for table friend_requests");
      out["blocker_mutes_blocked"] = await call(tx, (sp) => muteUser(sp, ALI, "pg_bina", true));
      out["my_blocks"] = await call(tx, async (sp) => (await myBlocks(sp, ALI)).map((r) => ({ username: r.username, full_name: r.full_name })));
      out["my_blocks_blocked_side"] = await call(tx, async (sp) => (await myBlocks(sp, BINA)).map((r) => ({ username: r.username, full_name: r.full_name })));
      out["receiver_blocks_sender_of_pending_request"] = await call(tx, (sp) => blockUser(sp, DUA, "pg_bina"));
      out["unblock"] = await step(tx, (sp) => unblockUser(sp, ALI, "PG_BINA"));
      out["unblock_again"] = await call(tx, (sp) => unblockUser(sp, ALI, "pg_bina"));
      out["unblock_unknown"] = await call(tx, (sp) => unblockUser(sp, ALI, "pg_nobody"));
      out["unblock_signed_out"] = await call(tx, (sp) => unblockUser(sp, null, "pg_bina"), "unblock_user");
      out["my_blocks_signed_out"] = await call(tx, (sp) => myBlocks(sp, null), "my_blocks");
      return out;
    }));

  it("accept_blocked", () =>
    replay(sql, "friends", "accept_blocked", async (tx) => {
      await request(tx, ALI, BINA);
      const id = await idOf(tx, ALI);
      await tx`insert into people.blocks (blocker_id, blocked_id) values (${BINA}, ${CHAND})`;
      await request(tx, CHAND, BINA);
      const id2 = await idOf(tx, CHAND);
      return {
        accept_ok: await step(tx, (sp) => respondFriendRequest(sp, BINA, id, true)),
        accept_blocked: await step(tx, (sp) => respondFriendRequest(sp, BINA, id2, true)),
        decline_blocked: await step(tx, (sp) => respondFriendRequest(sp, BINA, id2, false)),
      };
    }));

  it("mutes", () =>
    replay(sql, "friends", "mutes", async (tx) => {
      await tx`insert into people.blocks (blocker_id, blocked_id) values (${DUA}, ${ALI})`;
      const list = (me: string) => call(tx, async (sp) => (await myMutes(sp, me)).map((r) => ({ username: r.username, full_name: r.full_name })));
      return {
        mute: await step(tx, (sp) => muteUser(sp, ALI, "pg_bina", true)),
        mute_again: await step(tx, (sp) => muteUser(sp, ALI, "pg_bina", true)),
        mute_second: await step(tx, (sp) => muteUser(sp, ALI, "pg_eman", true)),
        list: await list(ALI),
        unmute: await step(tx, (sp) => muteUser(sp, ALI, "pg_bina", false)),
        unmute_not_muted: await step(tx, (sp) => muteUser(sp, ALI, "pg_bina", false)),
        mute_self: await call(tx, (sp) => muteUser(sp, ALI, "pg_ali", true)),
        mute_unknown: await call(tx, (sp) => muteUser(sp, ALI, "pg_nobody", true)),
        mute_blocked_by_them: await call(tx, (sp) => muteUser(sp, ALI, "pg_dua", true)),
        mute_signed_out: await call(tx, (sp) => muteUser(sp, null, "pg_bina", true), "mute_user"),
        list_signed_out: await call(tx, (sp) => myMutes(sp, null), "my_mutes"),
        list_after: await list(ALI),
        direct_insert: noPath("42501", "permission denied for table user_mutes"),
      };
    }));
});
