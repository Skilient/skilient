import type postgres from "postgres";
import { afterAll, beforeAll, describe, it } from "vitest";
import type { TestDatabase } from "@skilient/testing/postgres";
import * as Rec from "../../src/store/record";
import { issueEntry } from "../../src/store/issuing";
import * as R from "../../src/domain/record";
import { call, F, fill, issueAndSeal, job, ok, replay, sealPending, startWorld, step, type Tx } from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

const idOf = async (tx: Tx, where: string, params: unknown[]) =>
  ((await tx.unsafe(`select id::text from credentials.record_entries where ${where} limit 1`, params as never[]))[0] as unknown as { id: string } | undefined)?.id ?? null;
const page = (tx: Tx, user: string) => call(tx, async (sp) => fill(await Rec.societyRecordPage(sp, user, F.SOC)));

describe("credentials goldens replayed: officers", () => {
  const G = "officers";

  it("confirm", () =>
    replay(sql, G, "confirm", async (tx) => {
      const out: Record<string, unknown> = {};
      await issueAndSeal(tx);
      const osman = (await idOf(tx, `user_id = $1 and status = 'awaiting' and kind = 'attended'`, [F.OSMAN]))!;
      out["page"] = await page(tx, F.PRIYA);
      out["page_member"] = await page(tx, F.MEHR);
      out["self"] = await call(tx, (sp) => Rec.confirmEntry(sp, F.OSMAN, osman));
      out["member"] = await call(tx, (sp) => Rec.confirmEntry(sp, F.MEHR, osman));
      out["confirm"] = await step(tx, (sp) => Rec.confirmEntry(sp, F.PRIYA, osman));
      out["again"] = await call(tx, (sp) => Rec.confirmEntry(sp, F.PRIYA, osman));
      out["sealed"] = await job(tx, (sp) => sealPending(sp));
      return out;
    }));

  it("correct", () =>
    replay(sql, G, "correct", async (tx) => {
      const out: Record<string, unknown> = {};
      await issueAndSeal(tx);
      const sami = (await idOf(tx, `user_id = $1 and kind = 'result'`, [F.SAMI]))!;
      const osman = (await idOf(tx, `user_id = $1 and status = 'awaiting'`, [F.OSMAN]))!;
      out["not_sealed"] = await call(tx, (sp) => Rec.correctEntry(sp, F.PRIYA, osman, { title: "Night sky workshop II" }, null));
      out["nothing"] = await call(tx, (sp) => Rec.correctEntry(sp, F.PRIYA, sami, {}, null));
      out["bad_place"] = await call(tx, (sp) => Rec.correctEntry(sp, F.PRIYA, sami, { place: 0 }, null));
      out["member"] = await call(tx, (sp) => Rec.correctEntry(sp, F.MEHR, sami, { place: 2 }, null));
      out["correct"] = await step(tx, (sp) => Rec.correctEntry(sp, F.PRIYA, sami, { place: 2 }, " Typo in the place "));
      out["waiting"] = await call(tx, (sp) => Rec.correctEntry(sp, F.PRIYA, sami, { place: 3 }, null));
      out["sealed"] = await job(tx, (sp) => sealPending(sp));
      const mehr = (await idOf(tx, `user_id = $1 and kind = 'volunteer'`, [F.MEHR]))!;
      out["hours"] = await step(tx, (sp) => Rec.correctEntry(sp, F.OSMAN, mehr, { hours: 2.25, title: "Night sky workshop (setup)" }, null));
      return out;
    }));

  it("mistakes", () =>
    replay(sql, G, "mistakes", async (tx) => {
      const out: Record<string, unknown> = {};
      await issueAndSeal(tx);
      const sami = (await idOf(tx, `user_id = $1 and kind = 'attended'`, [F.SAMI]))!;
      out["short"] = await call(tx, (sp) => Rec.reportMistake(sp, F.SAMI, sami, "wrong"));
      out["other"] = await call(tx, (sp) => Rec.reportMistake(sp, F.MEHR, sami, "This is not my entry at all."));
      out["report"] = await step(tx, (sp) => Rec.reportMistake(sp, F.SAMI, sami, " I came to both sessions, not one. "));
      out["again"] = await call(tx, (sp) => Rec.reportMistake(sp, F.SAMI, sami, "I came to both sessions, not one."));
      out["page"] = await page(tx, F.OSMAN);
      const c = ((await tx`select id::text from credentials.record_corrections where user_id = ${F.SAMI}`)[0] as unknown as { id: string }).id;
      out["decline_short"] = await call(tx, (sp) => Rec.declineMistake(sp, F.OSMAN, c, "no"));
      out["decline_member"] = await call(tx, (sp) => Rec.declineMistake(sp, F.MEHR, c, "The scanner shows one."));
      out["decline"] = await step(tx, (sp) => Rec.declineMistake(sp, F.OSMAN, c, " The scanner shows one session. "));
      out["decline_again"] = await call(tx, (sp) => Rec.declineMistake(sp, F.OSMAN, c, "The scanner shows one session."));
      const [d] = await tx<{ today: string }[]>`select current_date::text as today`;
      await issueEntry(tx, {
        userId: F.SAMI,
        draft: { kind: "proof_task", title: F.TASK_TITLE, evidence: { line: "Android · verified by GitHub" }, occurredOn: d!.today },
        issuerType: "skilient",
        issuerId: null,
        issuerName: "Skilient",
        source: "task",
        sourceId: F.ATTEMPT,
        issuedBy: null,
      });
      await sealPending(tx);
      const skilient = (await idOf(tx, `user_id = $1 and kind = 'proof_task'`, [F.SAMI]))!;
      out["skilient"] = await call(tx, (sp) => Rec.reportMistake(sp, F.SAMI, skilient, "The skill should be Kotlin instead."));
      return out;
    }));

  it("revoke", () =>
    replay(sql, G, "revoke", async (tx) => {
      const out: Record<string, unknown> = {};
      await issueAndSeal(tx);
      const sami = (await idOf(tx, `user_id = $1 and kind = 'completed'`, [F.SAMI]))!;
      ok(await call(tx, (sp) => Rec.setDisplay(sp, F.SAMI, sami, true, false)));
      ok(await call(tx, (sp) => Rec.saveCvActivities(sp, F.SAMI, [sami])));
      out["no_category"] = await call(tx, (sp) => Rec.revokeEntry(sp, F.OSMAN, false, sami, null, "Checked in twice by mistake"));
      out["no_reason"] = await call(tx, (sp) => Rec.revokeEntry(sp, F.OSMAN, false, sami, "issued_in_error", " "));
      out["member"] = await call(tx, (sp) => Rec.revokeEntry(sp, F.MEHR, false, sami, "issued_in_error", "Checked in twice by mistake"));
      out["revoke"] = await step(tx, (sp) => Rec.revokeEntry(sp, F.OSMAN, false, sami, "issued_in_error", " Checked in twice by mistake "));
      out["again"] = await call(tx, (sp) => Rec.revokeEntry(sp, F.OSMAN, false, sami, "other", "Again"));
      const held = (await idOf(tx, `status = 'held'`, []))!;
      out["held"] = await call(tx, (sp) => Rec.revokeEntry(sp, F.OSMAN, false, held, "other", "Not here"));
      out["record"] = await call(tx, async (sp) => fill(await Rec.myRecord(sp, F.SAMI, R.emailHash(F.EMAIL[F.SAMI]!))));
      return out;
    }));
});
