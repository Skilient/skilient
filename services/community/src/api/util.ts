import { create, type DescMessage, type MessageInitShape, type MessageShape } from "@bufbuild/protobuf";
import type { HandlerContext } from "@connectrpc/connect";
import { callOf, from, refuseIfRestricted, withWrite, type Logger } from "@skilient/platform";
import type postgres from "postgres";
import { z } from "zod";
import { isStaff, requireTrustReviewer } from "../identity";
import type { Ports } from "../ports";
import { refused } from "../refusals";
import type { Filler, StaffCheck } from "../store/db";
import type { Files } from "../store/societies";
import type { Tickets } from "../store/tickets";

/**
 * What every community handler module receives. The ports reach other services with one batch call each, never
 * inside a loop (CLAUDE.md, "Never"). Tests pass the real services, a test ticket key and a media fake.
 */
export interface ApiDeps {
  sql: postgres.Sql;
  logger: Logger;
  ports: Ports;
  tickets: Tickets;
  /** Whether an uploaded file exists in media (W9); the path rule until then. */
  files: Files;
}

/** Validates input with zod; any failure is one typed refusal (no details echoed back). */
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw refused("invalid_input");
  return r.data;
}

export const Uuid = z.uuid();
export const OptionalUuid = z.union([z.literal(""), z.uuid()]);
export const Text = (max: number) => z.string().max(max);
export const opt = (s: string) => (s === "" ? null : s);
export const optId = (s: string) => parse(OptionalUuid, s) || null;
export const id = (s: string) => parse(Uuid, s);

/** The signed-in user's id, or null. */
export const meOf = (ctx: HandlerContext): string | null => callOf(ctx).user?.id ?? null;
/** The token's restriction, as refuse_if_restricted did on community's tables. */
export const restricted = (ctx: HandlerContext) => refuseIfRestricted(callOf(ctx).user);
/** Call options that carry this request on to another service (depth 2). */
export const onward = (ctx: HandlerContext) => from(ctx);

/** One write: idempotency key, one transaction with its events, the body's reply built with create(). */
export function write<I extends DescMessage, O extends DescMessage>(
  deps: ApiDeps,
  ctx: HandlerContext,
  input: I,
  output: O,
  req: MessageShape<I>,
  body: (tx: postgres.TransactionSql) => Promise<MessageInitShape<O>>,
  options: { storeReply?: boolean } = {},
): Promise<MessageShape<O>> {
  return withWrite(ctx, deps.sql, { input, output }, req, async (tx) => create(output, await body(tx)), options);
}

export const json = (v: unknown) => JSON.stringify(v);

/** The filler for one request: people's batch reads, carried on from this call. */
export const filler = (deps: ApiDeps, ctx: HandlerContext): Filler => (doc) => deps.ports.fill(doc, onward(ctx));

/** Trust reviewers and moderators see pending societies; asked of identity only when needed. */
export const staffCheck = (deps: ApiDeps, ctx: HandlerContext): StaffCheck => async () => {
  const user = callOf(ctx).user;
  if (!user || user.aal !== "aal2") return false;
  const roles = await deps.ports.staffRoles(user.id, onward(ctx));
  return isStaff(user, roles, "trust_reviewer") || isStaff(user, roles, "moderator");
};

/** `require_trust_reviewer()`: one identity call per staff request. */
export async function trust(deps: ApiDeps, ctx: HandlerContext): Promise<string> {
  const user = callOf(ctx).user;
  const roles = user && user.aal === "aal2" ? await deps.ports.staffRoles(user.id, onward(ctx)) : [];
  return requireTrustReviewer(user, roles);
}

/** The user ids on a document's people lists (for ranking's TiersOf). */
export function userIdsIn(doc: unknown): string[] {
  const out = new Set<string>();
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        if (k === "user_id" && typeof x === "string") out.add(x);
        else walk(x);
      }
    }
  };
  walk(doc);
  return [...out];
}

export const dateOrNull = (s: string) => (s === "" ? null : s);
