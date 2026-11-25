import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { argon2id, argon2Verify } from "hash-wasm";

/**
 * Password hashes. Existing Supabase hashes are imported unchanged and still verify (prd.md, "Sign-in and
 * sessions"; decision 2026-11-25). The PRD names bcrypt; production's algorithm is confirmed from the export
 * before cutover (pending Ahmed), so an unknown format is refused, never guessed.
 * New hashes are Argon2id with OWASP's parameters (19 MiB, 2 passes, 1 lane). It runs as WebAssembly
 * (hash-wasm), so it bundles into the distroless image with no native module; the host's `selfcheck`
 * command proves it there. A bcrypt hash is re-hashed at the user's next successful sign-in.
 */
export type HashAlgorithm = "bcrypt" | "argon2id";

const BCRYPT = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
const ARGON2ID = /^\$argon2id\$v=19\$m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/;

/** The algorithm of a stored hash, or null when it is not one identity can verify. */
export function hashAlgorithm(hash: string): HashAlgorithm | null {
  if (BCRYPT.test(hash)) return "bcrypt";
  if (ARGON2ID.test(hash)) return "argon2id";
  return null;
}

export const ARGON2ID_PARAMS = { memorySize: 19_456, iterations: 2, parallelism: 1, hashLength: 32 } as const;

/** A new Argon2id hash in the PHC string format. */
export async function hashPassword(password: string): Promise<string> {
  return argon2id({ password, salt: randomBytes(16), ...ARGON2ID_PARAMS, outputType: "encoded" });
}

/** Checks a password against an imported bcrypt hash or an Argon2id one; an unknown format never verifies. */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  const algorithm = hashAlgorithm(hash);
  if (algorithm === "bcrypt") return bcrypt.compare(password, hash);
  if (algorithm === "argon2id") return argon2Verify({ password, hash });
  return false;
}

/** True when a hash should be replaced at the next successful sign-in (anything but current Argon2id). */
export function needsRehash(hash: string): boolean {
  return !hash.startsWith(`$argon2id$v=19$m=${ARGON2ID_PARAMS.memorySize},t=${ARGON2ID_PARAMS.iterations},p=${ARGON2ID_PARAMS.parallelism}$`);
}
