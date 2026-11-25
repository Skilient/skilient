/**
 * Golden replay: deletion.json, identity's half (decision Q1: the deletion state lives in identity; people
 * and notify react to `user.deletion_requested`, `user.deletion_cancelled` and `user.deleted`). Profiles,
 * onboarding state and notifications are their owners' half; here they are checked as the events identity
 * emits. Onboarding comes from identity's copy of people's gate facts (`identity.profile_facts`).
 */
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { accountDeletionRun, cancelAccountDeletion, deleteAccount, requestAccountDeletion } from "../../src/store/deletion";
import { anonymous, call, EMAIL, MOD, NEWBIE, PEER, startWorld, step, STUDENT, type Tx } from "./replay";
import { identityHalf, replayHalf, voidValue } from "./staff-half";

/** The security event the recording's sign-up trigger wrote for each fixture account (identity's table). */
async function signupEvent(tx: Tx, userId: string): Promise<void> {
  await tx`insert into identity.security_events (id, user_id, kind, meta, created_at)
             values (gen_random_uuid(), ${userId}, 'signup', ${JSON.stringify({ provider: "email", role: "student" })}::text::jsonb, now() - interval '1 day')`;
}

const events = (tx: Tx, type: string, userId: string) =>
  tx<{ payload: Record<string, unknown> }[]>`select payload from platform.events where type = ${type} and ${userId}::uuid = any(subjects) order by seq`;

describe("deletion.json (identity's half)", () => {
  let pg: TestDatabase;
  let sql: postgres.Sql;
  beforeAll(async () => ({ pg, sql } = await startWorld()));
  afterAll(async () => {
    await pg?.stop();
  });

  it("request_account_deletion and cancel_account_deletion", () =>
    replayHalf(
      sql,
      "deletion",
      "request_cancel",
      async (tx) => {
        await tx`insert into identity.users (id, email, email_confirmed_at) values (${NEWBIE}, ${EMAIL[NEWBIE]!}, now())`;
        const requested = await step(tx, (sp) => requestAccountDeletion(sp, STUDENT).then((d) => d.toISOString()));
        const out = {
          requested,
          delete_after_minus_now: await call(tx, async (sp) => (await sp<{ v: string }[]>`select (delete_after - now())::text as v from identity.users where id = ${STUDENT}`)[0]!.v),
          requested_again: await step(tx, (sp) => requestAccountDeletion(sp, STUDENT).then((d) => d.toISOString())),
          cancelled: await step(tx, (sp) => cancelAccountDeletion(sp, STUDENT).then(() => null)),
          cancel_when_none_pending: await call(tx, (sp) => cancelAccountDeletion(sp, STUDENT)),
          staff_refused: await call(tx, (sp) => requestAccountDeletion(sp, MOD)),
          not_onboarded: await call(tx, (sp) => requestAccountDeletion(sp, NEWBIE)),
          signed_out: await anonymous("request_account_deletion", () => requestAccountDeletion(tx, null)),
        };
        // people's and notify's half: one request event with the date (asked twice, emitted once) and one cancel event.
        expect((await events(tx, "user.deletion_requested", STUDENT)).map((e) => Object.keys(e.payload))).toEqual([["delete_after"]]);
        expect(await events(tx, "user.deletion_cancelled", STUDENT)).toHaveLength(1);
        return out;
      },
      identityHalf,
    ));

  it("delete_account", () =>
    replayHalf(
      sql,
      "deletion",
      "delete_account",
      async (tx) => {
        await signupEvent(tx, STUDENT);
        await tx`insert into identity.security_events (id, user_id, kind) values (gen_random_uuid(), ${STUDENT}, 'password_changed')`;
        const notDue = await call(tx, (sp) => deleteAccount(sp, STUDENT));
        await tx`update identity.users set status = 'deleting', delete_after = now() - interval '1 minute' where id = ${STUDENT}`;
        const out = { not_due: notDue, deleted: await step(tx, (sp) => voidValue(deleteAccount(sp, STUDENT))) };
        expect((await events(tx, "user.deleted", STUDENT)).map((e) => e.payload)).toEqual([{ user_id: STUDENT }]);
        expect(await tx`select 1 from identity.deleted_accounts where user_id = ${STUDENT}`).toHaveLength(1);
        return out;
      },
      identityHalf,
    ));

  it("account_deletion_run (scheduled job)", () =>
    replayHalf(
      sql,
      "deletion",
      "account_deletion_run",
      async (tx) => {
        await signupEvent(tx, STUDENT);
        await tx`update identity.users set status = 'deleting', delete_after = now() - interval '1 minute' where id = ${STUDENT}`;
        await tx`update identity.users set status = 'deleting', delete_after = now() + interval '1 day' where id = ${PEER}`;
        return step(tx, (sp) => accountDeletionRun(sp));
      },
      identityHalf,
    ));
});
