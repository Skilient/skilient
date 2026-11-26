import type { Logger } from "@skilient/platform";
import type postgres from "postgres";
import type { Fetch, GithubConfig } from "./gh/types";
import type { IdentityPort } from "./identity";
import type { FileLookup } from "./store/credentials";
import type { Tx } from "./store/db";

/**
 * What every work handler module receives. The ports reach other services with one batch call each, never
 * inside a loop (CLAUDE.md, "Never"); `call` carries the request on (call depth 2). Tests pass fakes.
 */
export interface ApiDeps {
  sql: postgres.Sql;
  logger: Logger;
  people: PeoplePort;
  media: MediaPort;
  /** The skills recompute (`recompute_user_skills`) for the given users, in the caller's transaction. */
  recompute(tx: Tx, userIds: readonly string[]): Promise<void>;
  /** The GitHub App and the token key; absent where GitHub isn't configured (connecting then refuses). */
  github?: GithubDeps;
  /** Staff roles (identity's StaffRolesOf). */
  identity: IdentityPort;
  /** What media recorded about an uploaded file (W9); the path rule until then. */
  files?: FileLookup;
}

export interface GithubDeps {
  cfg: GithubConfig;
  /** 32 bytes from Key Vault `work-github-token-key`: seals students' GitHub tokens. */
  tokenKey: Buffer;
  fetch?: Fetch;
}

export interface PeoplePort {
  /** User ids for usernames (people's ResolveUsernames). */
  resolve(usernames: readonly string[], call: unknown): Promise<Map<string, string>>;
}

/** Whether uploaded images exist (media, W9). */
export interface MediaPort {
  missing(paths: readonly string[], call: unknown): Promise<string[]>;
}

/** Until media records files (W9), an image path is checked against the uploader's folder only. */
export const noMediaCheck: MediaPort = { missing: async () => [] };
