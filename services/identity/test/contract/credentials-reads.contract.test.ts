/**
 * What identity added for credentials (W8): EmailsOf (address, confirmed, ban in force; credentials only) and
 * user.banned when a ban starts (credentials revokes every CV version and link; lifting it publishes nothing).
 */
import { randomUUID } from "node:crypto";
import { ConnectError } from "@connectrpc/connect";
import { IdentityService } from "@skilient/contracts/identity/v1/identity_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, expect, it } from "vitest";
import { addFactor, staffWorld, type StaffWorld } from "./staff-world";
import { createUser, stopWorlds, type World } from "./world";

const worlds: World[] = [];
let w: StaffWorld;
afterAll(() => stopWorlds(worlds));

const reason = (e: unknown) => refusalReason(e) ?? `code ${ConnectError.from(e).code}`;

describeTransports(
  ["identity"],
  (env) => {
    let n = 0;
    const account = async (tag: string, opts: { roles?: string[]; confirmed?: boolean } = {}) => {
      const email = `${tag}-${env().transport}-${++n}@golden-uni.test`;
      const id = await createUser(w.sql, email, "Right-Passw0rd-123", { roles: opts.roles ?? [], ...(opts.confirmed === false ? { confirmed: false } : {}) });
      if (opts.roles?.length) await addFactor(w.sql, id);
      return { id, email };
    };

    it("EmailsOf: credentials only; address, confirmed and a ban in force, one batch", async () => {
      const a = await account("emails-a");
      const b = await account("emails-b", { confirmed: false });
      const r = await env().client(IdentityService, "credentials").emailsOf({ userIds: [a.id, b.id, randomUUID()] }, env().call());
      expect(r.users.map((u) => [u.userId, u.email, u.confirmed, u.banned]).sort()).toEqual(
        [
          [a.id, a.email, true, false],
          [b.id, b.email, false, false],
        ].sort(),
      );
      await expect(env().client(IdentityService).emailsOf({ userIds: [a.id] }, env().call())).rejects.toSatisfy((e) => reason(e) === "caller_not_allowed");
    });

    it("a ban publishes user.banned and shows in EmailsOf; a warning publishes nothing", async () => {
      const admin = await account("ban-admin", { roles: ["super_admin"] });
      const target = await account("ban-target");
      const other = await account("warn-target");
      const trust = env().client(IdentityService, "trust");
      const as = { ...env().call({ userToken: await w.token(admin.id) }), headers: { "idempotency-key": randomUUID() } };
      await trust.sanctionUser({ userId: other.id, kind: "warn", until: "", reason: "Please keep it civil.", sanctionId: randomUUID() }, as);
      await trust.sanctionUser(
        { userId: target.id, kind: "ban", until: "", reason: "Repeated harassment.", sanctionId: randomUUID() },
        { ...as, headers: { "idempotency-key": randomUUID() } },
      );
      const events = await w.sql<{ payload: { user_id: string; until: string | null } }[]>`select payload from platform.events where type = 'user.banned' order by seq`;
      expect(events.map((e) => e.payload).filter((p) => [target.id, other.id].includes(p.user_id))).toEqual([{ user_id: target.id, until: null }]);
      const r = await env().client(IdentityService, "credentials").emailsOf({ userIds: [target.id] }, env().call());
      expect(r.users.map((u) => u.banned)).toEqual([true]);
    });
  },
  staffWorld((x) => (w = x), worlds),
);
