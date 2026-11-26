/**
 * ranking's contract on both transports, co-hosted with identity, people, content, messaging, realtime and work:
 * every method is implemented, every caller rule holds, facts made through work reach ranking as events and the
 * nightly run publishes tiers back (work's paths seniors, people's shell), staff methods refuse without the role
 * and two-factor and audit before and after, and the facts of workstreams not built yet (the Record, W8;
 * societies, W7; case penalties and config, W10) work when fed as their owners will publish them. Golden replays
 * (test/golden) pin the rules; these pin the wiring and the events.
 */
import { Code, ConnectError } from "@connectrpc/connect";
import { RankingService } from "@skilient/contracts/ranking/v1/ranking_pb";
import { appendEvents, refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, expect, it } from "vitest";
import { publishAs } from "../../../messaging/test/contract/world";
import { factKeysOf } from "../../../people/test/contract/world";
import { rankingFlagsOf, rankingTiersOf } from "../../../work/test/contract/world";
import { teams } from "./team";
import { drain, nightly, rankingWorld, stopWorlds, type RankingWorld } from "./world";

const worlds: RankingWorld[] = [];
let w: RankingWorld;
afterAll(() => stopWorlds(worlds));

const reason = (e: unknown) => refusalReason(e) ?? `code ${ConnectError.from(e).code}`;
const code = (e: unknown) => ConnectError.from(e).code;
const BATCH: Record<string, string> = { tiersOf: "credentials", uniExamPeriods: "market", uniAddExamPeriod: "market", uniRemoveExamPeriod: "market" };

