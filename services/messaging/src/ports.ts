import type { CallOptions } from "@connectrpc/connect";
import { ContentService } from "@skilient/contracts/content/v1/content_pb";
import { MediaService } from "@skilient/contracts/media/v1/media_pb";
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import type { ClientFactory } from "@skilient/platform";
import { WorkService } from "@skilient/contracts/work/v1/work_pb";
import type { ContentPort, MediaPort, PeoplePort, VenturePort } from "./deps";

/** Chat images in media (W9): who uploaded a stored file (CheckFiles), or null when it isn't stored. */
export function mediaPort(clients: ClientFactory): MediaPort {
  return {
    async uploader(path, call) {
      const r = await clients.client(MediaService).checkFiles({ bucket: "chat-media", paths: [path] }, call as CallOptions);
      const f = r.files.find((x) => x.path === path);
      return f?.stored ? f.ownerId || null : null;
    },
  };
}

/** Messaging's calls to people: one batch call each, never one per user. */
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

/** Team chat titles: work's VentureTitles, one batch call. */
export function venturePort(clients: ClientFactory): VenturePort {
  return {
    async titles(ventureIds, call) {
      if (ventureIds.length === 0) return new Map();
      const r = await clients.client(WorkService).ventureTitles({ ventureIds: [...ventureIds] }, call as CallOptions);
      return new Map(r.ventures.map((v) => [v.ventureId, v.title]));
    },
  };
}

/** Messaging's calls to content: visibility for sharing, and link previews for messages. */
export function contentPort(clients: ClientFactory): ContentPort {
  const client = () => clients.client(ContentService);
  return {
    async visiblePosts(viewerId, postIds, call) {
      const r = await client().visiblePosts({ viewerId, postIds: [...postIds] }, call as CallOptions);
      return new Set(r.posts.filter((p) => p.visible).map((p) => p.postId));
    },
    async linkPreviews(urls, call) {
      const r = await client().linkPreviews({ urls: [...urls] }, call as CallOptions);
      return new Map(r.previews.map((p) => [p.url, { url: p.url, title: p.title, description: p.description, siteName: p.siteName }]));
    },
    async queuePreviews(urls, call) {
      const o = call as CallOptions;
      await client().queueLinkPreviews({ urls: [...urls] }, { ...o, headers: { ...(o.headers as Record<string, string> | undefined), "idempotency-key": crypto.randomUUID() } });
    },
  };
}
