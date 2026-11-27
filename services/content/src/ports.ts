import type { CallOptions } from "@connectrpc/connect";
import { CommunityService } from "@skilient/contracts/community/v1/community_pb";
import { IdentityService } from "@skilient/contracts/identity/v1/identity_pb";
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import { startCall, type ClientFactory } from "@skilient/platform";
import { WorkService } from "@skilient/contracts/work/v1/work_pb";
import type { IdentityPort, PeoplePort, SocietyPort, VenturePort } from "./deps";
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
export function shippedNames(people: PeoplePort, clients: ClientFactory): ShippedNamesPort {
  return async (owners, ventures) => {
    const [cards, titles] = await Promise.all([
      people.cards(owners, startCall()),
      ventures.length ? clients.client(WorkService).ventureTitles({ ventureIds: [...ventures] }, startCall() as CallOptions) : Promise.resolve({ ventures: [] }),
    ]);
    return { owners: new Map([...cards].map(([id, c]) => [id, c.fullName])), titles: new Map(titles.ventures.map((v) => [v.ventureId, v.title])) };
  };
}

/**
 * The venture block on invite and Shipped cards (post_cards' `venture`), from work's VentureCards as the viewer
 * sees it. Team members come as ids; `cards` resolves their names in its own people call (call depth two).
 */
export function venturePort(clients: ClientFactory): VenturePort {
  return {
    async cards(viewerId, ventureIds, call) {
      const r = await clients.client(WorkService).ventureCards({ viewerId: viewerId ?? "", ventureIds: [...ventureIds] }, call as CallOptions);
      return new Map(
        r.cards.map((c) => [
          c.id,
          {
            id: c.id,
            title: c.title,
            type: c.type,
            status: c.status,
            visibility: c.visibility,
            members: c.members,
            team_size: c.teamSize,
            is_member: c.isMember,
            my_application: c.myApplication || null,
            roles: c.roles.map((x) => ({ title: x.title, open: x.open })),
            team_ids: c.team.map((m) => ({ user_id: m.userId, profile_visible: m.profileVisible })),
          },
        ]),
      );
    },
  };
}

/** The society block on society posts (post_cards' `society`: id, name, slug, logo), from community's SocietyCards (W7). */
export function societyPort(clients: ClientFactory): SocietyPort {
  return {
    async cards(societyIds, call) {
      // The byline is a decoration: if community can't answer, cards show the post without it.
      const r = await (async () => clients.client(CommunityService).societyCards({ societyIds: [...societyIds] }, call as CallOptions))().catch(() => ({ cards: [] }));
      return new Map(r.cards.map((c) => [c.id, { id: c.id, name: c.name, slug: c.slug, logo_path: c.logoPath || null }]));
    },
  };
}
