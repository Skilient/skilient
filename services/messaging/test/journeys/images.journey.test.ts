/**
 * Journey: the image half of apps/web/tests/e2e/chat.spec.ts (W9 hand-off to media), through the real services'
 * contracts on both transports with media's in-memory store: the image is stored in media's chat-media bucket under
 * the thread's folder, sent only once it is stored and only by whoever uploaded it, and read only through a link
 * the owning service signs (web cannot read chat images directly). Re-encoding is web's (W13, chat.journey.test.ts).
 */
import { MediaService } from "@skilient/contracts/media/v1/media_pb";
import { MessagingService } from "@skilient/contracts/messaging/v1/messaging_pb";
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { helpers } from "../../../community/test/contract/helpers";
import { upload } from "../../../media/test/world";
import { drain, notifyWorld, stopWorlds, type NotifyWorld } from "../../../notify/test/contract/world";
import { friendRequestId, usernameOf } from "../../../people/test/contract/world";

const worlds: NotifyWorld[] = [];
let w: NotifyWorld;
afterAll(() => stopWorlds(worlds));

describeTransports(
  ["identity", "people", "content", "messaging", "realtime", "work", "ranking", "community", "credentials", "media", "notify"],
  (env) => {
    const h = helpers(env, () => w);
    const as = (token: string) => ({ ...env().call({ userToken: token }), headers: { "idempotency-key": crypto.randomUUID() } });

    describe("chat.spec: images (W9)", () => {
      it("the image is stored in chat-media under the thread; only the uploader sends it; reading needs a link messaging signs", async () => {
        const a = await h.onboarded("Asad Images");
        const b = await h.onboarded("Bina Images");
        await env().client(PeopleService).sendFriendRequest({ username: await usernameOf(w, a.id) }, as(b.token));
        await drain(w, env().host);
        const reqId = await friendRequestId(w, b.id, a.id);
        await env().client(PeopleService).respondFriendRequest({ requestId: reqId, accept: true }, as(a.token));
        await drain(w, env().host);
        const { threadId } = await env().client(MessagingService).getOrCreateDm({ username: await usernameOf(w, b.id) }, as(a.token));

        // Never uploaded: refused.
        const missing = { path: `${threadId}/${crypto.randomUUID()}.webp`, width: 900, height: 600 };
        await expect(env().client(MessagingService).sendMessage({ threadId, body: "", media: missing, replyToId: "" }, as(a.token))).rejects.toSatisfy(
          (e) => refusalReason(e) === "image_missing",
        );
        // Uploaded by A into the thread's folder: B can't send A's file as theirs; A can.
        const path = await upload(env(), w.store, a.token, "chat-media", { folder: threadId });
        await expect(env().client(MessagingService).sendMessage({ threadId, body: "", media: { path, width: 900, height: 600 }, replyToId: "" }, as(b.token))).rejects.toSatisfy(
          (e) => refusalReason(e) === "image_missing",
        );
        await env().client(MessagingService).sendMessage({ threadId, body: "", media: { path, width: 900, height: 600 }, replyToId: "" }, as(a.token));
        expect(w.store.files.has(`chat-media/${path}`)).toBe(true);

        // Web can't read a chat image itself, not even the uploader; messaging (for thread members) gets a signed link.
        const links = (await env().client(MediaService).downloadLinks({ bucket: "chat-media", paths: [path], ttlSeconds: 0 }, env().call({ userToken: a.token }))).links;
        expect(links).toEqual([]);
        const signed = (await env().client(MediaService, "messaging").downloadLinks({ bucket: "chat-media", paths: [path], ttlSeconds: 120 }, env().call())).links;
        expect(signed).toHaveLength(1);
        expect(w.store.read(signed[0]!.url)).not.toBeNull();
        expect(w.store.read(signed[0]!.url.replace(/sig=[^&]+/, "sig=forged"))).toBeNull();
      });
    });
  },
  notifyWorld((x) => (w = x), worlds),
);
