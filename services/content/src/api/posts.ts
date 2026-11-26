import { create } from "@bufbuild/protobuf";
import type { ServiceImpl } from "@connectrpc/connect";
import {
  ContentService,
  CreatePostRequestSchema,
  CreatePostResponseSchema,
  DeletePostRequestSchema,
  DeletePostResponseSchema,
  EditPostRequestSchema,
  EditPostResponseSchema,
  QueueLinkPreviewsRequestSchema,
  QueueLinkPreviewsResponseSchema,
  RsvpEventRequestSchema,
  RsvpEventResponseSchema,
  VotePollRequestSchema,
  VotePollResponseSchema,
} from "@skilient/contracts/content/v1/content_pb";
import { callOf, GLOBAL_FEED } from "@skilient/platform";
import { z } from "zod";
import type { ApiDeps } from "../deps";
import { cardRows, cards } from "../store/cards";
import { canViewPost } from "../store/db";
import { urlHash } from "../domain/links/url";
import { queuePreview } from "../store/links";
import { createPost, deletePost, editPost, listPosts, pinnedAnnouncement, rsvpEvent, votePoll } from "../store/posts";
import { cardMessage, Ids, meOf, onward, OptionalUuid, parse, restrictedOf, Uuid, write } from "./util";

const NewPost = z.object({
  type: z.string().max(20),
  audience: z.string().max(20),
  body: z.string().max(10_000),
  media: z.array(z.object({ path: z.string().max(200), width: z.number().int(), height: z.number().int() })).max(20),
  ventureId: OptionalUuid,
  societyId: OptionalUuid,
  event: z.object({ startsAt: z.string().max(60), place: z.string().max(500), url: z.string().max(1000) }).optional(),
  poll: z.object({ options: z.array(z.string().max(500)).max(20), days: z.number().int() }).optional(),
  pinDays: z.number().int(),
});

