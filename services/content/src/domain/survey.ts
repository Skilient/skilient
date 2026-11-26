import type { Config } from "./config";

/**
 * The micro-survey's rules, pure (assign_survey_question's dimension order, answer_survey's weights).
 */
export interface Dimension {
  dimension: string;
  post_types: readonly string[];
  tie_priority: number;
  /** Active question ids. */
  questions: readonly number[];
}

/**
 * The dimension a reader is asked on a post: furthest behind its share of the post's assignments
 * (Informative and Interesting a quarter each, the rest sharing half), safety signals winning ties, then a
 * random pick among equals. Only dimensions for the post's type with an active question.
 */
export function chooseDimension(
  postType: string,
  assigned: Readonly<Record<string, number>>,
  dims: readonly Dimension[],
  c: Config,
  pick: (n: number) => number,
): Dimension | null {
  const shares = c["survey.shares"];
  const forType = dims.filter((d) => d.post_types.includes(postType));
  const restCount = forType.filter((d) => d.dimension !== "informative" && d.dimension !== "interesting").length;
  const total = Object.values(assigned).reduce((a, b) => a + b, 0);
  const share = (d: Dimension) =>
    d.dimension === "informative" ? shares.informative : d.dimension === "interesting" ? shares.interesting : shares.rest / Math.max(restCount, 1);
  const open = forType.filter((d) => d.questions.length > 0);
  if (open.length === 0) return null;
  const key = (d: Dimension) => share(d) * (total + 1) - (assigned[d.dimension] ?? 0);
  const best = Math.max(...open.map(key));
  const top = open.filter((d) => Math.abs(key(d) - best) < 1e-9);
  const tie = Math.max(...top.map((d) => d.tie_priority));
  const finalists = top.filter((d) => d.tie_priority === tie);
  return finalists[pick(finalists.length)]!;
}

/** answer_survey's anti-gaming weight (PRD 5.28): the factors multiplied, rounded to 3 places. */
export function responseWeight(f: { friendOrTeammate: boolean; newAccount: boolean; prior: number; variation: boolean }, c: Config): number {
  const w = c["survey.weights"];
  let weight = 1;
  if (f.friendOrTeammate) weight *= w.friend_or_teammate;
  if (f.newAccount) weight *= w.new_account;
  if (f.prior >= w.straight_liner_min && !f.variation) weight *= w.straight_liner;
  return Math.round(weight * 1000) / 1000;
}
