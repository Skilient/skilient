import type { DescMessage } from "@bufbuild/protobuf";
import { create } from "@bufbuild/protobuf";
import type { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { callOf, from } from "@skilient/platform";
import * as W from "@skilient/contracts/work/v1/work_pb";
import { z } from "zod";
import type { ApiDeps } from "../deps";
import { GitHub, GitHubError, RateLimited } from "../gh/client";
import { decodeBase64, sliceLines } from "../gh/snippet";
import { requireTrustReviewer } from "../identity";
import { REFUSALS, refused } from "../refusals";
import * as CC from "../store/code-checks";
import * as CR from "../store/credentials";
import * as E from "../store/endorsements";
import * as RF from "../store/review-flags";
import { iso, meOf, parse, restrictedOf, Uuid, write } from "./util";

const SkillId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/);
const Text = (max: number) => z.string().max(max);
/** A page as JSON in the method's own response message (one `json` field). */
const json = <S extends DescMessage>(schema: S, v: unknown) => create(schema, { json: JSON.stringify(v ?? null) } as never);

/** The signed-in user, or a refusal. */
function need(ctx: HandlerContext): string {
  const me = meOf(ctx);
  if (!me) throw refused("not_signed_in");
  return me;
}

/** Endorsements, credentials, code checks, and the Trust reviewers' queues for them and for GitHub flags. */
export function evidenceApi(deps: ApiDeps): Partial<ServiceImpl<typeof W.WorkService>> {
  const { sql } = deps;
  /** `require_trust_reviewer()`: two-factor and the role, from identity (one call per request). */
  const staff = async (ctx: HandlerContext) => {
    const user = callOf(ctx).user;
    return requireTrustReviewer(user, user ? await deps.identity.staffRoles(user.id, from(ctx)) : []);
  };
  const credential = (c: Awaited<ReturnType<typeof CR.myCredentials>>[number] | Awaited<ReturnType<typeof CR.credentialsFor>>[number]) => ({
    id: c.id,
    title: c.title,
    issuer: c.issuer,
    issuedOn: c.issued_on,
    expiresOn: c.expires_on ?? "",
    verifyUrl: c.verify_url ?? "",
    fileType: "file_type" in c ? c.file_type : "",
    status: "status" in c ? c.status : "approved",
    reviewReason: "review_reason" in c ? (c.review_reason ?? "") : "",
    recognised: c.recognised,
    createdAt: "created_at" in c ? iso(c.created_at) : "",
  });
  return {
    // ---- Endorsements ----
    async endorse(req, ctx) {
      const endorsee = parse(Uuid, req.endorseeId);
      const venture = parse(Uuid, req.ventureId);
      const items = parse(z.array(z.object({ skillId: z.string().max(40), evidenceId: z.string().max(40) })).max(20), req.items);
      const note = parse(Text(2000), req.note);
      return write(deps, ctx, W.EndorseRequestSchema, W.EndorseResponseSchema, req, async (tx) => {
        restrictedOf(ctx)();
        const given = await E.endorse(tx, meOf(ctx), endorsee, venture, items.map((i) => ({ skill: i.skillId, evidence: i.evidenceId || null })), note || null);
        return create(W.EndorseResponseSchema, { given });
      });
    },
    async hideEndorsement(req, ctx) {
      const id = parse(Uuid, req.endorsementId);
      return write(deps, ctx, W.HideEndorsementRequestSchema, W.HideEndorsementResponseSchema, req, async (tx) =>
        create(W.HideEndorsementResponseSchema, { hidden: await E.hideEndorsement(tx, meOf(ctx), id, req.hidden) }),
      );
    },
    async endorseOptions(req, ctx) {
      const venture = parse(Uuid, req.ventureId);
      const r = await sql.begin((tx) => E.endorseOptions(tx, meOf(ctx), venture));
      return create(W.EndorseOptionsResponseSchema, { monthLeft: r.monthLeft, teammatesJson: JSON.stringify(r.teammates) });
    },
    async endorsementsFor(req, ctx) {
      const rows = await E.endorsementsFor(sql, need(ctx), parse(Uuid, req.userId));
      return create(W.EndorsementsForResponseSchema, {
        endorsements: rows.map((r) => ({
          id: r.id,
          skillId: r.skill_id,
          skillName: r.skill_name,
          endorserId: r.endorser_id,
          endorserVisible: r.endorser_visible,
          ventureId: r.venture_id ?? "",
          ventureTitle: r.venture_title ?? "",
          note: r.note ?? "",
          hasEvidence: r.has_evidence,
          hidden: r.hidden,
          createdAt: iso(r.created_at),
          endorserKind: r.endorser_kind,
        })),
      });
    },

    // ---- Credentials ----
    async submitCredential(req, ctx) {
      const p = parse(
        z.object({ path: Text(120), title: Text(400), issuer: Text(400), issuedOn: Text(20), expiresOn: Text(20), verifyUrl: Text(1000) }),
        req,
      );
      const lookup = deps.files ?? CR.pathFileLookup;
      return write(deps, ctx, W.SubmitCredentialRequestSchema, W.SubmitCredentialResponseSchema, req, async (tx) => {
        restrictedOf(ctx)();
        const id = await CR.submitCredential(
          tx,
          meOf(ctx),
          { path: p.path, title: p.title, issuer: p.issuer, issued_on: p.issuedOn, expires_on: p.expiresOn || null, verify_url: p.verifyUrl || null },
          lookup,
        );
        return create(W.SubmitCredentialResponseSchema, { credentialId: id });
      });
    },
    async deleteCredential(req, ctx) {
      const id = parse(Uuid, req.credentialId);
      return write(deps, ctx, W.DeleteCredentialRequestSchema, W.DeleteCredentialResponseSchema, req, async (tx) => {
        await CR.deleteCredential(tx, meOf(ctx), id);
        return create(W.DeleteCredentialResponseSchema, {});
      });
    },
    async myCredentials(_req, ctx) {
      return create(W.MyCredentialsResponseSchema, { credentials: (await CR.myCredentials(sql, need(ctx))).map(credential) });
    },
    async credentialsFor(req, ctx) {
      return create(W.CredentialsForResponseSchema, { credentials: (await CR.credentialsFor(sql, need(ctx), parse(Uuid, req.userId))).map(credential) });
    },

    // ---- Code checks ----
    async requestCodeCheck(req, ctx) {
      const skill = parse(SkillId, req.skillId);
      return write(deps, ctx, W.RequestCodeCheckRequestSchema, W.RequestCodeCheckResponseSchema, req, async (tx) => {
        restrictedOf(ctx)();
        return create(W.RequestCodeCheckResponseSchema, { checkId: await CC.requestCodeCheck(tx, meOf(ctx), skill) });
      });
    },
    async startCodeCheck(req, ctx) {
      const id = parse(Uuid, req.checkId);
      return write(deps, ctx, W.StartCodeCheckRequestSchema, W.StartCodeCheckResponseSchema, req, async (tx) =>
        create(W.StartCodeCheckResponseSchema, { deadlineAt: iso(await CC.startCodeCheck(tx, meOf(ctx), id)) }),
      );
    },
    async saveCodeCheck(req, ctx) {
      const id = parse(Uuid, req.checkId);
      const answers = parse(z.record(z.string().max(20), z.string().max(20_000)), req.answers);
      return write(deps, ctx, W.SaveCodeCheckRequestSchema, W.SaveCodeCheckResponseSchema, req, async (tx) =>
        create(W.SaveCodeCheckResponseSchema, { status: await CC.saveCodeCheck(tx, meOf(ctx), id, answers, req.submit) }),
      );
    },
    async codeCheckState(req, ctx) {
      const s = await CC.codeCheckState(sql, need(ctx), parse(SkillId, req.skillId));
      return create(W.CodeCheckStateResponseSchema, { checkId: s.checkId ?? "", status: s.status ?? "", blocker: s.blocker ? REFUSALS[s.blocker].text : "" });
    },
    async myCodeCheck(req, ctx) {
      const c = await CC.myCodeCheck(sql, need(ctx), parse(Uuid, req.checkId));
      if (!c) throw refused("check_not_found");
      return create(W.MyCodeCheckResponseSchema, { json: JSON.stringify(c) });
    },
    async codeCheckSnippet(req, ctx) {
      const me = need(ctx);
      const check = parse(Uuid, req.checkId);
      const user = callOf(ctx).user!;
      const roles = user.aal === "aal2" ? await deps.identity.staffRoles(me, from(ctx)) : [];
      const access = await CC.snippetAccess(sql, check, me, roles.some((r) => r === "trust_reviewer" || r === "super_admin"));
      if (!access) throw refused("snippet_unavailable");
      const gh = deps.github;
      if (!gh) throw refused("github_unavailable");
      const gone = async (reason: string) => {
        if (access.role === "student") await sql.begin((tx) => CC.codeCheckUnavailable(tx, check, reason));
        throw refused("snippet_gone");
      };
      if (!access.installation_id) return gone("the repository is no longer shared");
      const github = new GitHub(gh.cfg, gh.fetch ?? fetch);
      let content: string;
      try {
        const token = await github.installationToken(Number(access.installation_id));
        const { data } = await github.request<{ content?: string; encoding?: string }>(
          token,
          `/repositories/${access.repo_id}/contents/${access.path.split("/").map(encodeURIComponent).join("/")}?ref=${access.sha}`,
        );
        if (!data?.content || data.encoding !== "base64") return gone("GitHub didn't send the file");
        content = decodeBase64(data.content);
      } catch (error) {
        if (error instanceof GitHubError && [403, 404, 409].includes(error.status)) return gone("GitHub no longer shows this code");
        if (error instanceof RateLimited) throw refused("github_unavailable");
        throw error;
      }
      const lines = sliceLines(content, access.start_line, access.end_line);
      if (access.role === "student") await sql.begin((tx) => CC.codeCheckServed(tx, check));
      return create(W.CodeCheckSnippetResponseSchema, { path: access.path, startLine: access.start_line, lines });
    },

    // ---- Staff ----
    async opsCredentialQueue(req, ctx) {
      const me = await staff(ctx);
      return json(W.OpsCredentialQueueResponseSchema, await CR.credentialQueue(sql, me, parse(z.enum(["pending", "reviewed"]), req.status || "pending")));
    },
    async opsCredentialCase(req, ctx) {
      const me = await staff(ctx);
      return json(W.OpsCredentialCaseResponseSchema, await CR.credentialCase(sql, me, parse(Uuid, req.id)));
    },
    async opsClaimCredential(req, ctx) {
      const me = await staff(ctx);
      const id = parse(Uuid, req.id);
      return write(deps, ctx, W.OpsClaimCredentialRequestSchema, W.OpsClaimCredentialResponseSchema, req, async (tx) => {
        await CR.claimCredential(tx, me, id, req.claim);
        return create(W.OpsClaimCredentialResponseSchema, { ok: true });
      });
    },
    async opsReviewCredential(req, ctx) {
      const me = await staff(ctx);
      const id = parse(Uuid, req.credentialId);
      const reason = parse(Text(4000), req.reason);
      const issuer = parse(Text(60), req.issuerId);
      return write(deps, ctx, W.OpsReviewCredentialRequestSchema, W.OpsReviewCredentialResponseSchema, req, async (tx) => {
        await CR.reviewCredential(tx, me, id, req.approve, reason, issuer || null);
        return create(W.OpsReviewCredentialResponseSchema, { ok: true });
      });
    },
    async opsCodeCheckQueue(req, ctx) {
      const me = await staff(ctx);
      return json(W.OpsCodeCheckQueueResponseSchema, await CC.codeCheckQueue(sql, me, parse(z.enum(["submitted", "graded"]), req.status || "submitted")));
    },
    async opsCodeCheckCase(req, ctx) {
      const me = await staff(ctx);
      return json(W.OpsCodeCheckCaseResponseSchema, await CC.codeCheckCase(sql, me, parse(Uuid, req.id)));
    },
    async opsClaimCodeCheck(req, ctx) {
      const me = await staff(ctx);
      const id = parse(Uuid, req.id);
      return write(deps, ctx, W.OpsClaimCodeCheckRequestSchema, W.OpsClaimCodeCheckResponseSchema, req, async (tx) => {
        await CC.claimCodeCheck(tx, me, id, req.claim);
        return create(W.OpsClaimCodeCheckResponseSchema, { ok: true });
      });
    },
    async opsGradeCodeCheck(req, ctx) {
      const me = await staff(ctx);
      const id = parse(Uuid, req.checkId);
      const feedback = parse(Text(4000), req.feedback);
      let rubric: unknown;
      try {
        rubric = JSON.parse(parse(Text(10_000), req.rubricJson));
      } catch {
        throw refused("check_rubric");
      }
      return write(deps, ctx, W.OpsGradeCodeCheckRequestSchema, W.OpsGradeCodeCheckResponseSchema, req, async (tx) =>
        create(W.OpsGradeCodeCheckResponseSchema, { ok: await CC.gradeCodeCheck(tx, me, id, rubric, feedback, deps.recompute) }),
      );
    },
    async opsReviewFlagQueue(_req, ctx) {
      const me = await staff(ctx);
      return json(W.OpsReviewFlagQueueResponseSchema, await RF.reviewFlagQueue(sql, me));
    },
    async opsReviewFlagCase(req, ctx) {
      const me = await staff(ctx);
      return json(W.OpsReviewFlagCaseResponseSchema, await RF.reviewFlagCase(sql, me, Number(parse(z.string().regex(/^\d{1,15}$/), req.id))));
    },
    async opsClaimReviewFlag(req, ctx) {
      const me = await staff(ctx);
      const id = Number(parse(z.string().regex(/^\d{1,15}$/), req.id));
      return write(deps, ctx, W.OpsClaimReviewFlagRequestSchema, W.OpsClaimReviewFlagResponseSchema, req, async (tx) => {
        await RF.claimReviewFlag(tx, me, id, req.claim);
        return create(W.OpsClaimReviewFlagResponseSchema, { ok: true });
      });
    },
    async opsResolveReviewFlag(req, ctx) {
      const me = await staff(ctx);
      const id = Number(parse(z.string().regex(/^\d{1,15}$/), req.flagId));
      const note = parse(Text(4000), req.note);
      return write(deps, ctx, W.OpsResolveReviewFlagRequestSchema, W.OpsResolveReviewFlagResponseSchema, req, async (tx) =>
        create(W.OpsResolveReviewFlagResponseSchema, { ok: await RF.resolveReviewFlag(tx, me, id, req.upheld, note) }),
      );
    },
  };
}
