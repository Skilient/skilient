/**
 * Credentials' contract on both transports: the caller rules and anonymous reads, the batch reads other services
 * added for it (work's CvFacts, identity's EmailsOf, community's RecordFacts, ranking's percentile, people's flags),
 * a CV issued with the real services and verified with the public key file (the W8 done-when, new half), the
 * hand-offs from community (event.closed, society.term_changed) and work (swap.closed, task.completed) through
 * signing to ranking's copy and people's milestone, staff audit before and after, a ban and a deletion.
 */
import { ConnectError } from "@connectrpc/connect";
import { CommunityService } from "@skilient/contracts/community/v1/community_pb";
import { CredentialsService } from "@skilient/contracts/credentials/v1/credentials_pb";
import { IdentityService } from "@skilient/contracts/identity/v1/identity_pb";
import { RankingService } from "@skilient/contracts/ranking/v1/ranking_pb";
import { WorkService } from "@skilient/contracts/work/v1/work_pb";
import { appendEvents, refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { endEvent, endTerm, recordKindsAndResult, tick } from "../../../community/test/contract/world";
import { helpers } from "../../../community/test/contract/helpers";
import { milestonesOf } from "../../../people/test/contract/world";
import { publishTier, recordCopyOf } from "../../../ranking/test/contract/world";
import { giveSkill } from "../../../work/test/contract/world";
import { check, cvEnvelopeOf, recordEnvelopeOf } from "../../src/signing/sign";
import { credentialsWorld, drain, eventsOf, jobs, stopWorlds, type CredentialsWorld } from "./world";

const worlds: CredentialsWorld[] = [];
let w: CredentialsWorld;
afterAll(() => stopWorlds(worlds));

async function reason(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    if (e instanceof ConnectError) return refusalReason(e) ?? `code:${e.code}`;
    throw e;
  }
}

