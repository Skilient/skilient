/**
 * What ranking added for notify (W9): ScoredStudents, every student with a score row by id, a page at a time (the
 * formula notice went to every ranking_scores row). Notify only.
 */
import { ConnectError } from "@connectrpc/connect";
import { RankingService } from "@skilient/contracts/ranking/v1/ranking_pb";
import { refusalReason } from "@skilient/platform";
import { describeTransports } from "@skilient/testing";
import { afterAll, expect, it } from "vitest";
import { rankingWorld, stopWorlds, type RankingWorld } from "./world";

const worlds: RankingWorld[] = [];
let w: RankingWorld;
afterAll(() => stopWorlds(worlds));

const reason = (e: unknown) => refusalReason(e) ?? `code ${ConnectError.from(e).code}`;

describeTransports(
  ["identity", "people", "content", "messaging", "realtime", "work", "ranking"],
  (env) => {
    it("ScoredStudents: by id, after a cursor, a page at a time; notify only", async () => {
      const ids = ["9c000000-0000-4000-8000-000000000001", "9c000000-0000-4000-8000-000000000002", "9c000000-0000-4000-8000-000000000003"];
      await w.ranking`delete from ranking.ranking_scores`;
      for (const id of ids)
        await w.ranking`
          insert into ranking.ranking_scores (user_id, formula_version, components, proof, momentum, adjustments, total, ranked, computed_at, published_at)
          values (${id}, 2, '{}', 0, 0, 0, 10, true, now(), now())`;
      const page = (after: string, limit: number) => env().client(RankingService, "notify").scoredStudents({ afterUserId: after, limit }, env().call());
      expect((await page("", 2)).userIds).toEqual(ids.slice(0, 2));
      expect((await page(ids[1]!, 2)).userIds).toEqual([ids[2]]);
      expect((await page(ids[2]!, 0)).userIds).toEqual([]);
      await expect(env().client(RankingService).scoredStudents({}, env().call())).rejects.toSatisfy((e) => reason(e) === "caller_not_allowed");
    });
  },
  rankingWorld((x) => (w = x), worlds),
);
