import type { ServiceImpl } from "@connectrpc/connect";
import * as C from "@skilient/contracts/community/v1/community_pb";
import { z } from "zod";
import * as I from "../store/inductions";
import * as S from "../store/societies";
import * as St from "../store/staff";
import { filler, id, json, meOf, onward, opt, parse, restricted, staffCheck, Text, trust, userIdsIn, write, type ApiDeps } from "./util";

const Category = z.enum(["technology", "business", "debating", "arts", "sports", "community", "religious", "other"]);
const OptCategory = z.union([z.literal(""), Category]);
const Date_ = z.iso.date();

/** Societies: request, pages, membership, officers and terms, induction rounds, and the staff review. */
export function societiesApi(deps: ApiDeps): Partial<ServiceImpl<typeof C.CommunityService>> {
  const { sql } = deps;
  const tiersOf = async (doc: unknown, ctx: Parameters<typeof onward>[0]) => deps.ports.tiers(userIdsIn(doc), onward(ctx));
  return {
    async societyNameCheck(req, ctx) {
      return { json: json(await filler(deps, ctx)(await S.nameCheck(sql, meOf(ctx), parse(Text(200), req.name)))) };
    },
    async requestSociety(req, ctx) {
      const p = parse(
        z.object({ name: Text(200), category: Category, about: Text(2000), proofPath: Text(200), proofUrl: Text(600), officeBearer: z.boolean() }),
        req,
      );
      return write(deps, ctx, C.RequestSocietyRequestSchema, C.RequestSocietyResponseSchema, req, async (tx) => {
        restricted(ctx);
        const societyId = await S.requestSociety(
          tx,
          meOf(ctx),
          { name: p.name, category: p.category, about: p.about, proof_path: opt(p.proofPath), proof_url: opt(p.proofUrl), office_bearer: p.officeBearer },
          deps.files,
        );
        return { societyId };
      });
    },
    async resubmitSociety(req, ctx) {
      const p = parse(z.object({ societyId: z.uuid(), about: Text(2000), category: OptCategory, proofPath: Text(200), proofUrl: Text(600) }), req);
      return write(deps, ctx, C.ResubmitSocietyRequestSchema, C.ResubmitSocietyResponseSchema, req, async (tx) => {
        await S.resubmitSociety(tx, meOf(ctx), p.societyId, { about: p.about, category: p.category, proof_path: p.proofPath, proof_url: p.proofUrl }, deps.files);
        return {};
      });
    },
    async mySocietyRequests(_req, ctx) {
      return { json: json(await S.mySocietyRequests(sql, meOf(ctx))) };
    },
    async setSocietyImages(req, ctx) {
      const p = parse(z.object({ societyId: z.uuid(), logoPath: Text(200), coverPath: Text(200) }), req);
      return write(deps, ctx, C.SetSocietyImagesRequestSchema, C.SetSocietyImagesResponseSchema, req, async (tx) => {
        await S.setSocietyImages(tx, meOf(ctx), p.societyId, opt(p.logoPath), opt(p.coverPath), deps.files);
        return {};
      });
    },
    async updateSociety(req, ctx) {
      const p = parse(z.object({ societyId: z.uuid(), about: Text(2000), category: OptCategory }), req);
      return write(deps, ctx, C.UpdateSocietyRequestSchema, C.UpdateSocietyResponseSchema, req, async (tx) => {
        await S.updateSociety(tx, meOf(ctx), p.societyId, { about: p.about, category: p.category });
        return {};
      });
    },
    async setMembershipMode(req, ctx) {
      const p = parse(z.object({ societyId: z.uuid(), mode: Text(20) }), req);
      return write(deps, ctx, C.SetMembershipModeRequestSchema, C.SetMembershipModeResponseSchema, req, async (tx) => {
        await S.setMembershipMode(tx, meOf(ctx), p.societyId, p.mode);
        return {};
      });
    },
    async societiesDirectory(req, ctx) {
      const p = parse(z.object({ query: Text(200), category: Text(40) }), req);
      return { json: json(await S.directory(sql, meOf(ctx), p.query, opt(p.category), filler(deps, ctx))) };
    },
    async societyPage(req, ctx) {
      const doc = await S.societyPage(sql, meOf(ctx), parse(Text(100), req.slug), staffCheck(deps, ctx), filler(deps, ctx));
      return { json: json(doc), tiers: await tiersOf(doc["roll_call"], ctx) };
    },
    async societyManage(req, ctx) {
      const doc = await S.societyManage(sql, meOf(ctx), id(req.societyId), filler(deps, ctx));
      return { json: json(doc), tiers: await tiersOf(doc["members"], ctx) };
    },
    async followSociety(req, ctx) {
      const societyId = id(req.societyId);
      return write(deps, ctx, C.FollowSocietyRequestSchema, C.FollowSocietyResponseSchema, req, async (tx) => {
        if (req.on) restricted(ctx);
        await S.followSociety(tx, meOf(ctx), societyId, req.on);
        return {};
      });
    },
    async joinSociety(req, ctx) {
      const societyId = id(req.societyId);
      return write(deps, ctx, C.JoinSocietyRequestSchema, C.JoinSocietyResponseSchema, req, async (tx) => {
        restricted(ctx);
        return { result: await S.joinSociety(tx, meOf(ctx), societyId) };
      });
    },
    async decideJoinRequest(req, ctx) {
      const p = parse(z.object({ societyId: z.uuid(), userId: z.uuid() }), req);
      return write(deps, ctx, C.DecideJoinRequestRequestSchema, C.DecideJoinRequestResponseSchema, req, async (tx) => {
        await S.decideJoinRequest(tx, meOf(ctx), p.societyId, p.userId, req.accept);
        return {};
      });
    },
    async leaveSociety(req, ctx) {
      const societyId = id(req.societyId);
      return write(deps, ctx, C.LeaveSocietyRequestSchema, C.LeaveSocietyResponseSchema, req, async (tx) => {
        await S.leaveSociety(tx, meOf(ctx), societyId);
        return {};
      });
    },
    async inviteOfficer(req, ctx) {
      const p = parse(z.object({ societyId: z.uuid(), username: Text(60), title: Text(80), termStart: Date_, termEnd: Date_ }), req);
      const name = p.username.trim().toLowerCase();
      const user = (await deps.ports.resolve([name], onward(ctx))).get(name) ?? null;
      return write(deps, ctx, C.InviteOfficerRequestSchema, C.InviteOfficerResponseSchema, req, async (tx) => {
        restricted(ctx);
        return { inviteId: await S.inviteOfficer(tx, meOf(ctx), p.societyId, user, p.title, p.termStart, p.termEnd) };
      });
    },
    async offerHandover(req, ctx) {
      const p = parse(z.object({ societyId: z.uuid(), username: Text(60) }), req);
      const name = p.username.trim().toLowerCase();
      const user = (await deps.ports.resolve([name], onward(ctx))).get(name) ?? null;
      return write(deps, ctx, C.OfferHandoverRequestSchema, C.OfferHandoverResponseSchema, req, async (tx) => {
        restricted(ctx);
        return { inviteId: await S.offerHandover(tx, meOf(ctx), p.societyId, user) };
      });
    },
    async answerSocietyInvite(req, ctx) {
      const inviteId = id(req.inviteId);
      return write(deps, ctx, C.AnswerSocietyInviteRequestSchema, C.AnswerSocietyInviteResponseSchema, req, async (tx) => {
        await S.answerInvite(tx, meOf(ctx), inviteId, req.accept);
        return {};
      });
    },
    async mySocietyInvites(_req, ctx) {
      return { json: json(await S.mySocietyInvites(sql, meOf(ctx))) };
    },
    async removeOfficer(req, ctx) {
      const p = parse(z.object({ societyId: z.uuid(), userId: z.uuid() }), req);
      return write(deps, ctx, C.RemoveOfficerRequestSchema, C.RemoveOfficerResponseSchema, req, async (tx) => {
        await S.removeOfficer(tx, meOf(ctx), p.societyId, p.userId);
        return {};
      });
    },
    async confirmTerm(req, ctx) {
      const termId = id(req.termId);
      return write(deps, ctx, C.ConfirmTermRequestSchema, C.ConfirmTermResponseSchema, req, async (tx) => {
        await S.confirmTerm(tx, meOf(ctx), termId);
        return {};
      });
    },
    async myOfficerSocieties(_req, ctx) {
      return { json: json(await S.myOfficerSocieties(sql, meOf(ctx))) };
    },

    async saveInductionRound(req, ctx) {
      const p = parse(
        z.object({
          societyId: z.uuid(),
          roundId: z.union([z.literal(""), z.uuid()]),
          title: Text(200),
          description: Text(3000),
          deadline: Text(60),
          roles: z.array(z.object({ title: Text(80), seats: z.number().int().min(0).max(50), skillIds: z.array(Text(40)).max(5) })).max(20),
          questions: z.array(Text(600)).max(10),
        }),
        req,
      );
      return write(deps, ctx, C.SaveInductionRoundRequestSchema, C.SaveInductionRoundResponseSchema, req, async (tx) => {
        if (!p.roundId) restricted(ctx);
        const roundId = await I.saveRound(tx, meOf(ctx), p.societyId, {
          id: opt(p.roundId),
          title: p.title,
          description: p.description,
          deadline: p.deadline,
          roles: p.roles.map((r) => ({ title: r.title, seats: r.seats, skill_ids: r.skillIds })),
          questions: p.questions,
        });
        return { roundId };
      });
    },
    async publishInductionRound(req, ctx) {
      const roundId = id(req.roundId);
      return write(deps, ctx, C.PublishInductionRoundRequestSchema, C.PublishInductionRoundResponseSchema, req, async (tx) => {
        await I.publishRound(tx, meOf(ctx), roundId);
        return {};
      });
    },
    async inductionRoundPage(req, ctx) {
      return { json: json(await I.roundPage(sql, meOf(ctx), id(req.roundId), staffCheck(deps, ctx), filler(deps, ctx))) };
    },
    async applyInduction(req, ctx) {
      const p = parse(z.object({ roundId: z.uuid(), roleId: z.union([z.literal(""), z.uuid()]), answers: z.array(Text(2000)).max(10) }), req);
      return write(deps, ctx, C.ApplyInductionRequestSchema, C.ApplyInductionResponseSchema, req, async (tx) => {
        restricted(ctx);
        return { applicationId: await I.applyInduction(tx, meOf(ctx), p.roundId, opt(p.roleId), p.answers, staffCheck(deps, ctx)) };
      });
    },
    async decideInductionApplication(req, ctx) {
      const p = parse(z.object({ applicationId: z.uuid(), action: Text(20), note: Text(600) }), req);
      return write(deps, ctx, C.DecideInductionApplicationRequestSchema, C.DecideInductionApplicationResponseSchema, req, async (tx) => {
        await I.decideApplication(tx, meOf(ctx), p.applicationId, p.action, opt(p.note));
        return {};
      });
    },

    async opsSocieties(req, ctx) {
      const me = await trust(deps, ctx);
      return { json: json(await St.opsSocieties(sql, me, parse(Text(20), req.status) || "open", filler(deps, ctx))) };
    },
    async opsSocietyCase(req, ctx) {
      const me = await trust(deps, ctx);
      return { json: json(await St.opsSocietyCase(sql, me, id(req.societyId), filler(deps, ctx))) };
    },
    async claimSociety(req, ctx) {
      const me = await trust(deps, ctx);
      const societyId = id(req.societyId);
      return write(deps, ctx, C.ClaimSocietyRequestSchema, C.ClaimSocietyResponseSchema, req, async (tx) => {
        await St.claimSociety(tx, me, societyId, req.claim);
        return {};
      });
    },
    async decideSociety(req, ctx) {
      const me = await trust(deps, ctx);
      const p = parse(z.object({ societyId: z.uuid(), action: Text(20), reason: Text(1000) }), req);
      return write(deps, ctx, C.DecideSocietyRequestSchema, C.DecideSocietyResponseSchema, req, async (tx) => {
        await St.decideSociety(tx, me, p.societyId, p.action, opt(p.reason));
        return {};
      });
    },
  };
}
