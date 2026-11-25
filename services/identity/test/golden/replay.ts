/**
 * Replaying the identity goldens against the port (CLAUDE.md, "How to work" 4).
 *
 * The goldens were recorded on Supabase, so their `changes` name Supabase tables. Comparison rules
 * (docs/decisions.md, 2026-11-25):
 *   1. Identity-owned tables are read from identity's schema and reported under the recorded name, with
 *      identity's columns projected to the recorded row shape (RENAMED). They must match exactly.
 *   2. Tables another service owns (FOREIGN) are not identity's to write; a replay that meets one fails
 *      until its case is split (the owner replays that half in its workstream).
 *   3. An anonymous caller's recorded "permission denied for function X" (a Supabase grant) matches the
 *      port's not_signed_in refusal and nothing else (see `anonymous`).
 * Every recorded case runs in one transaction that is rolled back; so does every replay.
 */
import { join } from "node:path";
import { Code, ConnectError } from "@connectrpc/connect";
import { golden } from "@skilient/testing";
import { startPostgres, type TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { expect } from "vitest";
import { signinAccountKey } from "../../src/domain/signin";
import { outcome, type Outcome } from "./outcome";

export type Tx = postgres.TransactionSql;
const DIR = join(import.meta.dirname, "../../../../packages/testing/test/golden/identity");
const MIGRATIONS = join(import.meta.dirname, "../../migrations");

// The recording's fixture world (packages/testing/test/identity.golden.test.ts, `seed`).
export const STUDENT = "9b000000-0000-4000-8000-000000000001";
export const PEER = "9b000000-0000-4000-8000-000000000002";
export const ADMIN = "9b000000-0000-4000-8000-000000000003";
export const MOD = "9b000000-0000-4000-8000-000000000004";
export const NEWBIE = "9b000000-0000-4000-8000-000000000005";
export const EXTRA = "9b000000-0000-4000-8000-000000000006";
export const USERS = [STUDENT, PEER, ADMIN, MOD, NEWBIE, EXTRA];
export const EMAIL: Record<string, string> = {
  [STUDENT]: "golden.student@golden-uni.test",
  [PEER]: "golden.peer@golden-uni.test",
  [ADMIN]: "golden.admin@golden-uni.test",
  [MOD]: "golden.mod@golden-uni.test",
  [NEWBIE]: "golden.newbie@golden-uni.test",
  [EXTRA]: "golden.extra@golden-uni.test",
};
export const IP = "1".repeat(64);
export const SESSION_PEER_1 = "9d000000-0000-4000-8000-000000000021";
export const SESSION_PEER_2 = "9d000000-0000-4000-8000-000000000022";
export const SESSION_STUDENT = "9d000000-0000-4000-8000-000000000011";

/**
 * Rule 1: identity's tables under the recorded names, projected to the recorded columns. A replay file may
 * add entries for its own cases (vitest loads each test file in isolation, so additions stay in that file).
 */
export const RENAMED: Record<string, (tx: Tx) => PromiseLike<readonly unknown[]>> = {
  "auth.users": (tx) => tx`select id, email, null::text as email_change, banned_until from identity.users where id = any(${USERS}::uuid[]) order by email`,
  "auth.sessions": (tx) => tx`select id, user_id, aal from identity.sessions where user_id = any(${USERS}::uuid[]) and revoked_at is null order by id`,
  "auth.mfa_factors": (tx) =>
    tx`select id, user_id, 'totp' as factor_type, status from identity.totp_factors where user_id = any(${USERS}::uuid[]) order by id`,
  "public.staff_roles": (tx) => tx`select user_id, role, granted_by from identity.staff_roles where user_id = any(${USERS}::uuid[]) order by user_id, role`,
  "public.security_events": (tx) =>
    tx`select user_id, kind, ip_hash, user_agent, meta from identity.security_events where user_id = any(${USERS}::uuid[]) order by user_id, kind, created_at`,
  "public.user_devices": (tx) => tx`select user_id, device_hash, user_agent from identity.user_devices where user_id = any(${USERS}::uuid[]) order by user_id, device_hash`,
  "private.security_alert_tokens": (tx) =>
    tx`select user_id, expires_at, used_at from identity.security_alert_tokens where user_id = any(${USERS}::uuid[]) order by user_id, used_at nulls first`,
  "private.auth_failures": (tx) =>
    tx`select key from identity.auth_failures where key = any(${[...Object.values(EMAIL).map(signinAccountKey), `ip:${IP}`]}::text[]) order by key`,
  "private.mfa_backup_codes": (tx) =>
    tx`select user_id, count(*) filter (where used_at is null)::int as unused, count(*) filter (where used_at is not null)::int as used
         from identity.mfa_backup_codes where user_id = any(${USERS}::uuid[]) group by user_id order by user_id`,
  "public.agreement_acceptances": (tx) =>
    tx`select user_id, version, ip_hash from identity.agreement_acceptances where user_id = any(${USERS}::uuid[]) order by user_id, version`,
  "private.rate_limit_events": (tx) =>
    tx`select key from platform.rate_limit_events where key like 'golden:%' or exists (select 1 from unnest(${USERS}::uuid[]) u where key like '%' || u::text) order by key`,
};

/** Rule 2: tables other services own, the event or call that carries identity's part, and who replays the rest. */
export const FOREIGN: Record<string, { owner: string; via: string; replayedIn: string }> = {
  "public.profiles": { owner: "people", via: "user.created / user.deleted", replayedIn: "W2" },
  "public.onboarding_state": { owner: "people", via: "user.created", replayedIn: "W2" },
  "public.notifications": { owner: "notify", via: "identity events", replayedIn: "W9" },
  "public.ops_audit_log": { owner: "trust (pending Ahmed, Q4)", via: "audit sink", replayedIn: "W10" },
  "public.sanctions": { owner: "trust", via: "identity command", replayedIn: "W10" },
  "public.job_runs": { owner: "platform", via: "platform.jobs outcome", replayedIn: "W1 (synthesised)" },
};

export async function snapshot(tx: Tx): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const [table, read] of Object.entries(RENAMED)) out[table] = (await read(tx)).map((r) => JSON.stringify(r));
  return out;
}

