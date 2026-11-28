/**
 * What community added for notify (W9): NoticeFacts, the names, titles, officers, audiences and registrants society
 * and event notices snapshot or go to, in one query; RecordFacts now also serves notify (walk-ins' addresses for the
 * claim email). Notify only.
 */
import { ConnectError } from "@connectrpc/connect";
import { CommunityService } from "@skilient/contracts/community/v1/community_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, expect, it } from "vitest";
import { helpers } from "./helpers";
import { communityWorld, stopWorlds, type CommunityWorld } from "./world";

const worlds: CommunityWorld[] = [];
let w: CommunityWorld;
afterAll(() => stopWorlds(worlds));

const reason = (e: unknown) => refusalReason(e) ?? `code ${ConnectError.from(e).code}`;

describeTransports(
  ["identity", "people", "content", "messaging", "realtime", "work", "ranking", "community"],
  (env) => {
    const h = helpers(env, () => w);
    it("NoticeFacts: a society's name and slug, its officers and audience, an event's title and its registrants; notify only", async () => {
      const president = await h.onboarded("Nadia Notices");
      const secretary = await h.onboarded("Sami Notices");
      const fan = await h.onboarded("Fahad Notices");
      const s = await h.society(president, [secretary]);
      await env().client(CommunityService).followSociety({ societyId: s.id, on: true }, h.as(fan.token));
      const { eventId, ticketId } = await h.event(president, s.id, { seats: 10, startsIn: 5 * 86_400_000 });
      const { registrationId } = await env().client(CommunityService).registerEvent({ eventId, ticketTypeId: ticketId, answersJson: "[]" }, h.as(fan.token));
      const r = await env()
        .client(CommunityService, "notify")
        .noticeFacts({ eventIds: [eventId], officerSocietyIds: [s.id], audienceSocietyIds: [s.id], registrantEventIds: [eventId], registrationIds: [registrationId] }, env().call());
      expect(r.societies.map((x) => [x.id, x.name])).toEqual([[s.id, s.name]]);
      expect(r.events.map((e) => [e.id, e.societyId])).toEqual([[eventId, s.id]]);
      expect(r.officers[0]!.userIds.sort()).toEqual([president.id, secretary.id].sort());
      expect(r.audiences[0]!.userIds).toEqual(expect.arrayContaining([president.id, secretary.id, fan.id]));
      expect(r.registrants.map((x) => [x.eventId, x.userIds, x.paidUserIds])).toEqual([[eventId, [fan.id], []]]);
      expect(r.registrations.map((x) => [x.id, x.paid])).toEqual([[registrationId, false]]);
      await expect(env().client(CommunityService).noticeFacts({}, env().call())).rejects.toSatisfy((e) => reason(e) === "caller_not_allowed");
    });
  },
  communityWorld((x) => (w = x), worlds),
);
