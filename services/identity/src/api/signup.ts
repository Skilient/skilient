import { create } from "@bufbuild/protobuf";
import type { ServiceImpl } from "@connectrpc/connect";
import {
  AcceptAgreementRequestSchema,
  AcceptAgreementResponseSchema,
  AccountRole as Role,
  RequestEmailCodeRequestSchema,
  RequestEmailCodeResponseSchema,
  SignInWithCodeRequestSchema,
  SignInWithCodeResponseSchema,
  SignInWithGoogleRequestSchema,
  SignInWithGoogleResponseSchema,
  SignUpRequestSchema,
  SignUpResponseSchema,
  VerifyEmailRequestSchema,
  VerifyEmailResponseSchema,
  type IdentityService,
} from "@skilient/contracts/identity/v1/identity_pb";
import { callOf, Refusal, refuse, withWrite, type RefusalKind } from "@skilient/platform";
import { z } from "zod";
import { appUrl, requireCaptcha } from "../captcha";
import type { ApiDeps, Email } from "../deps";
import { isBreachedPassword } from "../domain/breached";
import { emailDomain } from "../domain/email";
import { signupRefusalCode } from "../domain/gate-state";
import { validateSignup, type AccountRole } from "../domain/signup-gate";
import { hashPassword } from "../domain/password";
import { CODE_PATTERN, consumeCode, emailKey, issueCode, type CodePurpose } from "../store/email-codes";
import { loadGateData, readGateState } from "../store/gate";
import { findGoogleAccount, googleVerifier, linkGoogle, touchGoogle } from "../store/google";
import { rateLimit } from "../store/rate-limit";
import { issueSession } from "../store/sessions";
import { recordSignIn } from "../store/signin";
import { acceptAgreementRow, createAccount, signupDetails } from "../store/signup";
import { toSession } from "./sessions";

const ROLE_IN: Record<number, AccountRole> = {
  [Role.UNSPECIFIED]: "student",
  [Role.STUDENT]: "student",
  [Role.FACULTY]: "faculty",
  [Role.RECRUITER]: "recruiter",
  [Role.UNIVERSITY_ADMIN]: "university_admin",
};
const ROLE_OUT: Record<AccountRole, Role> = { student: Role.STUDENT, faculty: Role.FACULTY, recruiter: Role.RECRUITER, university_admin: Role.UNIVERSITY_ADMIN };

const EmailAddress = z.string().trim().toLowerCase().min(3).max(320).regex(/^[^@\s]+@[^@\s]+$/);
const Hex64 = /^[0-9a-f]{64}$/;
const SignUpInput = z.object({
  email: EmailAddress,
  // PRD 5.27: at least 10 characters; the breached-password list is checked too.
  password: z.string().min(10).max(128),
  role: z.number().int().refine((r) => r in ROLE_IN),
  universityId: z.union([z.uuid(), z.literal("")]),
  fullName: z.string().trim().max(60),
  agreementVersion: z.number().int().min(0),
  captchaToken: z.string().max(4096),
});
const CodeInput = z.object({ email: EmailAddress, code: z.string().trim().regex(CODE_PATTERN) });
const Device = z.object({ deviceHash: z.string().regex(Hex64), ipHash: z.string().max(64), userAgent: z.string().max(1024) });
const GoogleInput = Device.extend({
  code: z.string().min(1).max(2048),
  codeVerifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
  redirectUri: z.url().max(2048),
  agreementVersion: z.number().int().min(0),
});
const UserIds = z.array(z.uuid()).max(500);

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw refuse("invalid_input", "invalid_input");
  return r.data;
}

const ipOrNull = (ip: string) => (Hex64.test(ip) ? ip : null);

// Rate limits (PRD 5.27, as the web app applies them today), keyed by a hash of the address.
const LIMITS = {
  signup: { limit: 5, window: 3600 },
  signinCode: { limit: 5, window: 3600 },
  verify: { limit: 5, window: 15 * 60 },
};

