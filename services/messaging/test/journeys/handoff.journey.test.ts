/**
 * The W4 to-dos other workstreams' journeys left (docs/azure/journey-handoff.md, "W4"), as real tests through
 * the contracts on both transports:
 *   - feed.spec (content): a new post arrives as a "1 new post" pill, not a jump, and the pill loads it;
 *   - community.spec share (content): the sheet sends the post as a DM message with a note, Undo takes it back
 *     within 15 seconds, and the chat shows the shared card, then "This post isn't available";
 *   - friends.spec (people): the receiver's open page shows the badge without a reload.
 */
import { ContentService } from "@skilient/contracts/content/v1/content_pb";
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import { GLOBAL_FEED } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { NU, NUTECH } from "../../../people/test/contract/world";
import { messagingWorld, stopWorlds, type MessagingWorld } from "../contract/world";
import { journeyClient } from "./journey";

const worlds: MessagingWorld[] = [];
let w: MessagingWorld;
afterAll(() => stopWorlds(worlds));

describeTransports(
  ["identity", "people", "content", "messaging", "realtime"],
  (env) => {
    const j = journeyClient(env, () => w);
    const content = () => env().client(ContentService);
    const post = (token: string, body: string, audience = "university") =>
      content().createPost({ type: "general", audience, body, media: [], pinDays: 0 }, j.as(token));

    describe("W4 hand-off", () => {
      it("feed.spec: a classmate's new post reaches an open feed as a pill (feed topic), and the pill loads it", async () => {
        const reader = await j.createStudent(NUTECH, "Pill Reader");
        const poster = await j.createStudent(NUTECH, "Pill Poster");
        const far = await j.createStudent(NU, "Pill Far");
        const tab = await j.tab(reader.token);
        expect((await tab.subscribe(`feed:${NUTECH.id}`)).type).toBe("subscribed");
        expect((await tab.subscribe(`feed:${GLOBAL_FEED}`)).type).toBe("subscribed");
        const farTab = await j.tab(far.token);
        expect(await farTab.subscribe(`feed:${NUTECH.id}`)).toMatchObject({ type: "refused" });
        const { postId } = await post(poster.token, `Fresh news ${Date.now().toString(36)}`);
        const pill = await tab.next((m) => m.topic === `feed:${NUTECH.id}` && m.event === "post.created");
        expect(pill.payload).toEqual({ post_id: postId, author_id: poster.id });
        // The pill loads it: the card by id.
        expect((await content().postCards({ postIds: [postId] }, j.read(reader.token))).cards.map((c) => c.id)).toEqual([postId]);
        const { postId: global } = await post(far.token, "A global hello", "global");
        await tab.next((m) => m.topic === `feed:${GLOBAL_FEED}` && m.payload["post_id"] === global);
        await new Promise((r) => setTimeout(r, 200));
        expect(farTab.received.filter((m) => m.topic === `feed:${NUTECH.id}`)).toEqual([]);
        tab.close();
        farTab.close();
      });

      it("the share e2e test (Community spec): into a DM with a note, live; Undo within 15 s; after a block the card is not available", async () => {
        const author = await j.createStudent(NUTECH, "Share Author");
        const friend = await j.createStudent(NUTECH, "Share Friend");
        await j.befriend(author, friend);
        const { threadId } = await j.messaging().getOrCreateDm({ username: friend.username }, j.as(author.token));
        const tab = await j.tab(friend.token);
        await tab.subscribe(`thread:${threadId}`);
        const { postId } = await post(author.token, "Worth a read");
        const { messageIds } = await j.messaging().sharePost({ postId, threadIds: [threadId], note: "for you" }, j.as(author.token));
        const live = await tab.next((m) => m.payload["id"] === messageIds[0]);
        expect(live.payload).toMatchObject({ body: "for you", shared: true, shared_post_id: postId });
        expect((await j.messaging().undoShare({ messageIds }, j.as(author.token))).removed).toBe(1);
        expect((await j.messaging().threadMessages({ threadId, before: "", limit: 0 }, j.read(friend.token))).messages).toEqual([]);
        // Shared again; the card shows; after the author blocks the friend, "This post isn't available".
        const again = await j.messaging().sharePost({ postId, threadIds: [threadId], note: "" }, j.as(author.token));
        const msg = (await j.messaging().threadMessages({ threadId, before: "", limit: 0 }, j.read(friend.token))).messages[0]!;
        expect([msg.id, msg.sharedPostId]).toEqual([again.messageIds[0], postId]);
        expect((await content().postCards({ postIds: [postId] }, j.read(friend.token))).cards).toHaveLength(1);
        await env().client(PeopleService).blockUser({ username: friend.username }, j.as(author.token));
        await j.drain();
        expect((await content().postCards({ postIds: [postId] }, j.read(friend.token))).cards).toEqual([]);
        tab.close();
      });

      it("friends.spec: the receiver's open page gets the Friends badge without a reload, and it clears on accept", async () => {
        const sender = await j.createStudent(NUTECH, "Badge Sender");
        const receiver = await j.createStudent(NUTECH, "Badge Receiver");
        const tab = await j.tab(receiver.token);
        await tab.subscribe(`user:${receiver.id}`);
        const people = env().client(PeopleService);
        const { requestId } = await people.sendFriendRequest({ username: receiver.username }, j.as(sender.token));
        const up = await tab.next((m) => m.event === "badge" && m.payload["key"] === "friends");
        expect(up.payload).toEqual({ key: "friends", count: 1 });
        await people.respondFriendRequest({ requestId, accept: true }, j.as(receiver.token));
        await tab.next((m) => m.event === "badge" && m.payload["key"] === "friends" && m.payload["count"] === 0);
        tab.close();
      });
    });
  },
  messagingWorld((x) => (w = x), worlds),
);
