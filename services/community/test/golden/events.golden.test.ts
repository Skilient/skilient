/**
 * Golden replays of events.json, registrations.json, checkin.json, closeout.json and payments.json
 * (packages/testing/test/community.golden.test.ts), under the rules in replay.ts. Publishing makes the event's
 * post in content (a call the handler makes); the replay hands the store a post id, as content would.
 */
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, it } from "vitest";
import * as Ck from "../../src/store/checkin";
import * as Co from "../../src/store/closeout";
import { noStaff } from "../../src/store/db";
import * as E from "../../src/store/events";
import * as P from "../../src/store/payments";
import * as R from "../../src/store/registrations";
import {
  byName,
  call,
  cohostSociety,
  endEvent,
  F,
  files,
  fill,
  job,
  ok,
  okStep,
  paymentMethod,
  replay,
  resolve,
  resolveEmail,
  seedEvent,
  startWorld,
  step,
  tickets,
  uploads,
  type Tx,
} from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

const { PRIYA, OSMAN, MEHR, SAMI, NIDA, ULA, GUL } = F;
type Json = Record<string, unknown>;

/** save_society_event's jsonb, read as the function read it (defaults as there). */
function eventInput(p: Json): E.EventInput {
  const team = p["team"] as { min: number; max: number } | undefined;
  const elig = (p["eligibility"] as Json | undefined) ?? {};
  return {
    id: (p["id"] as string | undefined) ?? null,
    type: String(p["type"]),
    title: String(p["title"] ?? ""),
    description: String(p["description"] ?? ""),
    cover_path: (p["cover_path"] as string | undefined) ?? null,
    location: String(p["location"] ?? ""),
    link: String(p["link"] ?? ""),
    sessions: ((p["sessions"] as Json[] | undefined) ?? []).map((s) => ({ title: String(s["title"] ?? ""), starts_at: String(s["starts_at"]), ends_at: String(s["ends_at"]) })),
    ticket_types: ((p["ticket_types"] as Json[] | undefined) ?? []).map((t) => ({ name: String(t["name"]), capacity: Number(t["capacity"]), price_pkr: (t["price_pkr"] as number | undefined) ?? null })),
    eligibility: { scope: String(elig["scope"] ?? "university"), departments: (elig["departments"] as string[] | undefined) ?? [], batches: (elig["batches"] as number[] | undefined) ?? [] },
    team: team ? { min: team.min, max: team.max } : null,
    approval_mode: String(p["approval_mode"] ?? "automatic"),
    registration_opens_at: (p["registration_opens_at"] as string | undefined) ?? null,
    registration_closes_at: (p["registration_closes_at"] as string | undefined) ?? null,
    questions: ((p["questions"] as Json[] | undefined) ?? []).map((q) => ({
      label: String(q["label"]),
      kind: String(q["kind"] ?? "short"),
      options: (q["options"] as string[] | undefined) ?? [],
      required: Boolean(q["required"]),
    })),
    record_kinds: (p["record_kinds"] as string[] | undefined) ?? null,
    completed_min: (p["completed_min"] as number | undefined) ?? null,
    volunteer_hours: Boolean(p["volunteer_hours"]),
    refund_policy: String(p["refund_policy"] ?? "none"),
    refund_days: (p["refund_days"] as number | undefined) ?? null,
    cohosts: (p["cohosts"] as string[] | undefined) ?? [],
  };
}

async function times(tx: Tx): Promise<Record<string, string>> {
  const [r] = await tx<Record<string, Date>[]>`
    select now() + interval '3 days' as s1, now() + interval '3 days 2 hours' as e1, now() + interval '4 days' as s2,
           now() + interval '4 days 3 hours' as e2`;
  return Object.fromEntries(Object.entries(r!).map(([k, v]) => [k, v.toISOString()]));
}
const NEW_EVENT = (t: Record<string, string>, extra: Json = {}): Json => ({
  type: "workshop",
  title: "  Robot arena  ",
  description: " Build a sumo robot in a weekend. ",
  location: " Hall A ",
  sessions: [
    { title: "Build day", starts_at: t["s2"], ends_at: t["e2"] },
    { starts_at: t["s1"], ends_at: t["e1"] },
  ],
  ticket_types: [{ name: " Builder ", capacity: 20 }, { name: "Spectator", capacity: 50 }],
  eligibility: { scope: "groups", departments: ["Computer Science"], batches: [2027] },
  team: { min: 2, max: 3 },
  approval_mode: "automatic",
  questions: [{ label: " Team experience? ", kind: "single", options: ["None", " Some ", ""], required: true }],
  record_kinds: ["attended", "completed", "result"],
  completed_min: 2,
  volunteer_hours: true,
  refund_policy: "none",
  ...extra,
});
const save = (me: string, soc: string, p: Json) => (sp: Tx) => E.saveEvent(sp, me, soc, eventInput(p), files, tickets.seal);
const publish = (me: string, event: string) => async (sp: Tx) => {
  await E.publishChecks(sp, me, event);
  const [p] = await sp<{ id: string }[]>`select gen_random_uuid()::text as id`;
  await E.markPublished(sp, me, event, p!.id);
};
const reg = (me: string | null, p: Json) => (sp: Tx) =>
  R.register(sp, me, F.EVENT, { ticket_type_id: (p["ticket_type_id"] as string | undefined) ?? null, answers: (p["answers"] as unknown[]) ?? [], team: (p["team"] as R.RegisterInput["team"]) ?? null });