// Subjects carry the code, as today's Supabase templates do (apps/web/supabase/config.toml), so it shows in
// the inbox list; the auth specs read it from there.
function codeEmail(to: string, purpose: CodePurpose, code: string): Email {
  return purpose === "signup"
    ? {
        to,
        kind: "signup_code",
        subject: `Your Skilient code: ${code}`,
        // The link carries the same code; web confirms it with VerifyEmail (spec: confirming from the link in a second tab).
        text: `Your code is ${code}. It works for 15 minutes. Or confirm with this link: ${appUrl()}/auth/confirm?email=${encodeURIComponent(to)}&code=${code}\nIf you didn't sign up for Skilient, ignore this email.`,
      }
    : { to, kind: "signin_code", subject: `Your Skilient sign-in code: ${code}`, text: `Your sign-in code is ${code}. It works for 15 minutes. If you didn't ask for it, ignore this email.` };
}

/**
 * Sign-up, email codes, Google sign-in, the agreement, the gate state and the sign-up details people reads
 * (W1 steps 3, 4 and 6). Each validates its input, authorises the actor, runs one transaction with its
 * events, and sends email only after that transaction committed. Methods that return a session never store
 * their reply (decision Q2).
 */
export function signupApi(deps: ApiDeps): Partial<ServiceImpl<typeof IdentityService>> {
  const { sql, mailer, refreshPepper } = deps;
  const sessionCtx = () => ({ keys: deps.keys, refreshPepper: deps.refreshPepper, gateFlags: deps.gateFlags });
  const google = deps.google ? googleVerifier(deps.google) : null;

  async function send(outbox: Email[]): Promise<void> {
    for (const email of outbox)
      await mailer.send(email).catch((e: unknown) => deps.logger.warn("mail.failed", { action: `mail.${email.kind}`, outcome: "error", error_code: String(e).slice(0, 60) }));
  }

  /** A refusal decided inside a transaction that must still commit (a counted wrong code). */
  type Deferred = { kind: RefusalKind; reason: string } | null;
  const raise = (d: Deferred) => {
    if (d) throw refuse(d.kind, d.reason);
  };

  return {
    async getGateState(_req, ctx) {
      const user = callOf(ctx).user;
      if (!user) throw refuse("not_signed_in", "not signed in");
      const s = await readGateState(sql, user.id);
      return {
        hasProfile: s.has_profile,
        role: s.role ? ROLE_OUT[s.role] : Role.UNSPECIFIED,
        universityId: s.university_id ?? "",
        onboardingComplete: s.onboarding_complete,
        onboardingStep: s.onboarding_step,
        agreementVersion: s.agreement_version ?? 0,
        agreementAccepted: s.agreement_accepted,
        emailAllowed: s.email_allowed,
        status: s.status,
        portals: s.portals,
      };
    },

    async getSignupDetails(req) {
      const ids = parse(UserIds, req.userIds);
      const rows = await signupDetails(sql, ids);
      return { users: rows.map((r) => ({ userId: r.user_id, fullName: r.full_name, role: ROLE_OUT[r.role], universityId: r.university_id ?? "", emailDomain: r.email_domain ?? "" })) };
    },

    async signUp(req, ctx) {
      const input = parse(SignUpInput, req);
      const role = ROLE_IN[input.role]!;
      await requireCaptcha(deps.turnstileSecret, input.captchaToken, null);
      // Hashed before the transaction, for new and existing addresses alike (same time either way).
      const [hash, breached] = await Promise.all([hashPassword(input.password), isBreachedPassword(input.password, { logger: deps.logger })]);
      if (breached) throw refuse("invalid_input", "breached_password");
      const outbox: Email[] = [];
      const reply = await withWrite(ctx, sql, { input: SignUpRequestSchema, output: SignUpResponseSchema }, req, async (tx) => {
        if (!(await rateLimit(tx, `signup:${emailKey(input.email)}`, LIMITS.signup.limit, LIMITS.signup.window))) throw refuse("too_many", "rate_limited");
        const gate = await loadGateData(tx, [emailDomain(input.email)]);
        const refused = validateSignup(gate, input.email, role, input.universityId || null);
        if (refused) throw refuse(refused === "Enter a valid email address." ? "invalid_input" : "not_allowed", signupRefusalCode(refused));
        const [existing] = await tx<{ id: string; confirmed: boolean }[]>`
          select id, email_confirmed_at is not null as confirmed from identity.users where email = ${input.email}`;
        if (existing) {
          // As today (decision 2026-11-25, Ahmed): a confirmed address is told it is already registered, so web
          // shows "This email is already registered. Sign in instead."; an unconfirmed one gets a fresh code,
          // as Supabase resent the confirmation. The password sent here never replaces the stored one.
          if (existing.confirmed) throw refuse("conflict", "already_registered");
          outbox.push(codeEmail(input.email, "signup", await issueCode(tx, refreshPepper, existing.id, "signup")));
          return create(SignUpResponseSchema, { userId: existing.id, verificationSent: true });
        }
        const { userId } = await createAccount(tx, {
          email: input.email,
          role,
          universityId: input.universityId || null,
          fullName: input.fullName || null,
          agreementVersion: input.agreementVersion || null,
          provider: "email",
          confirmed: false,
          passwordHash: hash,
        });
        outbox.push(codeEmail(input.email, "signup", await issueCode(tx, refreshPepper, userId, "signup")));
        return create(SignUpResponseSchema, { userId, verificationSent: true });
      });
      await send(outbox);
      return reply;
    },

    async verifyEmail(req, ctx) {
      const input = parse(CodeInput, req);
      let deferred: Deferred = null;
      const reply = await withWrite(
        ctx,
        sql,
        { input: VerifyEmailRequestSchema, output: VerifyEmailResponseSchema },
        req,
        async (tx) => {
          if (!(await rateLimit(tx, `verify_email:${emailKey(input.email)}`, LIMITS.verify.limit, LIMITS.verify.window))) throw refuse("too_many", "too_many_attempts");
          const [user] = await tx<{ id: string; banned: boolean }[]>`
            select id, coalesce(banned_until > now(), false) as banned from identity.users where email = ${input.email} for update`;
          if (!user || !(await consumeCode(tx, refreshPepper, user.id, "signup", input.code))) {
            deferred = { kind: "not_signed_in", reason: "invalid_code" };
            return create(VerifyEmailResponseSchema);
          }
          if (user.banned) throw refuse("not_allowed", "account_banned");
          await tx`update identity.users set email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = ${user.id}`;
          const session = await issueSession(tx, sessionCtx(), { userId: user.id, aal: "aal1" });
          return create(VerifyEmailResponseSchema, { session: toSession(session) });
        },
        { storeReply: false },
      );
      raise(deferred);
      return reply;
    },

    async requestEmailCode(req, ctx) {
      const email = parse(EmailAddress, req.email);
      await requireCaptcha(deps.turnstileSecret, parse(z.string().max(4096), req.captchaToken), null);
      const outbox: Email[] = [];
      const reply = await withWrite(ctx, sql, { input: RequestEmailCodeRequestSchema, output: RequestEmailCodeResponseSchema }, req, async (tx) => {
        // Limited per address whether or not it has an account, so the answer says nothing either way.
        if (!(await rateLimit(tx, `signin_code:${emailKey(email)}`, LIMITS.signinCode.limit, LIMITS.signinCode.window))) throw refuse("too_many", "rate_limited");
        const [user] = await tx<{ id: string; banned: boolean }[]>`
          select id, coalesce(banned_until > now(), false) as banned from identity.users where email = ${email}`;
        if (user && !user.banned) outbox.push(codeEmail(email, "signin", await issueCode(tx, refreshPepper, user.id, "signin")));
        return create(RequestEmailCodeResponseSchema);
      });
      await send(outbox);
      return reply;
    },

    async signInWithCode(req, ctx) {
      const input = parse(CodeInput.extend(Device.shape), req);
      let deferred: Deferred = null;
      const outbox: Email[] = [];
      const reply = await withWrite(
        ctx,
        sql,
        { input: SignInWithCodeRequestSchema, output: SignInWithCodeResponseSchema },
        req,
        async (tx) => {
          if (!(await rateLimit(tx, `signin_code_verify:${emailKey(input.email)}`, LIMITS.verify.limit, LIMITS.verify.window)))
            throw refuse("too_many", "too_many_attempts");
          const [user] = await tx<{ id: string; banned: boolean }[]>`
            select id, coalesce(banned_until > now(), false) as banned from identity.users where email = ${input.email} for update`;
          if (!user || !(await consumeCode(tx, refreshPepper, user.id, "signin", input.code))) {
            deferred = { kind: "not_signed_in", reason: "invalid_code" };
            return create(SignInWithCodeResponseSchema);
          }
          if (user.banned) throw refuse("not_allowed", "account_banned");
          // The code proves the inbox, so it also confirms an unconfirmed address.
          await tx`update identity.users set email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = ${user.id}`;
          const seen = await recordSignIn(tx, user.id, input.deviceHash, ipOrNull(input.ipHash), input.userAgent, "otp");
          if (seen.alert_token) outbox.push(newDeviceEmail(input.email, seen.alert_token));
          const session = await issueSession(tx, sessionCtx(), { userId: user.id, aal: "aal1", userAgent: input.userAgent, ipHash: ipOrNull(input.ipHash) });
          return create(SignInWithCodeResponseSchema, { session: toSession(session) });
        },
        { storeReply: false },
      );
      raise(deferred);
      await send(outbox);
      return reply;
    },

    async signInWithGoogle(req, ctx) {
      const input = parse(GoogleInput, req);
      if (!google) throw refuse("unavailable", "google_unavailable");
      // The callback must be the web app's own; Google checks it again against the registered list.
      if (!input.redirectUri.startsWith(`${appUrl()}/`)) throw refuse("invalid_input", "redirect_uri_invalid");
      const profile = await google({ code: input.code, codeVerifier: input.codeVerifier, redirectUri: input.redirectUri });
      const outbox: Email[] = [];
      const reply = await withWrite(
        ctx,
        sql,
        { input: SignInWithGoogleRequestSchema, output: SignInWithGoogleResponseSchema },
        req,
        async (tx) => {
          let found = await findGoogleAccount(tx, profile);
          let newAccount = false;
          if (!found) {
            // A new Google account is a student (Google sign-ups never choose a role), behind the same gate.
            const gate = await loadGateData(tx, [emailDomain(profile.email)]);
            const refused = validateSignup(gate, profile.email, "student", null);
            if (refused) throw refuse("not_allowed", "google_domain");
            const { userId } = await createAccount(tx, {
              email: profile.email,
              provider: "google",
              fullName: profile.name,
              agreementVersion: input.agreementVersion || null,
              confirmed: true,
            });
            await linkGoogle(tx, userId, profile);
            found = { userId, linked: true };
            newAccount = true;
          } else if (!found.linked) {
            await linkGoogle(tx, found.userId, profile);
          } else {
            await touchGoogle(tx, profile);
          }
          const [user] = await tx<{ banned: boolean }[]>`select coalesce(banned_until > now(), false) as banned from identity.users where id = ${found.userId}`;
          if (user!.banned) throw refuse("not_allowed", "account_banned");
          // Today's callback signs out an account whose email no longer fits its role.
          if (!newAccount && !(await readGateState(tx, found.userId)).email_allowed) throw refuse("not_allowed", "google_domain");
          const seen = await recordSignIn(tx, found.userId, input.deviceHash, ipOrNull(input.ipHash), input.userAgent, "google");
          if (seen.alert_token) {
            const [u] = await tx<{ email: string }[]>`select email from identity.users where id = ${found.userId}`;
            outbox.push(newDeviceEmail(u!.email, seen.alert_token));
          }
          const session = await issueSession(tx, sessionCtx(), { userId: found.userId, aal: "aal1", userAgent: input.userAgent, ipHash: ipOrNull(input.ipHash) });
          return create(SignInWithGoogleResponseSchema, { session: toSession(session), newAccount });
        },
        { storeReply: false },
      );
      await send(outbox);
      return reply;
    },

    async acceptAgreement(req, ctx) {
      const user = callOf(ctx).user;
      if (!user) throw refuse("not_signed_in", "not signed in");
      const version = parse(z.number().int().min(1), req.version);
      const ipHash = parse(z.string().max(64), req.ipHash);
      return withWrite(ctx, sql, { input: AcceptAgreementRequestSchema, output: AcceptAgreementResponseSchema }, req, async (tx) => {
        try {
          await tx.savepoint((sp) => acceptAgreementRow(sp, user.id, { user_id: user.id, version, ip_hash: ipOrNull(ipHash) }));
        } catch (e) {
          // Accepting again is done, not an error (the web app treats today's unique violation the same way).
          if (e instanceof Refusal && e.kind === "conflict") return create(AcceptAgreementResponseSchema);
          if (e instanceof Refusal && e.kind === "not_allowed") throw refuse("precondition", "stale_version");
          throw e;
        }
        return create(AcceptAgreementResponseSchema);
      });
    },
  };
}

function newDeviceEmail(to: string, token: string): Email {
  return {
    to,
    kind: "new_device",
    subject: "New sign-in to your Skilient account",
    text: `Your account was just signed in on a new device. If this wasn't you, end every session now: ${appUrl()}/security/not-me?token=${token}`,
  };
}
