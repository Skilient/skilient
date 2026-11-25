/**
 * Golden replay: ban.json, identity's half (decision 2026-11-25: the ban path gets a golden test and a
 * refusal test). Identity's half is `auth.users.banned_until`, the ended sessions and the audit row; the
 * sanction row and the notification are trust's and notify's (replay.ts FOREIGN). Trust's sanction id is
 * passed in, as trust's call does, and the audit row's sanction holds the fields identity knows: trust's
 * `case_id` and `per_day` are dropped from the recorded rows before comparing.
 */
import { randomUUID } from "node:crypto";
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { liftSanction, sanctionUser } from "../../src/store/sanctions";
import { loadActor } from "../../src/store/staff";
import { ADMIN, anonymous, call, MOD, NEWBIE, PEER, startWorld, step, STUDENT, type Tx } from "./replay";
import { dropKeys, identityHalf, replayHalf, voidValue } from "./staff-half";

const TRUST_ONLY = ["case_id", "per_day"];
const project = (v: unknown) => dropKeys(identityHalf(v), TRUST_ONLY);

type Aal = "aal1" | "aal2";
const ban = (actor: string, aal: Aal, userId: string, kind: string, until: Date | null, reason: string, sanctionId = randomUUID()) => (sp: Tx) =>
  loadActor(sp, { id: actor, aal }).then((a) => sanctionUser(sp, a, { userId, kind, until, reason, sanctionId }));
const lift = (actor: string, userId: string, sanctionId: string, reason: string) => (sp: Tx) =>
  voidValue(loadActor(sp, { id: actor, aal: "aal2" }).then((a) => liftSanction(sp, a, { userId, sanctionId, reason })));

describe("ban.json (identity's half)", () => {
  let pg: TestDatabase;
  let sql: postgres.Sql;
  beforeAll(async () => ({ pg, sql } = await startWorld()));
  afterAll(async () => {
    await pg?.stop();
  });

  it("ban, session end, audit, lift", () =>
    replayHalf(
      sql,
      "ban",
      "ban_and_lift",
      async (tx) => {
        const tvBefore = (await tx<{ tv: number }[]>`select token_version as tv from identity.users where id = ${PEER}`)[0]!.tv;
        const banned = await step(tx, ban(ADMIN, "aal2", PEER, "ban", null, "Repeated harassment."));
        const id = (banned.result as { ok: true; value: string }).value;
        // A ban bumps the token version (decision Q11), so every service refuses the user's tokens within a second.
        const [after] = await tx<{ tv: number }[]>`select token_version as tv from identity.users where id = ${PEER}`;
        expect(after!.tv).toBe(tvBefore + 1);
        return {
          banned,
          banned_until_is_permanent_sentinel: await call(tx, async (sp) => {
            const [r] = await sp<{ v: boolean }[]>`select banned_until = timestamptz '2999-12-31 00:00:00+00' as v from identity.users where id = ${PEER}`;
            return r!.v;
          }),
          banned_again_refused: await call(tx, ban(ADMIN, "aal2", PEER, "ban", null, "Again.")),
          lift_by_moderator_refused: await call(tx, lift(MOD, PEER, id, "Appeal upheld.")),
          lifted: await step(tx, lift(ADMIN, PEER, id, "Appeal upheld.")),
          lift_again_refused: await call(tx, lift(ADMIN, PEER, id, "Appeal upheld.")),
        };
      },
      project,
    ));

  it("refusals", () =>
    replayHalf(
      sql,
      "ban",
      "refusals",
      async (tx) => ({
        moderator_ban: await step(tx, ban(MOD, "aal2", PEER, "ban", null, "Repeated harassment.")),
        admin_without_aal2: await call(tx, ban(ADMIN, "aal1", PEER, "ban", null, "Repeated harassment.")),
        student: await call(tx, ban(STUDENT, "aal2", PEER, "ban", null, "Repeated harassment.")),
        signed_out: await anonymous("sanction_user", () => loadActor(tx, null)),
        self: await call(tx, ban(ADMIN, "aal2", ADMIN, "ban", null, "Testing.")),
        no_reason: await call(tx, ban(ADMIN, "aal2", PEER, "ban", null, " ")),
        past_end: await call(tx, ban(ADMIN, "aal2", PEER, "ban", new Date("2000-01-01T00:00:00Z"), "Repeated harassment.")),
        unknown_account: await call(tx, ban(ADMIN, "aal2", NEWBIE, "ban", null, "Repeated harassment.")),
        bad_kind: await call(tx, ban(ADMIN, "aal2", PEER, "delete", null, "Repeated harassment.")),
      }),
      project,
    ));

  it("moderator suspension ends sessions without a ban", () =>
    replayHalf(
      sql,
      "ban",
      "suspend",
      async (tx) => {
        const until = new Date(Date.now() + 3 * 24 * 3600 * 1000);
        const tooLong = new Date(Date.now() + 8 * 24 * 3600 * 1000);
        const suspended = await step(tx, ban(MOD, "aal2", PEER, "suspend", until, "Spam in chat."));
        return {
          suspended,
          banned_until_after_suspend: await call(tx, async (sp) => (await sp<{ b: Date | null }[]>`select banned_until as b from identity.users where id = ${PEER}`)[0]!.b),
          suspend_again_refused: await call(tx, ban(MOD, "aal2", PEER, "suspend", until, "Spam in chat.")),
          too_long_for_moderator: await call(tx, ban(MOD, "aal2", STUDENT, "suspend", tooLong, "Spam in chat.")),
          warn: await step(tx, ban(MOD, "aal2", STUDENT, "warn", null, "Please keep it civil.")),
        };
      },
      project,
    ));
});
