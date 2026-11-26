import type { DescMessage, MessageShape } from "@bufbuild/protobuf";
import type { HandlerContext } from "@connectrpc/connect";
import { callOf, from, refuseIfRestricted, withWrite } from "@skilient/platform";
import type postgres from "postgres";
import { z } from "zod";
import type { ApiDeps } from "../deps";
import { refused } from "../refusals";
import type { Card } from "../store/cards";

/** Validates input with zod; any failure is one typed refusal (no details echoed back). */
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw refused("invalid_input");
  return r.data;
}

/** The signed-in user's id, or null. */
export const meOf = (ctx: HandlerContext): string | null => callOf(ctx).user?.id ?? null;

/** The token's restriction, as refuse_if_restricted did on content's tables. */
export const restrictedOf = (ctx: HandlerContext) => () => refuseIfRestricted(callOf(ctx).user);

/** Call options that carry this request on to another service (depth 2). */
export const onward = (ctx: HandlerContext) => from(ctx);

/** One write: idempotency key, one transaction with its events (withWrite), the body's typed reply. */
export function write<I extends DescMessage, O extends DescMessage>(
  deps: ApiDeps,
  ctx: HandlerContext,
  input: I,
  output: O,
  req: MessageShape<I>,
  body: (tx: postgres.TransactionSql) => Promise<MessageShape<O>>,
): Promise<MessageShape<O>> {
  return withWrite(ctx, deps.sql, { input, output }, req, body);
}

/**
 * A write whose reply is the reader's own view of posts (the feed page, survey questions): run like a write,
 * but no reply is stored under the idempotency key (it would keep a second copy of post data for 24 hours).
 */
export function writeNoReply<I extends DescMessage, O extends DescMessage>(
  deps: ApiDeps,
  ctx: HandlerContext,
  input: I,
  output: O,
  req: MessageShape<I>,
  body: (tx: postgres.TransactionSql) => Promise<MessageShape<O>>,
): Promise<MessageShape<O>> {
  return withWrite(ctx, deps.sql, { input, output }, req, body, { storeReply: false });
}

/** Times as RFC 3339; "" for none. */
export const iso = (d: Date | string | null | undefined) => (d == null ? "" : d instanceof Date ? d.toISOString() : new Date(d).toISOString());
export const Uuid = z.uuid();
export const OptionalUuid = z.union([z.literal(""), z.uuid()]);
export const Ids = (max: number) => z.array(z.uuid()).max(max);

/** A card in the contract's shape. */
export function cardMessage(c: Card) {
  return {
    id: c.id,
    type: c.type,
    audience: c.audience,
    body: c.body,
    createdAt: iso(c.created_at),
    editedAt: iso(c.edited_at),
    pinnedUntil: iso(c.pinned_until),
    stage: c.stage,
    authorId: c.author_id,
    authorUsername: c.author_username,
    authorName: c.author_name,
    authorAvatarPath: c.author_avatar_path,
    isMine: c.is_mine,
    canEdit: c.can_edit,
    media: c.media,
    event: c.event
      ? {
          startsAt: iso(c.event.starts_at),
          place: c.event.place ?? "",
          url: c.event.url ?? "",
          going: Number(c.event.going),
          interested: Number(c.event.interested),
          mine: c.event.mine ?? "",
        }
      : undefined,
    poll: c.poll
      ? {
          closesAt: iso(c.poll.closes_at),
          closed: c.poll.closed,
          myVote: c.poll.my_vote ?? 0,
          total: Number(c.poll.total),
          options: c.poll.options.map((o) => ({ position: o.position, label: o.label, votes: o.votes === null ? -1 : Number(o.votes) })),
        }
      : undefined,
    ventureId: c.venture_id ?? "",
    ventureJson: c.venture == null ? "" : JSON.stringify(c.venture),
    commentCount: c.comment_count,
    link: c.link
      ? { url: c.link.url, title: c.link.title ?? "", description: c.link.description ?? "", imageUrl: c.link.image_url ?? "", siteName: c.link.site_name ?? "" }
      : undefined,
    authorMuted: c.author_muted,
    societyId: c.society_id ?? "",
    societyJson: c.society == null ? "" : JSON.stringify(c.society),
  };
}
