import { create } from "@bufbuild/protobuf";
import type { ServiceImpl } from "@connectrpc/connect";
import * as W from "@skilient/contracts/work/v1/work_pb";
import { z } from "zod";
import type { ApiDeps } from "../deps";
import { refused } from "../refusals";
import * as A from "../store/applications";
import * as R from "../store/reads";
import * as V from "../store/ventures";
import { iso, meOf, onward, OptionalUuid, parse, restrictedOf, Uuid, write } from "./util";

const Type = z.enum(["project", "startup"]);
const Visibility = z.enum(["public", "university", "unlisted"]);
const Stage = z.enum(["idea", "prototype", "launched", "revenue"]);
const Status = z.enum(["recruiting", "in_progress", "completed", "abandoned"]);
const TeamRole = z.enum(["lead", "developer", "designer", "researcher", "other"]);
const Skills = (max: number) => z.array(z.string().max(40)).max(max * 4);
const Text = (max: number) => z.string().max(max);
const opt = (s: string) => (s === "" ? null : s);

function needUser(ctx: Parameters<typeof meOf>[0]): string {
  const me = meOf(ctx);
  if (!me) throw refused("not_signed_in");
  return me;
}

/** Ventures: create, edit, status, team, roles, questions, applications, invites, follows, updates; and reads. */
export function venturesApi(deps: ApiDeps): Partial<ServiceImpl<typeof W.WorkService>> {
  const { sql } = deps;
  return {
    async createVenture(req, ctx) {
      const p = parse(
        z.object({
          type: Type,
          title: Text(200),
          description: Text(4000),
          visibility: z.union([z.literal(""), Visibility]),
          stage: z.union([z.literal(""), Stage]),
          pitchUrl: Text(500),
          affiliation: Text(200),
          skillIds: Skills(10),
          teamSize: z.number().int().min(0).max(6),
          roles: z.array(z.object({ title: Text(200), skillIds: Skills(5), slots: z.number().int().min(0).max(5) })).max(24),
          questions: z.array(Text(400)).max(12),
        }),
        req,
      );
      return write(deps, ctx, W.CreateVentureRequestSchema, W.CreateVentureResponseSchema, req, async (tx) => {
        restrictedOf(ctx)();
        const id = await V.createVenture(tx, meOf(ctx), {
          type: p.type,
          title: p.title,
          description: p.description,
          visibility: p.visibility || "public",
          stage: opt(p.stage),
          pitch_url: opt(p.pitchUrl),
          affiliation: opt(p.affiliation.trim()),
          skill_ids: p.skillIds,
          team_size: p.teamSize || 4,
          roles: p.roles.map((r) => ({ title: r.title, skill_ids: r.skillIds, slots: r.slots || 1 })),
          questions: p.questions,
        });
        return create(W.CreateVentureResponseSchema, { ventureId: id });
      });
    },
    async updateVenture(req, ctx) {
      const venture = parse(Uuid, req.ventureId);
      const p = parse(
        z.object({
          title: Text(200).optional(),
          description: Text(4000).optional(),
          visibility: Visibility.optional(),
          stage: z.union([z.literal(""), Stage]).optional(),
          pitchUrl: Text(500).optional(),
          affiliation: Text(200).optional(),
          teamSize: z.number().int().min(2).max(6).optional(),
          skillIds: Skills(10),
        }),
        req,
      );
      return write(deps, ctx, W.UpdateVentureRequestSchema, W.UpdateVentureResponseSchema, req, async (tx) => {
        await V.updateVenture(tx, meOf(ctx), venture, {
          title: p.title,
          description: p.description,
          visibility: p.visibility,
          stage: p.stage === undefined ? undefined : opt(p.stage),
          pitch_url: p.pitchUrl === undefined ? undefined : opt(p.pitchUrl),
          affiliation: p.affiliation === undefined ? undefined : opt(p.affiliation.trim()),
          skill_ids: req.setSkillIds ? p.skillIds : undefined,
          team_size: p.teamSize,
        });
        return create(W.UpdateVentureResponseSchema, {});
      });
    },
    async transitionVenture(req, ctx) {
      const venture = parse(Uuid, req.ventureId);
      const to = parse(Status, req.to);
      return write(deps, ctx, W.TransitionVentureRequestSchema, W.TransitionVentureResponseSchema, req, async (tx) => {
        await V.transitionVenture(tx, meOf(ctx), venture, to);
        return create(W.TransitionVentureResponseSchema, {});
      });
    },
    async getVenture(req, ctx) {
      const me = needUser(ctx);
      const page = await R.ventureForPage(sql, me, parse(Uuid, req.ventureId));
      if (!page) return create(W.GetVentureResponseSchema, {});
      const v = page.venture;
      const linkOnly = page.byLinkOnly;
      return create(W.GetVentureResponseSchema, {
        venture: {
          id: v.id,
          type: v.type,
          title: v.title,
          description: v.description,
          status: v.status,
          visibility: v.visibility,
          // Reached by link only: the details the policies hid stay hidden (venture_by_link's columns).
          stage: linkOnly ? "" : (v.stage ?? ""),
          pitchUrl: linkOnly ? "" : (v.pitch_url ?? ""),
          affiliation: linkOnly ? "" : (v.affiliation ?? ""),
          skillIds: linkOnly ? [] : v.skill_ids,
          teamSize: linkOnly ? 6 : v.team_size,
          ownerId: v.owner_id,
          universityId: v.university_id,
          repoFullName: linkOnly ? "" : (v.repo_full_name ?? ""),
          repoId: linkOnly || !v.repo_id ? 0n : BigInt(v.repo_id),
          createdAt: iso(v.created_at),
          completedAt: linkOnly ? "" : iso(v.completed_at),
          abandonedAt: linkOnly ? "" : iso(v.abandoned_at),
        },
        byLinkOnly: linkOnly,
        team: page.team.map((m) => ({ userId: m.user_id, teamRole: m.team_role, joinedAt: iso(m.joined_at), isOwner: m.is_owner, profileVisible: m.profile_visible })),
        roles: page.roles.map((r) => ({ id: r.id, title: r.title, skillIds: r.skill_ids, slots: r.slots, filled: r.filled })),
        questions: page.questions.map((q) => ({ position: q.position, body: q.body })),
        members: page.counts.members,
        followers: page.counts.followers,
        deliverables: page.counts.deliverables,
        updates: page.counts.updates,
        isMember: page.team.some((m) => m.user_id === me),
        isOwner: v.owner_id === me,
        following: page.state.following,
        pendingApplicationId: page.state.application_id ?? "",
        pendingInviteId: page.state.invite_id ?? "",
        viewerUniversityId: page.state.university_id ?? "",
      });
    },
    async browseVentures(req, ctx) {
      const me = needUser(ctx);
      const rows = await R.browseVentures(sql, me, {
        type: parse(Type, req.type),
        status: req.status ? parse(Status, req.status) : null,
        open_roles: req.openRoles,
        my_university: req.myUniversity,
        before: req.before ? parse(z.iso.datetime({ offset: true }), req.before) : null,
        limit: req.limit,
      });
      return create(W.BrowseVenturesResponseSchema, { ventures: rows.map(summary) });
    },
    async searchVentures(req, ctx) {
      const f = {
        q: parse(Text(200), req.q),
        type: parse(Type, req.type),
        skill: req.skillId ? parse(Text(40), req.skillId) : null,
        university_id: req.universityId ? parse(Uuid, req.universityId) : null,
        offset: parse(z.number().int().min(0).max(100_000), req.offset),
      };
      // A read that counts towards the 60-a-minute search limit, so it runs in a transaction of its own.
      const rows = await sql.begin((tx) => R.searchVentures(tx, meOf(ctx), f));
      return create(W.SearchVenturesResponseSchema, { ventures: rows.map(summary) });
    },
    async profileVentures(req, ctx) {
      const rows = await R.profileVentures(sql, needUser(ctx), parse(Uuid, req.userId));
      return create(W.ProfileVenturesResponseSchema, {
        ventures: rows.map((r) => ({ id: r.id, type: r.type, title: r.title, status: r.status, teamRole: r.team_role, isOwner: r.is_owner, joinedAt: iso(r.joined_at) })),
      });
    },
    async ventureUpdates(req, ctx) {
      return create(W.VentureUpdatesResponseSchema, { updates: (await R.ventureUpdates(sql, needUser(ctx), parse(Uuid, req.ventureId))).map(update) });
    },
    async followedVentureUpdates(_req, ctx) {
      return create(W.FollowedVentureUpdatesResponseSchema, { updates: (await R.followedVentureUpdates(sql, needUser(ctx))).map(update) });
    },
    async deliverables(req, ctx) {
      const rows = await R.deliverables(sql, needUser(ctx), parse(Uuid, req.ventureId));
      return create(W.DeliverablesResponseSchema, {
        deliverables: rows.map((d) => ({ id: d.id, label: d.label, url: d.url, addedBy: d.added_by ?? "", createdAt: iso(d.created_at) })),
      });
    },
    async ownerInvites(req, ctx) {
      const rows = await R.ownerInvites(sql, needUser(ctx), parse(Uuid, req.ventureId));
      return create(W.OwnerInvitesResponseSchema, { invites: rows.map((i) => ({ id: i.id, inviteeId: i.invitee_id, createdAt: iso(i.created_at) })) });
    },
    async myRequests(_req, ctx) {
      const me = needUser(ctx);
      const r = await R.myRequests(sql, me);
      return create(W.MyRequestsResponseSchema, {
        applications: r.applications.map((a) => ({
          id: a.id,
          ventureId: a.venture_id,
          ventureTitle: a.venture_title ?? "",
          ventureType: a.venture_type ?? "",
          roleId: a.role_id ?? "",
          roleTitle: a.role_title ?? "",
          candidateId: a.candidate_id,
          ownerId: a.owner_id,
          status: a.status,
          message: a.message,
          answersJson: JSON.stringify(a.answers),
          createdAt: iso(a.created_at),
          decidedAt: iso(a.decided_at),
          messages: r.messages.filter((m) => m.application_id === a.id).map((m) => ({ id: BigInt(m.id), senderId: m.sender_id, body: m.body, createdAt: iso(m.created_at) })),
          sent: a.candidate_id === me,
        })),
        invites: r.invites.map((i) => ({
          id: i.id,
          ventureId: i.venture_id,
          ventureTitle: i.venture_title ?? "",
          ventureType: i.venture_type ?? "",
          inviterId: i.inviter_id,
          status: i.status,
          createdAt: iso(i.created_at),
        })),
      });
    },

    async applyToVenture(req, ctx) {
      const venture = parse(Uuid, req.ventureId);
      const role = parse(OptionalUuid, req.roleId);
      const message = parse(Text(4000), req.message);
      const answers = parse(z.array(Text(2000)).max(10), req.answers);
      return write(deps, ctx, W.ApplyToVentureRequestSchema, W.ApplyToVentureResponseSchema, req, async (tx) => {
        restrictedOf(ctx)();
        return create(W.ApplyToVentureResponseSchema, { applicationId: await A.applyToVenture(tx, meOf(ctx), venture, opt(role), message, answers) });
      });
    },
    async decideApplication(req, ctx) {
      const application = parse(Uuid, req.applicationId);
      return write(deps, ctx, W.DecideApplicationRequestSchema, W.DecideApplicationResponseSchema, req, async (tx) =>
        create(W.DecideApplicationResponseSchema, { status: await A.decideApplication(tx, meOf(ctx), application, req.accept) }),
      );
    },
    async withdrawApplication(req, ctx) {
      const application = parse(Uuid, req.applicationId);
      return write(deps, ctx, W.WithdrawApplicationRequestSchema, W.WithdrawApplicationResponseSchema, req, async (tx) =>
        create(W.WithdrawApplicationResponseSchema, { withdrawn: await A.withdrawApplication(tx, meOf(ctx), application) }),
      );
    },
    async addApplicationMessage(req, ctx) {
      const application = parse(Uuid, req.applicationId);
      const body = parse(Text(4000), req.body);
      return write(deps, ctx, W.AddApplicationMessageRequestSchema, W.AddApplicationMessageResponseSchema, req, async (tx) => {
        restrictedOf(ctx)();
        return create(W.AddApplicationMessageResponseSchema, { messageId: BigInt(await A.addApplicationMessage(tx, meOf(ctx), application, body)) });
      });
    },
    async inviteToVenture(req, ctx) {
      const venture = parse(Uuid, req.ventureId);
      const username = parse(Text(64), req.username).trim().toLowerCase();
      // The invitee's id from people, once, before the transaction.
      const invitee = meOf(ctx) && username ? ((await deps.people.resolve([username], onward(ctx))).get(username) ?? null) : null;
      return write(deps, ctx, W.InviteToVentureRequestSchema, W.InviteToVentureResponseSchema, req, async (tx) => {
        restrictedOf(ctx)();
        return create(W.InviteToVentureResponseSchema, { inviteId: await A.inviteToVenture(tx, meOf(ctx), venture, invitee) });
      });
    },
    async respondInvite(req, ctx) {
      const invite = parse(Uuid, req.inviteId);
      return write(deps, ctx, W.RespondInviteRequestSchema, W.RespondInviteResponseSchema, req, async (tx) =>
        create(W.RespondInviteResponseSchema, { status: await A.respondInvite(tx, meOf(ctx), invite, req.accept) }),
      );
    },
    async revokeInvite(req, ctx) {
      const invite = parse(Uuid, req.inviteId);
      return write(deps, ctx, W.RevokeInviteRequestSchema, W.RevokeInviteResponseSchema, req, async (tx) =>
        create(W.RevokeInviteResponseSchema, { revoked: await A.revokeInvite(tx, meOf(ctx), invite) }),
      );
    },
    async leaveVenture(req, ctx) {
      const venture = parse(Uuid, req.ventureId);
      return write(deps, ctx, W.LeaveVentureRequestSchema, W.LeaveVentureResponseSchema, req, async (tx) => {
        await V.leaveVenture(tx, meOf(ctx), venture);
        return create(W.LeaveVentureResponseSchema, {});
      });
    },
    async removeVentureMember(req, ctx) {
      const venture = parse(Uuid, req.ventureId);
      const member = parse(Uuid, req.memberId);
      return write(deps, ctx, W.RemoveVentureMemberRequestSchema, W.RemoveVentureMemberResponseSchema, req, async (tx) => {
        await V.removeVentureMember(tx, meOf(ctx), venture, member);
        return create(W.RemoveVentureMemberResponseSchema, {});
      });
    },
    async setMemberRole(req, ctx) {
      const venture = parse(Uuid, req.ventureId);
      const member = parse(Uuid, req.memberId);
      const role = parse(TeamRole, req.teamRole);
      return write(deps, ctx, W.SetMemberRoleRequestSchema, W.SetMemberRoleResponseSchema, req, async (tx) => {
        await V.setMemberRole(tx, meOf(ctx), venture, member, role);
        return create(W.SetMemberRoleResponseSchema, {});
      });
    },
    async transferVentureOwnership(req, ctx) {
      const venture = parse(Uuid, req.ventureId);
      const member = parse(Uuid, req.memberId);
      return write(deps, ctx, W.TransferVentureOwnershipRequestSchema, W.TransferVentureOwnershipResponseSchema, req, async (tx) => {
        await V.transferOwnership(tx, meOf(ctx), venture, member);
        return create(W.TransferVentureOwnershipResponseSchema, {});
      });
    },
    async saveVentureRole(req, ctx) {
      const venture = parse(Uuid, req.ventureId);
      const role = parse(OptionalUuid, req.roleId);
      const title = parse(Text(200), req.title);
      const skills = parse(Skills(5), req.skillIds);
      const slots = parse(z.number().int().min(1).max(5), req.slots);
      return write(deps, ctx, W.SaveVentureRoleRequestSchema, W.SaveVentureRoleResponseSchema, req, async (tx) =>
        create(W.SaveVentureRoleResponseSchema, { roleId: await V.saveVentureRole(tx, meOf(ctx), venture, opt(role), title, skills, slots) }),
      );
    },
    async deleteVentureRole(req, ctx) {
      const venture = parse(Uuid, req.ventureId);
      const role = parse(Uuid, req.roleId);
      return write(deps, ctx, W.DeleteVentureRoleRequestSchema, W.DeleteVentureRoleResponseSchema, req, async (tx) => {
        await V.deleteVentureRole(tx, meOf(ctx), venture, role);
        return create(W.DeleteVentureRoleResponseSchema, {});
      });
    },
    async setVentureQuestions(req, ctx) {
      const venture = parse(Uuid, req.ventureId);
      const questions = parse(z.array(Text(400)).max(12), req.questions);
      return write(deps, ctx, W.SetVentureQuestionsRequestSchema, W.SetVentureQuestionsResponseSchema, req, async (tx) => {
        await V.setVentureQuestions(tx, meOf(ctx), venture, questions);
        return create(W.SetVentureQuestionsResponseSchema, {});
      });
    },
    async addVentureDeliverable(req, ctx) {
      const venture = parse(Uuid, req.ventureId);
      const label = parse(Text(200), req.label);
      const url = parse(Text(1000), req.url);
      return write(deps, ctx, W.AddVentureDeliverableRequestSchema, W.AddVentureDeliverableResponseSchema, req, async (tx) =>
        create(W.AddVentureDeliverableResponseSchema, { deliverableId: await V.addDeliverable(tx, meOf(ctx), venture, label, url) }),
      );
    },
    async removeVentureDeliverable(req, ctx) {
      const deliverable = parse(Uuid, req.deliverableId);
      return write(deps, ctx, W.RemoveVentureDeliverableRequestSchema, W.RemoveVentureDeliverableResponseSchema, req, async (tx) =>
        create(W.RemoveVentureDeliverableResponseSchema, { removed: await V.removeDeliverable(tx, meOf(ctx), deliverable) }),
      );
    },
    async followVenture(req, ctx) {
      const venture = parse(Uuid, req.ventureId);
      return write(deps, ctx, W.FollowVentureRequestSchema, W.FollowVentureResponseSchema, req, async (tx) => {
        if (req.follow) restrictedOf(ctx)();
        return create(W.FollowVentureResponseSchema, { following: await A.followVenture(tx, meOf(ctx), venture, req.follow) });
      });
    },
    async postVentureUpdate(req, ctx) {
      const venture = parse(Uuid, req.ventureId);
      const body = parse(Text(4000), req.body);
      const media = req.media.map((m) => ({ path: m.path, width: m.width, height: m.height }));
      return write(deps, ctx, W.PostVentureUpdateRequestSchema, W.PostVentureUpdateResponseSchema, req, async (tx) => {
        restrictedOf(ctx)();
        const id = await A.postVentureUpdate(tx, meOf(ctx), venture, body, media, (paths) => deps.media.missing(paths, onward(ctx)));
        return create(W.PostVentureUpdateResponseSchema, { updateId: id });
      });
    },
    async deleteVentureUpdate(req, ctx) {
      const u = parse(Uuid, req.updateId);
      return write(deps, ctx, W.DeleteVentureUpdateRequestSchema, W.DeleteVentureUpdateResponseSchema, req, async (tx) =>
        create(W.DeleteVentureUpdateResponseSchema, { deleted: await A.deleteVentureUpdate(tx, meOf(ctx), u) }),
      );
    },

    async ventureCards(req) {
      const viewer = req.viewerId ? parse(Uuid, req.viewerId) : null;
      const ids = parse(z.array(Uuid).max(200), req.ventureIds);
      const rows = await R.ventureCards(sql, viewer, ids);
      return create(W.VentureCardsResponseSchema, {
        cards: rows.map((c) => ({
          id: c.id,
          title: c.title,
          type: c.type,
          status: c.status,
          visibility: c.visibility,
          members: c.members,
          teamSize: c.team_size,
          isMember: c.is_member,
          myApplication: c.my_application ?? "",
          roles: c.roles,
          team: c.team.map((m) => ({ userId: m.user_id, profileVisible: m.profile_visible })),
        })),
      });
    },
    async ventureTitles(req) {
      const rows = await R.ventureTitles(sql, parse(z.array(Uuid).max(500), req.ventureIds));
      return create(W.VentureTitlesResponseSchema, { ventures: rows.map((r) => ({ ventureId: r.venture_id, title: r.title })) });
    },
  };
}

function summary(r: R.SummaryRow) {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    summary: r.summary,
    status: r.status,
    visibility: r.visibility,
    stage: r.stage ?? "",
    skillIds: r.skill_ids,
    universityId: r.university_id,
    ownerId: r.owner_id,
    members: r.members,
    teamSize: r.team_size,
    openSlots: r.open_slots,
    createdAt: iso(r.created_at),
  };
}

function update(u: R.UpdateRow) {
  return {
    id: u.id,
    ventureId: u.venture_id,
    ventureTitle: u.venture_title,
    authorId: u.author_id,
    body: u.body,
    media: u.media,
    createdAt: iso(u.created_at),
    canDelete: u.can_delete,
  };
}
