/**
 * messaging's and realtime's contracts on both transports, co-hosted with identity, people and content: every
 * method is implemented, every caller rule holds, and chats work through the contract as web calls them, with
 * live delivery over realtime's socket. Golden replays (test/golden) pin the rules; these pin the wiring, the
 * events, the calls to people and content, and the NOTIFY path.
 */
import { Code, ConnectError } from "@connectrpc/connect";
import { ContentService } from "@skilient/contracts/content/v1/content_pb";
import { MessagingService } from "@skilient/contracts/messaging/v1/messaging_pb";
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import { RealtimeService } from "@skilient/contracts/realtime/v1/realtime_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, expect, it } from "vitest";
import { usernameOf } from "../../../people/test/contract/world";
import { connect, drainCopies, messagingWorld, NU, stopWorlds, student, venture, type MessagingWorld } from "./world";

const worlds: MessagingWorld[] = [];
let w: MessagingWorld;
afterAll(() => stopWorlds(worlds));

const reason = (e: unknown) => refusalReason(e) ?? `code ${ConnectError.from(e).code}`;
const code = (e: unknown) => ConnectError.from(e).code;

describeTransports(
  ["identity", "people", "content", "messaging", "realtime"],
  (env) => {
    const messaging = (as = "web") => env().client(MessagingService, as);
    const as = (token: string) => ({ ...env().call({ userToken: token }), headers: { "idempotency-key": crypto.randomUUID() } });
    const read = (token: string) => env().call({ userToken: token });
    let http1: string | undefined;
    const socketUrl = async () => (http1 ??= env().http1Url ?? `http://127.0.0.1:${(await env().host.listen(0, { http1Port: 0, hostname: "127.0.0.1" })).http1Port}`);
    const friends = async (a: { token: string; id: string }, b: { token: string; id: string }) => {
      const { requestId } = await env().client(PeopleService).sendFriendRequest({ username: await usernameOf(w, b.id) }, as(a.token));
      await env().client(PeopleService).respondFriendRequest({ requestId, accept: true }, as(b.token));
      await drainCopies(w);
    };
    const events = async (type: string, subject: string) =>
      w.messaging<{ payload: Record<string, unknown> }[]>`select payload from platform.events where type = ${type} and ${subject}::uuid = any(subjects) order by seq`;

    it("implements every method in the contract", async () => {
      for (const m of MessagingService.methods) {
        const caller = m.localName === "canListen" ? "realtime" : ["openContactThread", "closeThread"].includes(m.localName) ? "market" : "web";
        const fn = (messaging(caller) as unknown as Record<string, (req: object, o: object) => Promise<unknown>>)[m.localName]!;
        const err = await fn({}, env().call()).then(
          () => null,
          (e: unknown) => e,
        );
        if (err) expect([m.localName, code(err)]).not.toEqual([m.localName, Code.Unimplemented]);
      }
      await expect(env().client(RealtimeService, "trust").stats({}, env().call())).resolves.toBeDefined();
    });

    it("refuses callers outside each method's list", async () => {
      await expect(messaging("realtime").sendMessage({}, env().call())).rejects.toSatisfy((e) => code(e) === Code.PermissionDenied);
      await expect(messaging("web").canListen({}, env().call())).rejects.toSatisfy((e) => code(e) === Code.PermissionDenied);
      await expect(messaging("web").openContactThread({}, env().call())).rejects.toSatisfy((e) => code(e) === Code.PermissionDenied);
      await expect(env().client(RealtimeService, "web").stats({}, env().call())).rejects.toSatisfy((e) => code(e) === Code.PermissionDenied);
      await expect(env().client(ContentService, "people").visiblePosts({ viewerId: "", postIds: [] }, env().call())).rejects.toSatisfy(
        (e) => code(e) === Code.PermissionDenied,
      );
    });

    it("a DM between friends: open, send, read, react, edit, delete; events carry ids only; strangers are refused", async () => {
      const a = await student(w, { fullName: "Chat Alpha" });
      const b = await student(w, { fullName: "Chat Beta" });
      const stranger = await student(w, { fullName: "Chat Stranger" });
      await expect(messaging().getOrCreateDm({ username: await usernameOf(w, b.id) }, as(a.token))).rejects.toSatisfy((e) => reason(e) === "dm_not_allowed");
      await friends(a, b);
      const { threadId } = await messaging().getOrCreateDm({ username: await usernameOf(w, b.id) }, as(a.token));
      const { messageId } = await messaging().sendMessage({ threadId, body: "hello beta https://example.test/x", replyToId: "" }, as(a.token));
      const [sent] = await events("message.sent", messageId);
      expect(sent!.payload).toEqual({ message_id: messageId, thread_id: threadId, sender_id: a.id, recipient_ids: [b.id] });
      const [badge] = (await events("badge.count_changed", b.id)).slice(-1);
      expect(badge!.payload).toEqual({ user_id: b.id, key: "chat", count: 1 });
      expect((await messaging().unreadChatCount({}, read(b.token))).count).toBe(1);
      const list = await messaging().myThreads({}, read(b.token));
      expect(list.threads.map((t) => [t.id, t.title, t.unread, t.lastMessage])).toEqual([[threadId, "Chat Alpha", 1, "hello beta https://example.test/x"]]);
      await messaging().markThreadRead({ threadId }, as(b.token));
      expect((await messaging().unreadChatCount({}, read(b.token))).count).toBe(0);
      expect((await events("thread.read", b.id)).map((e) => e.payload)).toEqual([{ thread_id: threadId, user_id: b.id }]);
      expect((await messaging().toggleReaction({ messageId, emoji: "👍" }, as(b.token))).on).toBe(true);
      await messaging().editMessage({ messageId, body: "hello again" }, as(a.token));
      const page = await messaging().threadMessages({ threadId, before: "", limit: 0 }, read(b.token));
      expect(page.messages.map((m) => [m.body, m.editedAt !== "", m.reactions.map((r) => [r.emoji, r.count])])).toEqual([["hello again", true, [["👍", 1]]]]);
      await messaging().deleteMessage({ messageId }, as(a.token));
      expect((await messaging().threadMessages({ threadId, before: "", limit: 0 }, read(b.token))).messages[0]!.deleted).toBe(true);
      await expect(messaging().sendMessage({ threadId, body: "let me in", replyToId: "" }, as(stranger.token))).rejects.toSatisfy((e) => reason(e) === "not_in_chat");
      expect((await messaging("realtime").canListen({ userId: stranger.id, threadId }, env().call())).allowed).toBe(false);
      expect((await messaging("realtime").canListen({ userId: b.id, threadId }, env().call())).allowed).toBe(true);
    });

    it("sharing a post asks content whether the sharer may see it, then sends it as a message; undo within 15 s", async () => {
      const a = await student(w, { fullName: "Share Alpha" });
      const b = await student(w, { fullName: "Share Beta" });
      const far = await student(w, { uni: NU, fullName: "Share Far" });
      await friends(a, b);
      const { threadId } = await messaging().getOrCreateDm({ username: await usernameOf(w, b.id) }, as(a.token));
      const content = env().client(ContentService);
      const { postId } = await content.createPost({ type: "general", audience: "university", body: "Share me", media: [], pinDays: 0 }, as(a.token));
      const { postId: hidden } = await content.createPost({ type: "general", audience: "university", body: "Not for A", media: [], pinDays: 0 }, as(far.token));
      const targets = await messaging().shareTargets({ q: "beta" }, read(a.token));
      expect(targets.targets.map((t) => [t.id, t.title])).toEqual([[threadId, "Share Beta"]]);
      await expect(messaging().sharePost({ postId: hidden, threadIds: [threadId], note: "" }, as(a.token))).rejects.toSatisfy((e) => reason(e) === "share_unavailable");
      const { messageIds } = await messaging().sharePost({ postId, threadIds: [threadId], note: "look" }, as(a.token));
      const msgs = await messaging().threadMessages({ threadId, before: "", limit: 0 }, read(b.token));
      expect(msgs.messages.map((m) => [m.body, m.shared, m.sharedPostId])).toEqual([["look", true, postId]]);
      expect((await messaging().undoShare({ messageIds }, as(a.token))).removed).toBe(1);
      expect((await events("message.deleted", threadId)).map((e) => e.payload["undone_share"])).toEqual([true]);
    });

    it("realtime: a member hears the thread, a stranger is refused, a blocked member is skipped, badges arrive on user:", async () => {
      const owner = await student(w, { fullName: "Team Owner" });
      const m1 = await student(w, { fullName: "Team One" });
      const m2 = await student(w, { fullName: "Team Two" });
      const stranger = await student(w, { fullName: "Not On Team" });
      const vid = await venture(w, owner.id, [m1.id, m2.id]);
      const { threadId } = await messaging().ventureChat({ ventureId: vid }, read(m1.token));
      expect(threadId).not.toBe("");
      const url = await socketUrl();
      const s1 = await connect(url, m1.token);
      const s2 = await connect(url, m2.token);
      const sx = await connect(url, stranger.token);
      expect((await s1.subscribe(`thread:${threadId}`)).type).toBe("subscribed");
      expect((await s1.subscribe(`user:${m1.id}`)).type).toBe("subscribed");
      expect((await s2.subscribe(`thread:${threadId}`)).type).toBe("subscribed");
      expect(await sx.subscribe(`thread:${threadId}`)).toMatchObject({ type: "refused", reason: "not_allowed" });
      expect(await sx.subscribe(`user:${m1.id}`)).toMatchObject({ type: "refused", reason: "not_allowed" });
      const t0 = performance.now();
      const { messageId } = await messaging().sendMessage({ threadId, body: "team news", replyToId: "" }, as(owner.token));
      const got = await s1.next((m) => m.event === "message.sent" && m.payload["id"] === messageId);
      expect(got.payload).toMatchObject({ body: "team news", sender_id: owner.id, thread_id: threadId });
      const badge = await s1.next((m) => m.topic === `user:${m1.id}` && m.event === "badge");
      expect(badge.payload).toEqual({ key: "chat", count: 1 });
      expect(badge.at - t0).toBeLessThan(500);
      await s2.next((m) => m.payload["id"] === messageId);
      // m2 blocks the owner: the owner's next message reaches m1, not m2.
      await env().client(PeopleService).blockUser({ username: await usernameOf(w, owner.id) }, as(m2.token));
      await drainCopies(w);
      const { messageId: second } = await messaging().sendMessage({ threadId, body: "after the block", replyToId: "" }, as(owner.token));
      await s1.next((m) => m.payload["id"] === second);
      await new Promise((r) => setTimeout(r, 300));
      expect(s2.received.some((m) => m.payload["id"] === second)).toBe(false);
      expect(sx.received).toEqual([]);
      // Pins: the venture's owner, in the team chat.
      await messaging().pinMessage({ messageId, pin: true }, as(owner.token));
      expect((await messaging().threadPins({ threadId }, read(m1.token))).pins.map((p) => p.messageId)).toEqual([messageId]);
      await expect(messaging().pinMessage({ messageId, pin: false }, as(m1.token))).rejects.toSatisfy((e) => reason(e) === "pin_owner_only");
      for (const s of [s1, s2, sx]) s.close();
    });

    it("user.deleted removes the user's messages and memberships and confirms", async () => {
      const a = await student(w, { fullName: "Leaving Alpha" });
      const b = await student(w, { fullName: "Staying Beta" });
      await friends(a, b);
      const { threadId } = await messaging().getOrCreateDm({ username: await usernameOf(w, b.id) }, as(a.token));
      await messaging().sendMessage({ threadId, body: "goodbye", replyToId: "" }, as(a.token));
      // As identity publishes it (identity's role).
      await w.sql.begin(async (tx) => {
        const { appendEvents } = await import("@skilient/platform");
        await appendEvents(tx, [{ type: "user.deleted", subjects: [a.id], payload: { user_id: a.id } }]);
      });
      await drainCopies(w);
      expect((await messaging().threadMessages({ threadId, before: "", limit: 0 }, read(b.token))).messages).toEqual([]);
      const confirmed = await w.messaging<{ payload: Record<string, unknown> }[]>`
        select payload from platform.events where type = 'user.deletion_confirmed' and producer = 'svc_messaging' and ${a.id}::uuid = any(subjects)`;
      expect(confirmed.map((e) => e.payload)).toEqual([{ user_id: a.id }]);
    });
  },
  messagingWorld((x) => (w = x), worlds),
);
