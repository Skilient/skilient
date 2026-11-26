import { create } from "@bufbuild/protobuf";
import type { ServiceImpl } from "@connectrpc/connect";
import {
  DeleteMessageRequestSchema,
  DeleteMessageResponseSchema,
  EditMessageRequestSchema,
  EditMessageResponseSchema,
  MessagingService,
  PinMessageRequestSchema,
  PinMessageResponseSchema,
  SendMessageRequestSchema,
  SendMessageResponseSchema,
  ToggleReactionRequestSchema,
  ToggleReactionResponseSchema,
} from "@skilient/contracts/messaging/v1/messaging_pb";
import { z } from "zod";
import type { ApiDeps } from "../deps";
import { extractLink } from "../domain/text";
import { deleteMessage, editMessage, pinMessage, searchChats, sendMessage, threadMessages, threadPins, toggleReaction } from "../store/messages";
import { iso, meOf, onward, OptionalUuid, parse, restrictedOf, Uuid, write } from "./util";

const MediaIn = z.object({ path: z.string().max(200), width: z.number().int().min(1).max(4000), height: z.number().int().min(1).max(4000) });

/** Messages, reactions, pins and search. */
export function messagesApi(deps: ApiDeps): Partial<ServiceImpl<typeof MessagingService>> {
  const { sql } = deps;
  /** Today's trigger queued a link's preview with the message; here content is asked once the message is in. */
  const preview = (body: string, call: unknown) => {
    const link = extractLink(body);
    if (link) deps.content.queuePreviews([link], call).catch((e: unknown) => deps.logger.warn("links.queue_failed", { action: "queue_link_preview", outcome: "error", error_code: String(e) }));
  };
  return {
    async sendMessage(req, ctx) {
      const r = parse(z.object({ threadId: Uuid, body: z.string().max(20_000), media: MediaIn.optional(), replyToId: OptionalUuid }), req);
      const reply = await write(deps, ctx, SendMessageRequestSchema, SendMessageResponseSchema, req, async (tx) =>
        create(SendMessageResponseSchema, {
          messageId: await sendMessage(tx, meOf(ctx), r.threadId, r.body, r.media ?? null, r.replyToId || null, null, { restricted: restrictedOf(ctx), postVisible: false }),
        }),
      );
      preview(r.body, onward(ctx));
      return reply;
    },
    async editMessage(req, ctx) {
      const r = parse(z.object({ messageId: Uuid, body: z.string().max(20_000) }), req);
      const reply = await write(deps, ctx, EditMessageRequestSchema, EditMessageResponseSchema, req, async (tx) => {
        await editMessage(tx, meOf(ctx), r.messageId, r.body);
        return create(EditMessageResponseSchema);
      });
      preview(r.body, onward(ctx));
      return reply;
    },
    async deleteMessage(req, ctx) {
      const messageId = parse(Uuid, req.messageId);
      return write(deps, ctx, DeleteMessageRequestSchema, DeleteMessageResponseSchema, req, async (tx) =>
        create(DeleteMessageResponseSchema, { mediaPath: (await deleteMessage(tx, meOf(ctx), messageId)) ?? "" }),
      );
    },
    async threadMessages(req, ctx) {
      const r = parse(z.object({ threadId: Uuid, before: z.union([z.literal(""), z.iso.datetime({ offset: true })]), limit: z.number().int() }), req);
      const rows = await threadMessages(sql, meOf(ctx), r.threadId, r.before || null, r.limit === 0 ? null : r.limit);
      const urls = [...new Set(rows.map((x) => x.link_url).filter((x): x is string => x !== null))];
      const previews = urls.length ? await deps.content.linkPreviews(urls, onward(ctx)) : new Map();
      return {
        messages: rows.map((m) => {
          const link = m.link_url ? previews.get(m.link_url) : undefined;
          return {
            id: m.id,
            senderId: m.sender_id,
            body: m.body,
            media: m.media_path ? { path: m.media_path, width: m.media_width ?? 0, height: m.media_height ?? 0 } : undefined,
            createdAt: iso(m.created_at),
            editedAt: iso(m.edited_at),
            deleted: m.deleted,
            replyToId: m.reply_to_id ?? "",
            replySenderId: m.reply_sender_id ?? "",
            replyExcerpt: m.reply_excerpt ?? "",
            reactions: m.reactions,
            pinned: m.pinned,
            link: link ? { url: link.url, title: link.title, description: link.description, siteName: link.siteName } : undefined,
            sharedPostId: m.shared_post_id ?? "",
            shared: m.shared,
          };
        }),
      };
    },
    async toggleReaction(req, ctx) {
      const r = parse(z.object({ messageId: Uuid, emoji: z.string().max(16) }), req);
      return write(deps, ctx, ToggleReactionRequestSchema, ToggleReactionResponseSchema, req, async (tx) =>
        create(ToggleReactionResponseSchema, { on: await toggleReaction(tx, meOf(ctx), r.messageId, r.emoji, restrictedOf(ctx)) }),
      );
    },
    async pinMessage(req, ctx) {
      const r = parse(z.object({ messageId: Uuid, pin: z.boolean() }), req);
      return write(deps, ctx, PinMessageRequestSchema, PinMessageResponseSchema, req, async (tx) => {
        await pinMessage(tx, meOf(ctx), r.messageId, r.pin, restrictedOf(ctx));
        return create(PinMessageResponseSchema);
      });
    },
    async threadPins(req, ctx) {
      const rows = await threadPins(sql, meOf(ctx), parse(Uuid, req.threadId));
      return { pins: rows.map((p) => ({ messageId: p.message_id, senderId: p.sender_id, excerpt: p.excerpt, pinnedAt: iso(p.pinned_at) })) };
    },
    async searchChats(req, ctx) {
      const me = meOf(ctx);
      const r = parse(z.object({ q: z.string().max(500), threadId: OptionalUuid }), req);
      const rows = await searchChats(sql, me, r.q, r.threadId || null);
      const ids = [...new Set(rows.flatMap((x) => [x.sender_id, ...(x.other_id ? [x.other_id] : [])]))];
      const ventures = [...new Set(rows.map((x) => x.venture_id).filter((x): x is string => x !== null))];
      const [people, titles] = await Promise.all([
        ids.length ? deps.people.cards(ids, onward(ctx)) : Promise.resolve(new Map()),
        ventures.length ? deps.ventures.titles(ventures, onward(ctx)) : Promise.resolve(new Map<string, string>()),
      ]);
      return {
        hits: rows.map((x) => ({
          messageId: x.message_id,
          threadId: x.thread_id,
          threadTitle: x.thread_type === "group" ? (titles.get(x.venture_id!) ?? "Venture chat") : (people.get(x.other_id ?? "")?.fullName ?? ""),
          senderName: x.sender_id === me ? "You" : (people.get(x.sender_id)?.fullName ?? ""),
          excerpt: x.excerpt,
          createdAt: iso(x.created_at),
        })),
      };
    },
  };
}
