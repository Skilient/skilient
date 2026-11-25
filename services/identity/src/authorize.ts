import type { IdentityService } from "@skilient/contracts/identity/v1/identity_pb";
import { refuse, type CallerPolicy } from "@skilient/platform";

const WEB = ["web"] as const;

/**
 * Which callers may use each method; the gate refuses anyone else before the body is read. Web calls almost
 * everything; trust calls the sanction commands, work the GitHub ones (decision 2026-11-25: writes from other
 * services into identity data go through identity commands); several services read staff roles in batches.
 */
export const callers: CallerPolicy<typeof IdentityService> = {
  getGateState: WEB,
  signinStatus: WEB,
  backupCodesRemaining: WEB,
  staffRolesOf: ["web", "people", "trust", "work", "credentials", "market"],
  currentAgreementVersion: WEB,
  opsStaff: WEB,
  getSignupDetails: ["people"],
  checkEmailDomains: ["people"],
  listSecurityEvents: WEB,
  listAuthenticators: WEB,
  signUp: WEB,
  verifyEmail: WEB,
  requestEmailCode: WEB,
  signInWithCode: WEB,
  signInPassword: WEB,
  signInWithGoogle: WEB,
  refresh: WEB,
  signOut: WEB,
  securityNotMe: WEB,
  logSecurityEvent: WEB,
  changePassword: WEB,
  requestPasswordReset: WEB,
  resetPassword: WEB,
  enrollTotp: WEB,
  verifyTotp: WEB,
  removeTotp: WEB,
  createBackupCodes: WEB,
  useBackupCode: WEB,
  deleteBackupCodes: WEB,
  acceptAgreement: WEB,
  requestAccountDeletion: WEB,
  cancelAccountDeletion: WEB,
  grantStaffRole: WEB,
  revokeStaffRole: WEB,
  opsResetMfa: WEB,
  sanctionUser: ["trust"],
  liftSanction: ["trust"],
  completeGithubLink: ["work"],
  disconnectGithub: ["work"],
};

/**
 * Who may do what (prd.md, "Who may do what"). The staff-role helpers are identity's (decision 2026-11-25).
 * Each is `private.require_*` ported: staff need the role (or super_admin) and a two-factor session (aal2).
 * The messages are the current ones, so the goldens match.
 */
export type StaffRole = "moderator" | "trust_reviewer" | "accounts" | "super_admin";

export interface Actor {
  id: string | null;
  aal: "aal1" | "aal2";
  /** The actor's staff roles (identity.staff_roles). */
  staffRoles: readonly StaffRole[];
  /** University seats held, for `require_accounts_or_admin` (owner and admin roles only count). */
  universityAdminOf?: readonly { universityId: string; role: string }[];
}

/** `private.is_staff`: aal2, and the role or super_admin (any role when none is named). */
export function isStaff(actor: Actor, role: StaffRole | null = null): boolean {
  return (
    actor.id != null &&
    actor.aal === "aal2" &&
    actor.staffRoles.some((r) => role == null || r === role || r === "super_admin")
  );
}

const require =
  (role: StaffRole | null, reason: string) =>
  (actor: Actor): string => {
    if (!isStaff(actor, role)) throw refuse("not_allowed", reason);
    return actor.id!;
  };

export const requireSuperAdmin = require("super_admin", "super admins only, with two-factor on");
export const requireModerator = require("moderator", "moderators only, with two-factor on");
export const requireTrustReviewer = require("trust_reviewer", "trust reviewers only, with two-factor on");
export const requireAccounts = require("accounts", "accounts staff only, with two-factor on");
export const requireAnyStaff = require(null, "staff only, with two-factor on");

/** `private.require_accounts_or_admin`: accounts staff, or an owner or admin of that university (aal2). */
export function requireAccountsOrAdmin(actor: Actor, universityId: string | null): string {
  const admin =
    universityId != null &&
    actor.aal === "aal2" &&
    (actor.universityAdminOf ?? []).some((s) => s.universityId === universityId && (s.role === "owner" || s.role === "admin"));
  if (!(isStaff(actor, "accounts") || admin)) throw refuse("not_allowed", "accounts staff only, with two-factor on");
  return actor.id!;
}

/** `private.require_appeal_decider`: any staff, holding the appeal's role, who did not make the original decision. */
export function requireAppealDecider(actor: Actor, appeal: { deciderRole: StaffRole; originalStaffId: string }): string {
  const me = requireAnyStaff(actor);
  if (!isStaff(actor, appeal.deciderRole)) throw refuse("not_allowed", "your role can't decide this appeal");
  if (appeal.originalStaffId === me) throw refuse("not_allowed", "you made the original decision, so another staff member must decide this appeal");
  return me;
}
