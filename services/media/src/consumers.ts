import { appendEvents, createConsumer, type Consumer, type LoggedEvent, type Logger } from "@skilient/platform";
import type postgres from "postgres";
import { z } from "zod";
import { release, releaseOwner, type Tx } from "./store/files";

/**
 * Media's consumer: files other services no longer use (the stack's cleanup triggers: avatar_cleanup,
 * post_media_cleanup, post_removed_cleanup, chat_media_cleanup, credential_file_cleanup, society_files_cleanup,
 * event_cover_cleanup, the receipts' 90-day purge and cv_exports_daily), and account deletion.
 *
 * | Event (v1)               | From        | Bucket                         | Effect                                      |
 * | ------------------------ | ----------- | ------------------------------ | ------------------------------------------- |
 * | profile.image_replaced   | people      | avatars or covers              | the old photo goes                          |
 * | post.removed             | content     | post-media                     | the post's images go                        |
 * | message.deleted          | messaging   | chat-media                     | the message's image goes                    |
 * | credential.changed       | work        | credentials                    | the file goes (deleted, file_removed)       |
 * | community_file.released  | community   | society-documents/-media, event-receipts | the released file goes            |
 * | cv_export.released       | credentials | cv-exports                     | the PDF goes after 30 days                  |
 * | user.deleted             | identity    | every bucket people own        | their files go; user.deletion_confirmed     |
 */
export const MEDIA_CONSUMER = "media.files";
export const MEDIA_EVENTS = ["profile.image_replaced", "post.removed", "message.deleted", "credential.changed", "community_file.released", "cv_export.released", "user.deleted"] as const;

const OWNER: Record<(typeof MEDIA_EVENTS)[number], string> = {
  "profile.image_replaced": "svc_people",
  "post.removed": "svc_content",
  "message.deleted": "svc_messaging",
  "credential.changed": "svc_work",
  "community_file.released": "svc_community",
  "cv_export.released": "svc_credentials",
  "user.deleted": "svc_identity",
};

export type Outcome = "applied" | "ignored" | "wrong_producer" | "invalid_payload" | "unknown_type";
type Event = Pick<LoggedEvent, "type" | "producer" | "payload" | "version" | "subjects">;

const paths = z.array(z.string().max(200)).max(50);
const S = {
  image: z.object({ kind: z.enum(["avatar", "cover"]), old_path: z.string().max(200) }),
  post: z.object({ media_paths: paths.optional() }),
  message: z.object({ media_paths: paths.optional() }),
  credential: z.object({ status: z.string(), file_path: z.string().max(200).nullable().optional() }),
  released: z.object({ bucket: z.string(), path: z.string().max(200) }),
};
const COMMUNITY_BUCKETS = new Set(["society-documents", "society-media", "event-receipts"]);

/** Applies one event (the consumer's handler; exported for tests). */
export async function applyMediaEvent(tx: Tx, event: Event, logger?: Logger): Promise<Outcome> {
  if (event.version !== 1) return "invalid_payload";
  const owner = OWNER[event.type as keyof typeof OWNER];
  if (!owner) return "unknown_type";
  if (owner !== event.producer) return "wrong_producer";
  const parse = <T>(s: z.ZodType<T>) => {
    const r = s.safeParse(event.payload);
    return r.success ? r.data : null;
  };
  switch (event.type) {
    case "profile.image_replaced": {
      const p = parse(S.image);
      if (!p) return "invalid_payload";
      await release(tx, p.kind === "avatar" ? "avatars" : "covers", [p.old_path], logger);
      return "applied";
    }
    case "post.removed": {
      const p = parse(S.post);
      if (!p) return "invalid_payload";
      if (!p.media_paths?.length) return "ignored";
      await release(tx, "post-media", p.media_paths, logger);
      return "applied";
    }
    case "message.deleted": {
      const p = parse(S.message);
      if (!p) return "invalid_payload";
      if (!p.media_paths?.length) return "ignored";
      await release(tx, "chat-media", p.media_paths, logger);
      return "applied";
    }
    case "credential.changed": {
      const p = parse(S.credential);
      if (!p) return "invalid_payload";
      if (!p.file_path || (p.status !== "deleted" && p.status !== "file_removed")) return "ignored";
      await release(tx, "credentials", [p.file_path], logger);
      return "applied";
    }
    case "community_file.released": {
      const p = parse(S.released);
      if (!p || !COMMUNITY_BUCKETS.has(p.bucket)) return "invalid_payload";
      await release(tx, p.bucket, [p.path], logger);
      return "applied";
    }
    case "cv_export.released": {
      const p = parse(S.released);
      if (!p || p.bucket !== "cv-exports") return "invalid_payload";
      await release(tx, "cv-exports", [p.path], logger);
      return "applied";
    }
    case "user.deleted": {
      const user = event.subjects[0] ?? (typeof event.payload["user_id"] === "string" ? event.payload["user_id"] : null);
      if (!user || !z.uuid().safeParse(user).success) return "invalid_payload";
      await releaseOwner(tx, user, logger);
      await appendEvents(tx, [{ type: "user.deletion_confirmed", subjects: [user], payload: { user_id: user } }]);
      return "applied";
    }
    default:
      return "unknown_type";
  }
}

export function mediaConsumer(options: { sql: postgres.Sql; logger?: Logger; pollMs?: number }): Consumer {
  return createConsumer({
    sql: options.sql,
    name: MEDIA_CONSUMER,
    types: MEDIA_EVENTS,
    pollMs: options.pollMs,
    logger: options.logger,
    handle: async (tx, event) => {
      const outcome = await applyMediaEvent(tx, event, options.logger);
      if (outcome !== "applied" && outcome !== "ignored") options.logger?.warn("media.skipped", { action: `consume.${event.type}`, outcome: "skipped", error_code: outcome });
    },
  });
}
