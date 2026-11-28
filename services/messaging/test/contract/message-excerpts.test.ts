/**
 * What messaging added for notify (W9): MessageExcerpts, what notify_chat_message snapshotted (the first 120
 * characters, "Shared a post" or "Sent an image") and a team chat's venture. Notify only.
 */
import { ConnectError } from "@connectrpc/connect";
import { MessagingService } from "@skilient/contracts/messaging/v1/messaging_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, expect, it } from "vitest";
import { NUTECH } from "../../../people/test/contract/world";
import { journeyClient } from "../journeys/journey";
import { messagingWorld, stopWorlds, type MessagingWorld } from "./world";

const worlds: MessagingWorld[] = [];
let w: MessagingWorld;
afterAll(() => stopWorlds(worlds));

const reason = (e: unknown) => refusalReason(e) ?? `code ${ConnectError.from(e).code}`;

describeTransports(
  ["identity", "people", "content", "messaging", "realtime"],
  (env) => {
    const j = journeyClient(env, () => w);
    it("MessageExcerpts: 120 characters, or 'Sent an image'; a DM has no venture; notify only", async () => {
      const a = await j.createStudent(NUTECH, "Excerpt Sender");
      const b = await j.createStudent(NUTECH, "Excerpt Reader");
      await j.befriend(a, b);
      const { threadId } = await j.messaging().getOrCreateDm({ username: b.username }, j.as(a.token));
      const long = "x".repeat(200);
      const { messageId: text } = await j.say(a.token, threadId, long);
      const { messageId: pic } = await j.messaging().sendMessage({ threadId, body: "", media: { path: `${threadId}/${crypto.randomUUID()}.webp`, width: 10, height: 10 }, replyToId: "" }, j.as(a.token));
      const r = await env().client(MessagingService, "notify").messageExcerpts({ messageIds: [text, pic] }, env().call());
      const by = new Map(r.messages.map((m) => [m.messageId, [m.threadId, m.excerpt, m.ventureId]]));
      expect([by.get(text), by.get(pic)]).toEqual([
        [threadId, long.slice(0, 120), ""],
        [threadId, "Sent an image", ""],
      ]);
      await expect(env().client(MessagingService).messageExcerpts({ messageIds: [] }, env().call())).rejects.toSatisfy((e) => reason(e) === "caller_not_allowed");
    });
  },
  messagingWorld((x) => (w = x), worlds),
);
