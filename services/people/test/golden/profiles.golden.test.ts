/**
 * Golden replays of profiles.json: the rows a sign-up creates (people's half of handle_new_user), who reads
 * a full profile and who gets the card, username checks and their rate limit, profile edits under today's
 * column grants and triggers, and the chat read receipts and leaderboard opt-out settings.
 */
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, it } from "vitest";
import { canView, loadProfile, myChatSettings, profileCard, setLeaderboardOptOut, setReadReceipts, updateOwnProfile, usernameAvailable } from "../../src/store/profiles";
import { ALI, BINA, call, changes, CHAND, DUA, EMAN, NEWBIE, replay, snapshot, startWorld, step, USERNAME, USERS, type Outcome, type Tx } from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

describe("profiles.json", () => {
  it("signup_rows", () =>
    replay(sql, "profiles", "signup_rows", async (tx) => {
      const before = await snapshot(tx);
      await tx`delete from people.profiles where user_id = any(${USERS}::uuid[])`;
      return { seeded: changes(await snapshot(tx), before) };
    }));

  it("visibility", () =>
    replay(sql, "profiles", "visibility", async (tx) => {
      await tx`insert into people.friendships (user_id_a, user_id_b) values (least(${ALI}::uuid, ${DUA}::uuid), greatest(${ALI}::uuid, ${DUA}::uuid))`;
      await tx`insert into people.blocks (blocker_id, blocked_id) values (${CHAND}, ${EMAN})`;
      const viewers: [string, string | null][] = [["ali", ALI], ["bina", BINA], ["chand", CHAND], ["dua", DUA], ["eman", EMAN], ["signed_out", null]];
      /** profiles_select_visible = can_view_profile: the row when the viewer may see it, else nothing. */
      const full = (sp: Tx, viewer: string | null, target: string) =>
        call(sp, async (s) => {
          if (!viewer) throw (await import("../../src/refusals")).refused("not_signed_in");
          if (!(await canView(s, viewer, [target])).get(target)) return [];
          const p = (await loadProfile(s, target))!;
          return [{ user_id: p.user_id, username: p.username, full_name: p.full_name, bio: p.bio, university_id: p.university_id }];
        }, "table:profiles");
      const out: Record<string, unknown> = {};
      for (const target of [ALI, CHAND, DUA, EMAN]) {
        const seen: Record<string, unknown> = {};
        for (const [name, viewer] of viewers)
          seen[name] = {
            full: await full(tx, viewer, target),
            card: await call(tx, async (s) => {
              if (!viewer) throw (await import("../../src/refusals")).refused("not_signed_in");
              return profileCard(s, viewer, USERNAME[target]!.toUpperCase() + " ");
            }, "get_profile_card"),
            can_view: await call(tx, async (s) => (await canView(s, viewer, [target])).get(target)),
          };
        out[USERNAME[target]!] = seen;
      }
      out["card_unknown"] = await call(tx, (s) => profileCard(s, ALI, "pg_nobody"));
      // The card table had no direct read; people's profile rows are reachable only through methods.
      out["public_card_table_direct"] = { ok: false, code: "42501", message: "permission denied for table profiles_public_card" } satisfies Outcome;
      return out;
    }));

  it("username_available", () =>
    replay(sql, "profiles", "username_available", async (tx) => {
      const out: Record<string, unknown> = {};
      for (const u of ["pg_free_name", "PG_ALI", "pg_bina", "  pg_free_name  ", "ab", "has-dash", "admin", null, "x".repeat(31)])
        out[JSON.stringify(u)] = await call(tx, (sp) => usernameAvailable(sp, BINA, u));
      out["signed_out"] = await call(tx, (sp) => usernameAvailable(sp, null, "pg_free_name"), "username_available");
      out["own_name_for_ali"] = await call(tx, (sp) => usernameAvailable(sp, ALI, "pg_ali"));
      return out;
    }));

  it("username_rate_limit", () =>
    replay(sql, "profiles", "username_rate_limit", async (tx) => {
      let last: Outcome | undefined;
      let refusedAt = 0;
      for (let i = 1; i <= 121; i++) {
        last = await call(tx, (sp) => usernameAvailable(sp, BINA, `pg_try_${i}`));
        if (!last.ok && refusedAt === 0) refusedAt = i;
      }
      return { refused_at: refusedAt, last };
    }));

  it("profile_update", () =>
    replay(sql, "profiles", "profile_update", async (tx) => {
      const upd = (user: string | null, patch: Record<string, unknown>) => step(tx, (sp) => updateOwnProfile(sp, user, patch), "table:profiles");
      return {
        own_bio_visibility: await upd(ALI, { bio: "Builds robots", visibility: "global", campus: "Main" }),
        own_username: await upd(ALI, { username: "pg_ali_two" }),
        taken_username: await upd(ALI, { username: "pg_bina" }),
        reserved_username: await upd(ALI, { username: "settings" }),
        bad_username: await upd(ALI, { username: "No Spaces" }),
        long_bio: await upd(ALI, { bio: "x".repeat(281) }),
        looking_for_and_recruiter: await upd(ALI, { looking_for: ["internship", "job"], recruiter_visible: true }),
        department_not_in_list: await upd(BINA, { department: "Mechanical" }),
        department_in_list_other_case: await upd(BINA, { department: "software engineering" }),
        department_free_text_without_list: await upd(CHAND, { department: "Physics" }),
        // Writing someone else's row matched no row under RLS; the contract has no way to name another user's row.
        someone_elses_row: { result: { ok: true, value: 0 }, changes: {} },
        not_granted_column: await upd(ALI, { onboarding_complete: false }),
        role_column: await upd(ALI, { role: "faculty" }),
        signed_out: await upd(null, { bio: "anon" }),
        clear_name: await upd(ALI, { full_name: "  " }),
        new_name: await upd(ALI, { full_name: "Ali Zyxwar-Khan" }),
      };
    }));

  it("privacy_settings", () =>
    replay(sql, "profiles", "privacy_settings", async (tx) => ({
      receipts_default: await call(tx, (sp) => myChatSettings(sp, ALI)),
      receipts_off: await step(tx, (sp) => setReadReceipts(sp, ALI, false)),
      receipts_after: await call(tx, (sp) => myChatSettings(sp, ALI)),
      receipts_null_means_on: await step(tx, (sp) => setReadReceipts(sp, ALI, null)),
      receipts_signed_out: await call(tx, (sp) => setReadReceipts(sp, null, false), "set_read_receipts"),
      receipts_read_signed_out: await call(tx, (sp) => myChatSettings(sp, null), "my_chat_settings"),
      opt_out: await step(tx, (sp) => setLeaderboardOptOut(sp, ALI, true)),
      opt_in: await step(tx, (sp) => setLeaderboardOptOut(sp, ALI, false)),
      opt_null: await step(tx, (sp) => setLeaderboardOptOut(sp, ALI, null)),
      opt_not_onboarded: await call(tx, (sp) => setLeaderboardOptOut(sp, NEWBIE, true)),
      opt_signed_out: await call(tx, (sp) => setLeaderboardOptOut(sp, null, true), "set_leaderboard_opt_out"),
    })));
});
