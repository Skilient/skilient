import type { Logger } from "@skilient/platform";
import type postgres from "postgres";

/**
 * What every messaging handler module receives. The ports reach other services with one batch call each,
 * never inside a loop; `call` carries the request on (call depth 2). Tests pass fakes.
 */
export interface ApiDeps {
  sql: postgres.Sql;
  logger: Logger;
  people: PeoplePort;
  content: ContentPort;
  ventures: VenturePort;
  /** Chat images (media, W9); absent where media isn't hosted (tests with MEDIA_CHECKS=off): the path rule only. */
  media?: MediaPort;
}

/** Chat images in media's chat-media bucket: stored, and uploaded by whom. */
export interface MediaPort {
  uploader(path: string, call: unknown): Promise<string | null>;
}

export interface PersonCard {
  username: string;
  fullName: string;
  avatarPath: string;
}

export interface PeoplePort {
  /** Names, usernames and avatars (people's ProfileCards). */
  cards(userIds: readonly string[], call: unknown): Promise<Map<string, PersonCard>>;
  /** User ids for usernames (people's ResolveUsernames). */
  resolve(usernames: readonly string[], call: unknown): Promise<Map<string, string>>;
}

export interface LinkPreview {
  url: string;
  title: string;
  description: string;
  siteName: string;
}

export interface ContentPort {
  /** Which posts the user may see (content's VisiblePosts). */
  visiblePosts(viewerId: string, postIds: readonly string[], call: unknown): Promise<Set<string>>;
  /** Cached previews for links in messages (content's LinkPreviews). */
  linkPreviews(urls: readonly string[], call: unknown): Promise<Map<string, LinkPreview>>;
  /** Asks content to fetch a link's preview (content's QueueLinkPreviews). */
  queuePreviews(urls: readonly string[], call: unknown): Promise<void>;
}

/** Venture titles for team chats (work's batch read, W5). */
export interface VenturePort {
  titles(ventureIds: readonly string[], call: unknown): Promise<Map<string, string>>;
}

/** Until work serves its batch read (W5), a team chat is titled "Venture chat". */
export const noVentureTitles: VenturePort = { titles: async () => new Map() };
