import type { CallOptions } from "@connectrpc/connect";
import { IdentityService, StaffRole } from "@skilient/contracts/identity/v1/identity_pb";
import { startCall, type ClientFactory } from "@skilient/platform";
import type { StaffRole as Role } from "./authorize";
import type { IdentityPort } from "./deps";
import type { SignupDetails } from "./store/lifecycle";

const ROLE: Partial<Record<StaffRole, Role>> = {
  [StaffRole.MODERATOR]: "moderator",
  [StaffRole.TRUST_REVIEWER]: "trust_reviewer",
  [StaffRole.ACCOUNTS]: "accounts",
  [StaffRole.SUPER_ADMIN]: "super_admin",
};

/** People's calls to identity: one batch call each, never one per user (CLAUDE.md, "Never"). */
export function identityPort(clients: ClientFactory): IdentityPort & { signupDetails(ids: readonly string[]): Promise<SignupDetails> } {
  const client = () => clients.client(IdentityService);
  return {
    async staffRoles(userId, call) {
      const r = await client().staffRolesOf({ userIds: [userId] }, call as CallOptions);
      return (r.users.find((u) => u.userId === userId)?.roles ?? []).map((x) => ROLE[x]).filter((x): x is Role => Boolean(x));
    },
    personalDomains(call) {
      return {
        async personal(domains) {
          if (domains.length === 0) return new Set();
          const r = await client().checkEmailDomains({ domains: [...domains] }, call as CallOptions);
          return new Set(r.domains.filter((d) => d.personal).map((d) => d.domain));
        },
      };
    },
    /** For user.created batches (the consumer's prepare); a call that starts outside any request. */
    async signupDetails(ids) {
      const r = await client().getSignupDetails({ userIds: [...ids] }, startCall());
      return new Map(r.users.map((u) => [u.userId, { fullName: u.fullName, emailDomain: u.emailDomain || null }]));
    },
  };
}
