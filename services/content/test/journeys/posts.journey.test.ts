/**
 * Journey: apps/web/tests/e2e/posts.spec.ts, through identity, people and content's contracts on both
 * transports. Each `it` mirrors one spec test; the web-only parts are `it.todo` for W13 (and W9 for images).
 */
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { NU, NUTECH } from "../../../people/test/contract/world";
import { graduateRollover } from "../../../people/src/store/universities";
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

    describe("posts.spec: audiences, images, edit, delete, cooldown", () => {
      it("a University post: classmates see it, another university doesn't (even by id); cooldown; edit; delete", async () => {
        const author = await j.createStudent(NUTECH, "Parveen Poster");
        const classmate = await j.createStudent(NUTECH, "Kamran Classmate");
        const outsider = await j.createStudent(NU, "Omar Outsider");
        const text = `Robotics club meets Friday ${Date.now().toString(36)}`;

        const { postId } = await j.post(author.token, text);
        const [mine] = await j.cards(author.token, [postId]);
        expect([mine!.body, mine!.audience, mine!.authorName, mine!.isMine, mine!.canEdit]).toEqual([text, "university", "Parveen Poster", true, true]);

        // Cooldown: a second post straight away is refused ("Wait 30 seconds between posts.").
        await expect(j.post(author.token, "Too fast")).rejects.toSatisfy((e) => reason(e) === "post_rate_limited");

        // Edit within 15 minutes shows "edited".
        await j.content().editPost({ postId, body: `${text} (Lab 3)` }, j.as(author.token));
        const [edited] = await j.cards(author.token, [postId]);
        expect([edited!.body, edited!.editedAt !== ""]).toEqual([`${text} (Lab 3)`, true]);

        // A classmate sees it in the University Feed; another university doesn't, even by id.
        const feed = await j.content().feedPage({ audience: "university", filter: "all", cursor: "", limit: 20, withCards: true }, j.as(classmate.token));
        expect(feed.cards.map((c) => c.id)).toContain(postId);
        const global = await j.content().feedPage({ audience: "global", filter: "all", cursor: "", limit: 20, withCards: true }, j.as(outsider.token));
        expect(global.items.map((i) => i.postId)).not.toContain(postId);
        expect(await j.opens(outsider.token, postId)).toBe(false);
        // A forged over-long post is refused by the contract (today's 23514).
        await expect(j.post(outsider.token, "x".repeat(2001))).rejects.toSatisfy((e) => reason(e) === "post_length");

        // Delete: gone for the classmate too.
        await j.content().deletePost({ postId }, j.as(author.token));
        expect(await j.opens(classmate.token, postId)).toBe(false);
      });

      it.todo("W13: the composer, its draft kept across a reload, no like/save/react buttons, share opens a dialog, axe in both themes");
      it.todo("W13: web re-encodes the image (2,000 px at most, no EXIF) before media stores it (stored under post-media and kept by content: images.journey.test.ts)");
    });

    describe("posts.spec: global poll and event across universities, filters", () => {
      it("a global poll votes once and shows results after; a society's event takes RSVPs and the Events filter finds it", async () => {
        const owner = await j.createStudent(NUTECH, "Olivia Owner");
        const voter = await j.createStudent(NU, "Vikram Voter");
        const planner = await j.createStudent(NUTECH, "Paras Planner");
        const classmate = await j.createStudent(NUTECH, "Cara Classmate");
        const tag = Date.now().toString(36);

        // A poll to the Global Feed: someone at another university sees "results after you vote", votes once, then sees them.
        const { postId: poll } = await j.post(owner.token, `Best study spot ${tag}?`, { type: "poll", audience: "global", poll: { options: ["Library", "Cafe"], days: 3 } });
        await j.promote([poll]);
        const [fresh] = await j.cards(voter.token, [poll]);
        expect([fresh!.poll!.myVote, fresh!.poll!.options.map((o) => o.votes)]).toEqual([0, [-1, -1]]);
        expect((await j.feed(voter.token, "global")).items.map((i) => i.postId)).toContain(poll);
        await j.content().votePoll({ postId: poll, position: 2 }, j.as(voter.token));
        const [voted] = await j.cards(voter.token, [poll]);
        expect([voted!.poll!.myVote, voted!.poll!.total, voted!.poll!.options.map((o) => [o.label, o.votes])]).toEqual([2, 1, [["Library", 0], ["Cafe", 1]]]);
        await expect(j.content().votePoll({ postId: poll, position: 1 }, j.as(voter.token))).rejects.toSatisfy((e) => reason(e) === "already_voted");

        // Students don't post events (PRD 5.31): an officer of a verified society does. Others are refused.
        const society = await j.society(planner.id, NUTECH.id);
        const startsAt = new Date(Date.now() + 3 * 86_400_000).toISOString();
        const event = { startsAt, place: "FAST Lab 2", url: "" };
        await expect(j.post(classmate.token, `Not allowed ${tag}`, { type: "event", event })).rejects.toSatisfy((e) => reason(e) === "events_by_societies");
        await expect(j.post(classmate.token, `Not an officer ${tag}`, { type: "event", societyId: society, event })).rejects.toSatisfy((e) => reason(e) === "officers_only");
        const { postId: hack } = await j.post(planner.token, `Hack night ${tag}`, { type: "event", societyId: society, event });
        await j.promote([hack]);

        // The Events filter finds it (not the poll); Going shows "1 going · 0 interested" and holds; Interested replaces it.
        const events = await j.feed(classmate.token, "university", "events");
        expect(events.items.map((i) => i.postId)).toEqual([hack]);
        await j.content().rsvpEvent({ postId: hack, status: "going" }, j.as(classmate.token));
        const [going] = await j.cards(classmate.token, [hack]);
        expect([going!.event!.going, going!.event!.interested, going!.event!.mine, going!.event!.place, going!.societyId]).toEqual([1, 0, "going", "FAST Lab 2", society]);
        await j.content().rsvpEvent({ postId: hack, status: "interested" }, j.as(classmate.token));
        const [changed] = await j.cards(classmate.token, [hack]);
        expect([changed!.event!.going, changed!.event!.interested, changed!.event!.mine]).toEqual([0, 1, "interested"]);
        await j.content().rsvpEvent({ postId: hack, status: "" }, j.as(classmate.token));
        expect((await j.cards(classmate.token, [hack]))[0]!.event!.mine).toBe("");
        // A university event is invisible to another university, even by id.
        expect(await j.opens(voter.token, hack)).toBe(false);
        expect((await j.feed(voter.token, "global", "events")).items).toEqual([]);
      });

      it.todo("W13: web re-encodes venture update images before media stores them (stored under post-media: images.journey.test.ts)");
      it.todo("W13: the composer has no Event type for students, the poll composer defaults to Global on the Global tab, axe on the feed filters");
    });

    describe("student portal: a graduate's posts", () => {
      it("a graduate posts to the Global Feed only (content's half: the University post is refused)", async () => {
        const grad = await j.createStudent(NUTECH, "Gradual Poster", { year: 2020 });
        const n = await w.people.begin((tx) => graduateRollover(tx, { year: 2026, month: 9, day: 1 }));
        expect(n).toBeGreaterThan(0);
        await j.drain();
        await expect(j.post(grad.token, "A graduate's university post")).rejects.toSatisfy((e) => reason(e) === "graduates_global_only");
        const { postId } = await j.post(grad.token, "A graduate's global post", { audience: "global" });
        const [card] = await j.cards(grad.token, [postId]);
        expect([card!.audience, card!.authorName]).toEqual(["global", "Gradual Poster"]);
      });
    });
  },
  contentWorld((x) => (w = x), worlds),
);
