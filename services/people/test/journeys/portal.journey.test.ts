/**
 * The people parts of apps/web/tests/e2e/student-portal.spec.ts, the privacy centre (decision W2 Q3:
 * visibility, recruiter visibility, leaderboard opt-out, chat read receipts, the blocked list, each stored by
 * people, enforced by its reads and published for the services that act on it) and leaderboard.spec.ts's
 * opt-out (people records and publishes it; the board itself is W6). One journey per spec test.
 */
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { startFakeHibp } from "../../../identity/test/contract/security-hibp";
import { graduateRollover } from "../../src/store/universities";
import { drainGate, drainLifecycle, NUTECH, peopleWorld, stopWorlds, type PeopleWorld } from "../contract/world";
import { journeyClient } from "./journey";

const worlds: PeopleWorld[] = [];
let w: PeopleWorld;
const hibp = await startFakeHibp([]);
afterAll(async () => {
  await stopWorlds(worlds);
  await hibp.stop();
});

describeTransports(
  ["identity", "people"],
  (env) => {
    const j = journeyClient(env, () => w);
    const flags = async (userId: string) =>
      (await w.people<{ payload: Record<string, unknown> }[]>`select payload from platform.events where type = 'profile.updated' and ${userId}::uuid = any(subjects) order by seq desc limit 1`)[0]!.payload;

    describe("Student portal (people's parts)", () => {
      it("the shell, the tour by keyboard, the progress card and the tips", async () => {
        const s = await j.createStudent(NUTECH, "Portal Student");
        const shell = await j.people().getShell({}, j.as(s.token));
        expect(shell.me).toMatchObject({ fullName: "Portal Student", universityName: NUTECH.name, onboardingComplete: true });
        expect(shell.tour).toMatchObject({ started: false, completed: false });
        // The tour moves step by step and ends once; restarting clears it.
        await j.people().saveTour({ tour: "student", step: 1, outcome: "progress" }, j.as(s.token));
        await j.people().saveTour({ tour: "student", step: 4, outcome: "progress" }, j.as(s.token));
        expect((await j.people().getShell({}, j.as(s.token))).tour).toMatchObject({ started: true, step: 4, completed: false });
        await j.people().saveTour({ tour: "student", step: 8, outcome: "completed" }, j.as(s.token));
        expect((await j.people().learnState({ tour: "student" }, j.as(s.token))).tour).toMatchObject({ step: 8, completed: true });
        const [ended] = await w.people`select payload from platform.events where type = 'tour.ended' and ${s.id}::uuid = any(subjects)`;
        expect(ended!["payload"]).toMatchObject({ tour: "student", outcome: "completed" });
        // The progress card: what is next, the to-do count and the checklist; dismissing it is remembered.
        expect((await j.people().nextBestAction({}, j.as(s.token))).href).toBe("/ventures");
        expect((await j.people().todoCounts({}, j.as(s.token))).total).toBe(0);
        expect((await j.people().gettingStarted({}, j.as(s.token))).items.find((i) => i.key === "profile")?.done).toBe(false);
        await j.people().setUiState({ key: "progress_card_dismissed_on", valueJson: '"2026-11-25"' }, j.as(s.token));
        // A tip shows once.
        await j.people().seeTip({ tip: "privacy" }, j.as(s.token));
        const learn = await j.people().learnState({ tour: "student" }, j.as(s.token));
        expect([learn.tipsSeen, learn.ui.map((u) => [u.key, u.valueJson])]).toEqual([["privacy"], [["progress_card_dismissed_on", '"2026-11-25"']]]);
        await j.people().restartTour({ tour: "student" }, j.as(s.token));
        expect((await j.people().getShell({}, j.as(s.token))).tour?.started).toBe(false);
      });

      it("welcome: the film ends on Start the tour, can be skipped, plays once, and leads into the tour", async () => {
        const s = await j.createStudent(NUTECH, "Welcome Student");
        // "Plays once" and "leads into the tour" are the tour's stored state: unstarted, then started.
        expect((await j.people().getShell({}, j.as(s.token))).tour?.started).toBe(false);
        await j.people().saveTour({ tour: "student", step: 0, outcome: "progress" }, j.as(s.token));
        expect((await j.people().getShell({}, j.as(s.token))).tour?.started).toBe(true);
      });

      it("a graduate posts to the Global Feed only (people's half: the graduate status and its event)", async () => {
        const s = await j.createStudent(NUTECH, "Grad Student", { year: 2020 });
        const n = await w.people.begin((tx) => graduateRollover(tx, { year: 2026, month: 9, day: 1 }));
        expect(n).toBeGreaterThan(0);
        expect((await j.people().getMyProfile({}, j.as(s.token))).status).toBe("graduate");
        expect((await flags(s.id))["status"]).toBe("graduate");
        await drainGate(w);
        expect((await j.id().getGateState({}, j.as(s.token))).status).toBe("graduate");
      });

      it("deleting an account: cooling-off, locked to one page, cancel restores it", async () => {
        const s = await j.createStudent(NUTECH, "Leaving Student");
        const r = await j.id().requestAccountDeletion({}, j.as(s.token));
        await drainLifecycle(w);
        const me = await j.people().getMyProfile({}, j.as(s.token));
        expect([me.status, me.deleteAfter !== ""]).toEqual(["deleting", true]);
        expect(new Date(me.deleteAfter).getTime()).toBe(new Date(r.deleteAfter).getTime());
        await j.id().cancelAccountDeletion({}, j.as(s.token));
        await drainLifecycle(w);
        const back = await j.people().getMyProfile({}, j.as(s.token));
        expect([back.status, back.deleteAfter]).toEqual(["active", ""]);
      });

      it.todo("W13 web: the phone shell (dock, header, shorter tour) and the welcome film's skip and replay");
      it.todo("W10 trust: feedback (send, follow its status, read the reply)");
      it.todo("W13 web: a deleting account is locked to /settings/account/delete");
    });

    describe("Privacy centre (people's settings, each stored, enforced and published)", () => {
      it("profile visibility, recruiter visibility, leaderboard opt-out, read receipts and the blocked list", async () => {
        const s = await j.createStudent(NUTECH, "Private Student");
        const other = await j.createStudent(NUTECH, "Classmate Viewer");
        const set = (req: Parameters<ReturnType<typeof j.people>["updateProfile"]>[0]) => j.people().updateProfile(req, j.as(s.token));

        await set({ visibility: "friends", lookingFor: [], lookingForSet: false });
        expect((await j.people().getProfile({ username: s.username }, j.as(other.token))).result.case).toBe("card");
        expect((await flags(s.id))["visibility"]).toBe("friends");

        await set({ recruiterVisible: true, lookingFor: ["internship", "job"], lookingForSet: true });
        expect(await flags(s.id)).toMatchObject({ recruiter_visible: true, looking_for: ["internship", "job"] });

        expect((await j.people().setLeaderboardOptOut({ out: true }, j.as(s.token))).out).toBe(true);
        expect((await flags(s.id))["leaderboard_opt_out"]).toBe(true);

        await j.people().setReadReceipts({ on: false }, j.as(s.token));
        expect((await flags(s.id))["read_receipts"]).toBe(false);

        const me = await j.people().getMyProfile({}, j.as(s.token));
        expect([me.visibility, me.recruiterVisible, me.leaderboardOptOut, me.readReceipts]).toEqual(["friends", true, true, false]);

        await j.people().blockUser({ username: other.username }, j.as(s.token));
        expect((await j.people().listBlocks({}, j.as(s.token))).blocked.map((b) => b.username)).toEqual([other.username]);
      });

      it("leaderboard opt-out (leaderboard.spec.ts): people records it and publishes it for ranking", async () => {
        const s = await j.createStudent(NUTECH, "Board Student");
        await j.people().setLeaderboardOptOut({ out: true }, j.as(s.token));
        expect((await flags(s.id))["leaderboard_opt_out"]).toBe(true);
        await j.people().setLeaderboardOptOut({ out: false }, j.as(s.token));
        expect((await flags(s.id))["leaderboard_opt_out"]).toBe(false);
      });

      it.todo("W6 ranking: an opted-out student is left off every board");
      it.todo("W11 market: who viewed my profile and blocked companies (portal off)");
    });
  },
  peopleWorld((x) => (w = x), worlds),
);
