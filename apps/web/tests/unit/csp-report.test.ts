import { describe, expect, it } from "vitest";
import { buildCsp, reportingEndpoints } from "@/lib/security/headers";
import { blockedLabel, createLimiter, parseCspReports } from "@/lib/security/csp-report";

describe("CSP reporting", () => {
  it("adds report-uri and report-to when asked", () => {
    const csp = buildCsp({ nonce: "n", reportPath: "/api/csp-report" });
    expect(csp).toContain("report-uri /api/csp-report");
    expect(csp).toContain("report-to csp");
    expect(buildCsp({ nonce: "n" })).not.toContain("report-");
    expect(reportingEndpoints("/api/csp-report")).toBe('csp="/api/csp-report"');
  });

  it("reads the legacy report-uri body, keeping origins and routes only", () => {
    const [v] = parseCspReports({
      "csp-report": {
        "document-uri": "https://www.skilient.com/profile/amna?tab=work#x",
        "violated-directive": "script-src-elem 'self'",
        "blocked-uri": "https://evil.example/x.js?token=secret",
        "source-file": "https://www.skilient.com/_next/static/chunks/a.js?v=1",
        "line-number": 12,
      },
    });
    expect(v).toEqual({
      directive: "script-src-elem",
      blocked: "https://evil.example",
      page: "/profile/:username",
      source: "https://www.skilient.com/_next/static/chunks/a.js",
      line: 12,
      disposition: "enforce",
    });
  });

  it("reads Reporting API batches and skips other report types", () => {
    const out = parseCspReports([
      { type: "csp-violation", body: { documentURL: "https://x.test/feed", effectiveDirective: "style-src-attr", blockedURL: "inline", disposition: "report" } },
      { type: "deprecation", body: { id: "x" } },
    ]);
    expect(out).toEqual([{ directive: "style-src-attr", blocked: "inline", page: "/feed", source: null, line: null, disposition: "report" }]);
    expect(parseCspReports("nonsense")).toEqual([]);
    expect(parseCspReports(Array.from({ length: 50 }, () => out.length && { type: "csp-violation", body: { effectiveDirective: "img-src" } }))).toHaveLength(20);
  });

  it("labels what was blocked without full URLs", () => {
    expect(blockedLabel("eval")).toBe("eval");
    expect(blockedLabel("data:image/png;base64,AAAA")).toBe("data");
    expect(blockedLabel("chrome-extension://abc/x.js")).toBe("chrome-extension");
    expect(blockedLabel(undefined)).toBe("unknown");
  });

  it("limits each key per window", () => {
    const allow = createLimiter(2, 1000);
    expect([allow("a", 0), allow("a", 1), allow("a", 2), allow("b", 2), allow("a", 1001)]).toEqual([true, true, false, true, true]);
  });
});
