import type { User } from "@skilient/platform";
import { refused } from "./refusals";

/** Staff roles as identity's StaffRolesOf returns them. */
export type Role = "moderator" | "trust_reviewer" | "accounts" | "super_admin";

/** `is_staff(role)`: a two-factor session and the role (or super admin). */
export function isStaff(user: User | null, roles: readonly Role[], role: Role): user is User {
  return Boolean(user && user.aal === "aal2" && roles.some((r) => r === role || r === "super_admin"));
}

/** `require_trust_reviewer()`: the CV staff methods (ops_cv_records, ops_revoke_cv). */
export function requireTrustReviewer(user: User | null, roles: readonly Role[]): string {
  if (!isStaff(user, roles, "trust_reviewer")) throw refused("trust_only");
  return user.id;
}

/** Trust reviewers and moderators: the Record's staff lookup and revocation. */
export function isRecordStaff(user: User | null, roles: readonly Role[]): user is User {
  return isStaff(user, roles, "trust_reviewer") || isStaff(user, roles, "moderator");
}
