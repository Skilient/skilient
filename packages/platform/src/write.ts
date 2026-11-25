import { createHash } from "node:crypto";
import { fromBinary, toBinary, type DescMessage, type MessageShape } from "@bufbuild/protobuf";
import type { HandlerContext } from "@connectrpc/connect";
import type postgres from "postgres";
import { callOf, headers } from "./context";
import { refuse } from "./errors";

const KEY = /^[A-Za-z0-9_-]{8,200}$/;

/**
 * Runs a write handler under its client-made idempotency key (docs/azure/prd.md, call rules: "Writes carry
 * a client-made idempotency key; a repeat returns the first result").
 *
 * In one transaction: claim the key, run the body (its own writes and events), store the encoded reply,
 * commit. A repeat with the same request gets the stored reply and changes nothing. A repeat with a
 * different request under the same key is refused. A concurrent duplicate waits on the first one's row
 * lock and then gets its reply. A refusal rolls everything back, so a refused request stores nothing and
 * may be retried with the same key.
 *
 * Methods that return a secret (a session token, backup codes) must not store their reply; those use
 * `withWrite(..., { storeReply: false })`, which refuses a repeat with `already_applied` (pending Ahmed,
 * docs/decisions.md).
 */
export async function withWrite<I extends DescMessage, O extends DescMessage>(
  ctx: HandlerContext,
  sql: postgres.Sql,
  schemas: { input: I; output: O },
  request: MessageShape<I>,
  body: (tx: postgres.TransactionSql) => Promise<MessageShape<O>>,
  options: { storeReply?: boolean } = {},
): Promise<MessageShape<O>> {
  const key = ctx.requestHeader.get(headers.idempotencyKey);
  if (!key) throw refuse("invalid_input", "idempotency_key_missing");
  if (!KEY.test(key)) throw refuse("invalid_input", "idempotency_key_invalid");
  const call = callOf(ctx);
  const actor = call.user ? `user:${call.user.id}` : `service:${call.caller}`;
  const method = `${ctx.service.typeName}/${ctx.method.name}`;
  const hash = createHash("sha256").update(toBinary(schemas.input, request)).digest("hex");
  const store = options.storeReply ?? true;

  return (await sql.begin(async (tx) => {
    const claimed = await tx`
      insert into platform.idempotency (actor, method, key, request_hash)
      values (${actor}, ${method}, ${key}, ${hash})
      on conflict (owner, actor, method, key) do nothing
      returning 1`;
    if (claimed.count === 0) {
      const [first] = await tx<{ request_hash: string; response: Buffer | null }[]>`
        select request_hash, response from platform.idempotency
         where actor = ${actor} and method = ${method} and key = ${key}`;
      if (!first || first.request_hash !== hash) throw refuse("precondition", "idempotency_key_reused");
      if (!store || !first.response) throw refuse("precondition", "already_applied");
      return fromBinary(schemas.output, new Uint8Array(first.response));
    }
    const reply = await body(tx);
    await tx`
      update platform.idempotency
         set status = 'done', response = ${store ? Buffer.from(toBinary(schemas.output, reply)) : null}
       where actor = ${actor} and method = ${method} and key = ${key}`;
    return reply;
  })) as MessageShape<O>;
}
