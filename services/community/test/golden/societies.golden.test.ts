/**
 * Golden replays of societies.json, membership.json, inductions.json and staff.json
 * (packages/testing/test/community.golden.test.ts), under the rules in replay.ts.
 */
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, it } from "vitest";
import { noStaff } from "../../src/store/db";
import * as I from "../../src/store/inductions";
import * as S from "../../src/store/societies";
import * as St from "../../src/store/staff";
import { call, F, files, fill, job, ok, okStep, replay, resolve, staffOf, startWorld, step, uploads, type Tx } from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

const { PRIYA, OSMAN, MEHR, SAMI, NIDA, ULA, GUL, TARIQ } = F;
type Json = Record<string, unknown>;
const newSociety = (p: Json): S.NewSociety => ({
  name: String(p["name"] ?? ""),
  category: String(p["category"] ?? ""),
  about: String(p["about"] ?? ""),
  proof_path: (p["proof_path"] as string | undefined) ?? null,
  proof_url: (p["proof_url"] as string | undefined) ?? null,
  office_bearer: Boolean(p["office_bearer"]),
});
const NEW_SOCIETY = (name: string, extra: Json = {}) =>
  newSociety({ name, category: "arts", about: "  Painting and printmaking for every student on campus.  ", proof_url: "https://comm-a.test/notices/arts", office_bearer: true, ...extra });
const request = (me: string | null, p: S.NewSociety) => (sp: Tx) => S.requestSociety(sp, me, p, files);

/** Trust staff: the handler's role and two-factor check, then the store. */
async function asStaff<T>(user: string, aal: "aal1" | "aal2", run: () => Promise<T>): Promise<T> {
  if (!(await staffOf(user, aal)())) throw (await import("../../src/refusals")).refused("trust_only");
  return run();
}