const answer = (a: string, extra: Json = {}) => ({ ticket_type_id: F.TICKET, answers: [a], ...extra });

describe("events.json", () => {
  it("save_publish", () =>
    replay(sql, "events", "save_publish", async (tx) => {
      const out: Json = {};
      const t = await times(tx);
      await cohostSociety(tx);
      out["save_member"] = await call(tx, save(MEHR, F.SOC, NEW_EVENT(t)));
      out["save_no_sessions"] = await call(tx, save(OSMAN, F.SOC, NEW_EVENT(t, { sessions: [] })));
      out["save_no_tickets"] = await call(tx, save(OSMAN, F.SOC, NEW_EVENT(t, { ticket_types: [] })));
      out["save_cheap"] = await call(tx, save(OSMAN, F.SOC, NEW_EVENT(t, { ticket_types: [{ name: "Seat", capacity: 5, price_pkr: 50 }] })));
      out["save_bad_scope"] = await call(tx, save(OSMAN, F.SOC, NEW_EVENT(t, { eligibility: { scope: "city" } })));
      out["save_bad_cover"] = await call(tx, save(OSMAN, F.SOC, NEW_EVENT(t, { cover_path: `${F.PENDING}/97d00000-0000-4000-8000-000000000003.webp` })));
      out["save_pending_society"] = await call(tx, save(NIDA, F.PENDING, NEW_EVENT(t)));
      const id = okStep((out["created"] = await step(tx, save(OSMAN, F.SOC, NEW_EVENT(t, { cover_path: F.COVER, cohosts: [F.COHOST_SLUG, F.PENDING_SLUG, F.SOC_SLUG] })))));
      out["edit_payload"] = await call(tx, (sp) => E.editPayload(sp, PRIYA, id));
      out["edit_payload_student"] = await call(tx, (sp) => E.editPayload(sp, MEHR, id));
      out["page_draft_student"] = await call(tx, (sp) => E.eventPage(sp, MEHR, id, fill));
      out["cohost_stranger"] = await call(tx, (sp) => E.answerCohost(sp, MEHR, id, F.COHOST, true));
      out["cohost_accept"] = await step(tx, (sp) => E.answerCohost(sp, SAMI, id, F.COHOST, true));
      out["cohost_again"] = await call(tx, (sp) => E.answerCohost(sp, SAMI, id, F.COHOST, false));
      out["publish_cohost"] = await call(tx, publish(SAMI, id));
      out["publish"] = await step(tx, publish(OSMAN, id));
      out["publish_again"] = await call(tx, publish(OSMAN, id));
      out["edited"] = await step(
        tx,
        save(OSMAN, F.SOC, NEW_EVENT(t, { id, title: "Robot arena", location: "Hall B", ticket_types: [{ name: "Builder", capacity: 25 }], questions: [] })),
      );
      out["list_officer"] = await call(tx, async (sp) => fill(await E.societyEventList(sp, PRIYA, F.SOC, noStaff)));
      out["list_cohost"] = await call(tx, async (sp) => fill(await E.societyEventList(sp, SAMI, F.COHOST, noStaff)));
      out["cancel_member"] = await call(tx, (sp) => E.cancelEvent(sp, MEHR, id, "x", P.cancelledRefunds));
      out["cancel"] = await step(tx, (sp) => E.cancelEvent(sp, OSMAN, id, " The hall flooded. ", P.cancelledRefunds));
      out["cancel_again"] = await call(tx, (sp) => E.cancelEvent(sp, OSMAN, id, "again", P.cancelledRefunds));
      out["edit_cancelled"] = await call(tx, save(OSMAN, F.SOC, NEW_EVENT(t, { id })));
      return out;
    }));

  it("publish_refusals", () =>
    replay(sql, "events", "publish_refusals", async (tx) => {
      const out: Json = {};
      const t = await times(tx);
      const paid = ok(await call(tx, save(OSMAN, F.SOC, NEW_EVENT(t, { ticket_types: [{ name: "Seat", capacity: 5, price_pkr: 500 }] }))));
      out["paid_no_details"] = await call(tx, publish(OSMAN, paid));
      await paymentMethod(tx);
      await tx`update community.societies set paid_paused = true where id = ${F.SOC}`;
      out["paid_paused"] = await call(tx, publish(OSMAN, paid));
      await tx`update community.events set starts_at = now() - interval '1 minute' where id = ${paid}`;
      out["started"] = await call(tx, publish(OSMAN, paid));
      return out;
    }));

  it("pages", () =>
    replay(sql, "events", "pages", async (tx) => {
      const out: Json = {};
      await seedEvent(tx, { extra: `eligibility = '{"scope": "groups", "departments": ["Computer Science"], "batches": [2027]}'` });
      await tx`insert into community.friendships (user_id_a, user_id_b) values (least(${SAMI}::uuid, ${NIDA}::uuid), greatest(${SAMI}::uuid, ${NIDA}::uuid))`;
      await tx`insert into community.event_registrations (id, event_id, user_id, ticket_type_id, status) values (gen_random_uuid(), ${F.EVENT}, ${NIDA}, ${F.TICKET}, 'confirmed')`;
      const list = (me: string, when: string, type: string | null) => async (sp: Tx) => fill(await E.societyEvents(sp, me, when, type));
      out["upcoming"] = await call(tx, list(SAMI, "upcoming", null));
      out["upcoming_type"] = await call(tx, list(SAMI, "upcoming", "talk"));
      out["mine"] = await call(tx, list(NIDA, "mine", null));
      out["past"] = await call(tx, list(SAMI, "past", null));
      out["unknown_list"] = await call(tx, list(SAMI, "soon", null));
      out["other_university"] = await call(tx, list(ULA, "upcoming", null));
      const page = (me: string) => (sp: Tx) => E.eventPage(sp, me, F.EVENT, fill);
      out["page_eligible"] = await call(tx, page(SAMI));
      out["page_wrong_group"] = await call(tx, page(MEHR));
      out["page_registered"] = await call(tx, page(NIDA));
      out["page_officer"] = await call(tx, page(OSMAN));
      out["page_other_university"] = await call(tx, page(ULA));
      out["page_graduate"] = await call(tx, page(GUL));
      await tx`update community.events set eligibility = '{"scope": "all"}', scope = 'global' where id = ${F.EVENT}`;
      out["page_other_university_all"] = await call(tx, page(ULA));
      out["other_university_all"] = await call(tx, list(ULA, "upcoming", null));
      return out;
    }));
});

