/**
 * Staff roles and the two-factor reset on both transports (step 9): OpsStaff, GrantStaffRole, RevokeStaffRole,
 * OpsResetMfa. Every staff method refuses a signed-out caller, an aal1 session and a missing role; every
 * write leaves one audit row with its before and after state and an `audit.recorded` event; role changes and
 * resets bump the target's token version, so their old tokens stop working within a second (decision Q11).
 */
import { Code, ConnectError } from "@connectrpc/connect";
import { IdentityService, StaffRole } from "@skilient/contracts/identity/v1/identity_pb";
import { refusalReason, uuidv7 } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, expect, it } from "vitest";
import { memoryOutbox } from "../../src/deps";
import { revokeStaffRole } from "../../src/store/staff";
import { addFactor, refusedWithin, staffWorld, type StaffWorld } from "./staff-world";
import { createUser, DEVICE, IP, stopWorlds, type World } from "./world";

const worlds: World[] = [];
let w: StaffWorld;
afterAll(() => stopWorlds(worlds));

const reason = (e: unknown) => refusalReason(e) ?? `code ${ConnectError.from(e).code}`;
const unauthenticated = (e: unknown) => ConnectError.from(e).code === Code.Unauthenticated;

describeTransports(
  ["identity"],
  (env) => {
    const id = () => env().client(IdentityService);
    const as = (token: string, key?: string) => ({ ...env().call({ userToken: token }), ...(key ? { headers: { "idempotency-key": key } } : {}) });
    const t = () => env().transport;
    let n = 0;
    const account = async (tag: string, opts: { roles?: string[]; factor?: boolean } = {}) => {
      const email = `${tag}-${t()}-${++n}@golden-uni.test`;
      const uid = await createUser(w.sql, email, "Right-Passw0rd-123", { roles: opts.roles });
      if (opts.factor ?? true) await addFactor(w.sql, uid);
      return { id: uid, email };
    };
    const auditRows = async (action: string, target: string) =>
      w.sql<{ staff_id: string; before: unknown; after: unknown; reason: string }[]>`
        select staff_id::text, before, after, reason from identity.audit_log where action = ${action} and target_id = ${target}`;
    const auditEvents = async (target: string) =>
      (await w.sql`select 1 from platform.events where type = 'audit.recorded' and payload->>'target_id' = ${target}`).length;

    it("OpsStaff lists staff for a super admin at aal2 only", async () => {
      const admin = await account("ops-admin", { roles: ["super_admin"] });
      const mod = await account("ops-mod", { roles: ["moderator"] });
      const r = await id().opsStaff({}, as(await w.token(admin.id)));
      const me = r.members.find((m) => m.userId === admin.id)!;
      expect(me).toMatchObject({ email: admin.email, roles: [StaffRole.SUPER_ADMIN], isMe: true, twoFactor: true });
      expect(r.members.find((m) => m.userId === mod.id)).toMatchObject({ roles: [StaffRole.MODERATOR], isMe: false });
      await expect(id().opsStaff({}, as(await w.token(admin.id, "aal1")))).rejects.toSatisfy((e) => reason(e) === "super admins only, with two-factor on");
      await expect(id().opsStaff({}, as(await w.token(mod.id)))).rejects.toSatisfy((e) => reason(e) === "super admins only, with two-factor on");
      await expect(id().opsStaff({}, env().call())).rejects.toSatisfy(unauthenticated);
      await expect(env().client(IdentityService, "trust").opsStaff({}, as(await w.token(admin.id)))).rejects.toSatisfy((e) => reason(e) === "caller_not_allowed");
    });

    it("GrantStaffRole: two-factor required, audited, idempotent, and the target's old token is revoked", async () => {
      const admin = await account("grant-admin", { roles: ["super_admin"] });
      const target = await account("grant-target");
      const noFactor = await account("grant-nofactor", { factor: false });
      const adminToken = await w.token(admin.id);
      const grant = (email: string, key?: string, role = StaffRole.TRUST_REVIEWER) =>
        id().grantStaffRole({ email, role, reason: "Joins the trust team." }, as(adminToken, key));

      await expect(grant(noFactor.email)).rejects.toSatisfy((e) => reason(e) === "that account has no two-factor set up");
      await expect(grant(`nobody-${t()}@golden-uni.test`)).rejects.toSatisfy((e) => reason(e) === "no account with that email");
      await expect(id().grantStaffRole({ email: target.email, role: StaffRole.ACCOUNTS, reason: " " }, as(adminToken))).rejects.toSatisfy(
        (e) => reason(e) === "give a reason",
      );
      await expect(grant(target.email, undefined, StaffRole.UNSPECIFIED)).rejects.toSatisfy((e) => reason(e) === "choose a role");
      const targetToken = await w.token(target.id, "aal1");
      await id().backupCodesRemaining({}, as(targetToken));
      const key = `grant-${t()}-key-0001`;
      const first = await grant(target.email, key);
      expect(first.userId).toBe(target.id);
      expect((await grant(target.email, key)).userId).toBe(target.id); // a repeat returns the first reply
      await expect(grant(target.email)).rejects.toSatisfy((e) => reason(e) === "that account already has this role");

      const rows = await auditRows("staff.grant", target.id);
      expect(rows.at(-1)).toMatchObject({ staff_id: admin.id, before: { roles: [] }, after: { roles: ["trust_reviewer"] }, reason: "Joins the trust team." });
      expect(await auditEvents(target.id)).toBe(rows.length);
      expect(
        await refusedWithin(1_000, () => id().backupCodesRemaining({}, as(targetToken)).catch((e: unknown) => {
          if (unauthenticated(e)) throw e;
        })),
      ).toBe(true);
    });

    it("GrantStaffRole and RevokeStaffRole refuse aal1, a moderator and a signed-out caller", async () => {
      const admin = await account("refuse-admin", { roles: ["super_admin"] });
      const mod = await account("refuse-mod", { roles: ["moderator"] });
      const target = await account("refuse-target", { roles: ["accounts"] });
      for (const token of [await w.token(admin.id, "aal1"), await w.token(mod.id)]) {
        await expect(id().grantStaffRole({ email: target.email, role: StaffRole.MODERATOR, reason: "Needed." }, as(token))).rejects.toSatisfy(
          (e) => reason(e) === "super admins only, with two-factor on",
        );
        await expect(id().revokeStaffRole({ userId: target.id, role: StaffRole.ACCOUNTS, reason: "Needed." }, as(token))).rejects.toSatisfy(
          (e) => reason(e) === "super admins only, with two-factor on",
        );
      }
      await expect(id().revokeStaffRole({ userId: target.id, role: StaffRole.ACCOUNTS, reason: "Needed." }, env().call())).rejects.toSatisfy(unauthenticated);
      expect(await auditRows("staff.revoke", target.id)).toHaveLength(0);
    });

    it("RevokeStaffRole: audited, never your own super admin role, never the last super admin", async () => {
      const admin = await account("revoke-admin", { roles: ["super_admin"] });
      const target = await account("revoke-target", { roles: ["moderator"] });
      const adminToken = await w.token(admin.id);
      await expect(id().revokeStaffRole({ userId: admin.id, role: StaffRole.SUPER_ADMIN, reason: "Stepping down." }, as(adminToken))).rejects.toSatisfy(
        (e) => reason(e) === "you can't remove your own super admin role",
      );
      const tvBefore = (await w.sql<{ tv: number }[]>`select token_version as tv from identity.users where id = ${target.id}`)[0]!.tv;
      await id().revokeStaffRole({ userId: target.id, role: StaffRole.MODERATOR, reason: "Left the team." }, as(adminToken));
      await expect(id().revokeStaffRole({ userId: target.id, role: StaffRole.MODERATOR, reason: "Left the team." }, as(adminToken))).rejects.toSatisfy(
        (e) => reason(e) === "that account doesn't have this role",
      );
      expect((await w.sql<{ tv: number }[]>`select token_version as tv from identity.users where id = ${target.id}`)[0]!.tv).toBe(tvBefore + 1);
      expect(await auditRows("staff.revoke", target.id)).toEqual([
        expect.objectContaining({ staff_id: admin.id, before: { roles: ["moderator"] }, after: { roles: [] } }),
      ]);
    });

    it("the last super admin can't be removed (an actor whose own role was removed meanwhile)", async () => {
      if (t() !== "memory") return; // a store-level race, checked once
      const only = await account("last-admin", { roles: [] });
      // Make `only` the one super admin left in this database for the duration of the check.
      await w.sql.begin(async (tx) => {
        await tx`delete from identity.staff_roles where role = 'super_admin'`;
        await tx`insert into identity.staff_roles (user_id, role) values (${only.id}, 'super_admin')`;
        // A second super admin who was demoted after loading their session still carries the role in memory.
        const stale = { id: uuidv7(), aal: "aal2" as const, staffRoles: ["super_admin" as const] };
        await expect(revokeStaffRole(tx, stale, { userId: only.id, role: "super_admin", reason: "Removing." })).rejects.toSatisfy(
          (e) => reason(e) === "the last super admin can't be removed",
        );
        throw new Error("rollback");
      }).catch((e: unknown) => {
        if (!(e instanceof Error && e.message === "rollback")) throw e;
      });
    });

    it("two super admins revoking each other at once leave exactly one", async () => {
      const a = await account("race-a", { roles: ["super_admin"] });
      const b = await account("race-b", { roles: ["super_admin"] });
      await w.sql`delete from identity.staff_roles where role = 'super_admin' and user_id not in (${a.id}, ${b.id})`;
      const [ta, tb] = [await w.token(a.id), await w.token(b.id)];
      const results = await Promise.allSettled([
        id().revokeStaffRole({ userId: b.id, role: StaffRole.SUPER_ADMIN, reason: "Race." }, as(ta)),
        id().revokeStaffRole({ userId: a.id, role: StaffRole.SUPER_ADMIN, reason: "Race." }, as(tb)),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const refused = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
      expect(["the last super admin can't be removed", "super admins only, with two-factor on"]).toContain(reason(refused.reason));
      const [left] = await w.sql<{ n: number }[]>`select count(*)::int as n from identity.staff_roles where role = 'super_admin'`;
      expect(left!.n).toBe(1);
    });

    it("OpsResetMfa removes factors and codes, ends sessions, emails once, and is audited", async () => {
      const admin = await account("reset-admin", { roles: ["super_admin"] });
      const user = await account("reset-user");
      await w.sql`insert into identity.mfa_backup_codes (user_id, code_hash) values (${user.id}, 'h1'), (${user.id}, 'h2')`;
      const session = (
        await id().signInPassword({ email: user.email, password: "Right-Passw0rd-123", deviceHash: DEVICE, ipHash: IP, userAgent: "contract/1.0" }, env().call())
      ).session;
      const adminToken = await w.token(admin.id);
      const note = "Checked their student card over a video call.";
      await expect(id().opsResetMfa({ userId: user.id, identityNote: "too short" }, as(adminToken))).rejects.toSatisfy(
        (e) => reason(e) === "write down how you checked who they are (at least 20 characters)",
      );
      await expect(id().opsResetMfa({ userId: admin.id, identityNote: note }, as(adminToken))).rejects.toSatisfy(
        (e) => reason(e) === "you can't reset your own two-factor here",
      );
      await expect(id().opsResetMfa({ userId: user.id, identityNote: note }, as(await w.token(admin.id, "aal1")))).rejects.toSatisfy(
        (e) => reason(e) === "super admins only, with two-factor on",
      );
      const before = memoryOutbox.length;
      const key = `reset-${t()}-key-0001`;
      await id().opsResetMfa({ userId: user.id, identityNote: note }, as(adminToken, key));
      await id().opsResetMfa({ userId: user.id, identityNote: note }, as(adminToken, key)); // repeat: same reply, no second email
      const mails = memoryOutbox.slice(before).filter((m) => m.to === user.email);
      expect(mails.map((m) => m.kind)).toEqual(["mfa_reset"]);
      await expect(id().opsResetMfa({ userId: user.id, identityNote: note }, as(adminToken))).rejects.toSatisfy(
        (e) => reason(e) === "this account has no two-factor to reset",
      );
      const [left] = await w.sql<{ f: number; c: number }[]>`
        select (select count(*)::int from identity.totp_factors where user_id = ${user.id}) as f,
               (select count(*)::int from identity.mfa_backup_codes where user_id = ${user.id}) as c`;
      expect(left).toEqual({ f: 0, c: 0 });
      if (session) await expect(id().refresh({ refreshToken: session.refreshToken }, env().call())).rejects.toSatisfy((e) => reason(e) === "refresh_token_invalid");
      expect(await auditRows("user.mfa_reset", user.id)).toEqual([
        expect.objectContaining({ staff_id: admin.id, reason: note, before: { factors: 1, backup_codes: 2 }, after: expect.objectContaining({ factors: 0, backup_codes: 0 }) }),
      ]);
      const [event] = await w.sql<{ payload: Record<string, unknown> }[]>`select payload from platform.events where type = 'user.mfa_reset' and ${user.id}::uuid = any(subjects)`;
      expect(Object.keys(event!.payload)).toEqual(["reset_at"]);
    });
  },
  staffWorld((x) => (w = x), worlds),
);
