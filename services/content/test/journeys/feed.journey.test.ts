/**
 * Journey: apps/web/tests/e2e/feed.spec.ts, through identity, people and content's contracts on both
 * transports. Paging goes through FeedPage's cursors; the new-posts pill and the followed ventures' updates
 * are other workstreams' (realtime W4, ventures W5).
 */
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { NU } from "../../../people/test/contract/world";
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

    describe("Ranked feed", () => {
      it("paging without duplicates; a new post shows on the next page one", async () => {
        const reader = await j.createStudent(NU, "Fiza Feedreader");
        const writer = await j.createStudent(NU, "Waqas Writer");
        const tag = Date.now().toString(36);

        // 45 posts in Full, spread over the last few hours.
        const rows = await w.content<{ id: string }[]>`
          insert into content.posts (id, author_id, university_id, audience, type, body, stage, created_at)
          select gen_random_uuid(), ${writer.id}, ${NU.id}, 'university', 'general', 'Feed post ' || ${tag} || ' #' || g, 'full', now() - make_interval(mins => g * 4)
            from generate_series(1, 45) g
          returning id::text`;
        const made = new Set(rows.map((r) => r.id));

        // Page through with the cursors: every post appears exactly once, 20 at a time.
        const seen: string[] = [];
        let cursor = "";
        let pages = 0;
        do {
          const page = await j.feed(reader.token, "university", "all", cursor, 20);
          expect(page.items.length).toBeLessThanOrEqual(20);
          expect(page.cards.map((c) => c.id)).toEqual(page.items.map((i) => i.postId));
          seen.push(...page.items.map((i) => i.postId));
          cursor = page.nextCursor;
          pages++;
        } while (cursor !== "" && pages < 10);
        expect(new Set(seen).size).toBe(seen.length);
        expect(seen.filter((id) => made.has(id))).toHaveLength(45);
        expect(pages).toBeGreaterThanOrEqual(3);

        // A new post arrives: the reader (same programme and university, so in its seed audience) finds it on a fresh first page.
        const { postId: fresh } = await j.post(writer.token, `Fresh news ${tag}`);
        const again: string[] = [];
        cursor = "";
        pages = 0;
        do {
          const page = await j.feed(reader.token, "university", "all", cursor, 20);
          again.push(...page.items.map((i) => i.postId));
          cursor = page.nextCursor;
          pages++;
        } while (cursor !== "" && pages < 10);
        expect(again).toContain(fresh);
        expect(new Set(again).size).toBe(again.length);

        // A page that is not this reader's (bad filter, bad cursor) is refused.
        await expect(j.feed(reader.token, "university", "popular")).rejects.toSatisfy((e) => reason(e) === "unknown_filter");
        await expect(j.feed(reader.token, "university", "all", "not-a-cursor")).rejects.toSatisfy((e) => reason(e) === "bad_cursor");
      });

      it.todo("W13: the feed's infinite scroll and \"Load more\", the end-of-feed marker, axe");
    });
  },
  contentWorld((x) => (w = x), worlds),
);