describe("societies.json", () => {
  it("request", () =>
    replay(sql, "societies", "request", async (tx) => {
      const out: Json = {};
      out["check_taken"] = await call(tx, async (sp) => fill(await S.nameCheck(sp, SAMI, "The Wren Robotics Club!")));
      out["check_pending"] = await call(tx, async (sp) => fill(await S.nameCheck(sp, SAMI, "wren  debating society")));
      out["check_free"] = await call(tx, async (sp) => fill(await S.nameCheck(sp, SAMI, "Wren Printmakers")));
      out["check_other_university"] = await call(tx, async (sp) => fill(await S.nameCheck(sp, ULA, "Wren Robotics")));
      out["requested"] = await step(tx, request(SAMI, NEW_SOCIETY("  Wren Printmakers  ")));
      out["again"] = await call(tx, request(SAMI, NEW_SOCIETY("Wren Sculptors")));
      out["duplicate_name"] = await call(tx, request(MEHR, NEW_SOCIETY("The Wren Robotics Club")));
      out["not_bearer"] = await call(tx, request(MEHR, NEW_SOCIETY("Wren Sculptors", { office_bearer: false })));
      out["no_proof"] = await call(tx, request(MEHR, NEW_SOCIETY("Wren Sculptors", { proof_url: "" })));
      out["foreign_proof"] = await call(tx, request(MEHR, NEW_SOCIETY("Wren Sculptors", { proof_url: "", proof_path: F.PROOF })));
      out["graduate"] = await call(tx, request(GUL, NEW_SOCIETY("Wren Sculptors")));
      out["signed_out"] = await call(tx, request(null, NEW_SOCIETY("Wren Sculptors")), "request_society");
      out["mine"] = await call(tx, (sp) => S.mySocietyRequests(sp, SAMI));
      return out;
    }));

  it("pages", () =>
    replay(sql, "societies", "pages", async (tx) => {
      const out: Json = {};
      await tx`insert into community.society_join_requests (society_id, user_id) values (${F.SOC}, ${SAMI})`;
      await tx`
        insert into community.induction_rounds (id, society_id, title, deadline, status, published_at)
        values (gen_random_uuid(), ${F.SOC}, 'Spring inductions', now() + interval '5 days', 'open', now()),
               (gen_random_uuid(), ${F.SOC}, 'Draft round', now() + interval '6 days', 'draft', null)`;
      await tx`
        insert into community.society_terms (id, society_id, user_id, role, title, term_start, term_end, ended_at)
        values (gen_random_uuid(), ${F.SOC}, ${MEHR}, 'officer', 'Treasurer', current_date - 400, current_date - 35, now() - interval '35 days')`;
      out["directory"] = await call(tx, (sp) => S.directory(sp, SAMI, null, null, fill));
      out["directory_query"] = await call(tx, (sp) => S.directory(sp, ULA, "robot", "technology", fill));
      out["directory_signed_out"] = await call(tx, (sp) => S.directory(sp, null, null, null, fill), "societies_directory");
      out["page_president"] = await call(tx, (sp) => S.societyPage(sp, PRIYA, F.SOC_SLUG, noStaff, fill));
      out["page_member"] = await call(tx, (sp) => S.societyPage(sp, MEHR, F.SOC_SLUG, noStaff, fill));
      out["page_other_university"] = await call(tx, (sp) => S.societyPage(sp, ULA, F.SOC_SLUG, noStaff, fill));
      out["page_pending_requester"] = await call(tx, (sp) => S.societyPage(sp, NIDA, F.PENDING_SLUG, noStaff, fill));
      out["page_pending_stranger"] = await call(tx, (sp) => S.societyPage(sp, SAMI, F.PENDING_SLUG, noStaff, fill));
      out["page_unknown"] = await call(tx, (sp) => S.societyPage(sp, SAMI, "no-such-society", noStaff, fill));
      out["manage_officer"] = await call(tx, (sp) => S.societyManage(sp, OSMAN, F.SOC, fill));
      out["manage_member"] = await call(tx, (sp) => S.societyManage(sp, MEHR, F.SOC, fill));
      out["officer_societies"] = await call(tx, (sp) => S.myOfficerSocieties(sp, OSMAN));
      return out;
    }));

  it("edits", () =>
    replay(sql, "societies", "edits", async (tx) => {
      const out: Json = {};
      out["update"] = await step(tx, (sp) => S.updateSociety(sp, OSMAN, F.SOC, { about: "  Robots, soldering and Friday build nights for everyone.  ", category: "" }));
      out["update_member"] = await call(tx, (sp) => S.updateSociety(sp, MEHR, F.SOC, { about: "Ours now, ours forever and ever." }));
      out["mode"] = await step(tx, (sp) => S.setMembershipMode(sp, OSMAN, F.SOC, "open"));
      out["mode_unknown"] = await call(tx, (sp) => S.setMembershipMode(sp, OSMAN, F.SOC, "invite"));
      out["images"] = await step(tx, (sp) => S.setSocietyImages(sp, PRIYA, F.SOC, F.LOGO, null, files));
      out["images_missing"] = await call(tx, (sp) => S.setSocietyImages(sp, PRIYA, F.SOC, null, `${F.SOC}/97d00000-0000-4000-8000-0000000000ff.webp`, files));
      out["images_stranger"] = await call(tx, (sp) => S.setSocietyImages(sp, SAMI, F.SOC, F.LOGO, null, files));
      out["resubmit_pending"] = await call(tx, (sp) => S.resubmitSociety(sp, NIDA, F.PENDING, { about: "More about us than before, really." }, files));
      await tx`update community.society_requests set status = 'more_info', staff_note = 'Add the notice' where society_id = ${F.PENDING}`;
      await tx`update community.societies set status = 'more_info', status_reason = 'Add the notice' where id = ${F.PENDING}`;
      out["resubmit"] = await step(tx, (sp) =>
        S.resubmitSociety(sp, NIDA, F.PENDING, { about: "  Weekly debates, a novice league and practice for national rounds.  ", proof_url: "https://comm-a.test/notices/debating" }, files),
      );
      await tx`update community.societies set status = 'suspended' where id = ${F.SOC}`;
      out["update_suspended"] = await call(tx, (sp) => S.updateSociety(sp, OSMAN, F.SOC, { about: "Still here, still building robots." }));
      return out;
    }));
});

