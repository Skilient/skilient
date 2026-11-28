import { create } from "@bufbuild/protobuf";
import type { CallOptions, HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { IdentityService } from "@skilient/contracts/identity/v1/identity_pb";
import {
  CheckFilesRequestSchema,
  CheckFilesResponseSchema,
  CreateUploadRequestSchema,
  CreateUploadResponseSchema,
  DownloadLinksResponseSchema,
  MediaService,
  PutFileRequestSchema,
  PutFileResponseSchema,
  StorageUsageResponseSchema,
} from "@skilient/contracts/media/v1/media_pb";
import { callOf, from, withWrite, type ClientFactory, type Logger } from "@skilient/platform";
import type postgres from "postgres";
import { z } from "zod";
import { refused } from "./refusals";
import type { Store } from "./storage/store";
import * as F from "./store/files";

export interface ApiDeps {
  sql: postgres.Sql;
  logger: Logger;
  store: Store;
  clients: ClientFactory;
  /** storage.quota_bytes (1 GiB on the stack). */
  quotaBytes: number;
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw refused("invalid_input");
  return r.data;
}

const Paths = z.array(z.string().max(200)).min(1).max(50);
const Bucket = z.string().regex(/^[a-z][a-z-]{2,30}$/);

/** A service calling (not web, which calls for a user). */
const isService = (ctx: HandlerContext) => callOf(ctx).caller !== "web";

export function createApi(deps: ApiDeps): ServiceImpl<typeof MediaService> {
  return {
    async createUpload(req, ctx) {
      const me = callOf(ctx).user?.id;
      if (!me) throw refused("not_signed_in");
      const r = parse(z.object({ bucket: Bucket, mime: z.string().max(40), bytes: z.number().int(), folder: z.string().max(80) }), {
        bucket: req.bucket,
        mime: req.mime,
        bytes: Number(req.bytes),
        folder: req.folder,
      });
      return withWrite(
        ctx,
        deps.sql,
        { input: CreateUploadRequestSchema, output: CreateUploadResponseSchema },
        req,
        async (tx) => {
          const u = await F.createUpload(tx, deps.store, me, { ...r, folder: r.folder || null });
          return create(CreateUploadResponseSchema, { path: u.path, url: u.url, headers: u.headers, expiresAt: new Date(u.expiresAt).toISOString() });
        },
        { storeReply: false },
      );
    },
    async putFile(req, ctx) {
      const r = parse(z.object({ bucket: Bucket, path: z.string().max(200), owner: z.uuid().nullable(), mime: z.string().max(40) }), {
        bucket: req.bucket,
        path: req.path,
        owner: req.ownerId || null,
        mime: req.mime,
      });
      return withWrite(
        ctx,
        deps.sql,
        { input: PutFileRequestSchema, output: PutFileResponseSchema },
        req,
        async (tx) => {
          await F.putFile(tx, deps.store, { ...r, data: req.data });
          return create(PutFileResponseSchema);
        },
        { storeReply: false },
      );
    },
    async checkFiles(req, ctx) {
      const bucket = parse(Bucket, req.bucket);
      const paths = parse(Paths, req.paths);
      return withWrite(
        ctx,
        deps.sql,
        { input: CheckFilesRequestSchema, output: CheckFilesResponseSchema },
        req,
        async (tx) => {
          const files = await F.checkFiles(tx, deps.store, bucket, paths, deps.logger);
          return create(CheckFilesResponseSchema, { files: files.map((f) => ({ path: f.path, stored: f.stored, ownerId: f.owner ?? "", mime: f.mime, bytes: BigInt(f.bytes) })) });
        },
        { storeReply: false },
      );
    },
    async downloadLinks(req, ctx) {
      const bucket = parse(Bucket, req.bucket);
      const paths = parse(Paths, req.paths);
      const ttl = req.ttlSeconds === 0 ? 600 : parse(z.number().int().min(60).max(3600), req.ttlSeconds);
      const reader = isService(ctx) ? ({ service: true } as const) : { user: callOf(ctx).user?.id ?? null };
      const links = await F.downloadLinks(deps.sql, deps.store, bucket, paths, reader, ttl);
      return create(DownloadLinksResponseSchema, { links });
    },
    async storageUsage(_req, ctx) {
      const user = callOf(ctx).user;
      if (!user || user.aal !== "aal2") throw refused("staff_only");
      const r = await deps.clients.client(IdentityService).staffRolesOf({ userIds: [user.id] }, from(ctx) as CallOptions);
      if (!(r.users.find((u) => u.userId === user.id)?.roles.length ?? 0)) throw refused("staff_only");
      const buckets = await F.storageUsage(deps.sql);
      return create(StorageUsageResponseSchema, { buckets: buckets.map((b) => ({ bucket: b.bucket, objects: BigInt(b.objects), bytes: BigInt(b.bytes) })), quotaBytes: BigInt(deps.quotaBytes) });
    },
  };
}
