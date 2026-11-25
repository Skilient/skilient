/**
 * Golden replays of universities.json: university requests (signed out), the staff methods (live dates,
 * open all, domains, final-year batches, batches) with their audit rows, the graduation job and the HEC
 * seed sync. Staff roles come from identity (StaffRolesOf); here the recording's roles are passed as
 * identity returns them. Personal domains come from identity's CheckEmailDomains (here a fixed list).
 */
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, it } from "vitest";
import { requireAccounts, type StaffRole } from "../../src/authorize";
import {
  confirmUniversityRequest,
  finalYear,
  graduateRollover,
  opsAddUniDomain,
  opsBatches,
  opsOpenAllUniversities,
  opsSetFinalYearBatch,
  opsSetUniversityLive,
  opsUniversityRequests,
  requestUniversity,
  syncHecUniversities,
  universityLive,
  unsubscribeUniversityRequest,
} from "../../src/store/universities";
import { ALI, call, PERSONAL, replay, STAFF, startWorld, step, UNI_A, UNI_B, UNI_C, type Tx } from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

/** The actor as the gate sees it, with the roles identity returns for them. */
const STAFF_AAL2 = { user: { id: STAFF, aal: "aal2" as const }, roles: ["super_admin"] as StaffRole[] };
const STAFF_AAL1 = { user: { id: STAFF, aal: "aal1" as const }, roles: ["super_admin"] as StaffRole[] };
const STUDENT_AAL2 = { user: { id: ALI, aal: "aal2" as const }, roles: [] as StaffRole[] };
type Actor = { user: { id: string; aal: "aal1" | "aal2" }; roles: StaffRole[] } | null;
/** require_accounts for the actor, then the store call (as the handlers do). */
const asStaff = <T>(actor: Actor, run: (me: string) => Promise<T>) => async () => {
  if (!actor) throw (await import("../../src/refusals")).refused("not_signed_in");
  return run(requireAccounts(actor.user, actor.roles));
};

