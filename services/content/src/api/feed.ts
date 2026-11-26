import { create } from "@bufbuild/protobuf";
import type { ServiceImpl } from "@connectrpc/connect";
import { ContentService, FeedPageResponse_ItemSchema, FeedPageResponseSchema, PostCardSchema } from "@skilient/contracts/content/v1/content_pb";
import { z } from "zod";
import type { ApiDeps } from "../deps";
import { cardRows, cards } from "../store/cards";
import { feedPage } from "../store/feed";
import { cardMessage, meOf, onward, parse } from "./util";

/**
 * The ranked feed. One call returns the page and, with `with_cards`, its cards: the session read or build,
 * the card query and the people call (docs/azure/prd.md, "Feed, first page": 120 ms).
 */
export function feedApi(deps: ApiDeps): Partial<ServiceImpl<typeof ContentService>> {
  return {
    async feedPage(req, ctx) {
      const r = parse(z.object({ audience: z.string().max(20), filter: z.string().max(20), cursor: z.string().max(120), limit: z.number().int(), withCards: z.boolean() }), req);
      const c = await deps.config();
      const me = meOf(ctx);
      // A read for the reader: its only write is the session's ranked list, a cache, so no idempotency key
      // is claimed (decision 2026-11-26, W3); a repeated call builds or reads a session again.
      const out = await feedPage(deps.sql, me, r.audience, r.filter, r.cursor === "" ? null : r.cursor, r.limit === 0 ? null : r.limit, c, undefined, deps.pools, !r.withCards);
      let items = out.items;
      const page = create(FeedPageResponseSchema, { nextCursor: out.next_cursor ?? "" });
      if (r.withCards && items.length) {
        // The cards apply can_view_post, so an item without a card is dropped, as feed_page dropped it.
        const names = out.authors ? deps.people.cards(out.authors, onward(ctx)) : undefined;
        names?.catch(() => {});
        const rows = await cardRows(deps.sql, me, items.map((i) => i.post_id));
        const shown = new Set(rows.map((x) => x.id));
        items = items.filter((i) => shown.has(i.post_id));
        page.cards = (await cards(deps, rows, me, onward(ctx), names)).map((x) => create(PostCardSchema, cardMessage(x)));
      }
      page.items = items.map((i) => create(FeedPageResponse_ItemSchema, { postId: i.post_id, rank: i.rank }));
      return page;
    },
  };
}
