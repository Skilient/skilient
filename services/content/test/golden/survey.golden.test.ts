/**
 * Golden replays of survey.json against content's store (packages/testing/test/content.golden.test.ts,
 * "survey"). The question text is drawn at random within a dimension, so neither side records it; the
 * account's age arrives with user.created (rule 4), so "a new account" is the member row's account time.
 */
import { applyCopyEvent } from "../../src/store/copies";
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, it } from "vitest";
import { addComment, hidePost } from "../../src/store/comments";
import { answerSurvey, countAnswer, postInsights, recordViews, surveyForPosts } from "../../src/store/survey";
import {
  addEvent,
  addPoll,
  ASMA,
  assign,
  befriend,
  BILAL,
  bodyMap,
  call,
  changes,
  CONFIG,
  CYRA,
  DANYAL,
  ESHA,
  GRAD,
  insertPost,
  named,
  prime,
  replay,
  snapshot,
  startWorld,
  step,
  STAFF,
  UNI_B,
  UUID_X,
  view,
  type Tx,
} from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

const first = () => 0;
const strip = (me: string | null, ids: string[]) => async (sp: Tx) =>
  (await surveyForPosts(sp, me, ids, CONFIG, first)).map((s) => ({
    post_id: s.post_id,
    dimension: s.dimension,
    my_answer: s.my_answer,
    can_change: s.can_change,
    answered: s.answered_at !== null,
    public_line: s.public_line,
  }));
const answer = (me: string | null, post: string, a: boolean | null, latency: number | null) => (sp: Tx) => answerSurvey(sp, me, post, a, latency ?? 0, CONFIG);

/** A response written as the recorder's owner insert did, with stats_on_response. */
async function insertResponse(tx: Tx, post: string, user: string, dimension: string, ans: boolean, weight: number, author: string): Promise<void> {
  await tx`
    insert into content.survey_responses (post_id, user_id, question_id, dimension, answer, latency_ms, weight, locked_at)
    values (${post}, ${user}, (select min(id) from content.survey_questions where dimension = ${dimension}), ${dimension}, ${ans}, 1500, ${weight}, now() - interval '1 day')`;
  await countAnswer(tx, post, dimension, author, null, { answer: ans, weight });
}

