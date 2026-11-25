/** The people and sanctions export parsers (the imports themselves are tested in their services). */
import { describe, expect, it } from "vitest";
import { parseSanctionExport } from "../src/auth-import";
import { parseDomains, parseEmails, parseProfiles, parseUniversities } from "../src/people-import";

const id = "0190f0b2-0000-7000-8000-000000000001";

describe("people export parsers", () => {
  it("keep every column of a row and require its key", () => {
    expect(parseProfiles(`${JSON.stringify({ user_id: id, full_name: "x", extra: 1 })}\n`)).toEqual([{ user_id: id, full_name: "x", extra: 1 }]);
    expect(() => parseProfiles(`{"full_name":"x"}`)).toThrow(/profiles line 1/);
    expect(parseUniversities(JSON.stringify({ id, name: "U" }))).toHaveLength(1);
    expect(() => parseDomains(JSON.stringify({ university_id: id }))).toThrow(/university_domains line 1/);
    expect(() => parseEmails(JSON.stringify({ user_id: "nope", email: "a@b.test" }))).toThrow(/auth.users emails line 1/);
  });
});

describe("sanctions export parser", () => {
  it("accepts organisation sanctions (no user) and refuses a malformed row", () => {
    const row = { id, user_id: null, kind: "suspend", until: null, reason: "r", staff_id: id, created_at: "2026-01-01", lifted_at: null, lifted_by: null, lift_reason: null };
    expect(parseSanctionExport(JSON.stringify(row))).toHaveLength(1);
    expect(() => parseSanctionExport(JSON.stringify({ ...row, staff_id: "nope" }))).toThrow(/sanctions line 1/);
  });
});
