/**
 * Golden replays of boards.json (packages/testing/test/ranking.golden.test.ts): the leaderboards, the reader's own
 * place, the filters, tiers on cards and the score page, after the reference run with the board extras (an
 * opt-out, a graduate, a deleting account, a block, last week's snapshot). Rules as replay.ts; names and
 * university names are joined from the fixture as web joins people's ProfileCards (rule 2), department hashes are
 * shown as the department texts people holds.
 */
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, it } from "vitest";
import * as B from "../../src/store/boards";
import { call, expectGolden, F, inCase, nameOf, runAll, seed, sha, startWorld, universityName, usernameOf, ventureTitle, type Tx } from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

type Row = Record<string, unknown>;
const DEPARTMENTS = new Map([...new Set(F.STUDENTS.map((s) => s.department))].map((d) => [sha(d), d]));

/** A board page as web shows it: the port's row with people's name, username and university name. */
const asShown = (rows: Awaited<ReturnType<typeof B.leaderboard>>) =>
  rows.map((r) => ({
    avatar_path: null,
    full_name: nameOf(r.user_id),
    is_me: r.is_me,
    place: String(r.place),
    rank: String(r.rank),
    tier: r.tier,
    university_name: universityName(r.university_id),
    username: usernameOf(r.user_id),
    weekly_change: r.weekly_change === null ? null : String(r.weekly_change),
  }));

/** The score page with every evidence name joined as web joins them from their owners (rule 2). */
function withNames(score: Row): Row {
  if (!score["scored"]) return score;
  const { evidence, names, ...rest } = score as { evidence: Record<string, string[]>; names: { skills: Record<string, string> } } & Row;
  const credential = (id: string) => F.CREDENTIALS.find((c) => c.id === id)?.title;
  const post = (id: string) => `Reference post ${F.POSTS.find((p) => F.fid(p.tag) === id)?.tag}`;
  const entry = (id: string) => {
    const i = F.RECORD.findIndex((r) => r.id === id);
    const r = F.RECORD[i]!;
    return { title: `Reference ${r.kind}`, issuer: F.SOCIETIES.find((s) => s.id === (r.society ? F.SOC(r.society) : ""))?.name ?? "Skilient", line: r.evidence["line"], code: `93R${String(i + 1).padStart(7, "0")}` };
  };
  const map = <T,>(ids: string[], f: (id: string) => T) => Object.fromEntries(ids.map((id) => [id, f(id)]));
  return {
    ...rest,
    names: {
      skills: names.skills,
      ventures: map(evidence["ventures"]!, (id) => ventureTitle(id)),
      people: map(evidence["people"]!, (id) => ({ name: nameOf(id), username: usernameOf(id) })),
      credentials: map(evidence["credentials"]!, credential),
      record: map(evidence["record"]!, entry),
      posts: map(evidence["posts"]!, post),
    },
  };
}

describe("boards.json", () => {
  const world = async (tx: Tx) => {
    await seed(tx, { extras: true });
    await runAll(tx, F.AS_OF);
  };

  it("leaderboards by scope and filter, my place, filters; opt-out, graduate, deleting and blocked people", () =>
    inCase(sql, async (tx) => {
      await world(tx);
      const board = async (who: string | null, scope: string, dept: string | null, batch: number | null, after = 0) => {
        const o = await call(tx, (sp) => B.leaderboard(sp, who, scope, dept, batch, after));
        return o.ok ? { ok: true, value: asShown(o.value as Awaited<ReturnType<typeof B.leaderboard>>) } : o;
      };
      const me = (who: string, scope: string, dept: string | null, batch: number | null) => call(tx, (sp) => B.leaderboardMe(sp, who, scope, dept, batch));
      const filters = async (who: string) => {
        const o = await call(tx, (sp) => B.leaderboardFilters(sp, who));
        if (!o.ok) return o;
        const v = o.value as { departments: string[]; batches: number[] };
        return { ok: true, value: { batches: v.batches, departments: v.departments.map((h) => DEPARTMENTS.get(h)).sort() } };
      };
      expectGolden("boards", "boards", {
        university: await board(F.R(1), "university", null, null),
        university_after_3: await board(F.R(1), "university", null, null, 3),
        department: await board(F.R(1), "university", "Software Engineering", null),
        batch: await board(F.R(1), "university", null, 2027),
        department_spaces: await board(F.R(1), "university", "  ", null),
        global: await board(F.R(1), "global", null, null),
        blocker: await board(F.R(2), "university", null, null),
        other_university: await board(F.R(7), "university", null, null),
        bad_scope: await board(F.R(1), "everywhere", null, null),
        anon: await board(null, "university", null, null),
        me_r1: await me(F.R(1), "university", null, null),
        me_r1_global: await me(F.R(1), "global", null, null),
        me_opted_out: await me(F.OPTED_OUT, "university", null, null),
        me_unranked: await me(F.R(4), "university", null, null),
        me_graduate: await me(F.GRADUATE, "university", null, null),
        me_graduate_global: await me(F.GRADUATE, "global", null, null),
        me_department: await me(F.R(8), "university", "Software Engineering", 2028),
        filters_a: await filters(F.R(1)),
        filters_b: await filters(F.R(7)),
      });
    }));

  it("tiers on cards (tiers_for): signed in, blocks left out, at most 200", () =>
    inCase(sql, async (tx) => {
      await world(tx);
      const ids = [F.R(1), F.R(3), F.R(4), F.R(5), F.R(6), F.R(7), F.R(10), F.Q(1)];
      const many = Array.from({ length: 201 }, (_, i) => `93200000-0000-4000-8000-${String(900000000000 + i)}`);
      expectGolden("boards", "tiers", {
        r2: await call(tx, (sp) => B.tiersFor(sp, F.R(2), ids)),
        r1: await call(tx, (sp) => B.tiersFor(sp, F.R(1), ids)),
        too_many: await call(tx, (sp) => B.tiersFor(sp, F.R(1), many)),
        anon: await call(tx, (sp) => B.tiersFor(sp, null, ids)),
      });
    }));

  it("the score page (my_score) with its evidence names and the next tier", () =>
    inCase(sql, async (tx) => {
      await world(tx);
      const score = async (who: string | null) => {
        const o = await call(tx, (sp) => B.myScore(sp, who));
        return o.ok ? { ok: true, value: withNames(o.value as Row) } : o;
      };
      expectGolden("boards", "score", {
        r1: await score(F.R(1)),
        r4: await score(F.R(4)),
        r5: await score(F.R(5)),
        r7: await score(F.R(7)),
        r10: await score(F.R(10)),
        r11: await score(F.R(11)),
        anon: await score(null),
        next_r6: await call(tx, (sp) => B.nextTier(sp, F.R(6))),
        next_r8: await call(tx, (sp) => B.nextTier(sp, F.R(8))),
      });
    }));
});
