/**
 * Golden replays of flags.json and exams.json: rings found by the run, rapid gains held, the trust reviewer's
 * queue, case, claim and review (audited before and after), and accounts staff's exam periods. The staff check is
 * the API's (`requireTrustReviewer`, `requireAccounts`: a two-factor session and the role from identity),
 * replayed from the recorded session's level and roles. Rules as replay.ts.
 */
import type { User } from "@skilient/platform";
import type { TestDatabase } from "@skilient/testing/postgres";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, it } from "vitest";
import { requireAccounts, requireTrustReviewer, type Role } from "../../src/identity";
import * as E from "../../src/store/exams";
import * as FL from "../../src/store/flags";
import { ALL, audit, call, expectGolden, F, flags, inCase, nameOf, runAll, scores, seed, seedRing, startWorld, universityName, usernameOf, ventureTitle, type Tx } from "./replay";

let pg: TestDatabase;
let sql: postgres.Sql;
beforeAll(async () => ({ pg, sql } = await startWorld()));
afterAll(async () => pg?.stop());

type Row = Record<string, unknown>;
const NEXT_DAY = F.pkt("2026-12-10 12:00");
const session = (id: string, aal: "aal1" | "aal2" = "aal2") => ({ id, aal }) as unknown as User;
const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : d);
/** Rule 6: the stack kept numeric(8,2)'s scale inside the flag's JSON ("414.00"); the port's JSON numbers have none. */
const scaled = (v: string | null) => (v === null ? null : Number(v).toFixed(2));
/** Rule 7: the stack's `claimed_by = me` is SQL null when nobody has claimed; the port's false. */
const unclaimed = (claimedBy: string | null, mine: boolean) => (claimedBy === null ? null : mine);

/** The queue as web shows it: member and claimer names joined from people (rule 2). */
const queueShown = (rows: FL.QueueRow[]) =>
  rows.map((f) => ({
    id: f.id,
    kind: f.kind,
    member_names: f.member_ids.map(nameOf).sort(),
    gain: scaled(f.gain),
    from_total: scaled(f.from_total),
    to_total: scaled(f.to_total),
    endorsements: f.endorsements,
    status: f.status,
    claimed_by_name: nameOf(f.claimed_by),
    claimed_by_me: unclaimed(f.claimed_by, f.claimed_by_me),
    created_at: iso(f.created_at),
    reviewed_at: iso(f.reviewed_at),
  }));

const caseShown = (c: Awaited<ReturnType<typeof FL.flagCase>>) =>
  c && {
    id: c.id,
    kind: c.kind,
    status: c.status,
    detail: c.detail,
    reason: c.reason,
    created_at: iso(c.created_at),
    reviewed_at: iso(c.reviewed_at),
    claimed_by_name: nameOf(c.claimed_by),
    claimed_by_me: unclaimed(c.claimed_by, c.claimed_by_me),
    is_member: c.is_member,
    reviewer_name: nameOf(c.reviewed_by),
    members: c.member_rows
      .map((m) => ({ user_id: m.user_id, name: nameOf(m.user_id), username: usernameOf(m.user_id), university: universityName(m.university_id), total: m.total === null ? null : Number(m.total), tier: m.tier }))
      .sort((a, b) => a.name!.localeCompare(b.name!)),
    endorsements: c.endorsement_rows.map((e) => ({
      id: e.id,
      endorser: nameOf(e.endorser_id),
      endorsee: nameOf(e.endorsee_id),
      skill: F.LABEL[e.skill_id],
      venture: ventureTitle(e.venture_id),
      venture_status: e.venture_status,
      deliverables: e.deliverables,
      hidden: e.hidden,
      created_at: iso(e.created_at),
    })),
  };