export function changes(before: Record<string, string[]>, after: Record<string, string[]>) {
  const out: Record<string, { added: unknown[]; removed: unknown[] }> = {};
  const minus = (a: string[], b: string[]) => {
    const left = [...b];
    return a.filter((x) => {
      const i = left.indexOf(x);
      if (i === -1) return true;
      left.splice(i, 1);
      return false;
    });
  };
  for (const table of Object.keys(after)) {
    const added = minus(after[table]!, before[table]!).map((x) => JSON.parse(x) as unknown);
    const removed = minus(before[table]!, after[table]!).map((x) => JSON.parse(x) as unknown);
    if (added.length || removed.length) out[table] = { added, removed };
  }
  return out;
}

/** One call with the rows it changed, as the recorder's `step` reports it. The call runs in a savepoint. */
export async function step(tx: Tx, run: (sp: Tx) => unknown) {
  const before = await snapshot(tx);
  const result = await outcome(() => tx.savepoint((sp) => Promise.resolve(run(sp))));
  return { result, changes: changes(before, await snapshot(tx)) };
}

export const call = (tx: Tx, run: (sp: Tx) => unknown): Promise<Outcome> => outcome(() => tx.savepoint((sp) => Promise.resolve(run(sp))));

/** Rule 3: an anonymous call refused by the gate equals Supabase's "permission denied for function <fn>". */
export async function anonymous(fn: string, run: () => unknown): Promise<Outcome> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    if (error instanceof ConnectError && error.code === Code.Unauthenticated) return { ok: false, code: "42501", message: `permission denied for function ${fn}` };
    return outcome(() => {
      throw error;
    });
  }
}

/** A replay world: identity's schema with the recording's fixture users and sessions. */
export async function startWorld(): Promise<{ pg: TestDatabase; sql: postgres.Sql }> {
  if (process.env["GOLDEN_RECORD"] === "1") throw new Error("golden replays never record; unset GOLDEN_RECORD");
  const pg = await startPostgres();
  const sql = await pg.service("identity", MIGRATIONS);
  return { pg, sql };
}

/** The recording's `seed`, for the tables identity owns. */
export async function seed(tx: Tx): Promise<void> {
  for (const id of [STUDENT, PEER, ADMIN, MOD]) await tx`insert into identity.users (id, email, email_confirmed_at) values (${id}, ${EMAIL[id]!}, now())`;
  await tx`insert into identity.staff_roles (user_id, role, granted_by) values (${ADMIN}, 'super_admin', ${ADMIN}), (${MOD}, 'moderator', ${ADMIN})`;
  await tx`insert into identity.sessions (id, user_id, aal) values (${SESSION_PEER_1}, ${PEER}, 'aal1'), (${SESSION_PEER_2}, ${PEER}, 'aal2'), (${SESSION_STUDENT}, ${STUDENT}, 'aal1')`;
}

/** Runs a case in a rolled-back transaction on a seeded world, then compares it with its golden. */
export async function replay(sql: postgres.Sql, file: string, name: string, run: (tx: Tx) => Promise<unknown>): Promise<void> {
  let value: unknown;
  await sql
    .begin(async (tx) => {
      await seed(tx);
      value = await run(tx);
      throw new Error("rollback");
    })
    .catch((e: unknown) => {
      if (!(e instanceof Error && e.message === "rollback")) throw e;
    });
  const r = golden(join(DIR, `${file}.json`), name, value);
  if (r.status === "differs") expect(r.actual).toEqual(r.expected);
  expect(r.status).toBe("matched");
}

/** Replaces the value of one key wherever it appears (a minted token), as the recorder did. */
export function maskKey(value: unknown, key: string, label: string): unknown {
  if (Array.isArray(value)) return value.map((v) => maskKey(v, key, label));
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, k === key && v != null ? label : maskKey(v, key, label)]));
  return value;
}