describe("survey.json", () => {
  it("survey_for_posts", () =>
    replay(sql, "survey", "survey_for_posts", async (tx) => {
      const out: Record<string, unknown> = {};
      const general = await insertPost(tx, BILAL, "Survey: general by Bilal", { hoursAgo: 4 });
      await tx`insert into content.post_survey_counts (post_id, dimension, assigned, ticks) values (${general}, 'informative', 1, 3), (${general}, 'interesting', 0, 4)`;
      const global = await insertPost(tx, CYRA, "Survey: global by Cyra", { audience: "global", university: UNI_B, hoursAgo: 4 });
      await prime(tx, global);
      const event = await addEvent(tx, BILAL, "Survey: event by Bilal", { hoursAgo: 4 });
      await prime(tx, event);
      const own = await insertPost(tx, ASMA, "Survey: own post", { hoursAgo: 4 });
      await prime(tx, own);
      const poll = await addPoll(tx, BILAL, "Survey: a poll", { hoursAgo: 4 });
      const other = await insertPost(tx, CYRA, "Survey: only at B", { university: UNI_B, hoursAgo: 4 });
      const second = await insertPost(tx, BILAL, "Survey: second general", { hoursAgo: 5 });
      await prime(tx, second);
      const m = await bodyMap(tx);
      const strip2 = async (me: string | null, ids: string[]) => {
        const r = named(await call(tx, strip(me, ids)), m, ["post_id"]);
        if (r.ok) (r.value as Record<string, unknown>[]).sort((a, b) => String(a["post_id"]).localeCompare(String(b["post_id"])));
        return r;
      };
      const ids = [general, global, event, own, poll, other, UUID_X];
      const before = await snapshot(tx);
      out["asma_first_time"] = await strip2(ASMA, ids);
      out["assignments_after_first"] = changes(before, await snapshot(tx));
      const mid = await snapshot(tx);
      out["asma_again_is_stable"] = await strip2(ASMA, ids);
      out["assignments_after_second"] = changes(mid, await snapshot(tx));
      out["staff_gets_the_other_general"] = await strip2(STAFF, [second, own, poll]);
      out["cyra_sees_global_and_own_university"] = await strip2(CYRA, [general, global, other]);
      out["empty_list"] = await strip2(ASMA, []);
      out["signed_out"] = await call(tx, strip(null, ids), "survey_for_posts");
      return out;
    }));

  it("answer", () =>
    replay(sql, "survey", "answer", async (tx) => {
      const out: Record<string, unknown> = {};
      const pA = await insertPost(tx, BILAL, "Answer: post A", { hoursAgo: 4 });
      await prime(tx, pA);
      out["no_question_yet"] = await call(tx, answer(ASMA, pA, true, 1500));
      out["assign"] = await step(tx, async (sp) => (await surveyForPosts(sp, ASMA, [pA], CONFIG, first)).map((s) => ({ dimension: s.dimension })));
      out["not_viewed_yet"] = await call(tx, answer(ASMA, pA, true, 1500));
      out["record_view"] = await step(tx, (sp) => recordViews(sp, ASMA, [pA]));
      out["too_fast"] = await call(tx, answer(ASMA, pA, true, 100));
      out["no_latency"] = await call(tx, answer(ASMA, pA, true, null));
      out["no_answer"] = await call(tx, answer(ASMA, pA, null, 1500));
      out["answer"] = await step(tx, answer(ASMA, pA, true, 1500));
      out["change_within_window"] = await step(tx, answer(ASMA, pA, false, 2000));
      await tx`update content.survey_responses set locked_at = now() - interval '1 minute' where post_id = ${pA} and user_id = ${ASMA}`;
      out["after_lock"] = await call(tx, answer(ASMA, pA, true, 2000));

      await assign(tx, pA, DANYAL, "interesting");
      await view(tx, pA, DANYAL);
      await befriend(tx, DANYAL, BILAL);
      out["friend_of_the_author_weighs_half"] = await step(tx, answer(DANYAL, pA, true, 1200));

      await assign(tx, pA, STAFF, "relevant");
      await view(tx, pA, STAFF);
      await tx`update content.members set account_created_at = now() where user_id = ${STAFF}`;
      out["new_account_weighs_half"] = await step(tx, answer(STAFF, pA, false, 1200));

      await assign(tx, pA, GRAD, "credible");
      await view(tx, pA, GRAD);
      await befriend(tx, GRAD, BILAL);
      await tx`update content.members set account_created_at = now() where user_id = ${GRAD}`;
      out["friend_and_new_account"] = await step(tx, answer(GRAD, pA, false, 1200));

      const pG = await insertPost(tx, BILAL, "Answer: global post", { audience: "global", hoursAgo: 4 });
      for (let i = 0; i < 20; i++) {
        const earlier = await insertPost(tx, CYRA, `Answer: earlier ${i}`, { audience: "global", university: UNI_B, hoursAgo: 6 });
        await assign(tx, earlier, ESHA, "relevant");
        await insertResponse(tx, earlier, ESHA, "relevant", true, 1, CYRA);
      }
      await assign(tx, pG, ESHA, "relevant");
      await view(tx, pG, ESHA);
      out["straight_liner_weighs_less"] = await step(tx, answer(ESHA, pG, true, 1500));

      await view(tx, pA, CYRA);
      out["invisible_post_no_question"] = await call(tx, answer(CYRA, pA, true, 1500));
      out["signed_out"] = await call(tx, answer(null, pA, true, 1500), "answer_survey");
      return out;
    }));

  it("record_views", () =>
    replay(sql, "survey", "record_views", async (tx) => {
      const out: Record<string, unknown> = {};
      const vA = await insertPost(tx, BILAL, "Views: uni post", { hoursAgo: 4 });
      const vB = await insertPost(tx, CYRA, "Views: only at B", { university: UNI_B, hoursAgo: 4 });
      const vC = await insertPost(tx, BILAL, "Views: global post", { audience: "global", hoursAgo: 4 });
      const vH = await insertPost(tx, BILAL, "Views: held", { hoursAgo: 4, stage: "held" });
      const rv = (me: string | null, ids: string[]) => (sp: Tx) => recordViews(sp, me, ids);
      out["mixed"] = await step(tx, rv(ASMA, [vA, vB, vC, vH, vA, UUID_X]));
      out["repeat"] = await step(tx, rv(ASMA, [vA, vC]));
      out["other_reader"] = await step(tx, rv(CYRA, [vA, vB, vC]));
      out["author_views_own_held_post"] = await step(tx, rv(BILAL, [vH]));
      out["empty"] = await call(tx, rv(ASMA, []));
      out["null"] = await call(tx, rv(ASMA, []));
      out["signed_out"] = await call(tx, rv(null, [vA]), "record_views");
      return out;
    }));

  it("insights", () =>
    replay(sql, "survey", "insights", async (tx) => {
      const out: Record<string, unknown> = {};
      const p = await insertPost(tx, ASMA, "Insights: asma post", { hoursAgo: 5 });
      const other = await insertPost(tx, BILAL, "Insights: bilal post", { hoursAgo: 5 });
      const q = (me: string | null, id: string, fn?: string) => call(tx, (sp) => postInsights(sp, me, id), fn);
      out["without_entitlement"] = await q(ASMA, p);
      out["not_the_author"] = await q(BILAL, p);
      out["unknown_post"] = await q(ASMA, UUID_X);
      const answers: [string, string, boolean, number][] = [
        [BILAL, "informative", true, 1],
        [DANYAL, "informative", true, 0.5],
        [STAFF, "informative", false, 1],
        [GRAD, "credible", false, 1],
        [ESHA, "credible", true, 0.5],
      ];
      for (const [user, dimension, ans, weight] of answers) {
        await view(tx, p, user);
        await assign(tx, p, user, dimension);
        await insertResponse(tx, p, user, dimension, ans, weight, ASMA);
      }
      // Rule 4: billing's grant arrives as entitlement.changed.
      await applyCopyEvent(tx, { type: "entitlement.changed", producer: "svc_billing", version: 1, subjects: [ASMA], payload: { subject_id: ASMA, key: "insights.post_survey", value: true } });
      out["with_entitlement"] = await q(ASMA, p);
      out["with_entitlement_still_not_for_others_posts"] = await q(ASMA, other);
      out["bilal_without_entitlement"] = await q(BILAL, other);
      out["signed_out"] = await q(null, p, "post_insights");
      return out;
    }));

  it("stats", () =>
    replay(sql, "survey", "stats", async (tx) => {
      const out: Record<string, unknown> = {};
      const p = await insertPost(tx, BILAL, "Stats: global post by Bilal", { audience: "global", hoursAgo: 4 });
      await prime(tx, p);
      const before = await snapshot(tx);
      out["views"] = [await call(tx, (sp) => recordViews(sp, ASMA, [p])), await call(tx, (sp) => recordViews(sp, CYRA, [p])), await call(tx, (sp) => recordViews(sp, DANYAL, [p]))];
      out["hide"] = await call(tx, (sp) => hidePost(sp, ASMA, p, true));
      const add = (me: string, body: string) => (sp: Tx) => addComment(sp, me, p, null, body, new Map(), () => {});
      out["comments"] = [
        await call(tx, add(ASMA, "A comment that is long enough")),
        await call(tx, add(CYRA, "From another university, long enough")),
        await call(tx, add(DANYAL, "short")),
      ];
      await assign(tx, p, ASMA, "interesting");
      await assign(tx, p, CYRA, "informative");
      await assign(tx, p, DANYAL, "credible");
      out["answers"] = [
        await call(tx, answer(ASMA, p, true, 1500)),
        await call(tx, answer(CYRA, p, true, 1500)),
        await call(tx, answer(DANYAL, p, false, 1500)),
      ];
      out["changes"] = changes(before, await snapshot(tx));
      return out;
    }));
});
