/**
 * Golden replays of posts.json against content's store, with the recorded inputs
 * (packages/testing/test/content.golden.test.ts, "posts" and "posts, more").
 */
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, it } from "vitest";
import { cardRows, cards } from "../../src/store/cards";
import { hidePost } from "../../src/store/comments";
import { createPost, deletePost, editPost, listPosts, pinnedAnnouncement, rsvpEvent, votePoll, type NewPost } from "../../src/store/posts";
import {
  addEvent,
  addMedia,
  addPoll,
  ASMA,
  BILAL,
  block,
  bodyMap,
  call,
  CYRA,
  DANYAL,
  FRESH,
  GRAD,
  insertComment,
  insertPost,
  isStaff,
  MEDIA,
  mute,
  named,
  people,
  replay,
  startWorld,
  step,
  STAFF,
  UNI_A,
  UNI_B,
  UUID_X,
  type Outcome,
  type Tx,
} from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

const uploaded = new Set(Object.values(MEDIA));
const checks = (me: string | null) => ({
  restricted: () => {},
  isStaff: async () => isStaff(me),
  missing: async (paths: string[]) => paths.filter((p) => !uploaded.has(p)),
});
const post = (p: Partial<NewPost> & { type: string; body: string; poll?: { options: unknown; days: number } | null; event?: NewPost["event"] }): NewPost => ({
  audience: "university",
  media: [],
  venture_id: null,
  society_id: null,
  event: null,
  poll: null,
  pin_days: 0,
  ...p,
});
const create = (tx: Tx, me: string | null, p: NewPost) => step(tx, (sp) => createPost(sp, me, p, checks(me)));
const tryCreate = (tx: Tx, me: string | null, p: NewPost, fn?: string) => call(tx, (sp) => createPost(sp, me, p, checks(me)), fn);
const noop = () => {};

