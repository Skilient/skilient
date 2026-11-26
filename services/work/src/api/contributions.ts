import { create } from "@bufbuild/protobuf";
import type { ServiceImpl } from "@connectrpc/connect";
import * as W from "@skilient/contracts/work/v1/work_pb";
import { z } from "zod";
import type { ApiDeps } from "../deps";
import { refused } from "../refusals";
import * as C from "../store/contributions";
import { verifiedContributors } from "../store/ventures";
import { canViewVenture } from "../store/db";
import { iso, meOf, parse, restrictedOf, Uuid, write } from "./util";

const Kind = z.enum(["code", "design", "research", "docs", "management", "other"]);
const EntryInput = z.object({
  kind: Kind,
  description: z.string().max(2000),
  evidenceUrl: z.string().max(1000),
  hours: z.number().min(0).max(1000),
  skillIds: z.array(z.string().max(40)).max(12),
});
const entry = (p: z.infer<typeof EntryInput>): C.Entry => ({
  kind: p.kind,
  description: p.description,
  evidence_url: p.evidenceUrl || null,
  hours: p.hours === 0 ? null : p.hours,
  skill_ids: p.skillIds,
});

/** The contribution log: log, correct, confirm; the venture's list, its verified count, a person's summary. */
export function contributionsApi(deps: ApiDeps): Partial<ServiceImpl<typeof W.WorkService>> {
  const { sql } = deps;
  return {
    async logContribution(req, ctx) {
      const venture = parse(Uuid, req.ventureId);
      const p = parse(EntryInput, req);
      return write(deps, ctx, W.LogContributionRequestSchema, W.LogContributionResponseSchema, req, async (tx) => {
        restrictedOf(ctx)();
        return create(W.LogContributionResponseSchema, { contributionId: await C.logContribution(tx, meOf(ctx), venture, entry(p)) });
      });
    },
    async correctContribution(req, ctx) {
      const original = parse(Uuid, req.originalId);
      const p = parse(EntryInput, req);
      return write(deps, ctx, W.CorrectContributionRequestSchema, W.CorrectContributionResponseSchema, req, async (tx) => {
        restrictedOf(ctx)();
        return create(W.CorrectContributionResponseSchema, { contributionId: await C.correctContribution(tx, meOf(ctx), original, entry(p), deps.recompute) });
      });
    },
    async confirmContribution(req, ctx) {
      const e = parse(Uuid, req.contributionId);
      return write(deps, ctx, W.ConfirmContributionRequestSchema, W.ConfirmContributionResponseSchema, req, async (tx) => {
        restrictedOf(ctx)();
        return create(W.ConfirmContributionResponseSchema, { confirmed: await C.confirmContribution(tx, meOf(ctx), e, deps.recompute) });
      });
    },
    async contributions(req, ctx) {
      const me = meOf(ctx);
      if (!me) throw refused("not_signed_in");
      const rows = await C.contributions(sql, me, parse(Uuid, req.ventureId));
      return create(W.ContributionsResponseSchema, {
        contributions: rows.map((r) => ({
          id: r.id,
          ventureId: r.venture_id,
          userId: r.user_id,
          currentId: r.current_id,
          kind: r.kind,
          description: r.description,
          evidenceUrl: r.evidence_url ?? "",
          hours: r.hours === null ? 0 : Number(r.hours),
          source: r.source,
          commitSha: r.commit_sha ?? "",
          createdAt: iso(r.created_at),
          correctedAt: iso(r.corrected_at),
          confirmations: r.confirmations,
          verified: r.verified,
          beforeVenture: r.before_venture,
          skillIds: r.skill_ids,
          aiAgent: r.ai_agent ?? "",
          confirmedByMe: r.confirmed_by_me,
          byMember: r.by_member,
        })),
      });
    },
    async verifiedContributors(req, ctx) {
      const me = meOf(ctx);
      const venture = parse(Uuid, req.ventureId);
      // `venture_verified_contributors`: the count where the reader can see the venture, else 0.
      const count = await sql.begin(async (tx) => {
        const [v] = await tx`select 1 from work.ventures v where v.id = ${venture} and ${canViewVenture(tx, me)}`;
        return v ? verifiedContributors(tx, venture) : 0;
      });
      return create(W.VerifiedContributorsResponseSchema, { count });
    },
    async contributionSummary(req, ctx) {
      const me = meOf(ctx);
      if (!me) throw refused("not_signed_in");
      const rows = await C.contributionSummary(sql, me, parse(Uuid, req.userId));
      return create(W.ContributionSummaryResponseSchema, { ventures: rows.map((r) => ({ ventureId: r.venture_id, entries: r.entries, verified: r.verified })) });
    },
  };
}
