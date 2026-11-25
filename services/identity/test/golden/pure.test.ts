/**
 * Golden replay for identity's pure rules (CLAUDE.md, "How to work" 4): each ported function is called with
 * the inputs recorded on the current stack, and its results must equal the recorded ones. The fixtures were
 * recorded by packages/testing/test/identity.golden.test.ts; this file only compares, never records.
 */
import { join } from "node:path";
import { golden } from "@skilient/testing";
import { beforeAll, describe, expect, it } from "vitest";
import {
  requireAccounts,
  requireAccountsOrAdmin,
  requireAnyStaff,
  requireAppealDecider,
  requireModerator,
  requireSuperAdmin,
  requireTrustReviewer,
  type Actor,
  type StaffRole,
} from "../../src/authorize";
import { normalizeBackupCode } from "../../src/domain/backup-codes";
import { emailDomain } from "../../src/domain/email";
import { signinAccountKey, signinDelaySeconds, signinIpKey } from "../../src/domain/signin";
import { domainAdmitsStudents, isRecruiterDomain, portalEnabled, portalsState, validateSignup, type AccountRole, type GateData } from "../../src/domain/signup-gate";
import { outcome } from "./outcome";

const DIR = join(import.meta.dirname, "../../../../packages/testing/test/golden/identity");

// The fixture world of the recording (identity.golden.test.ts, `seed`).
const UNI = "9a000000-0000-4000-8000-000000000001";
const UNI_CLOSED = "9a000000-0000-4000-8000-000000000002";
const STUDENT = "9b000000-0000-4000-8000-000000000001";
const PEER = "9b000000-0000-4000-8000-000000000002";
const ADMIN = "9b000000-0000-4000-8000-000000000003";
const MOD = "9b000000-0000-4000-8000-000000000004";
const IP = "1".repeat(64);
const NOW = new Date("2026-11-25T12:00:00Z");
const CLOSED = { faculty: true, recruiter: false, university: false };
const OPEN = { recruiter: true, university: true, faculty: false };
const world = (portals: unknown): GateData => ({
  domains: [
    { domain: "golden-uni.test", universityId: UNI, kind: "both", universityLiveAt: new Date(NOW.getTime() - 86_400_000) },
    { domain: "golden-closed.test", universityId: UNI_CLOSED, kind: "both", universityLiveAt: null },
  ],
  personalDomains: new Set(["golden-mail.test"]),
  portals,
  now: NOW,
});

function expectGolden(file: string, name: string, value: unknown): void {
  const r = golden(join(DIR, `${file}.json`), name, value);
  if (r.status === "differs") expect(r.actual).toEqual(r.expected);
  expect(r.status).toBe("matched");
}

beforeAll(() => {
  // Replays compare only: recording against the port would overwrite what the current stack said.
  if (process.env["GOLDEN_RECORD"] === "1") throw new Error("golden replays never record; unset GOLDEN_RECORD");
});

