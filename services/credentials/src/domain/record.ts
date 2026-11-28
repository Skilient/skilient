/**
 * The Record's pure rules, ported from 20261112000001_the_record.sql and the stack's callers (close_swap,
 * complete_task, the venture completion trigger): each kind's title and evidence (the signed `evidence` is
 * integers and strings only, so the canonical form never depends on how a decimal prints), ordinals, academic
 * years, the address hash and the CV's "Leadership and activities" labels. Dates and times are Pakistan time.
 */
import { createHash } from "node:crypto";

export type Kind = "attended" | "completed" | "result" | "office_bearer" | "volunteer" | "venture_completed" | "taught" | "proof_task";
export type Evidence = Record<string, string | number>;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PKT_MS = 5 * 3600_000;

/** The Pakistan-time calendar date of a moment, YYYY-MM-DD. */
export const pktDate = (at: Date | string) => new Date(new Date(at).getTime() + PKT_MS).toISOString().slice(0, 10);
/** to_char(..., 'HH24:MI') in Pakistan time. */
export const pktTime = (at: Date | string) => new Date(new Date(at).getTime() + PKT_MS).toISOString().slice(11, 16);
/** to_char(date, 'Mon YYYY'). */
export const monthYear = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
/** to_char(date, 'FMDD Mon YYYY'). */
export const dayMonthYear = (d: string) => `${Number(d.slice(8, 10))} ${monthYear(d)}`;

/** `private.ordinal`: 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st. */
export function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
  return `${n}${suffix}`;
}

/** `private.academic_year`: September to August; 2026-09-01 .. 2027-08-31 is 2026. */
export function academicYear(date: string): number {
  const y = Number(date.slice(0, 4));
  return Number(date.slice(5, 7)) >= 9 ? y : y - 1;
}

/** `private.email_hash`: SHA-256 (hex) of the trimmed, lower-cased address. */
export const emailHash = (email: string) => createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("hex");

/** Rounds half away from zero to `places` (numeric's round) and drops trailing zeros (trim_scale). */
export function decimal(x: number, places: number): string {
  const f = 10 ** places;
  const r = Math.sign(x) * Math.round(Math.abs(Number((x * f).toFixed(9)))) / f;
  return String(r);
}

/** `swap_hours_label(minutes)`: to_char(minutes / 60.0, 'FM9990.0') without a trailing ".0". */
export function swapHoursLabel(minutes: number): string {
  const s = (Math.round(Number(((minutes / 60) * 10).toFixed(9))) / 10).toFixed(1);
  return `${s.replace(/\.0$/, "")} h`;
}

export interface Draft {
  kind: Kind;
  title: string;
  evidence: Evidence;
  occurredOn: string;
}

export const attended = (title: string, firstAt: Date | string, on: string): Draft => ({
  kind: "attended",
  title,
  evidence: { line: `Checked in ${pktTime(firstAt)}` },
  occurredOn: on,
});

export const completed = (title: string, sessions: number, of: number, on: string): Draft => ({
  kind: "completed",
  title,
  evidence: { line: `${sessions} of ${of} sessions`, sessions, of },
  occurredOn: on,
});

export const result = (title: string, place: number, entrants: number, label: string | null, team: boolean, on: string): Draft => ({
  kind: "result",
  title,
  evidence: { line: `${label ?? ordinal(place)} of ${entrants}${team ? " teams" : ""}`, place, entrants },
  occurredOn: on,
});

export const volunteer = (title: string, minutes: number, on: string): Draft => ({
  kind: "volunteer",
  title,
  evidence: { line: `${decimal(minutes / 60, 1)} h · ${title}`, minutes },
  occurredOn: on,
});

export const officeBearer = (title: string, role: string, from: string, to: string): Draft => ({
  kind: "office_bearer",
  title,
  evidence: { line: `${title} · ${monthYear(from)} – ${monthYear(to)}`, role, from, to },
  occurredOn: to,
});

export const ventureCompleted = (title: string | null, teamSize: number, completedAt: Date | string): Draft => ({
  kind: "venture_completed",
  title: title ?? "Venture",
  evidence: { line: `Team of ${teamSize} · completed ${dayMonthYear(pktDate(completedAt))}`, team_size: teamSize },
  occurredOn: pktDate(completedAt),
});

