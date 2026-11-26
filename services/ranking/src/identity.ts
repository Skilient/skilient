import type { CallOptions } from "@connectrpc/connect";
import { IdentityService, StaffRole } from "@skilient/contracts/identity/v1/identity_pb";
import type { ClientFactory, User } from "@skilient/platform";
import { refused } from "./refusals";

/** Staff roles as identity's StaffRolesOf returns them. */
export type Role = "moderator" | "trust_reviewer" | "accounts" | "super_admin";

const ROLE: Partial<Record<StaffRole, Role>> = {
  [StaffRole.MODERATOR]: "moderator",
  [StaffRole.TRUST_REVIEWER]: "trust_reviewer",
  [StaffRole.ACCOUNTS]: "accounts",
  [StaffRole.SUPER_ADMIN]: "super_admin",
};

export interface IdentityPort {
  /** The acting user's staff roles (StaffRolesOf); one call per request. */
  staffRoles(userId: string, call: unknown): Promise<Role[]>;
}

export function identityPort(clients: ClientFactory): IdentityPort {
  const client = () => clients.client(IdentityService);
  return {
    async staffRoles(userId, call) {
      const r = await client().staffRolesOf({ userIds: [userId] }, call as CallOptions);
      return (r.users.find((u) => u.userId === userId)?.roles ?? []).map((x) => ROLE[x]).filter((x): x is Role => Boolean(x));
    },
  };
}

/** `is_staff(role)`: a two-factor session and the role (or super admin). */
function staff(user: User | null, roles: readonly Role[], role: Role): user is User {
  return Boolean(user && user.aal === "aal2" && roles.some((r) => r === role || r === "super_admin"));
}

/** `require_trust_reviewer()`: every ranking-flag method checks it, then audits before and after. */
export function requireTrustReviewer(user: User | null, roles: readonly Role[]): string {
  if (!staff(user, roles, "trust_reviewer")) throw refused("trust_only");
  return user.id;
}

/** `require_accounts()`: the exam-period methods. */
export function requireAccounts(user: User | null, roles: readonly Role[]): string {
  if (!staff(user, roles, "accounts")) throw refused("accounts_only");
  return user.id;
}
