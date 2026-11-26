import { create } from "@bufbuild/protobuf";
import type { ServiceImpl } from "@connectrpc/connect";
import {
  AddCommentRequestSchema,
  AddCommentResponseSchema,
  ContentService,
  DeleteCommentRequestSchema,
  DeleteCommentResponseSchema,
  HidePostRequestSchema,
  HidePostResponseSchema,
  PinCommentRequestSchema,
  PinCommentResponseSchema,
} from "@skilient/contracts/content/v1/content_pb";
import { z } from "zod";
import type { ApiDeps } from "../deps";
import { addComment, deleteComment, hidePost, mentionedUsernames, pinComment, postComments } from "../store/comments";
import { iso, meOf, onward, OptionalUuid, parse, restrictedOf, Uuid, write } from "./util";

/** Comments and hides. */
export function commentsApi(deps: ApiDeps): Partial<ServiceImpl<typeof ContentService>> {
  const { sql } = deps;
  return {
    async addComment(req, ctx) {
      const r = parse(z.object({ postId: Uuid, parentId: OptionalUuid, body: z.string().max(5000) }), req);
      // @mentions resolved before the transaction: one people call per comment, never one per name.
      const names = mentionedUsernames(r.body.trim()).slice(0, 20);
      const mentions = names.length && meOf(ctx) ? await deps.people.resolve(names, onward(ctx)) : new Map<string, string>();
      return write(deps, ctx, AddCommentRequestSchema, AddCommentResponseSchema, req, async (tx) =>
        create(AddCommentResponseSchema, { commentId: await addComment(tx, meOf(ctx), r.postId, r.parentId || null, r.body, mentions, restrictedOf(ctx)) }),
      );
    },
    async deleteComment(req, ctx) {
      const r = parse(z.object({ commentId: Uuid }), req);
      return write(deps, ctx, DeleteCommentRequestSchema, DeleteCommentResponseSchema, req, async (tx) => {
        await deleteComment(tx, meOf(ctx), r.commentId);
        return create(DeleteCommentResponseSchema);
      });
    },
    async pinComment(req, ctx) {
      const r = parse(z.object({ commentId: Uuid, pin: z.boolean() }), req);
      return write(deps, ctx, PinCommentRequestSchema, PinCommentResponseSchema, req, async (tx) => {
        await pinComment(tx, meOf(ctx), r.commentId, r.pin);
        return create(PinCommentResponseSchema);
      });
    },
    async hidePost(req, ctx) {
      const r = parse(z.object({ postId: Uuid, hide: z.boolean() }), req);
      return write(deps, ctx, HidePostRequestSchema, HidePostResponseSchema, req, async (tx) => {
        await hidePost(tx, meOf(ctx), r.postId, r.hide);
        return create(HidePostResponseSchema);
      });
    },
    async postComments(req, ctx) {
      const postId = parse(Uuid, req.postId);
      const me = meOf(ctx);
      const rows = await postComments(sql, me, postId);
      const shown = [...new Set(rows.filter((x) => x.show_name).map((x) => x.author_id))];
      const people = shown.length ? await deps.people.cards(shown, onward(ctx)) : new Map();
      return {
        comments: rows.map((x) => {
          const a = x.show_name ? people.get(x.author_id) : undefined;
          return {
            id: x.id,
            parentId: x.parent_id ?? "",
            body: x.body,
            pinned: x.pinned,
            deleted: x.deleted,
            createdAt: iso(x.created_at),
            authorUsername: x.show_profile ? (a?.username ?? "") : "",
            authorName: a?.fullName ?? "",
            authorAvatarPath: x.show_profile ? (a?.avatarPath ?? "") : "",
            isMine: x.is_mine,
            canDelete: x.can_delete,
          };
        }),
      };
    },
  };
}
