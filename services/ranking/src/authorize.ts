import type { RankingService } from "@skilient/contracts/ranking/v1/ranking_pb";
import type { CallerPolicy } from "@skilient/platform";

const WEB = ["web"] as const;

/**
 * Which callers may use each method; the gate refuses anyone else before the body is read. Web calls every
 * reader-facing and staff method (the reader comes from the token). TiersFor is also the batch other services
 * call once per page of cards for a signed-in reader; TiersOf is for services that show tiers without one; the
 * university calendar is market's (it checks the admin's seat first).
 */
export const callers: CallerPolicy<typeof RankingService> = {
  leaderboard: WEB,
  leaderboardMe: WEB,
  leaderboardFilters: WEB,
  myScore: WEB,
  tiersFor: ["web", "content", "people", "messaging", "community", "market"],
  tiersOf: ["credentials", "market", "trust", "community", "notify"],
  scoredStudents: ["notify"],
  rankingFlagQueue: ["web", "trust"],
  rankingFlagCase: WEB,
  claimRankingFlag: WEB,
  reviewRankingFlag: WEB,
  examPeriodList: WEB,
  addExamPeriod: WEB,
  removeExamPeriod: WEB,
  uniExamPeriods: ["market"],
  uniAddExamPeriod: ["market"],
  uniRemoveExamPeriod: ["market"],
};
