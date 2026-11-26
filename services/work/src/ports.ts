import type { CallOptions } from "@connectrpc/connect";
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import type { ClientFactory } from "@skilient/platform";
import type { PeoplePort } from "./deps";

/** Work's calls to people: one batch call each, never one per user. */
export function peoplePort(clients: ClientFactory): PeoplePort {
  const client = () => clients.client(PeopleService);
  return {
    async resolve(usernames, call) {
      if (usernames.length === 0) return new Map();
      const r = await client().resolveUsernames({ usernames: [...usernames] }, call as CallOptions);
      return new Map(r.users.map((u) => [u.username, u.userId]));
    },
  };
}
