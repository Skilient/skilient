/**
 * Journey: apps/web/tests/e2e/societies.spec.ts, "events: the stepper, the waitlist, a ticket that checks in once,
 * a live headcount, close-out, CSV and feedback", through the contracts on both transports. The live headcount
 * goes over realtime's event:{id} topic (a socket on the HTTP/2 run; the memory run has no sockets, and the same
 * NOTIFY is checked by the HTTP/2 run). The close-out reaches credentials as event.closed (W8 makes the Record
 * entries from it). Web-only parts are `it.todo` for W13.
 */
import { ConnectError } from "@connectrpc/connect";
import { CommunityService } from "@skilient/contracts/community/v1/community_pb";
import { ContentService } from "@skilient/contracts/content/v1/content_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { connect } from "../../../messaging/test/contract/world";
import { helpers, unique } from "../contract/helpers";
import { communityWorld, drain, eventsOf, stopWorlds, tick, type CommunityWorld } from "../contract/world";

const worlds: CommunityWorld[] = [];
let w: CommunityWorld;
afterAll(() => stopWorlds(worlds));

async function reason(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    if (e instanceof ConnectError) return refusalReason(e);
    throw e;
  }
}

describeTransports(
  ["identity", "people", "content", "messaging", "realtime", "work", "ranking", "community"],
  (env) => {
    const h = helpers(env, () => w);
    const community = () => env().client(CommunityService);
    const content = () => env().client(ContentService);

    describe("societies.spec: events, the waitlist, check-in, close-out, CSV and feedback", () => {
      it("a student can't create an event; the officer publishes one with its post; one seat, then the waitlist", async () => {
        const officer = await h.onboarded("Omar Officer");
        const first = await h.onboarded(unique("Ayesha First"));
        const second = await h.onboarded("Bilal Second");
        const s = await h.society(officer);

        // A student can't open the stepper: the society is not theirs.
        const start = new Date(Date.now() + 3600_000);
        const draft = { societyId: s.id, type: "workshop", title: "Mine", location: "Hall", sessions: [{ startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 7200_000).toISOString() }], ticketTypes: [{ name: "Seat", capacity: 1 }] };
        expect(await reason(community().saveSocietyEvent(draft, h.as(first.token)))).toBe("society_not_found");

        // The officer creates and publishes: one session starting in an hour, one seat, one required question.
        const title = unique("Soldering basics");
        const { eventId, ticketId } = await h.event(officer, s.id, { title, seats: 1, startsIn: 3600_000, question: "Have you soldered before?" });
        const [ev] = await w.community<{ status: string; post_id: string | null }[]>`select status, post_id::text from community.events where id = ${eventId}`;
        expect(ev!.status).toBe("published");
        expect(ev!.post_id).not.toBeNull();
        const post = await content().postCards({ postIds: [ev!.post_id!] }, h.read(first.token));
        expect([post.cards[0]!.type, post.cards[0]!.societyId]).toEqual(["event", s.id]);
        expect((await eventsOf(w, "event.updated")).filter((e) => e.payload["event_id"] === eventId).map((e) => e.payload["change"])).toEqual(["published"]);
        // Publishing again (a retry after the post was made) changes nothing.
        expect(await reason(community().publishEvent({ eventId }, h.as(officer.token)))).toBe("event_published");

        // The first student gets the seat; the second is waitlisted at 1.
        const page = h.json<{ block_reason: string | null; ticket_types: { left: number }[]; questions: { label: string; required: boolean }[] }>(
          await community().eventPage({ eventId }, h.read(first.token)),
        );
        expect([page.block_reason, page.ticket_types[0]!.left, page.questions[0]!.required]).toEqual([null, 1, true]);
        expect(await reason(community().registerEvent({ eventId, ticketTypeId: ticketId, answersJson: JSON.stringify([" "]) }, h.as(first.token)))).toBe("answer_question");
        const a = await community().registerEvent({ eventId, ticketTypeId: ticketId, answersJson: JSON.stringify(["Once, in school."]) }, h.as(first.token));
        expect([a.status, a.waitlistPosition]).toEqual(["confirmed", 0]);
        const ticket = h.json<{ status: string; payload: string; name: string; code: string }>(await community().eventTicket({ eventId }, h.read(first.token)));
        expect([ticket.status, ticket.name]).toEqual(["confirmed", ticket.name]);
        expect(ticket.payload).toMatch(/^SKT1\.[0-9a-f-]{36}\.[0-9a-f]{24}$/);
        const b = await community().registerEvent({ eventId, ticketTypeId: ticketId, answersJson: JSON.stringify(["No."]) }, h.as(second.token));
        expect([b.status, b.waitlistPosition]).toEqual(["waitlisted", 1]);
        expect(h.json<{ registration: { waitlist_position: number } }>(await community().eventPage({ eventId }, h.read(second.token))).registration.waitlist_position).toBe(1);

        // Check-in: the signed code checks in once; the second scan shows the first time. A second staff screen sees
        // the headcount move over realtime.
        const watcher = env().http1Url ? await connect(env().http1Url!, officer.token) : null;
        if (watcher) {
          const sub = await watcher.subscribe(`event:${eventId}`);
          expect(sub).toEqual({ type: "subscribed", topic: `event:${eventId}` });
        }
        if (env().http1Url) {
          const stranger = await connect(env().http1Url!, second.token);
          expect(await stranger.subscribe(`event:${eventId}`)).toMatchObject({ type: "refused", reason: "not_allowed" });
          stranger.close();
        }
        expect(h.json<{ checked_in: number; expected: number }>(await community().eventHeadcount({ eventId }, h.read(officer.token)))).toMatchObject({ checked_in: 0, expected: 1 });
        const green = h.json<{ result: string; name: string }>(await community().checkInScan({ eventId, payload: ticket.payload }, h.as(officer.token)));
        expect(green).toMatchObject({ result: "green", name: ticket.name });
        if (watcher) {
          const m = await watcher.next((x) => x.topic === `event:${eventId}` && x.event === "headcount");
          expect(m.payload).toMatchObject({ checked_in: 1 });
          watcher.close();
        }
        expect(h.json<{ checked_in: number }>(await community().eventHeadcount({ eventId }, h.read(officer.token))).checked_in).toBe(1);
        const amber = h.json<{ result: string; first_at: string }>(await community().checkInScan({ eventId, payload: ticket.payload }, h.as(officer.token)));
        expect(amber.result).toBe("amber");
        expect(h.json<{ result: string }>(await community().checkInScan({ eventId, payload: `${ticket.payload.slice(0, -4)}0000` }, h.as(officer.token))).result).toBe("red");
        expect(await reason(community().checkInScan({ eventId, payload: ticket.payload }, h.as(second.token)))).toBe("event_not_found");
        const walkIn = h.json<{ result: string; claim: boolean }>(await community().checkInEmail({ eventId, email: `walkin-${Date.now()}@nutech-contract.test` }, h.as(officer.token)));
        expect(walkIn).toMatchObject({ result: "green", claim: true });
        const found = h.json<{ user_id: string; checked_in: boolean }[]>(await community().checkInSearch({ eventId, query: "ayesha" }, h.read(officer.token)));
        expect(found).toEqual([expect.objectContaining({ user_id: first.id, checked_in: true })]);
        expect((await eventsOf(w, "ticket.checked_in")).filter((e) => e.payload["event_id"] === eventId)).toHaveLength(2);

        // CSV rows for officers; a student gets "not found".
        const rows = h.json<{ name: string; username: string; status: string; checked_in_sessions: number }[]>(await community().eventAttendeesRows({ eventId }, h.read(officer.token)));
        expect(rows.map((r) => [r.name, r.status, r.checked_in_sessions])).toEqual([
          [ticket.name, "confirmed", 1],
          ["Bilal Second", "waitlisted", 0],
        ].sort((x, y) => String(x[0]).localeCompare(String(y[0]))));
        expect(await reason(community().eventAttendeesRows({ eventId }, h.read(first.token)))).toBe("event_not_found");

        // Close-out after the event: every checked-in attendee is listed; issuing stores it and hands it to credentials.
        await w.community`update community.event_sessions set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour' where event_id = ${eventId}`;
        await w.community`update community.events set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour' where id = ${eventId}`;
        await tick(w, "event-tick");
        const closeout = h.json<{ open: boolean; counts: Record<string, number>; attendees: { name: string; sessions: number }[] }>(await community().closeoutPage({ eventId }, h.read(officer.token)));
        expect([closeout.open, closeout.counts["attended"], closeout.counts["emails"]]).toEqual([true, 1, 1]);
        expect(closeout.attendees.map((x) => [x.name, x.sessions])).toEqual([[ticket.name, 1]]);
        await community().issueEventEntries({ eventId }, h.as(officer.token));
        const [issued] = await w.community<{ n: number; status: string }[]>`select count(*)::int as n, min(status) as status from community.event_issuances where event_id = ${eventId}`;
        expect(issued).toEqual({ n: 1, status: "signed" });
        const closed = (await eventsOf(w, "event.closed")).filter((e) => e.payload["event_id"] === eventId);
        expect(closed).toHaveLength(1);
        expect(closed[0]!.payload).toMatchObject({
          society_id: s.id,
          society_verified: true,
          auto: false,
          sessions: 1,
          attended: [expect.objectContaining({ user_id: first.id, self_added: false })],
          walk_ins: [expect.objectContaining({ email_hash: expect.stringMatching(/^[0-9a-f]{64}$/) })],
        });
        expect(await reason(community().issueEventEntries({ eventId }, h.as(officer.token)))).toBe("already_issued");
        const manage = h.json<{ stats: Record<string, number> }>(await community().eventManage({ eventId }, h.read(officer.token)));
        expect(manage.stats).toMatchObject({ registered: 1, waitlist: 1, checked_in: 1 });

        // Feedback for a week after.
        expect(h.json<{ feedback_open: boolean }>(await community().eventPage({ eventId }, h.read(first.token))).feedback_open).toBe(true);
        await community().submitEventFeedback({ eventId, rating: 5 }, h.as(first.token));
        expect(h.json<{ feedback_open: boolean }>(await community().eventPage({ eventId }, h.read(first.token))).feedback_open).toBe(false);
        expect(h.json<{ upcoming: unknown[]; past: { id: string }[] }>(await community().myTickets({}, h.read(first.token))).past.map((x) => x.id)).toEqual([eventId]);
        await drain(w);
      });

      it.todo("W13: the event stepper (steps left, the date fields), the register sheet, the ticket's QR, the check-in console (camera, typed code, busy form), the close-out tab, the CSV download, axe in both themes");
    });
  },
  communityWorld((x) => (w = x), worlds),
);
