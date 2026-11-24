import { hostname } from "node:os";
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
}

/**
 * Reads what every process needs. Variables (not secrets): SERVICES, PORT, HTTP1_PORT,
 * LOG_LEVEL, USER_TOKEN_JWKS_URL, SERVICE_URL_<NAME>, CORE_A_URL, CORE_B_URL,
 * REALTIME_URL, KEY_VAULT_URL. Secrets (Key Vault, or SECRET_<NAME> locally):
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
  return { env, instance, logger, secrets, keys, users, logHashKey };
}
