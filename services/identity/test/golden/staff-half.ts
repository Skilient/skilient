/**
 * Helpers for the staff, two-factor reset, ban, GitHub and deletion replays (steps 9 to 11).
 *
 * - `RENAMED["public.ops_audit_log"]`: identity's own audit log, projected to the recorded columns.
 * - `seedStaffWorld`: the parts of the recording's seed those cases rely on that replay.ts's `seed` does not
 *   write (authenticator factors, profile facts, agreement versions).
 * - `replayHalf`: a case whose golden also holds another service's half (sanctions, notifications, GitHub
 *   tables, profiles). The recorded value is projected to identity's half, its <uuid:n> placeholders are
 *   renumbered in the order `normalise` meets them, and the port's value must equal it exactly. No golden
 *   file is changed.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalise } from "@skilient/testing";
import type postgres from "postgres";
import { expect } from "vitest";
import { ADMIN, MOD, PEER, RENAMED, seed, STUDENT, USERS, type Tx } from "./replay";

const DIR = join(import.meta.dirname, "../../../../packages/testing/test/golden/identity");

export const FACTOR_ADMIN = "9c000000-0000-4000-8000-000000000003";
export const FACTOR_MOD = "9c000000-0000-4000-8000-000000000004";
export const FACTOR_PEER = "9c000000-0000-4000-8000-000000000002";

RENAMED["public.ops_audit_log"] = (tx) =>
  tx`select staff_id, action, target_type, target_id, reason, before, after from identity.audit_log
      where staff_id = any(${USERS}::uuid[]) order by action, target_id`;

export async function seedStaffWorld(tx: Tx): Promise<void> {
  const secret = Buffer.alloc(16, 7); // a placeholder ciphertext: these factors are never verified
  await tx`insert into identity.totp_factors (id, user_id, secret_ciphertext, status) values
             (${FACTOR_ADMIN}, ${ADMIN}, ${secret}, 'verified'), (${FACTOR_MOD}, ${MOD}, ${secret}, 'verified'),
             (${FACTOR_PEER}, ${PEER}, ${secret}, 'verified')`;
  for (const id of [STUDENT, PEER, ADMIN, MOD])
    await tx`insert into identity.profile_facts (user_id, has_profile, role, onboarding_complete, onboarding_step, status)
               values (${id}, true, 'student', true, 6, 'active')`;
}

/** Tables other services own, dropped from a recorded case's `changes`. */
export const NOT_IDENTITY = [
  "public.profiles",
  "public.onboarding_state",
  "public.notifications",
  "public.sanctions",
  "private.github_link_tickets",
  "public.github_accounts",
  "private.github_tokens",
  "public.github_user_installations",
  "public.github_link_clashes",
  "public.sync_jobs",
];

type Json = unknown;

/** Drops other services' tables from every `changes` object, at any depth; drops tables left empty. */
export function identityHalf(value: Json, extra: (v: Json) => Json = (v) => v): Json {
  const walk = (v: Json): Json => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, Json> = {};
      for (const [k, x] of Object.entries(v as Record<string, Json>)) {
        if (k === "changes" && x && typeof x === "object") {
          out[k] = Object.fromEntries(Object.entries(x as Record<string, Json>).filter(([t]) => !NOT_IDENTITY.includes(t)).map(([t, c]) => [t, walk(c)]));
        } else out[k] = walk(x);
      }
      return extra(out);
    }
    return v;
  };
  return walk(value);
}

/** Drops keys (trust's sanction fields) from every object, at any depth. */
export function dropKeys(value: Json, keys: readonly string[]): Json {
  if (Array.isArray(value)) return value.map((v) => dropKeys(v, keys));
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value as Record<string, Json>).filter(([k]) => !keys.includes(k)).map(([k, v]) => [k, dropKeys(v, keys)]));
  return value;
}

/** Renumbers <uuid:n> placeholders by first appearance, walking keys in sorted order as `normalise` does. */
export function renumber(value: Json): Json {
  const ids = new Map<string, string>();
  const walk = (v: Json): Json => {
    if (typeof v === "string")
      return v.replace(/<uuid:\d+>/g, (p) => {
        if (!ids.has(p)) ids.set(p, `<uuid:${ids.size + 1}>`);
        return ids.get(p)!;
      });
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.entries(v as Record<string, Json>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, x]) => [k, walk(x)]),
      );
    return v;
  };
  return walk(value);
}

export function recorded(file: string, name: string): Json {
  const cases = JSON.parse(readFileSync(join(DIR, `${file}.json`), "utf8")) as Record<string, Json>;
  if (!(name in cases)) throw new Error(`no golden case "${name}" in ${file}.json`);
  return cases[name];
}

/** Runs a case in a rolled-back transaction on the seeded world, then compares it with identity's half of its golden. */
export async function replayHalf(sql: postgres.Sql, file: string, name: string, run: (tx: Tx) => Promise<unknown>, project: (expected: Json) => Json): Promise<void> {
  if (process.env["GOLDEN_RECORD"] === "1") throw new Error("golden replays never record; unset GOLDEN_RECORD");
  let value: unknown;
  await sql
    .begin(async (tx) => {
      await seed(tx);
      await seedStaffWorld(tx);
      value = await run(tx);
      throw new Error("rollback");
    })
    .catch((e: unknown) => {
      if (!(e instanceof Error && e.message === "rollback")) throw e;
    });
  expect(normalise(value)).toEqual(renumber(project(recorded(file, name))));
}

/** A store function that returns nothing, as Postgres reported a void function's value (""). */
export const voidValue = async (run: Promise<unknown>): Promise<string> => {
  await run;
  return "";
};