const VERIFIED_BY: Record<string, string> = { github: "GitHub", peer: "a peer review" };
export const proofTask = (title: string, skillId: string, skillLabel: string, verifiedBy: string, at: Date | string): Draft => ({
  kind: "proof_task",
  title,
  evidence: { line: `${skillLabel} · verified by ${VERIFIED_BY[verifiedBy] ?? "a code check"}`, skill: skillId, verified_by: verifiedBy },
  occurredOn: pktDate(at),
});

export const taught = (skillId: string, skillLabel: string, learnerFirstName: string | null, sessions: number, minutes: number, lastOn: string): Draft => ({
  kind: "taught",
  title: `Taught ${skillLabel} to ${learnerFirstName ?? "a student"}`,
  evidence: { line: `${sessions}${sessions === 1 ? " session" : " sessions"} · ${swapHoursLabel(minutes)}`, sessions, minutes, skill: skillId },
  occurredOn: lastOn,
});

/** correct_record_entry's new evidence for a place (results) or hours (volunteer hours). */
export function correctedEvidence(e: { kind: string; evidence: Evidence }, change: { place?: number; hours?: number; title: string }): Evidence {
  let v: Evidence = { ...e.evidence };
  if (change.place !== undefined && e.kind === "result")
    v = { ...v, place: change.place, line: `${ordinal(change.place)} of ${String(e.evidence["entrants"])}${String(e.evidence["line"] ?? "").endsWith(" teams") ? " teams" : ""}` };
  if (change.hours !== undefined && e.kind === "volunteer")
    v = { ...v, minutes: Math.round(Number((change.hours * 60).toFixed(9))), line: `${decimal(change.hours, 1)} h · ${change.title}` };
  return v;
}

/** `cv_activities`' label for one entry. */
export function activityLabel(kind: string, title: string, evidence: Evidence): string {
  switch (kind) {
    case "office_bearer":
      return title;
    case "result": {
      // The stack's CASE: a missing place falls to the ELSE branch, so it reads "Finalist" too.
      const place = Number(evidence["place"]);
      return `${Number.isFinite(place) && place <= 3 ? `${ordinal(place)} place` : "Finalist"}, ${title}`;
    }
    case "volunteer":
      return `Volunteer, ${title}`;
    case "attended":
      return `Attended ${title}`;
    case "completed":
      return `Completed ${title}`;
    case "venture_completed":
      return `Completed project ${title}`;
    case "taught":
      return `Taught ${title}`;
    default:
      return title;
  }
}

/** `cv_activities`' "when": a term's months, or the entry's month. */
export function activityWhen(kind: string, occurredOn: string, evidence: Evidence): string {
  if (kind === "office_bearer" && typeof evidence["from"] === "string" && typeof evidence["to"] === "string")
    return `${monthYear(evidence["from"])} – ${monthYear(evidence["to"])}`;
  return monthYear(occurredOn);
}

const SOCIETY = /^\$society_(slug|logo):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

/** The society ids a document names as `$society_slug:<id>` or `$society_logo:<id>` (community's facts). */
export function wantedSocieties(doc: unknown): string[] {
  const out = new Set<string>();
  const walk = (v: unknown): void => {
    if (typeof v === "string") {
      const m = SOCIETY.exec(v);
      if (m) out.add(m[2]!);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(doc);
  return [...out];
}

/** Fills society placeholders (null when community has no such society, or no logo). */
export function fillSocieties<T>(doc: T, societies: ReadonlyMap<string, { slug: string; logoPath: string | null }>): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      const m = SOCIETY.exec(v);
      if (!m) return v;
      const s = societies.get(m[2]!);
      return m[1] === "slug" ? (s?.slug ?? null) : (s?.logoPath ?? null);
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(doc) as T;
}

/** What ranking reads from record.sealed: role, place, entrants, minutes (only those the entry has). */
export function rankingEvidence(evidence: Evidence): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const k of ["role", "place", "entrants", "minutes"] as const) if (evidence[k] !== undefined) out[k] = evidence[k];
  return out;
}
