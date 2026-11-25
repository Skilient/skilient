import { create } from "@bufbuild/protobuf";
import type { ServiceImpl } from "@connectrpc/connect";
import {
  BlockUserRequestSchema,
  BlockUserResponseSchema,
  CancelFriendRequestRequestSchema,
  CancelFriendRequestResponseSchema,
  DismissSuggestionRequestSchema,
  DismissSuggestionResponseSchema,
  MuteUserRequestSchema,
  MuteUserResponseSchema,
  PeopleService,
  RespondFriendRequestRequestSchema,
  RespondFriendRequestResponseSchema,
  SearchPeopleRequestSchema,
  SearchPeopleResponseSchema,
  SendFriendRequestRequestSchema,
  SendFriendRequestResponseSchema,
  UnblockUserRequestSchema,
  UnblockUserResponseSchema,
  UnfriendRequestSchema,
  UnfriendResponseSchema,
} from "@skilient/contracts/people/v1/people_pb";
import { callOf, refuseIfRestricted } from "@skilient/platform";
import { z } from "zod";
import type { ApiDeps } from "../deps";
import {
  blockUser,
  cancelFriendRequest,
  dismissSuggestion,
  friendshipState,
  muteUser,
  myBlocks,
  myFriendRequests,
  myFriends,
  myMutes,
  pendingFriendRequestCount,
  respondFriendRequest,
  sendFriendRequest,
  unblockUser,
  unfriend,
} from "../store/friends";
import { peopleYouMayKnow, searchPeople } from "../store/search";
import { iso, meOf, parse, Username, Uuid, write } from "./util";

const card = (r: { user_id: string; username: string | null; full_name: string; avatar_path: string | null; department: string | null; graduation_year: number | null }) => ({
  userId: r.user_id,
  username: r.username ?? "",
  fullName: r.full_name,
  avatarPath: r.avatar_path ?? "",
  department: r.department ?? "",
  graduationYear: r.graduation_year ?? 0,
});

/** Friends, blocks, mutes, search and suggestions. */
export function socialApi(deps: ApiDeps): Partial<ServiceImpl<typeof PeopleService>> {
  const { sql } = deps;
  return {
    async listFriends(_req, ctx) {
      return { friends: (await myFriends(sql, meOf(ctx))).map((r) => ({ person: card(r), since: iso(r.since) })) };
    },
    async listFriendRequests(_req, ctx) {
      return { requests: (await myFriendRequests(sql, meOf(ctx))).map((r) => ({ id: r.id, direction: r.direction, person: card(r), createdAt: iso(r.created_at) })) };
    },
    async listBlocks(_req, ctx) {
      return { blocked: (await myBlocks(sql, meOf(ctx))).map((r) => ({ username: r.username ?? "", fullName: r.full_name, createdAt: iso(r.created_at) })) };
    },
    async listMutes(_req, ctx) {
      return { muted: (await myMutes(sql, meOf(ctx))).map((r) => ({ username: r.username ?? "", fullName: r.full_name, createdAt: iso(r.created_at) })) };
    },
    async friendshipState(req, ctx) {
      const [s] = await friendshipState(sql, meOf(ctx), parse(Username, req.username));
      return { state: s?.state ?? "", requestId: s?.request_id ?? "" };
    },
    async pendingFriendRequestCount(_req, ctx) {
      return { count: await pendingFriendRequestCount(sql, meOf(ctx)) };
    },

    async sendFriendRequest(req, ctx) {
      const username = parse(Username, req.username);
      return write(deps, ctx, SendFriendRequestRequestSchema, SendFriendRequestResponseSchema, req, async (tx) => {
        const user = callOf(ctx).user;
        const [r] = await sendFriendRequest(tx, user?.id ?? null, username, () => refuseIfRestricted(user));
        return create(SendFriendRequestResponseSchema, { requestId: r!.request_id, status: r!.status });
      });
    },
    async respondFriendRequest(req, ctx) {
      const id = parse(Uuid, req.requestId);
      return write(deps, ctx, RespondFriendRequestRequestSchema, RespondFriendRequestResponseSchema, req, async (tx) => {
        await respondFriendRequest(tx, meOf(ctx), id, req.accept);
        return create(RespondFriendRequestResponseSchema);
      });
    },
    async cancelFriendRequest(req, ctx) {
      const id = parse(Uuid, req.requestId);
      return write(deps, ctx, CancelFriendRequestRequestSchema, CancelFriendRequestResponseSchema, req, async (tx) => {
        await cancelFriendRequest(tx, meOf(ctx), id);
        return create(CancelFriendRequestResponseSchema);
      });
    },
    async unfriend(req, ctx) {
      const username = parse(Username, req.username);
      return write(deps, ctx, UnfriendRequestSchema, UnfriendResponseSchema, req, async (tx) => {
        await unfriend(tx, meOf(ctx), username);
        return create(UnfriendResponseSchema);
      });
    },
    async blockUser(req, ctx) {
      const username = parse(Username, req.username);
      return write(deps, ctx, BlockUserRequestSchema, BlockUserResponseSchema, req, async (tx) => {
        await blockUser(tx, meOf(ctx), username);
        return create(BlockUserResponseSchema);
      });
    },
    async unblockUser(req, ctx) {
      const username = parse(Username, req.username);
      return write(deps, ctx, UnblockUserRequestSchema, UnblockUserResponseSchema, req, async (tx) => {
        await unblockUser(tx, meOf(ctx), username);
        return create(UnblockUserResponseSchema);
      });
    },
    async muteUser(req, ctx) {
      const username = parse(Username, req.username);
      return write(deps, ctx, MuteUserRequestSchema, MuteUserResponseSchema, req, async (tx) => {
        await muteUser(tx, meOf(ctx), username, req.mute);
        return create(MuteUserResponseSchema);
      });
    },
    async dismissSuggestion(req, ctx) {
      const username = parse(Username, req.username);
      return write(deps, ctx, DismissSuggestionRequestSchema, DismissSuggestionResponseSchema, req, async (tx) => {
        await dismissSuggestion(tx, meOf(ctx), username);
        return create(DismissSuggestionResponseSchema);
      });
    },

    async searchPeople(req, ctx) {
      const r = parse(
        z.object({ q: z.string().max(200), department: z.string().max(80), skill: z.string().max(80), university: z.string().max(100), offset: z.number().int(), batch: z.number().int() }),
        req,
      );
      return write(deps, ctx, SearchPeopleRequestSchema, SearchPeopleResponseSchema, req, async (tx) => {
        const rows = await searchPeople(tx, meOf(ctx), {
          q: r.q,
          department: r.department || null,
          skill: r.skill || null,
          university: r.university || null,
          offset: r.offset,
          batch: r.batch || null,
        });
        return create(SearchPeopleResponseSchema, {
          results: rows.map((x) => ({ person: card(x), university: x.university ?? "", skills: x.skills, friendship: x.friendship })),
        });
      });
    },

    async peopleYouMayKnow(req, ctx) {
      const rows = await peopleYouMayKnow(sql, meOf(ctx), req.limit === 0 ? null : req.limit, deps.labels);
      return {
        suggestions: rows.map((s) => ({
          username: s.username,
          fullName: s.name,
          avatarPath: s.avatar_path ?? "",
          department: s.department ?? "",
          graduationYear: s.graduation_year ?? 0,
          reason: s.reason,
        })),
      };
    },
  };
}
