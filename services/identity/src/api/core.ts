import { create } from "@bufbuild/protobuf";
import type { ServiceImpl } from "@connectrpc/connect";
import {
  IdentityService,
  LogSecurityEventRequestSchema,
  LogSecurityEventResponseSchema,
  SecurityNotMeRequestSchema,
  SecurityNotMeResponseSchema,
  StaffRole,
} from "@skilient/contracts/identity/v1/identity_pb";
import { callOf, refuse, withWrite } from "@skilient/platform";
import { z } from "zod";
import type { ApiDeps } from "../deps";
import { backupCodesRemaining, currentAgreementVersion, personalDomains, recentSecurityEvents, staffRolesOf, verifiedAuthenticators } from "../store/reads";
import { logSecurityEvent, securityNotMe, signinStatus } from "../store/signin";


const ROLE: Record<string, StaffRole> = {
  moderator: StaffRole.MODERATOR,
  trust_reviewer: StaffRole.TRUST_REVIEWER,
  accounts: StaffRole.ACCOUNTS,
  super_admin: StaffRole.SUPER_ADMIN,
};

const Email = z.string().max(320);
const IpHash = z.string().max(64);
const UserIds = z.array(z.uuid()).max(500);
const Domains = z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9.-]{1,253}$/)).max(50);

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw refuse("invalid_input", "invalid_input");
  return r.data;
}

/**
 * Core handlers: reads, sign-in status, security events, "not me". Each validates its input, authorises the actor, runs one transaction
 * with its events and checks its row counts in the store. Methods not listed here are not built yet, and
 * ConnectRPC answers them with Unimplemented (docs/azure/identity-status.md).
 */
export function coreApi({ sql }: ApiDeps): Partial<ServiceImpl<typeof IdentityService>> {
  return {
    async signinStatus(req) {
      const email = parse(Email, req.email);
      const ip = parse(IpHash, req.ipHash);
      const s = await sql.begin((tx) => signinStatus(tx, email, ip));
      return { failures: s.failures, captchaRequired: s.captcha_required, retryAfterSeconds: s.retry_after_seconds };
    },

    async currentAgreementVersion() {
      return { version: await currentAgreementVersion(sql) };
    },

    async staffRolesOf(req) {
      const ids = parse(UserIds, req.userIds);
      const roles = await staffRolesOf(sql, ids);
      return { users: ids.map((userId) => ({ userId, roles: (roles.get(userId) ?? []).map((r) => ROLE[r]!).filter(Boolean) })) };
    },

    async checkEmailDomains(req) {
      const domains = parse(Domains, req.domains);
      const personal = await personalDomains(sql, domains);
      return { domains: domains.map((domain) => ({ domain, personal: personal.has(domain) })) };
    },

    async backupCodesRemaining(_req, ctx) {
      const user = callOf(ctx).user;
      if (!user) throw refuse("not_signed_in", "not signed in");
      return { remaining: await backupCodesRemaining(sql, user.id) };
    },

    async listSecurityEvents(_req, ctx) {
      const user = callOf(ctx).user;
      if (!user) throw refuse("not_signed_in", "not signed in");
      const rows = await recentSecurityEvents(sql, user.id);
      return { events: rows.map((r) => ({ kind: r.kind, at: r.at, userAgent: r.user_agent ?? "", method: r.method ?? "", newDevice: r.new_device })) };
    },

    async listAuthenticators(_req, ctx) {
      const user = callOf(ctx).user;
      if (!user) throw refuse("not_signed_in", "not signed in");
      const rows = await verifiedAuthenticators(sql, user.id);
      return { authenticators: rows.map((r) => ({ factorId: r.id, createdAt: r.created_at, verifiedAt: r.verified_at ?? "" })) };
    },

    async logSecurityEvent(req, ctx) {
      const user = callOf(ctx).user;
      if (!user) throw refuse("not_signed_in", "not signed in");
      return withWrite(ctx, sql, { input: LogSecurityEventRequestSchema, output: LogSecurityEventResponseSchema }, req, async (tx) => {
        await logSecurityEvent(tx, user.id, req.kind, req.ipHash, req.userAgent);
        return create(LogSecurityEventResponseSchema);
      });
    },

    async securityNotMe(req, ctx) {
      // Anonymous (the link in an email), so nothing is stored under the key: a repeat refuses (Q2).
      return withWrite(
        ctx,
        sql,
        { input: SecurityNotMeRequestSchema, output: SecurityNotMeResponseSchema },
        req,
        async (tx) => {
          const r = await securityNotMe(tx, req.token);
          return create(SecurityNotMeResponseSchema, { ok: r.ok, email: r.email ?? "" });
        },
        { storeReply: false },
      );
    },
  };
}
