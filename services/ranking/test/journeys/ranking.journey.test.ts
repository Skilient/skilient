/**
 * Journeys: apps/web/tests/e2e/leaderboard.spec.ts and ranking-ops.spec.ts through the contracts on both transports,
 * with every fact made the way students make it (work's contract) or, for workstreams not built yet, fed as its
 * owner will publish it (trust's case decisions, W10). And the W6 hand-offs other journeys left
 * (docs/azure/journey-handoff.md, "W6"): an opted-out student is left off every board. Web-only parts are
 * `it.todo` for W13.
 */
import { PeopleService } from "@skilient/contracts/people/v1/people_pb";
import { RankingService } from "@skilient/contracts/ranking/v1/ranking_pb";
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { publishAs } from "../../../messaging/test/contract/world";
import { rankingFlagsOf, rankingTiersOf } from "../../../work/test/contract/world";
import { teams } from "../contract/team";
import { drain, nightly, rankingWorld, stopWorlds, type RankingWorld } from "../contract/world";

const worlds: RankingWorld[] = [];
let w: RankingWorld;
afterAll(() => stopWorlds(worlds));

describeTransports(
  ["identity", "people", "content", "messaging", "realtime", "work", "ranking"],
  (env) => {
    const ranking = () => env().client(RankingService);
    const people = () => env().client(PeopleService);
    const t = teams(env, () => w);
    const onBoard = async (token: string, userId: string) => {
      const scopes = await Promise.all(
        [{ scope: "university" }, { scope: "global" }, { scope: "university", department: "Computer Science" }, { scope: "university", batch: 2027 }].map((q) =>
          ranking().leaderboard({ ...q, after: 0 }, t.read(token)),
        ),
      );
      return scopes.map((b) => b.rows.some((r) => r.userId === userId));
    };

    describe("leaderboard.spec: the board, your score, tier badges and opting out", () => {
      it("a completed venture puts both teammates on the board; the score page shows its evidence; tiers show on cards", async () => {
        const { owner, mate, ventureId } = await t.team(["Leila Board", "Omar Board"]);
        expect(await nightly(w)).toBe("done");
        const me = await ranking().leaderboardMe({ scope: "university" }, t.read(owner.token));
        expect([me.scored, me.ranked, me.optedOut, me.tier, Number(me.size) >= 2]).toEqual([true, true, false, "spark", true]);
        expect(await onBoard(owner.token, mate.id)).toEqual([true, true, true, true]);
        const filters = await ranking().leaderboardFilters({}, t.read(owner.token));
        expect(filters.batches).toContain(2027);
        const score = JSON.parse((await ranking().myScore({}, t.read(owner.token))).scoreJson) as {
          scored: boolean;
          components: { work: { points: number; ventures: { venture_id: string }[] }; endorsements: { counting: number } };
          next: { current: string; next: string };
          evidence: { ventures: string[]; people: string[] };
        };
        expect([score.scored, score.components.work.ventures[0]!.venture_id, score.components.endorsements.counting, score.next.current, score.next.next]).toEqual([
          true,
          ventureId,
          1,
          "spark",
          "flare",
        ]);
        expect([score.evidence.ventures, score.evidence.people]).toEqual([[ventureId], [mate.id]]);
        expect((await ranking().tiersFor({ userIds: [owner.id, mate.id, crypto.randomUUID()] }, t.read(owner.token))).tiers.map((x) => x.userId).sort()).toEqual([owner.id, mate.id].sort());
      });

      it("W6 ranking: an opted-out student is left off every board; their tier still shows; opting back in returns them", async () => {
        const { owner, mate } = await t.team(["Zara Optout", "Bilal Viewer"]);
        await nightly(w);
        expect(await onBoard(mate.token, owner.id)).toEqual([true, true, true, true]);
        await people().setLeaderboardOptOut({ out: true }, t.as(owner.token));
        await drain(w);
        expect(await onBoard(mate.token, owner.id)).toEqual([false, false, false, false]);
        const me = await ranking().leaderboardMe({ scope: "university" }, t.read(owner.token));
        expect([me.optedOut, me.ranked, me.rank]).toEqual([true, true, undefined]);
        expect((await ranking().tiersFor({ userIds: [owner.id] }, t.read(mate.token))).tiers.map((x) => x.tier)).toEqual(["spark"]);
        await people().setLeaderboardOptOut({ out: false }, t.as(owner.token));
        await drain(w);
        expect(await onBoard(mate.token, owner.id)).toEqual([true, true, true, true]);
      });

      it.todo("W13 web: the board page with its filters, the score page, tier badges on profiles, post cards and Explore, axe in both themes");
    });

    describe("ranking-ops.spec", () => {
      it("accounts staff enter and remove an exam period, audited; the score page shows the pause", async () => {
        const staff = await t.onboarded("Amna Accounts", { staffRoles: ["accounts"] });
        const s = await t.onboarded("Exam Student");
        await nightly(w);
        const [m] = await w.ranking<{ university_id: string }[]>`select university_id::text from ranking.members where user_id = ${s.id}`;
        const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
        const end = new Date(Date.now() + 5 * 3600_000 + 10 * 86_400_000).toISOString().slice(0, 10);
        const { id } = await ranking().addExamPeriod({ universityId: m!.university_id, startsOn: today, endsOn: end, reason: "Finals" }, t.as(staff.token));
        expect((JSON.parse((await ranking().myScore({}, t.read(s.token))).scoreJson) as { exam: unknown }).exam).toEqual({ starts_on: today, ends_on: end });
        await ranking().removeExamPeriod({ id, reason: "Entered by mistake" }, t.as(staff.token));
        expect((JSON.parse((await ranking().myScore({}, t.read(s.token))).scoreJson) as { exam: unknown }).exam).toBeNull();
        expect(await w.ranking`select action, staff_id::text from ranking.audit_log where target_id = ${id} order by created_at`).toEqual([
          { action: "exam_period.add", staff_id: staff.id },
          { action: "exam_period.remove", staff_id: staff.id },
        ]);
      });

      it("a trust reviewer upholds a fast gain and clears a ring", async () => {
        const reviewer = await t.onboarded("Tariq Reviewer", { staffRoles: ["trust_reviewer"] });
        // A fast gain: a high penalty (trust's case decision, W10) holds the score at 0; overturned, it jumps.
        const { owner } = await t.team(["Fast Gainer", "Fast Mate"]);
        const caseId = crypto.randomUUID();
        await publishAs(w, "trust", "case.resolved", [caseId, owner.id], { case_id: caseId, owner_id: owner.id, severity: "high", staff_id: reviewer.id });
        await nightly(w);
        const total = async () => Number((await w.ranking<{ total: string }[]>`select total::text from ranking.ranking_scores where user_id = ${owner.id}`)[0]!.total);
        expect(await total()).toBe(0);
        await publishAs(w, "trust", "case.overturned", [caseId], { case_id: caseId });
        await nightly(w);
        const me = await ranking().leaderboardMe({ scope: "university" }, t.read(owner.token));
        expect([me.held, await total()]).toEqual([true, 0]);
        const queue = await ranking().rankingFlagQueue({ status: "open" }, t.read(reviewer.token));
        const gain = queue.flags.find((f) => f.kind === "rapid_gain" && f.memberIds.includes(owner.id))!;
        expect(gain.gain).toBeGreaterThan(150);
        await ranking().claimRankingFlag({ id: gain.id, claim: true }, t.as(reviewer.token));
        await ranking().reviewRankingFlag({ id: gain.id, uphold: true, reason: "Gain not earned" }, t.as(reviewer.token));
        await nightly(w);
        expect([(await ranking().leaderboardMe({ scope: "university" }, t.read(owner.token))).held, await total()]).toEqual([false, 0]);

        // A ring: two teammates endorse each other on a venture with nothing outside to show for it.
        const ring = await t.team(["Ring One", "Ring Two"], { complete: false });
        await nightly(w);
        const flag = (await ranking().rankingFlagQueue({ status: "open" }, t.read(reviewer.token))).flags.find((f) => f.kind === "ring" && f.memberIds.includes(ring.owner.id))!;
        const counted = async () =>
          (await w.ranking<{ c: { endorsements: { counting: number } } }[]>`select components as c from ranking.ranking_scores where user_id = ${ring.owner.id}`)[0]!.c.endorsements.counting;
        expect(await counted()).toBe(0);
        await ranking().claimRankingFlag({ id: flag.id, claim: true }, t.as(reviewer.token));
        await ranking().reviewRankingFlag({ id: flag.id, uphold: false, reason: "They built it together" }, t.as(reviewer.token));
        await nightly(w);
        expect(await counted()).toBe(1);
        expect((await w.ranking`select action from ranking.audit_log where staff_id = ${reviewer.id} order by created_at`).map((r) => r["action"])).toEqual([
          "ranking_flag.claim",
          "ranking_flag.uphold",
          "ranking_flag.claim",
          "ranking_flag.clear",
        ]);
      });

      it.todo("W13 web: /ops evidence?tab=ranking (queue, case page, claim and decide) and /ops/exam-periods, axe in both themes");
      it.todo("W10 trust: the ranking flags in the /ops inbox (RankingFlagQueue) and case decisions published as case.resolved and case.overturned");
    });

    describe("W6 hand-offs to work", () => {
      it("paths' seniors: ranking's tiers reach work's copy; a ring reaches the peer-review check", async () => {
        const { owner, mate } = await t.team(["Senior One", "Senior Two"]);
        const ring = await t.team(["Peer One", "Peer Two"], { complete: false });
        await nightly(w);
        expect(await rankingTiersOf(w, [owner.id, mate.id])).toEqual([
          { tier: "spark", ranked: true },
          { tier: "spark", ranked: true },
        ]);
        expect((await rankingFlagsOf(w, [ring.owner.id, ring.mate.id])).map((f) => f.status)).toEqual(["open"]);
      });
    });
  },
  rankingWorld((x) => (w = x), worlds),
);
