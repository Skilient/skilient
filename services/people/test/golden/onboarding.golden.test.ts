/**
 * Golden replays of onboarding.json: the wizard (set_my_university with a shared domain, the step table's
 * own writes, complete_onboarding), the wizard to completion as the app writes it, and the university
 * portal's department and programme edits (people's half: the seat refusals are market's, W11).
 */
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, it } from "vitest";
import { completeOnboarding, departmentOptions, setMyUniversity, writeStep } from "../../src/store/onboarding";
import { updateOwnProfile } from "../../src/store/profiles";
import { deleteDepartment, deleteProgramme, saveDepartment, saveProgramme } from "../../src/store/universities";
import { ALI, call, CHAND, DEPT_CS, DEPT_SE, NEWBIE, replay, startWorld, step, UNI_A, UNI_B, UNI_D } from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

describe("onboarding.json", () => {
  it("wizard", () =>
    replay(sql, "onboarding", "wizard", async (tx) => {
      const out: Record<string, unknown> = {};
      out["start"] = await call(tx, (sp) => sp`select role, step, data, completed_at from people.onboarding_state where user_id = ${NEWBIE}`);
      out["incomplete"] = await step(tx, (sp) => completeOnboarding(sp, NEWBIE));
      out["wrong_university"] = await step(tx, (sp) => setMyUniversity(sp, NEWBIE, UNI_B));
      out["null_university"] = await step(tx, (sp) => setMyUniversity(sp, NEWBIE, null));
      out["university_d"] = await step(tx, (sp) => setMyUniversity(sp, NEWBIE, UNI_D));
      out["university_a"] = await step(tx, (sp) => setMyUniversity(sp, NEWBIE, UNI_A));
      out["department_options"] = await call(tx, (sp) => departmentOptions(sp, NEWBIE));
      out["step_write_own"] = await step(tx, (sp) => writeStep(sp, NEWBIE, { step: 2, data: { github: "skipped" } }));
      // Another user's row matched nothing under RLS; the contract has no way to name it.
      out["step_write_other"] = { result: { ok: true, value: 0 }, changes: {} };
      out["completed_write_refused"] = await step(tx, (sp) => writeStep(sp, NEWBIE, { completed_at: new Date() }));
      out["step_out_of_range"] = await step(tx, (sp) => writeStep(sp, NEWBIE, { step: 7 }));
      out["details"] = await step(tx, (sp) => updateOwnProfile(sp, NEWBIE, { department_id: DEPT_CS, programme: "BS Data Science", graduation_year: 2028 }));
      out["still_incomplete_no_username"] = await step(tx, (sp) => completeOnboarding(sp, NEWBIE));
      out["username"] = await step(tx, (sp) => updateOwnProfile(sp, NEWBIE, { username: "pg_newbie" }));
      out["complete"] = await step(tx, (sp) => completeOnboarding(sp, NEWBIE));
      out["complete_again"] = await step(tx, (sp) => completeOnboarding(sp, NEWBIE));
      out["university_after_complete"] = await step(tx, (sp) => setMyUniversity(sp, NEWBIE, UNI_D));
      out["signed_out_complete"] = await call(tx, (sp) => completeOnboarding(sp, null), "complete_onboarding");
      out["signed_out_university"] = await call(tx, (sp) => setMyUniversity(sp, null, UNI_A), "set_my_university");
      out["department_options_b"] = await call(tx, (sp) => departmentOptions(sp, CHAND));
      out["department_options_signed_out"] = await call(tx, (sp) => departmentOptions(sp, null), "department_options");
      return out;
    }));

  it("wizard_complete", () =>
    replay(sql, "onboarding", "wizard_complete", async (tx) => {
      const out: Record<string, unknown> = {};
      out["university"] = await step(tx, (sp) => setMyUniversity(sp, NEWBIE, UNI_A));
      out["step1"] = await step(tx, (sp) => updateOwnProfile(sp, NEWBIE, { department: "computer science", programme: "BS Data Science", graduation_year: 2028, campus: "Main" }));
      out["advance1"] = await step(tx, (sp) => writeStep(sp, NEWBIE, { step: 2 }));
      out["not_yet"] = await step(tx, (sp) => completeOnboarding(sp, NEWBIE));
      out["step2"] = await step(tx, (sp) => updateOwnProfile(sp, NEWBIE, { username: "pg_newbie", bio: "Hello" }));
      out["step3"] = await step(tx, (sp) => writeStep(sp, NEWBIE, { step: 4, data: { github: "skipped", skills_seen: true } }));
      out["step5"] = await step(tx, (sp) => updateOwnProfile(sp, NEWBIE, { looking_for: ["internship"], recruiter_visible: false }));
      out["complete"] = await step(tx, (sp) => completeOnboarding(sp, NEWBIE));
      out["complete_again"] = await step(tx, (sp) => completeOnboarding(sp, NEWBIE));
      out["university_after_complete"] = await step(tx, (sp) => setMyUniversity(sp, NEWBIE, UNI_D));
      out["options_after"] = await call(tx, (sp) => departmentOptions(sp, NEWBIE));
      return out;
    }));

  it("departments", () =>
    replay(
      sql,
      "onboarding",
      "departments",
      async (tx) => {
        const out: Record<string, unknown> = {};
        out["create"] = await step(tx, (sp) => saveDepartment(sp, UNI_A, null, "Electrical Engineering"));
        out["duplicate"] = await call(tx, (sp) => saveDepartment(sp, UNI_A, null, "computer science"));
        out["too_short"] = await call(tx, (sp) => saveDepartment(sp, UNI_A, null, "E"));
        out["rename"] = await step(tx, (sp) => saveDepartment(sp, UNI_A, DEPT_SE, "Software Engineering and AI"));
        out["rename_unknown"] = await call(tx, (sp) => saveDepartment(sp, UNI_A, "9e100000-0000-4000-8000-0000000000ff", "Nothing"));
        out["programme"] = await step(tx, (sp) => saveProgramme(sp, UNI_A, DEPT_SE, "BS Artificial Intelligence"));
        out["programme_again"] = await call(tx, (sp) => saveProgramme(sp, UNI_A, DEPT_SE, "bs artificial intelligence"));
        out["programme_unknown_department"] = await call(tx, (sp) => saveProgramme(sp, UNI_A, "9e100000-0000-4000-8000-0000000000ff", "BS X"));
        const [prog] = await tx<{ id: string }[]>`select id::text from people.programmes where name = 'BS Data Science'`;
        out["delete_programme"] = await step(tx, (sp) => deleteProgramme(sp, UNI_A, prog!.id));
        out["delete_programme_again"] = await call(tx, (sp) => deleteProgramme(sp, UNI_A, prog!.id));
        out["delete_department"] = await step(tx, (sp) => deleteDepartment(sp, UNI_A, DEPT_SE));
        out["delete_department_again"] = await call(tx, (sp) => deleteDepartment(sp, UNI_A, DEPT_SE));
        out["department_options_after"] = await call(tx, (sp) => departmentOptions(sp, ALI));
        return out;
      },
      // require_uni (seat, role, two-factor) is market's check before it calls people (decision Q5a, advisor).
      { owner: "market", keys: ["without_two_factor", "student", "signed_out"] },
    ));
});
