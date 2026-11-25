import type { DescMessage, MessageShape } from "@bufbuild/protobuf";
import type { HandlerContext } from "@connectrpc/connect";
import { callOf, withWrite } from "@skilient/platform";
import type postgres from "postgres";
import { z } from "zod";
import { refused } from "../refusals";
import type { ApiDeps } from "../deps";

/** Validates input with zod; any failure is one typed refusal (no details echoed back). */
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw refused("invalid_input");
  return r.data;
}

/** The signed-in user's id, or null. */
export const meOf = (ctx: HandlerContext): string | null => callOf(ctx).user?.id ?? null;

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

/** Text fields: "" means none. */
export const text = (s: string) => (s === "" ? null : s);
/** Times as RFC 3339; "" for none. */
export const iso = (d: Date | string | null | undefined) => (d == null ? "" : d instanceof Date ? d.toISOString() : new Date(d).toISOString());

export const Uuid = z.uuid();
export const Username = z.string().max(64);
export const UserIds = z.array(z.uuid()).max(500);
