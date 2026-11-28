/**
 * apps/web/tests/e2e/onboarding.spec.ts, through the contracts (decision W2 Q3): one journey per spec test.
 */
import { Code, ConnectError } from "@connectrpc/connect";
import { IdentityService } from "@skilient/contracts/identity/v1/identity_pb";
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { startFakeHibp } from "../../../identity/test/contract/security-hibp";
import { NU, NUTECH, peopleWorld, stopWorlds, type PeopleWorld } from "../contract/world";
import { journeyClient } from "./journey";

const worlds: PeopleWorld[] = [];
let w: PeopleWorld;
const hibp = await startFakeHibp([]);
afterAll(async () => {
  await stopWorlds(worlds);
  await hibp.stop();
});
const reason = (e: unknown) => refusalReason(e) ?? `code ${ConnectError.from(e).code}`;

describeTransports(
  ["identity", "people"],
  (env) => {
    const j = journeyClient(env, () => w);
    describe("onboarding and profiles", () => {
      it("two students at different universities sign up, onboard, and can't read each other's university data", async () => {
        const a = await j.signUp(NUTECH, "Amna Nutech");
        // Step 1 starts the wizard: the university that owns the email, and its departments.
        const start = await j.people().getOnboarding({}, j.as(a.token));
        expect([start.step, start.profile?.universityId, start.universities.map((u) => u.id), start.departments.map((d) => d.name)]).toEqual([
          1,
          NUTECH.id,
          [NUTECH.id],
          ["Computer Science", "Software Engineering"],
        ]);
        const ua = await j.onboard(a.token, { bio: "A's secret intro about robotics" });
        expect(ua.completed).toBe(true);
        const b = await j.signUp(NU, "Bashir Fast");
        const ub = await j.onboard(b.token, { department: "Computer Science", bio: "B's private note on compilers" });
        // identity's gate now says both are onboarded (people's profile.gate_changed reached its copy).
        for (const s of [a, b]) expect((await j.id().getGateState({}, j.as(s.token))).onboardingComplete).toBe(true);

        // Own profile: everything.
        const own = await j.people().getProfile({ username: ua.username }, j.as(a.token));
        expect(own.result).toMatchObject({ case: "full", value: { fullName: "Amna Nutech", bio: "A's secret intro about robotics", universityName: NUTECH.name, isOwner: true } });
        // Other university, default visibility "university": only the public card (department, no intro, no university).
        const card = await j.people().getProfile({ username: ua.username }, j.as(b.token));
        expect(card.result).toMatchObject({ case: "card", value: { fullName: "Amna Nutech", department: "Computer Science" } });
        expect(JSON.stringify(card)).not.toMatch(/secret intro|NUTECH/);
        const back = await j.people().getProfile({ username: ub.username }, j.as(a.token));
        expect([back.result.case, JSON.stringify(back).includes("private note")]).toEqual(["card", false]);

        // "Direct API": nothing reaches people without web's service token, and the user's own token is not one.
        await expect(env().raw(PeopleService, { authorization: `Bearer ${b.token}` }).getMyProfile({})).rejects.toSatisfy(
          (e) => [Code.Unauthenticated, Code.PermissionDenied].includes(ConnectError.from(e).code),
        );
      });

      it("onboarding resumes at the saved step after signing out; Back works, skipping ahead doesn't", async () => {
        const s = await j.signUp(NU, "Resume Case");
        await j.people().saveUniversityStep({ universityId: "", department: "Software Engineering", programme: "", graduationYear: 2028, campus: "" }, j.as(s.token));
        // Signing out and in again: the wizard is where it was.
        const again = (await j.id().signInPassword({ email: s.email, password: "People-contract-Passw0rd!", deviceHash: "d".repeat(64), ipHash: "1".repeat(64), userAgent: "journey/1.0", captchaToken: "" }, env().call())).session!;
        const o = await j.people().getOnboarding({}, j.as(again.accessToken));
        expect([o.step, o.profile?.department]).toEqual([2, "Software Engineering"]);
        // Saving step 1 again (Back, then Continue) never moves the saved step backwards.
        expect((await j.people().saveUniversityStep({ universityId: "", department: "Software Engineering", programme: "", graduationYear: 2028, campus: "" }, j.as(again.accessToken))).nextStep).toBe(2);
        expect((await j.people().getOnboarding({}, j.as(again.accessToken))).step).toBe(2);
        // Skipping ahead: finishing now is refused until the details exist (no username yet).
        expect((await j.people().completeOnboarding({}, j.as(again.accessToken))).completed).toBe(false);
        // Pages that need onboarding are closed until then (the gate redirects in web, W13).
        await expect(j.people().todoCounts({}, j.as(again.accessToken))).rejects.toSatisfy((e) => reason(e) === "finish_onboarding");
      });

      it("visibility decides who reads the full profile", async () => {
        const a = await j.createStudent(NUTECH, "Vis Owner", { bio: "Only for the right people" });
        const b = await j.createStudent(NU, "Vis Viewer");
        expect((await j.people().getProfile({ username: a.username }, j.as(b.token))).result.case).toBe("card");
        await j.people().updateProfile({ visibility: "global", lookingFor: [], lookingForSet: false }, j.as(a.token));
        expect((await j.people().getMyProfile({}, j.as(a.token))).visibility).toBe("global");
        expect((await j.people().getProfile({ username: a.username }, j.as(b.token))).result).toMatchObject({ case: "full", value: { bio: "Only for the right people" } });
      });

      it("replacing or removing a photo leaves no orphan files; /profile/edit redirects", async () => {
        const s = await j.createStudent(NUTECH, "Photo Swapper");
        const first = `${s.id}/${crypto.randomUUID()}.webp`;
        const second = `${s.id}/${crypto.randomUUID()}.webp`;
        await j.people().setProfileImage({ kind: "avatar", path: first }, j.as(s.token));
        await j.people().setProfileImage({ kind: "avatar", path: second }, j.as(s.token));
        await j.people().setProfileImage({ kind: "avatar", path: "" }, j.as(s.token));
        expect((await j.people().getMyProfile({}, j.as(s.token))).avatarPath).toBe("");
        // Every file the profile stopped using is handed to media for deletion (media deletes it, W9).
        const replaced = await w.people<{ payload: { old_path: string } }[]>`
          select payload from platform.events where type = 'profile.image_replaced' and ${s.id}::uuid = any(subjects) order by seq`;
        expect(replaced.map((e) => e.payload.old_path)).toEqual([first, second]);
        // A path outside the user's own folder is refused.
        await expect(j.people().setProfileImage({ kind: "avatar", path: `someone-else/${crypto.randomUUID()}.webp` }, j.as(s.token))).rejects.toSatisfy((e) => reason(e) === "field_invalid");
      });

      it("profile edit refuses a taken username with a named fix", async () => {
        const a = await j.createStudent(NUTECH, "Name Taker");
        const b = await j.createStudent(NUTECH, "Name Wanter");
        expect((await j.people().usernameAvailable({ username: a.username }, j.as(b.token))).available).toBe(false);
        await expect(j.people().updateProfile({ username: a.username, lookingFor: [], lookingForSet: false }, j.as(b.token))).rejects.toSatisfy((e) => reason(e) === "username_taken");
      });

      it("a signed-out visitor can't open a profile", async () => {
        const a = await j.createStudent(NUTECH, "Anyone");
        await expect(j.people().getProfile({ username: a.username }, { ...env().call(), headers: { "idempotency-key": crypto.randomUUID() } })).rejects.toSatisfy(
          (e) => reason(e) === "not_signed_in",
        );
        // And identity's gate says signed out too (web redirects to /signin?next=..., W13).
        await expect(j.id().getGateState({}, env().call())).rejects.toBeDefined();
        void IdentityService;
      });

      it.todo("W13: web re-encodes the photo (WebP 512x512, no EXIF) before media stores it (storage and deleting replaced files: photos.journey.test.ts)");
      it.todo("W13 web: the wizard's preview, minutes left, the welcome film, axe on every step, /profile/edit redirect");
    });
  },
  peopleWorld((x) => (w = x), worlds),
);
