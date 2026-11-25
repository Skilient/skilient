/**
 * Account deletion on both transports (step 11): RequestAccountDeletion and CancelAccountDeletion, then the
 * hourly run, `user.deleted`, the confirmations other services send (applied once each), and the daily check
 * that reports services that have not confirmed after 24 hours.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Code, ConnectError } from "@connectrpc/connect";
import { IdentityService } from "@skilient/contracts/identity/v1/identity_pb";
import { appendEvents, refusalReason, type Logger } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, expect, it } from "vitest";
import { accountDeletionRun, CONFIRMING_SERVICES, deletionCheck, deletionJobs, deletionSchedules, drainDeletionConfirmations } from "../../src/store/deletion";
import { onboarded, staffWorld, type StaffWorld } from "./staff-world";
import { createUser, stopWorlds, type World } from "./world";

const worlds: World[] = [];
let w: StaffWorld;
afterAll(() => stopWorlds(worlds));

const reason = (e: unknown) => refusalReason(e) ?? `code ${ConnectError.from(e).code}`;

function memoryLogger(lines: { msg: string; fields: Record<string, unknown> }[]): Logger {
  const log = (msg: string, fields: Record<string, unknown> = {}) => void lines.push({ msg, fields });
  const logger: Logger = { debug: log, info: log, warn: log, error: log, child: () => logger };
  return logger;
}

describeTransports(
  ["identity"],
  (env) => {
    const id = () => env().client(IdentityService);
    const as = (token: string, key?: string) => ({ ...env().call({ userToken: token }), ...(key ? { headers: { "idempotency-key": key } } : {}) });
    const t = () => env().transport;
    let n = 0;
    const student = async (tag: string, isOnboarded = true) => {
      const uid = await createUser(w.sql, `${tag}-${t()}-${++n}@golden-uni.test`, "Right-Passw0rd-123");
      if (isOnboarded) await onboarded(w.sql, uid);
      return uid;
    };

    it("requests deletion in 14 days, returns the same date when asked again, and cancels", async () => {
      const me = await student("del");
      const token = await w.token(me, "aal1");
      const first = await id().requestAccountDeletion({}, as(token));
      const when = new Date(first.deleteAfter).getTime();
      expect(Math.abs(when - (Date.now() + 14 * 24 * 3600 * 1000))).toBeLessThan(60_000);
      expect((await id().requestAccountDeletion({}, as(token))).deleteAfter).toBe(first.deleteAfter);
      const [state] = await w.sql`select status from identity.users where id = ${me}`;
      expect(state?.["status"]).toBe("deleting");
      await id().cancelAccountDeletion({}, as(token));
      await expect(id().cancelAccountDeletion({}, as(token))).rejects.toSatisfy((e) => reason(e) === "no deletion is pending");
      const types = await w.sql<{ type: string }[]>`select type from platform.events where ${me}::uuid = any(subjects) and type like 'user.deletion_%' order by seq`;
      expect(types.map((r) => r.type)).toEqual(["user.deletion_requested", "user.deletion_cancelled"]);
    });

    it("refuses a signed-out caller, an account still onboarding, a staff account, and other services", async () => {
      await expect(id().requestAccountDeletion({}, env().call())).rejects.toSatisfy((e) => ConnectError.from(e).code === Code.Unauthenticated);
      await expect(id().cancelAccountDeletion({}, env().call())).rejects.toSatisfy((e) => ConnectError.from(e).code === Code.Unauthenticated);
      const newbie = await student("del-newbie", false);
      await expect(id().requestAccountDeletion({}, as(await w.token(newbie, "aal1")))).rejects.toSatisfy((e) => reason(e) === "finish onboarding first");
      const staff = await student("del-staff");
      await w.sql`insert into identity.staff_roles (user_id, role) values (${staff}, 'moderator')`;
      await expect(id().requestAccountDeletion({}, as(await w.token(staff)))).rejects.toSatisfy((e) => reason(e) === "staff accounts are removed by a super admin");
      const me = await student("del-caller");
      await expect(env().client(IdentityService, "trust").requestAccountDeletion({}, as(await w.token(me, "aal1")))).rejects.toSatisfy(
        (e) => reason(e) === "caller_not_allowed",
      );
    });

    it("the hourly run deletes due accounts, emits user.deleted, and confirmations are applied once", async () => {
      if (t() !== "memory") return; // jobs and events, not a transport concern: run once
      expect(deletionSchedules).toEqual([
        { name: "account-deletion", cron: "17 * * * *" },
        { name: "account-deletion-check", cron: "41 4 * * *" },
      ]);
      const due = await student("due");
      const later = await student("later");
      await w.sql`insert into identity.security_events (id, user_id, kind) values (gen_random_uuid(), ${due}, 'sign_in')`;
      await w.sql`update identity.users set status = 'deleting', delete_after = now() - interval '1 minute' where id = ${due}`;
      await w.sql`update identity.users set status = 'deleting', delete_after = now() + interval '1 day' where id = ${later}`;
      const lines: { msg: string; fields: Record<string, unknown> }[] = [];
      const logger = memoryLogger(lines);
      const jobs = deletionJobs({ sql: w.sql, logger } as never);
      await w.sql.begin((tx) => jobs["account-deletion"]!(tx, { id: "j1", kind: "account-deletion", payload: {}, attempts: 1 } as never));
      expect(await w.sql`select 1 from identity.users where id = ${due}`).toHaveLength(0);
      expect(await w.sql`select 1 from identity.security_events where user_id = ${due}`).toHaveLength(0);
      expect(await w.sql`select 1 from identity.users where id = ${later}`).toHaveLength(1);
      const [deleted] = await w.sql<{ payload: Record<string, unknown> }[]>`select payload from platform.events where type = 'user.deleted' and ${due}::uuid = any(subjects)`;
      expect(deleted!.payload).toEqual({ user_id: due });
      expect(lines.find((l) => l.msg === "deletion.run")?.fields["deleted"]).toBe(1);
      expect(await w.sql.begin((tx) => accountDeletionRun(tx))).toBe(0); // nothing else is due

      // Two services confirm (people twice); an unknown service and an account never deleted are ignored.
      const people = await w.pg.service("people", mkdtempSync(join(tmpdir(), "mig-")));
      const trust = await w.pg.service("trust", mkdtempSync(join(tmpdir(), "mig-")));
      const realtime = await w.pg.service("realtime", mkdtempSync(join(tmpdir(), "mig-")));
      const confirm = (db: typeof people, user: string) =>
        db.begin((tx) => appendEvents(tx, [{ type: "user.deletion_confirmed", subjects: [user], payload: { user_id: user } }]));
      await confirm(people, due);
      await confirm(people, due);
      await confirm(trust, due);
      await confirm(realtime, due);
      await confirm(people, later);
      expect(await drainDeletionConfirmations(w.sql, logger)).toBe(5);
      expect(await drainDeletionConfirmations(w.sql, logger)).toBe(0); // the cursor moved on
      const confirmed = await w.sql<{ service: string }[]>`select service from identity.deletion_confirmations where user_id = ${due} order by service`;
      expect(confirmed.map((r) => r.service)).toEqual(["people", "trust"]);
      expect(lines.some((l) => l.msg === "deletion.confirmation_ignored")).toBe(true);

      // Before 24 hours nothing is reported; after, the missing services are named (no user id in the line).
      expect((await w.sql.begin((tx) => deletionCheck(tx, logger))).unconfirmed).toBe(0);
      await w.sql`update identity.deleted_accounts set deleted_at = now() - interval '25 hours' where user_id = ${due}`;
      lines.length = 0;
      await w.sql.begin((tx) => jobs["account-deletion-check"]!(tx, { id: "j2", kind: "account-deletion-check", payload: {}, attempts: 1 } as never));
      const report = lines.find((l) => l.msg === "deletion.unconfirmed")!;
      expect(report.fields["accounts"]).toBe(1);
      expect(String(report.fields["services"]).split(",")).toEqual(CONFIRMING_SERVICES.filter((s) => s !== "people" && s !== "trust").sort());
      expect(JSON.stringify(report)).not.toContain(due);

      // Once every service has confirmed and 30 days have passed, the record goes.
      await w.sql`insert into identity.deletion_confirmations (user_id, service, event_id)
                  select ${due}, s, gen_random_uuid() from unnest(${[...CONFIRMING_SERVICES]}::text[]) s on conflict do nothing`;
      await w.sql`update identity.deleted_accounts set deleted_at = now() - interval '31 days' where user_id = ${due}`;
      expect(await w.sql.begin((tx) => deletionCheck(tx))).toMatchObject({ unconfirmed: 0, purged: 1 });
      await Promise.all([people.end(), trust.end(), realtime.end()]);
    });
  },
  staffWorld((x) => (w = x), worlds),
);
