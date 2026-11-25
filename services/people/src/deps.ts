import type { Logger } from "@skilient/platform";
import type postgres from "postgres";
import type { StaffRole } from "./authorize";
import type { GroupLabels } from "./store/search";
import type { PersonalDomains } from "./store/universities";

/**
 * What every people handler module receives. The ports reach other services: identity (staff roles,
 * personal email domains) and, from W5/W7, work and community (venture and society labels). Tests pass fakes.
 */
export interface ApiDeps {
  sql: postgres.Sql;
  logger: Logger;
  identity: IdentityPort;
  labels: GroupLabels;
}

/** The two identity reads people makes inside a request (one call each, never in a loop). */
export interface IdentityPort {
  /** The acting user's staff roles (StaffRolesOf). `call` carries the request on (depth 2). */
  staffRoles(userId: string, call: unknown): Promise<StaffRole[]>;
  /** Which domains are public email providers' (CheckEmailDomains). */
  personalDomains(call: unknown): PersonalDomains;
}
