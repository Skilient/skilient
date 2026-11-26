/**
 * Journey: apps/web/tests/e2e/survey.spec.ts, through identity, people and content's contracts on both
 * transports. Insights needs the entitlement that billing publishes (entitlement.changed).
 */
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { NUTECH } from "../../../people/test/contract/world";
import { contentWorld, stopWorlds, type ContentWorld } from "../contract/world";
import { journeyClient } from "./journey";

const worlds: ContentWorld[] = [];
let w: ContentWorld;
afterAll(() => stopWorlds(worlds));
const reason = (e: unknown) => refusalReason(e);

describeTransports(
  ["identity", "people", "content"],
  (env) => {
    const j = journeyClient(env, () => w);
    const strip = async (token: string, postId: string) => {
      const { entries } = await j.content().surveyForPosts({ postIds: [postId] }, j.as(token));
      return entries[0]!;
    };

    describe("Micro-survey", () => {
      it("strip, fixed question, answer, change, insights", async () => {
        const author = await j.createStudent(NUTECH, "Sara Surveyed");
        const reader = await j.createStudent(NUTECH, "Rafay Reader");
        const late = await j.createStudent(NUTECH, "Lina Late");
        const text = `Notes from the ML workshop ${Date.now().toString(36)}`;
        const { postId } = await j.post(author.token, text);

        // Not under your own post.
        const own = await strip(author.token, postId);
        expect([own.questionId, own.dimension]).toEqual([0, ""]);

        // A reader gets a question; it never changes, however often the strip is asked for.
        const first = await strip(reader.token, postId);
        expect(first.question.endsWith("?")).toBe(true);
        expect([first.questionId > 0, first.dimension !== "", first.myAnswer, first.canChange]).toEqual([true, true, "", false]);
        for (let i = 0; i < 3; i++) expect((await strip(reader.token, postId)).question).toBe(first.question);

        // An answer before a qualified view is refused, and so is one given too fast.
        await expect(j.content().answerSurvey({ postId, answer: true, latencyMs: 5000 }, j.as(reader.token))).rejects.toSatisfy((e) => reason(e) === "read_first");
        expect((await j.content().recordViews({ postIds: [postId] }, j.as(reader.token))).recorded).toBe(1);
        await expect(j.content().answerSurvey({ postId, answer: true, latencyMs: 100 }, j.as(reader.token))).rejects.toSatisfy((e) => reason(e) === "read_first");

        // Answer, then change inside the window; under three ticks there is no public line.
        await j.content().answerSurvey({ postId, answer: true, latencyMs: 1500 }, j.as(reader.token));
        const answered = await strip(reader.token, postId);
        expect([answered.myAnswer, answered.canChange, answered.answeredAt !== "", answered.publicLine]).toEqual(["yes", true, true, []]);
        await j.content().answerSurvey({ postId, answer: false, latencyMs: 2000 }, j.as(reader.token));
        const changed = await strip(reader.token, postId);
        expect([changed.myAnswer, changed.question]).toEqual(["no", first.question]);
        const [ev] = await w.content<{ payload: Record<string, unknown> }[]>`select payload from platform.events where type = 'survey.answered' and ${postId}::uuid = any(subjects) order by seq limit 1`;
        expect(ev!.payload).toMatchObject({ post_id: postId, user_id: reader.id, answer: true });

        // Another reader who has not seen the post is refused too (the API check in the spec).
        await strip(late.token, postId);
        await expect(j.content().answerSurvey({ postId, answer: true, latencyMs: 5000 }, j.as(late.token))).rejects.toSatisfy((e) => reason(e) === "read_first");
        // Only a reader with a question can answer; the author has none.
        await expect(j.content().answerSurvey({ postId, answer: true, latencyMs: 5000 }, j.as(author.token))).rejects.toSatisfy((e) => reason(e) === "no_question");

        // A free author's Insights are refused (the upgrade explains why); others can't read them at all.
        await expect(j.content().postInsights({ postId }, j.read(author.token))).rejects.toSatisfy((e) => reason(e) === "insights_paid");
        await expect(j.content().postInsights({ postId }, j.read(reader.token))).rejects.toSatisfy((e) => reason(e) === "insights_author_only");
        // Billing grants the entitlement; the author's insights then carry the answers.
        await j.publish("billing", "entitlement.changed", [author.id], { subject_id: author.id, key: "insights.post_survey", value: true });
        const { rows } = await j.content().postInsights({ postId }, j.read(author.token));
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.reduce((n, r) => n + r.ticks + r.crosses, 0)).toBe(1);
      });

      it.todo("W13: the strip under every surveyable post with Yes and No and nothing to dismiss, the \"Answered\" state with Change, and axe");
      it.todo("W13: the Insights dialog's upgrade explanation for a free author");
    });
  },
  contentWorld((x) => (w = x), worlds),
);
