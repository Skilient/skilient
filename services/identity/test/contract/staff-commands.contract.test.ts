/**
 * The commands other services call (step 10), on both transports: SanctionUser and LiftSanction (trust only),
 * CompleteGithubLink and DisconnectGithub (work only). Trust forwards the acting staff member's access token;
 * identity reads the actor from that verified token and re-checks the role and two-factor level itself.
 * Includes the ban path's refusal tests (decision 2026-11-25).
 */
import { randomUUID } from "node:crypto";
import { Code, ConnectError } from "@connectrpc/connect";
import { IdentityService } from "@skilient/contracts/identity/v1/identity_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, expect, it } from "vitest";
import { addFactor, refusedWithin, staffWorld, type StaffWorld } from "./staff-world";
import { createUser, DEVICE, IP, stopWorlds, type World } from "./world";

const worlds: World[] = [];
let w: StaffWorld;
afterAll(() => stopWorlds(worlds));

const reason = (e: unknown) => refusalReason(e) ?? `code ${ConnectError.from(e).code}`;
const unauthenticated = (e: unknown) => ConnectError.from(e).code === Code.Unauthenticated;
const days = (n: number) => new Date(Date.now() + n * 24 * 3600 * 1000).toISOString();

describeTransports(
  ["identity"],
  (env) => {
    const web = () => env().client(IdentityService);
    const trust = () => env().client(IdentityService, "trust");
    const work = () => env().client(IdentityService, "work");
    const as = (token: string) => env().call({ userToken: token });
    const t = () => env().transport;
    let n = 0;
    const account = async (tag: string, roles: string[] = []) => {
      const email = `${tag}-${t()}-${++n}@golden-uni.test`;
      const uid = await createUser(w.sql, email, "Right-Passw0rd-123", { roles });
      if (roles.length) await addFactor(w.sql, uid);
      return { id: uid, email };
    };
    const signIn = async (email: string) => {
      const r = await web().signInPassword({ email, password: "Right-Passw0rd-123", deviceHash: DEVICE, ipHash: IP, userAgent: "contract/1.0" }, env().call());
      expect(r.session).toBeDefined();
      return r.session!;
    };
    const user = async (userId: string) =>
      (await w.sql<{ banned_until: Date | null; tv: number; live: number }[]>`
        select banned_until, token_version as tv,
               (select count(*)::int from identity.sessions s where s.user_id = u.id and s.revoked_at is null) as live
          from identity.users u where id = ${userId}`)[0]!;

    it("only trust may sanction and only work may record GitHub links", async () => {
      const admin = await account("callers-admin", ["super_admin"]);
      const target = await account("callers-target");
      const token = await w.token(admin.id);
      const sanction = { userId: target.id, kind: "warn", reason: "Please keep it civil.", sanctionId: randomUUID() };
      await expect(web().sanctionUser(sanction, as(token))).rejects.toSatisfy((e) => reason(e) === "caller_not_allowed");
      await expect(work().sanctionUser(sanction, as(token))).rejects.toSatisfy((e) => reason(e) === "caller_not_allowed");
      await expect(web().liftSanction({ userId: target.id, sanctionId: sanction.sanctionId, reason: "Lifted." }, as(token))).rejects.toSatisfy(
        (e) => reason(e) === "caller_not_allowed",
      );
      await expect(web().completeGithubLink({ userId: target.id, githubLogin: "octo" }, env().call())).rejects.toSatisfy((e) => reason(e) === "caller_not_allowed");
      await expect(trust().disconnectGithub({ userId: target.id, githubLogin: "octo" }, env().call())).rejects.toSatisfy((e) => reason(e) === "caller_not_allowed");
    });

    it("ban path refusals: no staff token, aal1, a student, a moderator ban, self, bad input", async () => {
      const admin = await account("refuse-admin", ["super_admin"]);
      const mod = await account("refuse-mod", ["moderator"]);
      const student = await account("refuse-student");
      const target = await account("refuse-target");
      const ban = (token: string | null, userId = target.id, extra: Partial<{ kind: string; until: string; reason: string }> = {}) =>
        trust().sanctionUser(
          { userId, kind: "ban", until: "", reason: "Repeated harassment.", sanctionId: randomUUID(), ...extra },
          token ? as(token) : env().call(),
        );
      await expect(ban(null)).rejects.toSatisfy(unauthenticated);
      await expect(ban(await w.token(admin.id, "aal1"))).rejects.toSatisfy((e) => reason(e) === "moderators only, with two-factor on");
      await expect(ban(await w.token(student.id))).rejects.toSatisfy((e) => reason(e) === "moderators only, with two-factor on");
      await expect(ban(await w.token(mod.id))).rejects.toSatisfy((e) => reason(e) === "only a super admin can ban an account");
      const adminToken = await w.token(admin.id);
      await expect(ban(adminToken, admin.id)).rejects.toSatisfy((e) => reason(e) === "you can't sanction your own account");
      await expect(ban(adminToken, target.id, { reason: " " })).rejects.toSatisfy((e) => reason(e) === "give a reason");
      await expect(ban(adminToken, target.id, { kind: "delete" })).rejects.toSatisfy((e) => reason(e) === "choose warn, suspend or ban");
      await expect(ban(adminToken, target.id, { until: "2000-01-01T00:00:00Z" })).rejects.toSatisfy(
        (e) => reason(e) === "the ban must end in the future, or leave the end empty for a permanent ban",
      );
      await expect(ban(adminToken, randomUUID())).rejects.toSatisfy((e) => reason(e) === "account not found");
      await expect(ban(adminToken, target.id, { until: "tomorrow" })).rejects.toSatisfy((e) => reason(e) === "invalid_input");
      expect(await user(target.id)).toMatchObject({ banned_until: null, tv: 0 });
      const [audits] = await w.sql<{ n: number }[]>`select count(*)::int as n from identity.audit_log where target_id = ${target.id}`;
      expect(audits!.n).toBe(0);
    });

    it("a ban ends every session, revokes tokens within a second, is audited, and lifts", async () => {
      const admin = await account("ban-admin", ["super_admin"]);
      const mod = await account("ban-mod", ["moderator"]);
      const target = await account("ban-target");
      const session = await signIn(target.email);
      const targetToken = session.accessToken;
      await web().backupCodesRemaining({}, as(targetToken));
      const adminToken = await w.token(admin.id);
      const sanctionId = randomUUID();
      await trust().sanctionUser({ userId: target.id, kind: "ban", until: "", reason: "Repeated harassment.", sanctionId }, as(adminToken));
      const banned = await user(target.id);
      expect(banned.banned_until?.toISOString()).toBe("2999-12-31T00:00:00.000Z");
      expect(banned.live).toBe(0);
      expect(
        await refusedWithin(1_000, () => web().backupCodesRemaining({}, as(targetToken)).catch((e: unknown) => {
          if (unauthenticated(e)) throw e;
        })),
      ).toBe(true);
      await expect(web().refresh({ refreshToken: session.refreshToken }, env().call())).rejects.toSatisfy((e) => reason(e) === "refresh_token_invalid");
      await expect(
        trust().sanctionUser({ userId: target.id, kind: "ban", until: "", reason: "Again.", sanctionId: randomUUID() }, as(adminToken)),
      ).rejects.toSatisfy((e) => reason(e) === "this account already has an active ban; lift it first");
      const [ban] = await w.sql<{ staff_id: string; before: unknown; after: { sanction: { id: string } } }[]>`
        select staff_id::text, before, after from identity.audit_log where action = 'sanction.ban' and target_id = ${target.id}`;
      expect(ban).toMatchObject({ staff_id: admin.id, before: { active: null }, after: { sanction: { id: sanctionId, kind: "ban" } } });

      const lift = (token: string) => trust().liftSanction({ userId: target.id, sanctionId, reason: "Appeal upheld." }, as(token));
      await expect(lift(await w.token(mod.id))).rejects.toSatisfy((e) => reason(e) === "your role can't lift this sanction");
      await expect(lift(await w.token(admin.id, "aal1"))).rejects.toSatisfy((e) => reason(e) === "staff only, with two-factor on");
      await expect(trust().liftSanction({ userId: target.id, sanctionId: randomUUID(), reason: "Appeal upheld." }, as(adminToken))).rejects.toSatisfy(
        (e) => reason(e) === "sanction not found",
      );
      await lift(adminToken);
      expect((await user(target.id)).banned_until).toBeNull();
      await expect(lift(adminToken)).rejects.toSatisfy((e) => reason(e) === "that sanction was already lifted");
      const [lifted] = await w.sql`select staff_id::text from identity.audit_log where action = 'sanction.lift' and target_id = ${sanctionId}`;
      expect(lifted?.["staff_id"]).toBe(admin.id);
    });

    it("a moderator's suspension ends sessions without a ban; a warning changes nothing; a repeat is idempotent", async () => {
      const mod = await account("suspend-mod", ["moderator"]);
      const target = await account("suspend-target");
      const other = await account("warn-target");
      await signIn(target.email);
      await signIn(other.email);
      const modToken = await w.token(mod.id);
      await expect(
        trust().sanctionUser({ userId: target.id, kind: "suspend", until: days(8), reason: "Spam in chat.", sanctionId: randomUUID() }, as(modToken)),
      ).rejects.toSatisfy((e) => reason(e) === "moderators can suspend for at most 7 days");
      await expect(
        trust().sanctionUser({ userId: target.id, kind: "suspend", until: "", reason: "Spam in chat.", sanctionId: randomUUID() }, as(modToken)),
      ).rejects.toSatisfy((e) => reason(e) === "choose when the suspension ends");
      const call = { userId: target.id, kind: "suspend", until: days(3), reason: "Spam in chat.", sanctionId: randomUUID() };
      const options = { ...as(modToken), headers: { "idempotency-key": `suspend-${t()}-0001` } };
      await trust().sanctionUser(call, options);
      await trust().sanctionUser(call, options); // the same key: the first reply, applied once
      expect(await user(target.id)).toMatchObject({ banned_until: null, live: 0, tv: 1 });
      await expect(
        trust().sanctionUser({ ...call, sanctionId: randomUUID() }, as(modToken)),
      ).rejects.toSatisfy((e) => reason(e) === "this account already has an active suspend; lift it first");

      await expect(
        trust().sanctionUser({ userId: other.id, kind: "warn", until: days(1), reason: "Please keep it civil.", sanctionId: randomUUID() }, as(modToken)),
      ).rejects.toSatisfy((e) => reason(e) === "a warning has no end date");
      await trust().sanctionUser({ userId: other.id, kind: "warn", until: "", reason: "Please keep it civil.", sanctionId: randomUUID() }, as(modToken));
      expect(await user(other.id)).toMatchObject({ banned_until: null, live: 1, tv: 0 });
      const [warn] = await w.sql`select after from identity.audit_log where action = 'sanction.warn' and target_id = ${other.id}`;
      expect(warn?.["after"]).toMatchObject({ active: null, sanction: { kind: "warn" } });
    });

    it("work records GitHub link and unlink security events (the login is a public handle)", async () => {
      const student = await account("gh-student");
      await work().completeGithubLink({ userId: student.id, githubLogin: "golden-octo" }, env().call());
      await work().disconnectGithub({ userId: student.id, githubLogin: "golden-octo" }, env().call());
      const rows = await w.sql<{ kind: string; meta: unknown }[]>`
        select kind, meta from identity.security_events where user_id = ${student.id} and kind like 'github_%' order by created_at, kind`;
      expect(rows).toEqual([
        { kind: "github_connected", meta: { login: "golden-octo" } },
        { kind: "github_disconnected", meta: { login: "golden-octo" } },
      ]);
      await expect(work().completeGithubLink({ userId: student.id, githubLogin: "-bad-" }, env().call())).rejects.toSatisfy(
        (e) => reason(e) === "invalid GitHub login",
      );
      await expect(work().completeGithubLink({ userId: randomUUID(), githubLogin: "golden-octo" }, env().call())).rejects.toSatisfy(
        (e) => reason(e) === "account not found",
      );
      await expect(work().completeGithubLink({ userId: "nope", githubLogin: "golden-octo" }, env().call())).rejects.toSatisfy((e) => reason(e) === "invalid_input");
    });
  },
  staffWorld((x) => (w = x), worlds),
);
