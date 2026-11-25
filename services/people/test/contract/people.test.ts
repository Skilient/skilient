/**
 * people's contract on both transports (memory and HTTP/2), co-hosted with identity: every method is
 * implemented, every caller rule holds, and each area answers through the contract as web (or market, or
 * another service) will call it. Golden replays (test/golden) pin the rules; these pin the wiring, the
 * events, the idempotency of writes and the calls people makes to identity.
 */
import { Code, ConnectError } from "@connectrpc/connect";
import { IdentityService } from "@skilient/contracts/identity/v1/identity_pb";
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import { refusalReason, RESTRICTED } from "@skilient/platform";
import { decodeJwt } from "jose";
import { describeTransports } from "@skilient/testing";
import { afterAll, expect, it } from "vitest";
import { loadGateData } from "../../../identity/src/store/gate";
import { applyCopyEvent } from "../../src/store/copies";
import { peopleYouMayKnow } from "../../src/store/search";
import { CLOSED, drainGate, NU, NUTECH, PASSWORD, PERSONAL_DOMAIN, peopleWorld, student, stopWorlds, unique, usernameOf, type PeopleWorld } from "./world";

const worlds: PeopleWorld[] = [];
let w: PeopleWorld;
afterAll(() => stopWorlds(worlds));

const reason = (e: unknown) => refusalReason(e) ?? `code ${ConnectError.from(e).code}`;
const code = (e: unknown) => ConnectError.from(e).code;

