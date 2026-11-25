/**
 * The contract world for the staff, sanction, GitHub and deletion tests: world.ts's set-up, plus the signing
 * key, so a test can mint a staff member's access token at aal2 with the account's current token version
 * (what identity would issue after a two-factor sign-in).
 */
import { randomUUID } from "node:crypto";
import { createRevocationCache, createUserTokenVerifier, uuidv7 } from "@skilient/platform";
import type { TransportOptions } from "@skilient/testing";
import { startPostgres } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { generateSigningKey, loadSigningKeys, type SigningKeys } from "../../src/keys";
import { contractEnv, MIGRATIONS, testSecrets, type World } from "./world";

export interface StaffWorld extends World {
  keys: SigningKeys;
  /** An access token for `userId` at `aal`, carrying the account's current token version. */
  token(userId: string, aal?: "aal1" | "aal2"): Promise<string>;
}

export function staffWorld(onWorld: (w: StaffWorld) => void, worlds: World[]): () => Promise<TransportOptions> {
  contractEnv();
  return async () => {
    const pg = await startPostgres();
    const sql = await pg.service("identity", MIGRATIONS);
    const signingKey = await generateSigningKey();
    const keys = await loadSigningKeys({ get: async () => signingKey }, "k1");
    const revocations = createRevocationCache({ sql, pollMs: 200 });
    await revocations.start();
    const token = async (userId: string, aal: "aal1" | "aal2" = "aal2") => {
      const [u] = await sql<{ tv: number }[]>`select token_version as tv from identity.users where id = ${userId}`;
      return keys.sign({ sub: userId, aal, tv: u?.tv ?? 0, sid: randomUUID() });
    };
    const world: StaffWorld = { sql, pg, revocations, keys, token };
    worlds.push(world);
    onWorld(world);
    return { database: () => sql, secrets: testSecrets(signingKey), users: createUserTokenVerifier(keys.jwks(), { revocations }) };
  };
}

/** A verified authenticator (the secret is a placeholder: these tests never check a code). */
export async function addFactor(sql: postgres.Sql, userId: string): Promise<void> {
  await sql`insert into identity.totp_factors (id, user_id, secret_ciphertext, status) values (${uuidv7()}, ${userId}, ${Buffer.alloc(16, 1)}, 'verified')`;
}

export async function onboarded(sql: postgres.Sql, userId: string): Promise<void> {
  await sql`insert into identity.profile_facts (user_id, has_profile, role, onboarding_complete, onboarding_step, status)
            values (${userId}, true, 'student', true, 6, 'active')`;
}

/** Waits until a call that used to succeed is refused as signed out (revocation reaches the gate within a second). */
export async function refusedWithin(ms: number, attempt: () => Promise<unknown>): Promise<boolean> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const refused = await attempt().then(
      () => false,
      () => true,
    );
    if (refused) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
}