describe("universities.json", () => {
  it("requests", () =>
    replay(sql, "universities", "requests", async (tx) => {
      const r = (email: string | null, name: string | null, consent: boolean | null, token: string | null) =>
        step(tx, (sp) => requestUniversity(sp, { email, universityName: name, consent, token, ipHash: null }, PERSONAL));
      const T1 = "a".repeat(40);
      const T2 = "b".repeat(40);
      return {
        closed_known_university: await r("Student@People-C.test", null, true, T1),
        again_same_email: await r("student@people-c.test", "Anything", true, "c".repeat(40)),
        unknown_domain_named: await r("x@people-new.test", "  People New University  ", true, T2),
        unknown_domain_no_name: await r("y@people-new.test", null, true, "d".repeat(40)),
        unknown_domain_short_name: await r("y@people-new.test", "P", true, "d".repeat(40)),
        live_university: await r("z@people-a.test", null, true, "e".repeat(40)),
        personal_domain: await r("z@people-mail.test", "Some University", true, "e".repeat(40)),
        no_consent: await r("w@people-new.test", "People New University", false, "f".repeat(40)),
        short_token: await r("w@people-new.test", "People New University", true, "short"),
        bad_email: await r("not-an-email", "People New University", true, "f".repeat(40)),
        confirm: await step(tx, (sp) => confirmUniversityRequest(sp, T1)),
        confirm_again: await step(tx, (sp) => confirmUniversityRequest(sp, T1)),
        confirm_named: await step(tx, (sp) => confirmUniversityRequest(sp, T2)),
        confirm_unknown: await call(tx, (sp) => confirmUniversityRequest(sp, "0".repeat(40))),
        unsubscribe: await step(tx, (sp) => unsubscribeUniversityRequest(sp, T2)),
        unsubscribe_again: await step(tx, (sp) => unsubscribeUniversityRequest(sp, T2)),
        unsubscribe_unknown: await call(tx, (sp) => unsubscribeUniversityRequest(sp, "0".repeat(40))),
        confirm_after_unsubscribe: await call(tx, (sp) => confirmUniversityRequest(sp, T2)),
        staff_view: await call(tx, (sp) => asStaff(STAFF_AAL2, async () => (await opsUniversityRequests(sp)).filter((g) => g.domain.includes("people")))()),
        staff_view_student: await call(tx, (sp) => asStaff(STUDENT_AAL2, () => opsUniversityRequests(sp))()),
        staff_view_aal1: await call(tx, (sp) => asStaff(STAFF_AAL1, () => opsUniversityRequests(sp))()),
      };
    }));

  it("staff", () =>
    replay(sql, "universities", "staff", async (tx) => {
      const st = STAFF_AAL2;
      const out: Record<string, unknown> = {};
      const live = (sp: Tx, actor: Actor, uni: string, on: boolean, reason: string) => asStaff(actor, (me) => opsSetUniversityLive(sp, me, { universityId: uni, live: on, reason }))();
      out["open_c"] = await step(tx, (sp) => live(sp, st, UNI_C, true, "launch day"));
      out["open_c_again"] = await step(tx, (sp) => live(sp, st, UNI_C, true, "again"));
      out["close_c"] = await step(tx, (sp) => live(sp, st, UNI_C, false, "paused"));
      out["no_reason"] = await call(tx, (sp) => live(sp, st, UNI_C, true, " a "));
      out["unknown_university"] = await call(tx, (sp) => live(sp, st, "9e000000-0000-4000-8000-0000000000ff", true, "launch"));
      out["open_all"] = await step(tx, (sp) => asStaff(st, (me) => opsOpenAllUniversities(sp, me, "public launch"))());
      out["open_all_again"] = await step(tx, (sp) => asStaff(st, (me) => opsOpenAllUniversities(sp, me, "public launch"))());
      const domain = (sp: Tx, actor: Actor, uni: string, d: string, kind: string, reason: string) =>
        asStaff(actor, (me) => opsAddUniDomain(sp, me, { universityId: uni, domain: d, kind, reason }, PERSONAL))();
      out["add_domain"] = await step(tx, (sp) => domain(sp, st, UNI_B, " Students.People-B.TEST ", "student", "second domain"));
      out["add_domain_taken"] = await call(tx, (sp) => domain(sp, st, UNI_A, "people-b.test", "both", "steal"));
      out["add_domain_personal"] = await call(tx, (sp) => domain(sp, st, UNI_A, "people-mail.test", "both", "nope"));
      out["add_domain_invalid"] = await call(tx, (sp) => domain(sp, st, UNI_A, "not a domain", "both", "nope"));
      out["add_domain_kind"] = await call(tx, (sp) => domain(sp, st, UNI_A, "x.people-a.test", "alumni", "nope"));
      out["add_domain_no_reason"] = await call(tx, (sp) => domain(sp, st, UNI_A, "x.people-a.test", "both", ""));
      // The trigger refusing a personal domain on any insert; people's other writer of domains is the HEC sync.
      out["personal_domain_direct_insert"] = await call(tx, (sp) => syncHecUniversities(sp, [{ name: "People Golden University A", slug: "people-golden-a", domains: ["people-mail.test"] }], PERSONAL));
      const fy = (sp: Tx, actor: Actor, uni: string, batch: number | null, reason: string) => asStaff(actor, (me) => opsSetFinalYearBatch(sp, me, { universityId: uni, batch, reason }))();
      out["final_year"] = await step(tx, (sp) => fy(sp, st, UNI_A, 2026, "early exams"));
      out["final_year_clear"] = await step(tx, (sp) => fy(sp, st, UNI_A, null, "back to rule"));
      out["final_year_bad"] = await call(tx, (sp) => fy(sp, st, UNI_A, 1900, "bad"));
      out["final_year_short_reason"] = await call(tx, (sp) => fy(sp, st, UNI_A, 2026, "x"));
      out["final_year_unknown"] = await call(tx, (sp) => fy(sp, st, "9e000000-0000-4000-8000-0000000000ff", 2026, "reason"));
      // ops_batches returned bigint counts, which Postgres sent as text.
      const batches = (sp: Tx, actor: Actor) =>
        asStaff(actor, async () => (await opsBatches(sp)).filter((u) => [UNI_A, UNI_B, UNI_C, "9e000000-0000-4000-8000-00000000000d"].includes(u.university_id)).sort((a, b) => a.name.localeCompare(b.name)).map((u) => ({ ...u, students: String(u.students), graduates: String(u.graduates) })))();
      out["batches"] = await call(tx, (sp) => batches(sp, st));
      for (const [name, actor] of [["student", STUDENT_AAL2], ["aal1", STAFF_AAL1], ["signed_out", null]] as const) {
        out[`refused_${name}`] = {
          live: await call(tx, (sp) => live(sp, actor, UNI_C, true, "launch"), "ops_set_university_live"),
          open_all: await call(tx, (sp) => asStaff(actor, (me) => opsOpenAllUniversities(sp, me, "launch"))(), "ops_open_all_universities"),
          domain: await call(tx, (sp) => domain(sp, actor, UNI_A, "y.people-a.test", "both", "reason"), "ops_add_uni_domain"),
          final_year: await call(tx, (sp) => fy(sp, actor, UNI_A, 2026, "reason"), "ops_set_final_year_batch"),
          batches: await call(tx, (sp) => batches(sp, actor), "ops_batches"),
        };
      }
      return out;
    }));

  it("graduate_rollover", () =>
    replay(sql, "universities", "graduate_rollover", async (tx) => {
      const out: Record<string, unknown> = {};
      out["before_september_2027"] = await step(tx, (sp) => graduateRollover(sp, { year: 2027, month: 8, day: 31 }));
      out["on_september_1_2027"] = await step(tx, (sp) => graduateRollover(sp, { year: 2027, month: 9, day: 1 }));
      out["again"] = await step(tx, (sp) => graduateRollover(sp, { year: 2027, month: 9, day: 1 }));
      await tx`update people.universities set final_year_batch = 2028 where id = ${UNI_B}`;
      out["early_batch_at_b"] = await step(tx, (sp) => graduateRollover(sp, { year: 2027, month: 9, day: 1 }));
      out["final_year_of"] = {
        a_rule: await call(tx, async (sp) => (await finalYear(sp, UNI_A)) != null),
        b_set: await call(tx, (sp) => finalYear(sp, UNI_B)),
        unknown: await call(tx, (sp) => finalYear(sp, "9e000000-0000-4000-8000-0000000000ff")),
      };
      out["university_live"] = { a: await call(tx, (sp) => universityLive(sp, UNI_A)), c: await call(tx, (sp) => universityLive(sp, UNI_C)) };
      return out;
    }));

  it("sync_hec", () =>
    replay(sql, "universities", "sync_hec", async (tx) => {
      const rows1 = [
        { name: "People HEC One", slug: "people-golden-hec-one", city: "Lahore", province: "Punjab", domains: ["one.people-hec.test", "ONE2.people-hec.test"] },
        { name: "People HEC Two", slug: "people-golden-hec-two", city: "", province: "", domains: [] },
      ];
      // A plpgsql function returning void printed as an empty string on the current stack.
      const sync = (sp: Tx, rows: unknown) => syncHecUniversities(sp, rows, PERSONAL).then(() => "");
      const first = await step(tx, (sp) => sync(sp, rows1));
      const rows2 = [{ name: "People HEC One", slug: "people-golden-hec-one", city: "Karachi", province: "Sindh", domains: ["one.people-hec.test"] }];
      return {
        first,
        update_drops_domain: await step(tx, (sp) => sync(sp, rows2)),
        not_an_array: await call(tx, (sp) => sync(sp, { name: "x" })),
      };
    }));
});