describe("membership.json", () => {
  it("join", () =>
    replay(sql, "membership", "join", async (tx) => {
      const out: Json = {};
      out["follow"] = await step(tx, (sp) => S.followSociety(sp, SAMI, F.SOC, true));
      out["unfollow"] = await step(tx, (sp) => S.followSociety(sp, SAMI, F.SOC, false));
      out["follow_pending"] = await call(tx, (sp) => S.followSociety(sp, SAMI, F.PENDING, true));
      out["join_request"] = await step(tx, (sp) => S.joinSociety(sp, SAMI, F.SOC));
      out["join_again"] = await call(tx, (sp) => S.joinSociety(sp, SAMI, F.SOC));
      out["join_member"] = await call(tx, (sp) => S.joinSociety(sp, MEHR, F.SOC));
      out["join_other_university"] = await call(tx, (sp) => S.joinSociety(sp, ULA, F.SOC));
      out["decide_member"] = await call(tx, (sp) => S.decideJoinRequest(sp, MEHR, F.SOC, SAMI, true));
      out["accept"] = await step(tx, (sp) => S.decideJoinRequest(sp, OSMAN, F.SOC, SAMI, true));
      out["accept_gone"] = await call(tx, (sp) => S.decideJoinRequest(sp, OSMAN, F.SOC, SAMI, true));
      await tx`update community.societies set membership_mode = 'open' where id = ${F.SOC}`;
      out["join_open"] = await step(tx, (sp) => S.joinSociety(sp, NIDA, F.SOC));
      await tx`update community.societies set membership_mode = 'inductions' where id = ${F.SOC}`;
      out["join_inductions"] = await call(tx, (sp) => S.joinSociety(sp, GUL, F.SOC));
      out["leave"] = await step(tx, (sp) => S.leaveSociety(sp, SAMI, F.SOC));
      out["leave_again"] = await call(tx, (sp) => S.leaveSociety(sp, SAMI, F.SOC));
      out["leave_president"] = await call(tx, (sp) => S.leaveSociety(sp, PRIYA, F.SOC));
      out["leave_officer"] = await step(tx, (sp) => S.leaveSociety(sp, OSMAN, F.SOC));
      return out;
    }));

  it("officers", () =>
    replay(sql, "membership", "officers", async (tx) => {
      const out: Json = {};
      const [d] = await tx<{ a: string; b: string; c: string }[]>`select current_date::text as a, (current_date + 180)::text as b, (current_date + 900)::text as c`;
      const invite = (me: string, name: string, title: string, a: string, b: string) => (sp: Tx) => S.inviteOfficer(sp, me, F.SOC, resolve(name), title, a, b);
      out["invite_officer_not_president"] = await call(tx, invite(OSMAN, F.USERNAME[MEHR]!, "Treasurer", d!.a, d!.b));
      out["invite_unknown"] = await call(tx, invite(PRIYA, "cm_nobody", "Treasurer", d!.a, d!.b));
      out["invite_other_university"] = await call(tx, invite(PRIYA, F.USERNAME[ULA]!, "Treasurer", d!.a, d!.b));
      out["invite_officer_again"] = await call(tx, invite(PRIYA, F.USERNAME[OSMAN]!, "Treasurer", d!.a, d!.b));
      out["invite_long_term"] = await call(tx, invite(PRIYA, F.USERNAME[MEHR]!, "Treasurer", d!.a, d!.c));
      const inv = okStep((out["invite"] = await step(tx, invite(PRIYA, " CM_MEHR ", " Treasurer ", d!.a, d!.b))));
      out["my_invites"] = await call(tx, (sp) => S.mySocietyInvites(sp, MEHR));
      out["answer_stranger"] = await call(tx, (sp) => S.answerInvite(sp, SAMI, inv, true));
      out["accept"] = await step(tx, (sp) => S.answerInvite(sp, MEHR, inv, true));
      const handover = (name: string) => (sp: Tx) => S.offerHandover(sp, PRIYA, F.SOC, resolve(name));
      out["handover_not_member"] = await call(tx, handover(F.USERNAME[SAMI]!));
      const h1 = okStep((out["handover_first"] = await step(tx, handover(F.USERNAME[MEHR]!))));
      const h2 = okStep((out["handover_replaced"] = await step(tx, handover(F.USERNAME[OSMAN]!))));
      out["answer_withdrawn"] = await call(tx, (sp) => S.answerInvite(sp, MEHR, h1, true));
      out["handover"] = await step(tx, (sp) => S.answerInvite(sp, OSMAN, h2, true));
      out["remove_not_president"] = await call(tx, (sp) => S.removeOfficer(sp, PRIYA, F.SOC, MEHR));
      out["remove_president"] = await call(tx, (sp) => S.removeOfficer(sp, OSMAN, F.SOC, OSMAN));
      out["remove"] = await step(tx, (sp) => S.removeOfficer(sp, OSMAN, F.SOC, MEHR));
      out["remove_again"] = await call(tx, (sp) => S.removeOfficer(sp, OSMAN, F.SOC, MEHR));
      const [t] = await tx<{ old_president: string; mehr: string; new_president: string }[]>`
        select (select id::text from community.society_terms where society_id = ${F.SOC} and user_id = ${PRIYA} and role = 'president' and ended_at is not null) as old_president,
               (select id::text from community.society_terms where society_id = ${F.SOC} and user_id = ${MEHR} and role = 'officer' and ended_at is not null) as mehr,
               (select id::text from community.society_terms where society_id = ${F.SOC} and user_id = ${OSMAN} and role = 'president' and ended_at is null) as new_president`;
      out["confirm_own"] = await call(tx, (sp) => S.confirmTerm(sp, OSMAN, t!.new_president));
      out["confirm_not_ended"] = await call(tx, (sp) => S.confirmTerm(sp, PRIYA, t!.new_president));
      out["confirm_by_member"] = await call(tx, (sp) => S.confirmTerm(sp, PRIYA, t!.mehr));
      out["confirm_officer"] = await step(tx, (sp) => S.confirmTerm(sp, OSMAN, t!.mehr));
      out["confirm_again"] = await step(tx, (sp) => S.confirmTerm(sp, OSMAN, t!.mehr));
      out["confirm_old_president"] = await step(tx, (sp) => S.confirmTerm(sp, OSMAN, t!.old_president));
      return out;
    }));
});

