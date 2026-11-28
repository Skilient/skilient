import type postgres from "postgres";
import { afterAll, beforeAll, describe, it } from "vitest";
import type { TestDatabase } from "@skilient/testing/postgres";
import { exportMac } from "../../src/store/cv";
import { requireUser } from "../../src/store/db";
import { issueEntry } from "../../src/store/issuing";
import * as Rec from "../../src/store/record";
import { applyIssuingEvent } from "../../src/store/consumers";
import { call, exportSecret, F, facts, fill, issueAndSeal, job, myHash, ok, replay, sealPending, signUp, startWorld, step, type Tx } from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

/** A signed-out reader: the handler's not_signed_in (me(ctx)), the stack's grant refusal. */
const signedOut = (tx: Tx, fn: string) => call(tx, () => requireUser(null), fn);
const task = (tx: Tx, line: string) =>
  tx<{ d: string }[]>`select current_date::text as d`.then(([d]) =>
    issueEntry(tx, {
      userId: F.SAMI,
      draft: { kind: "proof_task", title: F.TASK_TITLE, evidence: { line }, occurredOn: d!.d },
      issuerType: "skilient",
      issuerId: null,
      issuerName: "Skilient",
      source: "task",
      sourceId: F.ATTEMPT,
      issuedBy: null,
    }),
  );

describe("credentials goldens replayed: the Record", () => {
  it("student", () =>
    replay(sql, "record", "student", async (tx) => {
      const out: Record<string, unknown> = {};
      const mine = (u: string) => call(tx, async (sp) => fill(await Rec.myRecord(sp, u, myHash(u))));
      out["empty"] = await mine(F.NIDA);
      out["signed_out"] = await signedOut(tx, "my_record");
      await issueAndSeal(tx);
      await tx`
        update credentials.record_entries e set issued_at = now() - make_interval(mins => r.n::int)
          from (select id, row_number() over (order by kind) as n from credentials.record_entries where user_id = ${F.SAMI}) r where r.id = e.id`;
      out["record"] = await mine(F.SAMI);
      const ids = (await tx<{ id: string }[]>`select id::text from credentials.record_entries where user_id = ${F.SAMI} order by kind`).map((r) => r.id);
      const [attended, completed, result] = ids;
      out["pin"] = await step(tx, (sp) => Rec.setDisplay(sp, F.SAMI, attended!, true, false));
      out["pin_hidden"] = await call(tx, (sp) => Rec.setDisplay(sp, F.SAMI, completed!, true, true));
      ok(await call(tx, (sp) => Rec.setDisplay(sp, F.SAMI, completed!, true, false)));
      ok(await call(tx, (sp) => Rec.setDisplay(sp, F.SAMI, result!, true, false)));
      const extra = (await task(tx, "Android · verified by GitHub"))!;
      out["pin_pending"] = await call(tx, (sp) => Rec.setDisplay(sp, F.SAMI, extra, true, false));
      await sealPending(tx);
      out["fourth_pin"] = await call(tx, (sp) => Rec.setDisplay(sp, F.SAMI, extra, true, false));
      out["hide"] = await step(tx, (sp) => Rec.setDisplay(sp, F.SAMI, result!, false, true));
      out["other"] = await call(tx, (sp) => Rec.setDisplay(sp, F.MEHR, attended!, false, true));
      await tx`update credentials.record_entries set pinned_at = now() - make_interval(mins => (case kind when 'attended' then 2 else 1 end)) where user_id = ${F.SAMI} and pinned_at is not null`;
      out["highlights"] = await call(tx, (sp) => Rec.highlights(sp, F.SAMI));
      out["highlights_signed_out"] = await signedOut(tx, "record_highlights");
      return out;
    }));

  it("pdf", () =>
    replay(sql, "record", "pdf", async (tx) => {
      const out: Record<string, unknown> = {};
      await issueAndSeal(tx);
      const e = await tx<{ id: string; code: string }[]>`select id::text, code from credentials.record_entries where user_id = ${F.SAMI} and status = 'sealed' order by kind`;
      const codes = e.map((x) => x.code);
      const exp = (user: string, id: string, kind: string, entry: string | null, c: string[], bytes: number, mac?: string) =>
        Rec.recordPdfExport(
          tx,
          user,
          { exportId: id, kind, entryId: entry, codes: c, pdfHash: F.PDF_HASH, bytes, mac: mac ?? exportMac(exportSecret, [id, kind, entry ?? "", c.join(","), F.PDF_HASH, bytes]) },
          exportSecret,
          F.NAME[user]!,
        );
      out["bad_mac"] = await call(tx, () => exp(F.SAMI, F.EXPORT_CERT, "certificate", e[0]!.id, [codes[0]!], 2048, "0".repeat(64)));
      out["not_mine"] = await call(tx, () => exp(F.MEHR, F.EXPORT_CERT, "certificate", e[0]!.id, [codes[0]!], 2048));
      out["two_codes"] = await call(tx, () => exp(F.SAMI, F.EXPORT_CERT, "certificate", e[0]!.id, codes.slice(0, 2), 2048));
      out["certificate"] = await step(tx, (sp) =>
        Rec.recordPdfExport(
          sp,
          F.SAMI,
          {
            exportId: F.EXPORT_CERT,
            kind: "certificate",
            entryId: e[0]!.id,
            codes: [codes[0]!],
            pdfHash: F.PDF_HASH,
            bytes: 2048,
            mac: exportMac(exportSecret, [F.EXPORT_CERT, "certificate", e[0]!.id, codes[0]!, F.PDF_HASH, 2048]),
          },
          exportSecret,
          F.NAME[F.SAMI]!,
        ),
      );
      out["transcript"] = await step(tx, (sp) =>
        Rec.recordPdfExport(
          sp,
          F.SAMI,
          { exportId: F.EXPORT_TRANSCRIPT, kind: "transcript", entryId: null, codes, pdfHash: F.PDF_HASH, bytes: 4096, mac: exportMac(exportSecret, [F.EXPORT_TRANSCRIPT, "transcript", "", codes.join(","), F.PDF_HASH, 4096]) },
          exportSecret,
          F.NAME[F.SAMI]!,
        ),
      );
      ok(await call(tx, (sp) => Rec.revokeEntry(sp, F.OSMAN, false, e[0]!.id, "not_earned", "Left after ten minutes")));
      out["verify"] = await call(tx, (sp) => Rec.verifyTranscript(sp, F.EXPORT_TRANSCRIPT));
      out["verify_unknown"] = await call(tx, (sp) => Rec.verifyTranscript(sp, F.EXPORT_CV));
      return out;
    }));
});

