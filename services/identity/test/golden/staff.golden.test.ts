/**
 * Golden replay: staff.json (agreement version, is_staff and staff_roles_of, ops_staff, grant and revoke) and
 * two-factor.json#ops_reset_mfa, against identity's schema. Names in ops_staff come from people through the
 * PeopleNames port (a fake here; people is W2). The mfa_reset notification is notify's half (an event here).
 */
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isStaff, type StaffRole } from "../../src/authorize";
import { fakePeopleNames } from "../../src/store/people-names";
import { currentAgreementVersion, staffRolesOf } from "../../src/store/reads";
import { grantStaffRole, loadActor, opsResetMfa, opsStaff, revokeStaffRole } from "../../src/store/staff";
import { ADMIN, anonymous, call, EMAIL, MOD, NEWBIE, PEER, startWorld, step, STUDENT, type Tx } from "./replay";
import { identityHalf, replayHalf, voidValue } from "./staff-half";

const as = (tx: Tx, id: string, aal: "aal1" | "aal2" = "aal1") => loadActor(tx, { id, aal });
const NAMES = fakePeopleNames({ [ADMIN]: "Golden 3", [MOD]: "Golden 4", [PEER]: "Golden 2", [STUDENT]: "Golden 1" });

describe("staff.json and two-factor.json#ops_reset_mfa", () => {
  let pg: TestDatabase;
  let sql: postgres.Sql;
  beforeAll(async () => ({ pg, sql } = await startWorld()));
  afterAll(async () => {
    await pg?.stop();
  });

  it("current_agreement_version", () =>
    replayHalf(
      sql,
      "staff",
      "current_agreement_version",
      async (tx) => {
        await tx`insert into identity.agreement_versions (version, title, published_at) values
                   (1, 'v1', now() - interval '3 days'), (2, 'v2', now() - interval '2 days'), (3, 'v3', now() - interval '1 day'),
                   (4, 'draft', null)`;
        return call(tx, (sp) => currentAgreementVersion(sp));
      },
      identityHalf,
    ));

  it("is_staff and staff_roles_of", () =>
    replayHalf(
      sql,
      "staff",
      "is_staff",
      async (tx) => {
        const check = async (id: string, aal: "aal1" | "aal2", role: StaffRole | null = null) => call(tx, async (sp) => isStaff(await as(sp, id, aal), role));
        const rolesOf = async (id: string) => call(tx, async (sp) => (await staffRolesOf(sp as unknown as postgres.Sql, [id])).get(id) ?? []);
        return {
          admin_aal2_any: await check(ADMIN, "aal2"),
          admin_aal2_moderator: await check(ADMIN, "aal2", "moderator"),
          admin_aal1: await check(ADMIN, "aal1"),
          moderator_aal2_moderator: await check(MOD, "aal2", "moderator"),
          moderator_aal2_super_admin: await check(MOD, "aal2", "super_admin"),
          student_aal2: await check(STUDENT, "aal2"),
          signed_out: await anonymous("is_staff", () => loadActor(tx, null)),
          roles_of_admin: await rolesOf(ADMIN),
          roles_of_student: await rolesOf(STUDENT),
        };
      },
      identityHalf,
    ));

  it("ops_staff (names through the PeopleNames port)", () =>
    replayHalf(
      sql,
      "staff",
      "ops_staff",
      async (tx) => ({
        admin: await call(tx, async (sp) => opsStaff(sp, await as(sp, ADMIN, "aal2"), NAMES)),
        moderator: await call(tx, async (sp) => opsStaff(sp, await as(sp, MOD, "aal2"), NAMES)),
      }),
      identityHalf,
    ));

  it("grant_staff_role and revoke_staff_role", () =>
    replayHalf(
      sql,
      "staff",
      "grant_revoke",
      async (tx) => {
        const grant = (actor: string, email: string, role: string, reason: string) => (sp: Tx) =>
          as(sp, actor, "aal2").then((a) => grantStaffRole(sp, a, { email, role, reason }));
        const revoke = (actor: string, userId: string, role: string, reason: string) => (sp: Tx) =>
          voidValue(as(sp, actor, "aal2").then((a) => revokeStaffRole(sp, a, { userId, role, reason })));
        const reason = "Joins the trust team.";
        const granted = await step(tx, grant(ADMIN, EMAIL[PEER]!, "trust_reviewer", reason));
        return {
          granted,
          already_has_role: await call(tx, grant(ADMIN, EMAIL[PEER]!, "trust_reviewer", reason)),
          no_reason: await call(tx, grant(ADMIN, EMAIL[MOD]!, "accounts", " ")),
          no_account: await call(tx, grant(ADMIN, "nobody@golden-uni.test", "accounts", reason)),
          no_two_factor: await call(tx, grant(ADMIN, EMAIL[STUDENT]!, "accounts", reason)),
          by_moderator: await call(tx, grant(MOD, EMAIL[PEER]!, "accounts", reason)),
          revoked: await step(tx, revoke(ADMIN, PEER, "trust_reviewer", "Left the team.")),
          revoke_missing_role: await call(tx, revoke(ADMIN, PEER, "trust_reviewer", "Left the team.")),
          revoke_own_super_admin: await call(tx, revoke(ADMIN, ADMIN, "super_admin", "Stepping down.")),
          revoke_by_moderator: await call(tx, revoke(MOD, ADMIN, "super_admin", "Stepping down.")),
        };
      },
      identityHalf,
    ));

  it("two-factor.json#ops_reset_mfa (the notification is notify's half)", () =>
    replayHalf(
      sql,
      "two-factor",
      "ops_reset_mfa",
      async (tx) => {
        const note = "Checked their student card over a video call.";
        for (let i = 0; i < 10; i++) await tx`insert into identity.mfa_backup_codes (user_id, code_hash) values (${PEER}, ${"golden-" + i})`;
        const reset = (actor: string, aal: "aal1" | "aal2", userId: string, identityNote: string) => (sp: Tx) =>
          as(sp, actor, aal).then((a) => opsResetMfa(sp, a, { userId, identityNote }));
        const out = {
          reset: await step(tx, reset(ADMIN, "aal2", PEER, note)),
          no_factor_left: await call(tx, reset(ADMIN, "aal2", PEER, note)),
          short_note: await call(tx, reset(ADMIN, "aal2", MOD, "ok")),
          self: await call(tx, reset(ADMIN, "aal2", ADMIN, note)),
          unknown_account: await call(tx, reset(ADMIN, "aal2", NEWBIE, note)),
          admin_without_aal2: await call(tx, reset(ADMIN, "aal1", MOD, note)),
          moderator: await call(tx, reset(MOD, "aal2", ADMIN, note)),
        };
        // notify's half travels as an event (ids and a date only).
        const [event] = await tx<{ payload: Record<string, unknown> }[]>`
          select payload from platform.events where type = 'user.mfa_reset' and ${PEER}::uuid = any(subjects)`;
        expect(Object.keys(event!.payload)).toEqual(["reset_at"]);
        return out;
      },
      identityHalf,
    ));
});
