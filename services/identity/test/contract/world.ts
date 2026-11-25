import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { createRevocationCache, createUserTokenVerifier, uuidv7, type RevocationCache } from "@skilient/platform";
import type { TransportOptions } from "@skilient/testing";
import { startPostgres, type TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { hashPassword } from "../../src/domain/password";
import { generateSigningKey, loadSigningKeys } from "../../src/keys";

/**
 * A contract-test world for identity: Postgres 17 with identity's migrations, generated secrets, and a gate
 * that trusts identity's own signing key and follows token revocations (as every service does in Azure).
 * One per transport (describeTransports calls `options()` once per transport).
 */
export const MIGRATIONS = join(import.meta.dirname, "../../migrations");

export function contractEnv(): void {
  process.env["IDENTITY_SIGNING_KIDS"] = "k1";
  process.env["IDENTITY_JOBS"] = "off";
  process.env["IDENTITY_MAILER"] = "memory";
}

/** The secrets identity reads, generated per test file (never real values). */
export function testSecrets(signingKey: string): Record<string, string> {
  return {
    "identity-signing-key-k1": signingKey,
    "identity-refresh-pepper": randomBytes(32).toString("base64url"),
    "identity-totp-key": randomBytes(32).toString("base64url"),
  };
}

export interface World {
  sql: postgres.Sql;
  pg: TestDatabase;
  revocations: RevocationCache;
}

/** Starts a world and returns describeTransports options; `onWorld` receives it for the tests to use. */
export function identityWorld(onWorld: (w: World) => void, worlds: World[] = []): () => Promise<TransportOptions> {
  contractEnv();
  return async () => {
    const pg = await startPostgres();
    const sql = await pg.service("identity", MIGRATIONS);
    const signingKey = await generateSigningKey();
    const keys = await loadSigningKeys({ get: async () => signingKey }, "k1");
    // Its own connection (the admin's): the host ends the service pool at teardown, before the world stops.
    const revocations = createRevocationCache({ sql: pg.admin, pollMs: 200 });
    await revocations.start();
    const world = { sql, pg, revocations };
    worlds.push(world);
    onWorld(world);
    return { database: () => sql, secrets: testSecrets(signingKey), users: createUserTokenVerifier(keys.jwks(), { revocations }) };
  };
}

export async function stopWorlds(worlds: World[]): Promise<void> {
  for (const w of worlds) {
    await w.revocations.stop();
    await w.pg.stop();
  }
}

/**
 * Argon2id costs about 200 ms of CPU per hash, and the suites create many accounts with the same few fixture
 * passwords; hashing each distinct password once per test file keeps that CPU off the calls under test (the
 * 2 s call deadline is the PRD rule and is not raised). The stored hash is as real as a fresh one.
 */
const hashes = new Map<string, Promise<string>>();
function cachedHash(password: string): Promise<string> {
  let h = hashes.get(password);
  if (!h) hashes.set(password, (h = hashPassword(password)));
  return h;
}

/** A confirmed account with a password (Argon2id, or a given hash such as an imported bcrypt one). */
export async function createUser(sql: postgres.Sql, email: string, password: string, options: { hash?: string; confirmed?: boolean; roles?: string[] } = {}): Promise<string> {
  const id = uuidv7();
  await sql`insert into identity.users (id, email, email_confirmed_at) values (${id}, ${email}, ${options.confirmed === false ? null : new Date()})`;
  const hash = options.hash ?? (await cachedHash(password));
  await sql`insert into identity.password_credentials (user_id, hash, algorithm) values (${id}, ${hash}, ${hash.startsWith("$2") ? "bcrypt" : "argon2id"})`;
  for (const role of options.roles ?? []) await sql`insert into identity.staff_roles (user_id, role) values (${id}, ${role})`;
  return id;
}

export const DEVICE = "d".repeat(64);
export const IP = "1".repeat(64);
