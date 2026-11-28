/**
 * What community added for credentials (W8): RecordFacts, what the Record's entries need that event.closed and
 * society.term_changed don't carry (titles, result labels, walk-ins' addresses, society names). Credentials only.
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
    it("RecordFacts: event and term titles, labels, walk-ins' addresses and societies, in one call; credentials only", async () => {
      const president = await h.onboarded("Facts President");
      const officer = await h.onboarded("Facts Officer");
      const s = await h.society(president, [officer]);
      const { eventId } = await h.event(president, s.id, { title: "Facts night" });
      await w.community`insert into community.event_results (id, event_id, user_id, place, label, set_by) values (gen_random_uuid(), ${eventId}, ${officer.id}, 1, 'Best robot', ${president.id})`;
      const address = `walkin-${Date.now().toString(36)}@nutech-contract.test`;
      const [a] = await w.community<{ id: string }[]>`
        insert into community.event_email_attendees (id, event_id, email, added_by) values (gen_random_uuid(), ${eventId}, ${address}, ${officer.id}) returning id::text`;
      const [t] = await w.community<{ id: string }[]>`select id::text from community.society_terms where society_id = ${s.id} and user_id = ${officer.id}`;
      const r = await env().client(CommunityService, "credentials").recordFacts({ eventIds: [eventId], termIds: [t!.id], attendeeIds: [a!.id], societyIds: [] }, env().call());
      expect(r.events.map((e) => [e.title, e.societyId])).toEqual([["Facts night", s.id]]);
      expect(r.terms.map((x) => [x.title, x.societyId])).toEqual([["General Secretary", s.id]]);
      expect(r.labels.map((l) => [l.userId, l.label])).toEqual([[officer.id, "Best robot"]]);
      expect(r.walkIns.map((x) => x.email)).toEqual([address]);
      expect(r.societies.map((x) => [x.id, x.name, x.slug, x.status])).toEqual([[s.id, s.name, s.slug, "verified"]]);
      await expect(env().client(CommunityService).recordFacts({ eventIds: [eventId], termIds: [], attendeeIds: [], societyIds: [] }, env().call())).rejects.toSatisfy(
        (e) => reason(e) === "caller_not_allowed",
      );
    });
  },
  communityWorld((x) => (w = x), worlds),
);
