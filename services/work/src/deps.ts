import type { CallOptions } from "@connectrpc/connect";
import { MediaService } from "@skilient/contracts/media/v1/media_pb";
import { startCall, type ClientFactory, type Logger } from "@skilient/platform";
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

/** Without media (tests that don't host it, MEDIA_CHECKS=off), an image path is checked against the uploader's folder only. */
export const noMediaCheck: MediaPort = { missing: async () => [] };

/** Venture update images in media's post-media bucket (W9): the paths media has not stored. */
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

/** A credential's file as media recorded it (W9): owner, type and size; null when it isn't stored. */
export function mediaFileLookup(clients: ClientFactory): FileLookup {
  return async (path) => {
    const r = await clients.client(MediaService).checkFiles({ bucket: "credentials", paths: [path] }, startCall() as CallOptions);
    const f = r.files.find((x) => x.path === path);
    return f?.stored ? { owner: f.ownerId, mimetype: f.mime, bytes: Number(f.bytes) } : null;
  };
}
