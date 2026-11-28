import { randomBytes } from "node:crypto";
import type { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import {
  ClaimRecordEntriesRequestSchema,
  ClaimRecordEntriesResponseSchema,
  ConfirmRecordEntryRequestSchema,
  ConfirmRecordEntryResponseSchema,
  CorrectRecordEntryRequestSchema,
  CorrectRecordEntryResponseSchema,
  CreateRecordShareLinkRequestSchema,
  CreateRecordShareLinkResponseSchema,
  DeclineRecordMistakeRequestSchema,
  DeclineRecordMistakeResponseSchema,
  OpenRecordShareRequestSchema,
  OpenRecordShareResponseSchema,
  RecordPdfExportRequestSchema,
  RecordPdfExportResponseSchema,
  ReportRecordMistakeRequestSchema,
  ReportRecordMistakeResponseSchema,
  RevokeRecordEntryRequestSchema,
  RevokeRecordEntryResponseSchema,
  RevokeRecordShareLinkRequestSchema,
  RevokeRecordShareLinkResponseSchema,
  SaveCvActivitiesRequestSchema,
  SaveCvActivitiesResponseSchema,
  SetRecordDisplayRequestSchema,
  SetRecordDisplayResponseSchema,
  type CredentialsService,
} from "@skilient/contracts/credentials/v1/credentials_pb";
import { z } from "zod";
import { emailHash } from "../domain/record";
import { refused } from "../refusals";
import { sha256Hex } from "../store/cv";
import * as Rec from "../store/record";
import { filled, id, json, me, meOf, onward, parse, recordStaff, restricted, Uuid, write, type ApiDeps } from "./util";
import type { Row } from "../store/db";

type Impl = ServiceImpl<typeof CredentialsService>;
const HASH = z.string().regex(/^[0-9a-f]{64}$/);
const Code = z.string().regex(/^[0-9A-Za-z]{10}$/);

export function recordApi(deps: ApiDeps): Pick<
  Impl,
  | "myRecord"
  | "setRecordDisplay"
  | "reportRecordMistake"
  | "createRecordShareLink"
  | "revokeRecordShareLink"
  | "openRecordShare"
  | "recordHighlights"
  | "recordWaiting"
  | "claimRecordEntries"
  | "saveCvActivities"
  | "cvActivityOptions"
  | "myEntries"
  | "recordPdfExport"
  | "verifyRecordEntry"
  | "verifyRecordTranscript"
  | "societyRecordPage"
  | "confirmRecordEntry"
  | "correctRecordEntry"
  | "declineRecordMistake"
  | "revokeRecordEntry"
  | "opsRecordEntry"
  | "noticeFacts"
> {
  /** The hash of the reader's confirmed address (identity's EmailsOf), or null. */
  const myHash = async (ctx: HandlerContext, user: string) => {
    const a = (await deps.ports.accounts([user], onward(ctx))).get(user);
    return a?.confirmed ? emailHash(a.email) : null;
  };
  return {
    async myRecord(_req, ctx) {
      const user = me(ctx);
      return { json: json(await filled(deps, ctx, await Rec.myRecord(deps.sql, user, await myHash(ctx, user)))) };
    },

    async setRecordDisplay(req, ctx) {
      const user = me(ctx);
      const entryId = id(req.entryId);
      return write(deps, ctx, SetRecordDisplayRequestSchema, SetRecordDisplayResponseSchema, req, async (tx) => {
        await Rec.setDisplay(tx, user, entryId, req.pinned, req.hidden);
        return {};
      });
    },

    async reportRecordMistake(req, ctx) {
      const user = me(ctx);
      restricted(ctx);
      const entryId = id(req.entryId);
      const note = parse(z.string().max(4000), req.note);
      return write(deps, ctx, ReportRecordMistakeRequestSchema, ReportRecordMistakeResponseSchema, req, async (tx) => ({
        correctionId: await Rec.reportMistake(tx, user, entryId, note),
      }));
    },

    async createRecordShareLink(req, ctx) {
      const user = me(ctx);
      restricted(ctx);
      const label = parse(z.string().max(200), req.label);
      const token = randomBytes(32).toString("base64url");
      return write(
        deps,
        ctx,
        CreateRecordShareLinkRequestSchema,
        CreateRecordShareLinkResponseSchema,
        req,
        async (tx) => ({ linkId: await Rec.createShareLink(tx, user, sha256Hex(token), label, req.days === 0 ? null : req.days), token }),
        { storeReply: false },
      );
    },

    async revokeRecordShareLink(req, ctx) {
      const user = me(ctx);
      const linkId = id(req.linkId);
      return write(deps, ctx, RevokeRecordShareLinkRequestSchema, RevokeRecordShareLinkResponseSchema, req, async (tx) => {
        await Rec.revokeShareLink(tx, user, linkId);
        return {};
      });
    },

    async openRecordShare(req, ctx) {
      const token = parse(z.string().min(1).max(200), req.token);
      const viewer = req.viewerKey === "" ? null : parse(HASH, req.viewerKey);
      return write(
        deps,
        ctx,
        OpenRecordShareRequestSchema,
        OpenRecordShareResponseSchema,
        req,
        async (tx) => {
          const r = await Rec.openShare(tx, sha256Hex(token), viewer);
          if (r.state !== "ok") return { json: json({ state: r.state }) };
          const p = (await deps.ports.profiles([r.user_id!], onward(ctx))).get(r.user_id!);
          const person = p ? { name: p.name, username: p.username, university: p.university, department: p.department } : null;
          return { json: json({ state: "ok", expires_at: r.expires_at, person, entries: r.entries }) };
        },
        { storeReply: false },
      );
    },

    async recordHighlights(req, ctx) {
      const reader = me(ctx);
      const user = id(req.userId);
      if ((await deps.ports.blocked(user, [reader], onward(ctx))).has(reader)) return { json: "[]" };
      return { json: json(await Rec.highlights(deps.sql, user)) };
    },

    async recordWaiting(_req, ctx) {
      const user = me(ctx);
      return { count: await Rec.waitingCount(deps.sql, user, await myHash(ctx, user)) };
    },

    async claimRecordEntries(req, ctx) {
      const user = me(ctx);
      const hash = await myHash(ctx, user);
      return write(deps, ctx, ClaimRecordEntriesRequestSchema, ClaimRecordEntriesResponseSchema, req, async (tx) => ({ claimed: await Rec.claim(tx, user, hash) }));
    },

    async saveCvActivities(req, ctx) {
      const user = me(ctx);
      const ids = parse(z.array(z.uuid()).max(100), req.entryIds);
      return write(deps, ctx, SaveCvActivitiesRequestSchema, SaveCvActivitiesResponseSchema, req, async (tx) => {
        await Rec.saveCvActivities(tx, user, ids);
        return {};
      });
    },

    async cvActivityOptions(_req, ctx) {
      return { json: json(await Rec.cvActivityOptions(deps.sql, me(ctx))) };
    },

    async myEntries(req, ctx) {
      const user = me(ctx);
      const rows = await Rec.myEntries(deps.sql, user, parse(z.array(z.uuid()).max(200), req.entryIds), parse(z.array(z.uuid()).max(200), req.sourceIds));
      return {
        entries: rows.map((r) => ({
          id: String(r["id"]),
          kind: String(r["kind"]),
          sourceId: String(r["source_id"]),
          title: String(r["title"]),
          issuerName: String(r["issuer_name"]),
          line: String(r["line"]),
          code: String(r["code"]),
          status: String(r["status"]),
        })),
      };
    },

    async recordPdfExport(req, ctx) {
      const user = me(ctx);
      const e = {
        exportId: id(req.exportId),
        kind: parse(z.enum(["certificate", "transcript"]), req.kind),
        entryId: req.entryId === "" ? null : id(req.entryId),
        codes: parse(z.array(Code).min(1).max(500), req.codes),
        pdfHash: parse(HASH, req.pdfHash),
        bytes: parse(z.number().int().min(1).max(20_000_000), req.bytes),
        mac: parse(z.string().max(128), req.mac),
      };
      const holder = (await deps.ports.profiles([user], onward(ctx))).get(user)?.name ?? "";
      return write(deps, ctx, RecordPdfExportRequestSchema, RecordPdfExportResponseSchema, req, async (tx) => {
        await Rec.recordPdfExport(tx, user, e, deps.exportSecret, holder);
        return {};
      });
    },

    async verifyRecordEntry(req) {
      const r = await Rec.verifyEntry(deps.sql, parse(z.string().max(40), req.code));
      return { json: r ? json(r) : "" };
    },

    async verifyRecordTranscript(req) {
      const r = await Rec.verifyTranscript(deps.sql, id(req.exportId));
      return { json: r ? json(r) : "" };
    },

    async societyRecordPage(req, ctx) {
      const user = me(ctx);
      return { json: json(await filled(deps, ctx, await Rec.societyRecordPage(deps.sql, user, id(req.societyId)))) };
    },

    async confirmRecordEntry(req, ctx) {
      const user = me(ctx);
      const entryId = id(req.entryId);
      return write(deps, ctx, ConfirmRecordEntryRequestSchema, ConfirmRecordEntryResponseSchema, req, async (tx) => {
        await Rec.confirmEntry(tx, user, entryId);
        return {};
      });
    },

    async correctRecordEntry(req, ctx) {
      const user = me(ctx);
      const entryId = id(req.entryId);
      const change = {
        title: parse(z.string().max(400), req.title),
        line: parse(z.string().max(400), req.line),
        ...(req.place !== undefined ? { place: req.place } : {}),
        ...(req.hours !== undefined ? { hours: parse(z.number().finite(), req.hours) } : {}),
      };
      const note = parse(z.string().max(1000), req.note);
      return write(deps, ctx, CorrectRecordEntryRequestSchema, CorrectRecordEntryResponseSchema, req, async (tx) => ({
        entryId: await Rec.correctEntry(tx, user, entryId, change, note || null),
      }));
    },

    async declineRecordMistake(req, ctx) {
      const user = me(ctx);
      const correctionId = id(req.correctionId);
      const note = parse(z.string().max(1000), req.note);
      return write(deps, ctx, DeclineRecordMistakeRequestSchema, DeclineRecordMistakeResponseSchema, req, async (tx) => {
        await Rec.declineMistake(tx, user, correctionId, note);
        return {};
      });
    },

    async revokeRecordEntry(req, ctx) {
      const user = me(ctx);
      const entryId = id(req.entryId);
      const reason = parse(z.string().max(2000), req.reason);
      const staff = await recordStaff(deps, ctx);
      return write(deps, ctx, RevokeRecordEntryRequestSchema, RevokeRecordEntryResponseSchema, req, async (tx) => {
        await Rec.revokeEntry(tx, user, staff, entryId, req.category || null, reason);
        return {};
      });
    },

    async opsRecordEntry(req, ctx) {
      if (!meOf(ctx) || !(await recordStaff(deps, ctx))) throw refused("staff_only");
      const r = await Rec.opsRecordEntry(deps.sql, parse(z.string().max(40), req.code));
      return { json: r ? json(await filled(deps, ctx, r)) : "" };
    },

    // notify's Record and CV notices (W9): what record_sign_commit, revoke_record_entry, decline_record_mistake and
    // ops_revoke_cv snapshotted. One trip.
    async noticeFacts(req) {
      const q = parse(z.object({ entryIds: z.array(Uuid).max(200), correctionIds: z.array(Uuid).max(200), recordIds: z.array(Uuid).max(200) }), req);
      const [r] = await deps.sql<{ entries: Row[]; corrections: Row[]; records: Row[] }[]>`
        select
          coalesce((select json_agg(json_build_object('id', e.id, 'kind', e.kind, 'title', e.title, 'issuer', e.issuer_name, 'code', coalesce(e.code, ''),
                                                      'date', to_char(e.occurred_on, 'FMDD Mon YYYY'), 'corrected', e.supersedes is not null,
                                                      'revoke_reason', coalesce(btrim(e.revoked_reason), ''), 'issuer_id', coalesce(e.issuer_id::text, '')))
                      from credentials.record_entries e where e.id = any(${q.entryIds}::uuid[])), '[]') as entries,
          coalesce((select json_agg(json_build_object('id', c.id, 'note', coalesce(c.decision_note, '')))
                      from credentials.record_corrections c where c.id = any(${q.correctionIds}::uuid[])), '[]') as corrections,
          coalesce((select json_agg(json_build_object('id', v.id, 'code', v.code, 'version', v.version))
                      from credentials.cv_records v where v.id = any(${q.recordIds}::uuid[])), '[]') as records`;
      const s = (v: unknown) => String(v ?? "");
      return {
        entries: r!.entries.map((e) => ({
          id: s(e["id"]),
          kind: s(e["kind"]),
          title: s(e["title"]),
          issuer: s(e["issuer"]),
          code: s(e["code"]),
          date: s(e["date"]),
          corrected: e["corrected"] === true,
          revokeReason: s(e["revoke_reason"]),
          issuerId: s(e["issuer_id"]),
        })),
        corrections: r!.corrections.map((c) => ({ id: s(c["id"]), note: s(c["note"]) })),
        records: r!.records.map((c) => ({ id: s(c["id"]), code: s(c["code"]), version: Number(c["version"]) })),
      };
    },
  };
}