describe("registrations.json", () => {
  it("seats", () =>
    replay(sql, "registrations", "seats", async (tx) => {
      const out: Json = {};
      await seedEvent(tx, { capacity: 2 });
      out["no_answer"] = await call(tx, reg(SAMI, answer(" ")));
      out["long_answer"] = await call(tx, reg(SAMI, answer("x".repeat(2001))));
      out["no_ticket"] = await call(tx, reg(SAMI, { ticket_type_id: F.SOC, answers: ["Yes"] }));
      out["first"] = await step(tx, reg(SAMI, answer("Once, in school.")));
      out["again"] = await call(tx, reg(SAMI, answer("Twice.")));
      out["second"] = await step(tx, reg(NIDA, answer("No.")));
      out["waitlisted_1"] = await step(tx, reg(MEHR, answer("Yes.")));
      out["waitlisted_2"] = await step(tx, reg(OSMAN, answer("Yes.")));
      out["graduate"] = await call(tx, reg(GUL, answer("Yes.")));
      out["other_university"] = await call(tx, reg(ULA, answer("Yes.")));
      out["page_waitlisted"] = await call(tx, (sp) => E.eventPage(sp, MEHR, F.EVENT, fill));
      out["cancel"] = await step(tx, (sp) => R.cancelRegistration(sp, SAMI, F.EVENT));
      out["cancel_again"] = await call(tx, (sp) => R.cancelRegistration(sp, SAMI, F.EVENT));
      out["again_after_cancel"] = await step(tx, reg(SAMI, answer("Back again.")));
      out["tickets"] = await call(tx, (sp) => R.myTickets(sp, MEHR, fill));
      out["tickets_cancelled"] = await call(tx, (sp) => R.myTickets(sp, SAMI, fill));
      out["unknown_event"] = await call(tx, (sp) => R.register(sp, SAMI, F.SOC, { ticket_type_id: F.TICKET, answers: ["x"], team: null }));
      out["signed_out"] = await call(tx, reg(null, answer("x")), "register_event");
      return out;
    }));

  it("rules", () =>
    replay(sql, "registrations", "rules", async (tx) => {
      const out: Json = {};
      await seedEvent(tx, { capacity: 1, required: false, extra: `approval_mode = 'manual', team_min = 2, team_max = 2` });
      const none = { ticket_type_id: F.TICKET, answers: [] };
      out["no_team"] = await call(tx, reg(SAMI, none));
      out["bad_code"] = await call(tx, reg(SAMI, { ...none, team: { code: "ZZZZZZ" } }));
      out["captain"] = await step(tx, reg(SAMI, { ...none, team: { create: " Wren Bots " } }));
      const [c] = await tx<{ code: string }[]>`select code from community.event_teams where event_id = ${F.EVENT}`;
      out["joined"] = await step(tx, reg(NIDA, { ...none, team: { code: c!.code.toLowerCase() } }));
      out["team_full"] = await call(tx, reg(MEHR, { ...none, team: { code: c!.code } }));
      out["page_captain"] = await call(tx, (sp) => E.eventPage(sp, SAMI, F.EVENT, fill));
      const decide = (me: string, user: string, accept: boolean) => (sp: Tx) => R.decideRegistration(sp, me, F.EVENT, user, accept);
      out["decide_member"] = await call(tx, decide(MEHR, SAMI, true));
      out["approve"] = await step(tx, decide(OSMAN, SAMI, true));
      out["approve_full"] = await step(tx, decide(OSMAN, NIDA, true));
      out["approve_again"] = await call(tx, decide(OSMAN, NIDA, true));
      out["decline"] = await step(tx, decide(OSMAN, NIDA, false));
      await tx`update community.events set registration_opens_at = now() + interval '1 day' where id = ${F.EVENT}`;
      out["not_open"] = await call(tx, reg(MEHR, { ...none, team: { create: "Late" } }));
      await tx`update community.events set registration_opens_at = null, registration_closes_at = now() - interval '1 minute' where id = ${F.EVENT}`;
      out["closed"] = await call(tx, reg(MEHR, { ...none, team: { create: "Late" } }));
      await tx`update community.events set status = 'cancelled' where id = ${F.EVENT}`;
      out["cancelled"] = await call(tx, reg(MEHR, none));
      await tx`update community.events set status = 'draft' where id = ${F.EVENT}`;
      out["draft"] = await call(tx, reg(MEHR, none));
      await endEvent(tx);
      out["ended"] = await call(tx, reg(MEHR, none));
      return out;
    }));
});

