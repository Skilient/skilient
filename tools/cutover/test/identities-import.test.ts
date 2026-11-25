/** The auth.identities export parser (fixture rows only); the writes are tested in services/identity/test/import. */
import { describe, expect, it } from "vitest";
import { googleAccounts, parseIdentities } from "../src/identities-import";

const U1 = "0190f0b2-0000-7000-8000-000000000001";
const U2 = "0190f0b2-0000-7000-8000-000000000002";

describe("auth.identities export", () => {
  it("parses Google and email rows, ignoring identity_data", () => {
    const rows = parseIdentities(
      [
        JSON.stringify({ provider: "google", provider_id: "1001", user_id: U1, email: "a@uni.test", identity_data: { name: "ignored" } }),
        "",
        JSON.stringify({ provider: "email", provider_id: U2, user_id: U2, email: "b@uni.test" }),
        JSON.stringify({ provider: "google", provider_id: "1002", user_id: U2 }),
      ].join("\n"),
    );
    expect(rows).toEqual([
      { provider: "google", providerUserId: "1001", userId: U1, email: "a@uni.test" },
      { provider: "email", providerUserId: U2, userId: U2, email: "b@uni.test" },
      { provider: "google", providerUserId: "1002", userId: U2, email: null },
    ]);
    expect(googleAccounts(rows)).toEqual({ accounts: 2, duplicates: [] });
  });

  it("refuses malformed lines and duplicate identities", () => {
    expect(() => parseIdentities("not json")).toThrow(/identities line 1: not JSON/);
    expect(() => parseIdentities(JSON.stringify({ provider: "google", provider_id: "", user_id: U1 }))).toThrow(/line 1: provider_id/);
    expect(() => parseIdentities(JSON.stringify({ provider: "google", provider_id: "1", user_id: "nope" }))).toThrow(/line 1: user_id/);
    const dup = JSON.stringify({ provider: "google", provider_id: "1", user_id: U1 });
    expect(() => parseIdentities(`${dup}\n${dup}`)).toThrow(/line 2: duplicate google identity/);
  });

  it("flags an account with two Google identities", () => {
    const rows = parseIdentities(
      [JSON.stringify({ provider: "google", provider_id: "1", user_id: U1 }), JSON.stringify({ provider: "google", provider_id: "2", user_id: U1 })].join("\n"),
    );
    expect(googleAccounts(rows)).toEqual({ accounts: 1, duplicates: [U1] });
  });
});
