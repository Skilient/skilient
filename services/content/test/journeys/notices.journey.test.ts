/**
 * Journey: the notice half of apps/web/tests/e2e/comments.spec.ts (W9 hand-off to notify), through the real
 * services' contracts on both transports: C is notified of the mention and A of the comment, with today's wording
 * ("mentioned you in a comment", "commented on your post"), and a reply notifies the commenter.
 */
import { ContentService } from "@skilient/contracts/content/v1/content_pb";
import { NotifyService } from "@skilient/contracts/notify/v1/notify_pb";
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { helpers } from "../../../community/test/contract/helpers";
import { drain, notifyWorld, stopWorlds, type NotifyWorld } from "../../../notify/test/contract/world";
import { describeNotification } from "../../../notify/src/domain/describe";
import { usernameOf } from "../../../people/test/contract/world";

const worlds: NotifyWorld[] = [];
let w: NotifyWorld;
afterAll(() => stopWorlds(worlds));

describeTransports(
  ["identity", "people", "content", "messaging", "realtime", "work", "ranking", "community", "credentials", "media", "notify"],
  (env) => {
    const h = helpers(env, () => w);
    const as = (token: string) => ({ ...env().call({ userToken: token }), headers: { "idempotency-key": crypto.randomUUID() } });

    describe("comments.spec: notices (W9)", () => {
      it("C is notified of the mention and A of the comment; the author's reply notifies the commenter", async () => {
        const author = await h.onboarded("Asma Author");
        const commenter = await h.onboarded("Bilal Commenter");
        const mentioned = await h.onboarded("Chand Mentioned");
        const { postId } = await env().client(ContentService).createPost({ type: "general", audience: "university", body: "Who is going to the career fair?" }, as(author.token));
        const { commentId } = await env()
          .client(ContentService)
          .addComment({ postId, parentId: "", body: `Me! @${await usernameOf(w, mentioned.id)} are you coming?` }, as(commenter.token));
        await env().client(ContentService).addComment({ postId, parentId: commentId, body: "See you there." }, as(author.token));
        await drain(w, env().host);
        const said = async (u: { token: string }) =>
          (await env().client(NotifyService).myNotifications({ before: "", limit: 0 }, env().call({ userToken: u.token }))).notifications.map(
            (n) => describeNotification({ type: n.type, actorName: n.actorName || null, entityType: n.entityType, entityId: n.entityId, data: JSON.parse(n.dataJson) as Record<string, unknown> }).text,
          );
        expect(await said(author)).toEqual([expect.stringMatching(/^Bilal Commenter commented on your post/)]);
        expect(await said(mentioned)).toEqual([expect.stringMatching(/^Bilal Commenter mentioned you in a comment/)]);
        expect(await said(commenter)).toEqual([expect.stringMatching(/^Asma Author replied to your comment/)]);
      });
    });
  },
  notifyWorld((x) => (w = x), worlds),
);