describe("checkin.json", () => {
  it("door", () =>
    replay(sql, "checkin", "door", async (tx) => {
      const out: Json = {};
      await seedEvent(tx, { capacity: 3, startsIn: "1 hour" });
      ok(await call(tx, reg(SAMI, answer("Once, in school."))));
      ok(await call(tx, reg(NIDA, answer("No."))));
      await tx`update community.event_registrations set status = 'pending' where event_id = ${F.EVENT} and user_id = ${NIDA}`;
      const ticket = ok((out["ticket"] = await call(tx, (sp) => R.eventTicket(sp, SAMI, F.EVENT, tickets, fill))));
      out["ticket_pending"] = await call(tx, (sp) => R.eventTicket(sp, NIDA, F.EVENT, tickets, fill));
      out["ticket_none"] = await call(tx, (sp) => R.eventTicket(sp, MEHR, F.EVENT, tickets, fill));
      const payload = ticket["payload"] as string;
      const scan = (me: string, p: string) => (sp: Tx) => Ck.scan(sp, me, F.EVENT, null, p, tickets, fill);
      out["scan_member"] = await call(tx, scan(MEHR, payload));
      out["scan"] = await step(tx, scan(OSMAN, payload));
      out["scan_again"] = await step(tx, scan(PRIYA, payload));
      out["scan_forged"] = await call(tx, scan(OSMAN, `${payload.slice(0, -4)}0000`));
      out["scan_garbage"] = await call(tx, scan(OSMAN, "hello"));
      const [nidaReg] = await tx<{ id: string }[]>`select id::text from community.event_registrations where event_id = ${F.EVENT} and user_id = ${NIDA}`;
      out["scan_pending"] = await call(tx, scan(OSMAN, await tickets.payload(tx, F.EVENT, nidaReg!.id, NIDA)));
      const search = (q: string) => (sp: Tx) => Ck.search(sp, OSMAN, F.EVENT, q, byName, fill);
      out["search_short"] = await call(tx, search("w"));
      out["search"] = await call(tx, search("wren"));
      out["search_username"] = await call(tx, search("cm_ni"));
      out["person_registered"] = await step(tx, (sp) => Ck.person(sp, OSMAN, F.EVENT, null, SAMI, fill));
      out["person_walk_in"] = await step(tx, (sp) => Ck.person(sp, OSMAN, F.EVENT, F.SESSION, MEHR, fill));
      out["person_graduate"] = await call(tx, (sp) => Ck.person(sp, OSMAN, F.EVENT, null, GUL, fill));
      const email = (address: string) => (sp: Tx) => Ck.byEmail(sp, OSMAN, F.EVENT, null, address, resolveEmail, fill);
      out["email_invalid"] = await call(tx, email("not-an-email"));
      out["email_other_domain"] = await call(tx, email("walkin@comm-b.test"));
      out["email_stranger"] = await step(tx, email(" Walkin@Comm-A.test "));
      out["email_stranger_again"] = await step(tx, email("walkin@comm-a.test"));
      out["email_account"] = await step(tx, email(F.EMAIL[NIDA]!));
      out["headcount"] = await call(tx, (sp) => Ck.headcountPage(sp, OSMAN, F.EVENT, null));
      out["headcount_student"] = await call(tx, (sp) => Ck.headcountPage(sp, SAMI, F.EVENT, null));
      out["staff_add"] = await step(tx, (sp) => Co.addStaff(sp, OSMAN, F.EVENT, resolve(" CM_ULA ")));
      out["staff_unknown"] = await call(tx, (sp) => Co.addStaff(sp, OSMAN, F.EVENT, resolve("cm_nobody")));
      out["staff_scan"] = await call(tx, scan(ULA, payload));
      out["staff_remove"] = await step(tx, (sp) => Co.removeStaff(sp, OSMAN, F.EVENT, ULA));
      out["message_short"] = await call(tx, (sp) => Co.messageRegistrants(sp, OSMAN, F.EVENT, "hi"));
      out["message"] = await step(tx, (sp) => Co.messageRegistrants(sp, OSMAN, F.EVENT, "  Doors open at 5. Bring your ticket.  "));
      out["manage"] = await call(tx, (sp) => Co.eventManage(sp, PRIYA, F.EVENT, fill));
      out["manage_student"] = await call(tx, (sp) => Co.eventManage(sp, SAMI, F.EVENT, fill));
      out["cancel_checked_in"] = await call(tx, (sp) => R.cancelRegistration(sp, SAMI, F.EVENT));
      out["code"] = await call(tx, (sp) => Ck.eventCode(sp, OSMAN, F.EVENT, tickets));
      const token = (await tickets.codes(tx, F.EVENT)).current;
      out["self_bad"] = await call(tx, (sp) => Ck.selfCheckIn(sp, SAMI, F.EVENT, "000000000000000000000000", tickets, fill));
      out["self"] = await step(tx, (sp) => Ck.selfCheckIn(sp, SAMI, F.EVENT, token, tickets, fill));
      out["self_unregistered"] = await call(tx, (sp) => Ck.selfCheckIn(sp, ULA, F.EVENT, token, tickets, fill));
      return out;
    }));
});

