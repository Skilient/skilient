import { create, type DescMessage, type MessageInitShape, type MessageShape } from "@bufbuild/protobuf";
import type { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import {
  DeletePushSubscriptionRequestSchema,
  DeletePushSubscriptionResponseSchema,
  EmailChannel,
  MarkAllReadRequestSchema,
  MarkAllReadResponseSchema,
  MarkReadRequestSchema,
  MarkReadResponseSchema,
  MyNotificationsResponseSchema,
  MyPushSettingsResponseSchema,
  MySettingsResponseSchema,
  NotifyService,
  PushPublicKeyResponseSchema,
  QueueOpsAlertRequestSchema,
  QueueOpsAlertResponseSchema,
  SavePushSubscriptionRequestSchema,
  SavePushSubscriptionResponseSchema,
  SetPrefRequestSchema,
  SetPrefResponseSchema,
  SetPushPrefRequestSchema,
  SetPushPrefResponseSchema,
  TouchActivityRequestSchema,
  TouchActivityResponseSchema,
  UnreadCountResponseSchema,
} from "@skilient/contracts/notify/v1/notify_pb";
import { callOf, enqueue, from, withWrite, type Logger } from "@skilient/platform";
import type postgres from "postgres";
import { z } from "zod";
import type { Ports } from "../ports";
import { refused } from "../refusals";
import * as B from "../store/bell";

export interface ApiDeps {
  sql: postgres.Sql;
  logger: Logger;
  ports: Ports;
  /** The VAPID public key, or "" until set up. */
  vapidPublicKey: string;
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw refused("invalid_input");
  return r.data;
}

function me(ctx: HandlerContext): string {
  const id = callOf(ctx).user?.id;
  if (!id) throw refused("not_signed_in");
  return id;
}

function write<I extends DescMessage, O extends DescMessage>(
  deps: ApiDeps,
  ctx: HandlerContext,
  input: I,
  output: O,
  req: MessageShape<I>,
  body: (tx: postgres.TransactionSql) => Promise<MessageInitShape<O>>,
  options: { storeReply?: boolean } = {},
): Promise<MessageShape<O>> {
  return withWrite(ctx, deps.sql, { input, output }, req, async (tx) => create(output, await body(tx)), options);
}

const CHANNEL_OUT = { instant_email: EmailChannel.INSTANT_EMAIL, digest: EmailChannel.DIGEST, off: EmailChannel.OFF } as const;
const CHANNEL_IN: Partial<Record<EmailChannel, "instant_email" | "digest" | "off">> = {
  [EmailChannel.INSTANT_EMAIL]: "instant_email",
  [EmailChannel.DIGEST]: "digest",
  [EmailChannel.OFF]: "off",
};
const iso = (d: Date | null) => (d ? new Date(d).toISOString() : "");
const Category = z.string().regex(/^[a-z_]{2,40}$/);

/** `can_view_profile(actor)` for the reader: people's ProfileCards and Relations, one call each (decisions.md, W9). */
async function visibleActors(deps: ApiDeps, ctx: HandlerContext, reader: string, actors: string[]) {
  if (actors.length === 0) return { cards: new Map(), visible: new Set<string>() };
  const call = from(ctx);
  const [cards, rel] = await Promise.all([deps.ports.cards([reader, ...actors], call), deps.ports.relations(reader, actors, call)]);
  const mine = cards.get(reader)?.universityId ?? "";
  const visible = new Set(
    actors.filter((a) => {
      const c = cards.get(a);
      const r = rel.get(a);
      if (!c || r?.blocked) return false;
      return c.visibility === "global" || (c.visibility === "university" && c.universityId !== "" && c.universityId === mine) || Boolean(r?.friends);
    }),
  );
  return { cards, visible };
}

export function createApi(deps: ApiDeps): ServiceImpl<typeof NotifyService> {
  return {
    async myNotifications(req, ctx) {
      const user = me(ctx);
      const before = req.before === "" ? null : parse(z.iso.datetime({ offset: true }), req.before);
      const rows = await B.myNotifications(deps.sql, user, before, req.limit);
      const actors = [...new Set(rows.map((r) => r.actor_id).filter((x): x is string => Boolean(x)))];
      const { cards, visible } = await visibleActors(deps, ctx, user, actors);
      return create(MyNotificationsResponseSchema, {
        notifications: rows.map((r) => {
          const c = r.actor_id ? cards.get(r.actor_id) : undefined;
          const see = r.actor_id ? visible.has(r.actor_id) : false;
          return {
            id: r.id,
            type: r.type,
            category: r.category,
            actorUsername: see ? (c?.username ?? "") : "",
            actorName: c?.name ?? "",
            actorAvatarPath: see ? (c?.avatarPath ?? "") : "",
            entityType: r.entity_type,
            entityId: r.entity_id,
            dataJson: JSON.stringify(r.data ?? {}),
            readAt: iso(r.read_at),
            createdAt: iso(r.created_at),
          };
        }),
      });
    },
    async unreadCount(_req, ctx) {
      return create(UnreadCountResponseSchema, { count: await B.unreadCount(deps.sql, me(ctx)) });
    },
    async markRead(req, ctx) {
      const user = me(ctx);
      const id = parse(z.uuid(), req.id);
      return write(deps, ctx, MarkReadRequestSchema, MarkReadResponseSchema, req, async (tx) => {
        await B.markRead(tx, user, id);
        return {};
      });
    },
    async markAllRead(req, ctx) {
      const user = me(ctx);
      return write(deps, ctx, MarkAllReadRequestSchema, MarkAllReadResponseSchema, req, async (tx) => ({ count: await B.markAllRead(tx, user) }));
    },
    async touchActivity(req, ctx) {
      const user = me(ctx);
      return write(deps, ctx, TouchActivityRequestSchema, TouchActivityResponseSchema, req, async (tx) => {
        await B.touchActivity(tx, user);
        return {};
      });
    },
    async mySettings(_req, ctx) {
      const rows = await B.mySettings(deps.sql, me(ctx));
      return create(MySettingsResponseSchema, {
        categories: rows.map((r) => ({ category: r.category, label: r.label, description: r.description, channel: CHANNEL_OUT[r.channel], allowInstant: r.allow_instant })),
      });
    },
    async setPref(req, ctx) {
      const user = me(ctx);
      const category = parse(Category, req.category);
      const channel = CHANNEL_IN[req.channel];
      if (!channel) throw refused("invalid_input");
      return write(deps, ctx, SetPrefRequestSchema, SetPrefResponseSchema, req, async (tx) => {
        await B.setPref(tx, user, category, channel);
        return {};
      });
    },
    async pushPublicKey() {
      return create(PushPublicKeyResponseSchema, { publicKey: deps.vapidPublicKey });
    },
    async myPushSettings(_req, ctx) {
      const r = await B.myPushSettings(deps.sql, me(ctx));
      return create(MyPushSettingsResponseSchema, { devices: r.devices, categories: r.categories });
    },
    async setPushPref(req, ctx) {
      const user = me(ctx);
      const category = parse(Category, req.category);
      return write(deps, ctx, SetPushPrefRequestSchema, SetPushPrefResponseSchema, req, async (tx) => {
        await B.setPushPref(tx, user, category, req.on);
        return {};
      });
    },
    async savePushSubscription(req, ctx) {
      const user = me(ctx);
      const endpoint = parse(z.string().min(1).max(1000), req.endpoint);
      return write(
        deps,
        ctx,
        SavePushSubscriptionRequestSchema,
        SavePushSubscriptionResponseSchema,
        req,
        async (tx) => {
          await B.savePushSubscription(tx, user, { endpoint, p256dh: req.p256dh, auth: req.auth, userAgent: req.userAgent });
          return {};
        },
        { storeReply: false },
      );
    },
    async deletePushSubscription(req, ctx) {
      const user = me(ctx);
      const endpoint = req.endpoint === "" ? null : parse(z.string().max(1000), req.endpoint);
      return write(
        deps,
        ctx,
        DeletePushSubscriptionRequestSchema,
        DeletePushSubscriptionResponseSchema,
        req,
        async (tx) => {
          await B.deletePushSubscription(tx, user, endpoint);
          return {};
        },
        { storeReply: false },
      );
    },
    async queueOpsAlert(req, ctx) {
      const a = parse(
        z.object({
          key: z.string().regex(/^[a-z0-9_.-]{1,80}$/),
          state: z.enum(["firing", "resolved"]),
          title: z.string().min(1).max(200),
          detail: z.string().min(1).max(2000),
          since: z.string().max(40),
          recipients: z.array(z.email()).max(20),
        }),
        { key: req.key, state: req.state, title: req.title, detail: req.detail, since: req.since, recipients: req.recipients },
      );
      return write(
        deps,
        ctx,
        QueueOpsAlertRequestSchema,
        QueueOpsAlertResponseSchema,
        req,
        async (tx) => {
          await tx`insert into notify.email_queue (kind, payload) values ('ops_alert', ${JSON.stringify(a)}::text::jsonb)`;
          await enqueue(tx, { kind: "email-drain", dedupeKey: `email-drain:alert:${a.key}:${Date.now()}` });
          return {};
        },
        { storeReply: false },
      );
    },
  };
}
