import { create } from "@bufbuild/protobuf";
import type { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import {
  CancelAccountDeletionRequestSchema,
  CancelAccountDeletionResponseSchema,
  CompleteGithubLinkRequestSchema,
  CompleteGithubLinkResponseSchema,
  DisconnectGithubRequestSchema,
  DisconnectGithubResponseSchema,
  GrantStaffRoleRequestSchema,
  GrantStaffRoleResponseSchema,
  LiftSanctionRequestSchema,
  LiftSanctionResponseSchema,
  OpsResetMfaRequestSchema,
  OpsResetMfaResponseSchema,
  RequestAccountDeletionRequestSchema,
  RequestAccountDeletionResponseSchema,
  RevokeStaffRoleRequestSchema,
  RevokeStaffRoleResponseSchema,
  SanctionUserRequestSchema,
  SanctionUserResponseSchema,
  StaffRole,
  type IdentityService,
} from "@skilient/contracts/identity/v1/identity_pb";
import { callOf, from, refuse, withWrite } from "@skilient/platform";
import { z } from "zod";
import type { ApiDeps } from "../deps";
import { cancelAccountDeletion, requestAccountDeletion } from "../store/deletion";
import { recordGithubEvent } from "../store/github";
import { peopleNamesVia, type PeopleNames } from "../store/people-names";
import { liftSanction, sanctionUser } from "../store/sanctions";
import { grantStaffRole, loadActor, opsStaff, opsResetMfa, revokeStaffRole } from "../store/staff";

const ROLE_NAME: Record<number, string> = {
  [StaffRole.MODERATOR]: "moderator",
  [StaffRole.TRUST_REVIEWER]: "trust_reviewer",
  [StaffRole.ACCOUNTS]: "accounts",
  [StaffRole.SUPER_ADMIN]: "super_admin",
};
const ROLE_ENUM: Record<string, StaffRole> = Object.fromEntries(Object.entries(ROLE_NAME).map(([k, v]) => [v, Number(k) as StaffRole]));

const Uuid = z.uuid();
const Email = z.string().max(320);
const Reason = z.string().max(2000);
const Kind = z.string().max(20);
const Until = z.union([z.literal(""), z.iso.datetime({ offset: true })]);
const Login = z.string().max(39);

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw refuse("invalid_input", "invalid_input");
  return r.data;
}

const roleName = (role: StaffRole): string => ROLE_NAME[role] ?? "";

/**
 * Staff roles, the two-factor reset, the commands trust and work call, and account deletion (steps 9 to 11).
 * Every handler validates its input, builds the actor from the verified token (never from the body),
 * authorises in the store, and runs one transaction with its audit row and events under the call's
 * idempotency key. The gate has already checked the caller service (src/authorize.ts `callers`).
 */
