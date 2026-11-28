import type postgres from "postgres";
import { publicKeyOf, type SigningKey } from "./sign";

/**
 * The signing key (cv_install_key, cv_active_key and cv_rotate_key on the stack). The private half is the Key Vault
 * secret `credentials-signing-key`: JSON {"key_id": "cv-YYYYMMDD-xxxxxxxx", "private_key": "<PKCS#8, base64>"}, read
 * once at start and held in memory (Key Vault's own key type has no Ed25519; docs/azure/prd.md, "Secrets and
 * keys"). At start the service makes sure the key's public half is in signing_keys and is the one active key: a key
 * id it has not seen retires the old key and becomes active (that is rotation: a new secret and a restart); a
 * retired key id never signs again. Public halves are never deleted, so every code ever issued still verifies.
 */
export interface ActiveKey {
  keyId: string;
  privateKey: string;
}

const KEY_ID = /^cv-[0-9]{8}-[0-9a-f]{8}$/;

export function parseSigningSecret(secret: string): ActiveKey {
  let v: unknown;
  try {
    v = JSON.parse(secret);
  } catch {
    throw new Error("credentials-signing-key is not JSON {key_id, private_key}");
  }
  const o = v as { key_id?: unknown; private_key?: unknown };
  if (typeof o.key_id !== "string" || !KEY_ID.test(o.key_id) || typeof o.private_key !== "string" || o.private_key.length < 40)
    throw new Error("credentials-signing-key needs key_id (cv-YYYYMMDD-xxxxxxxx) and private_key (PKCS#8, base64)");
  return { keyId: o.key_id, privateKey: o.private_key };
}

/** The secret's value for a key (tests and the key script). */
export const signingSecret = (k: SigningKey) => JSON.stringify({ key_id: k.keyId, private_key: k.privateKey });

/** Installs the key if new (retiring the active one), checks it is the active one, and returns it. */
export async function installKey(sql: postgres.Sql, key: ActiveKey): Promise<ActiveKey> {
  const publicKey = publicKeyOf(key.privateKey);
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended('credentials:signing-key', 0))`;
    const [row] = await tx<{ public_key: string; retired: boolean }[]>`
      select public_key, retired_at is not null as retired from credentials.signing_keys where key_id = ${key.keyId}`;
    if (row) {
      if (row.public_key !== publicKey) throw new Error(`signing key ${key.keyId}: the secret's private half does not match the stored public key`);
      if (row.retired) throw new Error(`signing key ${key.keyId} is retired: put a new key in credentials-signing-key`);
      return;
    }
    await tx`update credentials.signing_keys set retired_at = now() where retired_at is null`;
    await tx`insert into credentials.signing_keys (key_id, public_key) values (${key.keyId}, ${publicKey})`;
  });
  return key;
}
