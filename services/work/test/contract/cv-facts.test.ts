/**
 * What work added for credentials (W8): CvFacts, the CV's work parts in one query (the stack's cv_snapshot_base),
 * VentureTitles for credentials, and swap.closed's catalogue skill_label. Credentials only.
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
    it("CvFacts: L2+ skills by level then evidence, the top three, counts; credentials only", async () => {
      const s = await student(w, { fullName: "Facts Student" });
      await drainCopies(w);
      await w.work`insert into work.user_skills (user_id, skill_id, level, repos, active_days) values
                     (${s.id}, 'android', 2, 2, 5), (${s.id}, 'typescript', 3, 1, 1), (${s.id}, 'angular', 1, 9, 9)`;
      const r = JSON.parse((await env().client(WorkService, "credentials").cvFacts({ userId: s.id }, env().call())).json) as Record<string, unknown>;
      expect(r).toEqual({
        skills: [
          expect.objectContaining({ id: "typescript", level: 3, evidence: { repos: 1, active_days: 1, pull_requests: 0, entries: 0, endorsements: 0 } }),
          expect.objectContaining({ id: "android", name: "Android", category: "platform", level: 2, ai_assisted: false }),
        ],
        top_skills: ["TypeScript", "Android"],
        projects: [],
        projects_count: 0,
        completed_count: 0,
        open_source: [],
        pull_requests_count: 0,
        endorsements: [],
        credentials: [],
      });
      await expect(env().client(WorkService).cvFacts({ userId: s.id }, env().call())).rejects.toSatisfy((e) => reason(e) === "caller_not_allowed");
      expect(
        (await env().client(WorkService, "credentials").ventureTitles({ ventureIds: [] }, env().call())).ventures,
      ).toEqual([]);
    });
  },
  workWorld((x) => (w = x), worlds),
);
