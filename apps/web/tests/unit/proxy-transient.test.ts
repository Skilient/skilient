import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { busyWithCookies, isTransientError } from "@/lib/supabase/proxy";

describe("isTransientError", () => {
  it("treats network, timeout, pool and 5xx failures as transient", () => {
    expect(isTransientError({ name: "AuthRetryableFetchError", status: 0 })).toBe(true);
    expect(isTransientError({ status: 503 })).toBe(true);
    expect(isTransientError({ code: "57014", status: 500 })).toBe(true);
    expect(isTransientError({ code: "PGRST001" })).toBe(true);
  });

  it("does not treat a real auth refusal as transient", () => {
    expect(isTransientError(null)).toBe(false);
    expect(isTransientError({ name: "AuthApiError", status: 401 })).toBe(false);
    expect(isTransientError({ name: "AuthSessionMissingError", status: 400 })).toBe(false);
  });
});

describe("busyWithCookies", () => {
  it("answers 503 and keeps refreshed cookies", async () => {
    const from = NextResponse.next();
    from.cookies.set("__Secure-skl-auth", "base64-abc");
    from.headers.set("x-request-id", "req-1");
    const res = busyWithCookies(from);
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("5");
    expect(res.headers.get("x-request-id")).toBe("req-1");
    expect(res.cookies.get("__Secure-skl-auth")?.value).toBe("base64-abc");
    expect(await res.text()).toContain("You are still signed in");
  });
});
