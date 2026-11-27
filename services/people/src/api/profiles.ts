import { create } from "@bufbuild/protobuf";
import type { ServiceImpl } from "@connectrpc/connect";
import {
  PeopleService,
  SetLeaderboardOptOutRequestSchema,
  SetLeaderboardOptOutResponseSchema,
  SetProfileImageRequestSchema,
  SetProfileImageResponseSchema,
  SetReadReceiptsRequestSchema,
  SetReadReceiptsResponseSchema,
  UpdateProfileRequestSchema,
  UpdateProfileResponseSchema,
  UsernameAvailableRequestSchema,
  UsernameAvailableResponseSchema,
  GetProfileRequestSchema,
  GetProfileResponseSchema,
} from "@skilient/contracts/people/v1/people_pb";
import { appendEvents } from "@skilient/platform";
import { z } from "zod";
import type { ApiDeps } from "../deps";
import { refused } from "../refusals";
import {
  getProfile,
  loadProfile,
  profileCards,
  relations,
  filterByName,
  resolveUsernames,
  setLeaderboardOptOut,
  setProfileImage,
  setReadReceipts,
  updateOwnProfile,
  usernameAvailable,
  type ProfilePatch,
  type ProfileRow,
} from "../store/profiles";
import { iso, meOf, parse, text, UserIds, Username, Uuid, countedRead, write } from "./util";

const Visibility = z.enum(["friends", "university", "global"]);
const LookingFor = z.array(z.enum(["internship", "job", "teammates", "project", "mentorship"])).max(5);

/** The viewer's own profile as the contract carries it (GetMyProfile, GetOnboarding). */
export function myProfileMessage(p: ProfileRow) {
  return {
    userId: p.user_id,
    role: p.role,
    universityId: p.university_id ?? "",
    universityName: p.university_name ?? "",
    fullName: p.full_name,
    username: p.username ?? "",
    department: p.department ?? "",
    departmentId: p.department_id ?? "",
    programme: p.programme ?? "",
    graduationYear: p.graduation_year ?? 0,
    campus: p.campus ?? "",
    bio: p.bio ?? "",
    avatarPath: p.avatar_path ?? "",
    coverPath: p.cover_path ?? "",
    visibility: p.visibility,
    recruiterVisible: p.recruiter_visible,
    lookingFor: p.looking_for,
    onboardingComplete: p.onboarding_complete,
    readReceipts: p.chat_read_receipts,
    leaderboardOptOut: p.leaderboard_opt_out,
    status: p.status,
    deleteAfter: iso(p.delete_after),
  };
}

