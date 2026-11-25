import type postgres from "postgres";
import { EVENTS_CHANNEL } from "../events";
import type { Logger } from "../log";
import type { RevocationCheck } from "./user-token";

/**
 * Token revocation (docs/azure/prd.md, identity: "a sanction, role change or sign-out bumps the user's token
 * version"). `identity` appends `user.tokens_revoked` (subjects: [user], payload: { tv }) in the same
 * transaction as the bump. Every service keeps the floor per user in memory: on start it reads the last
 * eleven minutes of these events (access tokens live ten), then follows NOTIFY. A token whose `tv` is
 * below the user's floor is refused.
 */
export const TOKENS_REVOKED = "user.tokens_revoked";

export interface RevocationCache extends RevocationCheck {
  /** The lowest token version still valid for a user (0 when nothing was revoked recently). */
  floor(userId: string): number;
  /** Reads events not yet seen; returns how many it applied. */
  refresh(): Promise<number>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createRevocationCache(options: { sql: postgres.Sql; windowMs?: number; pollMs?: number; logger?: Logger }): RevocationCache {
  const { sql } = options;
  const windowMs = options.windowMs ?? 11 * 60_000;
  const floors = new Map<string, { tv: number; at: number }>();
  let last: { txid: string; seq: string } | null = null;
  let listener: { unlisten(): Promise<void> } | undefined;
  let timer: NodeJS.Timeout | undefined;
  let running: Promise<number> | null = null;

  async function refresh(): Promise<number> {
    const rows = await sql<{ txid: string; seq: string; user_id: string; tv: number }[]>`
      select txid::text, seq::text, subjects[1]::text as user_id, (payload ->> 'tv')::int as tv
        from platform.events
       where type = ${TOKENS_REVOKED}
         and txid < pg_snapshot_xmin(pg_current_snapshot())
         and ${last ? sql`(txid, seq) > (${last.txid}::xid8, ${last.seq}::bigint)` : sql`at > now() - ${`${windowMs} milliseconds`}::interval`}
       order by txid, seq`;
    const now = Date.now();
    for (const r of rows) {
      const seen = floors.get(r.user_id);
      if (!seen || r.tv > seen.tv) floors.set(r.user_id, { tv: r.tv, at: now });
    }
    if (rows.length) last = { txid: rows.at(-1)!.txid, seq: rows.at(-1)!.seq };
    for (const [user, f] of floors) if (now - f.at > windowMs) floors.delete(user);
    return rows.length;
  }

  function wake(): void {
    if (running) return;
    running = refresh()
      .catch((error: unknown) => {
        options.logger?.error("revocation.refresh_failed", {
          action: "revocation.refresh",
          outcome: "error",
          error_code: error instanceof Error ? error.message.slice(0, 80) : "unknown",
        });
        return 0;
      })
      .finally(() => {
        running = null;
      });
  }

  const floor = (userId: string) => floors.get(userId)?.tv ?? 0;
  return {
    floor,
    isRevoked: (userId, tokenVersion) => tokenVersion < floor(userId),
    refresh,
    async start() {
      await refresh();
      listener = await sql.listen(EVENTS_CHANNEL, (type) => {
        if (type === TOKENS_REVOKED) wake();
      });
      timer = setInterval(wake, options.pollMs ?? 2_000);
      timer.unref();
    },
    async stop() {
      if (timer) clearInterval(timer);
      await listener?.unlisten();
      await running;
    },
  };
}