describe("inductions.json", () => {
  const ROUND = (deadline: string, extra: Partial<I.RoundInput> = {}): I.RoundInput => ({
    id: null,
    title: " Fall inductions ",
    description: " Join the build team. ",
    deadline,
    roles: [
      { title: " Hardware lead ", seats: 1, skill_ids: ["react"] },
      { title: "Designer", seats: 2, skill_ids: [] },
    ],
    questions: [" What have you built so far? "],
    ...extra,
  });

  it("rounds", () =>
    replay(sql, "inductions", "rounds", async (tx) => {
      const out: Json = {};
      const [t] = await tx<{ week: string; late: string }[]>`select (now() + interval '7 days')::text as week, (now() + interval '40 days')::text as late`;
      const save = (me: string, soc: string, p: I.RoundInput) => (sp: Tx) => I.saveRound(sp, me, soc, p);
      out["save_member"] = await call(tx, save(MEHR, F.SOC, ROUND(t!.week)));
      out["save_late"] = await call(tx, save(OSMAN, F.SOC, ROUND(t!.late)));
      out["save_no_roles"] = await call(tx, save(OSMAN, F.SOC, ROUND(t!.week, { roles: [] })));
      out["save_too_many_questions"] = await call(tx, save(OSMAN, F.SOC, ROUND(t!.week, { questions: ["One?", "Two?", "Three?", "Four?"] })));
      out["save_pending_society"] = await call(tx, save(NIDA, F.PENDING, ROUND(t!.week)));
      const id = okStep((out["saved"] = await step(tx, save(OSMAN, F.SOC, ROUND(t!.week)))));
      out["resaved"] = await step(tx, save(OSMAN, F.SOC, ROUND(t!.week, { id, title: "Fall inductions", roles: [{ title: "Hardware lead", seats: 1, skill_ids: [] }] })));
      out["page_draft_officer"] = await call(tx, (sp) => I.roundPage(sp, PRIYA, id, noStaff, fill));
      out["page_draft_student"] = await call(tx, (sp) => I.roundPage(sp, SAMI, id, noStaff, fill));
      out["apply_draft"] = await call(tx, (sp) => I.applyInduction(sp, SAMI, id, F.SOC, ["x"], noStaff));
      out["publish_member"] = await call(tx, (sp) => I.publishRound(sp, MEHR, id));
      out["publish"] = await step(tx, (sp) => I.publishRound(sp, OSMAN, id));
      out["publish_again"] = await call(tx, (sp) => I.publishRound(sp, OSMAN, id));
      out["resave_open"] = await call(tx, save(OSMAN, F.SOC, ROUND(t!.week, { id })));
      const [role] = await tx<{ id: string }[]>`select id::text from community.induction_roles where round_id = ${id} and position = 1`;
      const apply = (me: string, roleId: string, answers: string[]) => (sp: Tx) => I.applyInduction(sp, me, id, roleId, answers, noStaff);
      out["apply_no_role"] = await call(tx, apply(SAMI, F.SOC, ["A line follower."]));
      out["apply_no_answer"] = await call(tx, apply(SAMI, role!.id, [" "]));
      out["apply_other_university"] = await call(tx, apply(ULA, role!.id, ["A drone."]));
      const a1 = okStep((out["apply"] = await step(tx, apply(SAMI, role!.id, ["A line-following robot."]))));
      out["apply_again"] = await call(tx, apply(SAMI, role!.id, ["Another robot."]));
      const a2 = ok(await call(tx, apply(NIDA, role!.id, ["A solar lamp."])));
      ok(await call(tx, apply(GUL, role!.id, ["A weather station."])));
      out["page_officer"] = await call(tx, (sp) => I.roundPage(sp, OSMAN, id, noStaff, fill));
      out["page_applicant"] = await call(tx, (sp) => I.roundPage(sp, SAMI, id, noStaff, fill));
      const decide = (me: string, a: string, action: string, note: string | null) => (sp: Tx) => I.decideApplication(sp, me, a, action, note);
      out["decide_member"] = await call(tx, decide(MEHR, a1, "accept", null));
      out["decide_unknown_action"] = await call(tx, decide(OSMAN, a1, "maybe", null));
      out["shortlist"] = await step(tx, decide(OSMAN, a1, "shortlist", null));
      out["accept"] = await step(tx, decide(OSMAN, a1, "accept", " Welcome aboard "));
      out["accept_again"] = await call(tx, decide(OSMAN, a1, "accept", null));
      out["accept_full"] = await call(tx, decide(OSMAN, a2, "accept", null));
      out["decline"] = await step(tx, decide(OSMAN, a2, "decline", "  "));
      await tx`update community.induction_rounds set deadline = now() - interval '15 days' where id = ${id}`;
      out["tick"] = await job(tx, (sp) => I.societyTick(sp));
      out["tick_again"] = await job(tx, (sp) => I.societyTick(sp));
      return out;
    }));
});