describe("signup gates (signup.json)", () => {
  it("email_domain", async () => {
    const out: Record<string, unknown> = {};
    for (const e of ["Golden.Student@Golden-Uni.TEST", "  a@golden-uni.test ", "no-at-sign", "a@b@golden-uni.test", "", "a@"])
      out[JSON.stringify(e)] = await outcome(() => emailDomain(e));
    expectGolden("signup", "email_domain", out);
  });

  it("domain_admits_students", async () => {
    const d = world(CLOSED);
    expectGolden("signup", "domain_admits_students", {
      any_university: await outcome(() => domainAdmitsStudents(d, "golden-uni.test", null)),
      its_university: await outcome(() => domainAdmitsStudents(d, "golden-uni.test", UNI)),
      other_university: await outcome(() => domainAdmitsStudents(d, "golden-uni.test", UNI_CLOSED)),
      personal_domain: await outcome(() => domainAdmitsStudents(d, "golden-mail.test", null)),
      unknown_domain: await outcome(() => domainAdmitsStudents(d, "golden-nowhere.test", null)),
    });
  });

  it("is_recruiter_domain", async () => {
    const d = world(CLOSED);
    expectGolden("signup", "is_recruiter_domain", {
      company: await outcome(() => isRecruiterDomain(d, "golden-company.test")),
      university: await outcome(() => isRecruiterDomain(d, "golden-uni.test")),
      personal: await outcome(() => isRecruiterDomain(d, "golden-mail.test")),
      none: await outcome(() => isRecruiterDomain(d, null)),
    });
  });

  it("portals_state and portal_enabled", async () => {
    const read = async (value: unknown) => ({
      state: await outcome(() => portalsState(value)),
      recruiter: await outcome(() => portalEnabled(value, "recruiter")),
      university: await outcome(() => portalEnabled(value, "university")),
      faculty: await outcome(() => portalEnabled(value, "faculty")),
      unknown: await outcome(() => portalEnabled(value, "golden")),
    });
    expectGolden("signup", "portals_state", { closed: await read(CLOSED), open: await read(OPEN) });
  });

  it("validate_signup", async () => {
    const v = (portals: unknown) => (email: string | null, role: AccountRole, uni: string | null = null) =>
      outcome(() => validateSignup(world(portals), email, role, uni));
    const off = v(CLOSED);
    const on = v(OPEN);
    expectGolden("signup", "validate_signup", {
      portalsOff: {
        student_ok: await off("new@golden-uni.test", "student"),
        student_ok_with_university: await off("new@golden-uni.test", "student", UNI),
        student_wrong_university: await off("new@golden-uni.test", "student", UNI_CLOSED),
        student_not_live: await off("new@golden-closed.test", "student"),
        student_personal_domain: await off("new@golden-mail.test", "student"),
        student_unknown_domain: await off("new@golden-nowhere.test", "student"),
        invalid_email: await off("not-an-email", "student"),
        null_email: await off(null, "student"),
        faculty_ok: await off("prof@golden-uni.test", "faculty"),
        faculty_not_live: await off("prof@golden-closed.test", "faculty"),
        recruiter_closed: await off("hr@golden-company.test", "recruiter"),
        university_admin_closed: await off("office@golden-uni.test", "university_admin"),
      },
      portalsOn: {
        recruiter_ok: await on("hr@golden-company.test", "recruiter"),
        recruiter_personal: await on("hr@golden-mail.test", "recruiter"),
        recruiter_university_domain: await on("hr@golden-uni.test", "recruiter"),
        university_admin_ok: await on("office@golden-uni.test", "university_admin", UNI),
        university_admin_not_live: await on("office@golden-closed.test", "university_admin", UNI_CLOSED),
        faculty_closed: await on("prof@golden-uni.test", "faculty"),
      },
    });
  });
});

describe("sign-in helpers (signin.json) and backup codes (two-factor.json)", () => {
  it("signin_helpers", async () => {
    const delays: Record<string, unknown> = {};
    for (const n of [0, 9, 10, 11, 12, 14, 15, 20]) delays[String(n)] = await outcome(() => signinDelaySeconds(n));
    expectGolden("signin", "signin_helpers", {
      account_key: await outcome(() => signinAccountKey("  Golden.Student@Golden-Uni.TEST ")),
      account_key_null: await outcome(() => signinAccountKey(null)),
      ip_key: await outcome(() => signinIpKey(IP)),
      ip_key_invalid: await outcome(() => signinIpKey("not-a-hash")),
      delays,
    });
  });

  it("normalize_backup_code", async () => {
    const out: Record<string, unknown> = {};
    for (const c of ["ABCDE-FGHJK", " abcde fghjk ", "ab-cd_ef!", "", null]) out[JSON.stringify(c)] = await outcome(() => normalizeBackupCode(c));
    expectGolden("two-factor", "normalize_backup_code", out);
  });
});

