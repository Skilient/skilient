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

/**
 * `require_trust_reviewer()` (`is_staff('trust_reviewer')`): a two-factor session and the trust reviewer role (or
 * super admin). Every staff method of work checks this, then audits before and after.
 */
export function requireTrustReviewer(user: User | null, roles: readonly Role[]): string {
  if (!user || user.aal !== "aal2" || !roles.some((r) => r === "trust_reviewer" || r === "super_admin")) throw refused("trust_only");
  return user.id;
}
