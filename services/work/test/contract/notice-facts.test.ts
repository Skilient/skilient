/**
 * What work added for notify (W9): NoticeFacts, the titles and catalogue names notices snapshot (ventures with their
 * owner and members, skills, credentials with the review reason, task attempts, swap sessions in Pakistan time), in
 * one query. Notify only.
 */
import { ConnectError } from "@connectrpc/connect";
import { WorkService } from "@skilient/contracts/work/v1/work_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, expect, it } from "vitest";
import { drainCopies, stopWorlds, student, workWorld, type WorkWorld } from "./world";

const worlds: WorkWorld[] = [];
let w: WorkWorld;
afterAll(() => stopWorlds(worlds));

const reason = (e: unknown) => refusalReason(e) ?? `code ${ConnectError.from(e).code}`;

describeTransports(
  ["identity", "people", "content", "messaging", "realtime", "work"],
  (env) => {
    it("NoticeFacts: a venture's title, owner and members, skill names, a credential's title and reason; notify only", async () => {
      const s = await student(w, { fullName: "Notice Facts" });
      await drainCopies(w);
      const { ventureId } = await env()
        .client(WorkService)
        .createVenture({ type: "project", title: "Plover Tracker", description: "Counting birds.", visibility: "public", skillIds: [], roles: [], questions: [] }, {
          ...env().call({ userToken: s.token }),
          headers: { "idempotency-key": crypto.randomUUID() },
        });
      const credential = crypto.randomUUID();
      await w.work`
        insert into work.credentials (id, user_id, title, issuer, issued_on, file_path, file_type, file_bytes, status, review_reason, reviewed_at)
        values (${credential}, ${s.id}, 'Plover Survey Certificate', 'Golden Board', current_date - 30, ${`${s.id}/${crypto.randomUUID()}.pdf`}, 'pdf', 1000, 'rejected', 'The date is unreadable.', now())`;
      const r = await env()
        .client(WorkService, "notify")
        .noticeFacts({ ventureIds: [ventureId, crypto.randomUUID()], skillIds: ["typescript", "nope"], credentialIds: [credential], attemptIds: [], sessionIds: [crypto.randomUUID()] }, env().call());
      expect(r.ventures.map((v) => [v.title, v.ownerId, v.memberIds])).toEqual([["Plover Tracker", s.id, [s.id]]]);
      expect(r.skills.map((k) => [k.id, k.name])).toEqual([["typescript", "TypeScript"]]);
      expect(r.credentials.map((c) => [c.title, c.reviewReason])).toEqual([["Plover Survey Certificate", "The date is unreadable."]]);
      expect([r.attempts, r.sessions]).toEqual([[], []]);
      await expect(env().client(WorkService).noticeFacts({}, env().call())).rejects.toSatisfy((e) => reason(e) === "caller_not_allowed");
    });
  },
  workWorld((x) => (w = x), worlds),
);
