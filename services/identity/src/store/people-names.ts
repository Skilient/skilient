import type { CallOptions } from "@connectrpc/connect";
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import type { ClientFactory } from "@skilient/platform";
/**
 * Display names come from `people`, through its batch method (decision 2026-11-25, Q1: `ops_staff` gets names
 * from people). `people` is built in W2, so identity reaches it through this port: tests pass a fake, and
 * until people's contract exists the service uses `noPeopleNames`, which knows no names (the list then
 * sorts by email). One call per list, never one per user (CLAUDE.md, "Never": no call inside a loop).
 */
export interface PeopleNames {
  /** Full names for many users in one call; a user people does not know is missing from the map. */
  namesOf(userIds: readonly string[]): Promise<Map<string, string>>;
}

export const noPeopleNames: PeopleNames = {
  async namesOf() {
    return new Map();
  },
};

/** A fixed map, for tests. */
export function fakePeopleNames(names: Record<string, string>): PeopleNames {
  return {
    async namesOf(userIds) {
      return new Map(userIds.filter((id) => id in names).map((id) => [id, names[id]!]));
    },
  };
}

/**
 * People's batch read (ProfileCards, W2), called once per OpsStaff request with the request carried on
 * (depth 2). If people cannot answer, the list falls back to no names (it then sorts by email) rather than
 * failing the staff page.
 */
export function peopleNamesVia(clients: ClientFactory, call: CallOptions, onError?: (e: unknown) => void): PeopleNames {
  return {
    async namesOf(userIds) {
      if (userIds.length === 0) return new Map();
      try {
        const r = await clients.client(PeopleService).profileCards({ userIds: [...userIds] }, call);
        return new Map(r.users.map((u) => [u.userId, u.fullName]));
      } catch (e) {
        onError?.(e);
        return new Map();
      }
    },
  };
}
