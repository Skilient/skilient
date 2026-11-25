import type postgres from "postgres";
import { refuse } from "./errors";

/**
 * At most `limit` hits per `key` in the window, for the calling service's role only (decision 2026-11-25,
 * Q12). Ported from `private.rate_limit` as its current definition: the same validation, serialised per
 * key with a transaction-level advisory lock, and a hit recorded only when it is allowed.
 */
export async function rateLimit(tx: postgres.TransactionSql, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (!key || key.length > 200 || limit < 1 || limit > 1000 || windowSeconds <= 0 || windowSeconds > 86_400)
    throw refuse("invalid_input", "invalid rate limit");
  await tx`select pg_advisory_xact_lock(hashtextextended(current_user || ':rate_limit:' || ${key}, 0))`;
  const [row] = await tx<{ n: number }[]>`
    select count(*)::int as n from platform.rate_limit_events
     where key = ${key} and created_at > now() - make_interval(secs => ${windowSeconds})`;
  if (row!.n >= limit) return false;
  await tx`insert into platform.rate_limit_events (key) values (${key})`;
  return true;
}