export function staffApi(deps: ApiDeps, people?: PeopleNames): Partial<ServiceImpl<typeof IdentityService>> {
  const { sql, logger, mailer } = deps;
  const user = (ctx: HandlerContext) => callOf(ctx).user;

  return {
    async opsStaff(_req, ctx) {
      const actor = await loadActor(sql, user(ctx));
      const names =
        people ??
        peopleNamesVia(deps.clients, from(ctx), (e) =>
          deps.logger.warn("ops_staff.names_unavailable", { action: "OpsStaff", outcome: "degraded", error_code: e instanceof Error ? e.message.slice(0, 60) : "unknown" }),
        );
      const members = await opsStaff(sql, actor, names);
      return {
        members: members.map((m) => ({
          userId: m.user_id,
          email: m.email,
          roles: m.roles.map((r) => ROLE_ENUM[r]!).filter((r) => r !== undefined),
          since: m.since,
          isMe: m.is_me,
          twoFactor: m.two_factor,
          name: m.name ?? "",
        })),
      };
    },

    async grantStaffRole(req, ctx) {
      const input = { email: parse(Email, req.email), role: roleName(req.role), reason: parse(Reason, req.reason) };
      return withWrite(ctx, sql, { input: GrantStaffRoleRequestSchema, output: GrantStaffRoleResponseSchema }, req, async (tx) => {
        const userId = await grantStaffRole(tx, await loadActor(tx, user(ctx)), input);
        return create(GrantStaffRoleResponseSchema, { userId });
      });
    },

    async revokeStaffRole(req, ctx) {
      const input = { userId: parse(Uuid, req.userId), role: roleName(req.role), reason: parse(Reason, req.reason) };
      return withWrite(ctx, sql, { input: RevokeStaffRoleRequestSchema, output: RevokeStaffRoleResponseSchema }, req, async (tx) => {
        await revokeStaffRole(tx, await loadActor(tx, user(ctx)), input);
        return create(RevokeStaffRoleResponseSchema);
      });
    },

    async opsResetMfa(req, ctx) {
      const input = { userId: parse(Uuid, req.userId), identityNote: parse(Reason, req.identityNote) };
      const reset: { to?: string } = {};
      const reply = await withWrite(ctx, sql, { input: OpsResetMfaRequestSchema, output: OpsResetMfaResponseSchema }, req, async (tx) => {
        reset.to = await opsResetMfa(tx, await loadActor(tx, user(ctx)), input);
        return create(OpsResetMfaResponseSchema);
      });
      // After commit, and only when this call did the reset (a repeat returns the stored reply, sends nothing).
      const to = reset.to;
      if (to) {
        await mailer
          .send({
            to,
            kind: "mfa_reset",
            subject: "Your Skilient two-factor was reset",
            text:
              "A Skilient staff member reset two-factor sign-in on your account after checking who you are.\n\n" +
              "Every device was signed out. Sign in with your password and set up two-factor again from Settings, Security.\n\n" +
              "If you did not ask for this, reply to this email at once.",
          })
          .catch((error: unknown) =>
            logger.error("mfa_reset.email_failed", { action: "ops_reset_mfa", outcome: "error", error_code: error instanceof Error ? error.message.slice(0, 80) : "unknown" }),
          );
      }
      return reply;
    },

    async sanctionUser(req, ctx) {
      const until = parse(Until, req.until);
      const input = {
        userId: parse(Uuid, req.userId),
        kind: parse(Kind, req.kind),
        until: until ? new Date(until) : null,
        reason: parse(Reason, req.reason),
        sanctionId: parse(Uuid, req.sanctionId),
      };
      return withWrite(ctx, sql, { input: SanctionUserRequestSchema, output: SanctionUserResponseSchema }, req, async (tx) => {
        await sanctionUser(tx, await loadActor(tx, user(ctx)), input);
        return create(SanctionUserResponseSchema);
      });
    },

    async liftSanction(req, ctx) {
      const input = { userId: parse(Uuid, req.userId), sanctionId: parse(Uuid, req.sanctionId), reason: parse(Reason, req.reason) };
      return withWrite(ctx, sql, { input: LiftSanctionRequestSchema, output: LiftSanctionResponseSchema }, req, async (tx) => {
        await liftSanction(tx, await loadActor(tx, user(ctx)), input);
        return create(LiftSanctionResponseSchema);
      });
    },

    async completeGithubLink(req, ctx) {
      const input = { userId: parse(Uuid, req.userId), login: parse(Login, req.githubLogin), kind: "github_connected" as const };
      return withWrite(ctx, sql, { input: CompleteGithubLinkRequestSchema, output: CompleteGithubLinkResponseSchema }, req, async (tx) => {
        await recordGithubEvent(tx, input);
        return create(CompleteGithubLinkResponseSchema);
      });
    },

    async disconnectGithub(req, ctx) {
      const input = { userId: parse(Uuid, req.userId), login: parse(Login, req.githubLogin), kind: "github_disconnected" as const };
      return withWrite(ctx, sql, { input: DisconnectGithubRequestSchema, output: DisconnectGithubResponseSchema }, req, async (tx) => {
        await recordGithubEvent(tx, input);
        return create(DisconnectGithubResponseSchema);
      });
    },

    async requestAccountDeletion(req, ctx) {
      const me = user(ctx);
      if (!me) throw refuse("not_signed_in", "not signed in");
      return withWrite(ctx, sql, { input: RequestAccountDeletionRequestSchema, output: RequestAccountDeletionResponseSchema }, req, async (tx) => {
        const when = await requestAccountDeletion(tx, me.id);
        return create(RequestAccountDeletionResponseSchema, { deleteAfter: when.toISOString() });
      });
    },

    async cancelAccountDeletion(req, ctx) {
      const me = user(ctx);
      if (!me) throw refuse("not_signed_in", "not signed in");
      return withWrite(ctx, sql, { input: CancelAccountDeletionRequestSchema, output: CancelAccountDeletionResponseSchema }, req, async (tx) => {
        await cancelAccountDeletion(tx, me.id);
        return create(CancelAccountDeletionResponseSchema);
      });
    },
  };
}