describe("flags.json", () => {
  const trust = (tx: Tx, who: string, roles: Role[], aal: "aal1" | "aal2" = "aal2") => {
    void tx;
    return requireTrustReviewer(session(who, aal), roles);
  };
  const queue = (tx: Tx, who: string, roles: Role[], status: string, aal: "aal1" | "aal2" = "aal2") =>
    call(tx, async (sp) => queueShown(await FL.flagQueue(sp, trust(sp, who, roles, aal), status)));
  const flagCase = (tx: Tx, who: string, roles: Role[], id: string) => call(tx, async (sp) => caseShown(await FL.flagCase(sp, trust(sp, who, roles), id)));
  const claim = (tx: Tx, who: string, roles: Role[], id: string, yes: boolean) => call(tx, (sp) => FL.claimFlag(sp, trust(sp, who, roles), id, yes).then(() => null));
  const review = (tx: Tx, who: string, roles: Role[], id: string, uphold: boolean, reason: string) =>
    call(tx, (sp) => FL.reviewFlag(sp, trust(sp, who, roles), id, uphold, reason).then(() => null));
  const ringId = async (tx: Tx) => ((await tx<{ id: string }[]>`select id::text from ranking.anti_gaming_flags where kind = 'ring' and members && ${ALL}::uuid[]`)[0]!).id;
  const T: Role[] = ["trust_reviewer"];
  const adjustments = (tx: Tx, users: string[]) =>
    tx`select a.user_id, a.kind, a.severity, a.points, a.reason, a.staff_id, a.case_id, a.flag_id from ranking.ranking_adjustments a
        where a.user_id = any(${users}::uuid[]) order by a.user_id, a.created_at`.then((r) => [...r]);

  it("a ring is found, reviewed by a trust reviewer (claimed, cleared), audited before and after", () =>
    inCase(sql, async (tx) => {
      await seed(tx);
      await seedRing(tx);
      await runAll(tx, F.AS_OF);
      const out: Row = { found: await flags(tx), q5: await scores(tx, [F.Q(5), F.Q(6)]) };
      const id = await ringId(tx);
      out["queue_not_staff"] = await queue(tx, F.STAFF, [], "open");
      out["queue_aal1"] = await queue(tx, F.STAFF, T, "open", "aal1");
      out["queue"] = await queue(tx, F.STAFF, T, "open");
      out["case"] = await flagCase(tx, F.STAFF, T, id);
      out["case_unknown"] = await flagCase(tx, F.STAFF, T, F.fid("nothing"));
      out["review_unclaimed"] = await review(tx, F.STAFF, T, id, false, "Looks fine");
      out["release_unclaimed"] = await claim(tx, F.STAFF, T, id, false);
      out["claim"] = await claim(tx, F.STAFF, T, id, true);
      out["case_claimed"] = await flagCase(tx, F.STAFF, T, id);
      out["review_short_reason"] = await review(tx, F.STAFF, T, id, false, "x");
      out["review"] = await review(tx, F.STAFF, T, id, false, " They built it together ");
      out["review_again"] = await review(tx, F.STAFF, T, id, false, "Again");
      out["reviewed"] = await queue(tx, F.STAFF, T, "reviewed");
      out["flags"] = await flags(tx);
      out["audit"] = await audit(tx, F.STAFF);
      await runAll(tx, NEXT_DAY);
      out["after"] = await scores(tx, [F.Q(5), F.Q(6)]);
      out["flags_after"] = await flags(tx);
      expectGolden("flags", "ring", out);
    }));

  it("a member can't review their own flag; a ring upheld keeps its endorsements at 0", () =>
    inCase(sql, async (tx) => {
      await seed(tx);
      await seedRing(tx);
      await runAll(tx, F.AS_OF);
      const id = await ringId(tx);
      const out: Row = {};
      out["member_claim"] = await claim(tx, F.Q(5), T, id, true);
      out["member_case"] = await flagCase(tx, F.Q(5), T, id);
      out["claim"] = await claim(tx, F.STAFF, T, id, true);
      out["other_claim"] = await claim(tx, F.Q(5), T, id, true);
      out["release"] = await claim(tx, F.STAFF, T, id, false);
      out["claim_again"] = await claim(tx, F.STAFF, T, id, true);
      out["uphold"] = await review(tx, F.STAFF, T, id, true, "Traded endorsements");
      out["audit"] = await audit(tx, F.STAFF);
      await runAll(tx, NEXT_DAY);
      out["after"] = await scores(tx, [F.Q(5), F.Q(6)]);
      out["flags_after"] = await flags(tx);
      expectGolden("flags", "ring_upheld", out);
    }));

  const rapidWorld = async (tx: Tx) => {
    await seed(tx);
    await tx`update ranking.ranking_scores set formula_version = 2, total = ${F.RAPID_PREVIOUS.total}, components = '{"work": {"points": 0, "ventures": []}}'::jsonb
              where user_id = ${F.RAPID_PREVIOUS.user}`;
    await runAll(tx, F.AS_OF);
    return ((await tx<{ id: string }[]>`select id::text from ranking.anti_gaming_flags where kind = 'rapid_gain' and user_id = ${F.R(1)}`)[0]!).id;
  };

  it("a rapid gain holds the published score; upheld, it becomes a negative adjustment on the next run", () =>
    inCase(sql, async (tx) => {
      const id = await rapidWorld(tx);
      const B = await import("../../src/store/boards");
      const out: Row = { held: await scores(tx, [F.R(1)]), flags: await flags(tx) };
      out["me"] = await call(tx, (sp) => B.leaderboardMe(sp, F.R(1), "university", null, null));
      const board = await call(tx, (sp) => B.leaderboard(sp, F.R(2), "university", null, null, 0));
      out["board"] = board.ok
        ? {
            ok: true,
            value: (board.value as Awaited<ReturnType<typeof B.leaderboard>>).map((r) => ({
              avatar_path: null,
              full_name: nameOf(r.user_id),
              is_me: r.is_me,
              place: String(r.place),
              rank: String(r.rank),
              tier: r.tier,
              university_name: universityName(r.university_id),
              username: usernameOf(r.user_id),
              weekly_change: r.weekly_change === null ? null : String(r.weekly_change),
            })),
          }
        : board;
      out["queue"] = await queue(tx, F.STAFF, T, "open");
      out["case"] = await flagCase(tx, F.STAFF, T, id);
      out["claim"] = await claim(tx, F.STAFF, T, id, true);
      out["uphold"] = await review(tx, F.STAFF, T, id, true, "Gain not earned");
      out["adjustments"] = await adjustments(tx, [F.R(1)]);
      out["audit"] = await audit(tx, F.STAFF);
      await runAll(tx, NEXT_DAY);
      out["after"] = await scores(tx, [F.R(1)]);
      out["flags_after"] = await flags(tx);
      expectGolden("flags", "rapid_gain", out);
    }));

  it("a cleared rapid gain counts from the next run", () =>
    inCase(sql, async (tx) => {
      const id = await rapidWorld(tx);
      await claim(tx, F.STAFF, T, id, true);
      const out: Row = { clear: await review(tx, F.STAFF, T, id, false, "Earned it") };
      await runAll(tx, NEXT_DAY);
      out["after"] = await scores(tx, [F.R(1)]);
      out["flags_after"] = await flags(tx);
      expectGolden("flags", "rapid_gain_cleared", out);
    }));
});

