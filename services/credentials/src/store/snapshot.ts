import { ALL_SECTIONS, eligible, summary, topPercent } from "../domain/cv";
import { activityLabel, activityWhen, type Evidence } from "../domain/record";
import type { Account, Profile, Tier } from "../ports";
import type { Db, Row } from "./db";

/**
 * CvSnapshotV1 (apps/web/lib/cv/types.ts), as `private.cv_snapshot` built it through its four layers: the base
 * (person, standing, sections, summary, education; and work's parts, now work's CvFacts), the faculty fields on
 * projects (work's CvFacts carries them), awards (market, W11: `[]` until market's batch read exists) and the
 * Record's activities. What other services own arrives as `SnapshotInputs`, read by the handler in one batch call
 * each (or from the fixture in the golden replays).
 */
export interface SnapshotInputs {
  profile: Profile | undefined;
  account: Account | undefined;
  tier: Tier | undefined;
  /** work's CvFacts with endorsers' names filled. */
  work: Row;
}

export function isEligible(i: Pick<SnapshotInputs, "profile" | "account">): boolean {
  return eligible(
    i.profile && {
      role: i.profile.role,
      onboardingComplete: i.profile.onboardingComplete,
      username: i.profile.username,
      universityId: i.profile.universityId,
      banned: i.account?.banned ?? false,
    },
  );
}

/** `cv_activities(user)`: the entries the student picked for the CV, sealed, newest first. */
export async function activities(db: Db, userId: string): Promise<Row[]> {
  const rows = await db<{ kind: string; title: string; issuer_name: string; occurred_on: string; evidence: Evidence; code: string }[]>`
    select e.kind, e.title, e.issuer_name, e.occurred_on::text, e.evidence, e.code
      from credentials.cv_settings s
      join credentials.record_entries e on e.id = any (s.record_entries) and e.user_id = s.user_id and e.status = 'sealed'
     where s.user_id = ${userId}
     order by e.occurred_on desc, e.signed_at desc`;
  return rows.map((e) => ({
    kind: e.kind,
    label: activityLabel(e.kind, e.title, e.evidence),
    issuer: e.issuer_name,
    when: activityWhen(e.kind, e.occurred_on, e.evidence),
    line: typeof e.evidence["line"] === "string" ? e.evidence["line"] : "",
    code: e.code,
  }));
}

/** The snapshot, or null when the account may not have a CV. */
export async function snapshot(db: Db, userId: string, i: SnapshotInputs): Promise<Row | null> {
  if (!isEligible(i)) return null;
  const p = i.profile!;
  const [s] = await db<{ sections: string[] | null; show_percentile: boolean | null; show_email: boolean | null }[]>`
    select sections, show_percentile, show_email from credentials.cv_settings where user_id = ${userId}`;
  const showPct = s?.show_percentile ?? !p.leaderboardOptOut;
  const showEmail = s?.show_email ?? false;
  const tier = i.tier?.tier ?? null;
  const top = topPercent(i.tier ? { ranked: i.tier.ranked, percentile: i.tier.percentile } : null, showPct);
  const w = i.work;
  const n = (k: string) => Number(w[k] ?? 0);
  return {
    schema: "skilient.cv/1",
    person: { name: p.name, username: p.username, university: p.university, department: p.department, graduation_year: p.year, email: showEmail ? (i.account?.email ?? null) : null },
    standing: { tier, top_percent: top },
    sections: s?.sections ?? [...ALL_SECTIONS],
    summary: summary({
      department: p.department,
      university: p.university,
      year: p.year,
      topSkills: (w["top_skills"] as string[] | undefined) ?? [],
      projects: n("projects_count"),
      completed: n("completed_count"),
      pullRequests: n("pull_requests_count"),
      tier,
      top,
    }),
    skills: w["skills"] ?? [],
    projects: w["projects"] ?? [],
    open_source: w["open_source"] ?? [],
    endorsements: w["endorsements"] ?? [],
    credentials: w["credentials"] ?? [],
    education: { university: p.university, department: p.department, graduation_year: p.year },
    awards: [],
    activities: await activities(db, userId),
  };
}