describe("closeout.json", () => {
  it("closeout", () =>
    replay(sql, "closeout", "closeout", async (tx) => {
      const out: Json = {};
      await seedEvent(tx, { capacity: 5, required: false, extra: `record_kinds = '{attended,completed,result}', volunteer_hours = true` });
      for (const u of [SAMI, NIDA, MEHR]) ok(await call(tx, reg(u, { ticket_type_id: F.TICKET, answers: [] })));
      const fix = (user: string, present: boolean, why: string) => (sp: Tx) => Co.fixAttendance(sp, OSMAN, F.EVENT, null, user, present, why);
      out["fix_too_early"] = await call(tx, fix(SAMI, true, "Came late"));
      out["issue_too_early"] = await call(tx, (sp) => Co.issueEntries(sp, OSMAN, F.EVENT));
      ok(await call(tx, (sp) => Ck.person(sp, OSMAN, F.EVENT, null, SAMI, fill)));
      ok(await call(tx, (sp) => Ck.person(sp, OSMAN, F.EVENT, null, NIDA, fill)));
      ok(await call(tx, (sp) => Ck.byEmail(sp, OSMAN, F.EVENT, null, "walkin@comm-a.test", resolveEmail, fill)));
      await endEvent(tx);
      out["feedback_open_page"] = await call(tx, (sp) => E.eventPage(sp, SAMI, F.EVENT, fill));
      out["fix_no_reason"] = await call(tx, fix(MEHR, true, " "));
      out["fix_add"] = await step(tx, fix(MEHR, true, "Signed the paper list"));
      await tx`update community.event_checkins set checked_in_at = now() - interval '1 minute' where event_id = ${F.EVENT} and user_id = ${MEHR}`;
      out["fix_remove"] = await step(tx, fix(NIDA, false, "Left after ten minutes"));
      out["fix_remove_again"] = await call(tx, fix(NIDA, false, "Left after ten minutes"));
      out["fix_unregistered"] = await call(tx, fix(ULA, true, "Was there"));
      const result = (user: string, place: number | null, label: string | null) => (sp: Tx) => Co.setResult(sp, OSMAN, F.EVENT, user, null, place, label);
      out["result"] = await step(tx, result(SAMI, 1, " Winner "));
      out["result_again"] = await step(tx, result(SAMI, 2, null));
      out["result_unregistered"] = await call(tx, result(ULA, 1, null));
      out["result_cleared"] = await step(tx, result(MEHR, null, null));
      out["hours_over"] = await call(tx, (sp) => Co.logHours(sp, OSMAN, F.EVENT, MEHR, 5));
      out["hours"] = await step(tx, (sp) => Co.logHours(sp, OSMAN, F.EVENT, MEHR, 1.5));
      out["page"] = await call(tx, (sp) => Co.closeoutPage(sp, PRIYA, F.EVENT, fill));
      out["page_student"] = await call(tx, (sp) => Co.closeoutPage(sp, SAMI, F.EVENT, fill));
      out["rows"] = await call(tx, (sp) => Co.attendeesRows(sp, PRIYA, F.EVENT, fill));
      out["issue"] = await step(tx, (sp) => Co.issueEntries(sp, OSMAN, F.EVENT));
      out["issue_again"] = await call(tx, (sp) => Co.issueEntries(sp, OSMAN, F.EVENT));
      out["feedback"] = await step(tx, (sp) => Co.submitFeedback(sp, SAMI, F.EVENT, 4, "  Great irons.  "));
      out["feedback_again"] = await call(tx, (sp) => Co.submitFeedback(sp, SAMI, F.EVENT, 5, null));
      out["feedback_stranger"] = await call(tx, (sp) => Co.submitFeedback(sp, ULA, F.EVENT, 5, null));
      out["manage"] = await call(tx, (sp) => Co.eventManage(sp, PRIYA, F.EVENT, fill));
      return out;
    }));

  it("jobs", () =>
    replay(sql, "closeout", "jobs", async (tx) => {
      const out: Json = {};
      await seedEvent(tx, { capacity: 5, startsIn: "30 minutes", required: false });
      for (const u of [SAMI, NIDA]) ok(await call(tx, reg(u, { ticket_type_id: F.TICKET, answers: [] })));
      out["remind_1h"] = await job(tx, Co.eventTick);
      out["remind_again"] = await job(tx, Co.eventTick);
      await tx`update community.events set starts_at = now() - interval '5 minutes' where id = ${F.EVENT}`;
      out["live"] = await job(tx, Co.eventTick);
      ok(await call(tx, (sp) => Ck.person(sp, OSMAN, F.EVENT, null, SAMI, fill)));
      await endEvent(tx, 80);
      await tx`update community.events set status = 'live' where id = ${F.EVENT}`;
      out["ended"] = await job(tx, Co.eventTick);
      out["closeout"] = await job(tx, Co.closeoutTick);
      out["closeout_again"] = await job(tx, Co.closeoutTick);
      return out;
    }));
});

