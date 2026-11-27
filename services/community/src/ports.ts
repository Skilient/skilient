import type { CallOptions } from "@connectrpc/connect";
import { ContentService } from "@skilient/contracts/content/v1/content_pb";
import { IdentityService, StaffRole } from "@skilient/contracts/identity/v1/identity_pb";
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import { RankingService } from "@skilient/contracts/ranking/v1/ranking_pb";
import { headers, type ClientFactory } from "@skilient/platform";
import { wanted, fill as fillDoc, type PersonFacts } from "./domain/people";
import type { Role } from "./identity";
import type { ResolvedEmail } from "./store/checkin";

/**
 * Community's calls to other services: one batch call each, never one per person (CLAUDE.md, "Never"); `call`
 * carries the request on (call depth 2). Tests pass the real services or fakes.
 */
export interface Ports {
  /** Staff roles (identity's StaffRolesOf). */
  staffRoles(userId: string, call: unknown): Promise<Role[]>;
  /** Fills a document's people and university placeholders (people's ProfileCards and ListUniversities). */
  fill<T>(doc: T, call: unknown): Promise<T>;
  /** User ids for usernames (people's ResolveUsernames). */
  resolve(usernames: readonly string[], call: unknown): Promise<Map<string, string>>;
  /** Of these people, those whose name contains the query or username starts with it, by name (people's FilterByName). */
  filterByName(userIds: string[], query: string, limit: number, call: unknown): Promise<string[]>;
  /** The confirmed account holding an address and the universities owning its domain (identity's ResolveEmails). */
  resolveEmail(email: string, call: unknown): Promise<ResolvedEmail>;
  /** Published tiers (ranking's TiersOf), for member and attendee lists. */
  tiers(userIds: readonly string[], call: unknown): Promise<Record<string, string>>;
  /** The event's post, made by content as the officer (content's CreatePost); idempotent per event. */
  eventPost(e: { eventId: string; societyId: string; body: string; startsAt: Date; place: string | null; url: string | null }, call: unknown): Promise<string>;
}

const ROLE: Partial<Record<StaffRole, Role>> = {
  [StaffRole.MODERATOR]: "moderator",
  [StaffRole.TRUST_REVIEWER]: "trust_reviewer",
  [StaffRole.ACCOUNTS]: "accounts",
  [StaffRole.SUPER_ADMIN]: "super_admin",
};

/** University names change rarely: held for ten minutes. */
let universities: { at: number; names: Map<string, string> } | undefined;

export function ports(clients: ClientFactory): Ports {
  const people = () => clients.client(PeopleService);
  const universityNames = async (call: unknown) => {
    if (!universities || Date.now() - universities.at > 600_000) {
      const r = await people().listUniversities({ domain: "" }, call as CallOptions);
      universities = { at: Date.now(), names: new Map(r.universities.map((u) => [u.id, u.name])) };
    }
    return universities.names;
  };
  return {
    async staffRoles(userId, call) {
      const r = await clients.client(IdentityService).staffRolesOf({ userIds: [userId] }, call as CallOptions);
      return (r.users.find((u) => u.userId === userId)?.roles ?? []).map((x) => ROLE[x]).filter((x): x is Role => Boolean(x));
    },
    async fill(doc, call) {
      const w = wanted(doc);
      const [cards, names] = await Promise.all([
        w.users.length ? people().profileCards({ userIds: w.users.slice(0, 500) }, call as CallOptions) : Promise.resolve({ users: [] }),
        w.universities.length ? universityNames(call) : Promise.resolve(new Map<string, string>()),
      ]);
      const facts = new Map<string, PersonFacts>(
        cards.users.map((u) => [
          u.userId,
          { name: u.fullName || null, username: u.username || null, avatar_path: u.avatarPath || null, department: u.department || null, batch: u.graduationYear || null },
        ]),
      );
      return fillDoc(doc, { person: (id) => facts.get(id), university: (id) => names.get(id) });
    },
    async resolve(usernames, call) {
      if (usernames.length === 0) return new Map();
      const r = await people().resolveUsernames({ usernames: [...usernames] }, call as CallOptions);
      return new Map(r.users.map((u) => [u.username, u.userId]));
    },
    async filterByName(userIds, query, limit, call) {
      if (userIds.length === 0) return [];
      return (await people().filterByName({ userIds, query, limit }, call as CallOptions)).userIds;
    },
    async resolveEmail(email, call) {
      const r = await clients.client(IdentityService).resolveEmails({ emails: [email] }, call as CallOptions);
      const e = r.emails.find((x) => x.email === email);
      return { user_id: e?.userId || null, university_ids: e?.universityIds ?? [] };
    },
    async tiers(userIds, call) {
      if (userIds.length === 0) return {};
      const r = await clients.client(RankingService).tiersOf({ userIds: [...userIds].slice(0, 500) }, call as CallOptions);
      return Object.fromEntries(r.tiers.filter((t) => t.tier).map((t) => [t.userId, t.tier]));
    },
    async eventPost(e, call) {
      const options = { ...(call as CallOptions), headers: { [headers.idempotencyKey]: `community-event-post-${e.eventId}` } };
      const r = await clients.client(ContentService).createPost(
        {
          type: "event",
          audience: "university",
          body: e.body,
          societyId: e.societyId,
          event: { startsAt: e.startsAt.toISOString(), place: e.place ?? "", url: e.url ?? "" },
          media: [],
          ventureId: "",
          pinDays: 0,
        },
        options,
      );
      return r.postId;
    },
  };
}
