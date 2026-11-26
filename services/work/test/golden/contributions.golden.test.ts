/**
 * Golden replays of contributions.json and reads.json (packages/testing/test/work.golden.test.ts). Names come
 * from people (rule 4): usernames shown only where the reader may open the profile, as venture_team did.
 */
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, it } from "vitest";
import * as C from "../../src/store/contributions";
import * as R from "../../src/store/reads";
import { canViewVenture } from "../../src/store/db";
import { verifiedContributors } from "../../src/store/ventures";
import { ASAD, block, call, entry, MINA, NAME, OMAR, OPEN, replay, startWorld, step, ULA, UNIVERSITY_NAME, USERNAME, VENTURE, type Tx } from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

type Json = Record<string, unknown>;
const noRecompute = async () => {};
const value = (o: unknown) => (o as { result: { value: string } }).result.value;

describe("contributions.json", () => {
  it("log_correct_confirm", () =>
    replay(sql, "contributions", "log_correct_confirm", async (tx) => {
      const out: Json = {};
      const e = (kind: string, description: string, evidence_url: string | null, hours: number | null, skill_ids: string[]): C.Entry => ({ kind, description, evidence_url, hours, skill_ids });
      const log = (me: string, x: C.Entry) => (sp: Tx) => C.logContribution(sp, me, VENTURE, x);
      const correct = (me: string, id: string, x: C.Entry) => (sp: Tx) => C.correctContribution(sp, me, id, x, noRecompute);
      const confirm = (me: string, id: string) => (sp: Tx) => C.confirmContribution(sp, me, id, noRecompute);
      const e1 = await step(tx, log(MINA, e("code", " Built the API ", " https://example.com/pr/1 ", 3.5, ["react"])));
      out["log"] = e1;
      out["log_outsider"] = await call(tx, log(ASAD, e("code", "Me", null, null, [])));
      out["log_foreign_skill"] = await call(tx, log(MINA, e("code", "Py", null, null, ["python"])));
      out["log_four_skills"] = await call(tx, log(MINA, e("code", "Many", null, null, ["react", "typescript", "python", "docker"])));
      const id = value(e1);
      out["confirm_own"] = await call(tx, confirm(MINA, id));
      out["confirm_outsider"] = await call(tx, confirm(ASAD, id));
      out["correct"] = await step(tx, correct(MINA, id, e("docs", "Built and documented the API", null, 4, ["typescript"])));
      out["correct_not_author"] = await call(tx, correct(OMAR, id, e("docs", "Mine", null, null, [])));
      out["confirm"] = await step(tx, confirm(OMAR, id));
      out["confirm_again"] = await step(tx, confirm(OMAR, id));
      const [c] = await tx<{ id: string }[]>`select id::text from work.contributions where corrects_id = ${id}`;
      out["correct_a_correction"] = await call(tx, correct(MINA, c!.id, e("docs", "Again", null, null, [])));
      out["confirm_a_correction"] = await call(tx, confirm(OMAR, c!.id));
      const old = await entry(tx, VENTURE, MINA, "Old work", 30);
      out["correct_late"] = await call(tx, correct(MINA, old, e("docs", "Late fix", null, null, [])));
      out["status"] = await call(tx, async (sp) =>
        (await C.contributions(sp, OMAR, VENTURE))
          .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
          .map((r) => ({
            description: r.description,
            kind: r.kind,
            source: r.source,
            confirmations: r.confirmations,
            peer_verified: r.verified,
            by_member: r.by_member,
            confirmed_by_me: r.confirmed_by_me,
            corrected: r.corrected_at !== null,
          })),
      );
      // venture_verified_contributors: the count where the reader can see the venture, else null.
      const counted = (me: string) => async (sp: Tx) => {
        const [v] = await sp`select 1 from work.ventures v where v.id = ${VENTURE} and ${canViewVenture(sp, me)}`;
        return v ? verifiedContributors(sp, VENTURE) : null;
      };
      out["verified_contributors"] = await call(tx, counted(OMAR));
      out["verified_contributors_outsider"] = await call(tx, counted(ULA));
      await tx`update work.ventures set status = 'abandoned', abandoned_at = now() where id = ${VENTURE}`;
      out["log_abandoned"] = await call(tx, log(MINA, e("code", "Late", null, null, [])));
      return out;
    }));
});

describe("reads.json", () => {
  it("views", () =>
    replay(sql, "reads", "views", async (tx) => {
      const out: Json = {};
      const browse = (me: string, type: string, status: string | null, open_roles: boolean, my_university: boolean) =>
        call(tx, async (sp) =>
          (await R.browseVentures(sp, me, { type, status, open_roles, my_university, before: null, limit: 20 })).map((r) => ({
            title: r.title,
            status: r.status,
            visibility: r.visibility,
            owner_username: USERNAME[r.owner_id] ?? null,
            members: r.members,
            team_size: r.team_size,
            open_slots: r.open_slots,
            university_name: UNIVERSITY_NAME[r.university_id] ?? null,
          })),
        );
      out["browse_projects_a"] = await browse(ASAD, "project", null, false, false);
      out["browse_projects_b"] = await browse(ULA, "project", null, false, false);
      out["browse_startups_b"] = await browse(ULA, "startup", null, false, false);
      out["browse_open_roles"] = await browse(ASAD, "project", null, true, false);
      out["browse_my_university"] = await browse(ULA, "startup", null, false, true);
      out["browse_status"] = await browse(ASAD, "startup", "recruiting", false, false);
      const page = (me: string, v: string) => R.ventureForPage(tx, me, v);
      const team = async (me: string, v: string) =>
        call(tx, async () =>
          ((await page(me, v))?.team ?? []).map((m) => ({
            username: m.profile_visible ? (USERNAME[m.user_id] ?? null) : null,
            full_name: NAME[m.user_id] ?? null,
            team_role: m.team_role,
            is_owner: m.is_owner,
            profile_visible: m.profile_visible,
          })),
        );
      out["team_member"] = await team(OMAR, VENTURE);
      out["team_classmate"] = await team(ASAD, VENTURE);
      out["team_other_university"] = await team(ULA, VENTURE);
      const profile = (me: string, user: string) =>
        call(tx, async (sp) => (await R.profileVentures(sp, me, user)).map((r) => ({ title: r.title, status: r.status, team_role: r.team_role, is_owner: r.is_owner })));
      out["profile_self"] = await profile(MINA, MINA);
      out["profile_other_university"] = await profile(ULA, MINA);
      const counts = (me: string, v: string) => call(tx, async () => ((p) => (p ? [p.counts] : []))(await page(me, v)));
      out["counts"] = await counts(ASAD, VENTURE);
      out["counts_hidden"] = await counts(ULA, VENTURE);
      await tx`update work.ventures set visibility = 'unlisted' where id = ${OPEN}`;
      const byLink = (me: string) =>
        call(tx, async () => ((p) => (p ? [{ title: p.venture.title, status: p.venture.status, visibility: p.venture.visibility }] : []))(await page(me, OPEN)));
      out["by_link"] = await byLink(ULA);
      out["by_link_counts"] = await counts(ULA, OPEN);
      out["by_link_team"] = await team(ULA, OPEN);
      await block(tx, MINA, ULA);
      out["by_link_blocked"] = await call(tx, async () => ((p) => (p ? [{ title: p.venture.title }] : []))(await page(ULA, OPEN)));
      return out;
    }));
});
