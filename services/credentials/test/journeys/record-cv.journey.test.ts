/**
 * Service-level journeys mirroring apps/web/tests/e2e/record.spec.ts and cv.spec.ts on both transports, the W8
 * done-when (a CV and a Record entry signed here verify with the public key file; the stack's own are held by
 * test/golden/share-staff-verify.golden.test.ts), and the hand-off work left for W8 (the Taught entry). What only
 * the web can check is an it.todo naming W13; appeals are trust's (W10).
 */
import { ConnectError } from "@connectrpc/connect";
import { CredentialsService } from "@skilient/contracts/credentials/v1/credentials_pb";
import { WorkService } from "@skilient/contracts/work/v1/work_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, describe, expect, it } from "vitest";
import { helpers } from "../../../community/test/contract/helpers";
import { endEvent, tick } from "../../../community/test/contract/world";
import { publishTier } from "../../../ranking/test/contract/world";
import { giveSkill, pastSwapSession } from "../../../work/test/contract/world";
import { setConfirmedEmail } from "../../../identity/test/contract/world";
import { usernameOf } from "../../../people/test/contract/world";
import { check, cvEnvelopeOf, recordEnvelopeOf } from "../../src/signing/sign";
import { exportMac, sha256Hex } from "../../src/store/cv";
import { credentialsWorld, drain, jobs, stopWorlds, type CredentialsWorld } from "../contract/world";

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
    const settle = () => drain(w, env().host);
    const run = () => jobs(w, env().host);
    const json = <T>(r: { json: string }) => JSON.parse(r.json) as T;
    const keyFile = async () => JSON.parse((await cr().publicKeys({}, env().call())).document) as { keys: { key_id: string; public_key: string }[] };
    const proGrant = async (user: string, key: string) => {
      // billing (W12) isn't built: the grant is written into credentials' copy as entitlement.changed would (the copy is tested in the contract tests).
      await w.credentials`insert into credentials.entitlements (subject_id, key, value) values (${user}, ${key}, 'true'::jsonb) on conflict do nothing`;
    };
    const tier = (user: string, t: string) => publishTier(w, user, t, 0.9);

    /** A verified society with an officer, and an ended event the student and the officer checked into. */
    async function closedEvent(student: { id: string; token: string }, opts: { walkIn?: string } = {}) {
      const president = await h.onboarded("Journey President");
      const officer = await h.onboarded("Journey Officer");
      const s = await h.society(president, [officer]);
      const { eventId, ticketId } = await h.event(president, s.id, { seats: 5, startsIn: 3600_000 });
      await h.community().registerEvent({ eventId, ticketTypeId: ticketId, answersJson: "[]" }, h.as(student.token));
      await h.community().checkInPerson({ eventId, userId: student.id }, h.as(officer.token));
      await h.community().registerEvent({ eventId, ticketTypeId: ticketId, answersJson: "[]" }, h.as(officer.token));
      await h.community().checkInPerson({ eventId, userId: officer.id }, h.as(officer.token));
      if (opts.walkIn) await h.community().checkInEmail({ eventId, email: opts.walkIn }, h.as(officer.token));
      await endEvent(w, eventId);
      await tick(w, "event-tick");
      await h.community().issueEventEntries({ eventId }, h.as(officer.token));
      await settle();
      await run();
      await settle();
      return { society: s, president, officer, eventId };
    }

    describe("record.spec", () => {
      it("check-in to sealed entry, second officer, verify, CV, share, transcript and revoke", async () => {
        const student = await h.onboarded("Record Student");
        const { society, president, officer } = await closedEvent(student);
        // The student's entry is sealed; the officer's own check-in (self-added) waits for a second officer.
        const mine = json<{ entries: { id: string; kind: string; status: string; code: string }[] }>(await cr().myRecord({}, h.read(student.token)));
        expect(mine.entries.map((e) => [e.kind, e.status])).toEqual([["attended", "sealed"]]);
        const page = json<{ awaiting: { id: string; can_confirm: boolean; name: string }[] }>(await cr().societyRecordPage({ societyId: society.id }, h.read(president.token)));
        expect(page.awaiting.map((a) => [a.name, a.can_confirm])).toEqual([["Journey Officer", true]]);
        expect(await reason(cr().confirmRecordEntry({ entryId: page.awaiting[0]!.id }, h.as(officer.token)))).toBe("second_officer");
        await cr().confirmRecordEntry({ entryId: page.awaiting[0]!.id }, h.as(president.token));
        await run();
        // Anyone verifies the student's entry with the key file.
        const code = mine.entries[0]!.code;
        const v = json<{ code: string; key_id: string; signed_at: string; payload: Record<string, unknown>; envelope_hash: string; signature: string }>(
          await cr().verifyRecordEntry({ code: code.toLowerCase() }, env().call()),
        );
        const pub = (await keyFile()).keys.find((k) => k.key_id === v.key_id)!.public_key;
        expect(check(recordEnvelopeOf({ code: v.code, key_id: v.key_id, signed_at: v.signed_at, payload: v.payload }), v.envelope_hash, v.signature, pub)).toBe("valid");
        expect(v.payload).toMatchObject({ kind: "attended", holder: { name: "Record Student" }, issuer: { name: society.name } });
        // On the CV ("Leadership and activities").
        await cr().saveCvActivities({ entryIds: [mine.entries[0]!.id] }, h.as(student.token));
        const { code: cvCode } = await cr().issueCv({ action: "ensure" }, h.as(student.token));
        const cv = await cr().verifyCv({ code: cvCode, pdfHash: "" }, env().call());
        expect((JSON.parse(cv.snapshotJson) as { activities: { label: string; code: string }[] }).activities.map((a) => a.code)).toEqual([code]);
        // A share link (an expiry always), opened once per viewer a day.
        const link = await cr().createRecordShareLink({ label: "Scholarship", days: 30 }, h.as(student.token));
        const viewer = sha256Hex("viewer");
        const open = () => cr().openRecordShare({ token: link.token, viewerKey: viewer }, h.as(student.token));
        expect(json<{ state: string; person: { name: string }; entries: { code: string }[] }>(await open())).toMatchObject({ state: "ok", person: { name: "Record Student" }, entries: [{ code }] });
        await open();
        expect(json<{ links: { view_count: number }[] }>(await cr().myRecord({}, h.read(student.token))).links.map((l) => l.view_count)).toEqual([1]);
        // A transcript the PDF route made (MAC), verifiable by id.
        const exportId = crypto.randomUUID();
        const pdfHash = sha256Hex("pdf");
        await cr().recordPdfExport({ exportId, kind: "transcript", entryId: "", codes: [code], pdfHash, bytes: 4096, mac: exportMac(w.exportSecret, [exportId, "transcript", "", code, pdfHash, 4096]) }, h.as(student.token));
        expect(json<{ entries: { code: string; status: string }[] }>(await cr().verifyRecordTranscript({ exportId }, env().call())).entries).toEqual([
          expect.objectContaining({ code, status: "sealed" }),
        ]);
        // Revoked by an officer: verify shows code, dates and category; the CV pick drops.
        await cr().revokeRecordEntry({ entryId: mine.entries[0]!.id, category: "issued_in_error", reason: "Scanned the wrong ticket" }, h.as(president.token));
        expect(json<{ status: string; revoked_category: string; payload?: unknown }>(await cr().verifyRecordEntry({ code }, env().call()))).toMatchObject({
          status: "revoked",
          revoked_category: "issued_in_error",
        });
        expect(json<{ chosen: string[] }>(await cr().cvActivityOptions({}, h.read(student.token))).chosen).toEqual([]);
      });

      it("a walk-in's held entry is claimed after signup with the same address, never with another", async () => {
        const student = await h.onboarded("Walkin Witness");
        const address = `walkin-${Date.now().toString(36)}@nutech-contract.test`;
        await closedEvent(student, { walkIn: address });
        const zara = await h.onboarded("Zara Walkin");
        expect((await cr().recordWaiting({}, h.read(zara.token))).count).toBe(0);
        expect((await cr().claimRecordEntries({}, h.as(zara.token))).claimed).toBe(0);
        await setConfirmedEmail(w.sql, zara.id, address);
        expect((await cr().recordWaiting({}, h.read(zara.token))).count).toBe(1);
        expect((await cr().claimRecordEntries({}, h.as(zara.token))).claimed).toBe(1);
        await run();
        expect(json<{ entries: { kind: string; status: string }[] }>(await cr().myRecord({}, h.read(zara.token))).entries.map((e) => [e.kind, e.status])).toEqual([["attended", "sealed"]]);
        expect((await cr().recordWaiting({}, h.read(zara.token))).count).toBe(0);
      });

      it.todo("W13: /me/record, /record/[username], /verify/[code], /verify/transcript/[id], the society's Record tab and /ops/record, axe in both themes");
      it.todo("W13: the empty Record points to the next society event (community's events list)");
      it.todo("W10: a revoked entry's appeal (trust's appeals, record_revocation)");
    });

    describe("cv.spec", () => {
      it("issue, share, verify, supersede and revoke (the W8 done-when: signed here, verified with the key file)", async () => {
        const s = await h.onboarded("Cv Journey");
        await tier(s.id, "spark");
        const first = await cr().issueCv({ action: "ensure" }, h.as(s.token));
        expect(await reason(cr().issueCv({ action: "refresh" }, h.as(s.token)))).toBe("refresh_pro");
        await proGrant(s.id, "cv.refresh_on_demand");
        const second = await cr().issueCv({ action: "refresh" }, h.as(s.token));
        expect(second.code).not.toBe(first.code);
        const keys = await keyFile();
        for (const code of [first.code, second.code]) {
          const v = await cr().verifyCv({ code, pdfHash: "" }, env().call());
          const pub = keys.keys.find((k) => k.key_id === v.keyId)!.public_key;
          expect(check(cvEnvelopeOf({ code: v.code, key_id: v.keyId, issued_at: v.issuedAt, expires_at: v.expiresAt, snapshot: JSON.parse(v.snapshotJson) }), v.snapshotHash, v.signature, pub)).toBe("valid");
        }
        expect((await cr().verifyCv({ code: first.code, pdfHash: "" }, env().call())).supersededAt).not.toBe("");
        // A share link always opens the newest version and counts a viewer once a day.
        const link = await cr().createCvShareLink({ label: "Recruiters", days: 30 }, h.as(s.token));
        const viewer = sha256Hex("cv-viewer");
        const o1 = await cr().openSharedCv({ token: link.token, viewerKey: viewer }, h.as(s.token));
        await cr().openSharedCv({ token: link.token, viewerKey: viewer }, h.as(s.token));
        expect([o1.state, o1.code]).toEqual(["ok", second.code]);
        expect(json<{ views: { total: number } }>(await cr().myCv({}, h.read(s.token))).views.total).toBe(1);
        // Revoked newest: the link is unavailable, verify shows dates only; re-issue gives the same content a new code.
        const records = json<{ records: { id: string; code: string }[] }>(await cr().myCv({}, h.read(s.token))).records;
        await cr().revokeCv({ recordId: records.find((r) => r.code === second.code)!.id }, h.as(s.token));
        expect((await cr().openSharedCv({ token: link.token, viewerKey: viewer }, h.as(s.token))).state).toBe("unavailable");
        const revoked = await cr().verifyCv({ code: second.code, pdfHash: "" }, env().call());
        expect([revoked.revokedAt !== "", revoked.snapshotJson]).toEqual([true, ""]);
        const again = await cr().issueCv({ action: "reissue" }, h.as(s.token));
        expect(again.code).not.toBe(second.code);
        expect((await cr().openSharedCv({ token: link.token, viewerKey: viewer }, h.as(s.token))).code).toBe(again.code);
      });

      it("share links open at Spark; PDF export is Pro; the render job's PDF verifies and a changed byte doesn't", async () => {
        const s = await h.onboarded("Pdf Journey");
        const { code } = await cr().issueCv({ action: "ensure" }, h.as(s.token));
        expect(await reason(cr().createCvShareLink({ label: "", days: 7 }, h.as(s.token)))).toBe("share_spark");
        expect((await cr().cvExportRights({}, h.read(s.token))).pdfExport).toBe(false);
        const record = json<{ records: { id: string }[] }>(await cr().myCv({}, h.read(s.token))).records[0]!;
        expect(await reason(cr().requestPdf({ kind: "cv", recordId: record.id, entryId: "", template: "standard", paper: "a4" }, h.as(s.token)))).toBe("pdf_pro");
        await proGrant(s.id, "cv.pdf_export");
        const { jobId } = await cr().requestPdf({ kind: "cv", recordId: record.id, entryId: "", template: "standard", paper: "a4" }, h.as(s.token));
        expect((await cr().pdfStatus({ jobId }, h.read(s.token))).status).toBe("queued");
        await run();
        const done = await cr().pdfStatus({ jobId }, h.read(s.token));
        expect(done.status).toBe("done");
        expect(new TextDecoder().decode(w.files.get(done.path)!).startsWith("%PDF-")).toBe(true);
        expect((await cr().verifyCv({ code, pdfHash: done.pdfHash }, env().call())).pdfMatches).toBe(true);
        expect((await cr().verifyCv({ code, pdfHash: sha256Hex("altered") }, env().call())).pdfMatches).toBe(false);
        // The web route's export (MAC over its fields): the file must be in media, which W9 builds; until then the
        // hosted service finds none and refuses. The MAC and size checks are held by the golden replays (cv.json#exports).
        const exportId = crypto.randomUUID();
        const pdfHash = sha256Hex("route-pdf");
        const fields = [exportId, record.id, "standard", "a4", pdfHash, 1500] as const;
        expect(await reason(cr().recordCvExport({ exportId, recordId: record.id, template: "standard", paper: "a4", pdfHash, bytes: 1500, mac: "0".repeat(64) }, h.as(s.token)))).toBe(
          "export_not_ours",
        );
        expect(
          await reason(cr().recordCvExport({ exportId, recordId: record.id, template: "standard", paper: "a4", pdfHash, bytes: 1500, mac: exportMac(w.exportSecret, [...fields]) }, h.as(s.token))),
        ).toBe("pdf_missing");
      });

      it.todo("W13: /me/cv, /cv/[username]?t=, /verify and the ATS PDF in every template (Chromium in the render job), axe in both themes");
    });

    describe("hand-offs left for W8", () => {
      it("work: the Taught entry is issued on the teacher's Record from swap.closed", async () => {
        const work = () => env().client(WorkService);
        const teacher = await h.onboarded("Tara Teacher");
        const learner = await h.onboarded("Lalo Learner");
        await giveSkill(w, teacher.id, "typescript", 2);
        await work().saveSwapOffer({ skillId: "typescript", note: "Happy to teach", on: true }, h.as(teacher.token));
        const { swapId } = await work().requestSwap(
          { teacherUsername: await usernameOf(w, teacher.id), skillId: "typescript", note: "Please", preferredTimes: "Evenings", offeredSkillId: "" },
          h.as(learner.token),
        );
        await work().respondSwap({ swapId, accept: true }, h.as(teacher.token));
        const { sessionId } = await work().proposeSwapSession({ swapId, startsAt: new Date(Date.now() + 86_400_000).toISOString(), minutes: 90, place: "Library" }, h.as(teacher.token));
        await work().respondSwapSession({ sessionId, accept: true }, h.as(learner.token));
        await pastSwapSession(w, sessionId);
        await work().confirmSwapSession({ sessionId, happened: true, minutes: 90, reason: "", note: "" }, h.as(learner.token));
        await work().endSwap({ swapId }, h.as(learner.token));
        await settle();
        await run();
        const entries = (await cr().myEntries({ entryIds: [], sourceIds: [swapId] }, h.read(teacher.token))).entries;
        expect(entries.map((e) => [e.kind, e.title, e.line, e.status, e.code.length])).toEqual([["taught", "Taught TypeScript to Lalo", "1 session · 1.5 h", "sealed", 10]]);
      });
    });
  },
  credentialsWorld((x) => (w = x), worlds),
);
