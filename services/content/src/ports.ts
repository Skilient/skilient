import type { CallOptions } from "@connectrpc/connect";
import { IdentityService } from "@skilient/contracts/identity/v1/identity_pb";
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import { startCall, type ClientFactory } from "@skilient/platform";
import type { IdentityPort, PeoplePort } from "./deps";
import type { ShippedNamesPort } from "./store/copies";

/** Content's calls to people: one batch call each, never one per user (CLAUDE.md, "Never"). */
export function peoplePort(clients: ClientFactory): PeoplePort {
  const client = () => clients.client(PeopleService);
  return {
    async cards(userIds, call) {
      if (userIds.length === 0) return new Map();
      const r = await client().profileCards({ userIds: [...userIds] }, call as CallOptions);
      return new Map(r.users.map((u) => [u.userId, { username: u.username, fullName: u.fullName, avatarPath: u.avatarPath }]));
    },
    async resolve(usernames, call) {
      if (usernames.length === 0) return new Map();
      const r = await client().resolveUsernames({ usernames: [...usernames] }, call as CallOptions);
      return new Map(r.users.map((u) => [u.username, u.userId]));
    },
  };
}

/** Content's call to identity: the poster's staff roles (staff announcements). */
export function identityPort(clients: ClientFactory): IdentityPort {
  return {
    async isStaff(userId, call) {
      const r = await clients.client(IdentityService).staffRolesOf({ userIds: [userId] }, call as CallOptions);
      return (r.users.find((u) => u.userId === userId)?.roles.length ?? 0) > 0;
    },
  };
}

/**
 * Names for Shipped posts (venture.completed batches): the owners' names from people. Venture titles come from
 * work's batch read once work serves it (W5); until then no title is known, so the event is logged and skipped
 * (work publishes no venture.completed before W5).
 */
export function shippedNames(people: PeoplePort): ShippedNamesPort {
  return async (owners) => {
    const cards = await people.cards(owners, startCall());
    return { owners: new Map([...cards].map(([id, c]) => [id, c.fullName])), titles: new Map() };
  };
}
