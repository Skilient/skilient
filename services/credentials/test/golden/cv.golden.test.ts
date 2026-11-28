import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TestDatabase } from "@skilient/testing/postgres";
import * as Cv from "../../src/store/cv";
import { requireUser } from "../../src/store/db";
import { issueCv, refreshStart, type IssueSource } from "../../src/store/issue";
import * as Rec from "../../src/store/record";
import { activities } from "../../src/store/snapshot";
import { call, copy, eligibleNow, exportSecret, F, grant, inputsFor, issueAndSeal, job, key, ok, replay, startWorld, step, world, type Tx } from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

/** The recorder's issueCv: refusals as {status: refused, code, message}; the snapshot it prepared. */
async function issue(tx: Tx, user: string, source: IssueSource) {
  const r = await call(tx, (sp) => issueCv(sp, user, source, inputsFor(user), key));
  if (!r.ok) return { status: "refused", code: r.code, message: r.message };
  const v = r.value as Record<string, unknown>;
  if (v["status"] === "issued") return { status: "issued", snapshot: v["snapshot"], code: v["code"] };
  if (v["status"] === "exists" || v["status"] === "unchanged") return { status: v["status"], snapshot: v["snapshot"], ...(v["status"] === "exists" || source !== "monthly" ? { code: null } : {}) };
  return { status: v["status"] };
}
const settings = (tx: Tx, user: string, sections: string[], pct: boolean | null, email: boolean | null, vis: string) =>
  (sp: Tx) => Cv.saveSettings(sp, user, eligibleNow(user), { sections, showPercentile: pct, showEmail: email, visibility: vis });
const snap = (tx: Tx, user: string) => call(tx, async (sp) => (await import("../../src/store/snapshot")).snapshot(sp, user, inputsFor(user)));

