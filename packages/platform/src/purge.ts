import type postgres from "postgres";

/**
 * The daily platform purge (decision 2026-11-25, Q8): events older than 30 days that every consumer has
 * passed, applied-event ids older than 30 days, idempotency rows older than 24 hours, and rate-limit hits
 * older than a day (Q12). It runs as the
 * migration admin (it spans every service's rows), from `host.mjs platform-purge` in a scheduled job.
 * Returns what it removed.
 */
export async function purgePlatform(admin: postgres.Sql, options: { eventDays?: number; appliedDays?: number; idempotencyHours?: number } = {}) {
  const eventDays = options.eventDays ?? 30;
  const appliedDays = options.appliedDays ?? 30;
  const idempotencyHours = options.idempotencyHours ?? 24;
  return admin.begin(async (tx) => {
    // An event goes only when every consumer's cursor is past it; with no consumers yet, age alone decides.
    const events = await tx`
      delete from platform.events e
       where e.at < now() - make_interval(days => ${eventDays})
         and not exists (select 1 from platform.cursors c where (c.last_txid, c.last_seq) < (e.txid, e.seq))`;
    const applied = await tx`delete from platform.applied_events where applied_at < now() - make_interval(days => ${appliedDays})`;
    const idempotency = await tx`delete from platform.idempotency where created_at < now() - make_interval(hours => ${idempotencyHours})`;
    // Rate-limit windows are at most a day (rateLimit refuses longer ones).
    const rateLimits = await tx`delete from platform.rate_limit_events where created_at < now() - interval '1 day'`;
    return { events: events.count, applied: applied.count, idempotency: idempotency.count, rateLimits: rateLimits.count };
  });
}
