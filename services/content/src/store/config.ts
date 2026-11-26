import { resolveConfig, type Config } from "../domain/config";
import type { Db } from "./db";

/** The settings as stored (trust's config.changed, W10) over the launch defaults. */
export async function loadConfig(db: Db): Promise<Config> {
  const rows = await db<{ key: string; value: unknown }[]>`select key, value from content.config`;
  return resolveConfig(Object.fromEntries(rows.map((r) => [r.key, r.value])));
}

/** A config reader cached for `ttlMs` (settings change rarely; config.changed lands within the window). */
export function cachedConfig(db: Db, ttlMs = 30_000): () => Promise<Config> {
  let at = 0;
  let value: Promise<Config> | undefined;
  return () => {
    if (!value || Date.now() - at > ttlMs) {
      at = Date.now();
      value = loadConfig(db).catch((e: unknown) => {
        value = undefined;
        throw e;
      });
    }
    return value;
  };
}
