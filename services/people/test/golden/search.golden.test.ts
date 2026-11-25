/**
 * Golden replays of search.json: people search (scope, filters, blocks, offset), its rate limit, people you
 * may know with dismissals, and the pure helpers. Skills and shared groups come from copies that are empty
 * until work and community publish (W5, W7), as they were empty for the fixture users on the current stack.
 */
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, it } from "vitest";
import { departmentKey } from "../../src/domain/profile";
import { containsPattern, prefixQuery } from "../../src/domain/search";
import { dismissSuggestion } from "../../src/store/friends";
import { peopleYouMayKnow, searchPeople, type SearchInput } from "../../src/store/search";
import { ALI, BINA, call, CHAND, DUA, EMAN, NEWBIE, replay, STAFF, startWorld, step, type Outcome, type Tx } from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

const befriend = (tx: Tx, a: string, b: string) => tx`insert into people.friendships (user_id_a, user_id_b) values (least(${a}::uuid, ${b}::uuid), greatest(${a}::uuid, ${b}::uuid))`;

describe("search.json", () => {
  it("search_people", () =>
    replay(sql, "search", "search_people", async (tx) => {
      await befriend(tx, ALI, BINA);
      await tx`insert into people.friend_requests (id, sender_id, receiver_id) values (gen_random_uuid(), ${ALI}, ${CHAND}), (gen_random_uuid(), ${EMAN}, ${ALI})`;
      await tx`insert into people.blocks (blocker_id, blocked_id) values (${STAFF}, ${ALI})`;
      const s = (me: string | null, q: string | null, extra: [string | null, string | null, string | null, number, number | null] = [null, null, null, 0, null]) => {
        const input: SearchInput = { q, department: extra[0], skill: extra[1], university: extra[2], offset: extra[3], batch: extra[4] };
        return call(tx, (sp) => searchPeople(sp, me, input), "search_people");
      };
      return {
        by_surname: await s(ALI, "zyxwar"),
        by_other_surname: await s(ALI, "Qorvel"),
        by_username_exact: await s(ALI, "pg_dua"),
        by_prefix_words: await s(ALI, "ali zyx"),
        one_letter: await s(ALI, "z"),
        empty: await s(ALI, "   "),
        department_in_scope: await s(BINA, "computer"),
        department_out_of_scope: await s(CHAND, "computer"),
        department_filter: await s(ALI, "zyxwar", ["software", null, null, 0, null]),
        batch_filter: await s(ALI, "zyxwar", [null, null, null, 0, 2027]),
        batch_filter_other_university: await s(CHAND, "zyxwar", [null, null, null, 0, 2027]),
        university_filter: await s(ALI, "qorvel", [null, null, "people-golden-b", 0, null]),
        skill_filter: await s(ALI, "zyxwar", [null, "react", null, 0, null]),
        offset: await s(ALI, "zyxwar", [null, null, null, 1, null]),
        blocked_hidden: await s(STAFF, "ali"),
        like_metacharacters: await s(ALI, "%_"),
        signed_out: await s(null, "zyxwar"),
      };
    }));

  it("search_rate_limit", () =>
    replay(sql, "search", "search_rate_limit", async (tx) => {
      let refusedAt = 0;
      let last: Outcome | undefined;
      for (let i = 1; i <= 61; i++) {
        last = await call(tx, async (sp) => (await searchPeople(sp, BINA, { q: "zyxwar", department: null, skill: null, university: null, offset: 0, batch: null })).map((r) => ({ user_id: r.user_id })));
        if (!last.ok && refusedAt === 0) refusedAt = i;
      }
      return { refused_at: refusedAt, last };
    }));

  it("people_you_may_know", () =>
    replay(sql, "search", "people_you_may_know", async (tx) => {
      await befriend(tx, BINA, DUA);
      await befriend(tx, BINA, STAFF);
      const pymk = (me: string | null, limit: number | null = 8) => call(tx, (sp) => peopleYouMayKnow(sp, me, limit), "people_you_may_know");
      const out: Record<string, unknown> = {};
      out["ali_default"] = await pymk(ALI);
      out["ali_limit_1"] = await pymk(ALI, 1);
      out["ali_limit_0"] = await pymk(ALI, 0);
      await befriend(tx, ALI, BINA);
      out["after_friend"] = await pymk(ALI);
      out["dismiss"] = await step(tx, (sp) => dismissSuggestion(sp, ALI, "pg_staff"));
      out["dismiss_again"] = await step(tx, (sp) => dismissSuggestion(sp, ALI, "PG_STAFF"));
      out["dismiss_self"] = await call(tx, (sp) => dismissSuggestion(sp, ALI, "pg_ali"));
      out["dismiss_unknown"] = await call(tx, (sp) => dismissSuggestion(sp, ALI, "pg_nobody"));
      out["dismiss_signed_out"] = await call(tx, (sp) => dismissSuggestion(sp, null, "pg_staff"), "dismiss_suggestion");
      out["after_dismiss"] = await pymk(ALI);
      await tx`insert into people.user_mutes (user_id, muted_id) values (${BINA}, ${ALI})`;
      out["bina_muted_ali"] = await pymk(BINA);
      await tx`insert into people.friend_requests (id, sender_id, receiver_id) values (gen_random_uuid(), ${CHAND}, ${EMAN})`;
      out["chand_pending_request"] = await pymk(CHAND);
      out["eman"] = await pymk(EMAN);
      out["not_onboarded"] = await pymk(NEWBIE);
      out["signed_out"] = await pymk(null);
      out["pure_department_key"] = {
        spaces: { ok: true, value: departmentKey("  Computer Science ") },
        empty: { ok: true, value: departmentKey("   ") },
        null: { ok: true, value: departmentKey(null) },
      };
      return out;
    }));

  it("helpers", () =>
    replay(sql, "search", "helpers", async (tx) => {
      const out: Record<string, unknown> = {};
      for (const q of ["ali zyx", "a", "C++ dev", "", null, "o'brien", "one two three four five six seven eight nine", "%_\\"]) {
        const text = prefixQuery(q);
        const [row] = await tx<{ v: string | null }[]>`select case when ${text}::text is null then null else to_tsquery('simple', ${text}::text)::text end as v`;
        out[JSON.stringify(q)] = { prefix: { ok: true, value: row!.v }, contains: { ok: true, value: containsPattern(q) } };
      }
      return out;
    }));
});
