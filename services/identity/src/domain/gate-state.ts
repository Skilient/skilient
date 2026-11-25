import { emailDomain } from "./email";
import { domainAdmitsFaculty, domainAdmitsStudents, isRecruiterDomain, portalsState, type AccountRole, type GateData } from "./signup-gate";

/**
 * The gate state and the email rules that read profile facts, as pure rules over identity's copies
 * (decision 2026-11-25, Q1): `public.my_gate_state`, `private.email_domain_allowed`,
 * `private.guard_email_change` and `private.guard_uni_admin_email_change`. The copies are fed by events
 * (src/store/gate-copies.ts); the messages are today's, unchanged.
 */
export type ProfileStatus = "active" | "graduate" | "deleting";

/** People's facts about one account, as copied from `profile.gate_changed` (null: no profile yet). */
export interface ProfileFacts {
  role: AccountRole;
  universityId: string | null;
  onboardingComplete: boolean;
  onboardingStep: number;
  status: ProfileStatus;
}

export interface GateState {
  has_profile: boolean;
  role: AccountRole | null;
  university_id: string | null;
  onboarding_complete: boolean;
  onboarding_step: number;
  /** Null when no agreement is published. */
  agreement_version: number | null;
  agreement_accepted: boolean;
  email_allowed: boolean;
  status: ProfileStatus;
  portals: { recruiter: boolean; university: boolean; faculty: boolean };
}

/**
 * `private.email_domain_allowed`: the account's email still fits its role. University accounts need a domain
 * of their university (faculty and officials a faculty domain, students a student one); recruiters a company
 * domain, and their organisation's domain once they are in one. No profile: false.
 */
export function emailDomainAllowed(data: Pick<GateData, "domains" | "personalDomains">, email: string | null, profile: ProfileFacts | null, orgDomain: string | null): boolean {
  if (!profile || email == null) return false;
  const domain = emailDomain(email);
  switch (profile.role) {
    case "faculty":
    case "university_admin":
      return domain != null && domainAdmitsFaculty(data as GateData, domain, profile.universityId);
    case "recruiter":
      return isRecruiterDomain(data, domain) && (orgDomain == null || orgDomain === domain);
    default:
      return domain != null && domainAdmitsStudents(data as GateData, domain, profile.universityId);
  }
}

/** `public.my_gate_state` for one signed-in account (without `username`, which is people's and not in the contract). */
export function gateState(input: {
  data: Pick<GateData, "domains" | "personalDomains" | "portals">;
  email: string | null;
  profile: ProfileFacts | null;
  orgDomain: string | null;
  /** The current agreement version; 0 or null when none is published. */
  agreementVersion: number | null;
  /** Whether the account accepted that version. */
  accepted: boolean;
}): GateState {
  const { profile } = input;
  const version = input.agreementVersion ? input.agreementVersion : null;
  return {
    has_profile: profile != null,
    role: profile?.role ?? null,
    university_id: profile?.universityId ?? null,
    onboarding_complete: profile?.onboardingComplete ?? false,
    onboarding_step: profile?.onboardingStep ?? 1,
    agreement_version: version,
    agreement_accepted: version == null || input.accepted,
    email_allowed: emailDomainAllowed(input.data, input.email, profile, input.orgDomain),
    status: profile?.status ?? "active",
    portals: portalsState(input.data.portals),
  };
}

/** The gate flags carried in an access token (decision Q1): the gate state, so web needs no call per page. */
export function tokenGateFlags(state: GateState): Record<string, unknown> {
  return { ...state };
}

export interface EmailChange {
  /** The confirmed address before and after (Supabase `email`). */
  email: { before: string | null; after: string | null };
  /** The address waiting for confirmation before and after (Supabase `email_change`); null when none. */
  pending?: { before: string | null; after: string | null };
}

const UNIVERSITY = "a university account must keep an email at its university";
const COMPANY = "a recruiter account must keep an email at its company";

/**
 * `private.guard_email_change` and `private.guard_uni_admin_email_change`: a university account keeps an
 * email at its university (faculty and officials a faculty domain), a recruiter one at a company (their
 * organisation's, once they are in one). Accounts without a profile may change freely. Returns the refusal
 * message, or null when the change may go ahead.
 */
export function guardEmailChange(data: Pick<GateData, "domains" | "personalDomains">, profile: ProfileFacts | null, orgDomain: string | null, change: EmailChange): string | null {
  if (!profile) return null;
  const candidates: string[] = [];
  const pending = change.pending;
  if (pending && (pending.after ?? "") !== "" && pending.after !== pending.before) candidates.push(pending.after!);
  if (change.email.after != null && change.email.after !== change.email.before) candidates.push(change.email.after);
  for (const address of candidates) {
    const domain = emailDomain(address);
    if (profile.role === "recruiter") {
      if (!(isRecruiterDomain(data, domain) && (orgDomain == null || domain === orgDomain))) return COMPANY;
    } else if (profile.role === "faculty" || profile.role === "university_admin") {
      if (!domainAdmitsFaculty(data as GateData, domain, profile.universityId)) return UNIVERSITY;
    } else if (!domainAdmitsStudents(data as GateData, domain, profile.universityId)) return UNIVERSITY;
  }
  return null;
}

/** Short refusal reasons for the signup gate's messages (refusals carry codes; web shows the copy). */
const SIGNUP_CODES: Record<string, string> = {
  "Enter a valid email address.": "invalid_email",
  "Recruiter accounts aren't open yet. Talk to us at skilient.com/recruiters.": "recruiter_portal_closed",
  "University accounts aren't open yet. Talk to us at skilient.com/universities.": "university_portal_closed",
  "Faculty accounts aren't open yet.": "faculty_portal_closed",
  "Use your work email.": "personal_email",
  "Use your company email, not a university one.": "university_email",
  "Use your university email.": "personal_email",
  "Your university isn't on Skilient yet.": "university_not_on_skilient",
  "That university doesn't use this email domain.": "wrong_university",
  "This kind of account can't sign up here yet.": "role_not_open",
};

export function signupRefusalCode(message: string): string {
  return SIGNUP_CODES[message] ?? "signup_refused";
}
