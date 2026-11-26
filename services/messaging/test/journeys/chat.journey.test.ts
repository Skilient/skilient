/**
 * Journey: apps/web/tests/e2e/chat.spec.ts, through the contracts on both transports, with each tab's live view
 * a realtime socket. Web-only parts are `it.todo` for W13 (and W9 for image files).
 */
import { appendEvents, refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { NUTECH } from "../../../people/test/contract/world";
import { messagingWorld, stopWorlds, venture, type MessagingWorld } from "../contract/world";
import { journeyClient } from "./journey";

const worlds: MessagingWorld[] = [];
let w: MessagingWorld;
afterAll(() => stopWorlds(worlds));

describeTransports(
  ["identity", "people", "content", "messaging", "realtime"],
  (env) => {
    const j = journeyClient(env, () => w);

    describe("chat.spec: DM live both ways, image, edit, delete, unread; outsiders refused; venture group chat", () => {
      it("a DM between friends, live both ways; edit and delete seen live; unread in the badge and the list; outsiders refused; the team chat", async () => {
        const a = await j.createStudent(NUTECH, "Amir Chatter");
        const b = await j.createStudent(NUTECH, "Bina Chatter");
        const outsider = await j.createStudent(NUTECH, "Cyrus Outsider");
        await j.befriend(a, b);

        // A opens the DM from B's profile; it starts empty.
        const { threadId } = await j.messaging().getOrCreateDm({ username: b.username }, j.as(a.token));
        expect((await j.messaging().threadMessages({ threadId, before: "", limit: 0 }, j.read(a.token))).messages).toEqual([]);
        const aTab = await j.tab(a.token);
        const bTab = await j.tab(b.token);
        expect((await aTab.subscribe(`thread:${threadId}`)).type).toBe("subscribed");
        expect((await bTab.subscribe(`thread:${threadId}`)).type).toBe("subscribed");
        expect((await bTab.subscribe(`user:${b.id}`)).type).toBe("subscribed");

        // A's message arrives live in B's tab; B's reply reaches A.
        const { messageId: hi } = await j.say(a.token, threadId, "Hi Bina, free to plan the app?");
        expect((await bTab.next((m) => m.payload["id"] === hi)).payload["body"]).toBe("Hi Bina, free to plan the app?");
        const { messageId: yes } = await j.say(b.token, threadId, "Yes! After class?");
        await aTab.next((m) => m.payload["id"] === yes);

        // An image (its path in the thread's folder), then an edit and a delete, all seen by B.
        const image = { path: `${threadId}/${crypto.randomUUID()}.webp`, width: 900, height: 600 };
        const { messageId: pic } = await j.messaging().sendMessage({ threadId, body: "", media: image, replyToId: "" }, j.as(a.token));
        expect((await bTab.next((m) => m.payload["id"] === pic)).payload["media_path"]).toBe(image.path);
        await j.messaging().editMessage({ messageId: hi, body: "Hi Bina, free to plan the campus app?" }, j.as(a.token));
        expect((await bTab.next((m) => m.event === "message.edited" && m.payload["id"] === hi)).payload["body"]).toBe("Hi Bina, free to plan the campus app?");
        await j.messaging().deleteMessage({ messageId: hi }, j.as(a.token));
        await bTab.next((m) => m.event === "message.deleted" && m.payload["id"] === hi);
        const page = await j.messaging().threadMessages({ threadId, before: "", limit: 0 }, j.read(b.token));
        expect(page.messages.find((m) => m.id === hi)).toMatchObject({ deleted: true, body: "" });

        // B reads, leaves; A writes; B's badge shows it live and the list counts it; opening marks it read.
        await j.messaging().markThreadRead({ threadId }, j.as(b.token));
        const { messageId: four } = await j.say(a.token, threadId, "See you at 4");
        const badge = await bTab.next((m) => m.event === "badge" && m.payload["count"] === 1);
        expect(badge.payload).toEqual({ key: "chat", count: 1 });
        const list = await j.messaging().myThreads({}, j.read(b.token));
        expect(list.threads.map((t) => [t.title, t.unread, t.lastMessage])).toEqual([["Amir Chatter", 1, "See you at 4"]]);
        expect((await j.messaging().threadMessages({ threadId, before: "", limit: 0 }, j.read(b.token))).messages[0]!.id).toBe(four);
        await j.messaging().markThreadRead({ threadId }, j.as(b.token));
        expect((await j.messaging().myThreads({}, j.read(b.token))).threads[0]!.unread).toBe(0);

        // A non-member can't read, listen, post or open a DM with someone who isn't a friend.
        expect((await j.messaging().threadMessages({ threadId, before: "", limit: 0 }, j.read(outsider.token))).messages).toEqual([]);
        const cTab = await j.tab(outsider.token);
        expect(await cTab.subscribe(`thread:${threadId}`)).toMatchObject({ type: "refused" });
        await expect(j.say(outsider.token, threadId, "let me in")).rejects.toSatisfy((e) => refusalReason(e) === "not_in_chat");
        await expect(j.messaging().getOrCreateDm({ username: a.username }, j.as(outsider.token))).rejects.toSatisfy((e) => refusalReason(e) === "dm_not_allowed");

        // The venture's Chat tab takes members to the team chat (membership is work's, W5: published here as work will).
        const vid = await venture(w, a.id, [b.id]);
        const { threadId: team } = await j.messaging().ventureChat({ ventureId: vid }, j.read(b.token));
        expect(team).not.toBe("");
        await aTab.subscribe(`thread:${team}`);
        const { messageId: hello } = await j.say(b.token, team, "Hello team");
        await aTab.next((m) => m.payload["id"] === hello);
        expect((await j.messaging().ventureChat({ ventureId: vid }, j.read(outsider.token))).threadId).toBe("");
        for (const t of [aTab, bTab, cTab]) t.close();
      });

      it.todo("W13: the Message button on a profile, the empty state, the composer (Enter sends, sending marks), the image picker, axe in both themes");
      it.todo("W9: the image is re-encoded and stored in chat-media; reading it needs a signed link");
    });

    describe("chat.spec: a DM whose other member deleted their account still loads, read-only", () => {
      it("the list shows \"Deleted account\", the thread loads with its messages, and the only person left is the viewer", async () => {
        const stays = await j.createStudent(NUTECH, "Kiran Stays");
        const leaves = await j.createStudent(NUTECH, "Leena Leaves");
        await j.befriend(stays, leaves);
        const { threadId } = await j.messaging().getOrCreateDm({ username: leaves.username }, j.as(stays.token));
        await j.say(stays.token, threadId, "Before you go");

        // Identity publishes user.deleted; messaging's copies consumer removes the leaver's rows (the DM survives).
        await w.sql.begin((tx) => appendEvents(tx, [{ type: "user.deleted", subjects: [leaves.id], payload: { user_id: leaves.id } }]));
        await j.drain();

        // /chat: the thread is listed with a title (the 2026-11-15 crash was a null one) and the message still shows.
        const list = await j.messaging().myThreads({}, j.read(stays.token));
        expect(list.threads.map((t) => [t.title, t.lastMessage])).toEqual([["Deleted account", "Before you go"]]);
        const page = await j.messaging().threadMessages({ threadId, before: "", limit: 0 }, j.read(stays.token));
        expect(page.messages.map((m) => m.body)).toEqual(["Before you go"]);
        // Read-only is the page's rule (partnerGone: the only person left in ThreadPeople is the viewer); as on the
        // old stack the service does not refuse a send into such a DM, so the page must not offer one.
        const people = await j.messaging().threadPeople({ threadId }, j.read(stays.token));
        expect(people.people.map((p) => [p.name, p.isMe])).toEqual([["Kiran Stays", true]]);
      });

      it.todo("W13: the closed banner replaces the composer (no Message field) and axe on the thread");
    });
  },
  messagingWorld((x) => (w = x), worlds),
);
