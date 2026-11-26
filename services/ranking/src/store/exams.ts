import { uuidv7 } from "@skilient/platform";
import { daysBetween } from "../domain/numbers";
import { refused, refusedWith } from "../refusals";
import type { Db, Tx } from "./db";
import { audit } from "./flags";

/**
 * Exam periods (PRD 5.13: decay pauses on these days), ported from _ranking.sql and _ops_wrapup.sql (accounts
 * staff in /ops, audited before and after) and _uni_ecosphere.sql (a university's own admins, through market,
 * which checks the seat and keeps the university's audit; at most 90 exam days a calendar year).
 */
export interface ExamRow {
  id: string;
  university_id: string;
  starts_on: string;
  ends_on: string;
  reason: string;
  created_by: string | null;
  created_at: Date;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
function checkPeriod(starts: string, ends: string, reason: string): string {
  const text = reason.trim();
  if (text.length < 3) throw refused("give_reason");
  if (!DATE.test(starts) || !DATE.test(ends) || ends < starts) throw refused("exam_end_before_start");
  if (daysBetween(starts, ends) >= 45) throw refused("exam_too_long");
  return text;
}

/** `exam_period_list()`: every university's, newest first (at most 300). University names are people's. */
export const examPeriodList = (db: Db) =>
  db<ExamRow[]>`
    select id::text, university_id::text, starts_on::text, ends_on::text, reason, created_by::text, created_at
      from ranking.exam_periods order by starts_on desc, university_id limit 300`;

/** A university's own periods (the university calendar). */
export const universityExamPeriods = (db: Db, universityId: string) =>
  db<ExamRow[]>`
    select id::text, university_id::text, starts_on::text, ends_on::text, reason, created_by::text, created_at
      from ranking.exam_periods where university_id = ${universityId} order by starts_on desc`;

/**
 * `add_exam_period(university, starts, ends, reason)` (accounts staff). A university is known to ranking when
 * one of its people is (people's profile copy); one without people has nobody whose decay could pause.
 */
export async function addExamPeriod(tx: Tx, staff: string, universityId: string, starts: string, ends: string, reason: string): Promise<string> {
  const text = checkPeriod(starts, ends, reason);
  const [known] = await tx`select 1 from ranking.members where university_id = ${universityId} limit 1`;
  if (!known) throw refused("university_not_found");
  await tx`select pg_advisory_xact_lock(hashtextextended(${`exam-periods:${universityId}`}, 0))`;
  const [overlap] = await tx`select 1 from ranking.exam_periods where university_id = ${universityId} and starts_on <= ${ends}::date and ends_on >= ${starts}::date`;
  if (overlap) throw refused("exam_overlap");
  const id = uuidv7();
  await tx`insert into ranking.exam_periods (id, university_id, starts_on, ends_on, reason, created_by) values (${id}, ${universityId}, ${starts}::date, ${ends}::date, ${text}, ${staff})`;
  await audit(tx, {
    staffId: staff,
    action: "exam_period.add",
    targetType: "exam_period",
    targetId: id,
    reason: text,
    before: {},
    after: { university_id: universityId, starts_on: starts, ends_on: ends },
  });
  return id;
}

/** `remove_exam_period(id, reason)` (accounts staff). */
export async function removeExamPeriod(tx: Tx, staff: string, id: string, reason: string): Promise<void> {
  const text = reason.trim();
  if (text.length < 3) throw refused("give_reason");
  const [e] = await tx<{ university_id: string; starts_on: string; ends_on: string; reason: string }[]>`
    delete from ranking.exam_periods where id = ${id} returning university_id::text, starts_on::text, ends_on::text, reason`;
  if (!e) throw refused("exam_not_found");
  await audit(tx, { staffId: staff, action: "exam_period.remove", targetType: "exam_period", targetId: id, reason: text, before: e, after: { removed: true } });
}

/** `uni_add_exam_period` for a university's admin (market checked the seat): no overlap, at most 90 days a year. */
export async function addUniversityExamPeriod(tx: Tx, universityId: string, actorId: string, starts: string, ends: string, reason: string): Promise<string> {
  const text = checkPeriod(starts, ends, reason);
  await tx`select pg_advisory_xact_lock(hashtextextended(${`exam-periods:${universityId}`}, 0))`;
  const [overlap] = await tx`select 1 from ranking.exam_periods where university_id = ${universityId} and starts_on <= ${ends}::date and ends_on >= ${starts}::date`;
  if (overlap) throw refused("exam_overlap_own");
  for (let year = Number(starts.slice(0, 4)); year <= Number(ends.slice(0, 4)); year++) {
    const [y0, y1] = [`${year}-01-01`, `${year}-12-31`];
    const [r] = await tx<{ days: number }[]>`
      select coalesce(sum(least(ends_on, ${y1}::date) - greatest(starts_on, ${y0}::date) + 1), 0)::int as days
        from ranking.exam_periods where university_id = ${universityId} and starts_on <= ${y1}::date and ends_on >= ${y0}::date`;
    const days = r!.days + daysBetween(starts > y0 ? starts : y0, ends < y1 ? ends : y1) + 1;
    if (days > 90) throw refusedWith("exam_year_cap", year, days);
  }
  const id = uuidv7();
  await tx`insert into ranking.exam_periods (id, university_id, starts_on, ends_on, reason, created_by) values (${id}, ${universityId}, ${starts}::date, ${ends}::date, ${text}, ${actorId})`;
  return id;
}

/** `uni_remove_exam_period` for a university's admin. Returns what was removed, for market's university audit. */
export async function removeUniversityExamPeriod(tx: Tx, universityId: string, id: string, reason: string) {
  if (reason.trim().length < 3) throw refused("give_reason");
  const [e] = await tx<{ starts_on: string; ends_on: string }[]>`
    delete from ranking.exam_periods where id = ${id} and university_id = ${universityId} returning starts_on::text, ends_on::text`;
  if (!e) throw refused("exam_not_found");
  return e;
}
