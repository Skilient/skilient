import type { CallOptions } from "@connectrpc/connect";
import { MediaService } from "@skilient/contracts/media/v1/media_pb";
import type { ClientFactory, Logger } from "@skilient/platform";
import type postgres from "postgres";
import type { Config } from "./domain/config";
import type { PoolCache } from "./store/pool";

/**
 * What every content handler module receives. The ports reach other services with one batch call each,
 * never inside a loop (CLAUDE.md, "Never"); `call` carries the request on (call depth 2). Tests pass fakes.
 */
export interface ApiDeps {
  sql: postgres.Sql;
  logger: Logger;
  people: PeoplePort;
  identity: IdentityPort;
  ventures: VenturePort;
  societies: SocietyPort;
  media: MediaPort;
  /** Settings, read from content.config (cached briefly by the service). */
  config(): Promise<Config>;
  /** The feed's candidate pools, held for 60 s per audience (docs/azure/prd.md, "Hot paths"). */
  pools: PoolCache;
}

export interface PersonCard {
  username: string;
  fullName: string;
  avatarPath: string;
}

export interface PeoplePort {
  /** Names, usernames and avatars for user ids (people's ProfileCards). */
  cards(userIds: readonly string[], call: unknown): Promise<Map<string, PersonCard>>;
  /** User ids for usernames (people's ResolveUsernames), for @mentions. */
  resolve(usernames: readonly string[], call: unknown): Promise<Map<string, string>>;
}

export interface IdentityPort {
  /** Whether the user holds any staff role (identity's StaffRolesOf). */
  isStaff(userId: string, call: unknown): Promise<boolean>;
}

/** The venture block on invite and Shipped cards (work's batch read, W5). */
export interface VenturePort {
  cards(viewerId: string | null, ventureIds: readonly string[], call: unknown): Promise<Map<string, unknown>>;
}

/** The society block on society posts (community's batch read, W7). */
export interface SocietyPort {
  cards(societyIds: readonly string[], call: unknown): Promise<Map<string, unknown>>;
}

/** Whether uploaded images exist (media, W9). */
export interface MediaPort {
  missing(paths: readonly string[], call: unknown): Promise<string[]>;
}

/** For tests that run without work or community: cards carry no venture or society block. */
export const noVentures: VenturePort = { cards: async () => new Map() };
export const noSocieties: SocietyPort = { cards: async () => new Map() };
/** Without media (tests that don't host it, MEDIA_CHECKS=off), an image path is checked against the uploader's folder only. */
export const noMediaCheck: MediaPort = { missing: async () => [] };

/** Post images in media's post-media bucket (W9): the paths media has not stored. */
export function mediaPort(clients: ClientFactory): MediaPort {
  return {
    async missing(paths, call) {
      if (paths.length === 0) return [];
      const r = await clients.client(MediaService).checkFiles({ bucket: "post-media", paths: [...paths] }, call as CallOptions);
      const stored = new Set(r.files.filter((f) => f.stored).map((f) => f.path));
      return paths.filter((p) => !stored.has(p));
    },
  };
}
