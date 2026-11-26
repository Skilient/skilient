/**
 * Journey: apps/web/tests/e2e/chat-extras.spec.ts ("typing, reply, reactions, read receipts, search, pins"),
 * through the contracts on both transports, with live updates over realtime's socket.
 */
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import { refusalReason } from "@skilient/platform";
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

    describe("chat-extras.spec: typing, reply, reactions, read receipts, search, pins", () => {
      it("a reply quotes its message; a reaction shows live and switches; receipts need both people; search finds words; the owner pins", async () => {
        const a = await j.createStudent(NUTECH, "Rehan Replies");
        const b = await j.createStudent(NUTECH, "Sana Reacts");
        await j.befriend(a, b);
        const { threadId } = await j.messaging().getOrCreateDm({ username: b.username }, j.as(a.token));
        const aTab = await j.tab(a.token);
        await aTab.subscribe(`thread:${threadId}`);

        // Reply: the quoted line travels with the reply.
        const { messageId: q } = await j.say(b.token, threadId, "Shall we meet at the library?");
        const { messageId: r } = await j.say(a.token, threadId, "Yes, at 3", q);
        const page = await j.messaging().threadMessages({ threadId, before: "", limit: 0 }, j.read(b.token));
        expect(page.messages.find((m) => m.id === r)).toMatchObject({ replyToId: q, replyExcerpt: "Shall we meet at the library?", replySenderId: b.id });

        // Reactions: one per person, a second emoji replaces the first; the other side hears it live.
        expect((await j.messaging().toggleReaction({ messageId: r, emoji: "👍" }, j.as(b.token))).on).toBe(true);
        await aTab.next((m) => m.event === "reaction.changed" && m.payload["message_id"] === r);
        await j.messaging().toggleReaction({ messageId: r, emoji: "🎉" }, j.as(b.token));
        const after = await j.messaging().threadMessages({ threadId, before: "", limit: 0 }, j.read(a.token));
        expect(after.messages.find((m) => m.id === r)!.reactions.map((x) => [x.emoji, x.count, x.mine])).toEqual([["🎉", 1, false]]);
        await expect(j.messaging().toggleReaction({ messageId: r, emoji: "👎" }, j.as(b.token))).rejects.toSatisfy((e) => refusalReason(e) === "reaction_choice");

        // Read receipts: shown while both have them on; off for one, gone for both.
        await j.messaging().markThreadRead({ threadId }, j.as(b.token));
        expect((await j.messaging().dmReceipt({ threadId }, j.read(a.token))).readAt).not.toBe("");
        await env().client(PeopleService).setReadReceipts({ on: false }, j.as(b.token));
        await j.drain();
        expect((await j.messaging().dmReceipt({ threadId }, j.read(a.token))).readAt).toBe("");
        expect((await j.messaging().dmReceipt({ threadId }, j.read(b.token))).readAt).toBe("");

        // Search: words and prefixes across the viewer's chats, with the other person's name as the title.
        const hits = await j.messaging().searchChats({ q: "libr", threadId: "" }, j.read(a.token));
        expect(hits.hits.map((h) => [h.threadTitle, h.senderName, h.excerpt])).toEqual([["Sana Reacts", "Sana Reacts", "Shall we meet at the library?"]]);
        expect((await j.messaging().searchChats({ q: "l", threadId: "" }, j.read(a.token))).hits).toEqual([]);

        // Pins: the venture's owner pins in the team chat (at most 3); a member cannot.
        const vid = await venture(w, a.id, [b.id]);
        const { threadId: team } = await j.messaging().ventureChat({ ventureId: vid }, j.read(a.token));
        const notes = [];
        for (const body of ["Agenda", "Repo link", "Deadline", "Extra"]) notes.push((await j.say(b.token, team, body)).messageId);
        for (const id of notes.slice(0, 3)) await j.messaging().pinMessage({ messageId: id, pin: true }, j.as(a.token));
        await expect(j.messaging().pinMessage({ messageId: notes[3]!, pin: true }, j.as(a.token))).rejects.toSatisfy((e) => refusalReason(e) === "pins_full");
        await expect(j.messaging().pinMessage({ messageId: notes[0]!, pin: false }, j.as(b.token))).rejects.toSatisfy((e) => refusalReason(e) === "pin_owner_only");
        expect((await j.messaging().threadPins({ threadId: team }, j.read(b.token))).pins.map((p) => p.excerpt)).toEqual(["Agenda", "Repo link", "Deadline"]);
        aTab.close();
      });

      it.todo("W13: the typing indicator (a page-to-page ping over the thread topic) and the reply, reaction and pin controls, axe in both themes");
    });
  },
  messagingWorld((x) => (w = x), worlds),
);