describeTransports(
  ["identity", "people", "content", "messaging", "realtime", "work", "ranking", "community", "credentials"],
  (env) => {
    const h = helpers(env, () => w);
    const cr = () => env().client(CredentialsService);
    const host = () => env().host;
    const settle = () => drain(w, host());

    describe("callers", () => {
      it("anyone verifies and reads the key file; a signed-out reader is refused; the batch reads are credentials' only", async () => {
        const doc = JSON.parse((await cr().publicKeys({}, env().call())).document) as { issuer: string; keys: { key_id: string; public_key: string; retired_at: string | null }[] };
        expect(doc.issuer).toBe("Skilient");
        expect(doc.keys.filter((k) => k.retired_at === null).map((k) => [k.key_id, k.public_key])).toEqual([[w.signingKey.keyId, w.signingKey.publicKey]]);
        expect((await cr().verifyCv({ code: "0000000000", pdfHash: "" }, env().call())).found).toBe(false);
        expect((await cr().verifyRecordEntry({ code: "0000000000" }, env().call())).json).toBe("");
        expect(await reason(cr().myRecord({}, env().call()))).toBe("not_signed_in");
        expect(await reason(cr().myCv({}, env().call()))).toBe("not_signed_in");
        expect(await reason(env().client(CredentialsService, "content").verifyCv({ code: "0000000000", pdfHash: "" }, env().call()))).not.toBeNull();
        expect(await reason(env().client(WorkService).cvFacts({ userId: crypto.randomUUID() }, env().call()))).not.toBeNull();
        expect(await reason(env().client(IdentityService).emailsOf({ userIds: [] }, env().call()))).not.toBeNull();
        expect(await reason(env().client(CommunityService).recordFacts({ eventIds: [], termIds: [], attendeeIds: [], societyIds: [] }, env().call()))).not.toBeNull();
      });
    });

    describe("CVs", () => {
      it("a CV issued with the real services verifies with the key file; cv.built reaches people; a repeat is the same reply", async () => {
        const s = await h.onboarded("Cv Student");
        await giveSkill(w, s.id, "typescript", 2, 2, 5);
        await publishTier(w, s.id, "spark", 0.7);
        const key = { ...h.read(s.token), headers: { "idempotency-key": crypto.randomUUID() } };
        const a = await cr().issueCv({ action: "ensure" }, key);
        const b = await cr().issueCv({ action: "ensure" }, key);
        expect([a.status, a.code]).toEqual(["issued", expect.stringMatching(/^[0-9A-Z]{10}$/)]);
        expect(b).toEqual(a);
        expect((await cr().issueCv({ action: "ensure" }, h.as(s.token))).status).toBe("exists");
        const v = await cr().verifyCv({ code: a.code.toLowerCase(), pdfHash: "" }, env().call());
        const snapshot = JSON.parse(v.snapshotJson) as { skills: { id: string }[]; person: { name: string }; standing: { tier: string | null } };
        expect(snapshot.person.name).toBe("Cv Student");
        expect(snapshot.skills.map((x) => x.id)).toEqual(["typescript"]);
        const doc = JSON.parse((await cr().publicKeys({}, env().call())).document) as { keys: { key_id: string; public_key: string }[] };
        const pub = doc.keys.find((k) => k.key_id === v.keyId)!.public_key;
        expect(check(cvEnvelopeOf({ code: v.code, key_id: v.keyId, issued_at: v.issuedAt, expires_at: v.expiresAt, snapshot: snapshot as never }), v.snapshotHash, v.signature, pub)).toBe("valid");
        await settle();
        expect(await milestonesOf(w, s.id)).toContain("cv.built");
        const share = await reason(cr().createCvShareLink({ label: "Me", days: 7 }, h.as(s.token)));
        expect(share === null || share === "share_spark").toBe(true);
      });

      it("staff revoke: trust reviewers with two-factor, audited before and after, published", async () => {
        const s = await h.onboarded("Revoked Student");
        const { code } = await cr().issueCv({ action: "ensure" }, h.as(s.token));
        const reviewer = await h.onboarded("Cv Reviewer", { staffRoles: ["trust_reviewer"] });
        const aal1 = await w.token(reviewer.id, "aal1");
        expect(await reason(cr().opsCvRecords({ query: code }, h.read(aal1)))).toBe("trust_only");
        const rows = JSON.parse((await cr().opsCvRecords({ query: code }, h.read(reviewer.token))).json) as { id: string; full_name: string }[];
        expect(rows.map((r) => r.full_name)).toEqual(["Revoked Student"]);
        expect(await reason(cr().opsRevokeCv({ recordId: rows[0]!.id, all: false, reason: "no" }, h.as(reviewer.token)))).toBe("staff_reason");
        expect((await cr().opsRevokeCv({ recordId: rows[0]!.id, all: false, reason: "Fake university email" }, h.as(reviewer.token))).revoked).toBe(1);
        const [audit] = await w.credentials<{ before: { code: string }; after: { revoked: number } }[]>`select before, after from credentials.audit_log where target_id = ${rows[0]!.id}`;
        expect([audit!.before.code, audit!.after.revoked]).toEqual([code, 1]);
        expect((await eventsOf(w, "audit.recorded")).some((e) => e.payload["target_id"] === rows[0]!.id)).toBe(true);
        const v = await cr().verifyCv({ code, pdfHash: "" }, env().call());
        expect([v.found, v.revokedAt !== "", v.snapshotJson, v.signature]).toEqual([true, true, "", ""]);
      });

      it("user.banned revokes every version and link; user.deleted wipes content and keeps the code", async () => {
        const s = await h.onboarded("Banned Student");
        const { code } = await cr().issueCv({ action: "ensure" }, h.as(s.token));
        await w.sql.begin((tx) => appendEvents(tx, [{ type: "user.banned", subjects: [s.id], payload: { user_id: s.id, until: null } }]));
        await settle();
        expect((await cr().verifyCv({ code, pdfHash: "" }, env().call())).revokedAt).not.toBe("");
        expect((await eventsOf(w, "cv.revoked")).some((e) => e.payload["user_id"] === s.id && e.payload["reason"] === "suspended")).toBe(true);
        await w.sql.begin((tx) => appendEvents(tx, [{ type: "user.deleted", subjects: [s.id], payload: { user_id: s.id } }]));
        await settle();
        const v = await cr().verifyCv({ code, pdfHash: "" }, env().call());
        expect([v.found, v.snapshotJson]).toEqual([true, ""]);
        expect((await eventsOf(w, "user.deletion_confirmed")).some((e) => e.payload["user_id"] === s.id && e.producer === "svc_credentials")).toBe(true);
      });
    });

    describe("hand-offs", () => {
      it("community's close-out and confirmed term become entries, sealed with the key file's key; ranking copies them with the evidence", async () => {
        const president = await h.onboarded("Rec President");
        const officer = await h.onboarded("Rec Officer");
        const s = await h.society(president, [officer]);
        await settle();
        const termId = await endTerm(w, s.id, officer.id);
        await tick(w, "society-tick");
        await h.community().confirmTerm({ termId }, h.as(president.token));
        const { eventId, ticketId } = await h.event(president, s.id, { seats: 5, startsIn: 3600_000 });
        await h.community().registerEvent({ eventId, ticketTypeId: ticketId, answersJson: "[]" }, h.as(officer.token));
        await h.community().checkInPerson({ eventId, userId: officer.id }, h.as(president.token));
        await endEvent(w, eventId);
        await recordKindsAndResult(w, eventId, officer.id, 1, "Best robot", president.id);
        await tick(w, "event-tick");
        await h.community().issueEventEntries({ eventId }, h.as(president.token));
        await settle();
        expect(await jobs(w, host())).toBeGreaterThan(0);
        await settle();
        const record = JSON.parse((await cr().myRecord({}, h.read(officer.token))).json) as { entries: { kind: string; status: string; line: string; issuer_slug: string; code: string }[] };
        expect(record.entries.map((e) => [e.kind, e.status]).sort()).toEqual(
          [
            ["attended", "sealed"],
            ["completed", "sealed"],
            ["office_bearer", "sealed"],
            ["result", "sealed"],
          ].sort(),
        );
        expect(record.entries.find((e) => e.kind === "result")!.line).toBe("Best robot of 1");
        expect(new Set(record.entries.map((e) => e.issuer_slug))).toEqual(new Set([s.slug]));
        const doc = JSON.parse((await cr().publicKeys({}, env().call())).document) as { keys: { key_id: string; public_key: string }[] };
        const e = JSON.parse((await cr().verifyRecordEntry({ code: record.entries[0]!.code }, env().call())).json) as {
          code: string;
          key_id: string;
          signed_at: string;
          payload: Record<string, unknown>;
          envelope_hash: string;
          signature: string;
        };
        const pub = doc.keys.find((k) => k.key_id === e.key_id)!.public_key;
        expect(check(recordEnvelopeOf({ code: e.code, key_id: e.key_id, signed_at: e.signed_at, payload: e.payload }), e.envelope_hash, e.signature, pub)).toBe("valid");
        const copy = await recordCopyOf(w, officer.id);
        expect(copy.map((c) => c.kind).sort()).toEqual(["attended", "completed", "office_bearer", "result"]);
        expect(copy.find((c) => c.kind === "result")!.evidence).toEqual({ place: 1, entrants: 1 });
        expect(copy.find((c) => c.kind === "office_bearer")!.evidence).toEqual({ role: "officer" });
        // The officers' tab: the president sees the society's entries by name.
        const page = JSON.parse((await cr().societyRecordPage({ societyId: s.id }, h.read(president.token))).json) as { entries: { name: string }[] };
        expect(new Set(page.entries.map((x) => x.name))).toEqual(new Set(["Rec Officer"]));
        // Revoking one tells ranking.
        const id = (JSON.parse((await cr().myRecord({}, h.read(officer.token))).json) as { entries: { id: string; kind: string }[] }).entries.find((x) => x.kind === "result")!.id;
        await cr().revokeRecordEntry({ entryId: id, category: "issued_in_error", reason: "Wrong person" }, h.as(president.token));
        await settle();
        expect((await recordCopyOf(w, officer.id)).find((c) => c.kind === "result")!.status).toBe("revoked");
      });

      it("work's swap.closed issues the teacher's Taught entry; task.completed the proof task entry", async () => {
        const teacher = await h.onboarded("Tara Taught");
        const learner = await h.onboarded("Lalo Learner");
        const swap = crypto.randomUUID();
        await w.work.begin((tx) =>
          appendEvents(tx, [
            {
              type: "swap.closed",
              subjects: [swap, teacher.id, learner.id],
              payload: { swap_id: swap, teacher_id: teacher.id, learner_id: learner.id, skill_id: "typescript", skill_label: "TypeScript", sessions: 1, minutes: 60, last_session_on: "2026-11-20" },
            },
            {
              type: "task.completed",
              subjects: [teacher.id],
              payload: { user_id: teacher.id, attempt_id: crypto.randomUUID(), skill_id: "typescript", skill_label: "TypeScript", task_title: "Build a list screen", verified_by: "github" },
            },
          ]),
        );
        await settle();
        await jobs(w, host());
        const mine = await cr().myEntries({ entryIds: [], sourceIds: [swap] }, h.read(teacher.token));
        expect(mine.entries.map((e) => [e.kind, e.title, e.line, e.status])).toEqual([["taught", "Taught TypeScript to Lalo", "1 session · 1 h", "sealed"]]);
        const record = JSON.parse((await cr().myRecord({}, h.read(teacher.token))).json) as { entries: { kind: string; line: string }[] };
        expect(record.entries.map((e) => [e.kind, e.line]).sort()).toEqual([
          ["proof_task", "TypeScript · verified by GitHub"],
          ["taught", "1 session · 1 h"],
        ]);
      });

      it("ranking's TiersOf carries the percentile for the CV", async () => {
        const s = await h.onboarded("Tier Student");
        await publishTier(w, s.id, "spark", 0.7);
        const r = await env().client(RankingService, "credentials").tiersOf({ userIds: [s.id] }, env().call());
        expect(r.tiers.map((t) => [t.tier, t.percentile])).toEqual([["spark", 0.7]]);
      });
    });
  },
  credentialsWorld((x) => (w = x), worlds),
);
