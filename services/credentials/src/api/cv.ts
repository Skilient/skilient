import { randomBytes } from "node:crypto";
import { enqueue, uuidv7 } from "@skilient/platform";
import {
  CreateCvShareLinkRequestSchema,
  CreateCvShareLinkResponseSchema,
  IssueCvRequestSchema,
  IssueCvResponseSchema,
  OpenSharedCvRequestSchema,
  OpenSharedCvResponseSchema,
  OpsRevokeCvRequestSchema,
  OpsRevokeCvResponseSchema,
  RecordCvExportRequestSchema,
  RecordCvExportResponseSchema,
  RequestPdfRequestSchema,
  RequestPdfResponseSchema,
  RevokeCvRequestSchema,
  RevokeCvResponseSchema,
  RevokeCvShareLinkRequestSchema,
  RevokeCvShareLinkResponseSchema,
  SaveCvSettingsRequestSchema,
  SaveCvSettingsResponseSchema,
  type CredentialsService,
} from "@skilient/contracts/credentials/v1/credentials_pb";
import type { ServiceImpl } from "@connectrpc/connect";
import { z } from "zod";
import { PAPERS, TEMPLATES } from "../domain/cv";
import { eligibleSet, snapshotInputs } from "../inputs";
import { refused } from "../refusals";
import * as Cv from "../store/cv";
import { entitled } from "../store/db";
import { issueCv, newestCode } from "../store/issue";
import { id, json, me, meOf, onward, opt, parse, restricted, trust, write, type ApiDeps } from "./util";

/** The tiers from Spark up (ranking_tier's order: raw, spark, flare, shine, radiant, luminary). */
const SPARK_UP = new Set(["spark", "flare", "shine", "radiant", "luminary"]);
const HASH = z.string().regex(/^[0-9a-f]{64}$/);

type Impl = ServiceImpl<typeof CredentialsService>;

export function cvApi(deps: ApiDeps): Pick<
  Impl,
  | "myCv"
  | "cvExportRights"
  | "saveCvSettings"
  | "issueCv"
  | "revokeCv"
  | "createCvShareLink"
  | "revokeCvShareLink"
  | "openSharedCv"
  | "verifyCv"
  | "recordCvExport"
  | "publicKeys"
  | "requestPdf"
  | "pdfStatus"
  | "opsCvRecords"
  | "opsRevokeCv"
