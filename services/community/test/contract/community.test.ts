/**
 * Community's contract on both transports: the caller rules, staff refusals and audit, the hand-offs community owes
 * other services (content's "post as" and society block, people's group copies and suggestion labels, ranking's
 * Record hold, realtime's event: topic), the events left for workstreams not built yet (credentials, notify,
 * trust, media), and user.deleted.
 */
import { ConnectError } from "@connectrpc/connect";
import { CommunityService } from "@skilient/contracts/community/v1/community_pb";
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { publishAs } from "../../../content/test/contract/world";
import { societyRolesOf } from "../../../content/test/contract/world";
import { groupMembersOf } from "../../../people/test/contract/world";
import { societyCopyOf } from "../../../ranking/test/contract/world";
import { helpers, unique } from "./helpers";
import { communityWorld, drain, eventsOf, stopWorlds, tick, type CommunityWorld } from "./world";

const worlds: CommunityWorld[] = [];
let w: CommunityWorld;
afterAll(() => stopWorlds(worlds));

async function reason(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    if (e instanceof ConnectError) return refusalReason(e) ?? `code:${e.code}`;
    throw e;
  }
}

describeTransports(
  ["identity", "people", "content", "messaging", "realtime", "work", "ranking", "community"],
  (env) => {
    const h = helpers(env, () => w);
    const community = () => env().client(CommunityService);

    describe("callers", () => {
      it("batch reads are other services': SocietyCards for content and people, CanListenEvent for realtime", async () => {
        const president = await h.onboarded("Cards President");
        const s = await h.society(president);
        const asContent = env().client(CommunityService, "content");
        const cards = await asContent.societyCards({ societyIds: [s.id, crypto.randomUUID()] }, env().call());
        expect(cards.cards.map((c) => [c.id, c.name, c.slug, c.status])).toEqual([[s.id, s.name, s.slug, "verified"]]);
        expect(await reason(community().societyCards({ societyIds: [s.id] }, env().call()))).not.toBeNull();
        expect(await reason(env().client(CommunityService, "content").canListenEvent({ userId: president.id, eventId: s.id }, env().call()))).not.toBeNull();
        const { eventId } = await h.event(president, s.id);
        const rt = env().client(CommunityService, "realtime");
        expect((await rt.canListenEvent({ userId: president.id, eventId }, env().call())).allowed).toBe(true);
        expect((await rt.canListenEvent({ userId: crypto.randomUUID(), eventId }, env().call())).allowed).toBe(false);
      });

      it("refuses a signed-out reader; a repeated write returns its first reply", async () => {
        expect(await reason(community().mySocietyInvites({}, env().call()))).toBeNull();
        expect(await reason(community().societiesDirectory({}, env().call()))).toBe("not_signed_in");
        const president = await h.onboarded("Repeat President");
        const s = await h.society(president);
        const key = { ...h.read(president.token), headers: { "idempotency-key": crypto.randomUUID() } };
        const p = { societyId: s.id, title: unique("Repeat round"), deadline: new Date(Date.now() + 86_400_000).toISOString(), roles: [{ title: "Builder", seats: 1 }] };
        const a = await community().saveInductionRound(p, key);
        const b = await community().saveInductionRound(p, key);
        expect(b.roundId).toBe(a.roundId);
        const [n] = await w.community<{ n: number }[]>`select count(*)::int as n from community.induction_rounds where society_id = ${s.id}`;
        expect(n!.n).toBe(1);
      });
    });

    describe("staff review", () => {
      it("needs a trust reviewer with two-factor; every decision is audited before and after and published", async () => {
        const president = await h.onboarded("Staff President");
        const student = await h.onboarded("Staff Student");
        const { societyId } = await community().requestSociety(
          { name: unique("Wren Chess"), category: "other", about: "Chess on Thursdays for everyone at the university.", proofUrl: "https://example.org/chess", officeBearer: true },
          h.as(president.token),
        );
        const reviewer = await h.onboarded("Staff Reviewer", { staffRoles: ["trust_reviewer"] });
        const aal1 = await w.token(reviewer.id, "aal1");
        expect(await reason(community().opsSocieties({ status: "open" }, h.read(aal1)))).toBe("trust_only");
        expect(await reason(community().opsSocieties({ status: "open" }, h.read(student.token)))).toBe("trust_only");
        expect(await reason(community().decideSociety({ societyId, action: "approve", reason: "" }, h.as(aal1)))).toBe("trust_only");
        await community().decideSociety({ societyId, action: "more_info", reason: "Add the notice" }, h.as(reviewer.token));
        await community().resubmitSociety({ societyId, about: "", proofUrl: "https://example.org/chess-notice" }, h.as(president.token));
        await community().decideSociety({ societyId, action: "approve", reason: "" }, h.as(reviewer.token));
        await community().decideSociety({ societyId, action: "pause_paid", reason: "Receipts look copied" }, h.as(reviewer.token));
        const audit = await w.community<{ action: string; staff_id: string; before: Record<string, unknown>; after: Record<string, unknown> }[]>`
          select action, staff_id::text, before, after from community.audit_log where target_id = ${societyId} order by created_at`;
        expect(audit.map((a) => [a.action, a.staff_id, a.before["status"] ?? a.before["paid_paused"], a.after["status"] ?? a.after["paid_paused"]])).toEqual([
          ["society.more_info", reviewer.id, "pending", "more_info"],
          ["society.approve", reviewer.id, "pending", "verified"],
          ["society.pause_paid", reviewer.id, false, true],
        ]);
        const status = (await eventsOf(w, "society.status_changed")).filter((e) => e.payload["society_id"] === societyId).map((e) => e.payload["status"]);
        expect(status).toEqual(["more_info", "verified"]);
        expect((await eventsOf(w, "society.verified")).filter((e) => e.payload["society_id"] === societyId)).toHaveLength(1);
      });
    });

    describe("hand-offs to other services", () => {
      it("content, people and ranking learn the society, its roles and its verification; people labels shared societies", async () => {
        const president = await h.onboarded("Handoff President");
        const officer = await h.onboarded("Handoff Officer");
        const member = await h.onboarded("Handoff Member");
        const s = await h.society(president, [officer]);
        await community().setMembershipMode({ societyId: s.id, mode: "open" }, h.as(president.token));
        await community().joinSociety({ societyId: s.id }, h.as(member.token));
        await drain(w);
        // content: "post as" reads the society's verification and its officers (society.status_changed, group.member_changed with role).
        expect((await societyRolesOf(w, s.id)).map((r) => [r.user_id, r.role]).sort()).toEqual(
          [
            [president.id, "president"],
            [officer.id, "officer"],
            [member.id, "member"],
          ].sort(),
        );
        // people: the members, for suggestions; and the society's name on a suggestion (SocietyCards).
        expect(await groupMembersOf(w, "society", s.id)).toEqual([president.id, officer.id, member.id].sort());
        const pymk = await env().client(PeopleService).peopleYouMayKnow({}, h.read(member.token));
        expect(pymk.suggestions.some((x) => x.reason.includes(`In ${s.name} with you`))).toBe(true);
        // ranking: the Record hold reads verified_at.
        expect(await societyCopyOf(w, s.id)).toEqual([{ status: "verified", verified: true }]);
        // Leaving: content and people forget the member.
        await community().leaveSociety({ societyId: s.id }, h.as(member.token));
        await drain(w);
        expect((await societyRolesOf(w, s.id)).map((r) => r.user_id)).not.toContain(member.id);
        expect(await groupMembersOf(w, "society", s.id)).not.toContain(member.id);
      });

      it("a confirmed term and a closed event go to credentials (W8) with the evidence ranking will read", async () => {
        const president = await h.onboarded("Record President");
        const officer = await h.onboarded("Record Officer");
        const s = await h.society(president, [officer]);
        // The officer's term ends; the society-tick tells the president; the president confirms it.
        await w.community`update community.society_terms set term_end = current_date - 1, term_start = current_date - 200 where society_id = ${s.id} and user_id = ${officer.id}`;
        await tick(w, "society-tick");
        const [term] = await w.community<{ id: string }[]>`select id::text from community.society_terms where society_id = ${s.id} and user_id = ${officer.id}`;
        await community().confirmTerm({ termId: term!.id }, h.as(president.token));
        const terms = (await eventsOf(w, "society.term_changed")).filter((e) => e.payload["term_id"] === term!.id).map((e) => e.payload);
        expect(terms.map((t) => [t["status"], t["role"], t["self_confirmed"]])).toEqual([
          ["ended", "officer", false],
          ["confirmed", "officer", false],
        ]);
        // An event with results and hours; close-out by the job at 72 hours stores Attended and Completed only.
        const { eventId, ticketId } = await h.event(president, s.id, { seats: 5, startsIn: 3600_000 });
        await w.community`update community.events set record_kinds = '{attended,completed,result}', volunteer_hours = true where id = ${eventId}`;
        const r = await community().registerEvent({ eventId, ticketTypeId: ticketId, answersJson: "[]" }, h.as(officer.token));
        expect(r.status).toBe("confirmed");
        await community().checkInPerson({ eventId, userId: officer.id }, h.as(president.token));
        await w.community`update community.event_sessions set starts_at = now() - interval '80 hours', ends_at = now() - interval '78 hours' where event_id = ${eventId}`;
        await w.community`update community.events set starts_at = now() - interval '80 hours', ends_at = now() - interval '78 hours', status = 'ended' where id = ${eventId}`;
        await w.community`insert into community.event_results (id, event_id, user_id, place, set_by) values (gen_random_uuid(), ${eventId}, ${officer.id}, 1, ${president.id})`;
        await tick(w, "event-closeout");
        const [closed] = (await eventsOf(w, "event.closed")).filter((e) => e.payload["event_id"] === eventId);
        expect(closed!.payload).toMatchObject({ auto: true, society_verified: true, attended: [expect.objectContaining({ user_id: officer.id })], results: [], volunteer: [] });
        expect(closed!.payload["completed"]).toEqual([expect.objectContaining({ user_id: officer.id, sessions: 1 })]);
      });

      it("payment disputes go to trust (W10) and replaced files to media (W9)", async () => {
        const president = await h.onboarded("Dispute President");
        const secretary = await h.onboarded("Dispute Secretary");
        const buyer = await h.onboarded("Dispute Buyer");
        const s = await h.society(president, [secretary]);
        const { methodId } = await community().proposePaymentMethod({ societyId: s.id, action: "add", kind: "jazzcash", accountTitle: "Dispute Society", accountNumber: "03001234567" }, h.as(president.token));
        await community().confirmPaymentMethod({ methodId, accept: true }, h.as(secretary.token));
        const { eventId, ticketId } = await h.event(president, s.id, { seats: 3, price: 500 });
        const { registrationId } = await community().registerEvent({ eventId, ticketTypeId: ticketId, answersJson: "[]" }, h.as(buyer.token));
        const first = `${eventId}/${registrationId}/${crypto.randomUUID()}.webp`;
        await community().submitReceipt({ registrationId, path: first, hash: "d".repeat(64) }, h.as(buyer.token));
        const [p] = await w.community<{ id: string }[]>`select id::text from community.event_payments where registration_id = ${registrationId}`;
        await community().reviewPayment({ paymentId: p!.id, approve: false, reason: "Blurry picture" }, h.as(president.token));
        await community().submitReceipt({ registrationId, path: `${eventId}/${registrationId}/${crypto.randomUUID()}.webp`, hash: "e".repeat(64) }, h.as(buyer.token));
        expect((await eventsOf(w, "community_file.released")).filter((e) => e.payload["path"] === first).map((e) => e.payload["bucket"])).toEqual(["event-receipts"]);
        await community().raisePaymentIssue({ registrationId }, h.as(buyer.token));
        await w.community`update community.event_payments set issue_raised_at = now() - interval '73 hours' where id = ${p!.id}`;
        await tick(w, "event-closeout");
        const disputes = (await eventsOf(w, "payment.disputed")).filter((e) => e.payload["payment_id"] === p!.id).map((e) => e.payload);
        expect(disputes).toEqual([expect.objectContaining({ reason: "unconfirmed_payment", president_id: president.id, user_id: buyer.id })]);
      });
    });

    describe("user.deleted", () => {
      it("removes the student's memberships, registrations and payments, and confirms to identity", async () => {
        const president = await h.onboarded("Delete President");
        const leaver = await h.onboarded("Delete Leaver");
        const s = await h.society(president);
        await community().setMembershipMode({ societyId: s.id, mode: "open" }, h.as(president.token));
        await community().joinSociety({ societyId: s.id }, h.as(leaver.token));
        const { eventId, ticketId } = await h.event(president, s.id, { seats: 2 });
        await community().registerEvent({ eventId, ticketTypeId: ticketId, answersJson: "[]" }, h.as(leaver.token));
        await publishAs(w.sql, "user.deleted", [leaver.id], { user_id: leaver.id });
        await drain(w);
        const [rows] = await w.community<{ members: number; regs: number; follows: number; copy: number }[]>`
          select (select count(*)::int from community.society_members where user_id = ${leaver.id}) as members,
                 (select count(*)::int from community.event_registrations where user_id = ${leaver.id}) as regs,
                 (select count(*)::int from community.society_follows where user_id = ${leaver.id}) as follows,
                 (select count(*)::int from community.members where user_id = ${leaver.id}) as copy`;
        expect(rows).toEqual({ members: 0, regs: 0, follows: 0, copy: 0 });
        const confirmed = (await eventsOf(w, "user.deletion_confirmed")).filter((e) => e.payload["user_id"] === leaver.id && e.producer === "svc_community");
        expect(confirmed).toHaveLength(1);
        expect((await eventsOf(w, "group.member_changed")).some((e) => e.payload["user_id"] === leaver.id && e.payload["member"] === false)).toBe(true);
      });
    });
  },
  communityWorld((x) => (w = x), worlds),
);
