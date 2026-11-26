/**
 * Journey: the share test in apps/web/tests/e2e/community.spec.ts ("Share: the recipient sees the post, and
 * 'This post isn't available' once they can't"). Content's part is whether the recipient may see the post:
 * messaging asks VisiblePosts before it sends, and the recipient's card comes from PostCards, which stops
 * returning it after a block, a staff removal or a delete. The chat message itself is messaging's (W4).
 */
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { NUTECH } from "../../../people/test/contract/world";
import { contentWorld, stopWorlds, type ContentWorld } from "../contract/world";
import { journeyClient } from "./journey";

const worlds: ContentWorld[] = [];
let w: ContentWorld;
afterAll(() => stopWorlds(worlds));

describeTransports(
  ["identity", "people", "content"],
  (env) => {
    const j = journeyClient(env, () => w);
    const visible = async (viewerId: string, postId: string) => {
      const { posts } = await j.contentAs("messaging").visiblePosts({ viewerId, postIds: [postId] }, env().call());
      return posts.find((p) => p.postId === postId)?.visible ?? false;
    };

    describe("Share (content's part)", () => {
      it("the recipient sees the post, and \"This post isn't available\" once they can't", async () => {
        const recipient = await j.createStudent(NUTECH, `Hira Reader ${Date.now().toString(36)}`);
        const sharer = await j.createStudent(NUTECH, "Sharer Saad");
        const text = "How we cut our CI time in half";
        const { postId } = await j.post(sharer.token, text);

        // Messaging may send it: the recipient can see it, and their card shows the text and its author.
        expect(await visible(recipient.id, postId)).toBe(true);
        expect((await j.cards(recipient.token, [postId])).map((c) => [c.body, c.authorName])).toEqual([[text, "Sharer Saad"]]);

        // Removed by moderation: the reader's card no longer shows it, and messaging may not send it any more.
        await j.publish("trust", "moderation.removed", [postId], { target_type: "post", target_id: postId, staff_id: null });
        expect(await visible(recipient.id, postId)).toBe(false);
        expect(await j.opens(recipient.token, postId)).toBe(false);

        // A block between the two hides a post both ways.
        const other = await j.createStudent(NUTECH, "Blocked Author");
        const { postId: second } = await j.post(other.token, "Posted before the block");
        expect(await visible(recipient.id, second)).toBe(true);
        await j.people().blockUser({ username: other.username }, j.as(recipient.token));
        await j.drain();
        expect(await visible(recipient.id, second)).toBe(false);
        expect(await j.opens(recipient.token, second)).toBe(false);
        expect(await visible(other.id, second)).toBe(true);

        // Deleted by its author: gone for the recipient too.
        const deleter = await j.createStudent(NUTECH, "Deleting Author");
        const { postId: third } = await j.post(deleter.token, "Soon to be deleted");
        expect(await visible(recipient.id, third)).toBe(true);
        await j.content().deletePost({ postId: third }, j.as(deleter.token));
        expect(await visible(recipient.id, third)).toBe(false);
        expect(await j.opens(recipient.token, third)).toBe(false);
      });

      it.todo("W13: the share dialog (focus, keyboard, note field) and axe in both themes on the post page and the chat");
    });
  },
  contentWorld((x) => (w = x), worlds),
);