describe("exams.json", () => {
  it("accounts staff add, list and remove exam periods (audited); refusals", () =>
    inCase(sql, async (tx) => {
      await seed(tx);
      const A: Role[] = ["accounts"];
      const add = (roles: Role[], aal: "aal1" | "aal2", uni: string, starts: string, ends: string, reason: string) =>
        call(tx, (sp) => E.addExamPeriod(sp, requireAccounts(session(F.STAFF, aal), roles), uni, starts, ends, reason));
      const list = (roles: Role[], aal: "aal1" | "aal2") =>
        call(tx, async (sp) => {
          requireAccounts(session(F.STAFF, aal), roles);
          return (await E.examPeriodList(sp)).map((e) => ({
            id: e.id,
            university_id: e.university_id,
            university_name: universityName(e.university_id),
            starts_on: e.starts_on,
            ends_on: e.ends_on,
            reason: e.reason,
            created_by_name: nameOf(e.created_by),
            created_at: iso(e.created_at),
          }));
        });
      const remove = (id: string, reason: string) => call(tx, (sp) => E.removeExamPeriod(sp, requireAccounts(session(F.STAFF), A), id, reason).then(() => null));
      const out: Row = {};
      out["not_staff"] = await add([], "aal2", F.UNI_A, "2026-12-14", "2026-12-20", "Finals");
      out["aal1"] = await add(A, "aal1", F.UNI_A, "2026-12-14", "2026-12-20", "Finals");
      out["list_aal1"] = await list(A, "aal1");
      out["short_reason"] = await add(A, "aal2", F.UNI_A, "2026-12-14", "2026-12-20", "x");
      out["backwards"] = await add(A, "aal2", F.UNI_A, "2026-12-20", "2026-12-14", "Finals");
      out["too_long"] = await add(A, "aal2", F.UNI_A, "2026-12-01", "2027-01-14", "Finals");
      out["unknown_university"] = await add(A, "aal2", F.fid("no-university"), "2026-12-14", "2026-12-20", "Finals");
      out["add"] = await add(A, "aal2", F.UNI_A, "2026-12-14", "2026-12-20", " Finals ");
      out["overlap"] = await add(A, "aal2", F.UNI_A, "2026-12-20", "2026-12-24", "Retakes");
      out["other_university"] = await add(A, "aal2", F.UNI_B, "2026-12-20", "2026-12-24", "Retakes");
      out["list"] = await list(A, "aal2");
      out["remove_unknown"] = await remove(F.fid("no-exam"), "Entered by mistake");
      out["list_after"] = await list(A, "aal2");
      out["audit"] = await audit(tx, F.STAFF);
      // Rule 8: the recording's two removals never reached the stack (its add had overlapped): not replayed.
      expectGolden("exams", "staff", out, { skip: ["remove_short_reason", "remove"] });
    }));

  it("removing an added period (audited); a short reason and an unknown id are refused (exams_remove.json)", () =>
    inCase(sql, async (tx) => {
      await seed(tx);
      const staff = (who = F.STAFF) => requireAccounts(session(who), who === F.STAFF ? ["accounts"] : []);
      const out: Row = {};
      out["add"] = await call(tx, (sp) => E.addExamPeriod(sp, staff(), F.UNI_A, "2027-02-01", "2027-02-10", "Mid-terms"));
      const id = (out["add"] as { value: string }).value;
      const remove = (who: string, reason: string) => call(tx, (sp) => E.removeExamPeriod(sp, staff(who), id, reason).then(() => null));
      out["remove_short_reason"] = await remove(F.STAFF, "x");
      out["remove_not_staff"] = await remove(F.R(1), "Entered by mistake");
      out["remove"] = await remove(F.STAFF, " Entered by mistake ");
      out["remove_again"] = await remove(F.STAFF, "Entered by mistake");
      out["list_after"] = await call(tx, async (sp) =>
        (await E.examPeriodList(sp)).map((e) => ({
          id: e.id,
          university_id: e.university_id,
          university_name: universityName(e.university_id),
          starts_on: e.starts_on,
          ends_on: e.ends_on,
          reason: e.reason,
          created_by_name: nameOf(e.created_by),
          created_at: iso(e.created_at),
        })),
      );
      out["audit"] = await audit(tx, F.STAFF);
      expectGolden("exams_remove", "remove", out);
    }));
});