/** Profiles: own profile, profile page, batch reads, edits and the privacy settings. */
export function profilesApi(deps: ApiDeps): Partial<ServiceImpl<typeof PeopleService>> {
  const { sql } = deps;
  return {
    async getMyProfile(_req, ctx) {
      const me = meOf(ctx);
      if (!me) throw refused("not_signed_in");
      const p = await loadProfile(sql, me);
      if (!p) throw refused("profile_not_found");
      return myProfileMessage(p);
    },

    async getProfile(req, ctx) {
      const username = parse(Username, req.username);
      return countedRead(deps, ctx, GetProfileRequestSchema, GetProfileResponseSchema, req, async (tx) => {
        const r = await getProfile(tx, meOf(ctx), username);
        if (r.kind === "full") {
          const p = r.profile;
          return create(GetProfileResponseSchema, {
            result: {
              case: "full",
              value: {
                userId: p.user_id,
                username: p.username ?? "",
                fullName: p.full_name,
                universityName: p.university_name ?? "",
                department: p.department ?? "",
                programme: p.programme ?? "",
                graduationYear: p.graduation_year ?? 0,
                campus: p.campus ?? "",
                bio: p.bio ?? "",
                avatarPath: p.avatar_path ?? "",
                coverPath: p.cover_path ?? "",
                visibility: p.visibility,
                lookingFor: p.looking_for,
                isOwner: p.is_owner,
              },
            },
          });
        }
        if (r.kind === "card")
          return create(GetProfileResponseSchema, {
            result: { case: "card", value: { userId: r.card.user_id, username: r.card.username, fullName: r.card.full_name, department: r.card.department ?? "", graduationYear: r.card.graduation_year ?? 0 } },
          });
        return create(GetProfileResponseSchema, { result: { case: "notFound", value: true } });
      });
    },

    async profileCards(req) {
      const ids = parse(UserIds, req.userIds);
      const rows = await profileCards(sql, ids);
      return {
        users: rows.map((r) => ({
          userId: r.user_id,
          username: r.username ?? "",
          fullName: r.full_name,
          avatarPath: r.avatar_path ?? "",
          department: r.department ?? "",
          graduationYear: r.graduation_year ?? 0,
          universityId: r.university_id ?? "",
          universityName: r.university_name ?? "",
          role: r.role,
          status: r.status,
          visibility: r.visibility,
        })),
      };
    },

    async resolveUsernames(req) {
      const names = parse(z.array(Username).max(500), req.usernames);
      return { users: (await resolveUsernames(sql, names)).map((r) => ({ username: r.username, userId: r.user_id })) };
    },

    async filterByName(req) {
      const r = parse(z.object({ userIds: z.array(Uuid).max(20_000), query: z.string().min(1).max(100), limit: z.number().int().min(1).max(100) }), req);
      return { userIds: await filterByName(sql, r.userIds, r.query, r.limit) };
    },

    async relations(req) {
      const userId = parse(Uuid, req.userId);
      const others = parse(UserIds, req.otherIds);
      return { others: (await relations(sql, userId, others)).map((r) => ({ otherId: r.other_id, friends: r.friends, blocked: r.blocked, muted: r.muted })) };
    },

    async usernameAvailable(req, ctx) {
      const name = parse(Username, req.username);
      return countedRead(deps, ctx, UsernameAvailableRequestSchema, UsernameAvailableResponseSchema, req, async (tx) =>
        create(UsernameAvailableResponseSchema, { available: await usernameAvailable(tx, meOf(ctx), name) }),
      );
    },

    async updateProfile(req, ctx) {
      const r = parse(
        z.object({
          fullName: z.string().max(200).optional(),
          username: z.string().max(64).optional(),
          bio: z.string().max(2000).optional(),
          campus: z.string().max(200).optional(),
          programme: z.string().max(200).optional(),
          department: z.string().max(200).optional(),
          graduationYear: z.number().int().optional(),
          visibility: Visibility.optional(),
          lookingFor: LookingFor,
          lookingForSet: z.boolean(),
          recruiterVisible: z.boolean().optional(),
        }),
        req,
      );
      const patch: ProfilePatch = {};
      if (r.fullName !== undefined) patch.full_name = r.fullName;
      if (r.username !== undefined) patch.username = r.username === "" ? null : r.username.trim().toLowerCase();
      if (r.bio !== undefined) patch.bio = text(r.bio);
      if (r.campus !== undefined) patch.campus = text(r.campus);
      if (r.programme !== undefined) patch.programme = text(r.programme);
      if (r.department !== undefined) patch.department = text(r.department);
      if (r.graduationYear !== undefined) patch.graduation_year = r.graduationYear === 0 ? null : r.graduationYear;
      if (r.visibility !== undefined) patch.visibility = r.visibility;
      if (r.lookingForSet) patch.looking_for = [...new Set(r.lookingFor)];
      if (r.recruiterVisible !== undefined) patch.recruiter_visible = r.recruiterVisible;
      return write(deps, ctx, UpdateProfileRequestSchema, UpdateProfileResponseSchema, req, async (tx) => {
        await updateOwnProfile(tx, meOf(ctx), patch);
        return create(UpdateProfileResponseSchema);
      });
    },

    async setProfileImage(req, ctx) {
      const kind = parse(z.enum(["avatar", "cover"]), req.kind);
      const path = parse(z.string().max(200), req.path);
      return write(deps, ctx, SetProfileImageRequestSchema, SetProfileImageResponseSchema, req, async (tx) => {
        const me = meOf(ctx);
        const { replaced } = await setProfileImage(tx, me, kind, text(path));
        // The media service deletes the file the profile no longer uses (today's avatar_cleanup trigger; W9).
        if (replaced) await appendEvents(tx, [{ type: "profile.image_replaced", subjects: [me!], payload: { user_id: me, kind, old_path: replaced } }]);
        return create(SetProfileImageResponseSchema);
      });
    },

    async setReadReceipts(req, ctx) {
      return write(deps, ctx, SetReadReceiptsRequestSchema, SetReadReceiptsResponseSchema, req, async (tx) => {
        await setReadReceipts(tx, meOf(ctx), req.on);
        return create(SetReadReceiptsResponseSchema);
      });
    },

    async setLeaderboardOptOut(req, ctx) {
      return write(deps, ctx, SetLeaderboardOptOutRequestSchema, SetLeaderboardOptOutResponseSchema, req, async (tx) =>
        create(SetLeaderboardOptOutResponseSchema, { out: await setLeaderboardOptOut(tx, meOf(ctx), req.out) }),
      );
    },
  };
}