describe("staff-role helpers (require.json)", () => {
  const actor = (id: string | null, aal: "aal1" | "aal2", roles: StaffRole[], seats: Actor["universityAdminOf"] = []): Actor => ({
    id,
    aal,
    staffRoles: roles,
    universityAdminOf: seats,
  });
  /** The recording's actors: PEER holds the role under test, ADMIN is a super admin, MOD a moderator. */
  const byActor = async (role: StaffRole, check: (a: Actor) => string) => ({
    holder_aal2: await outcome(() => check(actor(PEER, "aal2", [role]))),
    holder_aal1: await outcome(() => check(actor(PEER, "aal1", [role]))),
    super_admin_aal2: await outcome(() => check(actor(ADMIN, "aal2", ["super_admin"]))),
    moderator_aal2: await outcome(() => check(actor(MOD, "aal2", ["moderator"]))),
    student_aal2: await outcome(() => check(actor(STUDENT, "aal2", []))),
    signed_out: await outcome(() => check(actor(null, "aal1", []))),
  });

  it("require_trust_reviewer, require_accounts, require_moderator, require_any_staff", async () => {
    expectGolden("require", "require_trust_reviewer", await byActor("trust_reviewer", requireTrustReviewer));
    expectGolden("require", "require_accounts", await byActor("accounts", requireAccounts));
    expectGolden("require", "require_moderator", await byActor("moderator", requireModerator));
    expectGolden("require", "require_any_staff", await byActor("trust_reviewer", requireAnyStaff));
  });

  it("require_super_admin", async () => {
    expectGolden("require", "require_super_admin", {
      super_admin_aal2: await outcome(() => requireSuperAdmin(actor(ADMIN, "aal2", ["super_admin"]))),
      super_admin_aal1: await outcome(() => requireSuperAdmin(actor(ADMIN, "aal1", ["super_admin"]))),
      moderator_aal2: await outcome(() => requireSuperAdmin(actor(MOD, "aal2", ["moderator"]))),
      student_aal2: await outcome(() => requireSuperAdmin(actor(STUDENT, "aal2", []))),
      signed_out: await outcome(() => requireSuperAdmin(actor(null, "aal1", []))),
    });
  });

  it("require_accounts_or_admin", async () => {
    const seat = [{ universityId: UNI, role: "admin" }];
    const comms = [{ universityId: UNI, role: "comms" }];
    const check = (a: Actor, uni: string | null) => outcome(() => requireAccountsOrAdmin(a, uni));
    expectGolden("require", "require_accounts_or_admin", {
      accounts_staff: {
        holder_aal2: await check(actor(PEER, "aal2", ["accounts"]), null),
        holder_aal1: await check(actor(PEER, "aal1", ["accounts"]), null),
        super_admin_aal2: await check(actor(ADMIN, "aal2", ["super_admin"]), null),
        moderator_aal2: await check(actor(MOD, "aal2", ["moderator"], comms), null),
        student_aal2: await check(actor(STUDENT, "aal2", [], seat), null),
        signed_out: await check(actor(null, "aal1", []), null),
      },
      university_admin_own_university_aal2: await check(actor(STUDENT, "aal2", [], seat), UNI),
      university_admin_own_university_aal1: await check(actor(STUDENT, "aal1", [], seat), UNI),
      university_admin_other_university: await check(actor(STUDENT, "aal2", [], seat), UNI_CLOSED),
      university_admin_no_university_given: await check(actor(STUDENT, "aal2", [], seat), null),
      comms_role_is_not_admin: await check(actor(MOD, "aal2", ["moderator"], comms), UNI),
    });
  });

  it("require_appeal_decider", async () => {
    const appeal = (deciderRole: StaffRole, originalStaffId: string) => ({ deciderRole, originalStaffId });
    const d = (a: Actor, ap: ReturnType<typeof appeal>) => outcome(() => requireAppealDecider(a, ap));
    expectGolden("require", "require_appeal_decider", {
      moderator_decides_moderator_appeal: await d(actor(MOD, "aal2", ["moderator"]), appeal("moderator", ADMIN)),
      moderator_made_the_original_decision: await d(actor(MOD, "aal2", ["moderator"]), appeal("moderator", MOD)),
      trust_reviewer_on_moderator_appeal: await d(actor(PEER, "aal2", ["trust_reviewer"]), appeal("moderator", ADMIN)),
      trust_reviewer_on_trust_appeal: await d(actor(PEER, "aal2", ["trust_reviewer"]), appeal("trust_reviewer", MOD)),
      super_admin_on_any_appeal: await d(actor(ADMIN, "aal2", ["super_admin"]), appeal("accounts", MOD)),
      moderator_without_aal2: await d(actor(MOD, "aal1", ["moderator"]), appeal("moderator", ADMIN)),
      student: await d(actor(STUDENT, "aal2", []), appeal("moderator", ADMIN)),
    });
  });
});
