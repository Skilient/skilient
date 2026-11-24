import { scrubPath } from "@/lib/analytics/privacy";

/**
 * CSP violation reports (phase 13 question 15). Browsers send either the legacy `report-uri` body
 * (`application/csp-report`, `{"csp-report": {...}}`) or Reporting API batches (`application/reports+json`,
 * `[{type: "csp-violation", body: {...}}]`). Both are reduced to what a fix needs: the directive, where the
 * blocked thing came from (an origin or a keyword, never a full URL), the page's route and the script that
 * tried. Query strings, fragments and names in paths are dropped.
 */
export const CSP_REPORT_PATH = "/api/csp-report";
export const CSP_REPORT_GROUP = "csp";
export const CSP_REPORT_MAX_BYTES = 16 * 1024;

export interface CspViolation {
  directive: string;
  blocked: string;
  page: string;
  source: string | null;
  line: number | null;
  disposition: "enforce" | "report";
}

type Raw = Record<string, unknown>;

const KEYWORDS = new Set(["inline", "eval", "data", "blob", "self", "wasm-eval", "trusted-types-policy", "trusted-types-sink"]);

function str(value: unknown, max = 200): string | null {
  return typeof value === "string" && value.length > 0 ? value.slice(0, max) : null;
}

/** An origin for URLs, the keyword for 'inline'/'eval'/…, "other" for anything else. */
export function blockedLabel(value: unknown): string {
  const s = str(value, 2048);
  if (!s) return "unknown";
  if (KEYWORDS.has(s)) return s;
  try {
    const url = new URL(s);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "wss:" || url.protocol === "ws:" ? url.origin : url.protocol.replace(/:$/, "");
  } catch {
    return "other";
  }
}

function pageLabel(value: unknown): string {
  const s = str(value, 2048);
  if (!s) return "unknown";
  try {
    return scrubPath(new URL(s).pathname).slice(0, 120);
  } catch {
    return "unknown";
  }
}

function sourceLabel(value: unknown): string | null {
  const s = str(value, 2048);
  if (!s) return null;
  try {
    const url = new URL(s);
    return `${url.origin}${scrubPath(url.pathname)}`.slice(0, 200);
  } catch {
    return null;
  }
}

function fromLegacy(r: Raw): CspViolation | null {
  const directive = str(r["effective-directive"]) ?? str(r["violated-directive"])?.split(" ")[0] ?? null;
  if (!directive) return null;
  return {
    directive,
    blocked: blockedLabel(r["blocked-uri"]),
    page: pageLabel(r["document-uri"]),
    source: sourceLabel(r["source-file"]),
    line: typeof r["line-number"] === "number" ? r["line-number"] : null,
    disposition: r.disposition === "report" ? "report" : "enforce",
  };
}

function fromReportingApi(r: Raw): CspViolation | null {
  const directive = str(r.effectiveDirective);
  if (!directive) return null;
  return {
    directive,
    blocked: blockedLabel(r.blockedURL),
    page: pageLabel(r.documentURL),
    source: sourceLabel(r.sourceFile),
    line: typeof r.lineNumber === "number" ? r.lineNumber : null,
    disposition: r.disposition === "report" ? "report" : "enforce",
  };
}

/** At most 20 violations from one request body; anything unrecognised is skipped. */
export function parseCspReports(body: unknown): CspViolation[] {
  const out: CspViolation[] = [];
  if (Array.isArray(body)) {
    for (const item of body.slice(0, 20)) {
      if (item && typeof item === "object" && (item as Raw).type === "csp-violation" && typeof (item as Raw).body === "object") {
        const v = fromReportingApi((item as Raw).body as Raw);
        if (v) out.push(v);
      }
    }
  } else if (body && typeof body === "object" && typeof (body as Raw)["csp-report"] === "object") {
    const v = fromLegacy((body as Raw)["csp-report"] as Raw);
    if (v) out.push(v);
  }
  return out;
}

/** A small per-instance limiter: report floods come from one browser stuck in a loop. */
export function createLimiter(limit: number, windowMs: number, maxKeys = 5000) {
  const hits = new Map<string, { count: number; start: number }>();
  return (key: string, now = Date.now()): boolean => {
    const entry = hits.get(key);
    if (!entry || now - entry.start >= windowMs) {
      if (hits.size >= maxKeys) hits.clear();
      hits.set(key, { count: 1, start: now });
      return true;
    }
    entry.count += 1;
    return entry.count <= limit;
  };
}