describe("posts.json", () => {
  it("create", () =>
    replay(sql, "posts", "create", async (tx) => {
      const out: Record<string, unknown> = {};
      out["general_university_with_images"] = await create(
        tx,
        ASMA,
        post({
          type: "general",
          body: "  Hello from A, with pictures  ",
          media: [
            { path: MEDIA.asma1, width: 800, height: 600 },
            { path: MEDIA.asma2, width: 640, height: 480 },
          ],
        }),
      );
      out["second_within_30s"] = await tryCreate(tx, ASMA, post({ type: "general", body: "Too soon" }));
      out["global_general"] = await create(tx, CYRA, post({ type: "general", audience: "global", body: "Hello world from B" }));
      out["someone_elses_image"] = await tryCreate(tx, BILAL, post({ type: "general", body: "Stolen picture", media: [{ path: MEDIA.asma1, width: 10, height: 10 }] }));
      out["five_images"] = await tryCreate(
        tx,
        BILAL,
        post({ type: "general", body: "Too many", media: Array.from({ length: 5 }, () => ({ path: MEDIA.bilal1, width: 10, height: 10 })) }),
      );
      out["images_on_poll"] = await tryCreate(
        tx,
        BILAL,
        post({ type: "poll", body: "Poll with a picture", media: [{ path: MEDIA.bilal1, width: 10, height: 10 }], poll: { options: ["a", "b"], days: 1 } }),
      );
      out["empty_body"] = await tryCreate(tx, BILAL, post({ type: "general", body: "   " }));
      out["long_body"] = await tryCreate(tx, BILAL, post({ type: "general", body: "x".repeat(2001) }));
      out["unknown_type"] = await tryCreate(tx, BILAL, post({ type: "story", body: "A story" }));
      out["shipped_refused"] = await tryCreate(tx, BILAL, post({ type: "shipped", body: "We shipped" }));
      out["event_without_society"] = await tryCreate(tx, BILAL, post({ type: "event", body: "Come along", event: { starts_at: "2099-01-01T10:00:00Z", place: "Hall", url: "" } }));
      out["announcement_not_staff"] = await tryCreate(tx, BILAL, post({ type: "announcement", body: "Hear ye" }));
      out["poll_one_option"] = await tryCreate(tx, BILAL, post({ type: "poll", body: "Pick", poll: { options: ["only"], days: 2 } }));
      out["poll_eight_days"] = await tryCreate(tx, BILAL, post({ type: "poll", body: "Pick", poll: { options: ["a", "b"], days: 8 } }));
      out["poll"] = await create(tx, BILAL, post({ type: "poll", audience: "global", body: "Tabs or spaces?", poll: { options: [" Tabs ", "Spaces", "Both"], days: 3 } }));
      out["staff_announcement_pinned"] = await create(tx, STAFF, post({ type: "announcement", audience: "university", body: "Platform news", pin_days: 30 }));
      out["graduate_university_post"] = await tryCreate(tx, GRAD, post({ type: "general", audience: "university", body: "Still here" }));
      out["graduate_global_post"] = await create(tx, GRAD, post({ type: "general", audience: "global", body: "Alumni hello" }));
      out["not_onboarded"] = await tryCreate(tx, FRESH, post({ type: "general", body: "Hi" }));
      out["signed_out"] = await tryCreate(tx, null, post({ type: "general", body: "Hi" }), "create_post");
      out["link_url"] = await create(tx, DANYAL, post({ type: "general", body: "Read https://example.test/a/b?c=1). Then reply." }));
      return out;
    }));

  it("edit", () =>
    replay(sql, "posts", "edit", async (tx) => {
      const out: Record<string, unknown> = {};
      const fresh = await insertPost(tx, ASMA, "Edit me now");
      const old = await insertPost(tx, ASMA, "Too old to edit", { hoursAgo: 1 });
      const edge = await insertPost(tx, ASMA, "Edit me twice");
      out["own_fresh"] = await step(tx, (sp) => editPost(sp, ASMA, fresh, "  Edited text, trimmed  "));
      out["own_again"] = await step(tx, (sp) => editPost(sp, ASMA, fresh, "Edited a second time"));
      out["empty_body"] = await call(tx, (sp) => editPost(sp, ASMA, edge, "   "));
      out["null_body"] = await call(tx, (sp) => editPost(sp, ASMA, edge, ""));
      out["too_long"] = await call(tx, (sp) => editPost(sp, ASMA, edge, "y".repeat(2001)));
      out["after_window"] = await call(tx, (sp) => editPost(sp, ASMA, old, "Late edit"));
      out["someone_elses"] = await call(tx, (sp) => editPost(sp, BILAL, edge, "Hijack"));
      out["unknown_post"] = await call(tx, (sp) => editPost(sp, ASMA, UUID_X, "Nothing"));
      out["signed_out"] = await call(tx, (sp) => editPost(sp, null, edge, "Anon"), "edit_post");
      return out;
    }));

  it("delete", () =>
    replay(sql, "posts", "delete", async (tx) => {
      const out: Record<string, unknown> = {};
      const withMedia = await insertPost(tx, ASMA, "Delete me with pictures");
      await addMedia(tx, withMedia, [MEDIA.asma1, MEDIA.asma2]);
      const plain = await insertPost(tx, ASMA, "Delete me plain");
      const theirs = await insertPost(tx, BILAL, "Not yours to delete");
      out["own_with_media"] = await step(tx, (sp) => deletePost(sp, ASMA, withMedia));
      out["own_plain"] = await step(tx, (sp) => deletePost(sp, ASMA, plain));
      out["twice"] = await call(tx, (sp) => deletePost(sp, ASMA, withMedia));
      out["someone_elses"] = await call(tx, (sp) => deletePost(sp, ASMA, theirs));
      out["signed_out"] = await call(tx, (sp) => deletePost(sp, null, theirs), "delete_post");
      return out;
    }));

  it("vote_poll", () =>
    replay(sql, "posts", "vote_poll", async (tx) => {
      const out: Record<string, unknown> = {};
      const open = await addPoll(tx, BILAL, "Colour poll", { options: ["Red", "Green", "Blue"], hoursAgo: 4 });
      const closed = await addPoll(tx, BILAL, "Closed poll", { hoursAgo: 4 });
      await tx`update content.post_polls set closes_at = now() - interval '1 hour' where post_id = ${closed}`;
      const otherUni = await addPoll(tx, CYRA, "Poll at B", { university: UNI_B, hoursAgo: 4 });
      const global = await addPoll(tx, CYRA, "Global poll", { audience: "global", university: UNI_B, hoursAgo: 4 });
      const general = await insertPost(tx, BILAL, "Not a poll", { hoursAgo: 4 });
      const vote = (me: string | null, id: string, n: number) => (sp: Tx) => votePoll(sp, me, id, n, noop);
      out["vote"] = await step(tx, vote(ASMA, open, 2));
      out["vote_twice"] = await call(tx, vote(ASMA, open, 3));
      out["bad_option"] = await call(tx, vote(DANYAL, open, 9));
      out["option_zero"] = await call(tx, vote(DANYAL, open, 0));
      out["author_votes_own"] = await step(tx, vote(BILAL, open, 1));
      out["closed"] = await call(tx, vote(DANYAL, closed, 1));
      out["other_university"] = await call(tx, vote(ASMA, otherUni, 1));
      out["global_from_other_university"] = await step(tx, vote(ASMA, global, 1));
      out["not_a_poll"] = await call(tx, vote(DANYAL, general, 1));
      out["unknown_post"] = await call(tx, vote(DANYAL, UUID_X, 1));
      out["signed_out"] = await call(tx, vote(null, open, 1), "vote_poll");
      return out;
    }));

  it("rsvp", () =>
    replay(sql, "posts", "rsvp", async (tx) => {
      const out: Record<string, unknown> = {};
      const ev = await addEvent(tx, BILAL, "Open day", { startsInHours: 48, hoursAgo: 4 });
      const past = await addEvent(tx, BILAL, "Last week meetup", { startsInHours: -7, hoursAgo: 8 });
      const recent = await addEvent(tx, BILAL, "Just ended meetup", { startsInHours: -3, hoursAgo: 8 });
      const otherUni = await addEvent(tx, CYRA, "Event at B", { university: UNI_B, hoursAgo: 4 });
      const global = await addEvent(tx, CYRA, "Global meetup", { audience: "global", university: UNI_B, hoursAgo: 4 });
      const general = await insertPost(tx, BILAL, "Just a post", { hoursAgo: 4 });
      const rsvp = (me: string | null, id: string, s: "going" | "interested" | null) => (sp: Tx) => rsvpEvent(sp, me, id, s, noop);
      out["going"] = await step(tx, rsvp(ASMA, ev, "going"));
      out["interested_changes"] = await step(tx, rsvp(ASMA, ev, "interested"));
      out["second_user"] = await step(tx, rsvp(DANYAL, ev, "going"));
      out["clear"] = await step(tx, rsvp(ASMA, ev, null));
      out["clear_when_none"] = await step(tx, rsvp(ASMA, ev, null));
      out["past_event"] = await call(tx, rsvp(ASMA, past, "going"));
      out["ended_three_hours_ago"] = await step(tx, rsvp(ASMA, recent, "going"));
      out["not_an_event"] = await call(tx, rsvp(ASMA, general, "going"));
      out["other_university"] = await call(tx, rsvp(ASMA, otherUni, "going"));
      out["global_from_other_university"] = await step(tx, rsvp(ASMA, global, "interested"));
      // The enum cast refused "maybe" before the function ran; the contract's validation refuses it.
      out["bad_status"] = { ok: false, code: "22P02", message: 'invalid input value for enum rsvp_status: "maybe"' } satisfies Outcome;
      out["signed_out"] = await call(tx, rsvp(null, ev, "going"), "rsvp_event");
      return out;
    }));

  it("cards", () =>
    replay(sql, "posts", "cards", async (tx) => {
      const out: Record<string, unknown> = {};
      const withImages = await insertPost(tx, ASMA, "Card: with pictures", { hoursAgo: 6 });
      await addMedia(tx, withImages, [MEDIA.asma1, MEDIA.asma2]);
      const globalPost = await insertPost(tx, CYRA, "Card: global from B", { audience: "global", university: UNI_B, hoursAgo: 7 });
      const poll = await addPoll(tx, BILAL, "Card: open poll", { options: ["Cats", "Dogs"], hoursAgo: 8 });
      await tx`insert into content.poll_votes (post_id, user_id, position) values (${poll}, ${ASMA}, 1), (${poll}, ${DANYAL}, 2), (${poll}, ${STAFF}, 2)`;
      const closedPoll = await addPoll(tx, BILAL, "Card: closed poll", { options: ["Yes", "No"], hoursAgo: 9 });
      await tx`insert into content.poll_votes (post_id, user_id, position) values (${closedPoll}, ${DANYAL}, 1)`;
      await tx`update content.post_polls set closes_at = now() - interval '1 hour' where post_id = ${closedPoll}`;
      const unvotedPoll = await addPoll(tx, BILAL, "Card: poll nobody voted on", { options: ["A", "B"], hoursAgo: 10 });
      const event = await addEvent(tx, BILAL, "Card: event", { startsInHours: 72, hoursAgo: 11 });
      await tx`insert into content.event_rsvps (post_id, user_id, status) values (${event}, ${ASMA}, 'going'), (${event}, ${DANYAL}, 'interested'), (${event}, ${STAFF}, 'going')`;
      const byBlocked = await insertPost(tx, DANYAL, "Card: by someone Asma blocked", { hoursAgo: 12 });
      await block(tx, ASMA, DANYAL);
      const byMuted = await insertPost(tx, STAFF, "Card: by someone Asma muted", { hoursAgo: 13 });
      await mute(tx, ASMA, STAFF);
      const removed = await insertPost(tx, BILAL, "Card: removed", { hoursAgo: 14 });
      await tx`update content.posts set removed_at = now() where id = ${removed}`;
      const held = await insertPost(tx, BILAL, "Card: held", { hoursAgo: 15, stage: "held" });
      const url = "https://example.test/article/cards";
      const withLink = await insertPost(tx, BILAL, `Card: has a link ${url}`, { hoursAgo: 16 });
      await tx`
        insert into content.link_previews (url_hash, url, status, title, description, image_url, site_name)
        values (encode(sha256(convert_to(${url}, 'UTF8')), 'hex'), ${url}, 'ok', 'An article', 'About something', 'https://example.test/i.png', 'Example')`;
      const withComments = await insertPost(tx, BILAL, "Card: with comments", { hoursAgo: 17 });
      await insertComment(tx, withComments, STAFF, "A first comment here", { minutesAgo: 30 });
      await insertComment(tx, withComments, DANYAL, "A comment from the blocked one", { minutesAgo: 20 });
      const gone = await insertComment(tx, withComments, STAFF, "Deleted comment text", { minutesAgo: 10 });
      await tx`update content.post_comments set deleted_at = now(), body = '' where id = ${gone}`;
      const mine = await insertPost(tx, ASMA, "Card: asma just posted");
      const order = [withImages, globalPost, poll, closedPoll, unvotedPoll, event, byBlocked, byMuted, removed, held, withLink, withComments, mine, UUID_X];
      const read = (me: string | null, ids: string[]) =>
        call(tx, async (sp) =>
          (await cards({ people, ventures: { cards: async () => new Map() }, societies: { cards: async () => new Map() } }, await cardRows(sp, me, ids), me, null)).map((c) => ({
            type: c.type,
            audience: c.audience,
            body: c.body,
            edited: c.edited_at !== null,
            pinned: c.pinned_until !== null,
            stage: c.stage,
            author_username: c.author_username,
            author_name: c.author_name,
            is_mine: c.is_mine,
            can_edit: c.can_edit,
            media: c.media,
            event: c.event,
            poll: c.poll,
            venture: c.venture,
            comment_count: c.comment_count,
            link: c.link,
            author_muted: c.author_muted,
            society: c.society,
          })),
        );
      for (const [label, user] of [["asma", ASMA], ["danyal", DANYAL], ["cyra", CYRA], ["staff", STAFF], ["bilal", BILAL]] as const) out[`as_${label}`] = await read(user, order);
      out["signed_out"] = await call(tx, (sp) => cardRows(sp, null, order), "post_cards");
      out["empty_list"] = await read(ASMA, []);
      return out;
    }));

  it("list_posts", () =>
    replay(sql, "posts", "list_posts", async (tx) => {
      const out: Record<string, unknown> = {};
      await insertPost(tx, BILAL, "List: uni general 1", { hoursAgo: 2 });
      await insertPost(tx, DANYAL, "List: uni general 2", { hoursAgo: 3 });
      await addEvent(tx, BILAL, "List: uni event", { hoursAgo: 4 });
      const announcement = await insertPost(tx, BILAL, "List: uni announcement", { type: "announcement", hoursAgo: 5 });
      await tx`insert into content.announcement_meta (post_id, university_id, expires_at) values (${announcement}, ${UNI_A}, now() + interval '5 days')`;
      await insertPost(tx, ASMA, "List: asma own", { hoursAgo: 6 });
      await insertPost(tx, STAFF, "List: by muted author", { hoursAgo: 7 });
      await mute(tx, ASMA, STAFF);
      const hidden = await insertPost(tx, BILAL, "List: hidden by asma", { hoursAgo: 8 });
      await tx`insert into content.post_hides (user_id, post_id) values (${ASMA}, ${hidden})`;
      await insertPost(tx, BILAL, "List: global from A", { audience: "global", hoursAgo: 9 });
      await insertPost(tx, CYRA, "List: global from B", { audience: "global", university: UNI_B, hoursAgo: 10 });
      await insertPost(tx, CYRA, "List: uni B only", { university: UNI_B, hoursAgo: 11 });
      await insertPost(tx, DANYAL, "List: by blocked", { hoursAgo: 12 });
      await block(tx, ASMA, DANYAL);
      await insertPost(tx, BILAL, "List: held", { hoursAgo: 13, stage: "held" });
      const removed = await insertPost(tx, BILAL, "List: removed", { hoursAgo: 14 });
      await tx`update content.posts set removed_at = now() where id = ${removed}`;
      await insertPost(tx, BILAL, "List: oldest", { hoursAgo: 20 });
      const m = await bodyMap(tx);
      const raw = (me: string | null, a: [string, string | null, string | null, string | null, string | null, number]) =>
        call(tx, async (sp) =>
          (await listPosts(sp, me, { scope: a[0], filter: a[1] ?? "all", before: a[2], beforeId: a[3], author: a[4], limit: a[5] })).map((r) => ({
            id: r.id,
            created_at: r.created_at,
          })),
        );
      const list = async (me: string | null, a: Parameters<typeof raw>[1]) => named(await raw(me, a), m, ["id"]);
      out["university_all"] = await list(ASMA, ["university", "all", null, null, null, 50]);
      out["university_default_filter"] = await list(ASMA, ["university", null, null, null, null, 50]);
      out["global"] = await list(ASMA, ["global", "all", null, null, null, 50]);
      out["global_as_cyra"] = await list(CYRA, ["global", "all", null, null, null, 50]);
      out["university_as_cyra"] = await list(CYRA, ["university", "all", null, null, null, 50]);
      out["author_bilal"] = await list(ASMA, ["author", "all", null, null, BILAL, 50]);
      out["author_asma_own"] = await list(ASMA, ["author", "all", null, null, ASMA, 50]);
      out["author_staff_muted_still_listed"] = await list(ASMA, ["author", "all", null, null, STAFF, 50]);
      out["author_blocked"] = await list(ASMA, ["author", "all", null, null, DANYAL, 50]);
      out["filter_events"] = await list(ASMA, ["university", "events", null, null, null, 50]);
      out["filter_announcements"] = await list(ASMA, ["university", "announcements", null, null, null, 50]);
      out["filter_ventures"] = await list(ASMA, ["university", "ventures", null, null, null, 50]);
      out["filter_shipped"] = await list(ASMA, ["university", "shipped", null, null, null, 50]);
      out["unknown_filter_means_all"] = await list(ASMA, ["university", "nonsense", null, null, null, 3]);
      out["unknown_scope"] = await list(ASMA, ["everywhere", "all", null, null, null, 50]);
      const page1 = (await raw(ASMA, ["university", "all", null, null, null, 3])) as { ok: true; value: { id: string; created_at: string }[] };
      out["page_1_of_3"] = named(page1, m, ["id"]);
      const last = page1.value[page1.value.length - 1]!;
      out["page_2_before_cursor"] = await list(ASMA, ["university", "all", last.created_at, last.id, null, 3]);
      out["before_without_id"] = await list(ASMA, ["university", "all", last.created_at, null, null, 3]);      out["limit_zero_is_one"] = await list(ASMA, ["university", "all", null, null, null, 0]);
      out["limit_over_cap"] = await list(ASMA, ["university", "all", null, null, null, 500]);
      out["signed_out"] = await call(tx, (sp) => listPosts(sp, null, { scope: "university", filter: "all", before: null, beforeId: null, author: null, limit: 5 }), "list_posts");
      return out;
    }));

  it("pinned", () =>
    replay(sql, "posts", "pinned", async (tx) => {
      const out: Record<string, unknown> = {};
      const platform = await insertPost(tx, STAFF, "Pinned: platform news", { type: "announcement", audience: "global", hoursAgo: 5 });
      await tx`update content.posts set pinned_until = now() + interval '3 days' where id = ${platform}`;
      const uni = await insertPost(tx, STAFF, "Pinned: university notice", { type: "announcement", hoursAgo: 4 });
      await tx`insert into content.announcement_meta (post_id, university_id, expires_at, created_by) values (${uni}, ${UNI_A}, now() + interval '5 days', ${STAFF})`;
      await tx`update content.posts set pinned_until = now() + interval '3 days' where id = ${uni}`;
      const expired = await insertPost(tx, STAFF, "Pinned: expired pin", { type: "announcement", audience: "global", hoursAgo: 3 });
      await tx`update content.posts set pinned_until = now() - interval '1 day' where id = ${expired}`;
      const m = await bodyMap(tx);
      const one = async (me: string, university: boolean) => named(await call(tx, async (sp) => [{ id: await pinnedAnnouncement(sp, me, university) }]), m, ["id"]);
      out["platform_asma"] = await one(ASMA, false);
      out["platform_cyra"] = await one(CYRA, false);
      out["university_asma"] = await one(ASMA, true);
      out["university_bilal"] = await one(BILAL, true);
      out["university_cyra_other_university"] = await one(CYRA, true);
      out["signed_out"] = await call(tx, (sp) => pinnedAnnouncement(sp, null, false), "pinned_announcement");
      out["hide_platform"] = await step(tx, (sp) => hidePost(sp, ASMA, platform, true));
      out["platform_after_hide"] = await one(ASMA, false);
      out["hide_university"] = await step(tx, (sp) => hidePost(sp, ASMA, uni, true));
      out["university_after_hide"] = await one(ASMA, true);
      out["university_bilal_unaffected"] = await one(BILAL, true);
      return out;
    }));
});
