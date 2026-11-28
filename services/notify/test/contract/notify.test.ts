/**
 * Notify's contract on both transports: the caller rules, the batch reads other services added for notify (content's
 * CommentExcerpts, messaging's MessageExcerpts, work's, community's and credentials' NoticeFacts, ranking's
 * ScoredStudents, people's ClaimLaunchRecipients, identity's EmailsOf), a notice from a real friend request through to
 * the bell and the badge, marking read, preferences, push settings, and account deletion.
 */
import { ConnectError } from "@connectrpc/connect";
import { CommunityService } from "@skilient/contracts/community/v1/community_pb";
import { ContentService } from "@skilient/contracts/content/v1/content_pb";
import { CredentialsService } from "@skilient/contracts/credentials/v1/credentials_pb";
import { MessagingService } from "@skilient/contracts/messaging/v1/messaging_pb";
import { EmailChannel, NotifyService } from "@skilient/contracts/notify/v1/notify_pb";
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import { RankingService } from "@skilient/contracts/ranking/v1/ranking_pb";
import { WorkService } from "@skilient/contracts/work/v1/work_pb";
import { appendEvents, refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { helpers } from "../../../community/test/contract/helpers";
import { usernameOf } from "../../../people/test/contract/world";
import { noticesOf } from "../world";
import { drain, notifyWorld, stopWorlds, type NotifyWorld } from "./world";

const worlds: NotifyWorld[] = [];
let w: NotifyWorld;
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
  ["identity", "people", "content", "messaging", "realtime", "work", "ranking", "community", "credentials", "media", "notify"],
  (env) => {
    const h = helpers(env, () => w);
    const n = () => env().client(NotifyService);
    const as = (token: string) => ({ ...env().call({ userToken: token }), headers: { "idempotency-key": crypto.randomUUID() } });
    const read = (token: string) => env().call({ userToken: token });
    const settle = () => drain(w, env().host);

    describe("callers", () => {
      it("signed-out readers are refused; ops alerts are trust's; the batch reads added for notify are notify's only", async () => {
        expect(await reason(n().myNotifications({ before: "", limit: 0 }, env().call()))).toBe("not_signed_in");
        expect(await reason(n().unreadCount({}, env().call()))).toBe("not_signed_in");
        expect((await n().pushPublicKey({}, env().call())).publicKey).toBe(w.vapid.keys.publicKey);
        expect(await reason(n().queueOpsAlert({ key: "x", state: "firing", title: "t", detail: "d", since: "", recipients: [] }, env().call()))).not.toBeNull();
        expect(await reason(env().client(ContentService).commentExcerpts({ commentIds: [] }, env().call()))).not.toBeNull();
        expect(await reason(env().client(MessagingService).messageExcerpts({ messageIds: [] }, env().call()))).not.toBeNull();
        expect(await reason(env().client(WorkService).noticeFacts({}, env().call()))).not.toBeNull();
        expect(await reason(env().client(CommunityService).noticeFacts({}, env().call()))).not.toBeNull();
        expect(await reason(env().client(CredentialsService).noticeFacts({}, env().call()))).not.toBeNull();
        expect(await reason(env().client(RankingService).scoredStudents({}, env().call()))).not.toBeNull();
        expect(await reason(env().client(PeopleService).claimLaunchRecipients({ universityId: crypto.randomUUID() }, env().call()))).not.toBeNull();
        // Notify itself may call them.
        expect((await env().client(RankingService, "notify").scoredStudents({ afterUserId: "", limit: 1 }, env().call())).userIds.length).toBeLessThanOrEqual(1);
        expect((await env().client(WorkService, "notify").noticeFacts({ ventureIds: [crypto.randomUUID()] }, env().call())).ventures).toEqual([]);
      });
    });

    describe("the bell", () => {
      it("a friend request reaches the bell with the sender's card; the badge reaches people; marking read clears it", async () => {
        const a = await h.onboarded("Aiza Bell");
        const b = await h.onboarded("Basit Bell");
        await env().client(PeopleService).sendFriendRequest({ username: await usernameOf(w, a.id) }, as(b.token));
        await settle();
        const list = (await n().myNotifications({ before: "", limit: 0 }, read(a.token))).notifications;
        expect(list.map((x) => [x.type, x.category, x.actorName, x.actorUsername])).toEqual([["friend_request", "friend_requests", "Basit Bell", await usernameOf(w, b.id)]]);
        expect((await n().unreadCount({}, read(a.token))).count).toBe(1);
        const badges = await w.notify<{ payload: { count: number } }[]>`
          select payload from platform.events where type = 'badge.count_changed' and payload ->> 'user_id' = ${a.id} order by seq`;
        expect(badges.at(-1)!.payload).toMatchObject({ key: "notifications", count: 1 });
        await n().markRead({ id: list[0]!.id }, as(a.token));
        expect((await n().unreadCount({}, read(a.token))).count).toBe(0);
        expect(await reason(n().markRead({ id: list[0]!.id }, as(b.token)))).toBe("notification_not_found");
        // A block hides the notice and takes it out of the count.
        await env().client(PeopleService).blockUser({ username: await usernameOf(w, b.id) }, as(a.token));
        await settle();
        expect((await n().myNotifications({ before: "", limit: 0 }, read(a.token))).notifications).toEqual([]);
      });

      it("preferences: instant only where allowed; push settings and subscriptions (allowlist, ten devices)", async () => {
        const a = await h.onboarded("Aiza Prefs");
        expect(await reason(n().setPref({ category: "comments", channel: EmailChannel.INSTANT_EMAIL }, as(a.token)))).toBe("not_instant");
        await n().setPref({ category: "comments", channel: EmailChannel.OFF }, as(a.token));
        expect((await n().mySettings({}, read(a.token))).categories.find((c) => c.category === "comments")!.channel).toBe(EmailChannel.OFF);
        expect(await reason(n().savePushSubscription({ endpoint: "https://push.example.test/x", p256dh: "B" + "A".repeat(86), auth: "a".repeat(20), userAgent: "" }, as(a.token)))).toBe("push_service");
        for (let i = 0; i < 10; i++)
          await n().savePushSubscription({ endpoint: `https://fcm.googleapis.com/fcm/send/${a.id}-${i}`, p256dh: "B" + "A".repeat(86), auth: "a".repeat(20), userAgent: "" }, as(a.token));
        expect(await reason(n().savePushSubscription({ endpoint: `https://fcm.googleapis.com/fcm/send/${a.id}-x`, p256dh: "B" + "A".repeat(86), auth: "a".repeat(20), userAgent: "" }, as(a.token)))).toBe("push_devices");
        expect((await n().myPushSettings({}, read(a.token))).devices).toBe(10);
        await n().deletePushSubscription({ endpoint: "" }, as(a.token));
        expect((await n().myPushSettings({}, read(a.token))).devices).toBe(0);
      });

      it("an account deletion removes the user's notices and devices and confirms", async () => {
        const a = await h.onboarded("Aiza Gone");
        await n().savePushSubscription({ endpoint: `https://fcm.googleapis.com/fcm/send/${a.id}`, p256dh: "B" + "A".repeat(86), auth: "a".repeat(20), userAgent: "" }, as(a.token));
        await w.sql.begin((tx) => appendEvents(tx, [{ type: "user.deleted", subjects: [a.id], payload: { user_id: a.id } }]));
        await settle();
        expect(await noticesOf(w, a.id)).toEqual([]);
        const [devices] = await w.notify<{ n: number }[]>`select count(*)::int as n from notify.push_subscriptions where user_id = ${a.id}`;
        expect(devices!.n).toBe(0);
        const confirmed = await w.notify<{ producer: string }[]>`
          select producer from platform.events where type = 'user.deletion_confirmed' and payload ->> 'user_id' = ${a.id}`;
        expect(confirmed.map((c) => c.producer).sort()).toEqual(expect.arrayContaining(["svc_media", "svc_notify"]));
      });
    });
  },
  notifyWorld((x) => (w = x), worlds),
);