> {
  const eligibleNow = async (ctx: Parameters<Impl["myCv"]>[1], userId: string) => (await eligibleSet(deps.ports, [userId], onward(ctx))).has(userId);
  return {
    async myCv(_req, ctx) {
      const user = me(ctx);
      const [doc, tiers, profiles, rights] = await Promise.all([
        Cv.myCv(deps.sql, user),
        deps.ports.tiers([user], onward(ctx)),
        deps.ports.profiles([user], onward(ctx)),
        Cv.exportRights(deps.sql, user),
      ]);
      const p = profiles.get(user);
      return { json: json({ ...doc, tier: tiers.get(user)?.tier ?? null, username: p?.username ?? null, leaderboard_opt_out: p?.leaderboardOptOut ?? false, rights }) };
    },

    async cvExportRights(_req, ctx) {
      const r = await Cv.exportRights(deps.sql, meOf(ctx));
      return { pdfExport: r.pdf_export, templates: r.templates, refreshOnDemand: r.refresh_on_demand };
    },

    async saveCvSettings(req, ctx) {
      const user = me(ctx);
      const ok = await eligibleNow(ctx, user);
      return write(deps, ctx, SaveCvSettingsRequestSchema, SaveCvSettingsResponseSchema, req, async (tx) => {
        await Cv.saveSettings(tx, user, ok, {
          sections: parse(z.array(z.string().max(40)).max(20), req.sections),
          showPercentile: req.showPercentile ?? null,
          showEmail: req.showEmail,
          visibility: opt(req.visibility),
        });
        return {};
      });
    },

    async issueCv(req, ctx) {
      const user = me(ctx);
      const source = ({ ensure: "first", reissue: "reissue", refresh: "on_demand" } as const)[req.action as "ensure"];
      if (!source) throw refused("invalid_input");
      const inputs = await snapshotInputs(deps.ports, user, onward(ctx));
      return write(deps, ctx, IssueCvRequestSchema, IssueCvResponseSchema, req, async (tx) => {
        const r = await issueCv(tx, user, source, inputs, deps.key);
        if (r.status === "not_eligible") throw refused("not_eligible");
        if (r.status === "nothing_to_reissue") throw refused("nothing_to_reissue");
        return { status: r.status, code: (await newestCode(tx, user)) ?? "" };
      });
    },

    async revokeCv(req, ctx) {
      const user = me(ctx);
      const recordId = id(req.recordId);
      return write(deps, ctx, RevokeCvRequestSchema, RevokeCvResponseSchema, req, async (tx) => {
        await Cv.revokeCv(tx, user, recordId);
        return {};
      });
    },

    async createCvShareLink(req, ctx) {
      const user = me(ctx);
      restricted(ctx);
      const label = parse(z.string().max(200), req.label);
      const days = req.days === 0 ? null : req.days;
      const [ok, tiers] = await Promise.all([eligibleNow(ctx, user), deps.ports.tiers([user], onward(ctx))]);
      const spark = SPARK_UP.has(tiers.get(user)?.tier ?? "");
      const token = randomBytes(32).toString("base64url");
      // The token is shown once and never stored, so the reply is not kept for retries.
      return write(
        deps,
        ctx,
        CreateCvShareLinkRequestSchema,
        CreateCvShareLinkResponseSchema,
        req,
        async (tx) => ({ linkId: await Cv.createShareLink(tx, user, ok, spark, Cv.sha256Hex(token), label, days), token }),
        { storeReply: false },
      );
    },

    async revokeCvShareLink(req, ctx) {
      const user = me(ctx);
      const linkId = id(req.linkId);
      return write(deps, ctx, RevokeCvShareLinkRequestSchema, RevokeCvShareLinkResponseSchema, req, async (tx) => {
        await Cv.revokeShareLink(tx, user, linkId);
        return {};
      });
    },

    async openSharedCv(req, ctx) {
      const token = parse(z.string().min(1).max(200), req.token);
      const viewer = req.viewerKey === "" ? null : parse(HASH, req.viewerKey);
      const owner = async (userId: string) => {
        const [ok, profiles] = await Promise.all([eligibleSet(deps.ports, [userId], onward(ctx)), deps.ports.profiles([userId], onward(ctx))]);
        return { eligible: ok.has(userId), username: profiles.get(userId)?.username ?? null };
      };
      // The reply holds the CV's content: not kept for retries.
      return write(
        deps,
        ctx,
        OpenSharedCvRequestSchema,
        OpenSharedCvResponseSchema,
        req,
        async (tx) => {
          const [r] = await Cv.openShared(tx, Cv.sha256Hex(token), viewer, owner);
          const s = (k: string) => (r![k] === null || r![k] === undefined ? "" : String(r![k]));
          return {
            state: s("state"),
            username: s("username"),
            code: s("code"),
            issuedAt: s("issued_at"),
            expiresAt: s("expires_at"),
            keyId: s("key_id"),
            snapshotJson: r!["snapshot"] ? json(r!["snapshot"]) : "",
            snapshotHash: s("snapshot_hash"),
            signature: s("signature"),
          };
        },
        { storeReply: false },
      );
    },

    async verifyCv(req) {
      const code = parse(z.string().max(40), req.code);
      const hash = req.pdfHash === "" ? null : parse(z.string().regex(/^[0-9a-fA-F]{64}$/), req.pdfHash);
      const [r] = await Cv.verifyCv(deps.sql, code, hash);
      if (!r) return { found: false };
      const s = (k: string) => (r[k] === null || r[k] === undefined ? "" : String(r[k]));
      return {
        found: true,
        code: s("code"),
        issuedAt: s("issued_at"),
        expiresAt: s("expires_at"),
        revokedAt: s("revoked_at"),
        supersededAt: s("superseded_at"),
        keyId: s("key_id"),
        publicKey: s("public_key"),
        snapshotJson: r["snapshot"] ? json(r["snapshot"]) : "",
        snapshotHash: s("snapshot_hash"),
        signature: s("signature"),
        pdfChecked: Boolean(r["pdf_checked"]),
        ...(r["pdf_matches"] === null || r["pdf_matches"] === undefined ? {} : { pdfMatches: Boolean(r["pdf_matches"]) }),
      };
    },

    async recordCvExport(req, ctx) {
      const user = me(ctx);
      const e = {
        exportId: id(req.exportId),
        recordId: id(req.recordId),
        template: parse(z.enum(TEMPLATES), req.template),
        paper: parse(z.enum(PAPERS), req.paper),
        pdfHash: parse(HASH, req.pdfHash),
        bytes: parse(z.number().int().min(1).max(2_097_152), req.bytes),
        mac: parse(z.string().max(128), req.mac),
      };
      return write(deps, ctx, RecordCvExportRequestSchema, RecordCvExportResponseSchema, req, async (tx) => {
        await Cv.recordCvExport(tx, user, e, deps.exportSecret, (p) => deps.files.size(p));
        return {};
      });
    },

    async publicKeys() {
      return { document: await Cv.publicKeys(deps.sql) };
    },

    async requestPdf(req, ctx) {
      const user = me(ctx);
      const kind = parse(z.enum(["cv", "certificate", "transcript"]), req.kind);
      const template = req.template === "" ? "standard" : parse(z.enum(TEMPLATES), req.template);
      const paper = req.paper === "" ? "a4" : parse(z.enum(PAPERS), req.paper);
      const recordId = kind === "cv" ? id(req.recordId) : null;
      const entryId = kind === "certificate" ? id(req.entryId) : null;
      return write(deps, ctx, RequestPdfRequestSchema, RequestPdfResponseSchema, req, async (tx) => {
        if (kind === "cv") {
          if (!(await entitled(tx, user, "cv.pdf_export"))) throw refused("pdf_pro");
          if (template !== "standard" && !(await entitled(tx, user, "cv.templates"))) throw refused("template_pro");
          const [rec] = await tx`select 1 from credentials.cv_records where id = ${recordId} and user_id = ${user} and revoked_at is null`;
          if (!rec) throw refused("cv_not_found");
        } else if (kind === "certificate") {
          const [e] = await tx`select 1 from credentials.record_entries where id = ${entryId} and user_id = ${user} and status = 'sealed'`;
          if (!e) throw refused("entry_not_found");
        }
        const renderId = uuidv7();
        await tx`
          insert into credentials.pdf_renders (id, user_id, kind, record_id, entry_id, template, paper)
          values (${renderId}, ${user}, ${kind}, ${recordId}, ${entryId}, ${template}, ${paper})`;
        await enqueue(tx, { kind: "render", payload: { render_id: renderId }, dedupeKey: `render:${renderId}`, maxAttempts: 3 });
        return { jobId: renderId };
      });
    },

    async pdfStatus(req, ctx) {
      const user = me(ctx);
      const [r] = await deps.sql<{ status: string; path: string | null; pdf_hash: string | null }[]>`
        select status, path, pdf_hash from credentials.pdf_renders where id = ${id(req.jobId)} and user_id = ${user}`;
      if (!r) throw refused("pdf_not_found");
      return { status: r.status, path: r.path ?? "", pdfHash: r.pdf_hash ?? "" };
    },

    async opsCvRecords(req, ctx) {
      await trust(deps, ctx);
      const query = parse(z.string().max(200), req.query);
      const username = query.trim().toLowerCase().replace(/^@/, "");
      const byName = username.length >= 3 ? ((await deps.ports.resolveUsernames([username], onward(ctx))).get(username) ?? null) : null;
      const rows = await Cv.opsCvRecords(deps.sql, query, byName);
      return { json: json(await deps.ports.fill(rows, onward(ctx))) };
    },

    async opsRevokeCv(req, ctx) {
      const staff = await trust(deps, ctx);
      const recordId = id(req.recordId);
      const reason = parse(z.string().max(4000), req.reason);
      return write(deps, ctx, OpsRevokeCvRequestSchema, OpsRevokeCvResponseSchema, req, async (tx) => ({ revoked: await Cv.opsRevokeCv(tx, staff, recordId, req.all, reason) }));
    },
  };
}
