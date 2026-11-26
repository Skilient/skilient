import { create } from "@bufbuild/protobuf";
import type { ServiceImpl } from "@connectrpc/connect";
import { MessagingService, SharePostRequestSchema, SharePostResponseSchema, UndoShareRequestSchema, UndoShareResponseSchema } from "@skilient/contracts/messaging/v1/messaging_pb";
import { z } from "zod";
import type { ApiDeps } from "../deps";
import { sharePost, shareTargets, undoShare } from "../store/share";
import { Ids, iso, meOf, onward, OptionalUuid, parse, restrictedOf, write } from "./util";

/** `contains_pattern`: a case-insensitive substring match on a title, as share_targets filtered. */
const matches = (title: string, q: string) => title.toLowerCase().includes(q.trim().toLowerCase());

/** Sharing a post into chats. */
export function shareApi(deps: ApiDeps): Partial<ServiceImpl<typeof MessagingService>> {
  return {
    async shareTargets(req, ctx) {
      const me = meOf(ctx);
      const q = parse(z.string().max(200), req.q);
      const rows = await shareTargets(deps.sql, me);
      const others = [...new Set(rows.map((r) => r.other_id).filter((x): x is string => x !== null))];
      const ventures = [...new Set(rows.map((r) => r.venture_id).filter((x): x is string => x !== null))];
      const [people, titles] = await Promise.all([
        others.length ? deps.people.cards(others, onward(ctx)) : Promise.resolve(new Map()),
        ventures.length ? deps.ventures.titles(ventures, onward(ctx)) : Promise.resolve(new Map<string, string>()),
      ]);
      return {
        targets: rows
          .map((r) => {
            const o = r.other_id ? people.get(r.other_id) : undefined;
            return {
              id: r.id,
              type: r.type,
              title: r.type === "group" ? (titles.get(r.venture_id!) ?? "") : (o?.fullName ?? ""),
              username: r.type === "dm" && r.other_visible ? (o?.username ?? "") : "",
              avatarPath: r.type === "dm" && r.other_visible ? (o?.avatarPath ?? "") : "",
              lastAt: iso(r.last_at),
            };
          })
          .filter((t) => q.trim() === "" || matches(t.title, q))
          .slice(0, 30),
      };
    },
    async sharePost(req, ctx) {
      const r = parse(z.object({ postId: OptionalUuid, threadIds: z.array(z.uuid()).max(50), note: z.string().max(5000) }), req);
      const me = meOf(ctx);
      // Whether the sharer may see the post: content's batch read, once, before the transaction.
      const visible = me && r.postId ? (await deps.content.visiblePosts(me, [r.postId], onward(ctx))).has(r.postId) : false;
      return write(deps, ctx, SharePostRequestSchema, SharePostResponseSchema, req, async (tx) =>
        create(SharePostResponseSchema, { messageIds: await sharePost(tx, me, r.postId || null, r.threadIds, r.note, visible, restrictedOf(ctx)) }),
      );
    },
    async undoShare(req, ctx) {
      const ids = parse(Ids(5), req.messageIds);
      return write(deps, ctx, UndoShareRequestSchema, UndoShareResponseSchema, req, async (tx) => create(UndoShareResponseSchema, { removed: await undoShare(tx, meOf(ctx), ids) }));
    },
  };
}
