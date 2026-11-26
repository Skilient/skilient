import { create } from "@bufbuild/protobuf";
import type { ServiceImpl } from "@connectrpc/connect";
import {
  CloseThreadRequestSchema,
  CloseThreadResponseSchema,
  GetOrCreateDmRequestSchema,
  GetOrCreateDmResponseSchema,
  MarkThreadReadRequestSchema,
  MarkThreadReadResponseSchema,
  MessagingService,
  MuteThreadRequestSchema,
  MuteThreadResponseSchema,
  OpenContactThreadRequestSchema,
  OpenContactThreadResponseSchema,
} from "@skilient/contracts/messaging/v1/messaging_pb";
import { z } from "zod";
import type { ApiDeps } from "../deps";
import { refused } from "../refusals";
import { isMember } from "../store/db";
import { closeThread, dmReceipt, getOrCreateDm, markThreadRead, muteThread, myThreads, openContactThread, threadPeople, unreadChatCount, ventureChat } from "../store/threads";
import { iso, meOf, onward, parse, Uuid, write } from "./util";

/** Threads: DMs, the chat list, the badge, team chats, people, mute, read marks; and market's contact DMs. */
export function threadsApi(deps: ApiDeps): Partial<ServiceImpl<typeof MessagingService>> {
  const { sql } = deps;
  return {
    async getOrCreateDm(req, ctx) {
      const username = parse(z.string().max(64), req.username).trim().toLowerCase();
      // The username's id from people, once, before the transaction.
      const other = meOf(ctx) && username ? ((await deps.people.resolve([username], onward(ctx))).get(username) ?? null) : null;
      return write(deps, ctx, GetOrCreateDmRequestSchema, GetOrCreateDmResponseSchema, req, async (tx) =>
        create(GetOrCreateDmResponseSchema, { threadId: await getOrCreateDm(tx, meOf(ctx), other) }),
      );
    },
    async myThreads(_req, ctx) {
      const me = meOf(ctx);
      const rows = await myThreads(sql, me);
      const others = [...new Set(rows.map((r) => r.other_id).filter((x): x is string => x !== null))];
      const ventures = [...new Set(rows.map((r) => r.venture_id).filter((x): x is string => x !== null))];
      const [people, titles] = await Promise.all([
        others.length ? deps.people.cards(others, onward(ctx)) : Promise.resolve(new Map()),
        ventures.length ? deps.ventures.titles(ventures, onward(ctx)) : Promise.resolve(new Map<string, string>()),
      ]);
      return {
        threads: rows.map((r) => {
          const o = r.other_id ? people.get(r.other_id) : undefined;
          return {
            id: r.id,
            type: r.type,
            title: r.type === "group" ? (titles.get(r.venture_id!) ?? "Venture chat") : (o?.fullName ?? "Deleted account"),
            username: r.other_visible ? (o?.username ?? "") : "",
            avatarPath: r.other_visible ? (o?.avatarPath ?? "") : "",
            ventureId: r.venture_id ?? "",
            lastMessage: r.last_message ?? "",
            lastMessageAt: iso(r.last_message_at),
            lastSenderIsMe: r.last_sender_is_me ?? false,
            unread: r.unread,
            muted: r.muted,
          };
        }),
      };
    },
    async unreadChatCount(_req, ctx) {
      return { count: await unreadChatCount(sql, meOf(ctx)) };
    },
    async ventureChat(req, ctx) {
      return { threadId: (await ventureChat(sql, meOf(ctx), parse(Uuid, req.ventureId))) ?? "" };
    },
    async threadPeople(req, ctx) {
      const me = meOf(ctx);
      const rows = await threadPeople(sql, me, parse(Uuid, req.threadId));
      const people = rows.length ? await deps.people.cards(rows.map((r) => r.user_id), onward(ctx)) : new Map();
      return {
        people: rows
          .map((r) => {
            const p = people.get(r.user_id);
            return {
              userId: r.user_id,
              name: r.blocked ? "Blocked member" : (p?.fullName ?? ""),
              username: r.visible ? (p?.username ?? "") : "",
              avatarPath: r.visible ? (p?.avatarPath ?? "") : "",
              blocked: r.blocked,
              isMe: r.is_me,
            };
          })
          .sort((a, b) => (people.get(a.userId)?.fullName ?? "").localeCompare(people.get(b.userId)?.fullName ?? "")),
      };
    },
    async muteThread(req, ctx) {
      const r = parse(z.object({ threadId: Uuid, hours: z.number().int() }), req);
      return write(deps, ctx, MuteThreadRequestSchema, MuteThreadResponseSchema, req, async (tx) => {
        await muteThread(tx, meOf(ctx), r.threadId, r.hours);
        return create(MuteThreadResponseSchema);
      });
    },
    async markThreadRead(req, ctx) {
      const threadId = parse(Uuid, req.threadId);
      return write(deps, ctx, MarkThreadReadRequestSchema, MarkThreadReadResponseSchema, req, async (tx) => {
        await markThreadRead(tx, meOf(ctx), threadId);
        return create(MarkThreadReadResponseSchema);
      });
    },
    async dmReceipt(req, ctx) {
      return { readAt: iso(await dmReceipt(sql, meOf(ctx), parse(Uuid, req.threadId))) };
    },
    async canListen(req) {
      const r = parse(z.object({ userId: Uuid, threadId: Uuid }), req);
      const [row] = await sql<{ ok: boolean }[]>`select ${isMember(sql, r.userId, "t.id")} as ok from messaging.threads t where t.id = ${r.threadId}`;
      return { allowed: row?.ok ?? false };
    },
    async openContactThread(req, ctx) {
      const r = parse(z.object({ studentId: Uuid, recruiterId: Uuid, orgId: Uuid }), req);
      if (r.studentId === r.recruiterId) throw refused("self_message");
      return write(deps, ctx, OpenContactThreadRequestSchema, OpenContactThreadResponseSchema, req, async (tx) =>
        create(OpenContactThreadResponseSchema, { threadId: await openContactThread(tx, r.studentId, r.recruiterId, r.orgId) }),
      );
    },
    async closeThread(req, ctx) {
      const threadId = parse(Uuid, req.threadId);
      return write(deps, ctx, CloseThreadRequestSchema, CloseThreadResponseSchema, req, async (tx) => {
        await closeThread(tx, threadId);
        return create(CloseThreadResponseSchema);
      });
    },
  };
}
