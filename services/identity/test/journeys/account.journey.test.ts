/**
 * Journeys mirroring account deletion (apps/web/tests/e2e/student-portal.spec.ts) and the portals flag at
 * signup (portals.spec.ts), on both transports (decision 2026-11-25, Q5). Identity is driven only through
 * its contract; the portals flag arrives as trust's `config.portals_changed`, profile facts as people's
 * `profile.gate_changed`; the hourly deletion run is identity's own job handler.
 */
import { AccountRole, SignOutScope } from "@skilient/contracts/identity/v1/identity_pb";
import { createLogger } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, expect, it } from "vitest";
import type { ApiDeps } from "../../src/deps";
import { deletionJobs } from "../../src/store/deletion";
import { gateFlagsOf, journeyClient, journeyWorlds, NUTECH, publish, refusedWith } from "./journey";

const worlds = journeyWorlds();
afterAll(() => worlds.stop());

describeTransports(
  ["identity"],
  (env) => {
    const { id, as, unique, signUp, signIn, createStudent } = journeyClient(env);
    const w = () => worlds.current();
    worlds.stopEachTransport();
    const DAY = 24 * 3600 * 1000;

    // student-portal.spec.ts:274
    it("deleting an account: cooling-off, locked to one page, cancel restores it", async () => {
      const me = await createStudent(w(), { fullName: "Dana Delete" });
      const s = (await signIn(me.email)).session!;
      // Request: a 14-day cooling-off, and asking again keeps the date.
      const { deleteAfter } = await id().requestAccountDeletion({}, as(s.accessToken));
      expect(Math.abs(new Date(deleteAfter).getTime() - (Date.now() + 14 * DAY))).toBeLessThan(60_000);
      expect((await id().requestAccountDeletion({}, as(s.accessToken))).deleteAfter).toBe(deleteAfter);
      // Locked to one page: the gate (and every token minted from now on) says "deleting".
      expect((await id().getGateState({}, as(s.accessToken))).status).toBe("deleting");
      const locked = (await id().refresh({ refreshToken: s.refreshToken }, env().call())).session!;
      expect(gateFlagsOf(locked.accessToken)).toMatchObject({ status: "deleting" });
      // Cancel restores it.
      await id().cancelAccountDeletion({}, as(locked.accessToken));
      expect((await id().getGateState({}, as(locked.accessToken))).status).toBe("active");
      const restored = (await id().refresh({ refreshToken: locked.refreshToken }, env().call())).session!;
      expect(gateFlagsOf(restored.accessToken)).toMatchObject({ status: "active" });
      await expect(id().cancelAccountDeletion({}, as(restored.accessToken))).rejects.toSatisfy(refusedWith("no deletion is pending"));
      const types = await w().sql<{ type: string }[]>`select type from platform.events where ${me.id}::uuid = any(subjects) and type like 'user.deletion_%' order by seq`;
      expect(types.map((r) => r.type)).toEqual(["user.deletion_requested", "user.deletion_cancelled"]);
    });
    it.todo("W13: /settings/account/delete (typed username, axe), every other page redirecting there, and the nav coming back are web's");

    it("deleting an account: the hourly run deletes it when due and emits user.deleted", async () => {
      const me = await createStudent(w(), { fullName: "Gone Soon" });
      const s = (await signIn(me.email)).session!;
      await id().requestAccountDeletion({}, as(s.accessToken));
      const run = async () => {
        const jobs = deletionJobs({ sql: w().sql, logger: createLogger({ level: "error", write: () => {} }) } as unknown as ApiDeps);
        await w().sql.begin((tx) => jobs["account-deletion"]!(tx, { id: `run-${Date.now()}`, kind: "account-deletion", payload: {}, attempts: 1 } as never));
      };
      // Not due yet: the hourly run leaves it alone.
      await run();
      expect(await w().sql`select status from identity.users where id = ${me.id}`).toEqual([{ status: "deleting" }]);
      // Fourteen days later (the test moves the clock by moving the date back).
      await w().sql`update identity.users set delete_after = now() - interval '1 minute' where id = ${me.id}`;
      await run();
      expect(await w().sql`select 1 from identity.users where id = ${me.id}`).toEqual([]);
      const [deleted] = await w().sql<{ payload: Record<string, unknown>; producer: string }[]>`
        select payload, producer from platform.events where type = 'user.deleted' and ${me.id}::uuid = any(subjects)`;
      expect(deleted).toEqual({ payload: { user_id: me.id }, producer: "svc_identity" });
      // Nothing of the account is left to sign in with.
      await expect(signIn(me.email)).rejects.toSatisfy(refusedWith("invalid_credentials"));
      await expect(id().refresh({ refreshToken: s.refreshToken }, env().call())).rejects.toSatisfy(refusedWith("refresh_token_invalid"));
    });

    // portals.spec.ts:34
    it("the signup hook refuses recruiter and official accounts", async () => {
      const tag = `${env().transport}-${Date.now().toString(36)}`;
      await publish(w(), "trust", "config.portals_changed", { recruiter: false, university: false, faculty: true });
      await expect(signUp(`rita-${tag}@acme-${tag}.test`, { role: AccountRole.RECRUITER })).rejects.toSatisfy(refusedWith("recruiter_portal_closed")); // "Recruiter accounts aren't open yet."
      await expect(signUp(`off-${tag}@${NUTECH.domain}`, { role: AccountRole.UNIVERSITY_ADMIN })).rejects.toSatisfy(refusedWith("university_portal_closed")); // "University accounts aren't open yet."
      expect(await w().sql`select 1 from identity.users where email in (${`rita-${tag}@acme-${tag}.test`}, ${`off-${tag}@${NUTECH.domain}`})`).toEqual([]);
      // A signed-in student's gate shows both portals closed.
      const student = await createStudent(w());
      expect((await id().getGateState({}, as(student.session.accessToken))).portals).toMatchObject({ recruiter: false, university: false });
    });
    it.todo("W13: portal routes answer 404, organisation signups go to Talk to us, and students see no recruiter parts (web routes)");

    // portals.spec.ts:67
    it("switching the flag back restores routes and signup", async () => {
      const tag = `${env().transport}-${Date.now().toString(36)}`;
      await publish(w(), "trust", "config.portals_changed", { recruiter: true, university: true, faculty: true });
      const recruiter = await signUp(`rita-${tag}@acme-${tag}.test`, { role: AccountRole.RECRUITER });
      expect(recruiter.verificationSent).toBe(true);
      const official = await signUp(`off-${tag}@${NUTECH.domain}`, { role: AccountRole.UNIVERSITY_ADMIN });
      expect(official.verificationSent).toBe(true);
      const roles = await w().sql<{ role: string }[]>`select role from identity.users where id in (${recruiter.userId}, ${official.userId}) order by role`;
      expect(roles.map((r) => r.role)).toEqual(["recruiter", "university_admin"]);
      // A recruiter still needs a company address while the portal is open.
      await expect(signUp(unique(NUTECH.domain, "rita"), { role: AccountRole.RECRUITER })).rejects.toSatisfy(refusedWith("university_email"));
      const student = await createStudent(w());
      expect((await id().getGateState({}, as(student.session.accessToken))).portals).toMatchObject({ recruiter: true, university: true });
      // Back off for the rest of the file, as the @portals pass switches it back.
      await publish(w(), "trust", "config.portals_changed", { recruiter: false, university: false, faculty: true });
      await id().signOut({ scope: SignOutScope.LOCAL }, as(student.session.accessToken));
    });
    it.todo("W13: /signup/recruiter answers 200 and /uni/claim asks to sign in once the flag is on (web routes)");

    it("a portals flag from anyone but trust changes nothing", async () => {
      const tag = `${env().transport}-${Date.now().toString(36)}`;
      // people is not the flag's owner: the consumer skips its event, so recruiters stay closed.
      await publish(w(), "people", "config.portals_changed", { recruiter: true, university: true, faculty: true });
      await expect(signUp(`rita-${tag}@acme-${tag}.test`, { role: AccountRole.RECRUITER })).rejects.toSatisfy(refusedWith("recruiter_portal_closed"));
    });
  },
  worlds.options,
);
