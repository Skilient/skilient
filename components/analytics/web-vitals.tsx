"use client";

import { useReportWebVitals } from "next/web-vitals";
import { isVitalsMetric, VITALS_SAMPLE_RATE, vitalsRoute } from "@/lib/monitoring/vitals";

// Decided once per page load, so a sampled visit reports all of its metrics.
const sampled = typeof window !== "undefined" && Math.random() < VITALS_SAMPLE_RATE;

/** Sends LCP, INP and CLS for a tenth of page loads to /api/vitals (docs/alerts.md "Performance"). */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (!sampled || !isVitalsMetric(metric.name)) return;
    const body = JSON.stringify({ route: vitalsRoute(window.location.pathname), metrics: { [metric.name]: metric.value } });
    if (navigator.sendBeacon?.(new URL("/api/vitals", window.location.origin), new Blob([body], { type: "application/json" }))) return;
    void fetch("/api/vitals", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => undefined);
  });
  return null;
}
