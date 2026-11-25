import { hostname } from "node:os";
import type postgres from "postgres";
import { createDb, entraPassword } from "@skilient/platform/db";
import {
  createLogger,
  createSecrets,
  createUserTokenVerifier,
  noUserTokens,
  serviceKeysFrom,
  type Level,
  type Logger,
  type Secrets,
  type ServiceKeys,
  type UserTokenVerifier,
} from "@skilient/platform";

export interface Boot {
  env: NodeJS.ProcessEnv;
  instance: string;
  logger: Logger;
  secrets: Secrets;
  keys: ServiceKeys;
  users: UserTokenVerifier;
  logHashKey: string;
  /** Opens a service's database connection as svc_<name>; undefined when no database is configured. */
  database?: (service: string) => postgres.Sql;
}

/**
 * A service's database connection (prd.md, "Connections"; "Roles": one login role per service).
 * Locally DB_URL_<SERVICE> gives a full URL; in Azure DB_HOST and DB_NAME are set and the password is the
 * managed identity's Entra token. No password ever comes from the image or the repo.
 */
export function databaseFrom(env: NodeJS.ProcessEnv): ((service: string) => postgres.Sql) | undefined {
  const anyLocal = Object.keys(env).some((k) => k.startsWith("DB_URL_"));
  if (!env["DB_HOST"] && !anyLocal) return undefined;
  return (service) => {
    const role = `svc_${service.replace(/-/g, "_")}`;
    const local = env[`DB_URL_${service.replace(/-/g, "_").toUpperCase()}`];
    if (local) return createDb({ ...parseUrl(local), max: 5 }).sql;
    if (!env["DB_HOST"] || !env["DB_NAME"]) throw new Error(`no database for ${service}: set DB_HOST and DB_NAME`);
    return createDb({ host: env["DB_HOST"], database: env["DB_NAME"], user: role, password: entraPassword(env), ssl: true, max: 5 }).sql;
  };
}

function parseUrl(url: string): { host: string; port: number; database: string; user: string; password: string } {
  const u = new URL(url);
  return { host: u.hostname, port: Number(u.port || 5432), database: u.pathname.slice(1), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password) };
}

/**
 * Reads what every process needs. Variables (not secrets): SERVICES, PORT, HTTP1_PORT,
 * LOG_LEVEL, USER_TOKEN_JWKS_URL, SERVICE_URL_<NAME>, CORE_A_URL, CORE_B_URL,
 * REALTIME_URL, KEY_VAULT_URL, DB_HOST, DB_NAME (Azure) or DB_URL_<SERVICE> (local only). Secrets (Key Vault, or SECRET_<NAME> locally):
 * service-token-key, service-token-key-previous (optional), log-hash-key.
 */
export async function boot(env: NodeJS.ProcessEnv = process.env, options: { logTo?: "stdout" | "stderr" } = {}): Promise<Boot> {
  const instance = env["CONTAINER_APP_REPLICA_NAME"] ?? hostname();
  const level = (["debug", "info", "warn", "error"] as const).find((l) => l === env["LOG_LEVEL"]) ?? ("info" satisfies Level);
  const stream = options.logTo === "stderr" ? process.stderr : process.stdout;
  const logger = createLogger({ level, base: { instance }, write: (line) => stream.write(line + "\n") });
  const secrets = createSecrets({ env });
  const previous = await secrets.get("service-token-key-previous").catch(() => undefined);
  const keys = serviceKeysFrom(await secrets.get("service-token-key"), previous);
  const logHashKey = await secrets.get("log-hash-key");
  const jwks = env["USER_TOKEN_JWKS_URL"];
  if (!jwks) logger.warn("user_tokens_disabled", { reason: "USER_TOKEN_JWKS_URL is not set" });
  const users = jwks ? createUserTokenVerifier(new URL(jwks)) : noUserTokens;
  return { env, instance, logger, secrets, keys, users, logHashKey, database: databaseFrom(env) };
}