describe("credentials goldens replayed: CVs", () => {
  const G = "cv";

  it("settings", () =>
    replay(sql, G, "settings", async (tx) => {
      const out: Record<string, unknown> = {};
      out["save"] = await step(tx, settings(tx, F.SAMI, ["summary", "skills", "education"], false, true, "private"));
      out["empty"] = await call(tx, settings(tx, F.SAMI, [], null, false, "link"));
      out["twice"] = await call(tx, settings(tx, F.SAMI, ["summary", "summary"], null, false, "link"));
      out["unknown"] = await call(tx, settings(tx, F.SAMI, ["summary", "hobbies"], null, false, "link"));
      out["update"] = await step(tx, settings(tx, F.SAMI, ["projects", "summary", "activities"], null, null, "recruiters"));
      world.profiles.get(F.NIDA)!.onboardingComplete = false;
      out["not_eligible"] = await call(tx, settings(tx, F.NIDA, ["summary"], null, false, "link"));
      out["signed_out"] = await call(tx, () => requireUser(null), "save_cv_settings");
      return out;
    }));

  it("issue", () =>
    replay(sql, G, "issue", async (tx) => {
      const out: Record<string, unknown> = {};
      out["snapshot_nida"] = await snap(tx, F.NIDA);
      out["first"] = await job(tx, (sp) => issue(sp, F.SAMI, "first"));
      out["first_again"] = await job(tx, (sp) => issue(sp, F.SAMI, "first"));
      out["monthly_unchanged"] = await job(tx, (sp) => issue(sp, F.SAMI, "monthly"));
      ok(await call(tx, settings(tx, F.SAMI, ["summary", "skills", "education"], true, true, "link")));
      out["monthly_changed"] = await job(tx, (sp) => issue(sp, F.SAMI, "monthly"));
      out["on_demand_free"] = await job(tx, (sp) => issue(sp, F.SAMI, "on_demand"));
      await grant(tx, F.SAMI, "cv.refresh_on_demand");
      out["on_demand_pro"] = await job(tx, (sp) => issue(sp, F.SAMI, "on_demand"));
      world.profiles.get(F.NIDA)!.onboardingComplete = false;
      out["not_eligible"] = await job(tx, (sp) => issue(sp, F.NIDA, "first"));
      world.profiles.get(F.SAMI)!.leaderboardOptOut = true;
      ok(await call(tx, settings(tx, F.SAMI, ["summary", "skills", "education"], null, false, "link")));
      out["snapshot_opted_out"] = await snap(tx, F.SAMI);
      return out;
    }));

  it("reissue", () =>
    replay(sql, G, "reissue", async (tx) => {
      const out: Record<string, unknown> = {};
      expect((await issue(tx, F.SAMI, "first")).status).toBe("issued");
      out["reissue_live"] = await job(tx, (sp) => issue(sp, F.SAMI, "reissue"));
      const rec = ((await tx`select id::text from credentials.cv_records where user_id = ${F.SAMI}`)[0] as unknown as { id: string }).id;
      out["revoke_other"] = await call(tx, (sp) => Cv.revokeCv(sp, F.MEHR, rec));
      out["revoke"] = await step(tx, (sp) => Cv.revokeCv(sp, F.SAMI, rec));
      out["revoke_again"] = await call(tx, (sp) => Cv.revokeCv(sp, F.SAMI, rec));
      out["reissue"] = await job(tx, (sp) => issue(sp, F.SAMI, "reissue"));
      return out;
    }));

  it("refresh", () =>
    replay(sql, G, "refresh", async (tx) => {
      expect((await issue(tx, F.SAMI, "first")).status).toBe("issued");
      expect((await issue(tx, F.MEHR, "first")).status).toBe("issued");
      world.profiles.get(F.MEHR)!.onboardingComplete = false;
      return { queued: await call(tx, (sp) => refreshStart(sp, async (ids) => new Set(ids.filter(eligibleNow)), true)) };
    }));

  it("exports", () =>
    replay(sql, G, "exports", async (tx) => {
      const out: Record<string, unknown> = {};
      expect((await issue(tx, F.SAMI, "first")).status).toBe("issued");
      const rec = ((await tx`select id::text from credentials.cv_records where user_id = ${F.SAMI}`)[0] as unknown as { id: string }).id;
      const files = new Map<string, number>();
      const e = (template: string, bytes = 1500, mac?: string) => ({
        exportId: F.EXPORT_CV,
        recordId: rec,
        template,
        paper: "a4",
        pdfHash: F.PDF_HASH,
        bytes,
        mac: mac ?? Cv.exportMac(exportSecret, [F.EXPORT_CV, rec, template, "a4", F.PDF_HASH, bytes]),
      });
      const rec2 = (user: string, x: ReturnType<typeof e>) => (sp: Tx) => Cv.recordCvExport(sp, user, x, exportSecret, async (p) => files.get(p) ?? null);
      const rights = () => call(tx, async (sp) => [await Cv.exportRights(sp, F.SAMI)]);
      out["rights_free"] = await rights();
      out["free"] = await call(tx, rec2(F.SAMI, e("standard")));
      await grant(tx, F.SAMI, "cv.pdf_export");
      out["rights_pro"] = await rights();
      out["template"] = await call(tx, rec2(F.SAMI, e("classic")));
      out["bad_mac"] = await call(tx, rec2(F.SAMI, e("standard", 1500, "0".repeat(64))));
      out["no_file"] = await call(tx, rec2(F.SAMI, e("standard")));
      files.set(`${F.SAMI}/${F.EXPORT_CV}.pdf`, 1500);
      out["wrong_size"] = await call(tx, rec2(F.SAMI, e("standard", 1499)));
      out["export"] = await step(tx, rec2(F.SAMI, e("standard")));
      out["not_mine"] = await call(tx, rec2(F.MEHR, e("standard")));
      await tx`update credentials.cv_pdf_exports set created_at = now() - interval '31 days' where id = ${F.EXPORT_CV}`;
      out["daily"] = await job(tx, async (sp) => ({ n: await Cv.exportsDaily(sp) }));
      return out;
    }));

  it("activities", () =>
    replay(sql, G, "activities", async (tx) => {
      const out: Record<string, unknown> = {};
      await issueAndSeal(tx);
      await tx`update credentials.record_entries set occurred_on = occurred_on - (case kind when 'attended' then 2 when 'completed' then 1 else 0 end) where user_id = ${F.SAMI}`;
      const ids = (await tx<{ id: string }[]>`select id::text from credentials.record_entries where user_id = ${F.SAMI} order by kind`).map((r) => r.id);
      const mine = ((await tx`select id::text from credentials.record_entries where user_id = ${F.MEHR} limit 1`)[0] as unknown as { id: string }).id;
      out["not_mine"] = await call(tx, (sp) => Rec.saveCvActivities(sp, F.SAMI, [mine]));
      await tx`update credentials.config set value = jsonb_set(value, '{cv_entries}', '2') where key = 'record.limits'`;
      out["too_many"] = await call(tx, (sp) => Rec.saveCvActivities(sp, F.SAMI, ids));
      out["save"] = await step(tx, (sp) => Rec.saveCvActivities(sp, F.SAMI, [ids[2]!, ids[0]!]));
      out["snapshot"] = await call(tx, (sp) => activities(sp, F.SAMI));
      out["sections"] = await call(tx, async (sp) => ((await (await import("../../src/store/snapshot")).snapshot(sp, F.SAMI, inputsFor(F.SAMI))) ?? {})["sections"]);
      return out;
    }));

  it("ban", () =>
    replay(sql, G, "ban", async (tx) => {
      const out: Record<string, unknown> = {};
      expect((await issue(tx, F.SAMI, "first")).status).toBe("issued");
      expect((await issue(tx, F.MEHR, "first")).status).toBe("issued");
      ok(await call(tx, (sp) => Cv.createShareLink(sp, F.SAMI, true, true, F.LINK_HASH, "Recruiters", 30)));
      out["ban"] = await job(tx, async (sp) => {
        world.accounts.get(F.SAMI)!.banned = true;
        await copy(sp, "user.banned", "svc_identity", { user_id: F.SAMI, until: null }, [F.SAMI]);
        return null;
      });
      out["banned_issue"] = await job(tx, (sp) => issue(sp, F.SAMI, "monthly"));
      const code = ((await tx`select code from credentials.cv_records where user_id = ${F.MEHR}`)[0] as unknown as { code: string }).code;
      out["delete"] = await job(tx, async (sp) => {
        await copy(sp, "user.deleted", "svc_identity", { user_id: F.MEHR }, [F.MEHR]);
        return null;
      });
      out["deleted_row"] = await call(tx, async (sp) => {
        const [r] = await sp<{ v: unknown }[]>`select jsonb_build_object('user', user_id, 'snapshot', snapshot, 'revoked', revoked_reason, 'version', version) as v from credentials.cv_records where code = ${code}`;
        return r!.v;
      });
      out["deleted_verify"] = await call(tx, (sp) => Cv.verifyCv(sp, code, null));
      return out;
    }));
});
