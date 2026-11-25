/** The gate-state rules the goldens do not reach: recruiters, officials and the refusal codes. */
import { describe, expect, it } from "vitest";
import { emailDomainAllowed, gateState, guardEmailChange, signupRefusalCode, type ProfileFacts } from "../../src/domain/gate-state";
import { validateSignup, type GateData } from "../../src/domain/signup-gate";

const UNI = "9a000000-0000-4000-8000-000000000001";
const data: GateData = {
  domains: [
    { domain: "uni.test", universityId: UNI, kind: "both", universityLiveAt: new Date("2026-01-01") },
    { domain: "staff.uni.test", universityId: UNI, kind: "faculty", universityLiveAt: new Date("2026-01-01") },
  ],
  personalDomains: new Set(["mail.test"]),
  portals: {},
  now: new Date("2026-11-25"),
};
const facts = (role: ProfileFacts["role"]): ProfileFacts => ({ role, universityId: role === "recruiter" ? null : UNI, onboardingComplete: true, onboardingStep: 6, status: "active" });

describe("gate state rules", () => {
  it("recruiters keep a company email, and their organisation's once they have one", () => {
    expect(emailDomainAllowed(data, "hr@acme.test", facts("recruiter"), null)).toBe(true);
    expect(emailDomainAllowed(data, "hr@acme.test", facts("recruiter"), "other.test")).toBe(false);
    expect(emailDomainAllowed(data, "hr@uni.test", facts("recruiter"), null)).toBe(false);
    const change = (to: string, org: string | null) => guardEmailChange(data, facts("recruiter"), org, { email: { before: "hr@acme.test", after: to } });
    expect(change("hr2@acme.test", "acme.test")).toBeNull();
    expect(change("hr@mail.test", null)).toBe("a recruiter account must keep an email at its company");
    expect(change("hr@other.test", "acme.test")).toBe("a recruiter account must keep an email at its company");
  });

  it("faculty and officials need a faculty domain; students a student one; no profile changes freely", () => {
    expect(emailDomainAllowed(data, "prof@staff.uni.test", facts("faculty"), null)).toBe(true);
    expect(emailDomainAllowed(data, "kid@staff.uni.test", facts("student"), null)).toBe(false);
    expect(guardEmailChange(data, facts("student"), null, { email: { before: "a@uni.test", after: "a@staff.uni.test" } })).toBe("a university account must keep an email at its university");
    expect(guardEmailChange(data, null, null, { email: { before: "a@uni.test", after: "a@mail.test" } })).toBeNull();
    expect(emailDomainAllowed(data, "a@uni.test", null, null)).toBe(false);
  });

  it("no published agreement counts as accepted; no profile is the signed-in default", () => {
    const s = gateState({ data, email: "a@uni.test", profile: null, orgDomain: null, agreementVersion: 0, accepted: false });
    expect(s).toEqual({
      has_profile: false,
      role: null,
      university_id: null,
      onboarding_complete: false,
      onboarding_step: 1,
      agreement_version: null,
      agreement_accepted: true,
      email_allowed: false,
      status: "active",
      portals: { recruiter: false, university: false, faculty: true },
    });
  });

  it("every signup gate message has a short refusal code", () => {
    const messages = [
      validateSignup(data, "nope", "student"),
      validateSignup(data, "a@mail.test", "student"),
      validateSignup(data, "a@nowhere.test", "student"),
      validateSignup(data, "a@uni.test", "student", "9a000000-0000-4000-8000-0000000000ff"),
      validateSignup(data, "a@acme.test", "recruiter"),
      validateSignup(data, "a@uni.test", "university_admin"),
      validateSignup({ ...data, portals: { faculty: false } }, "a@uni.test", "faculty"),
      validateSignup({ ...data, portals: { recruiter: true } }, "a@mail.test", "recruiter"),
      validateSignup({ ...data, portals: { recruiter: true } }, "a@uni.test", "recruiter"),
    ];
    for (const m of messages) {
      expect(m).not.toBeNull();
      expect(signupRefusalCode(m!)).not.toBe("signup_refused");
      expect(signupRefusalCode(m!)).toMatch(/^[a-z_]+$/);
    }
  });
});
