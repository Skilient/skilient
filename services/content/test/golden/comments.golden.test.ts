/**
 * Golden replays of comments.json against content's store (packages/testing/test/content.golden.test.ts,
 * "comments"). Notifications were notify's rows (rule 2): the cases check comment.created's recipients instead.
 */
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addComment, deleteComment, hidePost, mentionedUsernames, pinComment, postComments } from "../../src/store/comments";
import {
  ASMA,
  BILAL,
  block,
  call,
  CYRA,
  DANYAL,
  ESHA,
  GRAD,
  insertComment,
  insertPost,
  NAME,
  people,
  replay,
  startWorld,
  step,
  STAFF,
  UNI_B,
  USERNAME,
  UUID_X,
  type Tx,
} from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

const noop = () => {};
const add = (me: string | null, post: string, parent: string | null, body: string) => async (sp: Tx) =>
  addComment(sp, me, post, parent, body, await people.resolve(mentionedUsernames(body.trim())), noop);
const lastCommentEvent = async (tx: Tx) =>
  (await tx<{ payload: Record<string, unknown> }[]>`select payload from platform.events where type = 'comment.created' order by seq desc limit 1`)[0]!.payload;

describe("comments.json", () => {
  it("add", () =>
    replay(sql, "comments", "add", async (tx) => {
      const out: Record<string, unknown> = {};
      const post = await insertPost(tx, BILAL, "Comment on me", { hoursAgo: 4 });
      const global = await insertPost(tx, BILAL, "Comment on me, global", { audience: "global", hoursAgo: 4 });
      await insertPost(tx, CYRA, "Comment on me at B", { university: UNI_B, hoursAgo: 4 });
      const first = await step(tx, add(ASMA, post, null, "  A first comment  "));
      out["comment"] = first;
      const firstId = (first.result as { ok: true; value: string }).value;
      out["second_within_10s"] = await call(tx, add(ASMA, post, null, "Too soon after the last"));
      const reply = await step(tx, add(DANYAL, post, firstId, "A reply to the first"));
      out["reply"] = reply;
      const replyId = (reply.result as { ok: true; value: string }).value;
      out["reply_to_a_reply"] = await call(tx, add(STAFF, post, replyId, "A reply to a reply"));
      out["reply_to_unknown_parent"] = await call(tx, add(STAFF, post, UUID_X, "Nobody here"));
      out["reply_parent_on_other_post"] = await call(tx, add(STAFF, global, firstId, "Wrong post"));
      out["empty"] = await call(tx, add(STAFF, post, null, "    "));
      out["null_body"] = await call(tx, add(STAFF, post, null, ""));
      out["too_long"] = await call(tx, add(STAFF, post, null, "z".repeat(1001)));
      out["exactly_1000"] = await step(tx, add(STAFF, post, null, "z".repeat(1000)));
      out["other_university"] = await call(tx, add(CYRA, post, null, "I should not see this"));
      out["global_from_other_university"] = await step(tx, add(CYRA, global, null, "Hello from B"));
      out["unknown_post"] = await call(tx, add(GRAD, UUID_X, null, "Nothing here"));
      out["mentions"] = await step(tx, add(GRAD, post, null, "Thanks @ct_danyal and @CT_ASMA, also @ct_cyra and @ct_bilal and @nobody_here"));
      // Rule 2: today's comment_mention notifications went to Danyal and Asma (Cyra is at B; Bilal wrote the post).
      expect(await lastCommentEvent(tx)).toMatchObject({ post_author_id: BILAL, mentioned_ids: [DANYAL, ASMA] });
      out["mention_on_global_reaches_other_university"] = await step(tx, add(ESHA, global, null, "Welcome @ct_cyra and @ct_asma"));
      expect(await lastCommentEvent(tx)).toMatchObject({ mentioned_ids: [CYRA, ASMA] });
      await block(tx, ASMA, BILAL);
      out["commenter_blocked_the_post_author"] = await call(tx, add(ASMA, post, null, "Blocked now"));
      out["signed_out"] = await call(tx, add(null, post, null, "Anon"), "add_comment");
      return out;
    }));

  it("add_reply_rules", () =>
    replay(sql, "comments", "add_reply_rules", async (tx) => {
      const out: Record<string, unknown> = {};
      const post = await insertPost(tx, BILAL, "Reply rules", { hoursAgo: 4 });
      const c1 = await insertComment(tx, post, DANYAL, "Top level by Danyal", { minutesAgo: 30 });
      const gone = await insertComment(tx, post, STAFF, "Will be deleted", { minutesAgo: 20 });
      await tx`update content.post_comments set deleted_at = now(), body = '' where id = ${gone}`;
      out["reply_to_deleted"] = await call(tx, add(ASMA, post, gone, "Reply to nothing"));
      await block(tx, ASMA, DANYAL);
      out["reply_to_blocked_author"] = await call(tx, add(ASMA, post, c1, "Reply to someone I blocked"));
      out["blocked_user_replies_to_own_comment"] = await call(tx, add(DANYAL, post, c1, "Reply to myself"));
      out["second_reply_rate_limited"] = await step(tx, add(DANYAL, post, c1, "Reply to myself, again"));
      return out;
    }));

  it("delete", () =>
    replay(sql, "comments", "delete", async (tx) => {
      const out: Record<string, unknown> = {};
      const post = await insertPost(tx, BILAL, "Delete comments here", { hoursAgo: 4 });
      const c1 = await insertComment(tx, post, ASMA, "Asma comment to delete", { minutesAgo: 40 });
      const c2 = await insertComment(tx, post, DANYAL, "Danyal comment to delete", { minutesAgo: 30 });
      const c3 = await insertComment(tx, post, STAFF, "Staff comment to keep", { minutesAgo: 20 });
      const pinned = await insertComment(tx, post, ASMA, "Pinned comment to delete", { minutesAgo: 10, pinned: true });
      const del = (me: string | null, id: string) => (sp: Tx) => deleteComment(sp, me, id);
      out["by_author"] = await step(tx, del(ASMA, c1));
      out["by_post_author"] = await step(tx, del(BILAL, c2));
      out["by_stranger"] = await call(tx, del(DANYAL, c3));
      out["twice"] = await call(tx, del(ASMA, c1));
      out["unknown"] = await call(tx, del(ASMA, UUID_X));
      out["pinned_loses_pin"] = await step(tx, del(ASMA, pinned));
      out["signed_out"] = await call(tx, del(null, c3), "delete_comment");
      return out;
    }));

  it("pin", () =>
    replay(sql, "comments", "pin", async (tx) => {
      const out: Record<string, unknown> = {};
      const post = await insertPost(tx, BILAL, "Pin comments here", { hoursAgo: 4 });
      const c1 = await insertComment(tx, post, ASMA, "First top level comment", { minutesAgo: 40 });
      const c2 = await insertComment(tx, post, DANYAL, "Second top level comment", { minutesAgo: 30 });
      const r1 = await insertComment(tx, post, STAFF, "A reply to the first", { minutesAgo: 20, parent: c1 });
      const gone = await insertComment(tx, post, STAFF, "Deleted one", { minutesAgo: 10 });
      await tx`update content.post_comments set deleted_at = now(), body = '' where id = ${gone}`;
      const pin = (me: string | null, id: string, p: boolean) => (sp: Tx) => pinComment(sp, me, id, p);
      out["pin"] = await step(tx, pin(BILAL, c1, true));
      out["pin_another_unpins_first"] = await step(tx, pin(BILAL, c2, true));
      out["pin_a_reply"] = await call(tx, pin(BILAL, r1, true));
      out["pin_by_commenter"] = await call(tx, pin(ASMA, c1, true));
      out["pin_deleted"] = await call(tx, pin(BILAL, gone, true));
      out["pin_unknown"] = await call(tx, pin(BILAL, UUID_X, true));
      out["unpin"] = await step(tx, pin(BILAL, c2, false));
      out["unpin_when_not_pinned"] = await step(tx, pin(BILAL, c2, false));
      out["signed_out"] = await call(tx, pin(null, c1, true), "pin_comment");
      return out;
    }));

  it("hide", () =>
    replay(sql, "comments", "hide", async (tx) => {
      const out: Record<string, unknown> = {};
      const post = await insertPost(tx, BILAL, "Hide this one", { hoursAgo: 4 });
      const other = await insertPost(tx, CYRA, "Hide at B", { university: UNI_B, hoursAgo: 4 });
      const held = await insertPost(tx, BILAL, "Hide held", { hoursAgo: 4, stage: "held" });
      const hide = (me: string | null, id: string, h: boolean) => (sp: Tx) => hidePost(sp, me, id, h);
      out["hide"] = await step(tx, hide(ASMA, post, true));
      out["hide_twice"] = await step(tx, hide(ASMA, post, true));
      out["second_reader"] = await step(tx, hide(DANYAL, post, true));
      out["unhide"] = await step(tx, hide(ASMA, post, false));
      out["unhide_when_not_hidden"] = await step(tx, hide(ASMA, post, false));
      out["author_hides_own"] = await step(tx, hide(BILAL, post, true));
      out["invisible_other_university"] = await call(tx, hide(ASMA, other, true));
      out["held_post_of_someone_else"] = await call(tx, hide(ASMA, held, true));
      out["unknown_post"] = await call(tx, hide(ASMA, UUID_X, true));
      out["signed_out"] = await call(tx, hide(null, post, true), "hide_post");
      return out;
    }));

  it("list", () =>
    replay(sql, "comments", "list", async (tx) => {
      const out: Record<string, unknown> = {};
      const post = await insertPost(tx, BILAL, "List my comments", { hoursAgo: 6 });
      const other = await insertPost(tx, CYRA, "List at B", { university: UNI_B, hoursAgo: 6 });
      const c1 = await insertComment(tx, post, ASMA, "First comment by Asma", { minutesAgo: 100 });
      await insertComment(tx, post, DANYAL, "Second comment by Danyal", { minutesAgo: 90 });
      const c3 = await insertComment(tx, post, STAFF, "Third comment by Staff, pinned", { minutesAgo: 80, pinned: true });
      await insertComment(tx, post, DANYAL, "Reply by Danyal to Asma", { minutesAgo: 70, parent: c1 });
      await insertComment(tx, post, ASMA, "Reply by Asma to Staff", { minutesAgo: 60, parent: c3 });
      const gone = await insertComment(tx, post, STAFF, "Deleted by its author", { minutesAgo: 50 });
      await tx`update content.post_comments set deleted_at = now(), body = '' where id = ${gone}`;
      const hiddenByUni = await insertComment(tx, post, GRAD, "Hidden by the university", { minutesAgo: 40 });
      await tx`update content.post_comments set hidden_by_university_at = now() where id = ${hiddenByUni}`;
      await insertComment(tx, post, ESHA, "Comment by Esha from B", { minutesAgo: 30 });
      await insertComment(tx, other, CYRA, "Comment on a post at B", { minutesAgo: 20 });
      const list = (me: string | null, id: string, fn?: string) =>
        call(
          tx,
          async (sp) =>
            (await postComments(sp, me, id)).map((l) => ({
              body: l.body,
              pinned: l.pinned,
              deleted: l.deleted,
              reply: l.parent_id !== null,
              author_username: l.show_profile ? (USERNAME[l.author_id] ?? null) : null,
              author_name: l.show_name ? NAME[l.author_id] : null,
              author_avatar_path: null,
              is_mine: l.is_mine,
              can_delete: l.can_delete,
              created_at: (l.created_at as Date).toISOString(),
            })),
          fn,
        );
      out["as_post_author"] = await list(BILAL, post);
      out["as_commenter"] = await list(ASMA, post);
      out["as_hidden_comment_author"] = await list(GRAD, post);
      out["as_staff"] = await list(STAFF, post);
      await block(tx, ASMA, DANYAL);
      out["blocker_does_not_see_blocked"] = await list(ASMA, post);
      out["blocked_does_not_see_blocker"] = await list(DANYAL, post);
      out["other_university_post"] = await list(ASMA, other);
      out["from_other_university_global"] = await list(CYRA, post);
      out["unknown_post"] = await list(ASMA, UUID_X);
      out["signed_out"] = await list(null, post, "post_comment_list");
      return out;
    }));
});
