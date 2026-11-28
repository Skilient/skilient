/**
 * Journey: apps/web/tests/e2e/comments.spec.ts, through identity, people and content's contracts on both
 * transports. Mute goes through people's MuteUser and reaches content as the `mute.changed` copy.
 */
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { NUTECH } from "../../../people/test/contract/world";
import { contentWorld, stopWorlds, type ContentWorld } from "../contract/world";
import { journeyClient } from "./journey";

const worlds: ContentWorld[] = [];
let w: ContentWorld;
afterAll(() => stopWorlds(worlds));
const reason = (e: unknown) => refusalReason(e);

describeTransports(
  ["identity", "people", "content"],
  (env) => {
    const j = journeyClient(env, () => w);
    const comments = async (token: string, postId: string) => (await j.content().postComments({ postId }, j.read(token))).comments;
    const inFeed = async (token: string, postId: string) => (await j.feed(token, "university")).items.some((i) => i.postId === postId);

    describe("Comments, hide and mute", () => {
      it("comment, mention, reply, pin, delete; hide and mute with undo", async () => {
        const author = await j.createStudent(NUTECH, "Asma Author");
        const commenter = await j.createStudent(NUTECH, "Bilal Commenter");
        const mentioned = await j.createStudent(NUTECH, "Chand Mentioned");
        const text = `Who is going to the career fair ${Date.now().toString(36)}?`;
        const { postId } = await j.post(author.token, text);
        await j.promote([postId]);

        // No comments yet; B comments and mentions C.
        expect(await comments(commenter.token, postId)).toEqual([]);
        const { commentId } = await j.content().addComment({ postId, parentId: "", body: `Me! @${mentioned.username} are you coming?` }, j.as(commenter.token));
        const first = await comments(commenter.token, postId);
        expect(first.map((c) => [c.body, c.authorName, c.isMine, c.canDelete])).toEqual([[`Me! @${mentioned.username} are you coming?`, "Bilal Commenter", true, true]]);
        expect((await j.cards(author.token, [postId]))[0]!.commentCount).toBe(1);
        // 10 seconds between comments.
        await expect(j.content().addComment({ postId, parentId: "", body: "And another thing" }, j.as(commenter.token))).rejects.toSatisfy(
          (e) => reason(e) === "comment_rate_limited",
        );

        // C is named in the mention and A is the post's author: the event carries both for notify (W9 writes the wording).
        const [ev] = await w.content<{ payload: Record<string, unknown> }[]>`select payload from platform.events where type = 'comment.created' and ${commentId}::uuid = any(subjects)`;
        expect(ev!.payload).toMatchObject({ comment_id: commentId, post_author_id: author.id, author_id: commenter.id, mentioned_ids: [mentioned.id] });

        // A replies to B (one level only), then pins B's comment.
        const { commentId: replyId } = await j.content().addComment({ postId, parentId: commentId, body: "See you there." }, j.as(author.token));
        await expect(j.content().addComment({ postId, parentId: replyId, body: "A reply to a reply" }, j.as(mentioned.token))).rejects.toSatisfy(
          (e) => reason(e) === "reply_depth",
        );
        await j.content().pinComment({ commentId, pin: true }, j.as(author.token));
        const seenByAuthor = await comments(author.token, postId);
        expect(seenByAuthor.map((c) => [c.body, c.parentId === "" ? "top" : "reply", c.pinned, c.isMine])).toEqual([
          [`Me! @${mentioned.username} are you coming?`, "top", true, false],
          ["See you there.", "reply", false, true],
        ]);
        await expect(j.content().pinComment({ commentId, pin: true }, j.as(commenter.token))).rejects.toSatisfy((e) => reason(e) === "pin_author_only");

        // B deletes her comment: it stays as a placeholder so the reply keeps its context.
        await j.content().deleteComment({ commentId }, j.as(commenter.token));
        const after = await comments(commenter.token, postId);
        expect(after.map((c) => [c.deleted, c.body, c.pinned])).toEqual([[true, "", false], [false, "See you there.", false]]);
        await expect(j.content().deleteComment({ commentId: replyId }, j.as(commenter.token))).rejects.toSatisfy((e) => reason(e) === "comment_delete_refused");

        // "Not for me" takes the post out of B's feed; Undo brings it back.
        expect(await inFeed(commenter.token, postId)).toBe(true);
        await j.content().hidePost({ postId, hide: true }, j.as(commenter.token));
        expect(await inFeed(commenter.token, postId)).toBe(false);
        await j.content().hidePost({ postId, hide: false }, j.as(commenter.token));
        expect(await inFeed(commenter.token, postId)).toBe(true);

        // Mute takes A's posts out of B's feed (the card says so), and unmuting brings them back.
        await j.people().muteUser({ username: author.username, mute: true }, j.as(commenter.token));
        await j.drain();
        expect(await inFeed(commenter.token, postId)).toBe(false);
        expect((await j.cards(commenter.token, [postId]))[0]!.authorMuted).toBe(true);
        expect((await j.people().listMutes({}, j.read(commenter.token))).muted.map((m) => m.fullName)).toEqual(["Asma Author"]);
        await j.people().muteUser({ username: author.username, mute: false }, j.as(commenter.token));
        await j.drain();
        expect(await inFeed(commenter.token, postId)).toBe(true);
        expect((await j.cards(commenter.token, [postId]))[0]!.authorMuted).toBe(false);
      });

      it.todo("W13: the post page's \"No comments yet\", the reply box, the Pinned by the author label, the Undo toast and the Friends -> Blocked list, axe in both themes");
    });
  },
  contentWorld((x) => (w = x), worlds),
);
