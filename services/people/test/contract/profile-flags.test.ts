/** What people added for credentials (W8): ProfileCards carries onboarding_complete and leaderboard_opt_out. */
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import { describeTransports } from "@skilient/testing";
import { afterAll, expect, it } from "vitest";
import { peopleWorld, stopWorlds, student, type PeopleWorld } from "./world";

const worlds: PeopleWorld[] = [];
let w: PeopleWorld;
afterAll(() => stopWorlds(worlds));

describeTransports(
  ["identity", "people"],
  (env) => {
    it("ProfileCards: onboarding and the leaderboard choice (the CV's eligibility and percentile)", async () => {
      const done = await student(w, { fullName: "Flags Done" });
      const fresh = await student(w, { fullName: "Flags Fresh", onboard: false });
      await env().client(PeopleService).setLeaderboardOptOut({ out: true }, { ...env().call({ userToken: done.token }), headers: { "idempotency-key": crypto.randomUUID() } });
      const r = await env().client(PeopleService, "credentials").profileCards({ userIds: [done.id, fresh.id] }, env().call());
      const of = (id: string) => r.users.find((u) => u.userId === id)!;
      expect([of(done.id).onboardingComplete, of(done.id).leaderboardOptOut]).toEqual([true, true]);
      expect([of(fresh.id).onboardingComplete, of(fresh.id).leaderboardOptOut]).toEqual([false, false]);
    });
  },
  peopleWorld((x) => (w = x), worlds),
);
