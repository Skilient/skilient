import { emailDomain } from "./email";

/**
 * The signup gates (`private.validate_signup` and the helpers it calls), as pure rules over identity's own
 * copy of the gate data: allowed university domains (fed by a `people` event, decision 2026-11-25), the
 * personal-email list, and the portals flag. The messages are the product's wording, unchanged.
 */
export type AccountRole = "student" | "faculty" | "recruiter" | "university_admin";
export type DomainKind = "student" | "faculty" | "both";

export interface AllowedDomain {
  domain: string;
  universityId: string;
  kind: DomainKind;
  /** When the university opened for signup; null while it is closed. */
  universityLiveAt: Date | null;
}

export interface GateData {
  domains: readonly AllowedDomain[];
  personalDomains: ReadonlySet<string>;
  /** The `portals.enabled` config value, as stored. */
  portals: unknown;
  now: Date;
}

/** `private.portals_state`: recruiter and university default to off, faculty to on. */
export function portalsState(value: unknown): { recruiter: boolean; university: boolean; faculty: boolean } {
  const v = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const flag = (k: string, fallback: boolean) => (typeof v[k] === "boolean" ? (v[k] as boolean) : fallback);
  return { recruiter: flag("recruiter", false), university: flag("university", false), faculty: flag("faculty", true) };
}

/** `private.portal_enabled`: an unknown portal is off. */
export function portalEnabled(value: unknown, portal: string): boolean {
  const state = portalsState(value) as Record<string, boolean>;
  return state[portal] ?? false;
}

const admits = (kinds: readonly DomainKind[]) => (data: GateData, domain: string | null, universityId: string | null) =>
  data.domains.some((d) => d.domain === domain && kinds.includes(d.kind) && (universityId == null || d.universityId === universityId));

/** `private.domain_admits_students`. */
export const domainAdmitsStudents = admits(["student", "both"]);
/** `private.domain_admits_faculty`. */
export const domainAdmitsFaculty = admits(["faculty", "both"]);

/** `private.is_recruiter_domain`: a company domain is neither personal nor a university's. */
export function isRecruiterDomain(data: Pick<GateData, "domains" | "personalDomains">, domain: string | null): boolean {
  return domain != null && !data.personalDomains.has(domain) && !data.domains.some((d) => d.domain === domain);
}

const live = (d: AllowedDomain, now: Date) => d.universityLiveAt != null && d.universityLiveAt.getTime() <= now.getTime();

/** `private.validate_signup`: null when the signup may go ahead, otherwise the message to show. */
export function validateSignup(data: GateData, email: string | null, role: AccountRole, universityId: string | null = null): string | null {
  const domain = emailDomain(email);
  if (domain == null) return "Enter a valid email address.";
  if (role === "recruiter" && !portalEnabled(data.portals, "recruiter")) return "Recruiter accounts aren't open yet. Talk to us at skilient.com/recruiters.";
  if (role === "university_admin" && !portalEnabled(data.portals, "university"))
    return "University accounts aren't open yet. Talk to us at skilient.com/universities.";
  if (role === "faculty" && !portalEnabled(data.portals, "faculty")) return "Faculty accounts aren't open yet.";
  if (role === "recruiter") {
    if (data.personalDomains.has(domain)) return "Use your work email.";
    if (data.domains.some((d) => d.domain === domain)) return "Use your company email, not a university one.";
    return null;
  }
  if (data.personalDomains.has(domain)) return "Use your university email.";
  let kinds: DomainKind[];
  if (role === "faculty" || role === "university_admin") {
    if (!domainAdmitsFaculty(data, domain, null)) return "Your university isn't on Skilient yet.";
    if (universityId != null && !domainAdmitsFaculty(data, domain, universityId)) return "That university doesn't use this email domain.";
    kinds = ["faculty", "both"];
  } else if (role === "student") {
    if (!domainAdmitsStudents(data, domain, null)) return "Your university isn't on Skilient yet.";
    if (universityId != null && !domainAdmitsStudents(data, domain, universityId)) return "That university doesn't use this email domain.";
    kinds = ["student", "both"];
  } else {
    return "This kind of account can't sign up here yet.";
  }
  if (
    role !== "university_admin" &&
    !data.domains.some((d) => d.domain === domain && kinds.includes(d.kind) && (universityId == null || d.universityId === universityId) && live(d, data.now))
  )
    return "Your university isn't on Skilient yet.";
  return null;
}
