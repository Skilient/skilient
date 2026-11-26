/**
 * content's contract on both transports (memory and HTTP/2), co-hosted with identity and people: every method
 * is implemented, every caller rule holds, and each area answers through the contract as web (or messaging,
 * notify, trust, market) will call it. Golden replays (test/golden) pin the rules; these pin the wiring, the
 * events in and out, the idempotency of writes and the calls content makes to people and identity.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Code, ConnectError } from "@connectrpc/connect";
import { ContentService } from "@skilient/contracts/content/v1/content_pb";
import { IdentityService } from "@skilient/contracts/identity/v1/identity_pb";
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import { refusalReason, RESTRICTED } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import type postgres from "postgres";
import { afterAll, expect, it } from "vitest";
import { PASSWORD, usernameOf } from "../../../people/test/contract/world";
import { contentWorld, drainCopies, NU, publishAs, setShippedNames, stopWorlds, student, type ContentWorld } from "./world";

const worlds: ContentWorld[] = [];
let w: ContentWorld;
afterAll(() => stopWorlds(worlds));

const reason = (e: unknown) => refusalReason(e) ?? `code ${ConnectError.from(e).code}`;
const code = (e: unknown) => ConnectError.from(e).code;
const WEB_ONLY = new Set(ContentService.methods.map((m) => m.localName));
WEB_ONLY.delete("visiblePosts");

describeTransports(
  ["identity", "people", "content"],
  (env) => {
    const content = (as = "web") => env().client(ContentService, as);
    const people = () => env().client(PeopleService);
    const asUser = (token: string, key: string | null = crypto.randomUUID()) => {
      const o = env().call({ userToken: token });
      return key ? { ...o, headers: { "idempotency-key": key } } : o;
    };
    const events = async (type: string, subject?: string) =>
      w.content<{ payload: Record<string, unknown> }[]>`
        select payload from platform.events where type = ${type} and (${subject ?? null}::uuid is null or ${subject ?? null}::uuid = any(subjects)) order by seq`;
    const newPost = (body: string, extra: Record<string, unknown> = {}) => ({ type: "general", audience: "university", body, media: [], pinDays: 0, ...extra });
    let roles: Record<string, postgres.Sql> = {};
    const roleOf = async (service: string) => (roles[service] ??= await w.pg.service(service, mkdtempSync(join(tmpdir(), "mig-"))));

    it("implements every method in the contract", async () => {
      roles = {};
      for (const m of ContentService.methods) {
        const fn = (content(m.localName === "visiblePosts" ? "messaging" : "web") as unknown as Record<string, (req: object, o: object) => Promise<unknown>>)[m.localName]!;
        const err = await fn({}, env().call()).then(
          () => null,
          (e: unknown) => e,
        );
        if (err) expect([m.localName, code(err)]).not.toEqual([m.localName, Code.Unimplemented]);
      }
    });

    it("refuses callers outside each method's list", async () => {
      for (const name of ["createPost", "feedPage", "addComment", "answerSurvey"])
        await expect((content("people") as unknown as Record<string, (r: object, o: object) => Promise<unknown>>)[name]!({}, env().call())).rejects.toSatisfy(
          (e) => code(e) === Code.PermissionDenied,
        );
      await expect(content("work").visiblePosts({ viewerId: "", postIds: [] }, env().call())).rejects.toSatisfy((e) => code(e) === Code.PermissionDenied);
      for (const caller of ["messaging", "notify", "trust", "market"]) await expect(content(caller).visiblePosts({ viewerId: "", postIds: [] }, env().call())).resolves.toBeDefined();
      expect(WEB_ONLY.size).toBe(ContentService.methods.length - 1);
    });

    it("posts: create publishes post.created with ids only; cards carry people's names; one write per idempotency key", async () => {
      const a = await student(w, { fullName: "Poster Person" });
      const b = await student(w, { fullName: "Reader Person" });
      const key = crypto.randomUUID();
      const { postId } = await content().createPost(newPost("Hello from the contract https://example.test/x"), asUser(a.token, key));
      const again = await content().createPost(newPost("Hello from the contract https://example.test/x"), asUser(a.token, key));
      expect(again.postId).toBe(postId);
      const [created] = await events("post.created", postId);
      expect(created!.payload).toEqual({ post_id: postId, author_id: a.id, type: "general", audience: "university", university_id: expect.any(String), society_id: null, venture_id: null });
      expect(JSON.stringify(created!.payload)).not.toContain("Hello");
      const [job] = await w.content`select payload ->> 'url' as url from platform.jobs where kind = 'link-preview' order by created_at desc limit 1`;
      expect(job).toEqual({ url: "https://example.test/x" });
      const { cards } = await content().postCards({ postIds: [postId] }, asUser(b.token, null));
      expect(cards.map((c) => [c.id, c.authorName, c.authorUsername, c.isMine, c.canEdit, c.commentCount])).toEqual([
        [postId, "Poster Person", await usernameOf(w, a.id), false, false, 0],
      ]);
      const mine = await content().postCards({ postIds: [postId] }, asUser(a.token, null));
      expect([mine.cards[0]!.isMine, mine.cards[0]!.canEdit]).toEqual([true, true]);
      await content().editPost({ postId, body: "Edited through the contract" }, asUser(a.token));
      const { mediaPaths } = await content().deletePost({ postId }, asUser(a.token));
      expect(mediaPaths).toEqual([]);
      const [removed] = await events("post.removed", postId);
      expect(removed!.payload).toMatchObject({ post_id: postId, reason: "deleted", media_paths: [] });
      await expect(content().postCards({ postIds: [postId] }, env().call())).rejects.toSatisfy((e) => reason(e) === "not_signed_in");
    });

    it("blocks and friendships from people reach content: a block hides the post both ways", async () => {
      const a = await student(w, { fullName: "Block A" });
      const b = await student(w, { fullName: "Block B" });
      const { postId } = await content().createPost(newPost("Before the block"), asUser(a.token));
      expect((await content().postCards({ postIds: [postId] }, asUser(b.token, null))).cards).toHaveLength(1);
      await people().blockUser({ username: await usernameOf(w, a.id) }, asUser(b.token));
      await drainCopies(w);
      expect((await content().postCards({ postIds: [postId] }, asUser(b.token, null))).cards).toHaveLength(0);
      const seen = await content("messaging").visiblePosts({ viewerId: b.id, postIds: [postId] }, env().call());
      expect(seen.posts).toEqual([expect.objectContaining({ postId, authorId: a.id, visible: false })]);
      await expect(content().addComment({ postId, parentId: "", body: "Blocked comment" }, asUser(b.token))).rejects.toSatisfy((e) => reason(e) === "no_such_post");
      await people().unblockUser({ username: await usernameOf(w, a.id) }, asUser(b.token));
      await drainCopies(w);
      expect((await content().postCards({ postIds: [postId] }, asUser(b.token, null))).cards).toHaveLength(1);
    });

    it("staff announcements need identity's staff role at aal2; another university can't see university posts", async () => {
      const staff = await student(w, { staffRoles: ["moderator"] });
      const plain = await student(w);
      await expect(content().createPost(newPost("Not staff", { type: "announcement" }), asUser(plain.token))).rejects.toSatisfy((e) => reason(e) === "staff_announcements");
      const { postId } = await content().createPost(newPost("Platform news", { type: "announcement", pinDays: 3 }), asUser(staff.token));
      expect((await content().pinnedAnnouncement({}, asUser(plain.token, null))).postId).toBe(postId);
      const other = await student(w, { uni: NU });
      const { postId: uniPost } = await content().createPost(newPost("Only at my university"), asUser(plain.token));
      expect((await content().postCards({ postIds: [uniPost, postId] }, asUser(other.token, null))).cards.map((c) => c.id)).toEqual([postId]);
    });

    it("comments resolve @mentions through people once and publish comment.created with ids", async () => {
      const a = await student(w, { fullName: "Comment Author" });
      const b = await student(w, { fullName: "Commenter" });
      const c = await student(w, { fullName: "Mentioned" });
      const { postId } = await content().createPost(newPost("Talk to me"), asUser(a.token));
      const { commentId } = await content().addComment({ postId, parentId: "", body: `Hello @${await usernameOf(w, c.id)} and @nobody_here` }, asUser(b.token));
      const [ev] = await events("comment.created", commentId);
      expect(ev!.payload).toEqual({ comment_id: commentId, post_id: postId, author_id: b.id, post_author_id: a.id, parent_author_id: null, mentioned_ids: [c.id] });
      const list = await content().postComments({ postId }, asUser(a.token, null));
      expect(list.comments.map((x) => [x.authorName, x.canDelete, x.isMine])).toEqual([["Commenter", true, false]]);
      await content().pinComment({ commentId, pin: true }, asUser(a.token));
      await content().deleteComment({ commentId }, asUser(a.token));
      expect((await content().postComments({ postId }, asUser(a.token, null))).comments.map((x) => [x.deleted, x.pinned, x.body])).toEqual([[true, false, ""]]);
    });

    it("survey, views and the feed through the contract; the feed page carries its cards", async () => {
      const a = await student(w, { fullName: "Feed Author" });
      const b = await student(w, { fullName: "Feed Reader" });
      const { postId } = await content().createPost(newPost("A post to rank"), asUser(a.token));
      await w.content`update content.posts set created_at = now() - interval '3 hours', stage = 'limited' where id = ${postId}`;
      const page = await content().feedPage({ audience: "university", filter: "all", cursor: "", limit: 5, withCards: true }, asUser(b.token));
      expect(page.items.map((i) => i.postId)).toContain(postId);
      expect(page.cards.find((c) => c.id === postId)?.authorName).toBe("Feed Author");
      const strip = await content().surveyForPosts({ postIds: [postId] }, asUser(b.token));
      expect(strip.entries[0]!.dimension).not.toBe("");
      await expect(content().answerSurvey({ postId, answer: true, latencyMs: 1500 }, asUser(b.token))).rejects.toSatisfy((e) => reason(e) === "read_first");
      expect((await content().recordViews({ postIds: [postId, postId] }, asUser(b.token))).recorded).toBe(1);
      await content().answerSurvey({ postId, answer: true, latencyMs: 1500 }, asUser(b.token));
      const [ans] = await events("survey.answered", postId);
      expect(ans!.payload).toMatchObject({ post_id: postId, user_id: b.id, answer: true });
      await expect(content().postInsights({ postId }, asUser(a.token, null))).rejects.toSatisfy((e) => reason(e) === "insights_paid");
      await publishAs(await roleOf("billing"), "entitlement.changed", [a.id], { subject_id: a.id, key: "insights.post_survey", value: true });
      await drainCopies(w);
      expect((await content().postInsights({ postId }, asUser(a.token, null))).rows.length).toBeGreaterThan(0);
      await expect(content().feedPage({ audience: "university", filter: "popular", cursor: "", limit: 5, withCards: false }, asUser(b.token))).rejects.toSatisfy(
        (e) => reason(e) === "unknown_filter",
      );
    });

    it("a suspended user cannot post, comment, vote or RSVP (refuse_if_restricted on content's tables)", async () => {
      const mod = await student(w, { staffRoles: ["moderator"] });
      const s = await student(w, { fullName: "Suspended Poster" });
      const a = await student(w);
      const { postId } = await content().createPost(newPost("Comment here"), asUser(a.token));
      const id = env().client(IdentityService);
      const until = new Date(Date.now() + 86_400_000).toISOString();
      await env().client(IdentityService, "trust").sanctionUser({ userId: s.id, kind: "suspend", until, reason: "spam posts", sanctionId: crypto.randomUUID() }, asUser(mod.token));
      const session = (await id.signInPassword({ email: s.email, password: PASSWORD, deviceHash: "d".repeat(64), ipHash: "1".repeat(64), userAgent: "contract/1.0", captchaToken: "" }, env().call()))
        .session!;
      await expect(content().createPost(newPost("Suspended post"), asUser(session.accessToken))).rejects.toSatisfy((e) => reason(e) === RESTRICTED);
      await expect(content().addComment({ postId, parentId: "", body: "Suspended comment" }, asUser(session.accessToken))).rejects.toSatisfy((e) => reason(e) === RESTRICTED);
      // Reading stays open.
      expect((await content().postCards({ postIds: [postId] }, asUser(session.accessToken, null))).cards).toHaveLength(1);
    });

    it("other owners' events: a Shipped post on venture.completed, trust's removal, user.deleted with confirmation", async () => {
      const owner = await student(w, { fullName: "Venture Owner" });
      const reader = await student(w);
      const work = await roleOf("work");
      const venture = crypto.randomUUID();
      setShippedNames({ owners: new Map([[owner.id, "Venture Owner"]]), titles: new Map([[venture, "Rocket"]]) });
      await publishAs(work, "venture.completed", [venture, owner.id], { venture_id: venture, owner_id: owner.id, university_id: null, visibility: "public" });
      await drainCopies(w);
      const [shipped] = await w.content<{ id: string; body: string; stage: string }[]>`select id::text, body, stage from content.posts where venture_id = ${venture}`;
      expect(shipped).toMatchObject({ body: "Venture Owner shipped Rocket.", stage: "full" });
      // Only work may say a venture shipped.
      await publishAs(await roleOf("market"), "venture.completed", [crypto.randomUUID(), owner.id], { venture_id: crypto.randomUUID(), owner_id: owner.id, university_id: null, visibility: "public" });
      await drainCopies(w);
      expect((await w.content`select count(*)::int as n from content.posts where author_id = ${owner.id} and type = 'shipped'`)[0]).toEqual({ n: 1 });

      const { postId } = await content().createPost(newPost("To be removed"), asUser(owner.token));
      await publishAs(await roleOf("trust"), "moderation.removed", [postId], { target_type: "post", target_id: postId, staff_id: null });
      await drainCopies(w);
      expect((await content().postCards({ postIds: [postId] }, asUser(reader.token, null))).cards).toHaveLength(0);

      await publishAs(w.sql, "user.deleted", [owner.id], { user_id: owner.id });
      await drainCopies(w);
      expect((await w.content`select count(*)::int as n from content.posts where author_id = ${owner.id}`)[0]).toEqual({ n: 0 });
      expect((await events("user.deletion_confirmed", owner.id)).map((e) => e.payload)).toEqual([{ user_id: owner.id }]);
    });
  },
  contentWorld((x) => (w = x), worlds),
);
