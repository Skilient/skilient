import { create, type DescMessage, type MessageShape } from "@bufbuild/protobuf";
import type { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import {
  ConfirmUniversityRequestRequestSchema,
  ConfirmUniversityRequestResponseSchema,
  DeleteDepartmentRequestSchema,
  DeleteDepartmentResponseSchema,
  DeleteProgrammeRequestSchema,
  DeleteProgrammeResponseSchema,
  OpsAddUniDomainRequestSchema,
  OpsAddUniDomainResponseSchema,
  OpsOpenAllUniversitiesRequestSchema,
  OpsOpenAllUniversitiesResponseSchema,
  OpsSetFinalYearBatchRequestSchema,
  OpsSetFinalYearBatchResponseSchema,
  OpsSetUniversityLiveRequestSchema,
  OpsSetUniversityLiveResponseSchema,
  PeopleService,
  RequestUniversityRequestSchema,
  RequestUniversityResponseSchema,
  SaveDepartmentRequestSchema,
  SaveDepartmentResponseSchema,
  SaveProgrammeRequestSchema,
  SaveProgrammeResponseSchema,
  UnsubscribeUniversityRequestRequestSchema,
  UnsubscribeUniversityRequestResponseSchema,
} from "@skilient/contracts/people/v1/people_pb";
import { callOf, from, withWrite } from "@skilient/platform";
import type postgres from "postgres";
import { z } from "zod";
import { requireAccounts } from "../authorize";
import type { ApiDeps } from "../deps";
import { refused } from "../refusals";
import {
  confirmUniversityRequest,
  deleteDepartment,
  deleteProgramme,
  listUniversities,
  opsAddUniDomain,
  opsBatches,
  opsOpenAllUniversities,
  opsSetFinalYearBatch,
  opsSetUniversityLive,
  opsUniversityRequests,
  requestUniversity,
  saveDepartment,
  saveProgramme,
  unsubscribeUniversityRequest,
} from "../store/universities";
import { iso, parse, Uuid, write } from "./util";

const Reason = z.string().max(500);
const Token = z.string().max(200);

/** Universities, requests, staff methods (role and two-factor from identity, audited) and market's department edits. */
export function universitiesApi(deps: ApiDeps): Partial<ServiceImpl<typeof PeopleService>> {
  const { sql } = deps;
  /** require_accounts: one identity StaffRolesOf call per request, before the transaction. */
  async function staff(ctx: HandlerContext): Promise<string> {
    const user = callOf(ctx).user;
    if (!user) throw refused("accounts_only");
    return requireAccounts(user, await deps.identity.staffRoles(user.id, from(ctx)));
  }
  /** Anonymous writes (the email links): a repeat refuses rather than returning a stored reply. */
  const anon = <I extends DescMessage, O extends DescMessage>(ctx: HandlerContext, input: I, output: O, req: MessageShape<I>, body: (tx: postgres.TransactionSql) => Promise<MessageShape<O>>) =>
    withWrite(ctx, sql, { input, output }, req, body, { storeReply: false });

  return {
    async listUniversities(req) {
      const domain = parse(z.string().trim().toLowerCase().max(253), req.domain);
      return { universities: await listUniversities(sql, domain || null) };
    },

    async requestUniversity(req, ctx) {
      const r = parse(z.object({ email: z.string().max(320), universityName: z.string().max(300), consent: z.boolean(), token: Token, ipHash: z.string().max(64) }), req);
      const personal = deps.identity.personalDomains(from(ctx));
      return anon(ctx, RequestUniversityRequestSchema, RequestUniversityResponseSchema, req, async (tx) => {
        const out = await requestUniversity(tx, { email: r.email, universityName: r.universityName || null, consent: r.consent, token: r.token, ipHash: r.ipHash || null }, personal);
        return create(RequestUniversityResponseSchema, { status: out.status, university: out.university ?? "" });
      });
    },
    async confirmUniversityRequest(req, ctx) {
      const token = parse(Token, req.token);
      return anon(ctx, ConfirmUniversityRequestRequestSchema, ConfirmUniversityRequestResponseSchema, req, async (tx) =>
        create(ConfirmUniversityRequestResponseSchema, { university: (await confirmUniversityRequest(tx, token)).university ?? "" }),
      );
    },
    async unsubscribeUniversityRequest(req, ctx) {
      const token = parse(Token, req.token);
      return anon(ctx, UnsubscribeUniversityRequestRequestSchema, UnsubscribeUniversityRequestResponseSchema, req, async (tx) =>
        create(UnsubscribeUniversityRequestResponseSchema, { unsubscribed: await unsubscribeUniversityRequest(tx, token) }),
      );
    },

    async opsUniversityRequests(_req, ctx) {
      await staff(ctx);
      const rows = await opsUniversityRequests(sql);
      return {
        groups: rows.map((g) => ({
          domain: g.domain,
          universityId: g.university_id ?? "",
          university: g.university ?? "",
          live: g.live,
          requests: g.requests,
          confirmed: g.confirmed,
          notified: g.notified,
          latest: iso(g.latest),
        })),
      };
    },
    async opsBatches(_req, ctx) {
      await staff(ctx);
      return {
        universities: (await opsBatches(sql)).map((u) => ({ universityId: u.university_id, name: u.name, finalYearBatch: u.final_year_batch ?? 0, students: u.students, graduates: u.graduates })),
      };
    },
    async opsSetUniversityLive(req, ctx) {
      const id = parse(Uuid, req.universityId);
      const reason = parse(Reason, req.reason);
      const me = await staff(ctx);
      return write(deps, ctx, OpsSetUniversityLiveRequestSchema, OpsSetUniversityLiveResponseSchema, req, async (tx) =>
        create(OpsSetUniversityLiveResponseSchema, { liveAt: iso(await opsSetUniversityLive(tx, me, { universityId: id, live: req.live, reason })) }),
      );
    },
    async opsOpenAllUniversities(req, ctx) {
      const reason = parse(Reason, req.reason);
      const me = await staff(ctx);
      return write(deps, ctx, OpsOpenAllUniversitiesRequestSchema, OpsOpenAllUniversitiesResponseSchema, req, async (tx) =>
        create(OpsOpenAllUniversitiesResponseSchema, { opened: await opsOpenAllUniversities(tx, me, reason) }),
      );
    },
    async opsAddUniDomain(req, ctx) {
      const r = parse(z.object({ universityId: Uuid, domain: z.string().max(253), kind: z.string().max(20), reason: Reason }), req);
      const me = await staff(ctx);
      const personal = deps.identity.personalDomains(from(ctx));
      return write(deps, ctx, OpsAddUniDomainRequestSchema, OpsAddUniDomainResponseSchema, req, async (tx) => {
        await opsAddUniDomain(tx, me, r, personal);
        return create(OpsAddUniDomainResponseSchema);
      });
    },
    async opsSetFinalYearBatch(req, ctx) {
      const id = parse(Uuid, req.universityId);
      const reason = parse(Reason, req.reason);
      const me = await staff(ctx);
      return write(deps, ctx, OpsSetFinalYearBatchRequestSchema, OpsSetFinalYearBatchResponseSchema, req, async (tx) => {
        await opsSetFinalYearBatch(tx, me, { universityId: id, batch: req.batch === 0 ? null : req.batch, reason });
        return create(OpsSetFinalYearBatchResponseSchema);
      });
    },

    // Market only (authorize.ts): market resolved the caller's seat to this university before calling.
    async saveDepartment(req, ctx) {
      const uni = parse(Uuid, req.universityId);
      const id = req.id === "" ? null : parse(Uuid, req.id);
      const name = parse(z.string().max(200), req.name);
      return write(deps, ctx, SaveDepartmentRequestSchema, SaveDepartmentResponseSchema, req, async (tx) => create(SaveDepartmentResponseSchema, { id: await saveDepartment(tx, uni, id, name) }));
    },
    async deleteDepartment(req, ctx) {
      const uni = parse(Uuid, req.universityId);
      const id = parse(Uuid, req.id);
      return write(deps, ctx, DeleteDepartmentRequestSchema, DeleteDepartmentResponseSchema, req, async (tx) => {
        await deleteDepartment(tx, uni, id);
        return create(DeleteDepartmentResponseSchema);
      });
    },
    async saveProgramme(req, ctx) {
      const uni = parse(Uuid, req.universityId);
      const dept = parse(Uuid, req.departmentId);
      const name = parse(z.string().max(200), req.name);
      return write(deps, ctx, SaveProgrammeRequestSchema, SaveProgrammeResponseSchema, req, async (tx) => create(SaveProgrammeResponseSchema, { id: await saveProgramme(tx, uni, dept, name) }));
    },
    async deleteProgramme(req, ctx) {
      const uni = parse(Uuid, req.universityId);
      const id = parse(Uuid, req.id);
      return write(deps, ctx, DeleteProgrammeRequestSchema, DeleteProgrammeResponseSchema, req, async (tx) => {
        await deleteProgramme(tx, uni, id);
        return create(DeleteProgrammeResponseSchema);
      });
    },
  };
}
