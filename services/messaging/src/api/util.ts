import type { DescMessage, MessageShape } from "@bufbuild/protobuf";
import type { HandlerContext } from "@connectrpc/connect";
import { callOf, from, refuseIfRestricted, withWrite } from "@skilient/platform";
import type postgres from "postgres";
import { z } from "zod";
import type { ApiDeps } from "../deps";
import { refused } from "../refusals";

/** Validates input with zod; any failure is one typed refusal (no details echoed back). */
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw refused("invalid_input");
  return r.data;
}

/** The signed-in user's id, or null. */
export const meOf = (ctx: HandlerContext): string | null => callOf(ctx).user?.id ?? null;

/** The token's restriction, as refuse_if_restricted did on messaging's tables. */
export const restrictedOf = (ctx: HandlerContext) => () => refuseIfRestricted(callOf(ctx).user);

/** Call options that carry this request on to another service (depth 2). */
export const onward = (ctx: HandlerContext) => from(ctx);

/** One write: idempotency key, one transaction with its events (withWrite), the body's typed reply. */
export function write<I extends DescMessage, O extends DescMessage>(
  deps: ApiDeps,
  ctx: HandlerContext,
  input: I,
  output: O,
  req: MessageShape<I>,
  body: (tx: postgres.TransactionSql) => Promise<MessageShape<O>>,
): Promise<MessageShape<O>> {
  return withWrite(ctx, deps.sql, { input, output }, req, body);
}

/** Times as RFC 3339; "" for none. */
export const iso = (d: Date | string | null | undefined) => (d == null ? "" : d instanceof Date ? d.toISOString() : new Date(d).toISOString());
export const Uuid = z.uuid();
export const OptionalUuid = z.union([z.literal(""), z.uuid()]);
export const Ids = (max: number) => z.array(z.uuid()).max(max);
