/**
 * apps/web/tests/e2e/friends.spec.ts, through the contracts (decision W2 Q3): one journey per spec test.
 */
import { Code, ConnectError } from "@connectrpc/connect";
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { startFakeHibp } from "../../../identity/test/contract/security-hibp";
import { NU, NUTECH, peopleWorld, stopWorlds, type PeopleWorld } from "../contract/world";
import { journeyClient } from "./journey";

const worlds: PeopleWorld[] = [];
let w: PeopleWorld;
const hibp = await startFakeHibp([]);
afterAll(async () => {
  await stopWorlds(worlds);
  await hibp.stop();
});
const reason = (e: unknown) => refusalReason(e) ?? `code ${ConnectError.from(e).code}`;

describeTransports(
  ["identity", "people"],
  (env) => {
    const j = journeyClient(env, () => w);
    describe("Friends and blocks", () => {
      it("request, live badge, accept, friends-only profile, unfriend", async () => {
        const asker = await j.createStudent(NUTECH, "Fatima Friend");
        const other = await j.createStudent(NU, "Farhan Faraway");
        const classmate = await j.createStudent(NU, "Kiran Classmate");
        await j.people().updateProfile({ visibility: "friends", lookingFor: [], lookingForSet: false }, j.as(other.token));

        // The receiver starts with no friends and no badge.
        expect((await j.people().listFriends({}, j.as(other.token))).friends).toEqual([]);
        expect((await j.people().getShell({}, j.as(other.token))).badges?.friends).toBe(0);

        // "@username" in the form: web strips the @ as today's form does.
        const sent = await j.people().sendFriendRequest({ username: other.username }, j.as(asker.token));
        expect(sent.status).toBe("pending");
        await expect(j.people().sendFriendRequest({ username: other.username }, j.as(asker.token))).rejects.toSatisfy((e) => ["request_exists", "request_rate_limited"].includes(reason(e)));
        const mine = await j.people().listFriendRequests({}, j.as(asker.token));
        expect(mine.requests.map((r) => [r.direction, r.person?.username])).toEqual([["sent", other.username]]);

        // The badge counts the request (it reaches an open page over realtime in W4).
        expect((await j.people().getShell({}, j.as(other.token))).badges?.friends).toBe(1);
        const received = await j.people().listFriendRequests({}, j.as(other.token));
        expect(received.requests.map((r) => [r.direction, r.person?.fullName])).toEqual([["received", "Fatima Friend"]]);
        await j.people().respondFriendRequest({ requestId: received.requests[0]!.id, accept: true }, j.as(other.token));
        expect((await j.people().listFriendRequests({}, j.as(other.token))).requests).toEqual([]);
        expect((await j.people().listFriends({}, j.as(other.token))).friends.map((f) => f.person?.username)).toEqual([asker.username]);
        expect((await j.people().getShell({}, j.as(other.token))).badges?.friends).toBe(0);

        // A friend reads the friends-only profile in full; a stranger gets the card.
        const full = await j.people().getProfile({ username: other.username }, j.as(asker.token));
        expect(full.result).toMatchObject({ case: "full", value: { fullName: "Farhan Faraway" } });
        expect((await j.people().friendshipState({ username: other.username }, j.as(asker.token))).state).toBe("friends");
        const card = await j.people().getProfile({ username: other.username }, j.as(classmate.token));
        expect(card.result.case).toBe("card");
        expect((await j.people().friendshipState({ username: other.username }, j.as(classmate.token))).state).toBe("none");

        // Unfriend: back to strangers, the profile closes again.
        await j.people().unfriend({ username: other.username }, j.as(asker.token));
        expect((await j.people().getProfile({ username: other.username }, j.as(asker.token))).result.case).toBe("card");
        expect((await j.people().friendshipState({ username: other.username }, j.as(asker.token))).state).toBe("none");
      });

      it("block hides both ways; unblock from the Blocked tab; direct writes refused", async () => {
        const blocker = await j.createStudent(NUTECH, "Bushra Blocker");
        const blocked = await j.createStudent(NUTECH, "Bashir Blocked");
        expect((await j.people().getProfile({ username: blocked.username }, j.as(blocker.token))).result.case).toBe("full");
        await j.people().blockUser({ username: blocked.username }, j.as(blocker.token));
        expect((await j.people().listBlocks({}, j.as(blocker.token))).blocked.map((b) => b.fullName)).toEqual(["Bashir Blocked"]);

        // Hidden both ways.
        expect((await j.people().getProfile({ username: blocker.username }, j.as(blocked.token))).result.case).toBe("notFound");
        expect((await j.people().getProfile({ username: blocked.username }, j.as(blocker.token))).result.case).toBe("notFound");

        // No way round it: a request reads as "no one has that username", the blocked person sees no blocks,
        // and nothing outside people's contract reaches its tables (no service token, no database role).
        await expect(j.people().sendFriendRequest({ username: blocker.username }, j.as(blocked.token))).rejects.toSatisfy((e) => reason(e) === "no_such_user");
        expect((await j.people().listBlocks({}, j.as(blocked.token))).blocked).toEqual([]);
        await expect(env().raw(PeopleService, { authorization: `Bearer ${blocked.token}` }).listBlocks({})).rejects.toSatisfy(
          (e) => ConnectError.from(e).code === Code.Unauthenticated || ConnectError.from(e).code === Code.PermissionDenied,
        );
        const methods = PeopleService.methods.map((m) => m.localName);
        expect(methods.filter((m) => /insert|delete(?!Department|Programme)|write/i.test(m))).toEqual([]);

        // Unblock: both see each other again.
        await j.people().unblockUser({ username: blocked.username }, j.as(blocker.token));
        expect((await j.people().listBlocks({}, j.as(blocker.token))).blocked).toEqual([]);
        expect((await j.people().getProfile({ username: blocker.username }, j.as(blocked.token))).result).toMatchObject({ case: "full", value: { fullName: "Bushra Blocker" } });
      });

      it.todo("W4 realtime: the receiver's open page shows the badge without a reload");
      it.todo("W13 web: axe on /friends (empty, sent, received), the block dialog and the profile");
    });
  },
  peopleWorld((x) => (w = x), worlds),
);