/** Posts: create, edit, delete, vote, RSVP, cards, lists, pinned announcements; and the visibility batch read. */
export function postsApi(deps: ApiDeps): Partial<ServiceImpl<typeof ContentService>> {
  const { sql } = deps;
  return {
    async createPost(req, ctx) {
      const p = parse(NewPost, req);
      return write(deps, ctx, CreatePostRequestSchema, CreatePostResponseSchema, req, async (tx) => {
        const me = meOf(ctx);
        const postId = await createPost(
          tx,
          me,
          {
            type: p.type,
            audience: p.audience,
            body: p.body,
            media: p.media,
            venture_id: p.ventureId || null,
            society_id: p.societyId || null,
            event: p.event ? { starts_at: p.event.startsAt, place: p.event.place, url: p.event.url } : null,
            poll: p.poll ? { options: p.poll.options, days: p.poll.days } : null,
            pin_days: p.pinDays,
          },
          {
            restricted: restrictedOf(ctx),
            isStaff: async () => callOf(ctx).user?.aal === "aal2" && (await deps.identity.isStaff(me!, onward(ctx))),
            missing: (paths) => deps.media.missing(paths, onward(ctx)),
          },
        );
        return create(CreatePostResponseSchema, { postId });
      }).then((reply) => (deps.pools.clear(), reply));
    },
    async editPost(req, ctx) {
      const r = parse(z.object({ postId: Uuid, body: z.string().max(10_000) }), req);
      return write(deps, ctx, EditPostRequestSchema, EditPostResponseSchema, req, async (tx) => {
        await editPost(tx, meOf(ctx), r.postId, r.body);
        return create(EditPostResponseSchema);
      });
    },
    async deletePost(req, ctx) {
      const r = parse(z.object({ postId: Uuid }), req);
      return write(deps, ctx, DeletePostRequestSchema, DeletePostResponseSchema, req, async (tx) =>
        create(DeletePostResponseSchema, { mediaPaths: await deletePost(tx, meOf(ctx), r.postId) }),
      ).then((reply) => (deps.pools.clear(), reply));
    },
    async votePoll(req, ctx) {
      const r = parse(z.object({ postId: Uuid, position: z.number().int().min(-32768).max(32767) }), req);
      return write(deps, ctx, VotePollRequestSchema, VotePollResponseSchema, req, async (tx) => {
        await votePoll(tx, meOf(ctx), r.postId, r.position, restrictedOf(ctx));
        return create(VotePollResponseSchema);
      });
    },
    async rsvpEvent(req, ctx) {
      const r = parse(z.object({ postId: Uuid, status: z.enum(["", "going", "interested"]) }), req);
      return write(deps, ctx, RsvpEventRequestSchema, RsvpEventResponseSchema, req, async (tx) => {
        await rsvpEvent(tx, meOf(ctx), r.postId, r.status === "" ? null : r.status, restrictedOf(ctx));
        return create(RsvpEventResponseSchema);
      });
    },
    async postCards(req, ctx) {
      const ids = parse(Ids(50), req.postIds);
      const me = meOf(ctx);
      return { cards: (await cards(deps, await cardRows(sql, me, ids), me, onward(ctx))).map(cardMessage) };
    },
    async listPosts(req, ctx) {
      const r = parse(
        z.object({
          scope: z.string().max(20),
          filter: z.string().max(20),
          before: z.union([z.literal(""), z.iso.datetime({ offset: true })]),
          beforeId: OptionalUuid,
          authorId: OptionalUuid,
          limit: z.number().int(),
        }),
        req,
      );
      const rows = await listPosts(sql, meOf(ctx), {
        scope: r.scope,
        filter: r.filter,
        before: r.before || null,
        beforeId: r.beforeId || null,
        author: r.authorId || null,
        limit: r.limit === 0 ? null : r.limit,
      });
      return { posts: rows.map((x) => ({ id: x.id, createdAt: x.created_at })) };
    },
    async pinnedAnnouncement(_req, ctx) {
      return { postId: (await pinnedAnnouncement(sql, meOf(ctx), false)) ?? "" };
    },
    async pinnedUniversityAnnouncement(_req, ctx) {
      return { postId: (await pinnedAnnouncement(sql, meOf(ctx), true)) ?? "" };
    },
    async linkPreviews(req) {
      const urls = parse(z.array(z.string().max(2000)).max(100), req.urls);
      if (urls.length === 0) return { previews: [] };
      const rows = await sql<{ url: string; title: string | null; description: string | null; image_url: string | null; site_name: string | null }[]>`
        select url, title, description, image_url, site_name from content.link_previews
         where url_hash = any(${urls.map(urlHash)}::text[]) and status = 'ok'`;
      return {
        previews: rows.map((r) => ({ url: r.url, title: r.title ?? "", description: r.description ?? "", imageUrl: r.image_url ?? "", siteName: r.site_name ?? "" })),
      };
    },
    async queueLinkPreviews(req, ctx) {
      const urls = parse(z.array(z.string().regex(/^https?:\/\/\S+$/).max(2000)).max(10), req.urls);
      return write(deps, ctx, QueueLinkPreviewsRequestSchema, QueueLinkPreviewsResponseSchema, req, async (tx) => {
        for (const url of new Set(urls)) await queuePreview(tx, url);
        return create(QueueLinkPreviewsResponseSchema);
      });
    },
    async canListenFeed(req) {
      const r = parse(z.object({ userId: Uuid, feedId: Uuid }), req);
      const [m] = await sql<{ ok: boolean }[]>`
        select ${r.feedId}::uuid = ${GLOBAL_FEED}::uuid or university_id = ${r.feedId}::uuid as ok from content.members where user_id = ${r.userId}`;
      return { allowed: m?.ok ?? false };
    },
    async visiblePosts(req) {
      const r = parse(z.object({ viewerId: OptionalUuid, postIds: Ids(100) }), req);
      const viewer = r.viewerId || null;
      const rows = await sql<{ id: string; author_id: string; visible: boolean }[]>`
        select p.id::text, p.author_id::text, ${canViewPost(sql, viewer)} as visible
          from content.posts p where p.id = any(${r.postIds}::uuid[])`;
      return { posts: rows.map((x) => ({ postId: x.id, authorId: x.author_id, visible: x.visible })) };
    },
  };
}
