import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { Page } from "@playwright/test";

/**
 * A fake PostHog at /ingest for tests against the analytics server (port PORT+1, built with a test key):
 * scripts come from the installed posthog-js, remote config turns replays and heatmaps on, and every
 * payload is decoded. Used by analytics.spec.ts and csp-sweep.spec.ts.
 */
export const KEY = "phc_e2e";
// A session the 20% sample would have to pick by chance; seeded as already sampled so every run records.
export const SESSION = "01a10371-19f2-755f-a7b9-44d388931815";

export interface Sent {
  event: string;
  properties: Record<string, unknown>;
  $set?: Record<string, unknown>;
}

export interface FakePostHog {
  events: Sent[];
  /** Every payload as sent, decoded, plus each replay snapshot decompressed. */
  wire: string[];
  snapshots: { href: string | null; data: string }[];
  /** PostHog scripts the page loaded (the recorder is `lazy-recorder.js`). */
  scripts: string[];
  outsideRequests: string[];
}

export async function fakePostHog(page: Page): Promise<FakePostHog> {
  const fake: FakePostHog = { events: [], wire: [], snapshots: [], scripts: [], outsideRequests: [] };
  await page.addInitScript(
    ({ key, session }) => {
      // posthog-js drops events from automated browsers; this page must look like a person's.
      // It checks navigator.webdriver and the userAgentData brands (headless Chromium lists "HeadlessChrome").
      Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false });
      Object.defineProperty(Navigator.prototype, "userAgentData", { get: () => undefined });
      const store = `ph_${key}_posthog`;
      if (!localStorage.getItem(store)) {
        localStorage.setItem(store, JSON.stringify({ $sesid: [Date.now(), session, Date.now()], $session_is_sampled: session, $replay_sample_rate: 0.2 }));
      }
    },
    { key: KEY, session: SESSION },
  );
  page.on("request", (request) => {
    if (/posthog\.com/.test(request.url())) fake.outsideRequests.push(request.url());
  });
  await page.route("**/ingest/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith("/ingest/static/")) {
      const name = url.pathname.split("/").pop()!;
      fake.scripts.push(name);
      const file = `node_modules/posthog-js/dist/${name}`;
      return existsSync(file)
        ? route.fulfill({ status: 200, contentType: "application/javascript", body: readFileSync(file) })
        : route.fulfill({ status: 404 });
    }
    if (url.pathname.endsWith("/config.js")) return route.fulfill({ status: 404 });
    if (url.pathname.endsWith("/config")) {
      return route.fulfill({ json: { token: KEY, sessionRecording: { endpoint: "/s/" }, heatmaps: true } });
    }
    const body = request.postDataBuffer();
    if (body) {
      const text = decodeBody(body);
      fake.wire.push(text);
      const parsed = JSON.parse(text) as { batch?: Sent[] } | Sent[] | Sent;
      const events = Array.isArray(parsed) ? parsed : "batch" in parsed && parsed.batch ? parsed.batch : [parsed as Sent];
      for (const event of events) {
        fake.events.push(event);
        if (event.event !== "$snapshot") continue;
        for (const item of event.properties.$snapshot_data as { type: number; data: unknown }[]) {
          const data = typeof item.data === "string" ? gunzipSync(Buffer.from(item.data, "latin1")).toString() : JSON.stringify(item.data);
          const href = item.type === 4 ? ((item.data as { href?: string }).href ?? null) : null;
          fake.snapshots.push({ href, data });
          fake.wire.push(data);
        }
      }
    }
    return route.fulfill({ json: { status: 1 } });
  });
  return fake;
}

/** posthog-js sends gzip, JSON, or (on page unload, by beacon) a form field of base64 JSON. */
function decodeBody(body: Buffer): string {
  if (body[0] === 0x1f) return gunzipSync(body).toString();
  const text = body.toString();
  if (!text.startsWith("data=")) return text;
  const decoded = Buffer.from(decodeURIComponent(text.slice(5)), "base64");
  return decoded[0] === 0x1f ? gunzipSync(decoded).toString() : decoded.toString();
}
