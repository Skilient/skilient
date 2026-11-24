import { createHmac } from "node:crypto";

/**
 * One JSON line per event (CLAUDE.md, "How to work" 3). Fields carry ids and
 * codes only: never names, emails or content. User ids are hashed with
 * `hashUserId` before they reach a log line.
 */
export type Level = "debug" | "info" | "warn" | "error";
export type Fields = Record<string, string | number | boolean | null | undefined>;

export interface Logger {
  debug(msg: string, fields?: Fields): void;
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
  child(fields: Fields): Logger;
}

const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LoggerOptions {
  level?: Level;
  base?: Fields;
  write?: (line: string) => void;
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const min = order[options.level ?? "info"];
  const write = options.write ?? ((line: string) => process.stdout.write(line + "\n"));
  const base = options.base ?? {};

  const emit = (level: Level, msg: string, fields?: Fields) => {
    if (order[level] < min) return;
    write(JSON.stringify({ time: new Date().toISOString(), level, msg, ...base, ...fields }));
  };

  return {
    debug: (msg, fields) => emit("debug", msg, fields),
    info: (msg, fields) => emit("info", msg, fields),
    warn: (msg, fields) => emit("warn", msg, fields),
    error: (msg, fields) => emit("error", msg, fields),
    child: (fields) => createLogger({ ...options, base: { ...base, ...fields } }),
  };
}

/** A stable, keyed hash of a user id for log lines. Not reversible without the key. */
export function hashUserId(userId: string, key: string | Uint8Array): string {
  return createHmac("sha256", key).update(userId).digest("base64url").slice(0, 22);
}
