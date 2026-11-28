import type { CallOptions } from "@connectrpc/connect";
import { CommunityService } from "@skilient/contracts/community/v1/community_pb";
import { IdentityService, StaffRole } from "@skilient/contracts/identity/v1/identity_pb";
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import { RankingService } from "@skilient/contracts/ranking/v1/ranking_pb";
import { WorkService } from "@skilient/contracts/work/v1/work_pb";
import type { ClientFactory } from "@skilient/platform";
import { fill as fillDoc, wanted, type PersonFacts as PlaceholderFacts } from "./domain/people";
import type { Role } from "./identity";

/** What people's ProfileCards says about one account. */
export interface Profile {
  name: string;
  username: string;
  universityId: string;
  university: string;
  department: string | null;
  year: number | null;
  role: string;
  onboardingComplete: boolean;
  leaderboardOptOut: boolean;
}

export interface Account {
  email: string;
  confirmed: boolean;
  banned: boolean;
}

export interface Tier {
  tier: string | null;
  ranked: boolean;
  percentile: number | null;
}

export interface RecordFacts {
  events: Map<string, { title: string; societyId: string }>;
  terms: Map<string, { title: string; societyId: string }>;
  /** `${event_id}:${user_id}` → label. */
  labels: Map<string, string>;
  walkIns: Map<string, string>;
  societies: Map<string, { name: string; slug: string; logoPath: string | null; status: string }>;
}

/**
 * Credentials' calls to other services: one batch call each, never one per person (CLAUDE.md, "Never"); `call`
 * carries the request on (call depth 2), or is a root call from a consumer or a job (`startCall`). Tests pass the
 * real services or fakes.
 */
export interface Ports {
  /** Staff roles (identity's StaffRolesOf). */
  staffRoles(userId: string, call: unknown): Promise<Role[]>;
  /** Fills a document's people and university placeholders (people's ProfileCards and ListUniversities). */
  fill<T>(doc: T, call: unknown): Promise<T>;
  /** People's facts for accounts (people's ProfileCards). */
  profiles(userIds: readonly string[], call: unknown): Promise<Map<string, Profile>>;
  /** Addresses, whether confirmed, and bans in force (identity's EmailsOf). */
  accounts(userIds: readonly string[], call: unknown): Promise<Map<string, Account>>;
  /** The confirmed account holding each address (identity's ResolveEmails; at most 50). */
  resolveEmails(emails: readonly string[], call: unknown): Promise<Map<string, string | null>>;
  /** Published tiers and percentiles (ranking's TiersOf). */
  tiers(userIds: readonly string[], call: unknown): Promise<Map<string, Tier>>;
  /** A student's verified work as the CV shows it (work's CvFacts). */
  workFacts(userId: string, call: unknown): Promise<Record<string, unknown>>;
  /** Venture titles (work's VentureTitles). */
  ventureTitles(ventureIds: readonly string[], call: unknown): Promise<Map<string, string>>;
  /** Titles, labels, walk-ins' addresses and society names (community's RecordFacts). */
  recordFacts(q: { eventIds?: readonly string[]; termIds?: readonly string[]; attendeeIds?: readonly string[]; societyIds?: readonly string[] }, call: unknown): Promise<RecordFacts>;
  /** Users with a block either way with `userId` (people's Relations). */
  blocked(userId: string, others: readonly string[], call: unknown): Promise<Set<string>>;
  /** User ids for usernames (people's ResolveUsernames). */
  resolveUsernames(usernames: readonly string[], call: unknown): Promise<Map<string, string>>;
}

/** Files are media's (W9): a PDF's size if it is stored, putting one, and letting one go. */
export interface Files {
  size(path: string): Promise<number | null>;
  put(path: string, bytes: Uint8Array): Promise<void>;
}

/** The render job's Chromium (jobs/render, W13): HTML in, PDF bytes out. */
export interface Renderer {
  render(kind: "cv" | "certificate" | "transcript", document: Record<string, unknown>, options: { template: string; paper: string }): Promise<Uint8Array>;
}

/** Until media (W9) records files, nothing is stored and no export can be recorded. */
export const noFiles: Files = {
  size: async () => null,
  put: async () => {
    throw new Error("files are media's (W9)");
  },
};
export const noRenderer: Renderer = {
  render: async () => {
    throw new Error("the render job's Chromium image is W13");
  },
};

const ROLE: Partial<Record<StaffRole, Role>> = {
  [StaffRole.MODERATOR]: "moderator",
  [StaffRole.TRUST_REVIEWER]: "trust_reviewer",
  [StaffRole.ACCOUNTS]: "accounts",
  [StaffRole.SUPER_ADMIN]: "super_admin",
};

let universities: { at: number; names: Map<string, string> } | undefined;
const opt = (call: unknown) => call as CallOptions;
const ids = (xs: readonly string[]) => [...new Set(xs)].slice(0, 500);

