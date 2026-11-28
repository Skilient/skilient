import { create, type DescMessage, type MessageInitShape, type MessageShape } from "@bufbuild/protobuf";
import type { HandlerContext } from "@connectrpc/connect";
import { callOf, from, refuseIfRestricted, withWrite, type Logger } from "@skilient/platform";
import type postgres from "postgres";
import { z } from "zod";
import { wantedSocieties, fillSocieties } from "../domain/record";
import { isRecordStaff, requireTrustReviewer } from "../identity";
import type { Files, Ports, Renderer } from "../ports";
import { refused } from "../refusals";
import type { ActiveKey } from "../signing/keys";

/**
 * What every credentials handler module receives. The ports reach other services with one batch call each, never
 * inside a loop (CLAUDE.md, "Never"). Tests pass the real services, a test signing key and export secret (through
 * TransportOptions.secrets), and fakes for files and rendering.
 */
export interface ApiDeps {
  sql: postgres.Sql;
  logger: Logger;
  ports: Ports;
  key: ActiveKey;
  exportSecret: string;
  files: Files;
  renderer: Renderer;
}

/** Validates input with zod; any failure is one typed refusal (no details echoed back). */
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw refused("invalid_input");
  return r.data;
}

export const Uuid = z.uuid();
export const id = (s: string) => parse(Uuid, s);
export const opt = (s: string) => (s === "" ? null : s);

/** The signed-in user's id, or null. */
export const meOf = (ctx: HandlerContext): string | null => callOf(ctx).user?.id ?? null;
/** The signed-in user's id, or not_signed_in. */
export function me(ctx: HandlerContext): string {
  const id = meOf(ctx);
  if (!id) throw refused("not_signed_in");
  return id;
}
/** The token's restriction, as refuse_if_restricted did on the Record's tables. */
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

/** Fills people's and community's placeholders in a document (one batch call each, only when the document asks). */
export async function filled<T>(deps: ApiDeps, ctx: HandlerContext, doc: T): Promise<T> {
  const societies = wantedSocieties(doc);
  const [people, facts] = await Promise.all([
    deps.ports.fill(doc, onward(ctx)),
    societies.length ? deps.ports.recordFacts({ societyIds: societies }, onward(ctx)) : Promise.resolve(null),
  ]);
  return facts ? fillSocieties(people, facts.societies) : people;
}

/** `require_trust_reviewer()`: one identity call per staff request. */
export async function trust(deps: ApiDeps, ctx: HandlerContext): Promise<string> {
  const user = callOf(ctx).user;
  const roles = user && user.aal === "aal2" ? await deps.ports.staffRoles(user.id, onward(ctx)) : [];
  return requireTrustReviewer(user, roles);
}

/** Trust reviewers and moderators with two-factor (the Record's staff); asked of identity only for a two-factor session. */
export async function recordStaff(deps: ApiDeps, ctx: HandlerContext): Promise<boolean> {
  const user = callOf(ctx).user;
  if (!user || user.aal !== "aal2") return false;
  return isRecordStaff(user, await deps.ports.staffRoles(user.id, onward(ctx)));
}