describeTransports(
  ["identity", "people", "content", "messaging", "realtime", "work", "ranking"],
  (env) => {
    const ranking = (as = "web") => env().client(RankingService, as);
    const t = teams(env, () => w);
    const events = (type: string, subject: string) =>
      w.ranking<{ payload: Record<string, unknown>; producer: string }[]>`
        select payload, producer from platform.events where type = ${type} and ${subject}::uuid = any(subjects) order by txid, seq`;

    it("implements every method in the contract", async () => {
      for (const m of RankingService.methods) {
        const fn = (ranking(BATCH[m.localName] ?? "web") as unknown as Record<string, (req: object, o: object) => Promise<unknown>>)[m.localName]!;
        const err = await fn({}, env().call()).then(
          () => null,
          (e: unknown) => e,
        );
        if (err) expect([m.localName, code(err)]).not.toEqual([m.localName, Code.Unimplemented]);
      }
    });

    it("refuses callers outside each method's list", async () => {
      await expect(ranking("content").leaderboard({ scope: "global", after: 0 }, env().call())).rejects.toSatisfy((e) => code(e) === Code.PermissionDenied);
      await expect(ranking("web").tiersOf({ userIds: [] }, env().call())).rejects.toSatisfy((e) => code(e) === Code.PermissionDenied);
      await expect(ranking("web").uniExamPeriods({ universityId: crypto.randomUUID() }, env().call())).rejects.toSatisfy((e) => code(e) === Code.PermissionDenied);
      await expect(ranking("market").addExamPeriod({}, env().call())).rejects.toSatisfy((e) => code(e) === Code.PermissionDenied);
      await expect(ranking("web").leaderboard({ scope: "global", after: 0 }, env().call())).rejects.toSatisfy((e) => reason(e) === "not_signed_in");
    });

    it("facts made through work reach ranking; the run publishes scores, tiers for work and the next tier for people", async () => {
      const { owner, mate, ventureId } = await t.team(["Board Owner", "Board Mate"]);
      const [completion] = await w.ranking<{ team_size: number; deliverables: number; verified_members: number }[]>`
        select team_size, deliverables, verified_members from ranking.venture_completions where venture_id = ${ventureId}`;
      expect(completion).toEqual({ team_size: 2, deliverables: 1, verified_members: 2 });
      expect((await w.ranking`select 1 from ranking.endorsements where endorsee_id = any(${[owner.id, mate.id]}::uuid[])`).length).toBe(2);
      expect(await nightly(w)).toBe("done");

      const me = await ranking().leaderboardMe({ scope: "university" }, t.read(owner.token));
      expect([me.scored, me.ranked, me.held, me.tier]).toEqual([true, true, false, "spark"]);
      const board = await ranking().leaderboard({ scope: "university", after: 0 }, t.read(owner.token));
      expect(board.rows.filter((r) => [owner.id, mate.id].includes(r.userId)).map((r) => r.isMe)).toContain(true);
      const score = JSON.parse((await ranking().myScore({}, t.read(owner.token))).scoreJson) as { components: { work: { ventures: { venture_id: string; creator: boolean }[] } }; evidence: { ventures: string[] } };
      expect(score.components.work.ventures.map((v) => [v.venture_id, v.creator])).toEqual([[ventureId, true]]);
      expect(score.evidence.ventures).toEqual([ventureId]);
      expect((await ranking().tiersFor({ userIds: [owner.id, mate.id] }, t.read(mate.token))).tiers.map((x) => x.tier)).toEqual(["spark", "spark"]);

      const [tier] = await events("tier.changed", owner.id);
      expect([tier!.producer, tier!.payload]).toEqual(["svc_ranking", { user_id: owner.id, tier: "spark", ranked: true, previous_tier: null }]);
      expect(await rankingTiersOf(w, [owner.id])).toEqual([{ tier: "spark", ranked: true }]);
      const facts = (await events("fact.value_changed", owner.id)).map((e) => e.payload["key"]);
      expect(facts.sort()).toEqual(["tier.next", "tier.points"]);
      expect(await factKeysOf(w, owner.id)).toEqual(["tier.next", "tier.points"]);
      const [published] = await w.ranking<{ payload: Record<string, unknown> }[]>`select payload from platform.events where type = 'ranking.published' order by seq desc limit 1`;
      expect(published!.payload["held"]).toBe(0);
      // A second run with nothing new publishes no tier or fact again.
      const before = (await events("tier.changed", owner.id)).length;
      await nightly(w);
      expect((await events("tier.changed", owner.id)).length).toBe(before);
    });

    it("staff: the ranking review needs a trust reviewer on two-factor; every write is audited before and after", async () => {
      const { owner, mate } = await t.team(["Ring Owner", "Ring Mate"], { complete: false });
      await nightly(w);
      const reviewer = await t.onboarded("Ring Reviewer", { staffRoles: ["trust_reviewer"] });
      await expect(ranking().rankingFlagQueue({ status: "open" }, t.read(owner.token))).rejects.toSatisfy((e) => reason(e) === "trust_only");
      const queue = await ranking().rankingFlagQueue({ status: "open" }, t.read(reviewer.token));
      const ring = queue.flags.find((f) => f.kind === "ring" && f.memberIds.includes(owner.id))!;
      expect([...ring.memberIds].sort()).toEqual([owner.id, mate.id].sort());
      expect(await rankingFlagsOf(w, [owner.id, mate.id])).toEqual([{ flag_id: ring.id, status: "open" }]);
      const c = await ranking().rankingFlagCase({ id: ring.id }, t.read(reviewer.token));
      expect([c.found, (JSON.parse(c.caseJson) as { endorsements: unknown[] }).endorsements.length]).toEqual([true, 2]);
      await expect(ranking().claimRankingFlag({ id: ring.id, claim: true }, t.as(owner.token))).rejects.toSatisfy((e) => reason(e) === "trust_only");
      await ranking().claimRankingFlag({ id: ring.id, claim: true }, t.as(reviewer.token));
      await ranking().reviewRankingFlag({ id: ring.id, uphold: true, reason: "Traded endorsements" }, t.as(reviewer.token));
      const rows = await w.ranking<{ action: string; before: unknown; after: unknown }[]>`
        select action, before, after from ranking.audit_log where target_id = ${ring.id} order by created_at, action`;
      expect(rows).toEqual([
        { action: "ranking_flag.claim", before: { claimed_by: null }, after: { claimed_by: reviewer.id } },
        { action: "ranking_flag.uphold", before: { status: "open", kind: "ring" }, after: { status: "upheld", adjustment: null } },
      ]);
      const recorded = await w.ranking`select 1 from platform.events where type = 'audit.recorded' and producer = 'svc_ranking' and payload->>'target_id' = ${ring.id}`;
      expect(recorded.length).toBe(2);
      await drain(w);
      expect(await rankingFlagsOf(w, [owner.id, mate.id])).toEqual([{ flag_id: ring.id, status: "upheld" }]);
    });

    it("exam periods: accounts staff (audited) and a university's own admins through market", async () => {
      const staff = await t.onboarded("Exam Staff", { staffRoles: ["accounts"] });
      const [m] = await w.ranking<{ university_id: string }[]>`select university_id::text from ranking.members where user_id = ${staff.id}`;
      const uni = m!.university_id;
      const { id } = await ranking().addExamPeriod({ universityId: uni, startsOn: "2027-03-01", endsOn: "2027-03-10", reason: "Mid-terms" }, t.as(staff.token));
      expect((await ranking().examPeriodList({}, t.read(staff.token))).periods.map((p) => p.id)).toContain(id);
      await ranking().removeExamPeriod({ id, reason: "Entered by mistake" }, t.as(staff.token));
      expect((await w.ranking`select action from ranking.audit_log where target_id = ${id} order by created_at`).map((r) => r["action"])).toEqual(["exam_period.add", "exam_period.remove"]);
      const market = ranking("market");
      const call = { ...env().call(), headers: { "idempotency-key": crypto.randomUUID() } };
      const added = await market.uniAddExamPeriod({ universityId: uni, actorId: staff.id, startsOn: "2027-05-01", endsOn: "2027-05-30", reason: "Finals" }, call);
      await expect(
        market.uniAddExamPeriod({ universityId: uni, actorId: staff.id, startsOn: "2027-06-01", endsOn: "2027-07-14", reason: "Finals" }, { ...env().call(), headers: { "idempotency-key": crypto.randomUUID() } }),
      ).resolves.toBeDefined();
      const refused = await market
        .uniAddExamPeriod({ universityId: uni, actorId: staff.id, startsOn: "2027-08-01", endsOn: "2027-08-20", reason: "Resits" }, { ...env().call(), headers: { "idempotency-key": crypto.randomUUID() } })
        .catch((e: unknown) => e);
      expect([reason(refused), ConnectError.from(refused).metadata.get("x-refusal-values")]).toEqual(["exam_year_cap", "[2027,94]"]);
      expect((await market.uniExamPeriods({ universityId: uni }, env().call())).periods.map((p) => p.id)).toContain(added.id);
    });

    it("facts of workstreams not built yet, fed as their owners will publish them: the Record, societies, penalties, config", async () => {
      const s = await t.onboarded("Record Student");
      const society = crypto.randomUUID();
      const entry = crypto.randomUUID();
      const caseId = crypto.randomUUID();
      await publishAs(w, "community", "society.status_changed", [society], { society_id: society, university_id: null, status: "verified", verified_at: "2026-01-01T07:00:00.000Z" });
      await publishAs(w, "credentials", "record.sealed", [entry, s.id], {
        entry_id: entry,
        user_id: s.id,
        kind: "office_bearer",
        issuer_type: "society",
        issuer_id: society,
        occurred_on: "2026-06-30",
        signed_at: "2026-06-30T07:00:00.000Z",
        evidence: { role: "president" },
      });
      await publishAs(w, "trust", "case.resolved", [caseId, s.id], { case_id: caseId, owner_id: s.id, severity: "low", staff_id: null });
      expect(await nightly(w)).toBe("done");
      const score = () => w.ranking<{ components: { record: { points: number }; adjustments: { points: number } } }[]>`select components from ranking.ranking_scores where user_id = ${s.id}`;
      expect([(await score())[0]!.components.record.points, (await score())[0]!.components.adjustments.points]).toEqual([35, -50]);
      await publishAs(w, "credentials", "record.revoked", [entry, s.id], { entry_id: entry, status: "revoked" });
      await publishAs(w, "trust", "case.overturned", [caseId], { case_id: caseId });
      await publishAs(w, "trust", "config.changed", [], { key: "ranking.formula", version: 9, value: { note: "not in force yet" }, effective_at: "2099-01-01T00:00:00.000Z" });
      expect(await nightly(w)).toBe("done");
      expect([(await score())[0]!.components.record.points, (await score())[0]!.components.adjustments.points]).toEqual([0, 0]);
      expect(await w.ranking`select version from ranking.formulas order by version`).toEqual([{ version: 1 }, { version: 2 }, { version: 9 }]);
    });

    it("user.deleted: the user's rows go and ranking confirms", async () => {
      const s = await t.onboarded("Leaving Student");
      await nightly(w);
      await w.sql.begin((tx) => appendEvents(tx, [{ type: "user.deleted", subjects: [s.id], payload: { user_id: s.id } }]));
      await drain(w);
      expect(await w.ranking`select 1 from ranking.ranking_scores where user_id = ${s.id} union all select 1 from ranking.members where user_id = ${s.id}`).toEqual([]);
      expect((await events("user.deletion_confirmed", s.id)).map((e) => e.producer)).toContain("svc_ranking");
    });
  },
  rankingWorld((x) => (w = x), worlds),
);
