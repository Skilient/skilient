/**
 * What content added for notify (W9): CommentExcerpts, the first 120 characters of comments as add_comment
 * snapshotted them for the comment, reply and mention notices; deleted comments are left out. Notify only.
 */
import { ConnectError } from "@connectrpc/connect";
import { ContentService } from "@skilient/contracts/content/v1/content_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, expect, it } from "vitest";
import { NUTECH } from "../../../people/test/contract/world";
import { journeyClient } from "../journeys/journey";
import { contentWorld, stopWorlds, type ContentWorld } from "./world";

const worlds: ContentWorld[] = [];
let w: ContentWorld;
afterAll(() => stopWorlds(worlds));

const reason = (e: unknown) => refusalReason(e) ?? `code ${ConnectError.from(e).code}`;

describeTransports(
  ["identity", "people", "content"],
  (env) => {
    const j = journeyClient(env, () => w);
    it("CommentExcerpts: 120 characters, the post's id; notify only", async () => {
      const a = await j.createStudent(NUTECH, "Excerpt Author");
      const { postId } = await j.post(a.token, "Plover census this weekend.");
      const long = `Count me in ${"and bring the spare tripod ".repeat(8)}`;
      const { commentId } = await j.content().addComment({ postId, parentId: "", body: long }, j.as(a.token));
      const r = await env().client(ContentService, "notify").commentExcerpts({ commentIds: [commentId, crypto.randomUUID()] }, env().call());
      expect(r.comments.map((c) => [c.commentId, c.postId, c.excerpt])).toEqual([[commentId, postId, long.slice(0, 120)]]);
      await expect(env().client(ContentService).commentExcerpts({ commentIds: [] }, env().call())).rejects.toSatisfy((e) => reason(e) === "caller_not_allowed");
    });
  },
  contentWorld((x) => (w = x), worlds),
);
