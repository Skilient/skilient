import { create } from "@bufbuild/protobuf";
import type { ServiceImpl } from "@connectrpc/connect";
import {
  RefreshRequestSchema,
  RefreshResponseSchema,
  SignInPasswordRequestSchema,
  SignInPasswordResponseSchema,
  SignOutRequestSchema,
  SignOutResponseSchema,
  SignOutScope,
  type IdentityService,
} from "@skilient/contracts/identity/v1/identity_pb";
import { callOf, refuse, uuidv7, withWrite } from "@skilient/platform";
import { z } from "zod";
import { appUrl, requireCaptcha } from "../captcha";
import type { ApiDeps, Email } from "../deps";
import { hashPassword, needsRehash, verifyPassword } from "../domain/password";
import { issueSession, refreshSession, revokeAllSessions, revokeSession, type SessionTokens } from "../store/sessions";
import { recordSignIn, signinFailed, signinStatus } from "../store/signin";

const SignIn = z.object({
  email: z.string().trim().toLowerCase().min(3).max(320),
  password: z.string().min(1).max(128),
  deviceHash: z.string().regex(/^[0-9a-f]{64}$/),
  ipHash: z.string().max(64),
  userAgent: z.string().max(1024),
});

// A real Argon2id hash of a random password: an unknown email costs the same time as a wrong password.
let decoy: Promise<string> | undefined;

export function toSession(s: SessionTokens) {
  return { accessToken: s.accessToken, refreshToken: s.refreshToken, expiresInSeconds: s.expiresInSeconds, sessionId: s.sessionId, aal: s.aal };
}

/** Password sign-in, refresh rotation and sign-out (step 5). */
export function sessionsApi(deps: ApiDeps): Partial<ServiceImpl<typeof IdentityService>> {
  const { sql, mailer } = deps;
  const ctxOf = () => ({ keys: deps.keys, refreshPepper: deps.refreshPepper, gateFlags: deps.gateFlags });

  return {
    async signInPassword(req, ctx) {
      const parsed = SignIn.safeParse(req);
      if (!parsed.success) throw refuse("invalid_input", "invalid_input");
      const input = parsed.data;
      const ip = /^[0-9a-f]{64}$/.test(input.ipHash) ? input.ipHash : null;
      let refusal: { kind: "not_signed_in" | "not_allowed" | "precondition" | "too_many"; reason: string } | null = null;
      const outbox: Email[] = [];
      const reply = await withWrite(
        ctx,
        sql,
        { input: SignInPasswordRequestSchema, output: SignInPasswordResponseSchema },
        req,
        async (tx) => {
          const status = await signinStatus(tx, input.email, ip);
          if (status.retry_after_seconds > 0) {
            refusal = { kind: "too_many", reason: "retry_later" };
            return create(SignInPasswordResponseSchema);
          }
          if (status.captcha_required) await requireCaptcha(deps.turnstileSecret, req.captchaToken, ip);
          const [user] = await tx<{ id: string; banned: boolean; confirmed: boolean; hash: string | null }[]>`
            select u.id, coalesce(u.banned_until > now(), false) as banned, u.email_confirmed_at is not null as confirmed, p.hash
              from identity.users u left join identity.password_credentials p on p.user_id = u.id
             where u.email = ${input.email}`;
          const ok = user?.hash ? await verifyPassword(user.hash, input.password) : await verifyPassword(await (decoy ??= hashPassword(uuidv7())), "x").then(() => false);
          if (!ok || !user) {
            const failed = await signinFailed(tx, input.email, ip);
            if (failed.notify && user)
              outbox.push({
                to: input.email,
                kind: "sign_in_alert",
                subject: "Someone keeps trying your Skilient password",
                text: `There have been ${failed.failures} failed attempts to sign in to your account. If this wasn't you, change your password: ${appUrl()}/forgot-password`,
              });
            refusal = { kind: "not_signed_in", reason: "invalid_credentials" };
            return create(SignInPasswordResponseSchema);
          }
          if (user.banned) {
            refusal = { kind: "not_allowed", reason: "account_banned" };
            return create(SignInPasswordResponseSchema);
          }
          if (!user.confirmed) {
            refusal = { kind: "precondition", reason: "email_not_confirmed" };
            return create(SignInPasswordResponseSchema);
          }
          if (needsRehash(user.hash!))
            await tx`update identity.password_credentials set hash = ${await hashPassword(input.password)}, algorithm = 'argon2id', updated_at = now()
                      where user_id = ${user.id}`;
          const seen = await recordSignIn(tx, user.id, input.deviceHash, ip, input.userAgent, "password");
          if (seen.alert_token)
            outbox.push({
              to: input.email,
              kind: "new_device",
              subject: "New sign-in to your Skilient account",
              text: `Your account was just signed in on a new device. If this wasn't you, end every session now: ${appUrl()}/security/not-me?token=${seen.alert_token}`,
            });
          const [factor] = await tx`select 1 from identity.totp_factors where user_id = ${user.id} and status = 'verified'`;
          const session = await issueSession(tx, ctxOf(), { userId: user.id, aal: "aal1", userAgent: input.userAgent, ipHash: ip });
          return create(SignInPasswordResponseSchema, { session: toSession(session), twoFactorRequired: Boolean(factor) });
        },
        { storeReply: false },
      );
      // Emails and refusals happen only after the transaction committed (a failure is counted even when refused).
      for (const email of outbox) await mailer.send(email).catch((e: unknown) => deps.logger.warn("mail.failed", { action: "mail.send", outcome: "error", error_code: String(e).slice(0, 60) }));
      if (refusal) {
        const r: { kind: "not_signed_in" | "not_allowed" | "precondition" | "too_many"; reason: string } = refusal;
        throw refuse(r.kind, r.reason);
      }
      return reply;
    },

    async refresh(req, ctx) {
      let reused = false;
      const reply = await withWrite(
        ctx,
        sql,
        { input: RefreshRequestSchema, output: RefreshResponseSchema },
        req,
        async (tx) => {
          const result = await refreshSession(tx, ctxOf(), req.refreshToken);
          if ("reused" in result) {
            reused = true;
            return create(RefreshResponseSchema);
          }
          return create(RefreshResponseSchema, { session: toSession(result) });
        },
        { storeReply: false },
      );
      if (reused) throw refuse("not_signed_in", "refresh_token_reused");
      return reply;
    },

    async signOut(req, ctx) {
      const user = callOf(ctx).user;
      if (!user) throw refuse("not_signed_in", "not signed in");
      return withWrite(ctx, sql, { input: SignOutRequestSchema, output: SignOutResponseSchema }, req, async (tx) => {
        switch (req.scope) {
          case SignOutScope.LOCAL:
            if (!user.sessionId) throw refuse("invalid_input", "session_unknown");
            await revokeSession(tx, user.id, user.sessionId, "sign_out");
            break;
          case SignOutScope.OTHERS:
            await revokeAllSessions(tx, user.id, "sign_out_others", user.sessionId ?? null);
            break;
          case SignOutScope.GLOBAL:
            await revokeAllSessions(tx, user.id, "sign_out_everywhere");
            await tx`insert into identity.security_events (id, user_id, kind) values (${uuidv7()}, ${user.id}, 'signed_out_everywhere')`;
            break;
          default:
            throw refuse("invalid_input", "scope_required");
        }
        return create(SignOutResponseSchema);
      });
    },
  };
}
