/**
 * The graduation rule (phase 6, `private.graduate_rollover` and `private.final_year_of`): students graduate
 * on 1 September, Asia/Karachi time; a university's final_year_batch is an exception. The rule's date lives
 * in trust's config today (`graduates.rule`); people keeps the current value (decision 2026-11-25, W2).
 */
export const GRADUATION_RULE = { month: 9, day: 1 } as const;

/** A calendar date in Asia/Karachi (UTC+5, no daylight saving). */
export function karachiDate(at: Date): { year: number; month: number; day: number } {
  const t = new Date(at.getTime() + 5 * 3600_000);
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

/** The newest graduation year that has already graduated under the rule on `today`. */
export function graduatedYear(today: { year: number; month: number; day: number }, rule = GRADUATION_RULE): number {
  const before = today.month < rule.month || (today.month === rule.month && today.day < rule.day);
  return today.year - (before ? 1 : 0);
}

/** `final_year_of`: the university's final-year batch, or this academic year's (September onwards is next year's). */
export function finalYearOf(finalYearBatch: number | null, now: Date): number {
  if (finalYearBatch != null) return finalYearBatch;
  const d = karachiDate(now);
  return d.year + (d.month >= 9 ? 1 : 0);
}
