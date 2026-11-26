/**
 * Journeys: apps/web/tests/e2e/levels.spec.ts, endorsements.spec.ts, credentials.spec.ts and code-checks.spec.ts,
 * through the contracts on both transports. Staff act as Trust reviewers on two-factor (people's student helper
 * with staff roles). GitHub is the fake (test/contract/fake-github.ts). Web-only parts are `it.todo` for W13,
 * file storage for W9.
 */
import { WorkService } from "@skilient/contracts/work/v1/work_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { patchOf } from "../contract/fake-github";
import { drainCopies, runJobs, stopWorlds, student, workWorld, type WorkWorld } from "../contract/world";

const worlds: WorkWorld[] = [];
let w: WorkWorld;
afterAll(() => stopWorlds(worlds));

describeTransports(
  ["identity", "people", "content", "messaging", "realtime", "work"],
  (env) => {
    const work = () => env().client(WorkService);
    const as = (token: string) => ({ ...env().call({ userToken: token }), headers: { "idempotency-key": crypto.randomUUID() } });
    const read = (token: string) => env().call({ userToken: token });
    const onboarded = async (fullName: string, staffRoles?: string[]) => {
      const s = await student(w, { fullName, ...(staffRoles ? { staffRoles } : {}) });
      await drainCopies(w);
      return s;
    };
    const level = async (token: string, skill: string) => (await work().mySkills({}, read(token))).skills.find((s) => s.skillId === skill)?.level ?? 0;
    /** A venture with `members` on its team, in progress. */
    const team = async (owner: { token: string }, title: string, members: { token: string }[]) => {
      const { ventureId } = await work().createVenture({ type: "project", title, description: "d", visibility: "public", skillIds: ["react", "typescript"], roles: [], questions: [] }, as(owner.token));
      for (const m of members) {
        const { applicationId } = await work().applyToVenture({ ventureId, roleId: "", message: "In", answers: [] }, as(m.token));
        await work().decideApplication({ applicationId, accept: true }, as(owner.token));
      }
      await work().transitionVenture({ ventureId, to: "in_progress" }, as(owner.token));
      return ventureId;
    };

    describe("levels.spec: a confirmed tagged entry makes L3; evidence-tied endorsements from two ventures make L4", () => {
      it("L3 on a teammate's confirmation, L4 on two endorsers tied to entries that show the skill", async () => {
        const a = await onboarded("Ali Owner");
        const b = await onboarded("Bano Builder");
        const c = await onboarded("Chand Second");
        const v1 = await team(a, "Hostel app", [b]);
        const v2 = await team(c, "Library app", [b]);
        const { contributionId: e1 } = await work().logContribution({ ventureId: v1, kind: "code", description: "Built the room booking screen", skillIds: ["react"] }, as(b.token));
        expect(await level(b.token, "react")).toBe(0);
        await work().confirmContribution({ contributionId: e1 }, as(a.token));
        expect(await level(b.token, "react")).toBe(3);
        const { contributionId: e2 } = await work().logContribution({ ventureId: v2, kind: "code", description: "Built the catalogue search", skillIds: ["react"] }, as(b.token));
        await work().endorse({ endorseeId: b.id, ventureId: v1, items: [{ skillId: "react", evidenceId: e1 }], note: "" }, as(a.token));
        expect(await level(b.token, "react")).toBe(3);
        await work().endorse({ endorseeId: b.id, ventureId: v2, items: [{ skillId: "react", evidenceId: e2 }], note: "Great work" }, as(c.token));
        const mine = (await work().mySkills({}, read(b.token))).skills.find((s) => s.skillId === "react");
        expect([mine?.level, mine?.peerVerified]).toEqual([4, true]);
        const drawer = await work().skillEvidence({ skillId: "react" }, read(b.token));
        expect(drawer.proofs.map((p) => p.kind).sort()).toEqual(["contribution", "endorsement", "endorsement"]);
      });

      it.todo("W13: the contribution sheet's skill checkboxes, the level badges and the drawer, axe in both themes");
    });

    describe("endorsements.spec: endorse a teammate, the endorsee sees and hides it, limits hold", () => {
      it("endorse from the Team tab's sheet; the profile lists it; hiding takes it off; the limits refuse", async () => {
        const a = await onboarded("Endorse Owner");
        const b = await onboarded("Endorse Mate");
        const v = await team(a, "Endorse app", [b]);
        const options = await work().endorseOptions({ ventureId: v }, read(a.token));
        const mates = JSON.parse(options.teammatesJson) as { user_id: string; skills: { id: string }[] }[];
        expect([options.monthLeft, mates.map((m) => m.user_id), mates[0]!.skills.map((s) => s.id)]).toEqual([20, [b.id], ["react", "typescript"]]);
        expect((await work().endorse({ endorseeId: b.id, ventureId: v, items: [{ skillId: "react", evidenceId: "" }], note: "Solid" }, as(a.token))).given).toBe(1);
        await expect(work().endorse({ endorseeId: b.id, ventureId: v, items: [{ skillId: "react", evidenceId: "" }], note: "" }, as(a.token))).rejects.toSatisfy(
          (e) => refusalReason(e) === "already_endorsed",
        );
        await expect(work().endorse({ endorseeId: a.id, ventureId: v, items: [{ skillId: "react", evidenceId: "" }], note: "" }, as(a.token))).rejects.toSatisfy(
          (e) => refusalReason(e) === "endorse_self",
        );
        await expect(work().endorse({ endorseeId: b.id, ventureId: v, items: [{ skillId: "python", evidenceId: "" }], note: "" }, as(a.token))).rejects.toSatisfy(
          (e) => refusalReason(e) === "endorse_skill",
        );
        const list = await work().endorsementsFor({ userId: b.id }, read(b.token));
        expect(list.endorsements.map((e) => [e.skillName, e.endorserId, e.note, e.hidden])).toEqual([["React", a.id, "Solid", false]]);
        await work().hideEndorsement({ endorsementId: list.endorsements[0]!.id, hidden: true }, as(b.token));
        expect((await work().endorsementsFor({ userId: b.id }, read(a.token))).endorsements).toEqual([]);
        expect((await work().endorsementsFor({ userId: b.id }, read(b.token))).endorsements.map((e) => e.hidden)).toEqual([true]);
      });

      it.todo("W13: the endorse sheet and the profile's Endorsements list, axe in both themes");
    });

    describe("the credentials spec: upload, staff review in /ops, outcome on the profile", () => {
      it("a student attaches a certificate; a Trust reviewer claims and approves it with a recognised issuer", async () => {
        const s = await onboarded("Cred Student");
        const reviewer = await onboarded("Cred Reviewer", ["trust_reviewer"]);
        const path = `${s.id}/${crypto.randomUUID()}.pdf`;
        const { credentialId } = await work().submitCredential({ path, title: "Cloud Practitioner", issuer: "Amazon Web Services", issuedOn: "2026-01-10", expiresOn: "", verifyUrl: "" }, as(s.token));
        await expect(work().submitCredential({ path, title: "Again", issuer: "Someone", issuedOn: "2026-01-10", expiresOn: "", verifyUrl: "" }, as(s.token))).rejects.toSatisfy(
          (e) => refusalReason(e) === "file_attached",
        );
        await expect(work().opsCredentialQueue({ status: "pending" }, read(s.token))).rejects.toSatisfy((e) => refusalReason(e) === "trust_only");
        const queue = JSON.parse((await work().opsCredentialQueue({ status: "pending" }, read(reviewer.token))).json) as { id: string; suggested_issuer: string | null }[];
        const row = queue.find((q) => q.id === credentialId)!;
        await expect(work().opsReviewCredential({ credentialId, approve: true, reason: "Checked", issuerId: "" }, as(reviewer.token))).rejects.toSatisfy(
          (e) => refusalReason(e) === "credential_claim_first",
        );
        await work().opsClaimCredential({ id: credentialId, claim: true }, as(reviewer.token));
        await work().opsReviewCredential({ credentialId, approve: true, reason: "Verified on the issuer's site", issuerId: row.suggested_issuer ?? "" }, as(reviewer.token));
        const shown = await work().credentialsFor({ userId: s.id }, read(reviewer.token));
        expect(shown.credentials.map((c) => [c.title, c.status])).toEqual([["Cloud Practitioner", "approved"]]);
        const [audit] = await w.work<{ action: string }[]>`select action from work.audit_log where target_id = ${credentialId} order by created_at desc limit 1`;
        expect(audit!.action).toBe("credential.approve");
      });

      it.todo("W9: the PDF is stored privately in the credentials store and only the student and reviewers can open it");
      it.todo("W13: the upload form, /ops/evidence and the profile's credentials, axe in both themes");
    });

    describe("code-checks.spec: request from the drawer, answer, graded in /ops, L4", () => {
      it("a check is prepared from the student's own commit, served, answered, claimed and passed", async () => {
        const s = await onboarded("Check Student");
        const reviewer = await onboarded("Check Reviewer", ["trust_reviewer"]);
        const repo = { id: 7101, full_name: "checkdev/svc", owner_id: 9101, languages: { Python: 1000 } };
        w.github.account("code-check", { id: 9101, login: "checkdev", installation: 5101, repos: [repo] });
        const lines = Array.from({ length: 60 }, (_, i) => `total_${i} = add(${i}, ${i + 1})`);
        for (const [i, day] of ["2026-11-01", "2026-11-03", "2026-11-05"].entries())
          w.github.commit(repo.id, {
            sha: `${"c".repeat(39)}${i}`,
            authorId: 9101,
            authorLogin: "checkdev",
            date: `${day}T10:00:00Z`,
            files: [{ filename: `src/calc_${i}.py`, additions: 60, patch: patchOf(lines), content: lines.join("\n") }],
          });
        await work().connectGithub({ code: "code-check", installationId: 5101n }, as(s.token));
        await runJobs(w);
        expect(await level(s.token, "python")).toBe(2);
        const { checkId } = await work().requestCodeCheck({ skillId: "python" }, as(s.token));
        await runJobs(w);
        expect((await work().codeCheckState({ skillId: "python" }, read(s.token))).status).toBe("ready");
        await work().startCodeCheck({ checkId }, as(s.token));
        const snippet = await work().codeCheckSnippet({ checkId }, read(s.token));
        expect(snippet.lines.length).toBeGreaterThanOrEqual(20);
        await work().saveCodeCheck({ checkId, answers: { what: "Adds numbers", why: "Totals", change: "Use sum()" }, submit: true }, as(s.token));
        await work().opsClaimCodeCheck({ id: checkId, claim: true }, as(reviewer.token));
        const rubric = Object.fromEntries(["behaviour", "design", "change", "accuracy"].map((k) => [k, { pass: true, comment: "" }]));
        expect((await work().opsGradeCodeCheck({ checkId, rubricJson: JSON.stringify(rubric), feedback: "Clear answers" }, as(reviewer.token))).ok).toBe(true);
        expect(await level(s.token, "python")).toBe(4);
        await expect(work().requestCodeCheck({ skillId: "python" }, as(s.token))).rejects.toSatisfy((e) => refusalReason(e) === "check_passed");
      });

      it.todo("W13: the drawer's Code check button, the timed answer page and /ops grading, axe in both themes");
    });
  },
  workWorld((x) => (w = x), worlds),
);