export function ports(clients: ClientFactory): Ports {
  const people = () => clients.client(PeopleService);
  const universityNames = async (call: unknown) => {
    if (!universities || Date.now() - universities.at > 600_000) {
      const r = await people().listUniversities({ domain: "" }, opt(call));
      universities = { at: Date.now(), names: new Map(r.universities.map((u) => [u.id, u.name])) };
    }
    return universities.names;
  };
  return {
    async staffRoles(userId, call) {
      const r = await clients.client(IdentityService).staffRolesOf({ userIds: [userId] }, opt(call));
      return (r.users.find((u) => u.userId === userId)?.roles ?? []).map((x) => ROLE[x]).filter((x): x is Role => Boolean(x));
    },
    async fill(doc, call) {
      const w = wanted(doc);
      const [cards, names] = await Promise.all([
        w.users.length ? people().profileCards({ userIds: w.users.slice(0, 500) }, opt(call)) : Promise.resolve({ users: [] }),
        w.universities.length ? universityNames(call) : Promise.resolve(new Map<string, string>()),
      ]);
      const facts = new Map<string, PlaceholderFacts>(
        cards.users.map((u) => [
          u.userId,
          { name: u.fullName || null, username: u.username || null, avatar_path: u.avatarPath || null, department: u.department || null, batch: u.graduationYear || null },
        ]),
      );
      return fillDoc(doc, { person: (id) => facts.get(id), university: (id) => names.get(id) });
    },
    async profiles(userIds, call) {
      if (userIds.length === 0) return new Map();
      const r = await people().profileCards({ userIds: ids(userIds) }, opt(call));
      return new Map(
        r.users.map((u) => [
          u.userId,
          {
            name: u.fullName,
            username: u.username,
            universityId: u.universityId,
            university: u.universityName,
            department: u.department || null,
            year: u.graduationYear || null,
            role: u.role,
            onboardingComplete: u.onboardingComplete,
            leaderboardOptOut: u.leaderboardOptOut,
          },
        ]),
      );
    },
    async accounts(userIds, call) {
      if (userIds.length === 0) return new Map();
      const r = await clients.client(IdentityService).emailsOf({ userIds: ids(userIds) }, opt(call));
      return new Map(r.users.map((u) => [u.userId, { email: u.email, confirmed: u.confirmed, banned: u.banned }]));
    },
    async resolveEmails(emails, call) {
      if (emails.length === 0) return new Map();
      const r = await clients.client(IdentityService).resolveEmails({ emails: [...new Set(emails)].slice(0, 50) }, opt(call));
      return new Map(r.emails.map((e) => [e.email, e.userId || null]));
    },
    async tiers(userIds, call) {
      if (userIds.length === 0) return new Map();
      const r = await clients.client(RankingService).tiersOf({ userIds: ids(userIds) }, opt(call));
      return new Map(r.tiers.map((t) => [t.userId, { tier: t.tier || null, ranked: t.ranked, percentile: t.percentile ?? null }]));
    },
    async workFacts(userId, call) {
      const r = await clients.client(WorkService).cvFacts({ userId }, opt(call));
      return JSON.parse(r.json) as Record<string, unknown>;
    },
    async ventureTitles(ventureIds, call) {
      if (ventureIds.length === 0) return new Map();
      const r = await clients.client(WorkService).ventureTitles({ ventureIds: ids(ventureIds) }, opt(call));
      return new Map(r.ventures.map((v) => [v.ventureId, v.title]));
    },
    async recordFacts(q, call) {
      const r = await clients.client(CommunityService).recordFacts(
        {
          eventIds: [...new Set(q.eventIds ?? [])].slice(0, 200),
          termIds: [...new Set(q.termIds ?? [])].slice(0, 200),
          attendeeIds: [...new Set(q.attendeeIds ?? [])].slice(0, 200),
          societyIds: [...new Set(q.societyIds ?? [])].slice(0, 200),
        },
        opt(call),
      );
      return {
        events: new Map(r.events.map((e) => [e.id, { title: e.title, societyId: e.societyId }])),
        terms: new Map(r.terms.map((t) => [t.id, { title: t.title, societyId: t.societyId }])),
        labels: new Map(r.labels.map((l) => [`${l.eventId}:${l.userId}`, l.label])),
        walkIns: new Map(r.walkIns.map((w) => [w.attendeeId, w.email])),
        societies: new Map(r.societies.map((s) => [s.id, { name: s.name, slug: s.slug, logoPath: s.logoPath || null, status: s.status }])),
      };
    },
    async blocked(userId, others, call) {
      if (others.length === 0) return new Set();
      const r = await people().relations({ userId, otherIds: ids(others) }, opt(call));
      return new Set(r.others.filter((o) => o.blocked).map((o) => o.otherId));
    },
    async resolveUsernames(usernames, call) {
      if (usernames.length === 0) return new Map();
      const r = await people().resolveUsernames({ usernames: [...usernames] }, opt(call));
      return new Map(r.users.map((u) => [u.username, u.userId]));
    },
  };
}