describe("staff.json", () => {
  it("review", () =>
    replay(sql, "staff", "review", async (tx) => {
      const out: Json = {};
      const staff = <T>(run: () => Promise<T>) => asStaff(TARIQ, "aal2", run);
      out["queue_aal1"] = await call(tx, (sp) => asStaff(TARIQ, "aal1", () => St.opsSocieties(sp, TARIQ, "open", fill)));
      out["queue_student"] = await call(tx, (sp) => asStaff(SAMI, "aal2", () => St.opsSocieties(sp, SAMI, "open", fill)));
      out["queue"] = await call(tx, (sp) => staff(() => St.opsSocieties(sp, TARIQ, "open", fill)));
      out["queue_decided"] = await call(tx, (sp) => staff(() => St.opsSocieties(sp, TARIQ, "decided", fill)));
      out["case"] = await call(tx, (sp) => staff(() => St.opsSocietyCase(sp, TARIQ, F.PENDING, fill)));
      out["case_unknown"] = await call(tx, (sp) => staff(() => St.opsSocietyCase(sp, TARIQ, F.SOC, fill)));
      out["claim"] = await step(tx, (sp) => staff(() => St.claimSociety(sp, TARIQ, F.PENDING, true)));
      out["claim_again"] = await step(tx, (sp) => staff(() => St.claimSociety(sp, TARIQ, F.PENDING, true)));
      out["release"] = await step(tx, (sp) => staff(() => St.claimSociety(sp, TARIQ, F.PENDING, false)));
      const decide = (soc: string, action: string, reason: string | null) => (sp: Tx) => staff(() => St.decideSociety(sp, TARIQ, soc, action, reason));
      out["more_info_no_reason"] = await call(tx, decide(F.PENDING, "more_info", " "));
      out["more_info"] = await step(tx, decide(F.PENDING, "more_info", "Add the notice from the students office"));
      out["approve_more_info"] = await call(tx, decide(F.PENDING, "approve", null));
      await tx`update community.societies set status = 'pending' where id = ${F.PENDING}`;
      await tx`update community.society_requests set status = 'pending' where society_id = ${F.PENDING}`;
      out["approve"] = await step(tx, decide(F.PENDING, "approve", null));
      out["page_after_approve"] = await call(tx, (sp) => S.societyPage(sp, NIDA, F.PENDING_SLUG, noStaff, fill));
      out["unknown_action"] = await call(tx, decide(F.SOC, "promote", "Because it is good"));
      out["suspend"] = await step(tx, decide(F.SOC, "suspend", "Fees collected without receipts"));
      out["pause_paid_suspended"] = await call(tx, decide(F.SOC, "pause_paid", "Hold on"));
      out["reinstate"] = await step(tx, decide(F.SOC, "reinstate", null));
      out["pause_paid"] = await step(tx, decide(F.SOC, "pause_paid", "Receipts look copied"));
      out["resume_paid"] = await step(tx, decide(F.SOC, "resume_paid", null));
      out["reject_verified"] = await call(tx, decide(F.SOC, "reject", "Not a society"));
      return out;
    }));

  it("reject", () =>
    replay(sql, "staff", "reject", async (tx) => {
      const out: Json = {};
      out["reject"] = await step(tx, (sp) => asStaff(TARIQ, "aal2", () => St.decideSociety(sp, TARIQ, F.PENDING, "reject", "We could not confirm it")));
      out["name_free"] = await call(tx, async (sp) => fill(await S.nameCheck(sp, SAMI, F.PENDING_NAME)));
      out["mine"] = await call(tx, (sp) => S.mySocietyRequests(sp, NIDA));
      out["request_again"] = await step(tx, request(NIDA, NEW_SOCIETY(F.PENDING_NAME)));
      return out;
    }));
});

void uploads;
