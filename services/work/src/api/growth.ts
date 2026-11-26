import type { DescMessage } from "@bufbuild/protobuf";
import { create } from "@bufbuild/protobuf";
import type { ServiceImpl } from "@connectrpc/connect";
import * as W from "@skilient/contracts/work/v1/work_pb";
import { z } from "zod";
import type { ApiDeps } from "../deps";
import { REFUSALS, refused } from "../refusals";
import { requireUser, type Tx } from "../store/db";
import * as P from "../store/paths";
import * as S from "../store/swaps";
import * as T from "../store/tasks";
import { meOf, onward, parse, restrictedOf, Uuid, write } from "./util";

const SkillId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/);
const Role = z.string().regex(/^[a-z0-9_-]{1,40}$/);
const Text = (max: number) => z.string().max(max);
/** A page as JSON in the method's own response message (one `json` field). */
const json = <S extends DescMessage>(schema: S, v: unknown) => create(schema, { json: JSON.stringify(v ?? null) } as never);

/** Paths, proof tasks (and their peer reviews), and skill swaps. */
export function growthApi(deps: ApiDeps): Partial<ServiceImpl<typeof W.WorkService>> {
  const { sql } = deps;
  /** A read that checks the reader in its own transaction. */
  const read = <R>(run: (tx: Tx) => Promise<R>): Promise<R> => sql.begin((tx) => run(tx)) as Promise<R>;
  return {
    // ---- Paths ----
    async myPaths(_req, ctx) {
      return json(W.MyPathsResponseSchema, await read((tx) => P.myPaths(tx, meOf(ctx))));
    },
    async pathView(req, ctx) {
      const role = parse(Role, req.role);
      return json(W.PathViewResponseSchema, await read((tx) => P.pathView(tx, meOf(ctx), role)));
    },
    async followPath(req, ctx) {
      const role = parse(Role, req.role);
      return write(deps, ctx, W.FollowPathRequestSchema, W.FollowPathResponseSchema, req, async (tx) => {
        await P.followPath(tx, meOf(ctx), role, req.follow);
        return create(W.FollowPathResponseSchema, {});
      });
    },
    async pathSkillDrawer(req, ctx) {
      const skill = parse(SkillId, req.skillId);
      const role = req.role ? parse(Role, req.role) : null;
      return json(W.PathSkillDrawerResponseSchema, await read((tx) => P.pathSkillDrawer(tx, meOf(ctx), skill, role)));
    },

    // ---- Proof tasks ----
    async startTask(req, ctx) {
      const task = parse(Uuid, req.taskId);
      return write(deps, ctx, W.StartTaskRequestSchema, W.StartTaskResponseSchema, req, async (tx) => {
        restrictedOf(ctx)();
        return create(W.StartTaskResponseSchema, { attemptId: await T.startTask(tx, meOf(ctx), task) });
      });
    },
    async linkTaskRepo(req, ctx) {
      const attempt = parse(Uuid, req.attemptId);
      const repo = Number(parse(z.bigint().min(1n), req.repoId));
      return write(deps, ctx, W.LinkTaskRepoRequestSchema, W.LinkTaskRepoResponseSchema, req, async (tx) => {
        await T.linkTaskRepo(tx, meOf(ctx), attempt, repo);
        return create(W.LinkTaskRepoResponseSchema, {});
      });
    },
    async submitTask(req, ctx) {
      const attempt = parse(Uuid, req.attemptId);
      return write(deps, ctx, W.SubmitTaskRequestSchema, W.SubmitTaskResponseSchema, req, async (tx) =>
        create(W.SubmitTaskResponseSchema, { status: await T.submitTask(tx, meOf(ctx), attempt) }),
      );
    },
    async abandonTask(req, ctx) {
      const attempt = parse(Uuid, req.attemptId);
      return write(deps, ctx, W.AbandonTaskRequestSchema, W.AbandonTaskResponseSchema, req, async (tx) => {
        await T.abandonTask(tx, meOf(ctx), attempt);
        return create(W.AbandonTaskResponseSchema, {});
      });
    },
    async chooseTaskCodeCheck(req, ctx) {
      const attempt = parse(Uuid, req.attemptId);
      return write(deps, ctx, W.ChooseTaskCodeCheckRequestSchema, W.ChooseTaskCodeCheckResponseSchema, req, async (tx) =>
        create(W.ChooseTaskCodeCheckResponseSchema, { checkId: await T.chooseTaskCodeCheck(tx, meOf(ctx), attempt) }),
      );
    },
    async myTask(req, ctx) {
      const attempt = parse(Uuid, req.attemptId);
      const t = await read((tx) => T.myTask(tx, meOf(ctx), attempt));
      return json(W.MyTaskResponseSchema, { ...t, codeCheckBlocker: t.codeCheckBlocker ? REFUSALS[t.codeCheckBlocker].text : null });
    },
    async taskReviewPage(req, ctx) {
      const review = parse(Uuid, req.reviewId);
      return json(W.TaskReviewPageResponseSchema, await read((tx) => T.taskReviewPage(tx, meOf(ctx), review)));
    },
    async acceptTaskReview(req, ctx) {
      const review = parse(Uuid, req.reviewId);
      return write(deps, ctx, W.AcceptTaskReviewRequestSchema, W.AcceptTaskReviewResponseSchema, req, async (tx) => {
        await T.acceptTaskReview(tx, meOf(ctx), review);
        return create(W.AcceptTaskReviewResponseSchema, {});
      });
    },
    async declineTaskReview(req, ctx) {
      const review = parse(Uuid, req.reviewId);
      return write(deps, ctx, W.DeclineTaskReviewRequestSchema, W.DeclineTaskReviewResponseSchema, req, async (tx) => {
        await T.declineTaskReview(tx, meOf(ctx), review);
        return create(W.DeclineTaskReviewResponseSchema, {});
      });
    },
    async reviewTask(req, ctx) {
      const review = parse(Uuid, req.reviewId);
      const note = parse(Text(4000), req.note);
      const ticks = parse(z.array(z.boolean()).max(20), req.ticks);
      return write(deps, ctx, W.ReviewTaskRequestSchema, W.ReviewTaskResponseSchema, req, async (tx) => {
        await T.reviewTask(tx, meOf(ctx), review, req.confirm, note || null, ticks);
        return create(W.ReviewTaskResponseSchema, {});
      });
    },

    // ---- Skill swaps ----
    async saveSwapOffer(req, ctx) {
      const skill = parse(SkillId, req.skillId);
      const note = parse(Text(2000), req.note);
      return write(deps, ctx, W.SaveSwapOfferRequestSchema, W.SaveSwapOfferResponseSchema, req, async (tx) => {
        await S.saveSwapOffer(tx, meOf(ctx), skill, note || null, req.on);
        return create(W.SaveSwapOfferResponseSchema, {});
      });
    },
    async saveSwapWant(req, ctx) {
      const skill = parse(SkillId, req.skillId);
      const note = parse(Text(2000), req.note);
      return write(deps, ctx, W.SaveSwapWantRequestSchema, W.SaveSwapWantResponseSchema, req, async (tx) => {
        await S.saveSwapWant(tx, meOf(ctx), skill, note || null, req.on);
        return create(W.SaveSwapWantResponseSchema, {});
      });
    },
    async requestSwap(req, ctx) {
      const username = parse(Text(64), req.teacherUsername).trim().toLowerCase();
      const skill = parse(SkillId, req.skillId);
      const note = parse(Text(4000), req.note);
      const times = parse(Text(1000), req.preferredTimes);
      const offer = req.offeredSkillId ? parse(SkillId, req.offeredSkillId) : null;
      // The teacher's id from people, once, before the transaction.
      const teacher = meOf(ctx) && username ? ((await deps.people.resolve([username], onward(ctx))).get(username) ?? null) : null;
      return write(deps, ctx, W.RequestSwapRequestSchema, W.RequestSwapResponseSchema, req, async (tx) => {
        restrictedOf(ctx)();
        return create(W.RequestSwapResponseSchema, { swapId: await S.requestSwap(tx, meOf(ctx), teacher, skill, note || null, times || null, offer) });
      });
    },
    async respondSwap(req, ctx) {
      const swap = parse(Uuid, req.swapId);
      return write(deps, ctx, W.RespondSwapRequestSchema, W.RespondSwapResponseSchema, req, async (tx) => {
        await S.respondSwap(tx, meOf(ctx), swap, req.accept);
        return create(W.RespondSwapResponseSchema, {});
      });
    },
    async cancelSwapRequest(req, ctx) {
      const swap = parse(Uuid, req.swapId);
      return write(deps, ctx, W.CancelSwapRequestRequestSchema, W.CancelSwapRequestResponseSchema, req, async (tx) => {
        await S.cancelSwapRequest(tx, meOf(ctx), swap);
        return create(W.CancelSwapRequestResponseSchema, {});
      });
    },
    async endSwap(req, ctx) {
      const swap = parse(Uuid, req.swapId);
      return write(deps, ctx, W.EndSwapRequestSchema, W.EndSwapResponseSchema, req, async (tx) => {
        await S.endSwap(tx, meOf(ctx), swap);
        return create(W.EndSwapResponseSchema, {});
      });
    },
    async proposeSwapSession(req, ctx) {
      const swap = parse(Uuid, req.swapId);
      const startsAt = parse(z.iso.datetime({ offset: true }), req.startsAt);
      const place = parse(Text(1000), req.place);
      return write(deps, ctx, W.ProposeSwapSessionRequestSchema, W.ProposeSwapSessionResponseSchema, req, async (tx) => {
        restrictedOf(ctx)();
        return create(W.ProposeSwapSessionResponseSchema, { sessionId: await S.proposeSwapSession(tx, meOf(ctx), swap, startsAt, req.minutes, place) });
      });
    },
    async respondSwapSession(req, ctx) {
      const session = parse(Uuid, req.sessionId);
      return write(deps, ctx, W.RespondSwapSessionRequestSchema, W.RespondSwapSessionResponseSchema, req, async (tx) => {
        await S.respondSwapSession(tx, meOf(ctx), session, req.accept);
        return create(W.RespondSwapSessionResponseSchema, {});
      });
    },
    async cancelSwapSession(req, ctx) {
      const session = parse(Uuid, req.sessionId);
      return write(deps, ctx, W.CancelSwapSessionRequestSchema, W.CancelSwapSessionResponseSchema, req, async (tx) => {
        await S.cancelSwapSession(tx, meOf(ctx), session);
        return create(W.CancelSwapSessionResponseSchema, {});
      });
    },
    async confirmSwapSession(req, ctx) {
      const session = parse(Uuid, req.sessionId);
      const reason = parse(Text(40), req.reason);
      const note = parse(Text(2000), req.note);
      return write(deps, ctx, W.ConfirmSwapSessionRequestSchema, W.ConfirmSwapSessionResponseSchema, req, async (tx) => {
        await S.confirmSwapSession(tx, meOf(ctx), session, req.happened, req.happened ? req.minutes : null, reason || null, note || null);
        return create(W.ConfirmSwapSessionResponseSchema, {});
      });
    },
    async decideSwapNote(req, ctx) {
      const note = parse(Uuid, req.noteId);
      return write(deps, ctx, W.DecideSwapNoteRequestSchema, W.DecideSwapNoteResponseSchema, req, async (tx) => {
        await S.decideSwapNote(tx, meOf(ctx), note, req.approve);
        return create(W.DecideSwapNoteResponseSchema, {});
      });
    },
    async swapsPage(_req, ctx) {
      return json(W.SwapsPageResponseSchema, await read((tx) => S.swapsPage(tx, meOf(ctx))));
    },
    async swapPage(req, ctx) {
      const swap = parse(Uuid, req.swapId);
      return json(W.SwapPageResponseSchema, await read((tx) => S.swapPage(tx, meOf(ctx), swap)));
    },
    async swapTeachers(req, ctx) {
      const skill = parse(SkillId, req.skillId);
      return json(W.SwapTeachersResponseSchema, 
        await read(async (tx) => {
          const me = await requireUser(tx, meOf(ctx));
          return S.swapTeachers(tx, me.id, me.university_id, skill);
        }),
      );
    },
    async swapNotesFor(req, ctx) {
      const user = parse(Uuid, req.userId);
      if (!meOf(ctx)) throw refused("not_signed_in");
      return json(W.SwapNotesForResponseSchema, await read((tx) => S.swapNotesFor(tx, meOf(ctx), user)));
    },
  };
}

