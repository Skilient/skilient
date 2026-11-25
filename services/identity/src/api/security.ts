import { create } from "@bufbuild/protobuf";
import type { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import {
  ChangePasswordRequestSchema,
  ChangePasswordResponseSchema,
  CreateBackupCodesRequestSchema,
  CreateBackupCodesResponseSchema,
  DeleteBackupCodesRequestSchema,
  DeleteBackupCodesResponseSchema,
  EnrollTotpRequestSchema,
  EnrollTotpResponseSchema,
  RemoveTotpRequestSchema,
  RemoveTotpResponseSchema,
  RequestPasswordResetRequestSchema,
  RequestPasswordResetResponseSchema,
  ResetPasswordRequestSchema,
  ResetPasswordResponseSchema,
  UseBackupCodeRequestSchema,
  UseBackupCodeResponseSchema,
  VerifyTotpRequestSchema,
  VerifyTotpResponseSchema,
  type IdentityService,
} from "@skilient/contracts/identity/v1/identity_pb";
import { callOf, refuse, withWrite, type RefusalKind } from "@skilient/platform";
import { z } from "zod";
import { appUrl } from "../captcha";
import type { ApiDeps, Email } from "../deps";
import { isBreachedPassword } from "../domain/breached";
import { applyNewPassword, checkCurrentPassword, consumeResetToken, createResetToken, newPasswordProblem, PASSWORD_MAX, RESET_TOKEN } from "../store/passwords";
import { issueSession, stepUpSession } from "../store/sessions";
import { createBackupCodes, deleteBackupCodes, enrollTotp, removeTotp, useBackupCode, verifyTotp } from "../store/two-factor";
import { toSession } from "./sessions";

const Uuid = z.uuid();
const TotpCode = z.string().regex(/^\d{6}$/);
const BackupCode = z.string().min(1).max(64);
const ResetEmail = z.string().trim().toLowerCase().min(3).max(320).regex(/^[^@\s]+@[^@\s]+$/);

type Refusal = { kind: RefusalKind; reason: string };

function signedIn(ctx: HandlerContext) {
  const user = callOf(ctx).user;
  if (!user) throw refuse("not_signed_in", "not signed in");
  return user;
}

/** The session this token belongs to; methods that return a session for this device need one. */
function sessionOf(ctx: HandlerContext): { id: string; aal: "aal1" | "aal2"; sessionId: string } {
  const user = signedIn(ctx);
  if (!user.sessionId) throw refuse("not_signed_in", "session_unknown");
  return { id: user.id, aal: user.aal, sessionId: user.sessionId };
}

/**
 * Two-factor (TOTP, backup codes) and passwords (change, reset) (steps 7 and 8). Each handler validates its
 * input, authorises the actor, runs one transaction with its events and checks row counts in the store.
 * Methods that return a secret or a session store no reply: a repeat under the same idempotency key
 * refuses with already_applied (decision Q2). Where an attempt must count even when refused (a wrong
 * code or password), the transaction commits first and the refusal follows.
 */
export function securityApi(deps: ApiDeps): Partial<ServiceImpl<typeof IdentityService>> {
  const { sql, mailer, totpKey } = deps;
  const sessionCtx = () => ({ keys: deps.keys, refreshPepper: deps.refreshPepper, gateFlags: deps.gateFlags });
  const send = (email: Email) =>
    mailer.send(email).catch((e: unknown) => deps.logger.warn("mail.failed", { action: "mail.send", outcome: "error", error_code: String(e).slice(0, 60) }));
  const breached = (password: string) => isBreachedPassword(password, { logger: deps.logger });

  return {
    async enrollTotp(req, ctx) {
      const user = signedIn(ctx);
      return withWrite(
        ctx,
        sql,
        { input: EnrollTotpRequestSchema, output: EnrollTotpResponseSchema },
        req,
        async (tx) => create(EnrollTotpResponseSchema, await enrollTotp(tx, totpKey, { id: user.id, aal: user.aal })),
        { storeReply: false },
      );
    },

    async verifyTotp(req, ctx) {
      const user = sessionOf(ctx);
      const factorId = req.factorId === "" ? null : Uuid.safeParse(req.factorId).data;
      if (factorId === undefined || !TotpCode.safeParse(req.code).success) throw refuse("invalid_input", "invalid_input");
      let refusal: Refusal | null = null;
      const reply = await withWrite(
        ctx,
        sql,
        { input: VerifyTotpRequestSchema, output: VerifyTotpResponseSchema },
        req,
        async (tx) => {
          const r = await verifyTotp(tx, totpKey, user, factorId, req.code, Date.now() / 1000);
          if (!r.ok) {
            refusal = r.reason === "rate_limited" ? { kind: "too_many", reason: "rate_limited" } : { kind: "not_allowed", reason: "invalid_code" };
            return create(VerifyTotpResponseSchema);
          }
          return create(VerifyTotpResponseSchema, { session: toSession(await stepUpSession(tx, sessionCtx(), user.id, user.sessionId)) });
        },
        { storeReply: false },
      );
      if (refusal) {
        const r: Refusal = refusal;
        throw refuse(r.kind, r.reason);
      }
      return reply;
    },

    async removeTotp(req, ctx) {
      const user = signedIn(ctx);
      const factorId = Uuid.safeParse(req.factorId);
      if (!factorId.success) throw refuse("invalid_input", "invalid_input");
      return withWrite(ctx, sql, { input: RemoveTotpRequestSchema, output: RemoveTotpResponseSchema }, req, async (tx) => {
        await removeTotp(tx, { id: user.id, aal: user.aal }, factorId.data);
        return create(RemoveTotpResponseSchema);
      });
    },

    async createBackupCodes(req, ctx) {
      const user = signedIn(ctx);
      return withWrite(
        ctx,
        sql,
        { input: CreateBackupCodesRequestSchema, output: CreateBackupCodesResponseSchema },
        req,
        async (tx) => create(CreateBackupCodesResponseSchema, { codes: await createBackupCodes(tx, { id: user.id, aal: user.aal }) }),
        { storeReply: false },
      );
    },

    async useBackupCode(req, ctx) {
      const user = sessionOf(ctx);
      if (!BackupCode.safeParse(req.code).success) throw refuse("invalid_input", "invalid_input");
      let to: string | null = null;
      const reply = await withWrite(
        ctx,
        sql,
        { input: UseBackupCodeRequestSchema, output: UseBackupCodeResponseSchema },
        req,
        async (tx) => {
          if (!(await useBackupCode(tx, user.id, req.code))) return create(UseBackupCodeResponseSchema, { ok: false });
          const [row] = await tx<{ email: string }[]>`select email from identity.users where id = ${user.id}`;
          to = row?.email ?? null;
          return create(UseBackupCodeResponseSchema, { ok: true, session: toSession(await stepUpSession(tx, sessionCtx(), user.id, user.sessionId)) });
        },
        { storeReply: false },
      );
      if (to)
        // The owner is told, as today (apps/web/lib/email/templates.ts, backupCodeUsedEmail).
        await send({
          to,
          kind: "backup_code_used",
          subject: "A backup code was used on your Skilient account",
          text: `Someone signed in to your account with a backup code, which turned two-factor off. If this was you, set it up again: ${appUrl()}/settings/security. If it wasn't, change your password there now.`,
        });
      return reply;
    },

    async deleteBackupCodes(req, ctx) {
      const user = signedIn(ctx);
      return withWrite(ctx, sql, { input: DeleteBackupCodesRequestSchema, output: DeleteBackupCodesResponseSchema }, req, async (tx) => {
        await deleteBackupCodes(tx, { id: user.id, aal: user.aal });
        return create(DeleteBackupCodesResponseSchema);
      });
    },

    async changePassword(req, ctx) {
      const user = sessionOf(ctx);
      // The "type it again" check stays in web: the contract carries only the two passwords.
      if (req.currentPassword.length < 1 || req.currentPassword.length > PASSWORD_MAX) throw refuse("invalid_input", "invalid_input");
      const problem = newPasswordProblem(req.newPassword);
      if (problem) throw refuse("invalid_input", problem);
      if (req.newPassword === req.currentPassword) throw refuse("invalid_input", "same_password");
      // Asked before the transaction so the network wait overlaps the password check; read after it.
      const isBreached = breached(req.newPassword);
      let refusal: Refusal | null = null;
      const reply = await withWrite(
        ctx,
        sql,
        { input: ChangePasswordRequestSchema, output: ChangePasswordResponseSchema },
        req,
        async (tx) => {
          const check = await checkCurrentPassword(tx, user.id, req.currentPassword);
          if (!check.ok) {
            refusal = check.reason === "rate_limited" ? { kind: "too_many", reason: "rate_limited" } : { kind: "not_allowed", reason: "wrong_password" };
            return create(ChangePasswordResponseSchema);
          }
          if (await isBreached) {
            refusal = { kind: "invalid_input", reason: "breached_password" };
            return create(ChangePasswordResponseSchema);
          }
          const [live] = await tx`select 1 from identity.sessions where id = ${user.sessionId} and user_id = ${user.id} and revoked_at is null`;
          if (!live) throw refuse("not_signed_in", "session_ended");
          await applyNewPassword(tx, user.id, req.newPassword, "password_changed");
          const session = await issueSession(tx, sessionCtx(), { userId: user.id, aal: user.aal });
          return create(ChangePasswordResponseSchema, { session: toSession(session) });
        },
        { storeReply: false },
      );
      if (refusal) {
        const r: Refusal = refusal;
        throw refuse(r.kind, r.reason);
      }
      return reply;
    },

    async requestPasswordReset(req, ctx) {
      const email = ResetEmail.safeParse(req.email);
      if (!email.success) throw refuse("invalid_input", "invalid_email");
      let token: string | null = null;
      const reply = await withWrite(ctx, sql, { input: RequestPasswordResetRequestSchema, output: RequestPasswordResetResponseSchema }, req, async (tx) => {
        token = (await createResetToken(tx, email.data))?.token ?? null;
        return create(RequestPasswordResetResponseSchema);
      });
      // Same answer and timing whether or not the account exists: the email is not awaited.
      if (token)
        void send({
          to: email.data,
          kind: "password_reset",
          subject: "Reset your Skilient password",
          text: `Someone asked to reset your Skilient password. This link works once, for one hour: ${appUrl()}/reset-password?token=${token}\nIf it wasn't you, ignore this email.`,
        });
      return reply;
    },

    async resetPassword(req, ctx) {
      if (!RESET_TOKEN.test(req.token)) throw refuse("precondition", "reset_link_expired");
      const problem = newPasswordProblem(req.newPassword);
      if (problem) throw refuse("invalid_input", problem);
      const isBreached = breached(req.newPassword);
      return withWrite(
        ctx,
        sql,
        { input: ResetPasswordRequestSchema, output: ResetPasswordResponseSchema },
        req,
        async (tx) => {
          const userId = await consumeResetToken(tx, req.token);
          // A breached password rolls back, so the link still works for a better one.
          if (await isBreached) throw refuse("invalid_input", "breached_password");
          await applyNewPassword(tx, userId, req.newPassword, "password_reset");
          const session = await issueSession(tx, sessionCtx(), { userId, aal: "aal1" });
          return create(ResetPasswordResponseSchema, { session: toSession(session) });
        },
        { storeReply: false },
      );
    },
  };
}
