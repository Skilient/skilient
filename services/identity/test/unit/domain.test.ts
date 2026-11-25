import { describe, expect, it } from "vitest";
import { isStaff, requireAppealDecider } from "../../src/authorize";
import { hashAlgorithm, hashPassword, needsRehash, verifyPassword } from "../../src/domain/password";
import { captchaRequired, signinDelaySeconds } from "../../src/domain/signin";

describe("identity domain rules", () => {
  it("staff need the role (or super_admin) and a two-factor session", () => {
    expect(isStaff({ id: "u", aal: "aal2", staffRoles: ["moderator"] }, "moderator")).toBe(true);
    expect(isStaff({ id: "u", aal: "aal1", staffRoles: ["moderator"] }, "moderator")).toBe(false);
    expect(isStaff({ id: "u", aal: "aal2", staffRoles: ["super_admin"] }, "accounts")).toBe(true);
    expect(isStaff({ id: null, aal: "aal2", staffRoles: ["super_admin"] })).toBe(false);
    expect(() => requireAppealDecider({ id: "m", aal: "aal2", staffRoles: ["moderator"] }, { deciderRole: "moderator", originalStaffId: "m" })).toThrow(
      /original decision/,
    );
  });

  it("captcha and delay thresholds", () => {
    expect([captchaRequired(2, 4), captchaRequired(3, 0), captchaRequired(0, 5)]).toEqual([false, true, true]);
    expect([9, 10, 15, 30].map(signinDelaySeconds)).toEqual([0, 2, 60, 60]);
  });

  it("refuses to verify a hash it cannot recognise", async () => {
    expect(hashAlgorithm("$1$x")).toBeNull();
    expect(await verifyPassword("$1$x", "anything")).toBe(false);
  });

  it("hashes new passwords with Argon2id and verifies them; bcrypt hashes need a rehash", async () => {
    const hash = await hashPassword("Golden-new-Passw0rd-2026");
    expect(hashAlgorithm(hash)).toBe("argon2id");
    expect(await verifyPassword(hash, "Golden-new-Passw0rd-2026")).toBe(true);
    expect(await verifyPassword(hash, "Golden-new-Passw0rd-2027")).toBe(false);
    expect(needsRehash(hash)).toBe(false);
    expect(needsRehash("$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234")).toBe(true);
  });
});
