/**
 * Journey: apps/web/tests/worker/notify-push.test.ts and the community spec's push half, through the real producers'
 * contracts on both transports, with the browser's push service faked: the fake checks each VAPID signature and
 * decrypts each push with the device's own keys (test/fakes.ts), so what a phone would show is what's asserted. The
 * W9 done-when's push half: a chat message pushes (one per thread), turning the category off stops it, and a device
 * the push service has forgotten (410) is removed.
 */
import { MessagingService } from "@skilient/contracts/messaging/v1/messaging_pb";
import { NotifyService } from "@skilient/contracts/notify/v1/notify_pb";
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { helpers } from "../../../community/test/contract/helpers";
import { friendRequestId, usernameOf } from "../../../people/test/contract/world";
import { drain, notifyWorld, stopWorlds, type NotifyWorld } from "../contract/world";
import { fakePushService, makeDevice } from "../fakes";
import { runNotifyJobs } from "../world";

const worlds: NotifyWorld[] = [];
let w: NotifyWorld;
afterAll(() => stopWorlds(worlds));

describeTransports(
  ["identity", "people", "content", "messaging", "realtime", "work", "ranking", "community", "credentials", "media", "notify"],
  (env) => {
    const h = helpers(env, () => w);
    const as = (token: string) => ({ ...env().call({ userToken: token }), headers: { "idempotency-key": crypto.randomUUID() } });
    const settle = () => drain(w, env().host);

    describe("Push", () => {
      it("a chat message pushes to the subscribed device; off stops it; a forgotten device is removed", async () => {
        const a = await h.onboarded("Ayla Push");
        const b = await h.onboarded("Babar Push");
        // Friends, so they may message.
        await env().client(PeopleService).sendFriendRequest({ username: await usernameOf(w, a.id) }, as(b.token));
        await settle();
        const reqId = await friendRequestId(w, b.id, a.id);
        await env().client(PeopleService).respondFriendRequest({ requestId: reqId, accept: true }, as(a.token));
        await settle();

        const phone = await makeDevice(a.id.slice(0, 8));
        await env().client(NotifyService).savePushSubscription({ endpoint: phone.endpoint, p256dh: phone.p256dh, auth: phone.authB64, userAgent: "Test Phone" }, as(a.token));
        const { threadId } = await env().client(MessagingService).getOrCreateDm({ username: await usernameOf(w, a.id) }, as(b.token));
        await env().client(MessagingService).sendMessage({ threadId, body: "Plover count moved to 6am", replyToId: "" }, as(b.token));
        await settle();
        const push = fakePushService(w.vapid, [phone]);
        await runNotifyJobs(w, env().host, { fetch: push.impl }, ["push-drain"]);
        expect(push.delivered).toHaveLength(1);
        expect(push.delivered[0]!.message).toMatchObject({ url: `/chat/${threadId}`, body: expect.stringContaining("Babar Push") as unknown });
        expect(push.delivered[0]!.message.tag).toBe(`c${threadId.replace(/-/g, "").slice(0, 24)}`);

        // A second message collapses into the same notice and still pushes.
        await env().client(MessagingService).sendMessage({ threadId, body: "and bring tea", replyToId: "" }, as(b.token));
        await settle();
        await runNotifyJobs(w, env().host, { fetch: push.impl }, ["push-drain"]);
        expect(push.delivered).toHaveLength(2);
        const [chat] = await w.notify<{ n: number }[]>`select count(*)::int as n from notify.notifications where user_id = ${a.id} and type = 'chat_message'`;
        expect(chat!.n).toBe(1);

        // Off for messages: nothing is queued.
        await env().client(NotifyService).markAllRead({}, as(a.token));
        await env().client(NotifyService).setPushPref({ category: "messages", on: false }, as(a.token));
        await env().client(MessagingService).sendMessage({ threadId, body: "you there?", replyToId: "" }, as(b.token));
        await settle();
        await runNotifyJobs(w, env().host, { fetch: push.impl }, ["push-drain"]);
        expect(push.delivered).toHaveLength(2);

        // On again; the push service says the device is gone (410): the subscription goes.
        await env().client(NotifyService).setPushPref({ category: "messages", on: true }, as(a.token));
        await env().client(NotifyService).markAllRead({}, as(a.token));
        await env().client(MessagingService).sendMessage({ threadId, body: "last one", replyToId: "" }, as(b.token));
        await settle();
        const gone = fakePushService(w.vapid, [phone], [410]);
        await runNotifyJobs(w, env().host, { fetch: gone.impl }, ["push-drain"]);
        expect(gone.delivered).toHaveLength(1);
        expect((await env().client(NotifyService).myPushSettings({}, env().call({ userToken: a.token }))).devices).toBe(0);
      });
    });
  },
  notifyWorld((x) => (w = x), worlds),
);