describe("credentials goldens replayed: claims", () => {
  it("claim", () =>
    replay(sql, "claims", "claim", async (tx) => {
      const out: Record<string, unknown> = {};
      await issueAndSeal(tx);
      out["waiting_other"] = await call(tx, (sp) => Rec.waitingCount(sp, F.SAMI, myHash(F.SAMI)));
      out["signup"] = await job(tx, async (sp) => {
        signUp(F.ZARA);
        await applyIssuingEvent(sp, { type: "user.created", producer: "svc_identity", version: 1, payload: { user_id: F.ZARA }, subjects: [F.ZARA] }, facts());
        return null;
      });
      out["waiting"] = await call(tx, (sp) => Rec.waitingCount(sp, F.ZARA, myHash(F.ZARA)));
      out["claim"] = await step(tx, (sp) => Rec.claim(sp, F.ZARA, myHash(F.ZARA)));
      out["again"] = await call(tx, (sp) => Rec.claim(sp, F.ZARA, myHash(F.ZARA)));
      out["waiting_after"] = await call(tx, (sp) => Rec.waitingCount(sp, F.ZARA, myHash(F.ZARA)));
      out["sealed"] = await job(tx, (sp) => sealPending(sp));
      return out;
    }));

  it("expire", () =>
    replay(sql, "claims", "expire", async (tx) => {
      const out: Record<string, unknown> = {};
      await issueAndSeal(tx);
      out["early"] = await job(tx, async (sp) => ({ n: await Rec.claimsExpire(sp) }));
      await tx`update credentials.record_claims set expires_at = now() - interval '1 minute' where event_id = ${F.EVENT}`;
      out["expired"] = await job(tx, async (sp) => ({ n: await Rec.claimsExpire(sp) }));
      return out;
    }));
});