describe("payments.json", () => {
  const method = (p: Json): P.MethodInput => ({
    action: String(p["action"] ?? "add"),
    replaces_id: (p["replaces_id"] as string | undefined) ?? null,
    kind: String(p["kind"] ?? ""),
    bank_name: String(p["bank_name"] ?? ""),
    account_title: String(p["account_title"] ?? ""),
    account_number: String(p["account_number"] ?? ""),
  });

  it("details", () =>
    replay(sql, "payments", "details", async (tx) => {
      const out: Json = {};
      const propose = (me: string, soc: string, p: Json) => (sp: Tx) => P.proposeMethod(sp, me, soc, method(p));
      const bank = { action: "add", kind: "bank", bank_name: " Wren Bank ", account_title: " Wren Robotics Society ", account_number: " pk00wren0000001234567890 " };
      out["propose_member"] = await call(tx, propose(MEHR, F.SOC, bank));
      out["propose_unknown"] = await call(tx, propose(PRIYA, F.SOC, { ...bank, action: "swap" }));
      out["propose_pending"] = await call(tx, propose(NIDA, F.PENDING, bank));
      const m1 = okStep((out["propose"] = await step(tx, propose(PRIYA, F.SOC, bank))));
      out["page"] = await call(tx, (sp) => P.paymentDetailsPage(sp, OSMAN, F.SOC, fill));
      out["confirm_own"] = await call(tx, (sp) => P.confirmMethod(sp, PRIYA, m1, true));
      out["confirm"] = await step(tx, (sp) => P.confirmMethod(sp, OSMAN, m1, true));
      out["confirm_again"] = await call(tx, (sp) => P.confirmMethod(sp, OSMAN, m1, true));
      const m2 = okStep(
        (out["propose_replace"] = await step(tx, propose(OSMAN, F.SOC, { action: "replace", replaces_id: m1, kind: "jazzcash", account_title: "Wren Robotics", account_number: "03001234567" }))),
      );
      out["reject"] = await step(tx, (sp) => P.confirmMethod(sp, PRIYA, m2, false));
      const m3 = okStep((out["propose_remove"] = await step(tx, propose(OSMAN, F.SOC, { action: "remove", replaces_id: m1 }))));
      out["remove"] = await step(tx, (sp) => P.confirmMethod(sp, PRIYA, m3, true));
      return out;
    }));

  it("tickets", () =>
    replay(sql, "payments", "tickets", async (tx) => {
      const out: Json = {};
      await paymentMethod(tx);
      await seedEvent(tx, { capacity: 2, price: 1500, required: false, startsIn: "5 days", extra: `refund_policy = 'until', refund_days = 3` });
      const none = { ticket_type_id: F.TICKET, answers: [] };
      out["held"] = await step(tx, reg(SAMI, none));
      out["payment"] = await call(tx, (sp) => P.ticketPayment(sp, SAMI, F.EVENT));
      out["payment_none"] = await call(tx, (sp) => P.ticketPayment(sp, NIDA, F.EVENT));
      out["ticket_held"] = await call(tx, (sp) => R.eventTicket(sp, SAMI, F.EVENT, tickets, fill));
      const regOf = async (u: string) => (await tx<{ id: string }[]>`select id::text from community.event_registrations where event_id = ${F.EVENT} and user_id = ${u}`)[0]!.id;
      const sami = await regOf(SAMI);
      const path = (r: string, n: string) => `${F.EVENT}/${r}/97f00000-0000-4000-8000-0000000000${n}.webp`;
      const HASH = "a".repeat(64);
      const submit = (me: string, r: string, p: string, hash: string, phash: string, txn: string) => (sp: Tx) => P.submitReceipt(sp, me, r, p, hash, phash, txn, files);
      out["receipt_missing"] = await call(tx, submit(SAMI, sami, path(sami, "01"), HASH, "0f0f0f0f0f0f0f0f", "TXN-1001"));
      uploads.add(path(sami, "01"));
      out["receipt_stranger"] = await call(tx, submit(NIDA, sami, path(sami, "01"), HASH, "0f0f0f0f0f0f0f0f", "TXN-1001"));
      out["receipt"] = await step(tx, submit(SAMI, sami, path(sami, "01"), HASH, "0f0f0f0f0f0f0f0f", " TXN-1001 "));
      out["receipt_again"] = await call(tx, submit(SAMI, sami, path(sami, "01"), HASH, "0f0f0f0f0f0f0f0f", "TXN-1001"));
      await tx`update community.event_payments set uploaded_at = now() - interval '1 hour' where event_id = ${F.EVENT} and user_id = ${SAMI}`;
      ok(await call(tx, reg(NIDA, none)));
      const nida = await regOf(NIDA);
      uploads.add(path(nida, "02"));
      ok(await call(tx, submit(NIDA, nida, path(nida, "02"), "b".repeat(64), "0f0f0f0f0f0f0f0e", "txn-1001")));
      out["waitlisted"] = await step(tx, reg(MEHR, none));
      out["review_list"] = await call(tx, (sp) => P.paymentsReview(sp, OSMAN, F.EVENT, fill));
      out["review_list_student"] = await call(tx, (sp) => P.paymentsReview(sp, SAMI, F.EVENT, fill));
      const pay = async (u: string) => (await tx<{ id: string }[]>`select id::text from community.event_payments where event_id = ${F.EVENT} and user_id = ${u}`)[0]!.id;
      const pSami = await pay(SAMI);
      const pNida = await pay(NIDA);
      out["reject_no_reason"] = await call(tx, (sp) => P.reviewPayment(sp, OSMAN, pNida, false, " "));
      out["reject"] = await step(tx, (sp) => P.reviewPayment(sp, OSMAN, pNida, false, "Amount doesn't match"));
      out["approve"] = await step(tx, (sp) => P.reviewPayment(sp, OSMAN, pSami, true, null));
      out["approve_again"] = await call(tx, (sp) => P.reviewPayment(sp, OSMAN, pSami, true, null));
      out["ticket_paid"] = await call(tx, (sp) => R.eventTicket(sp, SAMI, F.EVENT, tickets, fill));
      out["issue_not_review"] = await call(tx, (sp) => P.raiseIssue(sp, SAMI, sami));
      out["cancel_refund"] = await step(tx, (sp) => R.cancelRegistration(sp, SAMI, F.EVENT));
      out["refund_sent"] = await step(tx, (sp) => P.markRefundSent(sp, OSMAN, pSami, " Sent by bank transfer "));
      out["refund_sent_again"] = await call(tx, (sp) => P.markRefundSent(sp, OSMAN, pSami, null));
      out["refund_stranger"] = await call(tx, (sp) => P.confirmRefund(sp, NIDA, pSami, true));
      out["refund_disputed"] = await step(tx, (sp) => P.confirmRefund(sp, SAMI, pSami, false));
      await tx`update community.event_payments set refund_answered_at = now() - interval '73 hours' where id = ${pSami}`;
      out["dispute_case"] = await job(tx, P.closeoutPayments);
      await tx`update community.event_registrations set hold_expires_at = now() - interval '1 minute' where event_id = ${F.EVENT} and user_id = ${NIDA}`;
      out["hold_expired"] = await job(tx, Co.eventTick);
      out["review_after"] = await call(tx, (sp) => P.paymentsReview(sp, PRIYA, F.EVENT, fill));
      return out;
    }));

  it("issues", () =>
    replay(sql, "payments", "issues", async (tx) => {
      const out: Json = {};
      await paymentMethod(tx);
      await seedEvent(tx, { capacity: 3, price: 800, required: false, startsIn: "5 days" });
      const none = { ticket_type_id: F.TICKET, answers: [] };
      ok(await call(tx, reg(SAMI, none)));
      ok(await call(tx, reg(NIDA, none)));
      const regOf = async (u: string) => (await tx<{ id: string }[]>`select id::text from community.event_registrations where event_id = ${F.EVENT} and user_id = ${u}`)[0]!.id;
      const sami = await regOf(SAMI);
      const nida = await regOf(NIDA);
      const path = `${F.EVENT}/${sami}/97f00000-0000-4000-8000-000000000011.webp`;
      uploads.add(path);
      ok(await call(tx, (sp) => P.submitReceipt(sp, SAMI, sami, path, "c".repeat(64), "", "", files)));
      out["issue"] = await step(tx, (sp) => P.raiseIssue(sp, SAMI, sami));
      out["issue_stranger"] = await call(tx, (sp) => P.raiseIssue(sp, NIDA, sami));
      await tx`update community.event_payments set issue_raised_at = now() - interval '73 hours' where registration_id = ${sami}`;
      out["issue_case"] = await job(tx, P.closeoutPayments);
      const [pNida] = await tx<{ id: string }[]>`select id::text from community.event_payments where registration_id = ${nida}`;
      await tx`update community.event_payments set status = 'approved' where id = ${pNida!.id}`;
      await tx`update community.event_registrations set status = 'confirmed', hold_expires_at = null where id = ${nida}`;
      out["cancel_event"] = await step(tx, (sp) => E.cancelEvent(sp, PRIYA, F.EVENT, "Speaker unwell", P.cancelledRefunds));
      out["refund_received"] = await step(tx, (sp) => P.confirmRefund(sp, NIDA, pNida!.id, true));
      return out;
    }));
});
