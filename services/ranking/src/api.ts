import { create, type DescMessage, type MessageInitShape, type MessageShape } from "@bufbuild/protobuf";
import type { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import * as pb from "@skilient/contracts/ranking/v1/ranking_pb";
import type { RankingService } from "@skilient/contracts/ranking/v1/ranking_pb";
import { callOf, from, withWrite, type Logger } from "@skilient/platform";
import type postgres from "postgres";
import { z } from "zod";
import { requireAccounts, requireTrustReviewer, type IdentityPort } from "./identity";
import { refused } from "./refusals";
import * as B from "./store/boards";
import * as E from "./store/exams";
import * as F from "./store/flags";

export interface ApiDeps {
  sql: postgres.Sql;
  logger: Logger;
  /** Staff roles (identity's StaffRolesOf); one call per staff request. */
  identity: IdentityPort;
}

/** Validates input with zod; any failure is one typed refusal (no details echoed back). */
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw refused("invalid_input");
  return r.data;
}
const Uuid = z.uuid();
const Ids = (max: number) => z.array(z.uuid()).max(max);
const Day = z.iso.date();
const meOf = (ctx: HandlerContext) => callOf(ctx).user?.id ?? null;
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : "");
const optNum = (v: string | null) => (v === null ? undefined : Number(v));

function write<I extends DescMessage, O extends DescMessage>(
  deps: ApiDeps,
  ctx: HandlerContext,
  input: I,
  output: O,
  req: MessageShape<I>,
  body: (tx: postgres.TransactionSql) => Promise<MessageInitShape<O>>,
): Promise<MessageShape<O>> {
  return withWrite(ctx, deps.sql, { input, output }, req, async (tx) => create(output, await body(tx)));
}

const exam = (e: E.ExamRow) => ({
  id: e.id,
  universityId: e.university_id,
  startsOn: e.starts_on,
  endsOn: e.ends_on,
  reason: e.reason,
  createdBy: e.created_by ?? "",
  createdAt: iso(e.created_at),
});

