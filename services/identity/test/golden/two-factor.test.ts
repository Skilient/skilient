/**
 * Golden replay: backup codes (two-factor.json `backup_codes`, `delete_backup_codes`), against identity's schema.
 * The recording's world gives PEER a verified authenticator (`auth.mfa_factors`, identity.golden.test.ts
 * `seed`); replay.ts's seed does not hold factors, so each case adds it first, encrypted as identity stores it.
 * `ops_reset_mfa` is replayed with the staff methods, not here.
 */
import { randomBytes } from "node:crypto";
import { refuse } from "@skilient/platform";
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, it } from "vitest";
import { encryptTotpSecret, generateTotpSecret } from "../../src/domain/totp";
import { backupCodesRemaining } from "../../src/store/reads";
import { createBackupCodes, deleteBackupCodes, useBackupCode, type Actor } from "../../src/store/two-factor";
import { anonymous, call, PEER, replay, startWorld, step, type Tx } from "./replay";

const FACTOR_PEER = "9c000000-0000-4000-8000-000000000003";
const KEY = randomBytes(32);
const CODE = /^[2-9a-z]{5}-[2-9a-z]{5}$/;

/** The recorder's `shape`: strings matching `pattern` become `label`. */
function shape(value: unknown, pattern: RegExp, label: string): unknown {
  if (Array.isArray(value)) return value.map((v) => shape(v, pattern, label));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v, pattern, label)]));
  return typeof value === "string" && pattern.test(value) ? label : value;
}

async function peerFactor(tx: Tx): Promise<void> {
  await tx`insert into identity.totp_factors (id, user_id, secret_ciphertext, status)
           values (${FACTOR_PEER}, ${PEER}, ${encryptTotpSecret(KEY, generateTotpSecret(), FACTOR_PEER)}, 'verified')`;
}

/** The gate refuses a call with no user before the handler runs; this stands in for it. */
function as(user: string | null, aal: "aal1" | "aal2"): Actor {
  if (!user) throw refuse("not_signed_in", "not signed in");
  return { id: user, aal };
}

const remaining = (tx: Tx, user: string | null) => backupCodesRemaining(tx as unknown as postgres.Sql, as(user, "aal1").id);

describe("two-factor.json", () => {
  let pg: TestDatabase;
  let sql: postgres.Sql;
  beforeAll(async () => ({ pg, sql } = await startWorld()));
  afterAll(async () => {
    await pg?.stop();
  });

  it("backup_codes", () =>
    replay(sql, "two-factor", "backup_codes", async (tx) => {
      await peerFactor(tx);
      const created = await step(tx, (sp) => createBackupCodes(sp, as(PEER, "aal2")));
      const codes = (created.result as { ok: true; value: string[] }).value;
      const left = await call(tx, (sp) => remaining(sp, PEER));
      const used = await step(tx, (sp) => useBackupCode(sp, as(PEER, "aal1").id, codes[0]!.toUpperCase()));
      return {
        create_needs_aal2: await call(tx, (sp) => createBackupCodes(sp, as(PEER, "aal1"))),
        create_signed_out: await anonymous("create_mfa_backup_codes", () => createBackupCodes(tx, as(null, "aal2"))),
        created: shape(created, CODE, "<code>"),
        codes_well_formed: codes.length === 10 && codes.every((c) => CODE.test(c)),
        remaining: left,
        use_valid_code: used,
        remaining_after_use: await call(tx, (sp) => remaining(sp, PEER)),
        use_same_code_again: await call(tx, (sp) => useBackupCode(sp, as(PEER, "aal1").id, codes[0]!)),
        use_wrong_code: await call(tx, (sp) => useBackupCode(sp, as(PEER, "aal1").id, "zzzzz-zzzzz")),
        use_signed_out: await anonymous("use_mfa_backup_code", () => useBackupCode(tx, as(null, "aal1").id, codes[1]!)),
        remaining_signed_out: await anonymous("mfa_backup_codes_remaining", () => remaining(tx, null)),
      };
    }));

  it("delete_backup_codes", () =>
    replay(sql, "two-factor", "delete_backup_codes", async (tx) => {
      await peerFactor(tx);
      await call(tx, (sp) => createBackupCodes(sp, as(PEER, "aal2")));
      return {
        deleted: await step(tx, (sp) => deleteBackupCodes(sp, as(PEER, "aal2"))),
        signed_out: await anonymous("delete_mfa_backup_codes", () => deleteBackupCodes(tx, as(null, "aal2"))),
      };
    }));
});