describeTransports(
  ["identity", "people"],
  (env) => {
    const people = (as = "web") => env().client(PeopleService, as);
    const asUser = (token: string, key?: string) => {
      const o = env().call({ userToken: token });
      return key ? { ...o, headers: { "idempotency-key": key } } : o;
    };
    const events = async (type: string, subject?: string) =>
      w.people<{ payload: Record<string, unknown> }[]>`
        select payload from platform.events where type = ${type} and (${subject ?? null}::uuid is null or ${subject ?? null}::uuid = any(subjects)) order by seq`;

    it("implements every method in the contract", async () => {
      for (const m of PeopleService.methods) {
        const caller = ["saveDepartment", "deleteDepartment", "saveProgramme", "deleteProgramme"].includes(m.localName) ? "market" : "web";
        const fn = (people(caller) as unknown as Record<string, (req: object, o: object) => Promise<unknown>>)[m.localName]!;
        const err = await fn({}, env().call()).then(
          () => null,
          (e: unknown) => e,
        );
        if (err) expect([m.localName, code(err)]).not.toEqual([m.localName, Code.Unimplemented]);
      }
    });

    it("refuses callers outside each method's list", async () => {
      await expect(people("web").saveDepartment({ universityId: NUTECH.id, name: "Physics" }, env().call())).rejects.toSatisfy((e) => code(e) === Code.PermissionDenied);
      await expect(people("content").getShell({}, env().call())).rejects.toSatisfy((e) => code(e) === Code.PermissionDenied);
      await expect(people("market").sendFriendRequest({ username: "x" }, env().call())).rejects.toSatisfy((e) => code(e) === Code.PermissionDenied);
      // The batch reads serve every service, in one call.
      const a = await student(w, { fullName: "Batch Person" });
      for (const caller of ["content", "messaging", "identity", "market"]) {
        const r = await people(caller).profileCards({ userIds: [a.id] }, env().call());
        expect(r.users.map((u) => [u.userId, u.fullName, u.universityId])).toEqual([[a.id, "Batch Person", NUTECH.id]]);
      }
      await expect(people("content").profileCards({ userIds: Array.from({ length: 501 }, () => a.id) }, env().call())).rejects.toSatisfy((e) => reason(e) === "invalid_input");
    });

    it("the shell: the viewer's card, the student tour and badges that follow the copies", async () => {
      const me = await student(w, { fullName: "Shell Student" });
      const friend = await student(w, { fullName: "Asker" });
      const s0 = await people().getShell({}, asUser(me.token));
      expect(s0.me).toMatchObject({ userId: me.id, fullName: "Shell Student", universityId: NUTECH.id, universityName: NUTECH.name, role: "student", status: "active", onboardingComplete: true });
      expect(s0.tour).toMatchObject({ started: false, step: 0 });
      expect(s0.badges).toMatchObject({ chat: 0, notifications: 0, friends: 0, ventures: 0, openings: 0 });
      await people().sendFriendRequest({ username: await usernameOf(w, me.id) }, asUser(friend.token, crypto.randomUUID()));
      // Notify publishes the unread count; people's copy follows (and drops it from anyone else).
      await w.people.begin(async (tx) => {
        expect(await applyCopyEvent(tx, { type: "badge.count_changed", producer: "svc_notify", version: 1, payload: { user_id: me.id, key: "notifications", count: 3 } })).toBe("applied");
        expect(await applyCopyEvent(tx, { type: "badge.count_changed", producer: "svc_content", version: 1, payload: { user_id: me.id, key: "notifications", count: 99 } })).toBe("wrong_producer");
        expect(await applyCopyEvent(tx, { type: "badge.count_changed", producer: "svc_notify", version: 1, payload: { user_id: me.id, key: "bogus", count: 1 } })).toBe("unknown_key");
      });
      const s1 = await people().getShell({}, asUser(me.token));
      expect(s1.badges).toMatchObject({ friends: 1, notifications: 3 });
      expect(await people().todoCounts({}, asUser(me.token))).toMatchObject({ total: 1, requests: 1 });
      expect((await people().nextBestAction({}, asUser(me.token))).key).toBe("join_venture");
      const g = await people().gettingStarted({}, asUser(me.token));
      expect([g.total, g.done, g.items.map((i) => i.key)]).toEqual([6, 0, ["profile", "github", "l2", "venture", "endorsement", "cv"]]);
      // Not onboarded: the shell has the card and no badges; the progress reads refuse.
      const newbie = await student(w, { onboard: false });
      const s2 = await people().getShell({}, asUser(newbie.token));
      expect([s2.me?.onboardingComplete, s2.badges, s2.tour]).toEqual([false, undefined, undefined]);
      await expect(people().todoCounts({}, asUser(newbie.token))).rejects.toSatisfy((e) => reason(e) === "finish_onboarding");
      await expect(people().getShell({}, env().call())).rejects.toSatisfy((e) => reason(e) === "not_signed_in");
    });

    it("profile view, people search and the username check keep no reply under their idempotency key", async () => {
      const viewer = await student(w, { fullName: "Counted Viewer" });
      const target = await student(w, { fullName: "Counted Target" });
      const name = await usernameOf(w, target.id);
      const keys = { profile: crypto.randomUUID(), search: crypto.randomUUID(), username: crypto.randomUUID() };
      await people().getProfile({ username: name }, asUser(viewer.token, keys.profile));
      await people().searchPeople({ q: "Counted" }, asUser(viewer.token, keys.search));
      await people().usernameAvailable({ username: "counted_free_name" }, asUser(viewer.token, keys.username));
      const rows = await w.people<{ key: string; status: string; has_reply: boolean }[]>`
        select key, status, response is not null as has_reply from platform.idempotency where key = any(${Object.values(keys)})`;
      expect(rows).toHaveLength(3);
      for (const r of rows) expect([r.status, r.has_reply]).toEqual(["done", false]);
      // A repeat of the same key is refused rather than answered from a stored copy.
      await expect(people().getProfile({ username: name }, asUser(viewer.token, keys.profile))).rejects.toSatisfy((e) => reason(e) === "already_applied");
    });

    it("profiles: full, card or not found by visibility and blocks; edits publish profile.updated without names", async () => {
      const owner = await student(w, { fullName: "Vis Owner" });
      const classmate = await student(w, { fullName: "Classmate" });
      const outsider = await student(w, { uni: NU, fullName: "Outsider" });
      const name = await usernameOf(w, owner.id);
      expect((await people().getProfile({ username: name }, asUser(classmate.token, crypto.randomUUID()))).result.case).toBe("full");
      const card = await people().getProfile({ username: name.toUpperCase() }, asUser(outsider.token, crypto.randomUUID()));
      expect(card.result).toMatchObject({ case: "card", value: { userId: owner.id, fullName: "Vis Owner" } });
      await people().updateProfile({ visibility: "global", bio: "Only for the right people", lookingFor: [], lookingForSet: false }, asUser(owner.token, crypto.randomUUID()));
      const full = await people().getProfile({ username: name }, asUser(outsider.token, crypto.randomUUID()));
      expect(full.result).toMatchObject({ case: "full", value: { bio: "Only for the right people", isOwner: false } });
      const [updated] = (await events("profile.updated", owner.id)).slice(-1);
      expect(updated!.payload).toMatchObject({ user_id: owner.id, visibility: "global" });
      expect(JSON.stringify(updated!.payload)).not.toMatch(/Vis Owner|right people/);
      // A taken username is refused with a reason web maps to today's wording.
      await expect(people().updateProfile({ username: await usernameOf(w, classmate.id), lookingFor: [], lookingForSet: false }, asUser(owner.token, crypto.randomUUID()))).rejects.toSatisfy(
        (e) => reason(e) === "username_taken",
      );
      // The same idempotency key returns the first reply and writes once.
      const key = crypto.randomUUID();
      const before = (await events("profile.updated", owner.id)).length;
      await people().updateProfile({ recruiterVisible: true, lookingFor: [], lookingForSet: false }, asUser(owner.token, key));
      await people().updateProfile({ recruiterVisible: true, lookingFor: [], lookingForSet: false }, asUser(owner.token, key));
      expect((await events("profile.updated", owner.id)).length).toBe(before + 1);
      // Blocked either way: not found.
      await people().blockUser({ username: await usernameOf(w, outsider.id) }, asUser(owner.token, crypto.randomUUID()));
      expect((await people().getProfile({ username: name }, asUser(outsider.token, crypto.randomUUID()))).result.case).toBe("notFound");
      const [blocked] = await events("block.changed", owner.id);
      expect(blocked!.payload).toEqual({ blocker_id: owner.id, blocked_id: outsider.id, blocked: true });
      const rel = await people("content").relations({ userId: owner.id, otherIds: [outsider.id, classmate.id] }, env().call());
      expect(rel.others.map((r) => [r.otherId, r.blocked, r.friends])).toEqual([
        [outsider.id, true, false],
        [classmate.id, false, false],
      ]);
    });

    it("onboarding through the contract: steps move forward, complete publishes the gate for identity", async () => {
      const s = await student(w, { onboard: false });
      const o = await people().getOnboarding({}, asUser(s.token));
      expect([o.step, o.completed, o.universities.map((u) => u.id), o.ownList, o.departments.map((d) => d.name)]).toEqual([1, false, [NUTECH.id], true, ["Computer Science", "Software Engineering"]]);
      await expect(
        people().saveUniversityStep({ universityId: "", department: "Mechanical", programme: "", graduationYear: 2028, campus: "" }, asUser(s.token, crypto.randomUUID())),
      ).rejects.toSatisfy((e) => reason(e) === "department_not_listed");
      expect((await people().saveUniversityStep({ universityId: "", department: "Computer Science", programme: "BS CS", graduationYear: 2028, campus: "" }, asUser(s.token, crypto.randomUUID()))).nextStep).toBe(2);
      const username = `on${Date.now().toString(36)}`;
      expect((await people().usernameAvailable({ username }, asUser(s.token, crypto.randomUUID()))).available).toBe(true);
      expect((await people().saveProfileStep({ username, bio: "Hi" }, asUser(s.token, crypto.randomUUID()))).nextStep).toBe(3);
      expect((await people().saveGithubStep({ choice: "later" }, asUser(s.token, crypto.randomUUID()))).nextStep).toBe(4);
      expect((await people().saveSkillsStep({}, asUser(s.token, crypto.randomUUID()))).nextStep).toBe(5);
      expect((await people().saveLookingForStep({ lookingFor: ["internship"], recruiterVisible: false }, asUser(s.token, crypto.randomUUID()))).nextStep).toBe(6);
      expect((await people().completeOnboarding({}, asUser(s.token, crypto.randomUUID()))).completed).toBe(true);
      const [gate] = (await events("profile.gate_changed", s.id)).slice(-1);
      expect(gate!.payload).toEqual({ user_id: s.id, has_profile: true, role: "student", university_id: NUTECH.id, onboarding_complete: true, onboarding_step: 6, status: "active" });
      await drainGate(w);
      const gateState = await env().client(IdentityService).getGateState({}, asUser(s.token));
      expect(gateState.onboardingComplete).toBe(true);
      await expect(people().saveGithubStep({ choice: "later" }, asUser(s.token, crypto.randomUUID()))).rejects.toSatisfy((e) => reason(e) === "already_onboarded");
    });

    it("staff: role and two-factor from identity, audited, and the domains published to identity's gate", async () => {
      const staff = await student(w, { staffRoles: ["accounts"] });
      const plain = await student(w);
      await expect(people().opsSetUniversityLive({ universityId: CLOSED.id, live: true, reason: "launch" }, asUser(plain.token, crypto.randomUUID()))).rejects.toSatisfy(
        (e) => reason(e) === "accounts_only",
      );
      const aal1 = await w.token(staff.id, "aal1");
      await expect(people().opsBatches({}, asUser(aal1))).rejects.toSatisfy((e) => reason(e) === "accounts_only");
      const r = await people().opsSetUniversityLive({ universityId: CLOSED.id, live: true, reason: "launch day" }, asUser(staff.token, crypto.randomUUID()));
      expect(r.liveAt).not.toBe("");
      const [audit] = await w.people`select staff_id::text, action, target_id, reason from people.audit_log where target_id = ${CLOSED.id}`;
      expect(audit).toEqual({ staff_id: staff.id, action: "uni.open", target_id: CLOSED.id, reason: "launch day" });
      expect((await events("audit.recorded", staff.id)).length).toBeGreaterThan(0);
      await drainGate(w);
      const copy = await loadGateData(w.sql, [CLOSED.domain]);
      expect(copy.domains.map((d) => [d.universityId, d.universityLiveAt != null])).toEqual([[CLOSED.id, true]]);
      // A personal domain is refused through identity's CheckEmailDomains.
      await expect(
        people().opsAddUniDomain({ universityId: NU.id, domain: PERSONAL_DOMAIN, kind: "both", reason: "nope" }, asUser(staff.token, crypto.randomUUID())),
      ).rejects.toSatisfy((e) => reason(e) === "domain_personal");
      await people().opsAddUniDomain({ universityId: NU.id, domain: `x${Date.now().toString(36)}.nu-contract.test`, kind: "student", reason: "second campus" }, asUser(staff.token, crypto.randomUUID()));
      const batches = await people().opsBatches({}, asUser(staff.token));
      expect(batches.universities.find((u) => u.universityId === NUTECH.id)?.students).toBeGreaterThan(0);
      await people().opsSetUniversityLive({ universityId: CLOSED.id, live: false, reason: "pause" }, asUser(staff.token, crypto.randomUUID()));
    });

    it("signed-out university requests: personal domains refused via identity, emails never in events", async () => {
      const token = "t".repeat(40) + Date.now().toString(36);
      await expect(
        people().requestUniversity({ email: `a@${PERSONAL_DOMAIN}`, universityName: "Some University", consent: true, token, ipHash: "1".repeat(64) }, env().call()),
      ).rejects.toSatisfy((e) => reason(e) === "use_university_email");
      const email = unique("brand-new-uni.test");
      const r = await people().requestUniversity({ email, universityName: "Brand New University", consent: true, token, ipHash: "1".repeat(64) }, env().call());
      expect(r).toMatchObject({ status: "created", university: "Brand New University" });
      // Sent once (marketing.spec.ts:219): the same address again is recognised, not stored twice.
      const again = await people().requestUniversity({ email, universityName: "Brand New University", consent: true, token: `${token}x`, ipHash: "1".repeat(64) }, env().call());
      expect(again).toMatchObject({ status: "exists", university: "Brand New University" });
      expect(await w.people`select count(*)::int as n from people.university_requests where email = ${email}`).toEqual([{ n: 1 }]);
      expect((await people().confirmUniversityRequest({ token }, env().call())).university).toBe("Brand New University");
      const [leak] = await w.people`select count(*)::int as n from platform.events where payload::text like ${"%" + email + "%"}`;
      expect(leak).toEqual({ n: 0 });
    });

    it("a suspended user cannot send a friend request; after the lift and a refresh they can (W2 Q10)", async () => {
      const mod = await student(w, { staffRoles: ["moderator"] });
      const s = await student(w, { fullName: "Suspended Student" });
      const target = await student(w, { fullName: "Target" });
      const id = env().client(IdentityService);
      const signIn = async () =>
        (await id.signInPassword({ email: s.email, password: PASSWORD, deviceHash: "d".repeat(64), ipHash: "1".repeat(64), userAgent: "contract/1.0", captchaToken: "" }, env().call())).session!;
      const sanctionId = crypto.randomUUID();
      const until = new Date(Date.now() + 86_400_000).toISOString();
      await env().client(IdentityService, "trust").sanctionUser({ userId: s.id, kind: "suspend", until, reason: "spam requests", sanctionId }, asUser(mod.token, crypto.randomUUID()));
      const suspended = await signIn();
      expect(decodeJwt(suspended.accessToken)["rst"]).toEqual({ kind: "suspend", until });
      const targetName = await usernameOf(w, target.id);
      await expect(people().sendFriendRequest({ username: targetName }, asUser(suspended.accessToken, crypto.randomUUID()))).rejects.toSatisfy((e) => reason(e) === RESTRICTED);
      // Reading stays open.
      expect((await people().getShell({}, asUser(suspended.accessToken))).me?.userId).toBe(s.id);
      await env().client(IdentityService, "trust").liftSanction({ userId: s.id, sanctionId, reason: "appeal upheld" }, asUser(mod.token, crypto.randomUUID()));
      const refreshed = (await id.refresh({ refreshToken: suspended.refreshToken }, env().call())).session!;
      expect(decodeJwt(refreshed.accessToken)["rst"]).toBeUndefined();
      expect((await people().sendFriendRequest({ username: targetName }, asUser(refreshed.accessToken, crypto.randomUUID()))).status).toBe("pending");
    });

    it("identity's OpsStaff names come from people's ProfileCards, in one call", async () => {
      const admin = await student(w, { staffRoles: ["super_admin"], fullName: "Zara Admin" });
      const r = await env().client(IdentityService).opsStaff({}, asUser(admin.token));
      expect(r.members.find((m) => m.userId === admin.id)?.name).toBe("Zara Admin");
    });

    it("people you may know: a shared venture (ids from work's copy) shows its title from one label call per owner", async () => {
      const me = await student(w, { fullName: "Pymk Me", uni: NU });
      const mate = await student(w, { fullName: "Venture Mate", onboard: { visibility: "friends" } });
      const venture = crypto.randomUUID();
      await w.people.begin(async (tx) => {
        for (const u of [me.id, mate.id])
          expect(await applyCopyEvent(tx, { type: "group.member_changed", producer: "svc_work", version: 1, payload: { kind: "venture", group_id: venture, user_id: u, member: true } })).toBe("applied");
        expect(await applyCopyEvent(tx, { type: "group.member_changed", producer: "svc_community", version: 1, payload: { kind: "venture", group_id: venture, user_id: me.id, member: true } })).toBe("wrong_producer");
      });
      const calls: string[][] = [];
      const labels = { labels: async (kind: string, ids: readonly string[]) => (calls.push([kind, ...ids]), new Map(ids.map((i) => [i, "Robot Arm"]))) };
      const rows = await peopleYouMayKnow(w.people, me.id, 8, labels);
      // A friends-only profile from another university still shows: a shared venture already shows names.
      expect(rows.find((r) => r.name === "Venture Mate")?.reason).toBe("In Robot Arm with you");
      expect(calls).toEqual([["venture", venture]]);
      // Without labels (work not built yet) the line is left out, not guessed.
      expect((await peopleYouMayKnow(w.people, me.id, 8)).find((r) => r.name === "Venture Mate")?.reason).toBe("");
    });

    it("departments and programmes: market only, with the seat already checked by market", async () => {
      const d = await people("market").saveDepartment({ universityId: NU.id, name: "Electrical Engineering" }, env().call());
      const p = await people("market").saveProgramme({ universityId: NU.id, departmentId: d.id, name: "BS EE" }, env().call());
      await expect(people("market").saveProgramme({ universityId: NU.id, departmentId: d.id, name: "bs ee" }, env().call())).rejects.toSatisfy((e) => reason(e) === "programme_duplicate");
      await expect(people("market").deleteDepartment({ universityId: NUTECH.id, id: d.id }, env().call())).rejects.toSatisfy((e) => reason(e) === "department_not_found");
      await people("market").deleteProgramme({ universityId: NU.id, id: p.id }, env().call());
      await people("market").deleteDepartment({ universityId: NU.id, id: d.id }, env().call());
    });
  },
  peopleWorld((x) => (w = x), worlds),
);