/** Ranking's handlers: validate, authorise, one transaction with its events, typed replies. */
export function createApi(deps: ApiDeps): ServiceImpl<typeof RankingService> {
  const { sql } = deps;
  const staffRoles = (ctx: HandlerContext) => {
    const user = callOf(ctx).user;
    return user ? deps.identity.staffRoles(user.id, from(ctx)) : Promise.resolve([]);
  };
  const trust = async (ctx: HandlerContext) => requireTrustReviewer(callOf(ctx).user, await staffRoles(ctx));
  const accounts = async (ctx: HandlerContext) => requireAccounts(callOf(ctx).user, await staffRoles(ctx));
  const scope = (s: string) => parse(z.string().max(20), s);
  const dept = (d: string | undefined) => (d === undefined ? null : parse(z.string().max(200), d));

  return {
    async leaderboard(req, ctx) {
      const rows = await B.leaderboard(sql, meOf(ctx), scope(req.scope), dept(req.department), req.batch ?? null, Math.max(0, req.after));
      return {
        rows: rows.map((r) => ({
          place: BigInt(r.place),
          rank: BigInt(r.rank),
          ...(r.weekly_change === null ? {} : { weeklyChange: BigInt(r.weekly_change) }),
          userId: r.user_id,
          universityId: r.university_id ?? "",
          tier: r.tier ?? "",
          isMe: r.is_me,
        })),
      };
    },
    async leaderboardMe(req, ctx) {
      const m = await B.leaderboardMe(sql, meOf(ctx), scope(req.scope), dept(req.department), req.batch ?? null);
      return {
        optedOut: m.opted_out,
        ranked: m.ranked,
        scored: m.scored,
        ...(m.total === null ? {} : { total: m.total }),
        tier: m.tier ?? "",
        held: m.held,
        ...(m.rank === null ? {} : { rank: BigInt(m.rank) }),
        ...(m.place === null ? {} : { place: BigInt(m.place) }),
        ...(m.weekly_change === null ? {} : { weeklyChange: BigInt(m.weekly_change) }),
        size: BigInt(m.size),
      };
    },
    async leaderboardFilters(_req, ctx) {
      const f = await B.leaderboardFilters(sql, meOf(ctx));
      return { departmentHashes: f.departments, batches: f.batches };
    },
    async myScore(_req, ctx) {
      return { scoreJson: JSON.stringify(await B.myScore(sql, meOf(ctx))) };
    },
    async tiersFor(req, ctx) {
      const ids = parse(z.array(z.uuid()).max(1000), req.userIds);
      return { tiers: (await B.tiersFor(sql, meOf(ctx), ids)).map((t) => ({ userId: t.user_id, tier: t.tier })) };
    },
    async tiersOf(req) {
      const ids = parse(Ids(500), req.userIds);
      return { tiers: (await B.tiersOf(sql, ids)).map((t) => ({ userId: t.user_id, tier: t.tier ?? "", ranked: t.ranked })) };
    },

    async rankingFlagQueue(req, ctx) {
      const me = await trust(ctx);
      const rows = await F.flagQueue(sql, me, parse(z.string().max(20), req.status));
      return {
        flags: rows.map((f) => ({
          id: f.id,
          kind: f.kind,
          memberIds: f.member_ids,
          ...(f.gain === null ? {} : { gain: optNum(f.gain)! }),
          ...(f.from_total === null ? {} : { fromTotal: optNum(f.from_total)! }),
          ...(f.to_total === null ? {} : { toTotal: optNum(f.to_total)! }),
          endorsements: f.endorsements,
          status: f.status,
          claimedBy: f.claimed_by ?? "",
          claimedByMe: f.claimed_by_me,
          createdAt: iso(f.created_at),
          reviewedAt: iso(f.reviewed_at),
        })),
      };
    },
    async rankingFlagCase(req, ctx) {
      const me = await trust(ctx);
      const c = await F.flagCase(sql, me, parse(Uuid, req.id));
      if (!c) return { found: false, caseJson: "" };
      return {
        found: true,
        caseJson: JSON.stringify({
          id: c.id,
          kind: c.kind,
          status: c.status,
          detail: c.detail,
          reason: c.reason,
          created_at: iso(c.created_at),
          reviewed_at: c.reviewed_at ? iso(c.reviewed_at) : null,
          claimed_by: c.claimed_by,
          claimed_by_me: c.claimed_by_me,
          is_member: c.is_member,
          reviewed_by: c.reviewed_by,
          members: c.member_rows.map((m) => ({ user_id: m.user_id, university_id: m.university_id, total: m.total === null ? null : Number(m.total), tier: m.tier })),
          endorsements: c.endorsement_rows.map((e) => ({ ...e, created_at: iso(e.created_at) })),
        }),
      };
    },
    async claimRankingFlag(req, ctx) {
      const me = await trust(ctx);
      const id = parse(Uuid, req.id);
      return write(deps, ctx, pb.ClaimRankingFlagRequestSchema, pb.ClaimRankingFlagResponseSchema, req, async (tx) => {
        await F.claimFlag(tx, me, id, req.claim);
        return {};
      });
    },
    async reviewRankingFlag(req, ctx) {
      const me = await trust(ctx);
      const id = parse(Uuid, req.id);
      const reason = parse(z.string().max(4000), req.reason);
      return write(deps, ctx, pb.ReviewRankingFlagRequestSchema, pb.ReviewRankingFlagResponseSchema, req, async (tx) => {
        await F.reviewFlag(tx, me, id, req.uphold, reason);
        return {};
      });
    },

    async examPeriodList(_req, ctx) {
      await accounts(ctx);
      return { periods: (await E.examPeriodList(sql)).map(exam) };
    },
    async addExamPeriod(req, ctx) {
      const me = await accounts(ctx);
      const university = parse(Uuid, req.universityId);
      const reason = parse(z.string().max(500), req.reason);
      const [starts, ends] = [req.startsOn, req.endsOn];
      if (!Day.safeParse(starts).success || !Day.safeParse(ends).success) throw refused("exam_end_before_start");
      return write(deps, ctx, pb.AddExamPeriodRequestSchema, pb.AddExamPeriodResponseSchema, req, async (tx) => ({ id: await E.addExamPeriod(tx, me, university, starts, ends, reason) }));
    },
    async removeExamPeriod(req, ctx) {
      const me = await accounts(ctx);
      const id = parse(Uuid, req.id);
      const reason = parse(z.string().max(500), req.reason);
      return write(deps, ctx, pb.RemoveExamPeriodRequestSchema, pb.RemoveExamPeriodResponseSchema, req, async (tx) => {
        await E.removeExamPeriod(tx, me, id, reason);
        return {};
      });
    },

    async uniExamPeriods(req) {
      return { periods: (await E.universityExamPeriods(sql, parse(Uuid, req.universityId))).map(exam) };
    },
    async uniAddExamPeriod(req, ctx) {
      const university = parse(Uuid, req.universityId);
      const actor = parse(Uuid, req.actorId);
      const reason = parse(z.string().max(500), req.reason);
      const [starts, ends] = [req.startsOn, req.endsOn];
      if (!Day.safeParse(starts).success || !Day.safeParse(ends).success) throw refused("exam_end_before_start");
      return write(deps, ctx, pb.UniAddExamPeriodRequestSchema, pb.UniAddExamPeriodResponseSchema, req, async (tx) => ({ id: await E.addUniversityExamPeriod(tx, university, actor, starts, ends, reason) }));
    },
    async uniRemoveExamPeriod(req, ctx) {
      const university = parse(Uuid, req.universityId);
      const id = parse(Uuid, req.id);
      const reason = parse(z.string().max(500), req.reason);
      return write(deps, ctx, pb.UniRemoveExamPeriodRequestSchema, pb.UniRemoveExamPeriodResponseSchema, req, async (tx) => {
        const e = await E.removeUniversityExamPeriod(tx, university, id, reason);
        return { startsOn: e.starts_on, endsOn: e.ends_on };
      });
    },
  };
}
