import { describe, expect, it } from "vitest";
import { securityTxt, SECURITY_TXT_EXPIRES } from "@/lib/security/security-txt";
import { secureCookieName } from "@/lib/security/cookie-name";
import { authCookieOptions } from "@/lib/supabase/cookie-options";

describe("security.txt", () => {
  it("has the RFC 9116 required fields", () => {
    const text = securityTxt("https://www.skilient.com");
    expect(text).toMatch(/^Contact: mailto:security@/m);
    expect(text).toMatch(/^Expires: \d{4}-\d{2}-\d{2}T/m);
    expect(text).toContain("Canonical: https://www.skilient.com/.well-known/security.txt");
  });

  it("does not expire within 60 days (move Expires forward, at most a year ahead)", () => {
    const days = (Date.parse(SECURITY_TXT_EXPIRES) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(60);
    expect(days).toBeLessThanOrEqual(366);
  });
});

describe("session cookie", () => {
  it("is Secure with the __Secure- prefix in production builds", () => {
    expect(authCookieOptions(true)).toEqual({ name: "__Secure-skl-auth", secure: true });
    expect(authCookieOptions(false).secure).toBe(false);
  });
});

describe("app cookie names", () => {
  it("carry the __Secure- prefix in production builds", () => {
    expect(secureCookieName("sk_verify", true)).toBe("__Secure-sk_verify");
    expect(secureCookieName("sk_verify", false)).toBe("sk_verify");
  });
});
