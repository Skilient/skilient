/**
 * Journey: apps/web/tests/e2e/ventures.spec.ts, through the contracts on both transports, and the W5 to-dos
 * other journeys left (docs/azure/journey-handoff.md, "W5"): the followed-updates strip, the invite card's Apply
 * with open roles, and a venture made through work reaching its team chat. Web-only parts are `it.todo` for W13.
 */
import { ContentService } from "@skilient/contracts/content/v1/content_pb";
import { MessagingService } from "@skilient/contracts/messaging/v1/messaging_pb";
import { WorkService } from "@skilient/contracts/work/v1/work_pb";
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { usernameOf } from "../../../people/test/contract/world";
import { drainCopies, stopWorlds, student, workWorld, type WorkWorld } from "../contract/world";

const worlds: WorkWorld[] = [];
let w: WorkWorld;
afterAll(() => stopWorlds(worlds));

describeTransports(
  ["identity", "people", "content", "messaging", "realtime", "work"],
  (env) => {
    const work = () => env().client(WorkService);
    const as = (token: string) => ({ ...env().call({ userToken: token }), headers: { "idempotency-key": crypto.randomUUID() } });
    const read = (token: string) => env().call({ userToken: token });
    const onboarded = async (fullName: string) => {
      const s = await student(w, { fullName });
      await drainCopies(w);
      return s;
    };

    describe("ventures.spec: create, apply, accept, and the team shows the new member", () => {
      it("a project with a role and a question; a classmate applies; the owner accepts; the team and role fill", async () => {
        const owner = await onboarded("Rania Founder");
        const applicant = await onboarded("Saad Applicant");
        const { ventureId } = await work().createVenture(
          { type: "project", title: "Campus Compost", description: "Sensors for compost bins.", visibility: "university", skillIds: ["python"], roles: [{ title: "Firmware", skillIds: ["python"], slots: 1 }], questions: ["What have you built?"] },
          as(owner.token),
        );
        const page = await work().getVenture({ ventureId }, read(applicant.token));
        expect([page.venture?.title, page.roles.map((r) => [r.title, r.slots - r.filled]), page.questions.map((q) => q.body)]).toEqual([
          "Campus Compost",
          [["Firmware", 1]],
          ["What have you built?"],
        ]);
        const { applicationId } = await work().applyToVenture({ ventureId, roleId: page.roles[0]!.id, message: "I build sensors", answers: ["A weather station"] }, as(applicant.token));
        const inbox = await work().myRequests({}, read(owner.token));
        expect(inbox.applications.map((a) => [a.id, a.status, a.sent, a.roleTitle])).toEqual([[applicationId, "pending", false, "Firmware"]]);
        expect((await work().decideApplication({ applicationId, accept: true }, as(owner.token))).status).toBe("accepted");
        const after = await work().getVenture({ ventureId }, read(applicant.token));
        expect([after.isMember, after.members, after.team.map((t) => t.userId), after.roles[0]!.filled]).toEqual([true, 2, [owner.id, applicant.id], 1]);
        // The two may now message (an accepted application opens the DM).
        await drainCopies(w);
        const dm = await env().client(MessagingService).getOrCreateDm({ username: await usernameOf(w, applicant.id) }, as(owner.token));
        expect(dm.threadId).not.toBe("");
      });

      it.todo("W13: the create stepper, the Apply sheet, the requests inbox and axe in both themes");
    });

    describe("W5 hand-off", () => {
      it("feed.spec: updates from a followed venture come in the followed-updates strip", async () => {
        const owner = await onboarded("Strip Owner");
        const fan = await onboarded("Strip Fan");
        const { ventureId } = await work().createVenture({ type: "startup", title: "Strip Labs", description: "Labs.", visibility: "public", skillIds: [], roles: [], questions: [] }, as(owner.token));
        await work().followVenture({ ventureId, follow: true }, as(fan.token));
        const { updateId } = await work().postVentureUpdate({ ventureId, body: "Prototype works", media: [] }, as(owner.token));
        const strip = await work().followedVentureUpdates({}, read(fan.token));
        expect(strip.updates.map((u) => [u.id, u.ventureTitle, u.body])).toEqual([[updateId, "Strip Labs", "Prototype works"]]);
      });

      it("posts.spec: an invite card shows its open roles to Apply to, and a venture update takes images", async () => {
        const owner = await onboarded("Invite Owner");
        const reader = await onboarded("Invite Reader");
        const { ventureId } = await work().createVenture(
          { type: "project", title: "Invite Robotics", description: "Robots.", visibility: "public", skillIds: [], roles: [{ title: "Designer", skillIds: [], slots: 2 }], questions: [] },
          as(owner.token),
        );
        await drainCopies(w);
        const { postId } = await env().client(ContentService).createPost({ type: "invite", audience: "university", body: "Join us", media: [], ventureId, pinDays: 0 }, as(owner.token));
        const card = (await env().client(ContentService).postCards({ postIds: [postId] }, read(reader.token))).cards[0]!;
        expect(JSON.parse(card.ventureJson)).toMatchObject({ id: ventureId, title: "Invite Robotics", is_member: false, roles: [{ title: "Designer", open: 2 }], team: null });
        const image = { path: `${owner.id}/${crypto.randomUUID()}.webp`, width: 800, height: 600 };
        await work().postVentureUpdate({ ventureId, body: "Our first prototype", media: [image] }, as(owner.token));
        const updates = await work().ventureUpdates({ ventureId }, read(reader.token));
        expect(updates.updates[0]!.media.map((m) => ({ path: m.path, width: m.width, height: m.height }))).toEqual([image]);
      });

      it("chat.spec: a venture made and joined through work gets its team chat, titled with the venture", async () => {
        const owner = await onboarded("Chat Owner");
        const mate = await onboarded("Chat Mate");
        const { ventureId } = await work().createVenture({ type: "project", title: "Chat Robotics", description: "Robots.", visibility: "public", skillIds: [], roles: [], questions: [] }, as(owner.token));
        const { inviteId } = await work().inviteToVenture({ ventureId, username: await usernameOf(w, mate.id) }, as(owner.token));
        await work().respondInvite({ inviteId, accept: true }, as(mate.token));
        await drainCopies(w);
        const messaging = env().client(MessagingService);
        const { threadId } = await messaging.ventureChat({ ventureId }, read(mate.token));
        expect(threadId).not.toBe("");
        const list = await messaging.myThreads({}, read(mate.token));
        expect(list.threads.find((t) => t.id === threadId)?.title).toBe("Chat Robotics");
      });
    });
  },
  workWorld((x) => (w = x), worlds),
);
