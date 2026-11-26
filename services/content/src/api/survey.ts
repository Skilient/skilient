import { create } from "@bufbuild/protobuf";
import type { ServiceImpl } from "@connectrpc/connect";
import {
  AnswerSurveyRequestSchema,
  AnswerSurveyResponseSchema,
  ContentService,
  RecordViewsRequestSchema,
  RecordViewsResponseSchema,
  SurveyForPostsRequestSchema,
  SurveyForPostsResponseSchema,
} from "@skilient/contracts/content/v1/content_pb";
import { z } from "zod";
import type { ApiDeps } from "../deps";
import { answerSurvey, postInsights, recordViews, surveyForPosts } from "../store/survey";
import { Ids, iso, meOf, parse, Uuid, write, writeNoReply } from "./util";

/** The micro-survey and views. */
export function surveyApi(deps: ApiDeps): Partial<ServiceImpl<typeof ContentService>> {
  return {
    async surveyForPosts(req, ctx) {
      const ids = parse(Ids(100), req.postIds);
      const c = await deps.config();
      return writeNoReply(deps, ctx, SurveyForPostsRequestSchema, SurveyForPostsResponseSchema, req, async (tx) => {
        const rows = await surveyForPosts(tx, meOf(ctx), ids, c);
        return create(SurveyForPostsResponseSchema, {
          entries: rows.map((r) => ({
            postId: r.post_id,
            questionId: r.question_id ?? 0,
            question: r.question ?? "",
            dimension: r.dimension ?? "",
            myAnswer: r.my_answer === null ? "" : r.my_answer ? "yes" : "no",
            answeredAt: iso(r.answered_at),
            canChange: r.can_change,
            publicLine: Object.entries(r.public_line)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([dimension, v]) => ({ dimension, count: v.count, phrase: v.phrase })),
          })),
        });
      });
    },
    async answerSurvey(req, ctx) {
      const r = parse(z.object({ postId: Uuid, answer: z.boolean(), latencyMs: z.number().int().min(0) }), req);
      const c = await deps.config();
      return write(deps, ctx, AnswerSurveyRequestSchema, AnswerSurveyResponseSchema, req, async (tx) => {
        await answerSurvey(tx, meOf(ctx), r.postId, r.answer, r.latencyMs, c);
        return create(AnswerSurveyResponseSchema);
      });
    },
    async recordViews(req, ctx) {
      const ids = parse(Ids(500), req.postIds);
      return write(deps, ctx, RecordViewsRequestSchema, RecordViewsResponseSchema, req, async (tx) =>
        create(RecordViewsResponseSchema, { recorded: await recordViews(tx, meOf(ctx), [...new Set(ids)]) }),
      );
    },
    async postInsights(req, ctx) {
      const postId = parse(Uuid, req.postId);
      const rows = await postInsights(deps.sql, meOf(ctx), postId);
      return {
        rows: rows.map((r) => ({
          dimension: r.dimension,
          label: r.label,
          ticks: r.ticks,
          crosses: r.crosses,
          weightedRate: r.weighted_rate === null ? -1 : Number(r.weighted_rate),
          views: r.views ?? 0,
          commenters: r.commenters ?? 0,
        })),
      };
    },
  };
}
