/**
 * The CV's pure rules, ported from the stack's SQL: the sections (cv_all_sections at its latest, with activities),
 * eligibility (cv_eligible), the standing's "top N%" and the template summary (cv_snapshot_base, the recruiter
 * layout's wording). No AI: the summary is a template over verified facts.
 */
export const ALL_SECTIONS = ["summary", "projects", "open_source", "skills", "activities", "endorsements", "credentials", "education"] as const;
export type Section = (typeof ALL_SECTIONS)[number];

/** `cv_sections_valid`: known sections, each once (and at least one, for save_cv_settings). */
export function sectionsValid(sections: readonly string[]): boolean {
  return sections.length > 0 && sections.every((s) => (ALL_SECTIONS as readonly string[]).includes(s)) && new Set(sections).size === sections.length;
}

/** What people and identity say about an account, for `cv_eligible`. */
export interface PersonFacts {
  role: string;
  onboardingComplete: boolean;
  username: string;
  universityId: string;
  banned: boolean;
}

/** `cv_eligible`: an onboarded student with a username and a university, not banned now. */
export function eligible(p: PersonFacts | null | undefined): boolean {
  return Boolean(p && p.role === "student" && p.onboardingComplete && p.username && p.universityId && !p.banned);
}

/**
 * The standing's "top N%": only within the top half, and only when shown. `percentile` is ranking's published
 * value (0..1); the stack computed in numeric, so the float is rounded before ceil (0.7 gives 30, not 31).
 */
export function topPercent(t: { ranked: boolean; percentile: number | null } | null, show: boolean): number | null {
  if (!t || !t.ranked || t.percentile === null || !show) return null;
  const top = Math.max(1, Math.ceil(Number(((1 - t.percentile) * 100).toFixed(9))));
  return top <= 50 ? top : null;
}

/** `cv_join_names`: "A", "A and B", "A, B and C". */
export function joinNames(names: readonly string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)!}`;
}

const initcap = (s: string) => s.replace(/\b([a-z])([a-z]*)/gi, (_m, a: string, b: string) => a.toUpperCase() + b.toLowerCase());

/** The template summary (department, never the free-text programme). */
export function summary(f: {
  department: string | null;
  university: string;
  year: number | null;
  topSkills: readonly string[];
  projects: number;
  completed: number;
  pullRequests: number;
  tier: string | null;
  top: number | null;
}): string {
  let s = (f.department !== null ? `${f.department} student` : "Student") + ` at ${f.university}`;
  if (f.year !== null) s += `, class of ${f.year}`;
  if (f.topSkills.length > 0) s += `, with verified work in ${joinNames(f.topSkills)}`;
  else if (f.projects > 0) s += ", with verified work";
  if (f.projects === 1 && f.completed === 1) s += " across 1 completed team project";
  else if (f.projects === 1) s += " across 1 team project";
  else if (f.projects > 1) s += ` across ${f.projects} team projects` + (f.completed > 0 ? `, ${f.completed} of them completed` : "");
  s += ".";
  if (f.pullRequests > 0) s += ` ${f.pullRequests}${f.pullRequests === 1 ? " merged pull request" : " merged pull requests"} to other developers' repositories.`;
  if (f.tier !== null) s += ` ${initcap(f.tier)} tier on Skilient` + (f.top !== null ? `, top ${f.top}%` : "") + ".";
  return s;
}

export const TEMPLATES = ["standard", "classic", "compact", "modern", "academic"] as const;
export const PAPERS = ["a4", "letter"] as const;
