import { scrubPath } from "@/lib/analytics/privacy";

/**
 * Real-user Core Web Vitals for the performance alert (PRD 10: p75 LCP or INP over target for 24 hours;
 * phase 13 question 9). Client-safe. A tenth of page loads report; ids and names in paths are folded so
 * one route is one row group and nothing identifies a person.
 */
export const VITALS_SAMPLE_RATE = 0.1;
export const VITALS_METRICS = ["LCP", "INP", "CLS"] as const;
export type VitalsMetric = (typeof VITALS_METRICS)[number];

const ID_SEGMENT = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/i;

export function vitalsRoute(pathname: string): string {
  const path = scrubPath(pathname.split(/[?#]/)[0] || "/")
    .split("/")
    .map((segment) => (ID_SEGMENT.test(segment) ? ":id" : segment.replace(/[^A-Za-z0-9:_.-]/g, "")))
    .join("/")
    .slice(0, 120);
  return path.startsWith("/") ? path : `/${path}`;
}

export function isVitalsMetric(name: string): name is VitalsMetric {
  return (VITALS_METRICS as readonly string[]).includes(name);
}
